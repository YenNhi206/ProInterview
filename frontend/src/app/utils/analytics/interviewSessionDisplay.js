/**
 * Hiển thị phiên phỏng vấn AI ở trang admin. Chỉ lọc / đổi nhãn, không tạo hay sửa số liệu
 * (tách khỏi các file mock*.js đã xóa ở N-09).
 */

const STALE_IN_PROGRESS_MS = 24 * 60 * 60 * 1000;

/** Tài khoản nội bộ (@dev.local: admin, mentor, customer seed) không phải khách hàng thật. */
export function isInternalTestEmail(email) {
  return /@dev\.local$/i.test(String(email || "").trim());
}

/**
 * Phiên `in_progress` tạo quá 24h là đã bỏ dở. Job N-07 đánh `abandoned` trên DB, hàm này
 * phủ khoảng chờ trước khi job chạy. Chỉ đổi nhãn hiển thị.
 */
export function resolveDisplayStatus(status, createdAt, now = Date.now()) {
  if (String(status) !== "in_progress") return status;
  const created = new Date(createdAt).getTime();
  if (!Number.isFinite(created)) return status;
  return now - created > STALE_IN_PROGRESS_MS ? "abandoned" : status;
}
