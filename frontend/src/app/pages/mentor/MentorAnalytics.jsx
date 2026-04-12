import { useState, useEffect } from "react";
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
  Minus,
  X,
  Search,
  Filter,
  Download,
  Calendar,
  ArrowRight
} from "lucide-react";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
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
import { getUser } from "../utils/auth";
import {
  MENTEE_ANALYTICS,
  WEEKLY_STATS,
  MENTOR_DASHBOARD_STATS,
} from "../data/mentorMockData";
import { MentorPageShell } from "../components/mentor/MentorPageShell";

const MENTOR_ANALYTICS_INPUT_CSS = `
        .input-glass {
           background: rgba(255, 255, 255, 0.05);
           border: 1px solid rgba(255, 255, 255, 0.1);
           border-radius: 14px;
           padding: 12px 20px;
           color: white;
           font-weight: 500;
           transition: border-color 0.2s ease, background 0.2s ease;
        }
        .input-glass:focus { border-color: rgba(196, 255, 71, 0.45); background: rgba(255, 255, 255, 0.08); outline: none; box-shadow: 0 0 0 2px rgba(196, 255, 71, 0.12); }
`;

export function MentorAnalytics() {
  const navigate = useNavigate();
  const user = getUser();
  const [selectedMentee, setSelectedMentee] = useState(null);
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (!user || user.role !== "mentor") {
      navigate("/");
    }
  }, []);

  if (!user || user.role !== "mentor") return null;

  const stats = MENTOR_DASHBOARD_STATS;

  // Prepare chart data
  const weeklyChartData = WEEKLY_STATS.map((w) => ({
    week: w.week,
    "Điểm TB": parseFloat(w.avgStarScore.toFixed(2)),
    "Số buổi": w.totalMeetings,
  }));

  const getTrendIcon = (trend) => {
    switch (trend) {
      case "improving":
        return <TrendUp className="w-5 h-5 text-primary-fixed" />;
      case "declining":
        return <TrendDown className="w-5 h-5 text-orange-500" />;
      default:
        return <Minus className="w-5 h-5 text-zinc-500" />;
    }
  };

  const filteredMentees = MENTEE_ANALYTICS.filter(m => 
    m.menteeName.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <MentorPageShell bottomPad="pb-32" extraStyles={MENTOR_ANALYTICS_INPUT_CSS}>
      <div className="relative z-10 mx-auto max-w-7xl p-10 pt-20">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-10 mb-16">
          <div>
            <h1 className="text-6xl font-black text-white font-headline tracking-tighter mb-4 uppercase">
               Phân tích <span className="text-secondary tracking-tighter">& Thông kê</span>
            </h1>
            <p className="text-lg font-medium leading-relaxed text-white/55">Theo dõi dữ liệu thực tế và tiến độ của các mentees</p>
          </div>
        </div>

        {/* Global Key Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-16">
           {[
             { label: "Buổi mentor", value: stats.totalSessions, trend: "+12", icon: ChartLineIcon, color: "#6E35E8" },
             { label: "Tổng Mentees", value: MENTEE_ANALYTICS.length, trend: "Ổn định", icon: Users, color: "#c4ff47" },
             { label: "Đang cải thiện", value: MENTEE_ANALYTICS.filter(m => m.progressTrend === "improving").length, trend: "85%", icon: Target, color: "#f59e0b" },
             { label: "Xếp hạng top", value: MENTEE_ANALYTICS[0].avgStarScore.toFixed(1), trend: "/5.0", icon: Star, color: "#secondary" }
           ].map((stat, i) => (
             <div key={i} className="glass-card p-8 group">
                <div className="flex items-center justify-between mb-6">
                   <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center">
                      <stat.icon size={18} style={{ color: stat.color }} />
                   </div>
                   <span className="text-[10px] font-black text-zinc-600 uppercase tracking-widest">{stat.trend}</span>
                </div>
                <h3 className="text-4xl font-black text-white tracking-tighter mb-1">{stat.value}</h3>
                <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest leading-none">{stat.label}</p>
             </div>
           ))}
        </div>

        {/* Main Analytics Grid */}
        <div className="grid lg:grid-cols-12 gap-10">
           {/* Weekly Trends Chart */}
           <div className="lg:col-span-8">
              <div className="glass-card p-10 h-full">
                 <div className="flex items-center justify-between mb-10">
                    <div>
                       <h4 className="text-xl font-black text-white tracking-tight flex items-center gap-3 mb-2">
                          <ChartLineIcon className="text-primary-fixed" size={20} /> Hiệu suất đào tạo tuần
                       </h4>
                       <p className="text-xs font-medium text-zinc-500 uppercase tracking-widest">Dữ liệu hoàn thành các buổi phỏng vấn thử</p>
                    </div>
                    <div className="flex gap-2">
                       <button className="px-4 py-2 rounded-lg bg-white/10 text-[10px] font-black uppercase tracking-widest">Toàn thời gian</button>
                    </div>
                 </div>

                 <div className="h-[350px] w-full mt-4">
                    <ResponsiveContainer width="100%" height="100%">
                       <AreaChart data={weeklyChartData}>
                          <defs>
                             <linearGradient id="purpleGradient" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#6E35E8" stopOpacity={0.3}/>
                                <stop offset="95%" stopColor="#6E35E8" stopOpacity={0}/>
                             </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.03)" />
                          <XAxis 
                             dataKey="week" 
                             axisLine={false} 
                             tickLine={false} 
                             tick={{ fill: "#666", fontSize: 10, fontWeight: 700 }} 
                             dy={10}
                          />
                          <YAxis 
                             axisLine={false} 
                             tickLine={false} 
                             tick={{ fill: "#666", fontSize: 10, fontWeight: 700 }} 
                          />
                          <Tooltip 
                             contentStyle={{ background: "#0E0922", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "16px", padding: "12px" }}
                             itemStyle={{ color: "#fff", fontSize: "12px", fontWeight: "800" }}
                          />
                          <Area 
                             type="monotone" 
                             dataKey="Số buổi" 
                             stroke="#6E35E8" 
                             strokeWidth={4}
                             fillOpacity={1} 
                             fill="url(#purpleGradient)" 
                          />
                       </AreaChart>
                    </ResponsiveContainer>
                 </div>
              </div>
           </div>

           {/* Performance Radar Example or Sidebar Stats */}
           <div className="lg:col-span-4">
              <div className="glass-card p-10 h-full">
                 <h4 className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em] mb-10">Kỹ năng tập trung</h4>
                 <div className="h-[280px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                       <RadarChart cx="50%" cy="50%" outerRadius="80%" data={[
                          { subject: 'Situation', A: 120, fullMark: 150 },
                          { subject: 'Task', A: 98, fullMark: 150 },
                          { subject: 'Action', A: 86, fullMark: 150 },
                          { subject: 'Result', A: 99, fullMark: 150 },
                          { subject: 'Feedback', A: 85, fullMark: 150 },
                        ]}>
                          <PolarGrid stroke="rgba(255,255,255,0.05)" />
                          <PolarAngleAxis dataKey="subject" tick={{ fill: "#666", fontSize: 9, fontWeight: 800 }} />
                          <Radar name="Skills" dataKey="A" stroke="#c4ff47" fill="#c4ff47" fillOpacity={0.2} strokeWidth={2} />
                       </RadarChart>
                    </ResponsiveContainer>
                 </div>
                 <div className="mt-8 space-y-4">
                    <div className="flex items-center justify-between p-4 rounded-2xl bg-white/5 border border-white/5">
                       <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Trung bình STAR</span>
                       <span className="text-sm font-black text-primary-fixed">4.2/5.0</span>
                    </div>
                    <p className="text-[10px] text-zinc-600 font-bold uppercase tracking-widest text-center">Phân tích dựa trên 150+ buổi mentor</p>
                 </div>
              </div>
           </div>
        </div>

        {/* Mentees Management List */}
        <div className="mt-16 glass-card overflow-hidden">
           <div className="p-10 border-b border-white/5 flex flex-col md:flex-row md:items-center justify-between gap-6 bg-white/[0.01]">
              <div className="flex items-center gap-4">
                 <div className="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-primary-fixed">
                    <Users size={20} />
                 </div>
                 <div>
                    <h4 className="text-xl font-black text-white tracking-tight">Chi tiết Mentees</h4>
                    <p className="text-xs font-medium text-zinc-600 uppercase tracking-widest">Danh sách mentees và tiến trình STAR</p>
                 </div>
              </div>
              <div className="flex items-center gap-4">
                 <div className="relative">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-600" size={16} />
                    <input 
                       type="text" 
                       placeholder="Tìm kiếm mentee..." 
                       value={search}
                       onChange={(e) => setSearch(e.target.value)}
                       className="input-glass pl-12 w-64 text-sm"
                    />
                 </div>
                 <button className="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-zinc-500 hover:text-white transition-all">
                    <Download size={18} />
                 </button>
              </div>
           </div>

           <div className="overflow-x-auto">
              <table className="w-full text-left">
                 <thead>
                    <tr className="border-b border-white/5 text-[10px] font-black text-zinc-600 uppercase tracking-[0.2em]">
                       <th className="px-10 py-6">Mentee</th>
                       <th className="px-10 py-6">Số buổi</th>
                       <th className="px-10 py-6">Điểm TB</th>
                       <th className="px-10 py-6">Xu hướng</th>
                       <th className="px-10 py-6 text-right">Thao tác</th>
                    </tr>
                 </thead>
                 <tbody className="divide-y divide-white/5">
                    {filteredMentees.map((mentee) => (
                      <tr key={mentee.menteeId} className="hover:bg-white/[0.02] transition-colors group">
                         <td className="px-10 py-6">
                            <div className="flex items-center gap-4">
                               <img src={mentee.menteeAvatar} className="w-12 h-12 rounded-2xl object-cover ring-2 ring-white/5" />
                               <div>
                                  <p className="text-sm font-black text-white tracking-tight">{mentee.menteeName}</p>
                                  <p className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest">Cập nhật: {new Date(mentee.lastSessionDate).toLocaleDateString("vi-VN")}</p>
                               </div>
                            </div>
                         </td>
                         <td className="px-10 py-6">
                            <span className="text-xs font-black text-white">{mentee.totalSessions} buổi</span>
                         </td>
                         <td className="px-10 py-6">
                            <div className="flex items-center gap-2">
                               <Star size={12} className="text-[#FFD600] fill-current" />
                               <span className="text-sm font-black text-white">{mentee.avgStarScore.toFixed(1)}</span>
                            </div>
                         </td>
                         <td className="px-10 py-6">
                            <div className="flex items-center gap-2">
                               {getTrendIcon(mentee.progressTrend)}
                               <span className={`text-[10px] font-black uppercase tracking-widest ${mentee.progressTrend === 'improving' ? 'text-primary-fixed' : 'text-zinc-500'}`}>
                                  {mentee.progressTrend === 'improving' ? 'Cải thiện' : 'Ổn định'}
                               </span>
                            </div>
                         </td>
                         <td className="px-10 py-6 text-right">
                            <button 
                               onClick={() => setSelectedMentee(mentee)}
                               className="px-6 py-2.5 rounded-xl bg-white/5 border border-white/10 text-[10px] font-black uppercase tracking-widest text-zinc-500 hover:text-white hover:bg-white/10 transition-all flex items-center justify-center gap-2 ml-auto">
                               Chi tiết <CaretRight size={14} />
                            </button>
                         </td>
                      </tr>
                    ))}
                 </tbody>
              </table>
           </div>
        </div>
      </div>

      {/* Simplified Mentee Detail View (Same logic as Dashboard Modal but within Analytics context) */}
      <AnimatePresence>
        {selectedMentee && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-6 backdrop-blur-2xl bg-black/60"
            onClick={() => setSelectedMentee(null)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="glass-card w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
               <div className="p-8 border-b border-white/5 flex items-center justify-between">
                  <div className="flex items-center gap-6">
                     <img src={selectedMentee.menteeAvatar} className="w-16 h-16 rounded-[24px] object-cover ring-4 ring-white/5" />
                     <div>
                        <h2 className="text-3xl font-black text-white tracking-tighter">{selectedMentee.menteeName}</h2>
                        <p className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em] mt-1 text-primary-fixed">Phân tích hành vi & STAR</p>
                     </div>
                  </div>
                  <button onClick={() => setSelectedMentee(null)} className="w-12 h-12 rounded-xl bg-white/5 flex items-center justify-center text-zinc-500">
                     <X size={20} />
                  </button>
               </div>

               <div className="p-8 overflow-y-auto space-y-10 custom-scrollbar">
                  <div className="grid md:grid-cols-2 gap-10">
                     <div className="space-y-6">
                        <h5 className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Tiến trình STAR theo thời gian</h5>
                        <div className="h-[250px] glass-card p-6 bg-white/[0.01]">
                           <ResponsiveContainer width="100%" height="100%">
                              <LineChart data={selectedMentee.starHistory}>
                                 <XAxis dataKey="date" hide />
                                 <YAxis domain={[0, 5]} hide />
                                 <Tooltip contentStyle={{ background: "#0E0922", borderRadius: "12px", border: "1px solid #333" }} />
                                 <Line type="monotone" dataKey="situation" stroke="#6E35E8" strokeWidth={3} dot={false} />
                                 <Line type="monotone" dataKey="task" stroke="#c4ff47" strokeWidth={3} dot={false} />
                                 <Line type="monotone" dataKey="action" stroke="#f59e0b" strokeWidth={3} dot={false} />
                                 <Line type="monotone" dataKey="result" stroke="#FF8C42" strokeWidth={3} dot={false} />
                              </LineChart>
                           </ResponsiveContainer>
                        </div>
                     </div>
                     <div className="space-y-6">
                        <h5 className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Ưu điểm & Hạn chế</h5>
                        <div className="space-y-4">
                           <div className="p-6 rounded-3xl bg-primary-fixed/5 border border-primary-fixed/10">
                              <h6 className="text-[10px] font-black text-primary-fixed uppercase tracking-widest mb-4 flex items-center gap-2"><Lightning size={12} /> Điểm mạnh</h6>
                              <ul className="space-y-2">
                                 {selectedMentee.strengths.map((s, i) => (
                                   <li key={i} className="text-xs font-medium text-white/70 flex gap-2"><span className="text-primary-fixed">•</span> {s}</li>
                                 ))}
                              </ul>
                           </div>
                           <div className="p-6 rounded-3xl bg-orange-500/5 border border-orange-500/10">
                              <h6 className="text-[10px] font-black text-orange-400 uppercase tracking-widest mb-4 flex items-center gap-2"><Target size={12} /> Cần lưu ý</h6>
                              <ul className="space-y-2">
                                 {selectedMentee.weaknesses.map((w, i) => (
                                   <li key={i} className="text-xs font-medium text-white/70 flex gap-2"><span className="text-orange-400">•</span> {w}</li>
                                 ))}
                              </ul>
                           </div>
                        </div>
                     </div>
                  </div>
               </div>
               
               <div className="p-6 border-t border-white/5 bg-black/20 flex justify-end">
                  <button onClick={() => setSelectedMentee(null)} className="px-8 py-4 rounded-xl bg-white text-black text-[10px] font-black uppercase tracking-widest">Đóng phân tích</button>
               </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </MentorPageShell>
  );
}