import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useNavigate } from "react-router";
import { motion, AnimatePresence, useInView, animate, useMotionValue, useTransform } from "motion/react";
import {
  BookOpen,
  PlayCircle,
  CheckCircle2,
  Clock,
  ArrowRight,
  GraduationCap,
  Sparkles,
  TrendingUp,
  Trophy,
  Flame,
} from "lucide-react";
import { enrollmentApi } from "../../api/enrollmentApi.js";
import { toastApiError } from "../../utils/shared/apiToast.js";
import { normalizeCourseStats } from "../../utils/course/courseStats.js";
import { enrollmentAccessGranted } from "../../utils/course/enrollmentAccess.js";
import { mediaSrc, DEFAULT_COURSE_THUMB, avatarSrc } from "../../utils/shared/mediaUrl.js";
import { ImageWithFallback } from "../../components/figma/ImageWithFallback";
import { MentorPageShell } from "../../components/mentor/MentorPageShell";
import { CUSTOMER_SHELL_GUTTER, CUSTOMER_SHELL_MAX } from "../../components/layout/customerShellLayout";

/* ── Animated counter ────────────────────────────────── */
function CountUp({ to, suffix = "", duration = 1.1 }) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true });
  const count = useMotionValue(0);
  const rounded = useTransform(count, (v) => Math.round(v));
  const display = useTransform(rounded, (v) => `${v}${suffix}`);

  useEffect(() => {
    if (!inView) return;
    const ctrl = animate(count, to, { duration, ease: "easeOut" });
    return ctrl.stop;
  }, [inView, to, duration, count]);

  return <motion.span ref={ref}>{display}</motion.span>;
}

/* ── Animated progress bar ───────────────────────────── */
function ProgressBar({ pct, completed }) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true });
  const value = Math.min(100, Math.max(0, Number(pct) || 0));

  return (
    <div ref={ref} className="space-y-1.5">
      <div className="flex items-center justify-between text-[11px] font-semibold">
        <span className={completed ? "text-emerald-600" : "text-slate-500"}>
          {completed ? "Đã hoàn thành" : "Tiến độ học"}
        </span>
        <span className={`tabular-nums ${completed ? "text-emerald-700" : "text-[#8037f4]"}`}>{value}%</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-violet-100/80">
        <motion.div
          className={`h-full rounded-full ${
            completed
              ? "bg-gradient-to-r from-emerald-400 to-emerald-600"
              : "bg-gradient-to-r from-violet-400 to-[#8037f4]"
          }`}
          initial={{ width: 0 }}
          animate={inView ? { width: `${Math.max(value, value > 0 ? 4 : 0)}%` } : { width: 0 }}
          transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1], delay: 0.1 }}
        />
      </div>
    </div>
  );
}

/* ── Course card ─────────────────────────────────────── */
function CourseCard({ item, onContinue, onDetails, index }) {
  const { course, progressPct, isCompleted, hasPaidAccess } = item;
  const description =
    course.description?.trim() ||
    `Khóa học từ ${course.mentorName || "mentor"} — học theo lộ trình video ngắn, dễ áp dụng.`;

  return (
    <motion.article
      onClick={onDetails}
      className="group relative flex cursor-pointer flex-col overflow-hidden rounded-[2rem] border border-white/80 bg-white/60 backdrop-blur-2xl shadow-[0_8px_30px_rgb(0,0,0,0.04)]"
      initial={{ opacity: 0, y: 40 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.12 }}
      transition={{ duration: 0.45, delay: (index % 3) * 0.1, ease: [0.16, 1, 0.3, 1] }}
      whileHover={{ y: -8, boxShadow: "0 24px 48px rgba(128,55,244,0.12)", borderColor: "rgba(237,233,254,1)", backgroundColor: "rgba(255,255,255,0.95)" }}
    >
      {/* Thumbnail */}
      <div className="relative aspect-video w-full overflow-hidden bg-violet-50">
        <ImageWithFallback
          src={course.thumbnail}
          alt=""
          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-slate-900/60 via-slate-900/10 to-transparent" />

        {/* Status badge */}
        {isCompleted ? (
          <motion.span
            className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-full bg-emerald-500 px-2.5 py-1 text-[10px] font-black uppercase tracking-wide text-white shadow-md"
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", stiffness: 400, damping: 20, delay: 0.2 }}
          >
            <CheckCircle2 className="size-3" />
            Hoàn thành
          </motion.span>
        ) : progressPct > 0 ? (
          <span className="absolute left-3 top-3 rounded-full bg-white/95 px-2.5 py-1 text-[10px] font-black text-[#8037f4] shadow-sm">
            {progressPct}%
          </span>
        ) : null}

        {/* Mentor info overlay */}
        <div className="absolute bottom-3 left-3 right-3 flex items-center gap-2">
          {course.mentorAvatar ? (
            <img src={course.mentorAvatar} alt="" className="size-8 rounded-full border-2 border-white object-cover shadow-sm" />
          ) : (
            <div className="flex size-8 items-center justify-center rounded-full border-2 border-white bg-violet-600 text-xs font-bold text-white shadow-sm">
              {(course.mentorName || "M").charAt(0).toUpperCase()}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate text-[11px] font-bold text-white drop-shadow-sm">{course.mentorName}</p>
            <p className="flex items-center gap-1 text-[10px] font-medium text-white/90">
              <Clock className="size-3" />
              {course.lessonsCount} bài học
            </p>
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="flex flex-1 flex-col p-5">
        <h3 className="line-clamp-2 text-base font-black leading-snug text-slate-900 transition-colors duration-200 group-hover:text-[#8037f4]">
          {course.title}
        </h3>
        <p className="mt-2 line-clamp-2 flex-1 text-xs leading-relaxed text-slate-500">{description}</p>

        <div className="mt-4">
          <ProgressBar pct={progressPct} completed={isCompleted} />
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          {hasPaidAccess ? (
            <motion.button
              type="button"
              onClick={(e) => { e.stopPropagation(); onContinue(); }}
              className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-2xl bg-[#a3e635] px-4 py-2.5 text-xs font-bold text-slate-900 shadow-[0_4px_14px_rgba(163,230,53,0.3)]"
              whileHover={{ scale: 1.03, backgroundColor: "#84cc16" }}
              whileTap={{ scale: 0.94 }}
              transition={{ type: "spring", stiffness: 380, damping: 22 }}
            >
              <PlayCircle className="size-4 shrink-0" />
              {isCompleted ? "Xem lại" : progressPct > 0 ? "Tiếp tục học" : "Bắt đầu học"}
            </motion.button>
          ) : null}
          <motion.button
            type="button"
            onClick={(e) => { e.stopPropagation(); onDetails(); }}
            className={`inline-flex items-center justify-center gap-1 rounded-2xl border border-violet-200 bg-violet-50/50 px-4 py-2.5 text-xs font-bold text-[#8037f4] hover:bg-violet-100/50 ${hasPaidAccess ? "" : "flex-1"}`}
            whileHover={{ scale: 1.02, borderColor: "#a78bfa", backgroundColor: "#f5f3ff" }}
            whileTap={{ scale: 0.97 }}
            transition={{ type: "spring", stiffness: 380, damping: 22 }}
          >
            Chi tiết
            <ArrowRight className="size-3.5" />
          </motion.button>
        </div>
      </div>
    </motion.article>
  );
}

/* ── Stat card ───────────────────────────────────────── */
const STATS_META = [
  { key: "total",     label: "Khóa đã mua",       icon: BookOpen,    suffix: "",  from: "from-violet-50",  ring: "ring-violet-50", icon_color: "text-[#8037f4]",  bg: "bg-violet-100/70" },
  { key: "completed", label: "Đã hoàn thành",      icon: Trophy,      suffix: "",  from: "from-emerald-50", ring: "ring-emerald-50", icon_color: "text-emerald-600",bg: "bg-emerald-100/70" },
  { key: "remaining", label: "Đang học",            icon: Flame,       suffix: "",  from: "from-amber-50",   ring: "ring-amber-50",  icon_color: "text-amber-500",  bg: "bg-amber-100/70" },
  { key: "avgPct",    label: "Tiến độ trung bình", icon: TrendingUp,  suffix: "%", from: "from-sky-50",     ring: "ring-sky-50",    icon_color: "text-sky-600",    bg: "bg-sky-100/70" },
];

function StatCard({ meta, value, index }) {
  const Icon = meta.icon;
  return (
    <motion.div
      className="group relative overflow-hidden rounded-[2rem] border border-white/80 bg-white/70 p-6 backdrop-blur-2xl shadow-[0_8px_30px_rgb(0,0,0,0.04)]"
      initial={{ opacity: 0, y: 28, scale: 0.95 }}
      whileInView={{ opacity: 1, y: 0, scale: 1 }}
      viewport={{ once: true }}
      transition={{ duration: 0.4, delay: index * 0.08, ease: [0.16, 1, 0.3, 1] }}
    >
      <div className={`absolute -right-8 -top-8 h-32 w-32 rounded-full opacity-20 blur-3xl transition-transform duration-500 group-hover:scale-150 ${meta.bg}`} />
      <div className="relative z-10 flex items-center gap-5">
        <motion.div
          className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl ${meta.bg} ring-4 ${meta.ring} shadow-sm`}
          initial={{ scale: 0, rotate: -20 }}
          whileInView={{ scale: 1, rotate: 0 }}
          viewport={{ once: true }}
          transition={{ type: "spring", stiffness: 350, damping: 18, delay: index * 0.08 + 0.15 }}
        >
          <Icon className={`h-7 w-7 ${meta.icon_color}`} strokeWidth={2} />
        </motion.div>
        <div>
          <p className="text-[11px] font-black uppercase tracking-widest text-slate-400">{meta.label}</p>
          <p className={`mt-1 text-3xl font-black tabular-nums leading-none tracking-tight ${meta.icon_color}`}>
            <CountUp to={value} suffix={meta.suffix} />
          </p>
        </div>
      </div>
    </motion.div>
  );
}

/* ── Skeleton loader ─────────────────────────────────── */
function SkeletonCard() {
  return (
    <div className="overflow-hidden rounded-3xl border border-violet-100 bg-white shadow-sm">
      <div className="aspect-video w-full animate-pulse bg-violet-100/60" />
      <div className="p-5 space-y-3">
        <div className="h-4 w-3/4 animate-pulse rounded-full bg-violet-100/60" />
        <div className="h-3 w-full animate-pulse rounded-full bg-slate-100" />
        <div className="h-3 w-2/3 animate-pulse rounded-full bg-slate-100" />
        <div className="mt-4 h-2 w-full animate-pulse rounded-full bg-violet-100/50" />
        <div className="mt-3 h-9 w-full animate-pulse rounded-2xl bg-violet-100/60" />
      </div>
    </div>
  );
}

/* ── Empty state ─────────────────────────────────────── */
function EmptyCourses({ onBrowse }) {
  return (
    <motion.div
      className="flex flex-col items-center justify-center px-4 py-20 text-center"
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
    >
      <motion.div
        className="relative mb-8 flex h-44 w-44 items-center justify-center"
        animate={{ y: [0, -8, 0] }}
        transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
      >
        <div className="absolute inset-0 rounded-full bg-gradient-to-br from-violet-100 to-violet-50" />
        <motion.div
          className="absolute -right-2 top-4 flex size-11 items-center justify-center rounded-2xl bg-[#8037f4] text-white shadow-lg"
          animate={{ rotate: [0, 12, -8, 0] }}
          transition={{ duration: 2.5, repeat: Infinity, delay: 0.5 }}
        >
          <Sparkles className="size-5" />
        </motion.div>
        <div className="relative flex size-28 items-center justify-center rounded-3xl border-2 border-dashed border-violet-200 bg-white shadow-md">
          <GraduationCap className="size-14 text-violet-300" strokeWidth={1.25} />
        </div>
      </motion.div>
      <h2 className="font-headline text-xl font-black text-slate-900 sm:text-2xl">Bạn chưa mua khóa học nào</h2>
      <p className="mt-2 max-w-md text-sm leading-relaxed text-slate-500">
        Khám phá khóa học từ mentor — luyện kỹ năng phỏng vấn, CV và soft skills theo lộ trình video ngắn.
      </p>
      <motion.button
        type="button"
        onClick={onBrowse}
        className="mt-8 inline-flex items-center gap-2 rounded-2xl bg-[#a3e635] px-8 py-3.5 text-sm font-bold text-slate-900 shadow-[0_8px_24px_rgba(163,230,53,0.35)]"
        whileHover={{ scale: 1.05, backgroundColor: "#84cc16" }}
        whileTap={{ scale: 0.95 }}
        transition={{ type: "spring", stiffness: 360, damping: 24 }}
      >
        <BookOpen className="size-4" />
        Khám phá khóa học
      </motion.button>
    </motion.div>
  );
}

/* ── Main page ───────────────────────────────────────── */
export function MyCourses() {
  const navigate = useNavigate();
  const [enrolledCourses, setEnrolledCourses] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await enrollmentApi.getMyEnrollments();
      if (res.success) {
        const mapped = res.enrollments
          .filter((e) => e.courseId)
          .map((e) => {
            const c = e.courseId;
            const lessons = (c.modules || []).flatMap((module) =>
              (module.lessons || []).map((lesson) => ({
                id: String(lesson._id),
                title: lesson.title,
                duration: lesson.durationMinutes || 0,
              })),
            );
            const completedLessonIds = (e.completedLessons || []).map((id) => String(id));
            const totalCount = lessons.length || c.totalLessons || 1;
            const pct = Math.round((completedLessonIds.length / totalCount) * 100);
            const { rating } = normalizeCourseStats(c.stats);
            return {
              course: {
                id: c._id,
                title: c.title,
                description: c.description || c.shortDescription || "",
                thumbnail: mediaSrc(c.thumbnail, DEFAULT_COURSE_THUMB),
                mentorName: c.mentorId?.userId?.name || "Mentor",
                mentorAvatar: avatarSrc(c.mentorId?.userId?.avatar),
                rating,
                lessonsCount: totalCount,
                lessons,
              },
              progressPct: pct,
              isCompleted: pct === 100,
              hasPaidAccess: enrollmentAccessGranted(e),
              coursePrice: Number(c.price ?? 0),
            };
          });
        setEnrolledCourses(mapped);
      } else {
        toastApiError(res.error, "Không thể tải danh sách khóa học.");
      }
    } catch {
      toastApiError("Lỗi kết nối khi tải khóa học của bạn.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const summary = useMemo(() => {
    const total = enrolledCourses.length;
    const completed = enrolledCourses.filter((c) => c.isCompleted).length;
    const remaining = total - completed;
    const avgPct =
      total > 0
        ? Math.round(enrolledCourses.reduce((sum, c) => sum + c.progressPct, 0) / total)
        : 0;
    return { total, completed, remaining, avgPct };
  }, [enrolledCourses]);

  return (
    <div className="flex h-full min-h-screen flex-col">
      <MentorPageShell>
        <div className={`${CUSTOMER_SHELL_GUTTER} pb-24 pt-12 relative`}>
        {/* Premium Top Glow */}
        <div className="absolute left-1/2 top-0 -z-10 h-[300px] w-full max-w-4xl -translate-x-1/2 rounded-full bg-violet-300/20 blur-[100px] pointer-events-none" />

        <div className={`${CUSTOMER_SHELL_MAX} w-full`}>

          {/* ── Header ── */}
          <div className="mb-10 flex flex-col gap-4">
            <motion.h1
              className="py-2 leading-relaxed text-4xl font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-violet-700 to-indigo-600 sm:text-5xl"
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.08, ease: [0.16, 1, 0.3, 1] }}
            >
              Khóa học của bạn
            </motion.h1>
            <motion.p
              className="mt-1 max-w-xl text-sm font-medium text-slate-500"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45, delay: 0.2 }}
            >
              Tiếp tục xem lại bài cũ và theo dõi tiến độ trong các khóa đã mua.
            </motion.p>
          </div>

          {/* ── Stat cards ── */}
          {!loading && enrolledCourses.length > 0 && (
            <div className="mb-12 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 lg:gap-6">
              {STATS_META.map((meta, i) => (
                <StatCard
                  key={meta.key}
                  meta={meta}
                  value={summary[meta.key]}
                  index={i}
                />
              ))}
            </div>
          )}

          {/* ── Course grid ── */}
          <AnimatePresence mode="wait">
            {loading ? (
              <motion.div
                key="loading"
                className="grid grid-cols-1 gap-5 min-[720px]:grid-cols-2 min-[1100px]:grid-cols-3 min-[1100px]:gap-6"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                {[...Array(6)].map((_, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.07 }}
                  >
                    <SkeletonCard />
                  </motion.div>
                ))}
              </motion.div>
            ) : enrolledCourses.length === 0 ? (
              <EmptyCourses key="empty" onBrowse={() => navigate("/courses")} />
            ) : (
              <motion.div
                key="grid"
                className="grid grid-cols-1 gap-5 min-[720px]:grid-cols-2 min-[1100px]:grid-cols-3 min-[1100px]:gap-6"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.2 }}
              >
                {enrolledCourses.map((item, index) => (
                  <CourseCard
                    key={item.course.id}
                    item={item}
                    index={index}
                    onContinue={() => navigate(`/courses/${item.course.id}/learn`)}
                    onDetails={() => navigate(`/courses/${item.course.id}`)}
                  />
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
      </MentorPageShell>
    </div>
  );
}
