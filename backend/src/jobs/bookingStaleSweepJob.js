/** Adapted from BookingMentorPlatform (9a5a8ed): flag overdue sessions for review. */
import mongoose from "mongoose";
import { Booking } from "../models/Booking.js";
import { Payment } from "../models/Payment.js";
import { User } from "../models/User.js";
import { deliverNotification } from "../services/notificationDeliveryService.js";
import { parseBookingStartMs } from "../utils/bookingSchedule.js";
import { closeExpiredJobPosts } from "../services/jobPostsService.js";

export const STALE_GRACE_MS = 60 * 60 * 1000;
const INTERVAL_MS = 20 * 60 * 1000;
let timer;
let stopped = true;

export async function runStaleSweep(now = new Date()) {
  if (mongoose.connection.readyState !== 1) return { cancelled: 0, flagged: 0 };
  const result = { cancelled: 0, flagged: 0 };
  const candidates = await Booking.find({ status: { $in: ["pending", "confirmed", "in_progress"] } })
    .populate("mentorId", "userId name").populate("userId", "name").lean();
  const admins = await User.find({ role: "admin", isActive: { $ne: false } }).select("_id").lean();
  for (const booking of candidates) {
    const startMs = parseBookingStartMs(booking.date, booking.timeSlot);
    if (!Number.isFinite(startMs)) continue;
    // A session may be rescheduled while this sweep is reading its candidates.
    const schedule = { date: booking.date, timeSlot: booking.timeSlot, durationMinutes: booking.durationMinutes ?? null };
    if (booking.status === "pending" && ["pending", "failed"].includes(booking.paymentStatus) && startMs <= now.getTime()) {
      // Conditional update protects a payment/confirmation arriving after the initial read.
      const changed = await Booking.updateOne({ _id: booking._id, ...schedule, status: "pending", paymentStatus: booking.paymentStatus },
        { $set: { status: "cancelled", paymentStatus: "failed", cancelledBy: "system", cancelledAt: now,
          cancelReason: "Tự động hủy — quá giờ hẹn mà chưa thanh toán." } });
      if (changed.modifiedCount) {
        result.cancelled++;
        await Payment.updateMany({ type: "booking", referenceId: booking._id, status: "pending" },
          { $set: { status: "cancelled", failureReason: "booking_past_start" } });
      }
      continue;
    }
    const endMs = startMs + (Number(booking.durationMinutes) || 60) * 60_000;
    if (booking.paymentStatus !== "paid" || booking.staleFlaggedAt || now.getTime() < endMs + STALE_GRACE_MS) continue;
    const changed = await Booking.updateOne({ _id: booking._id, ...schedule, paymentStatus: "paid",
      status: { $in: ["pending", "confirmed", "in_progress"] }, staleFlaggedAt: null },
    { $set: { staleFlaggedAt: now } });
    if (!changed.modifiedCount) continue;
    result.flagged++;
    const slotLabel = `${booking.date} ${booking.timeSlot}`;
    const common = { type: "system", title: "Buổi hẹn quá giờ chưa có kết quả" };
    if (booking.mentorId?.userId) await deliverNotification(booking.mentorId.userId, {
      ...common, mentorPrefKey: "session_reminder",
      body: `Buổi ${slotLabel} với ${booking.userId?.name || "học viên"} đã quá giờ kết thúc. Vui lòng kiểm tra và ghi nhận kết quả buổi hẹn.`,
      metadata: { bookingId: booking._id, actionUrl: `/mentor/meeting-detail/${booking._id}` },
    });
    if (booking.userId?._id) await deliverNotification(booking.userId._id, {
      ...common, customerPrefKey: "booking_change",
      body: `Buổi ${slotLabel} với ${booking.mentorId?.name || "mentor"} chưa ghi nhận hoàn thành. Nếu mentor không tham gia, bạn có thể báo vắng mặt trên trang buổi hẹn.`,
      metadata: { bookingId: booking._id, actionUrl: `/session/${booking._id}` },
    });
    for (const admin of admins) await deliverNotification(admin._id, {
      ...common, title: "Buổi hẹn quá giờ — cần rà soát",
      body: `Buổi ${slotLabel} giữa ${booking.mentorId?.name || "mentor"} và ${booking.userId?.name || "học viên"} đã quá giờ kết thúc hơn 60 phút.`,
      metadata: { bookingId: booking._id, actionUrl: `/admin/bookings/${booking._id}` },
    });
  }
  return result;
}

export function startBookingStaleSweepJob() {
  if (!stopped) return;
  stopped = false;
  const tick = async () => {
    try { await runStaleSweep(); }
    catch (error) { console.error("[bookingStaleSweepJob]", error.message); }
    // JB-02: cùng nhịp 20 phút, đóng tin tuyển dụng quá hạn nhận hồ sơ (lỗi bên này không chặn bên kia).
    try {
      if (mongoose.connection.readyState === 1) {
        const { closed } = await closeExpiredJobPosts();
        if (closed) console.log(`[bookingStaleSweepJob] Đã đóng ${closed} tin tuyển dụng quá hạn.`);
      }
    } catch (error) { console.error("[bookingStaleSweepJob] job posts:", error.message); }
    if (!stopped) {
      timer = setTimeout(tick, INTERVAL_MS);
      timer.unref?.();
    }
  };
  void tick();
}

export function stopBookingStaleSweepJob() {
  stopped = true;
  clearTimeout(timer);
}
