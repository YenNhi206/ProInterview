/**
 * LP-15 (A-04): admin hủy lộ trình đang học và hoàn phần chưa học qua luồng hoàn tiền có sẵn
 * (Payment `refund_pending` → admin chuyển khoản → xác nhận, giống hoàn tiền booking).
 *
 * Quy tắc (DESIGN.md mục chia tiền; quyết định ghi ở DECISIONS.md ngày 24/11/2026):
 * - Chỉ admin hủy (REQ A-04 "xử lý hoàn tiền"), chỉ lộ trình `active` (đã thanh toán).
 * - Tiền hoàn = T − tổng `shareAmount` của các buổi gốc (attempt 1) **đã học**. "Đã học" = buổi `done`, hoặc booking
 *   của buổi đã `completed` (mentor đã được ghi thu nhập, LP-14) dù mentor chưa ghi kết quả. Mentor giữ phần đã nhận.
 * - Buổi chưa học (kể cả đã đặt lịch) bị hủy: booking `cancelled` (không hoàn từng buổi, LP-22), buổi `cancelled`.
 * - Không hoàn trùng: lộ trình chuyển `active → cancelled` bằng một lệnh có điều kiện; xác nhận hoàn chỉ từ `refund_pending`.
 */
import mongoose from "mongoose";
import { LearningPath } from "../models/LearningPath.js";
import { LearningPathSession } from "../models/LearningPathSession.js";
import { Booking } from "../models/Booking.js";
import { Payment } from "../models/Payment.js";
import { Mentor } from "../models/Mentor.js";
import { deliverNotification } from "./notificationDeliveryService.js";

const OPEN_BOOKING_STATUSES = ["pending", "confirmed", "in_progress"];
const formatVnd = (n) => `${Math.round(Number(n) || 0).toLocaleString("vi-VN")}đ`;

function fail(status, error) {
  return { ok: false, status, error };
}

/**
 * Buổi gốc đã học và tiền hoàn của một lộ trình (không ghi DB).
 * @returns {Promise<{ ok: true, path, learnedSessionIds: string[], learnedShare: number, refundAmount: number,
 *   openBookingIds: string[], payment } | { ok: false, status: number, error: string }>}
 */
export async function computeLearningPathCancel(pathId) {
  if (!mongoose.isValidObjectId(pathId)) return fail(400, "Mã lộ trình không hợp lệ.");
  const path = await LearningPath.findById(pathId).lean();
  if (!path) return fail(404, "Không tìm thấy lộ trình.");
  if (path.status !== "active") {
    return fail(409, path.status === "cancelled" ? "Lộ trình đã bị hủy." : "Chỉ hủy được lộ trình đang học (đã thanh toán).");
  }

  const sessions = await LearningPathSession.find({ pathId: path._id }).lean();
  const bookingIds = sessions.map((s) => s.bookingId).filter(Boolean);
  const bookings = bookingIds.length
    ? await Booking.find({ _id: { $in: bookingIds } }).select("status").lean()
    : [];
  const bookingStatus = new Map(bookings.map((b) => [String(b._id), b.status]));
  const isLearned = (s) => s.status === "done" || bookingStatus.get(String(s.bookingId)) === "completed";

  const learned = sessions.filter((s) => s.attempt === 1 && isLearned(s));
  const learnedShare = learned.reduce((sum, s) => sum + (Number(s.shareAmount) || 0), 0);
  const refundAmount = Math.max(0, Math.round((Number(path.totalAmount) || 0) - learnedShare));
  const openBookingIds = bookings.filter((b) => OPEN_BOOKING_STATUSES.includes(b.status)).map((b) => String(b._id));
  const payment = await Payment.findOne({ type: "learning_path", referenceId: path._id, status: "success" })
    .select("amount providerRef status")
    .lean();

  return {
    ok: true,
    path,
    learnedSessionIds: sessions.filter(isLearned).map((s) => String(s._id)),
    learnedShare,
    refundAmount,
    openBookingIds,
    payment,
  };
}

/** Xem trước cho admin: bao nhiêu buổi đã học, hoàn bao nhiêu, hủy mấy buổi đã đặt. */
export async function previewLearningPathCancel(pathId) {
  const c = await computeLearningPathCancel(pathId);
  if (!c.ok) return c;
  return {
    ok: true,
    preview: {
      learningPathId: String(c.path._id),
      totalAmount: c.path.totalAmount,
      learnedSessions: c.learnedSessionIds.length,
      learnedShare: c.learnedShare,
      refundAmount: c.refundAmount,
      openBookings: c.openBookingIds.length,
      hasPayment: Boolean(c.payment),
    },
  };
}

/**
 * Admin hủy lộ trình `active`. Trả `{ ok, learningPath, refundAmount, payment }`.
 * Hai admin bấm cùng lúc: chỉ một lần thành công (lệnh `active → cancelled` có điều kiện), lần kia 409.
 */
export async function cancelLearningPathByAdmin(pathId, { adminUserId, reason } = {}) {
  const text = String(reason ?? "").trim();
  if (text.length < 5) return fail(400, "Nhập lý do hủy lộ trình (ít nhất 5 ký tự).");

  const c = await computeLearningPathCancel(pathId);
  if (!c.ok) return c;
  if (!c.payment) return fail(409, "Không tìm thấy giao dịch đã thanh toán của lộ trình này.");

  const now = new Date();
  const claimed = await LearningPath.findOneAndUpdate(
    { _id: c.path._id, status: "active" },
    { $set: { status: "cancelled", cancelledAt: now, cancelReason: text.slice(0, 1000) } },
    { returnDocument: "after" },
  ).lean();
  if (!claimed) return fail(409, "Lộ trình vừa được cập nhật bởi thao tác khác. Vui lòng tải lại.");

  // Buổi chưa học: hủy booking đang mở (không hoàn từng buổi, LP-22) và đánh dấu buổi đã hủy.
  if (c.openBookingIds.length) {
    await Booking.updateMany(
      { _id: { $in: c.openBookingIds }, status: { $in: OPEN_BOOKING_STATUSES } },
      { $set: { status: "cancelled", cancelledBy: "system", cancelledAt: now, cancelReason: "Lộ trình bị hủy" } },
    );
  }
  await LearningPathSession.updateMany(
    { pathId: c.path._id, _id: { $nin: c.learnedSessionIds }, status: { $ne: "done" } },
    { $set: { status: "cancelled" } },
  );

  const payment = await Payment.findOneAndUpdate(
    { _id: c.payment._id, status: "success" },
    {
      $set: {
        ...(c.refundAmount > 0 && { status: "refund_pending" }),
        refundAmount: c.refundAmount,
        "providerResponse.cancelRequestedAt": now,
        "providerResponse.cancelRequestedBy": adminUserId ? String(adminUserId) : "",
        "providerResponse.cancelReason": text,
        "providerResponse.learnedShare": c.learnedShare,
      },
    },
    { returnDocument: "after" },
  ).lean();

  await notifyCancelled(claimed, c.refundAmount, text);
  return { ok: true, learningPath: claimed, refundAmount: c.refundAmount, payment };
}

/**
 * Admin xác nhận đã chuyển khoản hoàn cho ứng viên. `refund_pending` → `refunded` (hoàn toàn bộ) hoặc `partial_refund`.
 * Chỉ đi được một lần (lọc theo `refund_pending`).
 */
export async function confirmLearningPathRefund(paymentId, { adminUserId, transferRef } = {}) {
  if (!mongoose.isValidObjectId(paymentId)) return fail(400, "Mã giao dịch không hợp lệ.");
  const ref = String(transferRef ?? "").trim();
  if (ref.length < 3) return fail(400, "Nhập mã chuyển khoản hoàn (ít nhất 3 ký tự).");

  const current = await Payment.findOne({ _id: paymentId, type: "learning_path" }).lean();
  if (!current) return fail(404, "Không tìm thấy giao dịch lộ trình.");
  if (current.status !== "refund_pending") return fail(409, "Giao dịch không ở trạng thái chờ hoàn tiền.");

  const fullRefund = Number(current.refundAmount) >= Number(current.amount);
  const payment = await Payment.findOneAndUpdate(
    { _id: paymentId, status: "refund_pending" },
    {
      $set: {
        status: fullRefund ? "refunded" : "partial_refund",
        refundedAt: new Date(),
        "providerResponse.refundTransferRef": ref,
        "providerResponse.refundConfirmedBy": adminUserId ? String(adminUserId) : "",
      },
    },
    { returnDocument: "after" },
  ).lean();
  if (!payment) return fail(409, "Giao dịch vừa được xác nhận bởi thao tác khác.");

  await deliverNotification(payment.userId, {
    type: "learning_path_cancelled",
    title: "Đã hoàn tiền lộ trình",
    body: `ProInterview đã chuyển khoản hoàn ${formatVnd(payment.refundAmount)} cho lộ trình đã hủy.`,
    metadata: { learningPathId: payment.referenceId, actionUrl: `/learning-paths/${payment.referenceId}` },
  }).catch(() => {});
  return { ok: true, payment };
}

async function notifyCancelled(path, refundAmount, reason) {
  const refundText = refundAmount > 0 ? ` Bạn sẽ được hoàn ${formatVnd(refundAmount)} cho phần chưa học.` : "";
  await deliverNotification(path.candidateId, {
    type: "learning_path_cancelled",
    title: "Lộ trình đã bị hủy",
    body: `Lộ trình học của bạn đã bị hủy. Lý do: ${reason}.${refundText}`,
    metadata: { learningPathId: path._id, actionUrl: `/learning-paths/${path._id}` },
  }).catch(() => {});
  const mentor = await Mentor.findById(path.mentorId).select("userId").lean();
  if (mentor?.userId) {
    await deliverNotification(mentor.userId, {
      type: "learning_path_cancelled",
      title: "Lộ trình đã bị hủy",
      body: `Một lộ trình bạn đang dạy đã bị hủy. Lý do: ${reason}. Bạn giữ thu nhập các buổi đã dạy; buổi đã đặt chưa diễn ra bị hủy.`,
      mentorPrefKey: "booking_request",
      metadata: { learningPathId: path._id, actionUrl: `/mentor/learning-paths/${path._id}/edit` },
    }).catch(() => {});
  }
}
