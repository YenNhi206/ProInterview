import { authFetch, hasAuthCredentials } from "../utils/auth/auth.js";

const jsonHeaders = {
  Accept: "application/json",
  "Content-Type": "application/json",
};

export async function initiatePayment(payload) {
  if (!hasAuthCredentials()) return { success: false, error: "Chưa đăng nhập." };
  try {
    const res = await authFetch("/api/payments/initiate", {
      method: "POST",
      headers: { ...jsonHeaders },
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

export async function createSubscriptionTransferPending({ amount, planKey, orderNum, billing, forceNew, couponCode }) {
  if (!hasAuthCredentials()) return { success: false, error: "Chưa đăng nhập." };
  try {
    const res = await authFetch("/api/payments/subscription/transfer-pending", {
      method: "POST",
      headers: { ...jsonHeaders },
      body: JSON.stringify({ amount, planKey, orderNum, billing, forceNew: Boolean(forceNew), couponCode }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) return { success: false, error: body.error || `Lỗi ${res.status}` };
    if (body.success) {
      return {
        success: true,
        paymentId: body.paymentId,
        providerRef: body.providerRef,
        idempotent: Boolean(body.idempotent),
        paymentExpiresAt: body.paymentExpiresAt ?? null,
        amount: body.amount,
      };
    }
    return { success: false, error: body.error || "Không tạo được giao dịch chờ CK." };
  } catch {
    return { success: false, error: "Không kết nối được backend." };
  }
}

export async function submitSubscriptionTransfer(paymentId, reference) {
  if (!hasAuthCredentials()) return { success: false, error: "Chưa đăng nhập." };
  try {
    const res = await authFetch(`/api/payments/subscription/${paymentId}/submit-transfer`, {
      method: "PATCH",
      headers: { ...jsonHeaders },
      body: JSON.stringify({ reference }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) return { success: false, error: body.error || `Lỗi ${res.status}` };
    return { success: Boolean(body.success) };
  } catch {
    return { success: false, error: "Không kết nối được backend." };
  }
}

/** Poll trạng thái CK theo mã PI (SePay webhook + admin). */
export async function fetchTransferStatus(orderRef) {
  if (!hasAuthCredentials()) return { success: false, error: "Chưa đăng nhập." };
  const ref = String(orderRef || "").trim();
  if (!ref) return { success: false, error: "Thiếu mã đơn." };
  try {
    const q = `?orderRef=${encodeURIComponent(ref)}`;
    const res = await authFetch(`/api/payments/transfer-status${q}`, {
      method: "GET",
      headers: { ...jsonHeaders },
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) return { success: false, error: body.error || `Lỗi ${res.status}` };
    if (body.success) {
      return {
        success: true,
        orderRef: body.orderRef,
        status: body.status,
        entityType: body.entityType,
        entityId: body.entityId,
        redirectTo: body.redirectTo,
        sepayAuto: Boolean(body.sepayAuto),
        paymentExpiresAt: body.paymentExpiresAt ?? null,
        expiresInMs: Number(body.expiresInMs) || 0,
        timeoutMinutes: Number(body.timeoutMinutes) || 15,
      };
    }
    return { success: false, error: body.error || "Không lấy được trạng thái." };
  } catch {
    return { success: false, error: "Không kết nối được backend." };
  }
}

export async function fetchPaymentHistory(limit = 50) {
  if (!hasAuthCredentials()) return { success: false, error: "Chưa đăng nhập." };
  try {
    const q = Number.isFinite(Number(limit)) ? `?limit=${encodeURIComponent(String(limit))}` : "";
    const res = await authFetch(`/api/payments/history${q}`, {
      method: "GET",
      headers: { ...jsonHeaders },
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) return { success: false, error: body.error || `Lỗi ${res.status}` };
    if (body.success) return { success: true, payments: body.payments ?? [] };
    return { success: false, error: body.error || "Không lấy được lịch sử." };
  } catch {
    return { success: false, error: "Không kết nối được backend." };
  }
}
