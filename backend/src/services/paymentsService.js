import crypto from "node:crypto";
import mongoose from "mongoose";
import { Payment } from "../models/Payment.js";
import { Booking } from "../models/Booking.js";
import { User } from "../models/User.js";

const MONGO_ERR = "MongoDB chưa kết nối. Kiểm tra MONGO_URI trong .env.";

function isMongoReady() {
  return mongoose.connection.readyState === 1;
}

function webhookSecret() {
  return typeof process.env.PAYMENT_WEBHOOK_SECRET === "string" ? process.env.PAYMENT_WEBHOOK_SECRET.trim() : "";
}

/**
 * Khởi tạo thanh toán (stub sandbox): tạo bản ghi Payment + trả metadata để FE mở cổng sau này.
 * Hiện tại: không gọi MoMo/ZaloPay thật — `mock: true`.
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
    amount = Number.isFinite(amount) && amount > 0 ? Math.round(amount) : Math.round(b.totalAmount ?? b.price ?? 0);
    referenceId = b._id;
  } else if (type === "subscription") {
    if (!Number.isFinite(amount) || amount <= 0) {
      return { ok: false, status: 400, error: "amount bắt buộc khi type=subscription." };
    }
    amount = Math.round(amount);
    referenceId = new mongoose.Types.ObjectId(String(userId));
    referenceModel = "Subscription";
    const rawPlan = String(body?.planKey ?? body?.plan ?? "starter_pro").toLowerCase();
    const subscriptionPlan = rawPlan.includes("elite") ? "elite_pro" : "starter_pro";
    providerResponse = { plan: subscriptionPlan };
  } else {
    return { ok: false, status: 400, error: "type phải là booking hoặc subscription." };
  }

  const providerRef = `pi_${crypto.randomUUID().replace(/-/g, "")}`;

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
  const payUrl = `${base}/#/checkout?paymentId=${pay._id.toString()}&mock=1`;

  return {
    ok: true,
    paymentId: pay._id.toString(),
    providerRef,
    payUrl,
    qrBase64: null,
    deepLink: null,
    mock: true,
    message: "Sandbox: chưa gọi MoMo/ZaloPay API. Dùng payUrl để quay lại FE hoặc webhook để xác nhận.",
  };
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

async function finalizePaymentSuccess(paymentId) {
  const pay = await Payment.findById(paymentId);
  if (!pay || pay.status === "success") return { ok: pay ? true : false, already: pay?.status === "success" };

  pay.status = "success";
  pay.paidAt = new Date();
  await pay.save();

  if (pay.type === "booking" && pay.referenceModel === "Booking") {
    await Booking.findByIdAndUpdate(pay.referenceId, {
      $set: { paymentStatus: "paid", status: "confirmed", paidAt: new Date() },
    });
  }
  if (pay.type === "subscription") {
    const plan = pay.providerResponse?.plan === "elite_pro" ? "elite_pro" : "starter_pro";
    const planExpiresAt = new Date();
    planExpiresAt.setMonth(planExpiresAt.getMonth() + 1);
    const quota =
      plan === "elite_pro"
        ? { cvAnalysisLimit: 999, interviewLimit: 999 }
        : { cvAnalysisLimit: 20, interviewLimit: 10 };
    await User.findByIdAndUpdate(pay.userId, {
      $set: {
        plan,
        planExpiresAt,
        "quota.cvAnalysisLimit": quota.cvAnalysisLimit,
        "quota.interviewLimit": quota.interviewLimit,
      },
    });
  }
  return { ok: true };
}

export async function handleWebhookMomo(reqBody, headerSecret) {
  const secret = webhookSecret();
  if (!secret) return { ok: false, status: 503, error: "Chưa cấu hình PAYMENT_WEBHOOK_SECRET." };
  if (headerSecret !== secret) return { ok: false, status: 401, error: "Unauthorized" };

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
