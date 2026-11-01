/**
 * Integration: báo sai câu hỏi / kết quả chấm AI (POST /api/reports, targetType interview_*)
 * → Report + ModerationItem, tăng flagCount QuestionBank, không hiện ở trang support admin.
 */
import { describe, it, before, after } from "node:test";
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

let harness;
let http;
let User;
let InterviewSession;
let QuestionBank;
let hashQuestionText;
let ModerationItem;
let Report;

before(async () => {
  harness = await startMongoHarness();
  ({ User } = await import("../models/User.js"));
  ({ InterviewSession } = await import("../models/InterviewSession.js"));
  ({ QuestionBank, hashQuestionText } = await import("../models/QuestionBank.js"));
  ({ ModerationItem } = await import("../models/ModerationItem.js"));
  ({ Report } = await import("../models/Report.js"));
  await Promise.all([QuestionBank.init(), ModerationItem.init(), Report.init()]);
  const { createApp } = await import("../app.js");
  http = await startHttpServer(createApp());
});

after(async () => {
  if (http?.server) await stopHttpServer(http.server);
  if (harness) await stopMongoHarness(harness);
});

let seq = 0;
async function makeUser(role = "customer") {
  seq++;
  return User.create({ name: `AI report ${seq}`, email: `ai-report-${seq}-${Date.now()}@test.local`, role });
}

async function evaluatedSession(user) {
  const text = `Câu follow-up được chấm điểm số ${seq} — kể về một dự án khó`;
  const bank = await QuestionBank.create({ text, source: "llm_followup", textHash: hashQuestionText(text), competencyId: "problem_solving" });
  return InterviewSession.create({
    userId: user._id,
    hrGender: "female",
    status: "completed",
    questions: [
      { id: "b1", question: "Câu baseline 1" },
      { id: "b2", question: "Câu baseline 2" },
      { id: "b3", question: "Câu baseline 3" },
      { id: "f1", question: text, questionBankId: bank._id },
    ],
    answers: [{ questionIndex: 3, transcript: "Em đã tối ưu truy vấn và giảm 40% thời gian phản hồi." }],
    feedback: {
      overallScore: 70,
      promptVersion: "eval-v1",
      perQuestion: [{
        questionIndex: 3, score: 70, overall5: 3.5, shrmLevel: "proficient",
        scores: { clarity: 4, structure: 3, relevance: 3.5, credibility: 3.5 },
      }],
    },
  });
}

function postReport(userId, body) {
  return fetch(`${http.baseUrl}/api/reports`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${mintAccessToken(userId)}` },
    body: JSON.stringify(body),
  });
}

describe("POST /api/reports — interview_question / interview_evaluation", () => {
  it("tạo Report + ModerationItem đúng refs/snapshot, tăng flagCount", async () => {
    const user = await makeUser();
    const session = await evaluatedSession(user);
    const res = await postReport(user._id, {
      targetType: "interview_question", targetId: String(session._id), questionIndex: 3,
      reasonCode: "irrelevant", note: "Câu hỏi không liên quan vị trí",
    });
    assert.equal(res.status, 201);
    const body = await res.json();
    assert.ok(body.moderationItemId);

    const item = await ModerationItem.findById(body.moderationItemId).lean();
    assert.equal(item.type, "question_report");
    assert.equal(item.status, "open");
    assert.equal(item.priority, "normal");
    assert.equal(String(item.refs.reportId), body.reportId);
    assert.equal(String(item.refs.sessionId), String(session._id));
    assert.equal(item.refs.questionIndex, 3);
    assert.equal(String(item.refs.questionBankId), String(session.questions[3].questionBankId));
    assert.equal(item.snapshot.questionText, session.questions[3].question);
    assert.match(item.snapshot.transcript, /40%/);
    assert.equal(item.snapshot.aiEvaluation.overall, 3.5);

    const bank = await QuestionBank.findById(session.questions[3].questionBankId).lean();
    assert.equal(bank.flagCount, 1);
  });

  it("report trùng (cùng user, session, câu, targetType) → 409", async () => {
    const user = await makeUser();
    const session = await evaluatedSession(user);
    const body = { targetType: "interview_evaluation", targetId: String(session._id), questionIndex: 3, reasonCode: "inaccurate_scoring" };
    assert.equal((await postReport(user._id, body)).status, 201);
    assert.equal((await postReport(user._id, body)).status, 409);
    assert.equal(await ModerationItem.countDocuments({ "refs.sessionId": session._id, type: "evaluation_report" }), 1);
  });

  it("user khác chủ session → 403", async () => {
    const owner = await makeUser();
    const other = await makeUser();
    const session = await evaluatedSession(owner);
    const res = await postReport(other._id, {
      targetType: "interview_question", targetId: String(session._id), questionIndex: 3, reasonCode: "other",
    });
    assert.equal(res.status, 403);
  });

  it("validate: questionIndex ngoài phạm vi, note > 500, reasonCode lạ, chấm điểm câu chưa chấm → 400", async () => {
    const user = await makeUser();
    const session = await evaluatedSession(user);
    const base = { targetType: "interview_question", targetId: String(session._id), questionIndex: 3, reasonCode: "other" };
    assert.equal((await postReport(user._id, { ...base, questionIndex: 9 })).status, 400);
    assert.equal((await postReport(user._id, { ...base, note: "x".repeat(501) })).status, 400);
    assert.equal((await postReport(user._id, { ...base, reasonCode: "late" })).status, 400);
    assert.equal(
      (await postReport(user._id, { ...base, targetType: "interview_evaluation", questionIndex: 0 })).status,
      400,
    );
  });

  it("reasonCode offensive → priority high", async () => {
    const user = await makeUser();
    const session = await evaluatedSession(user);
    const body = await (await postReport(user._id, {
      targetType: "interview_question", targetId: String(session._id), questionIndex: 3, reasonCode: "offensive",
    })).json();
    const item = await ModerationItem.findById(body.moderationItemId).lean();
    assert.equal(item.priority, "high");
    assert.equal(item.priorityRank, 3);
  });

  it("report AI không hiện ở /api/admin/reports, admin không sửa được", async () => {
    const admin = await makeUser("admin");
    const user = await makeUser();
    const session = await evaluatedSession(user);
    const { reportId } = await (await postReport(user._id, {
      targetType: "interview_question", targetId: String(session._id), questionIndex: 3, reasonCode: "hallucination",
    })).json();

    const list = await (await fetch(`${http.baseUrl}/api/admin/reports?limit=100`, {
      headers: { Authorization: `Bearer ${mintAccessToken(admin._id)}` },
    })).json();
    assert.equal(list.success, true);
    assert.ok(!list.reports.some((r) => String(r._id) === reportId));
    assert.ok(list.reports.every((r) => !String(r.targetType).startsWith("interview_")));

    const patch = await fetch(`${http.baseUrl}/api/admin/reports/${reportId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${mintAccessToken(admin._id)}` },
      body: JSON.stringify({ status: "resolved" }),
    });
    assert.equal(patch.status, 404);
  });
});
