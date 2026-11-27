/**
 * Số đếm việc cần admin xử lý, hiện cạnh mục menu admin.
 * Điều kiện lọc dùng chung với trang tương ứng để menu và trang luôn khớp nhau:
 * - "Duyệt cố vấn" (`/admin/mentors/pending`): hồ sơ mentor đang chờ duyệt.
 * - "Rút tiền cố vấn" (`/admin/payouts`): yêu cầu rút tiền chờ duyệt hoặc đã duyệt nhưng chưa chi.
 */

/** Phát khi admin xử lý xong một việc (duyệt, từ chối, ghi nhận đã chi) để menu tải lại số đếm. */
export const ADMIN_NAV_COUNTS_CHANGED_EVENT = "admin:nav-counts-changed";

export function isPendingMentorApplication(mentor) {
  if (!mentor) return false;
  return !mentor.isActive && !mentor.isVerified && mentor.adminReview?.status !== "rejected";
}

export function filterPendingMentors(mentors) {
  return Array.isArray(mentors) ? mentors.filter(isPendingMentorApplication) : [];
}

/** `pending`: chờ admin duyệt; `approved`: đã duyệt, chờ admin chuyển khoản và ghi nhận đã chi. */
export const PAYOUT_STATUSES_AWAITING_ADMIN = ["pending", "approved"];

export function countPayoutsAwaitingAdmin(payouts) {
  if (!Array.isArray(payouts)) return 0;
  return payouts.filter((p) => PAYOUT_STATUSES_AWAITING_ADMIN.includes(p?.status)).length;
}

/** Nhãn hiển thị trên menu: ẩn khi 0, gộp thành "99+" khi quá nhiều. */
export function navCountLabel(count) {
  const n = Number(count);
  if (!Number.isFinite(n) || n <= 0) return "";
  return n > 99 ? "99+" : String(Math.floor(n));
}

export function notifyAdminNavCountsChanged() {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(ADMIN_NAV_COUNTS_CHANGED_EVENT));
}
