/**
 * N-08 (A-05): doanh thu theo nguồn cho trang phân tích admin (`GET /api/admin/analytics/revenue`).
 *
 * Bốn nguồn, mỗi nguồn đọc đúng một collection để số khớp truy vấn tay trên DB:
 *
 * | Nguồn           | Collection | Điều kiện                                                                 | Mốc thời gian            |
 * | --------------- | ---------- | ------------------------------------------------------------------------- | ------------------------ |
 * | `booking`       | Booking    | `paymentStatus ∈ {paid, partial_refund}`, loại booking lộ trình và buổi 0đ | `paidAt` ?? `createdAt`  |
 * | `course`        | Enrollment | `paymentStatus: paid`, `pricePaid > 0`                                     | `paidAt` ?? `createdAt`  |
 * | `subscription`  | Payment    | `type: subscription`, `status: success`                                    | `paidAt` ?? `createdAt`  |
 * | `learning_path` | Payment    | `type: learning_path`, `status ∈ {success, partial_refund}`                 | `paidAt` ?? `createdAt`  |
 *
 * - Booking lộ trình (`paymentMethod: learning_path`) và buổi 0đ không cộng vào `booking`: tiền lộ trình
 *   đã nằm trong Payment trọn gói, cộng nữa là trùng (LP-04, `EXCLUDE_LEARNING_PATH_BOOKINGS`).
 * - Payment demo (`providerRef` bắt đầu `UIMOCK-`, `seedFinanceDemoData.js`) không phải tiền thật, bị loại.
 * - `grossCollected` là tiền thực giữ lại (đã trừ phần hoàn). `platformRevenue` là phần nền tảng giữ:
 *   booking và khóa theo `platformFee` đã ghi; gói Pro/Elite giữ 100%; lộ trình là tổng phí nền tảng
 *   của các buổi gốc (`learningPathSessionFee(shareAmount, rate)`, LP-09), ghi nhận khi thu trọn gói.
 */
import mongoose from "mongoose";
import { EXCLUDE_LEARNING_PATH_BOOKINGS } from "../utils/learningPathBookingMoney.js";
import { learningPathSessionFee, planLearningPathMoney } from "../utils/learningPathMoney.js";

export const REVENUE_SOURCES = Object.freeze([
  { key: "booking", label: "Đặt lịch mentor" },
  { key: "course", label: "Khóa học" },
  { key: "subscription", label: "Gói Pro/Elite" },
  { key: "learning_path", label: "Lộ trình" },
]);

const DEFAULT_DAYS = 30;
const MAX_DAYS = 366;
/** Giờ Việt Nam (UTC+7, không đổi giờ mùa hè): ngày của chuỗi theo ngày tính theo giờ này. */
const VN_OFFSET_MS = 7 * 3_600_000;
const DAY_MS = 86_400_000;
const NOT_DEMO_PAYMENT = Object.freeze({ providerRef: { $not: /^UIMOCK-/i } });

function vndInt(n) {
  const v = Math.round(Number(n) || 0);
  return Number.isFinite(v) ? v : 0;
}

/** Số đã ghi trong DB; `null`/`undefined`/chuỗi rỗng là "chưa ghi" (Number(null) = 0 sẽ thành phí 0%). */
function storedNumber(raw) {
  if (raw === null || raw === undefined || raw === "") return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

function safeRate(raw, fallback) {
  const n = storedNumber(raw);
  return n !== null && n >= 0 && n <= 1 ? n : fallback;
}

/** Phí đã ghi, thiếu thì `gross × rate`; kẹp trong [0, gross] để phí + phần mentor = tiền giữ lại. */
function feeOf(row, gross, rate) {
  const stored = storedNumber(row.platformFee);
  const rawFee = stored !== null ? Math.round(stored) : Math.round(gross * rate);
  return Math.max(0, Math.min(gross, rawFee));
}

/** Khóa ngày `YYYY-MM-DD` theo giờ Việt Nam. */
export function vnDayKey(date) {
  return new Date(new Date(date).getTime() + VN_OFFSET_MS).toISOString().slice(0, 10);
}

/** 0h giờ Việt Nam của ngày chứa `date`, trả về Date (UTC). */
function vnStartOfDay(date) {
  const ms = new Date(date).getTime() + VN_OFFSET_MS;
  return new Date(Math.floor(ms / DAY_MS) * DAY_MS - VN_OFFSET_MS);
}

/**
 * Khoảng thời gian `[start, end)` từ query. `month=YYYY-MM` (giờ Việt Nam) ưu tiên hơn `days`.
 * `days` = số ngày gần nhất tính cả hôm nay (mặc định 30, tối đa 366).
 * @returns {{ ok: true, period: { start: Date, end: Date, days: number, month: string|null } } | { ok: false, error: string }}
 */
export function resolveRevenuePeriod({ days, month } = {}, now = new Date()) {
  const rawMonth = String(month ?? "").trim();
  if (rawMonth) {
    const m = /^(\d{4})-(\d{2})$/.exec(rawMonth);
    const year = m ? Number(m[1]) : NaN;
    const mon = m ? Number(m[2]) : NaN;
    if (!m || mon < 1 || mon > 12) {
      return { ok: false, error: "month phải theo định dạng YYYY-MM (ví dụ 2026-11)." };
    }
    const start = new Date(Date.UTC(year, mon - 1, 1) - VN_OFFSET_MS);
    const end = new Date(Date.UTC(year, mon, 1) - VN_OFFSET_MS);
    if (start.getTime() > now.getTime()) return { ok: false, error: "Không thể xem doanh thu tương lai." };
    return { ok: true, period: { start, end, days: Math.round((end - start) / DAY_MS), month: rawMonth } };
  }

  let n = DEFAULT_DAYS;
  if (days !== undefined && days !== null && String(days).trim() !== "") {
    n = Number(days);
    if (!Number.isInteger(n) || n < 1 || n > MAX_DAYS) {
      return { ok: false, error: `days phải là số nguyên từ 1 đến ${MAX_DAYS}.` };
    }
  }
  const end = new Date(vnStartOfDay(now).getTime() + DAY_MS);
  const start = new Date(end.getTime() - n * DAY_MS);
  return { ok: true, period: { start, end, days: n, month: null } };
}

/** Điều kiện Mongo: mốc `paidAt`, thiếu thì `fallbackField`, nằm trong `[start, end)`. */
function paidInRange(start, end, fallbackField = "createdAt") {
  const range = { $gte: start, $lt: end };
  return { $or: [{ paidAt: range }, { paidAt: null, [fallbackField]: range }] };
}

function emptyBucket() {
  return { grossCollected: 0, platformRevenue: 0, mentorNet: 0, count: 0 };
}

function addRow(bucket, { gross, fee }) {
  bucket.grossCollected += gross;
  bucket.platformRevenue += fee;
  bucket.mentorNet += gross - fee;
  bucket.count += 1;
}

/** Booking đã thu (trừ phần đã hoàn), cùng công thức với `getPlatformFinanceSummary`. */
export function bookingRevenueRow(row) {
  const rawGross = Number(row.totalAmount ?? row.price ?? 0);
  const refunded = Number(row.cancelRefundAmountVnd) || 0;
  const gross = Math.round(Math.max(0, rawGross - refunded));
  const rate = safeRate(row.platformFeeRate, Number(process.env.BOOKING_PLATFORM_FEE_RATE) || 0.3);
  return { gross, fee: feeOf(row, gross, rate) };
}

/** Khóa học đã thu (`pricePaid`); enrollment cũ chưa ghi `platformFee` (mặc định `null`) tính theo tỉ lệ. */
export function courseRevenueRow(row) {
  const gross = vndInt(row.pricePaid);
  const rate = safeRate(row.platformFeeRate, Number(process.env.COURSE_PLATFORM_FEE_RATE) || 0.35);
  return { gross, fee: feeOf(row, gross, rate) };
}

/**
 * Phí nền tảng của một lộ trình đã thu: tổng `learningPathSessionFee` các buổi gốc (attempt 1).
 * Chưa có buổi nào (dữ liệu lỗi) thì coi như 1 buổi, theo `planLearningPathMoney`.
 */
export function learningPathPlatformFee(path, originalSessions = []) {
  const rate = safeRate(path?.platformFeeRate, 0);
  if (originalSessions.length > 0) {
    return originalSessions.reduce((sum, s) => sum + learningPathSessionFee(vndInt(s.shareAmount), rate), 0);
  }
  const total = vndInt(path?.totalAmount);
  return planLearningPathMoney(total, 1, rate).reduce((sum, s) => sum + s.platformFee, 0);
}

/** Điều kiện Payment lộ trình đã thu (không tính Payment demo). Dùng chung cho analytics và báo cáo tài chính (LP-16). */
export const LEARNING_PATH_PAID_FILTER = Object.freeze({
  type: "learning_path",
  status: { $in: ["success", "partial_refund"] },
  ...NOT_DEMO_PAYMENT,
});

/**
 * LP-16: tiền từng Payment lộ trình đã thu. `gross` = số tiền trừ phần hoàn, `fee` = phí nền tảng các buổi gốc
 * (kẹp trong [0, gross]). Đọc LearningPath + buổi gốc một lần cho cả danh sách.
 * @returns {Promise<Array<{ payment: object, gross: number, fee: number }>>}
 */
export async function learningPathRevenueRows(lpPayments) {
  const LearningPath = mongoose.model("LearningPath");
  const LearningPathSession = mongoose.model("LearningPathSession");
  const pathIds = (lpPayments ?? []).map((p) => p.referenceId);
  const [paths, originalSessions] = pathIds.length
    ? await Promise.all([
        LearningPath.find({ _id: { $in: pathIds } }).select("totalAmount platformFeeRate").lean(),
        LearningPathSession.find({ pathId: { $in: pathIds }, attempt: 1 }).select("pathId shareAmount").lean(),
      ])
    : [[], []];
  const pathById = new Map(paths.map((p) => [String(p._id), p]));
  const sessionsByPath = new Map();
  for (const s of originalSessions) {
    const key = String(s.pathId);
    if (!sessionsByPath.has(key)) sessionsByPath.set(key, []);
    sessionsByPath.get(key).push(s);
  }
  return (lpPayments ?? []).map((payment) => {
    const gross = Math.max(0, vndInt(payment.amount) - vndInt(payment.refundAmount));
    const path = pathById.get(String(payment.referenceId));
    const fee = path ? learningPathPlatformFee(path, sessionsByPath.get(String(payment.referenceId)) || []) : 0;
    return { payment, gross, fee: Math.max(0, Math.min(gross, fee)) };
  });
}

/**
 * Doanh thu theo nguồn trong `period` (từ `resolveRevenuePeriod`).
 * Trả `{ period, totals, sources[], series[] }`; `series` có một dòng cho mỗi ngày (giờ Việt Nam),
 * kể cả ngày không có giao dịch, để biểu đồ không bị hở.
 */
export async function getRevenueBySource(period) {
  const Booking = mongoose.model("Booking");
  const Enrollment = mongoose.model("Enrollment");
  const Payment = mongoose.model("Payment");
  const { start, end } = period;

  const [bookings, enrollments, subscriptions, lpPayments] = await Promise.all([
    Booking.find({
      paymentStatus: { $in: ["paid", "partial_refund"] },
      ...EXCLUDE_LEARNING_PATH_BOOKINGS,
      ...paidInRange(start, end),
    })
      .select("totalAmount price platformFee platformFeeRate cancelRefundAmountVnd paidAt createdAt")
      .lean(),
    Enrollment.find({ paymentStatus: "paid", pricePaid: { $gt: 0 }, ...paidInRange(start, end) })
      .select("pricePaid platformFee platformFeeRate paidAt createdAt")
      .lean(),
    Payment.find({ type: "subscription", status: "success", ...NOT_DEMO_PAYMENT, ...paidInRange(start, end) })
      .select("amount refundAmount paidAt createdAt")
      .lean(),
    Payment.find({ ...LEARNING_PATH_PAID_FILTER, ...paidInRange(start, end) })
      .select("amount refundAmount referenceId paidAt createdAt")
      .lean(),
  ]);

  const lpRows = await learningPathRevenueRows(lpPayments);

  const buckets = Object.fromEntries(REVENUE_SOURCES.map((s) => [s.key, emptyBucket()]));
  const seriesByDay = new Map();
  for (let t = start.getTime(); t < end.getTime(); t += DAY_MS) {
    seriesByDay.set(vnDayKey(t), Object.fromEntries(REVENUE_SOURCES.map((s) => [s.key, 0])));
  }
  const record = (source, at, money) => {
    addRow(buckets[source], money);
    const day = seriesByDay.get(vnDayKey(at));
    if (day) day[source] += money.gross;
  };

  for (const b of bookings) record("booking", b.paidAt ?? b.createdAt, bookingRevenueRow(b));
  for (const e of enrollments) record("course", e.paidAt ?? e.createdAt, courseRevenueRow(e));
  for (const p of subscriptions) {
    const gross = Math.max(0, vndInt(p.amount) - vndInt(p.refundAmount));
    // Gói Pro/Elite không chia mentor: toàn bộ là phần nền tảng giữ.
    record("subscription", p.paidAt ?? p.createdAt, { gross, fee: gross });
  }
  for (const { payment: p, gross, fee } of lpRows) {
    record("learning_path", p.paidAt ?? p.createdAt, { gross, fee });
  }

  const totals = emptyBucket();
  for (const b of Object.values(buckets)) {
    totals.grossCollected += b.grossCollected;
    totals.platformRevenue += b.platformRevenue;
    totals.mentorNet += b.mentorNet;
    totals.count += b.count;
  }

  return {
    period: {
      startAt: start.toISOString(),
      endAt: end.toISOString(),
      days: period.days,
      month: period.month ?? null,
      timezone: "Asia/Ho_Chi_Minh",
    },
    totals,
    sources: REVENUE_SOURCES.map(({ key, label }) => ({
      key,
      label,
      ...buckets[key],
      sharePct: totals.grossCollected > 0 ? Math.round((buckets[key].grossCollected / totals.grossCollected) * 1000) / 10 : 0,
    })),
    series: [...seriesByDay.entries()].map(([date, bySource]) => ({
      date,
      ...bySource,
      total: REVENUE_SOURCES.reduce((sum, s) => sum + bySource[s.key], 0),
    })),
  };
}
