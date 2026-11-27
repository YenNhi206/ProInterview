/**
 * Hiển thị lịch sử tài chính mentor (M-06). Dữ liệu từ `GET /api/mentor/finance` → `history[]`:
 * dòng thu nhập có `grossAmount` (học viên trả), `platformFee`, `platformFeeRate`, `adjustment`,
 * `amount` (thực nhận đã ghi vào ví), `earningsStatus`, `clearAt`, `clearedAt`, `credited`.
 * Dòng rút tiền có `amount`, `status`, `bankName`, `accountMasked`.
 */
import { sessionTypeLabel } from "../booking/sessionTypeLabels.js";

export const ALL_MONTHS = "all";

const pad2 = (n) => String(n).padStart(2, "0");

function toDate(value) {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function formatDateVN(value) {
  const d = toDate(value);
  return d ? `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}/${d.getFullYear()}` : "";
}

/** "2026-11" theo giờ máy người xem. */
export function monthKey(value) {
  const d = toDate(value);
  return d ? `${d.getFullYear()}-${pad2(d.getMonth() + 1)}` : "";
}

export function monthLabel(key) {
  if (!key || key === ALL_MONTHS) return "Tất cả thời gian";
  const [y, m] = key.split("-");
  return `Tháng ${Number(m)}/${y}`;
}

/** Các tháng có giao dịch, mới nhất trước. */
export function listMonths(rows) {
  const keys = new Set((rows || []).map((r) => monthKey(r?.date)).filter(Boolean));
  return [...keys].sort((a, b) => (a < b ? 1 : a > b ? -1 : 0));
}

export function filterRows(rows, { month = ALL_MONTHS, tab = "all" } = {}) {
  return (rows || []).filter((r) => {
    if (tab === "income" && r.type !== "income") return false;
    if (tab === "withdraw" && r.type !== "withdraw") return false;
    if (month !== ALL_MONTHS && monthKey(r.date) !== month) return false;
    return true;
  });
}

/**
 * Tổng của các dòng đang xem. Thu nhập chưa ghi vào ví tách riêng, không cộng vào thực nhận.
 * Rút tiền: đã chuyển (`paid`), đang xử lý (chờ duyệt / đã duyệt chờ chuyển); bị từ chối không tính.
 */
export function summarizeRows(rows) {
  const s = { incomeCount: 0, gross: 0, fee: 0, adjustment: 0, net: 0, notCreditedCount: 0, notCreditedNet: 0, withdrawPaid: 0, withdrawProcessing: 0 };
  for (const r of rows || []) {
    const amount = Math.round(Number(r?.amount) || 0);
    if (r?.type === "income") {
      if (r.credited === false) {
        s.notCreditedCount += 1;
        s.notCreditedNet += amount;
        continue;
      }
      s.incomeCount += 1;
      s.gross += Math.round(Number(r.grossAmount) || 0);
      s.fee += Math.round(Number(r.platformFee) || 0);
      s.adjustment += Math.round(Number(r.adjustment) || 0);
      s.net += amount;
    } else if (r?.type === "withdraw") {
      if (r.status === "paid" || r.status === "completed") s.withdrawPaid += amount;
      else if (r.status !== "failed") s.withdrawProcessing += amount;
    }
  }
  return s;
}

export function percentText(rate) {
  const n = Number(rate) * 100;
  if (!Number.isFinite(n)) return "";
  const r = Math.round(n * 10) / 10;
  return `${Number.isInteger(r) ? r : r.toFixed(1)}%`;
}

/** Trạng thái tiền của một khoản thu: nhãn ngắn, mô tả đầy đủ, tông màu. */
export function incomeStatusMeta(row) {
  switch (row?.earningsStatus) {
    case "holding":
      return {
        label: row.clearAt ? `Đang giữ đến ${formatDateVN(row.clearAt)}` : "Đang giữ",
        detail: "Tiền đã ghi vào ví nhưng đang trong thời gian giữ, chưa rút được.",
        tone: "holding",
      };
    case "hold_overdue":
      return {
        label: "Chờ chuyển vào số dư",
        detail: "Đã hết thời gian giữ nhưng chưa chuyển sang số dư khả dụng: có khiếu nại đang xử lý, hoặc hệ thống sẽ chuyển ở lượt quét tiếp theo.",
        tone: "holding",
      };
    case "available":
      return {
        label: "Đã vào số dư khả dụng",
        detail: row.clearedAt ? `Chuyển sang số dư khả dụng ngày ${formatDateVN(row.clearedAt)}.` : "Đã chuyển sang số dư khả dụng.",
        tone: "done",
      };
    case "not_credited":
      return {
        label: "Chưa ghi vào ví",
        detail: "Khoản này chưa được ghi vào ví nên không nằm trong số dư hay tổng thu nhập. Liên hệ admin để đối soát.",
        tone: "warning",
      };
    default:
      return { label: "Đã ghi nhận", detail: "", tone: "done" };
  }
}

export function incomeTitle(row) {
  if (row?.source === "course") return row.courseTitle ? `Khóa học "${row.courseTitle}"` : "Bán khóa học";
  if (row?.source === "learning_path") return "Buổi lộ trình học";
  return `Buổi ${sessionTypeLabel(row?.sessionType, "tư vấn 1:1").toLowerCase()}`;
}

export function incomeSubtitle(row) {
  if (row?.source === "course") return "Học viên mua khóa học";
  const parts = [];
  if (row?.counterpartyName) parts.push(`Học viên ${row.counterpartyName}`);
  const when = [row?.sessionDate, row?.sessionTime].filter(Boolean).join(" ");
  if (when) parts.push(when);
  return parts.join(" · ");
}

export function withdrawTitle(row) {
  const account = [row?.bankName, row?.accountMasked].filter(Boolean).join(" ");
  return account ? `Rút tiền về ${account}` : "Rút tiền";
}
