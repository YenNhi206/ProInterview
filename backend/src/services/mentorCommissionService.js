import mongoose from "mongoose";
import { Mentor } from "../models/Mentor.js";

function parseRate(raw, fallback) {
  const n = Number(String(raw ?? "").trim());
  // Không cho phép 0% để tránh cấu hình rỗng/nhầm khiến UI hiển thị 0%.
  if (!Number.isFinite(n) || n <= 0 || n > 1) return fallback;
  return n;
}

function parsePositiveInt(raw, fallback) {
  const n = Number(String(raw ?? "").trim());
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return Math.floor(n);
}

function addYears(date, years) {
  const d = new Date(date);
  d.setFullYear(d.getFullYear() + years);
  return d;
}

export function mentorCommissionConfig() {
  const bookingStandardRate = parseRate(process.env.BOOKING_PLATFORM_FEE_RATE, 0.3);
  const bookingEarlyRate = parseRate(process.env.BOOKING_PLATFORM_FEE_RATE_EARLY_MENTOR, 0.2);
  const courseStandardRate = parseRate(process.env.COURSE_PLATFORM_FEE_RATE, 0.35);
  const courseEarlyRate = parseRate(process.env.COURSE_PLATFORM_FEE_RATE_EARLY_MENTOR, 0.25);
  const earlySlots = parsePositiveInt(process.env.EARLY_MENTOR_LIMIT, 20);
  const earlyYears = parsePositiveInt(process.env.EARLY_MENTOR_DURATION_YEARS, 1);
  return {
    bookingStandardRate,
    bookingEarlyRate,
    courseStandardRate,
    courseEarlyRate,
    earlySlots,
    earlyYears,
  };
}

export function isEarlyMentorRateActive(mentor, at = new Date()) {
  const expiresAt = mentor?.pricing?.earlyMentorExpiresAt
    ? new Date(mentor.pricing.earlyMentorExpiresAt)
    : null;
  if (!mentor?.pricing?.isEarlyMentor || !expiresAt) return false;
  return at.getTime() <= expiresAt.getTime();
}

export function resolveBookingPlatformFeeRate(mentor, at = new Date()) {
  const cfg = mentorCommissionConfig();
  const customRate = parseRate(mentor?.pricing?.platformFeeRate, NaN);
  if (Number.isFinite(customRate)) {
    return { rate: customRate, source: "mentor_custom" };
  }
  if (isEarlyMentorRateActive(mentor, at)) {
    return { rate: cfg.bookingEarlyRate, source: "early_mentor" };
  }
  return { rate: cfg.bookingStandardRate, source: "standard" };
}

export function resolveCoursePlatformFeeRate(mentor, at = new Date()) {
  const cfg = mentorCommissionConfig();
  const customRate = parseRate(mentor?.pricing?.coursePlatformFeeRate, NaN);
  if (Number.isFinite(customRate)) {
    return { rate: customRate, source: "mentor_custom" };
  }
  if (isEarlyMentorRateActive(mentor, at)) {
    return { rate: cfg.courseEarlyRate, source: "early_mentor" };
  }
  return { rate: cfg.courseStandardRate, source: "standard" };
}

/**
 * Kích hoạt policy hoa hồng cho mentor khi admin duyệt.
 * - Chỉ set mốc một lần đầu để giữ tính lịch sử.
 * - Top N mentor kích hoạt sớm nhất nhận Early rate trong 1 năm.
 */
export async function activateMentorCommissionPolicy(mentorId, now = new Date()) {
  if (!mongoose.isValidObjectId(String(mentorId || ""))) {
    return { ok: false, error: "mentorId không hợp lệ." };
  }

  const cfg = mentorCommissionConfig();
  let mentor = await Mentor.findById(mentorId).lean();
  if (!mentor) return { ok: false, error: "Không tìm thấy mentor." };

  if (!mentor?.pricing?.mentorActivatedAt) {
    await Mentor.updateOne(
      { _id: mentorId, "pricing.mentorActivatedAt": null },
      { $set: { "pricing.mentorActivatedAt": now } },
    );
    mentor = await Mentor.findById(mentorId).lean();
  }

  const activatedAt = mentor?.pricing?.mentorActivatedAt
    ? new Date(mentor.pricing.mentorActivatedAt)
    : now;

  if (mentor?.pricing?.isEarlyMentor && mentor?.pricing?.earlyMentorExpiresAt) {
    return { ok: true, mentor };
  }

  const earlierActivatedCount = await Mentor.countDocuments({
    "pricing.mentorActivatedAt": { $ne: null, $lt: activatedAt },
  });
  const rank = earlierActivatedCount + 1;
  const shouldEarly = rank <= cfg.earlySlots;

  if (shouldEarly) {
    // Guard "isEarlyMentor: {$ne: true}" đảm bảo idempotency — tránh double-grant cho cùng mentor
    // Kiểm tra tổng slot trước (soft check) để giảm window TOCTOU
    const takenSlots = await Mentor.countDocuments({ "pricing.isEarlyMentor": true });
    if (takenSlots < cfg.earlySlots) {
      const markResult = await Mentor.updateOne(
        { _id: mentorId, "pricing.isEarlyMentor": { $ne: true } },
        {
          $set: {
            "pricing.isEarlyMentor": true,
            "pricing.earlyMentorRank": rank,
            "pricing.earlyMentorExpiresAt": addYears(activatedAt, cfg.earlyYears),
          },
        },
      );
      if (markResult.modifiedCount === 1) {
        mentor = await Mentor.findById(mentorId).lean();
      }
    }
  }

  return { ok: true, mentor };
}
