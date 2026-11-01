/**
 * Integration: schema S1 (QuestionBank mở rộng, ModerationItem, Report AI, InterviewSession).
 */
import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import { applyTestEnv, startMongoHarness, stopMongoHarness } from "../test_helpers/mongoTestHarness.js";

applyTestEnv();

let harness;
let QuestionBank;
let hashQuestionText;
let ModerationItem;
let Report;
let InterviewSession;

before(async () => {
  harness = await startMongoHarness();
  ({ QuestionBank, hashQuestionText } = await import("../models/QuestionBank.js"));
  ({ ModerationItem } = await import("../models/ModerationItem.js"));
  ({ Report } = await import("../models/Report.js"));
  ({ InterviewSession } = await import("../models/InterviewSession.js"));
  await Promise.all([QuestionBank.init(), ModerationItem.init(), Report.init()]);
});

after(async () => {
  if (harness) await stopMongoHarness(harness);
});

const oid = () => new mongoose.Types.ObjectId();

describe("QuestionBank", () => {
  it("hash SHA-256 chuẩn hoá hoa/thường, khoảng trắng, dấu câu cuối", () => {
    const a = hashQuestionText("Hãy kể về  một DỰ ÁN khó?");
    const b = hashQuestionText("  hãy kể về một dự án khó  ");
    assert.equal(a, b);
    assert.equal(a.length, 64);
  });

  it("`question` là alias của `text`; unique (textHash, orgId)", async () => {
    const text = `Câu alias ${Date.now()}`;
    const doc = await QuestionBank.create({ question: text, source: "llm_followup", textHash: hashQuestionText(text) });
    assert.equal(doc.text, text);
    assert.equal(doc.status, "pending_review");
    assert.equal(doc.usageCount, 0);
    await assert.rejects(
      QuestionBank.create({ text, source: "llm_followup", textHash: hashQuestionText(text) }),
      /duplicate key/,
    );
    // Cùng text nhưng thuộc 1 tổ chức → được phép
    await QuestionBank.create({ text, source: "org_template", orgId: oid(), textHash: hashQuestionText(text) });
  });
});

describe("ModerationItem", () => {
  it("priorityRank suy ra từ priority để sort đúng high > normal > low", async () => {
    const created = await ModerationItem.create([
      { type: "question_report", priority: "low" },
      { type: "question_report", priority: "high" },
      { type: "question_report", priority: "normal" },
    ]);
    const ids = created.map((d) => d._id);
    const sorted = await ModerationItem.find({ _id: { $in: ids } }).sort({ priorityRank: -1 }).lean();
    assert.deepEqual(sorted.map((d) => d.priority), ["high", "normal", "low"]);
  });

  it("evaluation_incomplete unique theo (session, câu); item không report không đụng index reportId", async () => {
    const sessionId = oid();
    await ModerationItem.create({ type: "evaluation_incomplete", priority: "high", refs: { sessionId, questionIndex: 1 } });
    await assert.rejects(
      ModerationItem.create({ type: "evaluation_incomplete", refs: { sessionId, questionIndex: 1 } }),
      /duplicate key/,
    );
    await ModerationItem.create({ type: "evaluation_incomplete", refs: { sessionId, questionIndex: 2 } });

    const reportId = oid();
    await ModerationItem.create({ type: "question_report", refs: { reportId } });
    await assert.rejects(ModerationItem.create({ type: "evaluation_report", refs: { reportId } }), /duplicate key/);
  });
});

describe("Report", () => {
  it("report AI cần reasonCode, không cần reason/description; unique theo user + session + câu", async () => {
    const reportedBy = oid();
    const targetId = oid();
    const base = { reportedBy, targetType: "interview_question", targetId, questionIndex: 3 };
    await assert.rejects(Report.create(base), /reasonCode/);
    await Report.create({ ...base, reasonCode: "irrelevant" });
    await assert.rejects(Report.create({ ...base, reasonCode: "other" }), /duplicate key/);
    // Khác targetType trên cùng câu → được
    await Report.create({ ...base, targetType: "interview_evaluation", reasonCode: "inaccurate_scoring" });
  });

  it("report mentor vẫn bắt buộc reason + description như cũ", async () => {
    await assert.rejects(
      Report.create({ reportedBy: oid(), targetType: "mentor", targetId: oid() }),
      /reason|description/,
    );
    // Nhiều report mentor của cùng user không bị index unique (questionIndex null)
    const reportedBy = oid();
    const targetId = oid();
    const row = { reportedBy, targetType: "mentor", targetId, reason: "late", description: "Mentor tới trễ 20 phút" };
    await Report.create(row);
    await Report.create(row);
  });
});

describe("InterviewSession.answers", () => {
  it("lưu moderatorOverride song song, mặc định null", async () => {
    const s = await InterviewSession.create({
      userId: oid(),
      hrGender: "female",
      answers: [{ questionIndex: 0, transcript: "x" }],
    });
    assert.equal(s.answers[0].moderatorOverride, null);
    assert.equal(s.answers[0].evaluationIncomplete, false);
    s.answers[0].moderatorOverride = {
      scores: { clarity: 4, structure: 4, relevance: 3.5, credibility: 4 },
      overall: 4,
      shrmLevel: "proficient",
      by: oid(),
      at: new Date(),
    };
    await s.save();
    const again = await InterviewSession.findById(s._id).lean();
    assert.equal(again.answers[0].moderatorOverride.overall, 4);
  });
});
