import { authFetch, hasAuthCredentials } from "./auth.js";

const jsonHeaders = {
  Accept: "application/json",
  "Content-Type": "application/json",
};

export async function fetchCurrentPlan() {
  if (!hasAuthCredentials()) return { success: false, error: "Chưa đăng nhập." };
  try {
    const res = await authFetch("/api/plans/current", {
      method: "GET",
      headers: { ...jsonHeaders },
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) return { success: false, error: body.error || `Lỗi ${res.status}` };
    if (body.success) {
      return {
        success: true,
        plan: body.plan,
        planExpiresAt: body.planExpiresAt,
        quota: body.quota,
      };
    }
    return { success: false, error: body.error || "Không lấy được plan." };
  } catch {
    return { success: false, error: "Không kết nối được backend." };
  }
}

export async function activatePlanRequest({ plan, months = 1 }) {
  if (!hasAuthCredentials()) return { success: false, error: "Chưa đăng nhập." };
  try {
    const res = await authFetch("/api/plans/activate", {
      method: "POST",
      headers: { ...jsonHeaders },
      body: JSON.stringify({ plan, months }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) return { success: false, error: body.error || `Lỗi ${res.status}` };
    if (body.success) {
      return {
        success: true,
        plan: body.plan,
        planExpiresAt: body.planExpiresAt,
        quota: body.quota,
      };
    }
    return { success: false, error: body.error || "Kích hoạt plan thất bại." };
  } catch {
    return { success: false, error: "Không kết nối được backend." };
  }
}

export async function cancelPlanRequest() {
  if (!hasAuthCredentials()) return { success: false, error: "Chưa đăng nhập." };
  try {
    const res = await authFetch("/api/plans/cancel", {
      method: "POST",
      headers: { ...jsonHeaders },
      body: "{}",
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) return { success: false, error: body.error || `Lỗi ${res.status}` };
    if (body.success) {
      return {
        success: true,
        plan: body.plan,
        planExpiresAt: body.planExpiresAt,
        quota: body.quota,
      };
    }
    return { success: false, error: body.error || "Hủy plan thất bại." };
  } catch {
    return { success: false, error: "Không kết nối được backend." };
  }
}
