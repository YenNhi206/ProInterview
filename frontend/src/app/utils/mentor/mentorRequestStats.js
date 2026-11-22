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

  return { openCount: open.length, waiting, chosen };
}

