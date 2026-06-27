import { useState, useEffect, useCallback, forwardRef, useMemo } from "react";
import { useNavigate } from "react-router";
import { motion, AnimatePresence } from "motion/react";
import {
  Plus,
  Search,
  BookOpen,
  Users,
  Star,
  Trash2,
  ArrowRight,
  ImageIcon,
} from "lucide-react";
import { toast } from "sonner";
import { toastApiError, toastApiSuccess } from "../../utils/shared/apiToast.js";
import { getUser } from "../../utils/auth/auth.js";
import { MentorPageShell } from "../../components/mentor/MentorPageShell";
import { MentorStatPanel, MentorStatFrame, MentorStatMiniGrid } from "../../components/mentor/MentorStatFrames";
import { ArchiveCourseDialog } from "../../components/courses/ArchiveCourseDialog";
import { archiveCourse, fetchMyMentorCourses } from "../../api/courseApi.js";
import { mapCourseAdminModerationNote } from "../../utils/admin/courseAdminReview.js";
import { mediaSrc, DEFAULT_COURSE_THUMB } from "../../utils/shared/mediaUrl.js";
import { normalizeCourseStats } from "../../utils/course/courseStats.js";
import { MentorListExpandButton } from "../../components/mentor/MentorListExpandButton.jsx";
import { useMentorListExpand } from "../../hooks/useMentorListExpand.js";
import { MentorScrollFadeRow } from "../../components/mentor/MentorScrollFadeRow.jsx";

const STATUS_LABELS = {
  published: "Đã đăng",
  pending_review: "Chờ duyệt mới",
  pending_update: "Chờ duyệt cập nhật",
  draft: "Bản nháp",
  archived: "Đã lưu trữ",
};

const LEVEL_LABELS = {
  basic: "Cơ bản",
  intermediate: "Trung cấp",
  advanced: "Nâng cao",
};

const FILTER_TABS = [
  "all",
  "published",
  "pending_review",
  "pending_update",
  "draft",
  "archived",
];

const THUMB_LABELS = {
  Technical: "TECH",
  Behavioral: "BEHAVIORAL",
  Other: "CAREER",
  Resume: "CV",
  Negotiation: "NEGOTIATION",
  Bootcamp: "BOOTCAMP",
};

const THUMB_GRADIENTS = [
  "from-[#8037f4] to-[#6d28d9]",
  "from-slate-500 to-slate-700",
  "from-teal-500 to-cyan-700",
  "from-emerald-500 to-green-700",
  "from-orange-500 to-amber-600",
  "from-violet-500 to-indigo-700",
];

function formatCourseLevel(level) {
  const key = String(level || "").toLowerCase();
  return LEVEL_LABELS[key] || "Chưa rõ";
}

function getThumbLabel(course) {
  if (course.status === "draft") return "DRAFT";
  if (course.status === "archived") return "ARCHIVE";
  const topic = course.topicRaw || "";
  if (THUMB_LABELS[topic]) return THUMB_LABELS[topic];
  if (topic) return topic.slice(0, 14).toUpperCase();
  const tag = course.tags?.[0];
  if (tag) return String(tag).slice(0, 14).toUpperCase();
  return "COURSE";
}

function mapCourseRow(c) {
  const { rating, reviewsCount } = normalizeCourseStats(c?.stats);
  const thumb = String(c?.thumbnail || "").trim();
  return {
    id: c._id,
    title: c.title,
    status: c.status || "draft",
    adminModerationNote: mapCourseAdminModerationNote(c),
    students: c.stats?.enrollmentCount || 0,
    rating: rating ?? 0,
    reviewsCount,
    cover: mediaSrc(c.thumbnail, DEFAULT_COURSE_THUMB),
    hasCustomThumb: Boolean(thumb),
    level: formatCourseLevel(c.level),
    topicRaw: c.topics?.[0] || "",
    tags: c.tags || [],
  };
}

function weightedAvgRatingFromCourses(courses) {
  const active = (courses || []).filter((c) => c.status !== "archived");
  let weighted = 0;
  let totalReviews = 0;
  for (const c of active) {
    const n = Number(c.reviewsCount) || 0;
    const r = c.rating;
    if (n > 0 && r != null && Number.isFinite(Number(r)) && Number(r) > 0) {
      weighted += Number(r) * n;
      totalReviews += n;
    }
  }
  if (!totalReviews) return null;
  return Number((weighted / totalReviews).toFixed(1));
}

const statusBadgeStyle = {
  published: "bg-[#93f72b]/30 text-slate-800 ring-1 ring-[#93f72b]/50",
  pending_review: "bg-amber-50 text-amber-800 ring-1 ring-amber-200",
  pending_update: "bg-sky-50 text-sky-800 ring-1 ring-sky-200",
  draft: "bg-slate-100 text-slate-600 ring-1 ring-slate-200",
  archived: "bg-zinc-100 text-zinc-600 ring-1 ring-zinc-200",
};

const COURSE_ROW_STYLES = `
  @keyframes mentor-course-row-pulse {
    0% { transform: scale3d(1, 1, 1); }
    50% { transform: scale3d(1.018, 1.018, 1.018); }
    100% { transform: scale3d(1, 1, 1); }
  }
  .mentor-course-row {
    transform-origin: center center;
    transition: background-color 0.2s ease, box-shadow 0.2s ease, transform 0.15s ease;
  }
  @media (hover: hover) and (pointer: fine) {
    .mentor-course-row:hover {
      background-color: rgba(248, 250, 252, 0.95);
      box-shadow: 0 4px 18px rgba(15, 23, 42, 0.07);
      animation: mentor-course-row-pulse 0.9s ease-in-out;
    }
  }
  .mentor-course-row:active {
    background-color: rgba(248, 250, 252, 0.95);
    transform: scale(0.992);
  }
  @media (prefers-reduced-motion: reduce) {
    .mentor-course-row:hover,
    .mentor-course-row:active {
      animation: none;
      transform: none;
    }
  }
`;

const listContainerMotion = {
  hidden: { opacity: 1 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.09,
      delayChildren: 0.06,
    },
  },
};

const listRowMotion = {
  hidden: {
    opacity: 0,
    y: 36,
    scale: 0.9,
  },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      type: "spring",
      stiffness: 320,
      damping: 22,
      mass: 0.85,
    },
  },
  exit: {
    opacity: 0,
    y: -8,
    scale: 0.96,
    transition: { duration: 0.2, ease: "easeIn" },
  },
};

function pickFeaturedCourse(courses) {
  const pool = (courses || []).filter((c) => c.status !== "archived");
  if (!pool.length) return null;
  const published = pool.filter((c) => c.status === "published");
  const candidates = published.length ? published : pool;
  return [...candidates].sort((a, b) => {
    const studentsDiff = Number(b.students || 0) - Number(a.students || 0);
    if (studentsDiff !== 0) return studentsDiff;
    return Number(b.rating || 0) - Number(a.rating || 0);
  })[0];
}

function FeaturedCourseSpotlight({ course, onOpen, onEdit }) {
  const statusLabel = STATUS_LABELS[course.status] || "Bản nháp";
  const badgeCls = statusBadgeStyle[course.status] || statusBadgeStyle.draft;
  const canEdit = course.status !== "archived";

  return (
    <motion.section
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
      className="mb-6 overflow-hidden rounded-2xl border border-slate-200/90 bg-white p-4 shadow-[0_1px_3px_rgba(15,23,42,0.04)] sm:p-6"
    >
      <p className="mb-4 text-sm font-bold uppercase tracking-[0.12em] text-[#8037f4] sm:mb-5 sm:text-[11px] sm:tracking-[0.16em]">
        Khóa học nổi bật
      </p>
      <div className="flex flex-col gap-5 lg:flex-row lg:items-stretch lg:gap-6">
        <div className="lg:w-[42%]">
          {course.hasCustomThumb ? (
            <div className="h-44 overflow-hidden rounded-xl bg-slate-100 sm:h-[220px] lg:h-[240px]">
              <img
                src={course.cover}
                alt=""
                className="h-full w-full object-cover"
              />
            </div>
          ) : (
            <div className="flex h-44 flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-slate-200 bg-slate-50 px-4 text-center sm:h-[220px] lg:h-[240px]">
              <ImageIcon size={32} className="text-slate-300" strokeWidth={1.5} />
              <p className="max-w-[220px] text-sm leading-relaxed text-slate-400 sm:text-xs">
                Thả ảnh bìa khóa học hoặc chọn tệp
              </p>
            </div>
          )}
        </div>

        <div className="flex min-w-0 flex-1 flex-col justify-center">
          <h2 className="font-headline text-lg font-black leading-snug text-slate-900 sm:text-xl lg:text-2xl">
            {course.title}
          </h2>
          <div className="mt-4 flex flex-wrap gap-6 sm:mt-5 sm:gap-8 lg:gap-10">
            <div>
              <p className="mentor-stat-num font-headline text-2xl font-black text-slate-900 sm:text-3xl">
                {Number(course.students || 0).toLocaleString("vi-VN")}
              </p>
              <p className="mt-0.5 text-sm font-medium text-slate-500 sm:text-xs">Học viên</p>
            </div>
            <div>
              <p className="mentor-stat-num font-headline text-2xl font-black text-slate-900 sm:text-3xl">
                {course.rating > 0 ? course.rating.toFixed(1) : "—"}
              </p>
              <p className="mt-0.5 text-sm font-medium text-slate-500 sm:text-xs">Đánh giá</p>
            </div>
          </div>
          <div className="mt-4">
            <span className={`inline-block rounded-full px-3 py-1 text-xs font-bold sm:text-[11px] ${badgeCls}`}>
              {statusLabel}
            </span>
          </div>
          <div className="mt-5 flex flex-col gap-2.5 sm:mt-6 sm:flex-row sm:flex-wrap sm:gap-3">
            <button
              type="button"
              onClick={() => onOpen(course)}
              className="inline-flex min-h-[44px] w-full items-center justify-center rounded-full bg-slate-900 px-5 py-2.5 text-base font-bold text-white transition hover:bg-[#8037f4] sm:w-auto sm:text-sm"
            >
              Mở khóa học
            </button>
            <button
              type="button"
              onClick={() => onEdit(course)}
              disabled={!canEdit}
              className="inline-flex min-h-[44px] w-full items-center justify-center rounded-full border border-slate-300 bg-white px-5 py-2.5 text-base font-bold text-slate-900 transition hover:border-slate-400 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 sm:w-auto sm:text-sm"
            >
              Chỉnh sửa
            </button>
          </div>
        </div>
      </div>
    </motion.section>
  );
}

const CourseListRow = forwardRef(function CourseListRow({ course, index, onEdit, onArchive }, ref) {
  const statusLabel = STATUS_LABELS[course.status] || "Bản nháp";
  const badgeCls = statusBadgeStyle[course.status] || statusBadgeStyle.draft;
  const gradient = THUMB_GRADIENTS[index % THUMB_GRADIENTS.length];
  const thumbLabel = getThumbLabel(course);
  const canEdit = course.status !== "archived";

  const thumbInner = course.hasCustomThumb ? (
    <img src={course.cover} alt="" className="h-full w-full object-cover" />
  ) : (
    <>
      <div
        className="absolute inset-0 opacity-20"
        style={{
          backgroundImage:
            "repeating-linear-gradient(-45deg, transparent, transparent 8px, rgba(255,255,255,0.2) 8px, rgba(255,255,255,0.2) 16px)",
        }}
        aria-hidden
      />
      <div className="absolute inset-0 flex items-center justify-center p-2">
        <span className="text-center text-xs font-black uppercase leading-tight tracking-wide text-white sm:text-[10px]">
          {thumbLabel}
        </span>
      </div>
    </>
  );

  return (
    <motion.div
      ref={ref}
      layout
      initial="hidden"
      animate="visible"
      variants={listRowMotion}
      exit="exit"
      transition={{ layout: { duration: 0.28, ease: [0.22, 1, 0.36, 1] } }}
      className="max-lg:px-1 lg:border-b lg:border-slate-100 lg:last:border-b-0"
    >
      {/* ── Mobile: card ── */}
      <div className="mentor-course-row group overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-[0_2px_12px_rgba(15,23,42,0.05)] lg:hidden">
        <div
          className={`relative h-36 w-full overflow-hidden ${
            course.hasCustomThumb ? "bg-slate-100" : `bg-gradient-to-br ${gradient}`
          }`}
        >
          {thumbInner}
        </div>
        <div className="p-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${badgeCls}`}>
              {statusLabel}
            </span>
            <span className="text-sm font-medium text-slate-500">{course.level}</span>
          </div>
          <h3 className="mt-2.5 line-clamp-2 text-base font-bold leading-snug text-slate-900">
            {course.title}
          </h3>
          {course.adminModerationNote ? (
            <p
              className={`mt-2 text-sm leading-relaxed ${
                course.adminModerationNote.tone === "amber" ? "text-amber-700" : "text-red-600"
              }`}
            >
              {course.adminModerationNote.title}: {course.adminModerationNote.reason}
            </p>
          ) : null}
          <div className="mt-4 grid grid-cols-2 gap-2.5">
            <div className="rounded-xl bg-slate-50 px-3 py-2.5">
              <div className="flex items-center gap-1.5 text-slate-500">
                <Users size={15} className="text-[#8037f4]" strokeWidth={2} />
                <span className="text-xs font-semibold">Học viên</span>
              </div>
              <p className="mentor-stat-num mt-1 text-xl text-slate-900">
                {Number(course.students || 0).toLocaleString("vi-VN")}
              </p>
            </div>
            <div className="rounded-xl bg-slate-50 px-3 py-2.5">
              <div className="flex items-center gap-1.5 text-slate-500">
                <Star size={15} className="fill-amber-400 text-amber-400" strokeWidth={2} />
                <span className="text-xs font-semibold">Đánh giá</span>
              </div>
              <p className="mentor-stat-num mt-1 text-xl text-slate-900">
                {course.rating > 0 ? course.rating.toFixed(1) : "—"}
              </p>
            </div>
          </div>
          <div className="mt-4 flex gap-2">
            <button
              type="button"
              onClick={() => onEdit(course)}
              disabled={!canEdit}
              className={`inline-flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-xl text-sm font-bold transition active:scale-[0.98] ${
                canEdit
                  ? "bg-slate-900 text-white hover:bg-[#8037f4]"
                  : "cursor-not-allowed bg-slate-100 text-slate-400"
              }`}
            >
              Chỉnh sửa
              <ArrowRight size={16} strokeWidth={2.25} />
            </button>
            {canEdit && onArchive ? (
              <button
                type="button"
                onClick={() => onArchive(course)}
                title="Lưu trữ khóa học"
                className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-slate-200 text-slate-500 transition hover:border-red-200 hover:bg-red-50 hover:text-red-600 active:scale-95"
                aria-label="Lưu trữ khóa học"
              >
                <Trash2 size={16} />
              </button>
            ) : null}
          </div>
        </div>
      </div>

      {/* ── Desktop: table row ── */}
      <div className="mentor-course-row group relative mx-1 hidden flex-col gap-4 px-3 py-4 sm:mx-2 sm:px-4 sm:py-4 lg:flex lg:flex-row lg:items-center">
        <div
          className={`relative h-[72px] w-[72px] shrink-0 overflow-hidden rounded-xl ${
            course.hasCustomThumb ? "bg-slate-100" : `bg-gradient-to-br ${gradient}`
          }`}
        >
          {thumbInner}
        </div>

        <div className="min-w-0 flex-1 lg:pr-4">
          <h3 className="line-clamp-2 text-sm font-bold leading-snug text-slate-900 transition-colors duration-200 group-hover:text-[#8037f4] sm:text-[15px]">
            {course.title}
          </h3>
          <p className="mt-1 text-xs text-slate-500">
            {course.level}
            <span className="mx-1.5 text-slate-300">·</span>
            {statusLabel}
          </p>
          {course.adminModerationNote ? (
            <p
              className={`mt-2 text-xs leading-relaxed ${
                course.adminModerationNote.tone === "amber" ? "text-amber-700" : "text-red-600"
              }`}
            >
              {course.adminModerationNote.title}: {course.adminModerationNote.reason}
            </p>
          ) : null}
        </div>

        <div className="flex shrink-0 items-center gap-8 sm:gap-10 lg:gap-12">
          <div className="min-w-[4.5rem] text-center">
            <p className="mentor-stat-num text-lg text-slate-900">
              {Number(course.students || 0).toLocaleString("vi-VN")}
            </p>
            <p className="mt-0.5 text-[10px] font-medium text-slate-400">Học viên</p>
          </div>
          <div className="min-w-[4.5rem] text-center">
            <p className="mentor-stat-num text-lg text-slate-900">
              {course.rating > 0 ? course.rating.toFixed(1) : "—"}
            </p>
            <p className="mt-0.5 text-[10px] font-medium text-slate-400">Đánh giá</p>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2 sm:gap-3">
          <span className={`hidden rounded-lg px-3 py-1.5 text-[11px] font-bold sm:inline-block ${badgeCls}`}>
            {statusLabel}
          </span>
          {canEdit && onArchive ? (
            <button
              type="button"
              onClick={() => onArchive(course)}
              title="Lưu trữ khóa học"
              className="pointer-events-none flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-slate-200 text-slate-400 opacity-0 transition-[opacity,background-color,color] duration-200 group-hover:pointer-events-auto group-hover:opacity-100 hover:border-red-200 hover:bg-red-50 hover:text-red-600"
            >
              <Trash2 size={14} />
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => onEdit(course)}
            disabled={!canEdit}
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full border transition-[background-color,border-color,color,transform] duration-200 ${
              canEdit
                ? "border-slate-200 bg-white text-slate-600 group-hover:border-slate-900 group-hover:bg-slate-900 group-hover:text-white active:scale-95"
                : "cursor-not-allowed border-slate-100 bg-slate-50 text-slate-300"
            }`}
            aria-label={canEdit ? "Chỉnh sửa khóa học" : "Khóa học đã lưu trữ"}
          >
            <ArrowRight
              size={16}
              strokeWidth={2.25}
              className={canEdit ? "transition-transform duration-200 group-hover:translate-x-0.5" : ""}
            />
          </button>
        </div>
      </div>
    </motion.div>
  );
});

export function MentorCourseManagement() {
  const navigate = useNavigate();
  const user = getUser();
  const [activeTab, setActiveTab] = useState("all");
  const [search, setSearch] = useState("");
  const [myCourses, setMyCourses] = useState([]);
  const [courseSummary, setCourseSummary] = useState(null);
  const [archiveTarget, setArchiveTarget] = useState(null);
  const [archiving, setArchiving] = useState(false);

  const loadCourses = useCallback(() => {
    fetchMyMentorCourses().then((res) => {
      if (!res.success || !Array.isArray(res.courses)) {
        setMyCourses([]);
        setCourseSummary(null);
        if (!res.success) toastApiError(res.error, "Không tải được khóa học của bạn.");
        return;
      }
      setMyCourses(res.courses.map(mapCourseRow));
      setCourseSummary(res.summary || null);
    });
  }, []);

  useEffect(() => {
    if (!user || user.role !== "mentor") {
      navigate("/");
      return;
    }
    loadCourses();
  }, [navigate, user, loadCourses]);

  const activeCourses = useMemo(
    () => myCourses.filter((c) => c.status !== "archived"),
    [myCourses],
  );
  const featuredCourse = useMemo(() => pickFeaturedCourse(activeCourses), [activeCourses]);
  const filtered = useMemo(
    () =>
      myCourses.filter((c) => {
        const matchesTab =
          activeTab === "all" ? c.status !== "archived" : c.status === activeTab;
        const matchesSearch = c.title.toLowerCase().includes(search.toLowerCase());
        const hideFeatured =
          featuredCourse &&
          activeTab === "all" &&
          !search.trim() &&
          c.id === featuredCourse.id;
        return matchesTab && matchesSearch && !hideFeatured;
      }),
    [myCourses, activeTab, search, featuredCourse],
  );
  const {
    visibleItems: visibleCourses,
    showExpandButton: showCourseExpandButton,
    expanded: coursesExpanded,
    toggleExpanded: toggleCoursesExpanded,
  } = useMentorListExpand(filtered, `${activeTab}|${search}`);

  const handleArchiveConfirm = async (courseId) => {
    const idToArchive = courseId || archiveTarget?.id;
    if (!idToArchive) return;
    setArchiving(true);
    try {
      const res = await archiveCourse(idToArchive);
      if (!res.success) {
        toastApiError(res.error, "Không thể lưu trữ khóa học.");
        return;
      }
      toastApiSuccess(res.message || "Đã lưu trữ khóa học.");
      setArchiveTarget(null);
      loadCourses();
    } catch {
      toastApiError("Lỗi kết nối khi lưu trữ khóa học.");
    } finally {
      setArchiving(false);
    }
  };

  if (!user || user.role !== "mentor") return null;

  const totalCourses = courseSummary?.totalCourses ?? activeCourses.length;
  const totalStudents =
    courseSummary?.totalStudents ??
    activeCourses.reduce((sum, c) => sum + (Number(c.students) || 0), 0);
  const avgRatingValue =
    courseSummary?.avgRating != null && Number.isFinite(Number(courseSummary.avgRating))
      ? Number(courseSummary.avgRating)
      : weightedAvgRatingFromCourses(myCourses);
  const hasAvgRating = avgRatingValue != null && Number.isFinite(avgRatingValue);
  const avgRatingDisplay = hasAvgRating ? avgRatingValue.toFixed(1) : "—";

  return (
    <MentorPageShell bottomPad="pb-20" showAmbient={false} className="!bg-[#f8f9fc]" extraStyles={COURSE_ROW_STYLES}>
      <div className="relative z-10 mx-auto max-w-[1280px] px-3 pb-12 sm:px-6 lg:px-10">
        {/* Header */}
        <motion.header
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
          className="mb-5 flex flex-col gap-4 pt-2 sm:mb-8 lg:flex-row lg:items-start lg:justify-between"
        >
          <div>
            <h1 className="font-headline text-[clamp(1.875rem,5vw,2.75rem)] font-black leading-tight tracking-tight text-slate-900">
              Khóa học <span className="text-[#8037f4]">của tôi</span>
            </h1>
            <p className="mt-2 max-w-xl text-base text-slate-500 sm:text-sm">
              Quản lý nội dung, học viên và trạng thái duyệt.
            </p>
          </div>
          <motion.button
            type="button"
            onClick={() => navigate("/mentor/courses/new/edit")}
            whileHover={{ scale: 1.03, boxShadow: "0 12px 28px rgba(15,23,42,0.18)" }}
            whileTap={{ scale: 0.97 }}
            className="inline-flex w-full min-h-[48px] shrink-0 items-center justify-center gap-2 rounded-full bg-slate-900 px-6 py-3 text-base font-bold text-white shadow-[0_8px_20px_rgba(15,23,42,0.15)] transition hover:bg-[#8037f4] sm:w-auto sm:text-sm lg:mt-2"
          >
            <Plus size={18} strokeWidth={2.25} />
            Tạo khóa học mới
          </motion.button>
        </motion.header>

        {/* Stats — mobile: 2x2 grid; desktop: 3 cột */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, delay: 0.08, ease: [0.22, 1, 0.36, 1] }}
        >
          <MentorStatMiniGrid className="mb-6 lg:hidden">
            <MentorStatFrame
              index={1}
              compact
              accent="purple"
              value={String(totalCourses)}
              title="Tổng khóa học"
              cornerIcon={BookOpen}
            />
            <MentorStatFrame
              index={2}
              compact
              accent="lime"
              value={Number(totalStudents || 0).toLocaleString("vi-VN")}
              title="Tổng học viên"
              cornerIcon={Users}
            />
            <MentorStatFrame
              index={3}
              compact
              accent="purple"
              value={avgRatingDisplay}
              title="Đánh giá TB"
              cornerIcon={Star}
            />
            <MentorStatFrame
              index={4}
              compact
              accent="lime"
              value={String(activeCourses.length)}
              title="Đang hoạt động"
              cornerIcon={BookOpen}
            />
          </MentorStatMiniGrid>
          <MentorStatPanel className="mb-6 hidden lg:block">
            <MentorStatFrame
              index={1}
              accent="purple"
              value={String(totalCourses)}
              title="Tổng khóa học"
              cornerIcon={BookOpen}
              subtitle={
                activeCourses.length === totalCourses
                  ? "Khóa học đang quản lý"
                  : `${activeCourses.length} khóa đang hoạt động`
              }
            />
            <MentorStatFrame
              index={2}
              accent="lime"
              value={Number(totalStudents || 0).toLocaleString("vi-VN")}
              title="Tổng học viên"
              cornerIcon={Users}
              subtitle="Trên các khóa của bạn"
            />
            <MentorStatFrame
              index={3}
              accent="purple"
              value={avgRatingDisplay}
              title="Đánh giá trung bình"
              cornerIcon={Star}
              subtitle={hasAvgRating ? "Từ học viên đã học" : "Chưa có đánh giá"}
            />
          </MentorStatPanel>
        </motion.div>

        {featuredCourse && activeTab === "all" && !search.trim() ? (
          <FeaturedCourseSpotlight
            course={featuredCourse}
            onOpen={(c) => navigate(`/courses/${c.id}`)}
            onEdit={(c) => navigate(`/mentor/courses/${c.id}/edit`)}
          />
        ) : null}

        {/* Danh sách khóa học */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.12, ease: [0.22, 1, 0.36, 1] }}
          className="max-lg:space-y-3 lg:overflow-hidden lg:rounded-2xl lg:border lg:border-slate-200/90 lg:bg-white lg:shadow-[0_1px_3px_rgba(15,23,42,0.04)]"
        >
          {/* Tabs + search */}
          <div className="flex flex-col gap-4 rounded-2xl border border-slate-200/90 bg-white px-4 py-4 shadow-[0_1px_3px_rgba(15,23,42,0.04)] sm:px-6 lg:rounded-none lg:border-0 lg:border-b lg:border-slate-100 lg:shadow-none lg:flex-row lg:items-center lg:justify-between">
            <MentorScrollFadeRow innerClassName="flex gap-1" fadeFrom="from-white">
              {FILTER_TABS.map((t) => {
                const active = activeTab === t;
                return (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setActiveTab(t)}
                    className={`relative shrink-0 snap-start whitespace-nowrap px-3.5 py-2.5 text-sm sm:px-4 sm:text-sm ${
                      active
                        ? "font-bold text-slate-900"
                        : "font-medium text-slate-500 hover:text-slate-700"
                    }`}
                  >
                    {t === "all" ? "Tất cả" : STATUS_LABELS[t]}
                    {active && (
                      <motion.span
                        layoutId="mentorCourseTabUnderline"
                        className="absolute bottom-0 left-2 right-2 h-0.5 rounded-full bg-[#8037f4]"
                        transition={{ type: "spring", stiffness: 420, damping: 32 }}
                      />
                    )}
                  </button>
                );
              })}
            </MentorScrollFadeRow>
            <div className="relative w-full shrink-0 lg:w-72">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
                aria-hidden
              />
              <input
                type="search"
                placeholder="Tìm khóa học..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full min-h-[44px] rounded-xl border border-slate-200 bg-slate-50/80 py-2.5 pl-9 pr-4 text-base text-slate-900 outline-none placeholder:text-slate-400 focus:border-violet-300 focus:bg-white focus:ring-2 focus:ring-violet-100 sm:text-sm"
                aria-label="Tìm khóa học"
              />
            </div>
          </div>

          {/* Rows */}
          {filtered.length > 0 ? (
            <motion.div
              key={activeTab}
              variants={listContainerMotion}
              initial="hidden"
              animate="visible"
              className="max-lg:space-y-3 lg:overflow-hidden"
            >
              <AnimatePresence mode="popLayout" initial={false}>
                {visibleCourses.map((course, idx) => (
                  <CourseListRow
                    key={course.id}
                    course={course}
                    index={idx}
                    onEdit={(c) => navigate(`/mentor/courses/${c.id}/edit`)}
                    onArchive={(c) => setArchiveTarget({ id: c.id, title: c.title })}
                  />
                ))}
              </AnimatePresence>
              {showCourseExpandButton ? (
                <MentorListExpandButton
                  expanded={coursesExpanded}
                  onToggle={toggleCoursesExpanded}
                />
              ) : null}
            </motion.div>
          ) : (
            <motion.div
              key="empty"
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.3 }}
              className="px-6 py-16 text-center"
            >
              <motion.div
                animate={{ y: [0, -6, 0] }}
                transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
                className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100"
              >
                <ImageIcon size={24} className="text-slate-400" />
              </motion.div>
              <p className="text-sm font-semibold text-slate-700">
                {search.trim()
                  ? "Không tìm thấy khóa học phù hợp."
                  : activeTab === "archived"
                    ? "Chưa có khóa học nào được lưu trữ."
                    : "Bạn chưa có khóa học nào trong mục này."}
              </p>
              {!search.trim() && activeTab !== "archived" && (
                <motion.button
                  type="button"
                  onClick={() => navigate("/mentor/courses/new/edit")}
                  whileHover={{ x: 4 }}
                  className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-[#8037f4] hover:underline"
                >
                  <Plus size={16} />
                  Tạo khóa học mới
                </motion.button>
              )}
            </motion.div>
          )}
        </motion.div>

        {!activeCourses.length && activeTab !== "archived" && filtered.length > 0 && (
          <p className="mt-4 text-center text-xs text-slate-400">
            Gửi khóa học để admin duyệt trước khi hiển thị công khai.
          </p>
        )}
      </div>

      <ArchiveCourseDialog
        open={Boolean(archiveTarget)}
        courseTitle={archiveTarget?.title}
        archiving={archiving}
        onOpenChange={(open) => {
          if (!open && !archiving) setArchiveTarget(null);
        }}
        onConfirm={() => handleArchiveConfirm(archiveTarget?.id)}
      />
    </MentorPageShell>
  );
}
