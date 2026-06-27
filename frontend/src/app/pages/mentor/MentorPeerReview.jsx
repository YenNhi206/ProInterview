import { forwardRef, useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router";
import {
  Users,
  Star,
  Search,
  CheckCircle2,
  Clock,
  FileBadge,
  TrendingUp,
  BookOpen,
  PlayCircle,
  ImageIcon,
  ClipboardList,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { getUser } from "../../utils/auth/auth.js";
import { MentorPageShell } from "../../components/mentor/MentorPageShell";
import { MentorStatMiniGrid, MentorStatFrame } from "../../components/mentor/MentorStatFrames";
import { fetchMentorPeerReviews, submitMentorPeerReview } from "../../api/mentorApi.js";
import { tryApi } from "../../utils/shared/apiToast.js";
import { formatVnd } from "../../utils/shared/formatVnd.js";
import { toast } from "sonner";
import { mediaSrc, DEFAULT_COURSE_THUMB } from "../../utils/shared/mediaUrl.js";
import { MentorListExpandButton } from "../../components/mentor/MentorListExpandButton.jsx";
import { useMentorListExpand } from "../../hooks/useMentorListExpand.js";
import { MentorScrollFadeRow } from "../../components/mentor/MentorScrollFadeRow.jsx";

const CATEGORY_LABELS = {
  all: "Tất cả lĩnh vực",
  technical: "Kỹ thuật",
  behavioral: "Hành vi",
  negotiation: "Đàm phán",
  other: "Khác",
};

const FILTER_TABS = [
  { id: "all", label: "Tất cả" },
  { id: "pending", label: "Chưa đánh giá" },
  { id: "reviewed", label: "Đã đánh giá" },
];

const CATEGORIES = ["all", "other", "behavioral", "technical", "negotiation"];

const PEER_CATEGORY_KEYS = new Set(["technical", "behavioral", "negotiation", "other"]);

function normalizePeerCategory(raw) {
  const key = String(raw || "other").trim().toLowerCase();
  if (key === "resume") return "other";
  return PEER_CATEGORY_KEYS.has(key) ? key : "other";
}

const THUMB_GRADIENTS = [
  "from-[#8037f4] to-[#6d28d9]",
  "from-violet-500 to-[#8037f4]",
  "from-slate-600 to-slate-800",
  "from-[#93f72b]/90 to-emerald-600",
  "from-indigo-500 to-violet-700",
];

const PEER_ROW_STYLES = `
  @keyframes mentor-peer-row-pulse {
    0% { transform: scale3d(1, 1, 1); }
    50% { transform: scale3d(1.012, 1.012, 1.012); }
    100% { transform: scale3d(1, 1, 1); }
  }
  .mentor-peer-row {
    transform-origin: center center;
    transition: background-color 0.2s ease, box-shadow 0.2s ease, transform 0.15s ease;
  }
  @media (hover: hover) and (pointer: fine) {
    .mentor-peer-row:hover {
      background-color: rgba(248, 250, 252, 0.95);
      box-shadow: 0 4px 18px rgba(128, 55, 244, 0.08);
      animation: mentor-peer-row-pulse 0.9s ease-in-out;
    }
  }
  .mentor-peer-row:active {
    background-color: rgba(248, 250, 252, 0.95);
    transform: scale(0.992);
  }
  @media (prefers-reduced-motion: reduce) {
    .mentor-peer-row:hover,
    .mentor-peer-row:active {
      animation: none;
      transform: none;
    }
  }
`;

const listContainerMotion = {
  hidden: { opacity: 1 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.08, delayChildren: 0.05 },
  },
};

const listRowMotion = {
  hidden: { opacity: 0, y: 28, scale: 0.96 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { type: "spring", stiffness: 320, damping: 24, mass: 0.85 },
  },
  exit: {
    opacity: 0,
    y: -8,
    scale: 0.97,
    transition: { duration: 0.18, ease: "easeIn" },
  },
};

function formatCategory(cat) {
  if (!cat || cat === "all") return CATEGORY_LABELS.all;
  const key = String(cat).toLowerCase();
  return CATEGORY_LABELS[key] || String(cat);
}

function formatCategoryShort(cat) {
  if (!cat || cat === "all") return "Khác";
  const key = String(cat).toLowerCase();
  return CATEGORY_LABELS[key] || String(cat);
}

function pickPriorityCourse(courses, categoryFilter = "all") {
  let pending = (courses || []).filter((c) => c.status === "pending");
  if (categoryFilter !== "all") {
    pending = pending.filter((c) => normalizePeerCategory(c.category) === categoryFilter);
  }
  if (!pending.length) return null;
  return [...pending].sort(
    (a, b) => Number(b.participants || 0) - Number(a.participants || 0),
  )[0];
}

function PriorityPeerReviewSpotlight({ course, onReview }) {
  const hasCustomThumb = Boolean(String(course.cover || "").trim());

  return (
    <motion.section
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
      className="mb-6 overflow-hidden rounded-2xl border border-slate-200/90 bg-white p-5 shadow-[0_1px_3px_rgba(15,23,42,0.04)] sm:p-6"
    >
      <div className="flex flex-col gap-6 lg:flex-row lg:items-stretch">
        <div className="lg:w-[42%]">
          {hasCustomThumb ? (
            <div className="h-[200px] overflow-hidden rounded-xl bg-slate-100 sm:h-[220px] lg:h-[240px]">
              <img
                src={mediaSrc(course.cover, DEFAULT_COURSE_THUMB)}
                alt=""
                className="h-full w-full object-cover"
              />
            </div>
          ) : (
            <div className="flex h-[200px] flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-slate-200 bg-slate-50 px-4 text-center sm:h-[220px] lg:h-[240px]">
              <ImageIcon size={32} className="text-slate-300" strokeWidth={1.5} />
              <p className="max-w-[220px] text-xs leading-relaxed text-slate-400">
                Thả ảnh khóa học hoặc chọn tệp
              </p>
            </div>
          )}
        </div>

        <div className="flex min-w-0 flex-1 flex-col justify-center">
          <p className="mb-3 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.14em] text-[#8037f4]">
            <span className="h-1.5 w-1.5 rounded-full bg-[#8037f4]" aria-hidden />
            Ưu tiên đánh giá
          </p>
          <h2 className="font-headline text-xl font-black leading-snug text-slate-900 sm:text-2xl">
            {course.title}
          </h2>
          <p className="mt-3 text-sm text-slate-500">
            Tác giả {course.mentor}
            <span className="mx-1.5 text-slate-300">·</span>
            {Number(course.participants || 0).toLocaleString("vi-VN")} học viên
            <span className="mx-1.5 text-slate-300">·</span>
            {formatCategoryShort(course.category)}
          </p>
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => onReview(course)}
              className="inline-flex items-center justify-center gap-1.5 rounded-full bg-slate-900 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-[#8037f4]"
            >
              <ClipboardList size={15} />
              Đánh giá ngay
            </button>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-[#8037f4]/12 px-3 py-1.5 text-[11px] font-bold text-[#8037f4] ring-1 ring-[#8037f4]/20">
              <span className="h-1.5 w-1.5 rounded-full bg-[#8037f4]" aria-hidden />
              Chưa đánh giá
            </span>
          </div>
        </div>
      </div>
    </motion.section>
  );
}

function PeerReviewStarRating({ value, onChange, label }) {
  return (
    <div className="flex items-center gap-0.5" role="group" aria-label={`${label}: ${value} sao`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          onClick={() => onChange(n)}
          className="rounded-md p-1 transition hover:scale-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#8037f4]/40"
          aria-label={`${n} sao`}
          aria-pressed={n <= value}
        >
          <Star
            size={22}
            className={n <= value ? "fill-amber-400 text-amber-400" : "text-slate-300"}
          />
        </button>
      ))}
    </div>
  );
}

const PeerReviewListRow = forwardRef(function PeerReviewListRow({ course, index, onReview }, ref) {
  const reviewed = course.status === "reviewed";
  const gradient = THUMB_GRADIENTS[index % THUMB_GRADIENTS.length];
  const hasCustomThumb = Boolean(String(course.cover || "").trim());

  const thumbInner = hasCustomThumb ? (
    <img src={mediaSrc(course.cover, DEFAULT_COURSE_THUMB)} alt="" className="h-full w-full object-cover" />
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
      <div className="absolute inset-0 flex items-center justify-center">
        <ImageIcon size={32} className="text-white/90" strokeWidth={1.5} />
      </div>
    </>
  );

  const statusBadge = (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold sm:text-[11px] ${
        reviewed
          ? "bg-[#93f72b]/30 text-slate-800 ring-1 ring-[#93f72b]/45"
          : "bg-[#8037f4]/12 text-[#8037f4] ring-1 ring-[#8037f4]/20"
      }`}
    >
      <span
        className={`h-1.5 w-1.5 shrink-0 rounded-full ${reviewed ? "bg-slate-800" : "bg-[#8037f4]"}`}
      />
      {reviewed ? "Đã đánh giá" : "Chưa đánh giá"}
    </span>
  );

  const ctaButton = reviewed ? (
    <button
      type="button"
      onClick={() => onReview(course)}
      className="inline-flex min-h-[44px] w-full items-center justify-center gap-1.5 rounded-xl border border-[#8037f4]/25 bg-white px-4 py-2.5 text-sm font-bold text-[#8037f4] transition hover:bg-[#8037f4]/5 lg:w-auto lg:min-h-0 lg:py-2.5 lg:text-xs"
    >
      <CheckCircle2 size={16} />
      Đã đánh giá
    </button>
  ) : (
    <button
      type="button"
      onClick={() => onReview(course)}
      className="peer-review-cta inline-flex min-h-[44px] w-full items-center justify-center gap-1.5 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-[#8037f4] lg:w-auto lg:min-h-0 lg:py-2.5 lg:text-xs"
    >
      <ClipboardList size={16} />
      Đánh giá ngay
    </button>
  );

  return (
    <motion.div
      ref={ref}
      layout
      initial="hidden"
      animate="visible"
      variants={listRowMotion}
      exit="exit"
      transition={{ layout: { duration: 0.26, ease: [0.22, 1, 0.36, 1] } }}
      className="max-lg:px-1 lg:border-b lg:border-slate-100 lg:last:border-b-0"
    >
      {/* Mobile card */}
      <div className="mentor-peer-row overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-[0_2px_12px_rgba(15,23,42,0.05)] lg:hidden">
        <div
          className={`relative h-36 w-full overflow-hidden ${
            hasCustomThumb ? "bg-slate-100" : `bg-gradient-to-br ${gradient}`
          }`}
        >
          {thumbInner}
        </div>
        <div className="p-4">
          <div className="flex flex-wrap items-center gap-2">{statusBadge}</div>
          <h3 className="mt-2.5 line-clamp-2 text-base font-bold leading-snug text-slate-900">
            {course.title}
          </h3>
          <p className="mt-1.5 text-sm text-slate-500">
            Tác giả {course.mentor}
            <span className="mx-1.5 text-slate-300">·</span>
            {formatCategoryShort(course.category)}
          </p>
          <div className="mt-4 grid grid-cols-2 gap-2.5">
            <div className="rounded-xl bg-slate-50 px-3 py-2.5">
              <div className="flex items-center gap-1.5 text-slate-500">
                <Users size={15} className="text-[#8037f4]" strokeWidth={2} />
                <span className="text-xs font-semibold">Học viên</span>
              </div>
              <p className="mentor-stat-num mt-1 text-xl text-slate-900">{course.participants}</p>
            </div>
            <div className="rounded-xl bg-slate-50 px-3 py-2.5">
              <div className="flex items-center gap-1.5 text-slate-500">
                <BookOpen size={15} className="text-[#8037f4]/70" strokeWidth={2} />
                <span className="text-xs font-semibold">Lĩnh vực</span>
              </div>
              <p className="mt-1 text-sm font-bold leading-snug text-slate-800">
                {formatCategoryShort(course.category)}
              </p>
            </div>
          </div>
          <div className="mt-4">{ctaButton}</div>
        </div>
      </div>

      {/* Desktop row */}
      <div className="mentor-peer-row group relative mx-1 hidden flex-col gap-4 px-3 py-4 sm:mx-2 sm:px-4 sm:py-4 lg:flex lg:flex-row lg:items-center">
        <div
          className={`relative h-[72px] w-[72px] shrink-0 overflow-hidden rounded-xl ${
            hasCustomThumb ? "bg-slate-100" : `bg-gradient-to-br ${gradient}`
          }`}
        >
          {thumbInner}
        </div>
        <div className="min-w-0 flex-1 lg:pr-4">
          <h3 className="line-clamp-2 text-sm font-bold leading-snug text-slate-900 transition-colors duration-200 group-hover:text-[#8037f4] sm:text-[15px]">
            {course.title}
          </h3>
          <p className="mt-1 text-xs text-slate-500">
            Tác giả {course.mentor}
            <span className="mx-1.5 text-slate-300">·</span>
            {formatCategoryShort(course.category)}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1.5 text-slate-600 lg:w-28 lg:justify-center">
          <Users size={15} className="shrink-0 text-[#8037f4]/70" strokeWidth={2} />
          <span className="text-sm font-bold text-slate-800">{course.participants}</span>
          <span className="text-xs text-slate-400">Học viên</span>
        </div>
        <div className="lg:w-36 lg:text-center">{statusBadge}</div>
        <div className="lg:w-40 lg:text-right">{ctaButton}</div>
      </div>
    </motion.div>
  );
});

export function MentorPeerReview() {
  const navigate = useNavigate();
  const user = getUser();
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [coursesForReview, setCoursesForReview] = useState([]);
  const [selectedCourse, setSelectedCourse] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [reviewForm, setReviewForm] = useState({
    contentRating: 5,
    qualityRating: 5,
    priceValueRating: 5,
    feedback: "",
  });

  useEffect(() => {
    if (!user || user.role !== "mentor") {
      navigate("/");
      return;
    }
    void (async () => {
      const res = await tryApi(() => fetchMentorPeerReviews(), {
        fallback: "Không tải được danh sách đánh giá chéo.",
      });
      if (!res.success || !Array.isArray(res.items)) {
        setCoursesForReview([]);
        return;
      }
      setCoursesForReview(
        res.items.map((item) => ({
          ...item,
          cover: item.cover || "",
          category: normalizePeerCategory(item.category),
        })),
      );
    })();
  }, [navigate, user]);

  const priorityCourse = useMemo(
    () => pickPriorityCourse(coursesForReview, category),
    [coursesForReview, category],
  );
  const showPriority = useMemo(
    () => priorityCourse && !search.trim() && (filter === "all" || filter === "pending"),
    [priorityCourse, search, filter],
  );
  const filtered = useMemo(
    () =>
      coursesForReview.filter((c) => {
        const matchesFilter = filter === "all" || c.status === filter;
        const q = search.toLowerCase();
        const matchesSearch =
          !q ||
          c.title.toLowerCase().includes(q) ||
          c.mentor.toLowerCase().includes(q);
        const matchesCategory = category === "all" || c.category === category;
        const hidePriority = showPriority && c.id === priorityCourse?.id;
        return matchesFilter && matchesSearch && matchesCategory && !hidePriority;
      }),
    [coursesForReview, filter, search, category, showPriority, priorityCourse],
  );
  const {
    visibleItems: visibleCourses,
    showExpandButton: showPeerExpandButton,
    expanded: peerListExpanded,
    toggleExpanded: togglePeerListExpanded,
  } = useMentorListExpand(filtered, `${filter}|${search}|${category}`);

  if (!user || user.role !== "mentor") return null;

  const pendingCount = coursesForReview.filter((c) => c.status === "pending").length;
  const reviewedCount = coursesForReview.filter((c) => c.status === "reviewed").length;
  const highScoreCount = coursesForReview.filter(
    (c) => c.status === "reviewed" && Number(c.rating) >= 4.5,
  ).length;
  const reviewedRows = coursesForReview.filter(
    (c) => c.status === "reviewed" && Number(c.rating) > 0,
  );
  const avgRating = reviewedRows.length
    ? (
        reviewedRows.reduce((sum, c) => sum + Number(c.rating || 0), 0) / reviewedRows.length
      ).toFixed(1)
    : "0.0";

  const startReview = (course) => {
    if (course.status === "reviewed") {
      toast.info("Khóa học này đã được bạn đánh giá rồi.");
      return;
    }
    setSelectedCourse(course);
    setReviewForm({
      contentRating: 5,
      qualityRating: 5,
      priceValueRating: 5,
      feedback: "",
    });
  };

  const submitReview = async () => {
    if (!selectedCourse?.id) return;
    setSubmitting(true);
    const res = await tryApi(() => submitMentorPeerReview(selectedCourse.id, reviewForm), {
      fallback: "Không gửi được đánh giá.",
      successMessage: "Đã gửi đánh giá chéo.",
    });
    setSubmitting(false);
    if (!res.success) return;
    setCoursesForReview((prev) =>
      prev.map((item) =>
        item.id === selectedCourse.id
          ? {
              ...item,
              status: "reviewed",
              rating: Number(res.review?.rating || item.rating || 0),
            }
          : item,
      ),
    );
    setSelectedCourse(null);
  };

  return (
    <MentorPageShell
      bottomPad="pb-20"
      showAmbient={false}
      className="!bg-[#f8f9fc]"
      extraStyles={PEER_ROW_STYLES}
    >
      <div className="relative z-10 mx-auto max-w-[1280px] px-4 pb-12 sm:px-6 lg:px-10">
        <motion.header
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
          className="mb-6 pt-2 sm:mb-8"
        >
          <h1 className="font-headline text-[clamp(1.75rem,4vw,2.75rem)] font-black leading-tight tracking-tight text-slate-900">
            Đánh giá <span className="text-[#8037f4]">chéo khóa học</span>
          </h1>
          <p className="mt-2 max-w-xl text-sm text-slate-500">
            Góp ý nội dung cho đồng nghiệp và nhận điểm thưởng.
          </p>
        </motion.header>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, delay: 0.06, ease: [0.22, 1, 0.36, 1] }}
        >
          <MentorStatMiniGrid>
            <MentorStatFrame
              index={1}
              compact
              accent="purple"
              value={String(pendingCount)}
              title="Cần đánh giá"
              cornerIcon={Clock}
            />
            <MentorStatFrame
              index={2}
              compact
              accent="lime"
              value={String(reviewedCount)}
              title="Đã hoàn thành"
              cornerIcon={CheckCircle2}
            />
            <MentorStatFrame
              index={3}
              compact
              accent="purple"
              value={String(highScoreCount)}
              title="Đánh giá điểm cao"
              cornerIcon={TrendingUp}
            />
            <MentorStatFrame
              index={4}
              compact
              accent="lime"
              value={avgRating}
              title="Điểm trung bình"
              cornerIcon={Star}
            />
          </MentorStatMiniGrid>
        </motion.div>

        {showPriority ? (
          <PriorityPeerReviewSpotlight course={priorityCourse} onReview={startReview} />
        ) : null}

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
          className="max-lg:space-y-3 lg:overflow-hidden lg:rounded-2xl lg:border lg:border-slate-200/90 lg:bg-white lg:shadow-[0_1px_3px_rgba(15,23,42,0.04)]"
        >
          <div className="flex flex-col gap-4 rounded-2xl border border-slate-200/90 bg-white px-4 py-4 shadow-[0_1px_3px_rgba(15,23,42,0.04)] sm:px-6 lg:rounded-none lg:border-0 lg:border-b lg:border-slate-100 lg:shadow-none">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <MentorScrollFadeRow innerClassName="flex gap-1" fadeFrom="from-white">
                {FILTER_TABS.map((tab) => {
                  const active = filter === tab.id;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setFilter(tab.id)}
                      className={`relative shrink-0 snap-start whitespace-nowrap px-3.5 py-2.5 text-sm sm:px-4 ${
                        active
                          ? "font-bold text-slate-900"
                          : "font-medium text-slate-500 hover:text-slate-700"
                      }`}
                    >
                      {tab.label}
                      {active && (
                        <motion.span
                          layoutId="mentorPeerTabUnderline"
                          className="absolute bottom-0 left-2 right-2 h-0.5 rounded-full bg-[#8037f4]"
                          transition={{ type: "spring", stiffness: 420, damping: 32 }}
                        />
                      )}
                    </button>
                  );
                })}
              </MentorScrollFadeRow>

              <div className="flex flex-wrap gap-1.5 lg:justify-end">
                {CATEGORIES.map((cat) => {
                  const active = category === cat;
                  return (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setCategory(cat)}
                      className={`rounded-full px-3.5 py-2.5 text-sm font-bold transition sm:px-4 ${
                        active
                          ? "bg-slate-900 text-white shadow-sm"
                          : "border border-slate-200 bg-white text-slate-600 hover:border-[#8037f4]/30 hover:text-[#8037f4]"
                      }`}
                    >
                      {formatCategory(cat)}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="relative w-full lg:max-w-xs">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
                aria-hidden
              />
              <input
                type="search"
                placeholder="Tìm khóa học hoặc mentor..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full min-h-[44px] rounded-xl border border-slate-200 bg-slate-50/80 py-2.5 pl-9 pr-4 text-base text-slate-900 outline-none placeholder:text-slate-400 focus:border-[#8037f4]/40 focus:bg-white focus:ring-2 focus:ring-[#8037f4]/15 sm:text-sm"
              />
            </div>
          </div>

          {coursesForReview.length === 0 ? (
            <div className="px-6 py-14 text-center">
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-[#8037f4]/10">
                <FileBadge size={22} className="text-[#8037f4]" />
              </div>
              <p className="text-sm font-medium text-slate-600">
                Hiện chưa có khóa học nào khả dụng để đánh giá chéo.
              </p>
            </div>
          ) : filtered.length > 0 ? (
            <motion.div
              key={`${filter}-${category}-${search}`}
              variants={listContainerMotion}
              initial="hidden"
              animate="visible"
              className="max-lg:space-y-3 lg:overflow-hidden lg:divide-y lg:divide-slate-100"
            >
              <AnimatePresence mode="popLayout">
                {visibleCourses.map((course, idx) => (
                  <PeerReviewListRow
                    key={course.id}
                    course={course}
                    index={idx}
                    onReview={startReview}
                  />
                ))}
              </AnimatePresence>
              {showPeerExpandButton ? (
                <MentorListExpandButton
                  expanded={peerListExpanded}
                  onToggle={togglePeerListExpanded}
                />
              ) : null}
            </motion.div>
          ) : !showPriority ? (
            <div className="px-6 py-14 text-center">
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-[#8037f4]/10">
                <FileBadge size={22} className="text-[#8037f4]" />
              </div>
              <p className="text-sm font-medium text-slate-600">
                Không có khóa học phù hợp với bộ lọc hiện tại.
              </p>
            </div>
          ) : null}
        </motion.div>
      </div>

      <AnimatePresence>
        {selectedCourse && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm sm:p-6"
            onClick={() => setSelectedCourse(null)}
          >
            <motion.div
              initial={{ scale: 0.96, y: 20, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              exit={{ scale: 0.96, y: 20, opacity: 0 }}
              transition={{ type: "spring", stiffness: 380, damping: 28 }}
              className="flex max-h-[min(92svh,640px)] w-full max-w-xl flex-col overflow-hidden rounded-2xl border border-[#8037f4]/15 bg-white shadow-xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="shrink-0 border-b border-slate-100 bg-gradient-to-r from-[#8037f4]/5 to-transparent px-5 py-4 sm:px-6 sm:py-5">
                <h3 className="text-lg font-bold text-slate-900 sm:text-base">Đánh giá chéo khóa học</h3>
                <p className="mt-0.5 line-clamp-2 text-sm text-slate-500 sm:line-clamp-1 sm:text-xs">{selectedCourse.title}</p>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto p-5 sm:p-6">
                <div className="mb-5 space-y-2 rounded-xl border border-slate-100 bg-slate-50 p-4">
                  <p className="line-clamp-3 text-xs text-slate-600">
                    {selectedCourse.description || "Chưa có mô tả chi tiết cho khóa học này."}
                  </p>
                  <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                    <span className="rounded-md border border-slate-200 bg-white px-2 py-0.5">
                      {selectedCourse.level || "Chưa rõ"}
                    </span>
                    <span>
                      {selectedCourse.isFree
                        ? "Miễn phí"
                        : formatVnd(selectedCourse.price || 0)}
                    </span>
                    <span>{Number(selectedCourse.lessonCount || 0)} bài học</span>
                  </div>
                  <div className="flex flex-wrap gap-3 pt-1">
                    <button
                      type="button"
                      onClick={() => navigate(`/courses/${selectedCourse.id}?peerReview=1`)}
                      className="inline-flex items-center gap-1.5 text-xs font-medium text-[#8037f4] hover:opacity-80"
                    >
                      <BookOpen size={12} /> Chi tiết đề cương
                    </button>
                    <button
                      type="button"
                      onClick={() => window.open(selectedCourse.videoUrl || "", "_blank")}
                      disabled={!selectedCourse.videoUrl}
                      className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-700 hover:opacity-80 disabled:opacity-40"
                    >
                      <PlayCircle size={13} /> Xem bài học
                    </button>
                  </div>
                </div>

                <div className="mb-4 space-y-3">
                  {[
                    ["contentRating", "Nội dung"],
                    ["qualityRating", "Chất lượng"],
                    ["priceValueRating", "Giá trị / Chi phí"],
                  ].map(([field, label]) => (
                    <div key={field} className="flex items-center justify-between gap-4">
                      <span className="text-sm font-semibold text-slate-700">{label}</span>
                      <PeerReviewStarRating
                        label={label}
                        value={reviewForm[field]}
                        onChange={(n) => setReviewForm((prev) => ({ ...prev, [field]: n }))}
                      />
                    </div>
                  ))}
                </div>

                <textarea
                  value={reviewForm.feedback}
                  onChange={(e) => setReviewForm((prev) => ({ ...prev, feedback: e.target.value }))}
                  placeholder="Nhận xét chi tiết (không bắt buộc)"
                  className="min-h-28 w-full rounded-xl border border-slate-200 bg-slate-50 p-3.5 text-base text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-[#8037f4]/40 focus:ring-2 focus:ring-[#8037f4]/15 sm:text-sm"
                />
              </div>

              <div className="flex shrink-0 gap-3 border-t border-slate-100 px-5 py-4 sm:px-6">
                <button
                  type="button"
                  onClick={() => setSelectedCourse(null)}
                  className="flex min-h-[44px] flex-1 items-center justify-center rounded-xl border border-slate-200 bg-white text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                >
                  Hủy
                </button>
                <button
                  type="button"
                  onClick={submitReview}
                  disabled={submitting}
                  className="flex min-h-[44px] flex-1 items-center justify-center rounded-xl bg-[#93f72b] text-sm font-bold text-slate-900 shadow-[0_6px_16px_rgba(147,247,43,0.35)] transition hover:brightness-105 disabled:opacity-50"
                >
                  {submitting ? "Đang gửi..." : "Gửi đánh giá"}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </MentorPageShell>
  );
}
