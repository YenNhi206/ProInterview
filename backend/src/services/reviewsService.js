import mongoose from "mongoose";
import { Review } from "../models/Review.js";
import { Mentor } from "../models/Mentor.js";
import { MentorPeerReview } from "../models/MentorPeerReview.js";
import { Booking } from "../models/Booking.js";
import { Course } from "../models/Course.js";
import { Enrollment } from "../models/Enrollment.js";
import { deliverNotification } from "./notificationDeliveryService.js";
import { enrollmentAccessGranted } from "../helpers/enrollmentAccess.js";
import { resolveStoredUploadUrl } from "../utils/resolveStoredUploadUrl.js";

const MONGO_ERR = "MongoDB chưa kết nối. Kiểm tra MONGO_URI trong .env.";
function isMongoReady() {
  return mongoose.connection.readyState === 1;
}

/**
 * Chỉ tính từ review THẬT của học viên đã ghi danh. Đánh giá chéo giữa mentor (MentorPeerReview)
 * KHÔNG được trộn vào đây — đó là tín hiệu chuyên môn nội bộ, hiển thị riêng qua
 * GET /api/courses/:id/peer-reviews (có nhãn "Đánh giá chéo mentor"), không phải rating công
 * khai mà khách hàng dùng để quyết định mua khóa học. Trộn vào sẽ tạo kẽ hở: 2 mentor thông
 * đồng tự cho nhau điểm cao để thổi phồng rating công khai của chính khóa học mình.
 */
export async function recalcCourseReviewStats(courseId) {
  if (!mongoose.isValidObjectId(String(courseId))) return;
  const oid = new mongoose.Types.ObjectId(String(courseId));

  const studentAgg = await Review.aggregate([
    { $match: { targetType: "course", targetId: oid, isVisible: { $ne: false } } },
    { $group: { _id: null, avgRating: { $avg: "$rating" }, n: { $sum: 1 } } },
  ]);
  const studentRow = studentAgg[0];
  const studentN = studentRow?.n ?? 0;
  const avg = studentRow?.avgRating != null ? Math.round(studentRow.avgRating * 10) / 10 : 0;

  await Course.updateOne(
    { _id: courseId },
    { $set: { "stats.rating": avg, "stats.reviewCount": studentN } },
  );
}

async function notifyNewReview(review, targetType, targetIdRaw) {
  try {
    if (targetType === "mentor") {
      const mentor = await Mentor.findById(targetIdRaw).select("userId").lean();
      if (!mentor?.userId) return;
      await deliverNotification(mentor.userId, {
        mentorPrefKey: "mentee_review",
        type: "new_review",
        title: "Có đánh giá mới",
        body: `Học viên đã để lại đánh giá ${review.rating} sao cho buổi mentor.`,
        metadata: { mentorId: mentor._id, actionUrl: "/mentor/reviews" },
      });
      return;
    }
    const course = await Course.findById(targetIdRaw)
      .select("title mentorId")
      .populate({ path: "mentorId", select: "userId" })
      .lean();
    const mentorUserId = course?.mentorId?.userId;
    if (!mentorUserId) return;
    await deliverNotification(mentorUserId, {
      mentorPrefKey: "mentee_review",
      type: "new_review",
      title: "Đánh giá khóa học mới",
      body: `Khóa "${course.title || "của bạn"}" nhận đánh giá ${review.rating} sao.`,
      metadata: {
        courseId: course._id,
        actionUrl: course._id ? `/mentor/courses/${course._id}/edit` : "/mentor/courses",
      },
    });
  } catch {
    /* không chặn luồng tạo review nếu notification lỗi */
  }
}

export async function recalcMentorReviewStats(mentorId) {
  if (!mongoose.isValidObjectId(String(mentorId))) return;
  const oid = new mongoose.Types.ObjectId(String(mentorId));
  const agg = await Review.aggregate([
    { $match: { targetType: "mentor", targetId: oid, isVisible: { $ne: false } } },
    { $group: { _id: null, avgRating: { $avg: "$rating" }, n: { $sum: 1 } } },
  ]);
  const row = agg[0];
  const avg = row?.avgRating != null ? Math.round(row.avgRating * 10) / 10 : 0;
  const n = row?.n ?? 0;
  await Mentor.updateOne({ _id: mentorId }, { $set: { "stats.rating": avg, "stats.reviewCount": n } });
}

function toPublicReview(r) {
  const u = r.userId && typeof r.userId === "object" ? r.userId : null;
  return {
    id: String(r._id),
    targetType: r.targetType,
    targetId: String(r.targetId),
    bookingId: r.bookingId ? String(r.bookingId) : "",
    rating: r.rating,
    comment: r.comment ?? "",
    tags: r.tags ?? [],
    reply: r.reply?.content ? { content: r.reply.content, repliedAt: r.reply.repliedAt } : null,
    createdAt: r.createdAt,
    isVerified: Boolean(r.isVerified),
    userName: u?.name || "",
    userAvatar: u?.avatar || "",
    userTitle: u?.desiredPosition || "",
  };
}

export async function listReviews(query) {
  if (!isMongoReady()) return { ok: false, status: 503, error: MONGO_ERR };
  const targetType = String(query?.targetType ?? "").trim() || "mentor";
  if (!["mentor", "course"].includes(targetType)) {
    return { ok: false, status: 400, error: "targetType không hợp lệ." };
  }
  const targetIdRaw = String(query?.targetId ?? "").trim();
  if (!targetIdRaw) return { ok: false, status: 400, error: "Thiếu targetId." };

  let targetId = targetIdRaw;
  if (targetType === "mentor" && !mongoose.isValidObjectId(targetIdRaw)) {
    const or = [{ publicId: targetIdRaw }];
    const m = await Mentor.findOne({ $or: or }).select("_id").lean();
    if (!m) return { ok: false, status: 404, error: "Not found" };
    targetId = String(m._id);
  }
  if (!mongoose.isValidObjectId(targetId)) return { ok: false, status: 400, error: "targetId không hợp lệ." };

  const rows = await Review.find({ targetType, targetId, isVisible: { $ne: false } })
    .sort({ createdAt: -1 })
    .populate({ path: "userId", select: "name avatar desiredPosition currentCompany" })
    .lean();
  return { ok: true, reviews: rows.map(toPublicReview) };
}

/** Đánh giá chéo mentor — hiển thị công khai trên trang khóa học. */
export async function listCoursePeerReviewsPublic(courseId) {
  if (!isMongoReady()) return { ok: false, status: 503, error: MONGO_ERR };
  const idRaw = String(courseId ?? "").trim();
  if (!mongoose.isValidObjectId(idRaw)) {
    return { ok: false, status: 400, error: "courseId không hợp lệ." };
  }

  const course = await Course.findById(idRaw).select("_id status").lean();
  if (!course?._id) return { ok: false, status: 404, error: "Không tìm thấy khóa học." };
  if (course.status !== "published") {
    return { ok: true, reviews: [] };
  }

  const rows = await MentorPeerReview.find({
    courseId: course._id,
    isVisibleToOwner: { $ne: false },
  })
    .sort({ createdAt: -1 })
    .populate({
      path: "reviewerId",
      select: "name userId",
      populate: { path: "userId", select: "name avatar desiredPosition" },
    })
    .lean();

  const reviews = rows.map((r) => {
    const mentor = r.reviewerId && typeof r.reviewerId === "object" ? r.reviewerId : null;
    const user = mentor?.userId && typeof mentor.userId === "object" ? mentor.userId : null;
    const rating =
      Math.round(
        ((Number(r.contentRating || 0) +
          Number(r.qualityRating || 0) +
          Number(r.priceValueRating || 0)) /
          3) *
          10,
      ) / 10;
    return {
      id: String(r._id),
      targetType: "course_peer",
      rating,
      comment: String(r.feedback || "").trim(),
      tags: [],
      reply: null,
      createdAt: r.createdAt,
      isVerified: true,
      isPeerReview: true,
      userName: user?.name || mentor?.name || "Mentor",
      userAvatar: resolveStoredUploadUrl(user?.avatar || ""),
      userTitle: user?.desiredPosition || "Mentor ProInterview",
    };
  });

  return { ok: true, reviews };
}

/** Đánh giá của user hiện tại cho một mentor/khóa (nếu có). */
export async function getMyReviewForTarget(userId, query = {}) {
  if (!isMongoReady()) return { ok: false, status: 503, error: MONGO_ERR };
  const uid = String(userId ?? "").trim();
  if (!mongoose.isValidObjectId(uid)) return { ok: false, status: 401, error: "Phiên đăng nhập không hợp lệ." };

  const targetType = String(query?.targetType ?? "").trim() || "mentor";
  if (!["mentor", "course"].includes(targetType)) {
    return { ok: false, status: 400, error: "targetType không hợp lệ." };
  }
  let targetIdRaw = String(query?.targetId ?? "").trim();
  if (!targetIdRaw) return { ok: false, status: 400, error: "Thiếu targetId." };

  if (targetType === "mentor" && !mongoose.isValidObjectId(targetIdRaw)) {
    const m = await Mentor.findOne({ publicId: targetIdRaw }).select("_id").lean();
    if (!m) return { ok: false, status: 404, error: "Not found" };
    targetIdRaw = String(m._id);
  }
  if (!mongoose.isValidObjectId(targetIdRaw)) {
    return { ok: false, status: 400, error: "targetId không hợp lệ." };
  }

  const row = await Review.findOne({ userId: uid, targetType, targetId: targetIdRaw })
    .populate({ path: "userId", select: "name avatar desiredPosition currentCompany" })
    .lean();

  return {
    ok: true,
    hasReview: Boolean(row),
    review: row ? toPublicReview(row) : null,
  };
}

/** Admin — toàn bộ review (không bắt buộc targetId). */
export async function listReviewsForAdmin(query = {}) {
  if (!isMongoReady()) return { ok: false, status: 503, error: MONGO_ERR };

  const page = Math.max(Number(query?.page) || 1, 1);
  const limit = Math.min(Math.max(Number(query?.limit) || 50, 1), 100);
  const skip = (page - 1) * limit;
  const targetType = String(query?.targetType ?? "").trim();
  const visibleFilter = String(query?.visible ?? "").trim().toLowerCase();
  const filter = {};
  if (targetType && ["mentor", "course"].includes(targetType)) {
    filter.targetType = targetType;
  }
  if (visibleFilter === "true" || visibleFilter === "visible") {
    filter.isVisible = { $ne: false };
  } else if (visibleFilter === "false" || visibleFilter === "hidden") {
    filter.isVisible = false;
  }

  const [rows, total, mentorTotal, courseTotal] = await Promise.all([
    Review.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate({ path: "userId", select: "name email" })
      .lean(),
    Review.countDocuments(filter),
    Review.countDocuments({ ...filter, targetType: "mentor" }),
    Review.countDocuments({ ...filter, targetType: "course" }),
  ]);

  const mentorIds = [
    ...new Set(rows.filter((r) => r.targetType === "mentor").map((r) => String(r.targetId))),
  ];
  const courseIds = [
    ...new Set(rows.filter((r) => r.targetType === "course").map((r) => String(r.targetId))),
  ];

  const [mentors, courses] = await Promise.all([
    mentorIds.length
      ? Mentor.find({ _id: { $in: mentorIds } })
          .populate({ path: "userId", select: "name" })
          .select("userId title")
          .lean()
      : [],
    courseIds.length ? Course.find({ _id: { $in: courseIds } }).select("title").lean() : [],
  ]);

  const mentorMap = new Map(
    mentors.map((m) => [String(m._id), m.userId?.name || m.title || "Cố vấn"]),
  );
  const courseMap = new Map(courses.map((c) => [String(c._id), c.title || "Khóa học"]));

  const reviews = rows.map((r) => ({
    _id: r._id,
    targetType: r.targetType,
    targetId: String(r.targetId),
    rating: r.rating,
    comment: r.comment ?? "",
    tags: r.tags ?? [],
    createdAt: r.createdAt,
    isVisible: r.isVisible !== false,
    isVerified: Boolean(r.isVerified),
    hasReply: Boolean(r.reply?.content),
    userName: r.userId?.name || "",
    userEmail: r.userId?.email || "",
    targetLabel:
      r.targetType === "mentor"
        ? mentorMap.get(String(r.targetId)) || "—"
        : courseMap.get(String(r.targetId)) || "—",
  }));

  const totalPages = total > 0 ? Math.ceil(total / limit) : 1;

  return {
    ok: true,
    reviews,
    counts: { total, mentor: mentorTotal, course: courseTotal },
    pagination: {
      page,
      limit,
      total,
      totalPages,
      hasMore: skip + rows.length < total,
    },
  };
}

export async function createReview(userId, body) {
  if (!isMongoReady()) return { ok: false, status: 503, error: MONGO_ERR };
  const uid = String(userId ?? "").trim();
  if (!mongoose.isValidObjectId(uid)) return { ok: false, status: 401, error: "Phiên đăng nhập không hợp lệ." };

  const targetType = String(body?.targetType ?? "mentor").trim();
  if (!["mentor", "course"].includes(targetType)) {
    return { ok: false, status: 400, error: "targetType không hợp lệ." };
  }

  const rating = Number(body?.rating);
  if (!Number.isFinite(rating) || rating < 1 || rating > 5) {
    return { ok: false, status: 400, error: "rating phải từ 1 đến 5." };
  }

  const comment = typeof body?.comment === "string" ? body.comment.trim().slice(0, 4000) : "";
  const tags = Array.isArray(body?.tags) ? body.tags.map((t) => String(t).trim()).filter(Boolean).slice(0, 30) : [];

  let targetIdRaw = String(body?.targetId ?? "").trim();
  if (!targetIdRaw) return { ok: false, status: 400, error: "Thiếu targetId." };

  // Resolve mentor publicId → _id
  if (targetType === "mentor" && !mongoose.isValidObjectId(targetIdRaw)) {
    const m = await Mentor.findOne({ publicId: targetIdRaw }).select("_id").lean();
    if (!m) return { ok: false, status: 404, error: "Không tìm thấy mentor." };
    targetIdRaw = String(m._id);
  }
  if (!mongoose.isValidObjectId(targetIdRaw)) return { ok: false, status: 400, error: "targetId không hợp lệ." };

  if (targetType === "mentor") {
    const m = await Mentor.findById(targetIdRaw).select("_id isActive userId").lean();
    if (!m || m.isActive === false) return { ok: false, status: 404, error: "Không tìm thấy mentor." };
    if (m.userId && String(m.userId) === uid) {
      return { ok: false, status: 400, error: "Không thể tự đánh giá chính mình." };
    }
  } else {
    const c = await Course.findById(targetIdRaw).select("_id status mentorId").lean();
    if (!c) return { ok: false, status: 404, error: "Không tìm thấy khóa học." };
    if (c.status !== "published") {
      return { ok: false, status: 400, error: "Chỉ đánh giá khóa học đã xuất bản." };
    }
    if (c.mentorId) {
      const owner = await Mentor.findById(c.mentorId).select("userId").lean();
      if (owner?.userId && String(owner.userId) === uid) {
        return { ok: false, status: 400, error: "Không thể tự đánh giá khóa học của chính mình." };
      }
    }
    const enrollment = await Enrollment.findOne({ userId: uid, courseId: targetIdRaw }).lean();
    if (!enrollment || !enrollmentAccessGranted(enrollment)) {
      return {
        ok: false,
        status: 403,
        error: "Bạn cần ghi danh và thanh toán khóa học trước khi đánh giá.",
      };
    }
  }

  const dup = await Review.findOne({ userId: uid, targetType, targetId: targetIdRaw }).select("_id").lean();
  if (dup) {
    return { ok: false, status: 409, error: "Bạn đã gửi đánh giá cho mục tiêu này rồi." };
  }

  let bookingId = null;
  const bId = String(body?.bookingId ?? "").trim();
  if (targetType === "mentor") {
    if (!bId) {
      return {
        ok: false,
        status: 400,
        error: "Cần bookingId — chỉ đánh giá sau buổi mentor đã hoàn thành.",
      };
    }
    if (!mongoose.isValidObjectId(bId)) return { ok: false, status: 400, error: "bookingId không hợp lệ." };
    const b = await Booking.findOne({ _id: bId, userId: uid }).select("_id status reviewId mentorId").lean();
    if (!b) return { ok: false, status: 404, error: "Không tìm thấy booking." };
    if (String(b.mentorId) !== String(targetIdRaw)) {
      return { ok: false, status: 400, error: "Mentor đánh giá không khớp với booking." };
    }
    if (b.reviewId) return { ok: false, status: 409, error: "Booking này đã có review." };
    if (b.status !== "completed") return { ok: false, status: 400, error: "Chỉ review khi booking đã hoàn thành." };
    bookingId = b._id;
  } else if (bId) {
    return { ok: false, status: 400, error: "bookingId chỉ dùng khi đánh giá mentor." };
  }

  let doc;
  try {
    doc = await Review.create({
      userId: uid,
      targetType,
      targetId: targetIdRaw,
      bookingId: bookingId ?? undefined,
      rating: Math.round(rating),
      comment,
      tags,
      isVerified: Boolean(bookingId),
    });
  } catch (e) {
    if (e && e.code === 11000) {
      return { ok: false, status: 409, error: "Bạn đã gửi đánh giá cho mục tiêu này rồi." };
    }
    throw e;
  }

  if (bookingId) {
    await Booking.updateOne({ _id: bookingId }, { $set: { reviewId: doc._id } });
  }

  if (targetType === "course") {
    await recalcCourseReviewStats(targetIdRaw);
  } else {
    await recalcMentorReviewStats(targetIdRaw);
  }

  await notifyNewReview(doc, targetType, targetIdRaw);

  const populated = await Review.findById(doc._id)
    .populate({ path: "userId", select: "name avatar desiredPosition currentCompany" })
    .lean();

  return { ok: true, review: toPublicReview(populated || doc) };
}

export async function replyToReview(mentorUserId, reviewId, body) {
  if (!isMongoReady()) return { ok: false, status: 503, error: MONGO_ERR };
  const uid = String(mentorUserId ?? "").trim();
  if (!mongoose.isValidObjectId(uid)) return { ok: false, status: 401, error: "Phiên đăng nhập không hợp lệ." };
  if (!mongoose.isValidObjectId(reviewId)) return { ok: false, status: 400, error: "id review không hợp lệ." };

  const mentor = await Mentor.findOne({ userId: uid }).select("_id").lean();
  if (!mentor?._id) return { ok: false, status: 404, error: "Không tìm thấy hồ sơ mentor." };

  const content = typeof body?.content === "string" ? body.content.trim().slice(0, 2000) : "";
  if (!content) return { ok: false, status: 400, error: "Thiếu content." };

  const review = await Review.findById(reviewId);
  if (!review || String(review.targetType) !== "mentor" || String(review.targetId) !== String(mentor._id)) {
    return { ok: false, status: 404, error: "Không tìm thấy review." };
  }
  review.reply = { content, repliedAt: new Date() };
  await review.save();
  return { ok: true, review: toPublicReview(review) };
}

export async function deleteReview(userId, reviewId) {
  if (!isMongoReady()) return { ok: false, status: 503, error: MONGO_ERR };
  const uid = String(userId ?? "").trim();
  if (!mongoose.isValidObjectId(uid)) return { ok: false, status: 401, error: "Phiên đăng nhập không hợp lệ." };
  if (!mongoose.isValidObjectId(reviewId)) return { ok: false, status: 400, error: "id review không hợp lệ." };

  const review = await Review.findById(reviewId);
  if (!review) return { ok: false, status: 404, error: "Không tìm thấy review." };
  if (String(review.userId) !== uid) {
    return { ok: false, status: 403, error: "Chỉ chủ review mới được xóa." };
  }
  const bookingId = review.bookingId ? String(review.bookingId) : "";
  const targetType = review.targetType;
  const targetId = String(review.targetId);
  await review.deleteOne();
  if (bookingId && mongoose.isValidObjectId(bookingId)) {
    await Booking.updateOne({ _id: bookingId }, { $unset: { reviewId: 1 } });
  }
  if (targetType === "course") {
    await recalcCourseReviewStats(targetId);
  } else if (targetType === "mentor") {
    await recalcMentorReviewStats(targetId);
  }
  return { ok: true };
}

/** Admin ẩn / hiện review trên marketplace. */
export async function setReviewVisibilityForAdmin(reviewId, isVisible) {
  if (!isMongoReady()) return { ok: false, status: 503, error: MONGO_ERR };
  if (!mongoose.isValidObjectId(reviewId)) {
    return { ok: false, status: 400, error: "id review không hợp lệ." };
  }
  const visible = Boolean(isVisible);
  const review = await Review.findById(reviewId);
  if (!review) return { ok: false, status: 404, error: "Không tìm thấy review." };

  review.isVisible = visible;
  await review.save();

  if (review.targetType === "course") {
    await recalcCourseReviewStats(review.targetId);
  } else if (review.targetType === "mentor") {
    await recalcMentorReviewStats(review.targetId);
  }

  return {
    ok: true,
    review: {
      _id: review._id,
      isVisible: review.isVisible !== false,
      targetType: review.targetType,
      targetId: String(review.targetId),
    },
  };
}

