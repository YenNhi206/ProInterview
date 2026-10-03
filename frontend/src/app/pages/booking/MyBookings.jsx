import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router";
import { AccountReveal } from "../../components/account/AccountMotion";
import { AlertCircle, ArrowUpRight, Calendar, CheckCircle2, Clock, RefreshCw, Star, Video, Trophy, Sparkles, CreditCard } from "lucide-react";
import { motion } from "motion/react";
import { CUSTOMER_SHELL_GUTTER, CUSTOMER_SHELL_MAX } from "../../components/layout/customerShellLayout";
import { listBookings } from "../../api/bookingsApi.js";
import { apiBookingToLocal } from "../../utils/booking/bookingMappers.js";
import { parseDateMs } from "../../utils/booking/bookings.js";
import { isLoggedIn } from "../../utils/auth/auth.js";
import { toastApiError } from "../../utils/shared/apiToast.js";
import "../../../styles/bookings.css";

function AnimatedNumber({ value, duration = 1 }) {
  const [displayValue, setDisplayValue] = useState(0);
  const prevValueRef = React.useRef(0);

  useEffect(() => {
    const start = prevValueRef.current;
    const end = Math.round(Number(value) || 0);
    prevValueRef.current = end;

    if (start === end) {
      setDisplayValue(end);
      return;
    }

    const startTime = performance.now();
    const durationMs = Math.max(300, duration * 1000);

    let frameId;
    const update = (now) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / durationMs, 1);
      const ease = 1 - Math.pow(1 - progress, 3);
      const current = Math.round(start + (end - start) * ease);
      setDisplayValue(current);

      if (progress < 1) {
        frameId = requestAnimationFrame(update);
      } else {
        setDisplayValue(end);
      }
    };

    frameId = requestAnimationFrame(update);
    return () => cancelAnimationFrame(frameId);
  }, [value, duration]);

  return <>{displayValue}</>;
}

function elapsedMs(dateStr, timeStr) {
  try { return Date.now() - parseDateMs(dateStr, timeStr); } catch { return 0; }
}

function getTimeLabel(dateStr, timeStr) {
  const elapsed = elapsedMs(dateStr, timeStr);
  if (elapsed < 0) {
    const minutes = Math.ceil(-elapsed / 60000);
    if (minutes < 60) return `Còn ${minutes} phút`;
    if (minutes < 1440) return `Còn ${Math.floor(minutes / 60)} giờ`;
    return `Còn ${Math.floor(minutes / 1440)} ngày`;
  }
  return elapsed <= 30 * 60000 ? "Đang diễn ra" : "Đã qua giờ";
}

function getBookingBadge(s) {
  const payment = String(s.paymentStatus || "").toLowerCase();
  const status = String(s.status || "").toLowerCase();
  if (payment === "refund_pending") return { text: "Chờ hoàn tiền", tone: "amber" };
  if (payment === "refunded") return { text: "Đã hoàn tiền", tone: "muted" };
  if (status === "cancelled") return { text: "Đã hủy", tone: "rose" };
  if (status === "rescheduled") return { text: "Đã đổi lịch", tone: "muted" };
  if (status === "no_show") return { text: "Vắng mặt", tone: "rose" };
  if (status === "done" || status === "completed") return { text: "Hoàn thành", tone: "emerald" };
  if (status === "confirmed" || status === "in_progress" || payment === "paid")
    return { text: "Đã thanh toán", tone: "sky" };
  if (status === "pending" && elapsedMs(s.date, s.time) > 0)
    return { text: "Hết hạn thanh toán", tone: "rose" };
  return { text: "Chờ thanh toán", tone: "amber" };
}

function classifyBooking(row) {
  const st = String(row.status || "").toLowerCase();
  if (st === "cancelled" || st === "rescheduled") return "cancelled";
  if (st === "done" || st === "completed" || st === "no_show") return "past";
  if (st === "confirmed" || statusInProgress(st))
    return elapsedMs(row.date, row.time) > 2 * 3600000 ? "past" : "upcoming";
  if (st === "pending")
    return elapsedMs(row.date, row.time) > 3600000 ? "past" : "upcoming";
  return "past";
}

function statusInProgress(st) {
  return st === "in_progress";
}

function mentorSubtitle(s) {
  const title   = (s.mentorTitle   || "").trim();
  const company = (s.mentorCompany || "").trim();
  if (title && title.toLowerCase() !== "mentor")
    return company && company !== "—" ? `${title} · ${company}` : title;
  if (company && company !== "—") return company;
  return "";
}

function MentorAvatar({ name, src }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [src]);
  const initials = (name || "Mentor").trim().split(/\s+/).slice(-2).map((word) => word[0]).join("");

  return src && !failed ? (
    <img
      className="w-12 h-12 rounded-full object-cover ring-2 ring-violet-400/30 shrink-0"
      src={src}
      alt=""
      loading="lazy"
      onError={() => setFailed(true)}
    />
  ) : (
    <span
      className="w-12 h-12 rounded-full bg-gradient-to-br from-violet-600/30 to-indigo-600/20 border border-violet-400/30 text-violet-200 text-sm font-bold flex items-center justify-center shrink-0"
      aria-hidden="true"
    >
      {initials}
    </span>
  );
}

function BookingRow({ booking: s, tab, index }) {
  const navigate = useNavigate();
  const id = s.sessionId || s.backendId;
  const status = String(s.status || "").toLowerCase();
  const paid = String(s.paymentStatus || "").toLowerCase() === "paid";
  const completed = status === "done" || status === "completed";
  const canMeet = tab === "upcoming" && paid && (status === "confirmed" || status === "in_progress");
  const badge = getBookingBadge(s);
  const subtitle = mentorSubtitle(s);
  const date = new Date(parseDateMs(s.date, s.time));
  const validDate = !Number.isNaN(date.getTime());
  const name = s.mentorName || "Mentor";
  const sessionDetailUrl = `/session/${id}`;

  const handleRowClick = (e) => {
    // If clicked on an interactive button/link inside the row, let that element handle it
    if (e.target.closest("button") || e.target.closest("a")) return;
    navigate(sessionDetailUrl);
  };

  // Badge styles based on tone
  const badgeClasses =
    badge.tone === "emerald"
      ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/35 shadow-[0_0_10px_rgba(16,185,129,0.2)]"
      : badge.tone === "sky"
      ? "bg-sky-500/20 text-sky-300 border-sky-400/35 shadow-[0_0_10px_rgba(14,165,233,0.2)]"
      : badge.tone === "amber"
      ? "bg-amber-500/20 text-amber-300 border-amber-500/35 shadow-[0_0_10px_rgba(245,158,11,0.2)]"
      : badge.tone === "rose"
      ? "bg-rose-500/20 text-rose-300 border-rose-500/35"
      : "bg-white/5 text-slate-300 border-white/10";

  return (
    <AccountReveal
      as="article"
      index={index}
      onClick={handleRowClick}
      className="rounded-2xl border border-white/10 bg-gradient-to-b from-[#181538]/75 via-[#13112c]/80 to-[#0e0c22]/90 shadow-[0_8px_30px_rgba(0,0,0,0.35)] backdrop-blur-2xl hover:border-violet-400/40 hover:shadow-[0_16px_40px_rgba(124,58,237,0.22)] hover:-translate-y-0.5 transition-all duration-300 p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 sm:gap-6 group cursor-pointer select-none"
    >
      <div className="flex items-center gap-4 sm:gap-5 min-w-0 flex-1">
        {/* Calendar Glass Medal */}
        <div
          className="w-16 h-16 sm:w-18 sm:h-20 rounded-2xl flex flex-col items-center justify-center bg-gradient-to-b from-violet-500/25 via-indigo-900/40 to-slate-900/60 border border-violet-400/30 shadow-[0_0_15px_rgba(124,58,237,0.25)] text-violet-200 shrink-0 select-none group-hover:scale-105 transition-transform duration-200"
          aria-label={s.date}
        >
          <span className="text-[10px] font-bold uppercase tracking-wider text-violet-300">
            {validDate ? `Th ${date.getMonth() + 1}` : "Lịch"}
          </span>
          <strong className="text-xl sm:text-2xl font-black text-white leading-none my-0.5 tabular-nums">
            {validDate ? String(date.getDate()).padStart(2, "0") : "—"}
          </strong>
          <span className="text-[10px] text-slate-400 font-medium">
            {validDate ? date.getFullYear() : s.date}
          </span>
        </div>

        {/* Mentor Info & Session Meta */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-3">
            <MentorAvatar name={name} src={s.mentorAvatar} />
            <div className="min-w-0">
              <h2 className="text-base sm:text-lg font-bold text-white tracking-tight truncate group-hover:text-violet-200 transition-colors">
                <Link to={sessionDetailUrl} onClick={(e) => e.stopPropagation()}>{name}</Link>
              </h2>
              {subtitle && <p className="text-xs text-slate-300 truncate mt-0.5">{subtitle}</p>}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 mt-2.5">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/5 border border-white/10 text-xs text-slate-300 font-medium">
              <Clock size={12} className="text-violet-400 shrink-0" aria-hidden="true" />
              <span>{s.time}{s.endTime ? ` – ${s.endTime}` : ""}</span>
            </span>
            <span className="text-[11px] text-slate-400 font-mono px-2 py-0.5 rounded bg-white/[0.03]">
              #{s.orderNum}
            </span>
          </div>
        </div>
      </div>

      {/* Status & Action Block */}
      <div className="flex flex-row md:flex-col items-center md:items-end justify-between md:justify-center gap-3 shrink-0 pt-3 md:pt-0 border-t md:border-t-0 border-white/10">
        <div className="flex flex-col md:items-end gap-1.5">
          <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-bold border backdrop-blur-md ${badgeClasses}`}>
            {badge.text}
          </span>
          {tab === "upcoming" && (
            <span className="text-xs font-semibold text-violet-300/90 flex items-center gap-1">
              <Clock size={12} />
              {getTimeLabel(s.date, s.time)}
            </span>
          )}
          {completed && s.isReviewed && (
            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-300">
              <CheckCircle2 size={12} aria-hidden="true" />
              Đã đánh giá
            </span>
          )}
        </div>

        <div className="flex items-center gap-2.5">
          {status === "pending" && !paid && (
            <Link
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-gradient-to-r from-violet-600 via-indigo-600 to-purple-600 text-white text-xs font-bold shadow-[0_4px_16px_rgba(124,58,237,0.35)] hover:brightness-110 active:scale-95 transition-all"
              to="/account/payments?status=pending"
              onClick={(e) => e.stopPropagation()}
            >
              <CreditCard size={13} aria-hidden="true" />
              Thanh toán
            </Link>
          )}
          {canMeet && (
            <Link
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-500 text-white text-xs font-bold shadow-[0_4px_16px_rgba(16,185,129,0.35)] hover:brightness-110 active:scale-95 transition-all"
              to={`/meeting/${id}`}
              onClick={(e) => e.stopPropagation()}
            >
              <Video size={14} aria-hidden="true" />
              Vào phòng
            </Link>
          )}
          {completed && !s.isReviewed && (
            <Link
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-violet-600 via-indigo-600 to-violet-500 text-white text-xs font-bold shadow-[0_4px_16px_rgba(124,58,237,0.35)] hover:brightness-110 active:scale-95 transition-all"
              to={`/review/${id}`}
              onClick={(e) => e.stopPropagation()}
            >
              <Star size={14} aria-hidden="true" />
              Đánh giá
            </Link>
          )}
          <Link
            className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-white/15 bg-white/[0.06] hover:bg-white/[0.12] hover:border-violet-400/40 px-3.5 py-2 text-xs font-bold text-slate-200 hover:text-white shadow-sm transition-all active:scale-95 group/btn"
            to={sessionDetailUrl}
            onClick={(e) => e.stopPropagation()}
            aria-label={`Chi tiết lịch hẹn với ${name}, ${s.date} lúc ${s.time}`}
          >
            <span>Chi tiết</span>
            <ArrowUpRight size={13} className="transition-transform group-hover/btn:translate-x-0.5 group-hover/btn:-translate-y-0.5" aria-hidden="true" />
          </Link>
        </div>
      </div>
    </AccountReveal>
  );
}

function BookingSkeleton() {
  return (
    <div className="rounded-2xl border border-white/10 bg-gradient-to-b from-[#181538]/70 via-[#13112c]/75 to-[#0e0c22]/80 p-5 flex items-center gap-6" aria-hidden="true">
      <div className="w-18 h-20 bg-white/10 rounded-2xl animate-pulse shrink-0" />
      <div className="flex-1 space-y-2.5">
        <div className="h-4 bg-white/10 rounded-md w-1/3 animate-pulse" />
        <div className="h-3 bg-white/5 rounded-md w-1/4 animate-pulse" />
        <div className="h-3 bg-white/5 rounded-md w-1/5 animate-pulse mt-2" />
      </div>
      <div className="w-28 h-9 bg-white/10 rounded-xl animate-pulse" />
    </div>
  );
}

const TABS = [
  { id: "upcoming", label: "Sắp tới", empty: "Chưa có lịch hẹn sắp tới", description: "Chọn mentor và thời gian phù hợp để sẵn sàng cho buổi phỏng vấn." },
  { id: "past", label: "Đã qua", empty: "Chưa có lịch hẹn đã qua", description: "Các buổi mentor 1:1 đã hoàn thành sẽ hiển thị tại đây." },
  { id: "cancelled", label: "Đã hủy", empty: "Không có lịch hẹn đã hủy", description: "Các lịch hẹn đã hủy hoặc đổi lịch sẽ được lưu tại đây." },
];

export function MyBookings() {
  const [tab, setTab]         = useState("upcoming");
  const [rows, setRows]       = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState("");

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

  const currentTab = TABS.find((item) => item.id === tab);

  function handleTabKeyDown(event, index) {
    let next;
    if (event.key === "ArrowRight") next = (index + 1) % TABS.length;
    if (event.key === "ArrowLeft") next = (index - 1 + TABS.length) % TABS.length;
    if (event.key === "Home") next = 0;
    if (event.key === "End") next = TABS.length - 1;
    if (next == null) return;
    event.preventDefault();
    setTab(TABS[next].id);
    event.currentTarget.parentElement.querySelectorAll('[role="tab"]')[next].focus();
  }

  return (
    <div className="bookings-page">
      <div className={`${CUSTOMER_SHELL_GUTTER} pb-24 pt-8 sm:pt-12`}>
        <div className={`${CUSTOMER_SHELL_MAX} bookings-frame`}>
          {/* Header */}
          <motion.header
            className="bookings-header"
            initial={{ opacity: 0, y: -16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, ease: "easeOut" }}
          >
            <h1>Lịch hẹn</h1>
            <p>Quản lý các buổi mentor 1:1 của bạn.</p>
          </motion.header>

          {/* Prominent Hero Metrics Scoreboard */}
          <div className="my-7">
            {rows.length > 0 ? (
              <motion.div
                className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
                initial="hidden"
                animate="visible"
                variants={{
                  hidden: { opacity: 0 },
                  visible: {
                    opacity: 1,
                    transition: { staggerChildren: 0.12, delayChildren: 0.05 },
                  },
                }}
              >
                {/* Card 1: Buổi hẹn sắp tới */}
                <motion.div
                  variants={{
                    hidden: { opacity: 0, y: 20 },
                    visible: { opacity: 1, y: 0, transition: { duration: 0.45, ease: "easeOut" } },
                  }}
                  whileHover={{ y: -4, transition: { duration: 0.2 } }}
                  className="relative overflow-hidden rounded-2xl border border-violet-400/30 bg-gradient-to-br from-[#23174a]/90 via-[#18133b]/85 to-[#120f2e]/90 p-5 shadow-[0_12px_32px_rgba(10,8,30,0.4)] backdrop-blur-xl transition-all duration-300 hover:border-violet-400/50 hover:shadow-[0_16px_40px_rgba(124,58,237,0.28)]"
                >
                  <div className="pointer-events-none absolute -right-6 -top-6 h-28 w-28 rounded-full bg-violet-500/20 blur-2xl" />
                  <div className="flex items-center justify-between gap-3 mb-3">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
                      <span className="p-1.5 rounded-lg bg-violet-500/20 text-violet-300 ring-1 ring-violet-400/30">
                        <Calendar size={15} />
                      </span>
                      Lịch hẹn sắp tới
                    </span>
                    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
                      counts.upcoming > 0 ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30" : "bg-white/10 text-slate-300 border border-white/10"
                    }`}>
                      {counts.upcoming > 0 ? "Sẵn sàng" : "Trống lịch"}
                    </span>
                  </div>
                  <div className="flex items-baseline gap-2">
                    <span className="text-4xl sm:text-5xl font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-white via-violet-200 to-indigo-200 tabular-nums">
                      <AnimatedNumber value={counts.upcoming} duration={1.1} />
                    </span>
                    <span className="text-sm font-bold text-violet-300/70">buổi phỏng vấn</span>
                  </div>
                  <div className="mt-3.5">
                    <div className="h-2 w-full rounded-full bg-slate-900/80 overflow-hidden p-0.5 border border-white/5">
                      <motion.div
                        className="h-full rounded-full bg-gradient-to-r from-violet-500 via-indigo-500 to-violet-300 shadow-[0_0_12px_rgba(124,58,237,0.5)]"
                        initial={{ width: 0 }}
                        animate={{ width: counts.upcoming > 0 ? "100%" : "5%" }}
                        transition={{ duration: 0.85, ease: "easeOut", delay: 0.2 }}
                      />
                    </div>
                  </div>
                </motion.div>

                {/* Card 2: Buổi hẹn đã hoàn thành */}
                <motion.div
                  variants={{
                    hidden: { opacity: 0, y: 20 },
                    visible: { opacity: 1, y: 0, transition: { duration: 0.45, ease: "easeOut" } },
                  }}
                  whileHover={{ y: -4, transition: { duration: 0.2 } }}
                  className="relative overflow-hidden rounded-2xl border border-emerald-400/30 bg-gradient-to-br from-[#0e2927]/90 via-[#0d2027]/85 to-[#0f1729]/90 p-5 shadow-[0_12px_32px_rgba(10,8,30,0.4)] backdrop-blur-xl transition-all duration-300 hover:border-emerald-400/50 hover:shadow-[0_16px_40px_rgba(16,185,129,0.28)]"
                >
                  <div className="pointer-events-none absolute -right-6 -top-6 h-28 w-28 rounded-full bg-emerald-500/20 blur-2xl" />
                  <div className="flex items-center justify-between gap-3 mb-3">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
                      <span className="p-1.5 rounded-lg bg-emerald-500/20 text-emerald-300 ring-1 ring-emerald-400/30">
                        <Trophy size={15} />
                      </span>
                      Đã hoàn thành
                    </span>
                    <span className="inline-flex items-center gap-1 rounded-full border border-emerald-400/30 bg-emerald-500/20 px-2.5 py-0.5 text-[10px] font-bold text-emerald-300">
                      <Sparkles size={11} /> Kinh nghiệm tích lũy
                    </span>
                  </div>
                  <div className="flex items-baseline gap-2">
                    <span className="text-4xl sm:text-5xl font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-white via-emerald-200 to-teal-200 tabular-nums">
                      <AnimatedNumber value={counts.past} duration={1.1} />
                    </span>
                    <span className="text-sm font-bold text-emerald-300/70">/ {rows.length} buổi đã đặt</span>
                  </div>
                  <div className="mt-3.5">
                    <div className="h-2 w-full rounded-full bg-slate-900/80 overflow-hidden p-0.5 border border-white/5">
                      <motion.div
                        className="h-full rounded-full bg-gradient-to-r from-emerald-500 via-teal-400 to-emerald-200 shadow-[0_0_12px_rgba(16,185,129,0.5)]"
                        initial={{ width: 0 }}
                        animate={{ width: `${rows.length ? Math.round((counts.past / rows.length) * 100) : 0}%` }}
                        transition={{ duration: 0.85, ease: "easeOut", delay: 0.3 }}
                      />
                    </div>
                  </div>
                </motion.div>

                {/* Card 3: Tổng lượt kết nối & Đặt lịch mới */}
                <motion.div
                  variants={{
                    hidden: { opacity: 0, y: 20 },
                    visible: { opacity: 1, y: 0, transition: { duration: 0.45, ease: "easeOut" } },
                  }}
                  whileHover={{ y: -4, transition: { duration: 0.2 } }}
                  className="relative overflow-hidden rounded-2xl border border-white/15 bg-gradient-to-br from-[#19173d]/90 via-[#131230]/85 to-[#0f0e24]/90 p-5 shadow-[0_12px_32px_rgba(10,8,30,0.4)] backdrop-blur-xl sm:col-span-2 lg:col-span-1 flex flex-col justify-between transition-all duration-300 hover:border-white/25 hover:shadow-[0_16px_40px_rgba(99,102,241,0.2)]"
                >
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
                        <span className="p-1.5 rounded-lg bg-sky-500/20 text-sky-300 ring-1 ring-sky-400/30">
                          <Video size={15} />
                        </span>
                        Tổng phiên mentor
                      </span>
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Lịch sử</span>
                    </div>
                    <div className="flex items-baseline gap-2">
                      <span className="text-3xl sm:text-4xl font-black text-white tabular-nums">
                        <AnimatedNumber value={rows.length} duration={0.9} />
                      </span>
                      <span className="text-xs text-slate-400 font-medium">({counts.cancelled} buổi đã hủy)</span>
                    </div>
                  </div>

                  <div className="pt-4">
                    <Link
                      to="/mentors"
                      className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 via-indigo-600 to-violet-500 px-4 py-2.5 text-xs font-bold text-white shadow-[0_4px_16px_rgba(124,58,237,0.35)] hover:brightness-110 active:scale-[0.98] transition-all"
                    >
                      <Sparkles size={14} />
                      Đặt lịch với Mentor mới
                    </Link>
                  </div>
                </motion.div>
              </motion.div>
            ) : null}
          </div>

          {/* Toolbar: Floating Glass Segmented Dock + Actions */}
          <motion.div
            className="flex flex-wrap items-center justify-between gap-4 mb-6"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.15, ease: "easeOut" }}
          >
            {/* Apple-style Floating Glass Segmented Dock */}
            <div
              className="relative flex items-center p-1 sm:p-1.5 rounded-2xl border border-white/15 bg-gradient-to-b from-[#1c183d]/85 via-[#14122e]/90 to-[#0e0c24]/95 shadow-[0_8px_32px_rgba(5,3,20,0.5),inset_0_1px_1px_rgba(255,255,255,0.12)] backdrop-blur-2xl w-full sm:w-auto"
              role="tablist"
              aria-label="Lọc lịch hẹn"
            >
              {TABS.map((item, index) => {
                const isSelected = tab === item.id;
                return (
                  <button
                    key={item.id}
                    id={`bookings-tab-${item.id}`}
                    type="button"
                    role="tab"
                    aria-selected={isSelected}
                    aria-controls="bookings-panel"
                    tabIndex={isSelected ? 0 : -1}
                    onClick={() => setTab(item.id)}
                    onKeyDown={(event) => handleTabKeyDown(event, index)}
                    className={`relative flex-1 sm:flex-initial px-4 sm:px-5 py-2 sm:py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-all duration-200 flex items-center justify-center gap-2 sm:gap-2.5 select-none outline-none focus-visible:ring-2 focus-visible:ring-violet-400 ${
                      isSelected
                        ? "text-white font-bold"
                        : "text-slate-400 hover:text-slate-200 hover:bg-white/[0.04]"
                    }`}
                  >
                    {isSelected && (
                      <motion.div
                        layoutId="my-bookings-segmented-dock"
                        className="absolute inset-0 rounded-xl bg-gradient-to-b from-white/[0.18] via-white/[0.08] to-transparent border border-white/20 border-t-white/35 shadow-[0_4px_16px_rgba(0,0,0,0.45),0_1px_2px_rgba(0,0,0,0.3),inset_0_1px_1px_rgba(255,255,255,0.25)] backdrop-blur-md"
                        transition={{ type: "spring", stiffness: 450, damping: 35 }}
                      />
                    )}
                    <span className="relative z-10 tracking-tight">{item.label}</span>
                    {!loading && !error && (
                      <span
                        className={`relative z-10 inline-flex items-center justify-center px-2 py-0.5 rounded-full text-[11px] font-bold tabular-nums transition-colors duration-200 ${
                          isSelected
                            ? "bg-violet-400/25 text-violet-200 border border-violet-400/40 shadow-[0_0_10px_rgba(167,139,250,0.3)]"
                            : "bg-white/5 text-slate-400 border border-white/5"
                        }`}
                      >
                        {counts[item.id]}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Actions: Browse mentor button & Refresh */}
            <div className="flex items-center gap-3 ml-auto">
              {!loading && !error && rows.length > 0 && (tab !== "upcoming" || filtered.length > 0) && (
                <Link
                  className="inline-flex items-center gap-2 h-[46px] px-4 sm:px-5 rounded-2xl bg-gradient-to-r from-violet-600 via-indigo-600 to-violet-500 text-white shadow-[0_4px_16px_rgba(124,58,237,0.35)] hover:brightness-110 active:scale-95 text-xs sm:text-sm font-bold transition-all group"
                  to="/mentors"
                >
                  <span>Tìm mentor</span>
                  <span className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5">
                    <ArrowUpRight size={13} aria-hidden="true" />
                  </span>
                </Link>
              )}

              <motion.button
                type="button"
                className="relative flex items-center justify-center h-[46px] w-[46px] rounded-2xl border border-white/15 bg-gradient-to-b from-[#1c183d]/85 via-[#14122e]/90 to-[#0e0c24]/95 shadow-[0_8px_32px_rgba(5,3,20,0.5),inset_0_1px_1px_rgba(255,255,255,0.12)] backdrop-blur-2xl text-violet-300 hover:text-white hover:border-violet-400/40 hover:shadow-[0_8px_32px_rgba(5,3,20,0.5),0_0_16px_rgba(167,139,250,0.25)] transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed group shrink-0"
                onClick={load}
                disabled={loading}
                aria-label="Tải lại lịch hẹn"
                title="Tải lại lịch hẹn"
                whileHover={{ scale: 1.06 }}
                whileTap={{ scale: 0.94 }}
              >
                <RefreshCw
                  size={17}
                  className={`transition-transform duration-500 ${loading ? "animate-spin" : "group-hover:rotate-180"}`}
                  aria-hidden="true"
                />
              </motion.button>
            </div>
          </motion.div>

          {/* Appointments List Section */}
          <section key={tab} id="bookings-panel" role="tabpanel" aria-labelledby={`bookings-tab-${tab}`} tabIndex={0} aria-busy={loading}>
            {loading && (
              <div className="grid gap-3" role="status">
                <span className="sr-only">Đang tải lịch hẹn…</span>
                {[0, 1, 2].map((item) => <BookingSkeleton key={item} />)}
              </div>
            )}

            {error && !loading && (
              <div className="flex items-center justify-between p-5 rounded-2xl bg-rose-950/30 border border-rose-500/30 text-rose-200" role="alert">
                <div className="flex items-center gap-3">
                  <AlertCircle size={20} className="text-rose-400 shrink-0" aria-hidden="true" />
                  <p className="text-sm font-medium">{error}</p>
                </div>
                <button
                  type="button"
                  className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-bold text-white transition-colors"
                  onClick={load}
                >
                  Thử lại
                </button>
              </div>
            )}

            {!loading && !error && filtered.length === 0 && (
              <motion.div
                className="flex min-h-[360px] flex-col items-center justify-center p-12 text-center rounded-2xl border border-white/10 bg-gradient-to-b from-[#181538]/50 via-[#13112c]/60 to-[#0e0c22]/70 shadow-lg backdrop-blur-xl"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.35, ease: "easeOut" }}
              >
                <span className="w-16 h-16 rounded-full bg-violet-500/15 border border-violet-400/30 flex items-center justify-center text-violet-300 mb-4 shadow-[0_0_20px_rgba(124,58,237,0.25)]">
                  <Calendar size={28} strokeWidth={1.6} aria-hidden="true" />
                </span>
                <h2 className="text-xl font-bold text-white mb-2">{currentTab.empty}</h2>
                <p className="text-sm text-slate-300 max-w-md leading-relaxed">{currentTab.description}</p>
                {tab === "upcoming" && (
                  <Link
                    className="inline-flex items-center gap-2 mt-6 px-5 py-2.5 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 text-white text-xs font-bold shadow-md hover:brightness-110 transition-all"
                    to="/mentors"
                  >
                    <span>Tìm mentor phù hợp</span>
                    <ArrowUpRight size={15} aria-hidden="true" />
                  </Link>
                )}
              </motion.div>
            )}

            {!loading && !error && filtered.length > 0 && (
              <div className="grid gap-3.5">
                {filtered.map((booking, index) => (
                  <BookingRow
                    key={booking.sessionId || booking.backendId}
                    booking={booking}
                    tab={tab}
                    index={index}
                  />
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
