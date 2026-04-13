import { apiUrl } from "./api.js";
import { getAccessToken } from "./auth.js";

const jsonHeaders = {
  Accept: "application/json",
  "Content-Type": "application/json",
};

function authedFetch(path, options = {}) {
  const token = getAccessToken();
  return fetch(apiUrl(path), {
    ...options,
    headers: {
      ...jsonHeaders,
      Authorization: `Bearer ${token}`,
      ...options.headers,
    },
  }).then(async (res) => {
    const body = await res.json().catch(() => ({}));
    if (!res.ok) return { success: false, error: body.error || `Lỗi ${res.status}` };
    return { success: true, ...body };
  }).catch(() => ({ success: false, error: "Không kết nối được backend." }));
}

export const adminApi = {
  getStats: () => authedFetch("/api/admin-test/stats"),
  getMentors: () => authedFetch("/api/admin/mentors"),
  updateMentorStatus: (id, isActive) => 
    authedFetch(`/api/admin/mentors/${id}/status`, {
      method: "PATCH",
      body: JSON.stringify({ isActive }),
    }),
  getUsers: () => authedFetch("/api/admin-test/users"),
  updateUserStatus: (id, isActive) => 
    authedFetch(`/api/admin/users/${id}/status`, {
      method: "PATCH",
      body: JSON.stringify({ isActive }),
    }),
  getBookings: () => authedFetch("/api/admin-test/bookings"),
};
