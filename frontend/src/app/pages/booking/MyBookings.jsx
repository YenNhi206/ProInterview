import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { motion, AnimatePresence, useInView, animate, useMotionValue, useTransform } from "motion/react";
import {
  Calendar,
  Video,
  Star,
  FileText,
  Clock,
  CheckCircle2,
  AlertCircle,
  CalendarClock,
  CalendarCheck,
  CalendarX,
  XCircle,
  Sparkles,
} from "lucide-react";
import { MentorPageShell } from "../../components/mentor/MentorPageShell";
import { CUSTOMER_SHELL_GUTTER, CUSTOMER_SHELL_MAX } from "../../components/layout/customerShellLayout";
import { listBookings } from "../../api/bookingsApi.js";
import { apiBookingToLocal } from "../../utils/booking/bookingMappers.js";
import { parseDateMs } from "../../utils/booking/bookings.js";
import { isLoggedIn } from "../../utils/auth/auth.js";
import { toastApiError } from "../../utils/shared/apiToast.js";

/* ─── Animated counter ──────────────────────────────────────── */
function CountUp({ to, suffix = "", duration = 1.1 }) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true });
  const count = useMotionValue(0);
  const rounded = useTransform(count, (v) => Math.round(v));
  const display = useTransform(rounded, (v) => `${v}${suffix}`);

  useEffect(() => {
    if (!inView) return;
    const ctrl = animate(count, to, { duration, ease: "easeOut" });
    return ctrl.stop;
  }, [inView, to, duration, count]);

  return <motion.span ref={ref}>{display}</motion.span>;
}

/* ─── Time helpers ──────────────────────────────────────────── */
function elapsedMs(dateStr, timeStr) {
  try { return Date.now() - parseDateMs(dateStr, timeStr); } catch { return 0; }
}

function getTimeLabel(dateStr, timeStr) {
  const elapsed = elapsedMs(dateStr, timeStr);
  if (elapsed < 0) {
    const diffMs = -elapsed;
    const totalMin = Math.floor(diffMs / 60000);
    const h = Math.floor(totalMin / 60);
    const min = totalMin % 60;
    if (h <= 0) return { text: `Còn ${min} phút`, color: "text-violet-500", hot: true };
    if (h < 2) return { text: `Còn ${h}g ${min}p`, color: "text-violet-500", hot: true };
    if (h < 24) return { text: `Còn ${h} giờ`, color: "text-slate-500", hot: false };
    return { text: `Còn ${Math.floor(h / 24)} ngày`, color: "text-slate-400", hot: false };
  }
  if (elapsed <= 30 * 60000) return { text: "Đang diễn ra", color: "text-emerald-600", hot: true };
  return { text: "Đã qua giờ", color: "text-orange-500", hot: false };
}

function getElapsedLabel(dateStr, timeStr) {
  const elapsed = elapsedMs(dateStr, timeStr);
  if (elapsed < 0) return "";
  const h = Math.floor(elapsed / 3600000);
  if (h < 1) return "vừa xong";
  if (h < 24) return `${h} giờ trước`;
  const d = Math.floor(h / 24);
  return d < 30 ? `${d} ngày trước` : "";
}

function getPaymentBadge(paymentStatus, status, dateStr, timeStr) {
  const pst = String(paymentStatus || "").toLowerCase();
  const st  = String(status || "").toLowerCase();
  if (pst === "refund_pending")
    return { text: "Chờ hoàn CK",    cls: "bg-amber-50 text-amber-700 border-amber-200" };
  if (pst === "refunded")
    return { text: "Đã hoàn tiền",   cls: "bg-sky-50 text-sky-700 border-sky-200" };
  if (st === "confirmed" || st === "in_progress" || pst === "paid")
    return { text: "Đã thanh toán",  cls: "bg-emerald-50 text-emerald-700 border-emerald-200" };
  if (st === "done" || st === "completed")
    return { text: "Hoàn thành",     cls: "bg-violet-50 text-violet-700 border-violet-200" };
  if (st === "pending" && elapsedMs(dateStr, timeStr) > 0)
    return { text: "Hết hạn TT",     cls: "bg-slate-100 text-slate-400 border-slate-200" };
  return   { text: "Chờ thanh toán", cls: "bg-amber-50 text-amber-700 border-amber-200" };
}

function classifyBooking(row) {
  const st = String(row.status || "").toLowerCase();
  if (st === "cancelled" || st === "rescheduled") return "cancelled";
  if (st === "done" || st === "completed" || st === "no_show") return "past";
  if (st === "confirmed" || st === "in_progress")
    return elapsedMs(row.date, row.time) > 2 * 3600000 ? "past" : "upcoming";
  if (st === "pending")
    return elapsedMs(row.date, row.time) > 3600000 ? "past" : "upcoming";
  return "past";
}

function mentorSubtitle(s) {
  const title   = (s.mentorTitle   || "").trim();
  const company = (s.mentorCompany || "").trim();
  if (title && title.toLowerCase() !== "mentor")
    return company && company !== "—" ? `${title} · ${company}` : title;
  if (company && company !== "—") return company;
  return "";
}

/* ─── Stat card ─────────────────────────────────────────────── */
const STATS_META = [
  { id: "total",     label: "Tổng lịch hẹn",   icon: CalendarClock,  ring: "ring-violet-50", from: "from-violet-50",  iconCls: "text-[#8037f4]",  bg: "bg-violet-100/70"  },
  { id: "upcoming",  label: "Sắp tới",          icon: CalendarCheck,  ring: "ring-sky-50",    from: "from-sky-50",     iconCls: "text-sky-600",    bg: "bg-sky-100/70"     },
  { id: "past",      label: "Đã hoàn thành",    icon: CheckCircle2,   ring: "ring-emerald-50",from: "from-emerald-50", iconCls: "text-emerald-600",bg: "bg-emerald-100/70" },
  { id: "cancelled", label: "Đã hủy",           icon: CalendarX,      ring: "ring-rose-50",   from: "from-rose-50",    iconCls: "text-rose-500",   bg: "bg-rose-100/70"    },
];

function StatCard({ meta, value, index }) {
  const Icon = meta.icon;
  return (
    <motion.div
      className="group relative overflow-hidden rounded-[2rem] border border-white/80 bg-white/60 p-6 backdrop-blur-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)]"
      initial={{ opacity: 0, y: 28, scale: 0.95 }}
      whileInView={{ opacity: 1, y: 0, scale: 1 }}
      viewport={{ once: true }}
      transition={{ duration: 0.4, delay: index * 0.08, ease: [0.16, 1, 0.3, 1] }}
    >
      <div className={`absolute -right-8 -top-8 h-32 w-32 rounded-full opacity-20 blur-3xl transition-transform duration-500 group-hover:scale-150 ${meta.bg}`} />
      <div className="relative z-10 flex items-center gap-5">
        <motion.div
          className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl ${meta.bg} ring-4 ${meta.ring} shadow-sm`}
          initial={{ scale: 0, rotate: -20 }}
          whileInView={{ scale: 1, rotate: 0 }}
          viewport={{ once: true }}
          transition={{ type: "spring", stiffness: 350, damping: 18, delay: index * 0.08 + 0.15 }}
        >
          <Icon className={`h-7 w-7 ${meta.iconCls}`} strokeWidth={2} />
        </motion.div>
        <div>
          <p className="text-[11px] font-black uppercase tracking-widest text-slate-400">{meta.label}</p>
          <p className={`mt-1 text-3xl font-black tabular-nums leading-none tracking-tight ${meta.iconCls}`}>
            <CountUp to={value} />
          </p>
        </div>
      </div>
    </motion.div>
  );
}

/* ─── Skeleton card ─────────────────────────────────────────── */
function SkeletonCard({ delay = 0 }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
      className="animate-pulse rounded-[28px] border border-slate-100 bg-white p-5 shadow-sm"
    >
      <div className="flex gap-4">
        <div className="h-16 w-16 shrink-0 rounded-2xl bg-slate-100" />
        <div className="flex-1 space-y-3 pt-1">
          <div className="h-2.5 w-2/3 rounded bg-slate-100" />
          <div className="h-5 w-1/2 rounded bg-slate-100" />
          <div className="h-2.5 w-1/3 rounded bg-slate-100" />
        </div>
      </div>
      <div className="mt-5 flex gap-2 border-t border-slate-100 pt-4">
        <div className="h-9 w-24 rounded-xl bg-slate-100" />
        <div className="h-9 flex-1 rounded-xl bg-slate-100" />
      </div>
    </motion.div>
  );
}

/* ─── Booking card ──────────────────────────────────────────── */
function BookingCard({ s, tab, index }) {
  const navigate = useNavigate();
  const id          = s.sessionId || s.backendId;
  const badge       = getPaymentBadge(s.paymentStatus, s.status, s.date, s.time);
  const paid        = String(s.paymentStatus || "").toLowerCase() === "paid";
  const st          = String(s.status || "").toLowerCase();
  const isUpcoming  = tab === "upcoming";
  const canMeet     = paid && (st === "confirmed" || st === "in_progress");
  const needsReview = (st === "done" || st === "completed") && !s.isReviewed;
  const reviewed    = (st === "done" || st === "completed") && s.isReviewed;
  const subtitle    = mentorSubtitle(s);
  const timeInfo    = isUpcoming ? getTimeLabel(s.date, s.time) : null;
  const elapsed     = !isUpcoming ? getElapsedLabel(s.date, s.time) : "";

  const avatarFallback = `https://ui-avatars.com/api/?name=${encodeURIComponent(s.mentorName || "M")}&background=ede9fe&color=6d28d9`;

  return (
    <motion.article
      onClick={() => navigate(`/session/${id}`)}
      initial={{ opacity: 0, y: 32 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.1 }}
      transition={{ duration: 0.45, delay: (index % 4) * 0.08, ease: [0.16, 1, 0.3, 1] }}
      whileHover={{
        y: -8,
        boxShadow: "0 24px 48px rgba(128,55,244,0.12)",
        borderColor: "rgba(237,233,254,1)",
        backgroundColor: "rgba(255,255,255,0.95)",
        transition: { type: "spring", stiffness: 340, damping: 28 },
      }}
      className="group flex cursor-pointer flex-col overflow-hidden rounded-[2rem] border border-white/80 bg-white/60 backdrop-blur-2xl shadow-[0_8px_30px_rgb(0,0,0,0.04)]"
    >
      {/* Top accent bar — color by status */}
      <div
        className={`h-1 w-full ${
          st === "done" || st === "completed"
            ? "bg-gradient-to-r from-emerald-400 to-emerald-600"
            : st === "cancelled" || st === "rescheduled"
            ? "bg-gradient-to-r from-slate-300 to-slate-400"
            : timeInfo?.hot
            ? "bg-gradient-to-r from-violet-500 to-[#8037f4]"
            : "bg-gradient-to-r from-violet-300 to-violet-400"
        }`}
      />

      <div className="flex flex-col flex-1 p-5">
        {/* Header row */}
        <div className="flex items-start gap-4">
          {/* Avatar */}
          <div className="relative shrink-0">
            <div className="h-16 w-16 overflow-hidden rounded-2xl border-2 border-violet-50 shadow-sm">
              <img
                src={s.mentorAvatar || avatarFallback}
                alt=""
                onError={(e) => { e.currentTarget.src = avatarFallback; }}
                className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
              />
            </div>
            {timeInfo?.hot && (
              <span className="absolute -bottom-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full border-2 border-white bg-emerald-500 shadow-sm">
                <span className="absolute inline-flex h-4 w-4 animate-ping rounded-full bg-emerald-400 opacity-60" />
              </span>
            )}
          </div>

          {/* Info */}
          <div className="min-w-0 flex-1">
            {/* Date + badge */}
            <div className="mb-1.5 flex flex-wrap items-center justify-between gap-1.5">
              <p className="text-[10px] font-black uppercase tracking-wider text-[#8037f4]">
                {s.date} · {s.time}{s.endTime ? ` – ${s.endTime}` : ""}
              </p>
              <motion.span
                initial={{ scale: 0.7, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: (index % 4) * 0.08 + 0.18, type: "spring", stiffness: 400, damping: 20 }}
                className={`rounded-lg border px-2 py-0.5 text-[8px] font-black uppercase tracking-wide ${badge.cls}`}
              >
                {badge.text}
              </motion.span>
            </div>

            {/* Time countdown — pill badge */}
            {timeInfo && (
              <motion.span
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: "spring", stiffness: 400, damping: 20, delay: 0.15 }}
                className={`mb-2 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-black ${
                  timeInfo.text === "Đang diễn ra"
                    ? "bg-emerald-100 text-emerald-700 ring-1 ring-emerald-300"
                    : timeInfo.text === "Đã qua giờ"
                    ? "bg-orange-100 text-orange-700 ring-1 ring-orange-300"
                    : timeInfo.hot
                    ? "bg-violet-100 text-[#8037f4] ring-1 ring-violet-300"
                    : "bg-slate-100 text-slate-500"
                }`}
              >
                <Clock className="h-3 w-3 shrink-0" />
                {timeInfo.text}
                {timeInfo.hot && timeInfo.text !== "Đang diễn ra" && (
                  <span className="ml-0.5 inline-flex h-1.5 w-1.5 animate-ping rounded-full bg-[#8037f4]" />
                )}
              </motion.span>
            )}
            {elapsed && !timeInfo && (
              <p className="mb-1.5 text-[10px] font-medium text-slate-400">{elapsed}</p>
            )}

            {/* Mentor name */}
            <h2 className="line-clamp-1 text-base font-black text-slate-900 transition-colors duration-200 group-hover:text-[#8037f4] sm:text-lg">
              {s.mentorName}
            </h2>

            {/* Mentor title */}
            {subtitle && (
              <p className="mt-0.5 line-clamp-1 text-xs font-medium text-slate-500">{subtitle}</p>
            )}
          </div>
        </div>

        {/* Divider */}
        <div className="my-4 border-t border-dashed border-violet-100" />

        {/* Booking code + actions */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
            # {s.orderNum}
          </p>

          <div className="flex flex-wrap gap-2">
            <motion.button
              type="button"
              onClick={(e) => { e.stopPropagation(); navigate(`/session/${id}`); }}
              whileHover={{ scale: 1.04, backgroundColor: "#f5f3ff" }}
              whileTap={{ scale: 0.94 }}
              transition={{ type: "spring", stiffness: 380, damping: 24 }}
              className="inline-flex items-center gap-1.5 rounded-xl border border-violet-200 bg-white px-3.5 py-2 text-[10px] font-black uppercase tracking-widest text-violet-700"
            >
              <FileText className="h-3.5 w-3.5" />
              Chi tiết
            </motion.button>

            {canMeet && isUpcoming && (
              <motion.button
                type="button"
                onClick={(e) => { e.stopPropagation(); navigate(`/meeting/${id}`); }}
                whileHover={{ scale: 1.05, opacity: 0.9 }}
                whileTap={{ scale: 0.93 }}
                transition={{ type: "spring", stiffness: 380, damping: 24 }}
                className="inline-flex items-center gap-1.5 rounded-xl bg-[#a3e635] px-3.5 py-2 text-[10px] font-black uppercase tracking-widest text-slate-900 shadow-[0_4px_14px_rgba(163,230,53,0.35)]"
              >
                <Video className="h-3.5 w-3.5" />
                Vào phòng
              </motion.button>
            )}

            {needsReview && (
              <motion.button
                type="button"
                onClick={(e) => { e.stopPropagation(); navigate(`/review/${id}`); }}
                initial={{ scale: 0.85, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: (index % 4) * 0.08 + 0.3, type: "spring", stiffness: 360, damping: 20 }}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.93 }}
                className="inline-flex items-center gap-1.5 rounded-xl bg-[#bff365] px-3.5 py-2 text-[10px] font-black uppercase tracking-widest text-slate-900 shadow-sm"
              >
                <Star className="h-3.5 w-3.5 fill-slate-800" />
                Đánh giá
              </motion.button>
            )}

            {reviewed && (
              <span className="inline-flex items-center gap-1.5 rounded-xl bg-violet-50 px-3.5 py-2 text-[10px] font-bold uppercase tracking-widest text-violet-600">
                <CheckCircle2 className="h-3.5 w-3.5" />
                Đã đánh giá
              </span>
            )}
          </div>
        </div>
      </div>
    </motion.article>
  );
}

/* ─── Tabs ──────────────────────────────────────────────────── */
const TABS = [
  { id: "upcoming",  label: "Sắp tới" },
  { id: "past",      label: "Đã qua" },
  { id: "cancelled", label: "Đã hủy" },
];

/* ─── Main page ─────────────────────────────────────────────── */
export function MyBookings() {
  const navigate = useNavigate();
  const [tab, setTab]       = useState("upcoming");
  const [rows, setRows]     = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]   = useState("");

  const load = useCallback(async () => {
    if (!isLoggedIn()) {
      setRows([]);
      setLoading(false);
      setError("Vui lòng đăng nhập để xem lịch hẹn.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const res = await listBookings();
      if (!res.success) {
        const msg = res.error || "Không tải được danh sách lịch hẹn.";
        setError(msg);
        toastApiError(msg);
        setRows([]);
        return;
      }
      const mapped = (res.bookings || []).map(apiBookingToLocal).filter(Boolean);
      mapped.sort((a, b) => parseDateMs(b.date, b.time) - parseDateMs(a.date, a.time));
      setRows(mapped);
    } catch {
      const msg = "Lỗi kết nối khi tải lịch hẹn.";
      setError(msg);
      toastApiError(msg);
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const counts = useMemo(() => {
    const c = { upcoming: 0, past: 0, cancelled: 0 };
    for (const r of rows) {
      const k = classifyBooking(r);
      if (c[k] != null) c[k]++;
    }
    return c;
  }, [rows]);

  const filtered = useMemo(() => {
    const list = rows.filter((r) => classifyBooking(r) === tab);
    if (tab === "upcoming")
      return [...list].sort((a, b) => parseDateMs(a.date, a.time) - parseDateMs(b.date, b.time));
    return list;
  }, [rows, tab]);

  return (
    <div className="flex h-full min-h-screen flex-col">
      <MentorPageShell>
        <div className={`${CUSTOMER_SHELL_GUTTER} pb-24 pt-12 relative`}>
          {/* Premium Top Glow */}
          <div className="absolute left-1/2 top-0 -z-10 h-[300px] w-full max-w-4xl -translate-x-1/2 rounded-full bg-violet-300/20 blur-[100px] pointer-events-none" />
          
          <div className={`${CUSTOMER_SHELL_MAX} w-full`}>
          {/* ── Header ── */}
          <div className="mb-10 flex flex-col gap-4">
            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.55, delay: 0.08, ease: [0.16, 1, 0.3, 1] }}
              className="py-2 leading-relaxed text-4xl font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-violet-700 to-indigo-600 sm:text-5xl"
            >
              Buổi Mentor 1:1 của bạn
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45, delay: 0.18 }}
              className="mt-1 max-w-xl text-sm font-medium text-slate-500"
            >
              Theo dõi lịch hẹn, trạng thái thanh toán và phiên học sắp tới.
            </motion.p>
          </div>

          {/* ── Stats cards ── */}
          <div className="mb-12 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 lg:gap-6">
            {STATS_META.map((meta, i) => (
              <StatCard key={meta.id} meta={meta} value={counts[meta.id] ?? (meta.id === "total" ? rows.length : 0)} index={i} />
            ))}
          </div>

          {/* ── Content ──────────────────────────────────────────── */}
          <div className="space-y-5">

          {/* Tab bar */}
          <div
            className="flex gap-1.5 rounded-2xl bg-white/60 p-2 shadow-sm ring-1 ring-slate-200/50 backdrop-blur-xl sm:w-fit"
            role="tablist"
          >
            {TABS.map((t) => {
              const isActive = tab === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  onClick={() => setTab(t.id)}
                  className="relative flex-1 min-w-[80px] rounded-xl px-3 py-2.5 text-xs font-black uppercase tracking-wider"
                >
                  {isActive && (
                    <motion.span
                      layoutId="tab-pill-bookings"
                      className="absolute inset-0 rounded-xl bg-[#8037f4] shadow-md"
                      transition={{ type: "spring", stiffness: 380, damping: 30 }}
                    />
                  )}
                  <span className={`relative z-10 ${isActive ? "text-white" : "text-slate-500"}`}>
                    {t.label}
                    <span className="ml-1.5 opacity-70">({counts[t.id] ?? 0})</span>
                  </span>
                </button>
              );
            })}
          </div>

          {/* Error */}
          {error && !loading && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-center gap-3 rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-800"
            >
              <AlertCircle className="h-4 w-4 shrink-0" />
              {error}
            </motion.div>
          )}

          {/* Skeleton */}
          {loading && (
            <div className="grid grid-cols-1 gap-4 min-[900px]:grid-cols-2">
              {[0, 1, 2, 3].map((i) => <SkeletonCard key={i} delay={i * 0.07} />)}
            </div>
          )}

          {/* Card grid with tab transition */}
          <AnimatePresence mode="wait">
            {!loading && !error && filtered.length === 0 && (
              <motion.div
                key={`empty-${tab}`}
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.96 }}
                transition={{ duration: 0.22 }}
                className="rounded-3xl border-2 border-dashed border-violet-100 bg-violet-50/30 py-20 text-center"
              >
                <motion.div
                  animate={{ y: [0, -8, 0] }}
                  transition={{ repeat: Infinity, duration: 2.8, ease: "easeInOut" }}
                  className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-violet-100"
                >
                  <Calendar className="h-8 w-8 text-[#8037f4]" />
                </motion.div>
                <p className="text-sm font-black text-slate-700">Chưa có lịch hẹn nào</p>
                <p className="mt-1 text-xs text-slate-400">
                  {tab === "upcoming" ? "Hãy đặt lịch với mentor để bắt đầu." : "Lịch sử sẽ hiển thị tại đây."}
                </p>
                {tab === "upcoming" && (
                  <motion.button
                    type="button"
                    onClick={() => navigate("/mentors")}
                    whileHover={{ scale: 1.04 }}
                    whileTap={{ scale: 0.95 }}
                    className="mt-6 inline-flex items-center gap-2 rounded-xl bg-[#a3e635] px-6 py-3 text-xs font-black uppercase tracking-widest text-slate-900 shadow-[0_4px_14px_rgba(163,230,53,0.3)]"
                  >
                    <Sparkles className="h-3.5 w-3.5" />
                    Tìm mentor ngay
                  </motion.button>
                )}
              </motion.div>
            )}

            {!loading && !error && filtered.length > 0 && (
              <motion.div
                key={tab}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="grid grid-cols-1 gap-4 min-[900px]:grid-cols-2"
              >
                {filtered.map((s, index) => (
                  <BookingCard key={s.sessionId || s.backendId} s={s} tab={tab} index={index} />
                ))}
              </motion.div>
            )}
          </AnimatePresence>

          </div>
        </div>
      </div>
      </MentorPageShell>
    </div>
  );
}
