import { apiUrl } from "./api.js";
import { getAccessToken } from "./auth.js";

const jsonHeaders = {
  Accept: "application/json",
  "Content-Type": "application/json",
};

export async function fetchDashboardStats() {
  const token = getAccessToken();
  if (!token) return { success: false, error: "Chưa đăng nhập." };
  try {
    const res = await fetch(apiUrl("/api/users/dashboard-stats"), {
      method: "GET",
      headers: { ...jsonHeaders, Authorization: `Bearer ${token}` },
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
