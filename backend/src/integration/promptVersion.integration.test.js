/**
 * Integration AI-02: PromptVersion — loader, activate, sync, snapshot prompt.
 *
 * Snapshot so với `services/__fixtures__/promptGolden.json`: prompt chụp từ code TRƯỚC khi chuyển
 * sang PromptVersion. Prompt render qua loader (bản mặc định hoặc bản seed trong DB, few-shot rỗng)
 * phải trùng từng ký tự, kể cả max_tokens, temperature, model.
 */
import { describe, it, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import mongoose from "mongoose";
import {
  applyTestEnv, startMongoHarness, stopMongoHarness, mintAccessToken, startHttpServer, stopHttpServer,
} from "../test_helpers/mongoTestHarness.js";
import { captureLLMCalls, QGEN_SCENARIOS, EVAL_SCENARIOS, evalResponse } from "../test_helpers/llmPromptCapture.js";

applyTestEnv();
process.env.MAIL_USER = "";
process.env.MAIL_PASS = "";
// Langfuse bật với host giả để đọc metadata trace (fetch tới host này bị chặn lại trong test).
process.env.LANGFUSE_PUBLIC_KEY = "pk-test";
process.env.LANGFUSE_SECRET_KEY = "sk-test";
process.env.LANGFUSE_HOST = "http://langfuse.stub.local";

const GOLDEN = JSON.parse(readFileSync(new URL("../services/__fixtures__/promptGolden.json", import.meta.url), "utf8"));

let harness;
let http;
let PromptVersion;
let InterviewSession;
let QuestionBank;
let User;
let svc;
let iqs;
let sync;
let registry;
let getFramework;

const realFetch = globalThis.fetch;
let traces = [];

before(async () => {
  globalThis.fetch = async (url, init) => {
    if (String(url).startsWith("http://langfuse.stub.local")) {
      const body = JSON.parse(init.body);
      for (const ev of body.batch ?? []) if (ev.type === "trace-create") traces.push(ev.body);
      return new Response("{}", { status: 200 });
    }
    return realFetch(url, init);
  };
  harness = await startMongoHarness();
  ({ PromptVersion } = await import("../models/PromptVersion.js"));
  ({ InterviewSession } = await import("../models/InterviewSession.js"));
  ({ QuestionBank } = await import("../models/QuestionBank.js"));
  ({ User } = await import("../models/User.js"));
  ({ getFramework } = await import("../services/competencyFramework.js"));
  svc = await import("../services/promptVersionService.js");
  iqs = await import("../services/interviewQuestionService.js");
  sync = await import("../scripts/syncPromptVersions.js");
  ({ PROMPT_REGISTRY: registry } = await import("../prompts/index.js"));
  await PromptVersion.init();
  const { createApp } = await import("../app.js");
  http = await startHttpServer(createApp());
});

after(async () => {
  globalThis.fetch = realFetch;
  svc.__setPromptClock(null);
  if (http?.server) await stopHttpServer(http.server);
  if (harness) await stopMongoHarness(harness);
});

beforeEach(async () => {
  await PromptVersion.deleteMany({});
  await InterviewSession.collection.deleteMany({});
  await QuestionBank.collection.deleteMany({});
  svc.clearPromptCache();
  svc.__setPromptClock(null);
  traces = [];
});

const silent = () => {};
const copy = (v) => JSON.parse(JSON.stringify(v));

/** Template của key với chữ đổi ở phần chính (để nhận ra version mới trong prompt). */
function changedTemplate(key, marker) {
  const t = copy(registry[key].default.template);
  if (key === "evaluation") t.system = t.system.replace("Bạn là chuyên gia đánh giá phỏng vấn", `${marker} Bạn là chuyên gia đánh giá phỏng vấn`);
  else t.system_static = t.system_static.replace("Bạn là chuyên gia phỏng vấn", `${marker} Bạn là chuyên gia phỏng vấn`);
  return t;
}

async function addVersion(key, version, template, extra = {}) {
  return PromptVersion.create({ key, version, template, ...extra });
}

async function runScenarios() {
  const out = { question_gen: {}, evaluation: {} };
  for (const s of QGEN_SCENARIOS) {
    const r = await captureLLMCalls(() => iqs.generateQuestionsFromText(s.input), s.responses);
    if (r.error) throw r.error;
    out.question_gen[s.name] = { calls: r.calls, promptVersion: r.result.promptVersion };
  }
  for (const s of EVAL_SCENARIOS) {
    const r = await captureLLMCalls(() => iqs.evaluateTranscripts(s.input), s.responses);
    if (r.error) throw r.error;
    out.evaluation[s.name] = { calls: r.calls, promptVersion: r.result.promptVersion };
  }
  return out;
}

describe("Snapshot: prompt qua loader trùng prompt trước refactor", () => {
  it("không có bản ghi nào → bản mặc định trong code, trùng golden từng ký tự", async () => {
    assert.deepEqual(await runScenarios(), GOLDEN);
  });

  it("sau sync (bản seed trong DB, few-shot rỗng) → vẫn trùng golden, nguồn là DB", async () => {
    await sync.syncPromptVersions({ log: silent });
    assert.equal((await svc.getActivePrompt("evaluation")).source, "db");
    assert.equal((await svc.getActivePrompt("question_gen")).source, "db");
    assert.deepEqual(await runScenarios(), GOLDEN);
  });

  it("few-shot của version nằm ở vị trí cố định; mảng rỗng thì không đổi gì", async () => {
    await sync.syncPromptVersions({ log: silent });
    await PromptVersion.updateOne({ version: "eval-v1" }, { $set: { fewShotExamples: [{ input: "Câu mẫu", output: "{\"overall\": 2}" }] } });
    svc.clearPromptCache();
    const s = EVAL_SCENARIOS[0];
    const r = await captureLLMCalls(() => iqs.evaluateTranscripts(s.input), s.responses);
    const system = r.calls[0].system[0].text;
    const golden = GOLDEN.evaluation[s.name].calls[0].system[0].text;
    assert.notEqual(system, golden);
    assert.match(system, /## VÍ DỤ ĐÃ ĐƯỢC KIỂM DUYỆT[\s\S]*Câu mẫu[\s\S]*\n\nTrả về JSON hợp lệ/);
    assert.equal(system.replace(/## VÍ DỤ ĐÃ ĐƯỢC KIỂM DUYỆT[\s\S]*?\n\n(?=Trả về JSON hợp lệ)/, ""), golden);
  });
});

describe("Langfuse trace", () => {
  it("generate_questions và evaluate_session gắn metadata.promptVersion và frameworkVersion", async () => {
    await runScenarios();
    const gen = traces.find((t) => t.name === "generate_questions");
    const ev = traces.find((t) => t.name === "evaluate_session");
    assert.equal(gen.metadata.promptVersion, "followup-v1");
    assert.equal(ev.metadata.promptVersion, "eval-v1");
    assert.equal(gen.metadata.frameworkVersion, getFramework().version);
    assert.equal(ev.metadata.frameworkVersion, getFramework().version);
  });
});

describe("activate", () => {
  it("bật version mới thì bản cũ tắt; chỉ 1 bản active; bật lại bản cũ (rollback) được", async () => {
    await sync.syncPromptVersions({ log: silent });
    const by = (await User.create({ name: "Mod", email: `mod-${Date.now()}@test.local`, role: "moderator" }))._id;
    await addVersion("evaluation", "eval-v2", changedTemplate("evaluation", "[V2]"));

    const doc = await svc.activate("evaluation", "eval-v2", { by, note: "thử v2" });
    assert.equal(doc.active, true);
    assert.equal(String(doc.activatedBy), String(by));
    assert.equal(doc.note, "thử v2");
    assert.ok(doc.activatedAt);
    assert.equal((await PromptVersion.findOne({ version: "eval-v1" })).active, false);
    assert.equal(await PromptVersion.countDocuments({ key: "evaluation", active: true }), 1);
    assert.equal(await PromptVersion.countDocuments({ key: "question_gen", active: true }), 1, "key khác không bị ảnh hưởng");

    await svc.activate("evaluation", "eval-v1");
    assert.equal((await PromptVersion.findOne({ version: "eval-v1" })).active, true);
    assert.equal(await PromptVersion.countDocuments({ key: "evaluation", active: true }), 1);
  });

  it("version không tồn tại → 404; chuỗi legacy → 400; key lạ → 400", async () => {
    await sync.syncPromptVersions({ log: silent });
    await addVersion("evaluation", "eval-old-format", null, { legacy: true });
    await assert.rejects(svc.activate("evaluation", "eval-v9"), (e) => e.status === 404 && /Không tìm thấy/.test(e.message));
    await assert.rejects(svc.activate("evaluation", "eval-old-format"), (e) => e.status === 400 && /chuỗi cũ/.test(e.message));
    await assert.rejects(svc.activate("khong_co", "x-v1"), (e) => e.status === 400);
    assert.equal((await PromptVersion.findOne({ version: "eval-v1" })).active, true, "không đổi gì");
  });

  it("template thiếu phần / thiếu biến / biến lạ → từ chối bật, báo lỗi rõ, giữ bản cũ", async () => {
    await sync.syncPromptVersions({ log: silent });
    const missingPart = copy(registry.evaluation.default.template);
    delete missingPart.qa_index;
    const missingVar = copy(registry.evaluation.default.template);
    missingVar.qa_header = "### Câu {{n}} — {{competencyName}}";
    const unknownVar = copy(registry.question_gen.default.template);
    unknownVar.user = `${unknownVar.user} {{secret}}`;
    await addVersion("evaluation", "eval-v2", missingPart);
    await addVersion("evaluation", "eval-v3", missingVar);
    await addVersion("question_gen", "followup-v2", unknownVar);

    await assert.rejects(svc.activate("evaluation", "eval-v2"), (e) => e.status === 400 && /Thiếu phần "qa_index"/.test(e.message));
    await assert.rejects(svc.activate("evaluation", "eval-v3"), (e) => e.status === 400 && /qa_header" thiếu biến \{\{layer\}\}/.test(e.message));
    await assert.rejects(svc.activate("question_gen", "followup-v2"), (e) => e.status === 400 && /biến lạ \{\{secret\}\}/.test(e.message));
    assert.equal((await PromptVersion.findOne({ version: "eval-v1" })).active, true);
    assert.equal((await PromptVersion.findOne({ version: "followup-v1" })).active, true);
  });

  it("DB không bao giờ có 2 bản active cùng key; tên version theo quy ước và duy nhất toàn bảng", async () => {
    await sync.syncPromptVersions({ log: silent });
    await assert.rejects(addVersion("evaluation", "eval-v2", changedTemplate("evaluation", "x"), { active: true }), /E11000/);
    await assert.rejects(addVersion("evaluation", "v2", changedTemplate("evaluation", "x")), /<tiền tố>-vN/);
    await assert.rejects(addVersion("evaluation", "followup-v7", changedTemplate("evaluation", "x")), /bắt đầu bằng "eval-v"/);
    // Cùng chuỗi ở key khác → unique trên riêng version chặn
    await assert.rejects(PromptVersion.create({ key: "question_gen", version: "eval-v1", template: null, legacy: true }), /E11000/);
  });

  it("2 lần activate song song vẫn chỉ còn đúng 1 bản active", async () => {
    await sync.syncPromptVersions({ log: silent });
    await addVersion("evaluation", "eval-v2", changedTemplate("evaluation", "[V2]"));
    await addVersion("evaluation", "eval-v3", changedTemplate("evaluation", "[V3]"));
    await Promise.allSettled([svc.activate("evaluation", "eval-v2"), svc.activate("evaluation", "eval-v3")]);
    assert.equal(await PromptVersion.countDocuments({ key: "evaluation", active: true }), 1);
  });
});

describe("Loader", () => {
  it("đổi bản active trong DB → lần gọi sau TTL nhận version mới, không cần khởi động lại", async () => {
    let t = 1_000_000;
    svc.__setPromptClock(() => t);
    await sync.syncPromptVersions({ log: silent });
    assert.equal((await svc.getActivePrompt("evaluation")).version, "eval-v1");

    // Đổi trực tiếp trong DB (giả lập instance khác chạy activate) → instance này còn cache.
    await addVersion("evaluation", "eval-v2", changedTemplate("evaluation", "[V2]"));
    await PromptVersion.updateOne({ version: "eval-v1" }, { $set: { active: false } });
    await PromptVersion.updateOne({ version: "eval-v2" }, { $set: { active: true } });
    t += svc.PROMPT_CACHE_TTL_MS - 1;
    assert.equal((await svc.getActivePrompt("evaluation")).version, "eval-v1", "còn trong TTL");
    t += 2;
    assert.equal((await svc.getActivePrompt("evaluation")).version, "eval-v2", "hết TTL");
  });

  it("activate() có hiệu lực ngay ở instance gọi nó", async () => {
    svc.__setPromptClock(() => 5_000_000); // đồng hồ đứng yên: chỉ activate mới xóa được cache
    await sync.syncPromptVersions({ log: silent });
    assert.equal((await svc.getActivePrompt("question_gen")).version, "followup-v1");
    await addVersion("question_gen", "followup-v2", changedTemplate("question_gen", "[F2]"));
    await svc.activate("question_gen", "followup-v2");
    assert.equal((await svc.getActivePrompt("question_gen")).version, "followup-v2");
  });

  it("không có bản active → bản mặc định, không ném lỗi", async () => {
    const p = await svc.getActivePrompt("evaluation");
    assert.equal(p.source, "default");
    assert.equal(p.version, "eval-v1");
  });

  it("DB lỗi → bản mặc định; version ghi vào kết quả là eval-v1 dù DB đang active eval-v2", async () => {
    await sync.syncPromptVersions({ log: silent });
    await addVersion("evaluation", "eval-v2", changedTemplate("evaluation", "[V2]"));
    await svc.activate("evaluation", "eval-v2");
    svc.clearPromptCache();
    const realFindOne = PromptVersion.findOne;
    PromptVersion.findOne = () => { throw new Error("mất kết nối giả lập"); };
    try {
      const s = EVAL_SCENARIOS[0];
      const r = await captureLLMCalls(() => iqs.evaluateTranscripts(s.input), s.responses);
      assert.equal(r.error, null);
      assert.equal(r.result.promptVersion, "eval-v1");
      assert.deepEqual(r.calls, GOLDEN.evaluation[s.name].calls, "chạy đúng prompt mặc định");
    } finally {
      PromptVersion.findOne = realFindOne;
      svc.clearPromptCache();
    }
  });

  it("bản active trong DB có template hỏng (ghi tay, bỏ qua activate) → bản mặc định followup-v1", async () => {
    const broken = copy(registry.question_gen.default.template);
    delete broken.variety_hints;
    await PromptVersion.collection.insertOne({ key: "question_gen", version: "followup-v5", template: broken, fewShotExamples: [], active: true, legacy: false });
    const s = QGEN_SCENARIOS[0];
    const r = await captureLLMCalls(() => iqs.generateQuestionsFromText(s.input), s.responses);
    assert.equal(r.error, null);
    assert.equal(r.result.promptVersion, "followup-v1");
    assert.ok(r.result.questions.every((q) => q.promptVersion === undefined || q.promptVersion === "followup-v1"));
    assert.deepEqual(r.calls, GOLDEN.question_gen[s.name].calls);
  });
});

describe("syncPromptVersions", () => {
  it("chạy 2 lần không tạo bản trùng; chuỗi cũ trong dữ liệu đều có bản ghi legacy", async () => {
    await InterviewSession.collection.insertMany([
      { questions: [{ promptVersion: "followup-v1" }, { promptVersion: "qgen-2025" }], feedback: { promptVersion: "eval-legacy" } },
      { questions: [{ promptVersion: "" }], feedback: { promptVersion: "" } },
    ]);
    await QuestionBank.collection.insertMany([
      { textHash: "h1", orgId: null, generatedBy: { promptVersion: "followup-v0" }, provenance: { promptVersion: "followup-v0" } },
      { textHash: "h2", orgId: null, generatedBy: { promptVersion: "" }, provenance: { promptVersion: "prov-only" } },
    ]);

    const first = await sync.syncPromptVersions({ log: silent });
    assert.deepEqual(first.created.sort(), ["companyq-v1", "eval-v1", "followup-v1", "prescreen-v1", "rubric-v1"]);
    assert.deepEqual(first.legacyCreated.sort(), ["eval-legacy", "followup-v0", "prov-only", "qgen-2025"]);
    const count = await PromptVersion.countDocuments();
    assert.equal(count, 9);

    const second = await sync.syncPromptVersions({ log: silent });
    assert.deepEqual(second, { created: [], activated: [], legacyCreated: [], mismatched: [], conflicts: [] });
    assert.equal(await PromptVersion.countDocuments(), count);

    const legacy = await PromptVersion.findOne({ version: "eval-legacy" }).lean();
    assert.equal(legacy.key, "evaluation");
    assert.equal(legacy.template, null);
    assert.equal(legacy.legacy, true);
    assert.equal(legacy.active, false);
    assert.equal((await PromptVersion.findOne({ version: "qgen-2025" })).key, "question_gen");
    for (const key of ["evaluation", "question_gen", "company_question_gen", "course_prescreen", "rubric_scoring"]) {
      assert.equal(await PromptVersion.countDocuments({ key, active: true }), 1, `${key}: đúng 1 bản active`);
    }
  });

  it("CO-04: chuỗi version của câu công ty (orgId có giá trị) gắn key company_question_gen", async () => {
    await QuestionBank.collection.insertMany([
      { textHash: "c1", orgId: new mongoose.Types.ObjectId(), provenance: { promptVersion: "companyq-v0" } },
    ]);
    const r = await sync.syncPromptVersions({ log: silent });
    assert.deepEqual(r.legacyCreated, ["companyq-v0"]);
    assert.equal((await PromptVersion.findOne({ version: "companyq-v0" })).key, "company_question_gen");
  });

  it("không bật lại bản mặc định khi đã có version khác active; dry run không ghi", async () => {
    const dry = await sync.syncPromptVersions({ dryRun: true, log: silent });
    assert.deepEqual(dry.created.sort(), ["companyq-v1", "eval-v1", "followup-v1", "prescreen-v1", "rubric-v1"]);
    assert.equal(await PromptVersion.countDocuments(), 0);

    await sync.syncPromptVersions({ log: silent });
    await addVersion("evaluation", "eval-v2", changedTemplate("evaluation", "[V2]"));
    await svc.activate("evaluation", "eval-v2");
    await sync.syncPromptVersions({ log: silent });
    assert.equal((await PromptVersion.findOne({ key: "evaluation", active: true })).version, "eval-v2");
  });

  it("template trong DB khác code ở cùng version → cảnh báo, không ghi đè", async () => {
    await sync.syncPromptVersions({ log: silent });
    await PromptVersion.updateOne({ version: "eval-v1" }, { $set: { "template.qa_question": "Hỏi: {{question}}" } });
    const lines = [];
    const r = await sync.syncPromptVersions({ log: (l) => lines.push(l) });
    assert.deepEqual(r.mismatched, ["eval-v1"]);
    assert.ok(lines.some((l) => /template trong DB khác code/.test(l)));
    assert.equal((await PromptVersion.findOne({ version: "eval-v1" }).lean()).template.qa_question, "Hỏi: {{question}}");
  });
});

describe("Session ghi đúng version", () => {
  it("chấm điểm sau khi activate eval-v2 → feedback.promptVersion = eval-v2, prompt dùng chữ mới", async () => {
    await sync.syncPromptVersions({ log: silent });
    await addVersion("evaluation", "eval-v2", changedTemplate("evaluation", "[V2]"));
    await svc.activate("evaluation", "eval-v2");

    const user = await User.create({ name: "Cand", email: `cand-${Date.now()}@test.local` });
    const session = await InterviewSession.create({
      userId: user._id, hrGender: "female", status: "completed",
      questions: [
        { id: "b1", question: "Giới thiệu về bản thân bạn", competencyName: "Giao tiếp" },
        { id: "b2", question: "Kể về một dự án khó", competencyName: "Giải quyết vấn đề" },
      ],
      answers: [
        { questionIndex: 0, transcript: "Em là kỹ sư backend." },
        { questionIndex: 1, transcript: "Em tối ưu hệ thống thanh toán." },
      ],
    });
    const r = await captureLLMCalls(
      () => fetch(`${http.baseUrl}/api/interviews/sessions/${session._id}/evaluate`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${mintAccessToken(user._id)}` },
        body: "{}",
      }),
      [evalResponse([0, 1])],
    );
    assert.equal(r.result.status, 200);
    assert.match(r.calls[0].system[0].text, /^\[V2\] Bạn là chuyên gia đánh giá phỏng vấn/);
    assert.equal((await InterviewSession.findById(session._id).lean()).feedback.promptVersion, "eval-v2");
  });

  it("sinh câu sau khi activate followup-v2 → câu hỏi và trace mang followup-v2", async () => {
    await sync.syncPromptVersions({ log: silent });
    await addVersion("question_gen", "followup-v2", changedTemplate("question_gen", "[F2]"));
    await svc.activate("question_gen", "followup-v2");
    const s = QGEN_SCENARIOS[1];
    const r = await captureLLMCalls(() => iqs.generateQuestionsFromText(s.input), s.responses);
    assert.equal(r.result.promptVersion, "followup-v2");
    assert.match(r.calls[0].system[0].text, /^\[F2\] Bạn là chuyên gia phỏng vấn/);
    assert.equal(traces.find((t) => t.name === "generate_questions").metadata.promptVersion, "followup-v2");
  });
});
