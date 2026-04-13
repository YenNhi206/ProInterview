import { apiUrl } from "./api.js";
import { getAccessToken } from "./auth.js";

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

export async function fetchCourseReviews(mentorId) {
  try {
    const res = await fetch(apiUrl(`/api/reviews/mentor/${mentorId}`), {
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
  const token = getAccessToken();
  if (!token) return { success: false, error: "Chưa đăng nhập." };
  try {
    const res = await fetch(apiUrl("/api/reviews"), {
      method: "POST",
      headers: { ...jsonHeaders, Authorization: `Bearer ${token}` },
      body: JSON.stringify(data),
    });
    const body = await res.json().catch(() => ({}));
    return { success: res.ok, review: body.review, error: body.error };
  } catch {
    return { success: false, error: "Không kết nối được backend." };
  }
}
