import React, { useState } from "react";
import { useParams, useNavigate } from "react-router";
import {
  ArrowLeft,
  Star,
  Clock,
  Users,
  PlayCircle,
  BookOpen,
  CheckCircle,
  Lock,
  BadgeCheck as SealCheck,
  GraduationCap,
  Zap as Lightning,
  ChevronDown as CaretDown,
  ChevronUp as CaretUp,
  ShoppingCart,
  Heart,
  Share2 as ShareNetwork,
  Calendar as CalendarBlank,
  Trophy,
  Award as Certificate,
  BarChart3 as ChartBar,
  AlertCircle as WarningCircle,
  Sparkles as Sparkle,
  ArrowRight,
  Target,
  Video,
  ListChecks,
  User as UserCircle,
  ThumbsUp,
  MessageCircle,
  Pencil,
  X,
} from "lucide-react";
import { getCourseById, getRelatedCourses, MENTOR_REVIEWERS } from "../data/coursesData";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "../components/ui/dialog";

/* ── Helpers ─────────────────────────────────────────────── */
const formatPrice = (price) => {
  if (price === 0) return "Miễn phí";
  return new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(price);
};
const formatDuration = (minutes) => {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? `${h}h ${m > 0 ? m + "m" : ""}`.trim() : `${m}m`;
};
const getLevelLabel = (level) =>
  level === "Beginner" ? "Cơ bản" : level === "Intermediate" ? "Trung cấp" : "Nâng cao";
const getLevelColor = (level) => {
  if (level === "Beginner") return { bg: "rgba(180,240,0,0.12)", text: "#4A7A00", border: "rgba(180,240,0,0.3)" };
  if (level === "Intermediate") return { bg: "rgba(110, 53, 232,0.1)", text: "#6E35E8", border: "rgba(110, 53, 232,0.25)" };
  return { bg: "rgba(255,140,66,0.12)", text: "#CC5C00", border: "rgba(255,140,66,0.35)" };
};

/* ── Lesson Row ───────────────────────────────────────────── */
function LessonRow({ lesson, index }) {
  return (
    <div
      className="flex items-center gap-4 py-3 px-4 rounded-xl transition-all"
      style={{ background: lesson.isPreview ? "rgba(180,240,0,0.04)" : "transparent" }}
    >
      <div
        className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 text-sm font-bold"
        style={{
          background: lesson.isPreview ? "rgba(180,240,0,0.15)" : "rgba(110, 53, 232,0.08)",
          color: lesson.isPreview ? "#4A7A00" : "#6E35E8",
        }}
      >
        {index + 1}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-900 truncate">{lesson.title}</p>
        <p className="text-xs text-gray-400 mt-0.5">{formatDuration(lesson.duration)}</p>
      </div>
      {lesson.isPreview ? (
        <span
          className="text-xs font-bold px-2.5 py-1 rounded-lg flex items-center gap-1 shrink-0"
          style={{ background: "rgba(180,240,0,0.15)", color: "#4A7A00" }}
        >
          <PlayCircle className="w-3.5 h-3.5" />
          Preview
        </span>
      ) : (
        <Lock className="w-4 h-4 text-gray-300 shrink-0" />
      )}
    </div>
  );
}

/* ── Star Rating ──────────────────────────────────────────── */
function StarRating({ rating, size = "sm" }) {
  const s = size === "lg" ? "w-5 h-5" : "w-4 h-4";
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          fill={i <= Math.round(rating) ? "#FFD600" : "none"}
          className={s}
          style={{ color: "#FFD600" }}
        />
      ))}
    </div>
  );
}

/* ── Mock Student Reviews ─────────────────────────────────── */
const STUDENT_REVIEWS = [
  {
    id: "sr1",
    name: "Nguyễn Minh Khoa",
    avatar: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=80&q=80",
    role: "Backend Developer tại Tiki",
    rating: 5,
    comment: "Khóa học cực kỳ thực tế và chi tiết. Sau khi hoàn thành, mình đã pass phỏng vấn vòng behavioral tại Shopee. Cảm ơn mentor rất nhiều Phương pháp STAR được giải thích rõ ràng và có nhiều ví dụ thực tế từ ngành IT.",
    date: "2024-03-15",
    helpful: 24,
    verified: true,
  },
  {
    id: "sr2",
    name: "Trần Thị Lan Anh",
    avatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=80&q=80",
    role: "Product Manager",
    rating: 5,
    comment: "Nội dung rất bổ ích, đặc biệt phần về cách đo lường impact trong câu trả lời. Trước đây mình hay trả lời chung chung, giờ đã biết cách nêu số liệu cụ thể. Phỏng vấn tự tin hơn hẳn!",
    date: "2024-03-10",
    helpful: 18,
    verified: true,
  },
  {
    id: "sr3",
    name: "Lê Quốc Hùng",
    avatar: "https://images.unsplash.com/photo-1527980965255-d3b416303d12?w=80&q=80",
    role: "Frontend Engineer",
    rating: 4,
    comment: "Khóa học tốt, nội dung có chiều sâu. Mình chỉ muốn có thêm ví dụ về câu hỏi conflict resolution cụ thể hơn trong môi trư���ng tech. Nhìn chung rất đáng tiền đầu tư.",
    date: "2024-03-05",
    helpful: 11,
    verified: true,
  },
  {
    id: "sr4",
    name: "Phạm Thu Hà",
    avatar: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=80&q=80",
    role: "Data Analyst",
    rating: 5,
    comment: "Mentor giải thích rất tốt, cách trình bày dễ hiểu. Mình đã áp dụng ngay vào phỏng vấn thực và nhận được offer từ VNG. Chứng chỉ sau khi hoàn thành cũng rất chuyên nghiệp.",
    date: "2024-02-28",
    helpful: 32,
    verified: true,
  },
  {
    id: "sr5",
    name: "Hoàng Đức Anh",
    avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=80&q=80",
    role: "DevOps Engineer",
    rating: 4,
    comment: "Nội dung chất lượng cao, phù hợp cho cả fresher lẫn senior. Mình đặc biệt thích phần về cách chuẩn bị portfolio câu hỏi và các mẫu trả lời. Rất recommend!",
    date: "2024-02-20",
    helpful: 15,
    verified: false,
  },
];

/* ── Reviews Section ──────────────────────────────────────── */
function ReviewsSection({ course, enrolled }) {
  const [showReviewDialog, setShowReviewDialog] = useState(false);
  const [reviewRating, setReviewRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [reviewComment, setReviewComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmitReview = () => {
    if (!reviewRating || !reviewComment.trim()) return;
    setSubmitting(true);
    setTimeout(() => {
      setSubmitting(false);
      setSubmitted(true);
      setShowReviewDialog(false);
      // Reset form after closing
      setTimeout(() => {
        setReviewRating(0);
        setReviewComment("");
        setHoverRating(0);
      }, 300);
    }, 900);
  };

  const handleCloseDialog = () => {
    setShowReviewDialog(false);
    setReviewRating(0);
    setReviewComment("");
    setHoverRating(0);
  };

  return (
    <div className="space-y-6">
      {/* Rating summary */}
      <div className="bg-white rounded-3xl p-6 border border-gray-100">
        <div className="flex items-center gap-8 mb-6">
          <div className="text-center">
            <p
              className="font-bold mb-1"
              style={{ fontSize: "3rem", lineHeight: 1, color: "#6E35E8" }}
            >
              {course.rating}
            </p>
            <StarRating rating={course.rating} size="lg" />
            <p className="text-xs text-gray-400 mt-1">{course.reviewsCount} đánh giá</p>
          </div>
          <div className="flex-1">
            {[5, 4, 3, 2, 1].map((star) => (
              <div key={star} className="flex items-center gap-3 mb-1.5">
                <div className="flex items-center gap-1 w-6 shrink-0">
                  <span className="text-xs text-gray-500">{star}</span>
                  <Star className="w-3 h-3 text-[#FFD600]" />
                </div>
                <div className="flex-1 bg-gray-100 rounded-full h-2 overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: star === 5 ? "72%" : star === 4 ? "20%" : star === 3 ? "6%" : star === 2 ? "1.5%" : "0.5%",
                      background: "linear-gradient(90deg, #6E35E8, #8B4DFF)",
                    }}
                  />
                </div>
                <span className="text-xs text-gray-400 w-8 shrink-0 text-right">
                  {star === 5 ? "72%" : star === 4 ? "20%" : star === 3 ? "6%" : star === 2 ? "2%" : "0%"}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Add review button if enrolled - Prominent at top */}
        {enrolled && !submitted && (
          <button
            onClick={() => setShowReviewDialog(true)}
            className="w-full py-3.5 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 transition-all hover:brightness-105"
            style={{ background: "linear-gradient(135deg, #6E35E8, #8B4DFF)", color: "#fff" }}
          >
            <PencilSimple className="w-4 h-4" />
            Viết đánh giá cho khóa học này
          </button>
        )}

        {/* Success message */}
        {submitted && (
          <div
            className="p-4 rounded-2xl flex items-center gap-3"
            style={{ background: "rgba(180,240,0,0.08)", border: "1px solid rgba(180,240,0,0.25)" }}
          >
            <CheckCircle className="w-5 h-5 text-[#4A7A00]" />
            <div>
              <p className="font-bold text-[#4A7A00] text-sm">Đánh giá đã được gửi thành công</p>
              <p className="text-xs text-gray-500 mt-0.5">Cảm ơn bạn đã chia sẻ trải nghiệm. Đánh giá sẽ hiển thị sau khi được kiểm duyệt.</p>
            </div>
          </div>
        )}
      </div>

      {/* Peer reviews from mentors */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <Sparkle className="w-5 h-5 text-[#6E35E8]" />
          <h3 className="font-bold text-gray-900">Đánh giá từ Mentor chuyên nghiệp</h3>
          <span
            className="text-xs font-bold px-2 py-0.5 rounded-full"
            style={{ background: "rgba(180,240,0,0.15)", color: "#4A7A00" }}
          >
            Peer Review
          </span>
        </div>
        <p className="text-sm text-gray-500 mb-4">
          Các khóa học được đánh giá chéo bởi các mentor khác trong hệ thống, đảm bảo chất lượng và độ chính xác.
        </p>

        <div className="space-y-4">
          {(course.reviews || []).map((review) => (
            <div
              key={review.id}
              className="bg-white rounded-2xl p-5 border border-gray-100 hover:border-[rgba(110, 53, 232,0.2)] transition-all"
            >
              <div className="flex items-start gap-4">
                <img
                  src={review.mentorAvatar}
                  alt={review.mentorName}
                  className="w-12 h-12 rounded-full object-cover shrink-0"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className="font-bold text-gray-900">{review.mentorName}</span>
                    {review.verified && (
                      <span
                        className="flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full"
                        style={{ background: "rgba(110, 53, 232,0.1)", color: "#6E35E8" }}
                      >
                        <SealCheck className="w-3 h-3" />
                        Verified Mentor
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 mb-2">{review.mentorTitle}</p>
                  <StarRating rating={review.rating} />
                  <p className="text-sm text-gray-700 mt-3 leading-relaxed">{review.comment}</p>
                  <p className="text-xs text-gray-400 mt-2">
                    {new Date(review.createdAt).toLocaleDateString("vi-VN", {
                      day: "numeric",
                      month: "long",
                      year: "numeric",
                    })}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Student reviews */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <ThumbsUp className="w-5 h-5 text-[#6E35E8]" />
          <h3 className="font-bold text-gray-900">Đánh giá từ Học viên</h3>
        </div>
        <p className="text-sm text-gray-500 mb-4">
          Những đánh giá chân thật từ học viên đã hoàn thành khóa học.
        </p>

        <div className="space-y-4">
          {STUDENT_REVIEWS.map((review) => (
            <div
              key={review.id}
              className="bg-white rounded-2xl p-5 border border-gray-100 hover:border-[rgba(110, 53, 232,0.2)] transition-all"
            >
              <div className="flex items-start gap-4">
                <img
                  src={review.avatar}
                  alt={review.name}
                  className="w-12 h-12 rounded-full object-cover shrink-0"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className="font-bold text-gray-900">{review.name}</span>
                    {review.verified && (
                      <span
                        className="flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full"
                        style={{ background: "rgba(110, 53, 232,0.1)", color: "#6E35E8" }}
                      >
                        <SealCheck className="w-3 h-3" />
                        Verified Student
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 mb-2">{review.role}</p>
                  <StarRating rating={review.rating} />
                  <p className="text-sm text-gray-700 mt-3 leading-relaxed">{review.comment}</p>
                  <p className="text-xs text-gray-400 mt-2">
                    {new Date(review.date).toLocaleDateString("vi-VN", {
                      day: "numeric",
                      month: "long",
                      year: "numeric",
                    })}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* CTA to add review if enrolled */}
        {enrolled && !submitted && (
          <div
            className="mt-5 p-6 rounded-3xl cursor-pointer hover:brightness-95 transition-all"
            style={{ 
              background: "linear-gradient(135deg, rgba(110, 53, 232,0.06), rgba(139, 77, 255,0.02))", 
              border: "2px dashed rgba(110, 53, 232,0.2)" 
            }}
            onClick={() => setShowReviewDialog(true)}
          >
            <div className="flex items-center gap-4">
              <div
                className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0"
                style={{ background: "linear-gradient(135deg, #6E35E8, #8B4DFF)" }}
              >
                <PencilSimple className="w-6 h-6 text-white" />
              </div>
              <div className="flex-1">
                <p className="font-bold text-gray-900 mb-1">Chia sẻ trải nghiệm của bạn</p>
                <p className="text-sm text-gray-600">
                  Bạn đã hoàn thành khóa học? Hãy viết đánh giá để giúp học viên khác đưa ra quyết định đúng đắn.
                </p>
              </div>
              <ArrowRight className="w-5 h-5 text-[#6E35E8] shrink-0" />
            </div>
          </div>
        )}
      </div>

      {/* Review Dialog */}
      <Dialog open={showReviewDialog} onOpenChange={setShowReviewDialog}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-gray-900 flex items-center gap-2">
              <PencilSimple className="w-5 h-5 text-[#6E35E8]" />
              Đánh giá khóa học
            </DialogTitle>
            <DialogDescription className="text-sm text-gray-500">
              Chia sẻ trải nghiệm của bạn để giúp học viên khác có cái nhìn đúng đắn hơn về khóa học.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5 mt-4">
            {/* Course info quick reference */}
            <div className="flex items-center gap-3 p-3 rounded-xl bg-gray-50">
              <img
                src={course.thumbnail}
                alt={course.title}
                className="w-16 h-16 rounded-xl object-cover shrink-0"
              />
              <div className="flex-1 min-w-0">
                <p className="font-bold text-gray-900 text-sm truncate">{course.title}</p>
                <p className="text-xs text-gray-500 mt-0.5">Bởi {course.mentorName}</p>
              </div>
            </div>

            {/* Star rating picker */}
            <div>
              <p className="text-sm font-medium text-gray-700 mb-3">
                Bạn đánh giá khóa học này mấy sao?
                <span className="text-red-400 ml-1">*</span>
              </p>
              <div className="flex gap-2">
                {[1, 2, 3, 4, 5].map((s) => (
                  <button
                    key={s}
                    onClick={() => setReviewRating(s)}
                    onMouseEnter={() => setHoverRating(s)}
                    onMouseLeave={() => setHoverRating(0)}
                    className="transition-transform hover:scale-110 active:scale-95"
                  >
                    <Star
                      fill={s <= (hoverRating || reviewRating) ? "#FFD600" : "none"}
                      className="w-10 h-10"
                      style={{ color: s <= (hoverRating || reviewRating) ? "#FFD600" : "#d1d5db" }}
                    />
                  </button>
                ))}
              </div>
              {reviewRating > 0 && (
                <p className="text-sm mt-2 font-bold" style={{ color: "#6E35E8" }}>
                  {reviewRating === 5 
                    ? "⭐ Xuất sắc Khóa học vượt mong đợi" 
                    : reviewRating === 4 
                    ? "😊 Rất tốt Khóa học chất lượng cao" 
                    : reviewRating === 3 
                    ? "🙂 Tốt Khóa học đáp ứng được" 
                    : reviewRating === 2 
                    ? "😐 Chưa tốt, cần cải thiện" 
                    : "😞 Không đạt mong đợi"}
                </p>
              )}
            </div>

            {/* Comment textarea */}
            <div>
              <label className="text-sm font-medium text-gray-700 mb-2 block">
                Chia sẻ trải nghiệm của bạn
                <span className="text-red-400 ml-1">*</span>
              </label>
              <textarea
                value={reviewComment}
                onChange={(e) => setReviewComment(e.target.value)}
                placeholder="Khóa học đã giúp bạn cải thiện điều gì? Điểm nổi bật nhất là gì? Bạn có đề xuất gì cho mentor không?..."
                rows={5}
                className="w-full rounded-2xl px-4 py-3 text-sm border border-gray-200 outline-none resize-none transition-all leading-relaxed focus:border-[#6E35E8] focus:ring-2 focus:ring-[rgba(110, 53, 232,0.1)]"
                style={{ background: "#fafafa" }}
                maxLength={800}
              />
              <div className="flex justify-between mt-1.5">
                <p 
                  className="text-xs"
                  style={{ 
                    color: reviewComment.length >= 30 ? "#4A7A00" : reviewComment.length > 0 ? "#CC5C00" : "#9ca3af" 
                  }}
                >
                  {reviewComment.length >= 30 
                    ? "✓ Đủ độ dài để gửi" 
                    : "Tối thiểu 30 ký tự để đánh giá được chấp thuận"}
                </p>
                <p className="text-xs text-gray-400">{reviewComment.length}/800</p>
              </div>
            </div>

            {/* Submit buttons */}
            <div className="flex gap-3 pt-2">
              <button
                onClick={handleCloseDialog}
                disabled={submitting}
                className="flex-1 py-3 rounded-xl text-sm font-medium border border-gray-200 text-gray-600 hover:bg-gray-50 transition-all disabled:opacity-40"
              >
                Huỷ
              </button>
              <button
                onClick={handleSubmitReview}
                disabled={!reviewRating || reviewComment.trim().length < 30 || submitting}
                className="flex-1 py-3 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-all hover:brightness-105 disabled:opacity-40 disabled:cursor-not-allowed"
                style={{ background: "linear-gradient(135deg, #6E35E8, #8B4DFF)", color: "#fff" }}
              >
                {submitting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Đang gửi...
                  </>
                ) : (
                  <>
                    <ChatCircle className="w-4 h-4" />
                    Gửi đánh giá
                  </>
                )}
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ── Main Component ───────────────────────────────────────── */
export function CourseDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("overview");
  const [showAllLessons, setShowAllLessons] = useState(false);
  const [enrolled, setEnrolled] = useState(true); // Temporarily true for testing review dialog
  const [wishlisted, setWishlisted] = useState(false);

  const course = getCourseById(id || "");

  if (!course) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <BookOpen className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-gray-900 mb-2">Không tìm thấy khóa học</h2>
          <button
            onClick={() => navigate("/courses")}
            className="px-6 py-3 bg-[#6E35E8] text-white rounded-xl font-semibold hover:bg-[#8B4DFF] transition-colors"
          >
            Quay lại danh sách
          </button>
        </div>
      </div>
    );
  }

  const relatedCourses = getRelatedCourses(course.id, course.category, 3);
  const levelColor = getLevelColor(course.level);
  const displayedLessons = showAllLessons ? (course.lessons || []) : (course.lessons || []).slice(0, 5);
  const mentorOtherCourses = getRelatedCourses("", course.category, 2);

  const TABS = [
    { key: "overview", label: "Tổng quan", icon: ListChecks },
    { key: "curriculum", label: "Nội dung", icon: BookOpen },
    { key: "instructor", label: "Giảng viên", icon: UserCircle },
    { key: "reviews", label: `Đánh giá (${(course.reviews || []).length + STUDENT_REVIEWS.length})`, icon: Star },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ── Hero ────────────────────────────────────────────── */}
      <div
        className="relative overflow-hidden"
        style={{ background: "linear-gradient(135deg, #1a0a3e 0%, #2d1060 50%, #1F1F1F 100%)" }}
      >
        {/* BG blobs */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 left-1/4 w-96 h-96 rounded-full opacity-10 blur-3xl" style={{ background: "#6E35E8" }} />
          <div className="absolute bottom-0 right-1/4 w-64 h-64 rounded-full opacity-10 blur-3xl" style={{ background: "#B4F000" }} />
        </div>

        <div className="relative max-w-7xl mx-auto px-6 pt-8 pb-16">
          {/* Breadcrumb */}
          <button
            onClick={() => navigate("/courses")}
            className="flex items-center gap-2 text-white/60 hover:text-white transition-colors mb-8 text-sm"
          >
            <ArrowLeft className="w-4 h-4" />
            Quay lại khóa học
          </button>

          <div className="grid lg:grid-cols-[1fr_380px] gap-10 items-start">
            {/* Left: Course Info */}
            <div>
              {/* Category + Level badges */}
              <div className="flex items-center gap-2 mb-4 flex-wrap">
                <span
                  className="text-xs font-bold px-3 py-1 rounded-full"
                  style={{ background: "rgba(180,240,0,0.15)", color: "#B4F000", border: "1px solid rgba(180,240,0,0.25)" }}
                >
                  {course.category}
                </span>
                <span
                  className="text-xs font-bold px-3 py-1 rounded-full"
                  style={{ background: levelColor.bg, color: levelColor.text, border: `1px solid ${levelColor.border}` }}
                >
                  {getLevelLabel(course.level)}
                </span>
              </div>

              <h1 className="text-3xl md:text-4xl font-bold text-white mb-4 leading-tight">
                {course.title}
              </h1>
              <p className="text-white/70 text-base mb-6 leading-relaxed max-w-2xl">
                {course.description}
              </p>

              {/* Rating row */}
              <div className="flex items-center gap-6 mb-6 flex-wrap">
                <div className="flex items-center gap-2">
                  <StarRating rating={course.rating} />
                  <span className="font-bold text-[#FFD600]">{course.rating}</span>
                  <span className="text-white/50 text-sm">({course.reviewsCount} đánh giá)</span>
                </div>
                <div className="flex items-center gap-1.5 text-white/60 text-sm">
                  <Users className="w-4 h-4" />
                  <span>{course.studentsCount.toLocaleString()} học viên</span>
                </div>
                <div className="flex items-center gap-1.5 text-white/60 text-sm">
                  <Clock className="w-4 h-4" />
                  <span>{formatDuration(course.duration)}</span>
                </div>
                <div className="flex items-center gap-1.5 text-white/60 text-sm">
                  <BookOpen className="w-4 h-4" />
                  <span>{course.lessonsCount} bài học</span>
                </div>
              </div>

              {/* Mentor info */}
              <div className="flex items-center gap-3">
                <img
                  src={course.mentorAvatar}
                  alt={course.mentorName}
                  className="w-12 h-12 rounded-full object-cover border-2 border-white/20"
                />
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-white font-semibold">{course.mentorName}</span>
                    <SealCheck className="w-4 h-4 text-[#B4F000]" />
                  </div>
                  <p className="text-white/55 text-sm">{course.mentorTitle} · {course.mentorCompany}</p>
                </div>
              </div>
            </div>

            {/* Right: Sticky Enrollment Card */}
            <div
              className="rounded-3xl overflow-hidden shadow-2xl border"
              style={{ border: "1px solid rgba(255,255,255,0.12)", background: "rgba(255,255,255,0.97)" }}
            >
              {/* Thumbnail preview */}
              <div className="relative h-48 overflow-hidden">
                <img src={course.thumbnail} alt={course.title} className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                  <div
                    className="w-16 h-16 rounded-full flex items-center justify-center cursor-pointer hover:scale-105 transition-transform shadow-xl"
                    style={{ background: "rgba(110, 53, 232,0.9)" }}
                  >
                    <PlayCircle className="w-8 h-8 text-white" />
                  </div>
                </div>
                <div
                  className="absolute top-3 left-3 text-xs font-bold px-2.5 py-1 rounded-full"
                  style={{ background: "#B4F000", color: "#1F1F1F" }}
                >
                  Xem trước miễn phí
                </div>
              </div>

              <div className="p-6">
                {/* Price */}
                <div className="flex items-end gap-2 mb-4">
                  <span className="text-2xl font-bold text-[#6E35E8]">{formatPrice(course.price)}</span>
                  {course.price > 0 && (
                    <span className="text-xs text-gray-400 line-through mb-1">
                      {formatPrice(Math.round(course.price * 1.4))}
                    </span>
                  )}
                  {course.price > 0 && (
                    <span
                      className="text-xs font-bold px-2 py-0.5 rounded-lg mb-1"
                      style={{ background: "rgba(255,140,66,0.12)", color: "#CC5C00" }}
                    >
                      -28%
                    </span>
                  )}
                </div>

                {/* CTAs */}
                <div className="space-y-2.5 mb-4">
                  {enrolled ? (
                    <button
                      onClick={() => navigate(`/courses/${course.id}/learn`)}
                      className="w-full py-3 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 transition-all"
                      style={{ background: "linear-gradient(135deg, #6E35E8, #8B4DFF)", color: "#fff" }}
                    >
                      <PlayCircle className="w-4.5 h-4.5" />
                      Tiếp tục học
                    </button>
                  ) : (
                    <button
                      onClick={() => setEnrolled(true)}
                      className="w-full py-3 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 transition-all hover:brightness-110 active:scale-[0.98] shadow-lg"
                      style={{ background: "#B4F000", color: "#1F1F1F", boxShadow: "0 6px 20px rgba(180,240,0,0.3)" }}
                    >
                      <ShoppingCart className="w-4.5 h-4.5" />
                      {course.price === 0 ? "Đăng ký miễn phí" : "Đăng ký khóa học"}
                    </button>
                  )}
                  <div className="flex gap-2">
                    <button
                      onClick={() => setWishlisted(!wishlisted)}
                      className="flex-1 py-2.5 rounded-xl font-semibold text-xs flex items-center justify-center gap-1.5 border transition-all"
                      style={{
                        border: wishlisted ? "1px solid rgba(110, 53, 232,0.4)" : "1px solid #e5e7eb",
                        color: wishlisted ? "#6E35E8" : "#6b7280",
                        background: wishlisted ? "rgba(110, 53, 232,0.06)" : "transparent",
                      }}
                    >
                      <Heart 
                        fill={wishlisted ? "#6E35E8" : "none"}
                        className="w-3.5 h-3.5" 
                      />
                      Yêu thích
                    </button>
                    <button
                      className="flex-1 py-2.5 rounded-xl font-semibold text-xs flex items-center justify-center gap-1.5 border border-gray-200 text-gray-500 hover:bg-gray-50 transition-all"
                    >
                      <ShareNetwork className="w-3.5 h-3.5" />
                      Chia sẻ
                    </button>
                  </div>
                </div>

                {/* Course stats */}
                <div className="space-y-2.5 border-t border-gray-100 pt-5">
                  {[
                    { icon: Clock, label: "Thời lượng", value: formatDuration(course.duration) },
                    { icon: BookOpen, label: "Số bài học", value: `${course.lessonsCount} bài` },
                    { icon: Video, label: "Video chất lượng", value: "HD 1080p" },
                    { icon: Certificate, label: "Chứng chỉ hoàn thành", value: "Có" },
                    { icon: CalendarBlank, label: "Truy cập mãi mãi", value: "Không giới hạn" },
                  ].map((item) => (
                    <div key={item.label} className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2 text-gray-500">
                        <item.icon className="w-4 h-4" />
                        {item.label}
                      </div>
                      <span className="font-semibold text-gray-800">{item.value}</span>
                    </div>
                  ))}
                </div>

                {/* Book Mentor CTA */}
                {enrolled && (
                  <div
                    className="mt-5 p-4 rounded-2xl cursor-pointer hover:brightness-95 transition-all"
                    style={{ background: "linear-gradient(135deg, rgba(110, 53, 232,0.08), rgba(139, 77, 255,0.05))", border: "1px solid rgba(110, 53, 232,0.15)" }}
                    onClick={() => navigate(`/mentors/${course.mentorId}`)}
                  >
                    <div className="flex items-center gap-3">
                      <img src={course.mentorAvatar} alt={course.mentorName} className="w-10 h-10 rounded-full object-cover" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold text-[#6E35E8] mb-0.5">Sau khi học xong →</p>
                        <p className="text-sm font-semibold text-gray-900">Book 1-1 với {course.mentorName}</p>
                        <p className="text-xs text-gray-500">Confirm kiến thức & nhận feedback cá nhân</p>
                      </div>
                      <ArrowRight className="w-4 h-4 text-[#6E35E8] shrink-0" />
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Tabs + Content ───────────────────────────────────── */}
      <div className="max-w-7xl mx-auto px-6">
        {/* Tab bar */}
        <div className="flex gap-1 border-b border-gray-200 mt-8 -mx-6 px-6 overflow-x-auto">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className="flex items-center gap-2 px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-all"
              style={{
                borderBottomColor: activeTab === tab.key ? "#6E35E8" : "transparent",
                color: activeTab === tab.key ? "#6E35E8" : "#6b7280",
              }}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </div>

        <div className="grid lg:grid-cols-[1fr_380px] gap-10 py-10">
          {/* Main content */}
          <div>
            {/* ── Overview Tab ─────────────────────────────── */}
            {activeTab === "overview" && (
              <div className="space-y-8">
                {/* Learning outcomes */}
                <div className="bg-white rounded-3xl p-6 border border-gray-100">
                  <h2 className="text-xl font-bold text-gray-900 mb-5 flex items-center gap-2">
                    <Trophy className="w-5 h-5 text-[#6E35E8]" />
                    Bạn sẽ học được gì?
                  </h2>
                  <div className="grid sm:grid-cols-2 gap-3">
                    {course.learningOutcomes.map((outcome, i) => (
                      <div key={i} className="flex items-start gap-3">
                        <CheckCircle className="w-5 h-5 text-[#6E35E8] shrink-0 mt-0.5" />
                        <span className="text-sm text-gray-700">{outcome}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Requirements */}
                <div className="bg-white rounded-3xl p-6 border border-gray-100">
                  <h2 className="text-xl font-bold text-gray-900 mb-5 flex items-center gap-2">
                    <Target className="w-5 h-5 text-[#FF8C42]" />
                    Yêu cầu
                  </h2>
                  <div className="space-y-2">
                    {course.requirements.map((req, i) => (
                      <div key={i} className="flex items-start gap-3">
                        <WarningCircle className="w-4 h-4 text-[#FF8C42] shrink-0 mt-0.5" />
                        <span className="text-sm text-gray-700">{req}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Target audience */}
                <div className="bg-white rounded-3xl p-6 border border-gray-100">
                  <h2 className="text-xl font-bold text-gray-900 mb-5 flex items-center gap-2">
                    <Users className="w-5 h-5 text-[#FFD600]" />
                    Dành cho ai?
                  </h2>
                  <div className="space-y-2">
                    {course.targetAudience.map((aud, i) => (
                      <div key={i} className="flex items-start gap-3">
                        <CheckCircle className="w-4 h-4 text-[#FFD600] shrink-0 mt-0.5" />
                        <span className="text-sm text-gray-700">{aud}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Tags */}
                <div>
                  <h3 className="text-sm font-semibold text-gray-500 mb-3">Tags khóa học</h3>
                  <div className="flex flex-wrap gap-2">
                    {course.tags.map((tag) => (
                      <span
                        key={tag}
                        className="text-xs px-3 py-1.5 rounded-full font-medium"
                        style={{ background: "rgba(110, 53, 232,0.08)", color: "#6E35E8", border: "1px solid rgba(110, 53, 232,0.15)" }}
                      >
                        #{tag}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* ── Curriculum Tab ───────────────────────────── */}
            {activeTab === "curriculum" && (
              <div className="bg-white rounded-3xl border border-gray-100 overflow-hidden">
                <div className="p-6 border-b border-gray-100">
                  <h2 className="text-xl font-bold text-gray-900 mb-1">Nội dung khóa học</h2>
                  <p className="text-sm text-gray-500">
                    {course.lessonsCount} bài học · {formatDuration(course.duration)} · Cập nhật{" "}
                    {new Date(course.updatedAt).toLocaleDateString("vi-VN", { month: "long", year: "numeric" })}
                  </p>
                </div>

                <div className="divide-y divide-gray-50">
                  {displayedLessons.map((lesson, i) => (
                    <LessonRow key={lesson.id} lesson={lesson} index={i} />
                  ))}
                </div>

                {(course.lessons || []).length > 5 && (
                  <div className="p-4 border-t border-gray-100">
                    <button
                      onClick={() => setShowAllLessons(!showAllLessons)}
                      className="w-full py-3 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition-all"
                      style={{ color: "#6E35E8", background: "rgba(110, 53, 232,0.06)", border: "1px solid rgba(110, 53, 232,0.15)" }}
                    >
                      {showAllLessons ? (
                        <>
                          <CaretUp className="w-4 h-4" />
                          Thu gọn
                        </>
                      ) : (
                        <>
                          <CaretDown className="w-4 h-4" />
                          Xem thêm {(course.lessons || []).length - 5} bài học
                        </>
                      )}
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* ── Instructor Tab ──────────────────────────── */}
            {activeTab === "instructor" && (
              <div className="space-y-6">
                <div className="bg-white rounded-3xl p-6 border border-gray-100">
                  <div className="flex items-start gap-5 mb-6">
                    <img
                      src={course.mentorAvatar}
                      alt={course.mentorName}
                      className="w-20 h-20 rounded-2xl object-cover border-2 border-gray-100 shadow-sm"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <h2 className="text-xl font-bold text-gray-900">{course.mentorName}</h2>
                        <SealCheck className="w-5 h-5 text-[#6E35E8]" />
                        <span
                          className="text-xs font-bold px-2.5 py-1 rounded-full"
                          style={{ background: "rgba(110, 53, 232,0.1)", color: "#6E35E8" }}
                        >
                          Mentor xác thực
                        </span>
                      </div>
                      <p className="text-gray-600 mb-1">{course.mentorTitle}</p>
                      <p className="text-sm text-gray-400">{course.mentorCompany}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-4 mb-6 pb-6 border-b border-gray-100">
                    {[
                      { icon: Star, value: course.rating, label: "Rating", color: "#FFD600" },
                      { icon: Users, value: `${course.studentsCount}+`, label: "Học viên", color: "#6E35E8" },
                      { icon: BookOpen, value: "3", label: "Khóa học", color: "#B4F000" },
                    ].map((stat) => (
                      <div key={stat.label} className="text-center">
                        <div
                          className="w-10 h-10 rounded-xl flex items-center justify-center mx-auto mb-2"
                          style={{ background: `${stat.color}15` }}
                        >
                          <stat.icon className="w-5 h-5" style={{ color: stat.color }} />
                        </div>
                        <p className="font-bold text-gray-900">{stat.value}</p>
                        <p className="text-xs text-gray-400">{stat.label}</p>
                      </div>
                    ))}
                  </div>

                  <p className="text-sm text-gray-600 leading-relaxed mb-5">
                    {course.mentorName} là chuyên gia với hơn 10 năm kinh nghiệm trong ngành. Tại {course.mentorCompany}, 
                    {course.mentorName} đã dẫn dắt team và phỏng vấn hàng trăm ứng viên mỗi năm. 
                    Với niềm đam mê chia sẻ kiến thức, {course.mentorName} đã tạo ra các khóa học thực tế 
                    giúp học viên tự tin hơn trong hành trình phát triển sự nghiệp.
                  </p>

                  <button
                    onClick={() => navigate(`/mentors/${course.mentorId}`)}
                    className="w-full py-3.5 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 transition-all hover:brightness-105"
                    style={{ background: "linear-gradient(135deg, #6E35E8, #8B4DFF)", color: "#fff" }}
                  >
                    <CalendarBlank className="w-4 h-4" />
                    Book 1-1 với {course.mentorName}
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}

            {/* ── Reviews Tab ──────────────────────────────── */}
            {activeTab === "reviews" && (
              <ReviewsSection course={course} enrolled={enrolled} />
            )}
          </div>

          {/* Right sidebar (sticky on desktop) */}
          <div className="hidden lg:block">
            <div className="sticky top-6 space-y-4">
              {/* Related courses */}
              {relatedCourses.length > 0 && (
                <div className="bg-white rounded-3xl p-5 border border-gray-100">
                  <h3 className="font-bold text-gray-900 mb-4">Khóa học liên quan</h3>
                  <div className="space-y-4">
                    {relatedCourses.map((related) => (
                      <div
                        key={related.id}
                        className="flex gap-3 cursor-pointer group"
                        onClick={() => navigate(`/courses/${related.id}`)}
                      >
                        <img
                          src={related.thumbnail}
                          alt={related.title}
                          className="w-16 h-12 rounded-xl object-cover shrink-0 group-hover:opacity-90 transition-opacity"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-gray-900 line-clamp-2 group-hover:text-[#6E35E8] transition-colors leading-snug">
                            {related.title}
                          </p>
                          <p className="text-xs text-[#6E35E8] font-bold mt-1">{formatPrice(related.price)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                  <button
                    onClick={() => navigate("/courses")}
                    className="w-full py-2.5 rounded-xl font-semibold text-sm mt-4 transition-all"
                    style={{ color: "#6E35E8", background: "rgba(110, 53, 232,0.06)", border: "1px solid rgba(110, 53, 232,0.12)" }}
                  >
                    Xem tất cả khóa học
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Book Mentor Banner ───────────────────────────────── */}
      <div
        className="mx-4 mb-8 rounded-3xl overflow-hidden"
        style={{ background: "linear-gradient(135deg, #1a0a3e 0%, #2d1060 100%)" }}
      >
        <div className="max-w-7xl mx-auto px-8 py-10 flex flex-col md:flex-row items-center gap-6">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-3">
              <GraduationCap className="w-5 h-5 text-[#B4F000]" />
              <span className="text-[#B4F000] font-bold text-sm">BƯỚC TIẾP THEO</span>
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">
              Sau khi học xong, book 1-1 với mentor
            </h2>
            <p className="text-white/65 text-sm max-w-xl">
              Áp dụng kiến thức vào thực tế với phiên mentor 1-1: confirm những gì bạn đã học, 
              giải quyết câu hỏi còn thắc mắc, và nhận insider tips từ người trong ngành.
            </p>
          </div>
          <div className="flex items-center gap-4">
            <img src={course.mentorAvatar} alt={course.mentorName} className="w-14 h-14 rounded-full object-cover border-2 border-white/20 shrink-0" />
            <div>
              <p className="text-white font-bold">{course.mentorName}</p>
              <p className="text-white/55 text-sm">{course.mentorTitle}</p>
              <button
                onClick={() => navigate(`/mentors/${course.mentorId}`)}
                className="mt-2 px-5 py-2 rounded-xl font-bold text-sm transition-all hover:brightness-110"
                style={{ background: "#B4F000", color: "#1F1F1F" }}
              >
                Đặt lịch ngay →
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}