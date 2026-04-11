import { apiUrl } from "./api";

const jsonHeaders = {
  Accept: "application/json",
  "Content-Type": "application/json",
};

/**
 * Danh sách mentor — fetch từ Express + MongoDB (GET /api/mentors).
 */
export async function fetchMentors() {
  const res = await fetch(apiUrl("/api/mentors"), { headers: jsonHeaders });
  if (!res.ok) {
    console.error(`fetchMentors: HTTP ${res.status}`);
    return [];
  }
  const data = await res.json();
  if (data.success && Array.isArray(data.mentors)) {
    return data.mentors;
  }
  console.error("fetchMentors: response không hợp lệ", data);
  return [];
}

/**
 * Một mentor theo id — GET /api/mentors/:id
 */
export async function fetchMentor(id) {
  const res = await fetch(apiUrl(`/api/mentors/${encodeURIComponent(id)}`), {
    headers: jsonHeaders,
  });
  if (res.status === 404) return null;
  if (!res.ok) {
    console.error(`fetchMentor: HTTP ${res.status}`);
    return null;
  }
  const data = await res.json();
  if (data.success && data.mentor) return data.mentor;
  return null;
}
