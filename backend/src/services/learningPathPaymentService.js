/**
 * Thanh toán lộ trình bằng chuyển khoản (LP-10), tái dùng đường ray CK + SePay (quyết định 1):
 *
 *   ứng viên chấp nhận (pending_payment) → POST /:id/checkout: sinh mã PI (`utils/orderRef.js`),
 *   Payment `learning_path` pending (`recordTransferPending`), hết hạn sau TRANSFER_PAYMENT_TIMEOUT_MINUTES
 *   → (tùy chọn) PATCH /:id/submit-transfer
 *   → SePay webhook khớp mã PI + đúng số tiền (`sepayWebhookService.findPendingTargets`)
 *     hoặc admin xác nhận tay (LP-11) → `confirmLearningPathTransfer` → lộ trình `active`.
 *
 * Một lộ trình chỉ có 1 bản ghi Payment CK (unique {provider, type, referenceId}). Hết hạn thì Payment
 * `cancelled`, lộ trình vẫn `pending_payment`; thanh toán lại dùng lại bản ghi đó với mã PI mới.
 * Booking từng buổi không tạo Payment riêng (`paymentMethod: "learning_path"`, LP-04).
 */
import mongoose from "mongoose";
import { LearningPath } from "../models/LearningPath.js";
import { Payment } from "../models/Payment.js";
import { Mentor } from "../models/Mentor.js";
import { User } from "../models/User.js";
import { httpError } from "../utils/apiErrors.js";
import { generatePiOrderRef } from "../utils/orderRef.js";
import {
  newPaymentExpiresAt,
  transferPaymentExpiryMeta,
} from "../utils/transferPaymentExpiry.js";
import { runInTransaction } from "../helpers/dbHelper.js";
import { recordAdminTransferSuccess, recordTransferPending, recordTransferSubmitted } from "./paymentsService.js";
import { expireLearningPathTransferIfNeeded } from "./transferPaymentExpiryService.js";
import { deliverNotification } from "./notificationDeliveryService.js";
import { learningPathDTO, loadPathForCandidate } from "./learningPathsService.js";

export const LEARNING_PATH_PAYMENT_TYPE = "learning_path";
/** Lộ trình đã thanh toán xong (dùng để trả idempotent). */
const PAID_PATH_STATUSES = ["active", "completed"];
/** Giao dịch đang đối soát / hoàn tiền: không tự mở lại, không tự xác nhận. */
const LOCKED_PAYMENT_STATUSES = ["held_inactive_account", "refund_pending", "refunded", "partial_refund"];

function ledgerFilter(pathId) {
  return { type: LEARNING_PATH_PAYMENT_TYPE, provider: "transfer", referenceId: pathId };
}

/** Thông tin CK trả cho ứng viên để hiện QR (giống `serializeCartOrder`). */
function paymentDTO(payment) {
  const expiry = transferPaymentExpiryMeta(payment);
  const submittedAt = payment.providerResponse?.submittedAt ?? null;
  let status = "pending";
  if (payment.status === "success") status = "paid";
  else if (payment.status === "cancelled" || expiry.expired) status = "expired";
  else if (submittedAt) status = "submitted";
  return {
    paymentId: String(payment._id),
    orderRef: payment.providerRef,
    amount: payment.amount,
    status,
    submittedAt,
    paymentExpiresAt: expiry.paymentExpiresAt,
    expiresInMs: expiry.expiresInMs,
    timeoutMinutes: expiry.timeoutMinutes,
  };
}

/**
 * Ứng viên bấm thanh toán: pending_payment → tạo (hoặc trả lại) giao dịch CK trọn gói `totalAmount`.
 * - Giao dịch còn hạn: trả lại đúng mã PI cũ, không gia hạn (QR ứng viên đang mở vẫn đúng).
 * - Chưa có / đã hết hạn: sinh mã PI mới. Mã ghi vào `LearningPath.paymentRef` bằng compare-and-set,
 *   nên hai lần bấm cùng lúc chỉ một lần sinh mã (lần kia nhận 409 rồi tải lại).
 */
export async function checkoutLearningPath(actor, pathId) {
  const path = await loadPathForCandidate(actor, pathId);
  if (PAID_PATH_STATUSES.includes(path.status)) throw httpError(409, "Lộ trình đã được thanh toán.");
  if (path.status !== "pending_payment") {
    throw httpError(409, "Chỉ thanh toán được sau khi bạn chấp nhận lộ trình.");
  }
  const amount = path.totalAmount;
  if (!Number.isInteger(amount) || amount <= 0) {
    throw httpError(409, "Giá lộ trình không hợp lệ. Liên hệ hỗ trợ để được kiểm tra.");
  }

  let payment = await Payment.findOne(ledgerFilter(path._id));
  if (payment) {
    if (payment.status === "success") {
      throw httpError(409, "Lộ trình đã được ghi nhận thanh toán, đang kích hoạt. Vui lòng tải lại trang sau ít phút.");
    }
    if (LOCKED_PAYMENT_STATUSES.includes(payment.status)) {
      throw httpError(409, "Giao dịch của lộ trình đang được đối soát. Vui lòng liên hệ hỗ trợ.");
    }
    if (payment.status === "pending") {
      await expireLearningPathTransferIfNeeded(payment);
      if (payment.status === "pending" && payment.providerRef === path.paymentRef) {
        return { learningPath: await learningPathDTO(path), payment: paymentDTO(payment) };
      }
    }
  }

  const orderRef = generatePiOrderRef();
  const claimed = await LearningPath.updateOne(
    { _id: path._id, status: "pending_payment", paymentRef: path.paymentRef },
    { $set: { paymentRef: orderRef } },
  );
  if (claimed.modifiedCount === 0) {
    throw httpError(409, "Đang tạo giao dịch thanh toán. Vui lòng tải lại trang.");
  }
  const paymentExpiresAt = newPaymentExpiresAt();

  if (payment) {
    // Mở lại giao dịch đã hết hạn (hoặc lệch mã) bằng mã PI mới; điều kiện status chặn đè giao dịch đã xác nhận.
    const reopened = await Payment.findOneAndUpdate(
      { _id: payment._id, status: { $in: ["pending", "cancelled", "failed"] } },
      {
        $set: {
          status: "pending",
          amount,
          referenceModel: "LearningPath",
          providerRef: orderRef,
          paymentExpiresAt,
          providerResponse: { channel: "bank_transfer", reopenedAt: new Date().toISOString() },
        },
        $unset: { failureReason: "" },
      },
      { returnDocument: "after" },
    );
    if (!reopened) throw httpError(409, "Giao dịch vừa thay đổi trạng thái. Vui lòng tải lại trang.");
    payment = reopened;
  } else {
    const ledger = await recordTransferPending({
      userId: path.candidateId,
      type: LEARNING_PATH_PAYMENT_TYPE,
      referenceModel: "LearningPath",
      referenceId: path._id,
      amount,
      providerRef: orderRef,
      paymentExpiresAt,
    });
    if (!ledger.ok) throw httpError(500, ledger.error || "Không tạo được giao dịch chuyển khoản.");
    payment = await Payment.findOne(ledgerFilter(path._id));
    if (!payment || payment.providerRef !== orderRef) {
      throw httpError(409, "Đang tạo giao dịch thanh toán. Vui lòng tải lại trang.");
    }
  }

  const fresh = await LearningPath.findById(path._id).lean();
  return { learningPath: await learningPathDTO(fresh), payment: paymentDTO(payment) };
}

/** Ứng viên báo "Tôi đã chuyển khoản" (giúp admin đối soát tay ở LP-11). Không đổi trạng thái lộ trình. */
export async function submitLearningPathTransfer(actor, pathId) {
  const path = await loadPathForCandidate(actor, pathId);
  if (path.status !== "pending_payment") {
    throw httpError(409, PAID_PATH_STATUSES.includes(path.status) ? "Lộ trình đã được thanh toán." : "Lộ trình không ở trạng thái chờ thanh toán.");
  }
  const payment = await Payment.findOne(ledgerFilter(path._id));
  if (!payment || payment.providerRef !== path.paymentRef) {
    throw httpError(404, "Chưa có giao dịch chuyển khoản. Bấm thanh toán để lấy mã chuyển khoản.");
  }
  await expireLearningPathTransferIfNeeded(payment);
  if (payment.status === "cancelled") {
    throw httpError(409, "Mã chuyển khoản đã hết hạn. Bấm thanh toán lại để lấy mã mới.");
  }
  const meta = await recordTransferSubmitted({
    userId: path.candidateId,
    type: LEARNING_PATH_PAYMENT_TYPE,
    referenceId: path._id,
    paymentRef: payment.providerRef,
    submittedAt: new Date(),
  });
  if (!meta.ok) throw httpError(400, meta.error || "Không lưu được thông tin chuyển khoản.");
  const updated = await Payment.findById(payment._id).lean();
  return { learningPath: await learningPathDTO(path), payment: paymentDTO(updated) };
}

/**
 * Xác nhận đã nhận tiền lộ trình: Payment → `success`, lộ trình pending_payment → `active`.
 * Gọi từ SePay webhook (force + forceNote) hoặc admin (LP-11). Idempotent: lộ trình đã active và
 * giao dịch success thì trả `{ ok: true, idempotent: true }`, không gửi thông báo lần hai.
 *
 * @param {string} pathId
 * @param {{ force?: boolean, forceNote?: string, adminUserId?: string, amount?: number, allowExpired?: boolean }} options
 *   `amount`: số tiền thực nhận (SePay / admin nhập theo sao kê); lệch `Payment.amount` thì từ chối.
 *   `allowExpired` (chỉ admin, LP-11): xác nhận cả giao dịch đã bị hủy vì hết hạn — tiền đến muộn sau
 *   cửa sổ CK mà lộ trình vẫn chờ thanh toán. Bắt buộc kèm `force` + lý do.
 * @returns {Promise<{ ok: boolean, status?: number, error?: string, idempotent?: boolean, learningPath?: object }>}
 */
export async function confirmLearningPathTransfer(pathId, options = {}) {
  if (!mongoose.isValidObjectId(pathId)) return { ok: false, status: 400, error: "Mã lộ trình không hợp lệ." };
  const force = Boolean(options.force);
  const forceNote = String(options.forceNote || "").trim();
  if (force && forceNote.length < 3) {
    return { ok: false, status: 400, error: "Xác nhận ngoại lệ cần lý do (ít nhất 3 ký tự)." };
  }

  const path = await LearningPath.findById(pathId).lean();
  if (!path) return { ok: false, status: 404, error: "Không tìm thấy lộ trình." };
  const payment = await Payment.findOne(ledgerFilter(path._id)).lean();

  if (PAID_PATH_STATUSES.includes(path.status) && payment?.status === "success") {
    return { ok: true, idempotent: true, learningPath: await learningPathDTO(path) };
  }
  if (path.status !== "pending_payment") {
    return { ok: false, status: 409, error: "Lộ trình không ở trạng thái chờ thanh toán." };
  }
  if (!payment) return { ok: false, status: 400, error: "Lộ trình chưa có giao dịch chuyển khoản." };
  if (LOCKED_PAYMENT_STATUSES.includes(payment.status)) {
    return { ok: false, status: 409, error: "Giao dịch đang đối soát hoặc đã hoàn tiền; không xác nhận lại được." };
  }
  // Tiền đến sau khi mã đã hết hạn (Payment `cancelled` vì payment_timeout): chỉ admin xác nhận được,
  // dạng ngoại lệ có lý do, sau khi đối chiếu sao kê (LP-11). SePay không bao giờ khớp giao dịch đã hủy.
  const lateTransfer = payment.status === "cancelled" && payment.failureReason === "payment_timeout";
  if (lateTransfer && !(options.allowExpired && force)) {
    return { ok: false, status: 409, error: "Mã chuyển khoản đã hết hạn. Nếu đã nhận tiền, admin xác nhận ngoại lệ kèm lý do đối soát." };
  }
  // `success` mà lộ trình chưa active: lần trước dừng giữa chừng (DB không có transaction) → chạy tiếp.
  if (!lateTransfer && !["pending", "success"].includes(payment.status)) {
    return { ok: false, status: 409, error: "Giao dịch đã hết hạn hoặc bị hủy. Ứng viên cần tạo mã chuyển khoản mới." };
  }
  if (!force && !payment.providerResponse?.submittedAt) {
    return { ok: false, status: 400, error: "Ứng viên chưa báo «Đã chuyển khoản»." };
  }
  if (options.amount !== undefined && Math.round(Number(options.amount)) !== payment.amount) {
    return { ok: false, status: 400, error: "Số tiền nhận được không khớp giá lộ trình." };
  }
  if (payment.amount !== path.totalAmount) {
    return { ok: false, status: 409, error: "Số tiền giao dịch lệch giá lộ trình, cần đối soát tay." };
  }

  const paidAt = new Date();
  let activated = false;
  try {
    await runInTransaction(async (session) => {
      const ledger = await recordAdminTransferSuccess({
        userId: path.candidateId,
        type: LEARNING_PATH_PAYMENT_TYPE,
        referenceModel: "LearningPath",
        referenceId: path._id,
        amount: payment.amount,
        adminUserId: options.adminUserId || "",
        forceConfirm: force,
        forceNote,
        session,
      });
      if (!ledger.ok && !ledger.idempotent) throw new Error(`ERR_LEDGER:${ledger.error || ""}`);
      const res = await LearningPath.updateOne(
        { _id: path._id, status: "pending_payment" },
        { $set: { status: "active", paidAt } },
        session ? { session } : {},
      );
      activated = res.modifiedCount === 1;
    });
  } catch (error) {
    const msg = String(error?.message || "");
    console.error("[confirmLearningPathTransfer]", msg);
    return { ok: false, status: 500, error: "Không ghi nhận được thanh toán lộ trình." };
  }

  const after = await LearningPath.findById(path._id).lean();
  if (!activated) {
    // Lần gọi song song khác đã kích hoạt: coi như thành công, không gửi thông báo trùng.
    if (PAID_PATH_STATUSES.includes(after?.status)) return { ok: true, idempotent: true, learningPath: await learningPathDTO(after) };
    return { ok: false, status: 409, error: "Lộ trình vừa đổi trạng thái. Vui lòng tải lại trang." };
  }

  await notifyLearningPathPaid(after).catch((e) => console.error("[confirmLearningPathTransfer] notify:", e?.message || e));
  return { ok: true, learningPath: await learningPathDTO(after) };
}

async function notifyLearningPathPaid(path) {
  const [mentor, candidate] = await Promise.all([
    Mentor.findById(path.mentorId).select("userId name").lean(),
    User.findById(path.candidateId).select("name").lean(),
  ]);
  const amount = `${path.totalAmount.toLocaleString("vi-VN")}₫`;
  await deliverNotification(path.candidateId, {
    type: "learning_path_paid",
    title: "Đã nhận thanh toán lộ trình",
    body: `Lộ trình với ${mentor?.name || "Mentor"} (${amount}) đã được kích hoạt. Bạn có thể đặt lịch buổi đầu tiên.`,
    metadata: { learningPathId: path._id, mentorId: path.mentorId, actionUrl: `/learning-paths/${path._id}` },
  });
  if (mentor?.userId) {
    await deliverNotification(mentor.userId, {
      type: "learning_path_paid",
      title: "Mentee đã thanh toán lộ trình",
      body: `${candidate?.name || "Mentee"} đã thanh toán trọn gói ${amount}. Lộ trình đã bắt đầu.`,
      mentorPrefKey: "booking_request",
      metadata: { learningPathId: path._id, actionUrl: `/mentor/learning-paths/${path._id}/edit` },
    });
  }
}

/**
 * SePay: giao dịch CK lộ trình đang chờ có mã `orderRef`. Bỏ giao dịch đã hết hạn và giao dịch mà
 * lộ trình không còn `pending_payment` hoặc đã đổi sang mã khác.
 */
export async function findPendingLearningPathTargets(orderRef) {
  if (!orderRef) return [];
  const payments = await Payment.find({ type: LEARNING_PATH_PAYMENT_TYPE, provider: "transfer", status: "pending", providerRef: orderRef })
    .select("_id userId referenceId amount providerRef providerResponse paymentExpiresAt createdAt")
    .lean();
  const targets = [];
  for (const p of payments) {
    if (transferPaymentExpiryMeta(p).expired) continue;
    const path = await LearningPath.findOne({ _id: p.referenceId, status: "pending_payment", paymentRef: p.providerRef })
      .select("_id")
      .lean();
    if (!path) continue;
    targets.push({
      entityType: LEARNING_PATH_PAYMENT_TYPE,
      entityId: String(path._id),
      paymentId: String(p._id),
      userId: String(p.userId),
      expectedAmount: Math.round(Number(p.amount ?? 0)),
      transferSubmittedAt: p.providerResponse?.submittedAt ?? null,
    });
  }
  return targets;
}

/** `GET /api/payments/transfer-status`: trạng thái CK lộ trình theo mã PI (chỉ của user đăng nhập). */
export async function learningPathTransferStatusForUser(userId, orderRef) {
  const payment = await Payment.findOne({
    userId,
    type: LEARNING_PATH_PAYMENT_TYPE,
    provider: "transfer",
    providerRef: orderRef,
  });
  if (!payment) return null;
  await expireLearningPathTransferIfNeeded(payment);
  const dto = paymentDTO(payment);
  const paid = dto.status === "paid";
  return {
    ok: true,
    orderRef,
    status: dto.status,
    entityType: LEARNING_PATH_PAYMENT_TYPE,
    entityId: String(payment.referenceId),
    paymentExpiresAt: dto.paymentExpiresAt,
    expiresInMs: paid ? 0 : dto.expiresInMs,
    timeoutMinutes: dto.timeoutMinutes,
    redirectTo: paid ? `/learning-paths/${payment.referenceId}` : null,
    // Giống booking/khóa học: xác nhận kiểu force (SePay tự khớp hoặc admin ngoại lệ).
    sepayAuto: paid && Boolean(payment.providerResponse?.forceConfirm),
  };
}

// ---------------------------------------------------------------------------
// LP-11 — admin đối soát tay chuyển khoản lộ trình
// ---------------------------------------------------------------------------

/** Bộ lọc trang đối soát: chờ xác nhận, hết hạn mà lộ trình vẫn chờ thanh toán (có thể tiền đến muộn), đã nhận. */
export const ADMIN_LEARNING_PATH_TRANSFER_FILTERS = ["pending", "expired", "paid"];

function adminRowStatus(payment) {
  if (payment.status === "success") return "paid";
  if (payment.status === "cancelled") return "expired";
  if (payment.status === "pending" && transferPaymentExpiryMeta(payment).expired) return "expired";
  if (payment.status === "pending") return payment.providerResponse?.submittedAt ? "submitted" : "pending";
  return payment.status;
}

/**
 * Danh sách giao dịch CK lộ trình cho admin (`GET /api/admin/payments/learning-path-transfers?status=`).
 * `pending`: còn hạn chờ tiền; `expired`: hết hạn (đã hoặc chưa bị hủy) mà lộ trình vẫn `pending_payment`;
 * `paid`: đã nhận (kèm `confirmedVia` sepay | admin).
 */
export async function listLearningPathTransfersForAdmin({ status = "pending", limit = 100 } = {}) {
  const filterKey = ADMIN_LEARNING_PATH_TRANSFER_FILTERS.includes(status) ? status : "pending";
  const base = { type: LEARNING_PATH_PAYMENT_TYPE, provider: "transfer" };
  const now = new Date();
  const cap = Math.min(200, Math.max(1, Number(limit) || 100));
  let query;
  if (filterKey === "paid") query = { ...base, status: "success" };
  else if (filterKey === "expired") {
    query = { ...base, $or: [{ status: "cancelled", failureReason: "payment_timeout" }, { status: "pending", paymentExpiresAt: { $lte: now } }] };
  } else query = { ...base, status: "pending", paymentExpiresAt: { $gt: now } };

  const rows = await Payment.find(query)
    .sort(filterKey === "paid" ? { paidAt: -1, _id: -1 } : { createdAt: -1, _id: -1 })
    .limit(cap * (filterKey === "expired" ? 2 : 1))
    .populate("userId", "name email")
    .lean();

  const paths = await LearningPath.find({ _id: { $in: rows.map((r) => r.referenceId) } })
    .select("status totalAmount version mentorId paymentRef paidAt")
    .lean();
  const pathById = new Map(paths.map((p) => [String(p._id), p]));
  const mentors = await Mentor.find({ _id: { $in: paths.map((p) => p.mentorId) } }).select("name publicId").lean();
  const mentorById = new Map(mentors.map((m) => [String(m._id), m]));

  const items = [];
  for (const p of rows) {
    const path = pathById.get(String(p.referenceId));
    // Hết hạn mà lộ trình đã đổi trạng thái (đã thanh toán lần khác, bị hủy) thì không còn gì để đối soát.
    if (filterKey === "expired" && path?.status !== "pending_payment") continue;
    const pr = p.providerResponse && typeof p.providerResponse === "object" ? p.providerResponse : {};
    const mentor = path ? mentorById.get(String(path.mentorId)) : null;
    const user = p.userId && typeof p.userId === "object" ? p.userId : null;
    items.push({
      paymentId: String(p._id),
      learningPathId: String(p.referenceId),
      orderRef: p.providerRef || "",
      amount: p.amount,
      status: adminRowStatus(p),
      createdAt: p.createdAt,
      paymentExpiresAt: p.paymentExpiresAt ?? null,
      submittedAt: pr.submittedAt ?? null,
      paidAt: p.paidAt ?? null,
      /** `sepay` khi tự khớp webhook, `admin` khi admin xác nhận tay. */
      confirmedVia: p.status === "success" ? (pr.confirmedByUserId ? "admin" : "sepay") : "",
      forceConfirm: Boolean(pr.forceConfirm),
      forceNote: pr.forceNote || "",
      candidate: user ? { id: String(user._id), name: user.name || "", email: user.email || "" } : null,
      mentor: mentor ? { name: mentor.name || "", publicId: mentor.publicId || "" } : null,
      learningPath: path ? { status: path.status, totalAmount: path.totalAmount, version: path.version, paymentRef: path.paymentRef || "" } : null,
    });
    if (items.length >= cap) break;
  }

  const [paidAgg, pendingCount, submittedCount] = await Promise.all([
    Payment.aggregate([
      { $match: { ...base, status: "success" } },
      { $group: { _id: null, count: { $sum: 1 }, total: { $sum: "$amount" } } },
    ]),
    Payment.countDocuments({ ...base, status: "pending", paymentExpiresAt: { $gt: now } }),
    Payment.countDocuments({ ...base, status: "pending", paymentExpiresAt: { $gt: now }, "providerResponse.submittedAt": { $exists: true, $ne: null } }),
  ]);
  return {
    payments: items,
    stats: {
      paidCount: paidAgg[0]?.count || 0,
      paidTotalAmount: paidAgg[0]?.total || 0,
      pendingCount,
      submittedCount,
    },
  };
}

/**
 * Admin xác nhận CK lộ trình theo `paymentId` (`PATCH /api/admin/payments/:id/confirm-learning-path-transfer`).
 * - Không `force`: ứng viên phải đã báo «Đã chuyển khoản».
 * - `force` + `forceNote` (≥ 3 ký tự): xác nhận ngoại lệ; được phép cả giao dịch đã hết hạn (tiền đến muộn).
 * - `amount` (nếu gửi): số tiền trên sao kê, phải khớp giá lộ trình.
 */
export async function adminConfirmLearningPathTransfer(paymentId, { adminUserId, force, forceNote, amount } = {}) {
  if (!mongoose.isValidObjectId(paymentId)) return { ok: false, status: 400, error: "Mã giao dịch không hợp lệ." };
  const payment = await Payment.findOne({ _id: paymentId, type: LEARNING_PATH_PAYMENT_TYPE, provider: "transfer" })
    .select("referenceId")
    .lean();
  if (!payment) return { ok: false, status: 404, error: "Không tìm thấy giao dịch chuyển khoản lộ trình." };
  const hasAmount = !(amount === undefined || amount === null || amount === "");
  if (hasAmount && !Number.isFinite(Number(amount))) return { ok: false, status: 400, error: "Số tiền không hợp lệ." };
  const result = await confirmLearningPathTransfer(String(payment.referenceId), {
    adminUserId: String(adminUserId || ""),
    force: Boolean(force),
    forceNote: String(forceNote || ""),
    allowExpired: Boolean(force),
    ...(hasAmount ? { amount: Number(amount) } : {}),
  });
  if (!result.ok) return result;
  const updated = await Payment.findById(paymentId).lean();
  return { ...result, payment: updated };
}
