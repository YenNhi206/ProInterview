import { parseBookingNotes } from "./bookingMappers.js";
import { resolveMediaUrl } from "../shared/mediaUrl.js";

/** CV/JD đính kèm booking — ưu tiên field API, fallback parse từ notes. */
export function getBookingAttachments(booking) {
  const parsed = parseBookingNotes(booking?.notes);
  const cvFileName = String(booking?.cvFileName || parsed.cvFile || "").trim();
  const jdFileName = String(booking?.jdFileName || parsed.jdFile || "").trim();
  const cvFileUrl = resolveMediaUrl(booking?.cvFileUrl || "");
  const jdFileUrl = resolveMediaUrl(booking?.jdFileUrl || "");
  const position = String(parsed.position || "").trim();
  const noteMatch = String(booking?.notes || "").match(/^Ghi chú:\s*(.+)$/im);
  const note = noteMatch ? noteMatch[1].trim() : "";

  return { mentorshipRequestId: booking?.mentorshipRequestId || "", position, note, cvFileName, jdFileName, cvFileUrl, jdFileUrl };
}
