import crypto from "node:crypto";
import mongoose from "mongoose";
import { Booking } from "../models/Booking.js";
import { Course } from "../models/Course.js";
import { Enrollment } from "../models/Enrollment.js";
import { Payment } from "../models/Payment.js";
import { SepayWebhookEvent } from "../models/SepayWebhookEvent.js";
import { enrollmentAccessGranted } from "../helpers/enrollmentAccess.js";
import {
  extractOrderPart,
  normalizePiOrderRef,
  orderRefsMatch,
  parsePiOrderFromText,
} from "../utils/orderRef.js";
import {
  confirmEnrollmentTransferByAdmin,
  confirmSubscriptionTransferByAdmin,
} from "./paymentsService.js";
import { confirmBankTransferPaymentByAdmin } from "./bookingsService.js";
import {
  isTransferPaymentExpired,
  transferPaymentExpiryMeta,
  TRANSFER_PAYMENT_TIMEOUT_MINUTES,
  TRANSFER_PAYMENT_TIMEOUT_MS,
} from "../utils/transferPaymentExpiry.js";
import {
  expireBookingTransferIfNeeded,
  expireEnrollmentTransferIfNeeded,
  expireSubscriptionTransferIfNeeded,
} from "./transferPaymentExpiryService.js";

const MONGO_ERR = "MongoDB chưa kết nối. Kiểm tra MONGO_URI trong .env.";

function isMongoReady() {
  return mongoose.connection.readyState === 1;
}

function getSepayApiKey() {
  return String(process.env.SEPAY_WEBHOOK_API_KEY || process.env.SEPAY_API_KEY || "").trim();
}

export function verifySepayAuthorization(headerValue) {
  const expected = getSepayApiKey();
  if (!expected) return false;
  const raw = String(headerValue || "").trim();
  if (!raw) return false;
  const match = raw.match(/^Apikey\s+(.+)$/i);
  const token = match ? match[1].trim() : raw;
  const ta = Buffer.from(token, "utf8");
  const tb = Buffer.from(expected, "utf8");
  if (ta.length !== tb.length) return false;
  return crypto.timingSafeEqual(ta, tb);
}

function amountsMatch(expected, received) {
  const e = Math.round(Number(expected) || 0);
  const r = Math.round(Number(received) || 0);
  if (e <= 0 || r <= 0) return false;
  return e === r;
}

function expectedBookingAmount(booking) {
  return Math.round(Number(booking.totalAmount ?? booking.price ?? 0));
}

async function findPendingTargets(orderRef) {
  const norm = normalizePiOrderRef(orderRef);
  if (!norm) return [];

  const targets = [];

  // Only fetch bookings within 2× the payment timeout window — anything older is certainly expired.
  const activeSince = new Date(Date.now() - 2 * TRANSFER_PAYMENT_TIMEOUT_MS);
  const bookings = await Booking.find({
    paymentMethod: "transfer",
    paymentStatus: "pending",
    createdAt: { $gt: activeSince },
  })
    .select("_id userId paymentRef totalAmount price paymentExpiresAt createdAt")
    .lean();

  // Group bookings by (paymentRef, userId) to prevent cross-user ref collision inflating
  // the expected amount and blocking the legitimate user's auto-confirm.
  const bookingGroupMap = new Map(); // `${norm}::${userId}` -> [booking]
  for (const b of bookings) {
    if (isTransferPaymentExpired(b)) continue;
    if (orderRefsMatch(b.paymentRef, norm)) {
      const groupKey = `${norm}::${String(b.userId)}`;
      if (!bookingGroupMap.has(groupKey)) bookingGroupMap.set(groupKey, []);
      bookingGroupMap.get(groupKey).push(b);
    }
  }
  for (const group of bookingGroupMap.values()) {
    const totalExpected = group.reduce((sum, b) => sum + expectedBookingAmount(b), 0);
    if (group.length === 1) {
      const b = group[0];
      targets.push({
        entityType: "booking",
        entityId: String(b._id),
        entityIds: [String(b._id)],
        userId: String(b.userId),
        expectedAmount: totalExpected,
        transferSubmittedAt: b.transferSubmittedAt ?? null,
      });
    } else {
      // Multi-slot: one transfer covers all bookings in the group.
      targets.push({
        entityType: "booking_group",
        entityId: String(group[0]._id),
        entityIds: group.map((b) => String(b._id)),
        userId: String(group[0].userId),
        expectedAmount: totalExpected,
        transferSubmittedAt: group[0].transferSubmittedAt ?? null,
      });
    }
  }

  const enrollments = await Enrollment.find({
    paymentMethod: "transfer",
    paymentStatus: "pending",
  })
    .select("_id userId paymentRef pricePaid transferSubmittedAt courseId paymentExpiresAt createdAt")
    .lean();
  const courseIds = enrollments.map((e) => e.courseId).filter(Boolean);
  const courseRows =
    courseIds.length > 0
      ? await Course.find({ _id: { $in: courseIds } })
          .select("price")
          .lean()
      : [];
  const priceByCourseId = new Map(
    courseRows.map((c) => [String(c._id), Math.round(Number(c.price ?? 0))]),
  );
  for (const e of enrollments) {
    if (isTransferPaymentExpired(e)) continue;
    if (orderRefsMatch(e.paymentRef, norm)) {
      const fromCourse = priceByCourseId.get(String(e.courseId)) ?? 0;
      const pricePaid = Math.round(Number(e.pricePaid ?? 0));
      const expectedAmount = pricePaid > 0 ? pricePaid : fromCourse;
      targets.push({
        entityType: "course",
        entityId: String(e._id),
        userId: String(e.userId),
        expectedAmount,
        transferSubmittedAt: e.transferSubmittedAt ?? null,
        courseId: e.courseId ? String(e.courseId) : "",
      });
    }
  }

  const payments = await Payment.find({
    type: "subscription",
    provider: "transfer",
    status: "pending",
  })
    .select("_id userId amount providerRef providerResponse paymentExpiresAt createdAt")
    .lean();
  for (const p of payments) {
    if (isTransferPaymentExpired(p)) continue;
    const ref = p.providerRef || p.providerResponse?.paymentRef || "";
    if (orderRefsMatch(ref, norm)) {
      targets.push({
        entityType: "subscription",
        entityId: String(p._id),
        userId: String(p.userId),
        expectedAmount: Math.round(Number(p.amount ?? 0)),
        transferSubmittedAt: p.providerResponse?.submittedAt ?? null,
      });
    }
  }

  return targets;
}

async function upsertSepayLog(sepayId, patch) {
  await SepayWebhookEvent.findOneAndUpdate(
    { sepayId },
    { $set: patch },
    { upsert: true, new: true },
  );
}

async function autoConfirmTarget(target, { sepayId, amount }) {
  const forceNote = `SePay webhook #${sepayId} amount=${amount}`;
  const opts = { force: true, forceNote, adminUserId: "" };

  if (target.entityType === "booking") {
    return confirmBankTransferPaymentByAdmin(target.entityId, opts);
  }
  if (target.entityType === "booking_group") {
    // _skipSiblingConfirm: outer loop already covers all entityIds — no need for each booking
    // to re-scan and confirm its siblings (D3).
    // Don't fail-fast: treat ERR_ALREADY_PAID as idempotent success; collect other errors (D2).
    const groupOpts = { ...opts, _skipSiblingConfirm: true };
    const errors = [];
    for (const id of target.entityIds) {
      const res = await confirmBankTransferPaymentByAdmin(id, groupOpts);
      if (!res.ok && !String(res.error || "").includes("đã thanh toán")) {
        errors.push(res.error || "lỗi không xác định");
      }
    }
    if (errors.length > 0) {
      return { ok: false, error: `Một số slot không xác nhận được: ${errors.join("; ")}` };
    }
    return { ok: true };
  }
  if (target.entityType === "course") {
    return confirmEnrollmentTransferByAdmin(target.entityId, opts);
  }
  if (target.entityType === "subscription") {
    return confirmSubscriptionTransferByAdmin(target.entityId, opts);
  }
  return { ok: false, status: 400, error: "Loại đơn không hỗ trợ." };
}

/**
 * Webhook SePay — chỉ xử lý tiền vào (`transferType: in`).
 * Trả HTTP 200 + `{ success: true }` khi nhận hợp lệ (kể cả không khớp đơn).
 */
export async function handleSepayWebhook(body, authHeader) {
  if (!isMongoReady()) return { ok: false, status: 503, error: MONGO_ERR };
  if (!verifySepayAuthorization(authHeader)) {
    return { ok: false, status: 401, error: "Unauthorized" };
  }

  const payload = body && typeof body === "object" ? body : {};
  const sepayId = String(payload.id ?? payload.transactionId ?? "").trim();
  if (!sepayId) {
    return { ok: false, status: 400, error: "Thiếu id giao dịch SePay." };
  }

  const existing = await SepayWebhookEvent.findOne({ sepayId }).lean();
  if (existing?.status === "processed" || existing?.status === "received") {
    return { ok: true, idempotent: true, sepayId };
  }

  const transferType = String(payload.transferType ?? payload.transfer_type ?? "in").toLowerCase();
  if (transferType && transferType !== "in") {
    await upsertSepayLog(sepayId, {
      status: "ignored",
      transferType,
      rawPayload: payload,
      resultMessage: "outgoing transfer ignored",
    });
    return { ok: true, ignored: true };
  }

  const amount = Math.round(Number(payload.transferAmount ?? payload.amount ?? 0));
  const orderRef = parsePiOrderFromText(
    payload.content,
    payload.code,
    payload.description,
    payload.referenceCode,
    payload.transactionContent,
  );

  await upsertSepayLog(sepayId, {
    transferType: transferType || "in",
    transferAmount: amount,
    orderRef: orderRef || "",
    rawPayload: payload,
    status: "received",
  });

  if (!orderRef) {
    await upsertSepayLog(sepayId, {
      status: "unmatched",
      resultMessage: "no PI order ref in transfer content",
    });
    return { ok: true, unmatched: true, reason: "no_order_ref" };
  }

  const targets = await findPendingTargets(orderRef);
  const matched = targets.filter((t) => amountsMatch(t.expectedAmount, amount));

  if (matched.length === 0) {
    await upsertSepayLog(sepayId, {
      status: "unmatched",
      orderRef,
      resultMessage: targets.length
        ? `amount mismatch (got ${amount}, candidates ${targets.length})`
        : "no pending order for ref",
    });
    return { ok: true, unmatched: true, reason: "no_match", orderRef };
  }

  if (matched.length > 1) {
    await upsertSepayLog(sepayId, {
      status: "unmatched",
      orderRef,
      resultMessage: `ambiguous: ${matched.length} pending orders`,
    });
    return { ok: true, unmatched: true, reason: "ambiguous", orderRef };
  }

  const target = matched[0];
  const confirm = await autoConfirmTarget(target, { sepayId, amount });
  if (!confirm.ok) {
    await upsertSepayLog(sepayId, {
      status: "failed",
      orderRef,
      entityType: target.entityType,
      entityId: target.entityId,
      resultMessage: confirm.error || "confirm failed",
    });
    return { ok: true, confirmed: false, error: confirm.error, orderRef };
  }

  await upsertSepayLog(sepayId, {
    status: "processed",
    orderRef,
    entityType: target.entityType,
    entityId: target.entityId,
    resultMessage: target.entityType === "booking_group"
      ? `auto confirmed group (${target.entityIds.length} bookings)`
      : "auto confirmed",
  });

  return {
    ok: true,
    confirmed: true,
    orderRef,
    entityType: target.entityType,
    entityId: target.entityId,
  };
}

function mapEntityStatus(entityType, doc) {
  if (entityType === "booking") {
    if (doc.paymentStatus === "paid") return "paid";
    if (String(doc.status || "").toLowerCase() === "cancelled" && doc.paymentStatus === "failed") {
      return "expired";
    }
    if (doc.transferSubmittedAt) return "submitted";
    return "pending";
  }
  if (entityType === "course") {
    if (doc.paymentStatus === "paid" || enrollmentAccessGranted(doc)) return "paid";
    if (doc.transferSubmittedAt) return "submitted";
    return "pending";
  }
  if (entityType === "subscription") {
    if (doc.status === "success") return "paid";
    if (doc.status === "cancelled") return "expired";
    if (doc.providerResponse?.submittedAt) return "submitted";
    return "pending";
  }
  return "pending";
}

function statusPayload(doc, entityType, entityId, orderRef, extra = {}) {
  const expiry = transferPaymentExpiryMeta(doc);
  const status = expiry.expired ? "expired" : mapEntityStatus(entityType, doc);
  return {
    ok: true,
    orderRef,
    status,
    entityType,
    entityId,
    paymentExpiresAt: expiry.paymentExpiresAt,
    expiresInMs: expiry.expiresInMs,
    timeoutMinutes: TRANSFER_PAYMENT_TIMEOUT_MINUTES,
    redirectTo: status === "paid" ? buildRedirect(entityType, doc) : null,
    ...extra,
  };
}

function buildRedirect(entityType, doc) {
  if (entityType === "booking" && doc?._id) {
    return `/session/${encodeURIComponent(String(doc._id))}`;
  }
  if (entityType === "course" && doc?.courseId) {
    return `/courses/${encodeURIComponent(String(doc.courseId))}/learn`;
  }
  if (entityType === "subscription") return "/dashboard?planUpgraded=1";
  return "/dashboard";
}

/** Poll trạng thái CK theo mã PI — chỉ đơn thuộc user đăng nhập. */
export async function getTransferStatusForUser(userId, orderRefRaw) {
  if (!isMongoReady()) return { ok: false, status: 503, error: MONGO_ERR };
  if (!mongoose.isValidObjectId(userId)) {
    return { ok: false, status: 401, error: "Phiên không hợp lệ." };
  }
  const orderRef = normalizePiOrderRef(orderRefRaw);
  if (!orderRef) {
    return { ok: false, status: 400, error: "orderRef (mã PI) không hợp lệ." };
  }

  const uid = new mongoose.Types.ObjectId(userId);

  const bookings = await Booking.find({
    userId: uid,
    paymentMethod: "transfer",
  })
    .select("_id paymentRef paymentStatus transferSubmittedAt transferForceConfirm totalAmount price paymentExpiresAt createdAt status")
    .sort({ createdAt: 1 })
    .limit(50)
    .lean();

  // Collect all live bookings matching this orderRef (multi-slot orders share one paymentRef).
  const matchingLive = [];
  for (const b of bookings) {
    if (orderRefsMatch(b.paymentRef, orderRef)) {
      const live = await Booking.findById(b._id);
      if (live) {
        await expireBookingTransferIfNeeded(live);
        matchingLive.push(live);
      }
    }
  }

  if (matchingLive.length > 0) {
    const bookingIds = matchingLive.map((b) => String(b._id));
    if (matchingLive.length === 1) {
      const live = matchingLive[0];
      const status = mapEntityStatus("booking", live);
      return statusPayload(live, "booking", String(live._id), orderRef, {
        sepayAuto: Boolean(live.transferForceConfirm && status === "paid"),
        bookingIds,
      });
    }
    // Multi-slot: ALL bookings must be paid before redirecting.
    const allPaid = matchingLive.every((b) => b.paymentStatus === "paid");
    if (allPaid) {
      const first = matchingLive[0];
      return statusPayload(first, "booking", String(first._id), orderRef, {
        sepayAuto: Boolean(first.transferForceConfirm),
        bookingIds,
      });
    }
    // Return status from one still-pending booking so FE knows to keep waiting.
    const pending = matchingLive.find((b) => b.paymentStatus === "pending") ?? matchingLive[0];
    return statusPayload(pending, "booking", String(pending._id), orderRef, {
      sepayAuto: false,
      bookingIds,
    });
  }

  const enrollments = await Enrollment.find({ userId: uid, paymentMethod: "transfer" })
    .select("_id paymentRef paymentStatus transferSubmittedAt courseId transferForceConfirm paymentExpiresAt createdAt")
    .sort({ createdAt: -1 })
    .limit(20)
    .lean();

  for (const e of enrollments) {
    if (orderRefsMatch(e.paymentRef, orderRef)) {
      const live = await Enrollment.findById(e._id);
      if (live) {
        const expired = await expireEnrollmentTransferIfNeeded(live);
        if (expired.expired) {
          return {
            ok: true,
            orderRef,
            status: "expired",
            entityType: "course",
            entityId: String(e._id),
            redirectTo: null,
            sepayAuto: false,
            paymentExpiresAt: transferPaymentExpiryMeta(e).paymentExpiresAt,
            expiresInMs: 0,
            timeoutMinutes: TRANSFER_PAYMENT_TIMEOUT_MINUTES,
          };
        }
        const status = mapEntityStatus("course", live);
        return statusPayload(live, "course", String(live._id), orderRef, {
          sepayAuto: Boolean(live.transferForceConfirm && status === "paid"),
        });
      }
    }
  }

  const payments = await Payment.find({
    userId: uid,
    type: "subscription",
    provider: "transfer",
  })
    .select("_id providerRef status providerResponse paymentExpiresAt createdAt")
    .sort({ createdAt: -1 })
    .limit(10)
    .lean();

  for (const p of payments) {
    const ref = extractOrderPart(p.providerRef || p.providerResponse?.paymentRef || "");
    if (orderRefsMatch(ref, orderRef)) {
      const live = await Payment.findById(p._id);
      if (live) {
        const expired = await expireSubscriptionTransferIfNeeded(live);
        if (expired.expired) {
          return statusPayload(live, "subscription", String(live._id), orderRef, {
            redirectTo: null,
            sepayAuto: false,
          });
        }
        const status = mapEntityStatus("subscription", live);
        return statusPayload(live, "subscription", String(live._id), orderRef, {
          sepayAuto: status === "paid",
        });
      }
    }
  }

  return {
    ok: true,
    orderRef,
    status: "not_found",
    entityType: null,
    entityId: null,
    redirectTo: null,
    paymentExpiresAt: null,
    expiresInMs: 0,
    timeoutMinutes: TRANSFER_PAYMENT_TIMEOUT_MINUTES,
  };
}
