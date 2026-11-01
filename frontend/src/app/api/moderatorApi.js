import { authedFetch } from "./authedJson.js";

/**
 * API của kiểm duyệt viên — `/api/moderator/*` (backend: routes/moderator.js).
 * Duyệt khóa học chuyển khỏi adminApi từ package RBAC: admin không còn quyền kiểm duyệt nội dung.
 */
export const moderatorApi = {
  getContentStats: () => authedFetch("/api/moderator/content/stats"),
  getPendingCourses: () => authedFetch("/api/moderator/courses/pending"),
  getPublishedCourses: (limit = 50) =>
    authedFetch(`/api/moderator/courses/published?limit=${encodeURIComponent(limit)}`),
  approveCourse: (id) =>
    authedFetch(`/api/moderator/courses/${id}/approve`, {
      method: "PATCH",
    }),
  rejectCourse: (id, reason) =>
    authedFetch(`/api/moderator/courses/${id}/reject`, {
      method: "PATCH",
      body: JSON.stringify({ reason }),
    }),
  archiveCourse: (id, reason = "") =>
    authedFetch(`/api/moderator/courses/${id}/archive`, {
      method: "PATCH",
      body: JSON.stringify({ reason }),
    }),

  // ── Ngân hàng câu hỏi (HITL) ──
  /** @param {{ status?, competencyId?, source?, q?, sort?, page?, limit? }} params */
  listQuestions: (params = {}) => authedFetch(`/api/moderator/questions${toQuery(params)}`),
  getQuestion: (id) => authedFetch(`/api/moderator/questions/${id}`),
  createQuestion: (body) => authedFetch("/api/moderator/questions", { method: "POST", body: JSON.stringify(body) }),
  editQuestion: (id, { text, competencyId, reason }) =>
    authedFetch(`/api/moderator/questions/${id}`, { method: "PATCH", body: JSON.stringify({ text, competencyId, reason }) }),
  approveQuestion: (id, note = "") =>
    authedFetch(`/api/moderator/questions/${id}/approve`, { method: "PATCH", body: JSON.stringify({ note }) }),
  deprecateQuestion: (id, reason) =>
    authedFetch(`/api/moderator/questions/${id}/deprecate`, { method: "PATCH", body: JSON.stringify({ reason }) }),
  bulkQuestions: (ids, action, reason = "") =>
    authedFetch("/api/moderator/questions/bulk", { method: "POST", body: JSON.stringify({ ids, action, reason }) }),

  // ── Hàng đợi kiểm định ──
  /** @param {{ type?, status?, priority?, assignee?: "me"|"unassigned", page?, limit? }} params */
  listQueue: (params = {}) => authedFetch(`/api/moderator/queue${toQuery(params)}`),
  getQueueItem: (id) => authedFetch(`/api/moderator/queue/${id}`),
  claimQueueItem: (id) => authedFetch(`/api/moderator/queue/${id}/claim`, { method: "PATCH" }),
  /** action: dismiss | deprecate_question | edit_question | override_score */
  resolveQueueItem: (id, { action, note = "", payload }) =>
    authedFetch(`/api/moderator/queue/${id}/resolve`, {
      method: "PATCH",
      body: JSON.stringify({ action, note, ...(payload && { payload }) }),
    }),

  // ── Quality dashboard ──
  getQualityStats: ({ from, to } = {}) => authedFetch(`/api/moderator/quality/stats${toQuery({ from, to })}`),
};

/** Bỏ tham số rỗng — backend validate bằng Joi, chuỗi rỗng ở enum sẽ bị 400. */
function toQuery(params) {
  const entries = Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== "" && v !== "all");
  return entries.length ? `?${new URLSearchParams(entries).toString()}` : "";
}
