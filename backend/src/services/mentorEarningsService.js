import mongoose from "mongoose";
import { Booking } from "../models/Booking.js";
import { Course } from "../models/Course.js";
import { Enrollment } from "../models/Enrollment.js";
import { Mentor } from "../models/Mentor.js";
import { resolveCoursePlatformFeeRate } from "./mentorCommissionService.js";
import { runInTransaction } from "../helpers/dbHelper.js";

function parseFeeRate(envVal, fallback) {
  const n = Number(String(envVal ?? "").trim());
  if (!Number.isFinite(n) || n < 0 || n > 1) return fallback;
  return n;
}

/** Tiền mentor nhận sau phí nền tảng (VAT là phần thu của KH, không trừ thêm ở đây). */
export function mentorNetFromBooking(booking) {
  const gross = Math.round(Number(booking?.totalAmount ?? booking?.price ?? 0));
  const platformFee = Math.round(Number(booking?.platformFee || 0));
  return Math.max(0, gross - platformFee);
}

export function mentorNetFromCourseSale(input, mentorForFallback = null) {
  const gross = Math.round(Number(input?.pricePaid ?? input ?? 0));
  if (gross <= 0) return 0;
  const explicitFee = Number(input?.platformFee);
  if (Number.isFinite(explicitFee) && explicitFee >= 0) {
    return Math.max(0, gross - Math.round(explicitFee));
  }
  const explicitRate = parseFeeRate(input?.platformFeeRate, NaN);
  if (Number.isFinite(explicitRate)) {
    return Math.max(0, gross - Math.round(gross * explicitRate));
  }
  const fallbackRate = mentorForFallback
    ? resolveCoursePlatformFeeRate(mentorForFallback).rate
    : parseFeeRate(process.env.COURSE_PLATFORM_FEE_RATE, 0.35);
  const pf = Math.round(gross * fallbackRate);
  return Math.max(0, gross - pf);
}

/**
 * Ghi có ví mentor khi buổi đã hoàn thành và đã thanh toán.
 * Idempotent: `mentorEarningsCreditedAt` trên Booking.
 */
export async function tryCreditMentorForCompletedBooking(bookingId) {
  if (!mongoose.isValidObjectId(bookingId)) return { ok: false, error: "bookingId không hợp lệ." };
  const booking = await Booking.findById(bookingId)
    .select("mentorId status paymentStatus price totalAmount platformFee mentorEarningsCreditedAt")
    .lean();
  if (!booking || booking.status !== "completed" || booking.paymentStatus !== "paid") {
    return { ok: true, skipped: true };
  }
  if (booking.mentorEarningsCreditedAt) return { ok: true, skipped: true, already: true };

  const net = mentorNetFromBooking(booking);
  if (net <= 0) {
    await Booking.updateOne({ _id: bookingId }, { $set: { mentorEarningsCreditedAt: new Date() } });
    return { ok: true, skipped: true, reason: "zero_net" };
  }

  // Đánh dấu "đã cộng" + cộng số dư mentor trong CÙNG 1 transaction — nếu crash giữa chừng,
  // toàn bộ rollback thay vì để booking bị đánh dấu "đã cộng" nhưng mentor chưa nhận tiền
  // (tiền mất vĩnh viễn vì guard idempotent chặn mọi lần credit lại sau đó).
  let credited = false;
  await runInTransaction(async (session) => {
    const mark = await Booking.updateOne(
      {
        _id: bookingId,
        mentorEarningsCreditedAt: { $in: [null, undefined] },
        status: "completed",
        paymentStatus: "paid",
      },
      { $set: { mentorEarningsCreditedAt: new Date() } },
      { session },
    );
    if (mark.modifiedCount !== 1) return;
    await Mentor.updateOne(
      { _id: booking.mentorId },
      { $inc: { "finance.availableBalance": net, "finance.totalEarned": net } },
      { session },
    );
    credited = true;
  });
  if (!credited) return { ok: true, skipped: true, race: true };
  return { ok: true, credited: net };
}

/**
 * Ghi có ví mentor khi học phí khóa (CK) đã được admin xác nhận.
 * Idempotent: `mentorEarningsCreditedAt` trên Enrollment.
 */
export async function tryCreditMentorForPaidEnrollment(enrollmentId) {
  if (!mongoose.isValidObjectId(enrollmentId)) return { ok: false, error: "enrollmentId không hợp lệ." };
  const row = await Enrollment.findById(enrollmentId)
    .select("courseId pricePaid platformFeeRate platformFee paymentStatus mentorEarningsCreditedAt")
    .lean();
  if (!row || row.paymentStatus !== "paid") return { ok: true, skipped: true };
  if (row.mentorEarningsCreditedAt) return { ok: true, skipped: true, already: true };

  const gross = Math.round(Number(row.pricePaid || 0));
  const course = await Course.findById(row.courseId).select("mentorId").lean();
  if (!course?.mentorId) {
    console.error("[tryCreditMentorForPaidEnrollment] course missing mentorId", enrollmentId);
    return { ok: false, error: "Không tìm thấy mentor của khóa học." };
  }
  const mentor = await Mentor.findById(course.mentorId).select("pricing").lean();
  const resolvedRate =
    Number.isFinite(Number(row.platformFeeRate))
      ? Number(row.platformFeeRate)
      : resolveCoursePlatformFeeRate(mentor).rate;
  const resolvedFee = Number.isFinite(Number(row.platformFee))
    ? Math.round(Number(row.platformFee))
    : Math.round(gross * resolvedRate);
  const net = mentorNetFromCourseSale(
    { pricePaid: gross, platformFeeRate: resolvedRate, platformFee: resolvedFee },
    mentor,
  );

  // Đánh dấu "đã cộng" + cộng số dư mentor + cộng doanh thu khóa trong CÙNG 1 transaction —
  // tránh crash giữa chừng để lại enrollment "đã cộng" nhưng mentor chưa thực nhận tiền.
  let credited = false;
  await runInTransaction(async (session) => {
    const mark = await Enrollment.updateOne(
      { _id: enrollmentId, mentorEarningsCreditedAt: { $in: [null, undefined] }, paymentStatus: "paid" },
      {
        $set: {
          mentorEarningsCreditedAt: new Date(),
          platformFeeRate: resolvedRate,
          platformFee: resolvedFee,
        },
      },
      { session },
    );
    if (mark.modifiedCount !== 1) return;
    if (net > 0) {
      await Mentor.updateOne(
        { _id: course.mentorId },
        { $inc: { "finance.availableBalance": net, "finance.totalEarned": net } },
        { session },
      );
    }
    if (gross > 0) {
      await Course.updateOne({ _id: row.courseId }, { $inc: { "stats.totalRevenue": gross } }, { session });
    }
    credited = true;
  });
  if (!credited) return { ok: true, skipped: true, race: true };
  return { ok: true, credited: net, gross };
}
