import { useState, useEffect } from "react";
import { useNavigate } from "react-router";
import {
   Users,
   Star,
   ArrowLeft,
   Search,
   Filter,
   CheckCircle2,
   Clock,
   AlertCircle,
   FileBadge,
   ChevronRight,
   ShieldCheck,
   TrendingUp,
   Layout,
   BookOpen,
   Zap,
   StarHalf
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { getUser } from "../utils/auth";
import { MentorPageShell } from "../components/mentor/MentorPageShell";

const MENTOR_PEER_REVIEW_INPUT_CSS = `
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

const MOCK_COURSES_FOR_REVIEW = [
   { id: 1, title: "Làm chủ STAR Method trong phỏng vấn hành vi", mentor: "Nguyễn Tuấn Anh", category: "Interview Skills", status: "pending", rating: 0, participants: 120, cover: "https://images.unsplash.com/photo-1573497619292-0b2f5c8e030b?auto=format&fit=crop&q=80&w=400" },
   { id: 2, title: "Technical Interview: Data Structures & Algorithms chuyên sâu", mentor: "Trần Minh Châu", category: "Technical", status: "reviewed", rating: 4.8, participants: 85, cover: "https://images.unsplash.com/photo-1517694712202-14dd9538aa97?auto=format&fit=crop&q=80&w=400" },
   { id: 3, title: "Kỹ năng đàm phán lương dành cho Senior Dev", mentor: "Lê Văn Nam", category: "Salary Negotiation", status: "pending", rating: 0, participants: 45, cover: "https://images.unsplash.com/photo-1552664730-d307ca884978?auto=format&fit=crop&q=80&w=400" },
   { id: 4, title: "Xây dựng Personal Brand cho Freelancer", mentor: "Phạm Hồng Nhung", category: "Soft Skills", status: "pending", rating: 0, participants: 62, cover: "https://images.unsplash.com/photo-1551434678-e076c223a692?auto=format&fit=crop&q=80&w=400" },
];

export function MentorPeerReview() {
   const navigate = useNavigate();
   const user = getUser();
   const [filter, setFilter] = useState("all");
   const [search, setSearch] = useState("");
   const [category, setCategory] = useState("all");

   useEffect(() => {
      if (!user || user.role !== "mentor") {
         navigate("/");
      }
   }, []);

   if (!user || user.role !== "mentor") return null;

   const filtered = MOCK_COURSES_FOR_REVIEW.filter(c => {
      const matchesFilter = filter === "all" || c.status === filter;
      const matchesSearch = c.title.toLowerCase().includes(search.toLowerCase()) || c.mentor.toLowerCase().includes(search.toLowerCase());
      const matchesCategory = category === "all" || c.category === category;
      return matchesFilter && matchesSearch && matchesCategory;
   });

   return (
      <MentorPageShell bottomPad="pb-32" extraStyles={MENTOR_PEER_REVIEW_INPUT_CSS}>
         <div className="relative z-10 p-10 max-w-7xl mx-auto pt-20">
            {/* Header Section */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-10 mb-16">
               <div className="max-w-3xl">
                  <h1 className="text-6xl font-black text-white font-headline tracking-tighter mb-6 uppercase">
                     Đánh giá <span className="text-secondary tracking-tighter">Chéo Khóa học</span>
                  </h1>
                  <p className="text-white/55 text-lg font-medium leading-relaxed">
                     Với tư cách mentor trong hệ thống ProInterview, bạn có hành quyền đánh giá chuyên môn các khóa học của đồng nghiệp để đảm bảo chất lượng nội dung toàn hệ thống.
                  </p>
               </div>
               <button onClick={() => navigate("/mentor/dashboard")} className="px-8 py-4 rounded-3xl bg-white/5 border border-white/10 text-xs font-black uppercase tracking-widest hover:bg-white/10 transition-all flex items-center gap-2">
               </button>
            </div>

            {/* Global Stats Bar */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-16">
               {[
                  { label: "Cần đánh giá", value: 4, icon: Clock, color: "#6E35E8" },
                  { label: "Đã hoàn thành", value: 1, icon: CheckCircle2, color: "#c4ff47" },
                  { label: "Review điểm cao", value: 3, icon: TrendingUp, color: "#secondary" },
                  { label: "Rating trung bình", value: "5.0", icon: Star, color: "#f59e0b" }
               ].map((stat, i) => (
                  <div key={i} className="glass-card p-8 group">
                     <div className="flex items-center justify-between mb-6">
                        <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center">
                           <stat.icon size={18} style={{ color: stat.color }} />
                        </div>
                        <div className="w-2 h-2 rounded-full bg-white/10 group-hover:bg-primary-fixed transition-colors" />
                     </div>
                     <h3 className="text-4xl font-black text-white tracking-tighter mb-1">{stat.value}</h3>
                     <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest leading-none">{stat.label}</p>
                  </div>
               ))}
            </div>

            {/* Informational Toast */}
            <div className="glass-card mb-16 p-10 relative overflow-hidden group">
               <div className="absolute top-0 right-0 p-10 rotate-12 opacity-5 scale-125 group-hover:rotate-0 transition-all duration-1000">
                  <ShieldCheck size={140} className="text-primary-fixed" />
               </div>
               <div className="relative z-10 flex items-start gap-8">
                  <div className="w-14 h-14 rounded-2xl bg-primary-fixed/20 flex items-center justify-center text-primary-fixed shrink-0">
                     <Zap size={28} />
                  </div>
                  <div>
                     <h4 className="text-xl font-black text-white tracking-tight mb-3">Quy tắc Đánh giá chuyên môn</h4>
                     <p className="text-sm font-medium text-zinc-500 max-w-2xl leading-relaxed italic">
                        "Hãy đánh giá khách quan và chuyên nghiệp dựa trên kiến thức của bạn. Đánh giá của bạn giúp học viên tin tưởng hơn vào nội dung và nhận point thưởng từ nền tảng."
                     </p>
                  </div>
               </div>
            </div>

            {/* Filter & List Controls */}
            <div className="space-y-8">
               <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                  <div className="relative flex-1 group max-w-xl">
                     <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-zinc-600 group-hover:text-primary-fixed transition-colors" size={20} />
                     <input
                        type="text"
                        placeholder="Tìm kiếm khóa học hoặc mentor..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="input-glass pl-16 w-full text-sm font-medium"
                     />
                  </div>
                  <div className="flex gap-2 p-2 bg-white/[0.03] border border-white/5 rounded-[24px]">
                     {["all", "pending", "reviewed"].map((v) => (
                        <button
                           key={v}
                           onClick={() => setFilter(v)}
                           className={`px-8 py-3 rounded-[18px] text-[10px] font-black uppercase tracking-widest transition-all ${filter === v ? "bg-white text-black shadow-xl" : "text-zinc-500 hover:text-white"
                              }`}
                        >
                           {v === "all" ? "Tất cả" : v === "pending" ? "Chưa đánh giá" : "Đã đánh giá"}
                        </button>
                     ))}
                  </div>
               </div>

               <div className="flex flex-wrap gap-3">
                  {["all", "Interview Skills", "Technical", "Salary Negotiation", "Soft Skills"].map((cat) => (
                     <button
                        key={cat}
                        onClick={() => setCategory(cat)}
                        className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${category === cat ? "bg-primary-fixed text-black" : "bg-white/5 border border-white/10 text-zinc-500 hover:text-white"
                           }`}
                     >
                        {cat === "all" ? "Tất cả lĩnh vực" : cat}
                     </button>
                  ))}
               </div>

               {/* Course Grid */}
               <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  {filtered.map((course) => (
                     <div key={course.id} className="glass-card overflow-hidden group">
                        <div className="relative h-48 overflow-hidden">
                           <img src={course.cover} className="w-full h-full object-cover transition-transform duration-1000 group-hover:scale-110" />
                           <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                           <div className="absolute top-6 left-6 flex gap-2">
                              <span className="px-3 py-1 bg-black/60 backdrop-blur-md rounded-lg text-[9px] font-black uppercase tracking-widest text-primary-fixed border border-primary-fixed/20">
                                 {course.category}
                              </span>
                              <span className={`px-3 py-1 backdrop-blur-md rounded-lg text-[9px] font-black uppercase tracking-widest border ${course.status === 'reviewed' ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/20' : 'bg-orange-500/20 text-orange-400 border-orange-500/20'}`}>
                                 {course.status === 'reviewed' ? 'Đã Review' : 'Đang chờ'}
                              </span>
                           </div>
                        </div>
                        <div className="p-8">
                           <h4 className="text-xl font-black text-white tracking-tighter mb-2 group-hover:text-primary-fixed transition-colors">
                              {course.title}
                           </h4>
                           <p className="text-[10px] font-black text-zinc-600 uppercase tracking-widest mb-8">Tác giả: <span className="text-white">{course.mentor}</span></p>

                           <div className="flex items-center justify-between">
                              <div className="flex items-center gap-6">
                                 <div className="flex items-center gap-2">
                                    <Users size={14} className="text-zinc-600" />
                                    <span className="text-xs font-black text-white">{course.participants}</span>
                                 </div>
                                 {course.rating > 0 && (
                                    <div className="flex items-center gap-2">
                                       <Star size={14} className="text-[#FFD600] fill-current" />
                                       <span className="text-xs font-black text-white">{course.rating}</span>
                                    </div>
                                 )}
                              </div>
                              <button className="flex items-center gap-2 text-[10px] font-black text-white uppercase tracking-widest hover:text-primary-fixed transition-all group/btn">
                                 Bắt đầu đánh giá <ChevronRight size={14} className="group-hover/btn:translate-x-1 transition-transform" />
                              </button>
                           </div>
                        </div>
                     </div>
                  ))}
               </div>
            </div>
         </div>
      </MentorPageShell>
   );
}