import { isLoggedIn, isSafeAppRedirect } from "./auth.js";

/** Path hiện tại (pathname + search) để quay lại sau đăng nhập. */
export function getAuthReturnPath(location) {
  if (location && typeof location === "object") {
    const combined = `${location.pathname || ""}${location.search || ""}`;
    if (isSafeAppRedirect(combined, null)) return combined;
  }
  if (typeof window !== "undefined") {
    const combined = `${window.location.pathname || ""}${window.location.search || ""}`;
    if (isSafeAppRedirect(combined, null)) return combined;
  }
  return "/";
}

export function buildLoginPath(returnTo) {
  const target =
    typeof returnTo === "string" && isSafeAppRedirect(returnTo, null)
      ? returnTo.trim()
      : getAuthReturnPath();
  return `/login?redirect=${encodeURIComponent(target)}`;
}

export function buildRegisterPath(returnTo) {
  const target =
    typeof returnTo === "string" && isSafeAppRedirect(returnTo, null)
      ? returnTo.trim()
      : getAuthReturnPath();
  return `/register?redirect=${encodeURIComponent(target)}`;
}

/** Vào phòng phỏng vấn AI; bắt buộc đăng nhập, sau login quay lại /interview. */
export function navigateToInterview(navigate) {
  if (isLoggedIn()) {
    navigate("/interview");
    return;
  }
  navigate(buildLoginPath("/interview"));
}

/**
 * Điều hướng tới `path` (vd. /mentors, /courses, /checkout?...).
 * Chưa đăng nhập → /login?redirect=...
 */
export function requireLoginNavigate(navigate, path) {
  if (!path || typeof path !== "string") return;
  if (isLoggedIn()) {
    navigate(path);
    return;
  }
  navigate(buildLoginPath(path));
}
