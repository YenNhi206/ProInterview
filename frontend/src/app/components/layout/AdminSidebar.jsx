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
  Building2,
  Route,
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
      { to: "/admin/learning-path-payments", label: "Đối soát lộ trình học", icon: Route },
      { to: "/admin/course-payments", label: "Theo dõi học phí khóa", icon: BookOpen },
    ],
  },
  {
    title: "Tài chính",
    items: [
      { to: "/admin/payouts", label: "Rút tiền cố vấn", icon: Banknote },
      { to: "/admin/finance", label: "Tổng quan tài chính", icon: Wallet, end: true },
      { to: "/admin/finance/operations", label: "Giải ngân & đối soát", icon: Banknote },
      { to: "/admin/transactions", label: "Giao dịch", icon: ArrowLeftRight },
    ],
  },
  {
    title: "Người dùng & Doanh nghiệp",
    items: [
      { to: "/admin/users", label: "Người dùng", icon: Users },
      { to: "/admin/companies", label: "Đối tác doanh nghiệp", icon: Building2 },
      { to: "/admin/users/import", label: "Nhập từ Google Form", icon: Upload },
      { to: "/admin/mentors", label: "Cố vấn", icon: GraduationCap },
    ],
  },
  {
    title: "Nội dung",
    items: [
      // "Khóa học" đã chuyển sang /moderator/courses — kiểm duyệt nội dung thuộc moderator.
      { to: "/admin/content/questions", label: "Phỏng vấn AI", icon: FileQuestion },
      { to: "/admin/achievements", label: "Tin tức & Hoạt động", icon: Star },
    ],
  },
  {
    title: "Báo cáo",
    items: [
      { to: "/admin/reviews", label: "Đánh giá", icon: Star },
      { to: "/admin/analytics", label: "Phân tích", icon: LineChart },
      { to: "/admin/audit-log", label: "Nhật ký admin", icon: BookOpen },
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
    <Sidebar collapsible="icon" className="border-r border-white/10 bg-[#0a0416]/95 backdrop-blur-xl">
      <SidebarHeader className="overflow-hidden p-0">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarBrandButton
              tooltip="ProInterview, Quản trị"
              onClick={() => navigate("/admin")}
              badge={
                <span className="shrink-0 rounded-full border border-lime-400/40 bg-lime-400/15 px-2 py-0.5 text-[8px] font-black tracking-wider text-lime-400 shadow-[0_0_10px_rgba(147,247,43,0.2)]">
                  ADMIN
                </span>
              }
            />
          </SidebarMenuItem>
        </SidebarMenu>
        <div className="mx-3 h-px bg-white/10 group-data-[collapsible=icon]:mx-2" />
      </SidebarHeader>

      <SidebarContent className="min-h-0 flex-1 gap-0 overflow-hidden px-2 py-3">
        <div ref={contentRef} className="flex min-h-0 flex-1 flex-col gap-0 overflow-y-auto overflow-x-hidden">
        <SidebarGroup className="p-0">
          <SidebarGroupLabel
            className="mb-1.5 px-3 uppercase text-slate-400 font-bold group-data-[collapsible=icon]:hidden"
            style={{ fontSize: "0.625rem", letterSpacing: "0.12em" }}
          >
            Menu chính
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <div className="flex flex-col gap-3 group-data-[collapsible=icon]:gap-2">
              {MAIN_GROUPS.map((group) => (
                <SidebarGroup key={group.title} className="p-0">
                  <SidebarGroupLabel
                    className="mb-1.5 px-3 uppercase text-slate-400 font-bold group-data-[collapsible=icon]:hidden"
                    style={{ fontSize: "0.5625rem", letterSpacing: "0.14em" }}
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
                              data-button-surface="none"
                              onClick={() => navigate(to)}
                              className="
                                h-9 rounded-xl gap-3 transition-all text-slate-300
                                hover:bg-white/[0.08] hover:text-white
                                group-data-[collapsible=icon]:!justify-center
                                group-data-[collapsible=icon]:!w-9
                                group-data-[collapsible=icon]:!mx-auto
                                group-data-[collapsible=icon]:px-0
                              "
                              style={
                                active
                                  ? {
                                      background: "linear-gradient(135deg, #7c3aed 0%, #6366f1 100%)",
                                      color: "#ffffff",
                                      boxShadow: "0 4px 14px rgba(124, 58, 237, 0.35)",
                                      border: "1px solid rgba(167, 139, 250, 0.25)",
                                    }
                                  : undefined
                              }
                            >
                              <Icon
                                className={`size-[17px] shrink-0 ${active ? "text-white" : "text-slate-400"}`}
                              />
                              <span
                                className="truncate text-[0.8125rem] group-data-[collapsible=icon]:hidden"
                                data-admin-nav-label
                                data-active={active ? "true" : "false"}
                                style={{ fontWeight: active ? 700 : 500 }}
                              >
                                {label}
                              </span>
                              {active && (
                                <span
                                  className="ml-auto size-1.5 shrink-0 rounded-full group-data-[collapsible=icon]:hidden shadow-[0_0_8px_#93f72b]"
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
        <div className="mx-1 my-3 h-px bg-white/10 group-data-[collapsible=icon]:mx-0" />

        <SidebarGroup className="p-0">
          <SidebarGroupLabel
            className="mb-1.5 px-3 uppercase text-slate-400 font-bold group-data-[collapsible=icon]:hidden"
            style={{ fontSize: "0.625rem", letterSpacing: "0.12em" }}
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
                      data-button-surface="none"
                      onClick={() => navigate(to)}
                      className="
                        h-9 rounded-xl gap-3 transition-all text-slate-300
                        hover:bg-white/[0.08] hover:text-white
                        group-data-[collapsible=icon]:!justify-center
                        group-data-[collapsible=icon]:!w-9
                        group-data-[collapsible=icon]:!mx-auto
                        group-data-[collapsible=icon]:px-0
                      "
                      style={
                        active
                          ? {
                              background: "linear-gradient(135deg, #7c3aed 0%, #6366f1 100%)",
                              color: "#ffffff",
                              boxShadow: "0 4px 14px rgba(124, 58, 237, 0.35)",
                              border: "1px solid rgba(167, 139, 250, 0.25)",
                            }
                          : undefined
                      }
                    >
                      <Icon
                        className={`size-[17px] shrink-0 ${active ? "text-white" : "text-slate-400"}`}
                      />
                      <span
                        className="truncate text-[0.8125rem] group-data-[collapsible=icon]:hidden"
                        style={{ fontWeight: active ? 700 : 500 }}
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

      <div className="mx-2 h-px bg-white/10" />

      <SidebarFooter className="p-2">
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  data-button-surface="none"
                  className="
                    flex h-11 w-full cursor-pointer items-center gap-3 rounded-xl px-3 py-2
                    transition-all focus:outline-none
                    border border-white/10 bg-white/[0.04] hover:bg-white/[0.08]
                    group-data-[collapsible=icon]:mx-auto
                    group-data-[collapsible=icon]:w-10
                    group-data-[collapsible=icon]:justify-center
                    group-data-[collapsible=icon]:px-0
                  "
                >
                  <div
                    className="flex size-7 shrink-0 items-center justify-center rounded-lg font-bold text-white shadow-md shadow-violet-600/30"
                    style={{
                      background: "linear-gradient(135deg, #7c3aed, #4f46e5)",
                      fontSize: "0.65rem",
                    }}
                  >
                    {initials}
                  </div>
                  <div className="min-w-0 flex-1 text-left group-data-[collapsible=icon]:hidden">
                    <p className="truncate font-semibold text-white text-xs">
                      {displayName}
                    </p>
                    <p className="truncate text-slate-400 text-[11px]">
                      {user?.email || ""}
                    </p>
                  </div>
                  <ChevronsUpDown className="size-3.5 shrink-0 text-slate-400 group-data-[collapsible=icon]:hidden" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent side="top" align="end" className="mb-1 w-56 border border-white/10 bg-[#120a26] text-white backdrop-blur-xl">
                <DropdownMenuItem
                  onClick={handleLogout}
                  variant="destructive"
                  className="cursor-pointer"
                >
                  <LogOut className="size-4 mr-2" />
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
