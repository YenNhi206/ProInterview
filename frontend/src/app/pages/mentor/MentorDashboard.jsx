import { useState, useEffect } from "react";
import { useNavigate } from "react-router";
import { motion, AnimatePresence } from "motion/react";
import {
  Calendar as CalendarBlank,
  Users,
  Star,
  CheckCircle,
  CircleDollarSign as CurrencyCircleDollar,
  X,
  ArrowRight,
  BarChart3 as ChartBar,
  BadgeCheck as SealCheck,
  Target,
  ArrowUpRight,
  Plus,
  Zap as Lightning
} from "lucide-react";
import { getUser, getDisplayName } from "../../utils/auth";
import { MentorPageShell } from "../../components/mentor/MentorPageShell";
import { listMentorBookings } from "../../utils/bookingsApi";
import { fetchMentorDashboard } from "../../utils/mentorApi";
import { toastApiError } from "../../utils/apiToast";
import { avatarSrc, DEFAULT_AVATAR } from "../../utils/mediaUrl";
import { parseBookingNotes } from "../../utils/bookingMappers";
import { parseMentorNotesSections, sessionTypeLabel } from "../../utils/sessionTypeLabels";

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

/* ── Main Dashboard ────────────────────────────────────────────────────────── */
export function MentorDashboard() {
  const navigate = useNavigate();
  const user = getUser();
  const [selectedMeeting, setSelectedMeeting] = useState(null);
  const [mentorBookings, setMentorBookings] = useState([]);
  const [dashboard, setDashboard] = useState(null);

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

  const formatVnd = (amount) => `${Number(amount || 0).toLocaleString("vi-VN")} Đ`;

  return (
    <MentorPageShell bottomPad="pb-20">
      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(148,163,184,0.5); border-radius: 10px; }
      `}</style>
      <div className="relative z-10 mx-auto max-w-7xl px-6 pb-10 sm:px-8">
        <div className="mb-8 flex flex-col justify-between gap-4 md:mb-10 md:flex-row md:items-end md:gap-6">
          <div>
            <h1 className="font-headline text-2xl font-black tracking-tight text-slate-900 sm:text-3xl break-words">
               Xin chào,{" "}
               <span className="text-violet-700">{getDisplayName(user, "Mentor")}!</span>
            </h1>
          </div>
          <div className="flex flex-wrap gap-3">
              <button type="button" onClick={() => navigate("/mentor/finance")} className="flex items-center gap-2 rounded-xl bg-white border border-slate-200 px-5 py-2.5 text-xs font-bold text-slate-700 shadow-sm transition-all hover:bg-slate-50">
                 <CurrencyCircleDollar size={16} className="text-[#93f72b]" /> Tài chính
              </button>
              <button type="button" onClick={() => navigate("/mentor/schedule")} className="flex items-center gap-2 rounded-xl bg-[#8037f4] px-5 py-2.5 text-xs font-bold text-white shadow-[0_8px_24px_rgba(128,55,244,0.3)] transition-all hover:bg-violet-700 hover:brightness-105">
                 <CalendarBlank size={16} /> Quản lý Lịch
              </button>
          </div>
        </div>

        {/* Vital Stats Grid */}
        <div className="mb-8 grid grid-cols-1 gap-4 md:mb-10 md:grid-cols-3 md:gap-5">
           {[
             {
               label: "Tổng buổi mentor",
               value: stats.totalSessions,
               sub:
                 stats.thisMonthSessions > 0
                   ? `+${stats.thisMonthSessions} buổi tháng này`
                   : "Chưa có buổi mới tháng này",
               icon: Users,
               color: "#8037f4",
             },
             { label: "Lịch hẹn sắp tới", value: stats.upcomingMeetings, sub: "Trong 7 ngày tới", icon: CalendarBlank, color: "#f59e0b" },
             { label: "Tổng thu nhập", value: formatVnd(stats.totalEarned), sub: `Khả dụng ${formatVnd(stats.availableBalance)}`, icon: CurrencyCircleDollar, color: "#93f72b" }
           ].map((stat, i) => (
             <div key={i} className="glass-card group relative overflow-hidden bg-gradient-to-br from-white to-slate-50 p-5 sm:p-6">
                <div className="absolute right-0 top-0 h-24 w-24 translate-x-1/2 -translate-y-1/2 rounded-full bg-gradient-to-br from-violet-100/80 to-transparent" />
                <div className="mb-4 flex items-center gap-3">
                   <div className="flex h-10 w-10 items-center justify-center rounded-lg border-2 border-slate-200 bg-white shadow-sm transition-all group-hover:border-violet-200">
                      <stat.icon size={18} style={{ color: stat.color }} />
                   </div>
                   <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">{stat.label}</span>
                </div>
                <h3 className="mb-1.5 text-2xl font-black tracking-tight text-slate-900 sm:text-3xl">{stat.value}</h3>
                <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-slate-500">
                   <ArrowUpRight size={14} className="text-violet-600" /> {stat.sub}
                </p>
             </div>
           ))}
        </div>

        <div className="grid lg:grid-cols-12 gap-10 items-start">
           {/* Main Controls & Lists */}
           <div className="lg:col-span-8 space-y-10">


              {/* Upcoming Detailed Feed */}
              <div className="glass-card bg-white p-5 sm:p-6 shadow-sm border border-violet-100">
                 <div className="mb-6 flex items-center justify-between sm:mb-7">
                    <h4 className="font-headline text-lg font-black tracking-tight text-slate-900 sm:text-xl">
                      Lịch phỏng vấn sắp tới
                    </h4>
                    <button type="button" onClick={() => navigate("/mentor/schedule")} className="text-[10px] font-black uppercase tracking-widest text-violet-700 hover:underline">Xem tất cả lịch trình</button>
                 </div>
                 
                 <div className="space-y-4">
                    {upcomingMeetings.length === 0 && (
                      <div className="py-8 text-center text-sm font-medium text-slate-500 bg-slate-50 rounded-2xl border border-slate-100">
                        Chưa có lịch hẹn nào sắp tới.
                      </div>
                    )}
                    {upcomingMeetings.map((meeting) => (
                      <div key={meeting.id} 
                           role="button"
                           tabIndex={0}
                           onClick={() => navigate(`/mentor/meeting-detail/${meeting.id}`)}
                           onKeyDown={(e) => { if (e.key === "Enter") navigate(`/mentor/meeting-detail/${meeting.id}`); }}
                           className="group flex cursor-pointer flex-col gap-4 rounded-[28px] border border-slate-200 bg-slate-50/80 p-5 transition-all hover:border-violet-300 hover:bg-violet-50/60 hover:shadow-md sm:rounded-[32px] sm:p-6">
                         
                         <div className="flex items-center justify-between">
                           <div className="flex items-center gap-4 sm:gap-6">
                              <img src={meeting.mentee.avatar} alt="" className="h-12 w-12 rounded-2xl object-cover ring-2 ring-white shadow-sm sm:h-14 sm:w-14" />
                              <div>
                                 <h5 className="text-base font-black text-slate-900 transition-colors group-hover:text-violet-800 sm:text-lg">{meeting.mentee.name}</h5>
                                 <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                                   {meeting.sessionTypeLabel || meeting.position}
                                 </p>
                              </div>
                           </div>
                           <div className="flex items-center gap-6 sm:gap-10">
                              <div className="hidden text-right sm:block">
                                 <p className="text-xs font-black text-violet-700">{meeting.scheduledTime}</p>
                                 <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
                                   {formatMeetingDate(meeting.scheduledDate, meeting.scheduledTime)}
                                 </p>
                              </div>
                              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-600 text-white opacity-0 shadow-sm transition-all group-hover:opacity-100">
                                 <ArrowRight size={18} />
                              </div>
                           </div>
                         </div>

                         {meeting.menteeNotes ? (
                           <div className="mt-2 rounded-2xl bg-white p-4 border border-slate-100 shadow-sm">
                             <p className="text-[10px] font-bold uppercase tracking-widest text-violet-700 mb-1">Lời nhắn từ Mentee</p>
                             <p className="text-xs font-medium leading-relaxed text-slate-600 line-clamp-2">
                               {meeting.menteeNotes}
                             </p>
                           </div>
                         ) : null}
                      </div>
                    ))}
                 </div>
              </div>
           </div>

           {/* Sidebar: Recent Activity & Peer Review */}
           <div className="lg:col-span-4 space-y-10">
              <div className="glass-card bg-white p-5 sm:p-6">
                 <h4 className="mb-5 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">
                    <CheckCircle size={14} className="text-violet-600" /> Hoàn thành gần đây
                 </h4>
                 <div className="space-y-5">
                    {recentCompleted.length === 0 && (
                      <p className="text-xs font-medium text-slate-500">Chưa có buổi hoàn thành gần đây.</p>
                    )}
                    {recentCompleted.map((meeting) => (
                      <div key={meeting.id} 
                           role="button"
                           tabIndex={0}
                           onClick={() => setSelectedMeeting(meeting)}
                           onKeyDown={(e) => { if (e.key === "Enter") setSelectedMeeting(meeting); }}
                           className="group flex cursor-pointer items-center gap-4">
                         <img src={meeting.mentee.avatar} alt="" className="h-10 w-10 rounded-xl object-cover grayscale transition-all group-hover:grayscale-0" />
                         <div className="min-w-0 flex-1">
                            <p className="mb-0.5 text-xs font-black tracking-tight text-slate-900">{meeting.mentee.name}</p>
                            <p className="text-[9px] font-bold uppercase tracking-widest text-slate-500">
                              {formatMeetingDate(meeting.scheduledDate, meeting.scheduledTime)}
                            </p>
                         </div>
                         <div className="flex shrink-0 items-center gap-1.5 text-violet-700">
                            <Star size={12} className="fill-current" />
                            <span className="text-xs font-black">
                              {meeting.overallScore > 0 ? meeting.overallScore.toFixed(1) : "—"}
                            </span>
                         </div>
                      </div>
                    ))}
                 </div>
                 <button type="button" onClick={() => navigate("/mentor/analytics")} className="mt-6 w-full rounded-lg border border-slate-200 bg-slate-50 py-3 text-[10px] font-black uppercase tracking-widest text-slate-700 transition-all hover:bg-slate-100">
                    Xem toàn bộ lịch sử
                 </button>
              </div>

              {/* Peer Review Call-to-action */}
              <div className="glass-card group relative overflow-hidden border-violet-200 bg-gradient-to-br from-violet-50 to-white p-5 sm:p-6">
                 <div className="pointer-events-none absolute right-0 top-0 p-4 opacity-[0.12] transition-all duration-700 group-hover:rotate-0" style={{ transform: "rotate(12deg)" }}>
                    <SealCheck size={80} className="text-violet-500" />
                 </div>
                 <p className="relative mb-2 text-[10px] font-black uppercase tracking-[0.25em] text-violet-700">Đánh giá chéo</p>
                 <h4 className="relative mb-2 text-base font-black tracking-tight text-slate-900 sm:text-lg">
                   Tham gia Đánh giá Khóa học
                 </h4>
                 <p className="relative mb-4 text-xs font-medium leading-relaxed text-slate-600">
                   Góp ý nội dung cho đồng nghiệp và nhận điểm thưởng từ ProInterview.
                 </p>
                 <button type="button" onClick={() => navigate("/mentor/peer-review")} className="relative flex items-center gap-2 text-[11px] font-black text-violet-800 transition-all hover:gap-3">
                    Bắt đầu ngay <ArrowRight size={16} className="text-violet-700" />
                 </button>
              </div>
           </div>
        </div>
      </div>

      <AnimatePresence>
        {selectedMeeting && <MenteeProgressModal meeting={selectedMeeting} onClose={() => setSelectedMeeting(null)} />}
      </AnimatePresence>
    </MentorPageShell>
  );
}