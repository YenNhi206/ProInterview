import { MentorPageShell } from "../../components/mentor/MentorPageShell";
import "../../../styles/mentor-search.css";
import { AddCourseToCartButton } from "../../components/courses/AddCourseToCartButton.jsx";
import React, { useState, useMemo, useEffect, useRef } from "react";
import { motion, AnimatePresence, useScroll, useTransform } from "motion/react";
import { useNavigate, useSearchParams } from "react-router";
import {
  Search,
  Star,
  Clock,
  BookOpen,
  X,
  Filter,
  ChevronDown,
  AlertCircle,
  Sparkles,
  PlayCircle,
  Repeat,
  RotateCcw,
} from "lucide-react";

import { fetchCourses } from "../../api/courseApi.js";
import { toastApiError } from "../../utils/shared/apiToast.js";
import { normalizeCourseStats } from "../../utils/course/courseStats.js";
import { mediaSrc, DEFAULT_COURSE_THUMB, avatarSrc } from "../../utils/shared/mediaUrl.js";
import { ImageWithFallback } from "../../components/figma/ImageWithFallback";
import { CUSTOMER_SHELL_GUTTER, CUSTOMER_SHELL_MAX } from "../../components/layout/customerShellLayout";
import { AppSelect } from "../../components/ui/AppSelect";
import {
  buildCourseFilterCategories,
  courseMatchesTopic,
  getCourseTopicLabel,
} from "../../constants/courseCategories";
import { formatVnd } from "../../utils/shared/formatVnd.js";
import { ListPagination } from "../../components/shared/ListPagination";
import { getPlans } from "../../utils/auth/auth.js";

/* ─── Constants ─────────────────────────────────────────────── */
const LEVEL_OPTIONS = [
  { label: "Người mới",  value: "Beginner"     },
  { label: "Trung cấp",  value: "Intermediate" },
  { label: "Nâng cao",   value: "Advanced"     },
];

const FEE_OPTIONS = [
  { label: "Miễn phí", value: "free" },
  { label: "Trả phí",  value: "paid" },
];

const SORT_OPTIONS = [
  { value: "newest",     label: "Mới nhất"      },
  { value: "price_asc",  label: "Giá thấp → cao"},
  { value: "price_desc", label: "Giá cao → thấp"},
  { value: "rating",     label: "Đánh giá cao"  },
];

const COURSES_PAGE_SIZE = 8;

function normalizeLevel(raw) {
  const s = String(raw || "").toLowerCase();
  if (s === "intermediate") return "Intermediate";
  if (s === "advanced")     return "Advanced";
  return "Beginner";
}

/* ─── Course grid card (3D Flip Card with Neon Runner & Glow) ─── */
function CourseCard({ course, formatPrice, onOpen, index }) {
  const [flipped, setFlipped] = useState(false);
  const ratingDisplay  = course.rating != null ? course.rating.toFixed(1) : null;
  const durationHours  = Math.floor((course.duration || 0) / 60);
  const avatarFallback = `https://ui-avatars.com/api/?name=${encodeURIComponent(course.mentorName || "M")}&background=ede9fe&color=6d28d9`;
  /* Ưu đãi Pro/Elite (-5%/-10%) — ước tính hiển thị theo plan hiện tại, số tiền thật chốt ở /checkout. */
  const perkPlans = getPlans();
  const perkDiscountRate = perkPlans.elitePro ? 0.1 : perkPlans.starterPro ? 0.05 : 0;
  const perkPlanLabel = perkPlans.elitePro ? "Elite" : perkPlans.starterPro ? "Pro" : "";
  const coursePrice = Number(course.price) || 0;
  const perkDiscountAmount = coursePrice > 0 && perkDiscountRate > 0 ? Math.round(coursePrice * perkDiscountRate) : 0;
  const perkFinalPrice = coursePrice - perkDiscountAmount;

  return (
    <motion.div
      initial={{ opacity: 0, y: 44 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.12 }}
      transition={{ duration: 0.48, delay: (index % 4) * 0.09, ease: [0.16, 1, 0.3, 1] }}
      className={`pi-course-card-3d ${flipped ? "is-flipped" : ""}`}
    >
      <div className="pi-course-card-3d__inner">
        {/* ════════ FRONT FACE ════════ */}
        <div
          className="pi-course-card-3d__front group cursor-pointer"
          onClick={() => setFlipped(true)}
          title="Click để lật xem tổng quan khóa học"
        >
          {/* Thumbnail */}
          <div className="relative aspect-video w-full overflow-hidden bg-[#18113c] shrink-0">
            <ImageWithFallback
              src={course.thumbnail}
              alt=""
              className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#140d30] via-transparent to-transparent" />

            {/* Mentor avatar overlay */}
            <div className="absolute bottom-3 left-3 flex items-center gap-2">
              <img
                src={course.mentorAvatar || avatarFallback}
                onError={(e) => { e.currentTarget.src = avatarFallback; }}
                alt=""
                className="h-7 w-7 rounded-full border border-[#93f72b]/50 object-cover shadow-sm"
              />
              <p className="truncate text-[11px] font-bold text-white drop-shadow-sm max-w-[140px]">
                {course.mentorName}
              </p>
            </div>

            {/* Level Badge */}
            {course.level && (
              <span className="absolute top-3 right-3 rounded-full bg-black/60 px-2.5 py-0.5 text-[10px] font-bold text-[#93f72b] backdrop-blur-md border border-[#93f72b]/30">
                {course.level}
              </span>
            )}
          </div>

          {/* Body */}
          <div className="flex flex-1 flex-col justify-between p-4">
            <div>
              <h3 className="line-clamp-2 text-sm font-black leading-snug text-white transition-colors duration-200 group-hover:text-[#93f72b]">
                {course.title}
              </h3>
              {course.description && (
                <p className="mt-1.5 line-clamp-2 text-xs leading-relaxed text-slate-300">
                  {course.description}
                </p>
              )}
            </div>

            <div className="mt-3 pt-3 border-t border-white/10">
              {/* Stats row */}
              <div className="flex flex-wrap items-center justify-between gap-1 text-[11px] text-slate-300">
                {ratingDisplay ? (
                  <span className="inline-flex items-center gap-1 font-bold text-amber-400">
                    <Star className="size-3.5 fill-amber-400 text-amber-400" />
                    {ratingDisplay}
                  </span>
                ) : (
                  <span className="text-slate-400">Chưa có đánh giá</span>
                )}
                {durationHours > 0 && (
                  <span className="inline-flex items-center gap-1 text-slate-300">
                    <Clock className="size-3 text-violet-400" />
                    {durationHours}h học
                  </span>
                )}
                {course.mentorTitle && (
                  <span className="truncate text-slate-400 max-w-[110px]">{course.mentorTitle}</span>
                )}
              </div>

              {/* Price & Hint */}
              <div className="mt-3 flex items-center justify-between">
                <div>
                  <span className="text-base font-black text-[#93f72b]">
                    {formatPrice(perkFinalPrice)}
                  </span>
                  {perkDiscountAmount > 0 && (
                    <span className="ml-1.5 text-xs font-semibold text-slate-400 line-through">
                      {formatPrice(coursePrice)}
                    </span>
                  )}
                </div>

                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setFlipped(true);
                  }}
                  className="pi-card-3d-hint cursor-pointer hover:bg-[#93f72b]/25 transition-colors"
                  title="Click để lật xem chi tiết"
                >
                  <span>Chi tiết</span>
                  <Sparkles className="size-3" />
                </button>
              </div>

              {/* Touch toggle button for mobile */}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setFlipped(true);
                }}
                className="mt-3.5 flex md:hidden w-full items-center justify-center gap-1.5 rounded-xl border border-white/10 bg-white/5 py-1.5 text-[11px] font-bold text-violet-300 hover:text-white"
              >
                <Repeat className="size-3" /> Lật xem nhanh
              </button>
            </div>
          </div>
        </div>

        {/* ════════ BACK FACE (Rotating Neon Border + Glowing Ambient Orbs) ════════ */}
        <div
          className="pi-course-card-3d__back cursor-pointer"
          onClick={() => setFlipped(false)}
          title="Click vào thẻ để quay lại mặt trước"
        >
          <div className="pi-course-card-3d__back-surface">
            {/* Ambient Floating Orbs */}
            <div className="pi-card-glow-orb pi-card-glow-orb--top" aria-hidden="true" />
            <div className="pi-card-glow-orb pi-card-glow-orb--bottom" aria-hidden="true" />

            {/* Back Header */}
            <div className="relative z-10 flex items-start justify-between gap-2 border-b border-white/10 pb-2.5">
              <div>
                <span className="inline-flex items-center gap-1 text-[10px] font-extrabold uppercase tracking-wider text-[#93f72b]">
                  <Sparkles className="size-3" /> Tổng quan khóa học
                </span>
                <h4 className="mt-0.5 line-clamp-1 text-sm font-black text-white">
                  {course.title}
                </h4>
              </div>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setFlipped(false);
                }}
                title="Lật lại mặt trước"
                className="shrink-0 rounded-full p-1 text-slate-400 hover:bg-white/10 hover:text-white cursor-pointer"
              >
                <RotateCcw className="size-3.5" />
              </button>
            </div>

            {/* Back Content Highlights */}
            <div className="relative z-10 flex-1 py-2.5 flex flex-col justify-between gap-2 text-xs">
              <div className="pi-card-3d-info-box">
                <p className="text-[11px] font-medium text-slate-200 line-clamp-3 leading-relaxed">
                  {course.description || "Khóa học thực chiến chuyên sâu rèn luyện tư duy, kỹ năng phỏng vấn và giải quyết bài toán thực tế."}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-2 text-center">
                <div className="rounded-xl bg-white/5 p-2 border border-white/5">
                  <p className="text-[10px] text-slate-400 font-semibold">Giảng viên</p>
                  <p className="text-xs font-bold text-white truncate mt-0.5">{course.mentorName}</p>
                </div>
                <div className="rounded-xl bg-white/5 p-2 border border-white/5">
                  <p className="text-[10px] text-slate-400 font-semibold">Thời lượng</p>
                  <p className="text-xs font-bold text-[#93f72b] mt-0.5">{durationHours > 0 ? `${durationHours}h video` : "Tự học"}</p>
                </div>
              </div>

              {perkDiscountAmount > 0 && (
                <div className="flex items-center justify-between rounded-xl bg-violet-950/60 border border-violet-500/30 px-3 py-1.5 text-[11px]">
                  <span className="text-violet-300 font-medium">Gói {perkPlanLabel}:</span>
                  <span className="font-bold text-[#93f72b]">Tiết kiệm {formatPrice(perkDiscountAmount)}</span>
                </div>
              )}
            </div>

            {/* Back CTA Buttons */}
            <div className="relative z-10 pt-2.5 border-t border-white/10 flex flex-col gap-2">
              <motion.button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onOpen();
                }}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.96 }}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#93f72b] hover:bg-[#84cc16] py-2 text-xs font-black uppercase tracking-wide text-slate-950 shadow-[0_4px_16px_rgba(147,247,43,0.35)] transition-all cursor-pointer"
              >
                <PlayCircle className="size-3.5" />
                Vào xem khóa học
              </motion.button>
              <div onClick={(e) => e.stopPropagation()}>
                <AddCourseToCartButton courseId={course.id} className="w-full text-xs" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

/* ─── Skeleton card ──────────────────────────────────────────── */
function SkeletonCard({ index }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      className="animate-pulse overflow-hidden rounded-3xl border border-violet-50 bg-white shadow-sm"
    >
      <div className="aspect-video w-full bg-violet-100/60" />
      <div className="space-y-2.5 p-4">
        <div className="h-4 w-3/4 rounded bg-slate-100" />
        <div className="h-3 w-full rounded bg-slate-100" />
        <div className="h-3 w-2/3 rounded bg-slate-100" />
        <div className="mt-3 flex gap-2">
          <div className="h-5 w-12 rounded-full bg-slate-100" />
          <div className="h-5 w-10 rounded bg-slate-100" />
        </div>
        <div className="mt-1 h-9 w-full rounded-2xl bg-violet-100/70" />
      </div>
    </motion.div>
  );
}

/* ─── Main page ─────────────────────────────────────────────── */
export function Courses() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const heroRef = useRef(null);

  const { scrollYProgress } = useScroll({ target: heroRef, offset: ["start start", "end start"] });
  const glow1Y = useTransform(scrollYProgress, [0, 1], [0, -70]);
  const glow2Y = useTransform(scrollYProgress, [0, 1], [0, -45]);

  const [courses,          setCourses]          = useState([]);
  const [filterCategories, setFilterCategories] = useState(() => buildCourseFilterCategories());
  const [loading,          setLoading]          = useState(true);
  const [error,            setError]            = useState(null);

  const [searchQuery,      setSearchQuery]      = useState("");
  const [selectedLevel,    setSelectedLevel]    = useState("");
  const [selectedCategory, setSelectedCategory] = useState("");
  const [selectedFee,      setSelectedFee]      = useState("");
  const [sortBy,           setSortBy]           = useState("newest");
  const [filtersOpen,      setFiltersOpen]      = useState(false);
  const [currentPage,      setCurrentPage]      = useState(1);

  /* redirect ?tab=my-courses */
  useEffect(() => {
    if (searchParams.get("tab") === "my-courses") navigate("/my-courses", { replace: true });
  }, [searchParams, navigate]);

  /* fetch */
  const loadCourses = () => {
    setLoading(true);
    setError(null);
    fetchCourses()
      .then((res) => {
        if (res.success) {
          const mapped = res.courses.map((c) => {
            const { rating } = normalizeCourseStats(c.stats);
            return {
              id:            c._id,
              title:         c.title,
              description:   c.description,
              thumbnail:     mediaSrc(c.thumbnail, DEFAULT_COURSE_THUMB),
              category:      c.topics?.[0] || "Kỹ năng khác",
              level:         normalizeLevel(c.level),
              mentorName:    c.mentorId?.userId?.name     || "Khuất danh",
              mentorAvatar:  avatarSrc(c.mentorId?.userId?.avatar),
              mentorTitle:   c.mentorId?.title            || c.mentorId?.userId?.desiredPosition || "",
              mentorCompany: c.mentorId?.company          || c.mentorId?.userId?.currentCompany  || "",
              rating,
              duration:      c.totalDurationMinutes || 0,
              price:         c.price || 0,
              tags:          c.tags  || [],
              createdAt:     c.createdAt ? new Date(c.createdAt).getTime() : 0,
            };
          });
          setCourses(mapped);
          setFilterCategories(buildCourseFilterCategories(res.courses));
        } else {
          const msg = res.error || "Không tải được danh sách khóa học.";
          setError(msg);
          toastApiError(msg);
          setCourses([]);
          setFilterCategories(buildCourseFilterCategories());
        }
        setLoading(false);
      })
      .catch(() => {
        const msg = "Lỗi kết nối khi tải khóa học.";
        setError(msg);
        toastApiError(msg);
        setCourses([]);
        setFilterCategories(buildCourseFilterCategories());
        setLoading(false);
      });
  };

  useEffect(() => { loadCourses(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const hasFilter =
    Boolean(searchQuery) || Boolean(selectedLevel) || Boolean(selectedCategory) || Boolean(selectedFee);

  const clearFilters = () => {
    setSearchQuery("");
    setSelectedLevel("");
    setSelectedCategory("");
    setSelectedFee("");
    setSortBy("newest");
  };

  /* filter + sort */
  const filteredCourses = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return [...courses]
      .filter((c) => {
        if (selectedLevel && c.level !== selectedLevel) return false;
        if (!courseMatchesTopic(c.category, selectedCategory || null)) return false;
        if (selectedFee === "free" && c.price !== 0) return false;
        if (selectedFee === "paid" && c.price === 0) return false;
        if (q && !c.title.toLowerCase().includes(q) && !c.description?.toLowerCase().includes(q) && !c.mentorName.toLowerCase().includes(q))
          return false;
        return true;
      })
      .sort((a, b) => {
        if (sortBy === "price_asc")  return a.price - b.price;
        if (sortBy === "price_desc") return b.price - a.price;
        if (sortBy === "rating")     return (b.rating ?? 0) - (a.rating ?? 0);
        return (b.createdAt ?? 0) - (a.createdAt ?? 0);
      });
  }, [courses, searchQuery, selectedLevel, selectedCategory, selectedFee, sortBy]);

  const totalPages = Math.max(1, Math.ceil(filteredCourses.length / COURSES_PAGE_SIZE));

  const paginatedCourses = useMemo(() => {
    const start = (currentPage - 1) * COURSES_PAGE_SIZE;
    return filteredCourses.slice(start, start + COURSES_PAGE_SIZE);
  }, [filteredCourses, currentPage]);

  useEffect(() => { setCurrentPage(1); }, [searchQuery, selectedLevel, selectedCategory, selectedFee, sortBy]);
  useEffect(() => { if (currentPage > totalPages) setCurrentPage(totalPages); }, [currentPage, totalPages]);

  const formatPrice = (price) => formatVnd(price, { freeLabel: "Miễn phí" });

  return (
    <MentorPageShell bottomPad="pb-20" showAmbient={false}>

          {/* ── Dark hero banner ───────────────────────────────────── */}
      <div
        ref={heroRef}
        className="relative w-full overflow-hidden text-center"
        style={{
          backgroundImage: "linear-gradient(rgba(26,13,53,0.85), rgba(26,13,53,0.95)), url('/courses_hero_bg.png')",
          backgroundSize: "cover",
          backgroundPosition: "center",
          backgroundRepeat: "no-repeat",
          paddingTop: "5rem",
          paddingBottom: "5rem",
          minHeight: "420px",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
        }}
      >
        {/* Glow orbs — parallax */}
        <motion.div style={{ y: glow1Y }} className="pointer-events-none absolute left-1/4 top-0 h-[350px] w-[350px] rounded-full bg-[#8037f4]/20 blur-[90px]" />
        <motion.div style={{ y: glow2Y }} className="pointer-events-none absolute bottom-0 right-1/4 h-[300px] w-[300px] rounded-full bg-lime-500/10 blur-[80px]" />
        <div className="pointer-events-none absolute right-16 top-10 h-48 w-48 rounded-full bg-[#93f72b]/8 blur-2xl" />

        <div className="relative z-10 mx-auto flex max-w-4xl flex-col items-center px-4">
          {/* Heading */}
          <motion.h1
            initial={{ opacity: 0, y: -24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1], delay: 0.07 }}
            className="font-headline text-3xl font-black uppercase tracking-tight text-white sm:text-4xl md:text-5xl"
          >
            KHÓA HỌC KỸ NĂNG
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, delay: 0.2 }}
            className="mb-10 mt-3 max-w-2xl text-sm font-medium leading-relaxed text-slate-300 sm:text-base"
          >
            Các khóa học do Mentor xây dựng, giúp bạn bổ sung kỹ năng cần thiết cho hành trình ứng tuyển.
          </motion.p>

          {/* Search bar — poda-style animated border */}
          <motion.div
            initial={{ opacity: 0, y: 24, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1], delay: 0.35 }}
            className="ms-wrap"
            style={{ maxWidth: "42rem" }}
          >
            {/* Animated border layers */}
            <div className="ms-darkBorderBg" aria-hidden="true" />
            <div className="ms-border"       aria-hidden="true" />
            <div className="ms-white"        aria-hidden="true" />
            <div className="ms-glow"         aria-hidden="true" />

            {/* Bar content */}
            <div className="ms-inner">
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-4 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Tìm khóa học..."
                  className="w-full bg-transparent py-3 pl-11 pr-4 text-xs font-semibold text-white placeholder-slate-400 outline-none"
                />
              </div>
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-violet-800/60 text-slate-300 hover:text-white"
                >
                  <X className="size-3.5" />
                </button>
              )}
              <button
                type="button"
                className="ms-cta-btn inline-flex shrink-0 items-center gap-3 rounded-full py-2.5 pl-5 pr-2.5 text-[13px] font-black text-[#93f72b] cursor-pointer"
              >
                TÌM KIẾM
                <span className="ms-cta-icon">
                  <Search className="size-3.5" />
                </span>
              </button>
            </div>
          </motion.div>

          {/* Quick stats */}
          {!loading && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
              className="mt-6 flex flex-wrap justify-center gap-x-5 gap-y-1.5 text-[11px] font-semibold text-violet-300/80"
            >
              <span className="flex items-center gap-1.5">
                <BookOpen className="h-3.5 w-3.5" />
                {courses.length} khóa học
              </span>
              {filterCategories.length > 0 && (
                <span className="flex items-center gap-1.5">
                  <Sparkles className="h-3.5 w-3.5" />
                  {filterCategories.length} danh mục
                </span>
              )}
            </motion.div>
          )}
        </div>
      </div>

      {/* ── Content ───────────────────────────────────────────── */}
      <div className={`relative z-10 flex flex-col pb-8 pt-8 ${CUSTOMER_SHELL_GUTTER}`}>
        <div className={`${CUSTOMER_SHELL_MAX} w-full`}>

          {/* Results bar + filter toggle */}
          <motion.div
            className="mb-6 flex items-center justify-between border-b border-slate-100 pb-3 px-1"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: 0.1 }}
          >
            <p className="text-sm font-semibold text-slate-700">
              Tìm thấy{" "}
              <span className="text-base font-extrabold text-[#8037f4]">{filteredCourses.length}</span>{" "}
              khóa học cho bạn!
            </p>
            <button
              type="button"
              onClick={() => setFiltersOpen((v) => !v)}
              className="inline-flex items-center gap-1.5 rounded-full border border-violet-100 bg-violet-50 px-4 py-2 text-xs font-black uppercase tracking-wider text-[#8037f4] transition-all hover:bg-violet-100/80"
            >
              <Filter className="size-3.5" />
              Lọc kết quả
              <ChevronDown className={`size-3.5 transition-transform duration-200 ${filtersOpen ? "rotate-180" : ""}`} />
            </button>
          </motion.div>

          {/* Collapsible filter panel */}
          <AnimatePresence>
            {filtersOpen && (
              <motion.div
                initial={{ opacity: 0, y: -12, scaleY: 0.95 }}
                animate={{ opacity: 1, y: 0, scaleY: 1 }}
                exit={{ opacity: 0, y: -8, scaleY: 0.96 }}
                transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
                className="mb-8 rounded-3xl border border-violet-950/20 bg-[#1a132f] p-5 shadow-xl"
                style={{ transformOrigin: "top" }}
              >
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 items-end">
                  {/* Cấp độ */}
                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="course-selectedlevel" className="px-1 text-[10px] font-extrabold uppercase tracking-wider text-violet-300/80">Cấp độ</label>
                    <AppSelect
                      id="course-selectedlevel"
                      value={selectedLevel}
                      onValueChange={setSelectedLevel}
                      options={[
                        { value: "", label: "Tất cả cấp độ" },
                        ...LEVEL_OPTIONS
                      ]}
                      theme="dark"
                      size="compact"
                    />
                  </div>

                  {/* Danh mục */}
                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="course-selectedcategory" className="px-1 text-[10px] font-extrabold uppercase tracking-wider text-violet-300/80">Danh mục</label>
                    <AppSelect
                      id="course-selectedcategory"
                      value={selectedCategory}
                      onValueChange={setSelectedCategory}
                      options={[
                        { value: "", label: "Tất cả danh mục" },
                        ...filterCategories
                      ]}
                      theme="dark"
                      size="compact"
                    />
                  </div>

                  {/* Học phí */}
                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="course-selectedfee" className="px-1 text-[10px] font-extrabold uppercase tracking-wider text-violet-300/80">Học phí</label>
                    <AppSelect
                      id="course-selectedfee"
                      value={selectedFee}
                      onValueChange={setSelectedFee}
                      options={[
                        { value: "", label: "Tất cả" },
                        ...FEE_OPTIONS
                      ]}
                      theme="dark"
                      size="compact"
                    />
                  </div>

                  {/* Sắp xếp */}
                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="course-sortby" className="px-1 text-[10px] font-extrabold uppercase tracking-wider text-violet-300/80">Sắp xếp</label>
                    <AppSelect
                      id="course-sortby"
                      value={sortBy}
                      onValueChange={setSortBy}
                      options={SORT_OPTIONS}
                      theme="dark"
                      size="compact"
                    />
                  </div>

                  {/* Actions */}
                  <div className="flex items-end gap-2">
                    <button
                      type="button"
                      onClick={clearFilters}
                      disabled={!hasFilter}
                      className="flex-1 rounded-2xl border border-violet-800 bg-violet-950/30 py-2.5 text-xs font-extrabold text-slate-300 transition-all hover:bg-violet-900/20 disabled:cursor-not-allowed disabled:opacity-30"
                    >
                      Xóa lọc
                    </button>
                    <button
                      type="button"
                      onClick={() => setFiltersOpen(false)}
                      className="flex-1 rounded-2xl bg-lime-400 py-2.5 text-xs font-black text-violet-950 shadow-sm transition-all hover:bg-lime-300"
                    >
                      ÁP DỤNG
                    </button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Error */}
          {error && !loading && (
            <div className="mb-6 rounded-3xl border border-violet-100 bg-white py-16 text-center shadow-sm">
              <AlertCircle className="mx-auto mb-3 size-10 text-violet-400" />
              <p className="font-semibold text-violet-950">Không thể tải danh sách khóa học</p>
              <button
                type="button"
                onClick={loadCourses}
                className="mt-4 rounded-xl bg-[#a3e635] px-6 py-2.5 text-sm font-bold text-slate-900 hover:bg-[#84cc16]"
              >
                Thử lại
              </button>
            </div>
          )}

          {/* Loading skeletons */}
          {loading && (
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {[...Array(8)].map((_, i) => <SkeletonCard key={i} index={i} />)}
            </div>
          )}

          {/* Empty state */}
          {!loading && !error && filteredCourses.length === 0 && (
            <div className="rounded-3xl border border-violet-100 bg-white py-16 text-center shadow-sm">
              <motion.div animate={{ y: [0, -6, 0] }} transition={{ repeat: Infinity, duration: 2.8, ease: "easeInOut" }}>
                <Search className="mx-auto mb-4 size-12 text-violet-300" />
              </motion.div>
              <h3 className="mb-2 text-lg font-black text-violet-950">Không tìm thấy khóa học</h3>
              <p className="mb-7 text-sm text-slate-500">
                {searchQuery ? `Không có kết quả cho "${searchQuery}". ` : ""}Thử đổi bộ lọc khác nhé.
              </p>
              <motion.button
                type="button"
                onClick={clearFilters}
                whileHover={{ scale: 1.04 }}
                whileTap={{ scale: 0.95 }}
                className="rounded-xl bg-[#a3e635] px-6 py-2.5 text-sm font-bold text-slate-900"
              >
                Xóa bộ lọc
              </motion.button>
            </div>
          )}

          {/* Course grid */}
          {!loading && !error && filteredCourses.length > 0 && (
            <>
              <AnimatePresence mode="wait">
                <motion.div
                  key={`${currentPage}-${selectedLevel}-${selectedCategory}-${selectedFee}-${sortBy}-${searchQuery}`}
                  className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.15 }}
                >
                  {paginatedCourses.map((course, index) => (
                    <CourseCard
                      key={course.id}
                      course={course}
                      formatPrice={formatPrice}
                      onOpen={() => navigate(`/courses/${course.id}`)}
                      index={index}
                    />
                  ))}
                </motion.div>
              </AnimatePresence>

              <motion.div
                className="mt-8"
                initial={{ opacity: 0, y: 12 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.35 }}
              >
                <ListPagination
                  currentPage={currentPage}
                  totalPages={totalPages}
                  onPageChange={setCurrentPage}
                />
              </motion.div>
            </>
          )}

        </div>
      </div>
    </MentorPageShell>
  );
}
