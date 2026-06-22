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
} from "lucide-react";
import { getUser, getDisplayName } from "../../utils/auth/auth.js";
import { MentorPageShell } from "../../components/mentor/MentorPageShell";
import { MentorMoneyText } from "../../utils/shared/moneyDisplay.jsx";
import {
  MentorStatPanel,
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

  const meetingTypeLabel = meeting.sessionTypeLabel || sessionTypeLabel(meeting.meetingType);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-6 backdrop-blur-sm bg-slate-900/35"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.9, y: 20, opacity: 0 }}
        animate={{ scale: 1, y: 0, opacity: 1 }}
        exit={{ scale: 0.9, y: 20, opacity: 0 }}
        className="glass-card w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh] shadow-[0_28px_80px_rgba(15,23,42,0.18)] border border-slate-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Header ── */}
        <div className="relative border-b border-slate-200 bg-gradient-to-br from-violet-50 to-white p-8">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-6">
               <div className="relative">
                  <img
                    src={meeting.mentee.avatar}
                    alt={meeting.mentee.name}
                    className="h-20 w-20 rounded-[28px] object-cover shadow-md ring-2 ring-violet-200"
                  />
                  <div className="absolute -bottom-2 -right-2 flex h-8 w-8 items-center justify-center rounded-xl bg-[#93f72b] text-slate-900 shadow-lg">
                     <SealCheck size={16} />
                  </div>
               </div>
               <div>
                  <div className="mb-2 flex items-center gap-3">
                     <span className="rounded-lg bg-slate-100 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-slate-700">{meetingTypeLabel}</span>
                     <span className="rounded-lg bg-violet-100 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-violet-800">{meeting.mentee.level}</span>
                  </div>
                  <h2 className="mb-1 text-xl font-black tracking-tighter text-slate-900 sm:text-2xl">{meeting.mentee.name}</h2>
                  <p className="text-sm font-medium text-slate-600">
                    {meeting.position}
                    {meeting.company ? ` · ${meeting.company}` : ""}
                  </p>
               </div>
            </div>
            <button type="button" onClick={onClose} className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 transition-all hover:border-slate-300 hover:text-slate-900">
               <X size={18} />
            </button>
          </div>
        </div>

        {/* ── Scrollable content ── */}
        <div className="overflow-y-auto p-8 space-y-10 custom-scrollbar">
           {/* Overall STAR Score */}
           <div className="flex items-center gap-10">
              <div className="relative w-32 h-32 flex-shrink-0 group">
                 <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
                    <circle cx="50" cy="50" r="42" fill="none" stroke="rgba(148,163,184,0.35)" strokeWidth="10" />
                    <motion.circle
                      initial={{ strokeDasharray: "0 264" }}
                      animate={{ strokeDasharray: `${(overall / 5) * 264} 264` }}
                      transition={{ duration: 1.5, ease: "easeOut" }}
                      cx="50" cy="50" r="42" fill="none"
                      stroke={scoreColor}
                      strokeWidth="10"
                      strokeLinecap="round"
                    />
                 </svg>
                 <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-xl font-black sm:text-2xl tracking-tighter" style={{ color: scoreColor }}>{overall.toFixed(1)}</span>
                    <span className="text-[10px] font-black uppercase tracking-widest opacity-50">Score</span>
                 </div>
              </div>

              <div>
                 <p className="text-[10px] font-black uppercase tracking-[0.3em] mb-2 text-violet-700">Đánh giá tổng thể</p>
                 <h4 className="mb-3 text-2xl font-black text-slate-900">{scoreLabel}</h4>
                 <div className="mb-4 flex items-center gap-2">
                    {[1, 2, 3, 4, 5].map((s) => (
                      <Star
                        key={s}
                        size={16}
                        className={s <= Math.round(overall) ? "text-[#FFD600] fill-[#FFD600]" : "text-slate-200"}
                      />
                    ))}
                 </div>
                 {meeting.feedback ? (
                   <p className="max-w-sm text-sm italic text-slate-600">&ldquo;{meeting.feedback}&rdquo;</p>
                 ) : (
                   <p className="max-w-sm text-sm text-slate-500">Chưa có nhận xét từ học viên.</p>
                 )}
              </div>
           </div>

           {/* STAR Framework Detail */}
           <div className="space-y-6">
              <h5 className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em] flex items-center gap-3">
                 <ChartBar size={14} className="text-violet-700" /> Phân tích khung năng lực STAR
              </h5>
              <div className="grid grid-cols-1 gap-5">
                 {starComponents.map((comp) => (
                   <div key={comp.key} className="space-y-3">
                      <div className="flex items-center justify-between">
                         <div className="flex items-center gap-3">
                            <div className="flex h-8 w-8 items-center justify-center rounded-xl text-xs font-black text-slate-900" style={{ background: comp.color }}>{comp.label[0]}</div>
                            <span className="text-xs font-bold text-slate-700">{comp.label}</span>
                         </div>
                         <span className="text-xs font-black text-slate-900">{comp.value.toFixed(1)}/5.0</span>
                      </div>
                      <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
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
           <div className="grid md:grid-cols-2 gap-6">
              <div className="p-6 rounded-[28px] bg-primary-fixed/[0.03] border border-primary-fixed/10">
                 <h6 className="text-[10px] font-black text-violet-700 uppercase tracking-widest mb-4 flex items-center gap-2">
                    <Lightning size={12} /> Điểm mạnh
                 </h6>
                 <ul className="space-y-3">
                    {(meeting.strengths?.length ? meeting.strengths : ["Chưa có dữ liệu"]).map((s, i) => (
                      <li key={i} className="flex items-start gap-2 text-xs font-medium text-slate-700">
                         <span className="w-1.5 h-1.5 rounded-full bg-primary-fixed mt-1.5 shrink-0" />
                         {s}
                      </li>
                    ))}
                 </ul>
              </div>
              <div className="p-6 rounded-[28px] bg-orange-500/[0.03] border border-orange-500/10">
                 <h6 className="text-[10px] font-black text-orange-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                    <Target size={12} /> Cần cải thiện
                 </h6>
                 <ul className="space-y-3">
                    {(meeting.improvements?.length ? meeting.improvements : ["Chưa có dữ liệu"]).map((s, i) => (
                      <li key={i} className="flex items-start gap-2 text-xs font-medium text-slate-700">
                         <span className="w-1.5 h-1.5 rounded-full bg-orange-400 mt-1.5 shrink-0" />
                         {s}
                      </li>
                    ))}
                 </ul>
              </div>
           </div>
        </div>

        {/* ── Footer ── */}
        <div className="flex items-center justify-between gap-4 border-t border-slate-200 bg-slate-50 p-6">
           <button
              type="button"
              onClick={() => navigate(`/mentor/meeting-detail/${meeting.id}`)}
              className="flex-1 rounded-2xl bg-violet-600 px-6 py-4 text-[10px] font-black uppercase tracking-widest text-white shadow-lg transition-all hover:bg-violet-700"
           >
              Xem báo cáo chi tiết
           </button>
           <button
              type="button"
              onClick={onClose}
              className="rounded-2xl border border-slate-200 bg-white px-8 py-4 text-[10px] font-black uppercase tracking-widest text-slate-600 transition-all hover:border-slate-300 hover:text-slate-900"
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
    .filter((m) => m.feedback && Number(m.overallScore) >= 4)
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
      "Tư vấn CV chi tiết, chỉ ra điểm yếu và cách sửa cụ thể trên từng mục.",
    author: "Khách hàng Dev",
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
    <div className="w-full max-w-[280px] shrink-0 lg:border-r lg:border-slate-100 lg:pr-8">
      <div className="mb-4 flex items-center justify-between gap-2">
        <button
          type="button"
          aria-label="Tháng trước"
          onClick={() => onViewDateChange(new Date(year, month - 1, 1))}
          className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-50 hover:text-violet-700"
        >
          ‹
        </button>
        <span className="text-sm font-bold text-slate-800">{monthLabel}</span>
        <button
          type="button"
          aria-label="Tháng sau"
          onClick={() => onViewDateChange(new Date(year, month + 1, 1))}
          className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-50 hover:text-violet-700"
        >
          ›
        </button>
      </div>
      <div className="grid grid-cols-7 gap-y-1 text-center text-[11px] font-semibold text-slate-400">
        {["T2", "T3", "T4", "T5", "T6", "T7", "CN"].map((d) => (
          <span key={d} className="py-1.5">
            {d}
          </span>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-y-1">
        {cells.map((day, idx) => {
          if (!day) return <div key={`e-${idx}`} className="h-9" />;
          const key = `${year}-${month}-${day}`;
          const isToday =
            today.getFullYear() === year && today.getMonth() === month && today.getDate() === day;
          const hasMeeting = highlightedDays.has(key);
          return (
            <div key={key} className="flex h-9 items-center justify-center">
              <span
                className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium ${
                  isToday
                    ? "bg-[#8037f4] font-bold text-white"
                    : hasMeeting
                      ? "bg-violet-100 font-semibold text-violet-800"
                      : "text-slate-700"
                }`}
              >
                {day}
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
  hidden: { opacity: 0, y: 22 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.45, ease: [0.22, 1, 0.36, 1] },
  },
};

const dashboardStagger = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.1, delayChildren: 0.12 },
  },
};

const meetingRowFade = {
  hidden: { opacity: 0, x: 14 },
  visible: (i) => ({
    opacity: 1,
    x: 0,
    transition: {
      delay: i * 0.07,
      duration: 0.38,
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
    <MentorPageShell bottomPad="pb-20" showAmbient={false} className="!bg-[#f8f9fc]">
      <div className="relative z-10 mx-auto max-w-[1280px] px-4 pb-12 sm:px-6 lg:px-10">

        {/* Hero */}
        <motion.header
          initial={{ opacity: 0, y: -14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          className="mb-8 flex flex-col gap-8 pt-2 lg:flex-row lg:items-start lg:justify-between"
        >
          <div className="max-w-2xl flex-1">
            <h1 className="font-headline text-[clamp(1.75rem,3.5vw,2.5rem)] font-extrabold leading-[1.12] tracking-tight text-slate-900">
              Xin chào,{" "}
              <span className="text-[#8037f4]">{displayName}</span>
            </h1>
            <p className="mt-4 text-sm leading-relaxed text-slate-600 sm:text-[15px]">
              Theo dõi lịch tư vấn, dòng thu nhập và đánh giá chéo khóa học.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <motion.button
                type="button"
                onClick={() => navigate("/mentor/schedule")}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="inline-flex items-center justify-center gap-2.5 rounded-lg bg-slate-900 px-5 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-[#1a0d35]"
              >
                <span className="size-2 shrink-0 rounded-full bg-[#93f72b]" aria-hidden />
                Tạo lịch mới
              </motion.button>
              <button
                type="button"
                onClick={() => navigate("/mentor/schedule")}
                className="inline-flex items-center justify-center gap-2.5 rounded-lg border-2 border-slate-900 bg-white px-5 py-3 text-sm font-bold text-slate-900 transition hover:bg-slate-50"
              >
                <CalendarBlank size={16} strokeWidth={2.25} aria-hidden />
                Xem lịch trình
              </button>
            </div>
          </div>

          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.45, delay: 0.1 }}
            className="flex shrink-0 flex-col items-center text-center lg:items-end lg:text-right"
          >
            <div className="relative flex h-[188px] w-[188px] items-center justify-center overflow-hidden rounded-2xl border-2 border-dashed border-slate-200 bg-white shadow-sm sm:h-[200px] sm:w-[200px]">
              {mentorAvatar ? (
                <img
                  src={mentorAvatar}
                  alt={displayName}
                  className="h-full w-full object-cover"
                />
              ) : (
                <User size={56} className="text-slate-300" strokeWidth={1.5} />
              )}
            </div>
            <p className="mt-3 font-headline text-base font-black text-slate-900">{displayName}</p>
          </motion.div>
        </motion.header>

        {/* Stats */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, delay: 0.08, ease: [0.22, 1, 0.36, 1] }}
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

        {/* Testimonial */}
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, delay: 0.12, ease: [0.22, 1, 0.36, 1] }}
          className="mb-8 rounded-2xl bg-[#93f72b] px-6 py-6 sm:px-8 sm:py-7"
        >
          <Quote
            size={28}
            className="mb-3 text-slate-900/35"
            fill="currentColor"
            strokeWidth={0}
          />
          <p className="font-headline text-lg font-bold leading-snug text-slate-900 sm:text-xl">
            &ldquo;{featuredReview.quote}&rdquo;
          </p>
          <p className="mt-4 text-[11px] font-bold uppercase tracking-wider text-slate-800/75">
            {featuredReview.author} · Đánh giá {featuredReview.rating} / 5 sao
          </p>
        </motion.div>

        {/* Main grid */}        <motion.div
          variants={dashboardStagger}
          initial="hidden"
          animate="visible"
          className="grid gap-6 lg:grid-cols-12 lg:items-start"
        >
          <div className="space-y-5 lg:col-span-8">
            <motion.div
              variants={dashboardFadeUp}
              className="overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-[0_1px_3px_rgba(15,23,42,0.04)] transition-shadow duration-300 hover:shadow-[0_8px_28px_rgba(128,55,244,0.08)]"
            >
              <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-4 sm:px-6">
                <h2 className="font-headline text-sm font-black text-slate-900">
                  <span className="text-slate-400">{padStat(upcomingCount)}</span>{" "}
                  Lịch phỏng vấn sắp tới
                </h2>
                <button
                  type="button"
                  onClick={() => navigate("/mentor/schedule")}
                  className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500 transition hover:text-violet-700"
                >
                  Tất cả lịch trình →
                </button>
              </div>

              <div className="flex flex-col gap-6 p-5 sm:p-6 lg:flex-row lg:gap-0">
                <MentorMiniCalendar
                  highlightedDays={meetingDayKeys}
                  viewDate={calendarView}
                  onViewDateChange={setCalendarView}
                />

                {upcomingMeetings.length === 0 ? (
                  <motion.div
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.25, duration: 0.4 }}
                    className="flex min-h-[220px] flex-1 flex-col justify-center lg:pl-8"
                  >
                    <p className="text-lg font-bold text-slate-900">
                      Chưa có buổi phỏng vấn nào được lên lịch
                    </p>
                    <p className="mt-2 max-w-md text-sm leading-relaxed text-slate-500">
                      Tạo lịch mới để mentee có thể đặt buổi tư vấn với bạn.
                    </p>
                    <button
                      type="button"
                      onClick={() => navigate("/mentor/schedule")}
                      className="mt-4 inline-flex w-fit items-center gap-1 text-sm font-semibold text-[#8037f4] hover:underline"
                    >
                      Tạo lịch mới →
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
                        className="group flex cursor-pointer items-center justify-between gap-4 rounded-xl border border-slate-100 bg-slate-50/50 p-4 transition-[background-color,border-color,box-shadow,transform] duration-200 hover:-translate-y-0.5 hover:border-violet-200 hover:bg-violet-50/40 hover:shadow-[0_6px_18px_rgba(128,55,244,0.08)]"
                      >
                        <div className="flex min-w-0 items-center gap-3">
                          <img
                            src={meeting.mentee.avatar}
                            alt=""
                            className="h-11 w-11 shrink-0 rounded-full object-cover"
                          />
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-slate-900">{meeting.mentee.name}</p>
                            <p className="text-xs text-slate-500">
                              {meeting.sessionTypeLabel || meeting.position}
                            </p>
                          </div>
                        </div>
                        <div className="shrink-0 text-right">
                          <p className="text-sm font-bold text-[#8037f4]">{meeting.scheduledTime}</p>
                          <p className="text-xs text-slate-500">
                            {formatMeetingDate(meeting.scheduledDate, meeting.scheduledTime)}
                          </p>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>

            <motion.div variants={dashboardFadeUp} className="grid gap-4 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => navigate("/mentor/schedule")}
                className="group flex items-center gap-4 rounded-2xl border border-violet-100 bg-[#8037f4]/[0.06] p-5 text-left transition-[border-color,box-shadow,transform] duration-200 hover:-translate-y-0.5 hover:border-violet-200 hover:shadow-[0_8px_22px_rgba(128,55,244,0.1)]"
              >
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#8037f4]/15 text-[#8037f4] transition-transform duration-200 group-hover:scale-110">
                  <CalendarBlank size={20} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-slate-900">Lịch trình</p>
                  <p className="mt-0.5 text-xs text-slate-500">Quản lý meetings &amp; tài liệu</p>
                </div>
                <ChevronRight size={18} className="shrink-0 text-slate-300 transition-transform duration-200 group-hover:translate-x-1 group-hover:text-violet-500" />
              </button>
              <button
                type="button"
                onClick={() => navigate("/mentor/finance")}
                className="group flex items-center gap-4 rounded-2xl border border-[#93f72b]/40 bg-[#93f72b]/15 p-5 text-left transition-[border-color,box-shadow,transform] duration-200 hover:-translate-y-0.5 hover:border-[#93f72b]/60 hover:shadow-[0_8px_22px_rgba(147,247,43,0.14)]"
              >
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#93f72b]/20 text-slate-900 transition-transform duration-200 group-hover:scale-110">
                  <Wallet size={20} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-slate-900">Tài chính</p>
                  <p className="mt-0.5 text-xs text-slate-500">Rút tiền về ví của bạn</p>
                </div>
                <ChevronRight size={18} className="shrink-0 text-slate-300 transition-transform duration-200 group-hover:translate-x-1 group-hover:text-slate-700" />
              </button>
            </motion.div>
          </div>

          <div className="space-y-5 lg:col-span-4">
            <motion.div
              variants={dashboardFadeUp}
              className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#8037f4] to-[#630ed4] p-6 text-white shadow-[0_8px_30px_rgba(128,55,244,0.28)]"
            >
              <motion.div
                animate={{ scale: [1, 1.08, 1], opacity: [0.25, 0.35, 0.25] }}
                transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full bg-violet-500/25"
                aria-hidden
              />
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-violet-200/90">
                Tổng thu nhập
              </p>
              <p className="mentor-stat-num mentor-stat-num--hero mentor-stat-num--on-dark mentor-stat-num--money mt-3">
                <MentorMoneyText amount={stats.totalEarned} />
              </p>
              <p className="mt-2 text-xs text-violet-200/90">
                Khả dụng để rút -{" "}
                <MentorMoneyText amount={stats.availableBalance} className="font-semibold" />
              </p>
              <motion.button
                type="button"
                onClick={() => navigate("/mentor/finance")}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-full bg-[#93f72b] py-3.5 text-sm font-bold text-slate-900 shadow-[0_8px_20px_rgba(147,247,43,0.35)] transition hover:brightness-105"
              >
                <Wallet size={16} />
                Rút tiền
              </motion.button>
            </motion.div>

            <motion.div
              variants={dashboardFadeUp}
              className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-[0_1px_3px_rgba(15,23,42,0.04)] transition-shadow duration-300 hover:shadow-[0_6px_20px_rgba(15,23,42,0.06)] sm:p-6"
            >
              <h3 className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">
                Hoàn thành gần đây
              </h3>
              {recentCompleted.length === 0 ? (
                <p className="mt-4 text-sm text-slate-500">Chưa có buổi hoàn thành gần đây</p>
              ) : (
                <div className="mt-4 space-y-3">
                  {recentCompleted.map((meeting, idx) => (
                    <motion.div
                      key={meeting.id}
                      initial={{ opacity: 0, x: 10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.2 + idx * 0.06, duration: 0.35 }}
                      role="button"
                      tabIndex={0}
                      onClick={() => setSelectedMeeting(meeting)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") setSelectedMeeting(meeting);
                      }}
                      className="group flex cursor-pointer items-center gap-3 rounded-lg p-1 transition-colors duration-200 hover:bg-slate-50"
                    >
                      <img
                        src={meeting.mentee.avatar}
                        alt=""
                        className="h-9 w-9 rounded-full object-cover grayscale transition group-hover:grayscale-0"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-slate-900">{meeting.mentee.name}</p>
                        <p className="text-xs text-slate-500">
                          {formatMeetingDate(meeting.scheduledDate, meeting.scheduledTime)}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-1 text-violet-700">
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
                className="mt-5 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500 transition hover:text-violet-700"
              >
                Xem toàn bộ lịch sử →
              </button>
            </motion.div>

            <motion.div
              variants={dashboardFadeUp}
              className="overflow-hidden rounded-2xl border border-slate-200/90 bg-white p-6 shadow-[0_1px_3px_rgba(15,23,42,0.04)] transition-shadow duration-300 hover:shadow-[0_8px_24px_rgba(128,55,244,0.1)]"
            >
              <div className="mb-4 flex h-24 items-center justify-center rounded-xl border-2 border-dashed border-slate-200 bg-slate-50">
                <FileBadge size={32} className="text-[#8037f4]/40" strokeWidth={1.5} />
              </div>
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#8037f4]">
                Đánh giá khóa học
              </p>
              <h3 className="mt-2 font-headline text-lg font-black text-slate-900">
                Góp ý &amp; nhận điểm thưởng
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-500">
                Đánh giá chéo nội dung cho đồng nghiệp và nhận điểm thưởng từ ProInterview.
              </p>
              <motion.button
                type="button"
                onClick={() => navigate("/mentor/peer-review")}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-full bg-slate-900 py-3 text-sm font-bold text-white transition hover:bg-[#8037f4]"
              >
                Bắt đầu ngay
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