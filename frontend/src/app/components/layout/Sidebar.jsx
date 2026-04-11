import React from "react";
import { Link, useLocation, useNavigate } from "react-router";
import {
  LayoutGrid,
  FileText,
  Mic,
  Users,
  User,
  Settings,
  LogOut,
  Sparkles,
  Zap,
  ChevronsUpDown,
  Calendar,
  TrendingUp,
  Star,
  CircleDollarSign,
  GraduationCap,
  BookText,
  ClipboardList,
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
  useSidebar,
} from "../ui/sidebar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import { getUser, logout, getInitials } from "../../utils/auth";

/* ── Nav data ─────────────────────────────────────────────── */
const customerMainItems = [
  { title: "Bảng điều khiển", url: "/dashboard", icon: LayoutGrid },
  { title: "Phân tích CV/JD", url: "/cv-analysis", icon: FileText },
  { title: "Phỏng vấn AI", url: "/interview", icon: Mic },
  { title: "Khóa học", url: "/courses", icon: GraduationCap },
  { title: "Tìm Mentor", url: "/mentors", icon: Users },
];

const mentorMainItems = [
  { title: "Bảng điều khiển", url: "/mentor/dashboard", icon: LayoutGrid },
  { title: "Lịch họp", url: "/mentor/schedule", icon: Calendar },
  { title: "Khóa học", url: "/mentor/courses", icon: GraduationCap },
  { title: "Đánh giá chéo", url: "/mentor/peer-review", icon: ClipboardList },
  { title: "Tài chính", url: "/mentor/finance", icon: CircleDollarSign },
  { title: "Phân tích", url: "/mentor/analytics", icon: TrendingUp },
  { title: "Đánh giá", url: "/mentor/reviews", icon: Star },
];

const secondaryItems = [
  { title: "Hồ sơ", url: "/profile", icon: User },
  { title: "Cài đặt", url: "/settings", icon: Settings },
];

/* ── Component ───────────────────────────────────────────── */
export function AppSidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { state } = useSidebar();
  const collapsed = state === "collapsed";

  const user = getUser();
  const displayName = user?.name || "Người dùng";
  const initials = getInitials(displayName);
  const isMentor = user?.role === "mentor";

  const handleLogout = () => { logout(); navigate("/"); };

  const isActive = (url) =>
    url === "/dashboard" || url === "/mentor/dashboard"
      ? location.pathname === url
      : location.pathname.startsWith(url);

  return (
    <Sidebar collapsible="icon">

      {/* ════════════ HEADER / LOGO ════════════ */}
      <SidebarHeader className="p-0">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              size="lg"
              tooltip="ProInterview"
              onClick={() => navigate("/")}
              className="
                h-14 rounded-none cursor-pointer
                hover:bg-white/5 active:bg-white/10
                data-[active=true]:bg-transparent
                group-data-[collapsible=icon]:!justify-center
                group-data-[collapsible=icon]:px-0
                px-4
              "
            >
              {/* Logo icon */}
              <div
                className="flex aspect-square size-8 shrink-0 items-center justify-center rounded-xl"
                style={{
                  background: "linear-gradient(135deg, #6E35E8 0%, #8B4DFF 100%)",
                  boxShadow: "0 4px 12px rgba(110,53,232,0.45)",
                }}
              >
                <Sparkles className="w-4 h-4 text-[#c4ff47]" strokeWidth={2.5} />
              </div>

              {/* Logo text — hidden when collapsed */}
              <div className="flex flex-col min-w-0 group-data-[collapsible=icon]:hidden">
                <div className="flex items-center gap-1.5">
                  <span
                    className="font-extrabold text-white truncate"
                    style={{ fontSize: "0.9375rem", letterSpacing: "-0.02em" }}
                  >
                    ProInterview
                  </span>
                  <span
                    className="shrink-0 text-[9px] font-bold px-1.5 py-0.5 rounded-md"
                    style={{ background: "#c4ff47", color: "#120B2E" }}
                  >
                    MVP
                  </span>
                </div>
                <span className="text-[10px] text-white/35 truncate">
                  Nền tảng Phỏng vấn AI
                </span>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>

        {/* divider */}
        <div
          className="mx-3 h-px group-data-[collapsible=icon]:mx-2"
          style={{ background: "rgba(255,255,255,0.08)" }}
        />
      </SidebarHeader>

      {/* ════════════ CONTENT ════════════ */}
      <SidebarContent className="py-3 px-2 gap-0 overflow-x-hidden">

        {/* ── Main group ─────────────────────── */}
        <SidebarGroup className="p-0">
          <SidebarGroupLabel
            className="
              mb-1 px-2 uppercase text-white/30
              group-data-[collapsible=icon]:hidden
            "
            style={{ fontSize: "0.6rem", fontWeight: 700, letterSpacing: "0.1em" }}
          >
            Menu chính
          </SidebarGroupLabel>

          <SidebarGroupContent>
            <SidebarMenu className="gap-0.5">
              {isMentor
                ? mentorMainItems.map((item) => {
                  const active = isActive(item.url);
                  return (
                    <SidebarMenuItem key={item.title}>
                      <SidebarMenuButton
                        isActive={active}
                        tooltip={item.title}
                        onClick={() => navigate(item.url)}
                        className="
                            h-10 rounded-xl gap-3 transition-all
                            group-data-[collapsible=icon]:!justify-center
                            group-data-[collapsible=icon]:!w-10
                            group-data-[collapsible=icon]:!mx-auto
                            group-data-[collapsible=icon]:px-0
                          "
                        style={
                          active
                            ? {
                              background: "linear-gradient(135deg, #6E35E8 0%, #8B4DFF 100%)",
                              color: "#fff",
                              boxShadow: "0 4px 12px rgba(110,53,232,0.35)",
                            }
                            : { color: "rgba(255,255,255,0.55)" }
                        }
                      >
                        <item.icon
                          className="size-[18px] shrink-0"
                          style={{ color: active ? "#fff" : "rgba(255,255,255,0.55)" }}
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
                            style={{ background: "#c4ff47" }}
                          />
                        )}
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })
                : customerMainItems.map((item) => {
                  const active = isActive(item.url);
                  return (
                    <SidebarMenuItem key={item.title}>
                      <SidebarMenuButton
                        isActive={active}
                        tooltip={item.title}
                        onClick={() => navigate(item.url)}
                        className="
                            h-10 rounded-xl gap-3 transition-all
                            group-data-[collapsible=icon]:!justify-center
                            group-data-[collapsible=icon]:!w-10
                            group-data-[collapsible=icon]:!mx-auto
                            group-data-[collapsible=icon]:px-0
                          "
                        style={
                          active
                            ? {
                              background: "linear-gradient(135deg, #6E35E8 0%, #8B4DFF 100%)",
                              color: "#fff",
                              boxShadow: "0 4px 12px rgba(110,53,232,0.35)",
                            }
                            : { color: "rgba(255,255,255,0.55)" }
                        }
                      >
                        <item.icon
                          className="size-[18px] shrink-0"
                          style={{ color: active ? "#fff" : "rgba(255,255,255,0.55)" }}
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
                            style={{ background: "#c4ff47" }}
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
        <div
          className="my-3 h-px group-data-[collapsible=icon]:mx-0 mx-1"
          style={{ background: "rgba(255,255,255,0.07)" }}
        />

        {/* ── Secondary group ─────────────────── */}
        <SidebarGroup className="p-0">
          <SidebarGroupLabel
            className="
              mb-1 px-2 uppercase text-white/30
              group-data-[collapsible=icon]:hidden
            "
            style={{ fontSize: "0.6rem", fontWeight: 700, letterSpacing: "0.1em" }}
          >
            Khác
          </SidebarGroupLabel>

          <SidebarGroupContent>
            <SidebarMenu className="gap-0.5">
              {secondaryItems.map((item) => {
                const active = isActive(item.url);
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton
                      isActive={active}
                      tooltip={item.title}
                      onClick={() => navigate(item.url)}
                      className="
                        h-10 rounded-xl gap-3 transition-all
                        group-data-[collapsible=icon]:!justify-center
                        group-data-[collapsible=icon]:!w-10
                        group-data-[collapsible=icon]:!mx-auto
                        group-data-[collapsible=icon]:px-0
                      "
                      style={
                        active
                          ? {
                            background: "linear-gradient(135deg, #6E35E8 0%, #8B4DFF 100%)",
                            color: "#fff",
                            boxShadow: "0 4px 12px rgba(110,53,232,0.35)",
                          }
                          : { color: "rgba(255,255,255,0.55)" }
                      }
                    >
                      <item.icon
                        className="size-[18px] shrink-0"
                        style={{ color: active ? "#fff" : "rgba(255,255,255,0.55)" }}
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

        {/* ── Upgrade CTA (expanded only) ─────── */}
        {!isMentor && (
          <div className="mt-auto pt-3 group-data-[collapsible=icon]:hidden">
            <div
              className="rounded-2xl p-3.5"
              style={{
                background: "linear-gradient(135deg, rgba(110,53,232,0.22) 0%, rgba(139,77,255,0.12) 100%)",
                border: "1px solid rgba(196, 255, 71,0.22)",
              }}
            >
              <div className="flex items-center gap-2.5 mb-3">
                <div
                  className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                  style={{ background: "rgba(196, 255, 71,0.12)" }}
                >
                  <Zap className="w-3.5 h-3.5" style={{ color: "#c4ff47" }} />
                </div>
                <div className="min-w-0">
                  <p className="text-white text-xs font-bold truncate">Nâng cấp lên Pro</p>
                  <p className="text-white/40 text-[10px] truncate">AI không giới hạn</p>
                </div>
              </div>
              <button
                onClick={() => navigate("/pricing")}
                className="w-full py-1.5 rounded-xl text-xs font-bold transition-all hover:brightness-110 active:scale-[0.97]"
                style={{
                  background: "#c4ff47",
                  color: "#120B2E",
                  boxShadow: "0 3px 14px rgba(196, 255, 71,0.32)",
                }}
              >
                Xem gói Pro →
              </button>
            </div>
          </div>
        )}

        {/* ── Upgrade icon (collapsed only) ──── */}
        {!isMentor && (
          <div className="hidden mt-auto pt-2 group-data-[collapsible=icon]:flex group-data-[collapsible=icon]:justify-center">
            <button
              onClick={() => navigate("/pricing")}
              title="Nâng cấp Pro"
              className="w-10 h-10 rounded-xl flex items-center justify-center transition-all hover:brightness-110"
              style={{ background: "rgba(196, 255, 71,0.12)", border: "1px solid rgba(196, 255, 71,0.22)" }}
            >
              <Zap className="w-4 h-4" style={{ color: "#c4ff47" }} />
            </button>
          </div>
        )}

      </SidebarContent>

      {/* ════════════ FOOTER / USER ════════════ */}
      <div
        className="mx-2 h-px"
        style={{ background: "rgba(255,255,255,0.08)" }}
      />

      <SidebarFooter className="p-2">
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  className="
                    flex w-full items-center gap-3 rounded-xl px-3 py-2 h-11
                    transition-all focus:outline-none cursor-pointer
                    group-data-[collapsible=icon]:justify-center
                    group-data-[collapsible=icon]:w-10
                    group-data-[collapsible=icon]:mx-auto
                    group-data-[collapsible=icon]:px-0
                  "
                  style={{ background: "rgba(255,255,255,0.05)" }}
                  onMouseEnter={(e) => {
                    (e.currentTarget).style.background = "rgba(255,255,255,0.09)";
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget).style.background = "rgba(255,255,255,0.05)";
                  }}
                >
                  {/* Avatar */}
                  <div
                    className="flex size-7 shrink-0 items-center justify-center rounded-full font-bold text-white"
                    style={{
                      background: "linear-gradient(135deg, #6E35E8 0%, #8B4DFF 100%)",
                      fontSize: "0.65rem",
                      boxShadow: "0 2px 8px rgba(110,53,232,0.4)",
                    }}
                  >
                    {initials}
                  </div>

                  {/* Name + email — hidden when collapsed */}
                  <div className="flex-1 min-w-0 group-data-[collapsible=icon]:hidden">
                    <p className="text-white truncate font-medium" style={{ fontSize: "0.78rem" }}>
                      {displayName}
                    </p>
                    <p className="text-white/35 truncate" style={{ fontSize: "0.65rem" }}>
                      {user?.email || "Gói Miễn phí"}
                    </p>
                  </div>

                  <ChevronsUpDown
                    className="size-3 text-white/25 shrink-0 group-data-[collapsible=icon]:hidden"
                  />
                </button>
              </DropdownMenuTrigger>

              <DropdownMenuContent side="top" align="end" className="w-56 mb-1">
                {/* Header */}
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
                  <Link to="/settings" className="flex items-center gap-2.5 cursor-pointer">
                    <Settings className="size-4" />
                    Cài đặt
                  </Link>
                </DropdownMenuItem>
                {!isMentor && (
                  <DropdownMenuItem
                    onClick={() => navigate("/pricing")}
                    className="flex items-center gap-2.5 cursor-pointer"
                    style={{ color: "#6E35E8", fontWeight: 600 }}
                  >
                    <Zap className="size-4" />
                    Nâng cấp lên Pro ↗
                  </DropdownMenuItem>
                )}

                <DropdownMenuSeparator />

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
        </SidebarMenu>
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  );
}