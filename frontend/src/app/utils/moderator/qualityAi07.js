/**
 * AI-07: hiển thị khối "Rubric doanh nghiệp" và "Đổi version prompt" trên `/moderator/quality`
 * (API `GET /api/moderator/quality/stats` → `stats.rubrics`, `stats.promptVersionChanges`).
 */
import { formatHours, formatRate } from "./moderationLabels.js";

const PROMPT_LABEL = { evaluation: "Chấm điểm", question_gen: "Sinh câu hỏi" };
export const promptKeyLabel = (key) => PROMPT_LABEL[key] ?? key ?? "—";

/** "10% (1/10)"; chưa có dữ liệu → "Chưa có dữ liệu"; không biết version → "—". */
export function correctionText(side) {
  if (!side) return "—";
  if (!side.sample) return "Chưa có dữ liệu";
  return `${formatRate(side.rate, 1)} (${side.corrected}/${side.sample})`;
}

/**
 * Chênh tỉ lệ bị sửa (sau − trước). Giảm là tốt hơn.
 * @returns {{ text: string, tone: "better"|"worse"|"same"|null }}
 */
export function rateDeltaBadge(delta) {
  if (delta === null || delta === undefined || Number.isNaN(Number(delta))) return { text: "—", tone: null };
  const points = Math.round(Number(delta) * 1000) / 10;
  if (points === 0) return { text: "Không đổi", tone: "same" };
  const text = `${points > 0 ? "+" : ""}${points.toLocaleString("vi-VN")} điểm %`;
  return { text, tone: points < 0 ? "better" : "worse" };
}

/** Câu mô tả lần đổi: "Bật eval-v2 (thay eval-v1)" / "Rollback về eval-v1 (bỏ eval-v2)". */
export function changeTitle(change) {
  const to = change?.toVersion ?? "—";
  const from = change?.fromVersion;
  if (change?.change === "rollback") return `Rollback về ${to}${from ? ` (bỏ ${from})` : ""}`;
  return `Bật ${to}${from ? ` (thay ${from})` : ""}`;
}

/** Dòng phụ cho thẻ thời gian duyệt rubric. */
export function rubricReviewHint(rubrics) {
  if (!rubrics) return "";
  const parts = [`${rubrics.reviewedInPeriod ?? 0} rubric đã xử lý trong kỳ`];
  if (rubrics.withoutSubmitTime) parts.push(`${rubrics.withoutSubmitTime} rubric gửi trước khi có mốc gửi duyệt, không tính`);
  return parts.join(" · ");
}

/** Dòng phụ cho thẻ rubric chờ duyệt. */
export function rubricPendingHint(rubrics) {
  if (!rubrics) return "";
  if (!rubrics.pendingReview) return "Không có rubric nào đang chờ";
  return `${rubrics.pendingOver7d ?? 0} chờ quá 7 ngày · lâu nhất ${formatHours(rubrics.oldestPendingHours)}`;
}
