/** Parse booking.date (DD/MM/YYYY, YYYY-MM-DD) + timeSlot (HH:mm). */
export function parseBookingStartMs(dateStr, timeSlot) {
  const date = String(dateStr || "").trim();
  const time = String(timeSlot || "09:00").trim();
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

/** Đã tới hoặc qua giờ bắt đầu buổi (mentor được phép đánh dấu hoàn thành). */
export function isBookingAtOrPastStart(bookingOrDate, timeSlot) {
  const booking =
    bookingOrDate && typeof bookingOrDate === "object" && !Array.isArray(bookingOrDate)
      ? bookingOrDate
      : { date: bookingOrDate, timeSlot };
  const start = parseBookingStartMs(booking?.date, booking?.timeSlot || booking?.time);
  if (!Number.isFinite(start)) return false;
  return Date.now() >= start;
}

export function isBookingInLiveWindow(booking, { earlyMinutes = 15, lateMinutesAfterEnd = 60 } = {}) {
  const start = parseBookingStartMs(booking.date, booking.timeSlot);
  if (!Number.isFinite(start)) return true;
  const dur = (Number(booking.durationMinutes) || 60) * 60 * 1000;
  const end = start + dur;
  const now = Date.now();
  return now >= start - earlyMinutes * 60 * 1000 && now <= end + lateMinutesAfterEnd * 60 * 1000;
}

/** Khung giờ phải sau thời điểm hiện tại. */
export function isBookingSlotInFuture(dateStr, timeSlot, nowMs = Date.now()) {
  const ms = parseBookingStartMs(dateStr, timeSlot);
  if (!Number.isFinite(ms)) return false;
  return ms > nowMs;
}

/** Timestamp kết thúc buổi (start + durationMinutes). */
export function parseBookingEndMs(booking, { graceMinutesAfterEnd = 0 } = {}) {
  const start = parseBookingStartMs(booking?.date, booking?.timeSlot);
  if (!Number.isFinite(start)) return NaN;
  const dur = (Number(booking?.durationMinutes) || 60) * 60 * 1000;
  return start + dur + graceMinutesAfterEnd * 60 * 1000;
}

/** Đã qua giờ kết thúc + grace → đủ điều kiện auto-complete nếu mentor chưa bấm kết thúc. */
export function isBookingPastAutoCompleteGrace(booking, { graceMinutesAfterEnd = 30 } = {}) {
  const cutoff = parseBookingEndMs(booking, { graceMinutesAfterEnd });
  return Number.isFinite(cutoff) && Date.now() >= cutoff;
}

/**
 * Khoảng thời gian [start, end) của một buổi (ms). `durationMinutes` thiếu thì coi 60 phút.
 * @returns {{ start: number, end: number } | null}
 */
export function bookingIntervalMs(booking) {
  const start = parseBookingStartMs(booking?.date, booking?.timeSlot);
  if (!Number.isFinite(start)) return null;
  const minutes = Number(booking?.durationMinutes) > 0 ? Number(booking.durationMinutes) : 60;
  return { start, end: start + minutes * 60 * 1000 };
}

/**
 * Hai buổi có chồng giờ không. Buổi kết thúc đúng lúc buổi kia bắt đầu (19:00–20:00 và 20:00) không tính là trùng.
 * Buổi không đọc được ngày giờ thì không coi là trùng.
 */
export function bookingsOverlap(a, b) {
  const x = bookingIntervalMs(a);
  const y = bookingIntervalMs(b);
  if (!x || !y) return false;
  return x.start < y.end && y.start < x.end;
}
