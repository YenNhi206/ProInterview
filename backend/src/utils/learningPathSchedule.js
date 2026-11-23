/**
 * LP-12: buổi nào của lộ trình đang mở đặt lịch.
 *
 * Quy tắc (TASKS LP-12, STATE_MACHINES mục 14):
 * - Lộ trình phải `active` (đã thanh toán trọn gói, LP-10).
 * - Đi lần lượt theo `order`. Với mỗi `order`, chỉ xét lần học mới nhất (`attempt` lớn nhất, bỏ buổi `cancelled`):
 *   - `done` + `passed` → sang `order` kế tiếp;
 *   - `planned` → đây là buổi mở đặt lịch (lần đầu, hoặc buổi học lại `retakeOf` do LP-13 tạo);
 *   - `scheduled`, `pending_payment` (buổi bổ sung có phí chưa trả tiền, LP-13), hoặc `done` + `not_passed`
 *     mà chưa có buổi học lại → chưa mở buổi nào.
 * - Hệ quả: mỗi lúc lộ trình có tối đa 1 buổi mở đặt lịch và 1 buổi `scheduled`; không đặt được buổi 3
 *   khi buổi 2 chưa đạt.
 *
 * Hàm thuần, không đọc DB: dùng chung cho API đặt lịch và DTO (`canSchedule` cho FE LP-19).
 */

export const LEARNING_PATH_SCHEDULE_BLOCK = Object.freeze({
  PATH_NOT_ACTIVE: "path_not_active",
  SESSION_NOT_FOUND: "session_not_found",
  SESSION_NOT_PLANNED: "session_not_planned",
  /** LP-13: buổi bổ sung có phí chưa thanh toán thì không đặt lịch được (tránh học miễn phí). */
  AWAITING_PAYMENT: "awaiting_payment",
  SUPERSEDED: "superseded",
  PREVIOUS_NOT_PASSED: "previous_not_passed",
  ALL_DONE: "all_done",
});

/**
 * Lần học mới nhất của từng `order`, sắp theo `order` tăng dần. Buổi `cancelled` không tính.
 * @param {Array<{ _id?: unknown, id?: string, order: number, attempt?: number, status: string, outcome?: string|null }>} sessions
 */
export function latestAttemptsByOrder(sessions) {
  const latest = new Map();
  for (const s of sessions || []) {
    if (!s || s.status === "cancelled") continue;
    const order = Number(s.order);
    const attempt = Number(s.attempt) || 1;
    const current = latest.get(order);
    if (!current || attempt > (Number(current.attempt) || 1)) latest.set(order, s);
  }
  return [...latest.entries()].sort((a, b) => a[0] - b[0]).map(([, s]) => s);
}

const sessionKey = (s) => String(s?._id ?? s?.id ?? "");

/**
 * Buổi đang mở đặt lịch của lộ trình, hoặc `null`.
 * @param {{ status: string }} path
 * @param {Array<object>} sessions
 */
export function findSchedulableSession(path, sessions) {
  if (path?.status !== "active") return null;
  for (const s of latestAttemptsByOrder(sessions)) {
    if (s.status === "done" && s.outcome === "passed") continue;
    return s.status === "planned" ? s : null;
  }
  return null;
}

/**
 * Kiểm tra buổi `sessionId` có đặt lịch được không; trả lý do bị chặn để service đổi ra thông báo tiếng Việt.
 * @returns {{ ok: true, session: object } | { ok: false, reason: string, blockingSession?: object }}
 */
export function checkSessionSchedulable(path, sessions, sessionId) {
  const target = (sessions || []).find((s) => sessionKey(s) === String(sessionId));
  if (!target) return { ok: false, reason: LEARNING_PATH_SCHEDULE_BLOCK.SESSION_NOT_FOUND };
  if (path?.status !== "active") return { ok: false, reason: LEARNING_PATH_SCHEDULE_BLOCK.PATH_NOT_ACTIVE };
  if (target.status === "pending_payment") return { ok: false, reason: LEARNING_PATH_SCHEDULE_BLOCK.AWAITING_PAYMENT };
  if (target.status !== "planned") return { ok: false, reason: LEARNING_PATH_SCHEDULE_BLOCK.SESSION_NOT_PLANNED };

  const latest = latestAttemptsByOrder(sessions);
  const latestOfOrder = latest.find((s) => Number(s.order) === Number(target.order));
  if (latestOfOrder && sessionKey(latestOfOrder) !== sessionKey(target)) {
    return { ok: false, reason: LEARNING_PATH_SCHEDULE_BLOCK.SUPERSEDED };
  }

  const open = findSchedulableSession(path, sessions);
  if (open && sessionKey(open) === sessionKey(target)) return { ok: true, session: target };

  const blockingSession = latest.find((s) => !(s.status === "done" && s.outcome === "passed"));
  if (!blockingSession) return { ok: false, reason: LEARNING_PATH_SCHEDULE_BLOCK.ALL_DONE };
  return { ok: false, reason: LEARNING_PATH_SCHEDULE_BLOCK.PREVIOUS_NOT_PASSED, blockingSession };
}
