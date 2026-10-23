import { redirect } from "react-router";
import { authFetch, hasAuthCredentials, setLoggedIn } from "./auth.js";

function isRouterRedirect(error) {
  return error instanceof Response;
}

/**
 * Loader chặn route theo role, xác minh qua `/api/auth/me` (không tin localStorage —
 * role ở client có thể bị sửa tay, nguồn sự thật là server).
 *
 * @param {string} role     role bắt buộc, ví dụ "admin" | "moderator" | "enterprise"
 * @param {string} basePath đường dẫn quay lại sau khi đăng nhập
 */
export function createRoleLoader(role, basePath) {
  return async function roleLoader() {
    const loginPath = `/login?redirect=${encodeURIComponent(basePath)}`;
    if (!hasAuthCredentials()) {
      throw redirect(loginPath);
    }
    try {
      const res = await authFetch("/api/auth/me", { headers: { Accept: "application/json" } });
      const body = await res.json().catch(() => ({}));
      if (!res.ok || !body.success || body.user?.role !== role) {
        throw redirect(loginPath);
      }
      setLoggedIn(body.user);
      return null;
    } catch (err) {
      if (isRouterRedirect(err)) throw err;
      throw redirect(loginPath);
    }
  };
}
