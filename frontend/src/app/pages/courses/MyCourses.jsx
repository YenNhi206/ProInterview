import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router";
import {
  GraduationCap,
  PlayCircle,
  CheckCircle,
  Clock,
  BookOpen,
  Trophy,
  Flame,
  Search,
  BadgeCheck,
  Star,
  Award,
  Zap,
  Sparkles,
  ExternalLink,
} from "lucide-react";
import { COURSES_DATA, getCourseById } from "../../data/coursesData";

/* ── Constants ─────────────────────────────────────────────── */
const ENROLLED_KEY = "prointerview_enrolled_courses";
const PROGRESS_KEY = (id) => `prointerview_course_progress_${id}`;

/* ── Helpers ────────────────────────────────────────────────── */
const formatDuration = (minutes) => {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? `${h}h ${m > 0 ? m + "m" : ""}`.trim() : `${m}m`;
};

const formatPrice = (price) => {
  if (price === 0) return "Miễn phí";
  return new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(price);
};

/* ── Seed demo data (so the page isn't empty on first visit) ── */
function seedDemoEnrollments() {
  const existing = localStorage.getItem(ENROLLED_KEY);
  if (!existing) {
    // Enroll courses 1, 2, 3 by default for demo
    localStorage.setItem(ENROLLED_KEY, JSON.stringify(["1", "2", "3"]));
  }
  // Seed some progress data if not set
  const p1 = localStorage.getItem(PROGRESS_KEY("1"));
  if (!p1) {
    localStorage.setItem(PROGRESS_KEY("1"), JSON.stringify(["1-1", "1-2", "1-3", "1-4", "1-5", "1-6", "1-7"]));
  }
  const p2 = localStorage.getItem(PROGRESS_KEY("2"));
  if (!p2) {
    localStorage.setItem(PROGRESS_KEY("2"), JSON.stringify(["2-1", "2-2", "2-3", "2-4", "2-5", "2-6", "2-7", "2-8", "2-9", "2-10"]));
  }
  // Course 3: no progress yet
}

/* ── Enrolled Course Item ───────────────────────────────────── */

function loadEnrolledCourses() {
  seedDemoEnrollments();
  try {
    const ids = JSON.parse(localStorage.getItem(ENROLLED_KEY) || "[]");
    return ids
      .map((id) => {
        const course = getCourseById(id);
        if (!course) return null;
        const completed = JSON.parse(localStorage.getItem(PROGRESS_KEY(id)) || "[]");
        const totalLessons = course.lessons?.length || course.lessonsCount;
        const progressPct = totalLessons > 0 ? Math.round((completed.length / totalLessons) * 100) : 0;
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

/* ── Level Badge ────────────────────────────────────────────── */
function LevelBadge({ level }) {
  const colors = {
    Beginner: { bg: "rgba(180,240,0,0.12)", text: "#4A7A00", border: "rgba(180,240,0,0.3)" },
    Intermediate: { bg: "rgba(110, 53, 232,0.08)", text: "#6E35E8", border: "rgba(110, 53, 232,0.2)" },
    Advanced: { bg: "rgba(255,140,66,0.1)", text: "#CC5C00", border: "rgba(255,140,66,0.3)" },
  };
  const c = colors[level] || colors.Intermediate;
  const label = level === "Beginner" ? "Cơ bản" : level === "Intermediate" ? "Trung cấp" : "Nâng cao";
  return (
    <span
      className="text-xs font-semibold px-2 py-0.5 rounded-md"
      style={{ background: c.bg, color: c.text, border: `1px solid ${c.border}` }}
    >
      {label}
    </span>
  );
}

/* ── Progress Ring ──────────────────────────────────────────── */
function ProgressRing({ pct, size = 52 }) {
  const r = (size - 8) / 2;
  const circumference = 2 * Math.PI * r;
  const offset = circumference - (pct / 100) * circumference;
  const isCompleted = pct === 100;
  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#F0EAFD" strokeWidth={6} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={isCompleted ? "#B4F000" : "#6E35E8"}
          strokeWidth={6}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transition: "stroke-dashoffset 0.5s ease" }}
        />
      </svg>
      <span
        className="absolute text-xs font-bold"
        style={{ color: isCompleted ? "#4A7A00" : "#6E35E8" }}
      >
        {pct}%
      </span>
    </div>
  );
}

/* ── Course Card ────────────────────────────────────────────── */
function CourseCard({ item, onContinue }) {
  const { course, completedLessons, progressPct, isCompleted } = item;
  const totalLessons = course.lessons?.length || course.lessonsCount;
  const timeSpent = course.lessons
    ? course.lessons
        .filter((l) => completedLessons.includes(l.id))
        .reduce((sum, l) => sum + l.duration, 0)
    : 0;

  return (
    <div
      className="bg-white rounded-3xl overflow-hidden shadow-sm hover:shadow-xl transition-all duration-300 border border-gray-100 hover:-translate-y-0.5 flex flex-col"
    >
      {/* Thumbnail */}
      <div className="relative h-44 overflow-hidden">
        <img
          src={course.thumbnail}
          alt={course.title}
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />

        {/* Completion badge */}
        {isCompleted && (
          <div
            className="absolute top-3 left-3 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold"
            style={{ background: "#B4F000", color: "#1F1F1F" }}
          >
            <Trophy className="w-3.5 h-3.5" />
            Hoàn thành
          </div>
        )}

        {/* Level badge */}
        <div className="absolute top-3 right-3">
          <LevelBadge level={course.level} />
        </div>

        {/* Progress ring overlay */}
        <div className="absolute bottom-3 right-3">
          <ProgressRing pct={progressPct} size={52} />
        </div>

        {/* Lesson count bottom left */}
        <div className="absolute bottom-3 left-3">
          <span className="text-white/90 text-xs font-medium flex items-center gap-1">
            <CheckCircle className="w-3.5 h-3.5" style={{ color: isCompleted ? "#B4F000" : "rgba(255,255,255,0.7)" }} />
            {completedLessons.length}/{totalLessons} bài
          </span>
        </div>
      </div>

      {/* Content */}
      <div className="p-5 flex flex-col flex-1">
        {/* Category */}
        <div className="flex items-center gap-2 mb-2">
          <span
            className="text-xs font-bold px-2 py-0.5 rounded-md"
            style={{ background: "rgba(110, 53, 232,0.08)", color: "#6E35E8" }}
          >
            {course.category}
          </span>
        </div>

        {/* Title */}
        <h3 className="font-bold text-gray-900 mb-3 line-clamp-2 leading-snug">
          {course.title}
        </h3>

        {/* Mentor */}
        <div className="flex items-center gap-2.5 mb-4">
          <img
            src={course.mentorAvatar}
            alt={course.mentorName}
            className="w-8 h-8 rounded-full object-cover ring-2 ring-white"
          />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-gray-800 truncate">{course.mentorName}</p>
            <p className="text-xs text-gray-400 truncate">{course.mentorTitle}</p>
          </div>
          <BadgeCheck className="h-4 w-4 flex-shrink-0 text-[#6E35E8]" aria-hidden />
        </div>

        {/* Progress bar */}
        <div className="mb-4">
          <div className="flex justify-between items-center mb-1.5">
            <span className="text-xs text-gray-500">Tiến độ học</span>
            <span
              className="text-xs font-bold"
              style={{ color: isCompleted ? "#4A7A00" : "#6E35E8" }}
            >
              {progressPct}%
            </span>
          </div>
          <div className="w-full h-2 rounded-full" style={{ background: "#F0EAFD" }}>
            <div
              className="h-2 rounded-full transition-all duration-500"
              style={{
                width: `${progressPct}%`,
                background: isCompleted
                  ? "linear-gradient(90deg, #7CB800, #B4F000)"
                  : "linear-gradient(90deg, #6E35E8, #8B4DFF)",
              }}
            />
          </div>
        </div>

        {/* Stats row */}
        <div className="flex items-center gap-4 mb-4 text-xs text-gray-500">
          <div className="flex items-center gap-1">
            <Clock className="w-3.5 h-3.5" />
            <span>{formatDuration(timeSpent)} đã học</span>
          </div>
          <div className="flex items-center gap-1">
            <BookOpen className="w-3.5 h-3.5" />
            <span>{totalLessons} bài học</span>
          </div>
          <div className="flex items-center gap-1">
            <Star className="w-3.5 h-3.5 text-[#FFD600]" />
            <span className="font-semibold text-gray-700">{course.rating}</span>
          </div>
        </div>

        {/* CTA */}
        <div className="mt-auto">
          {isCompleted ? (
            <div className="flex gap-2">
              <button
                onClick={onContinue}
                className="flex-1 py-2.5 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition-all hover:opacity-90"
                style={{ background: "rgba(180,240,0,0.12)", color: "#4A7A00", border: "1px solid rgba(180,240,0,0.3)" }}
              >
                <ArrowSquareOut className="w-4 h-4" />
                Ôn lại
              </button>
              <button
                className="flex-1 py-2.5 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition-all hover:opacity-90"
                style={{ background: "#B4F000", color: "#1F1F1F" }}
              >
                <Certificate className="w-4 h-4" />
                Chứng chỉ
              </button>
            </div>
          ) : progressPct === 0 ? (
            <button
              onClick={onContinue}
              className="w-full py-2.5 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition-all hover:brightness-110"
              style={{ background: "linear-gradient(135deg, #6E35E8, #8B4DFF)", color: "#fff" }}
            >
              <PlayCircle className="w-4 h-4" />
              Bắt đầu học
            </button>
          ) : (
            <button
              onClick={onContinue}
              className="w-full py-2.5 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition-all hover:brightness-110"
              style={{ background: "linear-gradient(135deg, #6E35E8, #8B4DFF)", color: "#fff" }}
            >
              <Lightning className="w-4 h-4" />
              Tiếp tục học
              <ArrowRight className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Stat Card ──────────────────────────────────────────────── */
function StatCard({
  icon: Icon,
  label,
  value,
  sub,
  color,
  bgColor,
}) {
  return (
    <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 flex items-center gap-4">
      <div
        className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0"
        style={{ background: bgColor }}
      >
        <Icon className="w-6 h-6" style={{ color }} />
      </div>
      <div>
        <p className="text-2xl font-bold" style={{ color: "#1F1F1F" }}>
          {value}
        </p>
        <p className="text-sm text-gray-500">{label}</p>
        {sub && <p className="text-xs text-gray-400">{sub}</p>}
      </div>
    </div>
  );
}

/* ── Empty State ────────────────────────────────────────────── */
function EmptyState({ tab, onBrowse }) {
  if (tab === "Đang học") {
    return (
      <div className="text-center py-20">
        <div
          className="w-20 h-20 rounded-3xl flex items-center justify-center mx-auto mb-5"
          style={{ background: "rgba(110, 53, 232,0.08)" }}
        >
          <Fire className="w-10 h-10 text-[#6E35E8]" />
        </div>
        <h3 className="text-xl font-bold text-gray-900 mb-2">Chưa có khóa học đang học</h3>
        <p className="text-gray-500 mb-6 max-w-sm mx-auto">
          Bắt đầu một khóa học mới để thấy tiến độ của bạn tại đây
        </p>
        <button
          onClick={onBrowse}
          className="px-6 py-3 rounded-xl font-semibold text-sm text-white flex items-center gap-2 mx-auto transition-all hover:brightness-110"
          style={{ background: "linear-gradient(135deg, #6E35E8, #8B4DFF)" }}
        >
          Khám phá khóa học
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    );
  }
  if (tab === "Đã hoàn thành") {
    return (
      <div className="text-center py-20">
        <div
          className="w-20 h-20 rounded-3xl flex items-center justify-center mx-auto mb-5"
          style={{ background: "rgba(180,240,0,0.12)" }}
        >
          <Trophy className="w-10 h-10" style={{ color: "#4A7A00" }} />
        </div>
        <h3 className="text-xl font-bold text-gray-900 mb-2">Chưa hoàn thành khóa học nào</h3>
        <p className="text-gray-500 mb-6 max-w-sm mx-auto">
          Tiếp tục học để nhận chứng chỉ hoàn thành và unlock thành tích mới
        </p>
        <button
          onClick={onBrowse}
          className="px-6 py-3 rounded-xl font-semibold text-sm flex items-center gap-2 mx-auto transition-all hover:brightness-110"
          style={{ background: "#B4F000", color: "#1F1F1F" }}
        >
          Tiếp tục học ngay
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    );
  }
  return (
    <div className="text-center py-20">
      <div
        className="w-20 h-20 rounded-3xl flex items-center justify-center mx-auto mb-5"
        style={{ background: "rgba(110, 53, 232,0.08)" }}
      >
        <GraduationCap className="w-10 h-10 text-[#6E35E8]" />
      </div>
      <h3 className="text-xl font-bold text-gray-900 mb-2">Bạn chưa đăng ký khóa học nào</h3>
      <p className="text-gray-500 mb-6 max-w-sm mx-auto">
        Khám phá hàng chục khóa học từ các Mentor hàng đầu để cải thiện kỹ năng phỏng vấn
      </p>
      <button
        onClick={onBrowse}
        className="px-6 py-3 rounded-xl font-semibold text-sm text-white flex items-center gap-2 mx-auto transition-all hover:brightness-110"
        style={{ background: "linear-gradient(135deg, #6E35E8, #8B4DFF)" }}
      >
        Khám phá khóa học
        <ArrowRight className="w-4 h-4" />
      </button>
    </div>
  );
}

/* ── Recent Activity ────────────────────────────────────────── */
function RecentActivity({ items }) {
  const inProgress = items.filter((i) => i.progressPct > 0 && !i.isCompleted);
  if (inProgress.length === 0) return null;

  return (
    <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100 mb-8">
      <div className="flex items-center gap-2 mb-5">
        <Fire className="w-5 h-5 text-[#FF8C42]" />
        <h2 className="font-bold text-gray-900">Tiếp tục từ chỗ bỏ dở</h2>
      </div>
      <div className="space-y-3">
        {inProgress.slice(0, 2).map(({ course, progressPct, completedLessons }) => {
          const totalLessons = course.lessons?.length || course.lessonsCount;
          const nextLesson = course.lessons?.find((l) => !completedLessons.includes(l.id));
          return (
            <div
              key={course.id}
              className="flex items-center gap-4 p-4 rounded-2xl cursor-pointer hover:bg-gray-50 transition-colors group"
            >
              <img
                src={course.thumbnail}
                alt={course.title}
                className="w-14 h-14 rounded-xl object-cover flex-shrink-0"
              />
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-gray-900 truncate text-sm">{course.title}</p>
                {nextLesson && (
                  <p className="text-xs text-gray-400 truncate mt-0.5">
                    Tiếp theo: {nextLesson.title}
                  </p>
                )}
                <div className="flex items-center gap-3 mt-2">
                  <div className="flex-1 h-1.5 rounded-full" style={{ background: "#F0EAFD" }}>
                    <div
                      className="h-1.5 rounded-full"
                      style={{
                        width: `${progressPct}%`,
                        background: "linear-gradient(90deg, #6E35E8, #8B4DFF)",
                      }}
                    />
                  </div>
                  <span className="text-xs font-semibold text-[#6E35E8] flex-shrink-0">
                    {progressPct}%
                  </span>
                </div>
              </div>
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 transition-all group-hover:scale-110"
                style={{ background: "linear-gradient(135deg, #6E35E8, #8B4DFF)" }}
              >
                <PlayCircle className="w-5 h-5 text-white" />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ── Main Component ─────────────────────────────────────────── */
const TABS = ["Tất cả", "Đang học", "Đã hoàn thành"];

export function MyCourses() {
  const navigate = useNavigate();
  const [enrolledCourses, setEnrolledCourses] = useState([]);
  const [activeTab, setActiveTab] = useState("Tất cả");
  const [searchQuery, setSearchQuery] = useState("");

  // Load enrolled courses
  useEffect(() => {
    setEnrolledCourses(loadEnrolledCourses());
  }, []);

  // Compute stats
  const totalEnrolled = enrolledCourses.length;
  const totalCompleted = enrolledCourses.filter((e) => e.isCompleted).length;
  const totalInProgress = enrolledCourses.filter((e) => e.progressPct > 0 && !e.isCompleted).length;
  const totalMinutesLearned = enrolledCourses.reduce((sum, { course, completedLessons }) => {
    if (!course.lessons) return sum;
    return sum + course.lessons.filter((l) => completedLessons.includes(l.id)).reduce((s, l) => s + l.duration, 0);
  }, 0);
  const totalHoursLearned = Math.round(totalMinutesLearned / 60 * 10) / 10;

  // Filter
  const filtered = enrolledCourses.filter((item) => {
    const matchSearch =
      searchQuery === "" ||
      item.course.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.course.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.course.mentorName.toLowerCase().includes(searchQuery.toLowerCase());
    const matchTab =
      activeTab === "Tất cả" ||
      (activeTab === "Đang học" && item.progressPct > 0 && !item.isCompleted) ||
      (activeTab === "Đã hoàn thành" && item.isCompleted);
    return matchSearch && matchTab;
  });

  return (
    <div className="min-h-full bg-transparent text-foreground">
      {/* ── Hero Banner ── */}
      <div
        className="relative overflow-hidden"
        style={{ background: "linear-gradient(145deg, #0E0922 0%, #1a0d35 100%)" }}
      >
        {/* Decorative blobs */}
        <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 left-0 w-72 h-72 rounded-full blur-3xl opacity-20" style={{ background: "#B4F000" }} />
          <div className="absolute bottom-0 right-0 w-80 h-80 rounded-full blur-3xl opacity-15" style={{ background: "#FFD600" }} />
          <div className="absolute top-1/2 left-1/3 w-48 h-48 rounded-full blur-3xl opacity-10 bg-white" />
        </div>

        {/* Grid pattern */}
        <div className="absolute inset-0 opacity-[0.05]" style={{
          backgroundImage: "linear-gradient(rgba(255,255,255,0.5) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.5) 1px,transparent 1px)",
          backgroundSize: "40px 40px"
        }} />

        <div className="relative max-w-7xl mx-auto px-6 pt-10 pb-8">
          <div className="flex items-start justify-between gap-6 flex-wrap">
            <div>
              <div className="flex items-center gap-2 mb-3">
                <GraduationCap className="w-7 h-7" style={{ color: "#B4F000" }} />
                <span className="text-xs font-bold tracking-widest uppercase" style={{ color: "#B4F000" }}>
                  Khóa học của tôi
                </span>
              </div>
              <h1 className="text-3xl md:text-4xl font-bold text-white mb-2">
                Hành trình học tập của bạn
              </h1>
              <p className="text-white/70 text-base max-w-lg">
                Theo dõi tiến độ, tiếp tục từ chỗ bỏ dở và nhận chứng chỉ khi hoàn thành.
              </p>
            </div>

            {/* Quick stat pill */}
            {totalEnrolled > 0 && (
              <div
                className="flex items-center gap-3 px-5 py-3 rounded-2xl self-start"
                style={{ background: "rgba(255,255,255,0.12)", backdropFilter: "blur(8px)", border: "1px solid rgba(255,255,255,0.2)" }}
              >
                <Sparkle className="w-5 h-5 text-[#FFD600]" />
                <div>
                  <p className="text-white font-bold text-sm">{totalHoursLearned}h học</p>
                  <p className="text-white/60 text-xs">{totalCompleted} hoàn thành</p>
                </div>
              </div>
            )}
          </div>

          {/* Stats row */}
          {totalEnrolled > 0 && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-7">
              {[
                { label: "Đã đăng ký", value: totalEnrolled, icon: GraduationCap, color: "rgba(255,255,255,0.9)", bg: "rgba(255,255,255,0.12)" },
                { label: "Đang học", value: totalInProgress, icon: GraduationCap, color: "#FF8C42", bg: "rgba(255,140,66,0.2)" },
                { label: "Hoàn thành", value: totalCompleted, icon: GraduationCap, color: "#B4F000", bg: "rgba(180,240,0,0.2)" },
                { label: "Giờ học", value: `${totalHoursLearned}h`, icon: GraduationCap, color: "rgba(255,255,255,0.9)", bg: "rgba(255,255,255,0.12)" },
              ].map(({ label, value, icon, color, bg }) => (
                <div
                  key={label}
                  className="flex items-center gap-3 px-4 py-3 rounded-2xl"
                  style={{ background: bg, border: "1px solid rgba(255,255,255,0.1)" }}
                >
                  <Icon className="w-5 h-5 flex-shrink-0" style={{ color }} />
                  <div>
                    <p className="text-xl font-bold text-white">{value}</p>
                    <p className="text-xs text-white/60">{label}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Recent activity strip */}
        <RecentActivity items={enrolledCourses} />

        {/* Tabs + Search */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
          {/* Tabs */}
          <div
            className="flex gap-1 p-1 rounded-2xl"
            style={{ background: "#EDEAF5" }}
          >
            {TABS.map((tab) => {
              const count =
                tab === "Tất cả"
                  ? totalEnrolled
                  : tab === "Đang học"
                  ? totalInProgress
                  : totalCompleted;
              return (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className="px-4 py-2 rounded-xl text-sm font-semibold transition-all flex items-center gap-2"
                  style={
                    activeTab === tab
                      ? { background: "#6E35E8", color: "#fff", boxShadow: "0 2px 8px rgba(110, 53, 232,0.3)" }
                      : { color: "#6B7280" }
                  }
                >
                  {tab}
                  {count > 0 && (
                    <span
                      className="text-xs px-1.5 py-0.5 rounded-full"
                      style={
                        activeTab === tab
                          ? { background: "rgba(255,255,255,0.25)", color: "#fff" }
                          : { background: "rgba(110, 53, 232,0.1)", color: "#6E35E8" }
                      }
                    >
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Search */}
          {totalEnrolled > 0 && (
            <div className="relative w-full sm:w-72">
              <MagnifyingGlass className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Tìm khóa học của bạn..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 rounded-2xl bg-white border border-gray-200 text-sm text-gray-800 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#6E35E8]/30 shadow-sm"
              />
            </div>
          )}
        </div>

        {/* Results info */}
        {filtered.length > 0 && (
          <p className="text-sm text-gray-500 mb-5">
            Hiển thị{" "}
            <span className="font-semibold text-gray-800">{filtered.length}</span> khóa học
            {searchQuery && ` cho "${searchQuery}"`}
          </p>
        )}

        {/* Grid */}
        {filtered.length > 0 ? (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filtered.map((item) => (
              <CourseCard
                key={item.course.id}
                item={item}
                onContinue={() => navigate(`/courses/${item.course.id}/learn`)}
              />
            ))}
          </div>
        ) : (
          <EmptyState tab={activeTab} onBrowse={() => navigate("/courses")} />
        )}

        {/* Browse more */}
        {totalEnrolled > 0 && (
          <div
            className="mt-12 rounded-3xl p-8 flex flex-col md:flex-row items-center justify-between gap-6"
            style={{
              background: "linear-gradient(135deg, rgba(110, 53, 232,0.06) 0%, rgba(139, 77, 255,0.04) 100%)",
              border: "1px solid rgba(110, 53, 232,0.12)",
            }}
          >
            <div className="flex items-center gap-4">
              <div
                className="w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0"
                style={{ background: "linear-gradient(135deg, #6E35E8, #8B4DFF)" }}
              >
                <Sparkle className="w-7 h-7 text-white" />
              </div>
              <div>
                <p className="font-bold text-gray-900">Khám phá thêm khóa học</p>
                <p className="text-sm text-gray-500">
                  Hơn {COURSES_DATA.length} khóa học từ các Mentor hàng đầu đang chờ bạn
                </p>
              </div>
            </div>
            <button
              onClick={() => navigate("/courses")}
              className="px-6 py-3 rounded-xl font-semibold text-sm text-white flex items-center gap-2 transition-all hover:brightness-110 flex-shrink-0"
              style={{ background: "linear-gradient(135deg, #6E35E8, #8B4DFF)" }}
            >
              Xem tất cả khóa học
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}