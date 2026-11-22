/**
 * LP-19 / LP-21: hàm thuần cho timeline lộ trình (ứng viên + mentor), ô chọn giờ đặt buổi và form chấm buổi.
 * Quy tắc khớp backend: `utils/learningPathSchedule.js`, `utils/learningPathOutcome.js`,
 * `services/bookingsService.js#mentorSlotClosedReason`, `services/competencyFramework.js#suggestOutcome`.
 */
import { isBookingSlotInFuture } from "../booking/bookingSchedule.js";

/** Trạng thái một lần học, nhìn từ phía người dùng. `tone` ứng với class CSS `lp-tone-*`. */
export function sessionBadge(session) {
  if (!session) return { label: "", tone: "muted" };
  if (session.status === "done") {
    return session.outcome === "passed" ? { label: "Đạt", tone: "ok" } : { label: "Chưa đạt", tone: "bad" };
  }
  if (session.status === "scheduled") return { label: "Đã đặt lịch", tone: "info" };
  if (session.status === "pending_payment") return { label: "Chờ thanh toán", tone: "warn" };
  if (session.status === "cancelled") return { label: "Đã hủy", tone: "muted" };
  if (session.canSchedule) return { label: "Mở đặt lịch", tone: "open" };
  return { label: "Chưa mở", tone: "muted" };
}

/** Nhãn lần học: 1 = buổi gốc, 2 = học lại miễn phí, ≥ 3 = buổi bổ sung có phí (quyết định 2). */
export function attemptLabel(attempt) {
  const n = Number(attempt) || 1;
  if (n === 1) return "Buổi chính";
  if (n === 2) return "Học lại (miễn phí)";
  return `Buổi bổ sung ${n - 2}`;
}

/**
 * Gom các lần học theo `order` (buổi), mỗi nhóm sắp `attempt` tăng dần; `latest` = lần mới nhất chưa hủy.
 * @returns {{ order: number, title: string, attempts: object[], latest: object|null }[]}
 */
export function groupSessionsByOrder(sessions = []) {
  const groups = new Map();
  for (const s of sessions) {
    const order = Number(s.order);
    if (!groups.has(order)) groups.set(order, []);
    groups.get(order).push(s);
  }
  return [...groups.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([order, rows]) => {
      const attempts = [...rows].sort((a, b) => (Number(a.attempt) || 1) - (Number(b.attempt) || 1));
      const alive = attempts.filter((s) => s.status !== "cancelled");
      return { order, title: attempts[0]?.title || `Buổi ${order}`, attempts, latest: alive.at(-1) || null };
    });
}

/** Buổi đang mở đặt lịch (backend đánh `canSchedule`), hoặc null. */
export function schedulableSession(sessions = []) {
  return sessions.find((s) => s.canSchedule) || null;
}

/** Mentor được đề xuất buổi bổ sung có phí: lần học mới nhất của buổi, `done` + `not_passed`, `attempt ≥ 2`. */
export function canProposeSupplementary(sessions = [], session) {
  if (!session || session.status !== "done" || session.outcome !== "not_passed") return false;
  if ((Number(session.attempt) || 1) < 2) return false;
  const group = groupSessionsByOrder(sessions).find((g) => g.order === Number(session.order));
  return group?.latest?.id === session.id;
}

// ---------------------------------------------------------------------------
// Ô chọn giờ: khung giờ rảnh của mentor (GET /api/mentors/:id/availability) trừ giờ đã có người đặt
// ---------------------------------------------------------------------------

const pad2 = (n) => String(n).padStart(2, "0");

/** "24/11", "24/11/2026", "Thứ 2, 24/11/2026" hoặc "2026-11-24" → "2026-11-24" (thiếu năm thì lấy `fallbackYear`). */
export function toIsoDateKey(raw, fallbackYear) {
  const s = String(raw || "").trim();
  if (!s) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const tail = s.includes(",") ? s.split(",").pop().trim() : s;
  const parts = tail.split("/").map((p) => Number(p));
  if (parts.length >= 2 && Number.isFinite(parts[0]) && Number.isFinite(parts[1])) {
    const year = parts.length >= 3 && Number.isFinite(parts[2]) ? parts[2] : fallbackYear;
    return `${String(year).padStart(4, "0")}-${pad2(parts[1])}-${pad2(parts[0])}`;
  }
  return "";
}

/** Mentor đã khai báo lịch rảnh chưa. Chưa khai báo thì backend nhận mọi giờ (ô chọn chuyển sang nhập tay). */
export function mentorHasSchedule(availability) {
  const slots = availability?.availableSlots;
  const recurring = availability?.recurringSchedule;
  return Boolean((slots && Object.keys(slots).length) || (Array.isArray(recurring) && recurring.length));
}

/** Giờ mentor mở trong ngày `dateObj` — cùng thứ tự ưu tiên với backend: ngày chặn → lịch riêng của ngày → lịch tuần. */
export function mentorSlotsForDay(availability, dateObj) {
  if (!availability || !dateObj) return [];
  const year = dateObj.getFullYear();
  const iso = `${year}-${pad2(dateObj.getMonth() + 1)}-${pad2(dateObj.getDate())}`;
  const blocked = new Set((availability.blockedDates || []).map((d) => toIsoDateKey(d, year)).filter(Boolean));
  if (blocked.has(iso)) return [];
  const explicit = Object.entries(availability.availableSlots || {}).find(([k]) => toIsoDateKey(k, year) === iso);
  const clean = (list) => (Array.isArray(list) ? list.map((x) => String(x).trim()).filter(Boolean) : []);
  if (explicit) return clean(explicit[1]);
  const mentorDay = (dateObj.getDay() + 6) % 7; // 0 = thứ 2
  const row = (availability.recurringSchedule || []).find((r) => Number(r?.dayOfWeek) === mentorDay);
  return clean(row?.slots);
}

/** Giờ đã có người đặt trong ngày; map `booked` có thể dùng khóa "DD/MM/YYYY" hoặc "DD/MM". */
function bookedTimes(booked, dateKey) {
  const noYear = dateKey.split("/").slice(0, 2).join("/");
  return booked?.[dateKey] ?? booked?.[noYear] ?? [];
}

/**
 * Các ngày còn giờ trống trong `days` ngày tới, mỗi ngày là `{ date: "DD/MM/YYYY", label, times: ["HH:mm"] }`.
 * Bỏ giờ đã qua và giờ mentor đã có lịch. Mentor chưa khai báo lịch → trả `null` (để FE cho nhập tay).
 */
export function buildSlotOptions(availability, booked = {}, { now = new Date(), days = 21 } = {}) {
  if (!mentorHasSchedule(availability)) return null;
  const out = [];
  const nowMs = now.getTime();
  for (let i = 0; i < days; i += 1) {
    const day = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i);
    const date = `${pad2(day.getDate())}/${pad2(day.getMonth() + 1)}/${day.getFullYear()}`;
    const taken = new Set(bookedTimes(booked, date));
    const times = [...new Set(mentorSlotsForDay(availability, day))]
      .filter((t) => /^\d{1,2}:\d{2}$/.test(t) && !taken.has(t) && isBookingSlotInFuture(date, t, nowMs))
      .sort();
    if (times.length) out.push({ date, label: day.toLocaleDateString("vi-VN", { weekday: "short", day: "2-digit", month: "2-digit" }), times });
  }
  return out;
}

/** Ngày nhập tay dạng "YYYY-MM-DD" (input type=date) → "DD/MM/YYYY" cho API. */
export function isoToBookingDate(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso || ""));
  return m ? `${m[3]}/${m[2]}/${m[1]}` : "";
}

// ---------------------------------------------------------------------------
// Form chấm buổi của mentor (LP-21)
// ---------------------------------------------------------------------------

/** Mỗi dòng một ý, bỏ dòng trống, tối đa `max` dòng. */
export function linesToList(text, max = 10) {
  return String(text || "")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .slice(0, max);
}

/**
 * Gợi ý đạt / chưa đạt từ điểm (khớp backend): mọi key của buổi có điểm số và ≥ ngưỡng → "passed";
 * có key dưới ngưỡng → "not_passed"; thiếu key hoặc điểm null → null (chưa đủ dữ liệu).
 * @param {Record<string, number|null|"">} scores
 */
export function suggestOutcome(scores, keys, passThreshold = 3) {
  const list = [...new Set(keys || [])];
  if (!list.length) return null;
  let allPass = true;
  for (const k of list) {
    const v = scores?.[k];
    if (typeof v !== "number" || !Number.isFinite(v)) return null;
    if (v < passThreshold) allPass = false;
  }
  return allPass ? "passed" : "not_passed";
}

/** Lỗi của form chấm (trước khi gọi API), rỗng = gửi được. */
export function outcomeFormErrors(form) {
  const errors = [];
  if (!["passed", "not_passed"].includes(form?.outcome)) errors.push("Chọn kết quả Đạt hoặc Chưa đạt.");
  if (String(form?.summary || "").trim().length < 10) errors.push("Nhận xét chung cần ít nhất 10 ký tự.");
  if (form?.outcome === "not_passed" && linesToList(form?.improvementsText).length === 0) {
    errors.push("Buổi chưa đạt cần ít nhất một điểm cần cải thiện.");
  }
  return errors;
}

/** State form → body của PATCH .../outcome. Điểm để trống thì không gửi; "null" = chưa đủ dữ liệu. */
export function toOutcomePayload(form) {
  const scores = Object.entries(form?.scores || {})
    .filter(([, v]) => v !== "" && v !== undefined)
    .map(([shrmKey, v]) => ({ shrmKey, score: v === null || v === "null" ? null : Number(v) }));
  return {
    outcome: form.outcome,
    feedback: {
      summary: String(form.summary || "").trim(),
      strengths: linesToList(form.strengthsText),
      improvements: linesToList(form.improvementsText),
    },
    ...(scores.length ? { scores } : {}),
  };
}

/** Bước kế backend trả về sau khi ghi kết quả → câu thông báo cho mentor. */
export const OUTCOME_NEXT_STEP_NOTICE = {
  open_next: "Đã ghi kết quả. Mentee được mở đặt lịch buổi tiếp theo.",
  complete_path: "Đã ghi kết quả. Mentee đã hoàn thành lộ trình.",
  free_retake: "Đã ghi kết quả. Hệ thống đã tạo buổi học lại miễn phí cho mentee.",
  supplementary_required: "Đã ghi kết quả. Buổi học lại miễn phí đã dùng — bạn có thể đề xuất buổi bổ sung có phí bên dưới.",
};
