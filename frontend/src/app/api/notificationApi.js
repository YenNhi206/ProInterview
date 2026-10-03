import { authFetch, hasAuthCredentials } from "../utils/auth/auth.js";

const jsonHeaders = {
  Accept: "application/json",
  "Content-Type": "application/json",
};

export async function fetchUnreadNotificationCount() {
  if (!hasAuthCredentials()) return { success: false, count: 0 };
  try {
    const res = await authFetch("/api/notifications/unread-count", {
      method: "GET",
      headers: { Accept: "application/json" },
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      return {
        success: false,
        count: 0,
        error: body.error || `Lỗi ${res.status}`,
      };
    }
    return { success: true, count: body.count ?? 0 };
  } catch {
    return { success: false, count: 0, error: "Lỗi kết nối khi đếm thông báo." };
  }
}

export async function fetchNotifications() {
  if (!hasAuthCredentials()) return { success: false, notifications: [] };
  try {
    const res = await authFetch("/api/notifications", {
      method: "GET",
      headers: { ...jsonHeaders },
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      return {
        success: false,
        notifications: [],
        error: body.error || `Lỗi ${res.status}`,
      };
    }
    return { success: true, notifications: body.notifications || [] };
  } catch {
    return { success: false, notifications: [], error: "Lỗi kết nối khi tải thông báo." };
  }
}

export async function markNotificationAsRead(id) {
  if (!hasAuthCredentials()) return { success: false, error: "Chưa đăng nhập." };
  try {
    const res = await authFetch(`/api/notifications/${id}/read`, {
      method: "PATCH",
      headers: { ...jsonHeaders },
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) return { success: false, error: body.error || `Lỗi ${res.status}` };
    return { success: true };
  } catch {
    return { success: false, error: "Lỗi kết nối khi đánh dấu đã đọc." };
  }
}

export async function markAllNotificationsRead() {
  if (!hasAuthCredentials()) return { success: false, error: "Chưa đăng nhập." };
  try {
    const res = await authFetch("/api/notifications/read-all", {
      method: "POST",
      headers: { ...jsonHeaders },
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) return { success: false, error: body.error || `Lỗi ${res.status}` };
    return { success: true };
  } catch {
    return { success: false, error: "Lỗi kết nối khi đánh dấu đã đọc tất cả." };
  }
}

export async function deleteNotification(id) {
  if (!hasAuthCredentials()) return { success: false, error: "Chưa đăng nhập." };
  try {
    const res = await authFetch(`/api/notifications/${encodeURIComponent(id)}`, {
      method: "DELETE",
      headers: { Accept: "application/json" },
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok || body.success === false) {
      return { success: false, error: body.error || "Không thể xóa thông báo. Hãy thử lại." };
    }
    return { success: true };
  } catch {
    return { success: false, error: "Lỗi kết nối khi xóa thông báo. Hãy thử lại." };
  }
}
