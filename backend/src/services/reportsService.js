import mongoose from "mongoose";
import { Report, AI_REPORT_TARGET_TYPES } from "../models/Report.js";
import { InterviewSession } from "../models/InterviewSession.js";
import { QuestionBank } from "../models/QuestionBank.js";
import { validateAiReport, formatJoiError } from "../dto/aiReport.dto.js";
import { createItemForReport } from "./moderationQueueService.js";
import { Mentor } from "../models/Mentor.js";
import { Booking } from "../models/Booking.js";
import { Review } from "../models/Review.js";
import { Course } from "../models/Course.js";
import { Notification } from "../models/Notification.js";

const MONGO_ERR = "MongoDB chưa kết nối. Kiểm tra MONGO_URI trong .env.";
function isMongoReady() {
  return mongoose.connection.readyState === 1;
}

export async function createReport(userId, body) {
  if (!isMongoReady()) return { ok: false, status: 503, error: MONGO_ERR };
  const uid = String(userId ?? "").trim();
  if (!mongoose.isValidObjectId(uid)) return { ok: false, status: 401, error: "Phiên đăng nhập không hợp lệ." };

  const targetType = String(body?.targetType ?? "mentor").trim();
  if (AI_REPORT_TARGET_TYPES.includes(targetType)) return createAiReport(uid, body);
  if (!["mentor", "booking", "review", "course"].includes(targetType)) {
    return { ok: false, status: 400, error: "targetType không hợp lệ." };
  }

  let targetIdRaw = String(body?.targetId ?? body?.mentorId ?? "").trim();
  if (!targetIdRaw) return { ok: false, status: 400, error: "Thiếu targetId." };

  // Resolve mentor publicId → _id
  if (targetType === "mentor" && !mongoose.isValidObjectId(targetIdRaw)) {
    const m = await Mentor.findOne({ publicId: targetIdRaw }).select("_id").lean();
    if (!m) return { ok: false, status: 404, error: "Không tìm thấy mentor." };
    targetIdRaw = String(m._id);
  }
  if (!mongoose.isValidObjectId(targetIdRaw)) return { ok: false, status: 400, error: "targetId không hợp lệ." };

  if (targetType === "mentor") {
    const m = await Mentor.findById(targetIdRaw).select("_id").lean();
    if (!m) return { ok: false, status: 404, error: "Không tìm thấy mentor." };
  } else if (targetType === "booking") {
    const b = await Booking.findById(targetIdRaw).select("userId mentorId").lean();
    if (!b) return { ok: false, status: 404, error: "Không tìm thấy booking." };
    const isCustomer = String(b.userId) === uid;
    let isTheirMentor = false;
    if (!isCustomer) {
      const mentorDoc = await Mentor.findOne({ userId: uid }).select("_id").lean();
      isTheirMentor = Boolean(mentorDoc && String(b.mentorId) === String(mentorDoc._id));
    }
    if (!isCustomer && !isTheirMentor) {
      return { ok: false, status: 403, error: "Chỉ báo cáo booking mà bạn tham gia (với tư cách khách hoặc mentor)." };
    }
  } else if (targetType === "review") {
    const rev = await Review.findById(targetIdRaw).select("userId").lean();
    if (!rev) return { ok: false, status: 404, error: "Không tìm thấy review." };
    if (String(rev.userId) === uid) {
      return { ok: false, status: 400, error: "Không báo cáo review do chính bạn viết." };
    }
  } else if (targetType === "course") {
    const c = await Course.findById(targetIdRaw).select("_id").lean();
    if (!c) return { ok: false, status: 404, error: "Không tìm thấy khóa học." };
  }

  const reason = String(body?.reason ?? body?.category ?? "").trim();
  const allow = new Set(["late", "unprofessional", "inappropriate", "no_show", "fraud", "other"]);
  if (!allow.has(reason)) {
    return { ok: false, status: 400, error: "reason không hợp lệ." };
  }

  const title = typeof body?.title === "string" ? body.title.trim().slice(0, 120) : "";
  const descRaw = typeof body?.description === "string" ? body.description.trim() : "";
  if (!descRaw || descRaw.length < 10) {
    return { ok: false, status: 400, error: "description quá ngắn." };
  }
  const description = title ? `Tiêu đề: ${title}\n\n${descRaw}` : descRaw;
  const evidenceUrls = Array.isArray(body?.evidenceUrls)
    ? body.evidenceUrls.map((u) => String(u).trim()).filter(Boolean).slice(0, 10)
    : [];

  const doc = await Report.create({
    reportedBy: uid,
    targetType,
    targetId: targetIdRaw,
    reason,
    description: description.slice(0, 8000),
    evidenceUrls,
  });

  return { ok: true, reportId: String(doc._id) };
}

/**
 * Báo sai câu hỏi / kết quả chấm AI từ trang Feedback (spec S1 §2.3).
 * Không hiện ở trang support admin — sinh ModerationItem cho moderator.
 */
async function createAiReport(uid, body) {
  const { error, value } = validateAiReport(body);
  if (error) return { ok: false, status: 400, error: formatJoiError(error) };
  const { targetType, targetId, questionIndex, reasonCode, note } = value;

  const session = await InterviewSession.findById(targetId).lean();
  if (!session) return { ok: false, status: 404, error: "Không tìm thấy phiên phỏng vấn." };
  if (String(session.userId) !== uid) {
    return { ok: false, status: 403, error: "Chỉ báo cáo phiên phỏng vấn của chính bạn." };
  }
  if (questionIndex >= (session.questions?.length ?? 0)) {
    return { ok: false, status: 400, error: "questionIndex không hợp lệ." };
  }
  if (targetType === "interview_evaluation") {
    const evaluated = (session.feedback?.perQuestion ?? []).some((q) => q.questionIndex === questionIndex);
    if (!evaluated) return { ok: false, status: 400, error: "Câu này chưa có kết quả chấm điểm." };
  }

  let report;
  try {
    report = await Report.create({
      reportedBy: uid,
      targetType,
      targetId,
      questionIndex,
      reasonCode,
      description: note,
    });
  } catch (err) {
    if (err?.code === 11000) {
      return { ok: false, status: 409, error: "Bạn đã báo cáo câu này rồi." };
    }
    throw err;
  }

  let item;
  try {
    item = await createItemForReport({ report, session });
  } catch (err) {
    // Không để report "mồ côi" (không có item → moderator không bao giờ thấy) — xoá để user gửi lại.
    await Report.deleteOne({ _id: report._id }).catch(() => {});
    throw err;
  }

  const questionBankId = session.questions[questionIndex]?.questionBankId;
  if (targetType === "interview_question" && questionBankId) {
    await QuestionBank.updateOne({ _id: questionBankId }, { $inc: { flagCount: 1 } });
  }

  return { ok: true, reportId: String(report._id), moderationItemId: String(item._id) };
}

async function notifyReporterOnReportClosed(report, status, resolution) {
  try {
    const reporterId = report.reportedBy?._id ?? report.reportedBy;
    if (!reporterId) return;
    const isResolved = status === "resolved";
    await Notification.create({
      userId: reporterId,
      type: "system",
      title: isResolved ? "Báo cáo đã được xử lý" : "Cập nhật báo cáo",
      body: isResolved
        ? resolution || "Đội ngũ ProInterview đã xem xét và xử lý báo cáo của bạn."
        : resolution || "Báo cáo của bạn đã được đóng sau khi xem xét.",
      metadata: { actionUrl: "/settings" },
    });
  } catch {
    /* không chặn luồng admin */
  }
}

export async function listReportsForAdmin(query = {}) {
  if (!isMongoReady()) return { ok: false, status: 503, error: MONGO_ERR };

  const page = Math.max(Number(query?.page) || 1, 1);
  const limit = Math.min(Math.max(Number(query?.limit) || 50, 1), 100);
  const skip = (page - 1) * limit;
  // Report AI (interview_*) thuộc hàng đợi moderator, không hiện ở trang support admin.
  const filter = { targetType: { $nin: AI_REPORT_TARGET_TYPES } };

  const status = String(query?.status ?? "").trim();
  const openOnly = ["true", "1", "yes"].includes(String(query?.open ?? "").trim().toLowerCase());
  const closedOnly = ["true", "1", "yes"].includes(String(query?.closed ?? "").trim().toLowerCase());
  if (openOnly) {
    filter.status = { $in: ["pending", "reviewing"] };
  } else if (closedOnly) {
    filter.status = { $in: ["resolved", "dismissed"] };
  } else if (status && ["pending", "reviewing", "resolved", "dismissed"].includes(status)) {
    filter.status = status;
  }
  const targetType = String(query?.targetType ?? "").trim();
  if (targetType && ["mentor", "booking", "review", "course"].includes(targetType)) {
    filter.targetType = targetType;
  }

  const [rows, total, openCount, pendingCount] = await Promise.all([
    Report.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate("reportedBy", "name email role")
      .lean(),
    Report.countDocuments(filter),
    Report.countDocuments({ ...filter, status: { $in: ["pending", "reviewing"] } }),
    Report.countDocuments({ ...filter, status: "pending" }),
  ]);

  const mentorIds = [
    ...new Set(rows.filter((r) => r.targetType === "mentor").map((r) => String(r.targetId))),
  ];
  const courseIds = [
    ...new Set(rows.filter((r) => r.targetType === "course").map((r) => String(r.targetId))),
  ];
  const bookingIds = [
    ...new Set(rows.filter((r) => r.targetType === "booking").map((r) => String(r.targetId))),
  ];

  const [mentors, courses, bookings] = await Promise.all([
    mentorIds.length
      ? Mentor.find({ _id: { $in: mentorIds } })
          .populate({ path: "userId", select: "name" })
          .select("userId title")
          .lean()
      : [],
    courseIds.length ? Course.find({ _id: { $in: courseIds } }).select("title").lean() : [],
    bookingIds.length
      ? Booking.find({ _id: { $in: bookingIds } }).select("scheduledAt status").lean()
      : [],
  ]);

  const mentorMap = new Map(
    mentors.map((m) => [String(m._id), m.userId?.name || m.title || "Cố vấn"]),
  );
  const courseMap = new Map(courses.map((c) => [String(c._id), c.title || "Khóa học"]));
  const bookingMap = new Map(
    bookings.map((b) => [
      String(b._id),
      b.scheduledAt
        ? `Buổi ${new Date(b.scheduledAt).toLocaleDateString("vi-VN")} (${b.status || "—"})`
        : `Booking ${String(b._id).slice(-6)}`,
    ]),
  );

  const reports = rows.map((r) => ({
    ...r,
    targetLabel:
      r.targetType === "mentor"
        ? mentorMap.get(String(r.targetId)) || "—"
        : r.targetType === "course"
          ? courseMap.get(String(r.targetId)) || "—"
          : r.targetType === "booking"
            ? bookingMap.get(String(r.targetId)) || "—"
            : `Review ${String(r.targetId).slice(-6)}`,
  }));

  const totalPages = total > 0 ? Math.ceil(total / limit) : 1;

  return {
    ok: true,
    reports,
    counts: { total, open: openCount, pending: pendingCount },
    pagination: { page, limit, total, totalPages, hasMore: skip + rows.length < total },
  };
}

export async function updateReportStatusForAdmin(adminUserId, reportId, body = {}) {
  if (!isMongoReady()) return { ok: false, status: 503, error: MONGO_ERR };
  if (!mongoose.isValidObjectId(reportId)) {
    return { ok: false, status: 400, error: "reportId không hợp lệ." };
  }

  const status = String(body?.status || "").trim();
  const allowed = new Set(["reviewing", "resolved", "dismissed"]);
  if (!allowed.has(status)) {
    return { ok: false, status: 400, error: "status phải là reviewing, resolved hoặc dismissed." };
  }

  const resolution = String(body?.resolution || "").trim().slice(0, 2000);
  const doc = await Report.findById(reportId);
  if (!doc || AI_REPORT_TARGET_TYPES.includes(doc.targetType)) {
    return { ok: false, status: 404, error: "Không tìm thấy báo cáo." };
  }

  doc.status = status;
  if (status === "resolved" || status === "dismissed") {
    doc.resolvedBy = adminUserId;
    doc.resolvedAt = new Date();
    doc.resolution =
      resolution ||
      (status === "dismissed" ? "Admin đã bác bỏ báo cáo." : "Admin đã xử lý báo cáo.");
  } else {
    doc.resolution = resolution || doc.resolution || "";
  }

  await doc.save();

  const report = await Report.findById(doc._id)
    .populate("reportedBy", "name email role")
    .lean();

  if (status === "resolved" || status === "dismissed") {
    await notifyReporterOnReportClosed(report, status, doc.resolution);
  }

  return { ok: true, report };
}

