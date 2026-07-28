import crypto from "node:crypto";
import qs from "node:querystring";
import mongoose from "mongoose";
import { Payment } from "../models/Payment.js";
import { Booking } from "../models/Booking.js";
import { User } from "../models/User.js";
import { Enrollment } from "../models/Enrollment.js";
import { runInTransaction } from "../helpers/dbHelper.js";
import { planKeyFromSubscriptionMeta } from "../utils/planKeys.js";
import { normalizeBillingCycle, resolveSubscriptionAmount } from "../constants/planCatalog.js";
import { newPaymentExpiresAt } from "../utils/transferPaymentExpiry.js";
import {
  expireSubscriptionTransferIfNeeded,
} from "./transferPaymentExpiryService.js";
import { incrementCourseEnrollmentCount } from "./courseStatsService.js";
import { tryCreditMentorForPaidEnrollment } from "./mentorEarningsService.js";
import { Mentor } from "../models/Mentor.js";
import { deliverNotification } from "./notificationDeliveryService.js";
import { validateCoupon, claimCouponUsageByCode } from "./couponService.js";

const MONGO_ERR = "MongoDB chưa kết nối. Kiểm tra MONGO_URI trong .env.";

function isMongoReady() {
  return mongoose.connection.readyState === 1;
}

function webhookSecret() {
  return typeof process.env.PAYMENT_WEBHOOK_SECRET === "string" ? process.env.PAYMENT_WEBHOOK_SECRET.trim() : "";
}

function timingSafeStringEqual(a, b) {
  const ba = Buffer.from(String(a ?? ""), "utf8");
  const bb = Buffer.from(String(b ?? ""), "utf8");
  if (ba.length !== bb.length) return false;
  return crypto.timingSafeEqual(ba, bb);
}

/**
 * Khởi tạo thanh toán: tạo bản ghi Payment + trả URL cổng thanh toán.
 * @param {string} userId
 * @param {object} body { type, provider, amount, bookingId, planKey, ipAddr }
 */
export async function initiatePayment(userId, body) {
  if (!isMongoReady()) return { ok: false, status: 503, error: MONGO_ERR };
  if (!mongoose.isValidObjectId(userId)) return { ok: false, status: 401, error: "Phiên không hợp lệ." };

  const type = String(body?.type ?? "booking").toLowerCase();
  const provider = String(body?.provider ?? "momo").toLowerCase();
  if (!["momo", "zalopay", "vnpay", "card"].includes(provider)) {
    return { ok: false, status: 400, error: "provider không hợp lệ (momo, zalopay, vnpay, card)." };
  }

  const providerEnum = provider === "zalopay" ? "zalopay" : provider === "vnpay" ? "vnpay" : provider === "card" ? "card" : "momo";

  let amount = Number(body?.amount);
  let referenceId;
  let referenceModel = "Booking";
  let providerResponse;

  if (type === "booking") {
    const bid = body?.bookingId;
    if (!bid || !mongoose.isValidObjectId(bid)) {
      return { ok: false, status: 400, error: "bookingId (ObjectId) bắt buộc khi type=booking." };
    }
    const b = await Booking.findOne({ _id: bid, userId }).lean();
    if (!b) return { ok: false, status: 404, error: "Không tìm thấy booking." };
    // Luôn dùng amount từ booking record — không tin body.amount (tránh user tự điền giá thấp)
    amount = Math.round(b.totalAmount ?? b.price ?? 0);
    referenceId = b._id;
  } else if (type === "subscription") {
    const rawPlan = body?.planKey ?? body?.plan ?? "starter_pro";
    const billing = normalizeBillingCycle(body?.billing);
    const catalogAmount = resolveSubscriptionAmount(rawPlan, billing);
    if (!catalogAmount) {
      return { ok: false, status: 400, error: "planKey hoặc billing không hợp lệ." };
    }
    amount = catalogAmount;
    referenceId = new mongoose.Types.ObjectId(String(userId));
    referenceModel = "Subscription";
    const subscriptionPlan = planKeyFromSubscriptionMeta(rawPlan) || "starter_pro";
    providerResponse = { plan: subscriptionPlan, billing };
  } else {
    return { ok: false, status: 400, error: "type phải là booking hoặc subscription." };
  }

  // Tạo mã tham chiếu ngắn gọn (10 ký tự) để đảm bảo VNPay Sandbox không bị lỗi không tìm thấy đơn hàng
  const providerRef = crypto.randomBytes(5).toString('hex').toUpperCase();

  const pay = await Payment.create({
    userId,
    type,
    referenceId,
    referenceModel,
    amount,
    currency: "VND",
    provider: providerEnum,
    providerRef,
    status: "pending",
    ...(providerResponse ? { providerResponse } : {}),
  });

  const base = process.env.FRONTEND_URL?.replace(/\/$/, "") || "http://localhost:5173";
  let payUrl = `${base}/checkout?paymentId=${pay._id.toString()}&mock=1`;
  let isMock = true;

  // Xử lý VNPay thật (Sandbox)
  if (providerEnum === "vnpay" && process.env.VNP_TMN_CODE && process.env.VNP_HASH_SECRET) {
    const ipAddr = body?.ipAddr || "127.0.0.1";
    // Sử dụng providerRef (UUID) thay vì ObjectId để đảm bảo định dạng linh hoạt cho VNPay
    payUrl = createVnpayUrl(pay.providerRef, amount, ipAddr);
    isMock = false;
  }

  return {
    ok: true,
    paymentId: pay._id.toString(),
    providerRef,
    payUrl,
    qrBase64: null,
    deepLink: null,
    mock: isMock,
    message: isMock 
      ? "Sandbox: chưa gọi provider API thật. Dùng payUrl để giả lập."
      : "Redirecting to VNPay gateway.",
  };
}

/** ─── VNPay Helpers ─── */

function createVnpayUrl(paymentId, amount, ipAddr) {
  const tmnCode = process.env.VNP_TMN_CODE;
  const secretKey = process.env.VNP_HASH_SECRET;
  let vnpUrl = process.env.VNP_URL || "https://sandbox.vnpayment.vn/paymentv2/vpcpay.html";
  const returnUrl = process.env.VNP_RETURN_URL;

  const date = new Date();
  const createDate = formatVnpDate(date);

  let vnp_Params = {};
  vnp_Params['vnp_Version'] = '2.1.0';
  vnp_Params['vnp_Command'] = 'pay';
  vnp_Params['vnp_TmnCode'] = tmnCode;
  vnp_Params['vnp_Locale'] = 'vn';
  vnp_Params['vnp_CurrCode'] = 'VND';
  vnp_Params['vnp_TxnRef'] = paymentId; // Đây là providerRef
  vnp_Params['vnp_OrderInfo'] = 'Thanh toan ProInterview';
  vnp_Params['vnp_OrderType'] = 'other';
  vnp_Params['vnp_Amount'] = Math.round(amount * 100);
  vnp_Params['vnp_ReturnUrl'] = returnUrl;
  vnp_Params['vnp_IpAddr'] = (ipAddr === '::1' || ipAddr === '::ffff:127.0.0.1') ? '127.0.0.1' : ipAddr;
  vnp_Params['vnp_CreateDate'] = createDate;

  const sortedKeys = Object.keys(vnp_Params).sort();
  let signData = "";
  let query = "";

  for (let i = 0; i < sortedKeys.length; i++) {
    const key = sortedKeys[i];
    const val = vnp_Params[key];
    if (val !== undefined && val !== null && val !== "") {
      const encodedKey = encodeURIComponent(key);
      const encodedVal = encodeURIComponent(val).replace(/%20/g, "+");
      if (signData.length > 0) {
        signData += "&";
        query += "&";
      }
      signData += encodedKey + "=" + encodedVal;
      query += encodedKey + "=" + encodedVal;
    }
  }

  const hmac = crypto.createHmac("sha512", secretKey);
  const signed = hmac.update(Buffer.from(signData, 'utf-8')).digest("hex").toUpperCase();
  
  return vnpUrl + "?" + query + "&vnp_SecureHash=" + signed;
}


function sortVnpObject(obj) {
  const sorted = {};
  const keys = Object.keys(obj).sort();
  for (const key of keys) {
    sorted[key] = obj[key];
  }
  return sorted;
}


function formatVnpDate(date) {
  const year = date.getFullYear();
  const month = (1 + date.getMonth()).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  const hour = date.getHours().toString().padStart(2, '0');
  const minute = date.getMinutes().toString().padStart(2, '0');
  const second = date.getSeconds().toString().padStart(2, '0');
  return `${year}${month}${day}${hour}${minute}${second}`;
}


/**
 * Admin xác nhận đã nhận CK — ghi vào `payments` (cùng nguồn sự thật với MoMo/VNPay).
 * Idempotent: đã có bản ghi transfer+success cho cùng reference thì bỏ qua.
 */
export async function recordAdminTransferSuccess({
  userId,
  type,
  referenceModel,
  referenceId,
  amount,
  adminUserId = "",
  forceConfirm = false,
  forceNote = "",
  session = null,
}) {
  if (!isMongoReady()) return { ok: false, error: MONGO_ERR };
  if (!mongoose.isValidObjectId(userId) || !mongoose.isValidObjectId(referenceId)) {
    return { ok: false, error: "Tham chiếu không hợp lệ." };
  }
  const uid = new mongoose.Types.ObjectId(String(userId));
  const rid = new mongoose.Types.ObjectId(String(referenceId));
  const amt = Math.round(Number(amount) || 0);
  if (amt <= 0) return { ok: false, error: "Số tiền không hợp lệ." };
  const t = String(type || "").toLowerCase();
  if (!["booking", "course", "subscription"].includes(t)) {
    return { ok: false, error: "type phải là booking, course hoặc subscription." };
  }
  const refModel =
    referenceModel ||
    (t === "booking" ? "Booking" : t === "course" ? "Enrollment" : "Subscription");
  if (!["Booking", "Enrollment", "Subscription"].includes(String(refModel))) {
    return { ok: false, error: "referenceModel không hợp lệ." };
  }

  const defaultProviderRef = `trf-${t}-${String(rid)}`;

  // Ưu tiên update bản ghi CK pending (nếu đã tạo trước) → success
  const existing = await Payment.findOne({
    userId: uid,
    type: t,
    referenceId: rid,
    provider: "transfer",
  })
    .session(session)
    .select("_id status providerRef")
    .lean();

  if (existing && existing.status === "success") return { ok: true, idempotent: true };

  const note = String(forceNote || "").trim().slice(0, 500);
  const confirmMeta = {
    channel: "bank_transfer",
    confirmedBy: "admin",
    confirmedByUserId: String(adminUserId || "").trim() || null,
    confirmedAt: new Date(),
    forceConfirm: Boolean(forceConfirm),
    forceNote: note || "",
  };

  if (existing) {
    const current = await Payment.findById(existing._id).session(session).select("providerResponse").lean();
    const prev = current?.providerResponse && typeof current.providerResponse === "object" ? current.providerResponse : {};
    await Payment.updateOne(
      { _id: existing._id },
      {
        $set: {
          amount: amt,
          referenceModel: refModel,
          providerRef: existing.providerRef || defaultProviderRef,
          status: "success",
          paidAt: new Date(),
          providerResponse: { ...prev, ...confirmMeta },
        },
        $unset: { failureReason: "" },
      },
      { session },
    );
    return { ok: true, updated: true };
  }

  // Fallback: chưa có pending (data cũ) → tạo luôn success
  try {
    const created = new Payment({
      userId: uid,
      type: t,
      referenceId: rid,
      referenceModel: refModel,
      amount: amt,
      currency: "VND",
      provider: "transfer",
      providerRef: defaultProviderRef,
      status: "success",
      paidAt: new Date(),
      providerResponse: confirmMeta,
    });
    await created.save({ session });
  } catch (e) {
    if (e?.code === 11000) return { ok: true, idempotent: true };
    console.error("[recordAdminTransferSuccess]", e?.message || e);
    return { ok: false, error: e?.message || "Không ghi được bản ghi thanh toán." };
  }
  return { ok: true, created: true };
}

/**
 * Tạo bản ghi CK pending trong `payments` ngay khi user chọn CK (booking / course).
 * Idempotent: đã có record transfer cho reference thì bỏ qua.
 */
export async function recordTransferPending({
  userId,
  type,
  referenceModel,
  referenceId,
  amount,
  session = null,
  providerRef: providerRefInput,
  planKey,
  billing,
  paymentExpiresAt,
  couponCode,
  couponDiscountAmount,
}) {
  if (!isMongoReady()) return { ok: false, error: MONGO_ERR };
  if (!mongoose.isValidObjectId(userId) || !mongoose.isValidObjectId(referenceId)) {
    return { ok: false, error: "Tham chiếu không hợp lệ." };
  }
  const uid = new mongoose.Types.ObjectId(String(userId));
  const rid = new mongoose.Types.ObjectId(String(referenceId));
  const amt = Math.round(Number(amount) || 0);
  if (amt <= 0) return { ok: false, error: "Số tiền không hợp lệ." };

  const t = String(type || "").toLowerCase();
  if (!["booking", "course", "subscription"].includes(t)) {
    return { ok: false, error: "type phải là booking, course hoặc subscription." };
  }

  const refModel =
    referenceModel ||
    (t === "booking" ? "Booking" : t === "course" ? "Enrollment" : "Subscription");
  if (!["Booking", "Enrollment", "Subscription"].includes(String(refModel))) {
    return { ok: false, error: "referenceModel không hợp lệ." };
  }

  const existingQuery =
    t === "subscription"
      ? { userId: uid, type: t, provider: "transfer", status: "pending" }
      : { userId: uid, type: t, referenceId: rid, provider: "transfer" };
  const existing = await Payment.findOne(existingQuery)
    .session(session)
    .select("_id status providerRef referenceId")
    .lean();
  if (existing) {
    if (existing.status === "pending") {
      const $set = { amount: amt };
      const nextRef =
        typeof providerRefInput === "string" && providerRefInput.trim()
          ? String(providerRefInput).trim().slice(0, 100)
          : "";
      if (nextRef && nextRef !== existing.providerRef) {
        $set.providerRef = nextRef;
      }
      if (planKey && t === "subscription") {
        $set["providerResponse.plan"] = String(planKey).toLowerCase().includes("elite")
          ? "elite_pro"
          : "starter_pro";
      }
      if (billing && t === "subscription") {
        $set["providerResponse.billing"] = billing === "yearly" ? "yearly" : "monthly";
      }
      if (couponCode) {
        $set["providerResponse.couponCode"] = couponCode;
        $set["providerResponse.couponDiscountAmount"] = Math.round(Number(couponDiscountAmount) || 0);
      }
      if (paymentExpiresAt) {
        $set.paymentExpiresAt = paymentExpiresAt;
      }
      await Payment.updateOne({ _id: existing._id }, { $set });
      const refreshed = await Payment.findById(existing._id).select("providerRef status paymentExpiresAt createdAt").lean();
      return {
        ok: true,
        idempotent: true,
        status: refreshed?.status || existing.status,
        paymentId: String(existing._id),
        providerRef: refreshed?.providerRef || existing.providerRef,
        paymentExpiresAt: refreshed?.paymentExpiresAt || paymentExpiresAt || null,
      };
    }
    return {
      ok: true,
      idempotent: true,
      status: existing.status,
      paymentId: String(existing._id),
      providerRef: existing.providerRef,
    };
  }

  const providerRef =
    (typeof providerRefInput === "string" && providerRefInput.trim()) ||
    `trf-${t}-${String(rid)}`;
  const expiresAt = paymentExpiresAt || newPaymentExpiresAt();
  const planMeta =
    planKey && t === "subscription"
      ? {
          plan: String(planKey).toLowerCase().includes("elite") ? "elite_pro" : "starter_pro",
          billing: billing === "yearly" ? "yearly" : "monthly",
        }
      : {};
  const couponMeta = couponCode
    ? { couponCode, couponDiscountAmount: Math.round(Number(couponDiscountAmount) || 0) }
    : {};
  let created;
  try {
    created = new Payment({
      userId: uid,
      type: t,
      referenceId: rid,
      referenceModel: refModel,
      amount: amt,
      currency: "VND",
      provider: "transfer",
      providerRef: String(providerRef).trim().slice(0, 100),
      status: "pending",
      paymentExpiresAt: expiresAt,
      providerResponse: { channel: "bank_transfer", ...planMeta, ...couponMeta },
    });
    await created.save({ session });
  } catch (e) {
    if (e?.code === 11000) {
      const dupQuery =
        t === "subscription"
          ? { userId: uid, type: t, provider: "transfer", status: "pending" }
          : { userId: uid, type: t, referenceId: rid, provider: "transfer" };
      const dup = await Payment.findOne(dupQuery)
        .select("_id providerRef status")
        .lean();
      if (dup) {
        return {
          ok: true,
          idempotent: true,
          paymentId: String(dup._id),
          providerRef: dup.providerRef,
          status: dup.status,
        };
      }
      return { ok: true, idempotent: true };
    }
    console.error("[recordTransferPending]", e?.message || e);
    return { ok: false, error: e?.message || "Không ghi được bản ghi thanh toán." };
  }
  return {
    ok: true,
    created: true,
    paymentId: String(created._id),
    providerRef: created.providerRef,
    paymentExpiresAt: created.paymentExpiresAt,
  };
}

function normalizeSubscriptionPlanKey(raw) {
  return planKeyFromSubscriptionMeta(raw) || "starter_pro";
}

/** Gói Pro/Elite — chuyển khoản: tạo payment pending + mã PI làm nội dung CK. */
export async function createSubscriptionTransferPending(
  userId,
  { amount, planKey, orderNum, billing, forceNew, couponCode: rawCouponCode },
) {
  if (!isMongoReady()) return { ok: false, status: 503, error: MONGO_ERR };
  if (!mongoose.isValidObjectId(userId)) return { ok: false, status: 401, error: "Phiên không hợp lệ." };
  const ref = String(orderNum || "").trim().slice(0, 100);
  if (!ref) return { ok: false, status: 400, error: "orderNum (mã đơn) bắt buộc." };
  const plan = normalizeSubscriptionPlanKey(planKey);
  const billingCycle = normalizeBillingCycle(billing);
  const catalogAmount = resolveSubscriptionAmount(plan, billingCycle);
  if (!catalogAmount) {
    return { ok: false, status: 400, error: "planKey hoặc billing không hợp lệ." };
  }

  let couponDoc = null;
  let couponCode = "";
  let couponDiscountAmount = 0;
  const trimmedCouponCode = typeof rawCouponCode === "string" ? rawCouponCode.trim() : "";
  if (trimmedCouponCode) {
    const couponCheck = await validateCoupon({
      code: trimmedCouponCode,
      userId,
      type: "subscription",
      amount: catalogAmount,
    });
    if (!couponCheck.ok) return couponCheck;
    couponDoc = couponCheck.coupon;
    couponCode = couponDoc.code;
    couponDiscountAmount = couponCheck.discountAmount;
  }
  const resolvedAmount = Math.max(0, catalogAmount - couponDiscountAmount);

  const clientAmount = Math.round(Number(amount) || 0);
  if (clientAmount > 0 && clientAmount !== resolvedAmount) {
    return { ok: false, status: 400, error: "Số tiền không khớp bảng giá. Vui lòng tải lại trang checkout." };
  }
  const expiresAt = newPaymentExpiresAt();

  let pendingRow = await Payment.findOne({
    userId,
    type: "subscription",
    provider: "transfer",
    status: "pending",
  }).select("_id referenceId providerRef paymentExpiresAt createdAt amount");

  if (pendingRow && forceNew) {
    pendingRow.status = "cancelled";
    pendingRow.failureReason = "user_retry";
    await pendingRow.save();
    pendingRow = null;
  }

  if (pendingRow) {
    const expired = await expireSubscriptionTransferIfNeeded(pendingRow);
    if (expired.expired) pendingRow = null;
    // Không return sớm ở đây dù đơn còn hạn: phải đi tiếp qua recordTransferPending() bên dưới
    // để đồng bộ lại amount/coupon — nếu không, coupon áp SAU khi đơn pending đầu tiên đã tạo sẽ
    // bị bỏ qua (đơn cũ vẫn giữ giá gốc), làm lệch số tiền QR thực trả với Payment.amount đã lưu
    // → SePay không tự đối soát được, admin phải xác nhận tay (đúng lỗi user báo cáo).
  }

  const referenceId = pendingRow
    ? String(pendingRow.referenceId)
    : String(new mongoose.Types.ObjectId());
  const ledger = await recordTransferPending({
    userId,
    type: "subscription",
    referenceModel: "Subscription",
    referenceId,
    amount: resolvedAmount,
    providerRef: ref,
    planKey: plan,
    billing: billingCycle,
    paymentExpiresAt: expiresAt,
    couponCode,
    couponDiscountAmount,
  });
  if (!ledger.ok) return { ok: false, status: 500, error: ledger.error || "Không tạo được giao dịch chờ CK." };
  // Mã giảm giá chỉ claim khi thanh toán THÀNH CÔNG (xem finalizePaymentSuccess), không claim
  // ở đây để tránh khóa mã oan nếu đơn CK này cũng hết hạn mà chưa từng trả tiền.
  return {
    ok: true,
    paymentId: ledger.paymentId,
    providerRef: ledger.providerRef || ref,
    idempotent: Boolean(ledger.idempotent),
    paymentExpiresAt: ledger.paymentExpiresAt || expiresAt,
    amount: resolvedAmount,
  };
}

/** User báo đã CK gói subscription. */
export async function submitSubscriptionTransfer(userId, { paymentId, reference }) {
  if (!isMongoReady()) return { ok: false, status: 503, error: MONGO_ERR };
  if (!mongoose.isValidObjectId(userId) || !mongoose.isValidObjectId(paymentId)) {
    return { ok: false, status: 400, error: "paymentId không hợp lệ." };
  }
  const pay = await Payment.findOne({
    _id: paymentId,
    userId,
    type: "subscription",
    provider: "transfer",
  }).select("_id referenceId status providerRef");
  if (!pay) return { ok: false, status: 404, error: "Không tìm thấy giao dịch gói cước." };
  const refRaw = String(reference ?? pay.providerRef ?? "").trim();
  const meta = await recordTransferSubmitted({
    userId,
    type: "subscription",
    referenceId: pay.referenceId,
    paymentRef: refRaw,
    submittedAt: new Date(),
  });
  if (!meta.ok) return { ok: false, status: meta.missing ? 404 : 400, error: meta.error || "Không lưu được." };
  return { ok: true };
}

/** Admin — danh sách CK gói Pro/Elite chờ đối soát. */
export async function listPendingSubscriptionTransfers() {
  if (!isMongoReady()) return { ok: false, status: 503, error: MONGO_ERR };
  const rows = await Payment.find({
    type: "subscription",
    provider: "transfer",
    status: "pending",
  })
    .populate("userId", "name email plan")
    .sort({ createdAt: -1 })
    .limit(200)
    .lean();
  const paidAgg = await Payment.aggregate([
    { $match: { type: "subscription", provider: "transfer", status: "success" } },
    { $group: { _id: null, count: { $sum: 1 }, totalAmount: { $sum: "$amount" } } },
  ]);
  const paidStats = paidAgg[0] || { count: 0, totalAmount: 0 };

  return {
    ok: true,
    payments: rows.map((p) => {
      const pr =
        p.providerResponse && typeof p.providerResponse === "object" ? p.providerResponse : {};
      const u = p.userId && typeof p.userId === "object" ? p.userId : null;
      return {
        id: String(p._id),
        amount: p.amount,
        providerRef: p.providerRef || "",
        plan: pr.plan === "elite_pro" ? "elite_pro" : "starter_pro",
        status: p.status,
        createdAt: p.createdAt,
        transferSubmittedAt: pr.submittedAt || null,
        paymentRef: pr.paymentRef || "",
        user: u
          ? {
              id: String(u._id),
              name: u.name || "",
              email: u.email || "",
              plan: u.plan || "free",
            }
          : null,
      };
    }),
    stats: {
      paidCount: paidStats.count || 0,
      paidTotalAmount: paidStats.totalAmount || 0,
    },
  };
}

/** Admin xác nhận CK gói — kích hoạt plan trên User. */
export async function confirmSubscriptionTransferByAdmin(paymentId, options = {}) {
  if (!isMongoReady()) return { ok: false, status: 503, error: MONGO_ERR };
  if (!mongoose.isValidObjectId(paymentId)) {
    return { ok: false, status: 400, error: "paymentId không hợp lệ." };
  }
  const force = Boolean(options?.force);
  const forceNote = String(options?.forceNote || "").trim();
  if (force && forceNote.length < 3) {
    return { ok: false, status: 400, error: "Xác nhận ngoại lệ cần lý do (ít nhất 3 ký tự)." };
  }
  const pay = await Payment.findById(paymentId);
  if (!pay || pay.type !== "subscription" || pay.provider !== "transfer") {
    return { ok: false, status: 404, error: "Không tìm thấy giao dịch gói cước CK." };
  }
  if (pay.status === "success") {
    await finalizePaymentSuccess(paymentId);
    const updated = await Payment.findById(paymentId).lean();
    return { ok: true, idempotent: true, payment: updated };
  }
  if (pay.status !== "pending") {
    return { ok: false, status: 400, error: "Giao dịch không ở trạng thái chờ xác nhận." };
  }
  const submitted = pay.providerResponse?.submittedAt;
  if (!force && !submitted) {
    return { ok: false, status: 400, error: "Học viên chưa báo «Đã chuyển khoản»." };
  }
  const ledger = await recordAdminTransferSuccess({
    userId: pay.userId,
    type: "subscription",
    referenceModel: "Subscription",
    referenceId: pay.referenceId,
    amount: pay.amount,
    adminUserId: options?.adminUserId || "",
    forceConfirm: force,
    forceNote,
  });
  if (!ledger.ok && !ledger.idempotent) {
    return { ok: false, status: 500, error: ledger.error || "Không ghi ledger." };
  }
  await finalizePaymentSuccess(paymentId);
  const updated = await Payment.findById(paymentId).lean();
  return { ok: true, payment: updated };
}

/** Admin xác nhận CK học phí khóa — kích hoạt enrollment paid. */
export async function confirmEnrollmentTransferByAdmin(enrollmentId, options = {}) {
  if (!isMongoReady()) return { ok: false, status: 503, error: MONGO_ERR };
  if (!mongoose.isValidObjectId(enrollmentId)) {
    return { ok: false, status: 400, error: "id ghi danh không hợp lệ." };
  }
  const force = Boolean(options?.force);
  const forceNote = String(options?.forceNote || "").trim();
  if (force && forceNote.length < 3) {
    return { ok: false, status: 400, error: "Xác nhận ngoại lệ cần lý do (ít nhất 3 ký tự)." };
  }

  let courseIdForStats = null;
  let claimInfo = null;
  try {
    await runInTransaction(async (session) => {
      const row = await Enrollment.findById(enrollmentId).session(session);
      if (!row) throw new Error("ERR_404");
      if (row.paymentMethod !== "transfer") throw new Error("ERR_METHOD");
      if (row.paymentStatus !== "pending") throw new Error("ERR_STATUS");
      if (!force && !row.transferSubmittedAt) throw new Error("ERR_NO_SUBMIT");

      courseIdForStats = row.courseId;

      const courseAmt = Math.round(Number(row.pricePaid ?? 0));
      if (courseAmt > 0) {
        const ledger = await recordAdminTransferSuccess({
          userId: row.userId,
          type: "course",
          referenceModel: "Enrollment",
          referenceId: row._id,
          amount: courseAmt,
          adminUserId: options?.adminUserId || "",
          forceConfirm: force,
          forceNote,
          session,
        });
        if (!ledger.ok && !ledger.idempotent) {
          throw new Error(`ERR_LEDGER:${ledger.error || "unknown"}`);
        }
      }

      row.paymentStatus = "paid";
      row.paidAt = new Date();
      row.transferConfirmedAt = row.paidAt;
      row.transferConfirmedBy =
        options?.adminUserId && mongoose.isValidObjectId(String(options.adminUserId))
          ? options.adminUserId
          : undefined;
      row.transferForceConfirm = force;
      row.transferForceNote = force ? forceNote.slice(0, 500) : "";
      await row.save({ session });

      if (row.couponCode) {
        claimInfo = { code: row.couponCode, userId: row.userId, referenceId: row._id };
      }
    });
    if (claimInfo) {
      await claimCouponUsageByCode(claimInfo.code, claimInfo.userId, {
        referenceModel: "Enrollment",
        referenceId: claimInfo.referenceId,
      });
    }
  } catch (error) {
    const msg = String(error?.message || "");
    if (msg === "ERR_404") return { ok: false, status: 404, error: "Không tìm thấy ghi danh." };
    if (msg === "ERR_METHOD") {
      return { ok: false, status: 400, error: "Ghi danh này không dùng chuyển khoản." };
    }
    if (msg === "ERR_STATUS") {
      return { ok: false, status: 400, error: "Trạng thái thanh toán không cho phép xác nhận." };
    }
    if (msg === "ERR_NO_SUBMIT") {
      return {
        ok: false,
        status: 400,
        error: "Admin xác nhận thủ công cần force: true (không bắt học viên bấm trong app).",
      };
    }
    if (msg.startsWith("ERR_LEDGER:")) {
      return { ok: false, status: 500, error: "Không thể ghi nhận giao dịch thanh toán." };
    }
    return { ok: false, status: 500, error: error?.message || "Không thể xác nhận thanh toán." };
  }

  if (courseIdForStats) {
    await incrementCourseEnrollmentCount(courseIdForStats);
  }

  // Credit mentor earnings — idempotent (guarded by mentorEarningsCreditedAt).
  // Needed here so SePay auto-confirm path (sepayWebhookService → confirmEnrollmentTransferByAdmin)
  // also credits the mentor; adminController calls this again but it becomes a no-op.
  await tryCreditMentorForPaidEnrollment(enrollmentId).catch((e) =>
    console.error("[confirmEnrollmentTransferByAdmin] mentor credit:", e?.message || e),
  );

  const enrollment = await Enrollment.findById(enrollmentId).lean();
  return { ok: true, enrollment };
}

/**
 * User bấm “Tôi đã chuyển khoản” → lưu metadata vào payment transfer pending.
 * (Không đổi status; admin sẽ xác nhận sau.)
 */
export async function recordTransferSubmitted({ userId, type, referenceId, paymentRef, submittedAt, session = null }) {
  if (!isMongoReady()) return { ok: false, error: MONGO_ERR };
  if (!mongoose.isValidObjectId(userId) || !mongoose.isValidObjectId(referenceId)) {
    return { ok: false, error: "Tham chiếu không hợp lệ." };
  }
  const uid = new mongoose.Types.ObjectId(String(userId));
  const rid = new mongoose.Types.ObjectId(String(referenceId));
  const t = String(type || "").toLowerCase();
  if (!["booking", "course", "subscription"].includes(t)) {
    return { ok: false, error: "type phải là booking, course hoặc subscription." };
  }

  const ref = typeof paymentRef === "string" ? paymentRef.trim().slice(0, 200) : "";
  const at = submittedAt instanceof Date ? submittedAt : new Date();

  const row = await Payment.findOne({
    userId: uid,
    type: t,
    referenceId: rid,
    provider: "transfer",
  }).session(session);

  if (!row) return { ok: false, missing: true, error: "Không tìm thấy giao dịch CK trong ledger." };
  if (row.status !== "pending") return { ok: true, noop: true, status: row.status };

  const prev = row.providerResponse && typeof row.providerResponse === "object" ? row.providerResponse : {};
  row.providerResponse = {
    ...prev,
    channel: "bank_transfer",
    submittedAt: at,
    paymentRef: ref,
  };
  await row.save({ session });
  return { ok: true };
}

export async function listPaymentHistory(userId, limit = 50) {
  if (!isMongoReady()) return { ok: false, status: 503, error: MONGO_ERR };
  const lim = Math.min(100, Math.max(1, Number(limit) || 50));
  const rows = await Payment.find({ userId })
    .sort({ createdAt: -1 })
    .limit(lim)
    .lean();
  return {
    ok: true,
    payments: rows.map((p) => ({
      id: String(p._id),
      type: p.type,
      referenceModel: p.referenceModel,
      amount: p.amount,
      currency: p.currency,
      provider: p.provider,
      status: p.status,
      referenceId: String(p.referenceId),
      providerRef: p.providerRef,
      createdAt: p.createdAt,
      paidAt: p.paidAt,
    })),
  };
}

async function applySubscriptionPlanFromPayment(pay) {
  if (!pay || pay.type !== "subscription") return;
  const plan = pay.providerResponse?.plan === "elite_pro" ? "elite_pro" : "starter_pro";
  const billing = pay.providerResponse?.billing === "yearly" ? "yearly" : "monthly";
  const planExpiresAt = new Date();
  if (billing === "yearly") {
    planExpiresAt.setFullYear(planExpiresAt.getFullYear() + 1);
  } else {
    planExpiresAt.setMonth(planExpiresAt.getMonth() + 1);
  }
  // Lượt dùng refresh mỗi tháng trong suốt kỳ hạn — quan trọng với gói năm (planExpiresAt xa
  // nhưng vẫn phải cấp lại quota hàng tháng theo đúng quảng cáo "/tháng" ở trang giá).
  const nextQuotaReset = new Date();
  nextQuotaReset.setMonth(nextQuotaReset.getMonth() + 1);
  const quota =
    plan === "elite_pro"
      ? { cvAnalysisLimit: 30, interviewLimit: 8, interviewQuestionsAllowed: 5 }
      : { cvAnalysisLimit: 10, interviewLimit: 3, interviewQuestionsAllowed: 5 };
  await User.findByIdAndUpdate(pay.userId, {
    $set: {
      plan,
      planExpiresAt,
      "quota.cvAnalysisLimit":           quota.cvAnalysisLimit,
      "quota.cvAnalysisUsed":            0,
      "quota.interviewLimit":            quota.interviewLimit,
      "quota.interviewUsed":             0,
      "quota.interviewQuestionsAllowed": quota.interviewQuestionsAllowed,
      "quota.resetAt":                   nextQuotaReset,
    },
  });
}

async function finalizePaymentSuccess(paymentId) {
  const pay = await Payment.findById(paymentId);
  if (!pay) return { ok: false };
  const alreadySuccess = pay.status === "success";

  if (!alreadySuccess) {
    pay.status = "success";
    pay.paidAt = new Date();
    await pay.save();
  }

  if (pay.type === "booking" && pay.referenceModel === "Booking") {
    const booking = await Booking.findByIdAndUpdate(
      pay.referenceId,
      { $set: { paymentStatus: "paid", status: "confirmed", paidAt: new Date() } },
      { new: true },
    )
      .select("_id userId mentorId date timeSlot")
      .lean();
    if (booking && !alreadySuccess) {
      const mentor = await Mentor.findById(booking.mentorId).select("userId").lean();
      const student = await User.findById(booking.userId).select("name").lean();
      if (mentor?.userId) {
        await deliverNotification(mentor.userId, {
          mentorPrefKey: "booking_request",
          type: "booking_confirmed",
          title: "Buổi mentor đã được thanh toán",
          body: `${student?.name || "Học viên"} — ${booking.date} ${booking.timeSlot} đã thanh toán thành công.`,
          metadata: {
            bookingId: booking._id,
            actionUrl: `/mentor/meeting-detail/${booking._id}`,
          },
        });
      }
    }
  }
  if (pay.type === "course" && pay.referenceModel === "Enrollment") {
    const enrollment = await Enrollment.findByIdAndUpdate(
      pay.referenceId,
      { $set: { paymentStatus: "paid", paidAt: new Date() } },
      { new: true },
    );
    if (enrollment) {
      await tryCreditMentorForPaidEnrollment(String(pay.referenceId));
      await incrementCourseEnrollmentCount(enrollment.courseId);
      if (enrollment.couponCode) {
        await claimCouponUsageByCode(enrollment.couponCode, enrollment.userId, {
          referenceModel: "Enrollment",
          referenceId: enrollment._id,
        });
      }
    }
  }
  if (pay.type === "subscription") {
    await applySubscriptionPlanFromPayment(pay);
    const couponCode = pay.providerResponse?.couponCode;
    if (couponCode) {
      await claimCouponUsageByCode(couponCode, pay.userId, {
        referenceModel: "Subscription",
        referenceId: pay.referenceId,
      });
    }
  }
  return { ok: true, already: alreadySuccess };
}

async function finalizePaymentFailure(paymentId, reason = "Thanh toán thất bại từ cổng thanh toán.") {
  const pay = await Payment.findById(paymentId);
  if (!pay) return { ok: false };
  if (pay.status === "success" || pay.status === "failed") return { ok: true, already: true };

  pay.status = "failed";
  pay.failureReason = reason;
  await pay.save();

  if (pay.type === "booking" && pay.referenceModel === "Booking") {
    await Booking.findByIdAndUpdate(pay.referenceId, {
      $set: { paymentStatus: "failed" },
    });
  }
  return { ok: true };
}

export async function handleWebhookMomo(reqBody, headerSecret) {
  const secret = webhookSecret();
  if (!secret) return { ok: false, status: 503, error: "Chưa cấu hình PAYMENT_WEBHOOK_SECRET." };
  if (!timingSafeStringEqual(headerSecret, secret)) return { ok: false, status: 401, error: "Unauthorized" };

  const paymentId = reqBody?.paymentId || reqBody?.orderId;
  if (!paymentId || !mongoose.isValidObjectId(paymentId)) {
    return { ok: false, status: 400, error: "Thiếu paymentId hợp lệ." };
  }
  const r = await finalizePaymentSuccess(paymentId);
  if (!r.ok) return { ok: false, status: 404, error: "Không tìm thấy payment." };
  return { ok: true };
}

export async function handleWebhookZalopay(reqBody, headerSecret) {
  return handleWebhookMomo(reqBody, headerSecret);
}

export async function handleIpnVnpay(vnp_Params) {
  const params = { ...(vnp_Params ?? {}) };
  const secureHash = params["vnp_SecureHash"];
  if (!secureHash) {
    return { ok: false, status: 400, data: { RspCode: "99", Message: "Missing signature" } };
  }
  const secretKey = process.env.VNP_HASH_SECRET;
  if (!secretKey) {
    return { ok: false, status: 503, data: { RspCode: "99", Message: "Gateway secret missing" } };
  }

  delete params["vnp_SecureHash"];
  delete params["vnp_SecureHashType"];

  const sortedKeys = Object.keys(params).sort();
  let signData = "";
  for (let i = 0; i < sortedKeys.length; i++) {
    const key = sortedKeys[i];
    const val = params[key];
    if (val !== undefined && val !== null && val !== "") {
      if (signData.length > 0) signData += "&";
      signData += encodeURIComponent(key) + "=" + encodeURIComponent(val).replace(/%20/g, "+");
    }
  }

  const hmac = crypto.createHmac("sha512", secretKey);
  const signed = hmac.update(Buffer.from(signData, "utf-8")).digest("hex");
  if (secureHash.toUpperCase() !== signed.toUpperCase()) {
    return { ok: false, status: 400, data: { RspCode: "97", Message: "Checksum failed" } };
  }

  const txnRef = params["vnp_TxnRef"];
  const rspCode = params["vnp_ResponseCode"];
  const txnStatus = params["vnp_TransactionStatus"];
  const amountRaw = Number(params["vnp_Amount"]);
  const amount = Number.isFinite(amountRaw) ? Math.round(amountRaw / 100) : NaN;

  const pay = await Payment.findOne({ providerRef: txnRef });
  if (!pay) {
    return { ok: true, data: { RspCode: "01", Message: "Order not found" } };
  }

  const expectedAmount = Math.round(Number(pay.amount) || 0);
  if (!Number.isFinite(amount) || amount !== expectedAmount) {
    return { ok: true, data: { RspCode: "04", Message: "Invalid amount" } };
  }

  if (pay.status === "success") {
    return { ok: true, data: { RspCode: "02", Message: "Order already confirmed" } };
  }

  if (rspCode === "00" && txnStatus === "00") {
    await finalizePaymentSuccess(pay._id);
    return { ok: true, data: { RspCode: "00", Message: "Success" } };
  }

  await finalizePaymentFailure(
    pay._id,
    `VNPay failed with responseCode=${rspCode || "unknown"}, transactionStatus=${txnStatus || "unknown"}`,
  );
  return { ok: true, data: { RspCode: "00", Message: "Confirm Success (Transaction Failed)" } };
}
