/**
 * Format số tiền VND — hậu tố "VND" (không dùng ₫/đ).
 * @param {number|string} amount
 * @param {{ freeLabel?: string|null }} [options]
 *   freeLabel: chuỗi khi amount = 0 (mặc định null → "0 VND"). Truyền "Miễn phí" cho khóa học.
 */
export function formatVnd(amount, { freeLabel = null } = {}) {
  const n = Number(amount);
  if (!Number.isFinite(n)) return "0 VND";
  if (n === 0 && freeLabel != null) return freeLabel;
  return `${Math.round(n).toLocaleString("vi-VN")} VND`;
}

/** Tách số và hậu tố — checkout hiển thị số lớn + VND */
export function formatVndParts(amount) {
  const value = new Intl.NumberFormat("vi-VN").format(Math.round(Number(amount) || 0));
  return { value, suffix: "VND" };
}
