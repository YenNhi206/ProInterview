import { authedFetch } from "./authedJson.js";

/**
 * AI-10: gợi ý mentor, khóa học, job cho ứng viên đang đăng nhập.
 * GET /api/recommendations/me?limit= (1–10, mặc định 5) → `{ success, recommendations }`.
 */
export function fetchMyRecommendations({ limit } = {}) {
  const qs = Number.isInteger(limit) ? `?limit=${limit}` : "";
  return authedFetch(`/api/recommendations/me${qs}`, { method: "GET" });
}
