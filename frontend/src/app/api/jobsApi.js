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

/** GET /api/jobs/:id */
export const getJob = (id) => getJson(`/api/jobs/${encodeURIComponent(id)}`);
