/**
 * LP-13: sau khi mentor ghi kết quả một buổi lộ trình thì làm gì tiếp (hàm thuần, không đọc DB).
 *
 * Quy tắc (TASKS LP-13, quyết định 2, STATE_MACHINES mục 14):
 * - `passed` và mọi `order` đều có lần học mới nhất `done` + `passed` → lộ trình `completed`.
 * - `passed` còn buổi chưa đạt → mở buổi kế (không cần ghi gì thêm, `findSchedulableSession` tự mở).
 * - `not_passed` ở lần học đầu (`attempt = 1`) → tạo buổi học lại miễn phí (`attempt = 2`, `shareAmount = 0`).
 * - `not_passed` từ lần học lại trở đi (`attempt ≥ 2`) → không tự tạo buổi; mentor đề xuất buổi bổ sung có phí.
 */
import { latestAttemptsByOrder } from "./learningPathSchedule.js";

export const LEARNING_PATH_OUTCOME_NEXT = Object.freeze({
  OPEN_NEXT: "open_next",
  COMPLETE_PATH: "complete_path",
  FREE_RETAKE: "free_retake",
  SUPPLEMENTARY_REQUIRED: "supplementary_required",
});

const isPassed = (s) => s?.status === "done" && s?.outcome === "passed";

/**
 * Mọi `order` của lộ trình đã có lần học mới nhất đạt (bỏ buổi `cancelled`). Lộ trình không có buổi → false.
 * @param {Array<{ order: number, attempt?: number, status: string, outcome?: string|null }>} sessions
 */
export function allOrdersPassed(sessions) {
  const latest = latestAttemptsByOrder(sessions);
  return latest.length > 0 && latest.every(isPassed);
}

/**
 * @param {{ attempt?: number }} session  Buổi vừa ghi kết quả.
 * @param {"passed"|"not_passed"} outcome
 * @param {Array<object>} sessionsAfter  Toàn bộ buổi của lộ trình SAU khi đã ghi kết quả buổi này.
 * @returns {string} Một giá trị của `LEARNING_PATH_OUTCOME_NEXT`.
 */
export function resolveOutcomeNextStep(session, outcome, sessionsAfter) {
  if (outcome === "passed") {
    return allOrdersPassed(sessionsAfter) ? LEARNING_PATH_OUTCOME_NEXT.COMPLETE_PATH : LEARNING_PATH_OUTCOME_NEXT.OPEN_NEXT;
  }
  const attempt = Number(session?.attempt) || 1;
  return attempt === 1 ? LEARNING_PATH_OUTCOME_NEXT.FREE_RETAKE : LEARNING_PATH_OUTCOME_NEXT.SUPPLEMENTARY_REQUIRED;
}

/**
 * Buổi `sessionId` có đang chờ mentor đề xuất buổi bổ sung có phí không: là lần học mới nhất của `order`,
 * `done` + `not_passed`, `attempt ≥ 2`.
 * @returns {boolean}
 */
export function needsSupplementarySession(sessions, sessionId) {
  const target = (sessions || []).find((s) => String(s?._id ?? s?.id ?? "") === String(sessionId));
  if (!target || target.status !== "done" || target.outcome !== "not_passed") return false;
  if ((Number(target.attempt) || 1) < 2) return false;
  const latest = latestAttemptsByOrder(sessions).find((s) => Number(s.order) === Number(target.order));
  return String(latest?._id ?? latest?.id ?? "") === String(target._id ?? target.id ?? "");
}
