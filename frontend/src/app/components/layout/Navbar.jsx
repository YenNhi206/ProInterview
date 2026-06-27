import React, { useEffect, useState } from "react";
import { Link, useNavigate, useLocation } from "react-router";
import {
  Bell,
  BookOpen,
  Calendar,
  LogIn,
  LogOut,
  Menu,
  Settings,
  Shield,
  User,
  UserPlus,
  X,
} from "lucide-react";
import { TopNavShell } from "./TopNavShell";
import { HOME_SHELL_MAX } from "./customerShellLayout";
import { useNavbarNotifications } from "../../hooks/useNavbarNotifications.js";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import {
  logout,
  getInitials,
  getDisplayName,
} from "../../utils/auth/auth.js";
import { useAuthSession } from "../../hooks/useAuthSession";
import { CUSTOMER_NAV_ITEMS, isCustomerNavActive } from "./customerNav";
import { buildLoginPath, buildRegisterPath } from "../../utils/auth/authGate.js";
import {
  MENTOR_MAIN_NAV,
  MENTOR_SECONDARY_NAV,
  isMentorNavActive,
} from "./mentorNav.js";
import { NavUserAvatar } from "./NavUserAvatar.jsx";

const PAGE_TITLES = {
  "/my-bookings": {
    label: "Lịch hẹn của bạn",
    sub: "Buổi Mentor đã đặt, lịch sắp tới và trạng thái",
  },
  "/cv-analysis": { label: "Phân tích CV", sub: "Phân tích CV với JD hoặc chuẩn ngành, biết chỗ cần chỉnh" },
  "/cv-analysis/jd/history": { label: "Lịch sử CV + JD", sub: "Các lần phân tích CV với Job Description" },
  "/cv-analysis/field/history": { label: "Lịch sử theo ngành", sub: "Các lần phân tích CV theo ngành nghề" },
  "/cv-analysis/jd": { label: "Phân tích CV + JD", sub: "Phân tích CV với Job Description" },
  "/cv-analysis/field": { label: "Phân tích theo ngành", sub: "Đánh giá CV theo chuẩn ngành nghề" },
  "/interview": { label: "Phỏng vấn AI", sub: "Thiết lập buổi luyện, Pio hỏi, bạn trả lời" },
  "/mentors": { label: "Tìm Mentor", sub: "Đặt lịch 1:1 với anh/chị mentor" },
  "/profile": { label: "Hồ sơ cá nhân", sub: "Thông tin và thành tích của bạn" },
  "/settings": { label: "Cài đặt", sub: "Tuỳ chỉnh tài khoản" },
  "/pricing": { label: "Bảng giá", sub: "Chọn gói phù hợp, luyện và nhận góp ý đầy đủ hơn" },
  "/booking": { label: "Đặt lịch", sub: "Chọn thời gian phù hợp với mentor" },
  "/courses": { label: "Khóa học", sub: "Video ngắn từ mentor, ôn kỹ năng trước phỏng vấn" },
  "/my-courses": { label: "Khóa học của tôi", sub: "Tiến độ và khóa bạn đã đăng ký" },
  "/mentor/dashboard": { label: "Mentor", sub: "Bảng điều khiển mentor" },
  "/mentor/schedule": { label: "Lịch họp", sub: "Lịch rảnh và các buổi hẹn" },
  "/mentor/courses": { label: "Khóa học", sub: "Quản lý nội dung khóa học" },
  "/mentor/finance": { label: "Tài chính", sub: "Thu nhập & giao dịch" },
  "/mentor/analytics": { label: "Phân tích", sub: "Số liệu & hiệu suất" },
  "/mentor/reviews": { label: "Đánh giá", sub: "Phản hồi từ học viên" },
  "/mentor/peer-review": { label: "Đánh giá chéo", sub: "Đánh giá chéo khóa học của đồng nghiệp" },
  "/checkout": { label: "Thanh toán", sub: "Chuyển khoản & xác nhận đơn" },
  "/session": { label: "Chi tiết buổi", sub: "Lịch hẹn & trạng thái" },
  "/mentor/meeting-detail": { label: "Chi tiết buổi mentor", sub: "Thông tin phiên họp" },
  "/mentor/meeting": { label: "Phòng họp", sub: "Buổi mentor trực tuyến" },
};

function ShellNavLinks({ items, pathname, isActive, onNavigate, className = "", stacked = false }) {
  return (
    <nav className={className} aria-label="Menu chính">
      {items.map((item) => {
        const active = isActive(pathname, item);
        if (stacked) {
          return (
            <Link
              key={item.url}
              to={item.url}
              onClick={onNavigate}
              className="rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-700 transition-colors hover:bg-violet-50 hover:text-violet-700"
              style={active ? { color: "#8037f4", fontWeight: 800 } : undefined}
            >
              {item.title}
            </Link>
          );
        }
        return (
          <Link
            key={item.url}
            to={item.url}
            onClick={onNavigate}
            className="relative shrink-0 cursor-pointer whitespace-nowrap py-1 text-sm transition-all duration-300"
            style={{
              color: active ? "#8037f4" : "rgb(71, 85, 105)",
              fontWeight: active ? 800 : 600,
            }}
          >
            {item.title}
            <span
              className={`absolute -bottom-1 left-0 h-[3px] w-full rounded-full transition-all duration-300 ${
                active ? "scale-x-100 opacity-100" : "scale-x-0 opacity-0"
              }`}
              style={{
                background: "#93f72b",
                boxShadow: "0 0 12px rgba(196, 255, 71, 0.8)",
              }}
              aria-hidden
            />
          </Link>
        );
      })}
    </nav>
  );
}

function CustomerNavbar() {
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);

  const { loggedIn, user } = useAuthSession();
  const {
    notifications,
    unreadCount,
    loadNotifications,
    handleMarkAllRead,
    handleMarkOneRead,
  } = useNavbarNotifications(loggedIn);

  useEffect(() => {
    if (notifOpen && loggedIn) loadNotifications();
  }, [notifOpen, loggedIn, loadNotifications]);
  const displayName = getDisplayName(user);
  const initials = getInitials(displayName);
  const loginHref = buildLoginPath(`${location.pathname}${location.search}`);
  const registerHref = buildRegisterPath(`${location.pathname}${location.search}`);
  const isHome = location.pathname === "/" || location.pathname === "";

  React.useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  const handleRead = (notif) => {
    const id = notif._id;
    handleMarkOneRead(id);
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
      navigate("/");
      return;
    }

    if (
      notif.type === "system" &&
      (notif.title?.includes("mentor") || notif.body?.toLowerCase().includes("mentor"))
    ) {
      navigate("/profile");
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate("/");
  };

  return (
    <>
      <TopNavShell
        variant="light"
        alignTop={isHome}
        shellMax={isHome ? HOME_SHELL_MAX : undefined}
      >
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

        <ShellNavLinks
          items={CUSTOMER_NAV_ITEMS}
          pathname={location.pathname}
          isActive={(p, item) => isCustomerNavActive(p, item.url)}
          className={`hidden items-center justify-center gap-3 px-1 md:flex md:gap-4 lg:gap-5 ${
            isHome ? "shrink-0" : "min-w-0 flex-1"
          }`}
        />

        <div className="flex shrink-0 items-center gap-2 sm:gap-3">
          <button
            type="button"
            className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg p-2 text-slate-600 transition-colors hover:bg-slate-100 md:hidden"
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
                      className="relative inline-flex size-8 shrink-0 items-center justify-center rounded-xl transition-all focus:outline-none md:size-9"
                      style={{
                        background: notifOpen ? "rgba(128,55,244,0.1)" : "transparent",
                        border: notifOpen ? "1px solid rgba(128,55,244,0.25)" : "1px solid transparent",
                      }}
                      aria-label="Thông báo"
                    >
                      <Bell className="size-4 text-[#8037f4]/75 md:size-5" />
                      {unreadCount > 0 && (
                        <span
                          className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full font-bold text-[#1d1a26]"
                          style={{
                            background: "#93f72b",
                            fontSize: "0.6rem",
                            boxShadow: "0 2px 8px rgba(180,245,0,0.45)",
                          }}
                        >
                          {unreadCount > 9 ? "9+" : unreadCount}
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
                        className="text-[10px] font-semibold text-[#8037f4] hover:underline"
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
                            background: !n.isRead ? "#8037f4" : "transparent",
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
                    className="flex shrink-0 items-center justify-center rounded-full border border-violet-200/80 bg-white p-0 shadow-sm transition-colors hover:border-violet-300 size-7 md:gap-2 md:py-1 md:pl-1 md:pr-2.5 md:size-auto"
                  >
                    <NavUserAvatar avatar={user?.avatar} initials={initials} />
                    <span className="hidden max-w-[7rem] truncate text-sm font-semibold text-slate-700 md:inline">
                      {displayName}
                    </span>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-52">
                  <DropdownMenuItem onClick={() => navigate("/profile")}>
                    <User className="mr-2 size-4" />
                    Hồ sơ
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => navigate("/my-courses")}>
                    <BookOpen className="mr-2 size-4" />
                    Khóa học của tôi
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => navigate("/my-bookings")}>
                    <Calendar className="mr-2 size-4" />
                    Lịch hẹn của tôi
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
                  <DropdownMenuItem
                    onClick={handleLogout}
                    className="font-semibold text-[#8037f4] focus:text-[#8037f4]"
                  >
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
                className="hidden sm:inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-4 py-1.5 text-sm font-semibold transition-all hover:scale-105 active:scale-95 sm:px-5"
                style={{
                  background: "#fff",
                  color: "#8037f4",
                  border: "1.5px solid #8037f4",
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
        <>
          <button
            type="button"
            className="fixed inset-0 z-[98] bg-slate-900/25 md:hidden"
            aria-label="Đóng menu"
            onClick={() => setMobileOpen(false)}
          />
        <div
          className="top-nav-shell-outer fixed right-3 top-[3.8rem] z-[99] w-[14rem] sm:right-6 sm:top-[4.2rem] sm:w-[16rem] md:hidden"
        >
          <div
            className="rounded-2xl border border-slate-200 bg-white p-3 shadow-2xl"
          >
          <ShellNavLinks
            items={CUSTOMER_NAV_ITEMS}
            pathname={location.pathname}
            isActive={(p, item) => isCustomerNavActive(p, item.url)}
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
                  color: "#8037f4",
                  border: "1.5px solid #8037f4",
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
        </>
      ) : null}
    </>
  );
}

function MentorNavbar() {
  const navigate = useNavigate();
  const location = useLocation();
  const [notifOpen, setNotifOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const { user } = useAuthSession();
  const {
    notifications,
    unreadCount,
    loadNotifications,
    handleMarkAllRead,
    handleMarkOneRead,
  } = useNavbarNotifications(Boolean(user));

  useEffect(() => {
    if (notifOpen && user) loadNotifications();
  }, [notifOpen, user, loadNotifications]);

  const displayName = getDisplayName(user);
  const initials = getInitials(displayName);

  React.useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  const handleRead = (notif) => {
    handleMarkOneRead(notif._id);
    setNotifOpen(false);

    const actionUrl = notif.metadata?.actionUrl || notif.actionUrl;
    if (actionUrl) {
      navigate(actionUrl);
      return;
    }

    const bookingId = notif.metadata?.bookingId || notif.bookingId;
    if (bookingId) {
      navigate(`/mentor/meeting-detail/${bookingId}`);
      return;
    }

    if (notif.type === "payment") {
      navigate("/mentor/finance");
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate("/");
  };

  return (
    <>
      <TopNavShell variant="light" alignTop={false}>
        <Link
          to="/mentor/dashboard"
          className="flex shrink-0 items-center leading-none"
          aria-label="ProInterview Mentor"
        >
          <img
            src="/Logo.png"
            alt=""
            className="block h-7 w-auto shrink-0 object-contain contrast-[1.12] brightness-[0.94]"
          />
        </Link>

        <ShellNavLinks
          items={MENTOR_MAIN_NAV}
          pathname={location.pathname}
          isActive={(p, item) => isMentorNavActive(p, item.url)}
          className="hidden min-w-0 flex-1 items-center justify-center gap-2 px-1 md:flex md:gap-3 lg:gap-4 xl:gap-5"
        />

        <div className="flex shrink-0 items-center gap-2 sm:gap-3">
          <button
            type="button"
            className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg p-2 text-slate-600 transition-colors hover:bg-slate-100 md:hidden"
            aria-label={mobileOpen ? "Đóng menu" : "Mở menu"}
            aria-expanded={mobileOpen}
            onClick={() => setMobileOpen((o) => !o)}
          >
            {mobileOpen ? <X className="size-5" /> : <Menu className="size-5" />}
          </button>

          <DropdownMenu open={notifOpen} onOpenChange={setNotifOpen}>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="relative inline-flex size-8 shrink-0 items-center justify-center rounded-xl transition-all focus:outline-none md:size-9"
                style={{
                  background: notifOpen ? "rgba(128,55,244,0.1)" : "transparent",
                  border: notifOpen ? "1px solid rgba(128,55,244,0.25)" : "1px solid transparent",
                }}
                aria-label="Thông báo"
              >
                <Bell className="size-4 text-[#8037f4]/75 md:size-5" />
                {unreadCount > 0 && (
                  <span
                    className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full font-bold text-[#1d1a26]"
                    style={{
                      background: "#93f72b",
                      fontSize: "0.6rem",
                      boxShadow: "0 2px 8px rgba(180,245,0,0.45)",
                    }}
                  >
                    {unreadCount > 9 ? "9+" : unreadCount}
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
                    className="text-[10px] font-semibold text-[#8037f4] hover:underline"
                  >
                    Đọc tất cả
                  </button>
                )}
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
                        background: !n.isRead ? "#8037f4" : "transparent",
                        border: !n.isRead ? "none" : "1px solid rgba(148, 163, 184, 0.5)",
                      }}
                    />
                    <div className="min-w-0 flex-1">
                      <p
                        className={`truncate text-sm ${!n.isRead ? "font-bold text-slate-900" : "font-medium text-slate-600"}`}
                      >
                        {n.title}
                      </p>
                      <p className="mt-0.5 text-xs leading-relaxed text-slate-500">{n.body || n.message}</p>
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
                className="flex shrink-0 items-center justify-center rounded-full border border-violet-200/80 bg-white p-0 shadow-sm transition-colors hover:border-violet-300 size-7 md:gap-2 md:py-1 md:pl-1 md:pr-2.5 md:size-auto"
                aria-label="Tài khoản mentor"
              >
                <NavUserAvatar avatar={user?.avatar} initials={initials} />
                <span className="hidden max-w-[7rem] truncate text-sm font-semibold text-slate-700 md:inline">
                  {displayName}
                </span>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <div className="border-b border-border px-3 py-2.5">
                <p className="truncate text-sm font-semibold text-slate-900">{displayName}</p>
                <p className="truncate text-xs text-slate-500">{user?.email || ""}</p>
              </div>
              <DropdownMenuItem asChild>
                <Link to="/profile" className="flex cursor-pointer items-center gap-2">
                  <User className="size-4" />
                  Hồ sơ
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link to="/settings" className="flex cursor-pointer items-center gap-2">
                  <Settings className="size-4" />
                  Cài đặt
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={handleLogout}
                className="flex cursor-pointer items-center gap-2 font-semibold text-[#8037f4] focus:text-[#8037f4]"
              >
                <LogOut className="size-4" />
                Đăng xuất
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </TopNavShell>

      {mobileOpen ? (
        <>
          <button
            type="button"
            className="fixed inset-0 z-[98] bg-slate-900/25 md:hidden"
            aria-label="Đóng menu"
            onClick={() => setMobileOpen(false)}
          />
        <div className="top-nav-shell-outer fixed right-3 top-[3.8rem] z-[99] w-[min(100vw-1.5rem,18rem)] sm:right-6 sm:top-[4.2rem] md:hidden">
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
            <MentorMobileNavPanel
              pathname={location.pathname}
              onNavigate={() => setMobileOpen(false)}
            />
          </div>
        </div>
        </>
      ) : null}
    </>
  );
}

function MentorMobileNavPanel({ pathname, onNavigate }) {
  return (
    <div className="max-h-[min(70vh,520px)] overflow-y-auto py-2">
      <p className="px-4 pb-2 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">
        Menu chính
      </p>
      <div className="space-y-1 px-3">
        {MENTOR_MAIN_NAV.map((item) => {
          const active = isMentorNavActive(pathname, item.url);
          const Icon = item.icon;
          return (
            <Link
              key={item.url}
              to={item.url}
              onClick={onNavigate}
              className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
                active ? "bg-[#8037f4] text-white shadow-[0_4px_14px_rgba(128,55,244,0.28)]" : "text-slate-700 hover:bg-slate-50"
              }`}
            >
              <Icon className={`size-[18px] shrink-0 ${active ? "text-white" : "text-slate-500"}`} />
              <span className="flex-1">{item.title}</span>
              {active ? <span className="size-1.5 rounded-full bg-[#93f72b]" /> : null}
            </Link>
          );
        })}
      </div>
      <div className="mx-4 my-3 h-px bg-slate-200" />
      <p className="px-4 pb-2 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">
        Khác
      </p>
      <div className="space-y-1 px-3 pb-2">
        {MENTOR_SECONDARY_NAV.map((item) => {
          const active = isMentorNavActive(pathname, item.url);
          const Icon = item.icon;
          return (
            <Link
              key={item.url}
              to={item.url}
              onClick={onNavigate}
              className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
                active ? "bg-[#8037f4] text-white" : "text-slate-700 hover:bg-slate-50"
              }`}
            >
              <Icon className={`size-[18px] shrink-0 ${active ? "text-white" : "text-slate-500"}`} />
              {item.title}
            </Link>
          );
        })}
      </div>
    </div>
  );
}

export function Navbar({ variant = "customer" }) {
  if (variant === "mentor") {
    return <MentorNavbar />;
  }
  return <CustomerNavbar />;
}
