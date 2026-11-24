import { authedFetch } from "./authedJson.js";

/**
 * Ứng tuyển (JB-08) và chỉ số ứng viên với doanh nghiệp (JB-19). Chỉ ứng viên (role customer).
 * Mọi hàm trả `{ success, ... }` hoặc `{ success: false, error }` tiếng Việt từ backend.
 */

/** POST /api/jobs/:id/apply `{ cvId, consent: true }` → `{ application }`. */
export const applyToJob = (jobId, { cvId }) =>
  authedFetch(`/api/jobs/${encodeURIComponent(jobId)}/apply`, {
    method: "POST",
    body: JSON.stringify({ cvId, consent: true }),
  });

/** GET /api/applications/me → `{ applications[] }` mới nhất trước. */
export const listMyApplications = () => authedFetch("/api/applications/me", { method: "GET" });

/** PATCH /api/applications/:id/withdraw → `{ application }`. */
export const withdrawApplication = (id) =>
  authedFetch(`/api/applications/${encodeURIComponent(id)}/withdraw`, { method: "PATCH", body: "{}" });

/** GET /api/profile/me/company-metrics/:companyId → `{ metrics }` (JB-19). */
export const getMyCompanyMetrics = (companyId) =>
  authedFetch(`/api/profile/me/company-metrics/${encodeURIComponent(companyId)}`, { method: "GET" });
