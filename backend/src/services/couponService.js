import { Coupon } from "../models/Coupon.js";

export async function findCouponByCode(code) {
  const normalized = String(code || "").trim().toUpperCase();
  if (!normalized) return null;
  return Coupon.findOne({ code: normalized });
}

function isCouponExpired(coupon) {
  return Boolean(coupon.expiresAt) && new Date() > new Date(coupon.expiresAt);
}

function couponAppliesTo(coupon, type) {
  const list = Array.isArray(coupon.applicableTo) && coupon.applicableTo.length ? coupon.applicableTo : ["all"];
  return list.includes("all") || list.includes(type);
}

export function computeCouponDiscount(coupon, amount) {
  const base = Math.max(0, Math.round(Number(amount) || 0));
  if (coupon.discountType === "fixed") return Math.min(base, Math.round(coupon.discountValue));
  return Math.min(base, Math.round((base * coupon.discountValue) / 100));
}

/**
 * Kiểm tra mã hợp lệ cho user/loại đơn/số tiền — KHÔNG đánh dấu đã dùng.
 * type: "booking" | "enrollment" | "subscription"
 */
export async function validateCoupon({ code, userId, type, amount }) {
  const coupon = await findCouponByCode(code);
  if (!coupon) return { ok: false, status: 404, error: "Mã giảm giá không tồn tại." };
  if (!coupon.isActive) return { ok: false, status: 400, error: "Mã giảm giá đã bị vô hiệu hóa." };
  if (isCouponExpired(coupon)) return { ok: false, status: 400, error: "Mã giảm giá đã hết hạn." };
  if (!couponAppliesTo(coupon, type)) {
    return { ok: false, status: 400, error: "Mã giảm giá không áp dụng cho đơn hàng này." };
  }
  const alreadyUsed = (coupon.usedBy || []).some((u) => String(u.userId) === String(userId));
  if (alreadyUsed) return { ok: false, status: 400, error: "Bạn đã sử dụng mã giảm giá này rồi." };

  const discountAmount = computeCouponDiscount(coupon, amount);
  return { ok: true, coupon, discountAmount };
}

/**
 * Đánh dấu đã dùng — atomic (chặn double-submit race). Gọi khi ĐƠN ĐÃ THANH TOÁN THÀNH CÔNG
 * (không phải lúc tạo đơn) — để đơn hết hạn/chưa từng trả tiền không bị tính là "đã dùng mã".
 * Trả false nếu user đã dùng mã này trước đó (đơn hàng vẫn giữ nguyên, không rollback ở đây).
 */
export async function claimCouponUsage(couponId, userId, { referenceModel, referenceId } = {}) {
  const updated = await Coupon.findOneAndUpdate(
    { _id: couponId, "usedBy.userId": { $ne: userId } },
    { $push: { usedBy: { userId, usedAt: new Date(), referenceModel, referenceId } } },
    { returnDocument: "after" },
  );
  return Boolean(updated);
}

/** Tiện ích: claim theo code (khi chỉ có couponCode lưu trên Booking/Enrollment/Payment, không có couponId). */
export async function claimCouponUsageByCode(code, userId, meta = {}) {
  const coupon = await findCouponByCode(code);
  if (!coupon) return false;
  return claimCouponUsage(coupon._id, userId, meta);
}
