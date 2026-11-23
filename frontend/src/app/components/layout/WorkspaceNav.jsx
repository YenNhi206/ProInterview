import React, { createContext, useContext, useEffect, useLayoutEffect, useState } from "react";
import { Link, NavLink, useLocation, useNavigate } from "react-router";
import { Check, ChevronDown, LogOut, Menu, Monitor, Moon, Sun, User, Settings, ChevronsUpDown } from "lucide-react";
import { NotificationCenter } from "./NotificationCenter.jsx";
import { NavUserAvatar } from "./NavUserAvatar.jsx";
import { useAuthSession } from "../../hooks/useAuthSession";
import { useWorkspaceTheme } from "../../hooks/useWorkspaceTheme.js";
import { getDisplayName, getInitials, logout } from "../../utils/auth/auth.js";
import { Sheet, SheetContent, SheetTitle, SheetDescription, SheetTrigger } from "../ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import { SelectThemeContext } from "../ui/AppSelect";
import "../../../styles/mentor-workspace.css";
import "../../../styles/mentor-workspace-light.css";

/** `null` = khu này chưa cho đổi sáng/tối. */
export const WorkspaceThemeContext = createContext(null);

const THEME_OPTIONS = [
  { value: "light", label: "Sáng", title: "Giao diện sáng", Icon: Sun },
  { value: "dark", label: "Tối", title: "Giao diện tối", Icon: Moon },
  { value: "system", label: "Hệ thống", title: "Theo cài đặt sáng/tối của máy", Icon: Monitor },
];

/** Nút chọn Sáng / Tối / Hệ thống ở cuối sidebar; ẩn ở khu chưa hỗ trợ. */
export function WorkspaceThemeSwitch() {
  const theme = useContext(WorkspaceThemeContext);
  if (!theme) return null;
  return (
    <div className="mentor-workspace-theme" role="radiogroup" aria-label="Giao diện">
      {THEME_OPTIONS.map(({ value, label, title, Icon }) => (
        <button
          key={value}
          type="button"
          role="radio"
          aria-checked={theme.mode === value}
          title={title}
          className={theme.mode === value ? "is-active" : ""}
          onClick={() => theme.setMode(value)}
        >
          <Icon size={14} strokeWidth={1.8} aria-hidden />
          <span>{label}</span>
        </button>
      ))}
    </div>
  );
}

/**
 * Sidebar workspace dùng chung (Mentor, Company, Moderator, Admin).
 */
function WorkspaceMenu({ config, onClose, active }) {
  const { homeUrl, label, badge, heading, mainNav, groups, separatorIndex } = config;
  const { user } = useAuthSession();
  const navigate = useNavigate();
  const location = useLocation();
  const name = getDisplayName(user);
  const initials = getInitials(name);

  const renderLink = (item, index) => {
    if (item.section) {
      return (
        <div key={item.section} className="mentor-workspace-nav-section-title">
          {item.section}
        </div>
      );
    }
    const Icon = item.icon;
    return (
      <NavLink
        key={item.url}
        to={item.url}
        end={item.end ?? item.url === homeUrl}
        onClick={onClose}
        className={({ isActive }) => {
          const active = item.customActive ? item.customActive(location.pathname) : isActive;
          return `mentor-workspace-nav-link${active ? " is-active" : ""}${index === separatorIndex ? " mentor-workspace-nav-separator" : ""}`;
        }}
      >
        <Icon size={17} strokeWidth={1.8} />
        <span>{item.title}</span>
      </NavLink>
    );
  };

  const badgeText = badge || (label || "Mentor").toUpperCase();

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col justify-between overflow-hidden">
      {/* Brand Header: Logo + Role Badge (Cố định ở trên) */}
      <div className="mentor-workspace-brand-row mb-2 shrink-0 flex items-center justify-between px-1.5 pt-1 pb-1">
        <Link
          to={homeUrl}
          onClick={onClose}
          className="mentor-workspace-brand flex w-full min-w-0 items-center justify-between gap-1.5"
          title="Về bảng điều khiển"
          aria-label="Về bảng điều khiển"
        >
          <img
            src="/Logo.png"
            alt="ProInterview"
            className="h-8 w-auto max-w-[126px] shrink-0 object-contain object-left contrast-[1.12] brightness-[0.94]"
          />
          <span className="mentor-workspace-badge shrink-0 whitespace-nowrap rounded-full px-2 py-0.5 text-[8px] font-black tracking-wider shadow-[0_0_10px_rgba(139,92,246,0.25)]">
            {badgeText}
          </span>
        </Link>
      </div>

      {/* Navigation Groups or Main Nav (Vùng cuộn riêng) */}
      <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden pr-1 flex flex-col gap-4">
        {groups ? (
          groups.map((group) => (
            <div key={group.title} className="flex flex-col gap-1">
              <div
                className="px-2.5 uppercase text-slate-400 font-bold"
                style={{ fontSize: "0.5625rem", letterSpacing: "0.14em" }}
              >
                {group.title}
              </div>
              <nav className="flex flex-col gap-0.5" aria-label={group.title}>
                {group.items.map(renderLink)}
              </nav>
            </div>
          ))
        ) : (
          <div className="flex flex-col gap-1">
            <nav className="flex flex-col gap-0.5" aria-label={label}>
              {mainNav.map(renderLink)}
            </nav>
          </div>
        )}
      </div>

      {/* Bottom Footer: Theme Switch + Single Sleek User Profile Card (Cố định ở đáy) */}
      <div className="mt-auto shrink-0 flex flex-col gap-2.5 px-1 pt-3">
        <WorkspaceThemeSwitch />
        <div className="border-t border-white/10 pt-2.5">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="group flex h-11 w-full cursor-pointer items-center gap-2.5 rounded-xl border border-white/10 bg-white/[0.04] px-2.5 py-2 text-left transition-all duration-200 hover:border-violet-500/40 hover:bg-white/[0.08] hover:shadow-[0_0_16px_rgba(124,58,237,0.18)] focus:outline-none"
              >
                <div className="size-7.5 shrink-0 overflow-hidden rounded-lg">
                  <NavUserAvatar avatar={user?.avatar} initials={initials} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-semibold text-white transition-colors group-hover:text-violet-200">
                    {name}
                  </p>
                  <p className="truncate text-[11px] text-slate-400">
                    {user?.email || label || "Mentor"}
                  </p>
                </div>
                <ChevronsUpDown className="size-3.5 shrink-0 text-slate-400 transition-colors group-hover:text-slate-200" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              data-ui-theme="dark"
              side="top"
              align="start"
              className="mb-2 w-60 rounded-2xl border border-white/15 bg-[#140c26] p-1.5 text-white shadow-[0_16px_40px_rgba(0,0,0,0.7)] backdrop-blur-2xl"
            >
              {/* User Header in Menu */}
              <div className="flex items-center gap-3 px-3 py-2.5 border-b border-white/10 mb-1">
                <div className="size-8 overflow-hidden rounded-lg shrink-0">
                  <NavUserAvatar avatar={user?.avatar} initials={initials} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-bold text-white">{name}</p>
                  <p className="truncate text-[10px] text-slate-400">{user?.email || ""}</p>
                </div>
                <span className="shrink-0 rounded-full border border-violet-400/30 bg-violet-500/15 px-2 py-0.5 text-[8px] font-black text-violet-300">
                  {badgeText}
                </span>
              </div>

              {/* Menu Items */}
              <DropdownMenuItem
                onClick={() => {
                  onClose?.();
                  navigate("/profile");
                }}
                className="flex cursor-pointer items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-medium text-slate-200 hover:bg-violet-600/20 hover:text-white transition-colors"
              >
                <User size={15} className="text-violet-400" />
                <span>Hồ sơ cá nhân</span>
              </DropdownMenuItem>

              <DropdownMenuItem
                onClick={() => {
                  onClose?.();
                  navigate("/settings");
                }}
                className="flex cursor-pointer items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-medium text-slate-200 hover:bg-violet-600/20 hover:text-white transition-colors"
              >
                <Settings size={15} className="text-violet-400" />
                <span>Cài đặt tài khoản</span>
              </DropdownMenuItem>

              <DropdownMenuSeparator className="my-1 h-px bg-white/10" />

              <DropdownMenuItem
                onClick={async () => {
                  onClose?.();
                  await logout();
                  navigate("/");
                }}
                className="flex cursor-pointer items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-medium text-rose-400 hover:bg-rose-500/15 hover:text-rose-300 transition-colors"
              >
                <LogOut size={15} className="text-rose-400" />
                <span>Đăng xuất</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </div>
  );
}

/** Ngữ cảnh chia sẻ trạng thái đóng/mở sidebar giữa WorkspaceTopBar và WorkspaceNav */
export const WorkspaceLayoutContext = createContext({
  sidebarCollapsed: false,
  setSidebarCollapsed: () => {},
  mobileMenuOpen: false,
  setMobileMenuOpen: () => {},
  toggleSidebar: () => {},
  desktop: true,
});

/**
 * Thanh điều hướng trên cùng (Top Navigation Bar) theo phong cách cổng thông tin:
 * - Bên trái: Nút Hamburger [ ≡ ] để thu gọn/mở rộng menu.
 * - Bên phải: Chọn ngôn ngữ (🇻🇳 Tiếng Việt), Chuông thông báo (🔔), Nút đổi giao diện Sáng/Tối (🌙 / ☀️).
 * - Lưu ý: Vị trí (Location) và Phóng to nhỏ (Fullscreen) đã được lược bỏ theo yêu cầu người dùng.
 */
export function WorkspaceTopBar({ onToggleSidebar, theme, themeable, light, onNotification }) {
  const [lang, setLang] = useState("vi");

  return (
    <header className="mentor-workspace-topbar sticky top-0 z-30 flex h-12 w-full items-center justify-between border-b border-slate-200/80 bg-white/95 px-4 backdrop-blur-md transition-colors [html[data-workspace-theme=dark]_&]:border-white/10 [html[data-workspace-theme=dark]_&]:bg-[#0c0618]/95 sm:px-6">
      {/* 1. Nút Hamburger [ ≡ ] */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onToggleSidebar}
          className="flex h-8.5 w-8.5 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-slate-700 transition hover:bg-slate-100 hover:text-slate-900 focus:outline-none [html[data-workspace-theme=dark]_&]:border-white/10 [html[data-workspace-theme=dark]_&]:bg-white/5 [html[data-workspace-theme=dark]_&]:text-slate-300 [html[data-workspace-theme=dark]_&]:hover:bg-white/10 [html[data-workspace-theme=dark]_&]:hover:text-white cursor-pointer"
          aria-label="Thu gọn / Mở rộng menu"
          title="Thu gọn / Mở rộng menu"
        >
          <Menu size={18} strokeWidth={2} />
        </button>
      </div>

      {/* 2. Cụm công cụ bên phải */}
      <div className="flex items-center gap-2 sm:gap-3">
        {/* Ngôn ngữ: 🇻🇳 Tiếng Việt ⌵ */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-100 focus:outline-none [html[data-workspace-theme=dark]_&]:text-slate-200 [html[data-workspace-theme=dark]_&]:hover:bg-white/10 cursor-pointer"
            >
              <span className="text-sm leading-none">🇻🇳</span>
              <span className="hidden sm:inline">Tiếng Việt</span>
              <ChevronDown size={13} className="text-slate-400" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-36">
            <DropdownMenuItem
              onClick={() => setLang("vi")}
              className="flex items-center justify-between text-xs font-bold text-violet-600 [html[data-workspace-theme=dark]_&]:text-[#93f72b]"
            >
              <span className="flex items-center gap-1.5">
                <span>🇻🇳</span>
                <span>Tiếng Việt</span>
              </span>
              <Check size={14} />
            </DropdownMenuItem>
            <DropdownMenuItem
              disabled
              className="flex items-center justify-between text-xs text-slate-400 opacity-60"
            >
              <span className="flex items-center gap-1.5">
                <span>🇬🇧</span>
                <span>English</span>
              </span>
              <span className="text-[10px]">Sớm ra mắt</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Chuông thông báo 🔔 */}
        <div className="relative flex items-center">
          <NotificationCenter active={true} onSelect={onNotification} />
        </div>

        {/* Chuyển đổi giao diện Sáng / Tối 🌙 / ☀️ */}
        {themeable && (
          <button
            type="button"
            onClick={() => theme?.setTheme(light ? "dark" : "light")}
            className="flex h-8.5 w-8.5 items-center justify-center rounded-lg text-slate-600 transition hover:bg-slate-100 hover:text-slate-900 focus:outline-none [html[data-workspace-theme=dark]_&]:text-slate-300 [html[data-workspace-theme=dark]_&]:hover:bg-white/10 [html[data-workspace-theme=dark]_&]:hover:text-white cursor-pointer"
            title={light ? "Chuyển sang giao diện tối" : "Chuyển sang giao diện sáng"}
            aria-label={light ? "Chuyển sang giao diện tối" : "Chuyển sang giao diện sáng"}
          >
            {light ? <Moon size={18} strokeWidth={1.8} /> : <Sun size={18} strokeWidth={1.8} />}
          </button>
        )}
      </div>
    </header>
  );
}

/**
 * Khung trang workspace: nền ambient + sidebar `nav` + thanh TopBar cố định + vùng nội dung.
 * `themeable` bật lựa chọn Sáng / Tối / Theo hệ thống; không bật thì luôn tối.
 */
export function WorkspaceShell({ nav, children, themeable = false, onNotification }) {
  const theme = useWorkspaceTheme(themeable);
  const light = theme.resolved === "light";
  const navigate = useNavigate();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [desktop, setDesktop] = useState(() =>
    typeof window !== "undefined" ? window.matchMedia("(min-width: 1024px)").matches : true
  );

  useEffect(() => {
    const query = window.matchMedia("(min-width: 1024px)");
    const change = () => {
      setDesktop(query.matches);
      if (query.matches) setMobileMenuOpen(false);
    };
    query.addEventListener("change", change);
    return () => query.removeEventListener("change", change);
  }, []);

  const toggleSidebar = () => {
    if (desktop) {
      setSidebarCollapsed((prev) => !prev);
    } else {
      setMobileMenuOpen((prev) => !prev);
    }
  };

  const handleNotification = (notification) => {
    const actionUrl = notification.metadata?.actionUrl || notification.actionUrl;
    if (actionUrl) {
      navigate(actionUrl);
      return;
    }
    const bookingId = notification.metadata?.bookingId || notification.bookingId;
    if (bookingId) navigate(`/mentor/meeting-detail/${bookingId}`);
    else if (notification.type === "payment") navigate("/mentor/finance");
    else onNotification?.(notification, navigate);
  };

  // Dialog / popover render qua portal ra ngoài khung này: gắn chế độ lên <html> để CSS sáng phủ tới.
  useLayoutEffect(() => {
    const root = document.documentElement;
    if (light) root.dataset.workspaceTheme = "light";
    else delete root.dataset.workspaceTheme;
  }, [light]);

  const layoutValue = {
    sidebarCollapsed,
    setSidebarCollapsed,
    mobileMenuOpen,
    setMobileMenuOpen,
    toggleSidebar,
    desktop,
  };

  return (
    <WorkspaceThemeContext.Provider value={themeable ? theme : null}>
      <WorkspaceLayoutContext.Provider value={layoutValue}>
        <div
          className={`mentor-workspace${light ? " mw-light" : " commerce-theme"}${sidebarCollapsed ? " is-sidebar-collapsed" : ""} pi-typography-shell relative min-h-svh w-full max-w-full min-w-0 antialiased`}
          style={{ fontFamily: "'Lexend', 'Plus Jakarta Sans', system-ui, sans-serif" }}
        >
          {light ? (
            <div className="app-shell-ambient mw-light-ambient" aria-hidden />
          ) : (
            <div className="app-shell-ambient app-shell-ambient--commerce" aria-hidden>
              <span className="commerce-glow commerce-glow--top-left" />
              <span className="commerce-glow commerce-glow--top-right" />
              <span className="commerce-glow commerce-glow--bottom-left" />
              <span className="commerce-glow commerce-glow--bottom-right" />
            </div>
          )}
          <SelectThemeContext.Provider value={light ? "light" : "dark"}>
            {nav}

            <main className="mentor-workspace-main relative z-[1] min-h-0 flex-1">
              <WorkspaceTopBar
                onToggleSidebar={toggleSidebar}
                theme={theme}
                themeable={themeable}
                light={light}
                onNotification={handleNotification}
              />
              {children}
            </main>
          </SelectThemeContext.Provider>
        </div>
      </WorkspaceLayoutContext.Provider>
    </WorkspaceThemeContext.Provider>
  );
}

export function WorkspaceNav(config) {
  const layout = useContext(WorkspaceLayoutContext);
  const location = useLocation();
  const lightSheet = useContext(WorkspaceThemeContext)?.resolved === "light";

  const open = layout?.mobileMenuOpen ?? false;
  const setOpen = layout?.setMobileMenuOpen ?? (() => {});
  const desktop = layout?.desktop ?? true;

  useEffect(() => {
    setOpen(false);
  }, [location.pathname, setOpen]);

  return (
    <>
      <aside
        className={`mentor-workspace-nav${layout?.sidebarCollapsed ? " is-collapsed" : ""}`}
        aria-label={`Điều hướng – ${config.label}`}
      >
        <WorkspaceMenu config={config} active={desktop} />
      </aside>
      {!desktop && (
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetContent
            side="left"
            className={`mentor-workspace mentor-workspace-mobile-nav${lightSheet ? " mw-light" : ""}`}
          >
            <SheetTitle className="sr-only">Điều hướng – {config.label}</SheetTitle>
            <SheetDescription className="sr-only">Công việc, thông báo và tài khoản</SheetDescription>
            <WorkspaceMenu config={config} active={open} onClose={() => setOpen(false)} />
          </SheetContent>
        </Sheet>
      )}
    </>
  );
}
