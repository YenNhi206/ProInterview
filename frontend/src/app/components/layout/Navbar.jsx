import React, { useState } from "react";
import { Link, useNavigate, useLocation } from "react-router";
import {
  BookOpen,
  Calendar,
  FileText,
  LogIn,
  LogOut,
  Menu,
  Settings,
  Shield,
  ShoppingCart,
  ShoppingBag,
  User,
  UserPlus,
  X,
} from "lucide-react";
import { TopNavShell } from "./TopNavShell";
import { HOME_SHELL_MAX } from "./customerShellLayout";
import { NotificationCenter } from "./NotificationCenter.jsx";
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
import { useCart } from "../../hooks/useCart.jsx";

const PAGE_TITLES = {
  "/cart": { label: "Giỏ hàng", sub: "Khóa học đã chọn và thanh toán" },
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
              className="rounded-xl px-4 py-2.5 text-sm font-semibold text-white/70 transition-colors hover:bg-white/5 hover:text-white"
              style={active ? { color: "#c7f36b", fontWeight: 800 } : undefined}
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
              color: active ? "#c7f36b" : "rgba(255, 255, 255, 0.7)",
              fontWeight: active ? 800 : 500,
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
  const { cart } = useCart();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  const { loggedIn, user } = useAuthSession();
  const displayName = getDisplayName(user);
  const initials = getInitials(displayName);
  const loginHref = buildLoginPath(`${location.pathname}${location.search}`);
  const registerHref = buildRegisterPath(`${location.pathname}${location.search}`);
  const isHome = location.pathname === "/" || location.pathname === "";

  React.useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  const handleRead = (notif) => {
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
            className="block h-7 w-auto shrink-0 object-contain brightness-0 invert opacity-90"
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
          <Link
            to={loggedIn ? "/cart" : buildLoginPath("/cart")}
            aria-label={`Giỏ hàng, ${cart.items.length} khóa học`}
            aria-current={location.pathname === "/cart" ? "page" : undefined}
            title="Giỏ hàng"
            className="relative inline-flex size-9 items-center justify-center rounded-xl text-slate-300 transition-colors hover:bg-white/10 hover:text-white"
          >
            <ShoppingCart className="size-5" />
            {cart.items.length > 0 && (
              <span
                aria-hidden="true"
                className="absolute -right-1 -top-1 flex size-4 items-center justify-center rounded-full bg-[#93f72b] text-[10px] font-bold text-slate-900"
              >
                {cart.items.length > 99 ? "99+" : cart.items.length}
              </span>
            )}
          </Link>
          {loggedIn ? (
            <>
              <NotificationCenter active={loggedIn} onSelect={handleRead} />

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className="flex shrink-0 items-center justify-center rounded-full border border-white/20 bg-white/5 p-0 transition-colors hover:border-violet-400/60 hover:bg-white/10 size-7 md:gap-2 md:py-1 md:pl-1 md:pr-2.5 md:size-auto"
                  >
                    <NavUserAvatar avatar={user?.avatar} initials={initials} />
                    <span className="hidden max-w-[7rem] truncate text-sm font-semibold text-white md:inline">
                      {displayName}
                    </span>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-60">
                  <DropdownMenuItem onClick={() => navigate("/profile")}>
                    <User className="mr-2 size-4" />
                    Hồ sơ
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => navigate("/cv-analysis/history")}>
                    <FileText className="mr-2 size-4" />
                    Lịch sử phân tích CV
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
                  <DropdownMenuItem onClick={() => navigate("/payment-history")}>
                    <ShoppingCart className="mr-2 size-4" /> Lịch sử thanh toán
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
                    variant="destructive"
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
                className="hidden sm:inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-4 py-2 text-sm font-medium text-white/80 transition-all hover:text-white"
              >
                <LogIn className="size-3.5 shrink-0" aria-hidden />
                Đăng nhập
              </Link>
              <Link
                to={registerHref}
                className="hidden sm:inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border border-white/20 px-5 py-2 text-sm font-medium text-white transition-all hover:border-[#93f72b] hover:text-[#93f72b]"
              >
                <UserPlus className="size-3.5 shrink-0" aria-hidden />
                Đăng ký
              </Link>
            </>
          )}

          <button
            type="button"
            className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg p-2 text-slate-600 transition-colors hover:bg-slate-100 md:hidden"
            aria-label={mobileOpen ? "Đóng menu" : "Mở menu"}
            aria-expanded={mobileOpen}
            onClick={() => setMobileOpen((o) => !o)}
          >
            {mobileOpen ? <X className="size-5" /> : <Menu className="size-5" />}
          </button>
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
          className="top-nav-shell-outer fixed right-3 top-[3.8rem] z-[99] w-[min(100vw-1.5rem,16rem)] sm:right-6 sm:top-[4.2rem] md:hidden"
        >
          <div
            className="liquid-glass rounded-2xl p-3 shadow-2xl"
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
            <div className="mt-2 flex flex-col gap-2 border-t border-white/10 pt-2">
              <Link
                to={loginHref}
                className="liquid-glass flex items-center justify-center gap-2 rounded-full py-2.5 text-sm font-semibold text-white transition-colors"
                onClick={() => setMobileOpen(false)}
              >
                <LogIn className="size-4" aria-hidden />
                Đăng nhập
              </Link>
              <Link
                to={registerHref}
                className="liquid-glass-strong flex items-center justify-center gap-2 rounded-full py-2.5 text-sm font-semibold text-white transition-all"
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
  const [mobileOpen, setMobileOpen] = useState(false);

  const { user } = useAuthSession();

  const displayName = getDisplayName(user);
  const initials = getInitials(displayName);

  React.useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  const handleRead = (notif) => {
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
            className="block h-7 w-auto shrink-0 object-contain brightness-0 invert opacity-90"
          />
        </Link>

        <ShellNavLinks
          items={MENTOR_MAIN_NAV}
          pathname={location.pathname}
          isActive={(p, item) => isMentorNavActive(p, item.url)}
          className="hidden min-w-0 flex-1 items-center justify-center gap-2 px-1 md:flex md:gap-3 lg:gap-4 xl:gap-5"
        />

        <div className="flex shrink-0 items-center gap-2 sm:gap-3">
          <NotificationCenter active={Boolean(user)} onSelect={handleRead} />

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="flex shrink-0 items-center justify-center rounded-full border border-white/20 bg-white/5 p-0 transition-colors hover:border-violet-400/60 hover:bg-white/10 size-7 md:gap-2 md:py-1 md:pl-1 md:pr-2.5 md:size-auto"
                aria-label="Tài khoản mentor"
              >
                <NavUserAvatar avatar={user?.avatar} initials={initials} />
                <span className="hidden max-w-[7rem] truncate text-sm font-semibold text-white md:inline">
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
              <DropdownMenuItem asChild>
                <Link to="/payment-history" className="flex cursor-pointer items-center gap-2"><ShoppingCart className="size-4" />Lịch sử thanh toán</Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={handleLogout}
                variant="destructive"
              >
                <LogOut className="size-4" />
                Đăng xuất
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <button
            type="button"
            className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg p-2 text-slate-600 transition-colors hover:bg-slate-100 md:hidden"
            aria-label={mobileOpen ? "Đóng menu" : "Mở menu"}
            aria-expanded={mobileOpen}
            onClick={() => setMobileOpen((o) => !o)}
          >
            {mobileOpen ? <X className="size-5" /> : <Menu className="size-5" />}
          </button>
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
