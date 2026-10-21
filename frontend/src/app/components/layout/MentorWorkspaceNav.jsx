import { useEffect, useState } from "react";
import { Link, NavLink, useLocation, useNavigate } from "react-router";
import { LogOut, Menu } from "lucide-react";
import { MENTOR_MAIN_NAV, MENTOR_SECONDARY_NAV } from "./mentorNav.js";
import { NotificationCenter } from "./NotificationCenter.jsx";
import { NavUserAvatar } from "./NavUserAvatar.jsx";
import { useAuthSession } from "../../hooks/useAuthSession";
import { getDisplayName, getInitials, logout } from "../../utils/auth/auth.js";
import { Sheet, SheetContent, SheetTitle, SheetDescription, SheetTrigger } from "../ui/sheet";

function WorkspaceMenu({ onClose, active }) {
  const { user } = useAuthSession();
  const navigate = useNavigate();
  const name = getDisplayName(user);
  const handleNotification = (notification) => {
    onClose?.();
    const actionUrl = notification.metadata?.actionUrl || notification.actionUrl;
    const bookingId = notification.metadata?.bookingId || notification.bookingId;
    if (actionUrl) navigate(actionUrl);
    else if (bookingId) navigate(`/mentor/meeting-detail/${bookingId}`);
    else if (notification.type === "payment") navigate("/mentor/finance");
  };
  const renderLink = (item, index) => {
    const Icon = item.icon;
    return <NavLink key={item.url} to={item.url} end={item.url === "/mentor/dashboard"} onClick={onClose}
      className={({ isActive }) => `mentor-workspace-nav-link${isActive ? " is-active" : ""}${index === 3 ? " mentor-workspace-nav-separator" : ""}`}>
      <Icon size={18} strokeWidth={1.6} /><span>{item.title}</span>
    </NavLink>;
  };
  return <>
    <Link to="/mentor/dashboard" onClick={onClose} className="mentor-workspace-brand"><img src="/Logo.png" alt="ProInterview" /></Link>
    <div className="mentor-workspace-nav-heading"><span className="mentor-workspace-nav-dot" />Không gian Mentor<NotificationCenter active={active} onSelect={handleNotification} /></div>
    <nav aria-label="Công việc Mentor">{MENTOR_MAIN_NAV.map(renderLink)}</nav>
    <nav className="mentor-workspace-nav-account" aria-label="Tài khoản Mentor">{MENTOR_SECONDARY_NAV.map(renderLink)}</nav>
    <div className="mentor-workspace-account">
      <Link to="/profile" onClick={onClose} className="mentor-workspace-user"><span className="mentor-workspace-avatar"><NavUserAvatar avatar={user?.avatar} initials={getInitials(name)} /></span><span title={name}>{name}</span></Link>
      <button type="button" aria-label="Đăng xuất" title="Đăng xuất" onClick={async () => { await logout(); navigate("/"); }}><LogOut size={17} /></button>
    </div>
  </>;
}

export function MentorWorkspaceNav() {
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
    <aside className="mentor-workspace-nav" aria-label="Điều hướng Mentor"><WorkspaceMenu active={desktop} /></aside>
    {!desktop && <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild><button type="button" className="mentor-workspace-menu-toggle" aria-label="Mở menu"><Menu size={21} /></button></SheetTrigger>
      <SheetContent side="left" className="mentor-workspace mentor-workspace-mobile-nav">
        <SheetTitle className="sr-only">Điều hướng Mentor</SheetTitle>
        <SheetDescription className="sr-only">Công việc, thông báo và tài khoản Mentor</SheetDescription>
        <WorkspaceMenu active={open} onClose={() => setOpen(false)} />
      </SheetContent>
    </Sheet>}
  </>;
}
