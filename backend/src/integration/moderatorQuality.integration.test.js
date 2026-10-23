/**
 * Integration: GET /api/moderator/quality/stats — dữ liệu seed nhỏ cho ra đúng KPI (spec S1 §4, §7).
 * File riêng để DB sạch: mọi con số dưới đây chỉ đến từ seed trong file này.
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
let moderator;
let getQualityStats;
let median;
let weekKey;

const DAY = 24 * 60 * 60 * 1000;
const now = new Date();
const daysAgo = (n) => new Date(now.getTime() - n * DAY);

before(async () => {
  harness = await startMongoHarness();
  const { User } = await import("../models/User.js");
  const { QuestionBank, hashQuestionText } = await import("../models/QuestionBank.js");
  const { ModerationItem } = await import("../models/ModerationItem.js");
  const { InterviewSession } = await import("../models/InterviewSession.js");
  const { Report } = await import("../models/Report.js");
  ({ getQualityStats, median, weekKey } = await import("../services/moderationQualityService.js"));
  const { createApp } = await import("../app.js");
  http = await startHttpServer(createApp());

  moderator = await User.create({ name: "Mod Q", email: `mod-q-${Date.now()}@test.local`, role: "moderator" });
  const customer = await User.create({ name: "Cus Q", email: `cus-q-${Date.now()}@test.local` });
  const qb = (text, extra) =>
    QuestionBank.create({ text, textHash: hashQuestionText(text), source: "llm_followup", generatedBy: { promptVersion: "followup-v1" }, ...extra });

  // Ngân hàng: 3 approved trong kỳ (1 câu đã sửa), 1 deprecated trong kỳ, 1 approved NGOÀI kỳ,
  // 2 pending (1 câu quá 7 ngày).
  await qb("Approved 1 về giải quyết vấn đề", { status: "approved", competencyId: "problem_solving", review: { at: daysAgo(2) }, flagCount: 2 });
  await qb("Approved 2 về giải quyết vấn đề", { status: "approved", competencyId: "problem_solving", review: { at: daysAgo(3) } });
  await qb("Approved 3 đã sửa về làm việc nhóm", {
    status: "approved", competencyId: "teamwork", review: { at: daysAgo(4) },
    revisions: [{ text: "Approved 3 đã sửa về làm việc nhóm", reason: "rõ hơn" }],
  });
  await qb("Deprecated 1 về làm việc nhóm", { status: "deprecated", competencyId: "teamwork", deprecation: { at: daysAgo(1) }, flagCount: 3 });
  await qb("Approved cũ ngoài kỳ thống kê", { status: "approved", competencyId: "teamwork", review: { at: daysAgo(60) } });
  // Câu moderator tự tạo (được duyệt sẵn) KHÔNG được tính vào approvalRate / editRate.
  await qb("Câu moderator tạo tay về làm việc nhóm", { source: "moderator", status: "approved", competencyId: "teamwork", review: { at: daysAgo(1) } });
  await qb("Pending mới về giao tiếp", { status: "pending_review", competencyId: "communication" });
  const oldPending = await qb("Pending quá 7 ngày về giao tiếp", { status: "pending_review", competencyId: "communication" });
  await QuestionBank.collection.updateOne({ _id: oldPending._id }, { $set: { createdAt: daysAgo(10) } });

  // 4 session hoàn thành trong kỳ; 2 có moderatorOverride (lệch 0.3 và 2.0); 1 câu chấm thiếu.
  const mkSession = (extra) => InterviewSession.create({
    userId: customer._id, hrGender: "female", status: "completed", completedAt: daysAgo(2), feedbackGeneratedAt: daysAgo(2), ...extra,
  });
  const s1 = await mkSession({
    questions: [{ question: "Q1", promptVersion: "followup-v1" }, { question: "Q2" }],
    feedback: { promptVersion: "eval-v1", perQuestion: [{ questionIndex: 0, overall5: 3.5 }, { questionIndex: 1, overall5: 2 }] },
    answers: [
      { questionIndex: 0, moderatorOverride: { overall: 3.8, scores: { clarity: 4, structure: 4, relevance: 4, credibility: 3 }, shrmLevel: "proficient", at: daysAgo(1) } },
      { questionIndex: 1, evaluationIncomplete: true, moderatorOverride: { overall: 4, scores: { clarity: 4, structure: 4, relevance: 4, credibility: 4 }, shrmLevel: "proficient", at: daysAgo(1) } },
    ],
  });
  await mkSession({ questions: [{ question: "Q3" }], feedback: { promptVersion: "eval-v1", perQuestion: [{ questionIndex: 0, overall5: 3 }] } });
  await mkSession({ questions: [{ question: "Q4" }], feedback: { promptVersion: "eval-v1", perQuestion: [{ questionIndex: 0, overall5: 3 }] } });
  await mkSession({ questions: [{ question: "Q5" }], feedback: { promptVersion: "eval-v1", perQuestion: [{ questionIndex: 0, overall5: 3 }] } });

  // 2 report AI trong kỳ trên s1 → flagRate = 2 / 4 session.
  await Report.create({ reportedBy: customer._id, targetType: "interview_question", targetId: s1._id, questionIndex: 0, reasonCode: "irrelevant" });
  await Report.create({ reportedBy: customer._id, targetType: "interview_evaluation", targetId: s1._id, questionIndex: 1, reasonCode: "inaccurate_scoring" });

  // Queue: 1 open, 1 in_review, 3 resolved trong kỳ sau 2h, 4h, 9h → median 4h.
  await ModerationItem.create({ type: "question_report" });
  await ModerationItem.create({ type: "question_report", status: "in_review" });
  for (const h of [2, 4, 9]) {
    const created = daysAgo(3);
    const item = await ModerationItem.create({
      type: "evaluation_report", status: "resolved",
      resolution: { action: "dismiss", at: new Date(created.getTime() + h * 3_600_000) },
    });
    await ModerationItem.collection.updateOne({ _id: item._id }, { $set: { createdAt: created } });
  }
});

after(async () => {
  if (http?.server) await stopHttpServer(http.server);
  if (harness) await stopMongoHarness(harness);
});

describe("quality/stats", () => {
  it("KPI tính đúng trên dữ liệu seed", async () => {
    // "now" thời điểm gọi (sau khi seed) — report/item vừa tạo phải nằm trong kỳ.
    const { stats } = await getQualityStats({}, { now: new Date(), useCache: false });

    assert.deepEqual(stats.bank.byStatus, { pending_review: 2, approved: 5, deprecated: 1 });
    assert.equal(stats.bank.pendingOver7d, 1);

    assert.equal(stats.queue.open, 1);
    assert.equal(stats.queue.inReview, 1);
    assert.equal(stats.queue.resolvedInPeriod, 3);
    assert.equal(stats.queue.medianTimeToResolveHours, 4);

    assert.equal(stats.approvalRate, 0.75, "3 approved / (3 + 1 deprecated) trong kỳ — bỏ câu moderator tạo tay");
    assert.equal(stats.editRate, 0.3333, "1 / 3 câu duyệt có sửa");
    assert.equal(stats.flagRate, 0.5, "2 report / 4 session hoàn thành");
    assert.equal(stats.incompleteEvalRate, 0.2, "1 / 5 câu được chấm");

    assert.equal(stats.overrides, 2);
    assert.equal(stats.aiModeratorAgreement, 0.5, "|3.8-3.5|=0.3 đồng thuận, |4-2|=2 không");
    assert.equal(stats.meanAbsoluteDiff, 1.15);

    const teamwork = stats.byCompetency.find((c) => c.competencyId === "teamwork");
    assert.equal(teamwork.deprecated, 1);
    assert.equal(teamwork.flagCount, 3);

    const followup = stats.byPromptVersion.find((v) => v.promptVersion === "followup-v1");
    assert.equal(followup.approvalRate, 0.75);
    assert.equal(followup.reports, 1);
    assert.equal(followup.flagRate, 1, "1 report / 1 câu followup-v1 được phục vụ");
    const evalV = stats.byPromptVersion.find((v) => v.promptVersion === "eval-v1");
    assert.equal(evalV.reports, 1);
    assert.equal(evalV.flagRate, 0.2, "1 report / 5 câu chấm bằng eval-v1");

    assert.ok(stats.weeklyTrend.length >= 1);
    const totalReports = stats.weeklyTrend.reduce((a, w) => a + w.reports, 0);
    assert.equal(totalReports, 2);
  });

  it("HTTP: moderator 200 + kết quả được cache", async () => {
    const auth = { Authorization: `Bearer ${mintAccessToken(moderator._id)}` };
    const first = await (await fetch(`${http.baseUrl}/api/moderator/quality/stats`, { headers: auth })).json();
    assert.equal(first.success, true);
    assert.equal(first.stats.approvalRate, 0.75);
    const second = await (await fetch(`${http.baseUrl}/api/moderator/quality/stats`, { headers: auth })).json();
    assert.equal(second.cached, true);
    const bad = await fetch(`${http.baseUrl}/api/moderator/quality/stats?from=khong-phai-ngay`, { headers: auth });
    assert.equal(bad.status, 400);
  });

  it("median, weekKey", () => {
    assert.equal(median([]), null);
    assert.equal(median([9, 2, 4]), 4);
    assert.equal(median([1, 2, 3, 4]), 2.5);
    assert.equal(weekKey(new Date("2026-10-22T10:00:00Z")), "2026-10-19");
    assert.equal(weekKey(new Date("2026-10-19T00:00:00Z")), "2026-10-19");
  });
});

void mongoose;
