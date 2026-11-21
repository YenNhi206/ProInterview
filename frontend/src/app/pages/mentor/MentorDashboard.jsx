import { useState, useEffect } from "react";
import { useNavigate } from "react-router";
import { motion, AnimatePresence } from "motion/react";
import {
  Calendar as CalendarBlank,
  Star,
  X,
  ArrowRight,
  ChevronRight,
  BarChart3 as ChartBar,
  CalendarClock,
  Landmark,
  BadgeCheck as SealCheck,
  Target,
  Zap as Lightning,
  Wallet,
  Users,
  Quote,
  User,
  FileBadge,
  Sparkles,
  Video,
} from "lucide-react";
import { getUser, getDisplayName } from "../../utils/auth/auth.js";
import { MentorPageShell } from "../../components/mentor/MentorPageShell";
import { MentorMoneyText } from "../../utils/shared/moneyDisplay.jsx";
import {
  MentorStatPanel,
  MentorStatMiniGrid,
  MentorStatFrame,
  MentorSessionActivityBlocks,
} from "../../components/mentor/MentorStatFrames";
import { listMentorBookings } from "../../api/bookingsApi.js";
import { fetchMentorDashboard } from "../../api/mentorApi.js";
import { toastApiError } from "../../utils/shared/apiToast.js";
import { formatVnd } from "../../utils/shared/formatVnd.js";
import { avatarSrc, DEFAULT_AVATAR } from "../../utils/shared/mediaUrl.js";
import { parseBookingNotes } from "../../utils/booking/bookingMappers.js";
import { parseMentorNotesSections, sessionTypeLabel } from "../../utils/booking/sessionTypeLabels.js";

function parseBookingDateTime(dateStr, timeStr = "00:00") {
  const raw = String(dateStr || "").trim();
  if (!raw) return null;
  const parts = raw.split("/").map((p) => Number(p));
  if (parts.length < 2 || !Number.isFinite(parts[0]) || !Number.isFinite(parts[1])) return null;
  const day = parts[0];
  const month = parts[1];
  const year = parts.length >= 3 && Number.isFinite(parts[2]) ? parts[2] : new Date().getFullYear();
  const [hour, minute] = String(timeStr || "00:00").split(":").map((p) => Number(p));
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return null;
  const dt = new Date(year, month - 1, day, hour, minute, 0, 0);
  if (Number.isNaN(dt.getTime())) return null;
  return dt;
}

function formatMeetingDate(dateStr, timeStr) {
  const dt = parseBookingDateTime(dateStr, timeStr);
  if (!dt) return "";
  return dt.toLocaleDateString("vi-VN");
}

function toMentorMeeting(booking, ratingByBookingId = {}) {
  const id = booking.id || booking._id || "";
  const menteeRating = Number(
    booking.menteeRating ?? ratingByBookingId[id] ?? 0,
  );
  const score = menteeRating > 0 ? menteeRating : 0;
  const notesParsed = parseMentorNotesSections(booking.mentorNotes);
  const { position: appliedRole } = parseBookingNotes(booking.notes);
  const typeLabel = sessionTypeLabel(booking.sessionType);
  return {
    id,
    status: booking.status || "",
    mentee: {
      name: booking.customerName || booking.customerEmail || "Thành viên",
      avatar: avatarSrc(booking.customerAvatar) || DEFAULT_AVATAR,
      level: "Mentee",
    },
    position: appliedRole || typeLabel,
    company: booking.customerEmail || "",
    scheduledTime: booking.timeSlot || "--:--",
    scheduledDate: booking.date || "",
    meetingType: booking.sessionType || "custom",
    sessionTypeLabel: typeLabel,
    price: Number(booking.price || 0),
    starScores: score
      ? { situation: score, task: score, action: score, result: score }
      : { situation: 0, task: 0, action: 0, result: 0 },
    overallScore: score,
    feedback: String(booking.reviewComment || notesParsed.feedback || "").trim(),
    strengths: notesParsed.strengths,
    improvements: notesParsed.weaknesses,
    menteeNotes: booking.notes || "",
  };
}

/* ── Mentee Progress Modal ────────────────────────────────────────────────── */
function MenteeProgressModal({
  meeting,
  onClose,
}) {
  const navigate = useNavigate();

  const star = meeting.starScores;
  const overall = meeting.overallScore ?? 0;

  const scoreColor = overall >= 4 ? "#93f72b" : overall >= 3 ? "#8037f4" : "#FF8C42";
  const scoreLabel =
    overall >= 4.5
      ? "Xuất sắc 🏆"
      : overall >= 4
      ? "Rất tốt ✨"
      : overall >= 3
      ? "Khá tốt 👍"
      : "Cần cải thiện 📚";

  const starComponents = star
    ? [
        { key: "situation", label: "Situation", value: star.situation, color: "#8037f4" },
        { key: "task", label: "Task", color: "#a66ff8", value: star.task },
        { key: "action", label: "Action", color: "#93f72b", value: star.action },
        { key: "result", label: "Result", color: "#FF8C42", value: star.result },
      ]
    : [];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/75 p-4 backdrop-blur-md sm:p-6"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.95, y: 20 }}
        className="relative flex max-h-[92svh] w-full max-w-2xl flex-col overflow-hidden rounded-3xl border border-white/15 bg-[#160f26] shadow-[0_24px_64px_rgba(0,0,0,0.8)] text-white"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 bg-white/[0.02] p-6">
          <div className="flex items-center gap-4">
            <img
              src={meeting.mentee.avatar}
              alt=""
              className="h-12 w-12 rounded-2xl object-cover ring-2 ring-white/15"
            />
            <div>
              <h3 className="text-lg font-bold text-white">{meeting.mentee.name}</h3>
              <p className="text-xs text-slate-400">
                {meeting.position} · {formatMeetingDate(meeting.scheduledDate, meeting.scheduledTime)}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-slate-400 transition hover:bg-white/10 hover:text-white"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="min-h-0 flex-1 overflow-y-auto p-6 space-y-6">
          {/* Overall Score */}
          <div className="flex flex-col items-center justify-center rounded-2xl border border-white/10 bg-gradient-to-b from-white/[0.04] to-transparent p-6 text-center">
            <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">Đánh giá chung</span>
            <div className="mt-2 text-4xl font-black" style={{ color: scoreColor }}>
              {overall > 0 ? overall.toFixed(1) : "—"}
              <span className="text-lg font-semibold text-slate-500"> / 5.0</span>
            </div>
            <span className="mt-2 text-xs font-semibold" style={{ color: scoreColor }}>
              {scoreLabel}
            </span>
            <div className="mt-4 flex items-center gap-1">
              {[1, 2, 3, 4, 5].map((s) => (
                <Star
                  key={s}
                  size={16}
                  className={s <= Math.round(overall) ? "text-[#FFD600] fill-[#FFD600]" : "text-white/20"}
                />
              ))}
            </div>
            {meeting.feedback ? (
              <p className="mt-4 max-w-sm text-sm italic text-slate-300">&ldquo;{meeting.feedback}&rdquo;</p>
            ) : (
              <p className="mt-4 max-w-sm text-sm text-slate-400">Chưa có nhận xét từ học viên.</p>
            )}
          </div>

          {/* STAR Framework Detail */}
          <div className="space-y-5">
            <h5 className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2.5">
              <ChartBar size={14} className="text-[#93f72b]" /> Phân tích khung năng lực STAR
            </h5>
            <div className="grid grid-cols-1 gap-4">
              {starComponents.map((comp) => (
                <div key={comp.key} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="flex h-7 w-7 items-center justify-center rounded-lg text-xs font-black text-slate-950" style={{ background: comp.color }}>
                        {comp.label[0]}
                      </div>
                      <span className="text-xs font-bold text-slate-300">{comp.label}</span>
                    </div>
                    <span className="text-xs font-bold text-white">{comp.value.toFixed(1)}/5.0</span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${(comp.value / 5) * 100}%` }}
                      transition={{ duration: 1, delay: 0.2 }}
                      className="h-full rounded-full"
                      style={{ background: comp.color, boxShadow: `0 0 10px ${comp.color}40` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Feedback Grid */}
          <div className="grid md:grid-cols-2 gap-4">
            <div className="p-5 rounded-2xl bg-white/[0.03] border border-white/10">
              <h6 className="text-[10px] font-bold text-[#93f72b] uppercase tracking-wider mb-3 flex items-center gap-2">
                <Lightning size={12} /> Điểm mạnh
              </h6>
              <ul className="space-y-2">
                {(meeting.strengths?.length ? meeting.strengths : ["Chưa có dữ liệu"]).map((s, i) => (
                  <li key={i} className="flex items-start gap-2 text-xs font-medium text-slate-300">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#93f72b] mt-1.5 shrink-0" />
                    {s}
                  </li>
                ))}
              </ul>
            </div>
            <div className="p-5 rounded-2xl bg-orange-500/[0.05] border border-orange-500/20">
              <h6 className="text-[10px] font-bold text-orange-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                <Target size={12} /> Cần cải thiện
              </h6>
              <ul className="space-y-2">
                {(meeting.improvements?.length ? meeting.improvements : ["Chưa có dữ liệu"]).map((s, i) => (
                  <li key={i} className="flex items-start gap-2 text-xs font-medium text-slate-300">
                    <span className="w-1.5 h-1.5 rounded-full bg-orange-400 mt-1.5 shrink-0" />
                    {s}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-4 border-t border-white/10 bg-white/[0.02] p-5">
          <button
            type="button"
            onClick={() => navigate(`/mentor/meeting-detail/${meeting.id}`)}
            className="flex-1 rounded-xl bg-[#93f72b] px-6 py-3 text-xs font-bold uppercase tracking-wider text-slate-950 shadow-[0_0_20px_rgba(147,247,43,0.35)] transition-all hover:bg-[#a8ff4e]"
          >
            Xem báo cáo chi tiết
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-white/15 bg-white/5 px-6 py-3 text-xs font-bold uppercase tracking-wider text-slate-300 transition-all hover:bg-white/10 hover:text-white"
          >
            Đóng
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

function formatVndCompact(amount) {
  const n = Number(amount) || 0;
  if (n >= 1_000_000) {
    const m = n / 1_000_000;
    return Number.isInteger(m) ? `${m}M` : `${m.toFixed(1).replace(/\.0$/, "")}M`;
  }
  if (n >= 1000) return `${Math.round(n / 1000)}K`;
  return String(n);
}

function pickFeaturedTestimonial(bookings) {
  const featured = bookings
    .filter((m) => {
      const fb = String(m.feedback || "").trim();
      return fb.length >= 6 && Number(m.overallScore) >= 4;
    })
    .sort((a, b) => Number(b.overallScore) - Number(a.overallScore))[0];
  if (featured) {
    return {
      quote: featured.feedback,
      author: featured.mentee?.name || "Khách hàng",
      rating: Number(featured.overallScore) || 5,
    };
  }
  return {
    quote:
      "Tư vấn CV chi tiết và chỉ ra lộ trình phỏng vấn thực tế rất rõ ràng, giúp mình tự tin hơn hẳn khi đối diện nhà tuyển dụng.",
    author: "Học viên ProInterview",
    rating: 5,
  };
}

function padStat(n) {
  return String(Math.max(0, Number(n) || 0)).padStart(2, "0");
}

function bookingDateKey(dateStr) {
  const dt = parseBookingDateTime(dateStr, "00:00");
  if (!dt) return null;
  return `${dt.getFullYear()}-${dt.getMonth()}-${dt.getDate()}`;
}

function MentorMiniCalendar({ highlightedDays, viewDate, onViewDateChange }) {
  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const first = new Date(year, month, 1);
  const last = new Date(year, month + 1, 0);
  const startPad = (first.getDay() + 6) % 7;
  const daysInMonth = last.getDate();
  const today = new Date();

  const cells = [];
  for (let i = 0; i < startPad; i += 1) cells.push(null);
  for (let d = 1; d <= daysInMonth; d += 1) cells.push(d);

  const monthLabel = `Tháng ${month + 1}, ${year}`;

  return (
    <div className="w-full max-w-[280px] shrink-0 lg:border-r lg:border-white/10 lg:pr-7">
      <div className="mb-4 flex items-center justify-between gap-2">
        <button
          type="button"
          aria-label="Tháng trước"
          onClick={() => onViewDateChange(new Date(year, month - 1, 1))}
          className="flex h-8 w-8 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-slate-300 transition hover:border-white/20 hover:bg-white/10 hover:text-white"
        >
          ‹
        </button>
        <span className="text-xs font-bold uppercase tracking-wider text-white">{monthLabel}</span>
        <button
          type="button"
          aria-label="Tháng sau"
          onClick={() => onViewDateChange(new Date(year, month + 1, 1))}
          className="flex h-8 w-8 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-slate-300 transition hover:border-white/20 hover:bg-white/10 hover:text-white"
        >
          ›
        </button>
      </div>
      <div className="grid grid-cols-7 gap-y-1 text-center text-[11px] font-bold uppercase tracking-wider text-violet-300/60">
        {["T2", "T3", "T4", "T5", "T6", "T7", "CN"].map((d) => (
          <span key={d} className="py-1">
            {d}
          </span>
        ))}
      </div>
      <div className="mt-1 grid grid-cols-7 gap-y-1">
        {cells.map((day, idx) => {
          if (!day) return <div key={`e-${idx}`} className="h-8" />;
          const key = `${year}-${month}-${day}`;
          const isToday =
            today.getFullYear() === year && today.getMonth() === month && today.getDate() === day;
          const hasMeeting = highlightedDays.has(key);
          return (
            <div key={key} className="flex h-8 items-center justify-center">
              <span
                className={`relative flex h-7 w-7 items-center justify-center rounded-lg text-xs font-semibold transition-all ${
                  isToday
                    ? "bg-[#93f72b] text-slate-950 font-black shadow-[0_0_12px_rgba(147,247,43,0.5)]"
                    : hasMeeting
                      ? "border border-violet-500/40 bg-violet-500/20 font-bold text-violet-200 shadow-[0_0_8px_rgba(130,60,240,0.3)]"
                      : "text-slate-300 hover:bg-white/10 hover:text-white"
                }`}
              >
                {day}
                {hasMeeting && !isToday && (
                  <span className="absolute -bottom-0.5 h-1 w-1 rounded-full bg-[#93f72b]" />
                )}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ── Dashboard entrance motion ─────────────────────────────────────────────── */
const dashboardFadeUp = {
  hidden: { opacity: 0, y: 18 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.45, ease: [0.22, 1, 0.36, 1] },
  },
};

const dashboardStagger = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.08, delayChildren: 0.1 },
  },
};

const meetingRowFade = {
  hidden: { opacity: 0, x: 14 },
  visible: (i) => ({
    opacity: 1,
    x: 0,
    transition: {
      delay: i * 0.06,
      duration: 0.35,
      ease: [0.22, 1, 0.36, 1],
    },
  }),
};

/* ── Main Dashboard ────────────────────────────────────────────────────────── */
export function MentorDashboard() {
  const navigate = useNavigate();
  const user = getUser();
  const [selectedMeeting, setSelectedMeeting] = useState(null);
  const [mentorBookings, setMentorBookings] = useState([]);
  const [dashboard, setDashboard] = useState(null);
  const [calendarView, setCalendarView] = useState(() => new Date());

  useEffect(() => {
    if (!user || user.role !== "mentor") {
      navigate("/");
    }
  }, []);

  useEffect(() => {
    let active = true;
    (async () => {
      const [bookingsRes, dashboardRes] = await Promise.all([
        listMentorBookings(),
        fetchMentorDashboard(),
      ]);
      if (!active) return;
      const dash = dashboardRes.success ? dashboardRes.dashboard || null : null;
      const ratingMap = dash?.ratingByBookingId || {};

      if (bookingsRes.success) {
        const rows = Array.isArray(bookingsRes.bookings) ? bookingsRes.bookings : [];
        setMentorBookings(rows.map((b) => toMentorMeeting(b, ratingMap)));
      } else if (bookingsRes.error) {
        toastApiError(bookingsRes.error, "Không tải được lịch hẹn.");
      }
      if (dashboardRes.success) {
        setDashboard(dash);
      } else if (dashboardRes.error) {
        toastApiError(dashboardRes.error, "Không tải được thống kê dashboard.");
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  if (!user || user.role !== "mentor") return null;

  const now = Date.now();
  const sevenDaysLater = now + 7 * 24 * 60 * 60 * 1000;
  const ratingMap = dashboard?.ratingByBookingId || {};
  const apiUpcoming = mentorBookings.filter((m) => {
    const statusOk = ["pending", "confirmed", "in_progress"].includes(String(m.status || "").toLowerCase());
    if (!statusOk) return false;
    const dt = parseBookingDateTime(m.scheduledDate, m.scheduledTime);
    return dt && dt.getTime() > now && dt.getTime() <= sevenDaysLater;
  });
  const dashboardUpcoming = Array.isArray(dashboard?.upcomingBookings)
    ? dashboard.upcomingBookings.map((b) => toMentorMeeting(b, ratingMap))
    : [];
  const upcomingMeetings = (dashboardUpcoming.length ? dashboardUpcoming : apiUpcoming).slice(0, 3);
  const recentCompleted = mentorBookings
    .filter((m) => String(m.status || "").toLowerCase() === "completed")
    .slice(0, 5);
  const finance = dashboard?.finance || {};
  const totalEarned = Number(finance.totalEarned || 0);
  const availableBalance = Number(finance.availableBalance || 0);
  const stats = {
    totalSessions: Number(dashboard?.totalSessions ?? mentorBookings.length),
    thisMonthSessions: Number(dashboard?.sessionsThisMonth ?? 0),
    upcomingMeetings: Number(dashboard?.upcomingWithin7Days ?? dashboardUpcoming.length ?? apiUpcoming.length),
    totalEarned,
    availableBalance,
  };

  const displayName = getDisplayName(user, "Mentor");
  const mentorAvatar = avatarSrc(user?.avatar) || "";
  const featuredReview = pickFeaturedTestimonial(mentorBookings);
  const monthHint =
    stats.thisMonthSessions > 0
      ? `${stats.thisMonthSessions} buổi mới tháng này`
      : "Chưa có buổi mới tháng này";

  const meetingDayKeys = new Set();
  mentorBookings.forEach((m) => {
    const k = bookingDateKey(m.scheduledDate);
    if (k) meetingDayKeys.add(k);
  });

  const upcomingCount = upcomingMeetings.length;

  return (
    <MentorPageShell bottomPad="pb-24" showAmbient={false} className="relative bg-transparent text-white overflow-hidden">
      {/* Background Lighting Depth */}
      <div className="pointer-events-none absolute -top-40 left-1/4 h-[500px] w-[600px] rounded-full bg-violet-600/10 blur-[140px]" />
      <div className="pointer-events-none absolute top-40 right-10 h-[400px] w-[500px] rounded-full bg-[#93f72b]/05 blur-[150px]" />

      <div className="relative z-10 mx-auto max-w-[1280px] px-4 pb-12 sm:px-6 lg:px-10">

        {/* Hero Section */}
        <motion.header
          initial={{ opacity: 0, y: -14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          className="mb-8 flex flex-col gap-6 pt-2 lg:flex-row lg:items-center lg:justify-between lg:gap-8"
        >
          <div className="lg:max-w-2xl lg:flex-1">
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-[#93f72b]/30 bg-[#93f72b]/10 px-3.5 py-1 text-xs font-bold uppercase tracking-wider text-[#93f72b]">
              <Sparkles size={13} /> Sẵn sàng nhận lịch tư vấn · Không gian điều hành chuyên gia
            </div>
            <h1 className="font-headline text-3xl font-black leading-[1.12] tracking-tight text-white sm:text-4xl lg:text-[2.65rem]">
              Xin chào,{" "}
              <span className="text-white font-black drop-shadow-sm">
                {displayName}
              </span>
            </h1>
            <p className="mt-3 text-sm leading-relaxed text-slate-300 sm:text-base">
              Quản lý buổi phỏng vấn 1:1, điều phối lịch rảnh và theo dõi tiến độ thu nhập thực tế trong tháng.
            </p>

            <div className="mt-6 flex flex-wrap items-center gap-3">
              <motion.button
                type="button"
                onClick={() => navigate("/mentor/schedule")}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="group inline-flex items-center gap-3 rounded-xl bg-[#93f72b] py-2.5 pl-5 pr-2.5 text-xs font-bold uppercase tracking-wider text-slate-950 shadow-[0_0_24px_rgba(147,247,43,0.35)] transition-all hover:bg-[#a8ff4e]"
              >
                <span>Tạo lịch trống mới</span>
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-black/15 transition-transform group-hover:translate-x-0.5">
                  <ArrowRight size={14} strokeWidth={2.5} />
                </span>
              </motion.button>
              <button
                type="button"
                onClick={() => navigate("/mentor/schedule")}
                className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/5 px-5 py-2.5 text-xs font-semibold uppercase tracking-wider text-slate-200 transition-all hover:border-white/30 hover:bg-white/10 hover:text-white"
              >
                <CalendarBlank size={15} strokeWidth={2} aria-hidden />
                Xem lịch trình
              </button>
            </div>
          </div>

          {/* Right Side: Mentor ID Badge Card */}
          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.45, delay: 0.1 }}
            className="shrink-0"
          >
            <div className="relative group rounded-2xl border border-white/10 bg-gradient-to-b from-[#181128]/95 to-[#120a20]/95 p-4 backdrop-blur-xl shadow-[0_16px_40px_rgba(0,0,0,0.4)] flex items-center gap-4">
              <div className="relative shrink-0">
                <div className="h-16 w-16 overflow-hidden rounded-2xl border border-white/15 bg-black/40 shadow-inner">
                  {mentorAvatar ? (
                    <img
                      src={mentorAvatar}
                      alt={displayName}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-slate-400">
                      <User size={28} />
                    </div>
                  )}
                </div>
                {user?.role === "mentor" && (
                  <div
                    title="Mentor đã xác minh"
                    className="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full bg-[#93f72b] text-slate-950 shadow-md ring-2 ring-[#120a20]"
                  >
                    <SealCheck size={13} strokeWidth={3} />
                  </div>
                )}
              </div>
              <div className="min-w-0 pr-3">
                <p className="truncate text-sm font-bold text-white">{displayName}</p>
                <p className="text-xs text-violet-300 font-medium">Chuyên gia Phỏng vấn</p>
                <div className="mt-1 flex items-center gap-2 text-[11px] font-semibold text-[#93f72b]">
                  <span className="flex items-center gap-1">
                    <Star size={12} className="fill-current" />
                    5.0
                  </span>
                  <span className="text-slate-600">·</span>
                  <span className="text-slate-400 font-medium">{stats.totalSessions} buổi</span>
                </div>
              </div>
            </div>
          </motion.div>
        </motion.header>

        {/* Stats Grid — 3 Bento KPI Cards */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, delay: 0.08, ease: [0.22, 1, 0.36, 1] }}
          className="lg:hidden"
        >
          <MentorStatMiniGrid>
            <MentorStatFrame
              index={1}
              compact
              accent="purple"
              value={String(stats.totalSessions)}
              title="Tổng buổi mentor"
              cornerIcon={Users}
            />
            <MentorStatFrame
              index={2}
              compact
              accent="lime"
              value={String(stats.upcomingMeetings)}
              title="Lịch hẹn sắp tới"
              cornerIcon={CalendarClock}
            />
            <MentorStatFrame
              index={3}
              compact
              accent="purple"
              value={formatVndCompact(stats.totalEarned)}
              title="Tổng thu nhập"
              cornerIcon={Landmark}
            />
            <MentorStatFrame
              index={4}
              compact
              accent="lime"
              value={formatVnd(stats.availableBalance)}
              title="Khả dụng rút"
              cornerIcon={Wallet}
            />
          </MentorStatMiniGrid>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, delay: 0.08, ease: [0.22, 1, 0.36, 1] }}
          className="hidden lg:block"
        >
          <MentorStatPanel>
            <MentorStatFrame
              index={1}
              accent="purple"
              value={String(stats.totalSessions)}
              title="Tổng buổi mentor"
              subtitle={monthHint}
              cornerIcon={Users}
              footer={
                <MentorSessionActivityBlocks
                  activeCount={stats.thisMonthSessions > 0 ? Math.min(5, stats.thisMonthSessions) : 0}
                />
              }
            />
            <MentorStatFrame
              index={2}
              accent="lime"
              value={String(stats.upcomingMeetings)}
              title="Lịch hẹn sắp tới"
              subtitle="Trong 7 ngày tới"
              cornerIcon={CalendarClock}
            />
            <MentorStatFrame
              index={3}
              accent="purple"
              value={formatVndCompact(stats.totalEarned)}
              title="Tổng thu nhập"
              subtitle={`Khả dụng để rút: ${formatVnd(stats.availableBalance)}`}
              cornerIcon={Landmark}
            />
          </MentorStatPanel>
        </motion.div>

        {/* Testimonial / Feedback highlight Ribbon */}
        {featuredReview?.quote && (
          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, delay: 0.12, ease: [0.22, 1, 0.36, 1] }}
            className="mb-8 relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-r from-violet-950/40 via-[#160f26]/85 to-[#120a20]/85 p-5 sm:px-6 shadow-[0_16px_40px_rgba(0,0,0,0.35)] backdrop-blur-xl"
          >
            <div className="flex items-start gap-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-500/20 text-[#93f72b] border border-violet-500/30 shadow-[0_0_12px_rgba(130,60,240,0.2)]">
                <Quote size={18} fill="currentColor" strokeWidth={0} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-normal leading-relaxed text-slate-200 sm:text-[15px] italic">
                  &ldquo;{featuredReview.quote}&rdquo;
                </p>
                <div className="mt-3 flex flex-wrap items-center gap-3 text-xs">
                  <span className="font-bold text-white">{featuredReview.author}</span>
                  <span className="text-slate-600">•</span>
                  <span className="inline-flex items-center gap-1.5 rounded-lg border border-amber-500/30 bg-amber-500/10 px-2.5 py-0.5 text-xs font-bold text-amber-300">
                    ★ {featuredReview.rating} / 5.0
                  </span>
                  <span className="text-slate-400">Nhận xét học viên thực tế</span>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* Main Bento Grid */}
        <motion.div
          variants={dashboardStagger}
          initial="hidden"
          animate="visible"
          className="grid gap-6 lg:grid-cols-12 lg:items-start"
        >
          {/* Left Column (8 cols): Calendar & Schedule */}
          <div className="space-y-6 lg:col-span-8">
            <motion.div
              variants={dashboardFadeUp}
              className="overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-b from-[#160f26]/90 to-[#10091e]/90 shadow-[0_16px_48px_rgba(0,0,0,0.4)] backdrop-blur-xl"
            >
              <div className="flex items-center justify-between gap-3 border-b border-white/10 bg-white/[0.02] px-6 py-4">
                <div className="flex items-center gap-3">
                  <span className="flex h-6 items-center justify-center rounded-full bg-[#93f72b] px-2.5 text-xs font-bold text-slate-950 shadow-[0_0_12px_rgba(147,247,43,0.4)]">
                    {padStat(upcomingCount)}
                  </span>
                  <h2 className="text-sm font-bold uppercase tracking-wider text-white">
                    Lịch phỏng vấn sắp tới
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={() => navigate("/mentor/schedule")}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-slate-400 transition hover:text-[#93f72b]"
                >
                  Toàn bộ lịch trình
                  <span aria-hidden="true">→</span>
                </button>
              </div>

              <div className="flex flex-col gap-6 p-6 sm:p-7 lg:flex-row lg:gap-0">
                <MentorMiniCalendar
                  highlightedDays={meetingDayKeys}
                  viewDate={calendarView}
                  onViewDateChange={setCalendarView}
                />

                {upcomingMeetings.length === 0 ? (
                  <motion.div
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2, duration: 0.4 }}
                    className="flex min-h-[220px] flex-1 flex-col items-center justify-center p-6 text-center lg:pl-8"
                  >
                    <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-white/15 bg-white/5 text-[#93f72b]">
                      <CalendarClock size={26} strokeWidth={1.8} />
                    </div>
                    <p className="mt-4 text-sm font-bold text-white">
                      Chưa có buổi phỏng vấn nào được lên lịch
                    </p>
                    <p className="mt-1.5 max-w-sm text-xs leading-relaxed text-slate-400">
                      Hãy mở các khung giờ rảnh để mentee có thể nhanh chóng đặt lịch tư vấn 1:1 cùng bạn.
                    </p>
                    <button
                      type="button"
                      onClick={() => navigate("/mentor/schedule")}
                      className="mt-5 inline-flex items-center gap-2 rounded-xl bg-[#93f72b] px-5 py-2.5 text-xs font-bold uppercase tracking-wider text-slate-950 shadow-[0_0_16px_rgba(147,247,43,0.3)] transition-all hover:bg-[#a8ff4e]"
                    >
                      Tạo lịch mới ngay →
                    </button>
                  </motion.div>
                ) : (
                  <div className="min-w-0 flex-1 space-y-3 lg:pl-8">
                    {upcomingMeetings.map((meeting, idx) => (
                      <motion.div
                        key={meeting.id}
                        custom={idx}
                        variants={meetingRowFade}
                        initial="hidden"
                        animate="visible"
                        role="button"
                        tabIndex={0}
                        onClick={() => navigate(`/mentor/meeting-detail/${meeting.id}`)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") navigate(`/mentor/meeting-detail/${meeting.id}`);
                        }}
                        className="group flex cursor-pointer items-center justify-between gap-4 rounded-xl border border-white/10 bg-white/[0.03] p-3.5 transition-all duration-200 hover:border-[#93f72b]/30 hover:bg-white/[0.06]"
                      >
                        <div className="flex min-w-0 items-center gap-3">
                          <img
                            src={meeting.mentee.avatar}
                            alt=""
                            className="h-10 w-10 shrink-0 rounded-xl object-cover border border-white/15"
                          />
                          <div className="min-w-0">
                            <p className="truncate text-xs font-bold text-white group-hover:text-[#93f72b] transition-colors">{meeting.mentee.name}</p>
                            <p className="text-[11px] text-slate-400 truncate mt-0.5">
                              {meeting.sessionTypeLabel || meeting.position}
                            </p>
                          </div>
                        </div>
                        <div className="shrink-0 text-right">
                          <p className="text-xs font-bold text-white">{meeting.scheduledTime}</p>
                          <p className="text-[11px] text-slate-400 mt-0.5">
                            {formatMeetingDate(meeting.scheduledDate, meeting.scheduledTime)}
                          </p>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>

            {/* Quick Action Bento Cards */}
            <motion.div variants={dashboardFadeUp} className="grid gap-4 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => navigate("/mentor/schedule")}
                className="group flex items-center gap-4 rounded-2xl border border-white/10 bg-[#160f26]/85 p-5 text-left transition-all duration-300 hover:border-[#93f72b]/40 hover:bg-[#160f26] shadow-lg"
              >
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-[#93f72b]/30 bg-[#93f72b]/10 text-[#93f72b] transition-transform group-hover:scale-105">
                  <CalendarBlank size={20} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-white group-hover:text-[#93f72b] transition-colors">Lịch trình & Khung giờ</p>
                  <p className="mt-0.5 text-xs text-slate-400">Điều phối phòng họp và khung giờ rảnh</p>
                </div>
                <ChevronRight size={16} className="shrink-0 text-slate-500 transition group-hover:translate-x-1 group-hover:text-white" />
              </button>

              <button
                type="button"
                onClick={() => navigate("/mentor/courses")}
                className="group flex items-center gap-4 rounded-2xl border border-white/10 bg-[#160f26]/85 p-5 text-left transition-all duration-300 hover:border-violet-500/40 hover:bg-[#160f26] shadow-lg"
              >
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-violet-500/30 bg-violet-500/10 text-violet-300 transition-transform group-hover:scale-105">
                  <Video size={20} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-white group-hover:text-violet-300 transition-colors">Studio Khóa học & Video</p>
                  <p className="mt-0.5 text-xs text-slate-400">Soạn bài giảng, đăng tải video mới</p>
                </div>
                <ChevronRight size={16} className="shrink-0 text-slate-500 transition group-hover:translate-x-1 group-hover:text-white" />
              </button>
            </motion.div>
          </div>

          {/* Right Column (4 cols): Wallet & Recent Activities */}
          <div className="space-y-6 lg:col-span-4">
            {/* Total Earnings Wallet */}
            <motion.div
              variants={dashboardFadeUp}
              className="relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-b from-[#181128]/95 to-[#10081d]/95 p-6 shadow-[0_16px_48px_rgba(0,0,0,0.4)] backdrop-blur-xl"
            >
              <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#93f72b]/30 to-transparent" />
              
              <div className="flex items-center justify-between">
                <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Ví hoa hồng
                </p>
                <span className="flex h-8 w-8 items-center justify-center rounded-xl border border-emerald-500/30 bg-emerald-500/15 text-emerald-400 shadow-[0_0_12px_rgba(16,185,129,0.25)]">
                  <Landmark size={15} />
                </span>
              </div>
              <p className="mt-4 text-3xl font-black tracking-tight text-white">
                <MentorMoneyText amount={stats.totalEarned} />
              </p>
              <div className="mt-4 flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2.5">
                <span className="text-xs text-slate-400 font-medium">Khả dụng để rút:</span>
                <MentorMoneyText amount={stats.availableBalance} className="text-xs font-bold text-[#93f72b]" />
              </div>
              <motion.button
                type="button"
                onClick={() => navigate("/mentor/finance")}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-[#93f72b] px-4 py-3 text-xs font-bold uppercase tracking-wider text-slate-950 shadow-[0_0_20px_rgba(147,247,43,0.3)] transition hover:bg-[#a8ff4e]"
              >
                <Wallet size={15} />
                <span>Rút tiền về tài khoản</span>
              </motion.button>
            </motion.div>

            {/* Recent Completed Sessions */}
            <motion.div
              variants={dashboardFadeUp}
              className="rounded-2xl border border-white/10 bg-[#160f26]/85 backdrop-blur-xl p-6 shadow-[0_16px_40px_rgba(0,0,0,0.35)]"
            >
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Hoàn thành gần đây
              </h3>
              {recentCompleted.length === 0 ? (
                <p className="mt-4 text-xs text-slate-400">Chưa có buổi phỏng vấn nào hoàn thành gần đây</p>
              ) : (
                <div className="mt-4 space-y-3">
                  {recentCompleted.map((meeting, idx) => (
                    <motion.div
                      key={meeting.id}
                      initial={{ opacity: 0, x: 10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.15 + idx * 0.05, duration: 0.35 }}
                      role="button"
                      tabIndex={0}
                      onClick={() => setSelectedMeeting(meeting)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") setSelectedMeeting(meeting);
                      }}
                      className="group flex cursor-pointer items-center gap-3 rounded-xl p-2.5 transition-all duration-200 hover:bg-white/5"
                    >
                      <img
                        src={meeting.mentee.avatar}
                        alt=""
                        className="h-9 w-9 rounded-xl object-cover border border-white/10"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-bold text-white group-hover:text-[#93f72b] transition-colors">{meeting.mentee.name}</p>
                        <p className="text-[11px] text-slate-400 mt-0.5">
                          {formatMeetingDate(meeting.scheduledDate, meeting.scheduledTime)}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-1 text-[#93f72b]">
                        <Star size={12} className="fill-current" />
                        <span className="text-xs font-bold">
                          {meeting.overallScore > 0 ? meeting.overallScore.toFixed(1) : "—"}
                        </span>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
              <button
                type="button"
                onClick={() => navigate("/mentor/analytics")}
                className="mt-5 text-xs font-bold uppercase tracking-wider text-slate-400 transition hover:text-[#93f72b]"
              >
                Xem toàn bộ lịch sử →
              </button>
            </motion.div>

            {/* Peer Review Callout — Dark Luxury */}
            <motion.div
              variants={dashboardFadeUp}
              className="relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-violet-950/40 via-[#160f26]/90 to-[#10091e]/90 p-6 shadow-[0_16px_48px_rgba(0,0,0,0.4)] backdrop-blur-xl group"
            >
              <div className="mb-4 flex h-20 items-center justify-center rounded-xl border border-dashed border-white/15 bg-white/[0.02]">
                <FileBadge size={32} className="text-[#93f72b]/60 transition-transform group-hover:scale-110" strokeWidth={1.5} />
              </div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-[#93f72b]">
                ● Đánh giá chéo khóa học
              </p>
              <h3 className="mt-2 text-base font-bold text-white">
                Góp ý &amp; nhận điểm thưởng
              </h3>
              <p className="mt-1.5 text-xs leading-relaxed text-slate-400">
                Đánh giá chéo nội dung bài giảng cho đồng nghiệp và nhận điểm thưởng uy tín từ ProInterview.
              </p>
              <motion.button
                type="button"
                onClick={() => navigate("/mentor/peer-review")}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/5 py-2.5 text-xs font-bold uppercase tracking-wider text-white transition hover:border-[#93f72b]/50 hover:bg-[#93f72b]/10 hover:text-[#93f72b]"
              >
                Bắt đầu đánh giá ngay
                <ArrowRight size={14} />
              </motion.button>
            </motion.div>
          </div>
        </motion.div>
      </div>

      <AnimatePresence>
        {selectedMeeting && <MenteeProgressModal meeting={selectedMeeting} onClose={() => setSelectedMeeting(null)} />}
      </AnimatePresence>
    </MentorPageShell>
  );
}
