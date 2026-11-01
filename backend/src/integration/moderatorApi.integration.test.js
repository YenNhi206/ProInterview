/**
 * Integration: /api/moderator/questions*, /queue*, /quality/stats (spec S1 §3, §7).
 */
import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
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
let QuestionBank;
let hashQuestionText;
let ModerationItem;
let InterviewSession;
let Report;
let Notification;
let moderator;
let moderator2;

before(async () => {
  harness = await startMongoHarness();
  ({ User } = await import("../models/User.js"));
  ({ QuestionBank, hashQuestionText } = await import("../models/QuestionBank.js"));
  ({ ModerationItem } = await import("../models/ModerationItem.js"));
  ({ InterviewSession } = await import("../models/InterviewSession.js"));
  ({ Report } = await import("../models/Report.js"));
  ({ Notification } = await import("../models/Notification.js"));
  await Promise.all([QuestionBank.init(), ModerationItem.init(), Report.init()]);
  const { createApp } = await import("../app.js");
  http = await startHttpServer(createApp());
  moderator = await makeUser("moderator");
  moderator2 = await makeUser("moderator");
});

after(async () => {
  if (http?.server) await stopHttpServer(http.server);
  if (harness) await stopMongoHarness(harness);
});

let seq = 0;
function makeUser(role = "customer") {
  seq++;
  return User.create({ name: `Mod API ${role} ${seq}`, email: `mod-api-${role}-${seq}-${Date.now()}@test.local`, role });
}

function api(user, method, path, body) {
  return fetch(`${http.baseUrl}/api/moderator${path}`, {
    method,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${mintAccessToken(user._id)}` },
    ...(body !== undefined && { body: JSON.stringify(body) }),
  });
}

async function bankQuestion(text, extra = {}) {
  return QuestionBank.create({ text, source: "llm_followup", textHash: hashQuestionText(text), competencyId: "problem_solving", ...extra });
}

describe("RBAC /api/moderator/* (HITL)", () => {
  it("admin, customer, mentor đều 403; moderator 200", async () => {
    const q = await bankQuestion(`Câu RBAC ${Date.now()} — kể về một lần bạn sửa lỗi`);
    const fakeId = new mongoose.Types.ObjectId();
    const routes = [
      ["GET", "/questions"],
      ["GET", `/questions/${q._id}`],
      ["GET", "/queue"],
      ["GET", "/quality/stats"],
      ["POST", "/questions", { text: "x", competencyId: "teamwork" }],
      ["PATCH", `/questions/${q._id}/approve`, {}],
      ["PATCH", `/questions/${q._id}/deprecate`, { reason: "test" }],
      ["POST", "/questions/bulk", { ids: [String(q._id)], action: "approve" }],
      ["PATCH", `/queue/${fakeId}/claim`],
      ["PATCH", `/queue/${fakeId}/resolve`, { action: "dismiss" }],
    ];
    for (const role of ["admin", "customer", "mentor"]) {
      const u = await makeUser(role);
      for (const [method, path, body] of routes) {
        const res = await api(u, method, path, body);
        assert.equal(res.status, 403, `${role} ${method} ${path}`);
      }
    }
    for (const [method, path] of routes.slice(0, 4)) {
      assert.equal((await api(moderator, method, path)).status, 200, `moderator ${method} ${path}`);
    }
  });
});

describe("Questions", () => {
  it("list lọc theo status + search, sort theo flagCount", async () => {
    const tag = `LOC${Date.now()}`;
    await bankQuestion(`${tag} câu ít cờ về giải quyết vấn đề`, { flagCount: 1 });
    await bankQuestion(`${tag} câu nhiều cờ về giải quyết vấn đề`, { flagCount: 5 });
    await bankQuestion(`${tag} câu đã duyệt về giải quyết vấn đề`, { status: "approved", flagCount: 9 });
    const body = await (await api(moderator, "GET", `/questions?status=pending_review&q=${tag}&sort=flagCount`)).json();
    assert.equal(body.success, true);
    assert.deepEqual(body.questions.map((q) => q.flagCount), [5, 1]);
    assert.equal(body.pagination.total, 2);
  });

  it("tạo tay → approved / source moderator; trùng → 409", async () => {
    const text = `Câu moderator tạo tay số ${Date.now()} về làm việc nhóm`;
    const res = await api(moderator, "POST", "/questions", { text, competencyId: "teamwork" });
    assert.equal(res.status, 201);
    const { question } = await res.json();
    assert.equal(question.status, "approved");
    assert.equal(question.source, "moderator");
    assert.equal(String(question.review.by), String(moderator._id));
    assert.equal((await api(moderator, "POST", "/questions", { text: `  ${text.toUpperCase()}?` , competencyId: "teamwork" })).status, 409);
  });

  it("sửa bắt buộc reason, đẩy revisions, đổi textHash; trùng câu khác → 409", async () => {
    const a = await bankQuestion(`Câu A ${Date.now()} cần sửa lại cho rõ nghĩa hơn`);
    const b = await bankQuestion(`Câu B ${Date.now()} đã tồn tại sẵn trong ngân hàng`);
    assert.equal((await api(moderator, "PATCH", `/questions/${a._id}`, { text: "Nội dung mới đủ dài để hợp lệ" })).status, 400);

    const newText = `Câu A đã sửa ${Date.now()} — kể về lần bạn tìm ra nguyên nhân gốc`;
    const ok = await (await api(moderator, "PATCH", `/questions/${a._id}`, { text: newText, reason: "Làm rõ ý" })).json();
    assert.equal(ok.question.text, newText);
    assert.equal(ok.question.textHash, hashQuestionText(newText));
    assert.equal(ok.question.originalText, a.text);
    assert.equal(ok.question.revisions.length, 1);
    assert.equal(ok.question.revisions[0].reason, "Làm rõ ý");

    const dup = await api(moderator, "PATCH", `/questions/${a._id}`, { text: b.text, reason: "trùng" });
    assert.equal(dup.status, 409);
  });

  it("approve / deprecate (bắt buộc reason) / bulk tối đa 100", async () => {
    const q = await bankQuestion(`Câu duyệt ${Date.now()} về giải quyết vấn đề phức tạp`);
    const approved = await (await api(moderator, "PATCH", `/questions/${q._id}/approve`, { note: "ok" })).json();
    assert.equal(approved.question.status, "approved");
    assert.equal((await api(moderator, "PATCH", `/questions/${q._id}/deprecate`, {})).status, 400);
    const dep = await (await api(moderator, "PATCH", `/questions/${q._id}/deprecate`, { reason: "Lạc đề" })).json();
    assert.equal(dep.question.status, "deprecated");
    assert.equal(dep.question.deprecation.reason, "Lạc đề");

    const ids = Array.from({ length: 101 }, () => String(new mongoose.Types.ObjectId()));
    assert.equal((await api(moderator, "POST", "/questions/bulk", { ids, action: "approve" })).status, 400);
    assert.equal((await api(moderator, "POST", "/questions/bulk", { ids: ids.slice(0, 2), action: "deprecate" })).status, 400, "deprecate cần reason");

    const x = await bankQuestion(`Bulk X ${Date.now()} về giải quyết vấn đề`);
    const y = await bankQuestion(`Bulk Y ${Date.now()} về giải quyết vấn đề`);
    const bulk = await (await api(moderator, "POST", "/questions/bulk", { ids: [String(x._id), String(y._id), ids[0]], action: "approve" })).json();
    assert.equal(bulk.updated, 2);
    assert.deepEqual(bulk.notFound, [ids[0]]);
  });

  it("chi tiết có revisions + session mẫu kèm điểm AI", async () => {
    const q = await bankQuestion(`Câu có session mẫu ${Date.now()} về giải quyết vấn đề`);
    const s = await InterviewSession.create({
      userId: moderator._id,
      hrGender: "female",
      status: "completed",
      questions: [{ id: "f1", question: q.text, questionBankId: q._id }],
      answers: [{ questionIndex: 0, transcript: "Câu trả lời mẫu" }],
      feedback: { perQuestion: [{ questionIndex: 0, overall5: 3, scores: { clarity: 3, structure: 3, relevance: 3, credibility: 3 } }] },
    });
    await QuestionBank.updateOne({ _id: q._id }, { $push: { sampleSessionIds: s._id } });
    const body = await (await api(moderator, "GET", `/questions/${q._id}`)).json();
    assert.equal(body.samples.length, 1);
    assert.equal(body.samples[0].transcript, "Câu trả lời mẫu");
    assert.equal(body.samples[0].aiEvaluation.overall, 3);
  });
});

describe("Queue", () => {
  async function reportedSession() {
    const customer = await makeUser();
    const q = await bankQuestion(`Câu bị báo ${Date.now()}-${seq} về giải quyết vấn đề`);
    const session = await InterviewSession.create({
      userId: customer._id,
      hrGender: "male",
      status: "completed",
      questions: [{ id: "f1", question: q.text, questionBankId: q._id }],
      answers: [{ questionIndex: 0, transcript: "Em làm A rồi B." }],
      feedback: {
        promptVersion: "eval-v1",
        perQuestion: [{ questionIndex: 0, overall5: 2, score: 40, shrmLevel: "developing", scores: { clarity: 2, structure: 2, relevance: 2, credibility: 2 } }],
      },
    });
    const res = await fetch(`${http.baseUrl}/api/reports`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${mintAccessToken(customer._id)}` },
      body: JSON.stringify({ targetType: "interview_evaluation", targetId: String(session._id), questionIndex: 0, reasonCode: "inaccurate_scoring" }),
    });
    const { reportId, moderationItemId } = await res.json();
    return { customer, session, q, reportId, itemId: moderationItemId };
  }

  it("list theo priority (high trước), detail kèm report + câu hỏi", async () => {
    const low = await ModerationItem.create({ type: "question_report", priority: "low" });
    const high = await ModerationItem.create({ type: "evaluation_incomplete", priority: "high" });
    const body = await (await api(moderator, "GET", "/queue?limit=100")).json();
    const ids = body.items.map((i) => String(i._id));
    assert.ok(ids.indexOf(String(high._id)) < ids.indexOf(String(low._id)));

    const { itemId, reportId, q } = await reportedSession();
    const detail = await (await api(moderator, "GET", `/queue/${itemId}`)).json();
    assert.equal(String(detail.report._id), reportId);
    assert.equal(String(detail.question._id), String(q._id));
    assert.equal(detail.item.snapshot.aiEvaluation.overall, 2);
  });

  it("claim → in_review; moderator khác claim / resolve → 409", async () => {
    const { itemId } = await reportedSession();
    const claimed = await (await api(moderator, "PATCH", `/queue/${itemId}/claim`)).json();
    assert.equal(claimed.item.status, "in_review");
    assert.equal(String(claimed.item.assignee), String(moderator._id));
    assert.equal((await api(moderator2, "PATCH", `/queue/${itemId}/claim`)).status, 409);
    assert.equal((await api(moderator2, "PATCH", `/queue/${itemId}/resolve`, { action: "dismiss" })).status, 409);
  });

  it("override_score: điểm AI gốc giữ nguyên, moderatorOverride đúng, report resolved, user nhận notification", async () => {
    const { customer, session, itemId, reportId } = await reportedSession();
    await api(moderator, "PATCH", `/queue/${itemId}/claim`);
    const bad = await api(moderator, "PATCH", `/queue/${itemId}/resolve`, { action: "override_score", payload: { scores: { clarity: 7 } } });
    assert.equal(bad.status, 400);

    const res = await api(moderator, "PATCH", `/queue/${itemId}/resolve`, {
      action: "override_score",
      note: "Câu trả lời có số liệu rõ",
      payload: { scores: { clarity: 4, structure: 3.5, relevance: 4, credibility: 4 }, shrmLevel: "proficient" },
    });
    assert.equal(res.status, 200);

    const saved = await InterviewSession.findById(session._id).lean();
    assert.equal(saved.feedback.perQuestion[0].overall5, 2, "điểm AI gốc không bị ghi đè");
    assert.equal(saved.feedback.perQuestion[0].scores.clarity, 2);
    const o = saved.answers[0].moderatorOverride;
    assert.equal(o.overall, 3.9);
    assert.equal(o.scores.structure, 3.5);
    assert.equal(o.shrmLevel, "proficient");
    assert.equal(String(o.by), String(moderator._id));

    const item = await ModerationItem.findById(itemId).lean();
    assert.equal(item.status, "resolved");
    assert.equal(item.resolution.action, "override_score");
    const report = await Report.findById(reportId).lean();
    assert.equal(report.status, "resolved");

    const notif = await Notification.findOne({ userId: customer._id }).lean();
    assert.ok(notif, "người báo phải nhận notification");
    assert.equal(notif.type, "feedback");
    assert.match(notif.metadata.actionUrl, new RegExp(String(session._id)));

    assert.equal((await api(moderator, "PATCH", `/queue/${itemId}/resolve`, { action: "dismiss" })).status, 409, "đã xử lý");
  });

  it("deprecate_question từ queue khai tử câu trong bank; dismiss đóng report", async () => {
    const a = await reportedSession();
    await (await api(moderator, "PATCH", `/queue/${a.itemId}/resolve`, { action: "deprecate_question", note: "Lạc đề" })).json();
    assert.equal((await QuestionBank.findById(a.q._id).lean()).status, "deprecated");

    const b = await reportedSession();
    await api(moderator, "PATCH", `/queue/${b.itemId}/resolve`, { action: "dismiss", note: "Điểm hợp lý" });
    assert.equal((await ModerationItem.findById(b.itemId).lean()).status, "dismissed");
    assert.equal((await Report.findById(b.reportId).lean()).status, "dismissed");
  });
});
