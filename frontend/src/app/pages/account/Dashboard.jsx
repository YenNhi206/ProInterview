import { useState, useEffect } from "react";
import { useNavigate } from "react-router";
import { motion } from "motion/react";
import {
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Area,
  AreaChart,
  CartesianGrid,
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
} from "recharts";
import {
  Mic,
  FileText,
  Zap,
  Flame,
  ArrowRight,
  Calendar,
  BrainCircuit,
  Target,
  Trophy,
  Sparkles,
} from "lucide-react";
import { getUser, getPlans, isLoggedIn } from "../../utils/auth";
import { getCVAnalysisHistory, getStoredInterviewHistory } from "../../utils/history";
import { getAllBookings, parseDateMs } from "../../utils/bookings";
import { listBookings } from "../../utils/bookingsApi";
import { fetchDashboardStats } from "../../utils/dashboardApi";
import { apiBookingToLocal } from "../../utils/bookingMappers";
import { PROGRESS_DATA, SKILLS_DATA } from "../../data/mockData";

export function Dashboard() {
  const navigate = useNavigate();
  const user = getUser();
  const fullName = user?.name || "Người dùng";
  const initials = user?.name
    ? user.name.trim().split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase()
    : "U";

  const [plans, setPlans] = useState(getPlans());
  const [interviewHistory, setInterviewHistory] = useState(() => getStoredInterviewHistory());
  const [cvHistory, setCvHistory] = useState(() => getCVAnalysisHistory());
  const [upcomingSessions, setUpcomingSessions] = useState([]);
  const [serverStats, setServerStats] = useState(null);
  const [statsFetched, setStatsFetched] = useState(false);

  useEffect(() => {
    const load = async () => {
      setPlans(getPlans());
      setInterviewHistory(getStoredInterviewHistory());
      setCvHistory(getCVAnalysisHistory());
      const all = getAllBookings();
      const now = Date.now();
      const skipStatus = new Set(["cancelled", "completed", "no_show", "done"]);
      const upcomingFromLocal = all.filter((b) => {
        if (b.status === "rescheduled" || b.status === "cancelled" || b.status === "done") return false;
        if (skipStatus.has(b.status)) return false;
        const [d, m, y] = b.date.split("/").map(Number);
        const [h] = b.time.split(":").map(Number);
        const ts = new Date(y, m - 1, d, h).getTime();
        return ts >= now - 3600_000;
      });

      if (!isLoggedIn()) {
        setServerStats(null);
        setStatsFetched(false);
        setUpcomingSessions(upcomingFromLocal);
        return;
      }

      const [statsRes, listRes] = await Promise.all([fetchDashboardStats(), listBookings()]);
      setServerStats(statsRes.success ? statsRes.stats : null);
      setStatsFetched(true);

      const mergeKey = (b) => String(b?.backendId || b?.paymentRef || b?.orderNum || "");
      const map = new Map();
      if (listRes.success && Array.isArray(listRes.bookings)) {
        const apiRows = listRes.bookings
          .map(apiBookingToLocal)
          .filter((b) => b && !skipStatus.has(b.status));
        for (const b of apiRows) {
          const k = mergeKey(b);
          if (k) map.set(k, b);
        }
      }
      for (const b of upcomingFromLocal) {
        const k = mergeKey(b);
        if (k && !map.has(k)) map.set(k, b);
      }
      const merged = Array.from(map.values()).sort((a, b) => {
        const ta = parseDateMs(a.date, a.time);
        const tb = parseDateMs(b.date, b.time);
        const aFuture = ta >= now;
        const bFuture = tb >= now;
        if (aFuture && bFuture) return ta - tb;
        if (!aFuture && !bFuture) return tb - ta;
        return aFuture ? -1 : 1;
      });
      const upcoming = merged.filter((b) => {
        if (b.status === "rescheduled" || b.status === "cancelled" || b.status === "done") return false;
        if (skipStatus.has(b.status)) return false;
        const ta = parseDateMs(b.date, b.time);
        return ta >= now - 3600_000;
      });
      setUpcomingSessions(upcoming);
    };
    void load();
    window.addEventListener("focus", load);
    return () => window.removeEventListener("focus", load);
  }, []);

  const useServerStats = statsFetched && serverStats != null;
  const totalInterviews = useServerStats ? serverStats.interviewSessionsCompleted : interviewHistory.length;
  const avgStar = useServerStats
    ? (Number(serverStats.interviewAverageScore) || 0).toFixed(1)
    : interviewHistory.length > 0
      ? (interviewHistory.reduce((a, i) => a + i.overall, 0) / interviewHistory.length).toFixed(1)
      : "0.0";
  const totalCVAnalyses = useServerStats ? serverStats.cvAnalysesCount : cvHistory.length;
  const bestMatch = useServerStats
    ? Math.round(Number(serverStats.cvBestMatchScore) || 0)
    : cvHistory.length > 0
      ? Math.max(...cvHistory.map((i) => i.matchScore))
      : 0;

  // Mapping Song ngữ cho Ma trận năng lực
  const skillMapping = {
    "Clarity": "Clarity (Mạch lạc)",
    "Structure": "Structure (Cấu trúc)",
    "Relevance": "Relevance (Độ liên quan)",
    "Credibility": "Credibility (Tin cậy)",
    "Communication": "Communication (Giao tiếp)"
  };

  const localizedSkillsData = SKILLS_DATA.map(item => ({
    ...item,
    skill: skillMapping[item.skill] || item.skill
  }));

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-[#1a0d35]/95 backdrop-blur-3xl border border-white/20 p-4 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] border-l-4 border-l-primary-fixed">
          <p className="text-[10px] uppercase font-black tracking-widest text-zinc-500 mb-2">{label}</p>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-primary-fixed shadow-[0_0_10px_#c4ff47]"></div>
            <p className="text-white font-black text-sm">{payload[0].value} <span className="text-[10px] font-normal text-zinc-400">Điểm số</span></p>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="pi-page-dashboard-bg relative min-h-screen overflow-x-hidden pb-20 font-sans text-white selection:bg-[rgba(196,255,71,0.28)] selection:text-white">
      <style>{`
        .glass-card {
           background: linear-gradient(145deg, rgba(255,255,255,0.07) 0%, rgba(255,255,255,0.02) 100%);
           backdrop-filter: blur(48px);
           border-radius: 28px;
           border: 1px solid rgba(255, 255, 255, 0.1);
           transition: transform 0.45s cubic-bezier(0.16, 1, 0.3, 1), border-color 0.35s ease, box-shadow 0.45s ease;
           position: relative;
           overflow: hidden;
        }
        .glass-card::before {
           content: '';
           position: absolute;
           inset: 0;
           background: linear-gradient(125deg, rgba(236,72,153,0.08) 0%, transparent 42%, rgba(196, 255, 71,0.06) 100%);
           pointer-events: none;
           opacity: 0.85;
        }
        .glass-card:hover {
           border-color: rgba(196, 255, 71, 0.42);
           transform: translateY(-6px) rotate(-0.3deg);
           box-shadow:
             0 24px 48px rgba(0,0,0,0.45),
             0 0 0 1px rgba(196, 255, 71, 0.12) inset,
             0 0 48px -6px rgba(196, 255, 71, 0.28),
             0 0 36px -10px rgba(167, 139, 250, 0.22);
        }
        .glow-halo {
           position: relative;
           display: flex;
           align-items: center;
           justify-content: center;
        }
        .glow-halo::after {
           content: '';
           position: absolute;
           width: 150%;
           height: 150%;
           background: radial-gradient(circle, rgba(232,121,249,0.35) 0%, rgba(110,53,232,0.15) 40%, transparent 70%);
           border-radius: 50%;
           z-index: -1;
           animation: pulse-halo 3.2s ease-in-out infinite;
        }
        @keyframes pulse-halo {
           0%, 100% { transform: scale(1); opacity: 0.55; }
           50% { transform: scale(1.15); opacity: 0.95; }
        }
        @keyframes float-y {
           0%, 100% { transform: translateY(0); }
           50% { transform: translateY(-8px); }
        }
        @keyframes shimmer-bg {
           0% { opacity: 0.4; transform: translate(0,0) scale(1); }
           50% { opacity: 0.7; transform: translate(2%, -2%) scale(1.05); }
           100% { opacity: 0.4; transform: translate(0,0) scale(1); }
        }
        .font-headline {
          letter-spacing: -0.045em;
          text-shadow: 0 2px 24px rgba(0,0,0,0.35);
        }
        .tech-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: linear-gradient(135deg, #f472b6, #c4ff47);
          box-shadow: 0 0 14px rgba(244, 114, 182, 0.75), 0 0 22px rgba(196, 255, 71, 0.45);
          animation: pulse-halo 2s ease-in-out infinite;
        }
        .sticker-badge {
          transform: rotate(-2deg);
          box-shadow: 4px 4px 0 rgba(0,0,0,0.35);
        }
      `}</style>

      <div
        className="fixed inset-0 pointer-events-none -z-10 opacity-90"
        style={{ animation: "shimmer-bg 14s ease-in-out infinite" }}
      >
        <div className="absolute top-[-20%] right-[-10%] h-[70vh] w-[70vh] rounded-full bg-gradient-to-bl from-fuchsia-600/35 via-violet-600/20 to-transparent blur-[100px]" />
        <div className="absolute bottom-[-25%] left-[-15%] h-[85vh] w-[85vh] rounded-full bg-gradient-to-tr from-[#c4ff47]/18 via-cyan-500/10 to-fuchsia-500/20 blur-[110px]" />
        <div className="absolute top-1/2 left-1/2 h-[50vh] w-[50vh] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#6E35E8]/12 blur-[90px]" />
        <div className="absolute top-[30%] right-[5%] h-[40vh] w-[40vh] rounded-full bg-[#c4ff47]/10 blur-[80px]" />
      </div>

      <header className="relative pt-14 pb-14 border-b border-white/[0.07]">
        <div
          className="absolute inset-0 opacity-[0.11]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,0.55) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.45) 1px,transparent 1px)",
            backgroundSize: "32px 32px",
          }}
        />
        <div className="max-w-7xl mx-auto px-6 sm:px-8 relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-10">
          <motion.div
            initial={{ opacity: 0, x: -24 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ type: "spring", stiffness: 120, damping: 18 }}
            className="flex items-center gap-6 sm:gap-8"
          >
            <div className="relative group" style={{ animation: "float-y 5s ease-in-out infinite" }}>
              <div className="absolute -inset-1 rounded-[36px] bg-gradient-to-br from-fuchsia-500 via-violet-600 to-[#c4ff47] opacity-60 blur-md group-hover:opacity-90 transition-opacity" />
              <div className="relative flex h-[5.5rem] w-[5.5rem] items-center justify-center overflow-hidden rounded-[28px] border-2 border-white/25 bg-[#140a22] text-3xl font-black text-white shadow-2xl ring-2 ring-fuchsia-500/25 sm:h-24 sm:w-24 sm:text-4xl">
                <div className="absolute inset-0 bg-gradient-to-br from-fuchsia-500/20 via-transparent to-lime-400/15" />
                <Sparkles className="absolute top-2 right-2 w-4 h-4 text-[#c4ff47] opacity-80" strokeWidth={2.2} />
                <span className="relative z-10 tracking-tight">{initials}</span>
              </div>
            </div>
            <div>
              <h1 className="text-4xl sm:text-5xl md:text-6xl font-black tracking-tighter leading-[1.05]">
                <span className="bg-gradient-to-r from-white via-fuchsia-100 to-zinc-300 bg-clip-text text-transparent">
                  Yo,{" "}
                </span>
                <span className="bg-gradient-to-r from-[#c4ff47] via-fuchsia-300 to-violet-300 bg-clip-text text-transparent">
                  {fullName.split(" ").slice(-1)[0]}
                </span>
                <span className="text-white">!</span>
              </h1>
              <p className="mt-2 text-sm font-semibold text-white/45 max-w-md">
                Dashboard của bạn — chỗ xem streak, skill và nhảy vào luyện tập một cách… không nhàm chán.
              </p>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 16, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ type: "spring", stiffness: 100, damping: 16, delay: 0.08 }}
            className="flex flex-col sm:flex-row items-stretch gap-2 p-2 rounded-[26px] bg-gradient-to-br from-white/[0.08] to-white/[0.02] border border-white/15 backdrop-blur-xl shadow-[0_20px_50px_rgba(0,0,0,0.35)]"
          >
            <div className="px-6 sm:px-8 py-4 sm:py-5 rounded-[20px] bg-gradient-to-br from-[#1a0a2e]/95 to-[#0f0520]/95 border border-fuchsia-500/25 flex items-center gap-4 min-w-0">
              <div className="w-11 h-11 shrink-0 rounded-2xl bg-gradient-to-br from-amber-400/30 to-orange-500/20 border border-amber-400/35 flex items-center justify-center text-amber-300 shadow-[0_0_20px_rgba(251,191,36,0.25)]">
                <Trophy size={22} strokeWidth={2} />
              </div>
              <div className="text-left min-w-0">
                <p className="text-[9px] font-black text-fuchsia-300/90 uppercase tracking-widest mb-0.5">Rank</p>
                <p className="text-base sm:text-lg font-black text-white tracking-tight uppercase truncate">
                  Elite flex
                </p>
              </div>
            </div>
            <div className="px-6 sm:px-8 py-4 sm:py-5 rounded-[20px] flex items-center gap-4 border border-white/10 bg-white/[0.04]">
              <div className="w-11 h-11 shrink-0 rounded-2xl bg-gradient-to-br from-orange-500/40 to-rose-500/25 border border-orange-400/40 flex items-center justify-center text-orange-200">
                <Flame size={22} strokeWidth={2} />
              </div>
              <div className="text-left">
                <p className="text-[9px] font-black text-zinc-400 uppercase tracking-widest mb-0.5">Streak</p>
                <p className="text-base sm:text-lg font-black text-white tracking-tight">05 ngày học</p>
              </div>
            </div>
          </motion.div>
        </div>
      </header>

      <main className="relative z-10 p-6 sm:p-8 max-w-7xl mx-auto mt-8 sm:mt-12">
        <div className="grid grid-cols-12 gap-8 lg:gap-10">
          <div className="col-span-12 lg:col-span-8 space-y-10 lg:space-y-12">
            <div className="space-y-3">
              <p className="text-[11px] font-bold text-white/50 px-1">Số liệu từ lịch sử trên máy bạn.</p>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
                <LushMetric
                  label="Phiên phỏng vấn AI"
                  value={totalInterviews}
                  icon={Mic}
                  accent="violet"
                  color="#a78bfa"
                  caption="Số buổi PV thử với AI đã hoàn thành và được lưu."
                />
                <LushMetric
                  label="Điểm trung bình"
                  value={avgStar}
                  icon={Target}
                  accent="lime"
                  color="#c4ff47"
                  caption="TB điểm AI chấm (≈0–5) qua các phiên đã lưu."
                />
                <LushMetric
                  label="Lượt phân tích CV"
                  value={totalCVAnalyses}
                  icon={FileText}
                  accent="cyan"
                  color="#22d3ee"
                  caption="Số lần chạy phân tích CV so với JD."
                />
                <LushMetric
                  label="Khớp JD (cao nhất)"
                  value={totalCVAnalyses === 0 ? "—" : `${bestMatch}%`}
                  icon={BrainCircuit}
                  accent="sunset"
                  color="#fb923c"
                  caption="% khớp JD cao nhất trong các lần phân tích; chưa có lượt → “—”."
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-8">
               {/* ── HIỆU SUẤT HOẠT ĐỘNG (Nâng cấp Chú thích & Trục) — luôn ô trên / radar dưới ── */}
               <div className="glass-card p-8 sm:p-10 group flex flex-col justify-between">
                  <div className="mb-6">
                     <div className="flex items-center gap-3 mb-1 flex-wrap">
                        <span className="h-1 w-10 rounded-full bg-gradient-to-r from-[#c4ff47] to-emerald-400" />
                        <h3 className="text-lg sm:text-xl font-black text-white font-headline tracking-tight">
                           Hiệu suất luyện —{" "}
                           <span className="bg-gradient-to-r from-fuchsia-300 to-violet-200 bg-clip-text text-transparent">
                              đồ thị cũng phải đẹp
                           </span>
                        </h3>
                     </div>
                     <p className="text-[11px] font-semibold text-white/40 pl-[52px]">Điểm theo thời gian (flex chart era)</p>
                  </div>
                  <div className="h-64 w-full">
                     <ResponsiveContainer width="100%" height="100%">
                       <AreaChart data={PROGRESS_DATA} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                         <defs>
                            <linearGradient id="lushGradient" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#c4ff47" stopOpacity={0.25} />
                              <stop offset="95%" stopColor="#6E35E8" stopOpacity={0} />
                            </linearGradient>
                         </defs>
                         <CartesianGrid strokeDasharray="8 8" vertical={false} stroke="rgba(255,255,255,0.05)" />
                         <XAxis 
                            dataKey="date" 
                            axisLine={false} 
                            tickLine={false} 
                            tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 9, fontWeight: 700 }}
                            dy={10}
                         />
                         <YAxis 
                            domain={[0, 5]} 
                            axisLine={false} 
                            tickLine={false} 
                            tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 10, fontWeight: 700 }}
                         />
                         <Tooltip content={<CustomTooltip />} />
                         <Area 
                            name="Điểm đánh giá" 
                            type="monotone" 
                            dataKey="score" 
                            stroke="#c4ff47" 
                            strokeWidth={4} 
                            fillOpacity={1} 
                            fill="url(#lushGradient)" 
                            animationDuration={2000} 
                         />
                       </AreaChart>
                     </ResponsiveContainer>
                  </div>
                  <div className="mt-8 pt-6 border-t border-white/5 flex items-center justify-center gap-6">
                     <div className="flex items-center gap-2">
                        <div className="w-2.5 h-2.5 rounded-full bg-primary-fixed shadow-[0_0_8px_#c4ff47]"></div>
                        <span className="text-[9px] font-black text-zinc-400 uppercase tracking-[0.2em]">Điểm kỹ năng (0-5)</span>
                     </div>
                     <div className="flex items-center gap-2">
                        <div className="w-2.5 h-2.5 rounded-full bg-zinc-800"></div>
                        <span className="text-[9px] font-black text-zinc-500 uppercase tracking-[0.2em]">Mốc thời gian</span>
                     </div>
                  </div>
               </div>

               {/* ── MA TRẬN NĂNG LỰC ── */}
               <div className="glass-card p-8 sm:p-10 bg-gradient-to-br from-fuchsia-500/[0.07] via-transparent to-violet-600/[0.06] relative group">
                  <div className="absolute top-3 right-3 p-3 opacity-[0.12] group-hover:opacity-25 transition-opacity text-fuchsia-300">
                     <BrainCircuit size={44} strokeWidth={1.5} />
                  </div>
                  <div className="flex items-center gap-3 mb-6 flex-wrap">
                     <span className="h-1 w-10 rounded-full bg-gradient-to-r from-fuchsia-400 to-violet-500" />
                     <h3 className="text-lg sm:text-xl font-black text-white font-headline tracking-tight">
                        Skill radar —{" "}
                        <span className="text-fuchsia-200/90">không chỉ số</span>
                     </h3>
                  </div>
                  <div className="h-64 w-full flex items-center justify-center">
                     <ResponsiveContainer width="100%" height="100%">
                       <RadarChart cx="50%" cy="50%" outerRadius="75%" data={localizedSkillsData}>
                         <PolarGrid stroke="rgba(255,255,255,0.1)" />
                         <PolarAngleAxis dataKey="skill" tick={{ fill: "#a1a1aa", fontSize: 9, fontWeight: 900 }} />
                         <Radar name="Skill" dataKey="value" stroke="#c4ff47" fill="#c4ff47" fillOpacity={0.25} dot={{ r: 4, fill: "#c4ff47", stroke: "#0E0922", strokeWidth: 2 }} />
                       </RadarChart>
                     </ResponsiveContainer>
                  </div>
               </div>
            </div>

            {/* INSIGHTS (Removed AI Advice as requested) */}
            <div className="glass-card p-10 border-white/5 bg-white/[0.02]">
               <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                  <div className="space-y-4">
                     <h4 className="text-[10px] font-black text-secondary tracking-widest uppercase flex items-center gap-2">
                        <div className="w-1 h-3 bg-secondary"></div> Thế mạnh hiện tại
                     </h4>
                     <ul className="space-y-3">
                        <li className="flex items-center gap-3 text-sm font-bold text-white group hover:text-secondary transition-colors cursor-default">
                           <div className="w-1.5 h-1.5 rounded-full bg-secondary"></div> Clarity (Mạch lạc)
                        </li>
                        <li className="flex items-center gap-3 text-sm font-bold text-white group hover:text-secondary transition-colors cursor-default">
                           <div className="w-1.5 h-1.5 rounded-full bg-secondary"></div> Relevance (Độ liên quan)
                        </li>
                     </ul>
                  </div>
                  <div className="space-y-4">
                     <h4 className="text-[10px] font-black text-primary-fixed tracking-widest uppercase flex items-center gap-2">
                        <div className="w-1 h-3 bg-primary-fixed"></div> Điểm cần cải thiện
                     </h4>
                     <ul className="space-y-3">
                        <li className="flex items-center gap-3 text-sm font-bold text-white group hover:text-primary-fixed transition-colors cursor-default">
                           <div className="w-1.5 h-1.5 rounded-full bg-primary-fixed"></div> Cấu trúc câu chuyện còn lỏng
                        </li>
                        <li className="flex items-center gap-3 text-sm font-bold text-white group hover:text-primary-fixed transition-colors cursor-default">
                           <div className="w-1.5 h-1.5 rounded-full bg-primary-fixed"></div> Giao tiếc ánh mắt / nhịp nói
                        </li>
                     </ul>
                  </div>
               </div>
            </div>
          </div>

          <aside className="col-span-12 lg:col-span-4 space-y-8 lg:space-y-10">
            <div className="space-y-5">
               <div className="flex items-center gap-2.5 mb-1">
                  <div className="tech-dot" />
                  <span className="text-[10px] font-black uppercase tracking-[0.22em] bg-gradient-to-r from-fuchsia-200/90 to-lime-200/80 bg-clip-text text-transparent">
                     Quick actions — nhích là tới
                  </span>
               </div>
               
               <LushActionTile
                  title="Phỏng vấn AI"
                  desc="Vào phòng, nói thật, nhận feedback gắt nhưng có tâm."
                  onClick={() => navigate("/interview")}
                  icon={Zap}
                  accent="#c084fc"
                  accent2="#6E35E8"
                  isLarge={true}
               />
               
               <div className="grid grid-cols-2 gap-4">
                  <LushActionTile title="CV × JD" desc="So khớp & gợi ý chỉnh CV." onClick={() => navigate("/cv-analysis")} icon={FileText} accent="#22d3ee" />
                  <LushActionTile title="Book mentor" desc="Slot 1-1 với người trong nghề." onClick={() => navigate("/mentors")} icon={Calendar} accent="#c4ff47" />
               </div>
            </div>

            <div className="glass-card p-10">
               <h3 className="text-sm font-black text-white uppercase tracking-[0.2em] flex items-center gap-2 mb-10">
                  <Calendar size={16} className="text-secondary" /> Lịch trình hành trình
               </h3>
               <div className="space-y-8 relative">
                 <div className="absolute left-[7px] top-2 bottom-6 w-[2px] bg-gradient-to-b from-secondary to-transparent opacity-10"></div>
                 {upcomingSessions.length === 0 ? (
                    <div className="py-12 text-center border-2 border-dashed border-white/10 rounded-[32px] bg-white/[0.02]">
                       <p className="text-zinc-500 text-[10px] font-black uppercase tracking-widest leading-loose">Sẵn sàng vận hành<br/><span className="text-zinc-700">Chưa có lịch hẹn</span></p>
                    </div>
                 ) : upcomingSessions.slice(0, 2).map((s, i) => (
                    <div key={i} className="flex gap-6 group relative">
                       <div className="relative z-10 w-4 h-4 rounded-full bg-[#0E0922] border-2 border-secondary group-hover:border-primary-fixed transition-colors flex items-center justify-center">
                          <div className="w-1.5 h-1.5 rounded-full bg-secondary group-hover:bg-primary-fixed transition-colors"></div>
                       </div>
                       <div>
                          <p className="text-[10px] font-black text-primary-fixed mb-1">{s.date} — {s.time}</p>
                          <h4 className="text-base font-black text-white group-hover:text-primary-fixed transition-colors tracking-tight">{s.mentorName}</h4>
                          <p className="text-[10px] text-zinc-500 mt-1 italic">Buổi định hướng chuyên môn</p>
                       </div>
                    </div>
                 ))}
               </div>
            </div>
          </aside>
        </div>
      </main>
    </div>
  );
}

const metricAccentRing = {
  violet: "from-violet-500/50 to-fuchsia-500/30 ring-fuchsia-400/20",
  lime: "from-lime-400/50 to-emerald-500/30 ring-lime-300/25",
  cyan: "from-cyan-400/45 to-sky-500/25 ring-cyan-300/20",
  sunset: "from-orange-400/50 to-rose-500/30 ring-orange-300/20",
};

function LushMetric({ label, value, icon: Icon, accent, color, caption }) {
  const ring = metricAccentRing[accent] || metricAccentRing.violet;
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 140, damping: 18 }}
      title={caption}
      className="glass-card p-5 sm:p-6 group flex flex-col items-stretch text-left h-full"
    >
      <div className="flex flex-col items-center text-center sm:items-start sm:text-left w-full">
        <div className="glow-halo mb-4 mx-auto sm:mx-0">
          <div
            className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${ring} ring-2 ring-inset flex items-center justify-center group-hover:scale-110 group-hover:rotate-3 transition-all duration-400 shadow-lg`}
            style={{ color }}
          >
            <Icon size={24} strokeWidth={2.2} />
          </div>
        </div>
        <p className="text-[9px] font-black text-zinc-500 uppercase tracking-[0.2em] mb-1 w-full leading-snug">{label}</p>
        <h4
          className="text-2xl sm:text-3xl font-black tracking-tighter transition-all group-hover:scale-[1.02] w-full"
          style={{
            backgroundImage: `linear-gradient(135deg, #fff 0%, ${color} 160%)`,
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            backgroundClip: "text",
          }}
        >
          {value}
        </h4>
      </div>
      {caption ? (
        <p className="mt-4 pt-3 border-t border-white/[0.08] text-[11px] sm:text-[12px] leading-relaxed text-white/50 font-medium">
          {caption}
        </p>
      ) : null}
    </motion.div>
  );
}

function LushActionTile({ title, desc, onClick, icon: Icon, accent, accent2, isLarge }) {
  const borderGlow = accent2 || accent;
  return (
    <motion.button
      type="button"
      onClick={onClick}
      whileTap={{ scale: 0.97 }}
      className={`glass-card text-left group relative border-white/15 active:scale-[0.98] ${isLarge ? "p-10 sm:p-12" : "p-7 sm:p-8"}`}
      style={{
        borderColor: `${accent}55`,
        boxShadow: isLarge ? `0 0 0 1px ${borderGlow}22, 0 20px 40px rgba(0,0,0,0.35)` : undefined,
      }}
    >
      <div
        className="absolute -right-10 -top-10 w-36 h-36 blur-3xl rounded-full opacity-20 group-hover:opacity-45 transition-all duration-700"
        style={{
          background: accent2 ? `linear-gradient(135deg, ${accent}, ${accent2})` : accent,
        }}
      />
      <div
        className={`rounded-2xl border flex items-center justify-center group-hover:scale-110 group-hover:-rotate-2 transition-all duration-500 shadow-lg ${isLarge ? "w-16 h-16 mb-8" : "w-12 h-12 mb-5"}`}
        style={{
          background: `linear-gradient(145deg, ${accent}35, rgba(255,255,255,0.06))`,
          borderColor: `${accent}50`,
          color: accent,
        }}
      >
        <Icon size={isLarge ? 28 : 20} strokeWidth={2.2} />
      </div>
      <div className="relative z-10">
        <h4
          className={`font-black flex items-center gap-2 sm:gap-3 leading-tight transition-colors ${isLarge ? "text-xl sm:text-2xl mb-3" : "text-sm mb-2"}`}
        >
          <span className="bg-gradient-to-r from-white to-white/80 bg-clip-text text-transparent group-hover:from-fuchsia-100 group-hover:to-lime-100 transition-all">
            {title}
          </span>
          <ArrowRight
            size={isLarge ? 22 : 16}
            className="opacity-0 -translate-x-3 group-hover:opacity-100 group-hover:translate-x-0 transition-all shrink-0 text-[#c4ff47]"
          />
        </h4>
        <p
          className={`text-zinc-400 font-semibold leading-relaxed group-hover:text-zinc-300 transition-colors ${isLarge ? "text-sm" : "text-[10px] sm:text-[11px] line-clamp-2"}`}
        >
          {desc}
        </p>
      </div>
    </motion.button>
  );
}