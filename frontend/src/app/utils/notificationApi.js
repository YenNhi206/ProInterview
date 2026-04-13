import { apiUrl } from "./api.js";
import { getAccessToken } from "./auth.js";

const jsonHeaders = {
  Accept: "application/json",
  "Content-Type": "application/json",
};

export async function fetchNotifications() {
  const token = getAccessToken();
  if (!token) return { success: false, notifications: [] };
  try {
    const res = await fetch(apiUrl("/api/notifications"), {
      method: "GET",
      headers: { ...jsonHeaders, Authorization: `Bearer ${token}` },
    });
    const body = await res.json().catch(() => ({}));
    return { success: res.ok, notifications: body.notifications || [] };
  } catch {
    return { success: false, notifications: [] };
  }
}

export async function markNotificationAsRead(id) {
  const token = getAccessToken();
  if (!token) return { success: false };
  try {
    const res = await fetch(apiUrl(`/api/notifications/${id}/read`), {
      method: "PATCH",
      headers: { ...jsonHeaders, Authorization: `Bearer ${token}` },
    });
    return { success: res.ok };
  } catch {
    return { success: false };
  }
}
