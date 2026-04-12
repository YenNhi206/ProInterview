import { useState, useEffect } from "react";
import { useNavigate } from "react-router";
import { 
  Star, 
  Heart, 
  Trophy, 
  Calendar, 
  User, 
  Quote, 
  ThumbsUp, 
  Zap, 
  Filter, 
  Search,
  ArrowLeft,
  ArrowRight,
  ChevronRight,
  MessageCircle,
  TrendingUp,
  Award
} from "lucide-react";
import { COMPLETED_MENTOR_MEETINGS } from "../data/mentorMockData";
import { getUser } from "../utils/auth";
import { MentorPageShell } from "../components/mentor/MentorPageShell";

const MENTOR_REVIEWS_INPUT_CSS = `
        .input-glass {
           background: rgba(255, 255, 255, 0.03);
           border: 1px solid rgba(255, 255, 255, 0.1);
           border-radius: 20px;
           padding: 14px 24px;
           color: white;
           transition: all 0.3s;
        }
        .input-glass:focus { border-color: #c4ff47; background: rgba(255, 255, 255, 0.06); outline: none; }
`;

export function MentorReviews() {
  const navigate = useNavigate();
  const userAuth = getUser();
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (!userAuth || userAuth.role !== "mentor") {
      navigate("/");
    }
  }, []);

  if (!userAuth || userAuth.role !== "mentor") return null;

  // Get all meetings with reviews
  const reviewedMeetings = COMPLETED_MENTOR_MEETINGS.filter((m) => m.menteeReview);

  // Filter by rating
  const filtered = reviewedMeetings.filter((m) => {
    if (filter === "all") return true;
    return m.menteeReview.rating === parseInt(filter);
  });

  // Filter by search
  const searched = filtered.filter((m) =>
    m.mentee.name.toLowerCase().includes(search.toLowerCase()) ||
    m.menteeReview.comment.toLowerCase().includes(search.toLowerCase())
  );

  const avgRating = reviewedMeetings.length > 0
    ? reviewedMeetings.reduce((sum, m) => sum + m.menteeReview.rating, 0) / reviewedMeetings.length
    : 0;

  const recommendCount = reviewedMeetings.filter((m) => m.menteeReview.wouldRecommend).length;

  return (
    <MentorPageShell bottomPad="pb-32" extraStyles={MENTOR_REVIEWS_INPUT_CSS}>
      <div className="relative z-10 p-10 max-w-7xl mx-auto pt-20">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-10 mb-16">
          <div>
            <h1 className="text-6xl font-black text-white font-headline tracking-tighter mb-4 uppercase">
               Đánh giá <span className="text-primary-fixed tracking-tighter">từ Mentees</span>
            </h1>
            <p className="text-white/55 text-lg font-medium">Lắng nghe ý kiến và xây dựng uy tín Mentor của bạn</p>
          </div>
        </div>

        {/* Aggregate Feedback Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-16">
          <div className="glass-card p-10 relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-8 opacity-[0.03] group-hover:opacity-10 transition-opacity">
               <Star size={120} className="text-primary-fixed" />
            </div>
            <p className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.3em] mb-4">Điểm trung bình</p>
            <div className="flex items-end gap-3 mb-6">
              <h3 className="text-6xl font-black text-white tracking-tighter">{avgRating.toFixed(1)}</h3>
              <p className="text-xl font-bold text-zinc-600 mb-2">/5.0</p>
            </div>
            <div className="flex gap-1.5">
              {[1, 2, 3, 4, 5].map((i) => (
                <Star key={i} size={20} className={i <= Math.round(avgRating) ? "text-[#FFD600] fill-[#FFD600]" : "text-white/10"} />
              ))}
            </div>
          </div>

          <div className="glass-card p-10 relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-8 opacity-[0.03] group-hover:opacity-10 transition-opacity">
               <MessageCircle size={120} className="text-secondary" />
            </div>
            <p className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.3em] mb-4">Tổng số nhận xét</p>
            <h3 className="text-6xl font-black text-white tracking-tighter mb-4">{reviewedMeetings.length}</h3>
            <p className="text-xs font-bold text-secondary uppercase tracking-widest flex items-center gap-2">
               <TrendingUp size={14} /> +2 tuần qua
            </p>
          </div>

          <div className="glass-card p-10 relative overflow-hidden group border-primary-fixed/20">
            <div className="absolute top-0 right-0 p-8 opacity-[0.03] group-hover:opacity-10 transition-opacity">
               <Award size={120} className="text-primary-fixed" />
            </div>
            <p className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.3em] mb-4">Tỷ lệ hài lòng</p>
            <h3 className="text-6xl font-black text-primary-fixed tracking-tighter mb-4">
              {reviewedMeetings.length > 0 ? Math.round((recommendCount / reviewedMeetings.length) * 100) : 0}%
            </h3>
            <p className="text-xs font-bold text-zinc-600 uppercase tracking-widest">Dựa trên recommend của mentee</p>
          </div>
        </div>

        {/* Dynamic Controls */}
        <div className="flex flex-col md:flex-row items-center gap-6 mb-12">
          <div className="relative flex-1 group w-full">
            <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-zinc-600 group-hover:text-primary-fixed transition-colors" size={20} />
            <input 
              type="text" 
              placeholder="Tìm kiếm theo tên mentee hoặc nội dung review..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="input-glass pl-16 w-full text-sm font-medium"
            />
          </div>
          <div className="flex gap-2 p-2 bg-white/[0.03] border border-white/5 rounded-[24px]">
            {["all", "5", "4", "3"].map((v) => (
              <button
                key={v}
                onClick={() => setFilter(v)}
                className={`px-8 py-3 rounded-[18px] text-[10px] font-black uppercase tracking-widest transition-all ${
                  filter === v ? "bg-white text-black shadow-xl" : "text-zinc-500 hover:text-white"
                }`}
              >
                {v === "all" ? "Tất cả" : `${v}★`}
              </button>
            ))}
          </div>
        </div>

        {/* Feed of Review Cards */}
        <div className="space-y-8">
          {searched.length === 0 ? (
            <div className="glass-card p-20 text-center">
              <MessageCircle size={60} className="mx-auto mb-6 text-zinc-700 opacity-20" />
              <p className="text-lg font-bold text-zinc-500">Chúng tôi không tìm thấy nhận xét phù hợp</p>
            </div>
          ) : (
            searched.map((meeting) => (
              <div
                key={meeting.id}
                className="glass-card p-10 group overflow-hidden"
              >
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-10">
                  <div className="flex items-center gap-8">
                    <div className="relative">
                       <img
                         src={meeting.mentee.avatar}
                         alt={meeting.mentee.name}
                         className="w-20 h-20 rounded-[30px] object-cover ring-4 ring-white/5 transition-transform group-hover:scale-105"
                       />
                       <div className="absolute -bottom-2 -right-2 w-8 h-8 rounded-xl bg-primary-fixed text-black flex items-center justify-center shadow-lg">
                          <Trophy size={14} />
                       </div>
                    </div>
                    <div>
                      <h3 className="text-2xl font-black text-white tracking-tighter mb-1 group-hover:text-primary-fixed transition-colors">
                        {meeting.mentee.name}
                      </h3>
                      <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-4">
                        {meeting.position} · {meeting.company}
                      </p>
                      <div className="flex items-center gap-3">
                         <div className="flex gap-1">
                           {[1, 2, 3, 4, 5].map((i) => (
                             <Star key={i} size={14} className={i <= meeting.menteeReview.rating ? "text-[#FFD600] fill-[#FFD600]" : "text-white/10"} />
                           ))}
                         </div>
                         <span className="text-xs font-black text-white">{meeting.menteeReview.rating}.0 Score</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col items-end gap-3 text-right">
                     <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest flex items-center gap-2">
                        <Calendar size={14} /> {new Date(meeting.menteeReview.reviewDate).toLocaleDateString("vi-VN")}
                     </p>
                     <div className="flex gap-2">
                        {meeting.menteeReview.wouldRecommend && (
                           <span className="px-4 py-1.5 rounded-lg bg-primary-fixed/10 text-primary-fixed text-[10px] font-black uppercase tracking-widest border border-primary-fixed/20">Recommend</span>
                        )}
                        <span className="px-4 py-1.5 rounded-lg bg-white/5 text-zinc-500 text-[10px] font-black uppercase tracking-widest border border-white/10">Public</span>
                     </div>
                  </div>
                </div>

                <div className="mt-12 relative p-10 rounded-[40px] bg-white/[0.02] border border-white/5">
                  <Quote size={80} className="absolute -top-4 -left-4 text-primary-fixed opacity-[0.08] -rotate-12" />
                  <p className="text-xl font-medium text-white/80 leading-relaxed italic z-10 relative">
                    "{meeting.menteeReview.comment}"
                  </p>
                  <div className="absolute bottom-6 right-8">
                     <button className="flex items-center gap-2 text-[10px] font-black text-zinc-600 uppercase tracking-widest hover:text-primary-fixed transition-colors">
                        Phản hồi nhận xét <ArrowRight size={14} />
                     </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </MentorPageShell>
  );
}
