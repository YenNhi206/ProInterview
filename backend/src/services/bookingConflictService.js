/**
 * Chặn ứng viên có 2 buổi chồng giờ nhau, kể cả với 2 mentor khác nhau.
 * Dùng ở mọi chỗ tạo hoặc dời giờ booking của ứng viên: đặt lịch thường (`createBooking`), mentor hẹn buổi 0đ
 * (`acceptAssessment`), đặt buổi lộ trình (`scheduleLearningPathSession`), ứng viên chọn giờ mới sau khi mentor hủy
 * (`resolveMentorCancelBooking`), mentor dời lịch (`rescheduleMentorBooking`).
 *
 * Trùng là chồng khoảng [giờ bắt đầu, giờ bắt đầu + thời lượng); buổi nối tiếp (19:00–20:00 rồi 20:00) không trùng.
 * Đặt với mentor khác ở giờ không trùng vẫn được.
 *
 * Không có index nào biểu diễn được "chồng khoảng", nên hai request cùng lúc của cùng một ứng viên vẫn có thể lọt
 * (cửa sổ vài mili giây). Trùng đúng cùng mentor + cùng giờ vẫn do unique index `mentorId + date + timeSlot` chặn.
 */
import mongoose from "mongoose";
import { Booking } from "../models/Booking.js";
import { bookingsOverlap } from "../utils/bookingSchedule.js";
import { isTransferPaymentExpired } from "../utils/transferPaymentExpiry.js";

/** Booking còn giữ giờ của ứng viên. */
const ACTIVE_BOOKING_STATUSES = ["pending", "confirmed", "in_progress"];

/** Đơn chuyển khoản chưa trả đã quá hạn: coi như đã chết, không giữ giờ (job / lần đặt sau sẽ đánh hết hạn). */
function isDeadTransferHold(booking) {
  return (
    booking.status === "pending" &&
    booking.paymentStatus === "pending" &&
    String(booking.paymentMethod || "").toLowerCase() === "transfer" &&
    isTransferPaymentExpired(booking)
  );
}

/**
 * Booking đang hoạt động của ứng viên chồng giờ với khung `{ date, timeSlot, durationMinutes }`, hoặc `null`.
 * @param {string|import("mongoose").Types.ObjectId} userId
 * @param {{ date: string, timeSlot: string, durationMinutes?: number, excludeBookingId?: unknown }} slot
 */
export async function findCandidateBookingConflict(userId, { date, timeSlot, durationMinutes = 60, excludeBookingId = null }) {
  if (!mongoose.isValidObjectId(String(userId || ""))) return null;
  const filter = { userId, status: { $in: ACTIVE_BOOKING_STATUSES } };
  if (excludeBookingId) filter._id = { $ne: excludeBookingId };
  const rows = await Booking.find(filter)
    .select("date timeSlot durationMinutes status paymentStatus paymentMethod paymentExpiresAt createdAt")
    .lean();
  const wanted = { date, timeSlot, durationMinutes };
  return rows.find((row) => !isDeadTransferHold(row) && bookingsOverlap(row, wanted)) ?? null;
}

/** Thông báo cho chính ứng viên (được xem lịch của mình). */
export function candidateConflictMessage(conflict) {
  const minutes = Number(conflict?.durationMinutes) > 0 ? Number(conflict.durationMinutes) : 60;
  return `Bạn đã có lịch hẹn khác lúc ${conflict.timeSlot} ngày ${conflict.date} (${minutes} phút) trùng khung giờ này. Vui lòng chọn giờ khác.`;
}

/** Thông báo cho mentor: không lộ lịch của ứng viên với mentor khác. */
export const MENTEE_BUSY_MESSAGE = "Mentee đã có lịch hẹn khác trùng khung giờ này. Vui lòng chọn giờ khác.";
