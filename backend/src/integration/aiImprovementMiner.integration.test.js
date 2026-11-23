/**
 * Integration AI-03: AIImprovementProposal + aiImprovementMinerService + promptVersionService.createVersion.
 * "Xong khi": đủ ngưỡng thì tạo đúng 1 đề xuất.
 */
import { describe, it, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import { applyTestEnv, startMongoHarness, stopMongoHarness } from "../test_helpers/mongoTestHarness.js";

applyTestEnv();
process.env.MAIL_USER = "";
process.env.MAIL_PASS = "";
delete process.env.AI_IMPROVEMENT_MIN_EVIDENCE;

let harness;
let User;
let InterviewSession;
let QuestionBank;
let hashQuestionText;
let ModerationItem;
let PromptVersion;
let AIImprovementProposal;
let Notification;
let pv;
let miner;
let seq = 0;

before(async () => {
  harness = await startMongoHarness();
  ({ User } = await import("../models/User.js"));
  ({ InterviewSession } = await import("../models/InterviewSession.js"));
  ({ QuestionBank, hashQuestionText } = await import("../models/QuestionBank.js"));
  ({ ModerationItem } = await import("../models/ModerationItem.js"));
  ({ PromptVersion } = await import("../models/PromptVersion.js"));
  ({ AIImprovementProposal } = await import("../models/AIImprovementProposal.js"));
  ({ Notification } = await import("../models/Notification.js"));
  pv = await import("../services/promptVersionService.js");
  miner = await import("../services/aiImprovementMinerService.js");
  await Promise.all([PromptVersion.syncIndexes(), AIImprovementProposal.syncIndexes(), ModerationItem.syncIndexes()]);
});

after(async () => {
  await stopMongoHarness(harness);
});

let moderator;
let customer;

beforeEach(async () => {
  await Promise.all([
    User.deleteMany({}), InterviewSession.deleteMany({}), QuestionBank.deleteMany({}), ModerationItem.deleteMany({}),
    PromptVersion.deleteMany({}), AIImprovementProposal.deleteMany({}), Notification.deleteMany({}),
  ]);
  pv.clearPromptCache();
  seq += 1;
  moderator = await User.create({ name: "Mod", email: `ai03-mod-${seq}@test.local`, role: "moderator" });
  customer = await User.create({ name: "Cand", email: `ai03-cand-${seq}@test.local`, role: "customer" });
});

/** Một câu trả lời đã được moderator chấm lại (item resolved + moderatorOverride trên session). */
async function overriddenAnswer({ competencyId = "problem_solving", aiOverall = 4, modOverall = 2, status = "resolved" } = {}) {
  const override = {
    scores: { clarity: modOverall, structure: modOverall, relevance: modOverall, credibility: modOverall },
    overall: modOverall,
    shrmLevel: "developing",
    note: "AI chấm quá cao, không có số liệu",
    by: moderator._id,
    at: new Date(),
  };
  const session = await InterviewSession.create({
    userId: customer._id,
    hrGender: "female",
    status: "completed",
    questions: [{ id: "q1", question: `Kể về một lần bạn xử lý sự cố (${competencyId})`, competencyId }],
    answers: [{ questionIndex: 0, transcript: "Em sửa lỗi rồi báo sếp.", moderatorOverride: override }],
    feedback: { perQuestion: [{ questionIndex: 0, overall5: aiOverall }], promptVersion: "eval-v1" },
  });
  return ModerationItem.create({
    type: "evaluation_report",
    status,
    refs: { sessionId: session._id, questionIndex: 0, userId: customer._id },
    snapshot: {
      questionText: session.questions[0].question,
      transcript: "Em sửa lỗi rồi báo sếp.",
      aiEvaluation: { overall: aiOverall, promptVersion: "eval-v1" },
    },
    resolution: status === "resolved" ? { action: "override_score", note: "chấm lại", by: moderator._id, at: new Date() } : undefined,
  });
}

async function editedQuestion({ roleCategory = "software_engineering", orgId = null, action = "edit_question" } = {}) {
  seq += 1;
  const original = `Câu hỏi mơ hồ số ${seq} về dự án`;
  const q = await QuestionBank.create({
    text: action === "edit_question" ? `Câu hỏi đã sửa số ${seq}: kể cụ thể vai trò của bạn` : original,
    originalText: original,
    textHash: hashQuestionText(`${original}-${seq}`),
    source: "llm_followup",
    roleCategory,
    orgId,
    status: action === "deprecate_question" ? "deprecated" : "approved",
  });
  return ModerationItem.create({
    type: "question_report",
    status: "resolved",
    refs: { questionBankId: q._id, userId: customer._id },
    snapshot: { questionText: original },
    resolution: { action, note: "câu mơ hồ", by: moderator._id, at: new Date() },
  });
}

describe("createVersion (AI-03, đề xuất h)", () => {
  it("chưa có bản trong DB: tạo từ bản mặc định, tên tự tăng, không bật", async () => {
    const v = await pv.createVersion("evaluation", { fewShotExamples: [{ input: "a", output: "b" }] });
    assert.equal(v.version, "eval-v2");
    assert.equal(v.active, false);
    assert.equal(v.fewShotExamples.length, 1);
    const v3 = await pv.createVersion("evaluation", {});
    assert.equal(v3.version, "eval-v3");
    // Bản active không đổi: loader vẫn chạy bản mặc định.
    const active = await pv.getActivePrompt("evaluation");
    assert.equal(active.version, "eval-v1");
  });

  it("chép template và few-shot của bản gốc; activate được bản mới", async () => {
    const v2 = await pv.createVersion("evaluation", { fewShotExamples: [{ input: "x", output: "y", note: "n" }] });
    await pv.activate("evaluation", v2.version);
    const v3 = await pv.createVersion("evaluation", { baseVersion: "eval-v2" });
    assert.deepEqual(v3.fewShotExamples, [{ input: "x", output: "y", note: "n" }]);
    const reloaded = await pv.activate("evaluation", v3.version);
    assert.equal(reloaded.active, true);
  });

  it("từ chối template thiếu phần, tên sai tiền tố, key lạ, trùng tên", async () => {
    await assert.rejects(pv.createVersion("evaluation", { template: { system: "x" } }), (e) => e.status === 400);
    await assert.rejects(pv.createVersion("evaluation", { version: "followup-v9" }), (e) => e.status === 400);
    await assert.rejects(pv.createVersion("khong_co", {}), (e) => e.status === 400);
    await assert.rejects(pv.createVersion("evaluation", { baseVersion: "eval-v99" }), (e) => e.status === 404);
    await pv.createVersion("evaluation", { version: "eval-v7" });
    await assert.rejects(pv.createVersion("evaluation", { version: "eval-v7" }), (e) => e.status === 409);
  });
});

describe("aiImprovementMinerService (AI-03)", () => {
  it("dưới ngưỡng: không tạo đề xuất", async () => {
    for (let i = 0; i < 4; i += 1) await overriddenAnswer();
    const { created } = await miner.mineImprovementProposals();
    assert.equal(created.length, 0);
    assert.equal(await AIImprovementProposal.countDocuments(), 0);
    assert.equal(await PromptVersion.countDocuments(), 0);
  });

  it("đủ ngưỡng (5): tạo đúng 1 đề xuất + 1 PromptVersion chưa bật + báo moderator", async () => {
    const items = [];
    for (let i = 0; i < 5; i += 1) items.push(await overriddenAnswer({ aiOverall: 4, modOverall: 2 + (i === 0 ? 0.5 : 0) }));
    // Nhiễu: item chưa xử lý, item dismiss, nhóm khác dưới ngưỡng.
    await overriddenAnswer({ status: "open" });
    await overriddenAnswer({ competencyId: "communication" });

    const { created } = await miner.mineImprovementProposals();
    assert.equal(created.length, 1);
    const [p] = await AIImprovementProposal.find().lean();
    assert.equal(p.target, "evaluation");
    assert.equal(p.kind, "few_shot");
    assert.equal(p.groupKey, "problem_solving");
    assert.equal(p.status, "proposed");
    assert.equal(p.evidence.overrideCount, 5);
    assert.deepEqual(p.evidence.moderationItemIds.map(String).sort(), items.map((i) => String(i._id)).sort());
    assert.equal(p.evidence.avgScoreDelta, -1.9);
    assert.equal(p.before.version, "eval-v1");
    assert.equal(p.after.version, "eval-v2");
    assert.equal(p.after.fewShotExamples.length, miner.NEW_EXAMPLES_PER_PROPOSAL);
    assert.match(p.after.fewShotExamples[0].output, /"overall":2/);

    const version = await PromptVersion.findOne({ version: "eval-v2" }).lean();
    assert.equal(version.active, false);
    assert.equal(version.fewShotExamples.length, 3);
    assert.equal((await pv.getActivePrompt("evaluation")).version, "eval-v1");

    const notes = await Notification.find({ type: "ai_improvement_proposed" }).lean();
    assert.equal(notes.length, 1);
    assert.equal(String(notes[0].userId), String(moderator._id));
    assert.equal(String(notes[0].metadata.proposalId), String(p._id));
  });

  it("chạy lại: không tạo đề xuất thứ hai từ cùng bằng chứng", async () => {
    for (let i = 0; i < 6; i += 1) await overriddenAnswer();
    await miner.mineImprovementProposals();
    const again = await miner.mineImprovementProposals();
    assert.equal(again.created.length, 0);
    assert.equal(await AIImprovementProposal.countDocuments(), 1);
    assert.equal(await PromptVersion.countDocuments(), 1);
  });

  it("nhóm đang có đề xuất chờ duyệt: bằng chứng mới để lại, không tạo thêm", async () => {
    for (let i = 0; i < 5; i += 1) await overriddenAnswer();
    await miner.mineImprovementProposals();
    for (let i = 0; i < 5; i += 1) await overriddenAnswer();
    const second = await miner.mineImprovementProposals();
    assert.equal(second.created.length, 0);
    assert.deepEqual(second.skipped, [{ target: "evaluation", groupKey: "problem_solving", reason: "open_proposal" }]);

    // Đề xuất cũ bị từ chối → lượt sau dùng 5 item còn lại.
    await AIImprovementProposal.updateMany({}, { $set: { status: "rejected" } });
    const third = await miner.mineImprovementProposals();
    assert.equal(third.created.length, 1);
    assert.equal(third.created[0].after.version, "eval-v3");
  });

  it("câu sửa / khai tử: đề xuất question_gen theo roleCategory; bỏ câu công ty", async () => {
    for (let i = 0; i < 3; i += 1) await editedQuestion();
    for (let i = 0; i < 2; i += 1) await editedQuestion({ action: "deprecate_question" });
    for (let i = 0; i < 5; i += 1) await editedQuestion({ roleCategory: "marketing", orgId: new mongoose.Types.ObjectId() });

    const { created } = await miner.mineImprovementProposals();
    assert.equal(created.length, 1);
    const [p] = created;
    assert.equal(p.target, "question_gen");
    assert.equal(p.groupKey, "software_engineering");
    assert.equal(p.evidence.avgScoreDelta, null);
    assert.equal(p.before.version, "followup-v1");
    assert.equal(p.after.version, "followup-v2");
    assert.ok(p.after.fewShotExamples.some((e) => /sửa thành/.test(e.output)));
  });

  it("ngưỡng đọc từ AI_IMPROVEMENT_MIN_EVIDENCE", async () => {
    process.env.AI_IMPROVEMENT_MIN_EVIDENCE = "2";
    try {
      await overriddenAnswer();
      await overriddenAnswer();
      const { created } = await miner.mineImprovementProposals();
      assert.equal(created.length, 1);
    } finally {
      delete process.env.AI_IMPROVEMENT_MIN_EVIDENCE;
    }
  });
});
