/**
 * JB-17: hàm thuần cho màn Platform Moderator xử lý báo cáo tin tuyển dụng (`/moderator/job-reports`).
 * API: `GET /api/moderator/queue?type=job_post_report`, `PATCH /api/moderator/queue/:id/resolve`
 * (`dismiss` | `hide_job`), `GET /api/moderator/jobs`, `PATCH /api/moderator/jobs/:id/visibility` (JB-04).
 */
import { JOB_REPORT_REASONS } from "../jobs/jobDetail.js";

/** Lý do ẩn tin tối thiểu (backend: `reason` / `note` ≥ 5 ký tự). */
export const HIDE_REASON_MIN = 5;

const REASON_LABEL = Object.fromEntries(JOB_REPORT_REASONS.map((r) => [r.value, r.label]));

/** Nhãn tiếng Việt của lý do báo cáo; key lạ trả nguyên key. */
export function jobReportReasonLabel(reason) {
  const key = String(reason ?? "").trim();
  return REASON_LABEL[key] ?? key;
}

/** Lỗi của ô lý do ẩn tin, rỗng nếu hợp lệ. */
export function hideReasonError(text) {
  return String(text ?? "").trim().length < HIDE_REASON_MIN ? `Nhập lý do ẩn tin (ít nhất ${HIDE_REASON_MIN} ký tự).` : "";
}

/**
 * Link bằng chứng do người báo cáo tự nhập (backend không kiểm scheme): chỉ cho bấm khi là http(s),
 * tránh `javascript:` chạy trong phiên của moderator.
 */
export function isSafeEvidenceUrl(url) {
  try {
    const u = new URL(String(url ?? "").trim());
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

export const JOB_VISIBILITY_LABEL = { published: "Đang hiển thị", hidden: "Đã ẩn" };
