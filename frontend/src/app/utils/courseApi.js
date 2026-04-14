import { apiUrl } from "./api.js";
import { authFetch, hasAuthCredentials } from "./auth.js";

const jsonHeaders = {
  Accept: "application/json",
  "Content-Type": "application/json",
};

export async function fetchCourses() {
  try {
    const res = await fetch(apiUrl("/api/courses"), {
      method: "GET",
      headers: jsonHeaders,
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) return { success: false, error: body.error || `Lỗi ${res.status}` };
    return { success: true, courses: body.courses };
  } catch {
    return { success: false, error: "Không kết nối được backend." };
  }
}

export async function fetchCourseById(id) {
  try {
    const res = await fetch(apiUrl(`/api/courses/${id}`), {
      method: "GET",
      headers: jsonHeaders,
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) return { success: false, error: body.error || `Lỗi ${res.status}` };
    return { success: true, course: body.course };
  } catch {
    return { success: false, error: "Không kết nối được backend." };
  }
}

/** Danh sách review theo mentor — khớp `GET /api/mentors/:id/reviews` (publicId hoặc _id). */
export async function fetchCourseReviews(mentorId) {
  try {
    const res = await fetch(apiUrl(`/api/mentors/${encodeURIComponent(mentorId)}/reviews`), {
      method: "GET",
      headers: jsonHeaders,
    });
    const body = await res.json().catch(() => ({}));
    return { success: res.ok, reviews: body.reviews || [] };
  } catch {
    return { success: false, reviews: [] };
  }
}

export async function submitReview(data) {
  if (!hasAuthCredentials()) return { success: false, error: "Chưa đăng nhập." };
  const body = { ...data };
  if (body.mentorId != null && body.targetId == null) {
    body.targetType = body.targetType ?? "mentor";
    body.targetId = body.mentorId;
    delete body.mentorId;
  }
  try {
    const res = await authFetch("/api/reviews", {
      method: "POST",
      headers: { ...jsonHeaders },
      body: JSON.stringify(body),
    });
    const json = await res.json().catch(() => ({}));
    return { success: res.ok, review: json.review, error: json.error };
  } catch {
    return { success: false, error: "Không kết nối được backend." };
  }
}
