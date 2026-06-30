import { apiUrl } from "./http.js";
import { authFetch, hasAuthCredentials } from "../utils/auth/auth.js";
import { normalizeCourseStats } from "../utils/course/courseStats.js";
import { mediaSrc, DEFAULT_COURSE_THUMB, avatarSrc } from "../utils/shared/mediaUrl.js";

/** Map document khóa học từ GET /api/courses → shape card UI (Home, Courses, gợi ý). */
export function mapApiCourseToCard(c) {
  const { rating, reviewsCount } = normalizeCourseStats(c?.stats);
  return {
    id: c._id,
    title: c.title,
    description: c.description,
    thumbnail: mediaSrc(c.thumbnail, DEFAULT_COURSE_THUMB),
    category: c.topics?.[0] || "Kỹ năng khác",
    level: c.level === "basic" ? "Beginner" : c.level === "intermediate" ? "Intermediate" : "Advanced",
    mentorName: c.mentorId?.userId?.name || "Khuất danh",
    mentorAvatar: avatarSrc(c.mentorId?.userId?.avatar),
    mentorTitle: c.mentorId?.userId?.desiredPosition || "Chuyên gia",
    rating,
    reviewsCount,
    studentsCount: Math.max(0, Number(c.stats?.enrollmentCount) || reviewsCount || 0),
    duration: c.totalDurationMinutes || 120,
    price: c.price || 0,
    discountPrice: c.discountPrice || 0,
    discountEndsAt: c.discountEndsAt || null,
    tags: c.tags || [],
  };
}

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

/** Đánh giá khóa học — GET /api/reviews?targetType=course&targetId= */
export async function fetchReviewsForCourse(courseId) {
  try {
    const q = new URLSearchParams({ targetType: "course", targetId: String(courseId) });
    const res = await fetch(apiUrl(`/api/reviews?${q}`), {
      method: "GET",
      headers: jsonHeaders,
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) return { success: false, reviews: [], error: body.error };
    return { success: true, reviews: body.reviews || [] };
  } catch {
    return { success: false, reviews: [] };
  }
}

/** Đánh giá chéo mentor — GET /api/courses/:id/peer-reviews */
export async function fetchPeerReviewsForCourse(courseId) {
  try {
    const res = await fetch(apiUrl(`/api/courses/${courseId}/peer-reviews`), {
      method: "GET",
      headers: jsonHeaders,
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) return { success: false, reviews: [], error: body.error };
    return { success: true, reviews: body.reviews || [] };
  } catch {
    return { success: false, reviews: [] };
  }
}

/** Gộp đánh giá học viên + đánh giá chéo mentor, sắp xếp mới nhất trước. */
export async function fetchAllReviewsForCourse(courseId) {
  const [studentRes, peerRes] = await Promise.all([
    fetchReviewsForCourse(courseId),
    fetchPeerReviewsForCourse(courseId),
  ]);
  const reviews = [...(studentRes.reviews || []), ...(peerRes.reviews || [])].sort(
    (a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0),
  );
  return {
    success: studentRes.success || peerRes.success,
    reviews,
    error: studentRes.error || peerRes.error,
  };
}

export async function fetchMyMentorCourses() {
  if (!hasAuthCredentials()) {
    return { success: false, error: "Chưa đăng nhập.", courses: [], summary: null };
  }
  try {
    const res = await authFetch("/api/courses/me", {
      method: "GET",
      headers: { ...jsonHeaders },
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      return { success: false, error: body.error || `Lỗi ${res.status}`, courses: [], summary: null };
    }
    return {
      success: true,
      courses: body.courses || [],
      summary: body.summary ?? null,
    };
  } catch {
    return { success: false, error: "Không kết nối được backend.", courses: [], summary: null };
  }
}

export async function createCourseDraft(payload) {
  if (!hasAuthCredentials()) return { success: false, error: "Chưa đăng nhập." };
  try {
    const res = await authFetch("/api/courses", {
      method: "POST",
      headers: { ...jsonHeaders },
      body: JSON.stringify(payload),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) return { success: false, error: body.error || `Lỗi ${res.status}` };
    return { success: true, course: body.course };
  } catch {
    return { success: false, error: "Không kết nối được backend." };
  }
}

export async function updateCourseDraft(id, payload) {
  if (!hasAuthCredentials()) return { success: false, error: "Chưa đăng nhập." };
  try {
    const res = await authFetch(`/api/courses/${encodeURIComponent(id)}`, {
      method: "PUT",
      headers: { ...jsonHeaders },
      body: JSON.stringify(payload),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) return { success: false, error: body.error || `Lỗi ${res.status}` };
    return { success: true, course: body.course };
  } catch {
    return { success: false, error: "Không kết nối được backend." };
  }
}

export async function publishCourse(id, payload) {
  if (!hasAuthCredentials()) return { success: false, error: "Chưa đăng nhập." };
  try {
    const res = await authFetch(`/api/courses/${encodeURIComponent(id)}/publish`, {
      method: "PATCH",
      headers: { ...jsonHeaders },
      body: payload ? JSON.stringify(payload) : undefined,
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) return { success: false, error: body.error || `Lỗi ${res.status}` };
    return { success: true, course: body.course };
  } catch {
    return { success: false, error: "Không kết nối được backend." };
  }
}

export async function fetchCourseMentorStudents(courseId) {
  if (!hasAuthCredentials()) return { success: false, error: "Chưa đăng nhập.", students: [], summary: null };
  try {
    const res = await authFetch(`/api/courses/${encodeURIComponent(courseId)}/mentor/students`, {
      method: "GET",
      headers: { ...jsonHeaders },
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) return { success: false, error: body.error || `Lỗi ${res.status}`, students: [], summary: null };
    return { success: true, students: body.students || [], summary: body.summary || null };
  } catch {
    return { success: false, error: "Không kết nối được backend.", students: [], summary: null };
  }
}

export async function fetchCourseMentorQA(courseId) {
  if (!hasAuthCredentials()) return { success: false, error: "Chưa đăng nhập.", items: [] };
  try {
    const res = await authFetch(`/api/courses/${encodeURIComponent(courseId)}/mentor/qa`, {
      method: "GET",
      headers: { ...jsonHeaders },
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) return { success: false, error: body.error || `Lỗi ${res.status}`, items: [] };
    return { success: true, items: body.items || [], pendingCount: body.pendingCount ?? 0 };
  } catch {
    return { success: false, error: "Không kết nối được backend.", items: [] };
  }
}

export async function answerCourseMentorQA(courseId, qaId, content) {
  if (!hasAuthCredentials()) return { success: false, error: "Chưa đăng nhập." };
  try {
    const res = await authFetch(
      `/api/courses/${encodeURIComponent(courseId)}/mentor/qa/${encodeURIComponent(qaId)}/answers`,
      {
        method: "POST",
        headers: { ...jsonHeaders },
        body: JSON.stringify({ content }),
      },
    );
    const body = await res.json().catch(() => ({}));
    if (!res.ok) return { success: false, error: body.error || `Lỗi ${res.status}` };
    return { success: true, message: body.message };
  } catch {
    return { success: false, error: "Không kết nối được backend." };
  }
}

export async function fetchCourseMentorReviews(courseId) {
  if (!hasAuthCredentials()) return { success: false, error: "Chưa đăng nhập.", reviews: [], summary: null };
  try {
    const res = await authFetch(`/api/courses/${encodeURIComponent(courseId)}/mentor/reviews`, {
      method: "GET",
      headers: { ...jsonHeaders },
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) return { success: false, error: body.error || `Lỗi ${res.status}`, reviews: [], summary: null };
    return { success: true, reviews: body.reviews || [], summary: body.summary || null };
  } catch {
    return { success: false, error: "Không kết nối được backend.", reviews: [], summary: null };
  }
}

export async function fetchCourseMentorAnalytics(courseId) {
  if (!hasAuthCredentials()) return { success: false, error: "Chưa đăng nhập.", lessonStats: [] };
  try {
    const res = await authFetch(`/api/courses/${encodeURIComponent(courseId)}/mentor/analytics`, {
      method: "GET",
      headers: { ...jsonHeaders },
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) return { success: false, error: body.error || `Lỗi ${res.status}`, lessonStats: [] };
    return { success: true, lessonStats: body.lessonStats || [], totals: body.totals || null };
  } catch {
    return { success: false, error: "Không kết nối được backend.", lessonStats: [] };
  }
}

/** Lưu trữ khóa học (xóa mềm — DELETE /api/courses/:id). */
export async function archiveCourse(id) {
  if (!hasAuthCredentials()) return { success: false, error: "Chưa đăng nhập." };
  try {
    const res = await authFetch(`/api/courses/${encodeURIComponent(id)}`, {
      method: "DELETE",
      headers: { ...jsonHeaders },
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) return { success: false, error: body.error || `Lỗi ${res.status}` };
    return { success: true, message: body.message };
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

/** Q&A bài học — học viên đã ghi danh (hoặc bài preview miễn phí) */
export async function fetchLessonQA(courseId, lessonId) {
  if (!hasAuthCredentials()) return { success: false, error: "Chưa đăng nhập.", items: [] };
  try {
    const res = await authFetch(
      `/api/courses/${encodeURIComponent(courseId)}/lessons/${encodeURIComponent(lessonId)}/qa`,
      {
        method: "GET",
        headers: { ...jsonHeaders },
      },
    );
    const body = await res.json().catch(() => ({}));
    if (!res.ok) return { success: false, error: body.error || `Lỗi ${res.status}`, items: [] };
    return { success: true, items: body.items || [] };
  } catch {
    return { success: false, error: "Không kết nối được backend.", items: [] };
  }
}

export async function submitLessonQuestion(courseId, lessonId, question) {
  if (!hasAuthCredentials()) return { success: false, error: "Chưa đăng nhập." };
  try {
    const res = await authFetch(
      `/api/courses/${encodeURIComponent(courseId)}/lessons/${encodeURIComponent(lessonId)}/qa`,
      {
        method: "POST",
        headers: { ...jsonHeaders },
        body: JSON.stringify({ question }),
      },
    );
    const body = await res.json().catch(() => ({}));
    if (!res.ok) return { success: false, error: body.error || `Lỗi ${res.status}` };
    return { success: true, item: body.item, message: body.message };
  } catch {
    return { success: false, error: "Không kết nối được backend." };
  }
}

/** Ghi chú bài học — học viên đã ghi danh */
export async function fetchLessonNotes(courseId, lessonId) {
  if (!hasAuthCredentials()) return { success: false, error: "Chưa đăng nhập.", content: "" };
  try {
    const res = await authFetch(
      `/api/courses/${encodeURIComponent(courseId)}/lessons/${encodeURIComponent(lessonId)}/notes`,
      {
        method: "GET",
        headers: { ...jsonHeaders },
      },
    );
    const body = await res.json().catch(() => ({}));
    if (!res.ok) return { success: false, error: body.error || `Lỗi ${res.status}`, content: "" };
    return { success: true, content: body.content ?? "", updatedAt: body.updatedAt ?? null };
  } catch {
    return { success: false, error: "Không kết nối được backend.", content: "" };
  }
}

export async function saveLessonNotes(courseId, lessonId, content) {
  if (!hasAuthCredentials()) return { success: false, error: "Chưa đăng nhập." };
  try {
    const res = await authFetch(
      `/api/courses/${encodeURIComponent(courseId)}/lessons/${encodeURIComponent(lessonId)}/notes`,
      {
        method: "PUT",
        headers: { ...jsonHeaders },
        body: JSON.stringify({ content }),
      },
    );
    const body = await res.json().catch(() => ({}));
    if (!res.ok) return { success: false, error: body.error || `Lỗi ${res.status}` };
    return { success: true, content: body.content ?? content, message: body.message };
  } catch {
    return { success: false, error: "Không kết nối được backend." };
  }
}

/** Lấy nội dung bài học chi tiết (có Auth) */
export async function fetchLessonContent(courseId, lessonId) {
  if (!hasAuthCredentials()) return { success: false, error: "Chưa đăng nhập." };
  try {
    const res = await authFetch(`/api/courses/${courseId}/lessons/${lessonId}`, {
      method: "GET",
      headers: { ...jsonHeaders },
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) return { success: false, error: body.error || `Lỗi ${res.status}` };
    return { success: true, lesson: body.lesson };
  } catch {
    return { success: false, error: "Không kết nối được backend." };
  }
}
