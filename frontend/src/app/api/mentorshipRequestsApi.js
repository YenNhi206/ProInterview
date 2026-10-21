import { authFetch } from "../utils/auth/auth.js";
async function call(path = "", method = "GET", payload) {
  const form = payload instanceof FormData;
  const response = await authFetch(`/api/mentorship-requests${path}`, { method, headers: payload && !form ? { "Content-Type": "application/json" } : undefined, body: payload ? (form ? payload : JSON.stringify(payload)) : undefined });
  const body = await response.json().catch(() => ({}));
  if (!response.ok || !body.success) throw new Error(body.error || "Không thực hiện được thao tác. Vui lòng thử lại.");
  return body;
}
export const listMentorshipDocuments = () => call("/documents");
export const listMentorshipRequests = scope => call(`?scope=${encodeURIComponent(scope || "open")}`);
export const getMentorshipRequest = id => call(`/${encodeURIComponent(id)}`);
export const createMentorshipRequest = form => call("", "POST", form);
export const sendMentorshipOffer = (id, payload) => call(`/${encodeURIComponent(id)}/offers`, "POST", payload);
export const selectMentorshipOffer = (id, offerId) => call(`/${encodeURIComponent(id)}/offers/${encodeURIComponent(offerId)}/select`, "POST", {});
export const withdrawMentorshipOffer = (id, offerId) => call(`/${encodeURIComponent(id)}/offers/${encodeURIComponent(offerId)}/withdraw`, "POST", {});
export const closeMentorshipRequest = id => call(`/${encodeURIComponent(id)}/close`, "POST", {});
export async function downloadMentorshipFile(id, kind, name) {
  const response = await authFetch(`/api/mentorship-requests/${encodeURIComponent(id)}/files/${kind}`);
  if (!response.ok) { const body = await response.json().catch(() => ({})); throw new Error(body.error || "Không tải được tài liệu."); }
  const url = URL.createObjectURL(await response.blob());
  const link = document.createElement("a"); link.href = url; link.download = name; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}
