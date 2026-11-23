/**
 * LP-23: năng lực gợi ý trong trình soạn lộ trình (API `GET /api/learning-paths/:id/competency-hints`).
 * Mentor bấm "Thêm buổi" thì có một buổi điền sẵn tên và năng lực; vẫn sửa tự do (quyết định 5).
 */
import { MAX_SESSIONS, emptySession } from "./learningPathEditor.js";

/** Nhãn trạng thái cho một gợi ý. */
export function hintStatusLabel(hint) {
  if (hint.status === "gap") return `Thiếu ${hint.gap} mức (hiện ${hint.currentLevel}/${hint.requiredLevel})`;
  if (hint.status === "unknown") return `Chưa có dữ liệu (job cần mức ${hint.requiredLevel})`;
  return `Đã đạt (mức ${hint.currentLevel}/${hint.requiredLevel})`;
}

/** Nguồn gợi ý: yêu cầu của job hay hồ sơ ứng viên. */
export function hintSourceLabel(hint) {
  return hint.fromJob ? "Job yêu cầu" : "Từ hồ sơ ứng viên";
}

/** Đã có buổi nào chọn năng lực này chưa. */
export function sessionsCoverKey(sessions, key) {
  return (sessions || []).some((s) => (s.shrmKeys || []).includes(key));
}

/**
 * Thêm một buổi rèn năng lực của gợi ý. Nếu buổi cuối còn trống (chưa tên, chưa năng lực) thì điền vào
 * buổi đó thay vì thêm buổi mới. Trả nguyên mảng nếu đã đủ số buổi tối đa hoặc năng lực đã có buổi.
 */
export function addHintSession(sessions, hint) {
  const list = sessions || [];
  if (!hint?.shrmKey || sessionsCoverKey(list, hint.shrmKey)) return list;
  const filled = { title: `Rèn năng lực: ${hint.name || hint.shrmKey}`, shrmKeys: [hint.shrmKey] };
  const last = list.at(-1);
  if (last && !String(last.title || "").trim() && !(last.shrmKeys || []).length && !String(last.objectivesText || "").trim()) {
    return [...list.slice(0, -1), { ...last, ...filled }];
  }
  if (list.length >= MAX_SESSIONS) return list;
  return [...list, { ...emptySession(), ...filled }];
}
