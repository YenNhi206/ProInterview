import React, { useEffect, useState } from "react";
import {
  Star,
  Check,
  ChevronDown,
  ChevronUp,
  PlayCircle,
  FileText,
  HelpCircle,
  BookOpen,
  Clock,
  Award,
  Video,
  Lock,
  ShoppingCart,
  BadgeCheck,
  Pencil,
  MessageCircle,
} from "lucide-react";
import { ImageWithFallback } from "../figma/ImageWithFallback";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "../ui/dialog";
import { submitReview } from "../../api/courseApi.js";
import { fetchMyReviewForTarget } from "../../api/reviewsApi.js";
import { ReviewReplyBlock } from "../reviews/ReviewReplyBlock";
import { toastApiError, toastApiSuccess } from "../../utils/shared/apiToast.js";
import { avatarSrc, mediaSrc } from "../../utils/shared/mediaUrl.js";
import { getPlans } from "../../utils/auth/auth.js";

import { formatVnd } from "../../utils/shared/formatVnd.js";

export const formatCoursePrice = (price) => formatVnd(price, { freeLabel: "Miễn phí" });

export const formatCourseDuration = (minutes) => {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? `${h}h ${m > 0 ? `${m}m` : ""}`.trim() : `${m}m`;
};

export function StarRating({ rating, size = "sm", variant = "default" }) {
  const s = size === "lg" ? "size-5" : size === "sm" ? "size-3.5" : "size-4";
  const n = rating == null ? NaN : Number(rating);
  const filled = Number.isFinite(n) ? Math.min(5, Math.max(0, Math.round(n))) : 0;
  const emptyColor = variant === "onDark" ? "rgba(255,255,255,0.35)" : "#e2e8f0";
  const fillColor = "#a3e635";

  return (
    <div className="flex gap-0.5" aria-hidden>
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          fill={i <= filled ? fillColor : "none"}
          className={s}
          style={{ color: i <= filled ? fillColor : emptyColor }}
        />
      ))}
    </div>
  );
}

function buildCourseIncludes(course) {
  const items = [];
  if (course.modulesCount > 0) {
    items.push({ icon: BookOpen, text: `${course.modulesCount} học phần` });
  }
  if (course.lessonsCount > 0) {
    items.push({ icon: PlayCircle, text: `${course.lessonsCount} bài học` });
  }
  if (course.duration > 0) {
    items.push({ icon: Clock, text: `Thời lượng ${formatCourseDuration(course.duration)}` });
  }
  items.push({ icon: Video, text: "Video & tài liệu bài giảng" });
  if (course.certificateEnabled) {
    items.push({ icon: Award, text: "Chứng chỉ hoàn thành khóa học" });
  }
  items.push({ icon: Check, text: "Truy cập khóa học không giới hạn" });
  return items;
}

function youtubeEmbedUrl(url) {
  if (!url) return null;
  const m = String(url).match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([\w-]+)/);
  return m ? `https://www.youtube.com/embed/${m[1]}` : null;
}

function isDirectVideoUrl(url) {
  const raw = String(url || "").trim();
  return /\.(mp4|webm|ogg)(\?|$)/i.test(raw) || raw.includes("cloudinary.com/video/");
}

export function CoursePurchaseCard({
  course,
  hasPaidEnrollment,
  hasPendingPayment,
  canTakeStudentActions,
  isReadOnlyMentorView,
  onEnroll,
  onContinueLearn,
  onContinuePayment,
}) {
  const price = Number(course.price) || 0;
  const displayPrice = price;
  /* Ưu đãi Pro/Elite (-5%/-10%) — ước tính hiển thị theo plan hiện tại, số tiền thật chốt ở /checkout. */
  const perkPlans = getPlans();
  const perkDiscountRate = perkPlans.elitePro ? 0.1 : perkPlans.starterPro ? 0.05 : 0;
  const perkDiscountAmount = price > 0 && perkDiscountRate > 0 ? Math.round(price * perkDiscountRate) : 0;
  const perkFinalPrice = price - perkDiscountAmount;
  const previewUrl = course.previewVideoUrl || "";
  const embed = youtubeEmbedUrl(previewUrl);
  const directPreview = !embed && isDirectVideoUrl(previewUrl) ? mediaSrc(previewUrl) : null;
  const includes = buildCourseIncludes(course);

  const ctaClassName =
    "flex w-full items-center justify-center gap-2 rounded-xl bg-[#a3e635] py-3.5 text-sm font-bold text-slate-900 shadow-md shadow-[#a3e635]/30 transition-all hover:bg-[#84cc16] active:scale-[0.99] lg:rounded-sm lg:py-3 lg:shadow-none";

  return (
    <div className="w-full overflow-hidden rounded-2xl border border-violet-200/60 bg-white shadow-[0_16px_48px_rgba(128,55,244,0.12)] lg:max-w-none lg:rounded-md lg:border-slate-200 lg:shadow-[0_12px_40px_rgba(15,23,42,0.08)]">
      <div className="relative aspect-[16/10] w-full overflow-hidden bg-slate-900 sm:aspect-video lg:h-52 lg:aspect-auto">
        {embed ? (
          <iframe
            title="Xem trước khóa học"
            src={embed}
            className="h-full w-full"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        ) : directPreview ? (
          <video
            key={directPreview}
            controls
            playsInline
            preload="metadata"
            poster={course.thumbnail}
            className="h-full w-full object-cover"
            src={directPreview}
          />
        ) : (
          <ImageWithFallback src={course.thumbnail} alt="" className="h-full w-full object-cover" />
        )}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-slate-900/50 via-transparent to-transparent lg:hidden" />
      </div>

      <div className="space-y-4 p-4 sm:p-5">
        <div className="flex flex-wrap items-end justify-between gap-3 border-b border-slate-100 pb-4 lg:border-0 lg:pb-0">
          <div className="flex flex-col gap-1">
            <div className="flex flex-wrap items-baseline gap-2">
              {perkDiscountAmount > 0 && (
                <span className="rounded-full bg-emerald-600 px-2 py-0.5 text-[11px] font-bold text-white">
                  -{Math.round(perkDiscountRate * 100)}% {perkPlans.elitePro ? "Elite" : "Pro"}
                </span>
              )}
              <span className="text-2xl font-black text-[#8037f4] sm:text-3xl lg:font-bold lg:text-slate-900">
                {formatCoursePrice(perkFinalPrice)}
              </span>
              {perkDiscountAmount > 0 && (
                <span className="text-sm text-slate-400 line-through">{formatCoursePrice(displayPrice)}</span>
              )}
            </div>
          </div>
        </div>

        {hasPaidEnrollment && !isReadOnlyMentorView ? (
          <button type="button" onClick={onContinueLearn} className={ctaClassName}>
            <PlayCircle className="size-4" />
            Tiếp tục học
          </button>
        ) : hasPaidEnrollment && isReadOnlyMentorView ? (
          <button
            type="button"
            disabled
            className="flex w-full cursor-not-allowed items-center justify-center gap-2 rounded-xl bg-[#8037f4]/50 py-3.5 text-sm font-bold text-white lg:rounded-sm lg:py-3"
          >
            <Lock className="size-4" />
            Mentor chỉ xem
          </button>
        ) : hasPendingPayment && canTakeStudentActions ? (
          <button type="button" onClick={onContinuePayment} className={ctaClassName}>
            <ShoppingCart className="size-4" />
            Tiếp tục thanh toán
          </button>
        ) : (
          <button
            type="button"
            onClick={canTakeStudentActions ? onEnroll : undefined}
            disabled={!canTakeStudentActions}
            className={`${ctaClassName} disabled:cursor-not-allowed disabled:opacity-50`}
          >
            <ShoppingCart className="size-4" />
            {canTakeStudentActions
              ? price === 0
                ? "Đăng ký miễn phí"
                : "Mua khóa học"
              : "Mentor chỉ xem"}
          </button>
        )}

        <div className="rounded-xl bg-violet-50/60 p-3.5 lg:rounded-none lg:bg-transparent lg:p-0">
          <p className="mb-2.5 text-sm font-bold text-slate-900">Khóa học này bao gồm</p>
          <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-1 lg:gap-2">
            {includes.map((item) => {
              const Icon = item.icon;
              return (
                <li
                  key={item.text}
                  className="flex items-center gap-2.5 rounded-lg bg-white/80 px-2.5 py-2 text-sm text-slate-600 lg:rounded-none lg:bg-transparent lg:px-0 lg:py-0"
                >
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-violet-100 text-[#8037f4] lg:size-auto lg:rounded-none lg:bg-transparent">
                    <Icon className="size-4 shrink-0 lg:text-slate-500" />
                  </span>
                  <span className="min-w-0 leading-snug">{item.text}</span>
                </li>
              );
            })}
          </ul>
        </div>

        {!hasPaidEnrollment ? (
          <p className="border-t border-slate-100 pt-3 text-xs leading-relaxed text-slate-500 lg:block">
            Bạn đang xem preview. Mua khóa học (hoặc đăng ký miễn phí) để truy cập đầy đủ nội dung.
          </p>
        ) : null}
      </div>
    </div>
  );
}

function LessonIcon({ type }) {
  if (type === "quiz") return <HelpCircle className="size-4 shrink-0 text-slate-400" />;
  if (type === "document") return <FileText className="size-4 shrink-0 text-slate-400" />;
  return <PlayCircle className="size-4 shrink-0 text-slate-400" />;
}

export function CourseCurriculumAccordion({ modules, certificateEnabled, enrolled }) {
  const [open, setOpen] = useState(() => {
    const init = {};
    modules.forEach((_, i) => {
      init[i] = i === 0;
    });
    return init;
  });

  if (!modules.length) {
    return (
      <p className="rounded-md border border-slate-200 bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">
        Chưa có nội dung bài học.
      </p>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-sm lg:rounded-md lg:shadow-none">
      {modules.map((mod, modIndex) => (
        <div key={mod.id} className="border-b border-slate-200 last:border-b-0">
          <button
            type="button"
            onClick={() => setOpen((v) => ({ ...v, [modIndex]: !v[modIndex] }))}
            className="flex w-full items-center justify-between gap-3 bg-slate-50 px-4 py-2.5 text-left transition-colors hover:bg-slate-100/80"
          >
            <span className="text-sm font-bold text-slate-800">
              {mod.title || `Phần ${modIndex + 1}`}
            </span>
            {open[modIndex] ? (
              <ChevronUp className="size-4 shrink-0 text-slate-500" />
            ) : (
              <ChevronDown className="size-4 shrink-0 text-slate-500" />
            )}
          </button>
          {open[modIndex] ? (
            <ul className="divide-y divide-slate-100">
              {mod.lessons.map((lesson) => (
                <li key={lesson.id} className="flex items-center gap-3 px-4 py-2.5">
                  <LessonIcon type={lesson.type} />
                  <span
                    className={`min-w-0 flex-1 truncate text-sm ${
                      lesson.isPreview || enrolled
                        ? "font-medium text-[#2563eb] hover:underline"
                        : "text-slate-700"
                    }`}
                  >
                    {lesson.title}
                  </span>
                  {!lesson.isPreview && !enrolled ? (
                    <Lock className="size-3.5 shrink-0 text-slate-300" />
                  ) : null}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ))}
      {certificateEnabled ? (
        <div className="flex items-center gap-3 border-t border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-600">
          <Lock className="size-4 shrink-0 text-slate-400" />
          <span>Chứng chỉ hoàn thành khóa học</span>
        </div>
      ) : null}
    </div>
  );
}

export function CourseInstructorBlock({ course, onViewMentor, canNavigate }) {
  return (
    <div className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-sm sm:p-5 lg:rounded-md lg:shadow-none">
      <button
        type="button"
        onClick={canNavigate ? onViewMentor : undefined}
        className={`mb-3 text-left ${canNavigate ? "hover:opacity-90" : ""}`}
        disabled={!canNavigate}
      >
        <h2 className="text-lg font-bold text-[#8037f4]">{course.mentorName}</h2>
        <p className="text-sm text-slate-500">{course.mentorTitle}</p>
      </button>
      <div className="flex items-start gap-4 rounded-sm border border-slate-100 bg-slate-50/80 p-4">
        <div className="relative shrink-0">
          <img
            src={course.mentorAvatar}
            alt={course.mentorName}
            className="size-20 rounded-sm object-cover"
          />
          <BadgeCheck className="absolute -bottom-1 -right-1 size-5 text-[#2563eb]" />
        </div>
        <div className="min-w-0 flex-1 text-sm text-slate-600">
          <p className="font-semibold text-slate-800">Mentor {course.mentorName}</p>
          <p className="mt-1 text-slate-500">{course.mentorCompany}</p>
          <p className="mt-2 text-xs text-slate-500">
            {course.studentsCount.toLocaleString("vi-VN")} học viên đã tham gia các khóa học
          </p>
        </div>
      </div>
    </div>
  );
}

export function CourseReviewsBlock({ course, enrolled, reviews, onReviewSubmitted }) {
  const [showAll, setShowAll] = useState(false);
  const [showDialog, setShowDialog] = useState(false);
  const [reviewRating, setReviewRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [reviewComment, setReviewComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    if (!enrolled || !course?.id) return;
    void fetchMyReviewForTarget("course", course.id).then((res) => {
      if (res.success && res.hasReview) setSubmitted(true);
    });
  }, [enrolled, course?.id]);

  const visible = showAll ? reviews : reviews.slice(0, 3);
  const ratingLabel =
    course.rating != null ? `${Number(course.rating).toFixed(1)}` : "—";

  const handleSubmit = async () => {
    if (!reviewRating || reviewComment.trim().length < 30) return;
    setSubmitting(true);
    const res = await submitReview({
      targetType: "course",
      targetId: course.id,
      rating: reviewRating,
      comment: reviewComment,
    });
    setSubmitting(false);
    if (res.success) {
      setSubmitted(true);
      setShowDialog(false);
      setReviewRating(0);
      setReviewComment("");
      toastApiSuccess("Đã gửi đánh giá. Cảm ơn bạn!");
      onReviewSubmitted?.(res.review);
    } else {
      toastApiError(res.error, "Gửi đánh giá thất bại.");
    }
  };

  return (
    <div className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-sm sm:p-5 lg:rounded-md lg:shadow-none">
      <h2 className="mb-3 text-lg font-bold text-slate-900">Đánh giá khóa học</h2>

      {!enrolled ? (
        <div className="mb-3 flex items-center gap-2 rounded-sm border border-violet-100 bg-violet-50/90 px-4 py-2.5 text-sm text-violet-900">
          <Lock className="size-4 shrink-0" />
          Bạn cần tham gia khóa học để có thể đánh giá.
        </div>
      ) : null}

      {enrolled && !submitted ? (
        <button
          type="button"
          onClick={() => setShowDialog(true)}
          className="mb-3 flex w-full items-center justify-center gap-2 rounded-sm border border-violet-200 bg-violet-50 py-2.5 text-sm font-semibold text-violet-900 hover:bg-violet-100"
        >
          <Pencil className="size-4" />
          Viết đánh giá
        </button>
      ) : null}
      {enrolled && submitted ? (
        <p className="mb-3 rounded-sm border border-emerald-100 bg-emerald-50 px-4 py-2.5 text-sm text-emerald-900">
          Bạn đã gửi đánh giá cho khóa học này.
        </p>
      ) : null}

      <p className="mb-3 flex flex-wrap items-center gap-2 text-sm text-slate-700">
        <Star className="size-4 fill-amber-400 text-amber-400" />
        <span className="font-bold">{ratingLabel}</span>
        <span>xếp hạng khóa học</span>
        <span className="text-slate-400">·</span>
        <span>
          {course.reviewsCount} Đánh giá
        </span>
      </p>

      <div className="space-y-3">
        {visible.map((r) => (
          <div key={r.id} className="border-b border-slate-100 pb-3 last:border-0">
            <div className="mb-2 flex items-center gap-3">
              <img
                src={avatarSrc(r.userAvatar)}
                alt=""
                className="size-9 rounded-full object-cover"
              />
              <div>
                <p className="text-sm font-bold text-slate-900">{r.userName || "Học viên"}</p>
                <div className="flex flex-wrap items-center gap-2">
                  <StarRating rating={r.rating} />
                  {r.isPeerReview ? (
                    <span className="rounded-sm bg-violet-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-violet-800">
                      Đánh giá chéo mentor
                    </span>
                  ) : null}
                </div>
              </div>
            </div>
            <p className="text-sm leading-relaxed text-slate-700">{r.comment}</p>
            <ReviewReplyBlock reply={r.reply} />
            {r.createdAt ? (
              <p className="mt-1 text-xs text-slate-400">
                {new Date(r.createdAt).toLocaleString("vi-VN", {
                  hour: "2-digit",
                  minute: "2-digit",
                  day: "2-digit",
                  month: "2-digit",
                  year: "numeric",
                })}
              </p>
            ) : null}
          </div>
        ))}
      </div>

      {reviews.length === 0 ? (
        <p className="text-sm text-slate-500">Chưa có đánh giá cho khóa học này.</p>
      ) : null}

      {reviews.length > 3 ? (
        <button
          type="button"
          onClick={() => setShowAll((v) => !v)}
          className="mt-4 w-full text-center text-sm font-semibold text-[#8037f4] hover:underline"
        >
          {showAll ? "Thu gọn đánh giá" : "Hiển thị tất cả đánh giá"}
        </button>
      ) : null}

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="border border-slate-200 bg-white sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold">Đánh giá khóa học</DialogTitle>
            <DialogDescription className="text-sm text-slate-600">
              Chia sẻ trải nghiệm sau khi học (tối thiểu 30 ký tự).
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5].map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setReviewRating(s)}
                  onMouseEnter={() => setHoverRating(s)}
                  onMouseLeave={() => setHoverRating(0)}
                >
                  <Star
                    className="size-8"
                    fill={s <= (hoverRating || reviewRating) ? "#FFD600" : "none"}
                    style={{ color: s <= (hoverRating || reviewRating) ? "#FFD600" : "#cbd5e1" }}
                  />
                </button>
              ))}
            </div>
            <textarea
              value={reviewComment}
              onChange={(e) => setReviewComment(e.target.value)}
              rows={4}
              className="w-full rounded-sm border border-slate-200 px-3 py-2 text-sm outline-none focus:border-[#8037f4] focus:ring-2 focus:ring-violet-500/20"
              placeholder="Khóa học giúp bạn điều gì?"
            />
            <button
              type="button"
              onClick={handleSubmit}
              disabled={!reviewRating || reviewComment.trim().length < 30 || submitting}
              className="flex w-full items-center justify-center gap-2 rounded-sm bg-[#a3e635] py-2.5 text-sm font-bold text-slate-900 disabled:opacity-50"
            >
              <MessageCircle className="size-4" />
              Gửi đánh giá
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
