import mongoose from "mongoose";
import { Review } from "../models/Review.js";
import { Mentor } from "../models/Mentor.js";
import { Booking } from "../models/Booking.js";
import { Course } from "../models/Course.js";

const MONGO_ERR = "MongoDB chưa kết nối. Kiểm tra MONGO_URI trong .env.";
function isMongoReady() {
  return mongoose.connection.readyState === 1;
}

function toPublicReview(r) {
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
    .lean();
  return { ok: true, reviews: rows.map(toPublicReview) };
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
    const m = await Mentor.findById(targetIdRaw).select("_id isActive").lean();
    if (!m || m.isActive === false) return { ok: false, status: 404, error: "Không tìm thấy mentor." };
  } else {
    const c = await Course.findById(targetIdRaw).select("_id").lean();
    if (!c) return { ok: false, status: 404, error: "Không tìm thấy khóa học." };
  }

  const dup = await Review.findOne({ userId: uid, targetType, targetId: targetIdRaw }).select("_id").lean();
  if (dup) {
    return { ok: false, status: 409, error: "Bạn đã gửi đánh giá cho mục tiêu này rồi." };
  }

  // If provided bookingId: verify belongs to user và khớp mentor
  let bookingId = null;
  const bId = String(body?.bookingId ?? "").trim();
  if (bId) {
    if (targetType !== "mentor") {
      return { ok: false, status: 400, error: "bookingId chỉ dùng khi đánh giá mentor (theo buổi đã hoàn thành)." };
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

  return { ok: true, review: toPublicReview(doc) };
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
  await review.deleteOne();
  if (bookingId && mongoose.isValidObjectId(bookingId)) {
    await Booking.updateOne({ _id: bookingId }, { $unset: { reviewId: 1 } });
  }
  return { ok: true };
}

