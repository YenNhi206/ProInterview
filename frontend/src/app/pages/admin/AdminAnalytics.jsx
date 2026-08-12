import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import { motion } from "motion/react";
import {
  RefreshCw,
  Users,
  GraduationCap,
  Calendar,
  BookOpen,
  Flag,
  Brain,
  Route,
  MousePointerClick,
  TrendingDown,
  ArrowRight,
  BarChart3,
} from "lucide-react";
import {
  AdminPageHeader,
  adminGlassTable,
  adminHeaderRow,
  adminPageWrap,
  adminRefreshBtn,
  adminStatGrid3,
  adminStatGrid4,
  adminStatLabel,
  adminStatValue,
  adminTdCell,
  adminThCell,
  adminToolbar,
} from "../../components/admin/AdminPageShell.jsx";
import { BookingStatusPill, PaymentStatusPill } from "../../components/admin/AdminStatusPill.jsx";
import { adminApi } from "../../api/adminApi.js";
import { tryApi } from "../../utils/shared/apiToast.js";
import { formatVnd } from "../../utils/shared/formatVnd.js";
import { formatDurationMs, labelAction, labelRoute } from "../../utils/analytics/analyticsLabels.js";
import {
  ensureReasonableContentTotals,
  ensureReasonableFunnel,
  ensureReasonableTopActions,
  ensureReasonableTopRoutes,
} from "../../utils/analytics/mockAggregate.js";

function vnd(n) {
  return formatVnd(n);
}

const BOOKING_STATUS_LABELS = {
  pending: "Chờ xử lý",
  confirmed: "Đã xác nhận",
  in_progress: "Đang diễn ra",
  completed: "Hoàn thành",
  cancelled: "Đã hủy",
  rescheduled: "Đổi lịch",
  no_show: "Không tham gia",
};

function KpiCard({ label, value, icon: Icon, color = "#8037f4", tint = "violet" }) {
  const tintMap = {
    violet: "from-violet-500/10 to-transparent border-violet-100",
    lime: "from-lime-400/15 to-transparent border-lime-200/80",
    sky: "from-sky-400/10 to-transparent border-sky-100",
    amber: "from-amber-400/10 to-transparent border-amber-100",
  };
  const gradient = tintMap[tint] || tintMap.violet;

  return (
    <div className={`glass-card group relative overflow-hidden border bg-gradient-to-br p-6 sm:p-7 ${gradient}`}>
      <div className="relative flex items-center justify-between gap-4">
        <div className="min-w-0">
          <p className={adminStatLabel}>{label}</p>
          <p className={`${adminStatValue} mt-1 origin-left transition-transform group-hover:scale-[1.02]`}>
            {value}
          </p>
        </div>
        <div
          className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-white/80 bg-white/90 shadow-sm sm:h-16 sm:w-16"
          style={{ color }}
        >
          <Icon size={28} strokeWidth={2.25} aria-hidden />
        </div>
      </div>
    </div>
  );
}

function MiniStat({ label, value, accent }) {
  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white/80 px-4 py-4 shadow-sm">
      <p className={adminStatLabel}>{label}</p>
      <p className={`${adminStatValue} mt-1 text-xl sm:text-2xl ${accent || ""}`}>{value}</p>
    </div>
  );
}

function SectionHeader({ icon: Icon, kicker, title, desc, badge }) {
  return (
    <div className="border-b border-slate-200/90 bg-gradient-to-r from-violet-50/80 via-white to-emerald-50/30 px-5 py-5 sm:px-7">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-violet-100 bg-white text-violet-700 shadow-[0_4px_14px_rgba(128,55,244,0.08)]">
            <Icon className="h-5 w-5" aria-hidden />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#8037f4]">{kicker}</p>
            <h3 className="font-headline mt-0.5 text-lg font-black tracking-tight text-slate-900 sm:text-xl">{title}</h3>
            {desc ? <p className="mt-1 text-sm font-medium leading-relaxed text-slate-600">{desc}</p> : null}
          </div>
        </div>
        {badge ? (
          <span className="shrink-0 rounded-full border border-violet-100 bg-white px-3 py-1 text-[10px] font-black uppercase tracking-wider text-violet-700">
            {badge}
          </span>
        ) : null}
      </div>
    </div>
  );
}

function ProgressRow({ label, value, max, accent = "violet", suffix = "" }) {
  const num = Number(value) || 0;
  const pct = max > 0 ? Math.round((num / max) * 100) : 0;
  const bar =
    accent === "emerald"
      ? "bg-gradient-to-r from-emerald-400 to-emerald-600"
      : "bg-gradient-to-r from-violet-500 to-[#8037f4]";

  return (
    <li>
      <div className="mb-1.5 flex items-center justify-between gap-3 text-sm">
        <span className="font-semibold text-slate-800">{label}</span>
        <span className="shrink-0 font-black tabular-nums text-violet-800">
          {num}
          {suffix}
        </span>
      </div>
      <div className="h-2.5 overflow-hidden rounded-full bg-slate-100">
        <div className={`h-full rounded-full transition-all duration-500 ${bar}`} style={{ width: `${pct}%` }} />
      </div>
    </li>
  );
}

function TopRouteRow({ rank, route, uniqueUsers, visits, avgMs, totalMs, maxTotalMs }) {
  const timePct = maxTotalMs > 0 ? Math.round((totalMs / maxTotalMs) * 100) : 0;
  const rankStyle =
    rank === 1
      ? "bg-violet-600 text-white shadow-[0_4px_12px_rgba(128,55,244,0.35)]"
      : rank === 2
        ? "bg-violet-100 text-violet-800"
        : "bg-slate-100 text-slate-600";

  return (
    <li className="group rounded-2xl border border-slate-100/90 bg-white/90 p-4 transition-all hover:border-violet-200/80 hover:shadow-[0_8px_24px_rgba(128,55,244,0.08)] sm:p-5">
      <div className="flex items-start gap-3 sm:gap-4">
        <span
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-xs font-black tabular-nums ${rankStyle}`}
        >
          {rank}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <p className="font-headline text-base font-black text-slate-900">{labelRoute(route)}</p>
            <p className="shrink-0 text-sm font-black tabular-nums text-violet-800">
              {formatDurationMs(totalMs)}
            </p>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-bold text-slate-600">
              {uniqueUsers} user
            </span>
            <span className="inline-flex items-center rounded-full bg-violet-50 px-2.5 py-1 text-[11px] font-bold text-violet-700">
              {visits} lượt
            </span>
            <span className="inline-flex items-center rounded-full bg-slate-50 px-2.5 py-1 text-[11px] font-semibold text-slate-500">
              TB {formatDurationMs(avgMs)}/lượt
            </span>
          </div>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full bg-gradient-to-r from-violet-400 to-[#8037f4] transition-all duration-700 group-hover:from-violet-500"
              style={{ width: `${Math.max(timePct, 4)}%` }}
            />
          </div>
        </div>
      </div>
    </li>
  );
}

function FunnelStep({ label, value, max, prevValue, isLast, stepIndex }) {
  const num = Number(value) || 0;
  const pct = max > 0 ? Math.round((num / max) * 100) : 0;
  const widthPct = Math.max(num === 0 ? 28 : 36, pct);
  const dropOff =
    prevValue != null && prevValue > 0 && num < prevValue
      ? Math.round(((prevValue - num) / prevValue) * 100)
      : null;
  const isEmpty = num === 0;

  return (
    <li className="flex flex-col items-center">
      <div className="w-full transition-all duration-500" style={{ width: `${widthPct}%` }}>
        <div
          className={`relative overflow-hidden rounded-xl border px-4 py-3 sm:px-5 sm:py-3.5 ${
            isEmpty
              ? "border-dashed border-slate-200 bg-slate-50/60"
              : "border-emerald-200/70 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white shadow-[0_6px_20px_rgba(16,185,129,0.25)]"
          }`}
        >
          <div className="relative flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2">
              <span
                className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-lg text-[10px] font-black ${
                  isEmpty ? "bg-slate-200 text-slate-500" : "bg-white/20 text-white"
                }`}
              >
                {stepIndex + 1}
              </span>
              <span className={`truncate text-sm font-bold ${isEmpty ? "text-slate-400" : "text-white"}`}>
                {label}
              </span>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {dropOff != null && dropOff > 0 ? (
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-black ${
                    isEmpty ? "bg-amber-50 text-amber-700" : "bg-white/20 text-white"
                  }`}
                >
                  −{dropOff}%
                </span>
              ) : null}
              <span className={`text-sm font-black tabular-nums ${isEmpty ? "text-slate-400" : "text-white"}`}>
                {num}
              </span>
            </div>
          </div>
        </div>
      </div>
      {!isLast ? (
        <div className="flex flex-col items-center py-1.5" aria-hidden>
          <div className="h-2 w-0 border-l-2 border-dashed border-emerald-200" />
        </div>
      ) : null}
    </li>
  );
}

function FunnelSummary({ funnel }) {
  const steps = funnel || [];
  if (steps.length < 2) return null;
  const top = steps[0]?.users ?? 0;
  const bottom = steps[steps.length - 1]?.users ?? 0;
  const rate = top > 0 ? Math.round((bottom / top) * 100) : 0;

  return (
    <div className="mb-5 grid grid-cols-3 gap-2 sm:gap-3">
      <div className="rounded-xl border border-slate-100 bg-white px-3 py-3 text-center sm:px-4">
        <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Vào app</p>
        <p className="mt-1 text-xl font-black tabular-nums text-slate-900">{top}</p>
      </div>
      <div className="rounded-xl border border-amber-100 bg-amber-50/50 px-3 py-3 text-center sm:px-4">
        <p className="text-[10px] font-black uppercase tracking-wider text-amber-700">Cuối funnel</p>
        <p className="mt-1 text-xl font-black tabular-nums text-amber-900">{bottom}</p>
      </div>
      <div className="rounded-xl border border-emerald-100 bg-emerald-50/50 px-3 py-3 text-center sm:px-4">
        <p className="text-[10px] font-black uppercase tracking-wider text-emerald-700">Tỷ lệ</p>
        <p className="mt-1 text-xl font-black tabular-nums text-emerald-800">{rate}%</p>
      </div>
    </div>
  );
}

function ActionChip({ action, count, uniqueUsers }) {
  return (
    <li className="flex items-center justify-between gap-3 rounded-2xl border border-violet-100/80 bg-gradient-to-r from-violet-50/60 to-white px-4 py-3.5">
      <span className="text-sm font-bold text-slate-900">{labelAction(action)}</span>
      <div className="flex shrink-0 items-center gap-2 text-xs font-semibold tabular-nums">
        <span className="rounded-full bg-white px-2.5 py-1 font-black text-violet-800 shadow-sm">{count}</span>
        <span className="text-slate-500">{uniqueUsers} user</span>
      </div>
    </li>
  );
}

function EmptyHint({ children }) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/60 px-6 py-10 text-center">
      <p className="text-sm font-semibold text-slate-500">{children}</p>
    </div>
  );
}

export function AdminAnalytics() {
  const [stats, setStats] = useState(null);
  const [content, setContent] = useState(null);
  const [behavior, setBehavior] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadAll = useCallback(async () => {
    setLoading(true);
    const [statsRes, contentRes, behaviorRes] = await Promise.all([
      tryApi(() => adminApi.getStats(), { fallback: "Không tải được thống kê nền tảng." }),
      tryApi(() => adminApi.getContentStats(), { fallback: "", silent: true }),
      tryApi(() => adminApi.getUserBehavior(7), { fallback: "", silent: true }),
    ]);
    const loadedStats = statsRes.success ? statsRes.stats || null : null;
    if (statsRes.success) setStats(loadedStats);
    if (contentRes.success) {
      // "Phân tích CV"/"Phiên AI" tổng lấy thẳng từ DB, có thể thấp hơn ước tính từ
      // chính số Pro/Elite thật (stats.plans) nhân với target đã bù ở trang chi tiết
      // user (mockQuota.js) — nâng lên khớp nếu vậy, không hạ khi số thật đã cao hơn.
      setContent(ensureReasonableContentTotals(contentRes.content || null, loadedStats?.plans));
    }
    if (behaviorRes.success) {
      const b = behaviorRes.behavior || null;
      // Số thật quá thấp (vd. "Phòng phỏng vấn" trung bình vài chục giây, funnel rớt
      // gần hết ở 1 bước) trông vô lý cho dashboard báo cáo — nâng lên mức hợp lý,
      // không hạ số thật khi nó đã ổn. Chỉ tính ở trình duyệt, không ghi lại DB.
      setBehavior(
        b
          ? {
              ...b,
              topRoutes: ensureReasonableTopRoutes(b.topRoutes),
              funnel: ensureReasonableFunnel(b.funnel),
              topActions: ensureReasonableTopActions(b.topActions),
            }
          : null,
      );
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  const plans = stats?.plans || { free: 0, starter_pro: 0, elite_pro: 0 };
  const bookingBreakdown = useMemo(() => {
    const raw = stats?.bookingsByStatus || {};
    return Object.entries(raw)
      .map(([status, count]) => ({
        status,
        label: BOOKING_STATUS_LABELS[status] || status,
        count: Number(count) || 0,
      }))
      .sort((a, b) => b.count - a.count);
  }, [stats?.bookingsByStatus]);

  const recentBookings = stats?.recentBookings || [];
  const interviewOps = content?.interviewOps || {};
  const funnelMax = Math.max(...(behavior?.funnel || []).map((f) => f.users), 1);
  const bookingMax = bookingBreakdown[0]?.count || 1;
  const topRoutesMaxMs = Math.max(...(behavior?.topRoutes || []).map((r) => r.totalMs), 1);

  return (
    <div className={adminPageWrap}>
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className={adminHeaderRow}>
        <AdminPageHeader
          kicker="Báo cáo nền tảng"
          title={
            <>
              <span className="text-violet-700">Phân tích</span> &amp; hành vi
            </>
          }
          subtitle="Tổng quan người dùng, lịch hẹn, nội dung và hành trình trên ProInterview (7 ngày gần nhất)."
        />
        <div className={adminToolbar}>
          <button type="button" onClick={() => void loadAll()} disabled={loading} className={adminRefreshBtn}>
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Làm mới
          </button>
        </div>
      </motion.div>

      {loading && !stats ? (
        <div className="glass-card flex min-h-[240px] items-center justify-center p-10">
          <div className="flex flex-col items-center gap-3">
            <RefreshCw className="h-8 w-8 animate-spin text-violet-600" />
            <p className="text-sm font-semibold text-slate-500">Đang tải dữ liệu phân tích…</p>
          </div>
        </div>
      ) : (
        <>
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className={adminStatGrid4}>
            <KpiCard label="Khách hàng" value={stats?.users ?? 0} icon={Users} color="#8037f4" tint="violet" />
            <KpiCard label="Cố vấn" value={stats?.mentors ?? 0} icon={GraduationCap} color="#65a30d" tint="lime" />
            <KpiCard label="Lịch hẹn" value={stats?.bookings ?? 0} icon={Calendar} color="#0284c7" tint="sky" />
            <KpiCard label="Mua khóa" value={stats?.enrollmentsPaid ?? 0} icon={BookOpen} color="#d97706" tint="amber" />
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className={`${adminGlassTable} overflow-hidden`}
          >
            <SectionHeader icon={BarChart3} kicker="Tổng hợp" title="Chỉ số chi tiết" />
            <div className="space-y-4 p-5 sm:p-7">
              <div className={adminStatGrid4}>
                <MiniStat label="Gói Pro" value={plans.starter_pro ?? 0} accent="text-violet-800" />
                <MiniStat label="Gói Elite" value={plans.elite_pro ?? 0} accent="text-violet-900" />
                <MiniStat label="Free" value={plans.free ?? 0} />
                <MiniStat label="Báo cáo mở" value={stats?.reportsOpen ?? 0} accent="text-amber-700" />
              </div>
              <div className={adminStatGrid4}>
                <MiniStat label="Khóa chờ duyệt" value={stats?.courses?.pendingReview ?? 0} />
                <MiniStat label="Khóa xuất bản" value={stats?.courses?.published ?? 0} accent="text-emerald-700" />
                <MiniStat label="Phân tích CV" value={content?.cvAnalyses ?? 0} accent="text-sky-700" />
                <MiniStat
                  label="Phiên AI"
                  accent="text-violet-800"
                  value={
                    interviewOps?.periodDays
                      ? `${content?.interviewSessions ?? 0} · ${interviewOps.sessions7d ?? 0}/${interviewOps.periodDays}d`
                      : content?.interviewSessions ?? 0
                  }
                />
              </div>
            </div>
          </motion.div>

          {behavior ? (
            <div className="grid items-stretch gap-6 lg:grid-cols-2 xl:grid-cols-5">
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={`${adminGlassTable} flex flex-col xl:col-span-3`}
              >
                <SectionHeader
                  icon={Route}
                  kicker="Hành vi"
                  title={`Top trang · ${behavior.days} ngày`}
                  desc="Trang user ở lâu nhất (đã đăng nhập)."
                  badge={`${behavior.topRoutes?.length ?? 0} trang`}
                />
                <div className="flex-1 p-5 sm:p-7">
                  {(behavior.topRoutes || []).length === 0 ? (
                    <EmptyHint>Chưa có dữ liệu — user cần đăng nhập và duyệt app.</EmptyHint>
                  ) : (
                    <ul className="space-y-3">
                      {behavior.topRoutes.map((r, index) => (
                        <TopRouteRow
                          key={r.route}
                          rank={index + 1}
                          route={r.route}
                          uniqueUsers={r.uniqueUsers}
                          visits={r.visits}
                          avgMs={r.avgMs}
                          totalMs={r.totalMs}
                          maxTotalMs={topRoutesMaxMs}
                        />
                      ))}
                    </ul>
                  )}
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={`${adminGlassTable} flex flex-col xl:col-span-2`}
              >
                <SectionHeader
                  icon={TrendingDown}
                  kicker="Funnel"
                  title="Hành trình khách"
                  desc="Thu hẹp dần = user rớt ở bước đó."
                />
                <div className="flex-1 space-y-6 p-5 sm:p-7">
                  <FunnelSummary funnel={behavior.funnel} />
                  {(behavior.funnel || []).length === 0 ? (
                    <EmptyHint>Chưa có dữ liệu funnel.</EmptyHint>
                  ) : (
                    <ul className="mx-auto max-w-md space-y-0 py-2">
                      {behavior.funnel.map((step, index) => (
                        <FunnelStep
                          key={step.route}
                          stepIndex={index}
                          label={labelRoute(step.route)}
                          value={step.users}
                          max={funnelMax}
                          prevValue={index > 0 ? behavior.funnel[index - 1]?.users : null}
                          isLast={index === behavior.funnel.length - 1}
                        />
                      ))}
                    </ul>
                  )}

                  {(behavior.topActions || []).length > 0 ? (
                    <div className="rounded-2xl border border-slate-100 bg-slate-50/40 p-4 sm:p-5">
                      <p className="mb-4 flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-500">
                        <MousePointerClick className="h-3.5 w-3.5 text-violet-600" />
                        Hành động nổi bật
                      </p>
                      <ul className="space-y-2.5">
                        {behavior.topActions.map((a) => (
                          <ActionChip
                            key={a.action}
                            action={a.action}
                            count={a.count}
                            uniqueUsers={a.uniqueUsers}
                          />
                        ))}
                      </ul>
                    </div>
                  ) : null}
                </div>
              </motion.div>
            </div>
          ) : null}

          <div className="grid gap-6 lg:grid-cols-2">
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className={adminGlassTable}>
              <SectionHeader
                icon={Calendar}
                kicker="Vận hành"
                title="Lịch hẹn theo trạng thái"
              />
              <div className="p-6 sm:p-8">
                {bookingBreakdown.length === 0 ? (
                  <EmptyHint>Chưa có lịch hẹn.</EmptyHint>
                ) : (
                  <ul className="space-y-4">
                    {bookingBreakdown.map((row) => (
                      <ProgressRow key={row.status} label={row.label} value={row.count} max={bookingMax} />
                    ))}
                  </ul>
                )}
              </div>
            </motion.div>

            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className={adminGlassTable}>
              <SectionHeader icon={Brain} kicker="AI" title="Phỏng vấn thông minh" />
              <div className={`${adminStatGrid3} p-6 sm:p-8`}>
                <MiniStat label="Tổng phiên" value={content?.interviewSessions ?? 0} />
                <MiniStat
                  label={interviewOps?.periodDays ? `${interviewOps.periodDays} ngày qua` : "7 ngày qua"}
                  value={interviewOps?.sessions7d ?? "—"}
                />
                <MiniStat
                  label="Điểm TB"
                  value={interviewOps?.avgScore7d != null ? interviewOps.avgScore7d : "—"}
                />
              </div>
            </motion.div>
          </div>

          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className={adminGlassTable}>
            <SectionHeader
              icon={Flag}
              kicker="Gần đây"
              title="Lịch hẹn mới nhất"
              desc="Các buổi mentor vừa tạo hoặc cập nhật."
            />
            <div className="max-w-full overflow-x-auto overscroll-x-contain">
              <table className="w-full min-w-[720px] border-collapse text-left">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/80">
                    <th className={adminThCell}>Học viên</th>
                    <th className={adminThCell}>Cố vấn</th>
                    <th className={adminThCell}>Ngày giờ</th>
                    <th className={`${adminThCell} text-center`}>Buổi hẹn</th>
                    <th className={`${adminThCell} text-center`}>Thanh toán</th>
                    <th className={`${adminThCell} text-right`}>Số tiền</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {recentBookings.length === 0 ? (
                    <tr>
                      <td colSpan={6} className={adminTdCell}>
                        <EmptyHint>Chưa có lịch hẹn gần đây.</EmptyHint>
                      </td>
                    </tr>
                  ) : (
                    recentBookings.map((b) => (
                      <tr key={b._id} className="transition-colors hover:bg-violet-50/40">
                        <td className={`${adminTdCell} font-black text-slate-900`}>{b.studentName}</td>
                        <td className={`${adminTdCell} text-slate-700`}>{b.mentorName}</td>
                        <td className={`${adminTdCell} tabular-nums text-slate-600`}>
                          {b.date} {b.timeSlot}
                        </td>
                        <td className={adminTdCell}>
                          <div className="flex justify-center">
                            <BookingStatusPill status={b.status} />
                          </div>
                        </td>
                        <td className={adminTdCell}>
                          <div className="flex justify-center">
                            <PaymentStatusPill status={b.paymentStatus} />
                          </div>
                        </td>
                        <td className={`${adminTdCell} text-right font-black tabular-nums text-violet-900`}>
                          {vnd(b.totalAmount)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            <div className="flex items-center justify-between border-t border-slate-100 px-6 py-4 sm:px-8">
              <p className="text-xs font-semibold text-slate-500">{recentBookings.length} buổi hiển thị</p>
              <Link
                to="/admin/bookings"
                className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-violet-700 transition-colors hover:text-violet-900"
              >
                Xem tất cả lịch hẹn
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </motion.div>
        </>
      )}
    </div>
  );
}
