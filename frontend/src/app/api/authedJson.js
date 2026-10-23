import { authFetch, hasAuthCredentials } from "../utils/auth/auth.js";

/**
 * Fetch JSON có Bearer token, luôn resolve về `{ success, ... }` thay vì throw —
 * dùng chung cho các API quản trị (admin, moderator) để lỗi mạng và lỗi HTTP
 * đi qua cùng một đường xử lý ở UI (xem tryApi trong utils/shared/apiToast.js).
 */

const jsonHeaders = {
  Accept: "application/json",
  "Content-Type": "application/json",
};

export const ERROR_MESSAGES = {
  UNAUTHENTICATED: "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.",
  NETWORK: "Không thể kết nối máy chủ. Vui lòng thử lại.",
};

export function normalizeApiError(body, status) {
  const raw = String(body?.error || "").trim();
  if (raw) return raw;
  if (status === 401 || status === 403) return ERROR_MESSAGES.UNAUTHENTICATED;
  return `Yêu cầu thất bại (mã ${status}). Vui lòng thử lại.`;
}

export function authedFetch(path, options = {}) {
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
