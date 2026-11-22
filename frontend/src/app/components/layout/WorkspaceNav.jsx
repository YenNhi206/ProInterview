import React, { createContext, useContext, useEffect, useLayoutEffect, useState } from "react";
import { Link, NavLink, useLocation, useNavigate } from "react-router";
import { LogOut, Menu, Monitor, Moon, Sun, User, Settings, ChevronsUpDown } from "lucide-react";
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
    <div className="flex h-full min-h-full flex-col justify-between">
      <div>
        {/* Brand Header: Logo + Role Badge */}
        <div className="mentor-workspace-brand-row mb-2 flex items-center justify-between px-2 pt-1 pb-1">
          <Link to={homeUrl} onClick={onClose} className="mentor-workspace-brand flex items-center justify-between w-full min-w-0">
            <img
              src="/Logo.png"
              alt="ProInterview"
              className="h-6.5 w-auto max-w-[108px] object-contain object-left contrast-[1.12] brightness-[0.94]"
            />
            <span className="mentor-workspace-badge shrink-0 rounded-full px-2 py-0.5 text-[8px] font-black tracking-wider shadow-[0_0_10px_rgba(139,92,246,0.25)]">
              {badgeText}
            </span>
          </Link>
        </div>

        {/* Navigation Groups or Main Nav */}
        <div className="flex flex-col gap-4">
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
      </div>

      {/* Bottom Footer: Theme Switch + Single Sleek User Profile Card */}
      <div className="mt-auto flex flex-col gap-2.5 px-1 pt-3">
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

/**
 * Khung trang workspace: nền ambient + sidebar `nav` + floating notification + vùng nội dung.
 * `themeable` bật lựa chọn Sáng / Tối / Theo hệ thống; không bật thì luôn tối.
 */
export function WorkspaceShell({ nav, children, themeable = false, onNotification }) {
  const theme = useWorkspaceTheme(themeable);
  const light = theme.resolved === "light";
  const navigate = useNavigate();

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
    return () => { delete root.dataset.workspaceTheme; };
  }, [light]);

  return (
    <WorkspaceThemeContext.Provider value={themeable ? theme : null}>
      <div
        className={`mentor-workspace${light ? " mw-light" : " commerce-theme"} pi-typography-shell relative min-h-svh w-full max-w-full min-w-0 antialiased`}
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

          {/* Nút chuông thông báo cố định ở đầu trang */}
          <aside className="absolute top-4 right-5 sm:right-8 z-30 pointer-events-auto">
            <NotificationCenter active={true} onSelect={handleNotification} />
          </aside>

          <main className="mentor-workspace-main relative z-[1] min-h-0 flex-1">
            {children}
          </main>
        </SelectThemeContext.Provider>
      </div>
    </WorkspaceThemeContext.Provider>
  );
}

export function WorkspaceNav(config) {
  const [open, setOpen] = useState(false);
  const [desktop, setDesktop] = useState(() => window.matchMedia("(min-width: 1024px)").matches);
  const location = useLocation();
  const lightSheet = useContext(WorkspaceThemeContext)?.resolved === "light";

  useEffect(() => {
    const query = window.matchMedia("(min-width: 1024px)");
    const change = () => { setDesktop(query.matches); setOpen(false); };
    query.addEventListener("change", change);
    return () => query.removeEventListener("change", change);
  }, []);
  useEffect(() => { setOpen(false); }, [location.pathname]);
  return <>
    <aside className="mentor-workspace-nav" aria-label={`Điều hướng – ${config.label}`}><WorkspaceMenu config={config} active={desktop} /></aside>
    {!desktop && <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild><button type="button" className="mentor-workspace-menu-toggle" aria-label="Mở menu"><Menu size={21} /></button></SheetTrigger>
      <SheetContent side="left" className={`mentor-workspace mentor-workspace-mobile-nav${lightSheet ? " mw-light" : ""}`}>
        <SheetTitle className="sr-only">Điều hướng – {config.label}</SheetTitle>
        <SheetDescription className="sr-only">Công việc, thông báo và tài khoản</SheetDescription>
        <WorkspaceMenu config={config} active={open} onClose={() => setOpen(false)} />
      </SheetContent>
    </Sheet>}
  </>;
}
