import { createContext, useContext, useEffect, useLayoutEffect, useState } from "react";
import { Link, NavLink, useLocation, useNavigate } from "react-router";
import { LogOut, Menu, Monitor, Moon, Sun } from "lucide-react";
import { NotificationCenter } from "./NotificationCenter.jsx";
import { NavUserAvatar } from "./NavUserAvatar.jsx";
import { useAuthSession } from "../../hooks/useAuthSession";
import { useWorkspaceTheme } from "../../hooks/useWorkspaceTheme.js";
import { getDisplayName, getInitials, logout } from "../../utils/auth/auth.js";
import { Sheet, SheetContent, SheetTitle, SheetDescription, SheetTrigger } from "../ui/sheet";
import { SelectThemeContext } from "../ui/AppSelect";
import "../../../styles/mentor-workspace.css";
import "../../../styles/mentor-workspace-light.css";

/** `null` = khu này chưa cho đổi sáng/tối (Platform Moderator, Company Moderator vẫn luôn tối). */
const WorkspaceThemeContext = createContext(null);

const THEME_OPTIONS = [
  { value: "light", label: "Sáng", title: "Giao diện sáng", Icon: Sun },
  { value: "dark", label: "Tối", title: "Giao diện tối", Icon: Moon },
  { value: "system", label: "Hệ thống", title: "Theo cài đặt sáng/tối của máy", Icon: Monitor },
];

/** Nút chọn Sáng / Tối / Hệ thống ở cuối sidebar; ẩn ở khu chưa hỗ trợ. */
function WorkspaceThemeSwitch() {
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
 * Sidebar workspace dùng chung (Mentor, Company Moderator): logo, nhãn khu vực + chuông thông báo,
 * menu chính, menu tài khoản, avatar + đăng xuất. Dưới 1024px chuyển thành Sheet.
 * Cần nằm trong `.mentor-workspace` để nhận theme (styles/mentor-workspace.css).
 *
 * @param {object}   props
 * @param {string}   props.homeUrl         link logo; cũng là mục chỉ active khi khớp đúng (end)
 * @param {string}   props.heading         nhãn khu vực, ví dụ "Không gian Mentor"
 * @param {string}   [props.badge]         nhãn ngắn cạnh logo (như "ADMIN" bên admin); có thì thay dòng `heading`
 * @param {string}   props.label           aria-label cho sidebar
 * @param {Array}    props.mainNav         [{ title, url, icon, end? }] — `end` ghi đè quy tắc active mặc định
 * @param {Array}    props.secondaryNav    [{ title, url, icon }]
 * @param {number}   [props.separatorIndex] mục bắt đầu nhóm mới (thêm khoảng cách phía trên)
 * @param {Function} [props.onNotification] (notification, navigate) => void
 */
function WorkspaceMenu({ config, onClose, active }) {
  const { homeUrl, heading, badge, label, mainNav, secondaryNav, separatorIndex, onNotification } = config;
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
    {badge ? (
      <div className="mentor-workspace-brand-row">
        <Link to={homeUrl} onClick={onClose} className="mentor-workspace-brand" aria-label={`ProInterview – ${heading}`}><img src="/Logo.png" alt="ProInterview" /></Link>
        <span className="mentor-workspace-badge">{badge}</span>
      </div>
    ) : <>
      <Link to={homeUrl} onClick={onClose} className="mentor-workspace-brand"><img src="/Logo.png" alt="ProInterview" /></Link>
      <div className="mentor-workspace-nav-heading"><span className="mentor-workspace-nav-dot" />{heading}<NotificationCenter active={active} onSelect={handleNotification} /></div>
    </>}
    <nav aria-label={label}>{mainNav.map(renderLink)}</nav>
    <nav className="mentor-workspace-nav-account" aria-label={`Tài khoản – ${label}`}>{secondaryNav.map(renderLink)}</nav>
    <WorkspaceThemeSwitch />
    <div className="mentor-workspace-account">
      <Link to="/profile" onClick={onClose} className="mentor-workspace-user"><span className="mentor-workspace-avatar"><NavUserAvatar avatar={user?.avatar} initials={getInitials(name)} /></span><span title={name}>{name}</span></Link>
      {/* Có `badge` thì hàng logo giống admin (không chỗ cho chuông) → chuông nằm cạnh tài khoản. */}
      {badge && <NotificationCenter active={active} onSelect={handleNotification} />}
      <button type="button" aria-label="Đăng xuất" title="Đăng xuất" onClick={async () => { await logout(); navigate("/"); }}><LogOut size={17} /></button>
    </div>
  </>;
}

/**
 * Khung trang workspace: nền ambient + sidebar `nav` + vùng nội dung.
 * `themeable` bật lựa chọn Sáng / Tối / Theo hệ thống (hiện chỉ khu Mentor); không bật thì luôn tối.
 */
export function WorkspaceShell({ nav, children, themeable = false }) {
  const theme = useWorkspaceTheme(themeable);
  const light = theme.resolved === "light";

  // Dialog / popover render qua portal ra ngoài khung này: gắn chế độ lên <html> để CSS sáng phủ tới.
  // Layout effect: gắn trước khi trình duyệt vẽ, tránh nháy nền tối khi mở trang.
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
          /* Same ambient background as the customer dark pages. */
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
