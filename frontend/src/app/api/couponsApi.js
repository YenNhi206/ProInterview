import { authFetch, hasAuthCredentials } from "../utils/auth/auth.js";

const jsonHeaders = {
  Accept: "application/json",
  "Content-Type": "application/json",
};

/** type: "booking" | "enrollment" | "subscription" */
export async function validateCoupon({ code, type, amount }) {
  if (!hasAuthCredentials()) return { success: false, error: "Chưa đăng nhập." };
  try {
    const res = await authFetch("/api/coupons/validate", {
      method: "POST",
      headers: { ...jsonHeaders },
      body: JSON.stringify({ code, type, amount }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) return { success: false, error: body.error || `Lỗi ${res.status}` };
    if (body.success) {
      return { success: true, coupon: body.coupon, discountAmount: Number(body.discountAmount) || 0 };
    }
    return { success: false, error: body.error || "Mã giảm giá không hợp lệ." };
  } catch {
    return { success: false, error: "Không kết nối được backend." };
  }
}
