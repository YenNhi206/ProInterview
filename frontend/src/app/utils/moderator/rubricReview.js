/**
 * CO-09: logic thuần cho cảnh báo AI trong màn duyệt rubric `/moderator/rubrics` (có test).
 *
 * `rubric.aiReview` (backend `services/rubricReviewService.js`): `{ status pending | done | failed | null,
 * summary, flags[{ code, severity info | warning | critical, criterionIndex (0-based) | null, message,
 * evidence, suggestedShrmKey, source rule | ai }], error, at }`.
 */

export const REVIEW_FLAG_LABELS = {
  // luật
  no_criteria: "Chưa có tiêu chí",
  weight_sum: "Tổng trọng số",
  invalid_shrm_key: "Năng lực không hợp lệ",
  duplicate_shrm_key: "Trùng năng lực",
  duplicate_name: "Trùng tên tiêu chí",
  missing_level: "Thiếu mô tả mức",
  duplicate_level: "Hai mức giống nhau",
  short_level: "Mô tả mức quá ngắn",
  copied_scale: "Chép thang của tiêu chí khác",
  // AI
  shrm_mismatch: "Map sai năng lực SHRM",
  vague_scale: "Thang mơ hồ",
  overlapping_levels: "Các mức chồng lấn",
  non_progressive_scale: "Thang không tăng dần",
  duplicate_criteria: "Tiêu chí đo trùng nhau",
};

export const SEVERITY_META = {
  critical: { label: "Nghiêm trọng", rank: 0 },
  warning: { label: "Cảnh báo", rank: 1 },
  info: { label: "Lưu ý", rank: 2 },
};

export const flagLabel = (code) => REVIEW_FLAG_LABELS[code] || code;

const rankOf = (f) => SEVERITY_META[f?.severity]?.rank ?? 3;

/**
 * Chia cờ thành cờ chung (không gắn tiêu chí) và cờ theo từng tiêu chí; đếm theo mức độ.
 * @returns {{ general: object[], byCriterion: Record<number, object[]>, counts: { critical: number, warning: number, info: number }, total: number }}
 */
export function groupReviewFlags(aiReview, criteriaCount = Infinity) {
  const flags = Array.isArray(aiReview?.flags) ? [...aiReview.flags].sort((a, b) => rankOf(a) - rankOf(b)) : [];
  const general = [];
  const byCriterion = {};
  const counts = { critical: 0, warning: 0, info: 0 };
  for (const f of flags) {
    if (f.severity in counts) counts[f.severity] += 1;
    const i = Number.isInteger(f.criterionIndex) && f.criterionIndex >= 0 && f.criterionIndex < criteriaCount ? f.criterionIndex : null;
    if (i === null) general.push(f);
    else (byCriterion[i] ??= []).push(f);
  }
  return { general, byCriterion, counts, total: flags.length };
}

/** Dòng trạng thái của lần kiểm tra AI, hoặc "" khi đã xong bình thường. */
export function reviewStatusText(aiReview) {
  switch (aiReview?.status) {
    case "pending":
      return "AI đang kiểm tra rubric…";
    case "failed":
      return `${aiReview.error || "AI chưa kiểm tra được rubric."} Cảnh báo bên dưới chỉ gồm phần kiểm tra theo luật.`;
    case "done":
      return "";
    default:
      return "Rubric này chưa được AI kiểm tra.";
  }
}

/** Nhãn ngắn cho cột danh sách: "2 nghiêm trọng · 1 cảnh báo", "Không có cảnh báo", hoặc "" khi chưa kiểm tra. */
export function reviewBadgeText(aiReview) {
  if (!aiReview?.status || aiReview.status === "pending") return "";
  const { counts, total } = groupReviewFlags(aiReview);
  if (!total) return "Không có cảnh báo";
  return [
    counts.critical && `${counts.critical} nghiêm trọng`,
    counts.warning && `${counts.warning} cảnh báo`,
    counts.info && `${counts.info} lưu ý`,
  ].filter(Boolean).join(" · ");
}
