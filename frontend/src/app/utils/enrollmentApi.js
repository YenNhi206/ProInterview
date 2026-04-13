import { apiUrl } from "./api.js";
import { getAccessToken } from "./auth.js";

const jsonHeaders = {
  Accept: "application/json",
  "Content-Type": "application/json",
};

export const enrollmentApi = {
  /** Ghi danh vào một khóa học */
  enroll: async (courseId) => {
    const token = getAccessToken();
    if (!token) return { success: false, error: "Chưa đăng nhập." };
    try {
      const res = await fetch(apiUrl(`/api/enrollment-test/${courseId}/enroll`), {
        method: "POST",
        headers: { ...jsonHeaders, Authorization: `Bearer ${token}` },
      });
      const body = await res.json().catch(() => ({}));
      return { success: res.ok, ...body };
    } catch {
      return { success: false, error: "Không kết nối được backend." };
    }
  },

  /** Lấy danh sách khóa học của tôi */
  getMyEnrollments: async () => {
    const token = getAccessToken();
    if (!token) return { success: false, error: "Chưa đăng nhập.", enrollments: [] };
    try {
      const res = await fetch(apiUrl("/api/enrollment-test/my"), {
        method: "GET",
        headers: { ...jsonHeaders, Authorization: `Bearer ${token}` },
      });
      const body = await res.json().catch(() => ({}));
      return { success: res.ok, enrollments: body.enrollments || [], error: body.error };
    } catch {
      return { success: false, error: "Không kết nối được backend.", enrollments: [] };
    }
  },

  /** Cập nhật tiến độ học tập */
  updateProgress: async (enrollmentId, lessonId, isCompleted = true) => {
    const token = getAccessToken();
    if (!token) return { success: false, error: "Chưa đăng nhập." };
    try {
      const res = await fetch(apiUrl(`/api/enrollment-test/${enrollmentId}/progress`), {
        method: "PATCH",
        headers: { ...jsonHeaders, Authorization: `Bearer ${token}` },
        body: JSON.stringify({ lessonId, isCompleted }),
      });
      const body = await res.json().catch(() => ({}));
      return { success: res.ok, ...body };
    } catch {
      return { success: false, error: "Không kết nối được backend." };
    }
  },
};
