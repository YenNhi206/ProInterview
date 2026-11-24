/**
 * Integration CO-09: AI gợi ý cho Platform Moderator khi duyệt rubric công ty.
 * "Xong khi": hiện cảnh báo trong màn duyệt rubric — API trả `aiReview.flags` cho moderator.
 */
import { describe, it, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import {
  applyTestEnv, startMongoHarness, stopMongoHarness, mintAccessToken, startHttpServer, stopHttpServer,
} from "../test_helpers/mongoTestHarness.js";

applyTestEnv();
process.env.MAIL_USER = "";
process.env.MAIL_PASS = "";
process.env.LLM_API_KEY = "test-key";
process.env.LLM_BASE_URL = "http://llm.stub.local/v1";
process.env.LLM_MODEL = "gpt-4o-mini";
delete process.env.LLM_PRESCREEN_MODEL;
delete process.env.ANTHROPIC_API_KEY;
delete process.env.LLM_PROVIDER;
delete process.env.MOCK_AI_SERVICES;
delete process.env.MOCK_AI;

let harness, http, User, Company, CompanyRubric, svc;
const realFetch = globalThis.fetch;
let llmQueue = [];
let llmCalls = [];
let platformMod, companyMod, company;
let seq = 0;

const LEVELS = {
  0: "Không nêu được ví dụ nào về trao đổi với khách hàng.",
  1: "Kể ví dụ nhưng không rõ mình đã nói gì với khách hàng.",
  2: "Có ví dụ cụ thể nhưng thiếu kết quả của cuộc trao đổi.",
  3: "Ví dụ đủ STAR, điều chỉnh cách nói cho từng khách hàng.",
  4: "Như mức 3, kèm kết quả đo được (khách hàng đồng ý ký hợp đồng).",
  5: "Rất tốt",
};

before(async () => {
  globalThis.fetch = async (url, init) => {
    if (String(url).startsWith("http://llm.stub.local")) {
      const body = JSON.parse(init.body);
      llmCalls.push(body);
      const next = llmQueue.shift();
      if (next instanceof Error) return new Response("boom", { status: 400 });
      const content = typeof next === "string" ? next : JSON.stringify(next ?? { summary: "Rubric ổn.", flags: [] });
      return new Response(JSON.stringify({ choices: [{ message: { content } }], usage: { prompt_tokens: 1500, completion_tokens: 200 } }), {
        status: 200, headers: { "Content-Type": "application/json" },
      });
    }
    return realFetch(url, init);
  };
  harness = await startMongoHarness();
  ({ User } = await import("../models/User.js"));
  ({ Company } = await import("../models/Company.js"));
  ({ CompanyRubric } = await import("../models/CompanyRubric.js"));
  svc = await import("../services/rubricReviewService.js");
  http = await startHttpServer((await import("../app.js")).createApp());

  company = await Company.create({ name: "Công ty CO-09", slug: `co09-${Date.now()}`, industry: "IT", status: "active" });
  platformMod = await User.create({ name: "Platform Mod", email: `co09-pmod-${Date.now()}@test.local`, role: "moderator" });
  companyMod = await User.create({ name: "HR CO-09", email: `co09-hr-${Date.now()}@test.local`, role: "company_moderator", companyId: company._id });
});

after(async () => {
  await svc?.waitForPendingRubricReviews();
  globalThis.fetch = realFetch;
  if (http?.server) await stopHttpServer(http.server);
  if (harness) await stopMongoHarness(harness);
});

beforeEach(() => {
  llmQueue = [];
  llmCalls = [];
});

const headers = (user) => ({ "Content-Type": "application/json", Authorization: `Bearer ${mintAccessToken(user._id)}` });
const api = (method, path, user, body) =>
  fetch(`${http.baseUrl}${path}`, { method, headers: headers(user), body: body ? JSON.stringify(body) : undefined })
    .then(async (res) => ({ status: res.status, ...(await res.json()) }));

async function draftRubric() {
  seq += 1;
  return CompanyRubric.create({
    companyId: company._id,
    roleCategory: "backend",
    title: `Rubric CO-09 #${seq}`,
    status: "draft",
    createdBy: companyMod._id,
    criteria: [
      { name: "Thuyết trình với khách hàng", shrmKey: "problem_solving", weight: 60, levels: LEVELS },
      { name: "Giao tiếp", shrmKey: "communication", weight: 40, levels: { ...LEVELS, 4: LEVELS[3], 5: "Như mức 3, thêm khả năng thuyết phục nhóm." } },
    ],
  });
}

const AI_REPLY = {
  summary: "Tiêu chí 1 gắn sai năng lực, mức 5 của tiêu chí 1 mơ hồ.",
  flags: [
    { code: "shrm_mismatch", severity: "critical", criterion: 1, message: "Tiêu chí đo giao tiếp, không phải giải quyết vấn đề.", evidence: "Thuyết trình với khách hàng", suggested_shrm_key: "communication" },
    { code: "vague_scale", severity: "warning", criterion: 1, message: "Mức 5 \"Rất tốt\" không mô tả hành vi.", evidence: "Rất tốt" },
    { code: "approve", severity: "critical", criterion: 1, message: "Mã lạ bị bỏ." },
  ],
};

describe("CO-09: AI kiểm tra rubric cho Platform Moderator", () => {
  it("gửi duyệt → chạy nền, moderator thấy cờ luật + cờ AI trong chi tiết rubric", async () => {
    const rubric = await draftRubric();
    llmQueue.push(AI_REPLY);
    const submit = await api("POST", `/api/company/rubrics/${rubric._id}/submit`, companyMod);
    assert.equal(submit.status, 200, JSON.stringify(submit));
    await svc.waitForPendingRubricReviews();

    assert.equal(llmCalls.length, 1);
    const prompt = llmCalls[0].messages.map((m) => m.content).join("\n");
    assert.match(prompt, /Tiêu chí 1: Thuyết trình với khách hàng \(trọng số 60%\)/);
    assert.match(prompt, /- communication — /, "gửi kèm bộ tiêu chí năng lực");

    const detail = await api("GET", `/api/moderator/rubrics/${rubric._id}`, platformMod);
    assert.equal(detail.status, 200);
    const review = detail.rubric.aiReview;
    assert.equal(review.status, "done");
    assert.equal(review.summary, AI_REPLY.summary);
    assert.equal(review.promptVersion, "rubricreview-v1");
    const got = review.flags.map((f) => `${f.source}:${f.code}@${f.criterionIndex}`);
    assert.deepEqual(got, [
      "ai:shrm_mismatch@0",
      "rule:duplicate_level@1",
      "ai:vague_scale@0",
      "rule:short_level@0",
    ], "critical trước, mã lạ bị bỏ");
    assert.equal(review.flags[0].suggestedShrmKey, "communication");

    // Danh sách cũng có aiReview để hiện số cảnh báo
    const list = await api("GET", "/api/moderator/rubrics?status=pending_review", platformMod);
    assert.equal(list.rubrics.find((r) => String(r._id) === String(rubric._id)).aiReview.flags.length, 4);

    // Gửi duyệt không đổi trạng thái vì AI
    assert.equal((await CompanyRubric.findById(rubric._id).lean()).status, "pending_review");
  });

  it("chạy lại: nội dung không đổi thì dùng kết quả cũ; force thì gọi LLM lại", async () => {
    const rubric = await draftRubric();
    llmQueue.push(AI_REPLY);
    await svc.reviewRubric(rubric._id);
    assert.equal(llmCalls.length, 1);

    const cached = await api("POST", `/api/moderator/rubrics/${rubric._id}/ai-review`, platformMod, {});
    assert.equal(cached.status, 200);
    assert.equal(llmCalls.length, 1, "không gọi LLM lại");
    assert.equal(cached.aiReview.status, "done");

    llmQueue.push({ summary: "Đã ổn.", flags: [] });
    const forced = await api("POST", `/api/moderator/rubrics/${rubric._id}/ai-review`, platformMod, { force: true });
    assert.equal(llmCalls.length, 2);
    assert.equal(forced.aiReview.summary, "Đã ổn.");
    assert.ok(forced.aiReview.flags.every((f) => f.source === "rule"));

    // Sửa nội dung → hash khác → chạy lại
    await CompanyRubric.updateOne({ _id: rubric._id }, { $set: { "criteria.0.name": "Trình bày giải pháp" } });
    llmQueue.push({ summary: "Mới.", flags: [] });
    const changed = await api("POST", `/api/moderator/rubrics/${rubric._id}/ai-review`, platformMod, {});
    assert.equal(llmCalls.length, 3);
    assert.equal(changed.aiReview.summary, "Mới.");
  });

  it("LLM lỗi → status failed, cờ luật vẫn có", async () => {
    const rubric = await draftRubric();
    llmQueue.push(new Error("down"), new Error("down"));
    const res = await api("POST", `/api/moderator/rubrics/${rubric._id}/ai-review`, platformMod, {});
    assert.equal(res.status, 200);
    assert.equal(res.aiReview.status, "failed");
    assert.match(res.aiReview.error, /AI chưa kiểm tra được/);
    assert.deepEqual(res.aiReview.flags.map((f) => f.code).sort(), ["duplicate_level", "short_level"]);
  });

  it("chỉ Platform Moderator gọi được; mã sai 400, không có 404", async () => {
    const rubric = await draftRubric();
    assert.equal((await api("POST", `/api/moderator/rubrics/${rubric._id}/ai-review`, companyMod, {})).status, 403);
    assert.equal((await api("POST", "/api/moderator/rubrics/abc/ai-review", platformMod, {})).status, 400);
    assert.equal((await api("POST", "/api/moderator/rubrics/64b000000000000000000000/ai-review", platformMod, {})).status, 404);
    assert.equal(llmCalls.length, 0);
  });
});
