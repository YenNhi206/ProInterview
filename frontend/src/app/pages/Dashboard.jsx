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
  LayoutDashboard,
  BrainCircuit,
  Target,
  Trophy,
  Sparkles,
  ZapOff
} from "lucide-react";
import { getUser, getPlans } from "../utils/auth";
import { getCVAnalysisHistory, getStoredInterviewHistory } from "../utils/history";
import { getAllBookings } from "../utils/bookings";
import { PROGRESS_DATA, SKILLS_DATA } from "../data/mockData";

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

  useEffect(() => {
    const load = () => {
      setPlans(getPlans());
      setInterviewHistory(getStoredInterviewHistory());
      setCvHistory(getCVAnalysisHistory());
      const all = getAllBookings();
      const now = Date.now();
      const upcoming = all.filter((b) => {
        if (b.status === "rescheduled" || b.status === "cancelled" || b.status === "done") return false;
        const [d, m, y] = b.date.split("/").map(Number);
        const [h] = b.time.split(":").map(Number);
        const ts = new Date(y, m - 1, d, h).getTime();
        return ts >= now - 3600_000;
      });
      setUpcomingSessions(upcoming);
    };
    load();
    window.addEventListener("focus", load);
    return () => window.removeEventListener("focus", load);
  }, []);

  const totalInterviews = interviewHistory.length;
  const avgStar =
    interviewHistory.length > 0
      ? (interviewHistory.reduce((a, i) => a + i.overall, 0) / interviewHistory.length).toFixed(1)
      : "0.0";
  const totalCVAnalyses = cvHistory.length;
  const bestMatch =
    cvHistory.length > 0 ? Math.max(...cvHistory.map((i) => i.matchScore)) : 0;

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
            <div className="w-2 h-2 rounded-full bg-primary-fixed shadow-[0_0_10px_#B4F500]"></div>
            <p className="text-white font-black text-sm">{payload[0].value} <span className="text-[10px] font-normal text-zinc-400">Điểm số</span></p>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="min-h-screen text-white selection:bg-primary-fixed selection:text-black font-sans pb-20 overflow-x-hidden" 
         style={{ background: "linear-gradient(145deg, #0E0922 0%, #07060E 100%)" }}>
      
      <style>{`
        .glass-card {
           background: rgba(255, 255, 255, 0.04);
           backdrop-filter: blur(40px);
           border-radius: 32px;
           border: 1px solid rgba(255, 255, 255, 0.08);
           transition: all 0.6s cubic-bezier(0.16, 1, 0.3, 1);
           position: relative;
           overflow: hidden;
        }
        .glass-card::before {
           content: '';
           position: absolute;
           inset: 0;
           background: linear-gradient(135deg, rgba(255,255,255,0.05) 0%, transparent 100%);
           pointer-events: none;
        }
        .glass-card:hover {
           border-color: rgba(180, 245, 0, 0.4);
           background: rgba(255, 255, 255, 0.06);
           transform: translateY(-4px) scale(1.01);
           box-shadow: 0 30px 60px rgba(0,0,0,0.6), 0 0 20px rgba(180, 245, 0, 0.1);
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
           width: 140%;
           height: 140%;
           background: radial-gradient(circle, rgba(110, 53, 232, 0.2) 0%, transparent 70%);
           border-radius: 50%;
           z-index: -1;
           animation: pulse-halo 4s infinite;
        }
        @keyframes pulse-halo {
           0%, 100% { transform: scale(1); opacity: 0.5; }
           50% { transform: scale(1.2); opacity: 0.8; }
        }
        .font-headline {
          letter-spacing: -0.04em;
          text-shadow: 0 2px 10px rgba(0,0,0,0.5);
        }
        .tech-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: #B4F500;
          box-shadow: 0 0 10px #B4F500;
        }
      `}</style>

      {/* Rrich Atmospheric Background Glows */}
      <div className="fixed top-0 right-0 w-[1400px] h-[1400px] bg-secondary/15 blur-[200px] rounded-full -translate-y-1/2 translate-x-1/2 pointer-events-none -z-0"></div>
      <div className="fixed bottom-0 left-0 w-[1200px] h-[1200px] bg-primary-fixed/10 blur-[200px] rounded-full translate-y-1/2 -translate-x-1/2 pointer-events-none -z-0"></div>

      <header className="relative pt-16 pb-12 border-b border-white/5">
         <div className="absolute inset-0 opacity-[0.06]" style={{
            backgroundImage: "linear-gradient(rgba(255,255,255,0.5) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.5) 1px,transparent 1px)",
            backgroundSize: "40px 40px"
         }} />
         <div className="max-w-7xl mx-auto px-8 relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-10">
            <motion.div initial={{ opacity: 0, x: -30 }} animate={{ opacity: 1, x: 0 }} className="flex items-center gap-8">
               <div className="relative group">
                  <div className="absolute inset-0 bg-primary-fixed blur-2xl opacity-20"></div>
                  <div className="relative w-24 h-24 rounded-[32px] bg-[#1a0d35] border-2 border-white/20 flex items-center justify-center text-4xl font-black text-white shadow-2xl overflow-hidden">
                     <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent"></div>
                     <span className="relative z-10">{initials}</span>
                  </div>
               </div>
               <div>
                  <div className="flex items-center gap-3 mb-3">
                     <span className="text-[10px] font-black uppercase tracking-[0.2em] text-primary-fixed bg-primary-fixed/20 px-3 py-1 rounded-full border border-primary-fixed/30">Hệ thống tối ưu</span>
                  </div>
                  <h1 className="text-5xl md:text-6xl font-black tracking-tighter text-white leading-none">
                     Xin chào, <span className="bg-gradient-to-r from-white to-zinc-500 bg-clip-text text-transparent">{fullName.split(" ").slice(-1)[0]}</span>
                  </h1>
               </div>
            </motion.div>

            <motion.div 
               initial={{ opacity: 0, scale: 0.9 }} 
               animate={{ opacity: 1, scale: 1 }}
               className="flex items-center gap-1 p-1 bg-white/5 rounded-[28px] border border-white/10 backdrop-blur-2xl shadow-2xl"
            >
               <div className="px-8 py-5 text-center bg-[#1a0d35] rounded-[22px] border border-white/10 flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl bg-primary-fixed/10 border border-primary-fixed/20 flex items-center justify-center text-primary-fixed">
                     <Trophy size={20} />
                  </div>
                  <div className="text-left">
                     <p className="text-[9px] font-black text-secondary uppercase tracking-widest mb-0.5">Hạng hội viên</p>
                     <p className="text-lg font-black text-white tracking-tight uppercase">Thượng hạng (Elite)</p>
                  </div>
               </div>
               <div className="px-8 py-5 flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center text-orange-500">
                     <Flame size={20} />
                  </div>
                  <div className="text-left">
                     <p className="text-[9px] font-black text-zinc-500 uppercase tracking-widest mb-0.5">Chuỗi nỗ lực</p>
                     <p className="text-lg font-black text-white tracking-tight">05 Ngày học</p>
                  </div>
               </div>
            </motion.div>
         </div>
      </header>

      <main className="relative z-10 p-8 max-w-7xl mx-auto mt-12">
        <div className="grid grid-cols-12 gap-10">
          <div className="col-span-12 lg:col-span-8 space-y-12">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
               <LushMetric label="Phiên phỏng vấn" value={totalInterviews} icon={Mic} color="#6E35E8" />
               <LushMetric label="Đánh giá TB" value={avgStar} icon={Target} color="#B4F500" />
               <LushMetric label="Hồ sơ phân tích" value={totalCVAnalyses} icon={FileText} color="#38bdf8" />
               <LushMetric label="Phù hợp" value={`${bestMatch}%`} icon={BrainCircuit} color="#f59e0b" />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
               {/* ── HIỆU SUẤT HOẠT ĐỘNG (Nâng cấp Chú thích & Trục) ── */}
               <div className="glass-card p-10 group flex flex-col justify-between">
                  <div className="mb-8">
                     <div className="flex items-center gap-3 mb-2">
                        <span className="w-8 h-[2px] bg-primary-fixed"></span>
                        <h3 className="text-xl font-black text-white font-headline tracking-tight">Hiệu suất luyện tập</h3>
                     </div>
                  </div>
                  <div className="h-64 w-full">
                     <ResponsiveContainer width="100%" height="100%">
                       <AreaChart data={PROGRESS_DATA} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                         <defs>
                            <linearGradient id="lushGradient" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#B4F500" stopOpacity={0.25} />
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
                            stroke="#B4F500" 
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
                        <div className="w-2.5 h-2.5 rounded-full bg-primary-fixed shadow-[0_0_8px_#B4F500]"></div>
                        <span className="text-[9px] font-black text-zinc-400 uppercase tracking-[0.2em]">Điểm kỹ năng (0-5)</span>
                     </div>
                     <div className="flex items-center gap-2">
                        <div className="w-2.5 h-2.5 rounded-full bg-zinc-800"></div>
                        <span className="text-[9px] font-black text-zinc-500 uppercase tracking-[0.2em]">Mốc thời gian</span>
                     </div>
                  </div>
               </div>

               {/* ── MA TRẬN NĂNG LỰC ── */}
               <div className="glass-card p-10 bg-gradient-to-br from-white/[0.05] to-transparent relative group">
                  <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                     <BrainCircuit size={40} />
                  </div>
                  <div className="flex items-center gap-3 mb-8">
                     <span className="w-8 h-[2px] bg-secondary"></span>
                     <h3 className="text-xl font-black text-white font-headline tracking-tight">Ma trận năng lực</h3>
                  </div>
                  <div className="h-64 w-full flex items-center justify-center">
                     <ResponsiveContainer width="100%" height="100%">
                       <RadarChart cx="50%" cy="50%" outerRadius="75%" data={localizedSkillsData}>
                         <PolarGrid stroke="rgba(255,255,255,0.1)" />
                         <PolarAngleAxis dataKey="skill" tick={{ fill: "#a1a1aa", fontSize: 9, fontWeight: 900 }} />
                         <Radar name="Skill" dataKey="value" stroke="#B4F500" fill="#B4F500" fillOpacity={0.25} dot={{ r: 4, fill: "#B4F500", stroke: "#0E0922", strokeWidth: 2 }} />
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
                           <div className="w-1.5 h-1.5 rounded-full bg-primary-fixed"></div> Structure (Cấu trúc)
                        </li>
                        <li className="flex items-center gap-3 text-sm font-bold text-white group hover:text-primary-fixed transition-colors cursor-default">
                           <div className="w-1.5 h-1.5 rounded-full bg-primary-fixed"></div> Communication (Giao tiếp)
                        </li>
                     </ul>
                  </div>
               </div>
            </div>
          </div>

          <aside className="col-span-12 lg:col-span-4 space-y-10">
            <div className="space-y-6">
               <div className="flex items-center gap-2 mb-2">
                  <div className="tech-dot" />
                  <span className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500">Phòng điều khiển chiến lược</span>
               </div>
               
               <LushActionTile 
                  title="Phỏng vấn AI" 
                  desc="Mô phỏng thực tế với phản hồi tức thì từ AI chuyên sâu." 
                  onClick={() => navigate("/interview")} 
                  icon={Zap} 
                  accent="#6E35E8"
                  isLarge={true}
               />
               
               <div className="grid grid-cols-2 gap-4">
                  <LushActionTile title="Phân tích CV" desc="Chuẩn JD mơ ước." onClick={() => navigate("/cv-analysis")} icon={FileText} accent="#38bdf8" />
                  <LushActionTile title="Đặt Mentor" desc="Gặp gỡ chuyên gia." onClick={() => navigate("/mentors")} icon={Calendar} accent="#B4F500" />
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

function LushMetric({ label, value, icon: Icon, color }) {
   return (
      <div className="glass-card p-8 group flex flex-col items-center text-center">
         <div className="glow-halo mb-6">
            <div className="w-14 h-14 rounded-[20px] bg-white/5 border border-white/10 flex items-center justify-center group-hover:scale-110 transition-transform shadow-2xl" style={{ color }}>
               <Icon size={24} strokeWidth={1.8} />
            </div>
         </div>
         <p className="text-[9px] font-black text-zinc-500 uppercase tracking-[0.3em] mb-2">{label}</p>
         <h4 className="text-3xl font-black text-white tracking-tighter group-hover:text-primary-fixed transition-colors">{value}</h4>
      </div>
   );
}

function LushActionTile({ title, desc, onClick, icon: Icon, accent, isLarge }) {
   return (
      <button 
         onClick={onClick}
         className={`glass-card text-left group relative border-white/20 bg-white/5 active:scale-95 transition-all ${isLarge ? 'p-12' : 'p-8'}`}
         style={{ borderColor: `${accent}44` }}
      >
         <div className="absolute -right-8 -top-8 w-24 h-24 blur-3xl rounded-full opacity-10 group-hover:opacity-30 transition-all duration-700" 
              style={{ backgroundColor: accent }}></div>
         <div className={`rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center group-hover:scale-110 transition-all duration-500 shadow-lg ${isLarge ? 'w-16 h-16 mb-10' : 'w-12 h-12 mb-6'}`}
              style={{ color: accent }}>
            <Icon size={isLarge ? 28 : 20} strokeWidth={2} />
         </div>
         <div className="relative z-10">
            <h4 className={`font-black text-white flex items-center gap-3 group-hover:text-primary-fixed transition-colors leading-none ${isLarge ? 'text-2xl mb-4' : 'text-sm mb-2'}`}>
               {title} <ArrowRight size={isLarge ? 22 : 16} className="opacity-0 -translate-x-4 group-hover:opacity-100 group-hover:translate-x-0 transition-all text-primary-fixed" />
            </h4>
            <p className={`text-zinc-400 font-bold leading-relaxed opacity-80 group-hover:opacity-100 transition-opacity ${isLarge ? 'text-sm' : 'text-[9px] line-clamp-2'}`}>{desc}</p>
         </div>
      </button>
   );
}