import { useState } from "react";
import { useParams, useNavigate } from "react-router";
import {
  ArrowLeft,
  BookOpen,
  Users,
  MessageCircle as ChatCircle,
  BarChart as ChartBar,
  Pencil as PencilSimple,
  Trash2 as Trash,
  Plus,
  Eye,
  PlayCircle,
  Clock,
  CheckCircle,
  AlertTriangle as Warning,
  Upload,
  Video,
  GraduationCap,
  Star,
  TrendingUp as TrendUp,
  ArrowUp,
  ArrowDown,
  BadgeCheck as SealCheck,
  Zap as Lightning,
  ToggleLeft,
  ToggleRight,
  X,
  Check,
  Video as FileVideo,
  User,
  Calendar as CalendarBlank,
  PieChart as ChartPie,
  LineChart as ChartLineIcon,
  CircleDollarSign as CurrencyCircleDollar,
  ChevronRight as CaretRight,
  Search as MagnifyingGlass,
  Filter as Funnel,
  Share as Export,
  Medal,
  AlertCircle as WarningCircle,
  Sparkles as Sparkle,
  ThumbsUp,
  Target,
  ChevronRight
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { getCourseById } from "../../data/coursesData";
import { MentorPageShell } from "../../components/mentor/MentorPageShell";

const MENTOR_COURSE_EDIT_EXTRA_CSS = `
        .tab-btn { position: relative; padding: 16px 24px; font-size: 10px; font-weight: 900; text-transform: uppercase; letter-spacing: 0.2em; color: rgba(255,255,255,0.4); transition: all 0.3s; }
        .tab-btn.active { color: #fff; }
        .tab-indicator { position: absolute; bottom: 0; left: 24px; right: 24px; height: 3px; background: #c4ff47; box-shadow: 0 0 15px #c4ff47; border-radius: 10px; }
`;

/* ── Helpers ─────────────────────────────────────────────────── */
const formatDuration = (minutes) => {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? `${h}h ${m > 0 ? m + "m" : ""}`.trim() : `${m}m`;
};
const formatPrice = (price) =>
  new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(price);

/* ── Mock data persists from legacy implementation ─────────── */
const MOCK_STUDENTS = [
  { id: "s1", name: "Nguyễn Văn An", avatar: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=80&q=80", progress: 92, completedLessons: 11, lastActive: "2 giờ trước", enrolled: "10/03/2024", status: "active" },
  { id: "s2", name: "Trần Thị Bích", avatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=80&q=80", progress: 100, completedLessons: 12, lastActive: "1 ngày trước", enrolled: "05/03/2024", status: "completed" },
  { id: "s3", name: "Lê Minh Châu", avatar: "https://images.unsplash.com/photo-1527980965255-d3b416303d12?w=80&q=80", progress: 42, completedLessons: 5, lastActive: "3 ngày trước", enrolled: "12/03/2024", status: "active" },
  { id: "s4", name: "Phạm Thu Dung", avatar: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=80&q=80", progress: 67, completedLessons: 8, lastActive: "5 giờ trước", enrolled: "08/03/2024", status: "active" },
  { id: "s5", name: "Hoàng Văn Em", avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=80&q=80", progress: 8, completedLessons: 1, lastActive: "7 ngày trước", enrolled: "15/03/2024", status: "inactive" },
  { id: "s6", name: "Vũ Thị Phương", avatar: "https://images.unsplash.com/photo-1580489944761-15a19d654956?w=80&q=80", progress: 100, completedLessons: 12, lastActive: "2 ngày trước", enrolled: "01/03/2024", status: "completed" },
  { id: "s7", name: "Đỗ Quang Hùng", avatar: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=80&q=80", progress: 58, completedLessons: 7, lastActive: "12 giờ trước", enrolled: "18/03/2024", status: "active" },
  { id: "s8", name: "Ngô Bảo Châu", avatar: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=80&q=80", progress: 25, completedLessons: 3, lastActive: "4 ngày trước", enrolled: "20/03/2024", status: "inactive" },
];

const MOCK_QA = [
  { id: "q1", lessonIdx: 0, student: "Nguyễn Văn An", avatar: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=80&q=80", question: "Trong phần Situation, nên mô tả bao nhiêu context là đủ?", answer: null, time: "2 giờ trước", likes: 5 },
  { id: "q2", lessonIdx: 2, student: "Lê Minh Châu", avatar: "https://images.unsplash.com/photo-1527980965255-d3b416303d12?w=80&q=80", question: "Khi kể về Task, tôi nên phân biệt rõ task của team và task của cá nhân không?", answer: "Nên focus vào task của CÁ NHÂN bạn...", time: "1 ngày trước", likes: 12 },
];

const MENTOR_STUDENT_REVIEWS = [
  { id: "msr1", name: "Nguyễn Minh Khoa", avatar: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=80&q=80", role: "Backend Developer", rating: 5, comment: "Khóa học cực kỳ thực tế và chi tiết.", date: "2024-03-15", helpful: 24, lessonRef: "Bài 2: Cấu trúc STAR", verified: true, responded: true, response: "Cảm ơn Khoa rất nhiều!" },
];

const generateLessonStats = (count) =>
  Array.from({ length: count }, (_, i) => ({
    views: Math.floor(400 - i * 25 + Math.random() * 50),
    completionRate: Math.max(55, Math.floor(95 - i * 3.5 + Math.random() * 10)),
    avgWatchTime: Math.max(60, Math.floor(85 - i * 2 + Math.random() * 15)),
    dropoffRate: Math.min(45, Math.floor(5 + i * 2.5 + Math.random() * 8)),
    questions: Math.floor(Math.random() * 8),
  }));

/* ── UI Components ─────────────────────────────────────────── */

function MiniBar({ value, max = 100, color }) {
  return (
    <div className="h-1.5 bg-white/5 rounded-full overflow-hidden flex-1">
      <motion.div 
        initial={{ width: 0 }}
        animate={{ width: `${(value / max) * 100}%` }}
        className="h-full rounded-full" 
        style={{ background: color, boxShadow: `0 0 10px ${color}40` }} 
      />
    </div>
  );
}

/* ── Tabs Content ──────────────────────────────────────────── */

function ReviewsTab({ mentorAvatar, mentorName }) {
  return (
    <div className="space-y-10">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {[
          { label: "Rating TB", value: "4.9", color: "#c4ff47" },
          { label: "Tổng đánh giá", value: 124, color: "#6E35E8" },
          { label: "Chờ phản hồi", value: 3, color: "#FF8C42" },
          { label: "Tỷ lệ hữu ích", value: "98%", color: "#secondary" }
        ].map((s, i) => (
          <div key={i} className="glass-card p-8">
             <h3 className="text-3xl font-black text-white tracking-tighter mb-1">{s.value}</h3>
             <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">{s.label}</p>
          </div>
        ))}
      </div>
      <div className="space-y-6">
         {MENTOR_STUDENT_REVIEWS.map(review => (
           <div key={review.id} className="glass-card p-10">
              <div className="flex items-start gap-6 mb-8">
                 <img src={review.avatar} className="w-14 h-14 rounded-2xl object-cover ring-2 ring-white/5" />
                 <div>
                    <h5 className="text-lg font-black text-white tracking-tight">{review.name}</h5>
                    <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">{review.role} · {review.date}</p>
                 </div>
              </div>
              <p className="text-base font-medium text-zinc-300 italic">"{review.comment}"</p>
           </div>
         ))}
      </div>
    </div>
  );
}

function LessonsTab({ lessons }) {
  const [editList, setEditList] = useState(lessons);
  const [editingId, setEditingId] = useState(null);

  return (
    <div className="space-y-8">
       <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-black text-white tracking-tight uppercase">Cấu trúc bài giảng</h3>
          <button className="px-6 py-3 rounded-2xl bg-primary-fixed text-black text-[10px] font-black uppercase tracking-widest shadow-xl flex items-center gap-2">
             <Plus size={16} /> Thêm bài học mới
          </button>
       </div>
       <div className="space-y-4">
          {editList.map((lesson, idx) => (
            <div key={lesson.id} className={`glass-card p-6 flex items-center justify-between group transition-all`}>
               <div className="flex items-center gap-6">
                  <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-sm font-black text-zinc-500 group-hover:text-primary-fixed">
                     {idx + 1}
                  </div>
                  <div>
                     <h4 className="text-sm font-black text-white group-hover:text-primary-fixed transition-colors">{lesson.title}</h4>
                     <p className="text-[10px] font-black text-zinc-600 uppercase tracking-widest">{formatDuration(lesson.duration)} · Video Uploaded</p>
                  </div>
               </div>
               <div className="flex items-center gap-3">
                  <button className="p-3 rounded-xl bg-white/5 border border-white/10 text-zinc-500 hover:text-white transition-all"><PencilSimple size={16} /></button>
                  <button className="p-3 rounded-xl bg-white/5 border border-white/10 text-zinc-500 hover:text-red-500 transition-all"><Trash size={16} /></button>
               </div>
            </div>
          ))}
       </div>
    </div>
  );
}

function StudentsTab({ students }) {
  return (
    <div className="space-y-10">
       <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          {[
            { label: "Đang hoạt động", value: students.filter(s => s.status === 'active').length, color: "#c4ff47" },
            { label: "Hoàn thành", value: students.filter(s => s.status === 'completed').length, color: "#6E35E8" },
            { label: "Tiến độ trung bình", value: "68%", color: "#f59e0b" },
            { label: "Drop-off Rate", value: "4.2%", color: "#secondary" }
          ].map((s, i) => (
            <div key={i} className="glass-card p-8">
               <h3 className="text-3xl font-black text-white tracking-tighter mb-1">{s.value}</h3>
               <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">{s.label}</p>
            </div>
          ))}
       </div>
       <div className="glass-card overflow-hidden">
          <table className="w-full text-left">
             <thead>
                <tr className="border-b border-white/5 text-[10px] font-black text-zinc-600 uppercase tracking-widest">
                   <th className="px-8 py-6">Học viên</th>
                   <th className="px-8 py-6">Tiến độ</th>
                   <th className="px-8 py-6 text-right">Lần cuối</th>
                </tr>
             </thead>
             <tbody className="divide-y divide-white/5">
                {students.map(s => (
                  <tr key={s.id} className="hover:bg-white/[0.02] transition-colors">
                     <td className="px-8 py-6">
                        <div className="flex items-center gap-4">
                           <img src={s.avatar} className="w-10 h-10 rounded-xl object-cover" />
                           <span className="text-sm font-black text-white">{s.name}</span>
                        </div>
                     </td>
                     <td className="px-8 py-6">
                        <div className="flex items-center gap-4 w-40">
                           <MiniBar value={s.progress} color={s.progress === 100 ? "#c4ff47" : "#6E35E8"} />
                           <span className="text-[10px] font-black text-white">{s.progress}%</span>
                        </div>
                     </td>
                     <td className="px-8 py-6 text-right text-[10px] font-bold text-zinc-500 uppercase">{s.lastActive}</td>
                  </tr>
                ))}
             </tbody>
          </table>
       </div>
    </div>
  );
}

function QATab({ qa }) {
  return (
    <div className="space-y-6">
       {qa.map(item => (
         <div key={item.id} className="glass-card p-10">
            <div className="flex items-center justify-between mb-8">
               <div className="flex items-center gap-4">
                  <img src={item.avatar} className="w-10 h-10 rounded-xl object-cover" />
                  <div>
                     <p className="text-sm font-black text-white">{item.student}</p>
                     <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Hỏi lúc {item.time} · Bài {item.lessonIdx + 1}</p>
                  </div>
               </div>
               <span className="px-4 py-1.5 rounded-xl bg-orange-500/20 text-orange-400 text-[9px] font-black uppercase tracking-widest border border-orange-500/20">Chờ phản hồi</span>
            </div>
            <p className="text-base font-medium text-white/80 leading-relaxed mb-10">"{item.question}"</p>
            <div className="flex gap-4">
               <textarea 
                  placeholder="Nhập câu trả lời của bạn..." 
                  className="flex-1 bg-white/5 border border-white/10 rounded-2xl p-4 text-sm text-white outline-none focus:border-primary-fixed transition-all resize-none"
                  rows={2}
               />
               <button className="px-8 rounded-2xl bg-white text-black text-[10px] font-black uppercase tracking-widest shadow-xl">Gửi</button>
            </div>
         </div>
       ))}
    </div>
  );
}

function AnalyticsTab({ lessonStats }) {
  return (
    <div className="space-y-10">
       <div className="glass-card p-10 h-[400px] flex items-center justify-center text-zinc-500 italic">
          [ Biểu đồ dữ liệu Recharts sẽ hiển thị ở đây giống như Dashboard ]
       </div>
       <div className="glass-card overflow-hidden">
          <table className="w-full text-left">
             <thead className="border-b border-white/5 text-[10px] font-black text-zinc-600 uppercase tracking-widest">
                <tr>
                   <th className="px-8 py-6">Bài học</th>
                   <th className="px-8 py-6">Lượt xem</th>
                   <th className="px-8 py-6">Hoàn thành</th>
                   <th className="px-8 py-6 text-right">Dropout</th>
                </tr>
             </thead>
             <tbody className="divide-y divide-white/5">
                {lessonStats.map((s, i) => (
                  <tr key={i} className="hover:bg-white/[0.02] transition-colors">
                     <td className="px-8 py-6 text-sm font-black text-white">Bài số {i + 1}</td>
                     <td className="px-8 py-6 text-sm font-black text-zinc-400">{s.views}</td>
                     <td className="px-8 py-6">
                        <span className="text-primary-fixed font-black text-sm">{s.completionRate}%</span>
                     </td>
                     <td className="px-8 py-6 text-right text-orange-400 font-black text-sm">{s.dropoffRate}%</td>
                  </tr>
                ))}
             </tbody>
          </table>
       </div>
    </div>
  );
}

/* ── Main MentorCourseEdit Component ────────────────────────── */
export function MentorCourseEdit() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("lessons");
  
  const course = getCourseById(id || "");

  if (!course) {
    return (
      <div className="min-h-screen bg-[#07060E] flex items-center justify-center text-white">
        <div className="text-center">
           <BookOpen size={64} className="mx-auto mb-6 text-primary-fixed opacity-20" />
           <h2 className="text-4xl font-black mb-10 tracking-tighter">Không tìm thấy khóa học</h2>
           <button onClick={() => navigate("/mentor/courses")} className="px-10 py-4 rounded-3xl bg-primary-fixed text-black text-xs font-black uppercase tracking-widest shadow-xl">Quay lại quản lý</button>
        </div>
      </div>
    );
  }

  const lessons = course.lessons || [];
  const lessonStats = generateLessonStats(lessons.length);

  const TABS = [
    { key: "lessons", label: "Bài học", icon: Layout },
    { key: "students", label: "Học viên", icon: Users },
    { key: "qa", label: "Hỏi & Đáp", icon: ChatCircle },
    { key: "reviews", label: "Đánh giá", icon: Star },
    { key: "analytics", label: "Phân tích", icon: ChartBar },
  ];

  return (
    <MentorPageShell bottomPad="pb-40" extraStyles={MENTOR_COURSE_EDIT_EXTRA_CSS}>
      <div className="relative z-10 p-10 max-w-7xl mx-auto pt-20">
        {/* Navigation Hero */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-10 mb-20">
          <div className="flex items-center gap-10">
             <img src={course.thumbnail} className="w-40 h-28 rounded-3xl object-cover ring-8 ring-white/5 shadow-2xl" />
             <div>
                <button onClick={() => navigate("/mentor/courses")} className="text-[10px] font-black text-primary-fixed uppercase tracking-widest mb-4 flex items-center gap-2 hover:translate-x-1 transition-transform">
                   <ArrowLeft size={14} /> Quản lý khóa học
                </button>
                <h1 className="text-5xl font-black text-white font-headline tracking-tighter mb-4 leading-none uppercase">
                   {course.title}
                </h1>
                <div className="flex items-center gap-6 mt-6">
                   <div className="flex items-center gap-2 text-[10px] font-black text-zinc-500 uppercase tracking-widest">
                      <Users size={14} /> {course.studentsCount} Students
                   </div>
                   <div className="flex items-center gap-2 text-[10px] font-black text-zinc-500 uppercase tracking-widest">
                      <Star size={14} className="text-[#FFD600]" /> {course.rating} Rating
                   </div>
                </div>
             </div>
          </div>
          <div className="flex gap-4">
             <button onClick={() => navigate(`/courses/${id}`)} className="px-8 py-4 rounded-3xl bg-white/5 border border-white/10 text-xs font-black uppercase tracking-widest hover:bg-white/10 transition-all flex items-center gap-2">
                <Eye size={16} /> Xem bản nháp
             </button>
          </div>
        </div>

        {/* Tab Interface */}
        <div className="glass-card mb-12 p-2 bg-white/[0.02] border border-white/5 flex gap-2 overflow-x-auto custom-scrollbar">
           {TABS.map(tab => (
             <button 
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`tab-btn ${activeTab === tab.key ? 'active' : ''} flex items-center gap-3 whitespace-nowrap`}
             >
                <tab.icon size={16} /> {tab.label}
                {activeTab === tab.key && <motion.div layoutId="tab-underline" className="tab-indicator" />}
             </button>
           ))}
        </div>

        {/* Dynamic Tab Body */}
        <AnimatePresence mode="wait">
           <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.4 }}
           >
              {activeTab === "lessons" && <LessonsTab lessons={lessons} />}
              {activeTab === "students" && <StudentsTab students={MOCK_STUDENTS} />}
              {activeTab === "qa" && <QATab qa={MOCK_QA} />}
              {activeTab === "reviews" && <ReviewsTab mentorAvatar={course.mentorAvatar} mentorName={course.mentorName} />}
              {activeTab === "analytics" && <AnalyticsTab lessonStats={lessonStats} />}
           </motion.div>
        </AnimatePresence>
      </div>

      {/* Floating Action Bar */}
      <div className="fixed bottom-10 left-1/2 -translate-x-1/2 z-50">
         <div className="glass-card px-10 py-5 bg-black/40 border-primary-fixed/20 shadow-[0_20px_60px_rgba(0,0,0,0.6)] flex items-center gap-10">
            <div className="hidden sm:block">
               <p className="text-[9px] font-black text-zinc-500 uppercase tracking-widest">Lần lưu cuối</p>
               <p className="text-[10px] font-black text-white uppercase tracking-widest">vừa xong</p>
            </div>
            <div className="flex gap-4">
               <button className="px-10 py-4 rounded-2xl bg-primary-fixed text-black text-[10px] font-black uppercase tracking-widest shadow-xl hover:scale-105 transition-all">Lưu & Xuất bản</button>
               <button className="px-8 py-4 rounded-2xl border border-white/10 text-[10px] font-black text-zinc-400 uppercase tracking-widest hover:text-white transition-all">Hủy thay đổi</button>
            </div>
         </div>
      </div>
    </MentorPageShell>
  );
}
