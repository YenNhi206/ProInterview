import React, { useLayoutEffect } from "react";
import { useNavigate, useParams } from "react-router";
import {
  Star,
  Clock,
  CheckCircle,
  ArrowLeft,
  Calendar as CalendarBlank,
  MessageCircle as ChatCircle,
  Briefcase,
  Medal,
  Video as VideoCamera,
  Users,
  ArrowRight,
  ShieldCheck,
  Zap as Lightning,
  AlertTriangle as Warning,
  ChevronRight,
  Play,
  Trophy,
  History,
  Target
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { MENTORS } from "../data/mockData";
import { fetchMentor } from "../utils/mentorApi";
import { getReviewsByMentor } from "../utils/bookings";
import { ReportMentorModal } from "../components/modals/ReportMentorModal";
import { MentorPageShell } from "../components/mentor/MentorPageShell";

const REVIEWS = [
  { name: "Nguyễn Văn A", role: "Kỹ sư phần mềm", avatar: "NA", rating: 5, text: "Buổi phỏng vấn thử rất thực tế, mentor chia sẻ nhiều kinh nghiệm nội bộ. Sau buổi này mình tự tin hơn hẳn.", date: "15/02/2026" },
  { name: "Trần Thị B", role: "Chuyên viên Tiếp thị", avatar: "TB", rating: 5, text: "Phản hồi rất chi tiết và mang tính xây dựng. Mentor giải thích rõ tại sao câu trả lời của mình chưa đủ mạnh và cách cải thiện.", date: "10/02/2026" },
];

export function MentorProfile() {
  const navigate = useNavigate();
  const { id } = useParams();
  const [mentor, setMentor] = React.useState(() =>
    id ? MENTORS.find((m) => m.id === id) ?? null : null
  );
  const [loadingMentor, setLoadingMentor] = React.useState(true);
  const [showReportModal, setShowReportModal] = React.useState(false);
  const [realReviews, setRealReviews] = React.useState([]);

  useLayoutEffect(() => {
    if (!id) {
      setMentor(null);
      return;
    }
    setMentor(MENTORS.find((m) => m.id === id) ?? null);
  }, [id]);

  React.useEffect(() => {
    if (!id) {
      setLoadingMentor(false);
      return;
    }
    setLoadingMentor(true);
    fetchMentor(id)
      .then((m) => {
        if (m) setMentor(m);
      })
      .finally(() => setLoadingMentor(false));
  }, [id]);

  React.useEffect(() => {
    if (mentor) setRealReviews(getReviewsByMentor(mentor.id));
  }, [mentor?.id]);

  if (loadingMentor && !mentor) return (
    <div className="flex items-center justify-center min-h-screen bg-[#07060E]">
      <div className="w-10 h-10 border-4 border-primary-fixed border-t-transparent rounded-full animate-spin" />
    </div>
  );
  
  if (!mentor) return <div className="p-20 text-center text-zinc-500 bg-[#07060E] min-h-screen">Không tìm thấy mentor.</div>;

  return (
    <MentorPageShell bottomPad="pb-32">
      <div className="relative z-10 mx-auto max-w-7xl px-10 pb-10 pt-8 sm:pt-10">
        {/* Navigation */}
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="group mb-3 flex h-11 w-11 items-center justify-center rounded-full border border-white/20 bg-white/10 text-white shadow-[0_1px_0_rgba(255,255,255,0.06)_inset] transition-all hover:border-white/35 hover:bg-white/[0.18] active:scale-[0.97]"
          aria-label="Quay lại trang trước"
        >
          <ArrowLeft className="h-5 w-5 transition-transform group-hover:-translate-x-0.5" strokeWidth={2} />
        </button>

        <div className="grid lg:grid-cols-12 gap-10 items-start">
          {/* ── Left Column: Bio & Experience ── */}
          <div className="lg:col-span-8 space-y-10">
            {/* Main Identity Card */}
            <div className="glass-card p-12 relative overflow-hidden group">
               <div className="absolute top-0 right-0 p-12 opacity-5 rotate-12 group-hover:rotate-0 transition-all duration-1000">
                  <Medal size={160} className="text-primary-fixed" />
               </div>
               <div className="relative z-10 flex flex-col md:flex-row gap-10">
                  <div className="relative shrink-0">
                     <img src={mentor.avatar} className="w-40 h-40 rounded-[48px] object-cover ring-8 ring-white/5 shadow-2xl" />
                     {mentor.available && (
                        <div className="absolute -bottom-4 right-4 bg-emerald-500 text-white text-[10px] font-black px-4 py-2 rounded-2xl shadow-xl flex items-center gap-2">
                           <div className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" /> SẴN SÀNG
                        </div>
                     )}
                  </div>
                  <div className="flex-1">
                     <div className="flex flex-wrap items-center gap-2 mb-6">
                        <span className="px-4 py-1.5 bg-primary-fixed/20 text-primary-fixed text-[10px] font-black uppercase tracking-widest rounded-xl border border-primary-fixed/20">Hạng {mentor.id === "1" ? "Pro" : "Elite"}</span>
                        <span className="px-4 py-1.5 bg-white/5 text-zinc-400 text-[10px] font-black uppercase tracking-widest rounded-xl border border-white/10">{mentor.company}</span>
                     </div>
                     <h1 className="text-6xl font-black text-white font-headline tracking-tighter mb-4 leading-none">{mentor.name}</h1>
                     <p className="text-xl font-medium text-zinc-500 mb-8">{mentor.title}</p>
                     <div className="grid grid-cols-2 md:grid-cols-3 gap-8 pt-8 border-t border-white/5">
                        <div>
                           <div className="flex items-center gap-2 text-[#FFD600] mb-1">
                              <Star size={16} className="fill-current" />
                              <span className="text-lg font-black">{mentor.rating}</span>
                           </div>
                           <p className="text-[10px] font-black text-zinc-600 uppercase tracking-widest">{mentor.reviews} Đánh giá</p>
                        </div>
                        <div>
                           <p className="text-lg font-black text-white mb-1">{mentor.sessionsDone}+</p>
                           <p className="text-[10px] font-black text-zinc-600 uppercase tracking-widest">Buổi Mentor</p>
                        </div>
                        <div>
                           <p className="text-lg font-black text-white mb-1">{mentor.responseTime}</p>
                           <p className="text-[10px] font-black text-zinc-600 uppercase tracking-widest">Phản hồi</p>
                        </div>
                     </div>
                  </div>
               </div>
            </div>

            {/* Specialties & Bio */}
            <div className="glass-card p-12">
               <h3 className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.4em] mb-10 flex items-center gap-3">
                  <Lightning size={14} className="text-primary-fixed" /> Giới chuyên môn & Kỹ năng
               </h3>
               <div className="flex flex-wrap gap-3 mb-12">
                  {mentor.tags.map(tag => (
                    <span key={tag} className="px-6 py-2.5 rounded-2xl bg-white/5 border border-white/10 text-[11px] font-black text-zinc-300 uppercase tracking-widest hover:border-primary-fixed transition-colors">{tag}</span>
                  ))}
               </div>
               <div className="space-y-6">
                  <h4 className="text-2xl font-black text-white tracking-tight">Về Mentor</h4>
                  <p className="text-lg font-medium text-zinc-400 leading-relaxed italic border-l-4 border-primary-fixed pl-8 py-2">
                     "{mentor.bio}"
                  </p>
               </div>
            </div>

            {/* Work Experience */}
            <div className="glass-card p-12">
               <h3 className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.4em] mb-10">Kinh nghiệm phát triển</h3>
               <div className="space-y-8">
                  {mentor.companies.map((company, i) => (
                    <div key={i} className="flex items-center gap-6 group">
                       <div className="w-14 h-14 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-zinc-600 group-hover:text-primary-fixed transition-colors">
                          <Briefcase size={24} />
                       </div>
                       <div>
                          <p className="text-xl font-black text-white leading-none mb-2">{company}</p>
                          <p className="text-[10px] font-black text-zinc-600 uppercase tracking-widest">{i === 0 ? "💼 CURRENT POSITION" : "💼 PAST EXPERIENCE"}</p>
                       </div>
                    </div>
                  ))}
               </div>
            </div>

            {/* Reviews Section */}
            <div className="glass-card p-12">
               <div className="flex items-center justify-between mb-12">
                  <h3 className="text-3xl font-black text-white tracking-tighter uppercase">Đánh giá <span className="text-secondary tracking-tighter">Học viên</span></h3>
                  <div className="flex items-center gap-3 px-6 py-3 rounded-2xl bg-white/5 border border-white/10">
                     <Star className="text-[#FFD600] fill-current" size={20} />
                     <span className="text-2xl font-black text-white">{mentor.rating}</span>
                  </div>
               </div>
               <div className="space-y-6">
                  {REVIEWS.map((review, i) => (
                    <div key={i} className="p-8 rounded-[32px] bg-white/[0.02] border border-white/5">
                       <div className="flex items-center justify-between mb-6">
                          <div className="flex items-center gap-4">
                             <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-fixed to-secondary flex items-center justify-center text-[10px] font-black text-black">{review.avatar}</div>
                             <div>
                                <p className="text-sm font-black text-white">{review.name}</p>
                                <p className="text-[10px] font-black text-zinc-600 uppercase tracking-widest">{review.role}</p>
                             </div>
                          </div>
                          <div className="flex gap-1">
                             {[1,2,3,4,5].map(j => <Star key={j} size={14} className="text-[#FFD600] fill-current" />)}
                          </div>
                       </div>
                       <p className="text-base font-medium text-zinc-400 italic">"{review.text}"</p>
                       <p className="text-[10px] font-black text-zinc-600 uppercase tracking-widest mt-6 text-right">📅 {review.date}</p>
                    </div>
                  ))}
               </div>
            </div>
          </div>

          {/* ── Right Column: Booking Widget ── */}
          <div className="lg:col-span-4">
             <div className="glass-card p-10 sticky top-10 border-primary-fixed/30 overflow-hidden shadow-[0_20px_80px_rgba(196, 255, 71,0.12)]">
                <div className="absolute top-0 right-0 p-8 opacity-5 -rotate-12 translate-x-10 -translate-y-10">
                   <Target size={180} />
                </div>
                <div className="relative z-10">
                   <div className="text-center mb-10 pb-10 border-b border-white/5">
                      <p className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.3em] mb-4">Chi phí Mentor</p>
                      <h2 className="text-5xl font-black text-white tracking-tighter mb-1">{mentor.price.toLocaleString("vi")}₫</h2>
                      <p className="text-[10px] font-black text-primary-fixed uppercase tracking-widest">/ 60 PHÚT ĐÀO TẠO 1-1</p>
                   </div>
                   
                   <div className="space-y-6 mb-12">
                      {[
                        { icon: VideoCamera, text: "Hỗ trợ Zoom / Google Meet" },
                        { icon: CalendarBlank, text: "Tự chọn lịch trình linh hoạt" },
                        { icon: ShieldCheck, text: "Cam kết Roadmap đầu ra" },
                        { icon: Lightning, text: "Feedback gửi sau 24h" }
                      ].map((item, i) => (
                        <div key={i} className="flex items-center gap-5">
                           <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-primary-fixed">
                              <item.icon size={18} />
                           </div>
                           <p className="text-xs font-black text-zinc-400 uppercase tracking-widest">{item.text}</p>
                        </div>
                      ))}
                   </div>

                   <button 
                      onClick={() => navigate(`/booking/${mentor.id}`)}
                      className="w-full py-5 rounded-3xl bg-white text-black text-xs font-black uppercase tracking-widest hover:scale-105 transition-all shadow-xl flex items-center justify-center gap-3 mb-4">
                      Đặt lịch ngay <ArrowRight size={18} />
                   </button>
                   <button className="w-full py-5 rounded-3xl bg-white/5 border border-white/10 text-xs font-black uppercase tracking-widest text-zinc-400 hover:text-white transition-all">
                      Xem toàn bộ lịch trống
                   </button>

                   <div className="mt-10 pt-10 border-t border-white/5 space-y-4">
                      <div className="flex items-center gap-3 text-emerald-500/80">
                         <ShieldCheck size={14} />
                         <p className="text-[9px] font-black uppercase tracking-widest">Hoàn tiền 100% nếu không hài lòng</p>
                      </div>
                      <button 
                        onClick={() => setShowReportModal(true)}
                        className="w-full flex items-center justify-center gap-2 text-[10px] font-black text-zinc-600 uppercase tracking-widest hover:text-red-500 transition-colors">
                        <Warning size={14} /> Báo cáo Mentor
                      </button>
                   </div>
                </div>
             </div>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {showReportModal && (
          <ReportMentorModal
            mentorId={mentor.id}
            mentorName={mentor.name}
            onClose={() => setShowReportModal(false)}
          />
        )}
      </AnimatePresence>
    </MentorPageShell>
  );
}