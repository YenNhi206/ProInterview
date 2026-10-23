/**
 * moderationQueueService.js — tạo item cho hàng đợi kiểm định của moderator (spec S1 §2.2, §2.3).
 * API đọc/xử lý hàng đợi (/api/moderator/queue) nằm ở các bước sau.
 */
import { ModerationItem, PRIORITY_RANK } from "../models/ModerationItem.js";

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
