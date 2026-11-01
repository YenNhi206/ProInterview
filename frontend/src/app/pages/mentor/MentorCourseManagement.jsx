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
  Video,
  Play,
  CheckCircle2,
  Clock,
  Sparkles,
  ExternalLink,
  Edit3,
  Layers,
  GraduationCap,
  AlertCircle,
} from "lucide-react";
import { toastApiError, toastApiSuccess } from "../../utils/shared/apiToast.js";
import { getUser } from "../../utils/auth/auth.js";
import { MentorPageShell } from "../../components/mentor/MentorPageShell";
import { ArchiveCourseDialog } from "../../components/courses/ArchiveCourseDialog";
import { archiveCourse, fetchMyMentorCourses } from "../../api/courseApi.js";
import { mapCourseAdminModerationNote } from "../../utils/admin/courseAdminReview.js";
import { mediaSrc, DEFAULT_COURSE_THUMB } from "../../utils/shared/mediaUrl.js";
import { normalizeCourseStats } from "../../utils/course/courseStats.js";
import { MentorListExpandButton } from "../../components/mentor/MentorListExpandButton.jsx";
import { useMentorListExpand } from "../../hooks/useMentorListExpand.js";

const STATUS_CONFIG = {
  published: {
    label: "Đã xuất bản",
    style: "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30",
    dot: "bg-emerald-400",
  },
  pending_review: {
    label: "Chờ duyệt mới",
    style: "bg-amber-500/10 text-amber-400 border border-amber-500/30",
    dot: "bg-amber-400",
  },
  pending_update: {
    label: "Chờ duyệt cập nhật",
    style: "bg-sky-500/10 text-sky-400 border border-sky-500/30",
    dot: "bg-sky-400",
  },
  draft: {
    label: "Bản nháp",
    style: "bg-white/[0.08] text-slate-300 border border-white/15",
    dot: "bg-slate-400",
  },
  archived: {
    label: "Đã lưu trữ",
    style: "bg-zinc-800 text-zinc-400 border border-zinc-700",
    dot: "bg-zinc-500",
  },
};

const LEVEL_LABELS = {
  basic: "Cơ bản",
  intermediate: "Trung cấp",
  advanced: "Nâng cao",
};

const FILTER_TABS = [
  { key: "all", label: "Tất cả" },
  { key: "published", label: "Đã xuất bản" },
  { key: "pending_review", label: "Chờ duyệt" },
  { key: "draft", label: "Bản nháp" },
  { key: "archived", label: "Đã lưu trữ" },
];

const THUMB_GRADIENTS = [
  "from-violet-600 via-indigo-700 to-purple-800",
  "from-slate-700 via-zinc-800 to-slate-900",
  "from-teal-600 via-emerald-700 to-cyan-800",
  "from-amber-600 via-orange-700 to-red-800",
  "from-blue-600 via-indigo-800 to-violet-900",
];

function formatCourseLevel(level) {
  const key = String(level || "").toLowerCase();
  return LEVEL_LABELS[key] || "Đa cấp độ";
}

function mapCourseRow(c) {
  const { rating, reviewsCount } = normalizeCourseStats(c?.stats);
  const thumb = String(c?.thumbnail || "").trim();
  const lessonsCount = Array.isArray(c?.chapters)
    ? c.chapters.reduce((sum, ch) => sum + (Array.isArray(ch.lessons) ? ch.lessons.length : 0), 0)
    : 0;

  return {
    id: c._id,
    title: c.title || "Khóa học chưa đặt tên",
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
    price: c.price || 0,
    lessonsCount,
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

/* ── Featured Course Spotlight Banner ────────────────────────────────────── */
function FeaturedCourseSpotlight({ course, onOpen, onEdit }) {
  const cfg = STATUS_CONFIG[course.status] || STATUS_CONFIG.draft;
  const canEdit = course.status !== "archived";

  return (
    <motion.section
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
      className="relative overflow-hidden rounded-3xl border border-white/[0.08] bg-gradient-to-r from-violet-950/30 via-[#0c0e15] to-[#0a0b10] p-6 sm:p-7 shadow-2xl backdrop-blur-xl"
    >
      <div className="pointer-events-none absolute -top-16 -right-16 h-48 w-48 rounded-full bg-violet-600/15 blur-3xl" />

      <div className="relative flex items-center justify-between gap-3 mb-5">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-violet-500/30 bg-violet-500/10 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-violet-300">
          <Sparkles size={12} className="text-violet-400" />
          Khóa học nổi bật nhất
        </span>
        <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ${cfg.style}`}>
          <span className={`h-1.5 w-1.5 rounded-full ${cfg.dot}`} />
          {cfg.label}
        </span>
      </div>

      <div className="flex flex-col gap-6 lg:flex-row lg:items-center">
        {/* Cover Thumbnail */}
        <div className="relative w-full lg:w-[320px] shrink-0 overflow-hidden rounded-2xl border border-white/10 bg-slate-900 aspect-video group">
          <img
            src={course.cover}
            alt=""
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent flex items-end p-3.5">
            <span className="inline-flex items-center gap-1 rounded-md bg-black/60 backdrop-blur-md px-2 py-0.5 text-[11px] font-medium text-slate-200">
              <Video size={12} className="text-violet-400" />
              {course.lessonsCount > 0 ? `${course.lessonsCount} bài video` : "Khóa video bài giảng"}
            </span>
          </div>
        </div>

        {/* Content & Stats */}
        <div className="flex min-w-0 flex-1 flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 text-xs font-medium text-slate-400 mb-1">
              <span>{course.level}</span>
              {course.topicRaw && (
                <>
                  <span>•</span>
                  <span>{course.topicRaw}</span>
                </>
              )}
            </div>
            <h2 className="text-xl sm:text-2xl font-extrabold tracking-tight text-white leading-snug">
              {course.title}
            </h2>
          </div>

          <div className="mt-5 grid grid-cols-2 sm:grid-cols-3 gap-4 border-t border-b border-white/[0.06] py-3.5">
            <div>
              <p className="text-xl sm:text-2xl font-black text-white tabular-nums">
                {Number(course.students || 0).toLocaleString("vi-VN")}
              </p>
              <p className="text-[11px] text-slate-400 mt-0.5">Học viên tham gia</p>
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-xl sm:text-2xl font-black text-amber-400 tabular-nums">
                  {course.rating > 0 ? course.rating.toFixed(1) : "—"}
                </span>
                {course.rating > 0 && <Star size={14} className="fill-amber-400 text-amber-400" />}
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5">
                {course.reviewsCount > 0 ? `${course.reviewsCount} lượt đánh giá` : "Chưa có đánh giá"}
              </p>
            </div>
            <div className="col-span-2 sm:col-span-1">
              <p className="text-xl sm:text-2xl font-black text-emerald-400 tabular-nums">
                {course.price > 0 ? `${Number(course.price).toLocaleString("vi-VN")} đ` : "Miễn phí"}
              </p>
              <p className="text-[11px] text-slate-400 mt-0.5">Giá học phí</p>
            </div>
          </div>

          <div className="mt-5 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => onEdit(course)}
              disabled={!canEdit}
              className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-5 py-2.5 text-xs font-bold text-white shadow-sm shadow-violet-600/30 transition hover:bg-violet-500 disabled:opacity-50"
            >
              <Video size={15} />
              <span>Chỉnh sửa &amp; Quản lý Video</span>
            </button>
            <button
              type="button"
              onClick={() => onOpen(course)}
              className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-xs font-semibold text-slate-200 transition hover:bg-white/10 hover:text-white"
            >
              <ExternalLink size={14} />
              <span>Xem trang công khai</span>
            </button>
          </div>
        </div>
      </div>
    </motion.section>
  );
}

/* ── Course List Row Component ───────────────────────────────────────────── */
const CourseListRow = forwardRef(function CourseListRow({ course, index, onEdit, onArchive }, ref) {
  const cfg = STATUS_CONFIG[course.status] || STATUS_CONFIG.draft;
  const gradient = THUMB_GRADIENTS[index % THUMB_GRADIENTS.length];
  const canEdit = course.status !== "archived";

  return (
    <motion.div
      ref={ref}
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.98 }}
      className="group relative overflow-hidden rounded-2xl border border-white/[0.08] bg-[#0c0e15] p-4 sm:p-5 transition-all duration-200 hover:border-violet-500/30 hover:bg-white/[0.02]"
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        {/* Left: Thumbnail & Main Info */}
        <div className="flex items-start gap-4 min-w-0 flex-1">
          {/* Thumbnail */}
          <div className="relative h-20 w-28 shrink-0 overflow-hidden rounded-xl border border-white/10 bg-slate-900 group-hover:border-violet-500/40 transition-colors">
            {course.hasCustomThumb ? (
              <img src={course.cover} alt="" className="h-full w-full object-cover" />
            ) : (
              <div className={`h-full w-full bg-gradient-to-br ${gradient} flex items-center justify-center`}>
                <Video size={24} className="text-white/70" />
              </div>
            )}
            <span className="absolute bottom-1 right-1 flex items-center gap-0.5 rounded bg-black/70 px-1.5 py-0.5 text-[9px] font-semibold text-white">
              <Play size={8} className="fill-white" />
              {course.lessonsCount} bài
            </span>
          </div>

          {/* Details */}
          <div className="min-w-0 flex-1 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${cfg.style}`}>
                <span className={`h-1 w-1 rounded-full ${cfg.dot}`} />
                {cfg.label}
              </span>
              <span className="text-[11px] text-slate-400 font-medium">
                {course.level}
              </span>
              {course.topicRaw && (
                <>
                  <span className="text-slate-600">•</span>
                  <span className="text-[11px] text-slate-400">{course.topicRaw}</span>
                </>
              )}
            </div>

            <h3 className="text-sm sm:text-base font-bold text-white tracking-tight line-clamp-2 group-hover:text-violet-300 transition-colors">
              {course.title}
            </h3>

            {/* Moderation note if any */}
            {course.adminModerationNote && (
              <div className="flex items-center gap-1.5 text-xs text-amber-400 pt-0.5">
                <AlertCircle size={13} className="shrink-0" />
                <span className="truncate">
                  {course.adminModerationNote.title}: {course.adminModerationNote.reason}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Right: Metrics & Actions */}
        <div className="flex items-center justify-between sm:justify-end gap-6 pt-2 sm:pt-0 border-t border-white/[0.06] sm:border-0">
          {/* Metrics */}
          <div className="flex items-center gap-5 shrink-0 text-right">
            <div>
              <p className="text-sm font-bold text-white tabular-nums">
                {Number(course.students || 0).toLocaleString("vi-VN")}
              </p>
              <p className="text-[10px] text-slate-400">Học viên</p>
            </div>
            <div>
              <div className="flex items-center justify-end gap-1 text-sm font-bold text-amber-400 tabular-nums">
                <Star size={12} className="fill-amber-400" />
                <span>{course.rating > 0 ? course.rating.toFixed(1) : "—"}</span>
              </div>
              <p className="text-[10px] text-slate-400">Đánh giá</p>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => onEdit(course)}
              disabled={!canEdit}
              className={`inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-bold transition ${
                canEdit
                  ? "bg-white text-slate-950 hover:bg-slate-200 active:scale-[0.98]"
                  : "bg-white/5 text-slate-500 cursor-not-allowed"
              }`}
            >
              <Edit3 size={13} />
              <span>Chỉnh sửa &amp; Video</span>
            </button>

            {canEdit && onArchive && (
              <button
                type="button"
                onClick={() => onArchive(course)}
                title="Lưu trữ khóa học"
                className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/[0.03] text-slate-400 transition hover:border-red-500/30 hover:bg-red-500/10 hover:text-red-400"
              >
                <Trash2 size={15} />
              </button>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
});

/* ── Main Component ───────────────────────────────────────────────────────── */
export function MentorCourseManagement() {
  const navigate = useNavigate();
  const user = getUser();
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("all");
  const [search, setSearch] = useState("");
  const [archiveTarget, setArchiveTarget] = useState(null);
  const [archiving, setArchiving] = useState(false);
  const [courseSummary, setCourseSummary] = useState(null);

  const loadCourses = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchMyMentorCourses();
      if (res.success) {
        setCourses(res.courses || []);
        if (res.summary) setCourseSummary(res.summary);
      } else {
        toastApiError(res.error, "Không tải được danh sách khóa học.");
      }
    } catch {
      toastApiError("Lỗi kết nối khi tải khóa học.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCourses();
  }, [loadCourses]);

  const myCourses = useMemo(() => courses.map(mapCourseRow), [courses]);

  const activeCourses = useMemo(
    () => myCourses.filter((c) => c.status !== "archived"),
    [myCourses]
  );

  const featuredCourse = useMemo(() => pickFeaturedCourse(myCourses), [myCourses]);

  const filtered = useMemo(() => {
    return myCourses.filter((c) => {
      if (activeTab !== "all" && c.status !== activeTab) return false;
      if (search.trim()) {
        const q = search.trim().toLowerCase();
        return (
          c.title?.toLowerCase().includes(q) ||
          c.level?.toLowerCase().includes(q) ||
          c.tags?.some((t) => String(t).toLowerCase().includes(q))
        );
      }
      return true;
    });
  }, [myCourses, activeTab, search]);

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
  const publishedCoursesCount = activeCourses.filter((c) => c.status === "published").length;
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
    <MentorPageShell bottomPad="pb-24" showAmbient={false} className="bg-transparent text-white">
      <div className="relative z-10 mx-auto max-w-[1240px] px-4 pt-4 pb-12 sm:px-6 lg:px-8 space-y-8">
        {/* ── 1. Header Banner ── */}
        <motion.div
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          className="relative overflow-hidden rounded-3xl border border-white/[0.08] bg-gradient-to-b from-[#13151f]/80 via-[#0d0f16]/90 to-[#0a0b10] p-6 sm:p-8 backdrop-blur-2xl shadow-xl"
        >
          <div className="pointer-events-none absolute -top-24 -left-24 h-64 w-64 rounded-full bg-violet-600/15 blur-3xl" />

          <div className="relative flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="space-y-3 max-w-2xl">
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-violet-500/30 bg-violet-500/10 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-violet-300">
                  <GraduationCap size={13} className="text-violet-400" />
                  Studio Khóa học &amp; Video bài giảng
                </span>
              </div>

              <h1 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold tracking-tight text-white leading-tight">
                Quản lý Khóa học &amp;{" "}
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-white via-slate-100 to-violet-300">
                  Bài giảng Video
                </span>
              </h1>

              <p className="text-sm text-slate-300 leading-relaxed max-w-xl">
                Tạo giáo trình chuyên sâu, tải lên video bài giảng chất lượng cao và theo dõi phản hồi từ học viên.
              </p>
            </div>

            <div className="flex shrink-0">
              <button
                type="button"
                onClick={() => navigate("/mentor/courses/new/edit")}
                className="group inline-flex items-center gap-2.5 rounded-xl bg-white px-5 py-3 text-xs font-bold text-slate-950 shadow-md transition-all hover:bg-slate-200 active:scale-[0.98]"
              >
                <Plus size={16} strokeWidth={2.5} />
                <span>Tạo khóa học &amp; Đăng video mới</span>
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-slate-950/10 transition-transform group-hover:translate-x-0.5">
                  <ArrowRight size={11} />
                </span>
              </button>
            </div>
          </div>
        </motion.div>

        {/* ── 2. Studio KPI Bento Grid (4 Cards) ── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="rounded-2xl border border-white/[0.08] bg-[#0c0e15] p-5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                Tổng khóa học
              </span>
              <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-violet-500/10 border border-violet-500/20 text-violet-400">
                <BookOpen size={16} />
              </span>
            </div>
            <div className="mt-4 flex items-baseline gap-2">
              <span className="text-3xl font-extrabold text-white tracking-tight">{totalCourses}</span>
              <span className="text-xs text-slate-400">khóa</span>
            </div>
            <p className="mt-2 text-[11px] text-slate-400">Toàn bộ khóa đang quản lý</p>
          </div>

          <div className="rounded-2xl border border-white/[0.08] bg-[#0c0e15] p-5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                Đang phát hành
              </span>
              <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                <CheckCircle2 size={16} />
              </span>
            </div>
            <div className="mt-4 flex items-baseline gap-2">
              <span className="text-3xl font-extrabold text-emerald-400 tracking-tight">{publishedCoursesCount}</span>
              <span className="text-xs text-slate-400">đang mở</span>
            </div>
            <p className="mt-2 text-[11px] text-emerald-300 font-medium">Công khai trên thư viện</p>
          </div>

          <div className="rounded-2xl border border-white/[0.08] bg-[#0c0e15] p-5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                Tổng học viên
              </span>
              <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
                <Users size={16} />
              </span>
            </div>
            <div className="mt-4 flex items-baseline gap-2">
              <span className="text-3xl font-extrabold text-white tracking-tight">
                {Number(totalStudents || 0).toLocaleString("vi-VN")}
              </span>
              <span className="text-xs text-slate-400">học viên</span>
            </div>
            <p className="mt-2 text-[11px] text-slate-400">Đã đăng ký học</p>
          </div>

          <div className="rounded-2xl border border-white/[0.08] bg-[#0c0e15] p-5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                Đánh giá trung bình
              </span>
              <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400">
                <Star size={16} className="fill-amber-400" />
              </span>
            </div>
            <div className="mt-4 flex items-baseline gap-2">
              <span className="text-3xl font-extrabold text-amber-400 tracking-tight">{avgRatingDisplay}</span>
              {hasAvgRating && <span className="text-xs text-slate-400">/ 5.0</span>}
            </div>
            <p className="mt-2 text-[11px] text-slate-400">{hasAvgRating ? "Điểm trung bình khóa học" : "Chưa có lượt đánh giá"}</p>
          </div>
        </div>

        {/* ── 3. Featured Course Spotlight (if any) ── */}
        {featuredCourse && activeTab === "all" && !search.trim() && (
          <FeaturedCourseSpotlight
            course={featuredCourse}
            onOpen={(c) => navigate(`/courses/${c.id}`)}
            onEdit={(c) => navigate(`/mentor/courses/${c.id}/edit`)}
          />
        )}

        {/* ── 4. Search & Filter Tabs Toolbar ── */}
        <div className="rounded-3xl border border-white/[0.08] bg-[#0c0e15] p-6 shadow-xl space-y-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-white/[0.08] pb-5">
            {/* Filter Tabs */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 custom-scrollbar">
              {FILTER_TABS.map((t) => {
                const active = activeTab === t.key;
                return (
                  <button
                    key={t.key}
                    type="button"
                    onClick={() => setActiveTab(t.key)}
                    className={`relative rounded-xl px-4 py-2 text-xs font-bold transition-all whitespace-nowrap ${
                      active
                        ? "bg-violet-600 text-white shadow-sm shadow-violet-600/30"
                        : "text-slate-400 hover:bg-white/5 hover:text-white"
                    }`}
                  >
                    {t.label}
                  </button>
                );
              })}
            </div>

            {/* Search Input */}
            <div className="relative w-full sm:w-72 shrink-0">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
                aria-hidden
              />
              <input
                type="search"
                placeholder="Tìm theo tên, chủ đề, tag..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full rounded-xl border border-white/10 bg-white/[0.04] py-2 pl-9 pr-4 text-xs text-white placeholder:text-slate-500 outline-none focus:border-violet-500 focus:bg-white/[0.06] transition"
              />
            </div>
          </div>

          {/* ── 5. Course List Rows ── */}
          {loading ? (
            <div className="py-16 text-center text-slate-400 text-xs">
              <div className="mx-auto mb-3 h-6 w-6 animate-spin rounded-full border-2 border-violet-500 border-t-transparent" />
              Đang tải danh sách khóa học...
            </div>
          ) : filtered.length > 0 ? (
            <div className="space-y-3">
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

              {showCourseExpandButton && (
                <div className="pt-2">
                  <MentorListExpandButton
                    expanded={coursesExpanded}
                    onToggle={toggleCoursesExpanded}
                  />
                </div>
              )}
            </div>
          ) : (
            <div className="py-16 text-center">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-white/[0.04] border border-white/10 text-slate-400">
                <Video size={24} />
              </div>
              <p className="text-sm font-bold text-white">
                {search.trim()
                  ? "Không tìm thấy khóa học nào khớp với từ khóa tìm kiếm."
                  : activeTab === "archived"
                  ? "Chưa có khóa học nào được lưu trữ."
                  : "Chưa có khóa học nào trong mục này."}
              </p>
              <p className="mt-1 text-xs text-slate-400 max-w-sm mx-auto">
                Bắt đầu xây dựng khóa học và đăng tải các video bài giảng chất lượng để chia sẻ kinh nghiệm phỏng vấn cùng học viên.
              </p>
              {!search.trim() && activeTab !== "archived" && (
                <button
                  type="button"
                  onClick={() => navigate("/mentor/courses/new/edit")}
                  className="mt-5 inline-flex items-center gap-2 rounded-xl bg-violet-600 px-5 py-2.5 text-xs font-bold text-white shadow-sm shadow-violet-600/30 transition hover:bg-violet-500"
                >
                  <Plus size={15} />
                  <span>Tạo khóa học &amp; Đăng video ngay</span>
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Archive Modal */}
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
