/**
 * Bộ lọc trang /jobs (JB-11): nhãn tiếng Việt cho enum của JobPost và đọc/ghi bộ lọc trên URL.
 * Giá trị enum phải khớp backend/src/models/JobPost.js (JOB_POST_LEVELS, …).
 */

export const JOB_LEVEL_LABELS = {
  intern: "Thực tập",
  fresher: "Fresher",
  junior: "Junior",
  middle: "Middle",
  senior: "Senior",
  lead: "Lead",
};

export const JOB_EMPLOYMENT_TYPE_LABELS = {
  full_time: "Toàn thời gian",
  part_time: "Bán thời gian",
  contract: "Hợp đồng",
  internship: "Thực tập",
};

export const JOB_WORK_MODE_LABELS = {
  onsite: "Tại văn phòng",
  hybrid: "Kết hợp",
  remote: "Từ xa",
};

/** Các khóa lọc gửi lên API, theo thứ tự hiển thị. `q` là ô tìm kiếm. */
export const JOB_FILTER_KEYS = ["q", "roleCategory", "level", "employmentType", "workMode"];

const ENUMS = {
  level: JOB_LEVEL_LABELS,
  employmentType: JOB_EMPLOYMENT_TYPE_LABELS,
  workMode: JOB_WORK_MODE_LABELS,
};

/**
 * Đọc bộ lọc từ URLSearchParams. Giá trị enum lạ bị bỏ (tránh API trả 400 khi ai đó sửa tay URL);
 * `roleCategory` không kiểm ở đây vì danh sách lấy từ API (backend tự trả lỗi nếu sai).
 */
export function readJobFilters(params) {
  const get = (k) => String(params?.get?.(k) ?? "").trim();
  const filters = {};
  for (const key of JOB_FILTER_KEYS) {
    const value = key === "q" ? get(key).slice(0, 100) : get(key).toLowerCase();
    if (!value) continue;
    if (ENUMS[key] && !ENUMS[key][value]) continue;
    filters[key] = value;
  }
  const page = Number.parseInt(get("page"), 10);
  filters.page = Number.isFinite(page) && page > 1 ? page : 1;
  return filters;
}

/** Bộ lọc → chuỗi query (bỏ giá trị rỗng, bỏ page=1) dùng cho cả URL trang và API. */
export function jobFiltersToQuery(filters) {
  const params = new URLSearchParams();
  for (const key of JOB_FILTER_KEYS) {
    const value = String(filters?.[key] ?? "").trim();
    if (value) params.set(key, value);
  }
  if (Number(filters?.page) > 1) params.set("page", String(filters.page));
  return params.toString();
}

/** Số bộ lọc đang bật (không tính ô tìm kiếm và trang). */
export function activeJobFilterCount(filters) {
  return JOB_FILTER_KEYS.filter((k) => k !== "q" && filters?.[k]).length;
}

/** "Hạn nộp" hiển thị: còn ≤ 7 ngày thì báo gấp. */
export function jobDeadlineInfo(closesAt, now = Date.now()) {
  if (!closesAt) return null;
  const end = new Date(closesAt).getTime();
  if (!Number.isFinite(end)) return null;
  const days = Math.ceil((end - now) / 86_400_000);
  const date = new Date(end).toLocaleDateString("vi-VN");
  return { date, daysLeft: days, urgent: days <= 7 };
}
