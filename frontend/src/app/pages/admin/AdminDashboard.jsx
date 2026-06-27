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
  { to: "/admin/content/courses", label: "Khóa học", icon: BookOpen, desc: "Duyệt và quản lý khóa" },
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
    <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="glass-card px-8 py-8">
        <p className="mb-2 text-[10px] font-black uppercase tracking-[0.22em] text-[#8037f4]">
          ProInterview Command Center
        </p>
        <h1 className="font-headline text-[clamp(1.75rem,3.5vw,2.5rem)] font-extrabold leading-[1.12] tracking-tight text-slate-900">
          Xin chào, <span className="text-violet-700">Admin!</span>
        </h1>
        <p className="mt-3 text-sm font-semibold text-slate-600">
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

        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          <StatCard
            label={`Tổng thu - ${monthLabel}`}
            value={loading ? "..." : formatVnd(platformFinance?.totals?.grossCollected || 0)}
            icon={Banknote}
            color="#4f46e5"
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
            className={`group glass-card border-slate-200/90 p-6 transition-all hover:border-violet-300/80 ${
              highlight ? "ring-2 ring-amber-400/50 border-amber-300/60 bg-amber-50/30" : ""
            }`}
          >
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 text-violet-700 transition-all group-hover:border-[#93f72b]/60 group-hover:bg-[#93f72b]/20 group-hover:text-[#120B2E]">
              <Icon size={24} strokeWidth={2} />
            </div>
            <h2 className="flex items-center gap-2 text-base font-black text-slate-900 group-hover:text-violet-800">
              {label}{" "}
              <ArrowRight size={14} className="opacity-0 transition-all group-hover:opacity-100" />
            </h2>
            <p className="mt-2 text-[11px] font-semibold leading-relaxed text-slate-500">{desc}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}

function StatCard({ label, value, icon: Icon, color }) {
  return (
    <div className="glass-card flex items-center justify-between p-8 group">
      <div>
        <p className="mb-2 text-[10px] font-black uppercase tracking-widest text-slate-500">{label}</p>
        <h3 className="origin-left text-4xl font-black tracking-tighter text-slate-900 transition-transform group-hover:scale-105">
          {value}
        </h3>
      </div>
      <div
        className="flex h-16 w-16 items-center justify-center rounded-[24px] border border-slate-200 bg-slate-50"
        style={{ color }}
      >
        <Icon size={32} strokeWidth={2.5} />
      </div>
    </div>
  );
}
