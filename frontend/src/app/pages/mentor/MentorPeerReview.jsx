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
  Sparkles,
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
  "from-slate-700 to-slate-900",
  "from-[#93f72b]/80 to-emerald-700",
  "from-indigo-600 to-violet-800",
];

const PEER_ROW_STYLES = `
  @keyframes mentor-peer-row-pulse {
    0% { transform: scale3d(1, 1, 1); }
    50% { transform: scale3d(1.008, 1.008, 1.008); }
    100% { transform: scale3d(1, 1, 1); }
  }
  .mentor-peer-row {
    transform-origin: center center;
    transition: background-color 0.2s ease, box-shadow 0.2s ease, transform 0.15s ease;
  }
  @media (hover: hover) and (pointer: fine) {
    .mentor-peer-row:hover {
      background-color: rgba(255, 255, 255, 0.03);
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
      animation: mentor-peer-row-pulse 0.9s ease-in-out;
    }
  }
  .mentor-peer-row:active {
    background-color: rgba(255, 255, 255, 0.04);
    transform: scale(0.994);
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
      className="mb-8 overflow-hidden rounded-2xl border border-white/10 bg-[#160f26]/85 p-6 shadow-[0_16px_48px_rgba(0,0,0,0.4)] backdrop-blur-xl sm:p-7"
    >
      <div className="flex flex-col gap-6 lg:flex-row lg:items-stretch">
        <div className="lg:w-[42%]">
          {hasCustomThumb ? (
            <div className="h-[200px] overflow-hidden rounded-xl border border-white/10 sm:h-[220px] lg:h-[240px]">
              <img
                src={mediaSrc(course.cover, DEFAULT_COURSE_THUMB)}
                alt=""
                className="h-full w-full object-cover"
              />
            </div>
          ) : (
            <div className="flex h-[200px] flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-white/20 bg-white/[0.02] px-4 text-center sm:h-[220px] lg:h-[240px]">
              <ImageIcon size={32} className="text-[#93f72b]/50" strokeWidth={1.5} />
              <p className="max-w-[220px] text-xs leading-relaxed text-slate-400">
                Ảnh khóa học của đồng nghiệp
              </p>
            </div>
          )}
        </div>

        <div className="flex min-w-0 flex-1 flex-col justify-center">
          <p className="mb-3 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.14em] text-[#93f72b]">
            <span className="h-1.5 w-1.5 rounded-full bg-[#93f72b]" aria-hidden />
            Ưu tiên đánh giá tuần này
          </p>
          <h2 className="font-headline text-xl font-black leading-snug text-white sm:text-2xl">
            {course.title}
          </h2>
          <p className="mt-3 text-sm text-slate-400">
            Tác giả <strong className="text-white">{course.mentor}</strong>
            <span className="mx-2 text-slate-600">·</span>
            {Number(course.participants || 0).toLocaleString("vi-VN")} học viên
            <span className="mx-2 text-slate-600">·</span>
            <span className="text-[#93f72b]">{formatCategoryShort(course.category)}</span>
          </p>
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => onReview(course)}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#93f72b] px-6 py-2.5 text-xs font-bold uppercase tracking-wider text-slate-950 shadow-[0_0_20px_rgba(147,247,43,0.35)] transition hover:bg-[#a8ff4e]"
            >
              <ClipboardList size={15} />
              Đánh giá ngay
            </button>
            <span className="inline-flex items-center gap-1.5 rounded-xl border border-[#93f72b]/30 bg-[#93f72b]/10 px-3.5 py-1.5 text-xs font-bold uppercase tracking-wider text-[#93f72b]">
              <span className="h-1.5 w-1.5 rounded-full bg-[#93f72b]" aria-hidden />
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
    <div className="flex items-center gap-1" role="group" aria-label={`${label}: ${value} sao`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          onClick={() => onChange(n)}
          className="rounded-md p-1 transition hover:scale-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#93f72b]/50"
          aria-label={`${n} sao`}
          aria-pressed={n <= value}
        >
          <Star
            size={22}
            className={n <= value ? "fill-amber-400 text-amber-400" : "text-white/20"}
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
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wider ${
        reviewed
          ? "border border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
          : "border border-[#93f72b]/30 bg-[#93f72b]/10 text-[#93f72b]"
      }`}
    >
      <span
        className={`h-1.5 w-1.5 shrink-0 rounded-full ${reviewed ? "bg-emerald-400" : "bg-[#93f72b]"}`}
      />
      {reviewed ? "Đã đánh giá" : "Chờ bạn góp ý"}
    </span>
  );

  const ctaButton = reviewed ? (
    <button
      type="button"
      onClick={() => onReview(course)}
      className="inline-flex min-h-[42px] w-full items-center justify-center gap-1.5 rounded-xl border border-white/15 bg-white/5 px-4 py-2 text-xs font-bold uppercase tracking-wider text-slate-300 transition hover:bg-white/10 hover:text-white lg:w-auto lg:min-h-0"
    >
      <CheckCircle2 size={15} className="text-emerald-400" />
      Xem lại góp ý
    </button>
  ) : (
    <button
      type="button"
      onClick={() => onReview(course)}
      className="peer-review-cta inline-flex min-h-[42px] w-full items-center justify-center gap-1.5 rounded-xl bg-[#93f72b] px-5 py-2 text-xs font-bold uppercase tracking-wider text-slate-950 shadow-[0_0_16px_rgba(147,247,43,0.3)] transition hover:bg-[#a8ff4e] lg:w-auto lg:min-h-0"
    >
      <ClipboardList size={15} />
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
      className="max-lg:px-1 lg:border-b lg:border-white/5 lg:last:border-b-0"
    >
      {/* Mobile card */}
      <div className="mentor-peer-row overflow-hidden rounded-2xl border border-white/10 bg-[#160f26]/85 p-4 shadow-lg lg:hidden">
        <div
          className={`relative h-36 w-full overflow-hidden rounded-xl ${
            hasCustomThumb ? "border border-white/10" : `bg-gradient-to-br ${gradient}`
          }`}
        >
          {thumbInner}
        </div>
        <div className="pt-4">
          <div className="flex flex-wrap items-center gap-2">{statusBadge}</div>
          <h3 className="mt-2.5 line-clamp-2 text-base font-bold leading-snug text-white">
            {course.title}
          </h3>
          <p className="mt-1.5 text-xs text-slate-400">
            Tác giả <strong className="text-white">{course.mentor}</strong>
            <span className="mx-2 text-slate-600">·</span>
            {formatCategoryShort(course.category)}
          </p>
          <div className="mt-4 grid grid-cols-2 gap-2.5">
            <div className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5">
              <div className="flex items-center gap-1.5 text-slate-400">
                <Users size={14} className="text-[#93f72b]" strokeWidth={2} />
                <span className="text-[11px] font-semibold">Học viên</span>
              </div>
              <p className="mt-1 text-lg font-bold text-white">{course.participants}</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5">
              <div className="flex items-center gap-1.5 text-slate-400">
                <BookOpen size={14} className="text-violet-400" strokeWidth={2} />
                <span className="text-[11px] font-semibold">Lĩnh vực</span>
              </div>
              <p className="mt-1 text-xs font-bold leading-snug text-white">
                {formatCategoryShort(course.category)}
              </p>
            </div>
          </div>
          <div className="mt-4">{ctaButton}</div>
        </div>
      </div>

      {/* Desktop row */}
      <div className="mentor-peer-row group relative mx-1 hidden flex-col gap-4 px-3 py-4 sm:mx-2 sm:px-5 sm:py-4 lg:flex lg:flex-row lg:items-center">
        <div
          className={`relative h-[68px] w-[68px] shrink-0 overflow-hidden rounded-xl border border-white/10 ${
            hasCustomThumb ? "" : `bg-gradient-to-br ${gradient}`
          }`}
        >
          {thumbInner}
        </div>
        <div className="min-w-0 flex-1 lg:pr-4">
          <h3 className="line-clamp-2 text-sm font-bold leading-snug text-white transition-colors duration-200 group-hover:text-[#93f72b]">
            {course.title}
          </h3>
          <p className="mt-1 text-xs text-slate-400">
            Tác giả <strong className="text-slate-200">{course.mentor}</strong>
            <span className="mx-2 text-slate-600">·</span>
            <span>{formatCategoryShort(course.category)}</span>
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1.5 text-slate-300 lg:w-28 lg:justify-center">
          <Users size={14} className="shrink-0 text-[#93f72b]" strokeWidth={2} />
          <span className="text-sm font-bold text-white">{course.participants}</span>
          <span className="text-xs text-slate-400">học viên</span>
        </div>
        <div className="lg:w-40 lg:text-center">{statusBadge}</div>
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
  }, [user, navigate]);

  const filtered = useMemo(() => {
    return coursesForReview.filter((course) => {
      if (filter === "pending" && course.status !== "pending") return false;
      if (filter === "reviewed" && course.status !== "reviewed") return false;
      if (category !== "all" && normalizePeerCategory(course.category) !== category) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        const titleMatch = course.title?.toLowerCase().includes(q);
        const mentorMatch = course.mentor?.toLowerCase().includes(q);
        if (!titleMatch && !mentorMatch) return false;
      }
      return true;
    });
  }, [coursesForReview, filter, category, search]);

  const {
    visibleItems: visibleCourses,
    showExpandButton: showPeerExpandButton,
    expanded: peerListExpanded,
    toggleExpanded: togglePeerListExpanded,
  } = useMentorListExpand(filtered, `${filter}-${category}-${search}`);

  const pendingCount = coursesForReview.filter((c) => c.status === "pending").length;
  const reviewedCount = coursesForReview.filter((c) => c.status === "reviewed").length;
  const highScoreCount = coursesForReview.filter((c) => c.status === "reviewed" && Number(c.rating || 0) >= 4.5).length;
  const avgRating = useMemo(() => {
    const list = coursesForReview.filter((c) => c.rating != null && Number(c.rating) > 0);
    if (!list.length) return "0.0";
    const sum = list.reduce((acc, c) => acc + Number(c.rating), 0);
    return (sum / list.length).toFixed(1);
  }, [coursesForReview]);

  const priorityCourse = useMemo(() => {
    if (filter === "reviewed") return null;
    return pickPriorityCourse(coursesForReview, category);
  }, [coursesForReview, filter, category]);

  const showPriority = Boolean(priorityCourse && !search.trim());

  const startReview = (course) => {
    setSelectedCourse(course);
    setReviewForm({
      contentRating: 5,
      qualityRating: 5,
      priceValueRating: 5,
      feedback: "",
    });
  };

  const submitReview = async () => {
    if (!selectedCourse) return;
    setSubmitting(true);
    const res = await tryApi(
      () =>
        submitMentorPeerReview(selectedCourse.id, {
          contentRating: reviewForm.contentRating,
          qualityRating: reviewForm.qualityRating,
          priceValueRating: reviewForm.priceValueRating,
          feedback: reviewForm.feedback,
        }),
      { fallback: "Không gửi được đánh giá chéo." },
    );
    setSubmitting(false);
    if (!res.success) return;
    toast.success("Đã gửi đánh giá chéo khóa học thành công!");
    setSelectedCourse(null);
    setCoursesForReview((prev) =>
      prev.map((c) =>
        c.id === selectedCourse.id
          ? {
              ...c,
              status: "reviewed",
              rating: (
                (reviewForm.contentRating +
                  reviewForm.qualityRating +
                  reviewForm.priceValueRating) /
                3
              ).toFixed(1),
            }
          : c,
      ),
    );
  };

  return (
    <MentorPageShell extraStyles={PEER_ROW_STYLES}>
      <div className="relative z-10 mx-auto max-w-6xl px-4 pb-12 sm:px-6 lg:px-8">
        <motion.header
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
          className="mb-8 pt-2"
        >
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-[#93f72b]/30 bg-[#93f72b]/10 px-3.5 py-1 text-xs font-bold uppercase tracking-wider text-[#93f72b]">
            <Sparkles size={13} /> Đánh Giá Chéo Khóa Học
          </div>
          <h1 className="text-3xl font-black leading-tight tracking-tight text-white sm:text-4xl">
            Đánh giá chéo <span className="text-[#93f72b]">đồng nghiệp</span>
          </h1>
          <p className="mt-2 max-w-xl text-sm text-violet-200/70">
            Góp ý chất lượng bài giảng cho các mentor khác và tích lũy điểm thưởng uy tín trong cộng đồng ProInterview.
          </p>
        </motion.header>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, delay: 0.06, ease: [0.22, 1, 0.36, 1] }}
          className="mb-8"
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
          className="rounded-2xl border border-white/10 bg-[#160f26]/85 shadow-[0_16px_48px_rgba(0,0,0,0.4)] backdrop-blur-xl overflow-hidden"
        >
          <div className="flex flex-col gap-4 border-b border-white/10 bg-white/[0.02] p-5 sm:p-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <MentorScrollFadeRow innerClassName="flex gap-1" fadeFrom="from-[#110c1e]">
                {FILTER_TABS.map((tab) => {
                  const active = filter === tab.id;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setFilter(tab.id)}
                      className={`relative shrink-0 snap-start whitespace-nowrap px-4 py-2 text-xs font-bold uppercase tracking-wider transition ${
                        active
                          ? "text-[#93f72b]"
                          : "text-slate-400 hover:text-white"
                      }`}
                    >
                      {tab.label}
                      {active && (
                        <motion.span
                          layoutId="mentorPeerTabUnderline"
                          className="absolute bottom-0 left-2 right-2 h-0.5 rounded-full bg-[#93f72b]"
                          transition={{ type: "spring", stiffness: 420, damping: 32 }}
                        />
                      )}
                    </button>
                  );
                })}
              </MentorScrollFadeRow>

              <div className="flex flex-wrap gap-2 lg:justify-end">
                {CATEGORIES.map((cat) => {
                  const active = category === cat;
                  return (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setCategory(cat)}
                      className={`rounded-full px-4 py-1.5 text-xs font-bold uppercase tracking-wider transition ${
                        active
                          ? "bg-[#93f72b] text-slate-950 shadow-[0_0_16px_rgba(147,247,43,0.35)]"
                          : "border border-white/10 bg-white/5 text-slate-300 hover:border-white/20 hover:bg-white/10 hover:text-white"
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
                className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
                aria-hidden
              />
              <input
                type="search"
                placeholder="Tìm khóa học hoặc mentor..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full min-h-[42px] rounded-xl border border-white/15 bg-[#10091e] py-2 pl-9 pr-4 text-sm text-white outline-none placeholder:text-slate-500 transition focus:border-[#93f72b] focus:ring-2 focus:ring-[#93f72b]/20"
              />
            </div>
          </div>

          {coursesForReview.length === 0 ? (
            <div className="px-6 py-20 text-center">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-[#93f72b]/30 bg-[#93f72b]/10 text-[#93f72b]">
                <FileBadge size={26} />
              </div>
              <h3 className="text-base font-bold text-white mb-1.5">
                Chưa có khóa học nào cần đánh giá chéo
              </h3>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">
                Hiện tại tất cả khóa học của đồng nghiệp đã được đánh giá hoặc chưa có yêu cầu mới. Hãy quay lại sau nhé!
              </p>
            </div>
          ) : filtered.length > 0 ? (
            <motion.div
              key={`${filter}-${category}-${search}`}
              variants={listContainerMotion}
              initial="hidden"
              animate="visible"
              className="divide-y divide-white/5"
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
            <div className="px-6 py-20 text-center">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-slate-400">
                <FileBadge size={26} />
              </div>
              <h3 className="text-base font-bold text-white mb-1.5">
                Không tìm thấy khóa học phù hợp
              </h3>
              <p className="text-xs text-slate-400">
                Hãy thử đổi từ khóa tìm kiếm hoặc chọn danh mục lĩnh vực khác.
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
            className="fixed inset-0 z-[200] flex items-center justify-center bg-black/75 p-4 backdrop-blur-md sm:p-6"
            onClick={() => setSelectedCourse(null)}
          >
            <motion.div
              initial={{ scale: 0.96, y: 20, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              exit={{ scale: 0.96, y: 20, opacity: 0 }}
              transition={{ type: "spring", stiffness: 380, damping: 28 }}
              className="flex max-h-[min(92svh,660px)] w-full max-w-xl flex-col overflow-hidden rounded-2xl border border-white/15 bg-[#160f26] shadow-[0_24px_64px_rgba(0,0,0,0.8)] text-white"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="shrink-0 border-b border-white/10 bg-white/[0.02] px-6 py-5">
                <h3 className="text-base font-bold text-white">Đánh giá chéo khóa học</h3>
                <p className="mt-1 line-clamp-1 text-xs text-slate-400">{selectedCourse.title}</p>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto p-6 space-y-5">
                <div className="rounded-xl border border-white/10 bg-[#10091e] p-4 space-y-3">
                  <p className="line-clamp-3 text-xs leading-relaxed text-slate-300">
                    {selectedCourse.description || "Chưa có mô tả chi tiết cho khóa học này."}
                  </p>
                  <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
                    <span className="rounded-md border border-white/10 bg-white/5 px-2.5 py-0.5 text-slate-300">
                      Cấp độ: {selectedCourse.level || "Chưa rõ"}
                    </span>
                    <span>
                      {selectedCourse.isFree
                        ? "Miễn phí"
                        : formatVnd(selectedCourse.price || 0)}
                    </span>
                    <span>·</span>
                    <span>{Number(selectedCourse.lessonCount || 0)} bài học</span>
                  </div>
                  <div className="flex flex-wrap gap-3 pt-1 border-t border-white/5">
                    <button
                      type="button"
                      onClick={() => navigate(`/courses/${selectedCourse.id}?peerReview=1`)}
                      className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#93f72b] hover:underline"
                    >
                      <BookOpen size={13} /> Chi tiết đề cương
                    </button>
                    <button
                      type="button"
                      onClick={() => window.open(selectedCourse.videoUrl || "", "_blank")}
                      disabled={!selectedCourse.videoUrl}
                      className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-300 hover:text-white disabled:opacity-40"
                    >
                      <PlayCircle size={14} /> Xem video bài giảng
                    </button>
                  </div>
                </div>

                <div className="space-y-3.5">
                  {[
                    ["contentRating", "Chất lượng nội dung kiến thức"],
                    ["qualityRating", "Chất lượng hình ảnh & âm thanh video"],
                    ["priceValueRating", "Độ hợp lý giá bán / Giá trị mang lại"],
                  ].map(([field, label]) => (
                    <div key={field} className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:justify-between">
                      <span className="text-xs font-semibold text-slate-300">{label}</span>
                      <PeerReviewStarRating
                        label={label}
                        value={reviewForm[field]}
                        onChange={(n) => setReviewForm((prev) => ({ ...prev, [field]: n }))}
                      />
                    </div>
                  ))}
                </div>

                <div>
                  <label className="block mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
                    Nhận xét & Góp ý chi tiết cho đồng nghiệp:
                  </label>
                  <textarea
                    value={reviewForm.feedback}
                    onChange={(e) => setReviewForm((prev) => ({ ...prev, feedback: e.target.value }))}
                    placeholder="Chia sẻ nhận xét mang tính xây dựng về bài giảng, cách trình bày, slide hoặc cấu trúc khóa học..."
                    className="min-h-28 w-full rounded-xl border border-white/15 bg-[#10091e] p-3.5 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-[#93f72b] focus:ring-2 focus:ring-[#93f72b]/20"
                  />
                </div>
              </div>

              <div className="flex shrink-0 gap-3 border-t border-white/10 bg-white/[0.01] px-6 py-4">
                <button
                  type="button"
                  onClick={() => setSelectedCourse(null)}
                  className="flex min-h-[42px] flex-1 items-center justify-center rounded-xl border border-white/15 bg-white/5 text-xs font-bold uppercase tracking-wider text-slate-300 transition hover:bg-white/10 hover:text-white"
                >
                  Hủy
                </button>
                <button
                  type="button"
                  onClick={submitReview}
                  disabled={submitting}
                  className="flex min-h-[42px] flex-1 items-center justify-center rounded-xl bg-[#93f72b] text-xs font-bold uppercase tracking-wider text-slate-950 shadow-[0_0_20px_rgba(147,247,43,0.35)] transition hover:bg-[#a8ff4e] disabled:opacity-50"
                >
                  {submitting ? "Đang gửi..." : "Gửi góp ý"}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </MentorPageShell>
  );
}
