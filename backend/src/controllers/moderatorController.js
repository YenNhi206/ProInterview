import mongoose from "mongoose";
import * as questionBankService from "../services/questionBankService.js";
import * as moderationQueueService from "../services/moderationQueueService.js";
import { getQualityStats } from "../services/moderationQualityService.js";
import {
  validate,
  listQuestionsQuery,
  createQuestionBody,
  editQuestionBody,
  approveQuestionBody,
  deprecateQuestionBody,
  bulkQuestionsBody,
  listQueueQuery,
  resolveQueueBody,
  qualityStatsQuery,
  listModeratorJobsQuery,
  jobVisibilityBody,
  listAiImprovementsQuery,
  reviewAiImprovementBody,
} from "../dto/moderator.dto.js";
import * as aiImprovementReviewService from "../services/aiImprovementReviewService.js";
import { listJobsForModerator, setJobVisibility } from "../services/jobPostModerationService.js";

/** Service ném `httpError` → kết quả `{ ok, status, error }` mà `send` hiểu. */
async function toResult(promise) {
  try {
    return { ok: true, ...(await promise) };
  } catch (error) {
    if (error?.status) return { ok: false, status: error.status, error: error.message };
    throw error;
  }
}

/**
 * /api/moderator/* — HITL kiểm định chất lượng AI (spec S1 §3).
 * Router đã gắn authJwt + requireModerator + adminAuditLog (routes/moderator.js).
 */

/** Kết quả service `{ ok, status?, error?, ...data }` → `{ success, ...data }` / `{ success: false, error }`. */
function send(res, result, okStatus = 200) {
  if (!result.ok) return res.status(result.status ?? 500).json({ success: false, error: result.error });
  const { ok: _ok, status: _status, ...data } = result;
  return res.status(okStatus).json({ success: true, ...data });
}

/** Validate input → gọi service; lỗi validate / id sai định dạng trả 400. */
function handle(schema, source, fn, { okStatus = 200, needsId = false } = {}) {
  return async (req, res) => {
    if (needsId && !mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ success: false, error: "id không hợp lệ." });
    }
    let value = {};
    if (schema) {
      const v = validate(schema, req[source]);
      if (v.error) return res.status(400).json({ success: false, error: v.error });
      value = v.value;
    }
    const result = await fn(value, req);
    return send(res, result, okStatus);
  };
}

export const ModeratorController = {
  // ── Questions ──
  listQuestions: handle(listQuestionsQuery, "query", (q) => questionBankService.listQuestions(q)),
  getQuestion: handle(null, null, (_v, req) => questionBankService.getQuestionDetail(req.params.id), { needsId: true }),
  createQuestion: handle(createQuestionBody, "body", (b, req) => questionBankService.createQuestion(b, req.userId), { okStatus: 201 }),
  editQuestion: handle(editQuestionBody, "body", (b, req) => questionBankService.editQuestion(req.params.id, b, req.userId), { needsId: true }),
  approveQuestion: handle(approveQuestionBody, "body", (b, req) => questionBankService.approveQuestion(req.params.id, b, req.userId), { needsId: true }),
  deprecateQuestion: handle(deprecateQuestionBody, "body", (b, req) => questionBankService.deprecateQuestion(req.params.id, b, req.userId), { needsId: true }),
  bulkQuestions: handle(bulkQuestionsBody, "body", (b, req) => questionBankService.bulkUpdateQuestions(b, req.userId)),

  // ── Queue ──
  listQueue: handle(listQueueQuery, "query", (q, req) => moderationQueueService.listQueue(q, req.userId)),
  getQueueItem: handle(null, null, (_v, req) => moderationQueueService.getQueueItem(req.params.id), { needsId: true }),
  claimQueueItem: handle(null, null, (_v, req) => moderationQueueService.claimItem(req.params.id, req.userId), { needsId: true }),
  resolveQueueItem: handle(resolveQueueBody, "body", (b, req) => moderationQueueService.resolveItem(req.params.id, b, req.userId), { needsId: true }),

  // ── JB-04: tin tuyển dụng (Platform Moderator) ──
  listJobs: handle(listModeratorJobsQuery, "query", (q) => toResult(listJobsForModerator(q))),
  setJobVisibility: handle(jobVisibilityBody, "body", (b, req) => toResult(setJobVisibility(req.params.id, b, req.userId)), { needsId: true }),

  // ── Quality ──
  qualityStats: handle(qualityStatsQuery, "query", (q) => getQualityStats(q)),

  // ── AI-05: đề xuất cải tiến AI ──
  listAiImprovements: handle(listAiImprovementsQuery, "query", (q) => toResult(aiImprovementReviewService.listProposals(q))),
  getAiImprovement: handle(null, null, (_v, req) => toResult(aiImprovementReviewService.getProposal(req.params.id)), { needsId: true }),
  reviewAiImprovement: handle(reviewAiImprovementBody, "body", (b, req) => toResult(aiImprovementReviewService.reviewProposal(req.params.id, b, req.userId)), { needsId: true }),
  // Backtest chạy nền (gọi LLM khoảng 12 lần) → 202, FE tải lại chi tiết để xem kết quả.
  backtestAiImprovement: handle(null, null, async (_v, req) => {
    const result = await toResult(aiImprovementReviewService.startBacktest(req.params.id));
    if (!result.ok) return result;
    return { ok: true, backtest: result.backtest };
  }, { needsId: true, okStatus: 202 }),
};
