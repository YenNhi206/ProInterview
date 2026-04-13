import mongoose from "mongoose";
import { Mentor } from "../models/Mentor.js";
import { Booking } from "../models/Booking.js";
import { Review } from "../models/Review.js";

const MONGO_ERR = "MongoDB chưa kết nối. Kiểm tra MONGO_URI trong .env.";
function isMongoReady() {
  return mongoose.connection.readyState === 1;
}

async function getMentorByUserId(userId) {
  const uid = String(userId ?? "").trim();
  if (!mongoose.isValidObjectId(uid)) return null;
  return Mentor.findOne({ userId: uid }).lean();
}

export async function getMentorDashboard(userId) {
  if (!isMongoReady()) return { ok: false, status: 503, error: MONGO_ERR };
  const mentor = await getMentorByUserId(userId);
  if (!mentor?._id) return { ok: false, status: 404, error: "Không tìm thấy hồ sơ mentor." };

  const total = await Booking.countDocuments({ mentorId: mentor._id });
  const completed = await Booking.countDocuments({ mentorId: mentor._id, status: "completed" });
  const upcoming = await Booking.find({
    mentorId: mentor._id,
    status: { $in: ["pending", "confirmed", "in_progress"] },
  })
    .sort({ date: 1, timeSlot: 1 })
    .limit(10)
    .lean();

  const reviews = await Review.find({ targetType: "mentor", targetId: mentor._id, isVisible: { $ne: false } })
    .select("rating")
    .lean();
  const reviewCount = reviews.length;
  const avgRating = reviewCount ? reviews.reduce((s, r) => s + (r.rating || 0), 0) / reviewCount : 0;

  return {
    ok: true,
    dashboard: {
      totalSessions: total,
      completedSessions: completed,
      reviewCount,
      avgRating: Math.round(avgRating * 10) / 10,
      upcomingBookings: upcoming,
    },
  };
}

export async function getMentorFinance(userId) {
  if (!isMongoReady()) return { ok: false, status: 503, error: MONGO_ERR };
  const mentor = await getMentorByUserId(userId);
  if (!mentor?._id) return { ok: false, status: 404, error: "Không tìm thấy hồ sơ mentor." };

  // Minimal finance: use mentor.finance snapshot + derive totals from bookings
  const completed = await Booking.find({ mentorId: mentor._id, status: "completed" }).select("price platformFee vat totalAmount createdAt").lean();
  const totalEarned = completed.reduce((s, b) => s + Number(b.price || 0), 0);
  const totalSessions = completed.length;

  return {
    ok: true,
    finance: {
      availableBalance: mentor.finance?.availableBalance ?? 0,
      pendingBalance: mentor.finance?.pendingBalance ?? 0,
      totalEarned: mentor.finance?.totalEarned ?? totalEarned,
      totalSessions,
      history: completed.slice(0, 50).map((b) => ({
        id: String(b._id),
        type: "income",
        amount: Number(b.price || 0),
        status: "completed",
        date: b.createdAt,
        description: "Thu từ booking",
      })),
    },
  };
}

export async function getMentorAnalytics(userId) {
  if (!isMongoReady()) return { ok: false, status: 503, error: MONGO_ERR };
  const mentor = await getMentorByUserId(userId);
  if (!mentor?._id) return { ok: false, status: 404, error: "Không tìm thấy hồ sơ mentor." };

  const rows = await Booking.find({ mentorId: mentor._id }).select("status createdAt").lean();
  const total = rows.length;
  const completed = rows.filter((r) => r.status === "completed").length;
  const cancelled = rows.filter((r) => r.status === "cancelled").length;
  return { ok: true, analytics: { total, completed, cancelled } };
}

export async function requestPayout(userId, body) {
  if (!isMongoReady()) return { ok: false, status: 503, error: MONGO_ERR };
  const mentor = await getMentorByUserId(userId);
  if (!mentor?._id) return { ok: false, status: 404, error: "Không tìm thấy hồ sơ mentor." };
  const amount = Number(body?.amount);
  if (!Number.isFinite(amount) || amount <= 0) return { ok: false, status: 400, error: "amount không hợp lệ." };

  // Minimal: only acknowledge. Real payout would create PayoutRequest collection.
  return { ok: true, payout: { amount: Math.round(amount), status: "pending" } };
}

