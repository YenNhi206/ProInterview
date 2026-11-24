import { authFetch } from "../utils/auth/auth.js";

/** /api/learning-paths — xem API_INDEX.md A.17 (LP-07). */
async function call(path = "", method = "GET", payload) {
  const response = await authFetch(`/api/learning-paths${path}`, {
    method,
    headers: payload ? { "Content-Type": "application/json" } : undefined,
    body: payload ? JSON.stringify(payload) : undefined,
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok || !body.success) throw new Error(body.error || "Không thực hiện được thao tác. Vui lòng thử lại.");
  return body;
}

export const listLearningPaths = () => call();
export const getLearningPath = (id) => call(`/${encodeURIComponent(id)}`);
/** LP-23: năng lực gợi ý cho trình soạn (chỉ mentor của lộ trình). */
export const getLearningPathCompetencyHints = (id) => call(`/${encodeURIComponent(id)}/competency-hints`);
/** payload: { mentorshipRequestId, goal?, totalAmount?, sessions?: [{ title, objectives[], shrmKeys[] }] } */
export const createLearningPath = (payload) => call("", "POST", payload);
/** payload: { goal?, totalAmount?, sessions? } — sessions thay toàn bộ danh sách buổi. */
export const updateLearningPath = (id, payload) => call(`/${encodeURIComponent(id)}`, "PATCH", payload);
export const proposeLearningPath = (id) => call(`/${encodeURIComponent(id)}/propose`, "POST", {});

const sessionPath = (id, sid, action) => `/${encodeURIComponent(id)}/sessions/${encodeURIComponent(sid)}/${action}`;

// LP-08: ứng viên chấp nhận đúng phiên bản đang xem / yêu cầu sửa kèm ghi chú (5–2000 ký tự).
export const acceptLearningPath = (id, version) => call(`/${encodeURIComponent(id)}/accept`, "POST", version ? { version } : {});
export const requestLearningPathRevision = (id, note) => call(`/${encodeURIComponent(id)}/request-revision`, "POST", { note });

// LP-10: thanh toán trọn gói bằng chuyển khoản. Trả `{ learningPath, payment }`; poll bằng fetchTransferStatus(payment.orderRef).
export const checkoutLearningPath = (id) => call(`/${encodeURIComponent(id)}/checkout`, "POST", {});
export const submitLearningPathTransfer = (id) => call(`/${encodeURIComponent(id)}/submit-transfer`, "PATCH", {});

/** LP-12: payload `{ date: "DD/MM/YYYY", timeSlot: "HH:mm", durationMinutes?, note? }`. Trả `{ learningPath, booking }`. */
export const scheduleLearningPathSession = (id, sid, payload) => call(sessionPath(id, sid, "schedule"), "POST", payload);

/**
 * LP-13: mentor ghi kết quả. payload `{ outcome, feedback: { summary, strengths[], improvements[] }, scores?: [{ shrmKey, score|null, note? }] }`.
 * Trả `{ learningPath, nextStep, suggestedOutcome }`.
 */
export const recordLearningPathSessionOutcome = (id, sid, payload) => call(sessionPath(id, sid, "outcome"), "PATCH", payload);
/** LP-13: mentor đề xuất buổi bổ sung có phí `{ price, note? }` sau khi buổi học lại vẫn chưa đạt. */
export const proposeSupplementarySession = (id, sid, payload) => call(sessionPath(id, sid, "supplementary"), "POST", payload);
