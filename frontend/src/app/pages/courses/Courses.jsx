import React, { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router";
import {
  Search,
  Filter,
  Star,
  Clock,
  Users,
  PlayCircle,
  BookOpen,
  Zap,
  Briefcase,
  GraduationCap,
  BarChart3,
  FileText,
  BadgeCheck,
  ChevronRight,
  CheckCircle2,
  Trophy,
  Flame,
  ArrowRight,
  Sparkles,
  ExternalLink,
  Award,
  Compass,
  RotateCcw,
  Play,
  ShieldCheck
} from "lucide-react";

import {
  COURSES_DATA,
  getCourseById,
} from "../../data/coursesData";

const CATEGORIES = [
  "Tất cả",
  "Viết CV",
  "Kỹ năng phỏng vấn",
  "Kỹ năng kỹ thuật",
  "Kỹ năng mềm",
  "Phát triển nghề nghiệp",
];

const LEVELS = ["Tất cả", "Người mới", "Trung cấp", "Nâng cao"];

/* ── Enrolled Course helpers ───────────────────────────────────── */
const ENROLLED_KEY = "prointerview_enrolled_courses";
const PROGRESS_KEY = (id) =>
  `prointerview_course_progress_${id}`;

function seedDemoEnrollments() {
  const existing = localStorage.getItem(ENROLLED_KEY);
  if (!existing) {
    localStorage.setItem(
      ENROLLED_KEY,
      JSON.stringify(["1", "2", "3"]),
    );
  }
  const p1 = localStorage.getItem(PROGRESS_KEY("1"));
  if (!p1) {
    localStorage.setItem(
      PROGRESS_KEY("1"),
      JSON.stringify([
        "1-1",
        "1-2",
        "1-3",
        "1-4",
        "1-5",
        "1-6",
        "1-7",
      ]),
    );
  }
  const p2 = localStorage.getItem(PROGRESS_KEY("2"));
  if (!p2) {
    localStorage.setItem(
      PROGRESS_KEY("2"),
      JSON.stringify([
        "2-1",
        "2-2",
        "2-3",
        "2-4",
        "2-5",
        "2-6",
        "2-7",
        "2-8",
        "2-9",
        "2-10",
      ]),
    );
  }
}

function loadEnrolledCourses() {
  seedDemoEnrollments();
  try {
    const ids = JSON.parse(
      localStorage.getItem(ENROLLED_KEY) || "[]",
    );
    return ids
      .map((id) => {
        const course = getCourseById(id);
        if (!course) return null;
        const completed = JSON.parse(
          localStorage.getItem(PROGRESS_KEY(id)) || "[]",
        );
        const totalLessons =
          course.lessons?.length || course.lessonsCount;
        const progressPct =
          totalLessons > 0
            ? Math.round(
                (completed.length / totalLessons) * 100,
              )
            : 0;
        return {
          course,
          completedLessons: completed,
          progressPct,
          isCompleted: progressPct === 100,
        };
      })
      .filter(Boolean);
  } catch {
    return [];
  }
}

const formatDuration = (minutes) => {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0
    ? `${h}h ${m > 0 ? m + "m" : ""}`.trim()
    : `${m}m`;
};

const getLevelBadge = (level) => {
  const configs = {
    Beginner: {
      bg: "rgba(180,240,0,0.92)",
      text: "#1a3300",
      shadow: "0 2px 8px rgba(0,0,0,0.25)",
      label: "Cơ bản",
    },
    Intermediate: {
      bg: "rgba(110, 53, 232,0.92)",
      text: "#ffffff",
      shadow: "0 2px 8px rgba(110, 53, 232,0.45)",
      label: "Trung cấp",
    },
    Advanced: {
      bg: "rgba(255,140,66,0.92)",
      text: "#1F1F1F",
      shadow: "0 2px 8px rgba(255,140,66,0.45)",
      label: "Nâng cao",
    },
  };
  const cfg = configs[level] || configs.Intermediate;
  return (
    <span
      className="text-xs font-bold px-2.5 py-1 rounded-lg"
      style={{
        background: cfg.bg,
        color: cfg.text,
        boxShadow: cfg.shadow,
        backdropFilter: "blur(6px)",
        letterSpacing: "0.01em",
      }}
    >
      {cfg.label}
    </span>
  );
};

/* ── Progress Ring ──────────────────────────────────────────── */
function ProgressRing({
  pct,
  size = 52,
}) {
  const r = (size - 8) / 2;
  const circumference = 2 * Math.PI * r;
  const offset = circumference - (pct / 100) * circumference;
  const isCompleted = pct === 100;
  return (
    <div
      className="relative flex items-center justify-center p-1.5 bg-black/40 backdrop-blur-md rounded-full border border-white/10"
      style={{ width: size, height: size }}
    >
      <svg width={size - 12} height={size - 12} className="-rotate-90">
        <circle
          cx={(size - 12) / 2}
          cy={(size - 12) / 2}
          r={r - 6}
          fill="none"
          stroke="rgba(255,255,255,0.05)"
          strokeWidth={4}
        />
        <circle
          cx={(size - 12) / 2}
          cy={(size - 12) / 2}
          r={r - 6}
          fill="none"
          stroke={isCompleted ? "#BFFF00" : "#7000ff"}
          strokeWidth={4}
          strokeDasharray={2 * Math.PI * (r - 6)}
          strokeDashoffset={2 * Math.PI * (r - 6) - (pct / 100) * 2 * Math.PI * (r - 6)}
          strokeLinecap="round"
          style={{ transition: "stroke-dashoffset 0.8s cubic-bezier(0.4, 0, 0.2, 1)" }}
        />
      </svg>
      <span
        className="absolute text-[10px] font-black"
        style={{ color: isCompleted ? "#BFFF00" : "white" }}
      >
        {pct}%
      </span>
    </div>
  );
}

/* ── Enrolled Course Card ───────────────────────────────────── */
function EnrolledCourseCard({
  item,
  onContinue,
}) {
  const { course, completedLessons, progressPct, isCompleted } = item;
  const totalLessons = course.lessons?.length || course.lessonsCount;
  
  return (
    <div className="glass-card rounded-2xl overflow-hidden group transition-all duration-500 hover:border-secondary/30 flex flex-col h-full">
      {/* Thumbnail */}
      <div className="relative h-48 overflow-hidden">
        <img
          src={course.thumbnail}
          alt={course.title}
          className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent" />

        {/* Completion badge */}
        {isCompleted && (
          <div className="absolute top-4 left-4 flex items-center gap-1.5 px-3 py-1.5 bg-primary-fixed text-on-primary-fixed rounded-full text-[10px] font-black uppercase tracking-widest shadow-lg shadow-primary-fixed/20">
            <Trophy className="size-3.5" />
            Hoàn thành
          </div>
        )}

        {/* Progress ring overlay */}
        <div className="absolute top-4 right-4">
          <ProgressRing pct={progressPct} size={48} />
        </div>

        {/* Lesson count bottom left */}
        <div className="absolute bottom-4 left-4">
          <span className="text-white/90 text-[10px] font-bold uppercase tracking-widest flex items-center gap-2 px-3 py-1.5 bg-black/40 backdrop-blur-md rounded-full border border-white/10">
            <CheckCircle2 className={`size-3.5 ${isCompleted ? 'text-primary-fixed' : 'text-zinc-500'}`} />
            {completedLessons.length}/{totalLessons} Bài học
          </span>
        </div>
      </div>

      {/* Content */}
      <div className="p-6 flex flex-col flex-1">
        <span className="text-secondary font-black uppercase tracking-[0.2em] text-[9px] mb-2 block">{course.category}</span>
        
        <h3 className="font-bold text-white mb-6 line-clamp-2 leading-tight group-hover:text-primary-fixed transition-colors">
          {course.title}
        </h3>

        {/* Mentor */}
        <div className="flex items-center gap-3 mb-8">
          <img
            src={course.mentorAvatar}
            alt={course.mentorName}
            className="w-8 h-8 rounded-lg object-cover border border-white/10"
          />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-bold text-white truncate">{course.mentorName}</p>
            <p className="text-[9px] text-zinc-500 uppercase tracking-widest truncate">{course.mentorTitle}</p>
          </div>
        </div>

        {/* Progress bar */}
        <div className="mb-8">
          <div className="flex justify-between items-center mb-2.5">
            <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Tiến độ</span>
            <span className={`text-[10px] font-black uppercase tracking-widest ${isCompleted ? 'text-primary-fixed' : 'text-secondary'}`}>
              {progressPct}%
            </span>
          </div>
          <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden">
            <div
              className={`h-full transition-all duration-1000 ease-out rounded-full ${isCompleted ? 'bg-primary-fixed glow-neon-sm' : 'bg-secondary'}`}
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>

        {/* CTA */}
        <div className="mt-auto">
          {isCompleted ? (
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={onContinue}
                className="py-3.5 rounded-xl font-bold text-xs uppercase tracking-widest border border-white/10 text-white hover:bg-white/5 transition-all flex items-center justify-center gap-2"
              >
                <RotateCcw className="size-3.5" />
                Ôn lại
              </button>
              <button className="py-3.5 rounded-xl font-bold text-xs uppercase tracking-widest bg-primary-fixed text-on-primary-fixed hover:brightness-110 transition-all flex items-center justify-center gap-2">
                <Award className="size-3.5" />
                Chứng chỉ
              </button>
            </div>
          ) : (
            <button
              onClick={onContinue}
              className="w-full py-4 rounded-xl font-black text-xs uppercase tracking-[0.2em] bg-secondary text-white hover:brightness-110 transition-all flex items-center justify-center gap-3 group/btn"
            >
                {progressPct === 0 ? <Play className="size-4.5" /> : <Zap className="size-4.5" />}
              {progressPct === 0 ? 'Bắt đầu học' : 'Tiếp tục học'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Recent Activity ────────────────────────────────────────── */
function RecentActivity({
  items,
}) {
  const navigate = useNavigate();
  const inProgress = items.filter(
    (i) => i.progressPct > 0 && !i.isCompleted,
  );
  if (inProgress.length === 0) return null;

  return (
    <div className="glass-card rounded-3xl p-8 border border-white/5 mb-12 relative overflow-hidden">
      {/* Background Glow */}
      <div className="absolute top-0 right-0 w-64 h-64 bg-secondary/5 blur-[80px] rounded-full"></div>
      
      <div className="flex items-center justify-between mb-8 relative z-10">
        <div className="flex items-center gap-3">
          <Zap className="size-6 text-secondary" />
          <h2 className="text-xl font-bold text-white tracking-tight">Tiếp tục từ chỗ bỏ dở</h2>
        </div>
        <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest bg-white/5 px-3 py-1 rounded-full border border-white/5">
          {inProgress.length} Khóa học đang học
        </span>
      </div>

      <div className="grid md:grid-cols-2 gap-6 relative z-10">
        {inProgress.slice(0, 2).map(({ course, progressPct, completedLessons }) => {
          const nextLesson = course.lessons?.find(
            (l) => !completedLessons.includes(l.id),
          );
          return (
            <div
              key={course.id}
              onClick={() => navigate(`/courses/${course.id}/learn`)}
              className="group p-5 rounded-2xl bg-white/5 border border-white/5 hover:border-secondary/30 transition-all cursor-pointer flex items-center gap-6"
            >
              <div className="relative w-20 h-20 rounded-xl overflow-hidden flex-shrink-0 group-hover:scale-105 transition-transform duration-500">
                <img
                  src={course.thumbnail}
                  alt={course.title}
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-black/20 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <PlayCircle className="text-white size-8" />
                </div>
              </div>
              
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-white truncate group-hover:text-primary-fixed transition-colors mb-1">
                  {course.title}
                </p>
                {nextLesson && (
                  <p className="text-[10px] text-zinc-500 truncate mb-4">
                    Tiếp theo: <span className="text-zinc-300">{nextLesson.title}</span>
                  </p>
                )}
                
                <div className="flex items-center gap-4">
                  <div className="flex-1 h-1 bg-white/5 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-secondary transition-all duration-1000"
                      style={{ width: `${progressPct}%` }}
                    />
                  </div>
                  <span className="text-[10px] font-black text-secondary uppercase tracking-widest">{progressPct}%</span>
                </div>
              </div>

              <ChevronRight className="text-zinc-700 group-hover:text-secondary translate-x-0 group-hover:translate-x-1 transition-all" />
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function Courses() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get("tab") || "explore";

  const [courses, setCourses] =
    useState(COURSES_DATA);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] =
    useState("Tất cả");
  const [selectedLevel, setSelectedLevel] = useState("Tất cả");
  const [showFilters, setShowFilters] = useState(false);

  // My Courses state
  const [enrolledCourses, setEnrolledCourses] = useState([]);
  const [myCoursesTab, setMyCoursesTab] = useState("Tất cả");
  const [myCoursesSearch, setMyCoursesSearch] = useState("");

  // Load enrolled courses
  useEffect(() => {
    setEnrolledCourses(loadEnrolledCourses());
  }, []);

  // Filter marketplace courses
  const filteredCourses = courses.filter((course) => {
    const matchSearch =
      searchQuery === "" ||
      course.title
        .toLowerCase()
        .includes(searchQuery.toLowerCase()) ||
      course.description
        .toLowerCase()
        .includes(searchQuery.toLowerCase()) ||
      course.tags.some((tag) =>
        tag.toLowerCase().includes(searchQuery.toLowerCase()),
      );
    const matchCategory =
      selectedCategory === "Tất cả" ||
      course.category === selectedCategory;
    const matchLevel =
      selectedLevel === "Tất cả" ||
      course.level === selectedLevel;
    return matchSearch && matchCategory && matchLevel;
  });

  // Filter my courses
  const filteredMyCourses = enrolledCourses.filter((item) => {
    const matchSearch =
      myCoursesSearch === "" ||
      item.course.title
        .toLowerCase()
        .includes(myCoursesSearch.toLowerCase()) ||
      item.course.category
        .toLowerCase()
        .includes(myCoursesSearch.toLowerCase()) ||
      item.course.mentorName
        .toLowerCase()
        .includes(myCoursesSearch.toLowerCase());
    const matchTab =
      myCoursesTab === "Tất cả" ||
      (myCoursesTab === "Đang học" &&
        item.progressPct > 0 &&
        !item.isCompleted) ||
      (myCoursesTab === "Đã hoàn thành" && item.isCompleted);
    return matchSearch && matchTab;
  });

  // Compute my courses stats
  const totalEnrolled = enrolledCourses.length;
  const totalCompleted = enrolledCourses.filter(
    (e) => e.isCompleted,
  ).length;
  const totalInProgress = enrolledCourses.filter(
    (e) => e.progressPct > 0 && !e.isCompleted,
  ).length;
  const totalMinutesLearned = enrolledCourses.reduce(
    (sum, { course, completedLessons }) => {
      if (!course.lessons) return sum;
      return (
        sum +
        course.lessons
          .filter((l) => completedLessons.includes(l.id))
          .reduce((s, l) => s + l.duration, 0)
      );
    },
    0,
  );
  const totalHoursLearned =
    Math.round((totalMinutesLearned / 60) * 10) / 10;

  const formatPrice = (price) => {
    if (price === 0) return "Miễn phí";
    return new Intl.NumberFormat("vi-VN", {
      style: "currency",
      currency: "VND",
    }).format(price);
  };

  return (
    <div className="pi-page-dashboard-bg min-h-full w-full font-sans text-white selection:bg-[rgba(196,255,71,0.28)] selection:text-white">
      <header className="relative border-b border-white/[0.07] pb-12 pt-12 sm:pb-16 sm:pt-14">
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.09]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,0.45) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.45) 1px,transparent 1px)",
            backgroundSize: "32px 32px",
          }}
          aria-hidden
        />
        <div className="relative z-10 mx-auto max-w-7xl px-6 sm:px-8">
          <div className="max-w-4xl">
            <div className="mb-4 flex items-center gap-3">
              <GraduationCap className="size-5 text-[#c4ff47]" />
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-fuchsia-300/90">Thư viện kiến thức</span>
            </div>
            <h1 className="mb-4 text-3xl font-black leading-[1.05] tracking-tighter text-white md:text-5xl">
              Luyện tập cùng{" "}
              <span className="bg-gradient-to-r from-[#c4ff47] via-fuchsia-300 to-violet-300 bg-clip-text text-transparent">
                Chuyên gia.
              </span>
            </h1>
            <p className="mb-6 max-w-2xl text-sm font-semibold leading-relaxed text-white/65 sm:text-base">
              Trang bị kiến thức cốt lõi qua các video bài giảng ngắn gọn. Áp dụng ngay vào buổi phỏng vấn 1-1 với Mentor để được đánh giá trực tiếp.
            </p>

            <div className="mb-8 flex w-fit rounded-2xl border border-white/12 bg-white/[0.05] p-1.5 backdrop-blur-xl">
              <button
                onClick={() => setSearchParams({ tab: "explore" })}
                className={`flex items-center gap-2 rounded-xl px-8 py-3 text-sm font-bold transition-all ${
                  activeTab === "explore"
                    ? "bg-[#c4ff47] text-[#0a0618] shadow-lg shadow-[#c4ff47]/25"
                    : "text-white/60 hover:text-white"
                }`}
              >
                <Compass className="size-4.5" />
                Khám phá
              </button>
              <button
                onClick={() => setSearchParams({ tab: "my-courses" })}
                className={`flex items-center gap-2 rounded-xl px-8 py-3 text-sm font-bold transition-all ${
                  activeTab === "my-courses"
                    ? "bg-[#c4ff47] text-[#0a0618] shadow-lg shadow-[#c4ff47]/25"
                    : "text-white/60 hover:text-white"
                }`}
              >
                <BookOpen className="size-4.5" />
                Khóa học của tôi
              </button>
            </div>

            {activeTab === "explore" && (
              <div className="flex flex-col gap-4 md:flex-row">
                <div className="group relative flex-1">
                  <Search className="absolute left-5 top-1/2 size-5 -translate-y-1/2 text-white/40 transition-colors group-focus-within:text-[#c4ff47]" />
                  <input
                    type="text"
                    placeholder="Tìm kiếm khóa học theo tên, kỹ năng, tag..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full rounded-2xl border border-white/12 bg-white/[0.06] py-4 pl-14 pr-6 text-sm font-medium text-white backdrop-blur-md placeholder:text-white/45 transition-all focus:outline-none focus:ring-2 focus:ring-[#6E35E8]/40"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => setShowFilters(!showFilters)}
                  className={`flex items-center gap-3 rounded-2xl border px-8 py-4 text-sm font-bold transition-all ${
                    showFilters
                      ? "border-[#c4ff47]/50 bg-[#c4ff47]/10 text-[#d4ff6a]"
                      : "border-white/12 bg-white/[0.06] text-white hover:border-white/20 hover:bg-white/[0.09]"
                  }`}
                >
                  <Filter className="size-5" />
                  Bộ lọc
                </button>
              </div>
            )}
          </div>
        </div>
      </header>


      {/* ═══════════════ EXPLORE TAB ═══════════════ */}
      {activeTab === "explore" && (
        <div className="relative z-[1] py-16">
          {/* Filters */}
          {showFilters && (
            <div className="max-w-7xl mx-auto px-6 mb-16 relative z-10">
              <div className="glass-card p-8 rounded-3xl border border-white/5 grid md:grid-cols-2 gap-12">
                <div>
                  <label className="mb-4 block text-xs font-black uppercase tracking-widest text-fuchsia-300/80">Danh mục</label>
                  <div className="flex flex-wrap gap-3">
                    {CATEGORIES.map((cat) => (
                      <button
                        key={cat}
                        onClick={() => setSelectedCategory(cat)}
                        className={`px-6 py-2.5 rounded-xl text-sm font-bold transition-all border ${
                          selectedCategory === cat
                            ? "bg-primary-fixed text-on-primary-fixed border-primary-fixed"
                            : "border-white/10 bg-white/[0.05] text-white/55 hover:border-white/25 hover:text-white"
                        }`}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="mb-4 block text-xs font-black uppercase tracking-widest text-fuchsia-300/80">Cấp độ</label>
                  <div className="flex flex-wrap gap-3">
                    {LEVELS.map((level) => (
                      <button
                        key={level}
                        onClick={() => setSelectedLevel(level)}
                        className={`px-6 py-2.5 rounded-xl text-sm font-bold transition-all border ${
                          selectedLevel === level
                            ? "bg-primary-fixed text-on-primary-fixed border-primary-fixed"
                            : "border-white/10 bg-white/[0.05] text-white/55 hover:border-white/25 hover:text-white"
                        }`}
                      >
                        {level}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Results Summary */}
          <div className="relative z-10 mx-auto mb-10 flex max-w-7xl items-center justify-between px-6">
            <p className="font-medium text-white/60">
              Hiển thị <span className="font-bold text-white">{filteredCourses.length}</span> khóa học
              {searchQuery && <span> cho "<span className="text-[#c4ff47]">{searchQuery}</span>"</span>}
            </p>
          </div>

          {/* Courses Grid */}
          <div className="max-w-7xl mx-auto px-6 pb-20 relative z-10">
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
              {filteredCourses.map((course) => (
                <div
                  key={course.id}
                  onClick={() => navigate(`/courses/${course.id}`)}
                  className="group glass-card rounded-2xl overflow-hidden cursor-pointer transition-all duration-500 hover:-translate-y-2 hover:border-secondary/30"
                >
                  {/* Thumbnail */}
                  <div className="relative h-56 overflow-hidden">
                    <img
                      src={course.thumbnail}
                      alt={course.title}
                      className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                    
                    <div className="absolute top-4 left-4 flex gap-2">
                      <span className="bg-secondary/90 backdrop-blur-md text-white px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider">
                        {course.category}
                      </span>
                    </div>

                    <div className="absolute top-4 right-4">
                      <span className="bg-black/40 backdrop-blur-md text-white/90 px-3 py-1 rounded-full text-[10px] font-bold border border-white/10">
                        {course.level}
                      </span>
                    </div>
                    
                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-500 scale-90 group-hover:scale-100">
                      <div className="w-14 h-14 rounded-full bg-primary-fixed/90 flex items-center justify-center shadow-2xl shadow-primary-fixed/30 transform transition-transform border border-white/20">
                        <Play className="text-on-primary-fixed size-7 translate-x-0.5" />
                      </div>
                    </div>
                  </div>

                  <div className="p-7">
                    <h3 className="text-xl font-bold mb-5 text-white group-hover:text-primary-fixed transition-colors leading-tight line-clamp-2">
                      {course.title}
                    </h3>
                    
                    <div className="flex items-center gap-3 mb-6">
                      <img
                        src={course.mentorAvatar}
                        alt={course.mentorName}
                        className="w-10 h-10 rounded-xl object-cover border border-white/10"
                      />
                      <div>
                        <p className="text-sm font-bold text-white">{course.mentorName}</p>
                        <p className="text-[10px] uppercase tracking-wider text-white/50">{course.mentorTitle}</p>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-6 border-t border-white/5">
                      <div className="flex items-center gap-4">
                        <div className="flex items-center gap-1.5">
                          <Star className="text-primary-fixed size-4.5" />
                          <span className="font-bold text-white text-sm">{course.rating}</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-zinc-500">
                          <Clock className="size-4.5" />
                          <span className="text-sm font-medium">{Math.floor(course.duration / 60)}h</span>
                        </div>
                      </div>
                      <div className="text-xl font-black text-primary-fixed">
                        {formatPrice(course.price)}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {filteredCourses.length === 0 && (
              <div className="text-center py-32 glass-card rounded-3xl border border-white/5">
                <Search className="mb-6 size-16 text-white/25" />
                <h3 className="text-2xl font-bold text-white mb-2">Không tìm thấy khóa học</h3>
                <p className="mb-10 text-white/55">Thử thay đổi bộ lọc hoặc từ khóa tìm kiếm</p>
                <button
                  onClick={() => {
                    setSearchQuery("");
                    setSelectedCategory("Tất cả");
                    setSelectedLevel("Tất cả");
                  }}
                  className="rounded-full bg-violet-600 px-8 py-3 font-bold text-white transition-all hover:scale-105 hover:bg-violet-500"
                >
                  Xóa tất cả bộ lọc
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ═══════════════ MY COURSES TAB ═══════════════ */}
      {activeTab === "my-courses" && (
        <div className="relative z-[1] mx-auto max-w-7xl px-6 py-16">
          {/* Header & Stats */}
          <div className="mb-16">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-8">
              <div>
                <h2 className="text-4xl font-black text-white tracking-tighter mb-4">Lộ trình của bạn</h2>
                <p className="max-w-xl text-white/60">Theo dõi tiến độ học tập và các chứng chỉ bạn đã đạt được trên hành trình chinh phục sự nghiệp.</p>
              </div>
              
              <div className="flex gap-4">
                {[
                  { label: "Hoàn thành", value: totalCompleted, icon: <ShieldCheck className="text-primary-fixed size-5" /> },
                  { label: "Giờ học", value: `${totalHoursLearned}h`, icon: <Clock className="size-5" /> }
                ].map((stat, i) => (
                  <div key={i} className="glass-card px-6 py-4 rounded-2xl border border-white/5 flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl bg-primary-fixed/10 flex items-center justify-center border border-primary-fixed/20">
                      {stat.icon}
                    </div>
                    <div>
                      <p className="text-xl font-black text-white">{stat.value}</p>
                      <p className="text-[10px] font-bold uppercase tracking-widest text-white/50">{stat.label}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Recent activity */}
          <RecentActivity items={enrolledCourses} />

          {/* Filter & Search for My Courses */}
          <div className="flex flex-col md:flex-row gap-6 mb-12 items-center justify-between">
            <div className="flex p-1 bg-white/5 rounded-xl border border-white/5">
              {["Tất cả", "Đang học", "Đã hoàn thành"].map((t) => (
                <button
                  key={t}
                  onClick={() => setMyCoursesTab(t)}
                  className={`px-6 py-2.5 rounded-lg text-xs font-bold transition-all ${
                    myCoursesTab === t
                      ? "bg-white/10 text-white shadow-lg"
                      : "text-white/50 hover:text-white"
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>

            <div className="relative w-full md:w-96 group">
              <Search className="absolute left-4 top-1/2 size-4.5 -translate-y-1/2 text-white/40 transition-colors group-focus-within:text-[#c4ff47]" />
              <input
                type="text"
                placeholder="Tìm trong khóa học của tôi..."
                value={myCoursesSearch}
                onChange={(e) => setMyCoursesSearch(e.target.value)}
                className="w-full rounded-2xl border border-white/12 bg-white/[0.06] py-3.5 pl-11 pr-5 text-sm text-white placeholder:text-white/45 transition-all focus:outline-none focus:ring-2 focus:ring-[#6E35E8]/35"
              />
            </div>
          </div>

          {/* Grid */}
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {filteredMyCourses.map((item) => (
              <EnrolledCourseCard
                key={item.course.id}
                item={item}
                onContinue={() => navigate(`/courses/${item.course.id}/learn`)}
              />
            ))}
          </div>

          {filteredMyCourses.length === 0 && (
            <div className="text-center py-32 glass-card rounded-3xl border border-white/5">
              <span className="material-symbols-outlined mb-6 text-6xl text-white/25">menu_book</span>
              <h3 className="text-2xl font-bold text-white mb-2">Chưa có khóa học nào</h3>
              <p className="mb-10 text-white/55">Khám phá các khóa học mới để bắt đầu hành trình của bạn.</p>
              <button
                onClick={() => setSearchParams({ tab: "explore" })}
                className="px-10 py-4 bg-primary-fixed text-on-primary-fixed rounded-full font-black hover:scale-105 transition-all"
              >
                Khám phá ngay
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}