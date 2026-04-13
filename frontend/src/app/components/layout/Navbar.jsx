import React, { useState } from "react";
import { useLocation } from "react-router";
import { Bell } from "lucide-react";
import { fetchNotifications, markNotificationAsRead } from "../../utils/notificationApi";

import { SidebarTrigger } from "../ui/sidebar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";

const PAGE_TITLES = {
  "/dashboard": { label: "Bảng điều khiển", sub: "Tổng quan tiến độ học của bạn" },
  "/cv-analysis": { label: "Phân tích CV/JD", sub: "Tối ưu hồ sơ theo từng vị trí" },
  "/interview": { label: "Phỏng vấn AI", sub: "Thiết lập & bắt đầu phiên luyện tập" },
  "/mentors": { label: "Tìm Mentor", sub: "Đặt lịch 1-1 với chuyên gia" },
  "/profile": { label: "Hồ sơ cá nhân", sub: "Thông tin và thành tích của bạn" },
  "/settings": { label: "Cài đặt", sub: "Tuỳ chỉnh tài khoản" },
  "/pricing": { label: "Bảng giá", sub: "Nâng cấp để mở khoá đầy đủ tính năng" },
  "/booking": { label: "Đặt lịch", sub: "Chọn thời gian phù hợp với mentor" },
  "/courses": { label: "Khóa học", sub: "Khám phá các khóa học nâng cao kỹ năng" },
  "/mentor/dashboard": { label: "Mentor", sub: "Bảng điều khiển mentor" },
  "/mentor/schedule": { label: "Lịch họp", sub: "Quản lý slot & buổi họp" },
  "/mentor/courses": { label: "Khóa học", sub: "Quản lý nội dung khóa" },
  "/mentor/finance": { label: "Tài chính", sub: "Thu nhập & giao dịch" },
  "/mentor/analytics": { label: "Phân tích", sub: "Số liệu & hiệu suất" },
  "/mentor/reviews": { label: "Đánh giá", sub: "Phản hồi từ học viên" },
  "/mentor/peer-review": { label: "Đánh giá chéo", sub: "Peer review mentor" },
};

const MOCK_NOTIFICATIONS = [
  {
    id: 1,
    title: "Buổi phỏng vấn sắp tới",
    message: "Mentor Nguyễn Văn A — trong 1 giờ nữa",
    time: "1 giờ trước",
    unread: true,
    color: "#6E35E8",
  },
  {
    id: 2,
    title: "Phản hồi mới từ Mentor",
    message: "Xem chi tiết đánh giá buổi phỏng vấn",
    time: "3 giờ trước",
    unread: true,
    color: "#c4ff47",
  },
  {
    id: 3,
    title: "Hoàn thành phân tích CV",
    message: "Kết quả phân tích đã sẵn sàng để xem",
    time: "Hôm qua",
    unread: false,
    color: "#FFD600",
  },
];

export function Navbar() {
  const location = useLocation();
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);

  React.useEffect(() => {
    fetchNotifications().then(res => {
      if (res.success) setNotifications(res.notifications);
    });
    // Optional: set polling
    const interval = setInterval(() => {
      fetchNotifications().then(res => {
        if (res.success) setNotifications(res.notifications);
      });
    }, 60000); 
    return () => clearInterval(interval);
  }, []);

  const handleRead = (id) => {
    markNotificationAsRead(id).then(res => {
      if (res.success) {
        setNotifications(prev => prev.map(n => n._id === id ? { ...n, isRead: true } : n));
      }
    });
  };


  const pageKey = Object.keys(PAGE_TITLES).find(
    (k) => k === location.pathname || location.pathname.startsWith(k + "/")
  ) || location.pathname;
  const pageInfo = PAGE_TITLES[pageKey] || { label: "ProInterview", sub: "" };
  const unreadCount = notifications.filter((n) => !n.isRead).length;

  return (
    <header
      className="sticky top-0 z-30 flex h-16 items-center gap-4 border-b border-white/10 px-5 backdrop-blur-xl"
      style={{
        background: "rgba(18, 11, 46, 0.82)",
        boxShadow:
          "0 1px 0 rgba(255,255,255,0.06), 0 -1px 24px -8px rgba(196, 255, 71, 0.06) inset",
      }}
    >
      <SidebarTrigger className="rounded-lg text-white/50 transition-colors hover:bg-white/10 hover:text-white" />

      <div className="h-6 w-px shrink-0 bg-white/15" />

      <div className="min-w-0 flex flex-col gap-0">
        <h1
          className="truncate text-white"
          style={{ fontSize: "0.9375rem", fontWeight: 700, lineHeight: 1.2, letterSpacing: "-0.015em" }}
        >
          {pageInfo.label}
        </h1>
        {pageInfo.sub && (
          <p className="hidden truncate text-xs text-white/45 sm:block">{pageInfo.sub}</p>
        )}
      </div>

      <div className="flex-1" />

      <div className="flex items-center gap-2">
        <DropdownMenu open={notifOpen} onOpenChange={setNotifOpen}>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="relative inline-flex size-9 items-center justify-center rounded-xl transition-all focus:outline-none"
              style={{
                background: notifOpen ? "rgba(110,53,232,0.2)" : "transparent",
                border: notifOpen ? "1px solid rgba(110,53,232,0.35)" : "1px solid transparent",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "rgba(110,53,232,0.15)";
                e.currentTarget.style.border = "1px solid rgba(110,53,232,0.28)";
              }}
              onMouseLeave={(e) => {
                if (!notifOpen) {
                  e.currentTarget.style.background = "transparent";
                  e.currentTarget.style.border = "1px solid transparent";
                }
              }}
            >
              <Bell className="h-5 w-5 text-white/65" />
              {unreadCount > 0 && (
                <span
                  className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full font-bold text-white"
                  style={{
                    background: "linear-gradient(135deg, #6E35E8, #9B6DFF)",
                    fontSize: "0.6rem",
                    boxShadow: "0 2px 8px rgba(110,53,232,0.55)",
                  }}
                >
                  {unreadCount}
                </span>
              )}
            </button>
          </DropdownMenuTrigger>

          <DropdownMenuContent
            align="end"
            className="w-80 overflow-hidden border border-white/10 bg-[#160f36] p-0 text-white shadow-2xl"
          >
            <div
              className="flex items-center justify-between px-4 py-3"
              style={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }}
            >
              <span className="text-sm font-semibold text-white">Thông báo</span>
              <span
                className="rounded-full px-2 py-0.5 text-xs font-semibold"
                style={{ background: "rgba(196, 255, 71,0.15)", color: "#c5f076" }}
              >
                {unreadCount} mới
              </span>
            </div>

            <div className="py-1 max-h-[400px] overflow-y-auto">
              {notifications.length === 0 && (
                <div className="px-4 py-8 text-center text-zinc-500 text-xs">Không có thông báo mới</div>
              )}
              {notifications.map((n) => (
                <DropdownMenuItem
                  key={n._id}
                  onClick={() => handleRead(n._id)}
                  className="flex cursor-pointer items-start gap-3 px-4 py-3 focus:bg-white/8"
                >
                  <div
                    className="mt-1.5 h-2 w-2 shrink-0 rounded-full"
                    style={{
                      background: !n.isRead ? (n.type === "payment" ? "#c4ff47" : "#6E35E8") : "transparent",
                      border: !n.isRead ? "none" : "1px solid rgba(255,255,255,0.2)",
                    }}
                  />
                  <div className="min-w-0 flex-1">
                    <p className={`truncate text-sm ${!n.isRead ? "font-bold text-white" : "font-medium text-white/70"}`}>
                      {n.title}
                    </p>
                    <p className="mt-0.5 text-xs leading-relaxed text-white/50">{n.message}</p>
                    <p className="mt-1 text-[10px] text-white/35">
                      {new Date(n.createdAt).toLocaleDateString("vi-VN")}
                    </p>
                  </div>
                </DropdownMenuItem>
              ))}
            </div>

            <div style={{ borderTop: "1px solid rgba(255,255,255,0.08)" }}>
              <button
                type="button"
                className="w-full py-3 text-xs font-semibold text-[#c4f06a] transition-colors hover:bg-white/6"
              >
                Xem tất cả thông báo
              </button>
            </div>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
