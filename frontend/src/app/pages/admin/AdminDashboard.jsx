import React, { useState, useEffect } from "react";
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
  TrendingUp,
  Activity,
  ArrowRight
} from "lucide-react";
import { adminApi } from "../../utils/adminApi";

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
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    adminApi.getStats().then(res => {
      if (res.success) setStats(res.stats);
      setLoading(false);
    });
  }, []);

  return (
    <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div>
        <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.22em] text-primary-fixed">
          ProInterview Command Center
        </p>
        <h1 className="text-4xl font-black tracking-tighter text-white sm:text-5xl">Bảng quản trị <span className="text-primary-fixed">Hệ thống</span></h1>
      </div>

      {/* Quick Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <StatCard 
          label="Tổng người dùng" 
          value={loading ? "..." : stats?.users || 0} 
          icon={Users} 
          color="#a78bfa" 
        />
        <StatCard 
          label="Tổng Mentor" 
          value={loading ? "..." : stats?.mentors || 0} 
          icon={GraduationCap} 
          color="#c4ff47" 
        />
        <StatCard 
          label="Lượt Booking" 
          value={loading ? "..." : stats?.bookings || 0} 
          icon={Activity} 
          color="#fb923c" 
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {TILES.map(({ to, label, icon: Icon, desc }) => (
          <Link
            key={to}
            to={to}
            className="group glass-card p-6 transition-all hover:border-primary-fixed/40 hover:bg-white/[0.08]"
          >
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-white group-hover:bg-primary-fixed group-hover:text-black transition-all">
              <Icon size={24} strokeWidth={2} />
            </div>
            <h2 className="text-base font-black text-white group-hover:text-primary-fixed flex items-center gap-2">
              {label} <ArrowRight size={14} className="opacity-0 group-hover:opacity-100 transition-all" />
            </h2>
            <p className="mt-2 text-[11px] font-medium leading-relaxed text-zinc-500">{desc}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}

function StatCard({ label, value, icon: Icon, color }) {
  return (
    <div className="glass-card p-8 flex items-center justify-between group">
      <div>
        <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-2">{label}</p>
        <h3 className="text-4xl font-black text-white tracking-tighter group-hover:scale-110 transition-transform origin-left">{value}</h3>
      </div>
      <div className="w-16 h-16 rounded-[24px] bg-white/5 border border-white/10 flex items-center justify-center" style={{ color }}>
        <Icon size={32} strokeWidth={2.5} />
      </div>
    </div>
  );
}
