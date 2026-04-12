/**
 * Map API booking (POST/GET /api/bookings) sang shape dùng chung với mock/local (Dashboard, SessionDetail, …).
 */

export function parseBookingNotes(notes = "") {
  const n = String(notes || "");
  const pick = (label) => {
    const re = new RegExp(`^${label}\\s*:\\s*(.+)`, "im");
    const m = n.match(re);
    return m ? m[1].trim() : "";
  };
  const position = pick("Vị trí ứng tuyển");
  const cv = pick("CV");
  const jd = pick("JD");
  return {
    position,
    cvFile: cv || null,
    jdFile: jd || null,
  };
}

export function endTimeFromSlot(timeSlot, durationMinutes = 60) {
  const t = String(timeSlot || "09:00");
  const [h0, m0] = t.split(":").map((x) => parseInt(x, 10));
  const h = Number.isFinite(h0) ? h0 : 9;
  const min = Number.isFinite(m0) ? m0 : 0;
  const dur = Number.isFinite(Number(durationMinutes)) && Number(durationMinutes) > 0 ? Number(durationMinutes) : 60;
  const d = new Date(2000, 0, 1, h, min, 0);
  d.setMinutes(d.getMinutes() + dur);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

/** Chuẩn hoá status backend → filter/sort giống local mock. */
export function mapBookingStatus(status) {
  if (status === "completed") return "done";
  return status;
}

/**
 * @param {object} b - booking từ API (toPublicBooking)
 */
export function apiBookingToLocal(b) {
  if (!b || !b.id) return null;
  const { position, cvFile, jdFile } = parseBookingNotes(b.notes);
  const time = b.timeSlot || "09:00";
  const endTime = endTimeFromSlot(time, b.durationMinutes);
  const ref = typeof b.paymentRef === "string" ? b.paymentRef.trim() : "";
  const orderNum = ref || `PI${String(b.id).slice(-6)}`;
  const price =
    typeof b.totalAmount === "number" && b.totalAmount > 0
      ? b.totalAmount
      : Number(b.price) || 0;

  return {
    orderNum,
    sessionId: b.id,
    backendId: b.id,
    mentorId: b.mentorId,
    mentorName: b.mentorName || "",
    mentorTitle: b.mentorTitle || "",
    mentorCompany: b.mentorCompany || "",
    mentorAvatar: b.mentorAvatar || "",
    date: b.date,
    time,
    endTime,
    price,
    meetLink: b.meetingLink || "",
    position: position || "—",
    note: "",
    cvFile,
    jdFile,
    status: mapBookingStatus(b.status),
    paymentRef: ref,
  };
}
