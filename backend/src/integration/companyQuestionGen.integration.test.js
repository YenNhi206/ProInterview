/**
 * CO-04: POST /api/company/questions/generate — AI sinh bộ 8–12 câu nháp theo roleCategory.
 * LLM giả lập qua captureLLMCalls (chặn fetch tới api.anthropic.com).
 */
import { describe, it, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import {
  applyTestEnv,
  startMongoHarness,
  stopMongoHarness,
  mintAccessToken,
  startHttpServer,
  stopHttpServer,
} from "../test_helpers/mongoTestHarness.js";
import { captureLLMCalls } from "../test_helpers/llmPromptCapture.js";

applyTestEnv();

let harness;
let http;
let User;
let Company;
let QuestionBank;
let PromptVersion;
let hashQuestionText;
let isValidCompetencyKey;
let clearPromptCache;

let companyA;
let companyB;
let modA;
let modB;
let platformMod;
let candidate;

before(async () => {
  harness = await startMongoHarness();
  ({ User } = await import("../models/User.js"));
  ({ Company } = await import("../models/Company.js"));
  ({ QuestionBank, hashQuestionText } = await import("../models/QuestionBank.js"));
  ({ PromptVersion } = await import("../models/PromptVersion.js"));
  ({ isValidCompetencyKey } = await import("../services/competencyFramework.js"));
  ({ clearPromptCache } = await import("../services/promptVersionService.js"));
  await QuestionBank.init();
  const { createApp } = await import("../app.js");
  http = await startHttpServer(createApp());

  const stamp = Date.now();
  companyA = await Company.create({ name: "Công ty A", slug: `cong-ty-a-${stamp}`, status: "active" });
  companyB = await Company.create({ name: "Công ty B", slug: `cong-ty-b-${stamp}`, status: "active" });
  modA = await User.create({ name: "HR A", email: `hr-a-${stamp}@test.local`, role: "company_moderator", companyId: companyA._id });
  modB = await User.create({ name: "HR B", email: `hr-b-${stamp}@test.local`, role: "company_moderator", companyId: companyB._id });
  platformMod = await User.create({ name: "Platform Mod", email: `pmod-${stamp}@test.local`, role: "moderator" });
  candidate = await User.create({ name: "Ứng viên", email: `cand-${stamp}@test.local`, role: "customer" });
});

after(async () => {
  if (http?.server) await stopHttpServer(http.server);
  if (harness) await stopMongoHarness(harness);
});

beforeEach(async () => {
  await QuestionBank.deleteMany({});
  await PromptVersion.deleteMany({});
  clearPromptCache();
});

const headers = (userId) => ({
  Authorization: `Bearer ${mintAccessToken(userId)}`,
  "Content-Type": "application/json",
  Accept: "application/json",
});

function generate(userId, body) {
  return fetch(`${http.baseUrl}/api/company/questions/generate`, {
    method: "POST",
    headers: headers(userId),
    body: JSON.stringify(body),
  });
}

/** Câu LLM giả lập; `n` khác nhau thì nội dung khác nhau. */
const llmQuestion = (n, extra = {}) => ({
  layer: n % 2 ? "behavior" : "theory",
  seniority: "middle",
  competency_id: "problem_solving",
  ddi_key_action_targeted: "Phân tích nguyên nhân gốc",
  question: `Kể về lần bạn xử lý sự cố API số ${n} khi lưu lượng tăng đột biến, bạn làm gì?`,
  star_guidance: { situation: ["Hệ thống quá tải"], task: ["Khôi phục dịch vụ"], action: ["Đọc log"], result: ["Giảm lỗi"] },
  expected_keywords: ["root cause", "rollback", "monitoring"],
  deep_dive: ["Bạn đo kết quả bằng chỉ số nào?"],
  shrm_rubric_excellent: "Nêu đủ STAR và số liệu.",
  ...extra,
});
const llmResponse = (questions) => JSON.stringify({ questions });
const tenQuestions = () => Array.from({ length: 10 }, (_, i) => llmQuestion(i + 1));

/** Gọi HTTP trong lúc chặn LLM; trả về response, body và các lần gọi LLM. */
async function generateWithLLM(userId, body, responses) {
  const r = await captureLLMCalls(async () => {
    const res = await generate(userId, body);
    return { status: res.status, body: await res.json() };
  }, responses);
  if (r.error) throw r.error;
  return { ...r.result, calls: r.calls };
}

describe("CO-04: sinh bộ câu nháp cho công ty", () => {
  it("sinh 10 câu draft, orgId = công ty, source org_template, ghi provenance.promptVersion", async () => {
    const { status, body, calls } = await generateWithLLM(modA._id, { roleCategory: "backend" }, [llmResponse(tenQuestions())]);

    assert.equal(status, 201, JSON.stringify(body));
    assert.equal(body.success, true);
    assert.equal(body.count, 10);
    assert.equal(body.promptVersion, "companyq-v1");
    assert.equal(calls.length, 1);
    assert.match(calls[0].user, /Lập trình viên Backend/);

    const docs = await QuestionBank.find({ orgId: companyA._id }).lean();
    assert.equal(docs.length, 10);
    for (const d of docs) {
      assert.equal(d.source, "org_template");
      assert.equal(d.status, "draft");
      assert.equal(d.roleCategory, "backend");
      assert.equal(d.provenance.promptVersion, "companyq-v1");
      assert.equal(d.generatedBy.promptVersion, "companyq-v1");
      assert.equal(d.textHash, hashQuestionText(d.text));
      assert.equal(d.history[0].action, "create");
      assert.equal(String(d.createdBy), String(modA._id));
    }
  });

  it("chỉ gửi năng lực của vị trí; key lạ từ LLM đổi sang key trong bộ tiêu chí; câu quá ngắn và trùng trong lượt bị bỏ", async () => {
    const qs = tenQuestions();
    qs[0].competency_id = "technical_mastery"; // không có trong LP-01
    qs[1] = { ...qs[2] };                       // trùng câu 3
    qs[3].question = "Ngắn quá?";               // < 15 ký tự
    const { status, body, calls } = await generateWithLLM(modA._id, { roleCategory: "backend", count: 10 }, [llmResponse(qs)]);

    assert.equal(status, 201, JSON.stringify(body));
    assert.equal(body.count, 8);
    assert.match(calls[0].system, /\(technical_learning\)/);
    const docs = await QuestionBank.find({ orgId: companyA._id }).lean();
    assert.ok(docs.every((d) => isValidCompetencyKey(d.competencyId)), "mọi competencyId thuộc bộ tiêu chí");
    assert.ok(!docs.some((d) => d.competencyId === "technical_mastery"));
  });

  it("không lưu câu trùng textHash với câu đã có của công ty (kể cả khác hoa/thường, dấu chấm cuối); công ty khác không bị chặn", async () => {
    const dupText = llmQuestion(1).question;
    await QuestionBank.create({
      text: `${dupText.toUpperCase()}.`, textHash: hashQuestionText(`${dupText.toUpperCase()}.`),
      orgId: companyA._id, source: "org_template", status: "rejected", roleCategory: "backend",
    });

    const a = await generateWithLLM(modA._id, { roleCategory: "backend" }, [llmResponse(tenQuestions())]);
    assert.equal(a.status, 201);
    assert.equal(a.body.count, 9);
    assert.equal(a.body.skippedDuplicates, 1);
    assert.match(a.body.message, /Bỏ qua 1 câu trùng/);

    const b = await generateWithLLM(modB._id, { roleCategory: "backend" }, [llmResponse(tenQuestions())]);
    assert.equal(b.body.count, 10, "trùng chỉ xét trong phạm vi một công ty");
  });

  it("câu đã có (chưa bị từ chối) của vị trí được đưa vào prompt để tránh lặp ý", async () => {
    await QuestionBank.create({
      text: "Bạn thiết kế idempotency cho API thanh toán thế nào?", textHash: hashQuestionText("Bạn thiết kế idempotency cho API thanh toán thế nào?"),
      orgId: companyA._id, source: "org_template", status: "approved", roleCategory: "backend",
    });
    await QuestionBank.create({
      text: "Câu đã bị từ chối không cần đưa vào prompt nữa", textHash: hashQuestionText("Câu đã bị từ chối không cần đưa vào prompt nữa"),
      orgId: companyA._id, source: "org_template", status: "rejected", roleCategory: "backend",
    });
    const { calls } = await generateWithLLM(modA._id, { roleCategory: "backend" }, [llmResponse(tenQuestions())]);
    assert.match(calls[0].system, /idempotency cho API thanh toán/);
    assert.doesNotMatch(calls[0].system, /Câu đã bị từ chối/);
  });

  it("Platform Moderator không thấy câu công ty ở /api/moderator/questions", async () => {
    const poolText = "Câu pool chung để đối chứng: bạn ưu tiên việc thế nào khi có nhiều deadline?";
    await QuestionBank.create({
      text: poolText, textHash: hashQuestionText(poolText), orgId: null, source: "moderator", status: "draft",
    });
    await generateWithLLM(modA._id, { roleCategory: "backend" }, [llmResponse(tenQuestions())]);
    const res = await fetch(`${http.baseUrl}/api/moderator/questions?limit=100`, { headers: headers(platformMod._id) });
    const body = await res.json();
    assert.equal(res.status, 200, JSON.stringify(body));
    assert.ok(Array.isArray(body.questions), JSON.stringify(body));
    assert.deepEqual(body.questions.map((q) => q.text ?? q.question), [poolText], "chỉ thấy câu pool chung");
  });

  it("output không phải JSON → gọi sửa JSON 1 lần rồi lưu", async () => {
    const { status, body, calls } = await generateWithLLM(
      modA._id, { roleCategory: "frontend", count: 8 },
      ["Đây là câu hỏi: không phải JSON", llmResponse(tenQuestions())],
    );
    assert.equal(status, 201, JSON.stringify(body));
    assert.equal(body.count, 8);
    assert.equal(calls.length, 2);
  });

  it("LLM trả rác cả 2 lần → 502 tiếng Việt, không lưu gì", async () => {
    const { status, body } = await generateWithLLM(modA._id, { roleCategory: "backend" }, ["rác", "vẫn rác"]);
    assert.equal(status, 502);
    assert.equal(body.success, false);
    assert.match(body.error, /AI chưa sinh được bộ câu hỏi/);
    assert.equal(await QuestionBank.countDocuments({}), 0);
  });

  it("JSON hợp lệ nhưng không có câu dùng được → 502", async () => {
    const { status, body } = await generateWithLLM(modA._id, { roleCategory: "backend" }, [llmResponse([{ question: "" }])]);
    assert.equal(status, 502);
    assert.match(body.error, /không hợp lệ/);
  });

  it("roleCategory lạ hoặc số câu ngoài 8–12 → 400, không gọi LLM", async () => {
    for (const body of [{ roleCategory: "astronaut" }, { roleCategory: "backend", count: 7 }, { roleCategory: "backend", count: 13 }, { roleCategory: "backend", count: "10x" }]) {
      const r = await generateWithLLM(modA._id, body, [llmResponse(tenQuestions())]);
      assert.equal(r.status, 400, JSON.stringify(body));
      assert.equal(r.calls.length, 0);
    }
  });

  it("chưa cấu hình LLM → 503 tiếng Việt", async () => {
    const saved = { LLM_API_KEY: process.env.LLM_API_KEY, ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY };
    delete process.env.LLM_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;
    try {
      const res = await generate(modA._id, { roleCategory: "backend" });
      const body = await res.json();
      assert.equal(res.status, 503);
      assert.match(body.error, /chưa được cấu hình/);
    } finally {
      for (const [k, v] of Object.entries(saved)) if (v !== undefined) process.env[k] = v;
    }
  });

  it("role khác company_moderator bị chặn 403", async () => {
    for (const user of [platformMod, candidate]) {
      const r = await generateWithLLM(user._id, { roleCategory: "backend" }, [llmResponse(tenQuestions())]);
      assert.equal(r.status, 403);
      assert.equal(r.calls.length, 0);
    }
  });
});
