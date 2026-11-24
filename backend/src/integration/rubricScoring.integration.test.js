/**
 * Integration JB-07: chấm câu doanh nghiệp theo rubric công ty khi `POST /api/interviews/sessions/:id/evaluate`.
 * "Xong khi": trích dẫn là câu có thật trong transcript (phần chạy trên bộ AI-01 làm khi có bộ dữ liệu).
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
delete process.env.ANTHROPIC_API_KEY;
delete process.env.LLM_PROVIDER;
delete process.env.MOCK_AI_SERVICES;
delete process.env.MOCK_AI;

let harness, http, User, Company, CompanyRubric, QuestionBank, InterviewSession, CostEvent, hashQuestionText;
const realFetch = globalThis.fetch;
/** Hàm sinh câu trả lời của LLM chấm rubric theo user prompt; mặc định chấm 3 điểm, trích câu đầu transcript. */
let rubricResponder = null;
let rubricCalls = [];
let evalCalls = 0;

const isRubricCall = (body) => body.messages.some((m) => m.role === "system" && m.content.includes("theo các tiêu chí trong rubric của doanh nghiệp"));
const criterionKeysOf = (prompt) => [...prompt.matchAll(/criterion_key: ([a-f0-9]{24})/g)].map((m) => m[1]);
const answerOf = (prompt) => prompt.split('"""')[1]?.trim() ?? "";

function defaultRubric(prompt) {
  const quote = answerOf(prompt).split(".")[0];
  return { criteria: criterionKeysOf(prompt).map((k) => ({ criterion_key: k, score: 3, evidence_quote: quote })) };
}

before(async () => {
  globalThis.fetch = async (url, init) => {
    if (String(url).startsWith("http://llm.stub.local")) {
      const body = JSON.parse(init.body);
      const user = body.messages.find((m) => m.role === "user")?.content ?? "";
      let content;
      if (isRubricCall(body)) {
        rubricCalls.push(user);
        const out = (rubricResponder ?? defaultRubric)(user);
        content = typeof out === "string" ? out : JSON.stringify(out);
      } else {
        evalCalls += 1;
        const idx = [...user.matchAll(/question_index\D{0,5}(\d+)/g)].map((m) => Number(m[1]));
        const indexes = idx.length ? [...new Set(idx)] : [0, 1, 2, 3, 4];
        content = JSON.stringify({
          overall_comment: "Ổn",
          questions: indexes.map((i) => ({
            question_index: i, scores: { clarity: 4, structure: 4, relevance: 4, credibility: 4 }, overall: 4, shrm_level: "proficient", strengths: ["Rõ"],
          })),
        });
      }
      return new Response(JSON.stringify({ choices: [{ message: { content } }], usage: { prompt_tokens: 800, completion_tokens: 150 } }), {
        status: 200, headers: { "Content-Type": "application/json" },
      });
    }
    return realFetch(url, init);
  };
  harness = await startMongoHarness();
  ({ User } = await import("../models/User.js"));
  ({ Company } = await import("../models/Company.js"));
  ({ CompanyRubric } = await import("../models/CompanyRubric.js"));
  ({ QuestionBank, hashQuestionText } = await import("../models/QuestionBank.js"));
  ({ InterviewSession } = await import("../models/InterviewSession.js"));
  ({ CostEvent } = await import("../models/CostEvent.js"));
  http = await startHttpServer((await import("../app.js")).createApp());
});

after(async () => {
  globalThis.fetch = realFetch;
  if (http?.server) await stopHttpServer(http.server);
  if (harness) await stopMongoHarness(harness);
});

beforeEach(() => {
  rubricResponder = null;
  rubricCalls = [];
  evalCalls = 0;
});

const ANSWER_1 = "Em từng tối ưu API danh sách đơn hàng bị chậm. Em đo bằng APM thấy truy vấn thiếu index, thêm index kép nên thời gian phản hồi giảm từ 1,2 giây xuống 300 mili giây.";
const ANSWER_2 = "Khi yêu cầu đổi giữa sprint, em họp nhanh với PO để xếp lại ưu tiên. Em báo rõ phần nào sẽ trễ và đề xuất tách tính năng thành hai đợt.";

let seq = 0;
/** Buổi 3 câu baseline + 2 câu doanh nghiệp (JB-06), đã hoàn thành, chưa chấm. */
async function companySession({ answers = [ANSWER_1, ANSWER_2] } = {}) {
  seq += 1;
  const user = await User.create({ name: `JB07 ${seq}`, email: `jb07-${seq}-${Date.now()}@test.local` });
  const company = await Company.create({ name: `Công ty JB07 ${seq}`, slug: `jb07-${seq}-${Date.now()}` });
  const texts = [`Kể về lần bạn tối ưu một API chậm (${seq})`, `Bạn xử lý thế nào khi yêu cầu đổi giữa sprint? (${seq})`];
  const qs = await QuestionBank.insertMany(texts.map((text) => ({
    text, source: "org_template", orgId: company._id, roleCategory: "backend", status: "approved", textHash: hashQuestionText(text),
  })));
  const rubric = await CompanyRubric.create({
    companyId: company._id, roleCategory: "backend", title: "Rubric Backend", status: "approved",
    criteria: [
      { name: "Giải quyết vấn đề kỹ thuật", shrmKey: "problem_solving", weight: 50, levels: { 0: "Không có", 3: "Có phân tích", 5: "Đo lường rõ" }, questionIds: [qs[0]._id] },
      { name: "Phối hợp với sản phẩm", shrmKey: "teamwork", weight: 30, questionIds: [qs[1]._id] },
      { name: "Giao tiếp rõ ràng", shrmKey: "communication", weight: 20, questionIds: [qs[0]._id, qs[1]._id] },
    ],
  });
  const baseline = [0, 1, 2].map((i) => ({ id: `b${i}`, question: `Câu baseline ${i}`, source: "baseline" }));
  const companyQs = qs.map((q, i) => ({ id: `company${i + 1}`, question: q.text, source: "company", questionBankId: q._id }));
  const session = await InterviewSession.create({
    userId: user._id, hrGender: "female", status: "completed", questionsAllowed: 5,
    questions: [...baseline, ...companyQs],
    companyQuestions: qs.map((q) => ({ questionId: q._id, companyId: company._id, rubricId: rubric._id })),
    answers: [
      ...[0, 1, 2].map((i) => ({ questionIndex: i, transcript: `Trả lời baseline số ${i} khá đầy đủ.` })),
      ...answers.map((t, i) => ({ questionIndex: 3 + i, transcript: t })),
    ],
  });
  return { user, company, rubric, qs, session };
}

const evaluate = (user, sessionId) =>
  fetch(`${http.baseUrl}/api/interviews/sessions/${sessionId}/evaluate`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${mintAccessToken(user._id)}` },
    body: JSON.stringify({}),
  });

async function waitForCostEvents(n) {
  for (let i = 0; i < 40; i += 1) {
    const count = await CostEvent.countDocuments({ kind: "rubric_scoring" });
    if (count >= n) return count;
    await new Promise((r) => setTimeout(r, 25));
  }
  return CostEvent.countDocuments({ kind: "rubric_scoring" });
}

describe("JB-07 chấm rubric công ty", () => {
  it("câu doanh nghiệp có điểm từng tiêu chí áp dụng + trích dẫn có thật; câu khác không có phần rubric", async () => {
    const { user, company, rubric, session } = await companySession();
    const costBefore = await CostEvent.countDocuments({ kind: "rubric_scoring" });
    // Câu 1: trích đúng cho tiêu chí đầu, bịa cho tiêu chí giao tiếp → trích dẫn bịa bị bỏ.
    rubricResponder = (prompt) => {
      const keys = criterionKeysOf(prompt);
      if (prompt.includes("tối ưu API")) {
        return { criteria: [
          { criterion_key: keys[0], score: 4.6, evidence_quote: "Em đo bằng APM thấy truy vấn thiếu index" },
          { criterion_key: keys[1], score: 3, evidence_quote: "Em luôn trình bày rõ ràng với cả nhóm" },
        ] };
      }
      return defaultRubric(prompt);
    };

    const res = await evaluate(user, session._id);
    assert.equal(res.status, 200);
    const body = await res.json();

    // Mỗi câu doanh nghiệp đúng 1 lời gọi, chỉ chứa tiêu chí áp dụng cho câu đó.
    assert.equal(rubricCalls.length, 2);
    const ids = rubric.criteria.map((c) => String(c._id));
    const callQ1 = rubricCalls.find((p) => p.includes("tối ưu API"));
    const callQ2 = rubricCalls.find((p) => p.includes("đổi giữa sprint"));
    assert.deepEqual(criterionKeysOf(callQ1), [ids[0], ids[2]]);
    assert.deepEqual(criterionKeysOf(callQ2), [ids[1], ids[2]]);

    const saved = await InterviewSession.findById(session._id).lean();
    const a3 = saved.answers.find((a) => a.questionIndex === 3);
    assert.equal(a3.rubricScoring.status, "scored");
    assert.equal(a3.rubricScoring.promptVersion, "rubric-v1");
    assert.equal(String(a3.rubricScoring.rubricId), String(rubric._id));
    assert.deepEqual(a3.rubricScores.map((r) => [r.criterionName, r.score]), [["Giải quyết vấn đề kỹ thuật", 5], ["Giao tiếp rõ ràng", 3]]);
    assert.equal(a3.rubricScores[0].evidenceQuote, "Em đo bằng APM thấy truy vấn thiếu index");
    assert.equal(a3.rubricScores[1].evidenceQuote, "", "trích dẫn không có trong transcript phải bị bỏ");
    // Mọi trích dẫn được lưu đều nằm trong transcript.
    for (const a of saved.answers.filter((x) => x.rubricScores?.length)) {
      for (const r of a.rubricScores.filter((x) => x.evidenceQuote)) assert.ok(a.transcript.includes(r.evidenceQuote), r.evidenceQuote);
    }
    // Câu baseline không bị chấm rubric.
    assert.ok(saved.answers.filter((a) => a.questionIndex < 3).every((a) => !a.rubricScoring && !a.rubricScores?.length));

    // Response cho JB-14: câu doanh nghiệp có tên doanh nghiệp + điểm; câu khác không có.
    const pq = body.evaluation.perQuestion;
    assert.equal(pq.find((q) => q.questionIndex === 3).company.name, company.name);
    assert.equal(pq.find((q) => q.questionIndex === 3).rubricScores.length, 2);
    assert.equal(pq.find((q) => q.questionIndex === 0).company, undefined);
    assert.equal(pq.find((q) => q.questionIndex === 0).rubricScores, undefined);

    assert.equal(await waitForCostEvents(costBefore + 2), costBefore + 2);
  });

  it("đã chấm thì không chấm lại; lần evaluate sau trả lại đúng điểm đã lưu", async () => {
    const { user, session } = await companySession();
    assert.equal((await evaluate(user, session._id)).status, 200);
    assert.equal(rubricCalls.length, 2);
    rubricCalls = [];
    evalCalls = 0;

    const res = await evaluate(user, session._id);
    const body = await res.json();
    assert.equal(rubricCalls.length, 0);
    assert.equal(evalCalls, 0);
    const q4 = body.evaluation.perQuestion.find((q) => q.questionIndex === 4);
    assert.equal(q4.rubricStatus, "scored");
    assert.deepEqual(q4.rubricScores.map((r) => r.score), [3, 3]);
  });

  it("LLM thiếu tiêu chí → failed, không chặn đánh giá; lần evaluate sau chấm bù", async () => {
    const { user, session } = await companySession();
    rubricResponder = (prompt) => ({ criteria: [{ criterion_key: criterionKeysOf(prompt)[0], score: 3, evidence_quote: "" }] });
    const res = await evaluate(user, session._id);
    assert.equal(res.status, 200);
    assert.ok((await res.json()).evaluation.perQuestion.find((q) => q.questionIndex === 3).rubricStatus === "failed");
    let saved = await InterviewSession.findById(session._id).lean();
    assert.equal(saved.answers.find((a) => a.questionIndex === 3).rubricScoring.status, "failed");
    assert.ok(saved.feedback.perQuestion.length > 0, "điểm SHRM/DDI vẫn được lưu");

    rubricResponder = null;
    rubricCalls = [];
    await evaluate(user, session._id);
    assert.equal(rubricCalls.length, 2);
    saved = await InterviewSession.findById(session._id).lean();
    assert.ok(saved.answers.filter((a) => a.questionIndex >= 3).every((a) => a.rubricScoring.status === "scored"));
    assert.equal(saved.rubricScoringClaimedAt, null);
  });

  it("câu doanh nghiệp bỏ trống → no_answer, không gọi LLM", async () => {
    const { user, session } = await companySession({ answers: [ANSWER_1, "   "] });
    await evaluate(user, session._id);
    assert.equal(rubricCalls.length, 1);
    const saved = await InterviewSession.findById(session._id).lean();
    const a4 = saved.answers.find((a) => a.questionIndex === 4);
    assert.equal(a4.rubricScoring.status, "no_answer");
    assert.deepEqual(a4.rubricScores, []);
  });

  it("buổi không có câu doanh nghiệp: không gọi LLM chấm rubric", async () => {
    const user = await User.create({ name: "No company", email: `jb07-none-${Date.now()}@test.local` });
    const session = await InterviewSession.create({
      userId: user._id, hrGender: "male", status: "completed",
      questions: [{ id: "b0", question: "Giới thiệu bản thân", source: "baseline" }],
      answers: [{ questionIndex: 0, transcript: "Em là lập trình viên backend." }],
    });
    const res = await evaluate(user, session._id);
    assert.equal(res.status, 200);
    assert.equal(rubricCalls.length, 0);
    assert.equal((await res.json()).evaluation.perQuestion[0].company, undefined);
  });
});
