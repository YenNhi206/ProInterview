/**
 * N-13: tên vai trò hiển thị trên giao diện theo đơn đăng ký (REGISTRATION_V3):
 * Candidate, Mentor, Admin, Platform Moderator, Company Moderator.
 *
 * Code và DB vẫn giữ giá trị `customer`, `moderator`, `company_moderator` (CLAUDE.md, mục "Tên role");
 * chỉ đổi chữ người dùng nhìn thấy. `enterprise` là role cũ trước N-02, hiển thị như Company Moderator.
 * Chú ý: `enterprise` trong `CVAnalysis.planAtTime` là giá trị gói, không đi qua hàm này.
 */
export const ROLE_LABELS = Object.freeze({
  customer: "Candidate",
  mentor: "Mentor",
  admin: "Admin",
  moderator: "Platform Moderator",
  company_moderator: "Company Moderator",
  enterprise: "Company Moderator",
});

/** Tên hiển thị của role; role lạ trả nguyên giá trị, rỗng trả "". */
export function roleLabel(role) {
  const key = String(role ?? "").trim();
  return ROLE_LABELS[key] ?? key;
}
