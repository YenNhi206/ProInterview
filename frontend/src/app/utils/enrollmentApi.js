import { authFetch, hasAuthCredentials } from "./auth.js";

const jsonHeaders = {
  Accept: "application/json",
  "Content-Type": "application/json",
};

export const enrollmentApi = {
  /** Ghi danh vào một khóa học */
  enroll: async (courseId) => {
    if (!hasAuthCredentials()) return { success: false, error: "Chưa đăng nhập." };
    try {
      const res = await authFetch(`/api/courses/${courseId}/enroll`, {
        method: "POST",
        headers: { ...jsonHeaders },
      });
      const body = await res.json().catch(() => ({}));
      return { success: res.ok, ...body };
    } catch {
      return { success: false, error: "Không kết nối được backend." };
    }
  },

  /** Lấy danh sách khóa học của tôi */
  getMyEnrollments: async () => {
    if (!hasAuthCredentials()) return { success: false, error: "Chưa đăng nhập.", enrollments: [] };
    try {
      const res = await authFetch("/api/enrollments/my", {
        method: "GET",
        headers: { ...jsonHeaders },
      });
      const body = await res.json().catch(() => ({}));
      return { success: res.ok, enrollments: body.enrollments || [], error: body.error };
    } catch {
      return { success: false, error: "Không kết nối được backend.", enrollments: [] };
    }
  },

  /** Cập nhật tiến độ học tập */
  updateProgress: async (enrollmentId, lessonId, isCompleted = true) => {
    if (!hasAuthCredentials()) return { success: false, error: "Chưa đăng nhập." };
    try {
      const res = await authFetch(`/api/enrollments/${enrollmentId}/progress`, {
        method: "PATCH",
        headers: { ...jsonHeaders },
        body: JSON.stringify({ lessonId, isCompleted }),
      });
      const body = await res.json().catch(() => ({}));
      return { success: res.ok, ...body };
    } catch {
      return { success: false, error: "Không kết nối được backend." };
    }
  },

  /** Lấy hoặc tạo chứng chỉ */
  getCertificate: async (enrollmentId) => {
    if (!hasAuthCredentials()) return { success: false, error: "Chưa đăng nhập." };
    try {
      const res = await authFetch(`/api/enrollments/${enrollmentId}/certificate`, {
        method: "GET",
        headers: { ...jsonHeaders },
      });
      const body = await res.json().catch(() => ({}));
      return { success: res.ok, ...body };
    } catch {
      return { success: false, error: "Không kết nối được backend." };
    }
  },
};
