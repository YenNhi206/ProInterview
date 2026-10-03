import React, { useState, useEffect, useCallback, useMemo } from "react";
import { Link, useNavigate } from "react-router";
import { AccountReveal } from "../../components/account/AccountMotion";
import { AlertCircle, ArrowUpRight, BookOpen, CheckCircle2, Play, RefreshCw, Trophy, Target, Sparkles, GraduationCap, Clock } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { enrollmentApi } from "../../api/enrollmentApi.js";
import { toastApiError } from "../../utils/shared/apiToast.js";
import { enrollmentAccessGranted } from "../../utils/course/enrollmentAccess.js";
import { mediaSrc } from "../../utils/shared/mediaUrl.js";
import { CUSTOMER_SHELL_GUTTER, CUSTOMER_SHELL_MAX } from "../../components/layout/customerShellLayout";
import "../../../styles/my-courses.css";

function AnimatedNumber({ value, duration = 1 }) {
  const [displayValue, setDisplayValue] = useState(0);
  const prevValueRef = React.useRef(0);

  useEffect(() => {
    const start = prevValueRef.current;
    const end = Math.round(Number(value) || 0);
    prevValueRef.current = end;

    if (start === end) {
      setDisplayValue(end);
      return;
    }

    const startTime = performance.now();
    const durationMs = Math.max(300, duration * 1000);

    let frameId;
    const update = (now) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / durationMs, 1);
      const ease = 1 - Math.pow(1 - progress, 3);
      const current = Math.round(start + (end - start) * ease);
      setDisplayValue(current);

      if (progress < 1) {
        frameId = requestAnimationFrame(update);
      } else {
        setDisplayValue(end);
      }
    };

    frameId = requestAnimationFrame(update);
    return () => cancelAnimationFrame(frameId);
  }, [value, duration]);

  return <>{displayValue}</>;
}

function CourseCover({ src }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [src]);

  if (!src || failed) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-violet-950/40 via-slate-900/60 to-indigo-950/40 text-violet-400/60" aria-hidden="true">
        <BookOpen size={42} strokeWidth={1.3} />
        <span className="text-[11px] font-semibold text-slate-400 mt-2">ProInterview Course</span>
      </div>
    );
  }

  return (
    <img
      src={src}
      alt=""
      loading="lazy"
      onError={() => setFailed(true)}
      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
    />
  );
}

function CourseCard({ item, index }) {
  const navigate = useNavigate();
  const { course, progressPct, completedCount, isCompleted, hasPaidAccess } = item;
  const actionLabel = isCompleted ? "Xem lại" : progressPct > 0 ? "Tiếp tục học" : "Bắt đầu học";
  const courseDetailUrl = `/courses/${course.id}`;
  const courseLearnUrl = `/courses/${course.id}/learn`;

  const handleCardClick = (e) => {
    // If clicked on an interactive button/link inside the card, let that element handle it
    if (e.target.closest("button") || e.target.closest("a")) return;
    navigate(courseDetailUrl);
  };

  return (
    <AccountReveal
      as="article"
      index={index}
      onClick={handleCardClick}
      className="rounded-2xl border border-white/10 bg-gradient-to-b from-[#181538]/75 via-[#13112c]/80 to-[#0e0c22]/90 shadow-[0_8px_30px_rgba(0,0,0,0.35)] backdrop-blur-2xl hover:border-violet-400/40 hover:shadow-[0_16px_40px_rgba(124,58,237,0.22)] hover:-translate-y-1 transition-all duration-300 overflow-hidden flex flex-col group cursor-pointer select-none"
    >
      {/* Thumbnail with overlay & badge */}
      <div className="relative aspect-video overflow-hidden bg-slate-950">
        <CourseCover src={course.thumbnail} />
        {/* Soft dark vignette */}
        <div className="absolute inset-0 bg-gradient-to-t from-[#0e0c22] via-transparent to-black/25 pointer-events-none" />

        {/* Status Badge */}
        <div className="absolute top-3 left-3 z-10">
          {hasPaidAccess && isCompleted && (
            <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold bg-emerald-500/25 text-emerald-300 border border-emerald-500/40 backdrop-blur-md shadow-[0_0_12px_rgba(16,185,129,0.3)]">
              <CheckCircle2 size={13} aria-hidden="true" />
              Hoàn thành
            </span>
          )}
          {hasPaidAccess && !isCompleted && (
            <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold bg-violet-500/25 text-violet-200 border border-violet-400/40 backdrop-blur-md shadow-[0_0_12px_rgba(124,58,237,0.3)]">
              <Play size={11} className="fill-current" aria-hidden="true" />
              Đang học
            </span>
          )}
          {!hasPaidAccess && (
            <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold bg-amber-500/25 text-amber-300 border border-amber-500/40 backdrop-blur-md shadow-[0_0_12px_rgba(245,158,11,0.25)]">
              <Clock size={12} aria-hidden="true" />
              Chờ thanh toán
            </span>
          )}
        </div>
      </div>

      {/* Card Content Body */}
      <div className="p-5 flex-1 flex flex-col justify-between">
        <div>
          <h2 className="text-base sm:text-lg font-bold text-white tracking-tight line-clamp-2 leading-snug group-hover:text-violet-200 transition-colors">
            <Link to={courseDetailUrl} onClick={(e) => e.stopPropagation()}>{course.title}</Link>
          </h2>

          <div className="flex items-center gap-2 mt-2 mb-4 text-xs text-slate-300 font-medium">
            <GraduationCap size={14} className="text-violet-400 shrink-0" />
            <span className="truncate">{course.mentorName}</span>
          </div>
        </div>

        {/* Progress or Pending Notice */}
        <div className="mt-auto pt-2">
          {hasPaidAccess ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs text-slate-300 font-medium">
                <span>{completedCount} / {course.lessonsCount} bài học</span>
                <span className="font-bold text-violet-300 tabular-nums">
                  <AnimatedNumber value={progressPct} duration={0.8} />%
                </span>
              </div>
              <div className="h-2 w-full rounded-full bg-slate-900 border border-white/10 overflow-hidden p-0.5">
                <motion.div
                  className={`h-full rounded-full ${
                    isCompleted
                      ? "bg-gradient-to-r from-emerald-500 via-teal-400 to-emerald-300 shadow-[0_0_10px_rgba(16,185,129,0.5)]"
                      : "bg-gradient-to-r from-violet-500 via-indigo-500 to-violet-300 shadow-[0_0_10px_rgba(124,58,237,0.5)]"
                  }`}
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.max(5, progressPct)}%` }}
                  transition={{ duration: 0.8, ease: "easeOut" }}
                />
              </div>
            </div>
          ) : (
            <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-200 text-xs font-medium flex items-center gap-2">
              <AlertCircle size={14} className="text-amber-400 shrink-0" />
              <span>Hoàn tất thanh toán để bắt đầu học.</span>
            </div>
          )}

          {/* Action Row */}
          <div className="flex items-center justify-between gap-2.5 mt-4 pt-3.5 border-t border-white/10">
            {hasPaidAccess ? (
              <Link
                to={courseLearnUrl}
                onClick={(e) => e.stopPropagation()}
                className={`flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl px-4 py-2.5 text-xs font-bold transition-all active:scale-[0.98] ${
                  isCompleted
                    ? "border border-emerald-400/30 bg-emerald-500/15 text-emerald-200 hover:bg-emerald-500/25 shadow-sm"
                    : "bg-gradient-to-r from-violet-600 via-indigo-600 to-violet-500 text-white shadow-md hover:brightness-110"
                }`}
              >
                <Play size={13} className="fill-current" aria-hidden="true" />
                {actionLabel}
              </Link>
            ) : (
              <Link
                to={courseDetailUrl}
                onClick={(e) => e.stopPropagation()}
                className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-violet-600 via-indigo-600 to-violet-500 px-4 py-2.5 text-xs font-bold text-white shadow-md hover:brightness-110 active:scale-[0.98] transition-all"
              >
                Thanh toán ngay
              </Link>
            )}

            <Link
              to={courseDetailUrl}
              onClick={(e) => e.stopPropagation()}
              className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-white/15 bg-white/[0.06] hover:bg-white/[0.12] hover:border-violet-400/40 px-3.5 py-2.5 text-xs font-bold text-slate-200 hover:text-white shadow-sm transition-all active:scale-[0.98]"
              aria-label={`Chi tiết khóa học ${course.title}`}
            >
              <span>Chi tiết</span>
              <ArrowUpRight size={13} aria-hidden="true" />
            </Link>
          </div>
        </div>
      </div>
    </AccountReveal>
  );
}

function CourseSkeleton() {
  return (
    <div className="rounded-2xl border border-white/10 bg-gradient-to-b from-[#181538]/70 via-[#13112c]/75 to-[#0e0c22]/80 overflow-hidden flex flex-col" aria-hidden="true">
      <div className="aspect-video bg-white/5 animate-pulse" />
      <div className="p-5 space-y-3">
        <div className="h-4 bg-white/10 rounded-md w-3/4 animate-pulse" />
        <div className="h-3 bg-white/5 rounded-md w-1/3 animate-pulse" />
        <div className="h-2 bg-white/5 rounded-full w-full mt-4 animate-pulse" />
        <div className="h-9 bg-white/10 rounded-xl w-full mt-4 animate-pulse" />
      </div>
    </div>
  );
}

const TABS = [
  { id: "all", label: "Tất cả" },
  { id: "learning", label: "Đang học" },
  { id: "completed", label: "Hoàn thành" },
];

const EMPTY_STATES = {
  all: { title: "Chưa có khóa học", description: "Tìm khóa học phù hợp để bắt đầu nâng cao kỹ năng phỏng vấn của bạn." },
  learning: { title: "Không có khóa học đang học", description: "Các khóa chưa hoàn thành sẽ hiển thị tại đây khi bạn tham gia." },
  completed: { title: "Chưa có khóa học hoàn thành", description: "Tiếp tục học để hoàn thành khóa học đầu tiên của bạn!" },
};

export function MyCourses() {
  const [enrolledCourses, setEnrolledCourses] = useState([]);
  const [tab, setTab] = useState("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await enrollmentApi.getMyEnrollments();
      if (!res.success) {
        const message = res.error || "Không tải được danh sách khóa học.";
        setError(message);
        toastApiError(message);
        return;
      }
      const mapped = res.enrollments.filter((enrollment) => enrollment.courseId).map((enrollment) => {
        const course = enrollment.courseId;
        const lessons = (course.modules || []).flatMap((module) => module.lessons || []);
        const totalCount = lessons.length || Math.max(0, Number(course.totalLessons) || 0);
        const completedIds = new Set((enrollment.completedLessons || []).map(String));
        const completedCount = Math.min(completedIds.size, totalCount);
        const progressPct = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;
        return {
          id: enrollment._id || course._id,
          course: {
            id: course._id,
            title: course.title,
            thumbnail: mediaSrc(course.thumbnail),
            mentorName: course.mentorId?.userId?.name || "Mentor",
            lessonsCount: totalCount,
          },
          completedCount,
          progressPct,
          isCompleted: progressPct === 100,
          hasPaidAccess: enrollmentAccessGranted(enrollment),
        };
      });
      setEnrolledCourses(mapped);
    } catch {
      const message = "Lỗi kết nối khi tải khóa học của bạn.";
      setError(message);
      toastApiError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadData(); }, [loadData]);

  const groups = useMemo(() => ({
    all: enrolledCourses,
    learning: enrolledCourses.filter((item) => item.hasPaidAccess && !item.isCompleted),
    completed: enrolledCourses.filter((item) => item.hasPaidAccess && item.isCompleted),
  }), [enrolledCourses]);

  const filtered = groups[tab];
  const emptyState = EMPTY_STATES[tab];

  // Calculate statistics for the hero metrics cards
  const paidCourses = useMemo(() => enrolledCourses.filter((item) => item.hasPaidAccess), [enrolledCourses]);
  const avgProgress = useMemo(() => {
    if (paidCourses.length === 0) return 0;
    return Math.round(paidCourses.reduce((sum, item) => sum + item.progressPct, 0) / paidCourses.length);
  }, [paidCourses]);

  function handleTabKeyDown(event, index) {
    let next;
    if (event.key === "ArrowRight") next = (index + 1) % TABS.length;
    if (event.key === "ArrowLeft") next = (index - 1 + TABS.length) % TABS.length;
    if (event.key === "Home") next = 0;
    if (event.key === "End") next = TABS.length - 1;
    if (next == null) return;
    event.preventDefault();
    setTab(TABS[next].id);
    event.currentTarget.parentElement.querySelectorAll('[role="tab"]')[next].focus();
  }

  return (
    <div className="my-courses-page">
      <div className={`${CUSTOMER_SHELL_GUTTER} pb-24 pt-8 sm:pt-12`}>
        <div className={`${CUSTOMER_SHELL_MAX} my-courses-frame`}>
          {/* Header */}
          <motion.header
            className="my-courses-header"
            initial={{ opacity: 0, y: -16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, ease: "easeOut" }}
          >
            <h1>Khóa học của bạn</h1>
            <p>Tiếp tục học và theo dõi tiến độ của bạn.</p>
          </motion.header>

          {/* Prominent Hero Metrics Scoreboard */}
          <div className="my-7">
            {enrolledCourses.length > 0 ? (
              <motion.div
                className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
                initial="hidden"
                animate="visible"
                variants={{
                  hidden: { opacity: 0 },
                  visible: {
                    opacity: 1,
                    transition: { staggerChildren: 0.12, delayChildren: 0.05 },
                  },
                }}
              >
                {/* Card 1: Tiến độ học tập trung bình */}
                <motion.div
                  variants={{
                    hidden: { opacity: 0, y: 20 },
                    visible: { opacity: 1, y: 0, transition: { duration: 0.45, ease: "easeOut" } },
                  }}
                  whileHover={{ y: -4, transition: { duration: 0.2 } }}
                  className="relative overflow-hidden rounded-2xl border border-violet-400/30 bg-gradient-to-br from-[#23174a]/90 via-[#18133b]/85 to-[#120f2e]/90 p-5 shadow-[0_12px_32px_rgba(10,8,30,0.4)] backdrop-blur-xl transition-all duration-300 hover:border-violet-400/50 hover:shadow-[0_16px_40px_rgba(124,58,237,0.28)]"
                >
                  <div className="pointer-events-none absolute -right-6 -top-6 h-28 w-28 rounded-full bg-violet-500/20 blur-2xl" />
                  <div className="flex items-center justify-between gap-3 mb-3">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
                      <span className="p-1.5 rounded-lg bg-violet-500/20 text-violet-300 ring-1 ring-violet-400/30">
                        <Target size={15} />
                      </span>
                      Tiến độ trung bình
                    </span>
                    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
                      avgProgress >= 80 ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30" :
                      avgProgress >= 40 ? "bg-sky-500/20 text-sky-300 border border-sky-500/30" :
                      "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                    }`}>
                      {avgProgress >= 80 ? "Xuất sắc" : avgProgress >= 40 ? "Tiến triển tốt" : "Đang bắt đầu"}
                    </span>
                  </div>
                  <div className="flex items-baseline gap-2">
                    <span className="text-4xl sm:text-5xl font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-white via-violet-200 to-indigo-200 tabular-nums">
                      <AnimatedNumber value={avgProgress} duration={1.1} />
                    </span>
                    <span className="text-sm font-bold text-violet-300/70">% hoàn thành</span>
                  </div>
                  <div className="mt-3.5">
                    <div className="h-2 w-full rounded-full bg-slate-900/80 overflow-hidden p-0.5 border border-white/5">
                      <motion.div
                        className="h-full rounded-full bg-gradient-to-r from-violet-500 via-indigo-500 to-violet-300 shadow-[0_0_12px_rgba(124,58,237,0.5)]"
                        initial={{ width: 0 }}
                        animate={{ width: `${Math.max(5, avgProgress)}%` }}
                        transition={{ duration: 0.85, ease: "easeOut", delay: 0.2 }}
                      />
                    </div>
                  </div>
                </motion.div>

                {/* Card 2: Khóa học đã hoàn thành */}
                <motion.div
                  variants={{
                    hidden: { opacity: 0, y: 20 },
                    visible: { opacity: 1, y: 0, transition: { duration: 0.45, ease: "easeOut" } },
                  }}
                  whileHover={{ y: -4, transition: { duration: 0.2 } }}
                  className="relative overflow-hidden rounded-2xl border border-emerald-400/30 bg-gradient-to-br from-[#0e2927]/90 via-[#0d2027]/85 to-[#0f1729]/90 p-5 shadow-[0_12px_32px_rgba(10,8,30,0.4)] backdrop-blur-xl transition-all duration-300 hover:border-emerald-400/50 hover:shadow-[0_16px_40px_rgba(16,185,129,0.28)]"
                >
                  <div className="pointer-events-none absolute -right-6 -top-6 h-28 w-28 rounded-full bg-emerald-500/20 blur-2xl" />
                  <div className="flex items-center justify-between gap-3 mb-3">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
                      <span className="p-1.5 rounded-lg bg-emerald-500/20 text-emerald-300 ring-1 ring-emerald-400/30">
                        <Trophy size={15} />
                      </span>
                      Đã hoàn thành
                    </span>
                    <span className="inline-flex items-center gap-1 rounded-full border border-emerald-400/30 bg-emerald-500/20 px-2.5 py-0.5 text-[10px] font-bold text-emerald-300">
                      <Sparkles size={11} /> Tốt nghiệp
                    </span>
                  </div>
                  <div className="flex items-baseline gap-2">
                    <span className="text-4xl sm:text-5xl font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-white via-emerald-200 to-teal-200 tabular-nums">
                      <AnimatedNumber value={groups.completed.length} duration={1.1} />
                    </span>
                    <span className="text-sm font-bold text-emerald-300/70">/ {paidCourses.length} khóa học</span>
                  </div>
                  <div className="mt-3.5">
                    <div className="h-2 w-full rounded-full bg-slate-900/80 overflow-hidden p-0.5 border border-white/5">
                      <motion.div
                        className="h-full rounded-full bg-gradient-to-r from-emerald-500 via-teal-400 to-emerald-200 shadow-[0_0_12px_rgba(16,185,129,0.5)]"
                        initial={{ width: 0 }}
                        animate={{ width: `${paidCourses.length ? Math.round((groups.completed.length / paidCourses.length) * 100) : 0}%` }}
                        transition={{ duration: 0.85, ease: "easeOut", delay: 0.3 }}
                      />
                    </div>
                  </div>
                </motion.div>

                {/* Card 3: Tổng khóa học & Khám phá */}
                <motion.div
                  variants={{
                    hidden: { opacity: 0, y: 20 },
                    visible: { opacity: 1, y: 0, transition: { duration: 0.45, ease: "easeOut" } },
                  }}
                  whileHover={{ y: -4, transition: { duration: 0.2 } }}
                  className="relative overflow-hidden rounded-2xl border border-white/15 bg-gradient-to-br from-[#19173d]/90 via-[#131230]/85 to-[#0f0e24]/90 p-5 shadow-[0_12px_32px_rgba(10,8,30,0.4)] backdrop-blur-xl sm:col-span-2 lg:col-span-1 flex flex-col justify-between transition-all duration-300 hover:border-white/25 hover:shadow-[0_16px_40px_rgba(99,102,241,0.2)]"
                >
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
                        <span className="p-1.5 rounded-lg bg-sky-500/20 text-sky-300 ring-1 ring-sky-400/30">
                          <GraduationCap size={15} />
                        </span>
                        Tổng khóa học
                      </span>
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Thư viện</span>
                    </div>
                    <div className="flex items-baseline gap-2">
                      <span className="text-3xl sm:text-4xl font-black text-white tabular-nums">
                        <AnimatedNumber value={enrolledCourses.length} duration={0.9} />
                      </span>
                      <span className="text-xs text-slate-400 font-medium">({groups.learning.length} khóa đang học)</span>
                    </div>
                  </div>

                  <div className="pt-4">
                    <Link
                      to="/courses"
                      className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 via-indigo-600 to-violet-500 px-4 py-2.5 text-xs font-bold text-white shadow-[0_4px_16px_rgba(124,58,237,0.35)] hover:brightness-110 active:scale-[0.98] transition-all"
                    >
                      <BookOpen size={15} />
                      Khám phá thêm khóa học
                    </Link>
                  </div>
                </motion.div>
              </motion.div>
            ) : null}
          </div>

          {/* Toolbar: Floating Glass Segmented Dock + Actions */}
          <motion.div
            className="flex flex-wrap items-center justify-between gap-4 mb-6"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.15, ease: "easeOut" }}
          >
            {/* Apple-style Floating Glass Segmented Dock */}
            <div
              className="relative flex items-center p-1 sm:p-1.5 rounded-2xl border border-white/15 bg-gradient-to-b from-[#1c183d]/85 via-[#14122e]/90 to-[#0e0c24]/95 shadow-[0_8px_32px_rgba(5,3,20,0.5),inset_0_1px_1px_rgba(255,255,255,0.12)] backdrop-blur-2xl w-full sm:w-auto"
              role="tablist"
              aria-label="Lọc khóa học"
            >
              {TABS.map((item, index) => {
                const isSelected = tab === item.id;
                return (
                  <button
                    key={item.id}
                    id={`my-courses-tab-${item.id}`}
                    type="button"
                    role="tab"
                    aria-selected={isSelected}
                    aria-controls="my-courses-panel"
                    tabIndex={isSelected ? 0 : -1}
                    onClick={() => setTab(item.id)}
                    onKeyDown={(event) => handleTabKeyDown(event, index)}
                    className={`relative flex-1 sm:flex-initial px-4 sm:px-5 py-2 sm:py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-all duration-200 flex items-center justify-center gap-2 sm:gap-2.5 select-none outline-none focus-visible:ring-2 focus-visible:ring-violet-400 ${
                      isSelected
                        ? "text-white font-bold"
                        : "text-slate-400 hover:text-slate-200 hover:bg-white/[0.04]"
                    }`}
                  >
                    {isSelected && (
                      <motion.div
                        layoutId="my-courses-segmented-dock"
                        className="absolute inset-0 rounded-xl bg-gradient-to-b from-white/[0.18] via-white/[0.08] to-transparent border border-white/20 border-t-white/35 shadow-[0_4px_16px_rgba(0,0,0,0.45),0_1px_2px_rgba(0,0,0,0.3),inset_0_1px_1px_rgba(255,255,255,0.25)] backdrop-blur-md"
                        transition={{ type: "spring", stiffness: 450, damping: 35 }}
                      />
                    )}
                    <span className="relative z-10 tracking-tight">{item.label}</span>
                    {!loading && !error && (
                      <span
                        className={`relative z-10 inline-flex items-center justify-center px-2 py-0.5 rounded-full text-[11px] font-bold tabular-nums transition-colors duration-200 ${
                          isSelected
                            ? "bg-violet-400/25 text-violet-200 border border-violet-400/40 shadow-[0_0_10px_rgba(167,139,250,0.3)]"
                            : "bg-white/5 text-slate-400 border border-white/5"
                        }`}
                      >
                        {groups[item.id].length}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Actions: Browse button & Refresh */}
            <div className="flex items-center gap-3 ml-auto">
              {!loading && !error && enrolledCourses.length > 0 && (
                <Link
                  className="inline-flex items-center gap-2 h-[46px] px-4 sm:px-5 rounded-2xl bg-gradient-to-r from-violet-600 via-indigo-600 to-violet-500 text-white shadow-[0_4px_16px_rgba(124,58,237,0.35)] hover:brightness-110 active:scale-95 text-xs sm:text-sm font-bold transition-all group"
                  to="/courses"
                >
                  <span>Khám phá khóa học</span>
                  <span className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5">
                    <ArrowUpRight size={13} aria-hidden="true" />
                  </span>
                </Link>
              )}

              <motion.button
                type="button"
                className="relative flex items-center justify-center h-[46px] w-[46px] rounded-2xl border border-white/15 bg-gradient-to-b from-[#1c183d]/85 via-[#14122e]/90 to-[#0e0c24]/95 shadow-[0_8px_32px_rgba(5,3,20,0.5),inset_0_1px_1px_rgba(255,255,255,0.12)] backdrop-blur-2xl text-violet-300 hover:text-white hover:border-violet-400/40 hover:shadow-[0_8px_32px_rgba(5,3,20,0.5),0_0_16px_rgba(167,139,250,0.25)] transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed group shrink-0"
                onClick={loadData}
                disabled={loading}
                aria-label="Tải lại khóa học"
                title="Tải lại khóa học"
                whileHover={{ scale: 1.06 }}
                whileTap={{ scale: 0.94 }}
              >
                <RefreshCw
                  size={17}
                  className={`transition-transform duration-500 ${loading ? "animate-spin" : "group-hover:rotate-180"}`}
                  aria-hidden="true"
                />
              </motion.button>
            </div>
          </motion.div>

          {/* Content Area */}
          <section key={tab} id="my-courses-panel" role="tabpanel" aria-labelledby={`my-courses-tab-${tab}`} aria-busy={loading} tabIndex={0}>
            {loading && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6" role="status">
                <span className="sr-only">Đang tải khóa học…</span>
                {[0, 1, 2].map((index) => <CourseSkeleton key={index} />)}
              </div>
            )}

            {!loading && error && (
              <div className="flex items-center justify-between p-5 rounded-2xl bg-rose-950/30 border border-rose-500/30 text-rose-200" role="alert">
                <div className="flex items-center gap-3">
                  <AlertCircle size={20} className="text-rose-400 shrink-0" aria-hidden="true" />
                  <p className="text-sm font-medium">{error}</p>
                </div>
                <button
                  type="button"
                  className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-bold text-white transition-colors"
                  onClick={loadData}
                >
                  Thử lại
                </button>
              </div>
            )}

            {!loading && !error && filtered.length === 0 && (
              <motion.div
                className="flex min-h-[360px] flex-col items-center justify-center p-12 text-center rounded-2xl border border-white/10 bg-gradient-to-b from-[#181538]/50 via-[#13112c]/60 to-[#0e0c22]/70 shadow-lg backdrop-blur-xl"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.35, ease: "easeOut" }}
              >
                <span className="w-16 h-16 rounded-full bg-violet-500/15 border border-violet-400/30 flex items-center justify-center text-violet-300 mb-4 shadow-[0_0_20px_rgba(124,58,237,0.25)]">
                  <BookOpen size={28} strokeWidth={1.6} aria-hidden="true" />
                </span>
                <h2 className="text-xl font-bold text-white mb-2">{emptyState.title}</h2>
                <p className="text-sm text-slate-300 max-w-md leading-relaxed">{emptyState.description}</p>
                {enrolledCourses.length === 0 ? (
                  <Link
                    className="inline-flex items-center gap-2 mt-6 px-5 py-2.5 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 text-white text-xs font-bold shadow-md hover:brightness-110 transition-all"
                    to="/courses"
                  >
                    <span>Khám phá khóa học</span>
                    <ArrowUpRight size={15} aria-hidden="true" />
                  </Link>
                ) : tab !== "all" && (
                  <button
                    type="button"
                    className="mt-6 px-4 py-2.5 rounded-xl border border-white/15 bg-white/5 hover:bg-white/10 text-xs font-bold text-slate-200 transition-all"
                    onClick={() => {
                      setTab("all");
                      document.getElementById("my-courses-tab-all")?.focus();
                    }}
                  >
                    Xem tất cả khóa học
                  </button>
                )}
              </motion.div>
            )}

            {!loading && !error && filtered.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filtered.map((item, index) => (
                  <CourseCard key={item.id} item={item} index={index} />
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
