/**
 * JB-12: hàm thuần cho trang chi tiết job `/jobs/:id` và form yêu cầu mentor gắn job.
 */

/** Lý do báo cáo tin tuyển dụng; key khớp `JOB_POST_REPORT_REASONS` (backend/src/models/Report.js). */
export const JOB_REPORT_REASONS = [
  { value: "fraud", label: "Lừa đảo, thu phí ứng viên" },
  { value: "misleading", label: "Thông tin sai hoặc gây hiểu nhầm" },
  { value: "discriminatory", label: "Phân biệt đối xử" },
  { value: "inappropriate", label: "Nội dung không phù hợp" },
  { value: "other", label: "Lý do khác" },
];

export const JOB_REPORT_MIN_DESCRIPTION = 10;

/** Nhãn trạng thái năng lực của `GET /api/jobs/:id/gap` (JB-05). */
export const GAP_STATUS_LABELS = {
  met: "Đạt yêu cầu",
  below: "Còn thiếu",
  no_evidence: "Chưa có dữ liệu",
};

/** Ai xem được khoảng thiếu: chỉ ứng viên đã đăng nhập (API chỉ cho role `customer`). */
export function gapAudience(user) {
  if (!user) return "guest";
  return user.role === "customer" ? "candidate" : "other";
}

/** Chỉ nhận đường dẫn nội bộ `/...`, chặn `//host` và `javascript:`. */
export function safeInternalPath(url, fallback = "") {
  const s = String(url ?? "").trim();
  return s.startsWith("/") && !s.startsWith("//") ? s : fallback;
}

/** Link gửi yêu cầu mentor gắn job. */
export function mentorRequestUrl(jobId) {
  return `/mentor-requests/new?jobPostId=${encodeURIComponent(jobId)}`;
}

/** Link mở phỏng vấn AI đã chọn sẵn job (màn chọn job ở JB-21 đọc `jobPostId`). */
export function interviewUrl(jobId) {
  return `/interview?jobPostId=${encodeURIComponent(jobId)}`;
}

/** Id job hợp lệ (ObjectId 24 ký tự hex) lấy từ query, sai thì chuỗi rỗng. */
export function readJobPostId(searchParams) {
  const raw = String(searchParams?.get?.("jobPostId") ?? "").trim();
  return /^[a-f0-9]{24}$/i.test(raw) ? raw : "";
}

/** Kiểm form báo cáo; trả chuỗi lỗi tiếng Việt hoặc "" khi hợp lệ. */
export function jobReportError({ reason, description }) {
  if (!JOB_REPORT_REASONS.some((r) => r.value === reason)) return "Chọn lý do báo cáo.";
  if (String(description ?? "").trim().length < JOB_REPORT_MIN_DESCRIPTION) {
    return `Mô tả vấn đề ít nhất ${JOB_REPORT_MIN_DESCRIPTION} ký tự.`;
  }
  return "";
}

/**
 * Nội dung JD dạng chữ dựng từ job, dùng làm tệp JD khi gửi yêu cầu mentor gắn job
 * (API yêu cầu mentor bắt buộc có tệp JD).
 */
export function jobToJdText(job) {
  if (!job) return "";
  const competencies = (job.requiredCompetencies ?? []).map((c) => `${c.name || c.shrmKey} (mức ${c.minLevel}/5)`);
  return [
    `Vị trí: ${job.title}${job.company?.name ? ` — ${job.company.name}` : ""}`,
    job.location ? `Địa điểm: ${job.location}` : "",
    job.salaryRange ? `Mức lương: ${job.salaryRange}` : "",
    "",
    job.description || job.summary || "",
    "",
    (job.requiredSkills ?? []).length ? `Kỹ năng yêu cầu: ${job.requiredSkills.join(", ")}` : "",
    competencies.length ? `Năng lực yêu cầu: ${competencies.join(", ")}` : "",
  ]
    .filter((line, i, arr) => line !== "" || (i > 0 && arr[i - 1] !== ""))
    .join("\n")
    .trim();
}

/** Tên tệp JD: "jd-backend-developer.txt". */
export function jdFileName(title) {
  const slug = String(title ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/gi, "d")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return `jd-${slug || "job"}.txt`;
}
