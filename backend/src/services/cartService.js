import crypto from "node:crypto";
import mongoose from "mongoose";
import { Cart } from "../models/Cart.js";
import { CartOrder } from "../models/CartOrder.js";
import { Course } from "../models/Course.js";
import { Enrollment } from "../models/Enrollment.js";
import { Payment } from "../models/Payment.js";
import { User } from "../models/User.js";
import { enforceExpiry } from "../utils/planGuard.js";
import { resolvePlanPerkDiscountRate } from "../constants/planCatalog.js";
import { resolveCoursePlatformFeeRate } from "./mentorCommissionService.js";
import { validateCoupon } from "./couponService.js";
import { newPaymentExpiresAt } from "../utils/transferPaymentExpiry.js";
import { expireEnrollmentTransferIfNeeded } from "./transferPaymentExpiryService.js";
import { confirmEnrollmentTransferByAdmin, recordTransferPending } from "./paymentsService.js";
import { tryCreditMentorForPaidEnrollment } from "./mentorEarningsService.js";

const MAX_COURSES = 20;
function fail(message, status = 400) {
  const error = new Error(message);
  error.statusCode = status;
  throw error;
}
function validId(id) {
  if (!mongoose.isObjectIdOrHexString(id)) fail("Mã khóa học không hợp lệ.");
}

export function serializeCartOrder(order) {
  if (!order) return null;
  return {
    id: String(order._id), orderRef: order.orderRef, items: order.items,
    totalAmount: order.totalAmount, couponCode: order.couponCode,
    status: order.status === "paid" && !order.fulfilledAt ? "processing" : order.status,
    paymentExpiresAt: order.paymentExpiresAt,
  };
}

export async function expireCartOrder(order) {
  if (!order || !["preparing", "pending", "expired"].includes(order.status)) return false;
  if (order.status !== "expired" && new Date(order.paymentExpiresAt).getTime() > Date.now()) return false;
  // Claim expiry before deleting reservations so a concurrent payment cannot be removed.
  const expired = await CartOrder.findOneAndUpdate(
    { _id: order._id, status: { $in: ["preparing", "pending", "expired"] } },
    { $set: { status: "expired", active: false } }, { new: true },
  );
  if (!expired) return false;
  await Payment.updateMany(
    { referenceId: { $in: expired.items.map((i) => i.enrollmentId) }, provider: "transfer", status: "pending" },
    { $set: { status: "cancelled", failureReason: "payment_timeout" } },
  );
  await Enrollment.deleteMany({ cartOrderId: expired._id, paymentStatus: "pending" });
  return true;
}

export async function getCartOrder(userId, id) {
  validId(id);
  let order = await CartOrder.findOne({ _id: id, userId });
  if (!order) fail("Không tìm thấy đơn hàng.", 404);
  if (await expireCartOrder(order)) order.status = "expired";
  // Payment receipt is already persisted: polling can retry interrupted fulfillment
  // without charging again, even when SePay has stopped retrying an HTTP-200 webhook.
  if (order.status === "paid" && !order.fulfilledAt) {
    await confirmCartOrderPayment(order._id, {
      force: true, forceNote: order.paymentNote || "Tiếp tục đơn đã nhận tiền",
      amount: order.totalAmount, adminUserId: order.confirmedBy,
    }).catch((error) => {
      if (error.statusCode !== 409) console.error("[cart fulfillment retry]", error.message);
    });
    order = await CartOrder.findById(id);
  }
  return serializeCartOrder(order);
}

export async function cancelCartOrder(userId, orderId = null) {
  const query = { userId, active: true, status: { $in: ["preparing", "pending"] } };
  if (orderId) {
    validId(orderId);
    query._id = orderId;
  }
  const order = await CartOrder.findOne(query);
  if (!order) return false;

  const orderCourseIds = (order.items || []).map((i) => i.courseId);
  if (orderCourseIds.length) {
    await Cart.updateOne(
      { userId },
      { $addToSet: { courseIds: { $each: orderCourseIds } } },
      { upsert: true }
    );
  }

  await CartOrder.updateOne(
    { _id: order._id },
    { $set: { status: "expired", active: false } }
  );
  await Payment.updateMany(
    { referenceId: { $in: order.items.map((i) => i.enrollmentId) }, provider: "transfer", status: "pending" },
    { $set: { status: "cancelled", failureReason: "order_cancelled" } }
  );
  await Enrollment.deleteMany({ cartOrderId: order._id, paymentStatus: "pending" });
  return true;
}

async function activeOrder(userId) {
  const order = await CartOrder.findOne({ userId, active: true });
  if (order && await expireCartOrder(order)) return null;
  return order;
}

export async function getCart(userId) {
  const cart = await Cart.findOne({ userId }).lean();
  const order = await activeOrder(userId);
  const ids = cart?.courseIds || [];
  let buyer = await User.findById(userId).select("plan planExpiresAt").lean();
  if (buyer) buyer = await enforceExpiry(buyer);
  const discountRate = resolvePlanPerkDiscountRate(buyer?.plan);
  const owned = await Enrollment.find({ userId, courseId: { $in: ids }, paymentStatus: "paid" }).select("courseId").lean();
  const ownedIds = new Set(owned.map((e) => String(e.courseId)));
  if (owned.length) await Cart.updateOne({ userId }, { $pull: { courseIds: { $in: owned.map((e) => e.courseId) } } });
  const courses = await Course.find({ _id: { $in: ids } }).populate("mentorId", "name userId pricing isActive").lean();
  const courseById = new Map(courses.map((c) => [String(c._id), c]));
  const items = ids.filter((id) => !ownedIds.has(String(id))).map((id) => {
    const course = courseById.get(String(id));
    const price = Math.max(0, Math.round(Number(course?.price) || 0));
    const discountAmount = Math.round(price * discountRate);
    return {
      courseId: String(id), title: course?.title || "Khóa học không còn tồn tại",
      thumbnail: course?.thumbnail || "", mentorName: course?.mentorId?.name || "",
      originalPrice: price, price: price - discountAmount, discountRate, discountAmount,
      available: Boolean(course && course.status === "published" && course.mentorId?.isActive !== false
        && String(course.mentorId?.userId) !== String(userId)),
    };
  });
  return { items, totalAmount: items.reduce((sum, i) => sum + i.price, 0), pendingOrder: serializeCartOrder(order) };
}

export async function addCartCourse(userId, courseId) {
  validId(courseId);
  const course = await Course.findById(courseId).populate("mentorId", "userId isActive");
  if (!course || course.status !== "published" || course.mentorId?.isActive === false) fail("Khóa học hiện không mở bán.", 404);
  if (String(course.mentorId?.userId) === String(userId)) fail("Không thể tự mua khóa học của chính mình.");
  if (await Enrollment.exists({ userId, courseId, paymentStatus: "paid" })) fail("Bạn đã sở hữu khóa học này.");

  try {
    await Cart.updateOne({ userId }, { $setOnInsert: { userId, courseIds: [] } }, { upsert: true });
  } catch (error) { if (error.code !== 11000) throw error; }
  const result = await Cart.updateOne(
    { userId, [`courseIds.${MAX_COURSES - 1}`]: { $exists: false } },
    { $addToSet: { courseIds: courseId } },
  );
  if (!result.matchedCount && !await Cart.exists({ userId, courseIds: courseId })) fail(`Giỏ hàng tối đa ${MAX_COURSES} khóa học.`);
  return getCart(userId);
}

export async function removeCartCourse(userId, courseId) {
  validId(courseId);
  await Cart.updateOne({ userId }, { $pull: { courseIds: courseId } });
  return getCart(userId);
}

export async function checkoutCart(userId, { couponCode = "" } = {}) {
  const previous = await activeOrder(userId);
  if (previous) {
    if (previous.status === "preparing") fail("Đơn hàng đang được tạo. Vui lòng thử lại sau.", 409);
    return serializeCartOrder(previous);
  }
  const cart = await getCart(userId);
  if (!cart.items.length) fail("Giỏ hàng trống.");
  if (cart.items.some((i) => !i.available)) fail("Vui lòng xóa khóa học không còn mở bán khỏi giỏ hàng.");
  const items = [];
  for (const item of cart.items) {
    const existing = await Enrollment.findOne({ userId, courseId: item.courseId });
    if (existing && !(await expireEnrollmentTransferIfNeeded(existing)).expired) {
      fail("Có khóa học đang chờ thanh toán riêng. Vui lòng hoàn tất hoặc chờ đơn đó hết hạn trước khi thanh toán giỏ hàng.", 409);
    }
    const course = await Course.findById(item.courseId).populate("mentorId", "pricing").lean();
    if (!course || course.status !== "published") fail("Khóa học đã thay đổi. Vui lòng tải lại giỏ hàng.", 409);
    const { rate } = resolveCoursePlatformFeeRate(course.mentorId);
    items.push({ ...item, enrollmentId: new mongoose.Types.ObjectId(), platformFeeRate: rate,
      platformFee: Math.max(0, Math.round(item.originalPrice * rate) - item.discountAmount), couponDiscountAmount: 0 });
  }
  let normalizedCoupon = "";
  if (String(couponCode).trim()) {
    const coupon = await validateCoupon({ code: couponCode, userId, type: "enrollment", amount: cart.totalAmount });
    if (!coupon.ok) fail(coupon.error, coupon.status);
    normalizedCoupon = coupon.coupon.code;
    let cumulativeBase = 0;
    let allocated = 0;
    for (const item of items) {
      cumulativeBase += item.price;
      const cumulativeDiscount = Math.floor(coupon.discountAmount * cumulativeBase / (cart.totalAmount || 1));
      item.couponDiscountAmount = cumulativeDiscount - allocated;
      allocated = cumulativeDiscount;
      item.price -= item.couponDiscountAmount;
      item.platformFee = Math.max(0, item.platformFee - item.couponDiscountAmount);
    }
  }
  let order;
  try {
    order = await CartOrder.create({ userId, items, couponCode: normalizedCoupon,
      orderRef: `PI${crypto.randomInt(100_000_000_000, 999_999_999_999)}`,
      totalAmount: items.reduce((sum, i) => sum + i.price, 0), paymentExpiresAt: newPaymentExpiresAt() });
  } catch (error) {
    if (error.code === 11000) fail("Đơn hàng đang được tạo. Vui lòng thử lại sau.", 409);
    throw error;
  }
  try {
    for (const [index, item] of items.entries()) {
      await Enrollment.create({ _id: item.enrollmentId, userId, courseId: item.courseId, cartOrderId: order._id,
        pricePaid: item.price, platformFeeRate: item.platformFeeRate, platformFee: item.platformFee,
        discountRate: item.discountRate, discountAmount: item.discountAmount,
        couponCode: normalizedCoupon, couponDiscountAmount: item.couponDiscountAmount,
        paymentRef: `${order.orderRef}-${index + 1}`, paymentExpiresAt: order.paymentExpiresAt,
        paymentStatus: "pending", paymentMethod: "transfer" });
      if (item.price > 0) {
        const ledger = await recordTransferPending({ userId, type: "course", referenceModel: "Enrollment",
          referenceId: item.enrollmentId, amount: item.price, paymentExpiresAt: order.paymentExpiresAt,
          couponCode: normalizedCoupon, couponDiscountAmount: item.couponDiscountAmount });
        if (!ledger.ok) throw new Error("Không tạo được giao dịch. Vui lòng thử lại.");
      }
    }
    order.status = "pending";
    await order.save();
  } catch (error) {
    await CartOrder.updateOne({ _id: order._id }, { $set: { status: "expired", active: false } });
    await Enrollment.deleteMany({ cartOrderId: order._id, paymentStatus: "pending" });
    await Payment.updateMany({ referenceId: { $in: items.map((i) => i.enrollmentId) }, status: "pending" },
      { $set: { status: "cancelled", failureReason: "cart_checkout_failed" } });
    if (error.code === 11000) fail("Khóa học đã có đơn thanh toán. Vui lòng tải lại giỏ hàng.", 409);
    throw error;
  }
  if (order.totalAmount === 0) {
    await confirmCartOrderPayment(order._id, { force: true, forceNote: "Đơn miễn phí", amount: 0 });
    order = await CartOrder.findById(order._id);
  }
  return serializeCartOrder(order);
}

export async function confirmCartOrderPayment(orderId, options = {}) {
  validId(orderId);
  let order = await CartOrder.findById(orderId);
  if (!order) fail("Không tìm thấy đơn giỏ hàng.", 404);
  if (!options.force || String(options.forceNote || "").trim().length < 3) fail("Xác nhận toàn đơn cần lý do đối soát.");
  if (Number(options.amount) !== order.totalAmount) fail("Số tiền xác nhận không khớp tổng đơn giỏ hàng.");
  if (await expireCartOrder(order) || order.status === "expired") fail("Đơn hàng đã hết hạn.", 409);
  if (order.status === "preparing") fail("Đơn hàng chưa tạo xong.", 409);
  if (order.fulfilledAt) return { ok: true, idempotent: true, order: serializeCartOrder(order) };
  const payer = await User.findById(order.userId).select("isActive accountClosedAt").lean();
  if (!payer || payer.isActive === false || payer.accountClosedAt) fail("Tài khoản ngừng hoạt động. Cần đối soát khoản tiền đã nhận.", 409);
  if (await Payment.exists({ referenceId: { $in: order.items.map((item) => item.enrollmentId) },
    status: { $in: ["held_inactive_account", "refunded", "refund_pending", "partial_refund"] } })) fail("Đơn có giao dịch đang giữ hoặc hoàn tiền, cần đối soát.", 409);
  // Store receipt once before fulfillment. If interrupted, replay resumes using the original
  // immutable total, including already-paid items (never match only the unpaid remainder).
  await CartOrder.updateOne({ _id: orderId, status: "pending" },
    { $set: { status: "paid", paidAt: new Date(), paymentNote: String(options.forceNote).slice(0, 500),
      ...(mongoose.isObjectIdOrHexString(options.adminUserId) ? { confirmedBy: options.adminUserId } : {}) } });
  const now = new Date();
  order = await CartOrder.findOneAndUpdate({ _id: orderId, status: "paid", fulfilledAt: null,
    $or: [{ fulfillmentLockUntil: null }, { fulfillmentLockUntil: { $lt: now } }] },
  { $set: { fulfillmentLockUntil: new Date(now.getTime() + 120_000) } }, { new: true });
  if (!order) fail("Đơn hàng đang được xác nhận. Vui lòng thử lại sau.", 409);
  try {
    for (const item of order.items) {
      const row = await Enrollment.findOne({ _id: item.enrollmentId, cartOrderId: order._id });
      if (!row) throw new Error("Thiếu ghi danh trong đơn hàng; cần đối soát.");
      if (row.paymentStatus !== "paid") {
        const result = await confirmEnrollmentTransferByAdmin(String(row._id), { ...options, _cartOrderId: String(order._id) });
        if (!result.ok) throw new Error(result.error);
      }
      const credit = await tryCreditMentorForPaidEnrollment(String(row._id));
      if (!credit.ok) throw new Error(credit.error || "Chưa đối soát xong thu nhập mentor.");
    }
    await Cart.updateOne({ userId: order.userId }, { $pull: { courseIds: { $in: order.items.map((i) => i.courseId) } } });
    order.fulfilledAt = new Date();
    order.active = false;
    await order.save();
    return { ok: true, order: serializeCartOrder(order) };
  } finally {
    await CartOrder.updateOne({ _id: orderId }, { $unset: { fulfillmentLockUntil: "" } });
  }
}
