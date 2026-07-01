import React from "react";
import { Link, useLocation, useNavigate } from "react-router";
import {
  FileText,
  Mic,
  Users,
  User,
  Settings,
  LogOut,
  Zap,
  ChevronsUpDown,
  Calendar,
  Star,
  GraduationCap,
  BookOpen,
  BookText,
  Shield,
  Home,
  LogIn,
  UserPlus,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "../ui/sidebar";
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
  getBrandClickPath,
  getPlans,
  getDisplayName,
  PLANS_CHANGED_EVENT,
} from "../../utils/auth/auth.js";
import { useAuthSession } from "../../hooks/useAuthSession";
import { SidebarBrandButton } from "./SidebarBrandButton";
import { requireLoginNavigate } from "../../utils/auth/authGate.js";

/* ── Nav data ─────────────────────────────────────────────── */
const customerMainItems = [
  { title: "Trang chủ", url: "/", icon: Home, public: true },
  { title: "Phân tích CV/JD", url: "/cv-analysis", icon: FileText, requiresAuth: true },
  { title: "Phỏng vấn AI", url: "/interview", icon: Mic, requiresAuth: true },
  { title: "Khóa học", url: "/courses", icon: GraduationCap, public: true },
  { title: "Tìm Mentor", url: "/mentors", icon: Users, public: true },
];

import { MENTOR_MAIN_NAV, MENTOR_SECONDARY_NAV } from "./mentorNav.js";

const secondaryItems = [
  { title: "Hồ sơ", url: "/profile", icon: User, requiresAuth: true },
  { title: "Cài đặt", url: "/settings", icon: Settings, requiresAuth: true },
];

/** Menu khách (chưa đăng nhập) trên trang công khai trong AppLayout. */
const guestMainItems = [
  { title: "Trang chủ", url: "/", icon: Home, public: true },
  { title: "Khóa học", url: "/courses", icon: GraduationCap, public: true },
  { title: "Tìm Mentor", url: "/mentors", icon: Users, public: true },
  { title: "Bảng giá", url: "/pricing", icon: Zap, public: true },
];

const guestSecondaryItems = [
  { title: "Đăng nhập", url: "/login", icon: LogIn, public: true },
  { title: "Đăng ký", url: "/register", icon: UserPlus, public: true },
];

function navRequiresAuth(item) {
  return item.requiresAuth !== false && item.public !== true;
}

/* ── Component ───────────────────────────────────────────── */
export function AppSidebar() {
  const location = useLocation();
  const navigate = useNavigate();

  const { loggedIn, user } = useAuthSession();
  const [plans, setPlans] = React.useState(getPlans);
  React.useEffect(() => {
    const refresh = () => setPlans(getPlans());
    window.addEventListener(PLANS_CHANGED_EVENT, refresh);
    window.addEventListener("focus", refresh);
    return () => {
      window.removeEventListener(PLANS_CHANGED_EVENT, refresh);
      window.removeEventListener("focus", refresh);
    };
  }, []);
  const displayName = getDisplayName(user);
  const initials = getInitials(displayName);
  const isMentor = loggedIn && user?.role === "mentor";
  const isElite = !!plans?.elitePro;
  const isPro = !!plans?.starterPro && !isElite;
  const upgradeTitle = isPro ? "Nâng cấp lên Elite" : "Nâng cấp lên Pro";
  const upgradeButton = isPro ? "Xem gói Elite →" : "Xem gói Pro →";
  const upgradeHint = isPro ? "Mở khóa toàn bộ tính năng" : "Mở khóa thêm lượt luyện tập";
  const mainNavItems = !loggedIn
    ? guestMainItems
    : isMentor
      ? MENTOR_MAIN_NAV
      : customerMainItems;
  const secondaryNav = !loggedIn
    ? guestSecondaryItems
    : [
        ...(user?.role === "admin" ? [{ title: "Quản trị", url: "/admin", icon: Shield, requiresAuth: true }] : []),
        ...secondaryItems,
      ];

  const goNav = (item) => {
    if (navRequiresAuth(item) && !loggedIn) {
      requireLoginNavigate(navigate, item.url);
      return;
    }
    if (item.url === "/") {
      navigate("/");
      return;
    }
    navigate(item.url);
  };

  const handleLogout = async () => {
    await logout();
    navigate("/");
  };

  const isActive = (url) =>
    url === "/" || url === "/mentor/dashboard"
      ? url === "/"
        ? location.pathname === "/"
        : location.pathname === url
      : location.pathname.startsWith(url);

  return (
    <Sidebar collapsible="icon">

      {/* ════════════ HEADER / LOGO ════════════ */}
      <SidebarHeader className="overflow-hidden p-0">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarBrandButton
              tooltip="ProInterview"
              onClick={() => navigate(getBrandClickPath())}
            />
          </SidebarMenuItem>
        </SidebarMenu>

        {/* divider */}
        <div className="mx-3 h-px bg-sidebar-border group-data-[collapsible=icon]:mx-2" />
      </SidebarHeader>

      {/* ════════════ CONTENT ════════════ */}
      <SidebarContent className="py-3 px-2 gap-0 overflow-x-hidden">

        {/* ── Main group ─────────────────────── */}
        <SidebarGroup className="p-0">
          <SidebarGroupLabel
            className="
              mb-1 px-2 uppercase text-sidebar-foreground/45
              group-data-[collapsible=icon]:hidden
            "
            style={{ fontSize: "0.6rem", fontWeight: 700, letterSpacing: "0.1em" }}
          >
            Menu chính
          </SidebarGroupLabel>

          <SidebarGroupContent>
            <SidebarMenu className="gap-0.5">
              {mainNavItems.map((item) => {
                  const active = isActive(item.url);
                  return (
                    <SidebarMenuItem key={item.title}>
                      <SidebarMenuButton
                        isActive={active}
                        tooltip={item.title}
                        onClick={() => goNav(item)}
                        className="
                            h-10 rounded-xl gap-3 transition-all text-sidebar-foreground/75
                            hover:bg-sidebar-accent hover:text-sidebar-accent-foreground
                            group-data-[collapsible=icon]:!justify-center
                            group-data-[collapsible=icon]:!w-10
                            group-data-[collapsible=icon]:!mx-auto
                            group-data-[collapsible=icon]:px-0
                          "
                        style={
                          active
                            ? {
                              background: "#8037f4",
                              color: "#fff",
                              boxShadow: "0 4px 12px rgba(128,55,244,0.35)",
                            }
                            : undefined
                        }
                      >
                        <item.icon
                          className={`size-[18px] shrink-0 ${active ? "text-white" : "text-sidebar-foreground/70"}`}
                        />
                        <span
                          className="text-[0.8125rem] truncate group-data-[collapsible=icon]:hidden"
                          style={{ fontWeight: active ? 600 : 400 }}
                        >
                          {item.title}
                        </span>
                        {/* active dot */}
                        {active && (
                          <span
                            className="ml-auto size-1.5 rounded-full shrink-0 group-data-[collapsible=icon]:hidden"
                            style={{ background: "#93f72b" }}
                          />
                        )}
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* ── Divider ─────────────────────────── */}
        <div className="mx-1 my-3 h-px bg-sidebar-border group-data-[collapsible=icon]:mx-0" />

        {/* ── Secondary group ─────────────────── */}
        <SidebarGroup className="p-0">
          <SidebarGroupLabel
            className="
              mb-1 px-2 uppercase text-sidebar-foreground/45
              group-data-[collapsible=icon]:hidden
            "
            style={{ fontSize: "0.6rem", fontWeight: 700, letterSpacing: "0.1em" }}
          >
            Khác
          </SidebarGroupLabel>

          <SidebarGroupContent>
            <SidebarMenu className="gap-0.5">
              {secondaryNav.map((item) => {
                const active = isActive(item.url);
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton
                      isActive={active}
                      tooltip={item.title}
                      onClick={() => goNav(item)}
                      className="
                        h-10 rounded-xl gap-3 transition-all text-sidebar-foreground/75
                        hover:bg-sidebar-accent hover:text-sidebar-accent-foreground
                        group-data-[collapsible=icon]:!justify-center
                        group-data-[collapsible=icon]:!w-10
                        group-data-[collapsible=icon]:!mx-auto
                        group-data-[collapsible=icon]:px-0
                      "
                      style={
                        active
                          ? {
                            background: "#8037f4",
                            color: "#fff",
                            boxShadow: "0 4px 12px rgba(128,55,244,0.35)",
                          }
                          : undefined
                      }
                    >
                      <item.icon
                        className={`size-[18px] shrink-0 ${active ? "text-white" : "text-sidebar-foreground/70"}`}
                      />
                      <span
                        className="text-[0.8125rem] truncate group-data-[collapsible=icon]:hidden"
                        style={{ fontWeight: active ? 600 : 400 }}
                      >
                        {item.title}
                      </span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {!loggedIn && (
          <div className="mt-auto pt-3 group-data-[collapsible=icon]:hidden">
            <div className="rounded-2xl border border-violet-200/60 bg-violet-50/80 p-3.5 text-center">
              <p className="text-xs font-bold text-slate-900">Chưa đăng nhập</p>
              <p className="mt-1 text-[10px] text-slate-500">Đăng nhập để dùng CV, phỏng vấn AI và mentor</p>
              <button
                type="button"
                onClick={() => navigate("/login")}
                className="mt-3 w-full rounded-xl bg-violet-600 py-2 text-xs font-bold text-white hover:bg-violet-700"
              >
                Đăng nhập
              </button>
            </div>
          </div>
        )}

        {/* ── Upgrade CTA (expanded only) ─────── */}
        {loggedIn && !isMentor && !isElite && (
          <div className="mt-auto pt-3 group-data-[collapsible=icon]:hidden">
            <div
              className="rounded-2xl border border-[rgba(128,55,244,0.2)] bg-white/75 p-3.5 shadow-sm backdrop-blur-sm"
            >
              <div className="mb-3 flex items-center gap-2.5">
                <div
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[rgba(180,245,0,0.2)]"
                >
                  <Zap className="h-3.5 w-3.5 text-[#5a9e00]" />
                </div>
                <div className="min-w-0">
                  <p className="truncate text-xs font-bold text-slate-900">{upgradeTitle}</p>
                  <p className="truncate text-[10px] text-slate-500">{upgradeHint}</p>
                </div>
              </div>
              <button
                onClick={() => navigate("/pricing")}
                className="w-full rounded-xl py-1.5 text-xs font-bold text-[#0f172a] transition-all hover:scale-[1.02] active:scale-[0.97]"
                style={{
                  background: "#93f72b",
                  boxShadow: "0 8px 20px rgba(15,23,42,0.1)",
                }}
              >
                {upgradeButton}
              </button>
            </div>
          </div>
        )}

        {/* ── Upgrade icon (collapsed only) ──── */}
        {loggedIn && !isMentor && !isElite && (
          <div className="hidden mt-auto pt-2 group-data-[collapsible=icon]:flex group-data-[collapsible=icon]:justify-center">
            <button
              onClick={() => navigate("/pricing")}
              title={upgradeTitle}
              className="flex h-10 w-10 items-center justify-center rounded-xl border border-[rgba(128,55,244,0.22)] bg-[rgba(180,245,0,0.15)] transition-all hover:bg-[rgba(180,245,0,0.28)]"
            >
              <Zap className="h-4 w-4 text-[#5a9e00]" />
            </button>
          </div>
        )}

      </SidebarContent>

      {/* ════════════ FOOTER / USER ════════════ */}
      <div className="mx-2 h-px bg-sidebar-border" />

      <SidebarFooter className="p-2">
        <SidebarMenu>
          {!loggedIn ? (
            <SidebarMenuItem>
              <div className="flex flex-col gap-2 px-1 group-data-[collapsible=icon]:items-center">
                <button
                  type="button"
                  onClick={() => navigate("/login")}
                  className="flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-violet-600 text-xs font-bold text-white hover:bg-violet-700 group-data-[collapsible=icon]:w-10 group-data-[collapsible=icon]:px-0"
                >
                  <LogIn className="size-4 shrink-0" />
                  <span className="group-data-[collapsible=icon]:hidden">Đăng nhập</span>
                </button>
                <button
                  type="button"
                  onClick={() => navigate("/register")}
                  className="flex h-9 w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 group-data-[collapsible=icon]:hidden"
                >
                  <UserPlus className="size-4" />
                  Tạo tài khoản
                </button>
              </div>
            </SidebarMenuItem>
          ) : (
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  className="
                    flex h-11 w-full cursor-pointer items-center gap-3 rounded-xl px-3 py-2
                    transition-all focus:outline-none
                    bg-sidebar-accent/50 hover:bg-sidebar-accent
                    group-data-[collapsible=icon]:mx-auto
                    group-data-[collapsible=icon]:w-10
                    group-data-[collapsible=icon]:justify-center
                    group-data-[collapsible=icon]:px-0
                  "
                >
                  {/* Avatar */}
                  <div
                    className="flex size-7 shrink-0 items-center justify-center rounded-full font-bold text-white"
                    style={{
                      background: "#8037f4",
                      fontSize: "0.65rem",
                      boxShadow: "0 2px 8px rgba(128,55,244,0.4)",
                    }}
                  >
                    {initials}
                  </div>

                  {/* Name + email, hidden when collapsed */}
                  <div className="min-w-0 flex-1 group-data-[collapsible=icon]:hidden">
                    <p className="truncate font-medium text-slate-900" style={{ fontSize: "0.78rem" }}>
                      {displayName}
                    </p>
                    <p className="truncate text-slate-500" style={{ fontSize: "0.65rem" }}>
                      {user?.email || "Gói Miễn phí"}
                    </p>
                  </div>

                  <ChevronsUpDown
                    className="size-3 shrink-0 text-slate-400 group-data-[collapsible=icon]:hidden"
                  />
                </button>
              </DropdownMenuTrigger>

              <DropdownMenuContent side="top" align="end" className="w-56 mb-1">
                {!isMentor && user?.role !== "admin" && (
                  <>
                    <div className="px-3 py-2.5 border-b border-border">
                      <p className="text-sm font-semibold text-foreground truncate">{displayName}</p>
                      <p className="text-xs text-muted-foreground truncate mt-0.5">
                        {user?.email || ""}
                      </p>
                    </div>

                    <DropdownMenuItem asChild>
                      <Link to="/profile" className="flex items-center gap-2.5 cursor-pointer">
                        <User className="size-4" />
                        Hồ sơ cá nhân
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link to="/cv-analysis/history" className="flex items-center gap-2.5 cursor-pointer">
                        <FileText className="size-4" />
                        Lịch sử phân tích CV
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link to="/my-courses" className="flex items-center gap-2.5 cursor-pointer">
                        <BookOpen className="size-4" />
                        Khóa học của tôi
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link to="/my-bookings" className="flex items-center gap-2.5 cursor-pointer">
                        <Calendar className="size-4" />
                        Lịch hẹn của tôi
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link to="/settings" className="flex items-center gap-2.5 cursor-pointer">
                        <Settings className="size-4" />
                        Cài đặt
                      </Link>
                    </DropdownMenuItem>
                    {!isElite && (
                      <DropdownMenuItem
                        onClick={() => navigate("/pricing")}
                        className="flex items-center gap-2.5 cursor-pointer"
                        style={{ color: "#8037f4", fontWeight: 600 }}
                      >
                        <Zap className="size-4" />
                        {upgradeTitle} ↗
                      </DropdownMenuItem>
                    )}

                    <DropdownMenuSeparator />
                  </>
                )}

                <DropdownMenuItem
                  onClick={handleLogout}
                  className="flex items-center gap-2.5 text-destructive focus:text-destructive cursor-pointer"
                >
                  <LogOut className="size-4" />
                  Đăng xuất
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
          )}
        </SidebarMenu>
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  );
}