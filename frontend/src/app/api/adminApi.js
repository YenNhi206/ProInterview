import { authFetch, hasAuthCredentials } from "../utils/auth/auth.js";

const jsonHeaders = {
  Accept: "application/json",
  "Content-Type": "application/json",
};

const ERROR_MESSAGES = {
  UNAUTHENTICATED: "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.",
  NETWORK: "Không thể kết nối máy chủ. Vui lòng thử lại.",
};

function normalizeApiError(body, status) {
  const raw = String(body?.error || "").trim();
  if (raw) return raw;
  if (status === 401 || status === 403) return ERROR_MESSAGES.UNAUTHENTICATED;
  return `Yêu cầu thất bại (mã ${status}). Vui lòng thử lại.`;
}

function authedFetch(path, options = {}) {
  if (!hasAuthCredentials()) {
    return Promise.resolve({ success: false, error: ERROR_MESSAGES.UNAUTHENTICATED });
  }
  return authFetch(path, {
    ...options,
    headers: { ...jsonHeaders, ...options.headers },
  })
    .then(async (res) => {
      const body = await res.json().catch(() => ({}));
      if (!res.ok) return { success: false, error: normalizeApiError(body, res.status) };
      return { success: true, ...body };
    })
    .catch(() => ({ success: false, error: ERROR_MESSAGES.NETWORK }));
}

export const adminApi = {
  getStats: () => authedFetch("/api/admin/stats"),
  getMentors: () => authedFetch("/api/admin/mentors"),
  getMentorById: (id) => authedFetch(`/api/admin/mentors/${encodeURIComponent(id)}`),
  updateMentorStatus: (id, isActive) =>
    authedFetch(`/api/admin/mentors/${id}/status`, {
      method: "PATCH",
      body: JSON.stringify({ isActive }),
    }),
  rejectMentorApplication: (id, reason) =>
    authedFetch(`/api/admin/mentors/${id}/reject`, {
      method: "PATCH",
      body: JSON.stringify({ reason }),
    }),
  updateMentorCommission: (id, payload = {}) =>
    authedFetch(`/api/admin/mentors/${id}/commission`, {
      method: "PATCH",
      body: JSON.stringify(payload ?? {}),
    }),
  approveMentorPrice: (id) =>
    authedFetch(`/api/admin/mentors/${id}/approve-price`, {
      method: "POST",
    }),
  rejectMentorPrice: (id) =>
    authedFetch(`/api/admin/mentors/${id}/reject-price`, {
      method: "POST",
    }),
  getUsers: () => authedFetch("/api/admin/users"),
  getUserById: (id) => authedFetch(`/api/admin/users/${encodeURIComponent(id)}`),
  updateUserStatus: (id, isActive) =>
    authedFetch(`/api/admin/users/${id}/status`, {
      method: "PATCH",
      body: JSON.stringify({ isActive }),
    }),
  /**
   * Import một người dùng + CV từ Google Form.
   * Cung cấp `file` (PDF trên máy) HOẶC `cvUrl` (link Google Drive public).
   * @param {{ email: string, name: string, field: string, file?: File, cvUrl?: string }} params
   */
  importUserCv: ({ email, name, field, file, cvUrl }) => {
    if (!hasAuthCredentials()) {
      return Promise.resolve({ success: false, error: ERROR_MESSAGES.UNAUTHENTICATED });
    }
    const formData = new FormData();
    formData.append("email", email);
    formData.append("name", name || "");
    formData.append("field", field || "IT / Công nghệ");
    if (file) {
      formData.append("file", file, file.name);
    } else if (cvUrl) {
      formData.append("cvUrl", cvUrl);
    }
    return authFetch("/api/admin/users/import-cv", { method: "POST", body: formData })
      .then(async (res) => {
        const body = await res.json().catch(() => ({}));
        if (!res.ok) return { success: false, error: normalizeApiError(body, res.status) };
        return { success: true, ...body };
      })
      .catch(() => ({ success: false, error: ERROR_MESSAGES.NETWORK }));
  },

  getBookings: () => authedFetch("/api/admin/bookings"),
  getBookingById: (id) => authedFetch(`/api/admin/bookings/${encodeURIComponent(id)}`),
  getTransactionSupport: () => authedFetch("/api/admin/system/transaction-support"),
  getSystemOverview: () => authedFetch("/api/admin/system/overview"),
  getContentStats: () => authedFetch("/api/admin/content/stats"),
  getRecentInterviewSessions: (limit = 30) =>
    authedFetch(`/api/admin/content/interview-sessions?limit=${encodeURIComponent(limit)}`),
  getCourseMediaOverview: (scope = "all") =>
    authedFetch(`/api/admin/content/course-media?scope=${encodeURIComponent(scope)}`),
  updateBookingStatus: (id, status, reason = "") =>
    authedFetch(`/api/admin/bookings/${id}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status, reason }),
    }),
  /** Ngoại lệ khi SePay không khớp — mặc định dùng webhook SePay. */
  confirmBookingTransferPayment: (id, body = {}) =>
    authedFetch(`/api/admin/bookings/${id}/confirm-transfer-payment`, {
      method: "PATCH",
      body: JSON.stringify(body ?? {}),
    }),
  confirmBookingRefund: (id) =>
    authedFetch(`/api/admin/bookings/${id}/confirm-refund`, {
      method: "PATCH",
      body: JSON.stringify({}),
    }),
  getPendingEnrollmentTransfers: () => authedFetch("/api/admin/enrollments/pending-transfer"),
  getCoursePaymentEnrollments: () => authedFetch("/api/admin/enrollments/course-payments"),
  getCourseFinanceSummary: () => authedFetch("/api/admin/finance/courses"),
  getPlatformFinanceSummary: (params = {}) => {
    const q = new URLSearchParams();
    if (params.month) q.set("month", params.month);
    const qs = q.toString();
    return authedFetch(`/api/admin/finance/platform-summary${qs ? `?${qs}` : ""}`);
  },
  confirmEnrollmentTransferPayment: (id, body = {}) =>
    authedFetch(`/api/admin/enrollments/${id}/confirm-transfer-payment`, {
      method: "PATCH",
      body: JSON.stringify(body ?? {}),
    }),
  normalizeTransferRefs: (body = {}) =>
    authedFetch("/api/admin/payments/normalize-transfer-refs", {
      method: "POST",
      body: JSON.stringify(body ?? {}),
    }),
  getPendingSubscriptionPayments: () => authedFetch("/api/admin/payments/subscription-pending"),
  confirmSubscriptionTransferPayment: (paymentId, body = {}) =>
    authedFetch(`/api/admin/payments/${paymentId}/confirm-subscription-transfer`, {
      method: "PATCH",
      body: JSON.stringify(body ?? {}),
    }),
  getPayouts: () => authedFetch("/api/admin/payouts"),
  approvePayout: (id, note = "") =>
    authedFetch(`/api/admin/payouts/${id}/approve`, {
      method: "PATCH",
      body: JSON.stringify({ note }),
    }),
  rejectPayout: (id, reason = "") =>
    authedFetch(`/api/admin/payouts/${id}/reject`, {
      method: "PATCH",
      body: JSON.stringify({ reason }),
    }),
  markPayoutPaid: (id, body = {}) =>
    authedFetch(`/api/admin/payouts/${id}/mark-paid`, {
      method: "PATCH",
      body: JSON.stringify(body ?? {}),
    }),
  getPendingCourses: () => authedFetch("/api/admin/courses/pending"),
  getPublishedCourses: (limit = 50) =>
    authedFetch(`/api/admin/courses/published?limit=${encodeURIComponent(limit)}`),
  approveCourse: (id) =>
    authedFetch(`/api/admin/courses/${id}/approve`, {
      method: "PATCH",
    }),
  rejectCourse: (id, reason) =>
    authedFetch(`/api/admin/courses/${id}/reject`, {
      method: "PATCH",
      body: JSON.stringify({ reason }),
    }),
  archiveCourse: (id, reason = "") =>
    authedFetch(`/api/admin/courses/${id}/archive`, {
      method: "PATCH",
      body: JSON.stringify({ reason }),
    }),
  getReports: (params = {}) => {
    const q = new URLSearchParams();
    if (params.status) q.set("status", params.status);
    if (params.open) q.set("open", "true");
    if (params.closed) q.set("closed", "true");
    if (params.targetType) q.set("targetType", params.targetType);
    if (params.page) q.set("page", String(params.page));
    if (params.limit) q.set("limit", String(params.limit));
    const qs = q.toString();
    return authedFetch(`/api/admin/reports${qs ? `?${qs}` : ""}`);
  },
  updateReportStatus: (id, body) =>
    authedFetch(`/api/admin/reports/${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    }),
  getReviews: (params = {}) => {
    const q = new URLSearchParams();
    if (params.targetType) q.set("targetType", params.targetType);
    if (params.limit) q.set("limit", String(params.limit));
    if (params.page) q.set("page", String(params.page));
    if (params.visible) q.set("visible", params.visible);
    const qs = q.toString();
    return authedFetch(`/api/admin/reviews${qs ? `?${qs}` : ""}`);
  },
  setReviewVisibility: (id, isVisible) =>
    authedFetch(`/api/admin/reviews/${encodeURIComponent(id)}/visibility`, {
      method: "PATCH",
      body: JSON.stringify({ isVisible }),
    }),
  getUserBehavior: (days = 7) =>
    authedFetch(`/api/admin/analytics/user-behavior?days=${encodeURIComponent(days)}`),
  getUserJourney: (userId, params = {}) => {
    const q = new URLSearchParams();
    if (params.days) q.set("days", String(params.days));
    if (params.limit) q.set("limit", String(params.limit));
    const qs = q.toString();
    return authedFetch(
      `/api/admin/analytics/users/${encodeURIComponent(userId)}/journey${qs ? `?${qs}` : ""}`,
    );
  },
};
