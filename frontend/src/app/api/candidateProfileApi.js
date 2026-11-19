import { authedFetch } from "./authedJson.js";

/** Lấy danh sách CV đã lưu của ứng viên */
export async function fetchCandidateCvs() {
  return authedFetch("/api/users/me/cvs");
}

/** Thêm CV mới vào kho lưu trữ của ứng viên */
export async function addCandidateCv(data) {
  return authedFetch("/api/users/me/cvs", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

/** Đặt một CV làm mặc định */
export async function setDefaultCandidateCv(cvId) {
  return authedFetch(`/api/users/me/cvs/${cvId}/default`, {
    method: "PATCH",
  });
}

/** Xóa CV khỏi kho */
export async function deleteCandidateCv(cvId) {
  return authedFetch(`/api/users/me/cvs/${cvId}`, {
    method: "DELETE",
  });
}

/** Cập nhật tiêu đề / tên gợi nhớ của CV */
export async function updateCandidateCv(cvId, data) {
  return authedFetch(`/api/users/me/cvs/${cvId}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

/** Lấy hồ sơ năng lực đã xác thực (SHRM/DDI framework) */
export async function fetchVerifiedCompetencies() {
  return authedFetch("/api/users/me/verified-competencies");
}

/** Đồng bộ hoặc tạo mới hồ sơ năng lực xác thực */
export async function syncVerifiedCompetencies(sampleIfEmpty = true) {
  return authedFetch("/api/users/me/verified-competencies/sync", {
    method: "POST",
    body: JSON.stringify({ sampleIfEmpty }),
  });
}

