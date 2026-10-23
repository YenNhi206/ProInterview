/**
 * Nhãn + định dạng cho khu vực Moderator HITL (/moderator/questions, /queue, /quality).
 * COMPETENCIES phải khớp key của COMPETENCY_LIBRARY (backend/src/services/competencyFramework.js) —
 * backend validate competencyId theo danh sách đó.
 */
export const COMPETENCIES = [
  { id: "problem_solving", label: "Giải quyết vấn đề & Tư duy phản biện" },
  { id: "communication", label: "Giao tiếp & Trình bày" },
  { id: "teamwork", label: "Làm việc nhóm & Cộng tác" },
  { id: "leadership", label: "Lãnh đạo & Tạo ảnh hưởng" },
  { id: "adaptability", label: "Thích nghi & Phục hồi" },
  { id: "technical_learning", label: "Học hỏi kỹ thuật & Tự phát triển" },
  { id: "planning_execution", label: "Lập kế hoạch & Thực thi" },
  { id: "innovation", label: "Đổi mới & Sáng tạo" },
  { id: "customer_focus", label: "Định hướng khách hàng" },
  { id: "integrity", label: "Chính trực & Đạo đức" },
  { id: "accountability", label: "Trách nhiệm & Chủ động" },
  { id: "data_driven_decision", label: "Ra quyết định dựa trên dữ liệu" },
  { id: "stakeholder_management", label: "Quản lý kỳ vọng & Đàm phán" },
  { id: "conflict_resolution", label: "Giải quyết xung đột" },
  { id: "coaching_development", label: "Phát triển & Coaching người khác" },
  { id: "strategic_thinking", label: "Tư duy chiến lược" },
  { id: "emotional_intelligence", label: "Trí tuệ cảm xúc" },
  { id: "results_orientation", label: "Định hướng kết quả" },
  { id: "risk_management", label: "Quản lý rủi ro" },
  { id: "cross_functional_influence", label: "Tạo ảnh hưởng liên phòng ban" },
];

const COMPETENCY_LABEL = Object.fromEntries(COMPETENCIES.map((c) => [c.id, c.label]));
export function competencyLabel(id) {
  return COMPETENCY_LABEL[id] || id || "—";
}

export const QUESTION_STATUS = {
  pending_review: { label: "Chờ duyệt", className: "bg-amber-50 text-amber-800 border-amber-200" },
  approved: { label: "Đã duyệt", className: "bg-emerald-50 text-emerald-800 border-emerald-200" },
  deprecated: { label: "Đã khai tử", className: "bg-slate-100 text-slate-600 border-slate-200" },
};

export const QUESTION_SOURCE = {
  baseline: "Baseline",
  llm_followup: "LLM follow-up",
  moderator: "Moderator",
  org_template: "Template tổ chức",
};

export const QUEUE_TYPE = {
  question_report: "Báo sai câu hỏi",
  evaluation_report: "Báo sai điểm chấm",
  evaluation_incomplete: "Chấm thiếu tiêu chí",
};

export const QUEUE_STATUS = {
  open: "Mới",
  in_review: "Đang xử lý",
  resolved: "Đã xử lý",
  dismissed: "Bác bỏ",
};

export const QUEUE_PRIORITY = {
  high: { label: "Cao", className: "bg-red-50 text-red-700 border-red-200" },
  normal: { label: "Thường", className: "bg-violet-50 text-violet-700 border-violet-200" },
  low: { label: "Thấp", className: "bg-slate-100 text-slate-600 border-slate-200" },
};

export const REASON_CODE = {
  irrelevant: "Không liên quan",
  inaccurate_scoring: "Chấm điểm sai",
  hallucination: "Bịa thông tin",
  offensive: "Phản cảm",
  other: "Khác",
};

export const SCORE_DIMENSIONS = [
  { id: "clarity", label: "Rõ ràng" },
  { id: "structure", label: "Cấu trúc" },
  { id: "relevance", label: "Liên quan" },
  { id: "credibility", label: "Thuyết phục" },
];

export const SHRM_LEVELS = [
  { id: "excellent", label: "Xuất sắc" },
  { id: "proficient", label: "Tốt" },
  { id: "developing", label: "Cần cải thiện" },
];

/** Tỉ lệ 0–1 → "75%"; null (mẫu số 0) → "—". */
export function formatRate(value, digits = 0) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return "—";
  return `${(Number(value) * 100).toFixed(digits)}%`;
}

/** Số giờ → "4 giờ" / "35 phút"; null → "—". */
export function formatHours(hours) {
  if (hours === null || hours === undefined) return "—";
  if (hours < 1) return `${Math.round(hours * 60)} phút`;
  return `${Math.round(hours * 10) / 10} giờ`;
}

export function formatDateTime(value) {
  if (!value) return "—";
  return new Date(value).toLocaleString("vi-VN", { dateStyle: "short", timeStyle: "short" });
}
