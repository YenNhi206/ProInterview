import { authFetch } from "../utils/auth/auth.js";

const jsonHeaders = {
  Accept: "application/json",
  "Content-Type": "application/json",
};

/** Map key UI category → reason hợp lệ trên backend */
export const REPORT_REASON_MAP = {
  quality: "other",
  attitude: "unprofessional",
  "reschedule-abuse": "late",
  unprofessional: "unprofessional",
  harassment: "inappropriate",
  other: "other",
};

/**
 * POST /api/reports — ứng viên báo sai câu hỏi / điểm AI trên trang Feedback (N-10).
 * Tạo Report + ModerationItem cho moderator. 409 = đã báo loại này cho câu này rồi.
 * @param {{ targetType: "interview_question"|"interview_evaluation", sessionId: string, questionIndex: number, reasonCode: string, note?: string }} payload
 */
export async function submitAiReport({ targetType, sessionId, questionIndex, reasonCode, note = "" }) {
  try {
    const res = await authFetch("/api/reports", {
      method: "POST",
      headers: jsonHeaders,
      body: JSON.stringify({ targetType, targetId: sessionId, questionIndex, reasonCode, note: note.trim() }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return { success: false, status: res.status, error: data.error || `Lỗi ${res.status}` };
    return { success: true, reportId: data.reportId };
  } catch {
    return { success: false, error: "Lỗi kết nối máy chủ" };
  }
}

/**
 * POST /api/reports — báo cáo mentor / booking / review / course
 * @param {{ targetType?: string, targetId: string, reason: string, title?: string, description: string, bookingId?: string }} payload
 */
export async function submitReport(payload) {
  try {
    const description =
      payload.bookingId && payload.description
        ? `${payload.description}\n\n(Booking liên quan: ${payload.bookingId})`
        : payload.description;

    const res = await authFetch("/api/reports", {
      method: "POST",
      headers: jsonHeaders,
      body: JSON.stringify({
        targetType: payload.targetType || "mentor",
        targetId: payload.targetId,
        reason: payload.reason,
        title: payload.title,
        description,
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return { success: false, error: data.error || `Lỗi ${res.status}` };
    return { success: true, reportId: data.reportId };
  } catch {
    return { success: false, error: "Lỗi kết nối máy chủ" };
  }
}
