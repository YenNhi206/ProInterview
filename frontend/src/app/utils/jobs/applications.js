/**
 * Hàm thuần cho ứng tuyển (JB-12 phần 2) và trang `/my-applications` (JB-13).
 * Trạng thái đơn khớp `APPLICATION_STATUSES` ở backend/src/models/Application.js.
 */

export const APPLICATION_STATUSES = ["submitted", "viewed", "shortlisted", "rejected", "withdrawn"];

/** Nhãn dự phòng khi API thiếu `statusLabel` (giống STATUS_LABEL ở applicationsService.js). */
export const APPLICATION_STATUS_LABELS = {
  submitted: "Đã nộp",
  viewed: "Nhà tuyển dụng đã xem",
  shortlisted: "Vào danh sách chọn",
  rejected: "Chưa phù hợp",
  withdrawn: "Đã rút",
};

/** Màu nhãn trạng thái: info (đang chờ), good, bad, muted. */
export const APPLICATION_STATUS_TONE = {
  submitted: "info",
  viewed: "info",
  shortlisted: "good",
  rejected: "bad",
  withdrawn: "muted",
};

/** Bộ lọc trên `/my-applications`. */
export const APPLICATION_FILTERS = [
  { value: "all", label: "Tất cả" },
  { value: "active", label: "Đang xét" },
  { value: "shortlisted", label: "Vào danh sách chọn" },
  { value: "closed", label: "Đã kết thúc" },
];

export function statusLabelOf(app) {
  return app?.statusLabel || APPLICATION_STATUS_LABELS[app?.status] || app?.status || "";
}

export function filterApplications(apps, filter) {
  const list = Array.isArray(apps) ? apps : [];
  if (filter === "active") return list.filter((a) => a.status === "submitted" || a.status === "viewed");
  if (filter === "shortlisted") return list.filter((a) => a.status === "shortlisted");
  if (filter === "closed") return list.filter((a) => a.status === "rejected" || a.status === "withdrawn");
  return list;
}

export function countByFilter(apps) {
  return Object.fromEntries(APPLICATION_FILTERS.map((f) => [f.value, filterApplications(apps, f.value).length]));
}

/** Đơn của ứng viên cho một job (mỗi job mỗi người 1 đơn, kể cả đã rút). */
export function applicationForJob(apps, jobId) {
  return (Array.isArray(apps) ? apps : []).find((a) => String(a?.job?.id ?? "") === String(jobId)) ?? null;
}

/** CV chọn được để ứng tuyển: bỏ CV bị đánh dấu không phải CV (PR-03 `isValidCv: false`). */
export function usableCvs(cvs) {
  return (Array.isArray(cvs) ? cvs : []).filter((c) => c && c.id && c.isValidCv !== false);
}

/** CV chọn sẵn: CV mặc định nếu dùng được, không thì CV đầu tiên dùng được. */
export function defaultCvId(cvs) {
  const list = usableCvs(cvs);
  return (list.find((c) => c.isDefault) ?? list[0])?.id ?? "";
}

/** Lỗi form ứng tuyển, "" khi hợp lệ. */
export function applyFormError({ cvId, consent }) {
  if (!cvId) return "Chọn một CV để ứng tuyển.";
  if (consent !== true) return "Bạn cần đồng ý chia sẻ thông tin để ứng tuyển.";
  return "";
}

/** "24/11/2026"; thiếu / sai ngày → "". */
export function formatDateVi(value) {
  if (!value) return "";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString("vi-VN");
}

/** Dòng mốc thời gian mới nhất của đơn, ví dụ "Nộp 20/11/2026 · Đã rút 22/11/2026". */
export function applicationTimeline(app) {
  const parts = [];
  if (app?.submittedAt) parts.push(`Nộp ${formatDateVi(app.submittedAt)}`);
  if (app?.status === "withdrawn" && app.withdrawnAt) parts.push(`Đã rút ${formatDateVi(app.withdrawnAt)}`);
  else if (app?.decidedAt) parts.push(`Có kết quả ${formatDateVi(app.decidedAt)}`);
  else if (app?.viewedAt) parts.push(`Được xem ${formatDateVi(app.viewedAt)}`);
  return parts.join(" · ");
}

/**
 * Chỉ số ứng viên với doanh nghiệp (JB-19) cho trang job. Chưa trả lời câu nào → `empty: true`
 * (trang hiện "Bạn chưa trả lời câu nào của doanh nghiệp này").
 */
export function companyMetricsView(metrics) {
  const answered = Number(metrics?.answeredCount) || 0;
  if (!metrics || answered === 0) return { empty: true };
  const avg = Number(metrics.rubricScoreAvg);
  return {
    empty: false,
    answeredCount: answered,
    questionCount: Number(metrics.questionCount) || answered,
    scoredCount: Number(metrics.scoredCount) || 0,
    pendingScoringCount: Number(metrics.pendingScoringCount) || 0,
    sessionCount: Number(metrics.sessionCount) || 0,
    average: Number.isFinite(avg) && metrics.rubricScoreAvg !== null ? Math.round(avg * 10) / 10 : null,
    lastAnsweredAt: formatDateVi(metrics.lastAnsweredAt),
    criteria: (Array.isArray(metrics.criteria) ? metrics.criteria : [])
      .filter((c) => Number.isFinite(Number(c?.avgScore)) && c.avgScore !== null)
      .map((c) => ({
        key: String(c.criterionKey ?? c.criterionName),
        name: String(c.criterionName || c.shrmKey || "Tiêu chí"),
        avg: Math.round(Number(c.avgScore) * 10) / 10,
        count: Number(c.count) || 0,
      }))
      .sort((a, b) => a.avg - b.avg),
  };
}
