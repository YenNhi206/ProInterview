/**
 * Backend gốc — không có dấu / cuối.
 * Dev: mặc định rỗng → gọi /api/... cùng origin, Vite proxy sang :5000 (tránh 404 nhầm cổng).
 * Prod: set VITE_API_URL hoặc mặc định http://localhost:5000.
 */
function resolveApiBase() {
  const fromEnv = import.meta.env.VITE_API_URL;
  if (fromEnv != null && String(fromEnv).trim() !== "") {
    return String(fromEnv).replace(/\/$/, "");
  }
  if (import.meta.env.DEV) return "";
  return "http://localhost:5000";
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
