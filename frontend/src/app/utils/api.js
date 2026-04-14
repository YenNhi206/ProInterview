/**
 * Backend gốc — không có dấu / cuối.
 * - Dev: không set VITE_API_URL → gọi trực tiếp http://localhost:5000 (khớp Vite proxy /api nếu chỉ dùng path /api).
 * - Prod build: không set VITE_API_URL → "" (cùng origin, cần reverse proxy /api → backend hoặc CDN cùng host).
 * - Prod: set VITE_API_URL=https://api.example.com khi frontend và API khác domain.
 */
function resolveApiBase() {
  const fromEnv = import.meta.env.VITE_API_URL;
  if (fromEnv != null && String(fromEnv).trim() !== "") {
    return String(fromEnv).replace(/\/$/, "");
  }
  if (import.meta.env.DEV) {
    return "http://localhost:5000";
  }
  return "";
}

export const API_BASE_URL = resolveApiBase();

/**
 * URL đầy đủ cho một path API (path bắt đầu bằng /).
 * Ví dụ: apiUrl("/api/mentors") → http://localhost:5000/api/mentors
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
