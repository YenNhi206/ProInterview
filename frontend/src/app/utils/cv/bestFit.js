/**
 * PR-12: chọn CV hợp nhất với một JD rồi chuyển sang phân tích chi tiết (`/cv-analysis/jd`).
 */

export const BEST_FIT_MIN_CVS = 2;
export const BEST_FIT_MAX_CVS = 5;
export const BEST_FIT_JD_MIN = 30;
export const BEST_FIT_JD_MAX = 20_000;

/** Lỗi đầu vào (tiếng Việt) hoặc "" nếu gửi được. Khớp kiểm tra của backend PR-05. */
export function bestFitInputError(cvIds, jdText) {
  const n = new Set(cvIds || []).size;
  if (n < BEST_FIT_MIN_CVS) return `Chọn ít nhất ${BEST_FIT_MIN_CVS} CV để so sánh.`;
  if (n > BEST_FIT_MAX_CVS) return `Chọn tối đa ${BEST_FIT_MAX_CVS} CV.`;
  const len = String(jdText || "").trim().length;
  if (len < BEST_FIT_JD_MIN) return `Dán mô tả công việc (JD) ít nhất ${BEST_FIT_JD_MIN} ký tự.`;
  if (len > BEST_FIT_JD_MAX) return `JD dài quá ${BEST_FIT_JD_MAX.toLocaleString("vi-VN")} ký tự.`;
  return "";
}

/** Bật / tắt chọn một CV, không vượt số tối đa. */
export function toggleCvSelection(selected, id, max = BEST_FIT_MAX_CVS) {
  const list = selected || [];
  if (list.includes(id)) return list.filter((x) => x !== id);
  return list.length >= max ? list : [...list, id];
}

/** Chữ của CV soạn trong editor (`content`) — cùng cách ghép với backend `cvContentText` (PR-05). */
export function cvContentText(content = {}) {
  const c = content ?? {};
  const lines = [
    c.summary,
    ...(c.experiences ?? []).flatMap((e) => [
      [e.position, e.company, [e.startDate, e.isCurrent ? "nay" : e.endDate].filter(Boolean).join(" – ")].filter(Boolean).join(" · "),
      e.description,
      ...(e.bullets ?? []),
    ]),
    ...(c.projects ?? []).flatMap((p) => [[p.name, p.role].filter(Boolean).join(" · "), p.description, (p.technologies ?? []).join(", ")]),
    (c.skills ?? []).length ? `Kỹ năng: ${c.skills.join(", ")}` : "",
    ...(c.educations ?? []).map((e) => [e.degree, e.fieldOfStudy, e.institution].filter(Boolean).join(" · ")),
    ...(c.certifications ?? []).map((x) => [x.name, x.issuer].filter(Boolean).join(" · ")),
  ];
  return lines.map((l) => String(l ?? "").trim()).filter(Boolean).join("\n");
}

/** Tên file an toàn cho bản .txt tạo từ CV soạn trong editor. */
export function txtFileName(title, fallback = "cv") {
  const base = String(title || "").trim().replace(/[\\/:*?"<>|]+/g, " ").replace(/\s+/g, " ").slice(0, 60).trim() || fallback;
  return `${base}.txt`;
}

/* Bàn giao file sang trang phân tích chi tiết. Chỉ giữ trong bộ nhớ (File không đưa vào URL / localStorage),
   nên tải lại trang thì mất và người dùng tải file lại như bình thường. */
let handoff = null;
export function setBestFitHandoff(value) {
  handoff = value ?? null;
}
/** Lấy một lần rồi xóa, tránh điền lại khi người dùng quay lại trang sau. */
export function takeBestFitHandoff() {
  const value = handoff;
  handoff = null;
  return value;
}
