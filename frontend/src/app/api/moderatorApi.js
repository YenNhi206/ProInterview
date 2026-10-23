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
};
