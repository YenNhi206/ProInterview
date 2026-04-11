import { useState, useEffect } from "react";
import { useNavigate } from "react-router";
import { motion, AnimatePresence } from "motion/react";
import {
  Calendar as CalendarBlank,
  Users,
  Star,
  RotateCcw as ClockCounterClockwise,
  Briefcase,
  LineChart as ChartLine,
  Video,
  CheckCircle,
  AlertCircle as WarningCircle,
  TrendingUp as TrendUp,
  Zap as Lightning,
  Clock,
  CircleDollarSign as CurrencyCircleDollar,
  X,
  ArrowRight,
  FileText,
  BarChart3 as ChartBar,
  BadgeCheck as SealCheck,
  StickyNote as Notepad,
  Target,
  ArrowUpRight,
  Plus
} from "lucide-react";
import { getUser } from "../utils/auth";
import {
  UPCOMING_MENTOR_MEETINGS,
  COMPLETED_MENTOR_MEETINGS,
  MENTOR_DASHBOARD_STATS,
  WEEKLY_STATS,
} from "../data/mentorMockData";
import { MentorPageShell } from "../components/mentor/MentorPageShell";

/* ── Mentee Progress Modal ────────────────────────────────────────────────── */
function MenteeProgressModal({
  meeting,
  onClose,
}) {
  const navigate = useNavigate();

  const star = meeting.starScores;
  const overall = meeting.overallScore ?? 0;

  const scoreColor = overall >= 4 ? "#B4F500" : overall >= 3 ? "#6E35E8" : "#FF8C42";
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
        { key: "situation", label: "Situation", value: star.situation, color: "#6E35E8" },
        { key: "task", label: "Task", color: "#8B4DFF", value: star.task },
        { key: "action", label: "Action", color: "#B4F500", value: star.action },
        { key: "result", label: "Result", color: "#FF8C42", value: star.result },
      ]
    : [];

  const dateStr = new Date(meeting.scheduledDate).toLocaleDateString("vi-VN", {
    weekday: "long",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });

  const meetingTypeLabel =
    meeting.meetingType === "mock-interview"
      ? "Phỏng vấn thử"
      : meeting.meetingType === "cv-review"
      ? "Xem xét CV"
      : "Tư vấn nghề nghiệp";

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-6 backdrop-blur-xl bg-black/40"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.9, y: 20, opacity: 0 }}
        animate={{ scale: 1, y: 0, opacity: 1 }}
        exit={{ scale: 0.9, y: 20, opacity: 0 }}
        className="glass-card w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh] shadow-[0_40px_100px_rgba(0,0,0,0.6)]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Header ── */}
        <div className="p-8 border-b border-white/5 relative bg-gradient-to-br from-[#1a0d35] to-[#0E0922]">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-6">
               <div className="relative">
                  <img
                    src={meeting.mentee.avatar}
                    alt={meeting.mentee.name}
                    className="w-20 h-20 rounded-[28px] object-cover ring-4 ring-white/5 shadow-2xl"
                  />
                  <div className="absolute -bottom-2 -right-2 w-8 h-8 rounded-xl bg-primary-fixed text-black flex items-center justify-center shadow-lg">
                     <SealCheck size={16} />
                  </div>
               </div>
               <div>
                  <div className="flex items-center gap-3 mb-2">
                     <span className="text-[10px] font-black px-3 py-1 rounded-lg bg-white/10 text-white uppercase tracking-widest">{meetingTypeLabel}</span>
                     <span className="text-[10px] font-black px-3 py-1 rounded-lg bg-primary-fixed/20 text-primary-fixed uppercase tracking-widest">{meeting.mentee.level}</span>
                  </div>
                  <h2 className="text-3xl font-black text-white tracking-tighter mb-1">{meeting.mentee.name}</h2>
                  <p className="text-sm font-medium text-zinc-500">{meeting.position} @ {meeting.company}</p>
               </div>
            </div>
            <button onClick={onClose} className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-zinc-500 hover:text-white transition-all">
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
                    <circle cx="50" cy="50" r="42" fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth="10" />
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
                    <span className="text-3xl font-black tracking-tighter" style={{ color: scoreColor }}>{overall.toFixed(1)}</span>
                    <span className="text-[10px] font-black uppercase tracking-widest opacity-50">Score</span>
                 </div>
              </div>

              <div>
                 <p className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.3em] mb-2 text-primary-fixed">Đánh giá tổng thể</p>
                 <h4 className="text-2xl font-black text-white mb-3">{scoreLabel}</h4>
                 <div className="flex items-center gap-2 mb-4">
                    {[1, 2, 3, 4, 5].map((s) => (
                      <Star
                        key={s}
                        size={16}
                        className={s <= Math.round(overall) ? "text-[#FFD600] fill-[#FFD600]" : "text-white/10"}
                      />
                    ))}
                 </div>
                 <p className="text-sm text-zinc-500 italic max-w-sm">"{meeting.feedback?.substring(0, 100)}..."</p>
              </div>
           </div>

           {/* STAR Framework Detail */}
           <div className="space-y-6">
              <h5 className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em] flex items-center gap-3">
                 <ChartBar size={14} className="text-primary-fixed" /> Phân tích khung năng lực STAR
              </h5>
              <div className="grid grid-cols-1 gap-5">
                 {starComponents.map((comp) => (
                   <div key={comp.key} className="space-y-3">
                      <div className="flex items-center justify-between">
                         <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-xl flex items-center justify-center font-black text-xs text-white" style={{ background: comp.color }}>{comp.label[0]}</div>
                            <span className="text-xs font-bold text-white/80">{comp.label}</span>
                         </div>
                         <span className="text-xs font-black text-white">{comp.value.toFixed(1)}/5.0</span>
                      </div>
                      <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
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
                 <h6 className="text-[10px] font-black text-primary-fixed uppercase tracking-widest mb-4 flex items-center gap-2">
                    <Lightning size={12} /> Điểm mạnh
                 </h6>
                 <ul className="space-y-3">
                    {meeting.strengths?.map((s, i) => (
                      <li key={i} className="text-xs font-medium text-white/70 flex items-start gap-2">
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
                    {meeting.improvements?.map((s, i) => (
                      <li key={i} className="text-xs font-medium text-white/70 flex items-start gap-2">
                         <span className="w-1.5 h-1.5 rounded-full bg-orange-400 mt-1.5 shrink-0" />
                         {s}
                      </li>
                    ))}
                 </ul>
              </div>
           </div>
        </div>

        {/* ── Footer ── */}
        <div className="p-6 border-t border-white/5 bg-black/20 flex items-center justify-between gap-4">
           <button
              onClick={() => navigate(`/mentor/meeting-detail/${meeting.id}`)}
              className="flex-1 px-6 py-4 rounded-2xl bg-white text-black text-[10px] font-black uppercase tracking-widest hover:scale-105 transition-all shadow-xl"
           >
              Xem báo cáo chi tiết
           </button>
           <button
              onClick={onClose}
              className="px-8 py-4 rounded-2xl bg-white/5 border border-white/10 text-[10px] font-black uppercase tracking-widest text-zinc-500 hover:text-white transition-all"
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

  useEffect(() => {
    if (!user || user.role !== "mentor") {
      navigate("/");
    }
  }, []);

  if (!user || user.role !== "mentor") return null;

  const upcomingMeetings = UPCOMING_MENTOR_MEETINGS.slice(0, 3);
  const recentCompleted = COMPLETED_MENTOR_MEETINGS.slice(0, 5);
  const stats = MENTOR_DASHBOARD_STATS;

  return (
    <MentorPageShell bottomPad="pb-20">
      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 10px; }
      `}</style>
      <div className="relative z-10 mx-auto max-w-7xl p-10 pt-20">
        <div className="mb-14 flex flex-col md:flex-row md:items-end justify-between gap-8">
          <div>
            <h1 className="text-7xl font-black text-white font-headline tracking-tighter mb-4">
               Xin chào, <span className="text-primary-fixed">{user.name.split(" ")[0]}!</span> 👋
            </h1>
            <p className="text-lg font-medium leading-relaxed text-white/55">Bảng điều khiển tối ưu dành cho Mentor của ProInterview</p>
          </div>
          <div className="flex gap-4">
              <button onClick={() => navigate("/mentor/schedule")} className="px-8 py-4 rounded-3xl bg-primary-fixed text-black text-xs font-black uppercase tracking-widest hover:scale-105 transition-all shadow-[0_10px_40px_rgba(180,245,0,0.3)] flex items-center gap-2">
                 <Plus size={18} /> Tạo lịch mới
              </button>
          </div>
        </div>

        {/* Vital Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-14">
           {[
             { label: "Tổng buổi mentor", value: stats.totalSessions, sub: `+${stats.thisMonthSessions} tháng này`, icon: Users, color: "#6E35E8" },
             { label: "Lịch hẹn sắp tới", value: stats.upcomingMeetings, sub: "Trong 7 ngày tới", icon: CalendarBlank, color: "#f59e0b" },
             { label: "Doanh thu tạm tính", value: `${(stats.totalEarnings / 1000000).toFixed(1)}M`, sub: "Sẵn sàng rút tiền", icon: CurrencyCircleDollar, color: "#B4F500" }
           ].map((stat, i) => (
             <div key={i} className="glass-card p-10 group overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-white/[0.05] to-transparent -translate-y-1/2 translate-x-1/2 rounded-full" />
                <div className="flex items-center gap-4 mb-8">
                   <div className="w-12 h-12 rounded-2xl flex items-center justify-center border border-white/10 bg-white/5 group-hover:bg-white/10 transition-all">
                      <stat.icon size={22} style={{ color: stat.color }} />
                   </div>
                   <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/45">{stat.label}</span>
                </div>
                <h3 className="text-5xl font-black text-white tracking-tighter mb-2">{stat.value}</h3>
                <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-white/45">
                   <ArrowUpRight size={14} className="text-primary-fixed" /> {stat.sub}
                </p>
             </div>
           ))}
        </div>

        <div className="grid lg:grid-cols-12 gap-10 items-start">
           {/* Main Controls & Lists */}
           <div className="lg:col-span-8 space-y-10">
              {/* Quick Navigation Cards */}
              <div className="grid sm:grid-cols-3 gap-6">
                 {[
                   { label: "Lịch trình", desc: "Quản lý meetings", icon: CalendarBlank, path: "/mentor/schedule", color: "#6E35E8" },
                   { label: "Tài chính", desc: "Thu nhập & Rút tiền", icon: CurrencyCircleDollar, path: "/mentor/finance", color: "#B4F500" },
                   { label: "Phân tích", desc: "Hiệu suất Mentees", icon: ChartLine, path: "/mentor/analytics", color: "#f59e0b" }
                 ].map((nav, i) => (
                   <button key={i} onClick={() => navigate(nav.path)} className="glass-card p-6 flex items-center gap-5 group text-left">
                      <div className="w-14 h-14 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center group-hover:scale-110 transition-transform shadow-inner">
                         <nav.icon size={24} style={{ color: nav.color }} />
                      </div>
                      <div>
                         <p className="text-xs font-black text-white uppercase tracking-widest mb-1">{nav.label}</p>
                         <p className="text-[10px] font-bold uppercase tracking-widest text-white/45">{nav.desc}</p>
                      </div>
                   </button>
                 ))}
              </div>

              {/* Upcoming Detailed Feed */}
              <div className="glass-card p-10">
                 <div className="flex items-center justify-between mb-10">
                    <h4 className="text-2xl font-black text-white font-headline tracking-tight">Lịch phỏng vấn sắp tới</h4>
                    <button onClick={() => navigate("/mentor/schedule")} className="text-[10px] font-black text-primary-fixed uppercase tracking-widest hover:underline">Xem tất cả lịch trình</button>
                 </div>
                 
                 <div className="space-y-4">
                    {upcomingMeetings.map((meeting) => (
                      <div key={meeting.id} 
                           onClick={() => navigate(`/mentor/meeting-detail/${meeting.id}`)}
                           className="flex items-center justify-between p-6 rounded-[32px] bg-white/[0.02] border border-white/5 hover:bg-white/[0.05] transition-all group cursor-pointer">
                         <div className="flex items-center gap-6">
                            <img src={meeting.mentee.avatar} className="w-14 h-14 rounded-2xl object-cover ring-2 ring-white/5" />
                            <div>
                               <h5 className="text-lg font-black text-white group-hover:text-primary-fixed transition-colors">{meeting.mentee.name}</h5>
                               <p className="text-[10px] font-black text-zinc-600 uppercase tracking-widest">{meeting.position} @ {meeting.company}</p>
                            </div>
                         </div>
                         <div className="flex items-center gap-10">
                            <div className="text-right hidden sm:block">
                               <p className="text-xs font-black text-white">{meeting.scheduledTime}</p>
                               <p className="text-[10px] font-bold uppercase tracking-widest text-white/40">{new Date(meeting.scheduledDate).toLocaleDateString("vi-VN")}</p>
                            </div>
                            <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-primary-fixed opacity-0 group-hover:opacity-100 transition-all">
                               <ArrowRight size={18} />
                            </div>
                         </div>
                      </div>
                    ))}
                 </div>
              </div>
           </div>

           {/* Sidebar: Recent Activity & Peer Review */}
           <div className="lg:col-span-4 space-y-10">
              <div className="glass-card p-10">
                 <h4 className="mb-8 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] text-white/45">
                    <CheckCircle size={14} className="text-primary-fixed" /> Hoàn thành gần đây
                 </h4>
                 <div className="space-y-6">
                    {recentCompleted.map((meeting) => (
                      <div key={meeting.id} 
                           onClick={() => setSelectedMeeting(meeting)}
                           className="flex items-center gap-4 group cursor-pointer">
                         <img src={meeting.mentee.avatar} className="w-10 h-10 rounded-xl object-cover grayscale group-hover:grayscale-0 transition-all" />
                         <div className="flex-1">
                            <p className="text-xs font-black text-white mb-0.5 tracking-tight">{meeting.mentee.name}</p>
                            <p className="text-[9px] font-bold uppercase tracking-widest text-white/45">{new Date(meeting.scheduledDate).toLocaleDateString("vi-VN")}</p>
                         </div>
                         <div className="flex items-center gap-1.5 text-primary-fixed">
                            <Star size={12} className="fill-current" />
                            <span className="text-xs font-black">{meeting.overallScore?.toFixed(1)}</span>
                         </div>
                      </div>
                    ))}
                 </div>
                 <button onClick={() => navigate("/mentor/analytics")} className="w-full mt-10 py-4 rounded-2xl bg-white/5 border border-white/10 text-[10px] font-black uppercase tracking-widest hover:bg-white/10 transition-all">
                    Xem toàn bộ lịch sử
                 </button>
              </div>

              {/* Peer Review Call-to-action */}
              <div className="glass-card p-10 overflow-hidden group">
                 <div className="absolute top-0 right-0 p-8 rotate-12 opacity-10 group-hover:rotate-0 transition-all duration-700">
                    <SealCheck size={120} className="text-secondary" />
                 </div>
                 <p className="text-[10px] font-black text-secondary uppercase tracking-[0.3em] mb-4">Peer Review</p>
                 <h4 className="text-2xl font-black text-white mb-4 tracking-tighter">Tham gia Đánh giá Khóa học</h4>
                 <p className="text-xs text-zinc-600 font-medium mb-8 leading-relaxed">Góp ý nội dung cho đồng nghiệp và nhận point thưởng từ ProInterview.</p>
                 <button onClick={() => navigate("/mentor/peer-review")} className="flex items-center gap-2 text-xs font-black text-white hover:gap-4 transition-all">
                    Bắt đầu ngay <ArrowRight size={18} className="text-primary-fixed" />
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