import mongoose from "mongoose";
import { User, Mentor, Booking, Enrollment, Payment, Course, PayoutRequest, CartOrder, Cart } from "../models/index.js";
import { expireCartOrder } from "./cartService.js";
import { expireEnrollmentTransferIfNeeded, expireBookingTransferIfNeeded } from "./transferPaymentExpiryService.js";

const active = ["pending", "confirmed", "in_progress"];
const openPayout = ["pending", "approved", "processing"];
const messages = {
  bookings: "Còn buổi đã thanh toán chưa kết thúc hoặc chưa xử lý hoàn tiền.",
  plan: "Gói Pro/Elite còn hạn sử dụng.", payments: "Còn thanh toán đang chờ, tiền đang giữ hoặc khoản hoàn chưa xong.",
  cart: "Còn đơn giỏ hàng chưa hoàn tất.", available: "Còn số dư khả dụng cần giải ngân.",
  clearing: "Còn tiền đang giữ 7 ngày.", pending: "Còn tiền trong yêu cầu rút đang xử lý.",
  earnings: "Còn thu nhập chưa ghi nhận hoặc chưa giải phóng.", payouts: "Còn yêu cầu rút tiền chưa hoàn tất.",
  mentorBookings: "Mentor còn buổi hẹn đã thanh toán chưa kết thúc.", reports: "Còn khiếu nại chưa xử lý.",
  mentorOrders: "Còn đơn của học viên đang chờ thanh toán hoặc đối soát.",
};

/** Preview is read-only. Never compare mixed ISO/DD-MM-YYYY booking dates as strings. */
export async function getAccountImpact(userId) {
  if (!mongoose.isObjectIdOrHexString(userId)) throw Object.assign(new Error("Mã người dùng không hợp lệ."), { statusCode: 400 });
  const user = await User.findById(userId).select("name email role isActive accountClosedAt plan planExpiresAt").lean();
  if (!user) throw Object.assign(new Error("Không tìm thấy tài khoản."), { statusCode: 404 });
  const mentor = await Mentor.findOne({ userId }).select("finance status").lean();
  const courses = mentor ? await Course.find({ mentorId: mentor._id }).distinct("_id") : [];
  const now = new Date();
  const [bookings, enrollments, payments, cartOrders] = await Promise.all([
    Booking.countDocuments({ userId, status: { $in: active }, paymentStatus: { $in: ["paid", "refund_pending"] } }),
    Enrollment.countDocuments({ userId, paymentStatus: "paid" }),
    Payment.countDocuments({ userId, $or: [{ status: { $in: ["held_inactive_account", "refund_pending"] } },
      { status: "pending", $or: [{ paymentExpiresAt: { $gt: now } }, { paymentExpiresAt: null }] }] }),
    CartOrder.countDocuments({ userId, active: true, $or: [{ status: "paid" }, { paymentExpiresAt: { $gt: now } }] }),
  ]);
  const checks = { bookings: bookings === 0, payments: payments === 0, cart: cartOrders === 0,
    plan: !(user.plan !== "free" && user.planExpiresAt && new Date(user.planExpiresAt) > now) };
  let mentorImpact = null;
  if (mentor) {
    const { Report } = await import("../models/Report.js");
    const unfinished = { $or: [{ earningsClearAt: { $ne: null }, earningsClearedAt: null },
      { mentorEarningsCreditedAt: null, paymentStatus: "paid" } ] };
    const mentorBookingIds = await Booking.find({ mentorId: mentor._id }).distinct("_id");
    const mentorEnrollmentIds = courses.length ? await Enrollment.find({ courseId: { $in: courses } }).distinct("_id") : [];
    const [unreleasedB, unreleasedE, payouts, mentorBookings, reports, mentorOrders] = await Promise.all([
      Booking.countDocuments({ mentorId: mentor._id, status: "completed", ...unfinished }),
      Enrollment.countDocuments({ courseId: { $in: courses }, ...unfinished }),
      PayoutRequest.countDocuments({ mentorId: mentor._id, status: { $in: openPayout } }),
      Booking.countDocuments({ mentorId: mentor._id, status: { $in: active }, paymentStatus: { $in: ["paid", "refund_pending"] } }),
      Report.countDocuments({ status: { $in: ["pending", "reviewing"] }, $or: [
        { targetType: "mentor", targetId: mentor._id }, { targetType: "course", targetId: { $in: courses } }, { targetType: "booking", targetId: { $in: mentorBookingIds } } ] }),
      Payment.countDocuments({ referenceId: { $in: [...mentorBookingIds, ...mentorEnrollmentIds] }, $or: [
        { status: { $in: ["held_inactive_account", "refund_pending"] } },
        { status: "pending", $or: [{ paymentExpiresAt: { $gt: now } }, { paymentExpiresAt: null }] },
      ] }),
    ]);
    const f = mentor.finance || {};
    const finance = { availableBalance: Number(f.availableBalance || 0), clearingBalance: Number(f.clearingBalance || 0), pendingBalance: Number(f.pendingBalance || 0) };
    Object.assign(checks, { available: finance.availableBalance === 0, clearing: finance.clearingBalance === 0,
      pending: finance.pendingBalance === 0, earnings: unreleasedB + unreleasedE === 0,
      payouts: payouts === 0, mentorBookings: mentorBookings === 0, reports: reports === 0, mentorOrders: mentorOrders === 0 });
    mentorImpact = { mentorId: String(mentor._id), status: mentor.status, finance, openPayoutRequests: payouts,
      unclearedRows: unreleasedB + unreleasedE, upcomingBookings: mentorBookings,
      payoutAccount: f.bankAccount ? { bankName: f.bankAccount.bankName, accountName: f.bankAccount.accountName,
        maskedNumber: `••••${String(f.bankAccount.accountNumber || "").slice(-4)}` } : null };
  }
  return { user: { ...user, id: String(user._id) }, mentor: mentorImpact,
    asStudent: { unusedPaidBookings: bookings, activeEnrollments: enrollments, heldPayments: payments, cartOrders,
      plan: user.plan, planExpiresAt: user.planExpiresAt }, closeChecks: checks,
    canClose: Object.values(checks).every(Boolean),
    blockers: Object.entries(checks).filter(([, ok]) => !ok).map(([code]) => ({ code, message: messages[code] })) };
}

export async function closeAccount(userId, { closedBy = null } = {}) {
  let impact = await getAccountImpact(userId);
  if (impact.user.accountClosedAt) return { ok: true, closedAt: impact.user.accountClosedAt };
  if (impact.user.role === "admin") return { ok: false, status: 409, error: "Không đóng tài khoản quản trị qua luồng này." };
  if (!impact.canClose) return { ok: false, status: 409, error: "Cần xử lý các ràng buộc trước khi đóng tài khoản.", blockers: impact.blockers };
  // Disable the account first, then recheck so new authenticated purchases stop here.
  const previous = await User.findOneAndUpdate({ _id: userId, accountClosedAt: null },
    { $set: { isActive: false, authSessions: [] }, $inc: { tokenVersion: 1 } }, { returnDocument: "before" });
  if (!previous) return { ok: false, status: 409, error: "Tài khoản đã thay đổi. Vui lòng tải lại." };
  impact = await getAccountImpact(userId);
  if (!impact.canClose) {
    await User.updateOne({ _id: userId, accountClosedAt: null }, { $set: { isActive: previous.isActive } });
    return { ok: false, status: 409, error: "Phát sinh giao dịch mới, cần xử lý trước khi đóng.", blockers: impact.blockers };
  }
  const now = new Date();
  await User.updateOne({ _id: userId }, { $set: { email: `closed_${userId}@removed.local`, name: "Tài khoản đã đóng",
    phone: "", avatar: "", bio: "", dob: "", integrations: {}, accountClosedAt: now },
    $unset: { googleId: 1, googleSub: 1, supabaseId: 1, passwordHash: 1, resetPasswordTokenHash: 1, emailVerificationTokenHash: 1 } });
  if (impact.mentor) await Mentor.updateOne({ _id: impact.mentor.mentorId }, { $set: { status: "closed", isActive: false, available: false, closedAt: now, closedBy } });
  // Preserve financial rows; clean only unpaid reservations and the shopping cart.
  for (const row of await CartOrder.find({ userId, active: true })) await expireCartOrder(row);
  for (const row of await Enrollment.find({ userId, paymentStatus: "pending" })) await expireEnrollmentTransferIfNeeded(row);
  for (const row of await Booking.find({ userId, status: "pending", paymentStatus: "pending" })) await expireBookingTransferIfNeeded(row);
  await Cart.updateOne({ userId }, { $set: { courseIds: [] } });
  return { ok: true, closedAt: now, mentorId: impact.mentor?.mentorId || null };
}
