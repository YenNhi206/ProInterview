/** Nhận diện loại phòng họp và URL có embed được trong iframe hay không. */

export function parseMeetingUrl(raw) {
  const url = String(raw || "").trim();
  if (!url || !/^https?:\/\//i.test(url)) return null;
  try {
    return new URL(url);
  } catch {
    return null;
  }
}

export function getMeetingProvider(url) {
  const parsed = typeof url === "string" ? parseMeetingUrl(url) : url;
  if (!parsed) return "none";
  const host = parsed.hostname.toLowerCase();
  if (host.includes("meet.google.com")) return "google_meet";
  if (host.includes("zoom.us") || host.includes("zoom.com")) return "zoom";
  if (host.includes("teams.microsoft.com") || host.includes("teams.live.com")) return "teams";
  if (host.includes("jit.si") || host.includes("8x8.vc") || host.includes("jitsi")) return "jitsi";
  return "other";
}

/** Chỉ Jitsi cho phép nhúng iframe trên domain khác (Google Meet / Zoom / Teams đều chặn). */
export function canEmbedMeetingUrl(url) {
  return getMeetingProvider(url) === "jitsi";
}

export const MEETING_PROVIDER_LABELS = {
  google_meet: "Google Meet",
  zoom: "Zoom",
  teams: "Microsoft Teams",
  jitsi: "Jitsi",
  other: "Liên kết phòng họp",
  none: "",
};

export function buildJitsiMeetUrl(roomName, displayName) {
  const room = String(roomName || "ProInterview")
    .replace(/[^a-zA-Z0-9-_]/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 80) || "ProInterview";
  const name = encodeURIComponent(displayName || "User");
  const config = [
    "config.prejoinPageEnabled=false",
    "config.enableWelcomePage=false",
    "config.disableDeepLinking=true",
    "config.startWithAudioMuted=false",
    "config.startWithVideoMuted=false",
    "config.hideConferenceSubject=true",
    "interfaceConfig.SHOW_JITSI_WATERMARK=false",
    "interfaceConfig.SHOW_WATERMARK_FOR_GUESTS=false",
    "interfaceConfig.DEFAULT_BACKGROUND=#f8f9fc",
    `userInfo.displayName="${name}"`,
  ].join("&");
  return `https://meet.jit.si/${room}#${config}`;
}

/** Tên phòng cố định theo booking — mentor & học viên vào cùng một phòng Jitsi. */
export function proInterviewRoomName(bookingId) {
  return `ProInterview-${String(bookingId || "").trim()}`;
}

/**
 * Link vào phòng họp qua app ProInterview (Browser Router).
 * Prod JaaS: user phải vào qua app để nhận JWT từ backend — không dùng meet.jit.si trực tiếp.
 */
export function resolveProInterviewMeetLink(bookingId, _storedLink = "") {
  const id = String(bookingId || "").trim();
  if (!id) return "";

  const configuredOrigin = String(import.meta.env.VITE_FRONTEND_URL || "").trim().replace(/\/$/, "");
  if (configuredOrigin) {
    return `${configuredOrigin}/meeting/${encodeURIComponent(id)}`;
  }

  if (typeof window !== "undefined" && window.location?.origin) {
    return `${window.location.origin}/meeting/${encodeURIComponent(id)}`;
  }

  return `/meeting/${encodeURIComponent(id)}`;
}

export function buildProInterviewMeetUrl(bookingId, displayName) {
  return buildJitsiMeetUrl(proInterviewRoomName(bookingId), displayName);
}

/** Có được phép mở phòng Jitsi hay không (khớp backend `startBookingMeeting`). */
/** Parse `date` (DD/MM/YYYY, YYYY-MM-DD) + `timeSlot` (HH:mm) → timestamp ms. */
export function parseBookingStartMs(booking) {
  const date = String(booking?.date || "").trim();
  const time = String(booking?.timeSlot || booking?.time || "09:00").trim();
  const [h, min = 0] = time.split(":").map((p) => parseInt(p, 10));

  const iso = date.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) {
    return new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]), h, min, 0).getTime();
  }

  const parts = date.split("/").map((p) => parseInt(p, 10));
  if (parts.length >= 3) {
    if (parts[0] > 1000) {
      const [y, m, d] = parts;
      return new Date(y, m - 1, d, h, min, 0).getTime();
    }
    const [d, m, y] = parts;
    return new Date(y, m - 1, d, h, min, 0).getTime();
  }
  if (parts.length === 2) {
    const [d, m] = parts;
    return new Date(new Date().getFullYear(), m - 1, d, h, min, 0).getTime();
  }
  return NaN;
}

/** Hiển thị thời gian còn lại đến giờ hẹn (phút → ngày/giờ). */
export function formatUntilStart(totalMinutes) {
  const mins = Math.max(0, Math.ceil(Number(totalMinutes) || 0));
  if (mins < 60) return `${mins} phút`;
  if (mins < 24 * 60) {
    const hours = Math.floor(mins / 60);
    const rest = mins % 60;
    return rest ? `${hours} giờ ${rest} phút` : `${hours} giờ`;
  }
  const days = Math.floor(mins / (24 * 60));
  const hours = Math.floor((mins % (24 * 60)) / 60);
  return hours ? `${days} ngày ${hours} giờ` : `${days} ngày`;
}

/** Cho phép đánh dấu in_progress / coi là đang live (mặc định 15 phút trước giờ hẹn). */
export function isBookingInLiveWindow(booking, { earlyMinutes = 15, lateMinutesAfterEnd = 60 } = {}) {
  const start = parseBookingStartMs(booking);
  if (!Number.isFinite(start)) return true;
  const dur = (Number(booking?.durationMinutes) || 60) * 60 * 1000;
  const end = start + dur;
  const now = Date.now();
  return now >= start - earlyMinutes * 60 * 1000 && now <= end + lateMinutesAfterEnd * 60 * 1000;
}

export function getMinutesUntilBookingStart(booking) {
  const start = parseBookingStartMs(booking);
  if (!Number.isFinite(start)) return 0;
  return Math.max(0, Math.ceil((start - Date.now()) / 60_000));
}

export function isBookingPastScheduledEnd(booking, { graceMinutes = 0 } = {}) {
  const start = parseBookingStartMs(booking);
  if (!Number.isFinite(start)) return false;
  const dur = (Number(booking?.durationMinutes) || 60) * 60 * 1000;
  return Date.now() >= start + dur + graceMinutes * 60 * 1000;
}

/** Đã tới hoặc qua giờ bắt đầu — mentor được phép đánh dấu hoàn thành. */
export function isBookingAtOrPastStart(booking) {
  const start = parseBookingStartMs(booking);
  if (!Number.isFinite(start)) return false;
  return Date.now() >= start;
}

export function canMentorCompleteBooking(booking) {
  return isBookingAtOrPastStart(booking);
}

export function canEnterMeetingRoom(booking, { asMentor = false } = {}) {
  if (!booking) {
    return { ok: false, message: "Không tìm thấy buổi hẹn." };
  }
  const st = String(booking.status || "").toLowerCase();
  const pst = String(booking.paymentStatus || "").toLowerCase();
  if (["cancelled", "completed", "no_show", "done"].includes(st)) {
    return { ok: false, message: "Buổi hẹn đã kết thúc hoặc đã bị hủy." };
  }
  if (!["confirmed", "in_progress"].includes(st)) {
    if (asMentor && st === "pending" && pst === "paid") {
      return { ok: true, message: "", mentorAutoConfirm: true };
    }
    if (asMentor && st === "pending") {
      return {
        ok: false,
        message: "Học viên chưa hoàn tất thanh toán. Bạn có thể vào phòng sau khi đơn được thanh toán (admin xác nhận CK).",
      };
    }
    if (asMentor) {
      return {
        ok: false,
        message: "Buổi hẹn chưa sẵn sàng. Kiểm tra trạng thái trong Lịch mentor.",
      };
    }
    return {
      ok: false,
      message:
        pst === "paid"
          ? "Chờ mentor xác nhận buổi hẹn trước khi vào phòng."
          : "Buổi hẹn chưa được xác nhận. Hoàn tất thanh toán hoặc chờ mentor xác nhận.",
    };
  }
  if (pst !== "paid") {
    return {
      ok: false,
      message: asMentor
        ? "Học viên chưa thanh toán buổi này."
        : "Buổi hẹn chưa được thanh toán.",
    };
  }
  return { ok: true, message: "" };
}

function escapeIcsText(value) {
  return String(value || "")
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

function formatIcsUtc(date) {
  return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

function formatGoogleCalendarLocal(date) {
  const pad = (n) => String(n).padStart(2, "0");
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}T${pad(date.getHours())}${pad(date.getMinutes())}00`;
}

/** Khoảng thời gian buổi hẹn từ date (DD/MM/YYYY) + time + endTime. */
export function parseSessionDateTimeRange(dateStr, timeStr, endTimeStr, durationMinutes = 60) {
  const startMs = parseBookingStartMs({ date: dateStr, timeSlot: timeStr });
  if (!Number.isFinite(startMs)) return null;
  let endMs = endTimeStr
    ? parseBookingStartMs({ date: dateStr, timeSlot: endTimeStr })
    : NaN;
  if (!Number.isFinite(endMs) || endMs <= startMs) {
    const dur = Number(durationMinutes) > 0 ? Number(durationMinutes) : 60;
    endMs = startMs + dur * 60 * 1000;
  }
  return { start: new Date(startMs), end: new Date(endMs) };
}

/** Mở Google Calendar với sự kiện mới (Asia/Ho_Chi_Minh). */
export function buildGoogleCalendarEventUrl({
  title,
  date,
  time,
  endTime,
  details,
  location,
  durationMinutes,
}) {
  const range = parseSessionDateTimeRange(date, time, endTime, durationMinutes);
  if (!range) return null;
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: title || "Buổi phỏng vấn ProInterview",
    dates: `${formatGoogleCalendarLocal(range.start)}/${formatGoogleCalendarLocal(range.end)}`,
    details: details || "",
    location: location || "",
    ctz: "Asia/Ho_Chi_Minh",
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

/** Tải .ics — Lịch Apple/Outlook/Android nhận nhắc TRIGGER trước giờ họp. */
export function downloadSessionCalendarIcs({
  title,
  date,
  time,
  endTime,
  description,
  location,
  uid,
  durationMinutes,
}) {
  const range = parseSessionDateTimeRange(date, time, endTime, durationMinutes);
  if (!range) return false;
  const eventUid = uid || `prointerview-${formatIcsUtc(range.start)}`;
  const ics = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//ProInterview//VI",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${eventUid}@prointerview.app`,
    `DTSTAMP:${formatIcsUtc(new Date())}`,
    `DTSTART:${formatIcsUtc(range.start)}`,
    `DTEND:${formatIcsUtc(range.end)}`,
    `SUMMARY:${escapeIcsText(title || "Buổi phỏng vấn ProInterview")}`,
    `DESCRIPTION:${escapeIcsText(description || "")}`,
    `LOCATION:${escapeIcsText(location || "")}`,
    "BEGIN:VALARM",
    "TRIGGER:-PT60M",
    "ACTION:DISPLAY",
    "DESCRIPTION:Nhac truoc 1 gio",
    "END:VALARM",
    "BEGIN:VALARM",
    "TRIGGER:-PT15M",
    "ACTION:DISPLAY",
    "DESCRIPTION:Nhac truoc 15 phut",
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");

  const blob = new Blob([ics], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "prointerview-buoi-phong-van.ics";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
  return true;
}
