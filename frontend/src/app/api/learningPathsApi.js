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
/** payload: { mentorshipRequestId, goal?, totalAmount?, sessions?: [{ title, objectives[], shrmKeys[] }] } */
export const createLearningPath = (payload) => call("", "POST", payload);
/** payload: { goal?, totalAmount?, sessions? } — sessions thay toàn bộ danh sách buổi. */
export const updateLearningPath = (id, payload) => call(`/${encodeURIComponent(id)}`, "PATCH", payload);
export const proposeLearningPath = (id) => call(`/${encodeURIComponent(id)}/propose`, "POST", {});
