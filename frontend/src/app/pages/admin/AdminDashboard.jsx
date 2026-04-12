import React from "react";
import { Link } from "react-router";
import {
  Users,
  GraduationCap,
  Wallet,
  Calendar,
  FileQuestion,
  LineChart,
  Settings,
  MessageSquare,
} from "lucide-react";

const TILES = [
  { to: "/admin/users", label: "Người dùng", icon: Users, desc: "Danh sách, filter, chi tiết user" },
  { to: "/admin/mentors", label: "Mentor", icon: GraduationCap, desc: "Mentor, duyệt pending" },
  { to: "/admin/finance", label: "Tài chính", icon: Wallet, desc: "Doanh thu, giao dịch, payout" },
  { to: "/admin/bookings", label: "Booking", icon: Calendar, desc: "Sessions & trạng thái" },
  { to: "/admin/content/questions", label: "Nội dung", icon: FileQuestion, desc: "Câu hỏi, video, khóa học" },
  { to: "/admin/analytics", label: "Analytics", icon: LineChart, desc: "Báo cáo & biểu đồ" },
  { to: "/admin/settings", label: "Cài đặt HT", icon: Settings, desc: "Giá, fee, API, email" },
  { to: "/admin/support", label: "Hỗ trợ", icon: MessageSquare, desc: "Ticket, khiếu nại, review" },
];

export function AdminDashboard() {
  return (
    <div className="space-y-8">
      <div>
        <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.22em] text-[#c4ff47]/90">
          ProInterview Admin
        </p>
        <h1 className="text-3xl font-black tracking-tighter text-white sm:text-4xl">Bảng điều khiển</h1>
        <p className="mt-2 max-w-2xl text-sm text-white/55">
          Trung tâm quản trị — các module bên dưới tương ứng cấu trúc bạn đã mô tả. Hiện hiển thị khung điều hướng; API
          CRUD sẽ bổ sung dần.
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {TILES.map(({ to, label, icon: Icon, desc }) => (
          <Link
            key={to}
            to={to}
            className="group rounded-2xl border border-white/10 bg-white/[0.05] p-5 transition-all hover:border-[#c4ff47]/35 hover:bg-white/[0.08]"
          >
            <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl border border-[#c4ff47]/25 bg-[#c4ff47]/10 text-[#c4ff47]">
              <Icon className="h-5 w-5" strokeWidth={2} />
            </div>
            <h2 className="text-sm font-bold text-white group-hover:text-[#c4ff47]">{label}</h2>
            <p className="mt-1 text-xs leading-relaxed text-white/45">{desc}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
