import { useState, useEffect } from "react";
import { useNavigate } from "react-router";
import {
   Plus,
   Search,
   Filter,
   MoreVertical,
   Users,
   Star,
   ArrowLeft,
   BookOpen,
   TrendingUp,
   CircleDollarSign,
   ArrowRight,
   PlusCircle,
   Layout,
   ExternalLink,
   Edit3,
   Trash2,
   CheckCircle2,
   Clock,
   ChevronRight,
   Shapes
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { getUser } from "../utils/auth";

const MOCK_MY_COURSES = [
   { id: 1, title: "Làm chủ STAR Method trong phỏng vấn hành vi", status: "published", students: 1240, rating: 4.9, earnings: 420000000, cover: "https://images.unsplash.com/photo-1573497619292-0b2f5c8e030b?auto=format&fit=crop&q=80&w=600", level: "Intermediate" },
   { id: 2, title: "Technical Interview: Data Structures & Algorithms cơ bản", status: "published", students: 450, rating: 4.7, earnings: 135000000, cover: "https://images.unsplash.com/photo-1517694712202-14dd9538aa97?auto=format&fit=crop&q=80&w=600", level: "Intermediate" },
   { id: 3, title: "Soft Skills trong môi trường làm việc đa văn hóa", status: "published", students: 20, rating: 4.8, earnings: 49000000, cover: "https://images.unsplash.com/photo-1552664730-d307ca884978?auto=format&fit=crop&q=80&w=600", level: "Advanced" },
   { id: 4, title: "Xây dựng tư duy Product Thinking cho Developer", status: "draft", students: 0, rating: 0, earnings: 0, cover: "https://images.unsplash.com/photo-1551434678-e076c223a692?auto=format&fit=crop&q=80&w=600", level: "Expert" },
];

export function MentorCourseManagement() {
   const navigate = useNavigate();
   const user = getUser();
   const [activeTab, setActiveTab] = useState("all");
   const [search, setSearch] = useState("");

   useEffect(() => {
      if (!user || user.role !== "mentor") {
         navigate("/");
      }
   }, []);

   if (!user || user.role !== "mentor") return null;

   const filtered = MOCK_MY_COURSES.filter(c => {
      const matchesTab = activeTab === "all" || c.status === activeTab;
      const matchesSearch = c.title.toLowerCase().includes(search.toLowerCase());
      return matchesTab && matchesSearch;
   });

   return (
      <div className="min-h-screen text-white font-sans pb-32 relative overflow-hidden"
         style={{ background: "linear-gradient(145deg, #0E0922 0%, #07060E 100%)" }}>

         <style>{`
        .glass-card {
           background: rgba(255, 255, 255, 0.04);
           backdrop-filter: blur(40px);
           border-radius: 40px;
           border: 1px solid rgba(255, 255, 255, 0.08);
           transition: all 0.6s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .font-headline { letter-spacing: -0.05em; line-height: 0.95; }
        .input-glass {
           background: rgba(255, 255, 255, 0.03);
           border: 1px solid rgba(255, 255, 255, 0.1);
           border-radius: 20px;
           padding: 14px 24px;
           color: white;
           transition: all 0.3s;
        }
        .input-glass:focus { border-color: #B4F500; background: rgba(255, 255, 255, 0.06); outline: none; }
      `}</style>

         {/* Atmospheric Background Glows */}
         <div className="fixed top-0 right-0 w-[1200px] h-[1200px] bg-secondary/10 blur-[250px] rounded-full -translate-y-1/2 translate-x-1/2 pointer-events-none -z-0"></div>
         <div className="fixed bottom-0 left-0 w-[800px] h-[800px] bg-primary-fixed/5 blur-[200px] rounded-full translate-y-1/2 -translate-x-1/2 pointer-events-none -z-0"></div>

         <div className="relative z-10 p-10 max-w-7xl mx-auto pt-20">
            {/* Header Unit */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-10 mb-16">
               <div>
                  <div className="flex items-center gap-3 text-[10px] font-black text-primary-fixed uppercase tracking-[0.3em] mb-4">
                     <Shapes size={14} /> Hệ thống Đào tạo
                  </div>
                  <h1 className="text-7xl font-black text-white font-headline tracking-tighter mb-4 uppercase leading-none">
                     Khóa học <span className="text-secondary tracking-tighter">của tôi</span>
                  </h1>
                  <p className="text-zinc-500 text-lg font-medium">Xây dựng nội dung, theo dõi doanh thu và học viên của bạn</p>
               </div>
               <div className="flex gap-4">
                  <button onClick={() => navigate("/mentor/course-edit/new")} className="px-10 py-5 rounded-3xl bg-primary-fixed text-black text-xs font-black uppercase tracking-widest hover:scale-105 transition-all shadow-[0_15px_40px_rgba(180,245,0,0.3)] flex items-center gap-3">
                     <Plus size={20} /> Tạo khóa học mới
                  </button>

               </div>
            </div>

            {/* Course Analytics Bar */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-20">
               {[
                  { label: "Tổng khóa học", value: 4, icon: BookOpen, color: "#6E35E8" },
                  { label: "Tổng học viên", value: "1.7k", icon: Users, color: "#B4F500" },
                  { label: "Rating trung bình", value: 4.8, icon: Star, color: "#f59e0b" },
                  { label: "Doanh thu tạm tính", value: "604M", icon: CircleDollarSign, color: "#secondary" }
               ].map((stat, i) => (
                  <div key={i} className="glass-card p-10 group overflow-hidden">
                     <div className="relative z-10">
                        <div className="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mb-10 group-hover:scale-110 transition-transform">
                           <stat.icon size={22} style={{ color: stat.color }} />
                        </div>
                        <h3 className="text-5xl font-black text-white tracking-tighter mb-2 leading-none">{stat.value}</h3>
                        <p className="text-[10px] font-black text-zinc-600 uppercase tracking-[0.2em]">{stat.label}</p>
                     </div>
                     <div className="absolute -bottom-6 -right-6 w-24 h-24 bg-gradient-to-br from-white/[0.03] to-transparent rounded-full" />
                  </div>
               ))}
            </div>

            {/* Controls & Grid */}
            <div className="space-y-10">
               <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-8">
                  <div className="flex gap-2 p-2 bg-white/[0.03] border border-white/5 rounded-[24px]">
                     {["all", "published", "draft"].map(t => (
                        <button
                           key={t}
                           onClick={() => setActiveTab(t)}
                           className={`px-8 py-3 rounded-[18px] text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === t ? 'bg-white text-black shadow-xl' : 'text-zinc-500 hover:text-white'
                              }`}
                        >
                           {t === 'all' ? 'Tất cả' : t === 'published' ? 'Đã đăng' : 'Bản nháp'}
                        </button>
                     ))}
                  </div>
                  <div className="relative group flex-1 max-w-lg">
                     <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-zinc-600 group-hover:text-primary-fixed transition-colors" size={20} />
                     <input
                        type="text"
                        placeholder="Tìm kiếm nội dung khóa học..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="input-glass pl-16 w-full text-sm font-medium"
                     />
                  </div>
               </div>

               <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10">
                  {filtered.map((course) => (
                     <div key={course.id} className="glass-card flex flex-col group h-full">
                        <div className="relative h-60 overflow-hidden">
                           <img src={course.cover} className="w-full h-full object-cover transition-transform duration-1000 group-hover:scale-110" />
                           <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent" />
                           <div className="absolute top-6 left-6 flex gap-2">
                              <span className={`px-4 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest border ${course.status === 'published' ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/20' : 'bg-zinc-500/20 text-zinc-500 border-zinc-500/20'}`}>
                                 {course.status === 'published' ? 'Đã đăng' : 'Bản nháp'}
                              </span>
                              <span className="px-4 py-1.5 bg-black/60 backdrop-blur-md rounded-xl text-[9px] font-black uppercase tracking-widest text-zinc-400 border border-white/10">
                                 {course.level}
                              </span>
                           </div>
                           <div className="absolute top-6 right-6">
                              <button className="w-10 h-10 rounded-xl bg-black/40 backdrop-blur-md flex items-center justify-center text-white border border-white/10 hover:bg-black/60 transition-all">
                                 <MoreVertical size={18} />
                              </button>
                           </div>
                        </div>
                        <div className="p-8 flex-1 flex flex-col">
                           <h4 className="text-xl font-black text-white tracking-tighter mb-4 group-hover:text-primary-fixed transition-colors leading-tight">
                              {course.title}
                           </h4>
                           <div className="grid grid-cols-2 gap-6 mb-10 mt-auto">
                              <div className="flex items-center gap-3">
                                 <Users size={16} className="text-zinc-600" />
                                 <div>
                                    <p className="text-[9px] font-black text-zinc-500 uppercase tracking-widest leading-none mb-1">Học viên</p>
                                    <p className="text-sm font-black text-white">{course.students.toLocaleString()}</p>
                                 </div>
                              </div>
                              <div className="flex items-center gap-3">
                                 <Star size={16} className="text-[#FFD600]" />
                                 <div>
                                    <p className="text-[9px] font-black text-zinc-500 uppercase tracking-widest leading-none mb-1">Đánh giá</p>
                                    <p className="text-sm font-black text-white">{course.rating > 0 ? course.rating : 'N/A'}</p>
                                 </div>
                              </div>
                           </div>
                           <div className="flex items-center gap-4">
                              <button
                                 onClick={() => navigate(`/mentor/course-edit/${course.id}`)}
                                 className="flex-1 py-4 rounded-2xl bg-white/5 border border-white/10 text-[10px] font-black uppercase tracking-widest hover:text-white hover:bg-white/10 transition-all flex items-center justify-center gap-2">
                                 <Edit3 size={14} /> Chỉnh sửa
                              </button>
                              <button
                                 className="w-14 py-4 rounded-2xl bg-white/5 border border-white/10 text-[10px] font-black uppercase tracking-widest hover:text-primary-fixed hover:bg-white/10 transition-all flex items-center justify-center">
                                 <ExternalLink size={16} />
                              </button>
                           </div>
                        </div>
                     </div>
                  ))}
                  <div
                     onClick={() => navigate("/mentor/course-edit/new")}
                     className="glass-card border-2 border-dashed border-white/10 flex flex-col items-center justify-center p-12 text-zinc-700 hover:border-primary-fixed hover:text-primary-fixed transition-all cursor-pointer group min-h-[400px]">
                     <div className="w-16 h-16 rounded-full bg-white/5 border border-white/10 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                        <PlusCircle size={32} className="opacity-40 group-hover:opacity-100" />
                     </div>
                     <p className="text-xs font-black uppercase tracking-[0.3em]">Thiết kế khóa học mới</p>
                  </div>
               </div>
            </div>
         </div>
      </div>
   );
}