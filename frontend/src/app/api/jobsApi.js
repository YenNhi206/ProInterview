import { authedFetch } from "./authedJson.js";
import { hasAuthCredentials } from "../utils/auth/auth.js";
import { apiUrl } from "./http.js";

/**
 * Tin tuyển dụng công khai (JB-03), không cần đăng nhập.
 * Lỗi 4xx trả `{ success: false, error }` tiếng Việt từ backend (vd. bộ lọc không hợp lệ).
 */
async function getJson(path) {
  let res;
  try {
    res = await fetch(apiUrl(path), { headers: { Accept: "application/json" } });
  } catch {
    return { success: false, error: "Không kết nối được máy chủ. Thử lại sau." };
  }
  const body = await res.json().catch(() => null);
  if (!res.ok || !body?.success) {
    return { success: false, error: body?.error || "Không tải được danh sách việc làm." };
  }
  return body;
}

/** GET /api/jobs?q=&roleCategory=&level=&employmentType=&workMode=&company=&page=&limit= */
export const listJobs = (query = "") => getJson(`/api/jobs${query ? `?${query}` : ""}`);

/**
 * GET /api/jobs/:id. Đã đăng nhập thì gửi kèm token để server ghi lượt xem cho "job quan tâm gần đây"
 * (JB-20, JB-21); khách vẫn xem được không cần token.
 */
export const getJob = (id) => {
  const path = `/api/jobs/${encodeURIComponent(id)}`;
  return hasAuthCredentials() ? authedFetch(path, { method: "GET" }) : getJson(path);
};

/** GET /api/jobs/recent (JB-20): tối đa 5 job ứng viên xem gần đây, chỉ job đang mở có câu doanh nghiệp. */
export const getRecentJobs = () => authedFetch("/api/jobs/recent", { method: "GET" });

/** GET /api/jobs/:id/gap (JB-05) — chỉ ứng viên đã đăng nhập. */
export const getJobGap = (id) => authedFetch(`/api/jobs/${encodeURIComponent(id)}/gap`, { method: "GET" });

/** POST /api/reports `{ targetType: "job_post", targetId, reason, description }` (JB-04). */
export const reportJob = (id, { reason, description }) =>
  authedFetch("/api/reports", {
    method: "POST",
    body: JSON.stringify({ targetType: "job_post", targetId: id, reason, description: description.trim() }),
  });
