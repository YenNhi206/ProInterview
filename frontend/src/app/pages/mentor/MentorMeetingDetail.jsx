import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router";
import { 
  ArrowLeft, 
  Video, 
  Calendar, 
  Clock, 
  Star, 
  FileText, 
  User, 
  Briefcase, 
  Target, 
  CheckCircle2, 
  AlertCircle,
  MoreVertical,
  MessageSquare,
  Zap,
  ShieldCheck,
  ChevronRight,
  TrendingUp,
  Layout
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { getUser } from "../utils/auth";
import { UPCOMING_MENTOR_MEETINGS, COMPLETED_MENTOR_MEETINGS } from "../data/mentorMockData";
import { MentorPageShell } from "../components/mentor/MentorPageShell";

const MENTOR_MEETING_DETAIL_EXTRA_CSS = `
        .neon-border { position: relative; }
        .neon-border::after {
           content: ''; position: absolute; inset: 0;
           border-radius: inherit;
           padding: 1px;
           background: linear-gradient(135deg, rgba(180, 245, 0, 0.4), transparent, rgba(110, 53, 232, 0.4));
           -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
           mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
           -webkit-mask-composite: xor;
           mask-composite: exclude;
           pointer-events: none;
        }
`;

export function MentorMeetingDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const user = getUser();
  
  // Look for the meeting in either upcoming or completed
  const meeting = [...UPCOMING_MENTOR_MEETINGS, ...COMPLETED_MENTOR_MEETINGS].find(m => m.id === id);

  useEffect(() => {
    if (!user || user.role !== "mentor") {
      navigate("/");
    }
    if (!meeting) {
      // In a real app we'd load it from API, for mock we just go back if not found
    }
  }, [id, user, meeting]);

  if (!user || user.role !== "mentor" || !meeting) return null;

  const isCompleted = meeting.status === "completed" || meeting.overallScore > 0;

  return (
    <MentorPageShell bottomPad="pb-32" extraStyles={MENTOR_MEETING_DETAIL_EXTRA_CSS}>
      <div className="relative z-10 p-10 max-w-7xl mx-auto pt-20">
        {/* Header Navigation */}
        <div className="flex items-center justify-between mb-16">
           <button type="button" onClick={() => navigate(-1)} className="group flex items-center gap-3 text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500 transition-all hover:text-white">
              <ArrowLeft size={16} className="transition-transform group-hover:-translate-x-1" /> Quay lại
           </button>
           <div className="flex gap-4">
              <button className="w-12 h-12 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-zinc-500 hover:text-white transition-all">
                 <MoreVertical size={20} />
              </button>
           </div>
        </div>

        <div className="grid lg:grid-cols-12 gap-10">
           {/* Main Session Content */}
           <div className="lg:col-span-8 space-y-10">
              {/* Session Core Info Card */}
              <div className="glass-card p-12 relative overflow-hidden group neon-border">
                 <div className="absolute top-0 right-0 p-12 opacity-5 scale-150 rotate-12 group-hover:rotate-0 transition-all duration-1000">
                    <Video size={180} className="text-primary-fixed" />
                 </div>
                 <div className="relative z-10">
                    <div className="flex items-center gap-4 mb-8">
                       <span className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest ${isCompleted ? 'bg-primary-fixed/20 text-primary-fixed border border-primary-fixed/20' : 'bg-orange-500/20 text-orange-400 border border-orange-500/20'}`}>
                          {isCompleted ? 'Đã hoàn thành' : 'Sắp diễn ra'}
                       </span>
                       <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest flex items-center gap-2">
                          <Layout size={14} /> {meeting.meetingType === 'mock-interview' ? 'Phỏng vấn thử' : 'Tư vấn chuyên sâu'}
                       </span>
                    </div>
                    <h1 className="text-6xl font-black text-white font-headline tracking-tighter mb-10 max-w-2xl leading-none">
                       {isCompleted ? 'Báo cáo chi tiết buổi Mentor' : 'Sẵn sàng phỏng vấn cùng Mentee'}
                    </h1>
                    
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-10">
                       <div className="space-y-2">
                          <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Thời gian bắt đầu</p>
                          <p className="text-xl font-black text-white flex items-center gap-3">
                             <Clock size={20} className="text-primary-fixed" /> {meeting.scheduledTime}
                          </p>
                       </div>
                       <div className="space-y-2">
                          <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Ngày diễn ra</p>
                          <p className="text-xl font-black text-white flex items-center gap-3">
                             <Calendar size={20} className="text-primary-fixed" /> {new Date(meeting.scheduledDate).toLocaleDateString("vi-VN")}
                          </p>
                       </div>
                       <div className="space-y-2">
                          <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Thời lượng</p>
                          <p className="text-xl font-black text-white flex items-center gap-3">
                             <ShieldCheck size={20} className="text-primary-fixed" /> {meeting.duration} Phút
                          </p>
                       </div>
                    </div>
                 </div>
              </div>

              {/* STAR Components Analysis (Visible if completed) */}
              {isCompleted && (
                 <div className="glass-card p-12">
                    <div className="flex items-center justify-between mb-12">
                       <h4 className="text-2xl font-black text-white font-headline tracking-tight flex items-center gap-4">
                          <Target className="text-primary-fixed" size={24} /> Kết quả STAR Framework
                       </h4>
                       <div className="flex items-center gap-3 px-6 py-3 rounded-2xl bg-white/5 border border-white/10">
                          <Star className="text-[#FFD600] fill-current" size={18} />
                          <span className="text-lg font-black text-white">{meeting.overallScore?.toFixed(1)}</span>
                          <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">/ 5.0</span>
                       </div>
                    </div>

                    <div className="space-y-10">
                       {[
                         { label: "Situation", key: "situation", color: "#6E35E8", desc: "Xác định hoàn cảnh và bối cảnh cụ thể" },
                         { label: "Task", key: "task", color: "#8B4DFF", desc: "Nhiệm vụ và mục tiêu cần đạt được" },
                         { label: "Action", key: "action", color: "#c4ff47", desc: "Hành động thực tế đã triển khai" },
                         { label: "Result", key: "result", color: "#FF8C42", desc: "Kết quả cuối cùng và giá trị đạt được" }
                       ].map((item) => {
                         const score = meeting.starScores?.[item.key] || 0;
                         return (
                           <div key={item.key} className="group">
                              <div className="flex items-start justify-between mb-4">
                                 <div className="flex items-center gap-4">
                                    <div className="w-10 h-10 rounded-2xl flex items-center justify-center text-white font-black text-sm" style={{ background: item.color }}>{item.label[0]}</div>
                                    <div>
                                       <p className="text-sm font-black text-white tracking-tight">{item.label}</p>
                                       <p className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest">{item.desc}</p>
                                    </div>
                                 </div>
                                 <span className="text-sm font-black text-white">{score.toFixed(1)}/5.0</span>
                              </div>
                              <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                                 <motion.div 
                                    initial={{ width: 0 }}
                                    animate={{ width: `${(score / 5) * 100}%` }}
                                    transition={{ duration: 1.5, ease: "easeOut" }}
                                    className="h-full rounded-full" 
                                    style={{ background: item.color, boxShadow: `0 0 15px ${item.color}40` }} 
                                 />
                              </div>
                           </div>
                         );
                       })}
                    </div>
                 </div>
              )}

              {/* General Feedback & Notes */}
              <div className="grid md:grid-cols-2 gap-10">
                 <div className="glass-card p-10">
                    <h5 className="text-[10px] font-black text-primary-fixed uppercase tracking-[0.2em] mb-6">Nhận xét từ Mentor</h5>
                    <p className="text-base font-medium text-zinc-300 leading-relaxed italic border-l-4 border-primary-fixed pl-6 py-2">
                       "{meeting.feedback || "Chưa có nhận xét tổng quát cho buổi này."}"
                    </p>
                 </div>
                 <div className="glass-card p-10">
                    <h5 className="text-[10px] font-black text-secondary uppercase tracking-[0.2em] mb-6">Ghi chú & Next Steps</h5>
                    <p className="text-sm font-medium text-zinc-400 leading-relaxed">
                       {meeting.notes || "Mentor chưa lưu lại ghi chú cụ thể nào."}
                    </p>
                 </div>
              </div>
           </div>

           {/* Mentee Profile Sidebar */}
           <div className="lg:col-span-4 space-y-10">
              <div className="glass-card p-10">
                 <p className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.3em] mb-10">Hồ sơ Mentee</p>
                 <div className="flex flex-col items-center text-center mb-10">
                    <img src={meeting.mentee.avatar} className="w-32 h-32 rounded-[40px] object-cover ring-8 ring-white/5 shadow-2xl mb-6" />
                    <h3 className="text-3xl font-black text-white tracking-tighter">{meeting.mentee.name}</h3>
                    <p className="text-sm font-black text-primary-fixed uppercase tracking-widest mt-2">{meeting.mentee.level}</p>
                 </div>
                 
                 <div className="space-y-6 pt-10 border-t border-white/5">
                    <div className="flex items-center gap-4">
                       <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-zinc-500"><Briefcase size={18} /></div>
                       <div>
                          <p className="text-[10px] font-black text-zinc-600 uppercase tracking-widest">Vị trí hiện tại</p>
                          <p className="text-xs font-bold text-white">{meeting.position} @ {meeting.company}</p>
                       </div>
                    </div>
                    <div className="flex items-center gap-4">
                       <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-zinc-500"><Star size={18} /></div>
                       <div>
                          <p className="text-[10px] font-black text-zinc-600 uppercase tracking-widest">Các buổi đã tham gia</p>
                          <p className="text-xs font-bold text-white">12 buổi học tập</p>
                       </div>
                    </div>
                 </div>

                 <button onClick={() => navigate("/mentor/analytics")} className="w-full mt-10 py-4 rounded-3xl bg-white/5 border border-white/10 text-[10px] font-black uppercase tracking-widest hover:text-white hover:bg-white/10 transition-all flex items-center justify-center gap-3">
                    Xem toàn bộ tiến trình <ChevronRight size={14} />
                 </button>
              </div>

              {/* Action Toolbar */}
              <div className="glass-card p-10">
                 <h4 className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em] mb-8">Thao tác hệ thống</h4>
                 <div className="space-y-4">
                    {!isCompleted ? (
                       <>
                          <button className="w-full py-5 rounded-3xl bg-primary-fixed text-black text-[10px] font-black uppercase tracking-widest shadow-[0_15px_40px_rgba(196, 255, 71,0.32)] hover:scale-105 transition-all">
                             Vào phòng họp ngay
                          </button>
                          <button className="w-full py-5 rounded-3xl bg-white/5 border border-white/10 text-[10px] font-black uppercase tracking-widest hover:bg-white/10 transition-all">
                             Dời lịch hẹn
                          </button>
                          <button className="w-full py-5 rounded-3xl bg-red-600/10 border border-red-500/20 text-red-500 text-[10px] font-black uppercase tracking-widest hover:bg-red-500/20 transition-all">
                             Hủy buổi mentor
                          </button>
                       </>
                    ) : (
                       <>
                          <button className="w-full py-5 rounded-3xl bg-primary-fixed text-black text-[10px] font-black uppercase tracking-widest shadow-[0_15px_40px_rgba(196, 255, 71,0.32)] hover:scale-105 transition-all flex items-center justify-center gap-2">
                             <TrendingUp size={16} /> Gửi feedback bổ sung
                          </button>
                          <button className="w-full py-5 rounded-3xl bg-white/5 border border-white/10 text-[10px] font-black uppercase tracking-widest hover:bg-white/10 transition-all flex items-center justify-center gap-2">
                             <Layout size={16} /> Xem bản ghi video
                          </button>
                       </>
                    )}
                 </div>
              </div>
           </div>
        </div>
      </div>
    </MentorPageShell>
  );
}