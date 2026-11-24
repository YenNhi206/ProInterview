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

  /** PR-08: tách tệp CV gốc thành `content` cho editor. Trả `{ success, extracted: { content, method, sections, cvVersion } }`, không ghi DB. */
  extractContent: (id) => authedFetch(`/api/cvs/${encodeURIComponent(id)}/extract-content`, { method: "POST" }),

  /** PR-13: các lần phân tích CV đã xong (`list`, mới nhất trước) để lấy gợi ý viết lại bullet. */
  listAnalyses: () => authedFetch("/api/cv/analyses"),

  /** PR-13: tải PDF của CV (PR-09, pdfkit). Trả `{ success, blob }` hoặc `{ success: false, error }`. */
  downloadPdf(id) {
    if (!hasAuthCredentials()) return Promise.resolve({ success: false, error: ERROR_MESSAGES.UNAUTHENTICATED });
    return authFetch(`/api/cvs/${encodeURIComponent(id)}/export-pdf`, { method: "GET", headers: { Accept: "application/pdf" } })
      .then(async (res) => {
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          return { success: false, error: normalizeApiError(body, res.status) };
        }
        return { success: true, blob: await res.blob() };
      })
      .catch(() => ({ success: false, error: ERROR_MESSAGES.NETWORK }));
  },

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
