import { useEffect, useState } from "react";
import { Link, NavLink, useLocation, useNavigate } from "react-router";
import { LogOut, Menu } from "lucide-react";
import { NotificationCenter } from "./NotificationCenter.jsx";
import { NavUserAvatar } from "./NavUserAvatar.jsx";
import { useAuthSession } from "../../hooks/useAuthSession";
import { getDisplayName, getInitials, logout } from "../../utils/auth/auth.js";
import { Sheet, SheetContent, SheetTitle, SheetDescription, SheetTrigger } from "../ui/sheet";
import { SelectThemeContext } from "../ui/AppSelect";
import "../../../styles/mentor-workspace.css";

/**
 * Sidebar workspace dùng chung (Mentor, Company Moderator): logo, nhãn khu vực + chuông thông báo,
 * menu chính, menu tài khoản, avatar + đăng xuất. Dưới 1024px chuyển thành Sheet.
 * Cần nằm trong `.mentor-workspace` để nhận theme (styles/mentor-workspace.css).
 *
 * @param {object}   props
 * @param {string}   props.homeUrl         link logo; cũng là mục chỉ active khi khớp đúng (end)
 * @param {string}   props.heading         nhãn khu vực, ví dụ "Không gian Mentor"
 * @param {string}   props.label           aria-label cho sidebar
 * @param {Array}    props.mainNav         [{ title, url, icon, end? }] — `end` ghi đè quy tắc active mặc định
 * @param {Array}    props.secondaryNav    [{ title, url, icon }]
 * @param {number}   [props.separatorIndex] mục bắt đầu nhóm mới (thêm khoảng cách phía trên)
 * @param {Function} [props.onNotification] (notification, navigate) => void
 */
function WorkspaceMenu({ config, onClose, active }) {
  const { homeUrl, heading, label, mainNav, secondaryNav, separatorIndex, onNotification } = config;
  const { user } = useAuthSession();
  const navigate = useNavigate();
  const name = getDisplayName(user);
  const handleNotification = (notification) => {
    onClose?.();
    const actionUrl = notification.metadata?.actionUrl || notification.actionUrl;
    if (actionUrl) navigate(actionUrl);
    else onNotification?.(notification, navigate);
  };
  const renderLink = (item, index) => {
    const Icon = item.icon;
    return <NavLink key={item.url} to={item.url} end={item.end ?? item.url === homeUrl} onClick={onClose}
      className={({ isActive }) => `mentor-workspace-nav-link${isActive ? " is-active" : ""}${index === separatorIndex ? " mentor-workspace-nav-separator" : ""}`}>
      <Icon size={18} strokeWidth={1.6} /><span>{item.title}</span>
    </NavLink>;
  };
  return <>
    <Link to={homeUrl} onClick={onClose} className="mentor-workspace-brand"><img src="/Logo.png" alt="ProInterview" /></Link>
    <div className="mentor-workspace-nav-heading"><span className="mentor-workspace-nav-dot" />{heading}<NotificationCenter active={active} onSelect={handleNotification} /></div>
    <nav aria-label={label}>{mainNav.map(renderLink)}</nav>
    <nav className="mentor-workspace-nav-account" aria-label={`Tài khoản – ${label}`}>{secondaryNav.map(renderLink)}</nav>
    <div className="mentor-workspace-account">
      <Link to="/profile" onClick={onClose} className="mentor-workspace-user"><span className="mentor-workspace-avatar"><NavUserAvatar avatar={user?.avatar} initials={getInitials(name)} /></span><span title={name}>{name}</span></Link>
      <button type="button" aria-label="Đăng xuất" title="Đăng xuất" onClick={async () => { await logout(); navigate("/"); }}><LogOut size={17} /></button>
    </div>
  </>;
}

/** Khung trang workspace: nền ambient tối + sidebar `nav` + vùng nội dung. */
export function WorkspaceShell({ nav, children }) {
  return (
    <div
      className="mentor-workspace commerce-theme pi-typography-shell relative min-h-svh w-full max-w-full min-w-0 antialiased"
      style={{ fontFamily: "'Lexend', 'Plus Jakarta Sans', system-ui, sans-serif" }}
    >
      {/* Same ambient background as the customer dark pages. */}
      <div className="app-shell-ambient app-shell-ambient--commerce" aria-hidden>
        <span className="commerce-glow commerce-glow--top-left" />
        <span className="commerce-glow commerce-glow--top-right" />
        <span className="commerce-glow commerce-glow--bottom-left" />
        <span className="commerce-glow commerce-glow--bottom-right" />
      </div>
      <SelectThemeContext.Provider value="dark">
        {nav}
        <main className="mentor-workspace-main relative z-[1] min-h-0 flex-1">
          {children}
        </main>
      </SelectThemeContext.Provider>
    </div>
  );
}

export function WorkspaceNav(config) {
  const [open, setOpen] = useState(false);
  const [desktop, setDesktop] = useState(() => window.matchMedia("(min-width: 1024px)").matches);
  const location = useLocation();
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
      <SheetContent side="left" className="mentor-workspace mentor-workspace-mobile-nav">
        <SheetTitle className="sr-only">Điều hướng – {config.label}</SheetTitle>
        <SheetDescription className="sr-only">Công việc, thông báo và tài khoản</SheetDescription>
        <WorkspaceMenu config={config} active={open} onClose={() => setOpen(false)} />
      </SheetContent>
    </Sheet>}
  </>;
}
