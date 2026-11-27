/**
 * Trang /interview/feedback: chọn buổi phỏng vấn cần hiện và nguồn câu hỏi / câu trả lời.
 *
 * Trang mở từ 2 nơi:
 *  - cuối phòng phỏng vấn (`navigate(..., { state: { sessionId } })`): câu hỏi và transcript nằm trong
 *    sessionStorage của tab;
 *  - thông báo "Kết quả phỏng vấn đã được kiểm định" (`/interview/feedback?sessionId=…`, moderationQueueService),
 *    có thể mở ở tab / máy khác, hoặc sau khi đã phỏng vấn buổi khác.
 * sessionStorage chỉ đúng với buổi gần nhất của tab. Dùng nó cho buổi khác thì điểm của buổi này bị ghép với câu
 * hỏi / câu trả lời của buổi kia, và nếu buổi chưa chấm thì transcript buổi kia bị gửi lên làm dữ liệu chấm.
 */

const OBJECT_ID = /^[a-f0-9]{24}$/i;

const cleanId = (value) => {
  const s = String(value ?? "").trim();
  return OBJECT_ID.test(s) ? s : "";
};

/**
 * Mã buổi cần hiện: `?sessionId=` trên URL trước, rồi state điều hướng, cuối cùng buổi gần nhất của tab.
 * @param {{ search?: string, stateSessionId?: string, storedSessionId?: string }} input
 */
export function resolveFeedbackSessionId({ search = "", stateSessionId = "", storedSessionId = "" } = {}) {
  let fromUrl = "";
  try {
    fromUrl = cleanId(new URLSearchParams(search).get("sessionId"));
  } catch {
    fromUrl = "";
  }
  return fromUrl || cleanId(stateSessionId) || cleanId(storedSessionId);
}

/** Dữ liệu trong sessionStorage chỉ dùng được khi nó thuộc đúng buổi đang mở. */
export function tabDataBelongsTo(sessionId, storedSessionId) {
  return Boolean(sessionId) && cleanId(storedSessionId) === sessionId;
}

/** Transcript theo `questionIndex` từ `GET /api/interviews/sessions/:id` (câu chưa trả lời → ""). */
export function transcriptsFromSession(session) {
  const questions = Array.isArray(session?.questions) ? session.questions : [];
  const out = questions.map(() => "");
  for (const a of session?.answers ?? []) {
    const i = Number(a?.questionIndex);
    if (Number.isInteger(i) && i >= 0) out[i] = String(a?.transcript ?? "");
  }
  return out;
}

/** Câu hỏi của buổi (cùng dạng `prointerview_question_objects` trong sessionStorage); không có → null. */
export function questionObjectsFromSession(session) {
  const questions = Array.isArray(session?.questions) ? session.questions : [];
  return questions.length ? questions : null;
}
