/**
 * LP-04: field tiền ghi sẵn cho Booking của lộ trình và buổi đánh giá 0đ.
 *
 * Vì sao phải ghi sẵn (docs/capstone/DECISIONS.md, "Chia tiền lộ trình"):
 * - `mentorNetFromBooking` = `totalAmount − platformFee`, không đọc `platformFeeRate` → thiếu
 *   `platformFee` thì mentor nhận 100%.
 * - `bookingStaleSweepJob` hủy booking `pending` chưa trả đã qua giờ → booking lộ trình phải `paid`.
 * - Báo cáo tài chính loại `paymentMethod: "learning_path"` để không cộng trùng với Payment trọn gói.
 *
 * Kết quả trải thẳng vào `Booking.create({ ...fields, ...learningPathBookingMoney(...) })`.
 */

function assertVnd(value, name) {
  if (!Number.isInteger(value) || value < 0) {
    throw new RangeError(`${name} phải là số nguyên VND không âm (nhận ${value}).`);
  }
}

function assertRate(rate) {
  if (typeof rate !== "number" || !Number.isFinite(rate) || rate < 0 || rate > 1) {
    throw new RangeError(`platformFeeRate phải nằm trong [0, 1] (nhận ${rate}).`);
  }
}

/**
 * Booking một buổi lộ trình. `shareAmount = 0` dùng cho buổi học lại miễn phí (quyết định 2).
 * @param {{ shareAmount: number, platformFeeRate: number, paidAt?: Date }} input
 */
export function learningPathBookingMoney({ shareAmount, platformFeeRate, paidAt = new Date() }) {
  assertVnd(shareAmount, "shareAmount");
  assertRate(platformFeeRate);
  return {
    price: shareAmount,
    totalAmount: shareAmount,
    platformFeeRate,
    platformFee: Math.round(shareAmount * platformFeeRate),
    vat: 0,
    discountRate: 0,
    discountAmount: 0,
    couponCode: "",
    couponDiscountAmount: 0,
    paymentStatus: "paid",
    paymentMethod: "learning_path",
    paidAt,
  };
}

/** Booking buổi đánh giá 0đ (`sessionType: "assessment"`): mọi field tiền bằng 0, không qua thanh toán. */
export function assessmentBookingMoney({ paidAt = new Date() } = {}) {
  return {
    price: 0,
    totalAmount: 0,
    platformFeeRate: 0,
    platformFee: 0,
    vat: 0,
    discountRate: 0,
    discountAmount: 0,
    couponCode: "",
    couponDiscountAmount: 0,
    paymentStatus: "paid",
    paymentMethod: "",
    paidAt,
  };
}

/** Booking thuộc lộ trình hoặc là buổi đánh giá 0đ — các luồng hủy/hoàn tiền cũ phải bỏ qua (LP-22). */
export function isLearningPathOrAssessmentBooking(booking) {
  return Boolean(booking?.learningPathId) || booking?.sessionType === "assessment" || booking?.paymentMethod === "learning_path";
}

/**
 * Điều kiện Mongo loại booking lộ trình và buổi 0đ khỏi báo cáo doanh thu booking.
 * Doanh thu lộ trình đọc từ Payment `learning_path` (LP-16).
 */
export const EXCLUDE_LEARNING_PATH_BOOKINGS = Object.freeze({
  paymentMethod: { $ne: "learning_path" },
  sessionType: { $ne: "assessment" },
});
