/**
 * Được học đầy đủ (không còn khóa chờ admin xác nhận CK).
 * Đồng bộ với backend `helpers/enrollmentAccess.js`.
 */
export function enrollmentAccessGranted(doc) {
  if (!doc) return false;
  const s = doc.paymentStatus == null ? "" : String(doc.paymentStatus).trim().toLowerCase();
  return s === "paid";
}
