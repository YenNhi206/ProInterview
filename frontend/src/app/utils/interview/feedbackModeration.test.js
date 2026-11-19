import { test } from "node:test";
import assert from "node:assert/strict";
import { AI_REPORT_REASONS, effectiveEvaluation, reportableTargets } from "./feedbackModeration.js";

const aiScores = { clarity: 2, structure: 2, relevance: 2, credibility: 2 };

test("effectiveEvaluation: không có override → điểm AI, không chờ", () => {
  const r = effectiveEvaluation({ overall: 2, scores: aiScores, shrmLevel: "developing" });
  assert.equal(r.overall, 2);
  assert.equal(r.reviewedByModerator, false);
  assert.equal(r.pending, false);
});

test("effectiveEvaluation: AI chấm thiếu tiêu chí hoặc đã báo sai → đang chờ kiểm định", () => {
  assert.equal(effectiveEvaluation({ overall: 3, evaluationIncomplete: true }).pending, true);
  assert.equal(effectiveEvaluation({ overall: 3, openReports: ["interview_evaluation"] }).pending, true);
});

test("effectiveEvaluation: có override → điểm moderator thay điểm AI, giữ aiOverall", () => {
  const r = effectiveEvaluation({
    overall: 2, scores: aiScores, shrmLevel: "developing", evaluationIncomplete: true,
    moderatorOverride: { overall: 4.1, scores: { clarity: 4, structure: 4, relevance: 4.5, credibility: 4 }, shrmLevel: "proficient", note: "Có STAR đầy đủ" },
  });
  assert.equal(r.overall, 4.1);
  assert.equal(r.aiOverall, 2);
  assert.equal(r.scores.relevance, 4.5);
  assert.equal(r.shrmLevel, "proficient");
  assert.equal(r.reviewedByModerator, true);
  assert.equal(r.moderatorNote, "Có STAR đầy đủ");
  assert.equal(r.pending, false, "chấm thiếu tiêu chí đã được moderator xử lý");
});

test("reportableTargets: loại đã báo không gửi lại được", () => {
  assert.deepEqual(reportableTargets([]), ["interview_question", "interview_evaluation"]);
  assert.deepEqual(reportableTargets(["interview_question"]), ["interview_evaluation"]);
  assert.deepEqual(reportableTargets(["interview_question", "interview_evaluation"]), []);
});

test("AI_REPORT_REASONS chỉ dùng reasonCode backend chấp nhận", () => {
  const allowed = new Set(["irrelevant", "inaccurate_scoring", "hallucination", "offensive", "other"]);
  for (const list of Object.values(AI_REPORT_REASONS)) {
    for (const r of list) assert.ok(allowed.has(r.id), r.id);
  }
});
