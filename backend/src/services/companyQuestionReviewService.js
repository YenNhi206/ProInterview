/**
 * CO-16 (quyết định CO-16 ngày 23/11/2026): Platform Moderator duyệt tầng hai câu doanh nghiệp.
 *
 *   draft → pending_platform_review (Company Mod duyệt, CO-05)
 *   pending_platform_review → approved | rejected (Platform Mod, file này)
 *
 * Chỉ câu `approved` mới vào phỏng vấn. Luồng này tách khỏi ngân hàng câu chung
 * (`/api/moderator/questions`, chỉ đọc `orgId: null`). Video avatar (CO-06) render lúc Platform Mod
 * duyệt, không render lúc Company Mod duyệt.
 */
import mongoose from "mongoose";
import { QuestionBank } from "../models/QuestionBank.js";
import {
  scheduleCompanyQuestionVideoWarm,
  scheduleCompanyQuestionVideoWarmByIds,
} from "./companyQuestionVideoService.js";

export const PLATFORM_REVIEW_STATUS = "pending_platform_review";
/** Tab của trang `/moderator/company-questions`. */
export const COMPANY_QUESTION_REVIEW_TABS = [PLATFORM_REVIEW_STATUS, "approved", "rejected"];
export const COMPANY_QUESTION_BATCH_MAX = 100;
const REASON_MAX_LENGTH = 500;

const COMPANY_QUESTION_FILTER = { orgId: { $ne: null } };

function escapeRegex(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function fail(status, error) {
  return { ok: false, status, error };
}

function cleanReason(raw) {
  return String(raw ?? "").trim().slice(0, REASON_MAX_LENGTH);
}

/**
 * Danh sách câu doanh nghiệp theo trạng thái, kèm tên công ty và job.
 * @returns {Promise<{ok: true, questions: object[], counts: object, pagination: object} | {ok: false, status: number, error: string}>}
 */
export async function listCompanyQuestionsForReview({
  status = PLATFORM_REVIEW_STATUS,
  companyId,
  jobPostId,
  roleCategory,
  q,
  page = 1,
  limit = 20,
} = {}) {
  if (!COMPANY_QUESTION_REVIEW_TABS.includes(status)) return fail(400, "Trạng thái không hợp lệ.");
  if (companyId && !mongoose.isValidObjectId(companyId)) return fail(400, "Mã công ty không hợp lệ.");
  if (jobPostId && !mongoose.isValidObjectId(jobPostId)) return fail(400, "Mã tin tuyển dụng không hợp lệ.");

  const scope = { ...COMPANY_QUESTION_FILTER };
  if (companyId) scope.orgId = new mongoose.Types.ObjectId(String(companyId));
  if (jobPostId) scope.jobPostId = new mongoose.Types.ObjectId(String(jobPostId));
  if (roleCategory) scope.roleCategory = String(roleCategory);
  if (q) scope.text = { $regex: escapeRegex(String(q).slice(0, 100)), $options: "i" };

  const p = Math.max(1, Number(page) || 1);
  const l = Math.min(100, Math.max(1, Number(limit) || 20));
  const filter = { ...scope, status };

  const [questions, total, countRows] = await Promise.all([
    QuestionBank.find(filter)
      .select("text roleCategory competencyId layer seniority status orgId jobPostId moderation review history createdAt updatedAt")
      // Chờ duyệt: cũ nhất trước (xếp hàng); tab khác: mới cập nhật trước.
      .sort(status === PLATFORM_REVIEW_STATUS ? { updatedAt: 1 } : { updatedAt: -1 })
      .skip((p - 1) * l)
      .limit(l)
      .populate("orgId", "name slug logo")
      .populate("jobPostId", "title status level")
      .lean(),
    QuestionBank.countDocuments(filter),
    QuestionBank.aggregate([
      { $match: { ...scope, status: { $in: COMPANY_QUESTION_REVIEW_TABS } } },
      { $group: { _id: "$status", n: { $sum: 1 } } },
    ]),
  ]);

  const counts = Object.fromEntries(COMPANY_QUESTION_REVIEW_TABS.map((s) => [s, 0]));
  for (const row of countRows) counts[row._id] = row.n;

  return {
    ok: true,
    questions: questions.map(({ orgId, jobPostId: job, history, ...rest }) => ({
      ...rest,
      company: orgId ? { _id: orgId._id, name: orgId.name, slug: orgId.slug, logo: orgId.logo } : null,
      jobPost: job ? { _id: job._id, title: job.title, status: job.status, level: job.level } : null,
      // Lần sửa gần nhất của Company Mod: Platform Mod thấy câu đã bị đổi gì.
      lastEdit: [...(history ?? [])].reverse().find((h) => h.action === "edit") ?? null,
    })),
    counts,
    pagination: { page: p, limit: l, total, totalPages: Math.max(1, Math.ceil(total / l)) },
  };
}

/** Platform Mod duyệt một câu: `pending_platform_review` → `approved`, rồi render video (CO-06). */
export async function approveCompanyQuestion(id, { note = "" } = {}, moderatorId) {
  if (!mongoose.isValidObjectId(id)) return fail(400, "Mã câu hỏi không hợp lệ.");
  const reason = cleanReason(note);
  const now = new Date();
  const doc = await QuestionBank.findOneAndUpdate(
    { _id: id, ...COMPANY_QUESTION_FILTER, status: PLATFORM_REVIEW_STATUS },
    {
      $set: {
        status: "approved",
        review: { by: moderatorId, at: now, note: reason },
        moderation: { reviewedBy: moderatorId, reviewedAt: now, reason, lastAction: "approve" },
      },
      $push: { history: { action: "approve", actorId: moderatorId, reason: reason || "Platform Moderator duyệt", at: now } },
    },
    { returnDocument: "after" },
  ).lean();
  if (!doc) return notReviewable(id);

  scheduleCompanyQuestionVideoWarm([doc]);
  return { ok: true, question: doc };
}

/** Platform Mod từ chối một câu (bắt buộc lý do để công ty biết sửa gì). */
export async function rejectCompanyQuestion(id, { reason } = {}, moderatorId) {
  if (!mongoose.isValidObjectId(id)) return fail(400, "Mã câu hỏi không hợp lệ.");
  const text = cleanReason(reason);
  if (!text) return fail(400, "Vui lòng nhập lý do từ chối để công ty biết và chỉnh sửa lại.");
  const now = new Date();
  const doc = await QuestionBank.findOneAndUpdate(
    { _id: id, ...COMPANY_QUESTION_FILTER, status: PLATFORM_REVIEW_STATUS },
    {
      $set: {
        status: "rejected",
        review: { by: moderatorId, at: now, note: text },
        moderation: { reviewedBy: moderatorId, reviewedAt: now, reason: text, lastAction: "reject" },
      },
      $push: { history: { action: "reject", actorId: moderatorId, reason: text, at: now } },
    },
    { returnDocument: "after" },
  ).lean();
  if (!doc) return notReviewable(id);
  return { ok: true, question: doc };
}

/** Duyệt / từ chối hàng loạt; chỉ đổi câu đang chờ Platform Mod, câu khác bỏ qua. */
export async function bulkReviewCompanyQuestions({ ids, action, reason } = {}, moderatorId) {
  if (!["approve", "reject"].includes(action)) return fail(400, "Thao tác không hợp lệ.");
  if (!Array.isArray(ids) || ids.length === 0) return fail(400, "Vui lòng chọn ít nhất một câu hỏi.");
  if (ids.length > COMPANY_QUESTION_BATCH_MAX) {
    return fail(400, `Mỗi lần tối đa ${COMPANY_QUESTION_BATCH_MAX} câu.`);
  }
  if (ids.some((id) => !mongoose.isValidObjectId(id))) return fail(400, "Mã câu hỏi không hợp lệ.");
  const text = cleanReason(reason);
  if (action === "reject" && !text) {
    return fail(400, "Vui lòng nhập lý do từ chối để công ty biết và chỉnh sửa lại.");
  }

  const now = new Date();
  const status = action === "approve" ? "approved" : "rejected";
  const filter = { _id: { $in: ids }, ...COMPANY_QUESTION_FILTER, status: PLATFORM_REVIEW_STATUS };
  // Lấy id trước khi cập nhật để chỉ warm đúng câu vừa được duyệt.
  const targets = await QuestionBank.find(filter).select("_id").lean();
  const targetIds = targets.map((d) => d._id);
  if (targetIds.length === 0) return { ok: true, updated: 0, skipped: ids.length };

  const res = await QuestionBank.updateMany(
    { _id: { $in: targetIds }, status: PLATFORM_REVIEW_STATUS },
    {
      $set: {
        status,
        review: { by: moderatorId, at: now, note: text },
        moderation: { reviewedBy: moderatorId, reviewedAt: now, reason: text, lastAction: action },
      },
      $push: {
        history: {
          action,
          actorId: moderatorId,
          reason: text || (action === "approve" ? "Platform Moderator duyệt hàng loạt" : ""),
          at: now,
        },
      },
    },
  );

  if (action === "approve") {
    // Không truyền companyId: lô có thể gồm câu nhiều công ty. Hàm warm tự lọc `approved`.
    scheduleCompanyQuestionVideoWarmByIds(targetIds, { $ne: null });
  }
  return { ok: true, updated: res.modifiedCount, skipped: ids.length - res.modifiedCount };
}

async function notReviewable(id) {
  const current = await QuestionBank.findOne({ _id: id, ...COMPANY_QUESTION_FILTER }).select("status").lean();
  if (!current) return fail(404, "Không tìm thấy câu hỏi doanh nghiệp.");
  return fail(409, "Câu hỏi không ở trạng thái chờ Platform Moderator duyệt.");
}
