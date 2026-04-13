import { isLoggedIn } from "./auth.js";

/** Vào phòng phỏng vấn AI; bắt buộc đăng nhập, sau login quay lại /interview. */
export function navigateToInterview(navigate) {
  if (isLoggedIn()) {
    navigate("/interview");
    return;
  }
  navigate(`/login?redirect=${encodeURIComponent("/interview")}`);
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
  navigate(`/login?redirect=${encodeURIComponent(path)}`);
}
