/** Neo cuộn trên landing (chỉ có trên trang chủ) — dùng trong Navbar chung. */
export const HOME_LANDING_ANCHORS = [
  { label: "Lộ trình", hash: "#features" },
  { label: "Khóa học", hash: "#courses" },
  { label: "Đánh giá", hash: "#testimonials" },
];

/** Menu ngang customer — xem & chọn tùy chọn tự do; đăng nhập khi bấm Phân tích / Bắt đầu phỏng vấn. */
export const CUSTOMER_NAV_ITEMS = [
  { title: "Phân tích CV", url: "/cv-analysis" },
  { title: "Phỏng vấn AI", url: "/interview" },
  { title: "Tìm Mentor", url: "/mentors" },
  { title: "Khóa học", url: "/courses" },
  { title: "Bảng giá", url: "/pricing" },
];

export function isCustomerNavActive(pathname, url) {
  if (url === "/cv-analysis") {
    return pathname === "/cv-analysis" || pathname.startsWith("/cv-analysis/");
  }
  return pathname === url || pathname.startsWith(`${url}/`);
}
