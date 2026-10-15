import { authFetch } from "../utils/auth/auth.js";

async function request(path = "", options = {}) {
  const response = await authFetch(`/api/cart${path}`, {
    ...options, headers: { Accept: "application/json", "Content-Type": "application/json" },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok || !body.success) throw new Error(body.error || "Không thể tải giỏ hàng. Vui lòng thử lại.");
  return body;
}
export const cartApi = {
  get: () => request(),
  add: (courseId) => request("/items", { method: "POST", body: JSON.stringify({ courseId }) }),
  remove: (courseId) => request(`/items/${encodeURIComponent(courseId)}`, { method: "DELETE" }),
  checkout: (couponCode) => request("/checkout", { method: "POST", body: JSON.stringify({ couponCode }) }),
  order: (id) => request(`/orders/${encodeURIComponent(id)}`),
  cancelOrder: (id) => request(`/orders/${encodeURIComponent(id)}`, { method: "DELETE" }),
};
