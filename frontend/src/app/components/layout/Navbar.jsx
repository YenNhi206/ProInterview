import React, { useState } from "react";
import { useLocation, useNavigate } from "react-router";
import { Bell } from "lucide-react";
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
    color: "#B4F000",
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
  const navigate = useNavigate();
  const location = useLocation();
  const [notifOpen, setNotifOpen] = useState(false);

  /* Resolve current page info */
  const pageKey = Object.keys(PAGE_TITLES).find(
    (k) => k === location.pathname || location.pathname.startsWith(k + "/")
  ) || location.pathname;
  const pageInfo = PAGE_TITLES[pageKey] || { label: "ProInterview" };
  const unreadCount = MOCK_NOTIFICATIONS.filter((n) => n.unread).length;

  return (
    <header
      className="sticky top-0 z-30 h-16 flex items-center px-5 gap-4"
      style={{
        background: "#FFFFFF",
        borderBottom: "1px solid rgba(0,0,0,0.07)",
        boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
      }}
    >
      {/* Sidebar toggle */}
      <SidebarTrigger className="text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors" />

      {/* Divider */}
      <div className="h-6 w-px bg-gray-200 flex-shrink-0" />

      {/* Page title */}
      <div className="flex flex-col gap-0 min-w-0">
        <h1
          className="text-gray-900 truncate"
          style={{ fontSize: "0.9375rem", fontWeight: 700, lineHeight: 1.2, letterSpacing: "-0.015em" }}
        >
          {pageInfo.label}
        </h1>
        {pageInfo.sub && (
          <p className="text-gray-400 text-xs truncate hidden sm:block">{pageInfo.sub}</p>
        )}
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Right: Notifications only */}
      <div className="flex items-center gap-2">
        <DropdownMenu open={notifOpen} onOpenChange={setNotifOpen}>
          <DropdownMenuTrigger asChild>
            <button
              className="relative inline-flex items-center justify-center rounded-xl size-9 transition-all focus:outline-none"
              style={{
                background: notifOpen ? "rgba(110,53,232,0.08)" : "transparent",
                border: "1px solid transparent",
              }}
              onMouseEnter={(e) => {
                (e.currentTarget).style.background = "rgba(110,53,232,0.06)";
                (e.currentTarget).style.border = "1px solid rgba(110,53,232,0.12)";
              }}
              onMouseLeave={(e) => {
                if (!notifOpen) {
                  (e.currentTarget).style.background = "transparent";
                  (e.currentTarget).style.border = "1px solid transparent";
                }
              }}
            >
              <Bell className="h-5 w-5 text-gray-600" />
              {unreadCount > 0 && (
                <span
                  className="absolute -top-0.5 -right-0.5 h-4 w-4 rounded-full flex items-center justify-center font-bold text-white"
                  style={{ background: "#6E35E8", fontSize: "0.6rem", boxShadow: "0 2px 6px rgba(110,53,232,0.5)" }}
                >
                  {unreadCount}
                </span>
              )}
            </button>
          </DropdownMenuTrigger>

          <DropdownMenuContent align="end" className="w-80 p-0 overflow-hidden">
            {/* Header */}
            <div
              className="px-4 py-3 flex items-center justify-between"
              style={{ borderBottom: "1px solid rgba(0,0,0,0.06)" }}
            >
              <span className="font-semibold text-gray-800" style={{ fontSize: "0.875rem" }}>
                Thông báo
              </span>
              <span
                className="text-xs font-semibold px-2 py-0.5 rounded-full"
                style={{ background: "rgba(110,53,232,0.1)", color: "#6E35E8" }}
              >
                {unreadCount} mới
              </span>
            </div>

            {/* Items */}
            <div className="py-1">
              {MOCK_NOTIFICATIONS.map((n) => (
                <DropdownMenuItem
                  key={n.id}
                  className="flex items-start gap-3 px-4 py-3 cursor-pointer focus:bg-gray-50"
                >
                  <div
                    className="w-2 h-2 rounded-full mt-1.5 flex-shrink-0"
                    style={{
                      background: n.unread ? n.color : "transparent",
                      border: n.unread ? "none" : "1px solid #e5e7eb",
                    }}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate">{n.title}</p>
                    <p className="text-xs text-gray-400 mt-0.5 leading-relaxed">{n.message}</p>
                    <p className="text-[10px] text-gray-300 mt-1">{n.time}</p>
                  </div>
                </DropdownMenuItem>
              ))}
            </div>

            {/* Footer */}
            <div style={{ borderTop: "1px solid rgba(0,0,0,0.06)" }}>
              <button
                className="w-full py-3 text-xs font-semibold transition-colors hover:bg-gray-50"
                style={{ color: "#6E35E8" }}
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