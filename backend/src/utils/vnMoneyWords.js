/**
 * Đọc số tiền VND thành chữ cho hóa đơn: 350000 → "Ba trăm năm mươi nghìn đồng".
 * Cách đọc chuẩn văn bản: "lẻ" cho hàng chục 0, "mốt" / "lăm" ở hàng đơn vị, nhóm giữa đọc đủ "không trăm".
 */
const DIGITS = ["không", "một", "hai", "ba", "bốn", "năm", "sáu", "bảy", "tám", "chín"];
const SCALES = ["", "nghìn", "triệu", "tỷ"];

/** Đọc một nhóm 3 chữ số. `full` = nhóm không đứng đầu nên phải đọc đủ hàng trăm ("không trăm"). */
function readTriple(n, full) {
  const h = Math.floor(n / 100);
  const t = Math.floor((n % 100) / 10);
  const u = n % 10;
  const words = [];
  if (h > 0 || full) words.push(DIGITS[h], "trăm");
  if (t > 1) words.push(DIGITS[t], "mươi");
  else if (t === 1) words.push("mười");
  else if (u > 0 && (h > 0 || full)) words.push("lẻ");
  if (u > 0) {
    if (u === 1 && t > 1) words.push("mốt");
    else if (u === 5 && t > 0) words.push("lăm");
    else words.push(DIGITS[u]);
  }
  return words.join(" ");
}

/** Số nguyên không âm → chữ (không kèm "đồng"); tỷ lặp lại cho số rất lớn ("nghìn tỷ"). */
export function vnNumberToWords(value) {
  let n = Math.floor(Math.abs(Number(value) || 0));
  if (n === 0) return "không";
  const groups = [];
  while (n > 0) {
    groups.push(n % 1000);
    n = Math.floor(n / 1000);
  }
  const parts = [];
  for (let i = groups.length - 1; i >= 0; i -= 1) {
    const g = groups[i];
    if (g === 0) {
      // Nhóm tỷ toàn 0 trong số "nghìn tỷ" vẫn cần chữ "tỷ" để giữ hàng.
      if (i % 3 === 0 && i > 0 && parts.length && !parts[parts.length - 1].endsWith("tỷ")) parts.push("tỷ");
      continue;
    }
    const scale = i === 0 ? "" : SCALES[i % 3 === 0 ? 3 : i % 3];
    parts.push([readTriple(g, i < groups.length - 1), scale].filter(Boolean).join(" "));
  }
  return parts.join(" ").replace(/\s+/g, " ").trim();
}

/** "Ba trăm năm mươi nghìn đồng" (viết hoa chữ đầu). */
export function vnMoneyInWords(amount) {
  const words = `${vnNumberToWords(amount)} đồng`;
  return words.charAt(0).toUpperCase() + words.slice(1);
}
