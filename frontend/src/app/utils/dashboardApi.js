import { authFetch, hasAuthCredentials } from "./auth.js";

const jsonHeaders = {
  Accept: "application/json",
  "Content-Type": "application/json",
};

export async function fetchDashboardStats() {
  if (!hasAuthCredentials()) return { success: false, error: "Chưa đăng nhập." };
  try {
    const res = await authFetch("/api/users/dashboard-stats", {
      method: "GET",
      headers: { ...jsonHeaders },
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      return { success: false, error: body.error || `Lỗi ${res.status}` };
    }
    if (body.success && body.stats) return { success: true, stats: body.stats };
    return { success: false, error: body.error || "Không lấy được thống kê." };
  } catch {
    return { success: false, error: "Không kết nối được backend." };
  }
}
