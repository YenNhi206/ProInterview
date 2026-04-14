import { authFetch, hasAuthCredentials } from "./auth.js";

const jsonHeaders = {
  Accept: "application/json",
  "Content-Type": "application/json",
};

/**
 * Tạo booking (POST /api/bookings) — cần Bearer JWT.
 * Payload khớp Booking.jsx / Checkout: mentorId, date, time hoặc timeSlot, sessionType, notes/position/note, price, …
 */
export async function createBooking(payload) {
  if (!hasAuthCredentials()) {
    return { success: false, error: "Chưa đăng nhập." };
  }
  try {
    const res = await authFetch("/api/bookings", {
      method: "POST",
      headers: { ...jsonHeaders },
      body: JSON.stringify(payload),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      return {
        success: false,
        error: body.error || `Đặt lịch thất bại (${res.status})`,
      };
    }
    if (body.success && body.booking) {
      return { success: true, booking: body.booking };
    }
    return { success: false, error: body.error || "Đặt lịch thất bại." };
  } catch {
    return {
      success: false,
      error: "Không kết nối được backend. Kiểm tra VITE_API_URL và backend đang chạy.",
    };
  }
}

function authedGet(path) {
  if (!hasAuthCredentials()) return Promise.resolve({ success: false, error: "Chưa đăng nhập." });
  return authFetch(path, {
    method: "GET",
    headers: { ...jsonHeaders },
  })
    .then(async (res) => {
      const body = await res.json().catch(() => ({}));
      if (!res.ok) return { success: false, error: body.error || `Lỗi ${res.status}` };
      return { success: true, ...body };
    })
    .catch(() => ({ success: false, error: "Không kết nối được backend." }));
}

function authedSend(method, path, payload) {
  if (!hasAuthCredentials()) return Promise.resolve({ success: false, error: "Chưa đăng nhập." });
  return authFetch(path, {
    method,
    headers: { ...jsonHeaders },
    body: payload != null ? JSON.stringify(payload) : undefined,
  })
    .then(async (res) => {
      const body = await res.json().catch(() => ({}));
      if (!res.ok) return { success: false, error: body.error || `Lỗi ${res.status}` };
      return { success: true, ...body };
    })
    .catch(() => ({ success: false, error: "Không kết nối được backend." }));
}

export async function listBookings() {
  const r = await authedGet("/api/bookings");
  if (!r.success) return r;
  return { success: true, bookings: r.bookings ?? [] };
}

export async function fetchBookingById(id) {
  if (!id) return { success: false, error: "Thiếu id." };
  return authedGet(`/api/bookings/${encodeURIComponent(id)}`);
}

export async function cancelBooking(id, body = {}) {
  if (!id) return { success: false, error: "Thiếu id." };
  return authedSend("DELETE", `/api/bookings/${encodeURIComponent(id)}`, body);
}

export async function rescheduleBooking(id, body) {
  if (!id) return { success: false, error: "Thiếu id." };
  return authedSend("PATCH", `/api/bookings/${encodeURIComponent(id)}/reschedule`, body ?? {});
}
