import { apiUrl } from "./api.js";
import { getAccessToken } from "./auth.js";

const jsonHeaders = {
  Accept: "application/json",
  "Content-Type": "application/json",
};

export async function initiatePayment(payload) {
  const token = getAccessToken();
  if (!token) return { success: false, error: "Chưa đăng nhập." };
  try {
    const res = await fetch(apiUrl("/api/payments/initiate"), {
      method: "POST",
      headers: { ...jsonHeaders, Authorization: `Bearer ${token}` },
      body: JSON.stringify(payload),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) return { success: false, error: body.error || `Lỗi ${res.status}` };
    if (body.success) {
      return {
        success: true,
        paymentId: body.paymentId,
        providerRef: body.providerRef,
        payUrl: body.payUrl,
        qrBase64: body.qrBase64,
        deepLink: body.deepLink,
        mock: body.mock,
        message: body.message,
      };
    }
    return { success: false, error: body.error || "Khởi tạo thanh toán thất bại." };
  } catch {
    return { success: false, error: "Không kết nối được backend." };
  }
}

export async function fetchPaymentHistory(limit = 50) {
  const token = getAccessToken();
  if (!token) return { success: false, error: "Chưa đăng nhập." };
  try {
    const q = Number.isFinite(Number(limit)) ? `?limit=${encodeURIComponent(String(limit))}` : "";
    const res = await fetch(apiUrl(`/api/payments/history${q}`), {
      method: "GET",
      headers: { ...jsonHeaders, Authorization: `Bearer ${token}` },
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) return { success: false, error: body.error || `Lỗi ${res.status}` };
    if (body.success) return { success: true, payments: body.payments ?? [] };
    return { success: false, error: body.error || "Không lấy được lịch sử." };
  } catch {
    return { success: false, error: "Không kết nối được backend." };
  }
}
