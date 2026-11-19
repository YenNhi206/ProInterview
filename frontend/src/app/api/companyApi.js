import { authedFetch } from "./authedJson.js";

function toQuery(params = {}) {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v != null && v !== "") q.set(k, String(v));
  }
  const s = q.toString();
  return s ? `?${s}` : "";
}

export const companyApi = {
  // ── Admin: Quản lý công ty (CO-01 & CO-02) ──
  listCompanies: (params = {}) => authedFetch(`/api/admin/companies${toQuery(params)}`),
  getCompany: (id) => authedFetch(`/api/admin/companies/${id}`),
  createCompany: (data) =>
    authedFetch("/api/admin/companies", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  updateCompany: (id, data) =>
    authedFetch(`/api/admin/companies/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),
  toggleCompanyStatus: (id, status) =>
    authedFetch(`/api/admin/companies/${id}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    }),
  inviteModerator: (companyId, email) =>
    authedFetch(`/api/admin/companies/${companyId}/invites`, {
      method: "POST",
      body: JSON.stringify({ email }),
    }),

  // ── Company Moderator: Không gian làm việc (CO-03, CO-05, CO-07, CO-12) ──
  getProfile: () => authedFetch("/api/company/profile"),
  getDashboardStats: () => authedFetch("/api/company/dashboard"),

  // Câu hỏi
  listQuestions: (params = {}) => authedFetch(`/api/company/questions${toQuery(params)}`),
  createQuestion: (data) =>
    authedFetch("/api/company/questions", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  generateStarterQuestions: (data = {}) =>
    authedFetch("/api/company/questions/generate-starter", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  batchApproveQuestions: (ids, reason = "") =>
    authedFetch("/api/company/questions/batch-approve", {
      method: "POST",
      body: JSON.stringify({ ids, reason }),
    }),
  batchRejectQuestions: (ids, reason = "") =>
    authedFetch("/api/company/questions/batch-reject", {
      method: "POST",
      body: JSON.stringify({ ids, reason }),
    }),
  editQuestion: (id, data) =>
    authedFetch(`/api/company/questions/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),
  approveQuestion: (id, reason = "") =>
    authedFetch(`/api/company/questions/${id}/approve`, {
      method: "POST",
      body: JSON.stringify({ reason }),
    }),
  rejectQuestion: (id, reason = "") =>
    authedFetch(`/api/company/questions/${id}/reject`, {
      method: "POST",
      body: JSON.stringify({ reason }),
    }),

  // Rubric
  listRubrics: (params = {}) => authedFetch(`/api/company/rubrics${toQuery(params)}`),
  getRubric: (id) => authedFetch(`/api/company/rubrics/${id}`),
  createRubric: (data) =>
    authedFetch("/api/company/rubrics", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  updateRubric: (id, data) =>
    authedFetch(`/api/company/rubrics/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),
  submitRubric: (id) =>
    authedFetch(`/api/company/rubrics/${id}/submit`, {
      method: "POST",
    }),

  // ── Platform Moderator: Duyệt Rubric (CO-08 & CO-15) ──
  listModeratorRubrics: (params = {}) => authedFetch(`/api/moderator/rubrics${toQuery(params)}`),
  getModeratorRubric: (id) => authedFetch(`/api/moderator/rubrics/${id}`),
  approveModeratorRubric: (id, comment = "") =>
    authedFetch(`/api/moderator/rubrics/${id}/approve`, {
      method: "POST",
      body: JSON.stringify({ comment }),
    }),
  rejectModeratorRubric: (id, comment = "") =>
    authedFetch(`/api/moderator/rubrics/${id}/reject`, {
      method: "POST",
      body: JSON.stringify({ comment }),
    }),

  // ── Public: Nhận lời mời (CO-02 & CO-11) ──
  verifyInvite: (token) => fetch(`/api/company-invites/verify/${encodeURIComponent(token)}`).then((r) => r.json()),
  acceptInvite: (data) =>
    fetch("/api/company-invites/accept", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    }).then((r) => r.json()),
};
