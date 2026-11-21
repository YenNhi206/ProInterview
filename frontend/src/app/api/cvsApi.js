import { authedFetch, ERROR_MESSAGES, normalizeApiError } from "./authedJson.js";
import { authFetch, hasAuthCredentials } from "../utils/auth/auth.js";

/** Kho CV của ứng viên — `/api/cvs` (PR-02, backend: routes/cvs.js). Trả `{ success, ... }`, không throw. */
export const cvsApi = {
  list: () => authedFetch("/api/cvs"),
  get: (id) => authedFetch(`/api/cvs/${encodeURIComponent(id)}`),
  update: (id, data) => authedFetch(`/api/cvs/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify(data) }),
  duplicate: (id) => authedFetch(`/api/cvs/${encodeURIComponent(id)}/duplicate`, { method: "POST" }),
  setDefault: (id) => authedFetch(`/api/cvs/${encodeURIComponent(id)}/set-default`, { method: "POST" }),
  remove: (id) => authedFetch(`/api/cvs/${encodeURIComponent(id)}`, { method: "DELETE" }),

  /** multipart: `file` + `title` / `targetRole` tùy chọn. Không đặt Content-Type để trình duyệt tự thêm boundary. */
  upload({ file, title = "", targetRole = "" }) {
    if (!hasAuthCredentials()) return Promise.resolve({ success: false, error: ERROR_MESSAGES.UNAUTHENTICATED });
    const form = new FormData();
    form.append("file", file);
    if (title.trim()) form.append("title", title.trim());
    if (targetRole.trim()) form.append("targetRole", targetRole.trim());
    return authFetch("/api/cvs", { method: "POST", body: form, headers: { Accept: "application/json" } })
      .then(async (res) => {
        const body = await res.json().catch(() => ({}));
        if (!res.ok) return { success: false, error: normalizeApiError(body, res.status) };
        return { success: true, ...body };
      })
      .catch(() => ({ success: false, error: ERROR_MESSAGES.NETWORK }));
  },
};
