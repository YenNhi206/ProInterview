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
  Target,
  Zap as Lightning,
  Wallet,
  Users,
  Quote,
  FileBadge,
  Video,
  GraduationCap,
  ShieldCheck,
  Mail,
  BookOpen,
  GitBranch,
  LayoutGrid,
  Sparkles,
  ClipboardList,
  CheckCircle2,
  Clock,
  User,
  Code,
  Briefcase,
} from "lucide-react";
import { getUser, getDisplayName } from "../../utils/auth/auth.js";
import { MentorPageShell } from "../../components/mentor/MentorPageShell";
import { MentorMoneyText } from "../../utils/shared/moneyDisplay.jsx";
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

  const [activeTab, setActiveTab] = useState("all");

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
  const upcomingMeetings = (dashboardUpcoming.length ? dashboardUpcoming : apiUpcoming).slice(0, 5);
  const recentCompleted = mentorBookings
    .filter((m) => String(m.status || "").toLowerCase() === "completed")
    .slice(0, 6);
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
  const featuredReview = pickFeaturedTestimonial(mentorBookings);

  const meetingDayKeys = new Set();
  mentorBookings.forEach((m) => {
    const k = bookingDateKey(m.scheduledDate);
    if (k) meetingDayKeys.add(k);
  });

  const upcomingCount = upcomingMeetings.length;

  const tabSessions = (() => {
    if (activeTab === "upcoming") return upcomingMeetings;
    if (activeTab === "completed") return recentCompleted;
    return [...upcomingMeetings, ...recentCompleted].slice(0, 7);
  })();

  return (
    <MentorPageShell bottomPad="pb-24" showAmbient={false} className="relative bg-transparent text-white [html[data-workspace-theme=light]_&]:text-slate-900 overflow-hidden">
      {/* Background Lighting Depth */}
      <div className="pointer-events-none absolute -top-40 left-1/4 h-[500px] w-[600px] rounded-full bg-violet-600/10 blur-[140px]" />
      <div className="pointer-events-none absolute top-40 right-10 h-[400px] w-[500px] rounded-full bg-[#93f72b]/05 blur-[150px]" />

      <div className="relative z-10 mx-auto max-w-7xl px-4 pb-12 sm:px-6 lg:px-8">

        {/* 1. Header / Greeting Row */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between pt-1"
        >
          <div>
            <h1 className="font-headline text-2xl font-black tracking-tight text-white [html[data-workspace-theme=light]_&]:text-slate-900 sm:text-3xl">
              Chào mừng
            </h1>
            <p className="text-xs text-slate-400 [html[data-workspace-theme=light]_&]:text-slate-500 mt-0.5">
              Trung tâm điều phối phỏng vấn &amp; quản trị hoạt động cố vấn ProInterview
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => navigate("/mentor/schedule")}
              className="inline-flex items-center gap-2 rounded-xl bg-[#2563eb] [html[data-workspace-theme=dark]_&]:bg-[#93f72b] [html[data-workspace-theme=dark]_&]:text-slate-950 px-4 py-2 text-xs font-bold text-white shadow-sm transition hover:opacity-95"
            >
              <CalendarBlank size={14} />
              <span>Tạo lịch trống mới</span>
            </button>
            <button
              type="button"
              onClick={() => navigate("/mentor/requests")}
              className="inline-flex items-center gap-1.5 rounded-xl border border-white/15 bg-white/5 [html[data-workspace-theme=light]_&]:bg-white [html[data-workspace-theme=light]_&]:border-[#e2daf3] px-3.5 py-2 text-xs font-semibold text-slate-300 [html[data-workspace-theme=light]_&]:text-slate-700 transition hover:bg-white/10"
            >
              <ClipboardList size={14} />
              <span>Nhu cầu mentee</span>
            </button>
          </div>
        </motion.div>

        {/* 2. Top Bento Info Strip (Matching the Student/Mentor Portal Reference) */}
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, delay: 0.05 }}
          className="mb-6 grid grid-cols-1 gap-3.5 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-12"
        >
          {/* Card 1: Highlighted Profile Card */}
          <div className="lg:col-span-4 rounded-2xl p-4 sm:p-5 flex items-center gap-4 bg-gradient-to-r from-[#1d4ed8] via-[#2563eb] to-[#3b82f6] text-white shadow-md border border-blue-400/20 [html[data-workspace-theme=dark]_&]:bg-gradient-to-r [html[data-workspace-theme=dark]_&]:from-[#2b164f] [html[data-workspace-theme=dark]_&]:via-[#341a60] [html[data-workspace-theme=dark]_&]:to-[#1e0e3b] [html[data-workspace-theme=dark]_&]:border-violet-500/30">
            <div className="size-13 sm:size-14 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center shrink-0 border border-white/25 shadow-inner">
              <GraduationCap size={26} className="text-white" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-bold uppercase tracking-wider text-white/80">
                THÔNG TIN CỐ VẤN
              </p>
              <h2 className="text-base sm:text-lg font-bold text-white truncate mt-0.5 font-headline">
                {displayName}
              </h2>
              <p className="text-xs text-white/80 truncate mt-0.5">
                {user?.email || "Mentor ProInterview"}
              </p>
            </div>
          </div>

          {/* Card 2: Trạng thái */}
          <div className="lg:col-span-2 rounded-2xl border border-white/10 bg-[#160f26]/80 [html[data-workspace-theme=light]_&]:bg-white [html[data-workspace-theme=light]_&]:border-[#e5dfef] [html[data-workspace-theme=light]_&]:shadow-sm p-4 flex flex-col justify-between">
            <div className="flex items-center gap-1.5 text-slate-400 [html[data-workspace-theme=light]_&]:text-slate-500 text-[11px] font-bold uppercase tracking-wider">
              <ShieldCheck size={14} className="text-emerald-500" />
              <span>Trạng thái</span>
            </div>
            <p className="text-sm font-black text-white [html[data-workspace-theme=light]_&]:text-slate-900 mt-2 flex items-center gap-1.5">
              <span className="size-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>Sẵn sàng nhận lịch</span>
            </p>
          </div>

          {/* Card 3: Lĩnh vực / Chuyên môn */}
          <div className="lg:col-span-2 rounded-2xl border border-white/10 bg-[#160f26]/80 [html[data-workspace-theme=light]_&]:bg-white [html[data-workspace-theme=light]_&]:border-[#e5dfef] [html[data-workspace-theme=light]_&]:shadow-sm p-4 flex flex-col justify-between">
            <div className="flex items-center gap-1.5 text-slate-400 [html[data-workspace-theme=light]_&]:text-slate-500 text-[11px] font-bold uppercase tracking-wider">
              <Code size={14} className="text-blue-500" />
              <span>Lĩnh vực</span>
            </div>
            <p className="text-sm font-bold text-violet-400 [html[data-workspace-theme=light]_&]:text-violet-700 truncate mt-2">
              IT &amp; Phỏng vấn AI
            </p>
          </div>

          {/* Card 4: Tổng buổi mentor */}
          <div className="lg:col-span-2 rounded-2xl border border-white/10 bg-[#160f26]/80 [html[data-workspace-theme=light]_&]:bg-white [html[data-workspace-theme=light]_&]:border-[#e5dfef] [html[data-workspace-theme=light]_&]:shadow-sm p-4 flex flex-col justify-between">
            <div className="flex items-center gap-1.5 text-slate-400 [html[data-workspace-theme=light]_&]:text-slate-500 text-[11px] font-bold uppercase tracking-wider">
              <CalendarClock size={14} className="text-amber-500" />
              <span>Buổi đã mentor</span>
            </div>
            <p className="text-sm font-black text-white [html[data-workspace-theme=light]_&]:text-slate-900 mt-2">
              {stats.totalSessions} <span className="text-xs font-normal text-slate-400">buổi</span>
            </p>
          </div>

          {/* Card 5: Số dư khả dụng */}
          <div className="lg:col-span-2 rounded-2xl border border-white/10 bg-[#160f26]/80 [html[data-workspace-theme=light]_&]:bg-white [html[data-workspace-theme=light]_&]:border-[#e5dfef] [html[data-workspace-theme=light]_&]:shadow-sm p-4 flex flex-col justify-between">
            <div className="flex items-center gap-1.5 text-slate-400 [html[data-workspace-theme=light]_&]:text-slate-500 text-[11px] font-bold uppercase tracking-wider">
              <Wallet size={14} className="text-emerald-500" />
              <span>Khả dụng rút</span>
            </div>
            <p className="text-sm font-black text-[#93f72b] [html[data-workspace-theme=light]_&]:text-emerald-700 mt-2 truncate">
              {formatVnd(stats.availableBalance)}
            </p>
          </div>
        </motion.div>

        {/* 3. Main 2-Column Body (Left: News & Schedules, Right: Menu Nhanh) */}
        <div className="grid gap-6 lg:grid-cols-12 lg:items-start">
          
          {/* Left Column (8 cols): Lịch & Hoạt động gần đây */}
          <div className="space-y-6 lg:col-span-8">
            
            {/* Card: Lịch phỏng vấn & Hoạt động mới nhất (Kiểu "Tin tức mới nhất") */}
            <motion.div
              variants={dashboardFadeUp}
              initial="hidden"
              animate="visible"
              className="rounded-2xl border border-white/10 bg-[#160f26]/85 [html[data-workspace-theme=light]_&]:bg-white [html[data-workspace-theme=light]_&]:border-[#e5dfef] [html[data-workspace-theme=light]_&]:shadow-sm p-5 sm:p-6"
            >
              {/* Header */}
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-white/10 [html[data-workspace-theme=light]_&]:border-slate-100 pb-4">
                <div className="flex items-center gap-2.5">
                  <div className="size-8 rounded-lg bg-blue-500/15 [html[data-workspace-theme=light]_&]:bg-blue-50 text-blue-500 flex items-center justify-center">
                    <CalendarClock size={16} />
                  </div>
                  <div>
                    <h2 className="text-sm sm:text-base font-bold text-white [html[data-workspace-theme=light]_&]:text-slate-900 font-headline">
                      Lịch phỏng vấn &amp; Hoạt động gần đây
                    </h2>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => navigate("/mentor/schedule")}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#2563eb] [html[data-workspace-theme=dark]_&]:text-[#93f72b] transition hover:underline self-start sm:self-auto"
                >
                  <span>Xem tất cả</span>
                  <ArrowRight size={13} />
                </button>
              </div>

              {/* Filter Pills */}
              <div className="flex items-center gap-2 mt-4 flex-wrap">
                <button
                  type="button"
                  onClick={() => setActiveTab("all")}
                  className={`rounded-full px-3.5 py-1 text-xs font-bold transition-all ${
                    activeTab === "all"
                      ? "bg-[#2563eb] text-white shadow-sm [html[data-workspace-theme=dark]_&]:bg-[#93f72b] [html[data-workspace-theme=dark]_&]:text-slate-950"
                      : "bg-white/5 text-slate-400 hover:text-white [html[data-workspace-theme=light]_&]:bg-slate-100 [html[data-workspace-theme=light]_&]:text-slate-600 [html[data-workspace-theme=light]_&]:hover:bg-slate-200"
                  }`}
                >
                  Tất cả
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("upcoming")}
                  className={`rounded-full px-3.5 py-1 text-xs font-bold transition-all ${
                    activeTab === "upcoming"
                      ? "bg-[#2563eb] text-white shadow-sm [html[data-workspace-theme=dark]_&]:bg-[#93f72b] [html[data-workspace-theme=dark]_&]:text-slate-950"
                      : "bg-white/5 text-slate-400 hover:text-white [html[data-workspace-theme=light]_&]:bg-slate-100 [html[data-workspace-theme=light]_&]:text-slate-600 [html[data-workspace-theme=light]_&]:hover:bg-slate-200"
                  }`}
                >
                  Lịch sắp tới ({upcomingCount})
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("completed")}
                  className={`rounded-full px-3.5 py-1 text-xs font-bold transition-all ${
                    activeTab === "completed"
                      ? "bg-[#2563eb] text-white shadow-sm [html[data-workspace-theme=dark]_&]:bg-[#93f72b] [html[data-workspace-theme=dark]_&]:text-slate-950"
                      : "bg-white/5 text-slate-400 hover:text-white [html[data-workspace-theme=light]_&]:bg-slate-100 [html[data-workspace-theme=light]_&]:text-slate-600 [html[data-workspace-theme=light]_&]:hover:bg-slate-200"
                  }`}
                >
                  Đã hoàn thành ({recentCompleted.length})
                </button>
              </div>

              {/* Items List */}
              <div className="mt-4 divide-y divide-white/5 [html[data-workspace-theme=light]_&]:divide-slate-100">
                {tabSessions.length === 0 ? (
                  <div className="py-10 text-center">
                    <p className="text-xs text-slate-400 [html[data-workspace-theme=light]_&]:text-slate-500">
                      Không có hoạt động nào trong mục này.
                    </p>
                  </div>
                ) : (
                  tabSessions.map((meeting) => (
                    <div
                      key={meeting.id}
                      onClick={() => {
                        if (String(meeting.status || "").toLowerCase() === "completed") {
                          setSelectedMeeting(meeting);
                        } else {
                          navigate(`/mentor/meeting-detail/${meeting.id}`);
                        }
                      }}
                      className="group flex cursor-pointer items-center justify-between gap-3 py-3 px-2 rounded-xl transition hover:bg-white/5 [html[data-workspace-theme=light]_&]:hover:bg-slate-50"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="size-9 rounded-xl bg-violet-500/15 text-violet-400 [html[data-workspace-theme=light]_&]:bg-violet-50 [html[data-workspace-theme=light]_&]:text-violet-600 flex items-center justify-center shrink-0">
                          <BookOpen size={16} />
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs sm:text-sm font-semibold text-white [html[data-workspace-theme=light]_&]:text-slate-900 group-hover:text-[#2563eb] [html[data-workspace-theme=dark]_&]:group-hover:text-[#93f72b] transition-colors truncate">
                            {meeting.mentee?.name ? `[${meeting.sessionTypeLabel || "Tư vấn"}] Phỏng vấn cùng ${meeting.mentee.name}` : meeting.sessionTypeLabel || "Buổi phỏng vấn 1:1"}
                          </p>
                          <div className="flex items-center gap-2 mt-0.5 text-[11px] text-slate-400 [html[data-workspace-theme=light]_&]:text-slate-500">
                            <span className="inline-flex items-center gap-1">
                              <Clock size={11} />
                              {meeting.scheduledTime} - {formatMeetingDate(meeting.scheduledDate, meeting.scheduledTime)}
                            </span>
                            <span>•</span>
                            <span className="truncate">{meeting.position || "Candidate"}</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <span className={`text-[10px] font-bold rounded-full px-2.5 py-0.5 ${
                          String(meeting.status).toLowerCase() === "completed"
                            ? "bg-emerald-500/15 text-emerald-400 [html[data-workspace-theme=light]_&]:bg-emerald-50 [html[data-workspace-theme=light]_&]:text-emerald-700"
                            : "bg-blue-500/15 text-blue-400 [html[data-workspace-theme=light]_&]:bg-blue-50 [html[data-workspace-theme=light]_&]:text-blue-700"
                        }`}>
                          {String(meeting.status).toLowerCase() === "completed" ? "Hoàn thành" : "Đã xác nhận"}
                        </span>
                        <ChevronRight size={14} className="text-slate-400 group-hover:translate-x-0.5 transition" />
                      </div>
                    </div>
                  ))
                )}
              </div>
            </motion.div>

            {/* Card: Lịch trình tháng (Mini Calendar) */}
            <motion.div
              variants={dashboardFadeUp}
              initial="hidden"
              animate="visible"
              className="rounded-2xl border border-white/10 bg-[#160f26]/85 [html[data-workspace-theme=light]_&]:bg-white [html[data-workspace-theme=light]_&]:border-[#e5dfef] [html[data-workspace-theme=light]_&]:shadow-sm p-5 sm:p-6"
            >
              <div className="flex items-center justify-between border-b border-white/10 [html[data-workspace-theme=light]_&]:border-slate-100 pb-4 mb-4">
                <div className="flex items-center gap-2">
                  <div className="size-8 rounded-lg bg-emerald-500/15 [html[data-workspace-theme=light]_&]:bg-emerald-50 text-emerald-500 flex items-center justify-center">
                    <CalendarBlank size={16} />
                  </div>
                  <h3 className="text-sm sm:text-base font-bold text-white [html[data-workspace-theme=light]_&]:text-slate-900 font-headline">
                    Lịch tháng &amp; Khung giờ
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => navigate("/mentor/schedule")}
                  className="text-xs font-semibold text-[#2563eb] [html[data-workspace-theme=dark]_&]:text-[#93f72b] hover:underline"
                >
                  Mở trang lịch đầy đủ →
                </button>
              </div>

              <div className="flex flex-col lg:flex-row gap-6 items-start">
                <MentorMiniCalendar
                  highlightedDays={meetingDayKeys}
                  viewDate={calendarView}
                  onViewDateChange={setCalendarView}
                />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-400 [html[data-workspace-theme=light]_&]:text-slate-500 mb-2">
                    Lịch hẹn 7 ngày tới ({upcomingCount})
                  </p>
                  {upcomingMeetings.length === 0 ? (
                    <div className="py-6 text-center border border-dashed border-white/10 [html[data-workspace-theme=light]_&]:border-slate-200 rounded-xl">
                      <p className="text-xs text-slate-400">Không có lịch hẹn nào trong 7 ngày tới</p>
                      <button
                        type="button"
                        onClick={() => navigate("/mentor/schedule")}
                        className="mt-2 text-xs font-bold text-[#2563eb] [html[data-workspace-theme=dark]_&]:text-[#93f72b] hover:underline"
                      >
                        + Tạo khung giờ trống ngay
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {upcomingMeetings.slice(0, 3).map((m) => (
                        <div
                          key={m.id}
                          onClick={() => navigate(`/mentor/meeting-detail/${m.id}`)}
                          className="flex items-center justify-between p-3 rounded-xl border border-white/10 bg-white/[0.02] [html[data-workspace-theme=light]_&]:bg-slate-50 [html[data-workspace-theme=light]_&]:border-slate-200 cursor-pointer hover:border-violet-500/40 transition"
                        >
                          <div className="min-w-0">
                            <p className="text-xs font-bold text-white [html[data-workspace-theme=light]_&]:text-slate-900 truncate">{m.mentee?.name}</p>
                            <p className="text-[11px] text-slate-400 mt-0.5">{m.scheduledTime} - {m.scheduledDate}</p>
                          </div>
                          <span className="text-xs font-bold text-[#2563eb] [html[data-workspace-theme=dark]_&]:text-[#93f72b]">Vào phòng →</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </motion.div>

            {/* Testimonial Ribbon */}
            {featuredReview?.quote && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-2xl border border-white/10 bg-gradient-to-r from-violet-950/40 via-[#160f26]/85 to-[#120a20]/85 [html[data-workspace-theme=light]_&]:bg-gradient-to-r [html[data-workspace-theme=light]_&]:from-violet-50 [html[data-workspace-theme=light]_&]:via-white [html[data-workspace-theme=light]_&]:to-violet-50/50 [html[data-workspace-theme=light]_&]:border-violet-200 p-5"
              >
                <div className="flex items-start gap-3">
                  <div className="size-9 rounded-xl bg-violet-500/20 text-[#93f72b] [html[data-workspace-theme=light]_&]:text-violet-600 flex items-center justify-center shrink-0">
                    <Quote size={16} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs sm:text-sm italic text-slate-200 [html[data-workspace-theme=light]_&]:text-slate-700 leading-relaxed">
                      &ldquo;{featuredReview.quote}&rdquo;
                    </p>
                    <div className="mt-2 flex items-center gap-2 text-xs">
                      <span className="font-bold text-white [html[data-workspace-theme=light]_&]:text-slate-900">{featuredReview.author}</span>
                      <span className="text-slate-500">•</span>
                      <span className="text-amber-400 font-bold">★ {featuredReview.rating} / 5.0</span>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

          </div>

          {/* Right Column (4 cols): Menu Nhanh (Matching FPT Portal Reference) */}
          <div className="space-y-6 lg:col-span-4">
            
            {/* Card: Menu Nhanh */}
            <motion.div
              variants={dashboardFadeUp}
              initial="hidden"
              animate="visible"
              className="rounded-2xl border border-white/10 bg-[#160f26]/85 [html[data-workspace-theme=light]_&]:bg-white [html[data-workspace-theme=light]_&]:border-[#e5dfef] [html[data-workspace-theme=light]_&]:shadow-sm p-5 sm:p-6"
            >
              {/* Header: Menu Nhanh */}
              <div className="flex items-center gap-3 border-b border-white/10 [html[data-workspace-theme=light]_&]:border-slate-100 pb-4">
                <div className="size-10 rounded-xl bg-[#2563eb] text-white flex items-center justify-center shrink-0 shadow-sm">
                  <LayoutGrid size={20} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white [html[data-workspace-theme=light]_&]:text-slate-900 font-headline">
                    Menu nhanh
                  </h3>
                  <p className="text-[11px] text-slate-400 [html[data-workspace-theme=light]_&]:text-slate-500">
                    Truy cập nhanh các chức năng thường dùng
                  </p>
                </div>
              </div>

              {/* Group 1: Tác vụ cố vấn */}
              <div className="mt-4">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 [html[data-workspace-theme=light]_&]:text-slate-400 px-2 mb-1.5 flex items-center gap-1.5">
                  <span className="size-1 rounded-full bg-[#2563eb] [html[data-workspace-theme=dark]_&]:bg-[#93f72b]" />
                  <span>HỌC TẬP &amp; PHÒNG HỌP</span>
                </p>
                <div className="space-y-0.5">
                  {[
                    { label: "Lịch trình & Khung giờ rảnh", path: "/mentor/schedule", icon: CalendarBlank },
                    { label: "Nhu cầu mentee mới", path: "/mentor/requests", icon: ClipboardList },
                    { label: "Lộ trình học viên", path: "/mentor/learning-paths", icon: GitBranch },
                    { label: "Studio Khóa học & Video", path: "/mentor/courses", icon: BookOpen },
                  ].map((item) => {
                    const Icon = item.icon;
                    return (
                      <button
                        key={item.path}
                        type="button"
                        onClick={() => navigate(item.path)}
                        className="group flex w-full items-center justify-between gap-3 px-3 py-2.5 rounded-xl text-left text-xs font-semibold text-slate-300 [html[data-workspace-theme=light]_&]:text-slate-700 hover:bg-white/5 [html[data-workspace-theme=light]_&]:hover:bg-violet-50/70 [html[data-workspace-theme=light]_&]:hover:text-[#2563eb] transition-all"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="size-7 rounded-lg bg-white/5 [html[data-workspace-theme=light]_&]:bg-slate-100 flex items-center justify-center text-slate-400 [html[data-workspace-theme=light]_&]:text-slate-600 group-hover:text-[#2563eb] [html[data-workspace-theme=dark]_&]:group-hover:text-[#93f72b] transition-colors">
                            <Icon size={14} />
                          </div>
                          <span className="truncate">{item.label}</span>
                        </div>
                        <ChevronRight size={13} className="text-slate-500 group-hover:translate-x-0.5 transition-transform" />
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Group 2: Tài chính & Uy tín */}
              <div className="mt-4 pt-3 border-t border-white/5 [html[data-workspace-theme=light]_&]:border-slate-100">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 [html[data-workspace-theme=light]_&]:text-slate-400 px-2 mb-1.5 flex items-center gap-1.5">
                  <span className="size-1 rounded-full bg-emerald-500" />
                  <span>TÀI CHÍNH &amp; UY TÍN</span>
                </p>
                <div className="space-y-0.5">
                  {[
                    { label: "Ví hoa hồng & Rút tiền", path: "/mentor/finance", icon: Wallet },
                    { label: "Đánh giá & Báo cáo", path: "/mentor/reviews", icon: Star },
                    { label: "Đánh giá chéo bài giảng", path: "/mentor/peer-review", icon: FileBadge },
                    { label: "Hồ sơ cố vấn công khai", path: "/profile", icon: User },
                  ].map((item) => {
                    const Icon = item.icon;
                    return (
                      <button
                        key={item.path}
                        type="button"
                        onClick={() => navigate(item.path)}
                        className="group flex w-full items-center justify-between gap-3 px-3 py-2.5 rounded-xl text-left text-xs font-semibold text-slate-300 [html[data-workspace-theme=light]_&]:text-slate-700 hover:bg-white/5 [html[data-workspace-theme=light]_&]:hover:bg-violet-50/70 [html[data-workspace-theme=light]_&]:hover:text-[#2563eb] transition-all"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="size-7 rounded-lg bg-white/5 [html[data-workspace-theme=light]_&]:bg-slate-100 flex items-center justify-center text-slate-400 [html[data-workspace-theme=light]_&]:text-slate-600 group-hover:text-[#2563eb] [html[data-workspace-theme=dark]_&]:group-hover:text-[#93f72b] transition-colors">
                            <Icon size={14} />
                          </div>
                          <span className="truncate">{item.label}</span>
                        </div>
                        <ChevronRight size={13} className="text-slate-500 group-hover:translate-x-0.5 transition-transform" />
                      </button>
                    );
                  })}
                </div>
              </div>
            </motion.div>

            {/* Card: Ví hoa hồng cố vấn */}
            <motion.div
              variants={dashboardFadeUp}
              initial="hidden"
              animate="visible"
              className="rounded-2xl border border-white/10 bg-[#160f26]/85 [html[data-workspace-theme=light]_&]:bg-white [html[data-workspace-theme=light]_&]:border-[#e5dfef] [html[data-workspace-theme=light]_&]:shadow-sm p-5 sm:p-6"
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 [html[data-workspace-theme=light]_&]:text-slate-500">
                  Ví hoa hồng
                </span>
                <span className="size-8 rounded-lg bg-emerald-500/15 text-emerald-400 [html[data-workspace-theme=light]_&]:bg-emerald-50 [html[data-workspace-theme=light]_&]:text-emerald-600 flex items-center justify-center">
                  <Landmark size={15} />
                </span>
              </div>
              <p className="mt-3 text-2xl sm:text-3xl font-black text-white [html[data-workspace-theme=light]_&]:text-slate-900 font-headline">
                <MentorMoneyText amount={stats.totalEarned} />
              </p>
              <div className="mt-3 flex items-center justify-between rounded-xl bg-white/[0.03] border border-white/10 [html[data-workspace-theme=light]_&]:bg-slate-50 [html[data-workspace-theme=light]_&]:border-slate-200 px-3 py-2 text-xs">
                <span className="text-slate-400 [html[data-workspace-theme=light]_&]:text-slate-500">Khả dụng:</span>
                <MentorMoneyText amount={stats.availableBalance} className="font-bold text-[#93f72b] [html[data-workspace-theme=light]_&]:text-emerald-600" />
              </div>
              <button
                type="button"
                onClick={() => navigate("/mentor/finance")}
                className="mt-4 w-full rounded-xl bg-[#2563eb] [html[data-workspace-theme=dark]_&]:bg-[#93f72b] [html[data-workspace-theme=dark]_&]:text-slate-950 py-2.5 text-xs font-bold text-white transition hover:opacity-95 shadow-sm"
              >
                Rút tiền về tài khoản →
              </button>
            </motion.div>

          </div>

        </div>

      </div>

      <AnimatePresence>
        {selectedMeeting && <MenteeProgressModal meeting={selectedMeeting} onClose={() => setSelectedMeeting(null)} />}
      </AnimatePresence>
    </MentorPageShell>
  );
}
