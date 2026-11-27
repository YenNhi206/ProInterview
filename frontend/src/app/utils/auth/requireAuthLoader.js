import { redirect } from "react-router";
import { getUser, hasAuthCredentials } from "./auth.js";

/** Lấy path từ request (Browser Router), giữ query string. */
function redirectPathFromRequest(request) {
  try {
    const url = new URL(request.url);
    if (url.pathname && url.pathname !== "/") {
      return `${url.pathname}${url.search}`;
    }
  } catch {
    /* fall through */
  }
  return "/";
}

/**
 * React Router loader: chặn route cần đăng nhập.
 * App.jsx đã gọi restoreSession() trước khi mount router.
 */
export function requireAuthLoader({ request }) {
  if (!hasAuthCredentials()) {
    const path = redirectPathFromRequest(request);
    throw redirect(`/login?redirect=${encodeURIComponent(path)}`);
  }
  return null;
}

/** Phỏng vấn AI / thanh toán / luyện tập — chỉ customer (ứng viên), không mentor/admin/moderator/company. */
export function customerOnlyLoader() {
  const user = getUser();
  if (user?.role === "mentor") throw redirect("/mentor/dashboard");
  if (user?.role === "admin") throw redirect("/admin");
  if (user?.role === "moderator") throw redirect("/moderator");
  if (user?.role === "company_moderator" || user?.role === "enterprise") throw redirect("/company");
  return null;
}

/** Customer đã đăng nhập — dùng cho /interview/*. */
export function requireCustomerAuthLoader({ request }) {
  requireAuthLoader({ request });
  customerOnlyLoader();
  return null;
}
