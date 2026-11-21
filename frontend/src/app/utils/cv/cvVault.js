/**
 * PR-11: kho CV `/cvs`. Ràng buộc tệp khớp backend (routes/cvs.js: multer 5 MB; services/cvValidator.js:
 * PDF, DOCX, DOC, TXT) — kiểm trước ở FE để báo lỗi ngay, backend vẫn kiểm lại nội dung có phải CV không.
 */

export const CV_MAX_BYTES = 5 * 1024 * 1024;
export const CV_ACCEPT_EXTENSIONS = [".pdf", ".docx", ".doc", ".txt"];
export const CV_ACCEPT_ATTR = CV_ACCEPT_EXTENSIONS.join(",");

/** Lỗi tiếng Việt cho tệp chọn từ máy; null = hợp lệ. */
export function cvFileError(file) {
  if (!file) return "Chọn một tệp CV.";
  const name = String(file.name || "").toLowerCase();
  if (!CV_ACCEPT_EXTENSIONS.some((ext) => name.endsWith(ext))) {
    return "Chỉ nhận tệp PDF, DOCX, DOC hoặc TXT.";
  }
  if (file.size > CV_MAX_BYTES) return "Tệp lớn hơn 5 MB. Hãy nén hoặc xuất lại CV.";
  if (file.size === 0) return "Tệp rỗng.";
  return null;
}

export function formatFileSize(bytes = 0) {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Tên mặc định khi người dùng không đặt: bỏ đuôi tệp. */
export function defaultCvTitle(fileName = "") {
  return String(fileName).replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ").trim() || "CV mới";
}

/** CV mặc định lên đầu, còn lại mới cập nhật trước (khớp thứ tự backend, dùng khi cập nhật lạc quan). */
export function sortCvs(cvs = []) {
  return [...cvs].sort((a, b) => Number(b.isDefault) - Number(a.isDefault) || new Date(b.updatedAt) - new Date(a.updatedAt));
}
