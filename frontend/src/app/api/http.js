/**
 * Backend gốc — không có dấu / cuối.
 * - Dev: không set VITE_API_URL → "" (gọi /api trên :5173, Vite proxy → backend)
 * - Dev + VITE_API_URL: trỏ thẳng backend (vd. http://localhost:5001)
 * - Prod: set VITE_API_URL=https://prointerview-backend.onrender.com
 */
function resolveApiBase() {
  const env = (typeof import.meta !== "undefined" && import.meta?.env) || {};
  const fromEnv = env.VITE_API_URL;

  if (fromEnv != null && String(fromEnv).trim() !== "") {
    return String(fromEnv).replace(/\/$/, "");
  }

  if (env.DEV) {
    return "";
  }

  // Prod: /api trên cùng domain Vercel → vercel.json rewrite sang Render (tránh lỗi CORS).
  return "";
}

export const API_BASE_URL = resolveApiBase();

/** True khi FE có backend Express (proxy dev hoặc VITE_API_URL prod). */
export function isExpressBackendConfigured() {
  const env = (typeof import.meta !== "undefined" && import.meta?.env) || {};
  if (env.DEV && !(env.VITE_API_URL || "").trim()) {
    return true;
  }
  return Boolean(API_BASE_URL && String(API_BASE_URL).trim());
}

/**
 * URL đầy đủ cho một path API (path bắt đầu bằng /).
 * Ví dụ: apiUrl("/api/mentors")
 * → http://localhost:5000/api/mentors
 */
export function apiUrl(path) {
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${API_BASE_URL}${p}`;
}

export async function apiGet(path) {
  const response = await fetch(apiUrl(path), {
    headers: { Accept: "application/json" },
  });

  if (!response.ok) {
    throw new Error(`API request failed: ${response.status}`);
  }

  return response.json();
}