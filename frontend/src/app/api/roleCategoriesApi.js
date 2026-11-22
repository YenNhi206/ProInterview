import { apiGet } from "./http.js";

/**
 * Danh sách nhóm vị trí (roleCategory) dùng chung — `GET /api/role-categories` (công khai).
 * Nguồn duy nhất là `backend/src/config/roleCategories.json`; FE không tự đặt danh sách riêng.
 * Dùng cho câu hỏi công ty (`/company/questions`), rubric, tin tuyển dụng (`/company/jobs`, `/jobs`).
 *
 * Kết quả: `{ success, version, roleCategories: [{ key, nameVi, nameEn, interviewRole, suggestedCompetencies[] }] }`.
 */
export const roleCategoriesApi = {
  list: () => apiGet("/api/role-categories"),
};
