/** Mã đơn chuyển khoản (PI…) — dùng chung enrollment, booking, SePay. */
import crypto from "node:crypto";

/**
 * Sinh mã đơn CK mới: `PI` + 12 chữ số, khớp `parsePiOrderFromText` (PI\d{5,12}).
 * Dùng cho giỏ hàng và lộ trình (LP-10); loại thanh toán mới cũng sinh mã ở đây.
 */
export function generatePiOrderRef() {
  return `PI${crypto.randomInt(100_000_000_000, 999_999_999_999)}`;
}

export function extractOrderPart(value) {
  const s = String(value || "").trim();
  if (!s) return "";
  return s.split("|")[0].trim().slice(0, 120);
}

export function normalizePiOrderRef(value) {
  const part = extractOrderPart(value);
  const m = part.match(/\b(PI\d{5,12})\b/i);
  return m ? m[1].toUpperCase() : part.toUpperCase();
}

/** Trích mã PI từ nội dung CK SePay (content, code, description, …). */
export function parsePiOrderFromText(...texts) {
  for (const raw of texts) {
    const s = String(raw ?? "");
    const m = s.match(/\b(PI\d{5,12})\b/i);
    if (m) return m[1].toUpperCase();
  }
  return "";
}

export function orderRefsMatch(storedRef, targetRef) {
  const a = normalizePiOrderRef(storedRef);
  const b = normalizePiOrderRef(targetRef);
  if (!a || !b) return false;
  return a === b;
}
