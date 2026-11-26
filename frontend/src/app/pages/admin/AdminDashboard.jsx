import React, { useState, useEffect } from "react";
import { Link } from "react-router";
import {
  Users,
  GraduationCap,
  Calendar,
  Crown,
  LineChart,
  Star,
  MessageSquare,
  UserPlus,
  Banknote,
  Activity,
  ArrowRight,
  BookOpen,
  UserCheck,
} from "lucide-react";
import { adminApi } from "../../api/adminApi.js";
import { toastApiError } from "../../utils/shared/apiToast.js";
import { formatVnd } from "../../utils/shared/formatVnd.js";
import { AppSelect } from "../../components/ui/AppSelect.jsx";

/** Cùng thứ tự ưu tiên với sidebar admin */
const TILES = [
  { to: "/admin/bookings", label: "Lịch hẹn & thanh toán", icon: Calendar, desc: "Lịch mentor, xác nhận CK SePay" },
  { to: "/admin/support", label: "Hỗ trợ", icon: MessageSquare, desc: "Khiếu nại, báo cáo mentor" },
  { to: "/admin/mentors/pending", label: "Duyệt cố vấn", icon: UserPlus, desc: "Hồ sơ chờ phê duyệt" },
  {
    to: "/admin/subscription-payments",
    label: "Gói Pro/Elite",
    icon: Crown,
    desc: "CK nâng cấp gói — SePay tự kích hoạt",
  },
  {
    to: "/admin/course-payments",
    label: "Học phí khóa",
    icon: BookOpen,
    desc: "Mua khóa CK — SePay mở khóa",
  },
  { to: "/admin/payouts", label: "Rút tiền cố vấn", icon: Banknote, desc: "Duyệt và chi trả mentor" },
  { to: "/admin/users", label: "Người dùng", icon: Users, desc: "Danh sách và chi tiết user" },
  { to: "/admin/mentors", label: "Cố vấn", icon: GraduationCap, desc: "Danh sách cố vấn" },
  // Duyệt khóa học đã chuyển sang /moderator/courses — admin không còn quyền kiểm duyệt.
  { to: "/admin/reviews", label: "Đánh giá", icon: Star, desc: "Review mentor & khóa học" },
  { to: "/admin/analytics", label: "Phân tích", icon: LineChart, desc: "Báo cáo và biểu đồ" },
];

const VIETNAMESE_MONTHS = [
  { value: "01", label: "Tháng 1" },
  { value: "02", label: "Tháng 2" },
  { value: "03", label: "Tháng 3" },
  { value: "04", label: "Tháng 4" },
  { value: "05", label: "Tháng 5" },
  { value: "06", label: "Tháng 6" },
  { value: "07", label: "Tháng 7" },
  { value: "08", label: "Tháng 8" },
  { value: "09", label: "Tháng 9" },
  { value: "10", label: "Tháng 10" },
  { value: "11", label: "Tháng 11" },
  { value: "12", label: "Tháng 12" },
];

export function AdminDashboard() {
  const [stats, setStats] = useState(null);
  const [platformFinance, setPlatformFinance] = useState(null);
  const [selectedMonth, setSelectedMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [loading, setLoading] = useState(true);
  const isAllTime = !selectedMonth;
  const monthLabel = selectedMonth || "Tất cả thời gian";
  const currentMonth = new Date().toISOString().slice(0, 7);
  const currentYear = Number(currentMonth.slice(0, 4));
  const currentMonthPart = currentMonth.slice(5, 7);
  const selectedYear = selectedMonth ? selectedMonth.slice(0, 4) : String(currentYear);
  const selectedMonthPart = selectedMonth ? selectedMonth.slice(5, 7) : currentMonthPart;
  const yearOptions = Array.from({ length: 6 }, (_, idx) => String(currentYear - idx));

  function updateMonthValue(nextYear, nextMonthPart) {
    const clampedMonthPart = nextYear === String(currentYear) && nextMonthPart > currentMonthPart
      ? currentMonthPart
      : nextMonthPart;
    setSelectedMonth(`${nextYear}-${clampedMonthPart}`);
  }

  useEffect(() => {
    adminApi
      .getStats()
      .then((statsRes) => {
        if (statsRes.success) setStats(statsRes.stats);
        else toastApiError(statsRes.error, "Không tải được thống kê admin.");
      })
      .catch(() => {
        toastApiError("Lỗi kết nối khi tải dashboard admin.");
      });
  }, []);

  useEffect(() => {
    setLoading(true);
    adminApi
      .getPlatformFinanceSummary({ month: selectedMonth })
      .then((financeRes) => {
        if (financeRes.success) setPlatformFinance(financeRes.platformFinance || null);
        else {
          toastApiError(financeRes.error, "Không tải được tổng quan tài chính nền tảng.");
          setPlatformFinance(null);
        }
      })
      .catch(() => {
        toastApiError("Lỗi kết nối khi tải tổng quan tài chính nền tảng.");
        setPlatformFinance(null);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [selectedMonth]);

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div>
        <p className="admin-kicker mb-1 text-[11px] font-bold uppercase tracking-[0.22em] text-[#93f72b] [html[data-workspace-theme=light]_&]:text-[#6d28d9]">
          ProInterview Command Center
        </p>
        <h1 className="font-headline text-[clamp(1.75rem,3.2vw,2.5rem)] font-extrabold leading-[1.15] tracking-tight text-white [html[data-workspace-theme=light]_&]:text-[#1a1b23]">
          Xin chào, <span className="admin-title-accent text-[#93f72b] [html[data-workspace-theme=light]_&]:text-[#6d28d9]">Admin!</span>
        </h1>
        <p className="mt-1.5 text-sm font-medium text-slate-400 [html[data-workspace-theme=light]_&]:text-[#5b5772]">
          Trung tâm điều hành toàn bộ hệ thống ProInterview.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        <StatCard
          label="Tổng người dùng"
          value={loading ? "..." : stats?.users || 0}
          icon={Users}
          color="#8037f4"
        />
        <StatCard
          label="Tổng cố vấn"
          value={loading ? "..." : stats?.mentors || 0}
          icon={GraduationCap}
          color="#84cc16"
        />
        <StatCard
          label="Lượt lịch hẹn"
          value={loading ? "..." : stats?.bookings || 0}
          icon={Activity}
          color="#f59e0b"
        />
      </div>

      <div className="glass-card space-y-6 p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">Doanh thu theo thời gian</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {!isAllTime && (
              <div className="inline-flex items-center gap-2 rounded-full border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700">
                <AppSelect
                  size="sm"
                  value={selectedMonthPart}
                  onValueChange={(v) => updateMonthValue(selectedYear, v)}
                  options={VIETNAMESE_MONTHS.map((m) => ({
                    value: m.value,
                    label: m.label,
                    disabled: selectedYear === String(currentYear) && m.value > currentMonthPart,
                  }))}
                />
                <AppSelect
                  size="sm"
                  value={selectedYear}
                  onValueChange={(v) => updateMonthValue(v, selectedMonthPart)}
                  options={yearOptions.map((year) => ({ value: year, label: year }))}
                />
              </div>
            )}
            <button
              type="button"
              onClick={() => setSelectedMonth(currentMonth)}
              className={`rounded-full border px-4 py-2 text-xs font-bold uppercase tracking-wide transition ${
                !isAllTime
                  ? "border-violet-300 bg-violet-100 text-violet-700"
                  : "border-slate-300 bg-white text-slate-700 hover:border-violet-300 hover:text-violet-700"
              }`}
            >
              Theo tháng
            </button>
            <button
              type="button"
              onClick={() => setSelectedMonth("")}
              className={`rounded-full border px-4 py-2 text-xs font-bold uppercase tracking-wide transition ${
                isAllTime
                  ? "border-violet-300 bg-violet-100 text-violet-700"
                  : "border-slate-300 bg-white text-slate-700 hover:border-violet-300 hover:text-violet-700"
              }`}
            >
              Tất cả thời gian
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label={`Tổng thu - ${monthLabel}`}
            value={loading ? "..." : formatVnd(platformFinance?.totals?.grossCollected || 0)}
            icon={Banknote}
            color="#4f46e5"
          />
          <StatCard
            label={`Khách hàng đã trả phí - ${monthLabel}`}
            value={loading ? "..." : (platformFinance?.totals?.paidCustomerCount ?? 0)}
            icon={UserCheck}
            color="#7c3aed"
          />
          <StatCard
            label={`Chia mentor - ${monthLabel}`}
            value={loading ? "..." : formatVnd(platformFinance?.totals?.mentorNet || 0)}
            icon={Users}
            color="#0f766e"
          />
          <StatCard
            label={`Lợi nhuận nền tảng - ${monthLabel}`}
            value={loading ? "..." : formatVnd(platformFinance?.totals?.platformRevenue || 0)}
            icon={Activity}
            color="#b45309"
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {TILES.map(({ to, label, icon: Icon, desc, highlight }) => (
          <Link
            key={to}
            to={to}
            className={`admin-glow-card group glass-card rounded-2xl border border-white/10 bg-white/[0.03] p-6 transition-all hover:border-violet-500/40 hover:bg-white/[0.06] ${
              highlight ? "ring-2 ring-amber-400/50 border-amber-300/60 bg-amber-500/10" : ""
            }`}
          >
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.05] text-violet-400 transition-all group-hover:border-[#93f72b]/60 group-hover:bg-[#93f72b]/20 group-hover:text-[#93f72b]">
              <Icon size={24} strokeWidth={2} />
            </div>
            <h2 className="flex items-center gap-2 text-base font-bold text-white group-hover:text-violet-300">
              {label}{" "}
              <ArrowRight size={14} className="opacity-0 transition-all group-hover:opacity-100 group-hover:translate-x-0.5" />
            </h2>
            <p className="mt-2 text-xs font-medium leading-relaxed text-slate-400">{desc}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}

function StatCard({ label, value, icon: Icon, color }) {
  return (
    <div className="admin-glow-card glass-card flex items-center justify-between p-6 sm:p-8 rounded-2xl border border-white/10 bg-white/[0.03] shadow-xl backdrop-blur-md group transition-all hover:border-violet-500/30">
      <div>
        <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">{label}</p>
        <h3 className="origin-left text-3xl sm:text-4xl font-extrabold tracking-tight text-white transition-transform group-hover:scale-105">
          {value}
        </h3>
      </div>
      <div
        className="flex h-14 w-14 sm:h-16 sm:w-16 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.05]"
        style={{ color }}
      >
        <Icon size={28} strokeWidth={2.2} />
      </div>
    </div>
  );
}
