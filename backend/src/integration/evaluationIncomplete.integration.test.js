/**
 * Integration: LLM chấm thiếu tiêu chí (POST /api/interviews/sessions/:id/evaluate)
 *  - retry LLM chỉ cho câu thiếu, tối đa 1 lần
 *  - vẫn thiếu → fallback 3 + evaluationIncomplete + đúng 1 ModerationItem (idempotent)
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

applyTestEnv();
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
let ModerationItem;

const realFetch = globalThis.fetch;
let llmQueue = [];
/** User prompt của từng lần gọi LLM — để kiểm tra retry chỉ gửi câu thiếu. */
let llmUserPrompts = [];

const fullScores = { clarity: 4, structure: 3.5, relevance: 4, credibility: 3.5 };
const evalQ = (idx, scores = fullScores) => ({ question_index: idx, scores, overall: 3.8, shrm_level: "proficient", strengths: ["Rõ ràng"] });

before(async () => {
  globalThis.fetch = async (url, init) => {
    if (String(url).startsWith("http://llm.stub.local")) {
      const body = JSON.parse(init.body);
      llmUserPrompts.push(body.messages.find((m) => m.role === "user")?.content ?? "");
      const content = JSON.stringify(llmQueue.shift() ?? { overall_comment: "", questions: [] });
      return new Response(JSON.stringify({ choices: [{ message: { content } }], usage: { prompt_tokens: 1, completion_tokens: 1 } }), {
        status: 200, headers: { "Content-Type": "application/json" },
      });
    }
    return realFetch(url, init);
  };
  harness = await startMongoHarness();
  ({ User } = await import("../models/User.js"));
  ({ InterviewSession } = await import("../models/InterviewSession.js"));
  ({ ModerationItem } = await import("../models/ModerationItem.js"));
  await ModerationItem.init();
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
  llmUserPrompts = [];
});

let seq = 0;
async function completedSession() {
  seq++;
  const user = await User.create({ name: "Eval", email: `eval-${seq}-${Date.now()}@test.local` });
  const session = await InterviewSession.create({
    userId: user._id,
    hrGender: "female",
    status: "completed",
    questions: [
      { id: "b1", question: "Giới thiệu về bản thân bạn", competencyName: "Giao tiếp" },
      { id: "b2", question: "Kể về một dự án khó bạn từng làm", competencyName: "Giải quyết vấn đề" },
    ],
    answers: [
      { questionIndex: 0, transcript: "Em là kỹ sư backend 3 năm kinh nghiệm." },
      { questionIndex: 1, transcript: "Em tối ưu hệ thống thanh toán giảm 40% độ trễ." },
    ],
  });
  return { user, session };
}

function evaluate(user, sessionId) {
  return fetch(`${http.baseUrl}/api/interviews/sessions/${sessionId}/evaluate`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${mintAccessToken(user._id)}` },
    body: JSON.stringify({}),
  });
}

describe("Evaluation thiếu tiêu chí", () => {
  it("retry lấp đủ → không đánh dấu, không tạo item; retry chỉ gửi câu thiếu", async () => {
    const { user, session } = await completedSession();
    llmQueue.push({ overall_comment: "Ổn", questions: [evalQ(0), evalQ(1, { clarity: 4, structure: 3 })] });
    llmQueue.push({ questions: [evalQ(1)] });

    const res = await evaluate(user, session._id);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(llmUserPrompts.length, 2);
    assert.match(llmUserPrompts[1], /question_index = 1/);
    assert.doesNotMatch(llmUserPrompts[1], /question_index = 0/);
    const q1 = body.evaluation.perQuestion.find((q) => q.questionIndex === 1);
    assert.equal(q1.evaluationIncomplete, false);
    assert.equal(q1.scores.structure, 3, "giữ điểm bản gốc đã có");
    assert.equal(q1.scores.credibility, 3.5, "lấp từ retry");
    assert.equal(await ModerationItem.countDocuments({ "refs.sessionId": session._id }), 0);
  });

  it("retry vẫn thiếu → fallback 3, evaluationIncomplete, 1 item high; evaluate lại vẫn 1 item", async () => {
    const { user, session } = await completedSession();
    llmQueue.push({ overall_comment: "Ổn", questions: [evalQ(0)] }); // bỏ sót hẳn câu 1
    llmQueue.push({ questions: [evalQ(1, { clarity: 4, structure: 3, relevance: 4 })] }); // vẫn thiếu credibility

    const body = await (await evaluate(user, session._id)).json();
    const q1 = body.evaluation.perQuestion.find((q) => q.questionIndex === 1);
    assert.equal(q1.evaluationIncomplete, true);
    assert.deepEqual(q1.incompleteFields, ["credibility"]);
    assert.equal(q1.scores.credibility, 3);
    assert.equal(llmUserPrompts.length, 2, "retry tối đa 1 lần");

    const saved = await InterviewSession.findById(session._id).lean();
    const a1 = saved.answers.find((a) => a.questionIndex === 1);
    assert.equal(a1.evaluationIncomplete, true);
    assert.equal(saved.feedback.promptVersion, "eval-v1");

    const items = await ModerationItem.find({ "refs.sessionId": session._id }).lean();
    assert.equal(items.length, 1);
    assert.equal(items[0].type, "evaluation_incomplete");
    assert.equal(items[0].priority, "high");
    assert.equal(items[0].priorityRank, 3);
    assert.equal(items[0].refs.questionIndex, 1);
    assert.equal(String(items[0].refs.userId), String(user._id));
    assert.match(items[0].snapshot.transcript, /40%/);

    // Gọi lại (cache) → vẫn 1 item, response cache mang cờ chờ kiểm định
    const cached = await (await evaluate(user, session._id)).json();
    assert.equal(cached.evaluation.perQuestion.find((q) => q.questionIndex === 1).evaluationIncomplete, true);

    // Chấm lại thật (xoá cache) và LLM vẫn thiếu → upsert, vẫn chỉ 1 item
    await InterviewSession.updateOne({ _id: session._id }, { $unset: { feedbackGeneratedAt: 1 } });
    llmQueue.push({ overall_comment: "Ổn", questions: [evalQ(0)] });
    llmQueue.push({ questions: [] });
    assert.equal((await evaluate(user, session._id)).status, 200);
    assert.equal(await ModerationItem.countDocuments({ "refs.sessionId": session._id, type: "evaluation_incomplete" }), 1);
  });
});
