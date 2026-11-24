/**
 * JB-14: phần "điểm theo rubric doanh nghiệp" của một câu trên trang Feedback phỏng vấn.
 * Dữ liệu từ `POST /api/interviews/sessions/:id/evaluate` (JB-07): câu doanh nghiệp có `company`,
 * `rubricStatus`, `rubricScores[]`; câu khác không có các trường này.
 */

export const RUBRIC_SCORE_MAX = 5;

/** Thông báo khi chưa có điểm theo tiêu chí. `scored` không có thông báo. */
export const RUBRIC_STATUS_MESSAGES = {
  pending: "Đang chấm theo tiêu chí của doanh nghiệp. Tải lại trang sau ít phút để xem kết quả.",
  failed: "Chưa chấm được theo tiêu chí của doanh nghiệp. Tải lại trang sau ít phút, hệ thống sẽ chấm lại.",
  no_answer: "Bạn chưa trả lời câu này nên chưa có điểm theo tiêu chí của doanh nghiệp.",
};

function clampScore(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return null;
  return Math.min(RUBRIC_SCORE_MAX, Math.max(0, n));
}

/**
 * Điểm trung bình theo trọng số (0–5, làm tròn 1 chữ số). Không có trọng số thì trung bình cộng.
 * @returns {number|null}
 */
export function weightedRubricAverage(criteria) {
  const rows = (criteria ?? []).filter((c) => c.score !== null);
  if (!rows.length) return null;
  const totalWeight = rows.reduce((s, c) => s + (c.weight > 0 ? c.weight : 0), 0);
  const avg = totalWeight > 0
    ? rows.reduce((s, c) => s + c.score * (c.weight > 0 ? c.weight : 0), 0) / totalWeight
    : rows.reduce((s, c) => s + c.score, 0) / rows.length;
  return Math.round(avg * 10) / 10;
}

/**
 * Chuẩn hóa phần rubric của một câu. Câu không phải của doanh nghiệp (không có `company`) → null,
 * để trang Feedback không hiện phần này.
 */
export function companyRubricView(evalQ) {
  const company = evalQ?.company;
  if (!company || typeof company !== "object") return null;
  const status = ["scored", "no_answer", "failed", "pending"].includes(evalQ.rubricStatus) ? evalQ.rubricStatus : "pending";
  const criteria = (Array.isArray(evalQ.rubricScores) ? evalQ.rubricScores : [])
    .map((r, i) => ({
      key: String(r?.criterionKey ?? i),
      name: String(r?.criterionName || r?.shrmKey || `Tiêu chí ${i + 1}`),
      score: clampScore(r?.score),
      weight: Number(r?.weight) || 0,
      quote: String(r?.evidenceQuote ?? "").trim(),
    }))
    .filter((c) => c.score !== null);
  const scored = status === "scored" && criteria.length > 0;
  return {
    companyName: String(company.name || "Doanh nghiệp"),
    status: scored ? "scored" : status === "scored" ? "failed" : status,
    message: scored ? "" : RUBRIC_STATUS_MESSAGES[status === "scored" ? "failed" : status],
    criteria: scored ? criteria : [],
    average: scored ? weightedRubricAverage(criteria) : null,
  };
}

/** Màu thanh điểm theo mức (0–5), dùng chung ngưỡng với điểm STAR trên trang. */
export function rubricScoreTone(score) {
  if (score >= 4) return "high";
  if (score >= 3) return "mid";
  return "low";
}
