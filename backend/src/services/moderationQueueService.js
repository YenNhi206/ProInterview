/**
 * moderationQueueService.js — hàng đợi kiểm định của moderator (spec S1 §2.2, §2.3, §3).
 *  - Tạo item: report AI (question_report / evaluation_report), chấm thiếu tiêu chí (evaluation_incomplete).
 *  - Đọc / nhận / xử lý item: /api/moderator/queue*.
 */
import mongoose from "mongoose";
import { ModerationItem, PRIORITY_RANK } from "../models/ModerationItem.js";
import { Report } from "../models/Report.js";
import { InterviewSession } from "../models/InterviewSession.js";
import { QuestionBank } from "../models/QuestionBank.js";
import { deprecateQuestion, editQuestion } from "./questionBankService.js";
import { deliverNotification } from "./notificationDeliveryService.js";
import { logger } from "../config/logger.js";

/** Chụp câu hỏi / transcript / điểm AI của 1 câu tại thời điểm tạo item. */
export function buildSessionSnapshot(session, questionIndex) {
  const question = session?.questions?.[questionIndex];
  const answer = (session?.answers ?? []).find((a) => a.questionIndex === questionIndex);
  const evaluation = (session?.feedback?.perQuestion ?? []).find((q) => q.questionIndex === questionIndex) ?? null;
  return {
    questionText: question?.question || answer?.questionText || "",
    transcript: answer?.transcript || "",
    aiEvaluation: evaluation
      ? {
          scores: evaluation.scores ?? null,
          overall: evaluation.overall5 ?? null,
          shrmLevel: evaluation.shrmLevel ?? "",
          promptVersion: session?.feedback?.promptVersion ?? "",
          ...(answer?.incompleteFields?.length ? { incompleteFields: answer.incompleteFields } : {}),
        }
      : null,
  };
}

/** Report AI → 1 ModerationItem. reasonCode "offensive" luôn priority high. */
export async function createItemForReport({ report, session }) {
  const priority = report.reasonCode === "offensive" ? "high" : "normal";
  return ModerationItem.create({
    type: report.targetType === "interview_question" ? "question_report" : "evaluation_report",
    priority,
    refs: {
      sessionId: session._id,
      questionIndex: report.questionIndex,
      questionBankId: session.questions?.[report.questionIndex]?.questionBankId ?? null,
      reportId: report._id,
      userId: report.reportedBy,
    },
    snapshot: buildSessionSnapshot(session, report.questionIndex),
  });
}

/**
 * evaluation_incomplete — idempotent theo (session, câu): upsert, gọi evaluate nhiều lần vẫn 1 item.
 * Upsert không chạy pre("validate") nên tự set priorityRank.
 */
export async function upsertIncompleteEvaluationItem({ session, questionIndex }) {
  const filter = { type: "evaluation_incomplete", "refs.sessionId": session._id, "refs.questionIndex": questionIndex };
  // type / refs.sessionId / refs.questionIndex đã nằm trong filter (upsert tự chép vào doc mới) —
  // set refs còn lại bằng dotted path để không đụng path "refs".
  const update = {
    $setOnInsert: {
      status: "open",
      priority: "high",
      priorityRank: PRIORITY_RANK.high,
      "refs.questionBankId": session.questions?.[questionIndex]?.questionBankId ?? null,
      "refs.reportId": null,
      "refs.userId": session.userId,
      snapshot: buildSessionSnapshot(session, questionIndex),
    },
  };
  try {
    return await ModerationItem.findOneAndUpdate(filter, update, { upsert: true, returnDocument: "after" });
  } catch (err) {
    if (err?.code !== 11000) throw err;
    return ModerationItem.findOne(filter);
  }
}

// ── Đọc hàng đợi ──────────────────────────────────────────────────────────────────────────────

/** Mặc định chỉ item còn mở (open + in_review); ưu tiên cao trước, cũ nhất trước. */
export async function listQueue({ type, status, priority, assignee, page = 1, limit = 20 }, moderatorId) {
  const filter = { status: status ?? { $in: ["open", "in_review"] } };
  if (type) filter.type = type;
  if (priority) filter.priority = priority;
  if (assignee === "me") filter.assignee = moderatorId;
  if (assignee === "unassigned") filter.assignee = null;
  const [items, total] = await Promise.all([
    ModerationItem.find(filter)
      .sort({ priorityRank: -1, createdAt: 1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate("assignee", "name email")
      .lean(),
    ModerationItem.countDocuments(filter),
  ]);
  return { ok: true, items, pagination: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) } };
}

/** Item + report gốc + câu trong bank + điểm moderator hiện tại (nếu đã chấm lại). */
export async function getQueueItem(id) {
  const item = await ModerationItem.findById(id).populate("assignee", "name email").lean();
  if (!item) return { ok: false, status: 404, error: "Không tìm thấy mục kiểm định." };
  const [report, question, session] = await Promise.all([
    item.refs?.reportId ? Report.findById(item.refs.reportId).populate("reportedBy", "name email").lean() : null,
    item.refs?.questionBankId ? QuestionBank.findById(item.refs.questionBankId).select("-history -sampleSessionIds").lean() : null,
    item.refs?.sessionId ? InterviewSession.findById(item.refs.sessionId).select("answers").lean() : null,
  ]);
  const answer = (session?.answers ?? []).find((a) => a.questionIndex === item.refs?.questionIndex);
  return { ok: true, item, report, question, moderatorOverride: answer?.moderatorOverride ?? null };
}

// ── Nhận / xử lý ─────────────────────────────────────────────────────────────────────────────

const CLOSED = ["resolved", "dismissed"];

/** Gán cho mình + in_review. Đang được moderator khác nhận → 409. */
export async function claimItem(id, moderatorId) {
  const item = await ModerationItem.findOneAndUpdate(
    { _id: id, status: { $nin: CLOSED }, assignee: { $in: [null, moderatorId] } },
    { $set: { assignee: moderatorId, status: "in_review" } },
    { returnDocument: "after" },
  ).lean();
  if (item) return { ok: true, item };
  const existing = await ModerationItem.findById(id).select("status assignee").lean();
  if (!existing) return { ok: false, status: 404, error: "Không tìm thấy mục kiểm định." };
  if (CLOSED.includes(existing.status)) return { ok: false, status: 409, error: "Mục này đã được xử lý." };
  return { ok: false, status: 409, error: "Mục này đang được moderator khác xử lý." };
}

const RESOLVED_MESSAGE = {
  dismiss: "Đội kiểm định đã xem xét báo cáo của bạn và giữ nguyên kết quả.",
  deprecate_question: "Câu hỏi bạn báo cáo đã bị loại khỏi ngân hàng câu hỏi. Cảm ơn bạn!",
  edit_question: "Câu hỏi bạn báo cáo đã được chỉnh sửa. Cảm ơn bạn!",
  override_score: "Điểm câu trả lời của bạn đã được moderator chấm lại.",
};

/** Moderator chấm lại — lưu song song, KHÔNG đụng điểm AI gốc ở feedback.perQuestion. */
async function writeModeratorOverride(item, payload, note, moderatorId) {
  const { sessionId, questionIndex } = item.refs ?? {};
  if (!sessionId || questionIndex === null || questionIndex === undefined) {
    return { ok: false, status: 400, error: "Mục này không gắn với câu trả lời nào để chấm lại." };
  }
  const s = payload.scores;
  const override = {
    scores: s,
    overall: payload.overall ?? Math.round(((s.clarity + s.structure + s.relevance + s.credibility) / 4) * 10) / 10,
    shrmLevel: payload.shrmLevel,
    note,
    by: moderatorId,
    at: new Date(),
  };
  const set = await InterviewSession.updateOne(
    { _id: sessionId, "answers.questionIndex": questionIndex },
    { $set: { "answers.$.moderatorOverride": override } },
  );
  if (set.matchedCount === 0) {
    const pushed = await InterviewSession.updateOne(
      { _id: sessionId, "answers.questionIndex": { $ne: questionIndex } },
      { $push: { answers: { questionIndex, transcript: "", moderatorOverride: override } } },
    );
    if (pushed.matchedCount === 0) return { ok: false, status: 404, error: "Không tìm thấy phiên phỏng vấn." };
  }
  return { ok: true, override };
}

/**
 * Xử lý item: dismiss | deprecate_question | edit_question | override_score.
 * Xong thì đóng item, cập nhật Report gốc và báo cho người đã báo (hoặc chủ session khi chấm lại
 * một evaluation_incomplete).
 */
export async function resolveItem(id, { action, note = "", payload = {} }, moderatorId) {
  if (!mongoose.isValidObjectId(id)) return { ok: false, status: 400, error: "id không hợp lệ." };
  const item = await ModerationItem.findById(id);
  if (!item) return { ok: false, status: 404, error: "Không tìm thấy mục kiểm định." };
  if (CLOSED.includes(item.status)) return { ok: false, status: 409, error: "Mục này đã được xử lý." };
  if (item.assignee && String(item.assignee) !== String(moderatorId)) {
    return { ok: false, status: 409, error: "Mục này đang được moderator khác xử lý." };
  }

  let outcome = { ok: true };
  if (action === "deprecate_question" || action === "edit_question") {
    const bankId = item.refs?.questionBankId;
    if (!bankId) return { ok: false, status: 400, error: "Mục này không gắn với câu hỏi nào trong ngân hàng." };
    outcome =
      action === "deprecate_question"
        ? await deprecateQuestion(bankId, { reason: payload.reason || note || "Moderator khai tử từ hàng đợi" }, moderatorId)
        : await editQuestion(bankId, { ...payload, reason: note || "Sửa từ hàng đợi kiểm định" }, moderatorId);
  } else if (action === "override_score") {
    outcome = await writeModeratorOverride(item, payload, note, moderatorId);
  }
  if (!outcome.ok) return outcome;

  const now = new Date();
  item.status = action === "dismiss" ? "dismissed" : "resolved";
  item.assignee = item.assignee ?? moderatorId;
  item.resolution = { action, note, by: moderatorId, at: now };
  await item.save();

  let notifyUserId = null;
  if (item.refs?.reportId) {
    const report = await Report.findByIdAndUpdate(
      item.refs.reportId,
      {
        $set: {
          status: action === "dismiss" ? "dismissed" : "resolved",
          resolvedBy: moderatorId,
          resolvedAt: now,
          resolution: note || RESOLVED_MESSAGE[action],
        },
      },
      { returnDocument: "after" },
    ).lean();
    notifyUserId = report?.reportedBy ?? null;
  } else if (action === "override_score") {
    notifyUserId = item.refs?.userId ?? null;
  }

  if (notifyUserId) {
    const sessionId = item.refs?.sessionId ? String(item.refs.sessionId) : "";
    await deliverNotification(notifyUserId, {
      type: "feedback",
      title: action === "override_score" ? "Kết quả phỏng vấn đã được kiểm định" : "Báo cáo của bạn đã được xử lý",
      body: RESOLVED_MESSAGE[action],
      // Notification.metadata chỉ lưu actionUrl (schema) — sessionId đi kèm trong link.
      metadata: { actionUrl: sessionId ? `/interview/feedback?sessionId=${sessionId}` : "/interview" },
    }).catch((err) => logger.warn("moderation_notify_failed", { itemId: String(item._id), error: err?.message }));
  }

  return { ok: true, item: item.toObject(), ...(outcome.override && { moderatorOverride: outcome.override }) };
}
