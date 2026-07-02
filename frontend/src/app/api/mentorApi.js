import { apiUrl } from "./http.js";
import { authFetch, hasAuthCredentials, getUser } from "../utils/auth/auth.js";

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

/**
 * Danh sách mentor — fetch từ Express + MongoDB (GET /api/mentors).
 */
export async function fetchMentors() {
  try {
    const res = await fetch(apiUrl("/api/mentors"), { headers: jsonHeaders });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return { success: false, error: normalizeApiError(data, res.status), mentors: [] };
    }
    if (data.success && Array.isArray(data.mentors)) {
      return { success: true, mentors: data.mentors };
    }
    return { success: false, error: data.error || "Không tải được danh sách mentor.", mentors: [] };
  } catch {
    return { success: false, error: ERROR_MESSAGES.NETWORK, mentors: [] };
  }
}

/**
 * Một mentor theo id — GET /api/mentors/:id
 */
export async function fetchMentor(id) {
  const res = await fetch(apiUrl(`/api/mentors/${encodeURIComponent(id)}`), {
    headers: jsonHeaders,
  });
  if (res.status === 404) return null;
  if (!res.ok) {
    console.error(`fetchMentor: HTTP ${res.status}`);
    return null;
  }
  const data = await res.json();
  if (data.success && data.mentor) return data.mentor;
  return null;
}

/** Đánh giá công khai theo mentor — GET /api/mentors/:id/reviews */
export async function fetchMentorPublicReviews(mentorId) {
  try {
    const res = await fetch(apiUrl(`/api/mentors/${encodeURIComponent(mentorId)}/reviews`), {
      headers: jsonHeaders,
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      return { success: false, error: body.error || `Lỗi ${res.status}`, reviews: [] };
    }
    return { success: true, reviews: body.reviews || [] };
  } catch {
    return { success: false, error: "Không kết nối được backend.", reviews: [] };
  }
}

export async function fetchMentorAvailability(id) {
  const res = await fetch(apiUrl(`/api/mentors/${encodeURIComponent(id)}/availability`), {
    headers: jsonHeaders,
  });
  if (res.status === 404) return null;
  if (!res.ok) {
    console.error(`fetchMentorAvailability: HTTP ${res.status}`);
    return null;
  }
  const data = await res.json().catch(() => ({}));
  if (data.success && data.availability) return data.availability;
  return null;
}
/**
 * Đăng ký làm mentor mới — POST /api/mentors/apply
 */
export async function applyAsMentor(data) {
  if (!hasAuthCredentials()) return { success: false, error: ERROR_MESSAGES.UNAUTHENTICATED };
  try {
    const res = await authFetch("/api/mentors/apply", {
      method: "POST",
      headers: { ...jsonHeaders },
      body: JSON.stringify(data ?? {}),
    });
    const result = await res.json().catch(() => ({}));
    if (!res.ok) return { success: false, error: normalizeApiError(result, res.status) };
    return { success: true, message: result.message, mentor: result.mentor || null };
  } catch {
    return { success: false, error: ERROR_MESSAGES.NETWORK };
  }
}

export async function updateMyMentorAvailability(payload) {
  if (!hasAuthCredentials()) return { success: false, error: ERROR_MESSAGES.UNAUTHENTICATED };
  try {
    const res = await authFetch("/api/mentors/me/availability", {
      method: "PATCH",
      headers: {
        ...jsonHeaders,
      },
      body: JSON.stringify(payload ?? {}),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return { success: false, error: normalizeApiError(data, res.status) };
    return { success: true, availability: data.availability };
  } catch {
    return { success: false, error: ERROR_MESSAGES.NETWORK };
  }
}

export async function fetchMyMentorProfile() {
  if (!hasAuthCredentials()) return { success: false, error: ERROR_MESSAGES.UNAUTHENTICATED, mentor: null };

  try {
    const res = await authFetch("/api/mentors/me", {
      method: "GET",
      headers: { ...jsonHeaders },
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) return { success: false, error: normalizeApiError(body, res.status), mentor: null };
    return { success: true, mentor: body.mentor || null };
  } catch {
    return { success: false, error: ERROR_MESSAGES.NETWORK, mentor: null };
  }
}

export async function requestMentorPriceChange(newPrice) {
  if (!hasAuthCredentials()) return { success: false, error: ERROR_MESSAGES.UNAUTHENTICATED };
  try {
    const res = await authFetch("/api/mentor/request-price-change", {
      method: "POST",
      headers: { ...jsonHeaders },
      body: JSON.stringify({ newPrice }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return { success: false, error: normalizeApiError(data, res.status) };
    return { success: true, pendingPricePerHour: data.pendingPricePerHour };
  } catch {
    return { success: false, error: ERROR_MESSAGES.NETWORK };
  }
}

export async function updateMyMentorProfile(payload) {
  if (!hasAuthCredentials()) return { success: false, error: ERROR_MESSAGES.UNAUTHENTICATED, mentor: null };
  try {
    const res = await authFetch("/api/mentors/me", {
      method: "PATCH",
      headers: { ...jsonHeaders },
      body: JSON.stringify(payload ?? {}),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) return { success: false, error: normalizeApiError(body, res.status), mentor: null };
    return { success: true, mentor: body.mentor || null };
  } catch {
    return { success: false, error: ERROR_MESSAGES.NETWORK, mentor: null };
  }
}

export async function fetchMentorDashboard() {
  if (!hasAuthCredentials()) return { success: false, error: ERROR_MESSAGES.UNAUTHENTICATED };
  try {
    const res = await authFetch("/api/mentor/dashboard", {
      method: "GET",
      headers: { ...jsonHeaders },
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) return { success: false, error: normalizeApiError(body, res.status) };
    return { success: true, dashboard: body.dashboard || null };
  } catch {
    return { success: false, error: ERROR_MESSAGES.NETWORK };
  }
}

export async function fetchMentorAnalytics() {
  if (!hasAuthCredentials()) return { success: false, error: ERROR_MESSAGES.UNAUTHENTICATED, analytics: null };
  try {
    const res = await authFetch("/api/mentor/analytics", {
      method: "GET",
      headers: { ...jsonHeaders },
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) return { success: false, error: normalizeApiError(body, res.status), analytics: null };
    return { success: true, analytics: body.analytics || null };
  } catch {
    return { success: false, error: ERROR_MESSAGES.NETWORK, analytics: null };
  }
}

export async function fetchMentorFinance() {
  if (!hasAuthCredentials()) return { success: false, error: ERROR_MESSAGES.UNAUTHENTICATED, finance: null };
  try {
    const res = await authFetch("/api/mentor/finance", {
      method: "GET",
      headers: { ...jsonHeaders },
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) return { success: false, error: normalizeApiError(body, res.status), finance: null };
    return { success: true, finance: body.finance || null };
  } catch {
    return { success: false, error: ERROR_MESSAGES.NETWORK, finance: null };
  }
}

export async function requestMentorPayout(amount) {
  if (!hasAuthCredentials()) return { success: false, error: ERROR_MESSAGES.UNAUTHENTICATED };
  try {
    const res = await authFetch("/api/mentor/payout", {
      method: "POST",
      headers: { ...jsonHeaders },
      body: JSON.stringify({ amount }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) return { success: false, error: normalizeApiError(body, res.status) };
    return { success: true, payout: body.payout };
  } catch {
    return { success: false, error: ERROR_MESSAGES.NETWORK };
  }
}

export async function updateMentorPayoutAccount(payload) {
  if (!hasAuthCredentials()) return { success: false, error: ERROR_MESSAGES.UNAUTHENTICATED };
  try {
    const res = await authFetch("/api/mentor/payout-account", {
      method: "PATCH",
      headers: { ...jsonHeaders },
      body: JSON.stringify(payload ?? {}),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) return { success: false, error: normalizeApiError(body, res.status) };
    return {
      success: true,
      payoutAccountMasked: body.payoutAccountMasked || null,
      payoutAccountBankName: body.payoutAccountBankName || null,
      payoutAccountOwnerName: body.payoutAccountOwnerName || null,
    };
  } catch {
    return { success: false, error: ERROR_MESSAGES.NETWORK };
  }
}

export async function fetchMentorPeerReviews() {
  if (!hasAuthCredentials()) return { success: false, error: ERROR_MESSAGES.UNAUTHENTICATED, items: [] };
  try {
    const res = await authFetch("/api/mentor/peer-reviews", {
      method: "GET",
      headers: { ...jsonHeaders },
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) return { success: false, error: normalizeApiError(body, res.status), items: [] };
    return { success: true, items: body.items || [] };
  } catch {
    return { success: false, error: ERROR_MESSAGES.NETWORK, items: [] };
  }
}

export async function submitMentorPeerReview(courseId, payload) {
  if (!hasAuthCredentials()) return { success: false, error: ERROR_MESSAGES.UNAUTHENTICATED };
  try {
    const res = await authFetch(`/api/mentor/peer-reviews/${encodeURIComponent(courseId)}`, {
      method: "POST",
      headers: { ...jsonHeaders },
      body: JSON.stringify(payload ?? {}),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) return { success: false, error: normalizeApiError(body, res.status) };
    return { success: true, review: body.review || null };
  } catch {
    return { success: false, error: ERROR_MESSAGES.NETWORK };
  }
}

export async function fetchMentorReviews() {
  if (!hasAuthCredentials()) return { success: false, error: ERROR_MESSAGES.UNAUTHENTICATED, items: [] };
  try {
    const res = await authFetch("/api/mentor/reviews", {
      method: "GET",
      headers: { ...jsonHeaders },
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) return { success: false, error: normalizeApiError(body, res.status), items: [] };
    return { success: true, items: body.items || [], summary: body.summary || null };
  } catch {
    return { success: false, error: ERROR_MESSAGES.NETWORK, items: [] };
  }
}
