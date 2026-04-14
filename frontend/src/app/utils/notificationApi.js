import { authFetch, hasAuthCredentials } from "./auth.js";

const jsonHeaders = {
  Accept: "application/json",
  "Content-Type": "application/json",
};

export async function fetchNotifications() {
  if (!hasAuthCredentials()) return { success: false, notifications: [] };
  try {
    const res = await authFetch("/api/notifications", {
      method: "GET",
      headers: { ...jsonHeaders },
    });
    const body = await res.json().catch(() => ({}));
    return { success: res.ok, notifications: body.notifications || [] };
  } catch {
    return { success: false, notifications: [] };
  }
}

export async function markNotificationAsRead(id) {
  if (!hasAuthCredentials()) return { success: false };
  try {
    const res = await authFetch(`/api/notifications/${id}/read`, {
      method: "PATCH",
      headers: { ...jsonHeaders },
    });
    return { success: res.ok };
  } catch {
    return { success: false };
  }
}
