const ADMIN_TITLE_RULES = [
  [/^\/admin\/users\/[^/]+$/, "Chi tiết người dùng"],
  [/^\/admin\/users$/, "Người dùng"],
  [/^\/admin\/mentors\/pending$/, "Duyệt cố vấn"],
  [/^\/admin\/mentors\/[^/]+$/, "Chi tiết cố vấn"],
  [/^\/admin\/mentors$/, "Cố vấn"],
  [/^\/admin\/bookings\/[^/]+$/, "Chi tiết lịch hẹn"],
  [/^\/admin\/bookings$/, "Lịch hẹn"],
  [/^\/admin\/course-payments$/, "Học phí khóa học"],
  [/^\/admin\/finance$/, "Tài chính"],
  [/^\/admin\/analytics$/, "Phân tích"],
  [/^\/admin\/settings$/, "Cài đặt hệ thống"],
  [/^\/admin$/, "Quản trị"],
];

const ROUTE_TITLES = {
  "/": "Trang chủ",
  "/login": "Đăng nhập",
  "/register": "Đăng ký",
  "/my-bookings": "Lịch hẹn của bạn",
  "/my-courses": "Khóa học của bạn",
  "/cart": "Giỏ hàng",
  "/payment-history": "Lịch sử thanh toán",
  "/admin/audit-log": "Nhật ký admin",
  "/admin/finance/operations": "Giải ngân & đối soát",
  "/cv-analysis": "Phân tích CV",
  "/cv-analysis/jd/history": "Lịch sử CV + JD",
  "/cv-analysis/best-fit": "Chọn CV hợp nhất",
  "/cv-analysis/jd": "Phân tích CV + JD",
  "/cv-analysis/field/history": "Lịch sử CV theo ngành",
  "/cv-analysis/field": "Phân tích CV theo ngành",
  "/interview": "Phỏng vấn AI",
  "/mentors": "Tìm mentor",
  "/courses": "Khóa học",
  "/jobs": "Việc làm",
  "/pricing": "Bảng giá",
  "/profile": "Hồ sơ",
  "/settings": "Cài đặt",
  "/mentor/dashboard": "Mentor",
  "/admin": "Quản trị",
};

const MEETING_TITLE_RE = /^\/meeting\/[^/]+$/;

export function resolveDocumentTitle(pathname) {
  const path = pathname || "/";
  if (MEETING_TITLE_RE.test(path.replace(/\/$/, "") || path)) {
    return "Phòng phỏng vấn · ProInterview";
  }
  if (path.startsWith("/admin")) {
    const normalized = path.replace(/\/$/, "") || "/admin";
    for (const [re, label] of ADMIN_TITLE_RULES) {
      if (re.test(normalized)) return `${label} · ProInterview`;
    }
    return "Quản trị · ProInterview";
  }
  const key = Object.keys(ROUTE_TITLES).find(
    (k) => path === k || path.startsWith(`${k}/`),
  );
  if (key) return `${ROUTE_TITLES[key]} · ProInterview`;
  return "ProInterview";
}
