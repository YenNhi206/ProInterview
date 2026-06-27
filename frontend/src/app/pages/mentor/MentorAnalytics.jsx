import { useState, useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router";
import { motion, AnimatePresence } from "motion/react";
import {
  LineChart as ChartLineIcon,
  Star,
  TrendingUp as TrendUp,
  TrendingDown as TrendDown,
  Users,
  Target,
  Zap as Lightning,
  ChevronRight as CaretRight,
  Equal,
  X,
  Search,
} from "lucide-react";
import {
  LineChart,
  Line,
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  AreaChart,
  Area
} from "recharts";
import { getUser } from "../../utils/auth/auth.js";
import { MentorPageShell } from "../../components/mentor/MentorPageShell";
import { MentorStatMiniGrid, MentorStatFrame } from "../../components/mentor/MentorStatFrames";
import { fetchMentorAnalytics } from "../../api/mentorApi.js";
import { toastApiError } from "../../utils/shared/apiToast.js";
import { avatarSrc } from "../../utils/shared/mediaUrl.js";
import { MentorListExpandButton } from "../../components/mentor/MentorListExpandButton.jsx";
import { useMentorListExpand } from "../../hooks/useMentorListExpand.js";

const MENTEE_TREND_STYLES = {
  improving: {
    icon: TrendUp,
    label: "Cải thiện",
    className: "border-violet-200 bg-violet-50 text-violet-700",
  },
  declining: {
    icon: TrendDown,
    label: "Giảm dần",
    className: "border-orange-200 bg-orange-50 text-orange-700",
  },
  stable: {
    icon: Equal,
    label: "Ổn định",
    className: "border-slate-200 bg-slate-50 text-slate-600",
  },
  unknown: {
    icon: null,
    label: "Chưa đủ dữ liệu",
    className: "border-slate-100 bg-slate-50 text-slate-500",
  },
};

/** Căn nhãn radar theo vị trí để không bị cắt ở mép trái/phải */
function RadarSubjectTick({ payload, x, y, cx, cy }) {
  const label = String(payload?.value ?? "");
  const centerX = Number(cx);
  const dx = Number(x) - centerX;
  let textAnchor = "middle";
  let dxOffset = 0;
  if (dx < -8) {
    textAnchor = "end";
    dxOffset = -6;
  } else if (dx > 8) {
    textAnchor = "start";
    dxOffset = 6;
  }
  return (
    <text
      x={Number(x) + dxOffset}
      y={Number(y)}
      textAnchor={textAnchor}
      dominantBaseline="central"
      fill="#64748b"
      fontSize={11}
      fontWeight={600}
    >
      {label}
    </text>
  );
}

function MenteeScoreCell({ mentee, compact = false }) {
  const valueCls = compact ? "text-xs font-bold" : "text-sm font-bold";
  const emptyCls = compact ? "text-[11px] font-semibold" : "text-xs font-semibold";
  if (mentee.scoreSource === "review" && mentee.avgStarScore != null) {
    return (
      <div className="flex items-center justify-center gap-1" title="Đánh giá sao trung bình sau buổi mentor">
        <Star size={compact ? 12 : 14} className="shrink-0 fill-[#FFD600] text-[#FFD600]" aria-hidden />
        <span className={`${valueCls} tabular-nums text-slate-900`}>{mentee.avgStarScore.toFixed(1)}</span>
      </div>
    );
  }
  if (mentee.scoreSource === "interview" && mentee.avgInterviewScore != null) {
    return (
      <div className="flex items-center justify-center gap-1" title="Điểm STAR trung bình từ phỏng vấn AI">
        <span className={`${valueCls} tabular-nums text-violet-700`}>{mentee.avgInterviewScore.toFixed(1)}</span>
        {compact ? (
          <span className="rounded bg-violet-50 px-1 py-0.5 text-[9px] font-bold text-violet-600">AI</span>
        ) : (
          <span className="rounded-md bg-violet-50 px-1.5 py-0.5 text-[10px] font-bold text-violet-600">AI</span>
        )}
      </div>
    );
  }
  return (
    <span className={`${emptyCls} text-slate-600`} title="Chưa có đánh giá sao hoặc điểm phỏng vấn AI">
      Chưa có
    </span>
  );
}

function MenteeTrendBadge({ trend, compact = false }) {
  const key = MENTEE_TREND_STYLES[trend] ? trend : "unknown";
  const { icon: Icon, label, className } = MENTEE_TREND_STYLES[key];
  const displayLabel = compact && key === "unknown" ? "Chưa có" : label;
  return (
    <span
      className={`inline-flex max-w-full items-center justify-center gap-1 rounded-lg border px-2 py-1 text-[10px] font-semibold leading-none sm:gap-1.5 sm:rounded-full sm:px-2.5 sm:py-1 sm:text-xs ${className}`}
      title={
        key === "unknown"
          ? "Cần thêm đánh giá hoặc buổi phỏng vấn AI để so sánh tiến bộ"
          : undefined
      }
    >
      {Icon ? <Icon size={compact ? 12 : 14} strokeWidth={2.5} aria-hidden /> : null}
      <span className="truncate">{displayLabel}</span>
    </span>
  );
}

function MenteeQuickStats({ mentee, variant = "inline" }) {
  if (variant === "panel") {
    return (
      <div className="overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-sm">
        <div className="flex flex-col divide-y divide-slate-100 sm:grid sm:grid-cols-3 sm:divide-x sm:divide-y-0">
          <div className="flex items-center justify-between gap-3 px-4 py-3 sm:flex-col sm:justify-center sm:gap-0 sm:px-3 sm:py-4 sm:text-center">
            <p className="text-xs font-semibold text-slate-500 sm:text-[10px] sm:font-bold sm:uppercase sm:tracking-wide sm:text-slate-400">
              Số buổi
            </p>
            <p className="text-base font-black tabular-nums text-slate-900 sm:mt-1.5 sm:text-xl">
              {mentee.totalSessions}
            </p>
          </div>
          <div className="flex items-center justify-between gap-3 px-4 py-3 sm:flex-col sm:justify-center sm:gap-0 sm:px-3 sm:py-4 sm:text-center">
            <p className="text-xs font-semibold text-slate-500 sm:text-[10px] sm:font-bold sm:uppercase sm:tracking-wide sm:text-slate-400">
              Đánh giá
            </p>
            <div className="sm:mt-1.5 sm:flex sm:justify-center">
              <MenteeScoreCell mentee={mentee} />
            </div>
          </div>
          <div className="flex items-center justify-between gap-3 px-4 py-3 sm:flex-col sm:justify-center sm:gap-0 sm:px-3 sm:py-4 sm:text-center">
            <p className="shrink-0 text-xs font-semibold text-slate-500 sm:text-[10px] sm:font-bold sm:uppercase sm:tracking-wide sm:text-slate-400">
              Xu hướng
            </p>
            <div className="sm:mt-1.5 sm:flex sm:justify-center">
              <MenteeTrendBadge trend={mentee.progressTrend} compact />
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-3 gap-2">
      <div className="flex min-h-[52px] min-w-0 flex-col items-center justify-center gap-1 rounded-xl bg-slate-50 px-1.5 py-2 text-center">
        <span className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Buổi</span>
        <span className="text-sm font-black tabular-nums leading-none text-slate-900">{mentee.totalSessions}</span>
      </div>
      <div className="flex min-h-[52px] min-w-0 flex-col items-center justify-center gap-1 rounded-xl bg-slate-50 px-1.5 py-2 text-center">
        <span className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Đánh giá</span>
        <div className="flex min-h-[18px] w-full items-center justify-center">
          <MenteeScoreCell mentee={mentee} compact />
        </div>
      </div>
      <div className="flex min-h-[52px] min-w-0 flex-col items-center justify-center gap-1 rounded-xl bg-slate-50 px-1.5 py-2 text-center">
        <span className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Xu hướng</span>
        <div className="flex min-h-[22px] w-full items-center justify-center">
          <MenteeTrendBadge trend={mentee.progressTrend} compact />
        </div>
      </div>
    </div>
  );
}

function MenteeMobileCard({ mentee, onSelect }) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className="w-full rounded-2xl border border-slate-200/90 bg-white p-4 text-left shadow-[0_2px_12px_rgba(15,23,42,0.05)] transition active:scale-[0.99] hover:border-[#8037f4]/25"
    >
      <div className="flex items-center gap-3">
        <img
          src={avatarSrc(mentee.menteeAvatar)}
          alt=""
          className="h-12 w-12 shrink-0 rounded-2xl object-cover ring-1 ring-slate-100"
          onError={(e) => {
            e.currentTarget.onerror = null;
            e.currentTarget.src = avatarSrc("");
          }}
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate text-[15px] font-bold leading-snug text-slate-900">{mentee.menteeName}</p>
              <p className="mt-0.5 text-xs text-slate-500">
                Cập nhật {new Date(mentee.lastSessionDate).toLocaleDateString("vi-VN")}
              </p>
            </div>
            <CaretRight size={18} className="mt-0.5 shrink-0 text-slate-300" aria-hidden />
          </div>
        </div>
      </div>
      <div className="mt-3.5">
        <MenteeQuickStats mentee={mentee} />
      </div>
    </button>
  );
}

export function MentorAnalytics() {
  const navigate = useNavigate();
  const user = getUser();
  const [selectedMentee, setSelectedMentee] = useState(null);
  const [search, setSearch] = useState("");
  const [analytics, setAnalytics] = useState(null);

  useEffect(() => {
    if (!user || user.role !== "mentor") {
      navigate("/");
      return;
    }
    fetchMentorAnalytics().then((res) => {
      if (res.success && res.analytics) setAnalytics(res.analytics);
      else if (!res.success) toastApiError(res.error, "Không tải được dữ liệu phân tích.");
    }).catch(() => toastApiError("Lỗi kết nối khi tải phân tích."));
  }, [navigate, user?.role, user?.id]);

  const mentees = analytics?.mentees ?? [];
  const filteredMentees = useMemo(
    () => mentees.filter((m) => m.menteeName.toLowerCase().includes(search.toLowerCase())),
    [mentees, search],
  );
  const {
    visibleItems: visibleMentees,
    showExpandButton: showMenteeExpandButton,
    expanded: menteesExpanded,
    toggleExpanded: toggleMenteesExpanded,
  } = useMentorListExpand(filteredMentees, search);

  if (!user || user.role !== "mentor") return null;

  const stats = analytics?.stats || {
    totalSessions: 0,
    totalMentees: 0,
    improvingCount: 0,
    topAvgScore: 0,
    trends: {},
  };
  const trends = stats.trends || {};
  const radarSkills =
    Array.isArray(stats.radarSkills) && stats.radarSkills.length > 0
      ? stats.radarSkills
      : [];
  const overallAvg = stats.overallAvgRating;
  const radarHasValues =
    radarSkills.length > 0 && radarSkills.some((r) => Number(r.value) > 0);
  const formatScoreOfFive = (value) =>
    value != null && Number.isFinite(Number(value)) ? `${Number(value).toFixed(1)} / 5.0` : null;
  const trendOrDash = (key, fallback = "—") => {
    const v = trends[key];
    return v != null && v !== "" ? v : fallback;
  };

  // Prepare chart data
  const weeklyChartData = (analytics?.weeklyStats || []).map((w) => ({
    week: w.week,
    "Điểm TB": parseFloat(w.avgStarScore.toFixed(2)),
    "Số buổi": w.totalMeetings,
  }));

  return (
    <MentorPageShell bottomPad="pb-20" showAmbient={false} className="!bg-[#f8f9fc]">
      <div className="relative z-10 mx-auto max-w-[1280px] px-4 pb-12 sm:px-6 lg:px-10">
        <motion.header
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
          className="mb-6 pt-2 sm:mb-8"
        >
          <h1 className="font-headline text-[clamp(1.75rem,4vw,2.75rem)] font-black leading-tight tracking-tight text-slate-900">
            Phân tích <span className="text-[#8037f4]">&amp; thống kê</span>
          </h1>
          <p className="mt-2 max-w-xl text-sm text-slate-500">
            Theo dõi tiến bộ và hiệu suất của mentee.
          </p>
        </motion.header>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, delay: 0.06, ease: [0.22, 1, 0.36, 1] }}
        >
          <MentorStatMiniGrid>
            <MentorStatFrame
              index={1}
              compact
              accent="purple"
              value={String(stats.totalSessions || 0)}
              title="Buổi mentor"
              cornerIcon={ChartLineIcon}
            />
            <MentorStatFrame
              index={2}
              compact
              accent="lime"
              value={String(stats.totalMentees || 0)}
              title="Tổng mentee"
              cornerIcon={Users}
            />
            <MentorStatFrame
              index={3}
              compact
              accent="purple"
              value={String(stats.improvingCount || 0)}
              title="Đang cải thiện"
              cornerIcon={Target}
            />
            <MentorStatFrame
              index={4}
              compact
              accent="purple"
              value={Number(stats.topAvgScore || 0).toFixed(1)}
              title="Điểm trung bình"
              cornerIcon={Star}
            />
          </MentorStatMiniGrid>
        </motion.div>

        <div className="mb-6 grid gap-6 lg:grid-cols-12">
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.12, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-[0_1px_3px_rgba(15,23,42,0.04)] lg:col-span-7"
          >
            <div className="flex flex-col items-start gap-1 border-b border-slate-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:gap-3 sm:px-6">
              <h2 className="font-headline text-left text-sm font-black text-slate-900">
                <span className="mr-2 text-[#8037f4]">01</span>
                Hiệu suất đào tạo tuần
              </h2>
              <span className="text-xs font-medium text-slate-400">6 tuần gần nhất</span>
            </div>
            <div className="h-[320px] p-4 sm:p-6">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={weeklyChartData}>
                  <defs>
                    <linearGradient id="mentorAnalyticsPurple" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#8037f4" stopOpacity={0.22} />
                      <stop offset="95%" stopColor="#8037f4" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(148,163,184,0.22)" />
                  <XAxis dataKey="week" axisLine={false} tickLine={false} tick={{ fill: "#94a3b8", fontSize: 10, fontWeight: 700 }} dy={10} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: "#94a3b8", fontSize: 10, fontWeight: 700 }} />
                  <Tooltip
                    contentStyle={{
                      background: "#ffffff",
                      border: "1px solid rgba(226,232,240,0.9)",
                      borderRadius: "14px",
                      fontWeight: 700,
                    }}
                    itemStyle={{ color: "#0f172a", fontSize: "12px" }}
                  />
                  <Area type="monotone" dataKey="Số buổi" stroke="#8037f4" strokeWidth={3} fill="url(#mentorAnalyticsPurple)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </motion.section>

          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.16, ease: [0.22, 1, 0.36, 1] }}
            className="flex flex-col overflow-hidden rounded-2xl border border-[#8037f4]/15 bg-[#8037f4]/[0.05] shadow-[0_1px_3px_rgba(15,23,42,0.04)] lg:col-span-5"
          >
            <div className="flex flex-col items-start gap-1 border-b border-[#8037f4]/10 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:gap-3 sm:px-6">
              <h2 className="font-headline text-left text-sm font-black text-slate-900">
                <span className="mr-2 text-[#8037f4]">02</span>
                Kỹ năng tập trung
              </h2>
            </div>
            <div className="flex-1 p-4 sm:p-6" style={{ minHeight: 320 }}>
              {radarHasValues ? (
                <ResponsiveContainer width="100%" height="100%">
                  <RadarChart
                    cx="50%"
                    cy="50%"
                    outerRadius="78%"
                    margin={{ top: 18, right: 28, bottom: 18, left: 28 }}
                    data={radarSkills}
                  >
                    <PolarGrid stroke="rgba(128,55,244,0.18)" />
                    <PolarAngleAxis dataKey="subject" tick={RadarSubjectTick} />
                    <PolarRadiusAxis domain={[0, 5]} tick={false} axisLine={false} />
                    <Radar name="Skills" dataKey="value" stroke="#8037f4" fill="#8037f4" fillOpacity={0.14} strokeWidth={2.5} />
                  </RadarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex h-full items-center justify-center text-sm text-slate-400">Chưa có dữ liệu</div>
              )}
            </div>
            <div className="flex items-center justify-between border-t border-[#8037f4]/10 bg-white/70 px-5 py-3 sm:px-6">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Điểm trung bình</span>
              <span
                className="font-headline text-sm font-black text-[#8037f4]"
                title={
                  stats.radarScoreSource === "interview"
                    ? "Trung bình 5 trục STAR từ phỏng vấn AI"
                    : stats.radarScoreSource === "review"
                      ? "Trung bình đánh giá sao của học viên"
                      : undefined
                }
              >
                {formatScoreOfFive(overallAvg) ?? "Chưa có"}
              </span>
            </div>
          </motion.section>
        </div>

        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
          className="overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-[0_1px_3px_rgba(15,23,42,0.04)]"
        >
          <div className="flex flex-col items-start gap-4 border-b border-slate-100 px-4 py-5 sm:flex-row sm:items-end sm:justify-between sm:px-6">
            <h2 className="font-headline text-left text-lg font-black tracking-tight text-slate-900">
              <span className="mr-2 text-[#8037f4]">03</span>
              Chi tiết mentee
            </h2>
            <div className="relative w-full sm:max-w-xs">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden />
              <input
                type="search"
                placeholder="Tìm học viên…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full min-h-[44px] rounded-xl border border-slate-200 bg-slate-50/80 py-2.5 pl-10 pr-4 text-base font-medium text-slate-900 outline-none placeholder:font-medium placeholder:text-slate-400 focus:border-[#8037f4]/40 focus:bg-white focus:ring-2 focus:ring-[#8037f4]/15 sm:text-sm"
                aria-label="Tìm học viên"
              />
            </div>
          </div>

          <div className="space-y-3 p-4 lg:hidden">
            {visibleMentees.map((mentee) => (
              <MenteeMobileCard
                key={mentee.menteeId}
                mentee={mentee}
                onSelect={() => setSelectedMentee(mentee)}
              />
            ))}
            {!filteredMentees.length && (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/80 px-4 py-12 text-center text-sm text-slate-500">
                Không tìm thấy mentee phù hợp.
              </div>
            )}
          </div>

          <div className="hidden overflow-x-auto lg:block">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/70 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  <th className="px-4 py-3 sm:px-6">Học viên</th>
                  <th className="px-4 py-3 sm:px-6">Số buổi</th>
                  <th className="px-4 py-3 sm:px-6" title="Đánh giá sao hoặc điểm phỏng vấn AI">Đánh giá</th>
                  <th className="px-4 py-3 sm:px-6">Xu hướng</th>
                  <th className="px-4 py-3 text-right sm:px-6">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {visibleMentees.map((mentee) => (
                  <tr key={mentee.menteeId} className="transition-colors hover:bg-slate-50/60">
                    <td className="px-4 py-4 sm:px-6">
                      <div className="flex items-center gap-3">
                        <img
                          src={avatarSrc(mentee.menteeAvatar)}
                          alt=""
                          className="h-10 w-10 rounded-xl object-cover"
                          onError={(e) => { e.currentTarget.onerror = null; e.currentTarget.src = avatarSrc(""); }}
                        />
                        <div>
                          <p className="text-sm font-bold text-slate-900">{mentee.menteeName}</p>
                          <p className="text-xs text-slate-500">Cập nhật: {new Date(mentee.lastSessionDate).toLocaleDateString("vi-VN")}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-4 sm:px-6">
                      <span className="text-sm font-bold text-slate-900">{mentee.totalSessions}</span>
                      <span className="ml-1 text-xs text-slate-400">buổi</span>
                    </td>
                    <td className="px-4 py-4 sm:px-6">
                      <MenteeScoreCell mentee={mentee} />
                    </td>
                    <td className="px-4 py-4 sm:px-6">
                      <MenteeTrendBadge trend={mentee.progressTrend} />
                    </td>
                    <td className="px-4 py-4 text-right sm:px-6">
                      <button
                        type="button"
                        onClick={() => setSelectedMentee(mentee)}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-900 transition hover:border-[#8037f4]/30 hover:text-[#8037f4]"
                      >
                        Chi tiết <CaretRight size={13} />
                      </button>
                    </td>
                  </tr>
                ))}
                {!filteredMentees.length && (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-sm text-slate-500">
                      Không tìm thấy mentee phù hợp.
                    </td>
                  </tr>
                )}
              </tbody>
              </table>
            </div>

            {showMenteeExpandButton ? (
              <MentorListExpandButton
                expanded={menteesExpanded}
                onToggle={toggleMenteesExpanded}
              />
            ) : null}
        </motion.section>
      </div>

      {/* ── Mentee detail modal (portal — tránh kẹt dưới navbar fixed z-[100]) ── */}
      {createPortal(
        <AnimatePresence>
          {selectedMentee && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[200] flex items-start justify-center overflow-y-auto bg-slate-900/50 p-4 py-6 backdrop-blur-sm sm:items-center sm:p-6"
              onClick={() => setSelectedMentee(null)}
            >
              <motion.div
                initial={{ scale: 0.96, y: 16, opacity: 0 }}
                animate={{ scale: 1, y: 0, opacity: 1 }}
                exit={{ scale: 0.96, y: 16, opacity: 0 }}
                className="my-auto flex w-full max-w-4xl max-h-[min(92svh,720px)] shrink-0 flex-col overflow-hidden rounded-2xl border border-[#8037f4]/15 bg-white shadow-[0_24px_64px_rgba(128,55,244,0.12)] sm:my-6"
                onClick={(e) => e.stopPropagation()}
              >
              {/* Modal header — gradient */}
              <div className="relative shrink-0 overflow-hidden bg-gradient-to-r from-[#630ed4] to-[#8037f4] px-4 py-4 text-white sm:px-6 sm:py-5">
                <div className="pointer-events-none absolute -right-8 -top-8 h-28 w-28 rounded-full bg-white/10" aria-hidden />
                <div className="relative flex items-start justify-between gap-3 sm:items-center sm:gap-4">
                  <div className="flex min-w-0 items-center gap-3 sm:gap-4">
                    <img
                      src={avatarSrc(selectedMentee.menteeAvatar)}
                      alt=""
                      className="h-12 w-12 shrink-0 rounded-2xl object-cover ring-2 ring-white/30 sm:h-14 sm:w-14"
                      onError={(e) => { e.currentTarget.onerror = null; e.currentTarget.src = avatarSrc(""); }}
                    />
                    <div className="min-w-0">
                      <p className="truncate text-base font-black tracking-tight text-white sm:text-xl">
                        {selectedMentee.menteeName}
                      </p>
                      <p className="mt-0.5 text-xs font-semibold text-violet-100 sm:text-sm">
                        Chi tiết tiến độ học viên
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedMentee(null)}
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/20 bg-white/10 text-white transition hover:bg-white/20"
                    aria-label="Đóng"
                  >
                    <X size={18} />
                  </button>
                </div>
              </div>

              {/* Quick stats */}
              <div className="shrink-0 border-b border-slate-100 bg-white px-4 py-3 sm:px-6 sm:py-4">
                <MenteeQuickStats mentee={selectedMentee} variant="panel" />
              </div>

              {/* Modal body */}
              <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">
                <div className="grid gap-4 md:grid-cols-2 md:gap-5">
                  {/* STAR chart */}
                  <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-[0_8px_24px_rgba(15,23,42,0.06)]">
                    <div className="border-b border-slate-100 px-4 py-3">
                      <p className="mentor-label flex items-center gap-2 text-left">
                        <ChartLineIcon size={12} className="text-violet-600" />
                        Tiến trình STAR · 4 tuần
                      </p>
                    </div>
                    <div className="flex min-h-[200px] flex-col justify-center p-4 sm:h-56">
                      {(() => {
                        const starChartRows = (selectedMentee.starHistory || []).filter((row) =>
                          [row.situation, row.task, row.action, row.result].some((v) => v != null && Number.isFinite(Number(v))),
                        );
                        if (!selectedMentee.hasBehaviorData || starChartRows.length === 0) {
                          return (
                            <div className="flex h-full flex-col items-start justify-center rounded-xl border-2 border-dashed border-violet-200/80 bg-violet-50/40 px-4 py-5 text-left sm:items-center sm:text-center">
                              <ChartLineIcon size={28} className="mb-3 text-violet-400" />
                              <p className="text-sm font-bold text-slate-700">
                                {selectedMentee.hasInterviewSessions ? "Chưa đủ điểm STAR để vẽ biểu đồ" : "Chưa có dữ liệu"}
                              </p>
                              <p className="mt-1 text-xs font-semibold leading-relaxed text-slate-500">
                                Cần thêm buổi phỏng vấn AI hoặc đánh giá sau mentor
                              </p>
                            </div>
                          );
                        }
                        return (
                          <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={starChartRows}>
                              <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.2)" />
                              <XAxis dataKey="date" tick={{ fill: "#64748b", fontSize: 10, fontWeight: 600 }} />
                              <YAxis domain={[0, 5]} tick={{ fill: "#64748b", fontSize: 10, fontWeight: 600 }} width={24} />
                              <Tooltip contentStyle={{ background: "#fff", borderRadius: "12px", border: "1px solid #e2e8f0", fontWeight: 600 }} />
                              <Legend wrapperStyle={{ fontSize: 11, fontWeight: 700 }} />
                              <Line type="monotone" dataKey="situation" name="Tình huống" stroke="#8037f4" strokeWidth={2.5} dot={{ r: 3 }} connectNulls />
                              <Line type="monotone" dataKey="task" name="Nhiệm vụ" stroke="#93f72b" strokeWidth={2.5} dot={{ r: 3 }} connectNulls />
                              <Line type="monotone" dataKey="action" name="Hành động" stroke="#f59e0b" strokeWidth={2.5} dot={{ r: 3 }} connectNulls />
                              <Line type="monotone" dataKey="result" name="Kết quả" stroke="#FF8C42" strokeWidth={2.5} dot={{ r: 3 }} connectNulls />
                            </LineChart>
                          </ResponsiveContainer>
                        );
                      })()}
                    </div>
                  </div>

                  {/* Strengths & weaknesses */}
                  <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-[0_8px_24px_rgba(15,23,42,0.06)]">
                    <div className="border-b border-slate-100 px-4 py-3">
                      <p className="mentor-label flex items-center gap-2 text-left">
                        <Star size={12} className="text-violet-600" />
                        Ưu điểm &amp; hạn chế
                      </p>
                    </div>
                    <div className="space-y-3 p-4">
                      <div className="rounded-xl border border-violet-200/80 bg-gradient-to-br from-violet-50 to-white p-4">
                        <p className="mb-3 flex items-center gap-2 text-sm font-black text-violet-700">
                          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#8037f4]/15">
                            <Lightning size={14} className="text-violet-600" />
                          </span>
                          Điểm mạnh
                        </p>
                        <ul className="space-y-2">
                          {(selectedMentee.strengths?.length ? selectedMentee.strengths : ["Chưa có dữ liệu"]).map((s, i) => (
                            <li key={i} className="flex gap-2 text-sm font-semibold text-slate-700">
                              <span className="text-[#93f72b]">•</span> {s}
                            </li>
                          ))}
                        </ul>
                      </div>
                      <div className="rounded-xl border border-orange-200/80 bg-gradient-to-br from-orange-50 to-white p-4">
                        <p className="mb-3 flex items-center gap-2 text-sm font-black text-orange-700">
                          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-orange-100">
                            <Target size={14} className="text-orange-600" />
                          </span>
                          Cần lưu ý
                        </p>
                        <ul className="space-y-2">
                          {(selectedMentee.weaknesses?.length ? selectedMentee.weaknesses : ["Chưa có dữ liệu"]).map((w, i) => (
                            <li key={i} className="flex gap-2 text-sm font-semibold text-slate-700">
                              <span className="text-orange-400">•</span> {w}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Modal footer */}
              <div className="flex shrink-0 border-t border-slate-100 bg-slate-50/50 px-4 py-4 sm:justify-end sm:px-6">
                <button
                  type="button"
                  onClick={() => setSelectedMentee(null)}
                  className="min-h-[44px] w-full rounded-xl bg-[#93f72b] px-8 py-2.5 text-sm font-bold text-slate-900 shadow-[0_8px_24px_rgba(147,247,43,0.35)] transition hover:brightness-105 active:scale-[0.98] sm:w-auto"
                >
                  Đóng
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>,
        document.body,
      )}
    </MentorPageShell>
  );
}