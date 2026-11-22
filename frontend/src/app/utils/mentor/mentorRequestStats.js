/**
 * Số liệu đầu trang "Nhu cầu mentee" của mentor, tính từ 2 danh sách thật (không phụ thuộc tab đang mở):
 * - openRows: GET /api/mentorship-requests?scope=open (nhu cầu đang mở)
 * - mineRows: GET /api/mentorship-requests?scope=mine (nhu cầu mentor đã gửi đề nghị; `offers` chỉ chứa đề nghị của chính mentor)
 */
export function mentorRequestStats(openRows = [], mineRows = []) {
  const open = Array.isArray(openRows) ? openRows : [];
  const mine = Array.isArray(mineRows) ? mineRows : [];
  const myOffer = (row) => (row.offers || [])[0] || null;

  const chosen = mine.filter((row) => {
    const offer = myOffer(row);
    return offer && row.selectedOfferId && row.selectedOfferId === offer.id;
  }).length;
  // Đề nghị còn hiệu lực, mentee chưa chọn ai.
  const waiting = mine.filter((row) => myOffer(row)?.status === "pending" && row.status === "open").length;

  const budgets = open.map((row) => Number(row.budget)).filter((n) => Number.isFinite(n) && n > 0);
  const avgBudget = budgets.length ? Math.round(budgets.reduce((a, b) => a + b, 0) / budgets.length) : null;

  return { openCount: open.length, waiting, chosen, avgBudget };
}

/** 6.000 → "6k", 1.500.000 → "1,5tr"; không có ngân sách → "—". */
export function formatBudgetShort(amount) {
  if (!amount) return "—";
  if (amount >= 1_000_000) return `${(Math.round(amount / 100_000) / 10).toLocaleString("vi-VN")}tr`;
  return `${Math.round(amount / 1000).toLocaleString("vi-VN")}k`;
}
