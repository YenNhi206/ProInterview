/**
 * CO-13: tách nội dung Company Moderator dán vào ô "Tải câu theo job" thành danh sách câu.
 * Mỗi dòng một câu; bỏ dòng trống và ký hiệu đầu dòng (`-`, `*`, `•`, `1.`, `2)`).
 * Backend (`POST /api/company/questions/upload`) tự bỏ câu trùng `textHash`.
 */
export const QUESTION_UPLOAD_MAX = 50;

const BULLET_PREFIX = /^\s*(?:[-*•]|\d+[.)])\s+/;

/** @param {string} raw @returns {string[]} */
export function parseQuestionUploadText(raw) {
  return String(raw ?? "")
    .split(/\r?\n/)
    .map((line) => line.replace(BULLET_PREFIX, "").trim())
    .filter(Boolean);
}
