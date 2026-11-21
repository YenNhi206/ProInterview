import { authedFetch } from "./authedJson.js";

/** Hồ sơ ứng viên — `/api/profile/me` (PR-01, PR-07). Trả `{ success, ... }`, không throw. */
export const profileApi = {
  getMe: () => authedFetch("/api/profile/me"),
  /** data: { headline?, targetRole?, targetRoles?, summary?, yearsOfExperience?, defaultCvId? } */
  updateMe: (data) => authedFetch("/api/profile/me", { method: "PATCH", body: JSON.stringify(data) }),
  getCompetencies: () => authedFetch("/api/profile/me/competencies"),
  /** Danh sách CV để chọn CV mặc định (`GET /api/cvs`, PR-02); quản lý kho CV ở trang /cvs. */
  listCvs: () => authedFetch("/api/cvs"),
};
