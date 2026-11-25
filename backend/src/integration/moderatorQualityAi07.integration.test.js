/**
 * Integration AI-07: Quality Dashboard thêm rubric chờ duyệt, thời gian duyệt rubric, tỉ lệ bị sửa
 * trước / sau mỗi lần đổi version. "Xong khi": số khớp truy vấn tay — mọi con số dưới đây tính tay từ seed.
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
let moderator;
let stats;
let PromptVersion;

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
const now = new Date();
const ago = (ms) => new Date(now.getTime() - ms);

before(async () => {
  harness = await startMongoHarness();
  const { User } = await import("../models/User.js");
  const { Company } = await import("../models/Company.js");
  const { CompanyRubric } = await import("../models/CompanyRubric.js");
  const { QuestionBank, hashQuestionText } = await import("../models/QuestionBank.js");
  const { InterviewSession } = await import("../models/InterviewSession.js");
  ({ PromptVersion } = await import("../models/PromptVersion.js"));
  const { AIImprovementProposal } = await import("../models/AIImprovementProposal.js");
  const pv = await import("../services/promptVersionService.js");
  const review = await import("../services/aiImprovementReviewService.js");
  const { getQualityStats } = await import("../services/moderationQualityService.js");
  await Promise.all([PromptVersion.syncIndexes(), AIImprovementProposal.syncIndexes()]);
  const { createApp } = await import("../app.js");
  http = await startHttpServer(createApp());

  moderator = await User.create({ name: "Mod AI07", email: `mod-ai07-${Date.now()}@test.local`, role: "moderator" });
  const customer = await User.create({ name: "Cand AI07", email: `cand-ai07-${Date.now()}@test.local` });
  const company = await Company.create({ name: "Cty AI07", slug: `cty-ai07-${Date.now()}`, status: "active" });

  // ── Rubric ──
  const rubric = (status, { submittedAt = null, reviewedAt = null } = {}) =>
    CompanyRubric.create({
      companyId: company._id, roleCategory: "frontend", title: `R ${status}`, status, submittedAt,
      criteria: [{ name: "Giải quyết vấn đề", shrmKey: "problem_solving", weight: 100 }],
      moderationNote: { reviewedAt, reviewedBy: reviewedAt ? moderator._id : null },
    });
  await rubric("pending_review", { submittedAt: ago(10 * DAY) }); // chờ 240 giờ (> 7 ngày)
  await rubric("pending_review", { submittedAt: ago(1 * DAY) });
  await rubric("approved", { submittedAt: ago(3 * DAY), reviewedAt: ago(1 * DAY) }); // 48 giờ
  await rubric("rejected", { submittedAt: ago(2 * DAY), reviewedAt: ago(1.5 * DAY) }); // 12 giờ
  await rubric("archived", { submittedAt: ago(5 * DAY), reviewedAt: ago(4 * DAY) }); // 24 giờ
  await rubric("approved", { reviewedAt: ago(2 * DAY) }); // gửi trước AI-07: không có submittedAt
  await rubric("approved", { submittedAt: ago(70 * DAY), reviewedAt: ago(60 * DAY) }); // ngoài kỳ 30 ngày
  await rubric("draft");

  // ── Chấm điểm: eval-v1 2 buổi × 5 câu, 1 câu chấm lại; eval-v2 1 buổi × 5 câu, 2 câu chấm lại ──
  const session = (version, overrides) =>
    InterviewSession.create({
      userId: customer._id, hrGender: "female", status: "completed", completedAt: ago(DAY), feedbackGeneratedAt: ago(DAY),
      questions: [0, 1, 2, 3, 4].map((i) => ({ id: `q${i}`, question: `Câu ${i}` })),
      answers: [0, 1, 2, 3, 4].map((i) => ({
        questionIndex: i, transcript: `Trả lời ${i}`,
        ...(i < overrides && { moderatorOverride: { overall: 2, at: ago(DAY / 2), by: moderator._id } }),
      })),
      feedback: { promptVersion: version, perQuestion: [0, 1, 2, 3, 4].map((i) => ({ questionIndex: i, overall5: 3 })) },
    });
  await session("eval-v1", 1);
  await session("eval-v1", 0);
  await session("eval-v2", 2);

  // ── Sinh câu: followup-v1 3 duyệt (1 bị sửa) + 1 khai tử; followup-v2 2 duyệt nguyên văn ──
  let n = 0;
  const qb = (version, status, extra = {}) => {
    n += 1;
    const text = `Câu sinh ${version} số ${n} về giải quyết vấn đề`;
    return QuestionBank.create({ text, textHash: hashQuestionText(text), source: "llm_followup", generatedBy: { promptVersion: version }, status, ...extra });
  };
  await qb("followup-v1", "approved", { review: { at: ago(DAY) } });
  await qb("followup-v1", "approved", { review: { at: ago(DAY) } });
  await qb("followup-v1", "approved", { review: { at: ago(DAY) }, revisions: [{ text: "sửa", reason: "rõ hơn" }] });
  await qb("followup-v1", "deprecated", { deprecation: { at: ago(DAY) } });
  await qb("followup-v2", "approved", { review: { at: ago(DAY) } });
  await qb("followup-v2", "approved", { review: { at: ago(DAY) } });
  await qb("followup-v2", "pending_review"); // chưa có quyết định: không tính

  // ── Đổi version: duyệt đề xuất eval-v1 → eval-v2, rồi rollback; bật followup-v2 bằng script ──
  const v2 = await pv.createVersion("evaluation", { fewShotExamples: [{ input: "a", output: "b" }] });
  const proposal = await AIImprovementProposal.create({
    target: "evaluation", kind: "few_shot", groupKey: "problem_solving",
    before: { promptKey: "evaluation", version: "eval-v1" },
    after: { promptKey: "evaluation", version: v2.version },
  });
  await review.reviewProposal(proposal._id, { action: "approve" }, moderator._id);
  await new Promise((r) => setTimeout(r, 5));
  await review.reviewProposal(proposal._id, { action: "rollback", note: "tỉ lệ bị sửa tăng" }, moderator._id);
  await new Promise((r) => setTimeout(r, 5));
  const f2 = await pv.createVersion("question_gen", {});
  await pv.activate("question_gen", f2.version);

  const result = await getQualityStats({}, { now: new Date(Date.now() + 1000), useCache: false });
  stats = result.stats;
  stats.proposalId = String(proposal._id);
});

after(async () => {
  if (http?.server) await stopHttpServer(http.server);
  if (harness) await stopMongoHarness(harness);
});

describe("Quality Dashboard — rubric (AI-07)", () => {
  it("rubric chờ duyệt, quá 7 ngày, chờ lâu nhất", () => {
    assert.equal(stats.rubrics.pendingReview, 2);
    assert.equal(stats.rubrics.pendingOver7d, 1);
    assert.ok(Math.abs(stats.rubrics.oldestPendingHours - 240) < 0.1);
  });

  it("duyệt trong kỳ và thời gian duyệt (trung vị 48, 12, 24 giờ = 24)", () => {
    assert.equal(stats.rubrics.reviewedInPeriod, 4);
    assert.equal(stats.rubrics.approvedInPeriod, 3); // approved ×2 + archived
    assert.equal(stats.rubrics.rejectedInPeriod, 1);
    assert.equal(stats.rubrics.medianReviewHours, 24);
    assert.equal(stats.rubrics.withoutSubmitTime, 1);
  });
});

describe("Quality Dashboard — tỉ lệ bị sửa trước / sau đổi version (AI-07)", () => {
  it("3 lần đổi, mới nhất trước", () => {
    assert.deepEqual(
      stats.promptVersionChanges.map((c) => `${c.promptKey}:${c.fromVersion}→${c.toVersion}:${c.change}`),
      ["question_gen:followup-v1→followup-v2:activate", "evaluation:eval-v2→eval-v1:rollback", "evaluation:eval-v1→eval-v2:activate"],
    );
  });

  it("evaluation: eval-v1 1/10 câu bị chấm lại, eval-v2 2/5", () => {
    const approve = stats.promptVersionChanges.find((c) => c.change === "activate" && c.promptKey === "evaluation");
    assert.deepEqual(approve.before, { sample: 10, corrected: 1, rate: 0.1 });
    assert.deepEqual(approve.after, { sample: 5, corrected: 2, rate: 0.4 });
    assert.equal(approve.rateDelta, 0.3);
    assert.equal(approve.proposal._id, stats.proposalId);
    const rollback = stats.promptVersionChanges.find((c) => c.change === "rollback");
    assert.deepEqual(rollback.after, approve.before);
    assert.equal(rollback.proposal._id, stats.proposalId);
  });

  it("question_gen: followup-v1 2/4 bị sửa hoặc khai tử, followup-v2 0/2", () => {
    const c = stats.promptVersionChanges.find((x) => x.promptKey === "question_gen");
    assert.deepEqual(c.before, { sample: 4, corrected: 2, rate: 0.5 });
    assert.deepEqual(c.after, { sample: 2, corrected: 0, rate: 0 });
    assert.equal(c.rateDelta, -0.5);
    assert.equal(c.proposal, null);
  });

  it("activate() ghi lịch sử bật, kể cả bật lại khi rollback", async () => {
    const v1 = await PromptVersion.findOne({ version: "eval-v1" }).lean();
    assert.equal(v1.activations.length, 1);
    assert.equal(v1.activations[0].previousVersion, "eval-v2");
    const v2 = await PromptVersion.findOne({ version: "eval-v2" }).lean();
    assert.equal(v2.activations[0].previousVersion, "eval-v1"); // DB chưa có bản active → bản mặc định
    assert.equal(String(v2.activations[0].by), String(moderator._id));
  });

  it("bản bật trước AI-07 (không có lịch sử): fromVersion null, không tính trước", async () => {
    await PromptVersion.collection.updateOne({ version: "followup-v2" }, { $set: { activations: [] } });
    const { getQualityStats } = await import("../services/moderationQualityService.js");
    const { stats: s } = await getQualityStats({}, { now: new Date(Date.now() + 1000), useCache: false });
    const c = s.promptVersionChanges.find((x) => x.promptKey === "question_gen");
    assert.equal(c.fromVersion, null);
    assert.equal(c.before, null);
    assert.equal(c.rateDelta, null);
  });
});

describe("GET /api/moderator/quality/stats (AI-07)", () => {
  it("trả rubrics và promptVersionChanges", async () => {
    const res = await fetch(`${http.baseUrl}/api/moderator/quality/stats`, {
      headers: { Authorization: `Bearer ${mintAccessToken(moderator._id)}` },
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.stats.rubrics.pendingReview, 2);
    assert.ok(Array.isArray(body.stats.promptVersionChanges));
  });
});
