/** Neo cuộn trên landing (chỉ có trên trang chủ) — dùng trong Navbar chung. */
export const HOME_LANDING_ANCHORS = [
  { label: "Lộ trình", hash: "#features" },
  { label: "Khóa học", hash: "#courses" },
  { label: "Đánh giá", hash: "#mentors" },
];

/** Menu ngang cho customer (khách & đã đăng nhập) — vào trang tự do, hành động dùng tính năng mới bắt login. */
export const CUSTOMER_NAV_ITEMS = [
  { title: "Phân tích CV", url: "/cv-analysis" },
  { title: "Phỏng vấn AI", url: "/interview" },
  { title: "Khóa học", url: "/courses" },
  { title: "Tìm Mentor", url: "/mentors" },
  { title: "Bảng giá", url: "/pricing" },
];

export function isCustomerNavActive(pathname, url) {
  if (url === "/cv-analysis") {
    return pathname === "/cv-analysis" || pathname.startsWith("/cv-analysis/");
  }
  return pathname === url || pathname.startsWith(`${url}/`);
}
