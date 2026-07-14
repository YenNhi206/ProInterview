import React from "react";
import { Link, useLocation, useNavigate } from "react-router";
import {
  LayoutDashboard,
  Users,
  GraduationCap,
  UserPlus,
  Wallet,
  ArrowLeftRight,
  Banknote,
  Camera,
  Calendar,
  FileQuestion,
  BookOpen,
  Crown,
  LineChart,
  Star,
  LifeBuoy,
  LogOut,
  ChevronsUpDown,
  Upload,
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
import { getUser, logout, getInitials, getDisplayName } from "../../utils/auth/auth.js";
import { SidebarBrandButton } from "./SidebarBrandButton";

/** Thứ tự nhóm & mục: ưu tiên vận hành hàng ngày → tiền → người dùng → nội dung → báo cáo */
const MAIN_GROUPS = [
  {
    title: "Tổng quan",
    items: [{ to: "/admin", label: "Bảng điều khiển", icon: LayoutDashboard, end: true }],
  },
  {
    title: "Vận hành",
    items: [
      { to: "/admin/bookings", label: "Lịch hẹn & thanh toán", icon: Calendar },
      { to: "/admin/bookings/check-ins", label: "Check-in mentor", icon: Camera },
      { to: "/admin/support", label: "Hỗ trợ", icon: LifeBuoy },
      { to: "/admin/mentors/pending", label: "Duyệt cố vấn", icon: UserPlus },
    ],
  },
  {
    title: "Đối soát SePay",
    items: [
      { to: "/admin/subscription-payments", label: "Theo dõi gói Pro/Elite", icon: Crown },
      { to: "/admin/course-payments", label: "Theo dõi học phí khóa", icon: BookOpen },
    ],
  },
  {
    title: "Tài chính",
    items: [
      { to: "/admin/payouts", label: "Rút tiền cố vấn", icon: Banknote },
      { to: "/admin/finance", label: "Tổng quan tài chính", icon: Wallet },
      { to: "/admin/transactions", label: "Giao dịch", icon: ArrowLeftRight },
    ],
  },
  {
    title: "Người dùng",
    items: [
      { to: "/admin/users", label: "Người dùng", icon: Users },
      { to: "/admin/users/import", label: "Nhập từ Google Form", icon: Upload },
      { to: "/admin/mentors", label: "Cố vấn", icon: GraduationCap },
    ],
  },
  {
    title: "Nội dung",
    items: [
      { to: "/admin/content/courses", label: "Khóa học", icon: BookOpen },
      { to: "/admin/content/questions", label: "Phỏng vấn AI", icon: FileQuestion },
      { to: "/admin/achievements", label: "Tin tức & Hoạt động", icon: Star },
    ],
  },
  {
    title: "Báo cáo",
    items: [
      { to: "/admin/reviews", label: "Đánh giá", icon: Star },
      { to: "/admin/analytics", label: "Phân tích", icon: LineChart },
    ],
  },
];

/** Ẩn tạm, cài đặt HT read-only; bật lại khi có PATCH /api/admin/settings */
const SECONDARY_ITEMS = [];

function pathActive(pathname, to, end) {
  const p = pathname.replace(/\/$/, "") || "/";
  const t = to.replace(/\/$/, "") || "/";
  if (end) return p === t;
  if (p === t) return true;
  if (!p.startsWith(`${t}/`)) return false;
  // /admin/mentors/pending thuộc menu "Duyệt cố vấn", không tô "Cố vấn"
  if (t === "/admin/mentors") {
    if (p === "/admin/mentors/pending" || p.startsWith("/admin/mentors/pending/")) {
      return false;
    }
  }
  // /admin/users/import thuộc menu "Nhập từ Google Form", không tô "Người dùng"
  if (t === "/admin/users") {
    if (p === "/admin/users/import" || p.startsWith("/admin/users/import/")) {
      return false;
    }
  }
  // /admin/bookings/check-ins thuộc menu "Check-in mentor", không tô "Lịch hẹn & thanh toán"
  if (t === "/admin/bookings") {
    if (p === "/admin/bookings/check-ins" || p.startsWith("/admin/bookings/check-ins/")) {
      return false;
    }
  }
  return true;
}

export function AdminSidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const contentRef = React.useRef(null);

  const user = getUser();
  const displayName = getDisplayName(user, "Admin");
  const initials = getInitials(displayName);

  const handleLogout = async () => {
    await logout();
    navigate("/");
  };

  React.useEffect(() => {
    if (contentRef.current) contentRef.current.scrollTop = 0;
  }, [location.pathname]);

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="overflow-hidden p-0">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarBrandButton
              tooltip="ProInterview, Quản trị"
              onClick={() => navigate("/admin")}
              badge={
                <span className="shrink-0 rounded-md bg-[#93f72b] px-1.5 py-0.5 text-[7px] font-bold tracking-wide text-[#2D1B69]">
                  ADMIN
                </span>
              }
            />
          </SidebarMenuItem>
        </SidebarMenu>
        <div className="mx-3 h-px bg-sidebar-border group-data-[collapsible=icon]:mx-2" />
      </SidebarHeader>

      <SidebarContent className="min-h-0 flex-1 gap-0 overflow-hidden px-2 py-3">
        <div ref={contentRef} className="flex min-h-0 flex-1 flex-col gap-0 overflow-y-auto overflow-x-hidden">
        <SidebarGroup className="p-0">
          <SidebarGroupLabel
            className="mb-1 px-2 uppercase text-slate-600 group-data-[collapsible=icon]:hidden"
            style={{ fontSize: "0.6rem", fontWeight: 700, letterSpacing: "0.1em" }}
          >
            Menu chính
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <div className="flex flex-col gap-3 group-data-[collapsible=icon]:gap-2">
              {MAIN_GROUPS.map((group) => (
                <SidebarGroup key={group.title} className="p-0">
                  <SidebarGroupLabel
                    className="mb-1 px-2 uppercase text-slate-600 group-data-[collapsible=icon]:hidden"
                    style={{ fontSize: "0.5625rem", fontWeight: 800, letterSpacing: "0.14em" }}
                  >
                    {group.title}
                  </SidebarGroupLabel>
                  <SidebarGroupContent>
                    <SidebarMenu className="gap-0.5">
                      {group.items.map(({ to, label, icon: Icon, end }) => {
                        const active = pathActive(location.pathname, to, end);
                        return (
                          <SidebarMenuItem key={to}>
                            <SidebarMenuButton
                              isActive={active}
                              tooltip={label}
                              onClick={() => navigate(to)}
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
                              <Icon
                                className={`size-[18px] shrink-0 ${active ? "text-white" : "text-sidebar-foreground/70"}`}
                              />
                              <span
                                className="truncate text-[0.8125rem] font-semibold group-data-[collapsible=icon]:hidden"
                                data-admin-nav-label
                                data-active={active ? "true" : "false"}
                                style={{ fontWeight: active ? 700 : 600 }}
                              >
                                {label}
                              </span>
                              {active && (
                                <span
                                  className="ml-auto size-1.5 shrink-0 rounded-full group-data-[collapsible=icon]:hidden"
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
              ))}
            </div>
          </SidebarGroupContent>
        </SidebarGroup>

        {SECONDARY_ITEMS.length > 0 ? (
          <>
        <div className="mx-1 my-3 h-px bg-sidebar-border group-data-[collapsible=icon]:mx-0" />

        <SidebarGroup className="p-0">
          <SidebarGroupLabel
            className="mb-1 px-2 uppercase text-slate-600 group-data-[collapsible=icon]:hidden"
            style={{ fontSize: "0.6rem", fontWeight: 700, letterSpacing: "0.1em" }}
          >
            Khác
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="gap-0.5">
              {SECONDARY_ITEMS.map(({ to, label, icon: Icon }) => {
                const active = pathActive(location.pathname, to, false);
                return (
                  <SidebarMenuItem key={to}>
                    <SidebarMenuButton
                      isActive={active}
                      tooltip={label}
                      onClick={() => navigate(to)}
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
                      <Icon
                        className={`size-[18px] shrink-0 ${active ? "text-white" : "text-sidebar-foreground/70"}`}
                      />
                      <span
                        className="truncate text-[0.8125rem] group-data-[collapsible=icon]:hidden"
                        style={{ fontWeight: active ? 600 : 400 }}
                      >
                        {label}
                      </span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
          </>
        ) : null}
        </div>
      </SidebarContent>

      <div className="mx-2 h-px bg-sidebar-border" />

      <SidebarFooter className="p-2">
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
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
                  <div className="min-w-0 flex-1 group-data-[collapsible=icon]:hidden">
                    <p className="truncate font-medium text-slate-900" style={{ fontSize: "0.78rem" }}>
                      {displayName}
                    </p>
                    <p className="truncate text-slate-500" style={{ fontSize: "0.65rem" }}>
                      {user?.email || ""}
                    </p>
                  </div>
                  <ChevronsUpDown className="size-3 shrink-0 text-slate-400 group-data-[collapsible=icon]:hidden" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent side="top" align="end" className="mb-1 w-56">
                <DropdownMenuItem
                  onClick={handleLogout}
                  className="flex cursor-pointer items-center gap-2.5 text-destructive focus:text-destructive"
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
