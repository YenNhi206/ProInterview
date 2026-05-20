import React, { useState } from "react";
import { useNavigate, useLocation } from "react-router";
import { Bell } from "lucide-react";
import {
  fetchNotifications,
  markAllNotificationsRead,
  markNotificationAsRead,
} from "../../utils/notificationApi";

import { SidebarTrigger } from "../ui/sidebar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";
<<<<<<< Updated upstream
=======
import {
  getUser,
  logout,
  getInitials,
  getDisplayName,
  isLoggedIn,
} from "../../utils/auth";
import { CUSTOMER_NAV_ITEMS, isCustomerNavActive } from "./customerNav";
import { CUSTOMER_SHELL_GUTTER, CUSTOMER_SHELL_MAX } from "./customerShellLayout";
import { BrandLogo } from "../brand/BrandLogo";
import { buildLoginPath, buildRegisterPath } from "../../utils/authGate";
>>>>>>> Stashed changes

const PAGE_TITLES = {
  "/dashboard": { label: "Bảng điều khiển", sub: "Tổng quan tiến độ học của bạn" },
  "/my-bookings": { label: "Lịch hẹn của tôi", sub: "Tất cả buổi mentor đã đặt" },
  "/cv-analysis": { label: "Phân tích CV/JD", sub: "Tối ưu hồ sơ theo từng vị trí" },
  "/interview": { label: "Phỏng vấn AI", sub: "Thiết lập & bắt đầu phiên luyện tập" },
  "/mentors": { label: "Tìm Mentor", sub: "Đặt lịch 1:1 với chuyên gia" },
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
  "/session": { label: "Chi tiết buổi", sub: "Lịch hẹn & trạng thái" },
  "/cv-analysis/history": { label: "Lịch sử phân tích", sub: "Các bản phân tích CV đã lưu" },
  "/mentor/meeting-detail": { label: "Chi tiết buổi mentor", sub: "Thông tin phiên họp" },
  "/mentor/meeting": { label: "Phòng họp", sub: "Buổi mentor trực tuyến" },
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

<<<<<<< Updated upstream
export function Navbar() {
=======
function CustomerNavbar() {
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);

  const loggedIn = isLoggedIn();
  const user = getUser();
  const displayName = getDisplayName(user);
  const initials = getInitials(displayName);
  const loginHref = buildLoginPath(`${location.pathname}${location.search}`);
  const registerHref = buildRegisterPath(`${location.pathname}${location.search}`);

  React.useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  React.useEffect(() => {
    if (!loggedIn) {
      setNotifications([]);
      return;
    }
    fetchNotifications().then((res) => {
      if (res.success) setNotifications(res.notifications);
    });
    const interval = setInterval(() => {
      fetchNotifications().then((res) => {
        if (res.success) setNotifications(res.notifications);
      });
    }, 60000);
    return () => clearInterval(interval);
  }, [loggedIn]);

  const handleMarkAllRead = () => {
    markAllNotificationsRead().then((res) => {
      if (res.success) {
        setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      }
    });
  };

  const handleRead = (notif) => {
    const id = notif._id;
    markNotificationAsRead(id).then((res) => {
      if (res.success) {
        setNotifications((prev) => prev.map((n) => (n._id === id ? { ...n, isRead: true } : n)));
      }
    });
    setNotifOpen(false);

    const actionUrl = notif.metadata?.actionUrl || notif.actionUrl;
    if (actionUrl) {
      navigate(actionUrl);
      return;
    }

    const bookingId = notif.metadata?.bookingId || notif.bookingId;
    if (
      bookingId &&
      (notif.type === "feedback" ||
        notif.title?.toLowerCase().includes("nhận xét") ||
        notif.body?.toLowerCase().includes("nhận xét"))
    ) {
      navigate(`/session/${bookingId}`);
      return;
    }

    if (
      bookingId &&
      (notif.type?.includes("booking") || notif.title?.toLowerCase().includes("buổi học"))
    ) {
      navigate(`/session/${bookingId}`);
      return;
    }

    if (notif.type === "payment") {
      navigate("/dashboard");
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate("/");
  };

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  return (
    <>
      <TopNavShell variant="light">
        <Link
          to="/"
          className="flex shrink-0 items-center leading-none"
          aria-label="Trang chủ"
          onClick={(e) => {
            if (location.pathname === "/" || location.pathname === "") {
              e.preventDefault();
              window.scrollTo({ top: 0, behavior: "smooth" });
            }
          }}
        >
          <img
            src="/Logo.png"
            alt=""
            className="block h-7 w-auto shrink-0 object-contain contrast-[1.12] brightness-[0.94]"
          />
        </Link>

        <CustomerNavLinks
          pathname={location.pathname}
          className="hidden min-w-0 flex-1 items-center justify-center gap-3 px-1 md:flex md:gap-4 lg:gap-5"
        />

        <div className="flex shrink-0 items-center gap-2 sm:gap-3">
          <button
            type="button"
            className="inline-flex p-2 rounded-lg text-slate-600 transition-colors hover:bg-slate-100 md:hidden"
            aria-label={mobileOpen ? "Đóng menu" : "Mở menu"}
            aria-expanded={mobileOpen}
            onClick={() => setMobileOpen((o) => !o)}
          >
            {mobileOpen ? <X className="size-5" /> : <Menu className="size-5" />}
          </button>

          {loggedIn ? (
            <>
              <DropdownMenu open={notifOpen} onOpenChange={setNotifOpen}>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className="relative inline-flex size-9 items-center justify-center rounded-xl transition-all focus:outline-none"
                    style={{
                      background: notifOpen ? "rgba(110,53,232,0.1)" : "transparent",
                      border: notifOpen ? "1px solid rgba(110,53,232,0.25)" : "1px solid transparent",
                    }}
                    aria-label="Thông báo"
                  >
                    <Bell className="h-5 w-5 text-[#6E35E8]/75" />
                    {unreadCount > 0 && (
                      <span
                        className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full font-bold text-[#1d1a26]"
                        style={{
                          background: "linear-gradient(135deg, #B4F500, #D4FF00)",
                          fontSize: "0.6rem",
                          boxShadow: "0 2px 8px rgba(180,245,0,0.45)",
                        }}
                      >
                        {unreadCount}
                      </span>
                    )}
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="end"
                  className="w-80 overflow-hidden border border-slate-200/90 bg-white p-0 text-slate-900 shadow-xl"
                >
                  <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
                    <span className="text-sm font-semibold text-slate-900">Thông báo</span>
                    {unreadCount > 0 && (
                      <button
                        type="button"
                        onClick={handleMarkAllRead}
                        className="text-[10px] font-semibold text-[#6E35E8] hover:underline"
                      >
                        Đọc tất cả
                      </button>
                    )}
                  </div>
                  <div className="max-h-[400px] overflow-y-auto py-1">
                    {notifications.length === 0 && (
                      <div className="px-4 py-8 text-center text-xs text-slate-500">
                        Không có thông báo mới
                      </div>
                    )}
                    {notifications.map((n) => (
                      <DropdownMenuItem
                        key={n._id}
                        onClick={() => handleRead(n)}
                        className="flex cursor-pointer items-start gap-3 px-4 py-3 focus:bg-violet-50"
                      >
                        <div
                          className="mt-1.5 h-2 w-2 shrink-0 rounded-full"
                          style={{
                            background: !n.isRead ? "#6E35E8" : "transparent",
                            border: !n.isRead ? "none" : "1px solid rgba(148, 163, 184, 0.5)",
                          }}
                        />
                        <div className="min-w-0 flex-1">
                          <p
                            className={`truncate text-sm ${!n.isRead ? "font-bold text-slate-900" : "font-medium text-slate-600"}`}
                          >
                            {n.title}
                          </p>
                          <p className="mt-0.5 text-xs leading-relaxed text-slate-500">
                            {n.body || n.message}
                          </p>
                        </div>
                      </DropdownMenuItem>
                    ))}
                  </div>
                </DropdownMenuContent>
              </DropdownMenu>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className="flex items-center gap-2 rounded-full border border-violet-200/80 bg-white py-1 pl-1 pr-2.5 shadow-sm transition-colors hover:border-violet-300"
                  >
                    <span
                      className="flex size-8 items-center justify-center rounded-full text-xs font-bold text-white"
                      style={{ background: "linear-gradient(135deg, #6E35E8, #9B6DFF)" }}
                    >
                      {initials}
                    </span>
                    <span className="hidden max-w-[7rem] truncate text-sm font-semibold text-slate-700 sm:inline">
                      {displayName}
                    </span>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-52">
                  <DropdownMenuItem onClick={() => navigate("/profile")}>
                    <User className="mr-2 size-4" />
                    Hồ sơ
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => navigate("/settings")}>
                    <Settings className="mr-2 size-4" />
                    Cài đặt
                  </DropdownMenuItem>
                  {user?.role === "admin" ? (
                    <DropdownMenuItem onClick={() => navigate("/admin")}>
                      <Shield className="mr-2 size-4" />
                      Quản trị
                    </DropdownMenuItem>
                  ) : null}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleLogout} className="text-red-600 focus:text-red-600">
                    <LogOut className="mr-2 size-4" />
                    Đăng xuất
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          ) : (
            <>
              <Link
                to={loginHref}
                className="hidden items-center gap-1.5 whitespace-nowrap rounded-full border border-slate-200 bg-white px-4 py-1.5 text-sm font-semibold text-slate-700 transition-all hover:bg-slate-50 sm:inline-flex"
              >
                <LogIn className="size-3.5 shrink-0" aria-hidden />
                Đăng nhập
              </Link>
              <Link
                to={registerHref}
                className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-4 py-1.5 text-sm font-semibold transition-all hover:scale-105 active:scale-95 sm:px-5"
                style={{
                  background: "#fff",
                  color: "#6E35E8",
                  border: "1.5px solid #6E35E8",
                }}
              >
                <UserPlus className="size-3.5 shrink-0" aria-hidden />
                Đăng ký
              </Link>
            </>
          )}
        </div>
      </TopNavShell>

      {mobileOpen ? (
        <div
          className={`fixed left-0 right-0 top-[3.65rem] z-[99] sm:top-[4.2rem] md:hidden ${CUSTOMER_SHELL_GUTTER}`}
        >
          <div
            className={`rounded-2xl border border-slate-200 bg-white p-4 shadow-lg ${CUSTOMER_SHELL_MAX}`}
          >
          <CustomerNavLinks
            pathname={location.pathname}
            onNavigate={() => setMobileOpen(false)}
            className="flex flex-col gap-1"
            stacked
          />
          {!loggedIn ? (
            <div className="mt-2 flex flex-col gap-2 border-t border-slate-100 pt-2">
              <Link
                to={loginHref}
                className="flex items-center justify-center gap-2 rounded-full border border-slate-200 py-2.5 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50"
                onClick={() => setMobileOpen(false)}
              >
                <LogIn className="size-4" aria-hidden />
                Đăng nhập
              </Link>
              <Link
                to={registerHref}
                className="flex items-center justify-center gap-2 rounded-full py-2.5 text-sm font-semibold transition-all"
                style={{
                  background: "#fff",
                  color: "#6E35E8",
                  border: "1.5px solid #6E35E8",
                }}
                onClick={() => setMobileOpen(false)}
              >
                <UserPlus className="size-4" aria-hidden />
                Đăng ký
              </Link>
            </div>
          ) : null}
          </div>
        </div>
      ) : null}
    </>
  );
}

function MentorNavbar() {
>>>>>>> Stashed changes
  const navigate = useNavigate();
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

  const handleMarkAllRead = () => {
    markAllNotificationsRead().then((res) => {
      if (res.success) {
        setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      }
    });
  };

  const handleRead = (notif) => {
    const id = notif._id;
    markNotificationAsRead(id).then(res => {
      if (res.success) {
        setNotifications(prev => prev.map(n => n._id === id ? { ...n, isRead: true } : n));
      }
    });

    // Close the dropdown
    setNotifOpen(false);

    // 1. Prioritize actionUrl from metadata
    const actionUrl = notif.metadata?.actionUrl || notif.actionUrl;
    if (actionUrl) {
       navigate(actionUrl);
       return;
    }

    // 2. Handle feedback type specifically
    const bookingId = notif.metadata?.bookingId || notif.bookingId;
    if (bookingId && (notif.type === "feedback" || notif.title?.toLowerCase().includes("nhận xét") || notif.body?.toLowerCase().includes("nhận xét"))) {
       navigate(`/session/${bookingId}`);
       return;
    }

    // 3. General booking navigation
    if (bookingId && (notif.type?.includes("booking") || notif.title?.toLowerCase().includes("buổi học"))) {
       navigate(`/session/${bookingId}`);
       return;
    }

    // 4. Default fallbacks
    if (notif.type === "payment") {
       navigate("/dashboard");
    }
  };


  const pageKey = Object.keys(PAGE_TITLES).find(
    (k) => k === location.pathname || location.pathname.startsWith(k + "/")
  ) || location.pathname;
  const pageInfo = PAGE_TITLES[pageKey] || { label: "ProInterview", sub: "" };
  const unreadCount = notifications.filter((n) => !n.isRead).length;

  return (
    <header
      className="sticky top-0 z-30 flex h-16 items-center gap-4 border-b px-5 antialiased backdrop-blur-xl"
      style={{
        background: "rgba(255, 255, 255, 0.92)",
        borderColor: "rgba(186, 165, 255, 0.45)",
        boxShadow: "0 1px 0 rgba(110, 53, 232, 0.08), 0 4px 20px rgba(110, 53, 232, 0.06)",
      }}
    >
      <SidebarTrigger className="rounded-lg text-[#6E35E8]/75 transition-colors hover:bg-[#6E35E8]/10 hover:text-[#6E35E8]" />

      <div className="h-6 w-px shrink-0 bg-[#6E35E8]/20" />

      <div className="min-w-0 flex flex-col gap-0">
        <h1
          className="truncate text-[#6E35E8]"
          style={{ fontSize: "0.9375rem", fontWeight: 700, lineHeight: 1.2, letterSpacing: "-0.015em" }}
        >
          {pageInfo.label}
        </h1>
        {pageInfo.sub && (
          <p className="hidden truncate text-xs text-slate-500 sm:block">{pageInfo.sub}</p>
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
                background: notifOpen ? "rgba(110,53,232,0.1)" : "transparent",
                border: notifOpen ? "1px solid rgba(110,53,232,0.25)" : "1px solid transparent",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "rgba(110,53,232,0.08)";
                e.currentTarget.style.border = "1px solid rgba(110,53,232,0.2)";
              }}
              onMouseLeave={(e) => {
                if (!notifOpen) {
                  e.currentTarget.style.background = "transparent";
                  e.currentTarget.style.border = "1px solid transparent";
                }
              }}
            >
              <Bell className="h-5 w-5 text-[#6E35E8]/75" />
              {unreadCount > 0 && (
                <span
                  className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full font-bold text-[#1d1a26]"
                  style={{
                    background: "linear-gradient(135deg, #B4F500, #D4FF00)",
                    fontSize: "0.6rem",
                    boxShadow: "0 2px 8px rgba(180,245,0,0.45)",
                  }}
                >
                  {unreadCount}
                </span>
              )}
            </button>
          </DropdownMenuTrigger>

          <DropdownMenuContent
            align="end"
            className="w-80 overflow-hidden border border-slate-200/90 bg-white p-0 text-slate-900 shadow-xl"
          >
            <div
              className="flex items-center justify-between border-b border-slate-100 px-4 py-3"
            >
              <span className="text-sm font-semibold text-slate-900">Thông báo</span>
              <div className="flex items-center gap-2">
                {unreadCount > 0 && (
                  <button
                    type="button"
                    onClick={handleMarkAllRead}
                    className="text-[10px] font-semibold text-[#6E35E8] hover:underline"
                  >
                    Đọc tất cả
                  </button>
                )}
                <span
                  className="rounded-full px-2 py-0.5 text-xs font-semibold text-[#0f172a]"
                  style={{ background: "linear-gradient(135deg, #B4F500, #93D600)" }}
                >
                  {unreadCount} mới
                </span>
              </div>
            </div>

            <div className="max-h-[400px] overflow-y-auto py-1">
              {notifications.length === 0 && (
                <div className="px-4 py-8 text-center text-xs text-slate-500">Không có thông báo mới</div>
              )}
              {notifications.map((n) => (
                <DropdownMenuItem
                  key={n._id}
                  onClick={() => handleRead(n)}
                  className="flex cursor-pointer items-start gap-3 px-4 py-3 focus:bg-violet-50"
                >
                  <div
                    className="mt-1.5 h-2 w-2 shrink-0 rounded-full"
                    style={{
                      background: !n.isRead ? (n.type === "payment" ? "#93D600" : "#6E35E8") : "transparent",
                      border: !n.isRead ? "none" : "1px solid rgba(148, 163, 184, 0.5)",
                    }}
                  />
                  <div className="min-w-0 flex-1">
                    <p className={`truncate text-sm ${!n.isRead ? "font-bold text-slate-900" : "font-medium text-slate-600"}`}>
                      {n.title}
                    </p>
                    <p className="mt-0.5 text-xs leading-relaxed text-slate-500">{n.body || n.message}</p>
                    <p className="mt-1 text-[10px] text-slate-400">
                      {new Date(n.createdAt).toLocaleDateString("vi-VN")}
                    </p>
                  </div>
                </DropdownMenuItem>
              ))}
            </div>

            <div className="border-t border-slate-100">
              <button
                type="button"
                onClick={() => {
                  handleMarkAllRead();
                  setNotifOpen(false);
                }}
                className="w-full py-3 text-xs font-semibold text-[#6E35E8] transition-colors hover:bg-violet-50"
              >
                Đánh dấu tất cả đã đọc
              </button>
            </div>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
