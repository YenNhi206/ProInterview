import { Booking } from "../models/Booking.js";
import { Enrollment } from "../models/Enrollment.js";
import { Payment } from "../models/Payment.js";
import { enrollmentAccessGranted } from "../helpers/enrollmentAccess.js";
import {
  isTransferPaymentExpired,
  TRANSFER_PAYMENT_EXPIRED_REASON,
} from "../utils/transferPaymentExpiry.js";

async function cancelTransferLedger({ type, referenceId, session }) {
  await Payment.updateOne(
    {
      type,
      referenceId,
      provider: "transfer",
      status: "pending",
    },
    {
      $set: {
        status: "cancelled",
        failureReason: "payment_timeout",
      },
    },
    session ? { session } : {},
  );
}

/** Hủy booking CK pending quá hạn — giải phóng slot mentor. */
export async function expireBookingTransferIfNeeded(booking, { session } = {}) {
  if (!booking) return { expired: false };
  const payStatus = String(booking.paymentStatus || "").toLowerCase();
  const method = String(booking.paymentMethod || "").toLowerCase();
  if (payStatus !== "pending" || method !== "transfer") return { expired: false };
  if (!isTransferPaymentExpired(booking)) return { expired: false };

  booking.paymentStatus = "failed";
  if (String(booking.status || "").toLowerCase() === "pending") {
    booking.status = "cancelled";
    booking.cancelledBy = "system";
    booking.cancelReason = TRANSFER_PAYMENT_EXPIRED_REASON;
    booking.cancelledAt = new Date();
  }
  await booking.save(session ? { session } : undefined);

  await cancelTransferLedger({
    type: "booking",
    referenceId: booking._id,
    session,
  });

  return { expired: true };
}

/** Xóa ghi danh CK pending quá hạn — cho phép ghi danh lại. */
export async function expireEnrollmentTransferIfNeeded(enrollment, { session } = {}) {
  if (!enrollment) return { expired: false };
  if (enrollment.cartOrderId) {
    const { CartOrder } = await import("../models/CartOrder.js");
    const { expireCartOrder } = await import("./cartService.js");
    const order = await CartOrder.findById(enrollment.cartOrderId);
    return { expired: await expireCartOrder(order) };
  }
  if (enrollmentAccessGranted(enrollment)) return { expired: false };
  if (String(enrollment.paymentStatus || "").toLowerCase() !== "pending") return { expired: false };
  if (String(enrollment.paymentMethod || "").toLowerCase() !== "transfer") return { expired: false };
  if (!isTransferPaymentExpired(enrollment)) return { expired: false };

  await cancelTransferLedger({
    type: "course",
    referenceId: enrollment._id,
    session,
  });

  await Enrollment.deleteOne({ _id: enrollment._id }, session ? { session } : undefined);

  return { expired: true };
}

/** Hủy payment subscription CK pending quá hạn. */
export async function expireSubscriptionTransferIfNeeded(payment, { session } = {}) {
  if (!payment) return { expired: false };
  if (String(payment.type || "").toLowerCase() !== "subscription") return { expired: false };
  if (String(payment.provider || "").toLowerCase() !== "transfer") return { expired: false };
  if (String(payment.status || "").toLowerCase() !== "pending") return { expired: false };
  if (!isTransferPaymentExpired(payment)) return { expired: false };

  payment.status = "cancelled";
  payment.failureReason = "payment_timeout";
  const prev =
    payment.providerResponse && typeof payment.providerResponse === "object"
      ? payment.providerResponse
      : {};
  payment.providerResponse = { ...prev, expiredAt: new Date().toISOString() };
  await payment.save(session ? { session } : undefined);

  return { expired: true };
}

/**
 * Hủy giao dịch CK lộ trình (LP-10) đã quá hạn. Lộ trình vẫn ở `pending_payment`:
 * ứng viên bấm thanh toán lại thì nhận mã PI mới (`checkoutLearningPath`).
 * Điều kiện `status: "pending"` trong bộ lọc để không đè giao dịch vừa được xác nhận.
 */
export async function expireLearningPathTransferIfNeeded(payment, { session } = {}) {
  if (!payment) return { expired: false };
  if (String(payment.type || "").toLowerCase() !== "learning_path") return { expired: false };
  if (String(payment.provider || "").toLowerCase() !== "transfer") return { expired: false };
  if (String(payment.status || "").toLowerCase() !== "pending") return { expired: false };
  if (!isTransferPaymentExpired(payment)) return { expired: false };

  const result = await Payment.updateOne(
    { _id: payment._id, status: "pending" },
    {
      $set: {
        status: "cancelled",
        failureReason: "payment_timeout",
        "providerResponse.expiredAt": new Date().toISOString(),
      },
    },
    session ? { session } : {},
  );
  if (result.modifiedCount === 0) return { expired: false };
  payment.status = "cancelled";
  payment.failureReason = "payment_timeout";
  return { expired: true };
}

export async function expireBookingTransferById(bookingId, opts) {
  const booking = await Booking.findById(bookingId);
  if (!booking) return { expired: false, missing: true };
  return expireBookingTransferIfNeeded(booking, opts);
}

export async function expireEnrollmentTransferById(enrollmentId, opts) {
  const enrollment = await Enrollment.findById(enrollmentId);
  if (!enrollment) return { expired: false, missing: true };
  return expireEnrollmentTransferIfNeeded(enrollment, opts);
}

export async function expireSubscriptionTransferById(paymentId, opts) {
  const payment = await Payment.findById(paymentId);
  if (!payment) return { expired: false, missing: true };
  return expireSubscriptionTransferIfNeeded(payment, opts);
}
