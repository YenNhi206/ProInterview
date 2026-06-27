/** Nhãn hiển thị tiếng Việt cho route / action analytics. */

const ROUTE_LABELS = {
  "/": "Trang chủ",
  "/pricing": "Bảng giá",
  "/dashboard": "Bảng điều khiển",
  "/cv-analysis": "Phân tích CV",
  "/cv-analysis/history": "Lịch sử phân tích CV",
  "/interview": "Phỏng vấn AI",
  "/interview/room": "Phòng phỏng vấn",
  "/interview/feedback": "Kết quả phỏng vấn",
  "/mentors": "Danh sách cố vấn",
  "/booking": "Đặt lịch",
  "/checkout": "Thanh toán",
  "/courses": "Khóa học",
  "/my-courses": "Khóa của tôi",
  "/profile": "Hồ sơ",
  "/settings": "Cài đặt",
  "/my-bookings": "Lịch hẹn của tôi",
  "/payment-return": "Kết quả thanh toán",
  "/payment-success": "Thanh toán thành công",
  "/payment-failure": "Thanh toán thất bại",
};

const ACTION_LABELS = {
  cv_analyze_start: "Bắt đầu phân tích CV",
  cv_analyze_done: "Hoàn thành phân tích CV",
  interview_start: "Bắt đầu phỏng vấn AI",
  interview_complete: "Hoàn thành phỏng vấn AI",
  checkout_open: "Mở trang thanh toán",
  booking_submit: "Gửi đặt lịch",
  course_enroll: "Mua khóa học",
  plan_upgrade: "Nâng cấp gói thành công",
  plan_checkout_start: "Bắt đầu thanh toán gói",
  course_complete: "Hoàn thành khóa học",
};

export function labelRoute(route) {
  const path = String(route || "").split("?")[0].split("#")[0];
  if (ROUTE_LABELS[path]) return ROUTE_LABELS[path];

  if (path.startsWith("/mentors/")) return "Hồ sơ cố vấn";
  if (path.startsWith("/booking/")) return "Chi tiết đặt lịch";
  if (path.startsWith("/session/")) return "Chi tiết buổi học";
  if (path.startsWith("/courses/") && path.endsWith("/learn")) return "Học khóa học";
  if (path.startsWith("/courses/")) return "Chi tiết khóa học";
  if (path.startsWith("/mentor/")) return "Khu vực cố vấn";
  if (path.startsWith("/admin/")) return "Admin";

  return path || "Không xác định";
}

export function labelAction(action) {
  return ACTION_LABELS[action] || action || "Hành động";
}

export function formatDurationMs(ms) {
  const n = Number(ms) || 0;
  if (n < 1000) return "< 1 giây";
  const sec = Math.round(n / 1000);
  if (sec < 60) return `${sec} giây`;
  const min = Math.floor(sec / 60);
  const rem = sec % 60;
  if (min < 60) return rem > 0 ? `${min} phút ${rem} giây` : `${min} phút`;
  const hr = Math.floor(min / 60);
  const m = min % 60;
  return m > 0 ? `${hr} giờ ${m} phút` : `${hr} giờ`;
}
