/**
 * LP-06 (C-06, quyết định 13): giới hạn buổi đánh giá 0đ của **mỗi ứng viên** (gộp mọi yêu cầu, mọi mentor).
 *
 * - Tối đa 1 buổi 0đ chưa xong cùng lúc (`pending` / `confirmed` / `in_progress` / `rescheduled`).
 * - Tối đa 2 buổi 0đ trong 30 ngày, tính theo lúc tạo buổi (`createdAt`). Buổi được tính:
 *   · đang mở (chưa xong);
 *   · `completed`;
 *   · `no_show` do **ứng viên** vắng (`cancelledBy` khác `"mentor"`).
 *   Không tính: `no_show` do mentor vắng (`cancelledBy: "mentor"`, LP-22) và buổi bị hủy trước khi diễn ra
 *   (`cancelled`, ai hủy cũng vậy) — buổi chưa diễn ra thì ứng viên chưa dùng lượt.
 *
 * Hàm thuần, không đụng DB; service truyền vào các booking `sessionType: "assessment"` của ứng viên.
 */

export const ASSESSMENT_OPEN_STATUSES = Object.freeze(["pending", "confirmed", "in_progress", "rescheduled"]);
export const ASSESSMENT_MAX_OPEN = 1;
export const ASSESSMENT_MAX_PER_WINDOW = 2;
export const ASSESSMENT_WINDOW_DAYS = 30;
const DAY_MS = 86_400_000;

/** Buổi 0đ này có tính vào lượt 30 ngày không. */
export function countsTowardAssessmentLimit(booking) {
  const status = String(booking?.status || "");
  if (ASSESSMENT_OPEN_STATUSES.includes(status) || status === "completed") return true;
  if (status === "no_show") return booking?.cancelledBy !== "mentor";
  return false;
}

/**
 * @param {{ status: string, cancelledBy?: string, createdAt: Date|string }[]} bookings buổi 0đ của ứng viên
 * @param {Date} [now]
 * @returns {{ ok: true } | { ok: false, reason: "open" | "window", reopensAt?: Date }}
 *   `reopensAt`: lúc lượt cũ nhất trong cửa sổ hết tính (ứng viên được tạo buổi mới).
 */
export function checkAssessmentLimit(bookings, now = new Date()) {
  const rows = Array.isArray(bookings) ? bookings : [];
  const open = rows.filter((b) => ASSESSMENT_OPEN_STATUSES.includes(String(b?.status || "")));
  if (open.length >= ASSESSMENT_MAX_OPEN) return { ok: false, reason: "open" };

  const windowStart = now.getTime() - ASSESSMENT_WINDOW_DAYS * DAY_MS;
  const used = rows
    .filter((b) => countsTowardAssessmentLimit(b))
    .map((b) => new Date(b.createdAt).getTime())
    .filter((t) => Number.isFinite(t) && t > windowStart)
    .sort((a, b) => a - b);
  if (used.length >= ASSESSMENT_MAX_PER_WINDOW) {
    // Cần bớt (used − max + 1) lượt cũ nhất ra khỏi cửa sổ thì mới còn chỗ.
    const pivot = used[used.length - ASSESSMENT_MAX_PER_WINDOW];
    return { ok: false, reason: "window", reopensAt: new Date(pivot + ASSESSMENT_WINDOW_DAYS * DAY_MS) };
  }
  return { ok: true };
}
