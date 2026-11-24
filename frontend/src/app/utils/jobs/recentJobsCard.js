/**
 * JB-21: thẻ "Luyện theo job bạn quan tâm gần đây" ở màn cài đặt phỏng vấn AI.
 * Lấy từ `GET /api/jobs/recent` (JB-20, server đã lọc job đang mở có câu doanh nghiệp hợp lệ).
 * Chọn job thì gửi `jobPostId` khi tạo buổi (JB-06); bỏ qua thì server chọn ngẫu nhiên.
 */
export const RECENT_JOBS_CARD_LIMIT = 3;

/** Tối đa 3 job (giữ thứ tự mới xem trước), bỏ phần tử không có id, bỏ trùng. */
export function recentJobsForCard(jobs, limit = RECENT_JOBS_CARD_LIMIT) {
  const seen = new Set();
  const out = [];
  for (const job of Array.isArray(jobs) ? jobs : []) {
    const id = job?.id ? String(job.id) : "";
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push(job);
    if (out.length >= limit) break;
  }
  return out;
}

/**
 * Job chọn sẵn ban đầu: `?jobPostId=` trên URL (từ trang job JB-12) nếu có, không thì chưa chọn (ngẫu nhiên).
 * Không tự chọn job đầu danh sách: bỏ qua thẻ thì buổi chạy ngẫu nhiên như yêu cầu JB-21.
 */
export function initialSelectedJobId(urlJobPostId) {
  return String(urlJobPostId ?? "").trim();
}

/** Thẻ chỉ hiện khi có job gần đây, hoặc đang có job chọn từ URL (để còn bỏ chọn được). */
export function shouldShowRecentJobsCard(cardJobs, selectedJobId) {
  return (Array.isArray(cardJobs) && cardJobs.length > 0) || Boolean(selectedJobId);
}
