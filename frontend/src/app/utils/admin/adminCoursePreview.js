const STORAGE_KEY = "prointerview_admin_course_return";

/** URL trang chi tiết khóa (marketplace học viên). */
export function courseStudentPageUrl(courseId, { adminPreview = false } = {}) {
  if (typeof window === "undefined") {
    return `#/courses/${courseId}${adminPreview ? "?adminPreview=1" : ""}`;
  }
  const base = `${window.location.origin}${window.location.pathname}`;
  const q = adminPreview ? "?adminPreview=1" : "";
  return `${base}#/courses/${courseId}${q}`;
}

/** Ghi nhớ đường quay lại admin (gọi trước khi mở link tab mới). */
export function markAdminCoursePreviewReturn(returnPath = "/moderator/courses") {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(STORAGE_KEY, returnPath);
}

/**
 * Fallback khi trình duyệt chặn tab mới — mở cùng tab kèm banner quay lại admin.
 */
export function openCourseStudentPreviewSameTab(courseId, returnPath = "/moderator/courses") {
  if (typeof window === "undefined") return;
  markAdminCoursePreviewReturn(returnPath);
  window.location.href = courseStudentPageUrl(courseId, { adminPreview: true });
}

export function getAdminCourseReturnPath() {
  return sessionStorage.getItem(STORAGE_KEY) || "/moderator/courses";
}

export function clearAdminCourseReturnPath() {
  sessionStorage.removeItem(STORAGE_KEY);
}

export function isAdminCoursePreviewMode(searchParams) {
  if (searchParams?.get("adminPreview") === "1") return true;
  if (typeof window === "undefined") return false;
  return Boolean(sessionStorage.getItem(STORAGE_KEY));
}
