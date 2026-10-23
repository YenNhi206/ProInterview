/**
 * Integration: harvest câu follow-up vào QuestionBank + chính sách không phục vụ câu deprecated
 * (POST /api/interviews/sessions/:id/generate-followup-questions).
 *
 * LLM OpenAI-compatible được stub qua globalThis.fetch: mỗi lần gọi lấy 1 bộ câu từ `llmQueue`.
 */
import { describe, it, before, after, beforeEach, mock } from "node:test";
import assert from "node:assert/strict";
import {
  applyTestEnv,
  startMongoHarness,
  stopMongoHarness,
  mintAccessToken,
  startHttpServer,
  stopHttpServer,
} from "../test_helpers/mongoTestHarness.js";

applyTestEnv();
// Không mở kết nối SMTP thật (giữ event loop sống → test file không thoát).
process.env.MAIL_USER = "";
process.env.MAIL_PASS = "";
process.env.LLM_API_KEY = "test-key";
process.env.LLM_BASE_URL = "http://llm.stub.local/v1";
process.env.LLM_MODEL = "stub-model";
delete process.env.ANTHROPIC_API_KEY;
delete process.env.LLM_PROVIDER;

let harness;
let http;
let User;
let InterviewSession;
let QuestionBank;
let hashQuestionText;

const realFetch = globalThis.fetch;
/** Mỗi phần tử: mảng câu LLM trả về cho 1 lần gọi. */
let llmQueue = [];
let llmCalls = 0;

function llmQuestion(text, competencyId = "problem_solving") {
  return { id: "q1", question: text, competency_id: competencyId, layer: "behavior", seniority: "junior" };
}

before(async () => {
  globalThis.fetch = async (url, init) => {
    if (String(url).startsWith("http://llm.stub.local")) {
      llmCalls++;
      const questions = llmQueue.shift() ?? [];
      const content = JSON.stringify({ questions, inferred_role: "Backend", inferred_seniority: "junior" });
      return new Response(
        JSON.stringify({ choices: [{ message: { content } }], usage: { prompt_tokens: 10, completion_tokens: 10 } }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }
    return realFetch(url, init);
  };
  harness = await startMongoHarness();
  ({ User } = await import("../models/User.js"));
  ({ InterviewSession } = await import("../models/InterviewSession.js"));
  ({ QuestionBank, hashQuestionText } = await import("../models/QuestionBank.js"));
  await QuestionBank.init();
  const { createApp } = await import("../app.js");
  http = await startHttpServer(createApp());
});

after(async () => {
  globalThis.fetch = realFetch;
  if (http?.server) await stopHttpServer(http.server);
  if (harness) await stopMongoHarness(harness);
});

beforeEach(() => {
  llmQueue = [];
  llmCalls = 0;
});

let seq = 0;
async function proSessionWithBaseline() {
  seq++;
  const expires = new Date();
  expires.setMonth(expires.getMonth() + 1);
  const user = await User.create({
    name: "Pro HITL",
    email: `hitl-${seq}-${Date.now()}@test.local`,
    plan: "elite_pro",
    planExpiresAt: expires,
    quota: { cvAnalysisLimit: 30, interviewLimit: 8, interviewQuestionsAllowed: 5 },
  });
  const session = await InterviewSession.create({
    userId: user._id,
    hrGender: "female",
    status: "in_progress",
    questions: [1, 2, 3].map((n) => ({ id: `b${n}`, question: `Câu baseline số ${n} — hãy giới thiệu về bản thân bạn` })),
  });
  return { user, session };
}

function generateFollowUp(user, sessionId) {
  return fetch(`${http.baseUrl}/api/interviews/sessions/${sessionId}/generate-followup-questions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${mintAccessToken(user._id)}` },
    body: JSON.stringify({ cvText: "Backend engineer Node.js", baselineAnswers: [] }),
  });
}

describe("Harvest câu follow-up", () => {
  it("cùng câu sinh 2 lần → 1 document, usageCount = 2, pending_review, gắn questionBankId", async () => {
    const qa = "Kể về lần bạn debug một lỗi production khó nhất và cách bạn tìm ra nguyên nhân";
    const qb = "Bạn đã thiết kế cơ chế retry cho một API không ổn định như thế nào";

    for (let round = 0; round < 2; round++) {
      llmQueue.push([llmQuestion(qa), llmQuestion(qb, "communication")]);
      const { user, session } = await proSessionWithBaseline();
      const res = await generateFollowUp(user, session._id);
      assert.equal(res.status, 200);
      const body = await res.json();
      assert.equal(body.questions.length, 2);
      assert.ok(body.questions.every((q) => q.questionBankId));
      const saved = await InterviewSession.findById(session._id).lean();
      assert.ok(saved.questions[3].questionBankId);
      assert.equal(saved.questions[3].promptVersion, "followup-v1");
    }

    const docs = await QuestionBank.find({ textHash: hashQuestionText(qa) }).lean();
    assert.equal(docs.length, 1);
    assert.equal(docs[0].usageCount, 2);
    assert.equal(docs[0].status, "pending_review");
    assert.equal(docs[0].source, "llm_followup");
    assert.equal(docs[0].originalText, qa);
    assert.equal(docs[0].generatedBy.promptVersion, "followup-v1");
    assert.equal(docs[0].generatedBy.model, "stub-model");
    assert.equal(docs[0].sampleSessionIds.length, 2);
  });

  it("harvest lỗi không làm hỏng response follow-up", async () => {
    llmQueue.push([
      llmQuestion("Hãy mô tả một quyết định kỹ thuật bạn từng phải đánh đổi giữa tốc độ và chất lượng"),
      llmQuestion("Bạn xử lý thế nào khi bất đồng ý kiến với trưởng nhóm về giải pháp", "communication"),
    ]);
    const { user, session } = await proSessionWithBaseline();
    const spy = mock.method(QuestionBank, "findOneAndUpdate", async () => {
      throw new Error("bank down");
    });
    try {
      const res = await generateFollowUp(user, session._id);
      assert.equal(res.status, 200);
      const body = await res.json();
      assert.equal(body.questions.length, 2);
      const saved = await InterviewSession.findById(session._id).lean();
      assert.equal(saved.questions.length, 5);
    } finally {
      spy.mock.restore();
    }
  });
});

describe("Chính sách deprecated", () => {
  it("câu deprecated được thay bằng câu approved cùng competency", async () => {
    const dep = "Câu hỏi đã bị khai tử vì lạc đề hoàn toàn với vị trí ứng tuyển";
    const approved = "Kể về một lần bạn chủ động tìm nguyên nhân gốc rễ của sự cố hệ thống";
    await QuestionBank.create({ text: dep, source: "llm_followup", status: "deprecated", competencyId: "problem_solving", textHash: hashQuestionText(dep) });
    await QuestionBank.create({ text: approved, source: "moderator", status: "approved", competencyId: "problem_solving", textHash: hashQuestionText(approved) });

    llmQueue.push([llmQuestion(dep), llmQuestion("Bạn ưu tiên công việc ra sao khi có nhiều deadline trùng nhau", "time_management")]);
    const { user, session } = await proSessionWithBaseline();
    const body = await (await generateFollowUp(user, session._id)).json();
    const texts = body.questions.map((q) => q.question);
    assert.ok(!texts.includes(dep), "không được trả câu deprecated");
    assert.ok(texts.includes(approved));
    assert.equal(llmCalls, 1, "có câu approved thay thế → không cần regenerate");
  });

  it("không có câu approved → regenerate 1 lần; câu deprecated không về session mới", async () => {
    const dep = "Một câu hỏi deprecated khác thuộc năng lực lãnh đạo nhóm nhỏ";
    await QuestionBank.create({ text: dep, source: "llm_followup", status: "deprecated", competencyId: "leadership", textHash: hashQuestionText(dep) });
    const fresh = "Kể về lần bạn dẫn dắt nhóm vượt qua giai đoạn áp lực cao trước hạn chót";

    llmQueue.push([llmQuestion(dep, "leadership"), llmQuestion("Bạn học công nghệ mới nhanh bằng cách nào trong dự án gần nhất", "learning_agility")]);
    llmQueue.push([llmQuestion(fresh, "leadership")]);
    const { user, session } = await proSessionWithBaseline();
    const body = await (await generateFollowUp(user, session._id)).json();
    const texts = body.questions.map((q) => q.question);
    assert.equal(llmCalls, 2);
    assert.ok(!texts.includes(dep));
    assert.ok(texts.includes(fresh));
    const saved = await InterviewSession.findById(session._id).lean();
    assert.ok(!saved.questions.some((q) => q.question === dep));
  });
});

describe("Chuỗi dự phòng — buổi phỏng vấn không bao giờ thiếu câu", () => {
  let applyDeprecationPolicy;
  let syncFallbackQuestions;
  let FALLBACK_QUESTIONS;
  const deprecate = (text, competencyId) =>
    QuestionBank.create({ text, source: "llm_followup", status: "deprecated", competencyId, textHash: hashQuestionText(text) });
  const q = (text, competencyId) => ({ question: text, competencyId, layer: "behavior" });

  before(async () => {
    ({ applyDeprecationPolicy, syncFallbackQuestions } = await import("../services/questionBankService.js"));
    ({ FALLBACK_QUESTIONS } = await import("../config/fallbackQuestions.js"));
  });
  // Các case dưới cần kho KHÔNG có câu approved nào (bước 1, 3 rỗng) để đi tới bộ câu tĩnh.
  beforeEach(async () => {
    await QuestionBank.deleteMany({ status: "approved" });
  });

  it("sinh lại tối đa 2 lần; cả 2 lần vẫn deprecated → approved bất kỳ competency", async () => {
    const dep = "Câu deprecated cho chuỗi dự phòng số một về giao tiếp";
    await deprecate(dep, "communication");
    const other = "Câu approved thuộc competency khác dùng làm dự phòng bước ba";
    await QuestionBank.create({ text: other, source: "moderator", status: "approved", competencyId: "teamwork", textHash: hashQuestionText(other) });

    let calls = 0;
    const res = await applyDeprecationPolicy([q(dep, "communication")], {
      regenerate: async () => {
        calls++;
        return [q(dep, "communication")];
      },
    });
    assert.equal(calls, 2);
    assert.equal(res.questions.length, 1);
    assert.equal(res.questions[0].question, other);
  });

  it("không có approved, sinh lại thất bại → câu tĩnh cùng competency, được upsert approved/moderator", async () => {
    const dep = "Câu deprecated cho chuỗi dự phòng số hai về lãnh đạo";
    await deprecate(dep, "leadership");
    const res = await applyDeprecationPolicy([q(dep, "leadership"), q("Một câu hợp lệ không bị khai tử trong buổi này", "teamwork")], {
      regenerate: async () => {
        throw new Error("LLM down");
      },
    });
    assert.equal(res.questions.length, 2, "không được thiếu câu");
    assert.equal(res.fallback, 1);
    const picked = res.questions[0];
    assert.ok(FALLBACK_QUESTIONS.leadership.includes(picked.question));
    assert.ok(picked.questionBankId);
    const doc = await QuestionBank.findById(picked.questionBankId).lean();
    assert.equal(doc.status, "approved");
    assert.equal(doc.source, "moderator");
  });

  it("câu tĩnh bị moderator khai tử thì bỏ qua; 2 câu deprecated cùng competency nhận 2 câu tĩnh khác nhau", async () => {
    const [s1, s2] = FALLBACK_QUESTIONS.integrity;
    await QuestionBank.updateOne({ textHash: hashQuestionText(s1), orgId: null }, {
      $set: { status: "deprecated" },
      $setOnInsert: { text: s1, source: "moderator", competencyId: "integrity" },
    }, { upsert: true });
    const d1 = "Câu deprecated thứ nhất về chính trực trong công việc";
    const d2 = "Câu deprecated thứ hai về chính trực trong công việc";
    await deprecate(d1, "integrity");
    await deprecate(d2, "integrity");
    const res = await applyDeprecationPolicy([q(d1, "integrity"), q(d2, "integrity")]);
    const texts = res.questions.map((x) => x.question);
    assert.equal(texts.length, 2);
    assert.ok(!texts.includes(s1), "câu tĩnh đã khai tử không được dùng");
    assert.equal(texts[0], s2);
    assert.notEqual(texts[0], texts[1]);
  });

  it("syncFallbackQuestions idempotent", async () => {
    const total = Object.values(FALLBACK_QUESTIONS).flat().length;
    const first = await syncFallbackQuestions();
    assert.equal(first.total, total);
    const second = await syncFallbackQuestions();
    assert.equal(second.inserted, 0);
    const count = await QuestionBank.countDocuments({
      textHash: { $in: Object.values(FALLBACK_QUESTIONS).flat().map((t) => hashQuestionText(t)) },
    });
    assert.equal(count, total);
  });

  it("HTTP: LLM luôn trả câu deprecated → vẫn đủ 2 câu, không câu nào deprecated", async () => {
    const dep = "Câu deprecated mà LLM cứ sinh lại mãi về quản lý rủi ro";
    await deprecate(dep, "risk_management");
    for (let i = 0; i < 3; i++) llmQueue.push([llmQuestion(dep, "risk_management"), llmQuestion(dep, "risk_management")]);
    const { user, session } = await proSessionWithBaseline();
    const res = await generateFollowUp(user, session._id);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.questions.length, 2);
    const depHashes = new Set((await QuestionBank.find({ status: "deprecated" }, { textHash: 1 }).lean()).map((d) => d.textHash));
    assert.ok(body.questions.every((x) => !depHashes.has(hashQuestionText(x.question))));
    assert.equal(llmCalls, 3, "1 lần sinh + tối đa 2 lần sinh lại");
  });
});
