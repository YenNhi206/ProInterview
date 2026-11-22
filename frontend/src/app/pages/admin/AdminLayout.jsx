import React from "react";
import { Link, Outlet, useLocation } from "react-router";
import { SidebarProvider, SidebarInset, SidebarTrigger } from "../../components/ui/sidebar";
import { AdminSidebar } from "../../components/layout/AdminSidebar";
import { MentorPageShell } from "../../components/mentor/MentorPageShell";
import { useUserPresence } from "../../hooks/useUserPresence.js";
import { SelectThemeContext } from "../../components/ui/AppSelect";

/** Tiêu đề header, thứ tự từ cụ thể → tổng quan (regex). */
const ADMIN_HEADER_RULES = [
  [/^\/admin\/users\/[^/]+$/, "Chi tiết người dùng"],
  [/^\/admin\/users$/, "Người dùng"],
  [/^\/admin\/companies$/, "Đối tác doanh nghiệp"],
  [/^\/admin\/companies\/[^/]+$/, "Đối tác doanh nghiệp"],
  [/^\/admin\/mentors\/pending$/, "Duyệt cố vấn"],
  [/^\/admin\/mentors\/[^/]+$/, "Cố vấn"],
  [/^\/admin\/mentors$/, "Cố vấn"],
  [/^\/admin\/bookings\/check-ins$/, "Check-in mentor"],
  [/^\/admin\/bookings\/[^/]+$/, "Lịch hẹn & thanh toán"],
  [/^\/admin\/bookings$/, "Lịch hẹn & thanh toán"],
  [/^\/admin\/course-payments$/, "Theo dõi học phí khóa"],
  [/^\/admin\/subscription-payments$/, "Theo dõi gói Pro/Elite"],
  [/^\/admin\/transactions$/, "Giao dịch"],
  [/^\/admin\/payouts$/, "Rút tiền cố vấn"],
  [/^\/admin\/finance$/, "Tài chính"],
  [/^\/admin\/content\/questions$/, "Phỏng vấn AI"],
  [/^\/admin\/content\/courses$/, "Khóa học"],
  [/^\/admin\/achievements$/, "Quản lý Tin tức"],
  [/^\/admin\/analytics$/, "Phân tích"],
  [/^\/admin\/reviews$/, "Đánh giá"],
  [/^\/admin\/support$/, "Hỗ trợ"],
  [/^\/admin\/settings$/, "Cài đặt hệ thống"],
  [/^\/admin$/, "Quản trị"],
];

function adminPageHeader(pathname) {
  const p = (pathname || "").replace(/\/$/, "") || "/";
  for (const [re, label] of ADMIN_HEADER_RULES) {
    if (re.test(p)) return { label };
  }
  return { label: "Quản trị" };
}

function AdminTopBar() {
  const location = useLocation();
  const { label } = adminPageHeader(location.pathname);

  return (
    <header
      className="sticky top-0 z-30 flex h-16 shrink-0 items-center gap-4 border-b border-white/10 bg-[#0a0416]/80 px-5 antialiased backdrop-blur-xl"
      style={{ boxShadow: "0 1px 0 rgba(255, 255, 255, 0.05)" }}
    >
      <SidebarTrigger className="size-9 rounded-xl border border-white/10 bg-white/[0.04] text-slate-300 transition-colors hover:bg-white/10 hover:text-white" />
      <div className="h-5 w-px shrink-0 bg-white/10" />
      <div className="min-w-0 flex items-center gap-2">
        <span className="hidden sm:inline text-xs font-bold uppercase tracking-wider text-slate-400">
          Quản trị
        </span>
        <span className="hidden sm:inline text-slate-600">/</span>
        <h1
          className="truncate font-headline text-[0.9375rem] font-extrabold tracking-tight text-white"
        >
          {label}
        </h1>
      </div>
      <div className="flex-1" />
      <div className="flex items-center gap-3">
        <Link
          to="/"
          className="hidden sm:inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs font-semibold text-slate-300 transition-colors hover:bg-white/10 hover:text-white"
        >
          Trang chủ ProInterview
        </Link>
        <span
          className="shrink-0 rounded-full border border-lime-400/40 bg-lime-400/10 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider text-lime-400 shadow-[0_0_12px_rgba(147,247,43,0.18)]"
        >
          Admin
        </span>
      </div>
    </header>
  );
}

export function AdminLayout() {
  useUserPresence();

  return (
    <SelectThemeContext.Provider value="dark">
      <div
        className="admin-shell app-user-shell relative h-svh w-full overflow-hidden bg-[#0a0416] text-white antialiased selection:bg-violet-500/30 selection:text-white"
      >
        <div className="app-shell-ambient" aria-hidden />
        <SidebarProvider
          className="relative z-[1] flex h-full min-h-0 w-full bg-transparent"
          style={{
            "--sidebar-width": "236px",
            "--sidebar-width-icon": "56px",
          }}
        >
          <AdminSidebar />
          <SidebarInset className="relative z-[1] flex min-h-0 min-w-0 flex-1 flex-col bg-transparent shadow-none md:peer-data-[variant=inset]:shadow-none md:peer-data-[variant=inset]:m-0 md:peer-data-[variant=inset]:rounded-none">
            <AdminTopBar />
            <div className="relative z-10 flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
              <MentorPageShell fillHeight bottomPad="pb-8">
                <div className="relative z-10 mx-auto w-full min-w-0 max-w-7xl px-4 pb-12 pt-6 sm:px-6 lg:px-8" data-admin-content>
                  <Outlet />
                </div>
              </MentorPageShell>
            </div>
          </SidebarInset>
        </SidebarProvider>
      </div>
    </SelectThemeContext.Provider>
  );
}
