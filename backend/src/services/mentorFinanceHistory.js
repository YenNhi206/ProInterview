/**
 * Lịch sử thu nhập của mentor, đọc theo SỔ VÍ chứ không tính lại.
 *
 * Mỗi buổi / lượt mua khóa khi được ghi có sẽ lưu `earningsNetAmount` (số đã cộng vào ví),
 * `earningsClearAt` (hết thời gian giữ) và `earningsClearedAt` (đã chuyển sang số dư khả dụng)
 * — xem `mentorEarningsService.js`. Màn hình tài chính phải hiện đúng các số đó; tính lại từ
 * giá và phí hiện tại có thể lệch ví (dữ liệu cũ, hoàn tiền một phần, đổi phí sau khi ghi có).
 *
 * Dòng chưa từng được ghi có (`mentorEarningsCreditedAt` rỗng) vẫn hiện để mentor thấy,
 * nhưng đánh dấu `not_credited` và KHÔNG cộng vào thu nhập đã ghi.
 */

/** Trạng thái tiền của một khoản thu nhập. */
export const EARNINGS_STATUS = Object.freeze({
  /** Đã ghi có, đang trong thời gian giữ. */
  HOLDING: "holding",
  /** Đã qua ngày hết giữ nhưng chưa chuyển (đang có khiếu nại, hoặc job chưa chạy tới). */
  HOLD_OVERDUE: "hold_overdue",
  /** Đã chuyển sang số dư khả dụng. */
  AVAILABLE: "available",
  /** Chưa từng ghi vào ví. */
  NOT_CREDITED: "not_credited",
});

const toInt = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.round(n) : 0;
};

const validDate = (v) => {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
};

function earningsStatusOf(row, now) {
  if (!row.mentorEarningsCreditedAt) return EARNINGS_STATUS.NOT_CREDITED;
  if (row.earningsClearedAt) return EARNINGS_STATUS.AVAILABLE;
  const clearAt = validDate(row.earningsClearAt);
  if (clearAt && clearAt.getTime() <= now.getTime()) return EARNINGS_STATUS.HOLD_OVERDUE;
  return EARNINGS_STATUS.HOLDING;
}

/**
 * Phần tiền chung của một khoản thu: học viên trả, phí, thực nhận, điều chỉnh.
 * `adjustment` khác 0 khi số đã ghi vào ví khác (học viên trả − phí), ví dụ hoàn tiền một phần.
 */
function moneyParts({ gross, fee, feeRate, snapshotNet, credited }) {
  const grossAmount = Math.max(0, toInt(gross));
  const platformFee = Math.max(0, toInt(fee));
  const formulaNet = Math.max(0, grossAmount - platformFee);
  const hasSnapshot = credited && snapshotNet != null && Number.isFinite(Number(snapshotNet));
  const amount = hasSnapshot ? Math.max(0, toInt(snapshotNet)) : formulaNet;
  // % phí hiển thị phải khớp số phí thật: dùng mức lưu trên bản ghi chỉ khi nó cho ra đúng số phí,
  // nếu không thì tính từ phí / học viên trả (vd. bản ghi cũ lưu phí 0 nhưng mức 35% là sai).
  const rate = Number(feeRate);
  const effectiveRate = grossAmount > 0 ? Math.round((platformFee / grossAmount) * 1000) / 1000 : 0;
  const storedRateMatches =
    Number.isFinite(rate) && rate >= 0 && rate <= 1 && Math.abs(Math.round(grossAmount * rate) - platformFee) <= 1;
  const platformFeeRate = storedRateMatches ? rate : effectiveRate;
  return { grossAmount, platformFee, platformFeeRate, amount, adjustment: amount - formulaNet };
}

function ledgerDates(row) {
  return {
    creditedAt: validDate(row.mentorEarningsCreditedAt),
    clearAt: validDate(row.earningsClearAt),
    clearedAt: validDate(row.earningsClearedAt),
  };
}

/** Một buổi mentor (đặt lịch thường hoặc buổi lộ trình) → dòng lịch sử. */
export function bookingIncomeRow(b, now = new Date()) {
  const credited = Boolean(b.mentorEarningsCreditedAt);
  const isLearningPath = Boolean(b.learningPathId);
  const user = b.userId && typeof b.userId === "object" ? b.userId : null;
  return {
    id: String(b._id),
    type: "income",
    source: isLearningPath ? "learning_path" : "booking",
    sessionType: b.sessionType || "",
    sessionDate: b.date || "",
    sessionTime: b.timeSlot || "",
    counterpartyName: String(user?.name || "").trim(),
    refunded: ["refunded", "partial_refund", "refund_pending"].includes(b.paymentStatus),
    date: validDate(b.completedAt) || validDate(b.createdAt),
    credited,
    earningsStatus: earningsStatusOf(b, now),
    ...ledgerDates(b),
    ...moneyParts({
      gross: b.totalAmount ?? b.price,
      fee: b.platformFee,
      feeRate: b.platformFeeRate,
      snapshotNet: b.earningsNetAmount,
      credited,
    }),
    description: isLearningPath ? "Thu từ buổi lộ trình" : "Thu từ booking",
    status: "completed",
  };
}

/** Một lượt mua khóa học → dòng lịch sử. */
export function courseIncomeRow(e, now = new Date(), fallbackFeeRate = 0.35) {
  const credited = Boolean(e.mentorEarningsCreditedAt);
  const course = e.courseId && typeof e.courseId === "object" ? e.courseId : null;
  const gross = toInt(e.pricePaid);
  const explicitFee = e.platformFee != null && Number.isFinite(Number(e.platformFee)) ? Number(e.platformFee) : null;
  const rate = e.platformFeeRate != null && Number.isFinite(Number(e.platformFeeRate)) ? Number(e.platformFeeRate) : null;
  const fee = explicitFee ?? Math.round(gross * (rate ?? fallbackFeeRate));
  return {
    id: `enrollment-${String(e._id)}`,
    type: "income",
    source: "course",
    courseTitle: String(course?.title || "").trim(),
    refunded: ["refunded", "partial_refund", "refund_pending"].includes(e.paymentStatus),
    date: validDate(e.paidAt) || validDate(e.createdAt),
    credited,
    earningsStatus: earningsStatusOf(e, now),
    ...ledgerDates(e),
    ...moneyParts({ gross, fee, feeRate: rate ?? (explicitFee == null ? fallbackFeeRate : null), snapshotNet: e.earningsNetAmount, credited }),
    description: "Thu từ khóa học",
    status: "completed",
  };
}

/**
 * Tổng theo nguồn, chỉ tính khoản đã ghi vào ví; khoản chưa ghi cộng riêng.
 * `difference` = số trong ví − tổng các khoản đã ghi; khác 0 nghĩa là cần admin đối soát.
 */
export function summarizeIncome(rows, ledgerTotalEarned) {
  const breakdown = { booking: 0, learningPath: 0, course: 0 };
  let creditedTotal = 0;
  let notCreditedTotal = 0;
  let notCreditedCount = 0;
  for (const r of rows) {
    if (r.type !== "income") continue;
    if (!r.credited) {
      notCreditedTotal += r.amount;
      if (r.amount > 0) notCreditedCount += 1;
      continue;
    }
    creditedTotal += r.amount;
    if (r.source === "learning_path") breakdown.learningPath += r.amount;
    else if (r.source === "course") breakdown.course += r.amount;
    else breakdown.booking += r.amount;
  }
  const ledger = toInt(ledgerTotalEarned);
  return {
    breakdown,
    reconciliation: {
      ledgerTotalEarned: ledger,
      creditedTotal,
      notCreditedTotal,
      notCreditedCount,
      difference: ledger - creditedTotal,
    },
  };
}
