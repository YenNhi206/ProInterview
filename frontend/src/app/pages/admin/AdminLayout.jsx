import React from "react";
import { Outlet, useLocation } from "react-router";
import { SidebarProvider, SidebarInset, SidebarTrigger } from "../../components/ui/sidebar";
import { AdminSidebar } from "../../components/layout/AdminSidebar";
import { MentorPageShell } from "../../components/mentor/MentorPageShell";
import { useUserPresence } from "../../hooks/useUserPresence.js";

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
      className="sticky top-0 z-30 flex h-16 shrink-0 items-center gap-4 border-b border-[rgba(110,53,232,0.14)] bg-white/95 px-5 antialiased backdrop-blur-xl"
      style={{ boxShadow: "0 1px 0 rgba(110, 53, 232, 0.08)" }}
    >
      <SidebarTrigger className="rounded-lg text-[#6E35E8]/75 transition-colors hover:bg-[#6E35E8]/10 hover:text-[#6E35E8]" />
      <div className="h-6 w-px shrink-0 bg-[#6E35E8]/20" />
      <div className="min-w-0">
        <h1
          className="truncate font-headline text-[0.9375rem] font-extrabold tracking-tight text-[#6E35E8]"
        >
          {label}
        </h1>
      </div>
      <div className="flex-1" />
      <span
        className="shrink-0 rounded-md px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-[#2D1B69] sm:text-[10px]"
        style={{ background: "linear-gradient(135deg, #B4F500, #93D600)" }}
      >
        Admin
      </span>
    </header>
  );
}

export function AdminLayout() {
  useUserPresence();

  return (
    <div
      className="admin-shell app-user-shell relative h-svh w-full overflow-hidden bg-[#f3f0f9] text-slate-900 antialiased selection:bg-violet-100 selection:text-violet-900"
    >
      <div className="app-shell-ambient" aria-hidden />
      <SidebarProvider
        className="relative z-[1] flex h-full min-h-0 w-full bg-transparent"
        style={{
          "--sidebar-width": "228px",
          "--sidebar-width-icon": "56px",
        }}
      >
        <AdminSidebar />
        <SidebarInset className="relative z-[1] flex min-h-0 min-w-0 flex-1 flex-col bg-transparent shadow-none md:peer-data-[variant=inset]:shadow-none md:peer-data-[variant=inset]:m-0 md:peer-data-[variant=inset]:rounded-none">
          <AdminTopBar />
          <div className="relative z-10 flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
            <MentorPageShell fillHeight bottomPad="pb-8">
              <div className="relative z-10 mx-auto w-full min-w-0 max-w-7xl px-4 pb-10 pt-6 sm:px-6 lg:px-8" data-admin-content>
                <Outlet />
              </div>
            </MentorPageShell>
          </div>
        </SidebarInset>
      </SidebarProvider>
    </div>
  );
}
