import mongoose from "mongoose";
import { Booking } from "../models/Booking.js";
import { Course } from "../models/Course.js";
import { Enrollment } from "../models/Enrollment.js";
import { Mentor } from "../models/Mentor.js";
import { PayoutRequest } from "../models/PayoutRequest.js";
import { resolveCoursePlatformFeeRate } from "./mentorCommissionService.js";
import { runInTransaction, supportsTransactions } from "../helpers/dbHelper.js";

export const EARNINGS_HOLD_DAYS = 7;
function clearAt(from) { return new Date(new Date(from || Date.now()).getTime() + EARNINGS_HOLD_DAYS * 86400000); }

function parseFeeRate(envVal, fallback) {
  if (envVal == null || String(envVal).trim() === "") return fallback;
  const n = Number(String(envVal ?? "").trim());
  if (!Number.isFinite(n) || n < 0 || n > 1) return fallback;
  return n;
}

/** Tiền mentor nhận sau phí nền tảng (VAT là phần thu của KH, không trừ thêm ở đây). */
export function mentorNetFromBooking(booking) {
  const gross = Math.round(Number(booking?.totalAmount ?? booking?.price ?? 0));
  const platformFee = Math.round(Number(booking?.platformFee || 0));
  return Math.max(0, gross - platformFee);
}

export function mentorNetFromCourseSale(input, mentorForFallback = null) {
  const gross = Math.round(Number(input?.pricePaid ?? input ?? 0));
  if (gross <= 0) return 0;
  const explicitFee = Number(input?.platformFee);
  if (input?.platformFee != null && Number.isFinite(explicitFee) && explicitFee >= 0) {
    return Math.max(0, gross - Math.round(explicitFee));
  }
  const explicitRate = parseFeeRate(input?.platformFeeRate, NaN);
  if (Number.isFinite(explicitRate)) {
    return Math.max(0, gross - Math.round(gross * explicitRate));
  }
  const fallbackRate = mentorForFallback
    ? resolveCoursePlatformFeeRate(mentorForFallback).rate
    : parseFeeRate(process.env.COURSE_PLATFORM_FEE_RATE, 0.35);
  const pf = Math.round(gross * fallbackRate);
  return Math.max(0, gross - pf);
}

/**
 * Ghi có ví mentor khi buổi đã hoàn thành và đã thanh toán.
 * Idempotent: `mentorEarningsCreditedAt` trên Booking.
 */
export async function tryCreditMentorForCompletedBooking(bookingId) {
  if (!mongoose.isValidObjectId(bookingId)) return { ok: false, error: "bookingId không hợp lệ." };
  const booking = await Booking.findById(bookingId)
    .select("mentorId status paymentStatus price totalAmount platformFee mentorEarningsCreditedAt completedAt")
    .lean();
  if (!booking || booking.status !== "completed" || booking.paymentStatus !== "paid") {
    return { ok: true, skipped: true };
  }
  if (booking.mentorEarningsCreditedAt) return { ok: true, skipped: true, already: true };

  const net = mentorNetFromBooking(booking);
  if (net <= 0) {
    await Booking.updateOne({ _id: bookingId }, { $set: { mentorEarningsCreditedAt: new Date() } });
    return { ok: true, skipped: true, reason: "zero_net" };
  }

  // Đánh dấu "đã cộng" + cộng số dư mentor trong CÙNG 1 transaction — nếu crash giữa chừng,
  // toàn bộ rollback thay vì để booking bị đánh dấu "đã cộng" nhưng mentor chưa nhận tiền
  // (tiền mất vĩnh viễn vì guard idempotent chặn mọi lần credit lại sau đó).
  let credited = false;
  await runInTransaction(async (session) => {
    const mark = await Booking.updateOne(
      {
        _id: bookingId,
        mentorEarningsCreditedAt: { $in: [null, undefined] },
        status: "completed",
        paymentStatus: "paid",
      },
      { $set: { mentorEarningsCreditedAt: new Date(), earningsClearAt: clearAt(booking.completedAt), earningsNetAmount: net } },
      { session },
    );
    if (mark.modifiedCount !== 1) return;
    await Mentor.updateOne(
      { _id: booking.mentorId },
      { $inc: { "finance.clearingBalance": net, "finance.totalEarned": net } },
      { session },
    );
    credited = true;
  });
  if (!credited) return { ok: true, skipped: true, race: true };
  return { ok: true, credited: net };
}

/**
 * Ghi có ví mentor khi học phí khóa (CK) đã được admin xác nhận.
 * Idempotent: `mentorEarningsCreditedAt` trên Enrollment.
 */
export async function tryCreditMentorForPaidEnrollment(enrollmentId) {
  if (!mongoose.isValidObjectId(enrollmentId)) return { ok: false, error: "enrollmentId không hợp lệ." };
  const row = await Enrollment.findById(enrollmentId)
    .select("courseId pricePaid platformFeeRate platformFee paymentStatus mentorEarningsCreditedAt paidAt")
    .lean();
  if (!row || row.paymentStatus !== "paid") return { ok: true, skipped: true };
  if (row.mentorEarningsCreditedAt) return { ok: true, skipped: true, already: true };

  const gross = Math.round(Number(row.pricePaid || 0));
  const course = await Course.findById(row.courseId).select("mentorId").lean();
  if (!course?.mentorId) {
    console.error("[tryCreditMentorForPaidEnrollment] course missing mentorId", enrollmentId);
    return { ok: false, error: "Không tìm thấy mentor của khóa học." };
  }
  const mentor = await Mentor.findById(course.mentorId).select("pricing").lean();
  const resolvedRate =
    row.platformFeeRate != null && Number.isFinite(Number(row.platformFeeRate))
      ? Number(row.platformFeeRate)
      : resolveCoursePlatformFeeRate(mentor).rate;
  const resolvedFee = row.platformFee != null && Number.isFinite(Number(row.platformFee))
    ? Math.round(Number(row.platformFee))
    : Math.round(gross * resolvedRate);
  const net = mentorNetFromCourseSale(
    { pricePaid: gross, platformFeeRate: resolvedRate, platformFee: resolvedFee },
    mentor,
  );

  // Đánh dấu "đã cộng" + cộng số dư mentor + cộng doanh thu khóa trong CÙNG 1 transaction —
  // tránh crash giữa chừng để lại enrollment "đã cộng" nhưng mentor chưa thực nhận tiền.
  let credited = false;
  await runInTransaction(async (session) => {
    const mark = await Enrollment.updateOne(
      { _id: enrollmentId, mentorEarningsCreditedAt: { $in: [null, undefined] }, paymentStatus: "paid" },
      {
        $set: {
          mentorEarningsCreditedAt: new Date(),
          platformFeeRate: resolvedRate,
          platformFee: resolvedFee,
          earningsClearAt: clearAt(row.paidAt), earningsNetAmount: net,
        },
      },
      { session },
    );
    if (mark.modifiedCount !== 1) return;
    if (net > 0) {
      await Mentor.updateOne(
        { _id: course.mentorId },
        { $inc: { "finance.clearingBalance": net, "finance.totalEarned": net } },
        { session },
      );
    }
    if (gross > 0) {
      await Course.updateOne({ _id: row.courseId }, { $inc: { "stats.totalRevenue": gross } }, { session });
    }
    credited = true;
  });
  if (!credited) return { ok: true, skipped: true, race: true };
  return { ok: true, credited: net, gross };
}

async function hasOpenReportBlocking({ mentorId, targetType, targetId }) {
  const { Report } = await import("../models/Report.js");
  const count = await Report.countDocuments({
    status: { $in: ["pending", "reviewing"] },
    $or: [
      { targetType: "mentor", targetId: mentorId },
      { targetType, targetId },
    ],
  });
  return count > 0;
}

/** Lý do bỏ qua 1 dòng khi release — không phải lỗi hệ thống, không nên ném lên trên. */
class ClearanceSkip extends Error {
  constructor(reason) {
    super(reason);
    this.reason = reason;
  }
}

/**
 * Số tiền phải trừ khỏi `clearingBalance` khi release.
 *
 * Ưu tiên snapshot `earningsNetAmount` đã chốt lúc ghi có. Chỉ tính lại cho các dòng cũ được
 * ghi có TRƯỚC khi có snapshot — với dòng mới, tính lại là sai: nếu booking bị hoàn tiền một
 * phần ở giữa thì số tính lại không còn khớp số đã cộng vào.
 */
function resolveNetForRelease(row, recompute) {
  const snapshot = Number(row?.earningsNetAmount);
  if (row?.earningsNetAmount != null && Number.isFinite(snapshot) && snapshot >= 0) return snapshot;
  return recompute();
}

/**
 * Release 1 dòng theo pattern claim-first:
 *   1. Claim `earningsClearedAt` bằng update có điều kiện — chỉ 1 process thắng được.
 *   2. Chuyển tiền, có guard `clearingBalance >= net` chống số dư âm.
 * Ném `ClearanceSkip` nếu không claim được hoặc không chuyển được tiền; caller quyết định
 * rollback (chạy ngoài transaction) hay để transaction tự abort.
 */
async function releaseOneRow({ Model, rowId, mentorId, net, now, session }) {
  const opts = session ? { session } : {};

  const claimed = await Model.updateOne(
    { _id: rowId, paymentStatus: "paid", ...(Model.modelName === "Booking" ? { status: "completed" } : {}), earningsClearAt: { $lte: now }, earningsClearedAt: { $in: [null, undefined] } },
    { $set: { earningsClearedAt: now }, $unset: { earningsClearFailedAt: 1 } },
    opts,
  );
  if (claimed.modifiedCount !== 1) throw new ClearanceSkip("already_claimed");

  // Không có tiền để chuyển (net 0) — vẫn coi là đã xử lý xong, không đụng ví.
  if (net <= 0) return;

  const credited = await Mentor.updateOne(
    { _id: mentorId, "finance.clearingBalance": { $gte: net } },
    { $inc: { "finance.clearingBalance": -net, "finance.availableBalance": net } },
    opts,
  );
  if (credited.modifiedCount !== 1) throw new ClearanceSkip("credit_failed");
}

/**
 * Quét các buổi/khóa đã đủ `EARNINGS_HOLD_DAYS` kể từ lúc ghi có (`earningsClearAt` đã tới),
 * chưa release (`earningsClearedAt` rỗng) — không có report mở thì chuyển tiền từ
 * `clearingBalance` sang `availableBalance`; có report mở thì bỏ qua, job lần sau quét lại.
 * Gọi định kỳ từ `jobs/earningsClearanceJob.js`.
 *
 * An toàn khi chạy chồng nhau: mỗi dòng được claim độc quyền trước khi cộng tiền, nên 2 lần
 * chạy song song không thể cộng đôi. Khi DB hỗ trợ transaction (replica set / Atlas), cả 2
 * lệnh ghi nằm trong 1 transaction nên cũng không còn cửa sổ crash ở giữa.
 */
export async function releaseEligibleEarnings(now = new Date()) {
  let releasedCount = 0;
  let heldCount = 0;
  let failedCount = 0;

  // Tính 1 lần cho cả lượt quét — `runInTransaction` sẽ hỏi lại DB mỗi lần gọi, quá tốn trong vòng lặp.
  const txSupported = await supportsTransactions();
  const session = txSupported ? await mongoose.startSession() : null;

  /** Chạy releaseOneRow, tự chọn đường transaction hay claim-first + rollback tay. */
  async function runRelease({ Model, rowId, mentorId, net }) {
    try {
      if (session) {
        await session.withTransaction(async () => {
          await releaseOneRow({ Model, rowId, mentorId, net, now, session });
        });
      } else {
        await releaseOneRow({ Model, rowId, mentorId, net, now, session: null });
      }
      releasedCount++;
    } catch (err) {
      if (!(err instanceof ClearanceSkip)) throw err;
      if (err.reason === "already_claimed") return; // lượt chạy khác đã xử lý — im lặng bỏ qua
      if (err.reason === "credit_failed") {
        // Có transaction thì claim đã tự rollback; không có thì phải trả lại bằng tay.
        await Model.updateOne(
          { _id: rowId, earningsClearedAt: session ? null : now },
          { $set: { earningsClearedAt: null, earningsClearFailedAt: now } },
        ).catch(() => {});
        failedCount++;
        console.error(
          `[CLEARANCE_FAILED] ${Model.modelName} ${rowId} mentor=${mentorId} net=${net} — ` +
            "mentor không tồn tại hoặc clearingBalance không đủ. Cần admin đối soát.",
        );
      }
    }
  }

  try {
    const bookings = await Booking.find({
      earningsClearAt: { $lte: now },
      paymentStatus: "paid",
      earningsClearedAt: { $in: [null, undefined] },
      mentorEarningsCreditedAt: { $ne: null },
    })
      .select("mentorId status totalAmount price platformFee earningsNetAmount")
      .lean();

    for (const b of bookings) {
      if (b.status !== "completed") { heldCount++; continue; }
      if (await hasOpenReportBlocking({ mentorId: b.mentorId, targetType: "booking", targetId: b._id })) {
        heldCount++;
        continue;
      }
      const net = resolveNetForRelease(b, () => mentorNetFromBooking(b));
      await runRelease({ Model: Booking, rowId: b._id, mentorId: b.mentorId, net });
    }

    const enrollments = await Enrollment.find({
      earningsClearAt: { $lte: now },
      paymentStatus: "paid",
      earningsClearedAt: { $in: [null, undefined] },
      mentorEarningsCreditedAt: { $ne: null },
    })
      .select("courseId pricePaid platformFeeRate platformFee earningsNetAmount")
      .lean();

    for (const e of enrollments) {
      const course = await Course.findById(e.courseId).select("mentorId").lean();
      if (!course?.mentorId) continue;
      if (await hasOpenReportBlocking({ mentorId: course.mentorId, targetType: "course", targetId: e.courseId })) {
        heldCount++;
        continue;
      }
      const net = resolveNetForRelease(e, () =>
        mentorNetFromCourseSale({
          pricePaid: e.pricePaid,
          platformFeeRate: e.platformFeeRate,
          platformFee: e.platformFee,
        }),
      );
      await runRelease({ Model: Enrollment, rowId: e._id, mentorId: course.mentorId, net });
    }
  } finally {
    if (session) await session.endSession();
  }

  return { ok: true, releasedCount, heldCount, failedCount };
}

/**
 * Đối soát: với mỗi mentor, tổng `earningsNetAmount` của các dòng đã ghi có nhưng chưa release
 * phải bằng `finance.clearingBalance`. Lệch = có lượt release hỏng giữa chừng hoặc ghi tay.
 *
 * CHỈ BÁO CÁO, không tự sửa số dư — tự động chỉnh ví là việc phải có người quyết định.
 */
export async function reconcileMentorClearingBalances() {
  const [bookingSums, enrollmentSums] = await Promise.all([
    Booking.aggregate([
      { $match: { earningsClearAt: { $ne: null }, mentorEarningsCreditedAt: { $ne: null }, earningsClearedAt: { $in: [null, undefined] } } },
      { $group: { _id: "$mentorId", total: { $sum: { $ifNull: ["$earningsNetAmount", 0] } } } },
    ]),
    Enrollment.aggregate([
      { $match: { earningsClearAt: { $ne: null }, mentorEarningsCreditedAt: { $ne: null }, earningsClearedAt: { $in: [null, undefined] } } },
      { $lookup: { from: "courses", localField: "courseId", foreignField: "_id", as: "course" } },
      { $unwind: "$course" },
      { $group: { _id: "$course.mentorId", total: { $sum: { $ifNull: ["$earningsNetAmount", 0] } } } },
    ]),
  ]);

  const expected = new Map();
  for (const row of [...bookingSums, ...enrollmentSums]) {
    if (!row._id) continue;
    const key = String(row._id);
    expected.set(key, (expected.get(key) || 0) + Math.round(Number(row.total) || 0));
  }

  const mentors = await Mentor.find({
    $or: [{ "finance.clearingBalance": { $ne: 0 } }, { _id: { $in: [...expected.keys()] } }],
  })
    .select("finance.clearingBalance name")
    .lean();

  const mismatches = [];
  for (const m of mentors) {
    const actual = Math.round(Number(m.finance?.clearingBalance) || 0);
    const want = expected.get(String(m._id)) || 0;
    if (actual !== want) {
      mismatches.push({ mentorId: String(m._id), name: m.name || "", actual, expected: want, diff: actual - want });
    }
  }

  const pendingSums = await PayoutRequest.aggregate([
    { $match: { status: { $in: ["pending", "approved", "processing"] } } },
    { $group: { _id: "$mentorId", total: { $sum: "$amount" } } },
  ]);
  const pendingExpected = new Map(pendingSums.map((row) => [String(row._id), row.total]));
  const payoutMentors = await Mentor.find({ $or: [{ "finance.pendingBalance": { $ne: 0 } }, { _id: { $in: pendingSums.map((row) => row._id) } }] }).select("name finance.pendingBalance").lean();
  const payoutMismatches = payoutMentors.flatMap((m) => {
    const actual = Number(m.finance?.pendingBalance || 0), expected = pendingExpected.get(String(m._id)) || 0;
    return actual === expected ? [] : [{ mentorId: String(m._id), name: m.name, actual, expected, diff: actual - expected }];
  });
  const alerts = await collectClearanceAlerts();
  return { ok: true, checked: mentors.length, mismatches, payoutMismatches, alerts };
}

/** Ngưỡng nhắc admin giải ngân cho mentor bị tạm ngưng còn số dư khả dụng. */
const SUSPENDED_WITH_BALANCE_DAYS = 7;

/**
 * Ba loại việc dễ rơi vào im lặng — gom vào cùng báo cáo đối soát để admin chỉ phải nhìn 1 chỗ:
 *  - dòng release lỗi quá 24h (job vẫn retry mỗi giờ nhưng log trôi mất, không ai thấy)
 *  - `Payment` bị giữ vì tài khoản bị khóa, chưa ai quyết hoàn tiền hay mở khóa
 *  - mentor `suspended` còn tiền khả dụng quá lâu mà admin chưa giải ngân thay
 */
async function collectClearanceAlerts() {
  const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const staleAt = new Date(Date.now() - SUSPENDED_WITH_BALANCE_DAYS * 24 * 60 * 60 * 1000);
  const Payment = mongoose.model("Payment");

  const [failedBookings, failedEnrollments, heldPayments, suspendedWithBalance] = await Promise.all([
    Booking.countDocuments({ earningsClearFailedAt: { $lte: dayAgo } }),
    Enrollment.countDocuments({ earningsClearFailedAt: { $lte: dayAgo } }),
    Payment.countDocuments({ status: "held_inactive_account" }),
    Mentor.find({ status: "suspended", "finance.availableBalance": { $gt: 0 }, updatedAt: { $lte: staleAt } })
      .select("name finance.availableBalance")
      .limit(50)
      .lean(),
  ]);

  return {
    staleFailedClearances: failedBookings + failedEnrollments,
    heldPayments,
    suspendedMentorsWithBalance: suspendedWithBalance.map((m) => ({
      mentorId: String(m._id),
      name: m.name || "",
      availableBalance: Math.round(Number(m.finance?.availableBalance) || 0),
    })),
  };
}
