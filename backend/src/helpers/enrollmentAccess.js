/**
 * Được học đầy đủ khi và chỉ khi paymentStatus === "paid".
 * Không fallback theo paymentMethod — enrollment "failed"/"refunded"/null không được cấp quyền.
 */
export function enrollmentAccessGranted(doc) {
  if (!doc) return false;
  const s = doc.paymentStatus == null ? "" : String(doc.paymentStatus).trim().toLowerCase();
  return s === "paid";
}
