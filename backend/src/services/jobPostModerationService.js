/**
 * JB-04 (PM-05, C-10, PM-03): báo cáo tin tuyển dụng và Platform Moderator ẩn / bỏ ẩn tin.
 *
 * - Người dùng đã đăng nhập báo cáo tin đang đăng (`POST /api/reports { targetType: "job_post" }`) → `Report`
 *   + `ModerationItem` loại `job_post_report` (màn riêng JB-17, không vào hàng đợi phỏng vấn `/moderator/queue`).
 * - Platform Moderator ẩn / bỏ ẩn (`PATCH /api/moderator/jobs/:id/visibility`) hoặc xử lý item bằng `hide_job`.
 *   Ẩn tin thì đóng mọi báo cáo đang mở của tin đó và báo cho người báo cáo + Company Moderator của công ty.
 * - Tin `hidden` không hiện ở API công khai (JB-03 chỉ trả `published`), Company Mod không sửa được, vẫn đóng được.
 */
import mongoose from "mongoose";
import { JobPost } from "../models/JobPost.js";
import { Company } from "../models/Company.js";
import { User } from "../models/User.js";
import { Report, JOB_POST_REPORT_REASONS, JOB_POST_REPORT_TARGET_TYPE } from "../models/Report.js";
import { ModerationItem, JOB_POST_REPORT_ITEM_TYPE } from "../models/ModerationItem.js";
import { deliverNotification } from "./notificationDeliveryService.js";
import { httpError } from "../utils/apiErrors.js";
import { logger } from "../config/logger.js";
import { findPublicJob } from "./publicJobsService.js";

const OPEN_ITEM_STATUSES = ["open", "in_review"];
const MAX_REASON_LEN = 1000;

function assertObjectId(id, label = "id") {
  if (!mongoose.isValidObjectId(id)) throw httpError(400, `${label} không hợp lệ.`);
}

/**
 * Tạo báo cáo tin tuyển dụng. Chỉ báo cáo tin đang đăng; Company Mod không tự báo cáo tin của công ty mình;
 * mỗi người chỉ có 1 báo cáo đang chờ xử lý cho mỗi tin.
 * @returns {Promise<{ reportId: string, moderationItemId: string }>}
 */
export async function createJobPostReport(userId, body = {}) {
  const jobId = String(body.targetId ?? "").trim();
  assertObjectId(jobId, "targetId");
  const reason = String(body.reason ?? "").trim();
  if (!JOB_POST_REPORT_REASONS.includes(reason)) {
    throw httpError(400, `reason phải là một trong: ${JOB_POST_REPORT_REASONS.join(", ")}.`);
  }
  const description = typeof body.description === "string" ? body.description.trim() : "";
  if (description.length < 10) throw httpError(400, "Vui lòng mô tả vấn đề (ít nhất 10 ký tự).");

  // Chỉ báo cáo tin người dùng đang thấy: cùng quy tắc API công khai (published, chưa quá `closesAt`,
  // công ty không bị khóa) — không phụ thuộc độ trễ của job tự đóng (JB-02).
  const found = await findPublicJob(jobId);
  if (!found) throw httpError(404, "Không tìm thấy tin tuyển dụng đang đăng.");
  const { job, company } = found;
  const reporter = await User.findById(userId).select("role companyId").lean();
  if (reporter?.role === "company_moderator" && String(reporter.companyId || "") === String(job.companyId)) {
    throw httpError(400, "Không báo cáo tin tuyển dụng của chính công ty bạn.");
  }
  const pending = await Report.exists({
    reportedBy: userId,
    targetType: JOB_POST_REPORT_TARGET_TYPE,
    targetId: job._id,
    status: { $in: ["pending", "reviewing"] },
  });
  if (pending) throw httpError(409, "Bạn đã báo cáo tin này và báo cáo đang chờ xử lý.");

  let report;
  try {
    report = await Report.create({
      reportedBy: userId,
      targetType: JOB_POST_REPORT_TARGET_TYPE,
      targetId: job._id,
      reason,
      description: description.slice(0, 8000),
      evidenceUrls: Array.isArray(body.evidenceUrls) ? body.evidenceUrls.map((u) => String(u).trim()).filter(Boolean).slice(0, 10) : [],
    });
  } catch (error) {
    // Hai request cùng lúc của cùng người (bấm đúp): unique index báo cáo job đang chờ chặn bản thứ hai.
    if (error?.code === 11000) throw httpError(409, "Bạn đã báo cáo tin này và báo cáo đang chờ xử lý.");
    throw error;
  }

  let item;
  try {
    item = await ModerationItem.create({
      type: JOB_POST_REPORT_ITEM_TYPE,
      priority: reason === "fraud" || reason === "discriminatory" ? "high" : "normal",
      refs: { reportId: report._id, userId, jobPostId: job._id, companyId: job.companyId },
      snapshot: { jobTitle: job.title, companyName: company?.name || "" },
    });
  } catch (error) {
    // Không để report "mồ côi" (không có item → moderator không bao giờ thấy).
    await Report.deleteOne({ _id: report._id }).catch(() => {});
    throw error;
  }
  return { reportId: String(report._id), moderationItemId: String(item._id) };
}

async function notifyCompanyModerators(job, payload) {
  const mods = await User.find({ role: "company_moderator", companyId: job.companyId }).select("_id").lean();
  for (const m of mods) {
    await deliverNotification(m._id, payload).catch((err) =>
      logger.warn("job_visibility_notify_failed", { jobPostId: String(job._id), error: err?.message }),
    );
  }
}

/**
 * Đóng mọi báo cáo đang mở của tin sau khi tin bị ẩn: item → `resolved` (`hide_job`), report → `resolved`,
 * báo cho người báo cáo. `exceptItemId`: item đang được xử lý ở `resolveItem` (tự đóng ở đó).
 * @returns {Promise<number>} số item đã đóng
 */
export async function resolveOpenJobReports(jobPostId, { moderatorId, note, exceptItemId = null }) {
  const items = await ModerationItem.find({
    type: JOB_POST_REPORT_ITEM_TYPE,
    "refs.jobPostId": jobPostId,
    status: { $in: OPEN_ITEM_STATUSES },
    ...(exceptItemId ? { _id: { $ne: exceptItemId } } : {}),
  })
    .select("_id refs")
    .lean();
  const now = new Date();
  let closed = 0;
  for (const it of items) {
    const res = await ModerationItem.updateOne(
      { _id: it._id, status: { $in: OPEN_ITEM_STATUSES } },
      {
        $set: {
          status: "resolved",
          assignee: moderatorId,
          resolution: { action: "hide_job", note: note || "Tin tuyển dụng đã bị ẩn.", by: moderatorId, at: now },
        },
      },
    );
    if (!res.modifiedCount) continue;
    closed += 1;
    if (it.refs?.reportId) await closeJobReport(it.refs.reportId, { status: "resolved", moderatorId, note, jobPostId });
  }
  return closed;
}

/** Cập nhật Report gốc và báo cho người báo cáo. */
export async function closeJobReport(reportId, { status, moderatorId, note, jobPostId }) {
  const report = await Report.findByIdAndUpdate(
    reportId,
    {
      $set: {
        status,
        resolvedBy: moderatorId,
        resolvedAt: new Date(),
        resolution: note || (status === "resolved" ? "Tin tuyển dụng đã bị ẩn." : "Giữ nguyên tin tuyển dụng."),
      },
    },
    { returnDocument: "after" },
  ).lean();
  if (!report?.reportedBy) return;
  await deliverNotification(report.reportedBy, {
    type: "feedback",
    title: "Báo cáo tin tuyển dụng đã được xử lý",
    body:
      status === "resolved"
        ? "Platform Moderator đã ẩn tin tuyển dụng bạn báo cáo. Cảm ơn bạn!"
        : "Platform Moderator đã xem xét báo cáo của bạn và giữ nguyên tin tuyển dụng.",
    metadata: { jobPostId, actionUrl: "/jobs" },
  }).catch((err) => logger.warn("job_report_notify_failed", { reportId: String(reportId), error: err?.message }));
}

/**
 * Platform Moderator ẩn (`published → hidden`) hoặc bỏ ẩn (`hidden → published`) một tin.
 * Cập nhật có điều kiện theo `status` nên hai thao tác cùng lúc chỉ một cái thắng; tin đã đóng / bản nháp → 409.
 * Bỏ ẩn tin đã quá `closesAt` → 409 (job định kỳ sẽ đóng tin).
 * @returns {Promise<{ job: object, closedReports: number }>}
 */
export async function setJobVisibility(jobId, { hidden, reason = "" }, moderatorId, { exceptItemId = null } = {}) {
  assertObjectId(jobId);
  const note = String(reason || "").trim().slice(0, MAX_REASON_LEN);
  if (hidden && note.length < 5) throw httpError(400, "Vui lòng nhập lý do ẩn tin (ít nhất 5 ký tự).");
  const now = new Date();

  const updated = hidden
    ? await JobPost.findOneAndUpdate(
        { _id: jobId, status: "published" },
        { $set: { status: "hidden", hiddenAt: now, hiddenBy: moderatorId, hiddenReason: note } },
        { returnDocument: "after" },
      ).lean()
    : await JobPost.findOneAndUpdate(
        { _id: jobId, status: "hidden", $or: [{ closesAt: null }, { closesAt: { $gt: now } }] },
        { $set: { status: "published", hiddenAt: null, hiddenBy: null, hiddenReason: "" } },
        { returnDocument: "after" },
      ).lean();

  if (!updated) {
    const current = await JobPost.findById(jobId).select("status closesAt").lean();
    if (!current) throw httpError(404, "Không tìm thấy tin tuyển dụng.");
    if (hidden && current.status === "hidden") throw httpError(409, "Tin này đã bị ẩn.");
    if (!hidden && current.status === "published") throw httpError(409, "Tin này đang hiển thị.");
    if (!hidden && current.status === "hidden") throw httpError(409, "Tin đã quá hạn nhận hồ sơ, không bỏ ẩn được.");
    throw httpError(409, "Chỉ ẩn / bỏ ẩn được tin đang đăng hoặc đang bị ẩn.");
  }

  let closedReports = 0;
  if (hidden) {
    closedReports = await resolveOpenJobReports(updated._id, { moderatorId, note, exceptItemId });
    await notifyCompanyModerators(updated, {
      type: "job_post_hidden",
      title: "Tin tuyển dụng bị ẩn",
      body: `Tin "${updated.title}" đã bị Platform Moderator ẩn. Lý do: ${note}`,
      metadata: { jobPostId: updated._id, companyId: updated.companyId, actionUrl: "/company/jobs" },
    });
  } else {
    await notifyCompanyModerators(updated, {
      type: "system",
      title: "Tin tuyển dụng hiển thị lại",
      body: `Tin "${updated.title}" đã được Platform Moderator bỏ ẩn và hiển thị lại.`,
      metadata: { jobPostId: updated._id, companyId: updated.companyId, actionUrl: "/company/jobs" },
    });
  }
  return { job: moderatorJobDTO(updated, { openReports: 0 }), closedReports };
}

function moderatorJobDTO(job, { openReports = 0, companyName = "" } = {}) {
  return {
    id: String(job._id),
    title: job.title,
    companyId: String(job.companyId),
    companyName,
    roleCategory: job.roleCategory,
    level: job.level,
    status: job.status,
    publishedAt: job.publishedAt ?? null,
    closesAt: job.closesAt ?? null,
    hiddenAt: job.hiddenAt ?? null,
    hiddenReason: job.hiddenReason || "",
    openReports,
  };
}

/**
 * Danh sách tin cho Platform Moderator (JB-17): `status` = `published` | `hidden` (mặc định cả hai),
 * `reported=true` chỉ tin có báo cáo đang mở; kèm số báo cáo đang mở. Tin nhiều báo cáo nhất lên trước.
 */
export async function listJobsForModerator({ status, reported, q, page = 1, limit = 20 } = {}) {
  const statuses = status ? [status] : ["published", "hidden"];
  if (!statuses.every((s) => ["published", "hidden"].includes(s))) throw httpError(400, "status phải là published hoặc hidden.");
  const pageNum = Math.max(1, Number(page) || 1);
  const limitNum = Math.min(100, Math.max(1, Number(limit) || 20));

  const counts = await ModerationItem.aggregate([
    { $match: { type: JOB_POST_REPORT_ITEM_TYPE, status: { $in: OPEN_ITEM_STATUSES } } },
    { $group: { _id: "$refs.jobPostId", n: { $sum: 1 } } },
  ]);
  const countById = new Map(counts.map((r) => [String(r._id), r.n]));

  const filter = { status: { $in: statuses } };
  if (String(reported) === "true") filter._id = { $in: counts.map((r) => r._id) };
  const text = String(q || "").trim();
  if (text) filter.title = { $regex: text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), $options: "i" };

  const rows = await JobPost.find(filter).select("title companyId roleCategory level status publishedAt closesAt hiddenAt hiddenReason updatedAt").lean();
  rows.sort((a, b) => (countById.get(String(b._id)) || 0) - (countById.get(String(a._id)) || 0) || new Date(b.updatedAt) - new Date(a.updatedAt));
  const pageRows = rows.slice((pageNum - 1) * limitNum, pageNum * limitNum);
  const companies = await Company.find({ _id: { $in: pageRows.map((r) => r.companyId) } }).select("name").lean();
  const companyName = new Map(companies.map((c) => [String(c._id), c.name]));
  return {
    jobs: pageRows.map((j) => moderatorJobDTO(j, { openReports: countById.get(String(j._id)) || 0, companyName: companyName.get(String(j.companyId)) || "" })),
    pagination: { page: pageNum, limit: limitNum, total: rows.length, totalPages: Math.max(1, Math.ceil(rows.length / limitNum)) },
  };
}
