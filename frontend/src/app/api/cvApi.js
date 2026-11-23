/**
 * CV analyses — Express `/api/cv/*`
 */
import { authFetch, hasAuthCredentials } from "../utils/auth/auth.js";
import {
  mapAnalysisDocToHistoryItem,
  mapAnalysisDocToUiResult,
} from "../utils/cv/cvMappers.js";

export {
  mapAnalysisDocToHistoryItem,
  mapAnalysisDocToUiResult,
  buildCvAnalysisSavePayload,
  mapPythonCvPipelineToAnalysis,
  filterHighlightKeywords,
  computeCvRemainingFromQuota,
} from "../utils/cv/cvMappers.js";

const jsonHeaders = {
  Accept: "application/json",
  "Content-Type": "application/json",
};

export async function fetchCvQuota() {
  if (!hasAuthCredentials()) return { success: false, quota: null };
  try {
    const res = await authFetch("/api/cv/quota", { method: "GET", headers: { Accept: "application/json" } });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) return { success: false, error: body.error, quota: null };
    return { success: true, quota: body.quota };
  } catch {
    return { success: false, quota: null };
  }
}

export async function fetchCvAnalyses() {
  if (!hasAuthCredentials()) {
    return { success: false, error: "Chưa đăng nhập.", analyses: [] };
  }
  try {
    const res = await authFetch("/api/cv/analyses", { method: "GET", headers: { Accept: "application/json" } });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      return { success: false, error: body.error || `Lỗi ${res.status}`, analyses: [] };
    }
    const raw = body.list || body.analyses || [];
    return {
      success: true,
      analyses: raw.map(mapAnalysisDocToHistoryItem).filter(Boolean),
    };
  } catch {
    return { success: false, error: "Không kết nối được server.", analyses: [] };
  }
}

export async function fetchCvAnalysisById(id) {
  if (!hasAuthCredentials()) {
    return { success: false, error: "Chưa đăng nhập." };
  }
  try {
    const res = await authFetch(`/api/cv/analyses/${encodeURIComponent(id)}`, {
      method: "GET",
      headers: { Accept: "application/json" },
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      return { success: false, error: body.error || `Lỗi ${res.status}` };
    }
    const doc = body.analysis;
    return {
      success: true,
      historyItem: mapAnalysisDocToHistoryItem(doc),
      analysis: mapAnalysisDocToUiResult(doc),
      analysisId: String(doc?._id || id),
    };
  } catch {
    return { success: false, error: "Không kết nối được server." };
  }
}

export async function saveCvAnalysis(payload) {
  if (!hasAuthCredentials()) {
    return { success: false, error: "Chưa đăng nhập." };
  }
  try {
    const res = await authFetch("/api/cv/analyses", {
      method: "POST",
      headers: jsonHeaders,
      body: JSON.stringify(payload),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      const code = body.error || `http_${res.status}`;
      const detailMsg = Array.isArray(body.details)
        ? body.details.map((d) => d.message || d.field).filter(Boolean).join("; ")
        : body.message || "";
      return {
        success: false,
        error: code,
        message: detailMsg || body.error || `Lỗi ${res.status}`,
      };
    }
    const doc = body.analysis;
    return {
      success: true,
      analysisId: String(doc?._id || ""),
      historyItem: mapAnalysisDocToHistoryItem(doc),
    };
  } catch {
    return { success: false, error: "network_error", message: "Không kết nối được server." };
  }
}

/** Thông báo user-facing khi POST /api/cv/analyses thất bại */
export function formatCvSaveError(saveRes) {
  if (!saveRes || saveRes.success) return null;
  if (saveRes.error === "quota_exceeded") {
    return "Đã hết lượt phân tích CV — kết quả hiển thị nhưng không lưu được vào lịch sử. Nâng cấp gói để tiếp tục.";
  }
  if (saveRes.error === "schema_invalid" || saveRes.error === "business_rule_violation") {
    const hint = saveRes.message ? ` (${saveRes.message})` : "";
    return `Kết quả hiển thị nhưng không lưu được lịch sử (lỗi dữ liệu)${hint}. Thử phân tích lại hoặc liên hệ hỗ trợ.`;
  }
  if (saveRes.error === "network_error") {
    return "Kết quả hiển thị nhưng không lưu lịch sử — không kết nối được server.";
  }
  return `Kết quả hiển thị nhưng chưa lưu lịch sử${saveRes.message ? `: ${saveRes.message}` : ""}.`;
}

export async function submitCvFeedback(id, rating) {
  if (!hasAuthCredentials()) return { success: false };
  try {
    const res = await authFetch(`/api/cv/analyses/${encodeURIComponent(id)}/feedback`, {
      method: "PATCH",
      headers: jsonHeaders,
      body: JSON.stringify({ rating }),
    });
    const body = await res.json().catch(() => ({}));
    return res.ok ? { success: true } : { success: false, error: body.error };
  } catch {
    return { success: false };
  }
}

export async function deleteCvAnalysis(id) {
  if (!hasAuthCredentials()) {
    return { success: false, error: "Chưa đăng nhập." };
  }
  try {
    const res = await authFetch(`/api/cv/analyses/${encodeURIComponent(id)}`, {
      method: "DELETE",
      headers: { Accept: "application/json" },
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      return { success: false, error: body.error || `Lỗi ${res.status}` };
    }
    return { success: true };
  } catch {
    return { success: false, error: "Không kết nối được server." };
  }
}

/**
 * PR-12: xếp hạng 2–5 CV trong kho với một JD (`POST /api/cv/best-fit`, PR-05).
 * Body `{ cvIds, jdText }` hoặc `{ cvIds, jobPostId }`. Python có thể mất tới ~60 giây.
 */
export async function bestFitCvs({ cvIds, jdText, jobPostId } = {}) {
  if (!hasAuthCredentials()) return { success: false, error: "Vui lòng đăng nhập." };
  try {
    const res = await authFetch("/api/cv/best-fit", {
      method: "POST",
      headers: jsonHeaders,
      body: JSON.stringify({ cvIds, ...(jobPostId ? { jobPostId } : { jdText }) }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok || !body.success) {
      const fallback = res.status === 403 ? "Bạn đã hết lượt phân tích CV. Vui lòng nâng cấp gói." : res.status >= 502 ? "Dịch vụ phân tích CV đang bận. Thử lại sau ít phút." : `Lỗi ${res.status}`;
      return { success: false, error: body.error || body.message || fallback };
    }
    return { success: true, bestFit: body.bestFit };
  } catch {
    return { success: false, error: "Không kết nối được máy chủ." };
  }
}
