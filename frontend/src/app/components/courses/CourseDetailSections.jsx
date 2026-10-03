import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
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
  ShoppingBag,
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
import { AddCourseToCartButton } from "./AddCourseToCartButton.jsx";
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
  const fillColor = "#f59e0b";

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
  const hasFreeLesson = (course.modules || []).some((m) =>
    (m.lessons || []).some((l) => l.isPreview || l.isFree)
  );

  const ctaClassName =
    "relative overflow-hidden group flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-violet-600 via-indigo-600 to-purple-600 hover:from-violet-500 hover:via-indigo-500 hover:to-purple-500 py-3.5 text-sm font-bold text-white shadow-[0_10px_30px_-5px_rgba(139,92,246,0.5)] hover:shadow-[0_15px_40px_-5px_rgba(139,92,246,0.7)] active:scale-[0.98] transition-all cursor-pointer";

  return (
    <motion.div
      whileHover={{ y: -3 }}
      transition={{ duration: 0.3 }}
      className="relative w-full overflow-hidden rounded-3xl border border-violet-500/30 bg-gradient-to-b from-[#1d1245]/95 via-[#130c2e]/95 to-[#0b061c]/98 backdrop-blur-2xl shadow-[0_25px_60px_-15px_rgba(128,55,244,0.35)] transition-all"
    >
      {/* Top subtle ambient neon glow orb */}
      <div className="pointer-events-none absolute -top-16 -right-16 size-48 rounded-full bg-gradient-to-br from-violet-500/30 to-fuchsia-500/20 blur-3xl" />
      <div className="pointer-events-none absolute top-0 left-0 right-0 h-[1.5px] bg-gradient-to-r from-transparent via-violet-400/60 to-transparent" />

      {/* Video / Thumbnail preview section */}
      <div className="group/preview relative aspect-video w-full overflow-hidden bg-slate-950 cursor-pointer">
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
            className="h-full w-full object-cover transition-transform duration-500 group-hover/preview:scale-105"
            src={directPreview}
          />
        ) : (
          <>
            <ImageWithFallback
              src={course.thumbnail}
              alt=""
              className="h-full w-full object-cover transition-transform duration-500 group-hover/preview:scale-105"
            />
            {/* Glassmorphic Play Trigger Overlay */}
            <div className="absolute inset-0 bg-gradient-to-t from-[#0b061c]/80 via-black/30 to-transparent flex flex-col items-center justify-center gap-2 transition-opacity group-hover/preview:from-[#0b061c]/60">
              <div className="relative flex items-center justify-center">
                <div className="absolute size-14 rounded-full bg-violet-500/30 animate-ping opacity-60" />
                <div className="size-13 rounded-full bg-white/20 backdrop-blur-md border border-white/40 flex items-center justify-center shadow-[0_0_25px_rgba(168,85,247,0.6)] group-hover/preview:scale-110 transition-transform">
                  <PlayCircle className="size-7 text-white fill-white/80" />
                </div>
              </div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-violet-200 bg-black/40 px-3 py-1 rounded-full border border-white/10 backdrop-blur-md">
                Xem trước khóa học
              </span>
            </div>
          </>
        )}
      </div>

      <div className="relative z-10 space-y-5 p-5 sm:p-6">
        {/* Price Tag - Full Price, Full Width, Clean Flow */}
        <div className="w-full">
          {price === 0 ? (
            <div className="flex items-center gap-2.5">
              <span className="rounded-full bg-gradient-to-r from-emerald-500/25 to-teal-500/25 border border-emerald-400/40 px-3.5 py-1 text-xs font-black uppercase tracking-wider text-emerald-300 shadow-[0_0_15px_rgba(16,185,129,0.3)]">
                Miễn phí
              </span>
              <span className="text-xs text-slate-400">Trọn đời khóa học</span>
            </div>
          ) : (
            <div className="flex flex-wrap items-baseline gap-3">
              <span className="text-3xl sm:text-[34px] font-black tracking-tight text-white drop-shadow-[0_2px_12px_rgba(168,85,247,0.3)]">
                {formatCoursePrice(displayPrice)}
              </span>
              {perkDiscountAmount > 0 && (
                <span className="text-xs font-semibold text-emerald-300 bg-emerald-500/15 border border-emerald-500/30 px-2.5 py-1 rounded-full">
                  Ưu đãi hội viên: {formatCoursePrice(perkFinalPrice)}
                </span>
              )}
            </div>
          )}
        </div>

        {/* CTA Button with Shimmer Sweep Effect */}
        {hasPaidEnrollment && !isReadOnlyMentorView ? (
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            type="button"
            onClick={onContinueLearn}
            className={ctaClassName}
          >
            <div className="absolute inset-0 -translate-x-full group-hover:animate-[shimmer_1.5s_infinite] bg-gradient-to-r from-transparent via-white/20 to-transparent pointer-events-none" />
            <PlayCircle className="size-4" />
            Tiếp tục học
          </motion.button>
        ) : hasPaidEnrollment && isReadOnlyMentorView ? (
          <button
            type="button"
            disabled
            className="flex w-full cursor-not-allowed items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 py-3.5 text-sm font-bold text-slate-400"
          >
            <Lock className="size-4" />
            Mentor chỉ xem
          </button>
        ) : hasPendingPayment && canTakeStudentActions ? (
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            type="button"
            onClick={onContinuePayment}
            className={ctaClassName}
          >
            <div className="absolute inset-0 -translate-x-full group-hover:animate-[shimmer_1.5s_infinite] bg-gradient-to-r from-transparent via-white/20 to-transparent pointer-events-none" />
            <ShoppingBag className="size-4" strokeWidth={1.5} aria-hidden="true" />
            Tiếp tục thanh toán
          </motion.button>
        ) : (
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            type="button"
            onClick={canTakeStudentActions ? onEnroll : undefined}
            disabled={!canTakeStudentActions}
            className={`${ctaClassName} disabled:cursor-not-allowed disabled:opacity-50`}
          >
            <div className="absolute inset-0 -translate-x-full group-hover:animate-[shimmer_1.5s_infinite] bg-gradient-to-r from-transparent via-white/20 to-transparent pointer-events-none" />
            <ShoppingBag className="size-4" strokeWidth={1.5} aria-hidden="true" />
            {canTakeStudentActions
              ? price === 0
                ? "Đăng ký miễn phí"
                : "Tham gia khóa học"
              : "Mentor chỉ xem"}
          </motion.button>
        )}

        {!hasPaidEnrollment && !hasPendingPayment && canTakeStudentActions && (
          <AddCourseToCartButton courseId={course.id} />
        )}

        {hasFreeLesson && !hasPaidEnrollment && !hasPendingPayment && canTakeStudentActions && (
          <button
            type="button"
            onClick={() => {
              const el = document.getElementById("course-curriculum");
              if (el) el.scrollIntoView({ behavior: "smooth" });
            }}
            className="flex w-full items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] hover:bg-white/[0.08] hover:border-white/20 py-3 text-sm font-semibold text-slate-300 hover:text-white transition-all cursor-pointer"
          >
            <PlayCircle className="size-4 text-violet-400" />
            Học thử miễn phí
          </button>
        )}

        {/* Khóa học này bao gồm - Glowing Interactive Tiles */}
        <div className="rounded-2xl bg-white/[0.03] border border-white/10 p-4.5 backdrop-blur-md">
          <p className="mb-3.5 text-xs font-extrabold uppercase tracking-wider text-slate-300 flex items-center justify-between">
            <span>Khóa học này bao gồm</span>
            <span className="size-1.5 rounded-full bg-violet-400 animate-pulse" />
          </p>
          <ul className="space-y-2.5">
            {includes.map((item) => {
              const Icon = item.icon;
              return (
                <motion.li
                  key={item.text}
                  whileHover={{ x: 4 }}
                  transition={{ duration: 0.15 }}
                  className="flex items-center gap-3 text-sm text-slate-200 group/item cursor-default"
                >
                  <span className="flex size-7 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500/25 to-purple-500/30 text-violet-300 border border-violet-400/30 shadow-[0_0_12px_rgba(139,92,246,0.25)] group-hover/item:border-violet-400/60 group-hover/item:text-white transition-colors">
                    <Icon className="size-3.5 shrink-0" />
                  </span>
                  <span className="min-w-0 leading-snug font-medium text-[13px] text-slate-300 group-hover/item:text-white transition-colors">
                    {item.text}
                  </span>
                </motion.li>
              );
            })}
          </ul>
        </div>

        {/* Micro Trust Guarantee footer */}
        <div className="pt-2 border-t border-white/10 flex items-center justify-around text-[11px] text-slate-400">
          <span className="flex items-center gap-1">
            <Check className="size-3 text-emerald-400" /> Truy cập trọn đời
          </span>
          <span className="flex items-center gap-1">
            <Check className="size-3 text-emerald-400" /> Cấp chứng chỉ
          </span>
        </div>
      </div>
    </motion.div>
  );
}

function LessonIcon({ type }) {
  if (type === "quiz") return <HelpCircle className="size-4 shrink-0 text-violet-400" />;
  if (type === "document") return <FileText className="size-4 shrink-0 text-violet-400" />;
  return <PlayCircle className="size-4 shrink-0 text-violet-400" />;
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
      <p className="rounded-2xl border border-white/10 bg-white/[0.03] px-5 py-8 text-center text-sm text-slate-400">
        Chưa có nội dung bài học.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {modules.map((mod, modIndex) => (
        <div
          key={mod.id}
          className="rounded-2xl border border-white/10 bg-white/[0.02] overflow-hidden transition-all hover:border-violet-500/30"
        >
          <button
            type="button"
            onClick={() => setOpen((v) => ({ ...v, [modIndex]: !v[modIndex] }))}
            className="flex w-full items-center justify-between gap-3 bg-white/[0.02] px-5 sm:px-6 py-4 text-left transition-colors hover:bg-white/[0.05] cursor-pointer"
          >
            <div className="flex items-center gap-3">
              <span className="flex size-7 items-center justify-center rounded-xl bg-violet-500/20 border border-violet-500/30 text-xs font-bold text-violet-300">
                {modIndex + 1}
              </span>
              <span className="text-sm font-bold text-white sm:text-base">
                {mod.title || `Phần ${modIndex + 1}`}
              </span>
            </div>
            <motion.div
              animate={{ rotate: open[modIndex] ? 180 : 0 }}
              transition={{ duration: 0.2 }}
            >
              <ChevronDown className="size-4 shrink-0 text-slate-400" />
            </motion.div>
          </button>
          <AnimatePresence initial={false}>
            {open[modIndex] && (
              <motion.ul
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                className="overflow-hidden divide-y divide-white/5 bg-black/15"
              >
                {mod.lessons.map((lesson) => (
                  <motion.li
                    key={lesson.id}
                    whileHover={{ x: 5, backgroundColor: "rgba(255,255,255,0.04)" }}
                    transition={{ duration: 0.15 }}
                    className="flex items-center gap-3 px-5 sm:px-6 py-3.5 transition-colors"
                  >
                    <LessonIcon type={lesson.type} />
                    <span
                      className={`min-w-0 flex-1 truncate text-sm ${
                        lesson.isPreview || enrolled
                          ? "font-medium text-violet-300 hover:text-violet-200 hover:underline cursor-pointer"
                          : "text-slate-300"
                      }`}
                    >
                      {lesson.title}
                    </span>
                    {lesson.isPreview && !enrolled ? (
                      <span className="rounded-full bg-violet-500/20 border border-violet-500/30 px-2.5 py-0.5 text-[11px] font-semibold text-violet-300">
                        Xem thử
                      </span>
                    ) : null}
                    {!lesson.isPreview && !enrolled ? (
                      <Lock className="size-3.5 shrink-0 text-slate-500" />
                    ) : null}
                  </motion.li>
                ))}
              </motion.ul>
            )}
          </AnimatePresence>
        </div>
      ))}
      {certificateEnabled ? (
        <div className="flex items-center gap-3 rounded-2xl border border-white/5 bg-white/[0.01] px-5 sm:px-6 py-3.5 text-sm text-slate-400">
          <Award className="size-4 shrink-0 text-amber-400" />
          <span>Chứng chỉ hoàn thành khóa học</span>
        </div>
      ) : null}
    </div>
  );
}

export function CourseInstructorBlock({ course, onViewMentor, canNavigate }) {
  return (
    <div
      onClick={canNavigate ? onViewMentor : undefined}
      role={canNavigate ? "button" : undefined}
      tabIndex={canNavigate ? 0 : undefined}
      onKeyDown={
        canNavigate
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onViewMentor();
              }
            }
          : undefined
      }
      className={`group block w-full text-left rounded-3xl border border-white/10 bg-white/[0.03] backdrop-blur-xl p-5 sm:p-6 shadow-2xl transition-all ${
        canNavigate
          ? "cursor-pointer hover:border-violet-500/40 hover:bg-white/[0.06] hover:shadow-[0_15px_40px_rgba(128,55,244,0.15)] active:scale-[0.99]"
          : ""
      }`}
    >
      <div className="flex items-center justify-between gap-3 mb-4">
        <span className="text-[11px] font-bold uppercase tracking-wider text-violet-400">
          Giảng viên hướng dẫn
        </span>
        {canNavigate ? (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-violet-400/40 bg-violet-600/25 px-3.5 py-1 text-xs font-bold text-violet-200 shadow-sm transition-all group-hover:border-violet-400 group-hover:bg-violet-600/40 group-hover:text-white">
            <span>Xem hồ sơ</span>
            <span className="transition-transform group-hover:translate-x-0.5">→</span>
          </span>
        ) : null}
      </div>

      <div className="flex items-center gap-4">
        <div className="relative shrink-0">
          <img
            src={course.mentorAvatar}
            alt={course.mentorName}
            className="size-16 rounded-2xl object-cover ring-2 ring-violet-500/30 shadow-md transition-transform group-hover:scale-105"
          />
          <BadgeCheck className="absolute -bottom-1 -right-1 size-5 text-violet-400 bg-slate-900 rounded-full" />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="font-bold text-white text-base truncate transition-colors group-hover:text-violet-200">
            {course.mentorName}
          </h3>
          <p className="text-xs text-violet-300 font-medium truncate">{course.mentorTitle}</p>
          <p className="text-xs text-slate-400 mt-0.5 truncate">{course.mentorCompany}</p>
        </div>
      </div>

      {course.studentsCount > 0 ? (
        <div className="mt-4 pt-3.5 border-t border-white/10 flex items-center justify-between text-xs text-slate-400">
          <span>Học viên tham gia</span>
          <span className="font-semibold text-slate-200">{course.studentsCount.toLocaleString("vi-VN")} học viên</span>
        </div>
      ) : null}
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

  const visible = showAll ? reviews : reviews.slice(0, 4);
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
    <div className="pt-8 border-t border-white/10">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-white/10 pb-6 mb-6">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-white">Đánh giá từ học viên</h2>
          {course.rating != null && course.rating > 0 ? (
            <div className="mt-2 flex flex-wrap items-center gap-2.5 text-sm text-slate-300">
              <span className="text-2xl font-black text-amber-400">{ratingLabel}</span>
              <StarRating rating={course.rating} size="md" variant="onDark" />
              <span className="text-slate-500">·</span>
              <span className="font-medium text-slate-300">{course.reviewsCount} Đánh giá</span>
            </div>
          ) : (
            <p className="mt-1 text-sm text-slate-400">Chưa có đánh giá nào cho khóa học này</p>
          )}
        </div>

        <div>
          {enrolled && !submitted ? (
            <button
              type="button"
              onClick={() => setShowDialog(true)}
              className="inline-flex items-center justify-center gap-2 rounded-2xl border border-violet-500/30 bg-violet-600/20 px-5 py-2.5 text-sm font-semibold text-violet-200 hover:bg-violet-600/30 transition-all cursor-pointer shadow-xs"
            >
              <Pencil className="size-4" />
              Viết đánh giá
            </button>
          ) : null}
          {enrolled && submitted ? (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3.5 py-1 text-xs font-semibold text-emerald-300">
              <Check className="size-3.5" />
              Bạn đã đánh giá khóa học này
            </span>
          ) : null}
        </div>
      </div>

      {!enrolled ? (
        <div className="mb-6 flex items-center gap-2.5 rounded-2xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
          <Lock className="size-4 shrink-0 text-amber-400" />
          Bạn cần tham gia khóa học để có thể chia sẻ đánh giá.
        </div>
      ) : null}

      {reviews.length === 0 ? (
        <p className="py-6 text-center text-sm text-slate-400">Chưa có đánh giá nào. Hãy là người đầu tiên tham gia và để lại nhận xét!</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {visible.map((r) => (
            <motion.div
              key={r.id}
              whileHover={{ y: -4, borderColor: "rgba(168, 85, 247, 0.4)", backgroundColor: "rgba(255,255,255,0.04)" }}
              transition={{ duration: 0.2 }}
              className="flex flex-col justify-between rounded-2xl border border-white/10 bg-white/[0.02] p-5 transition-all shadow-xs"
            >
              <div>
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <img
                      src={avatarSrc(r.userAvatar)}
                      alt=""
                      className="size-10 rounded-full object-cover ring-1 ring-white/20"
                    />
                    <div>
                      <p className="text-sm font-bold text-white">{r.userName || "Học viên"}</p>
                      <StarRating rating={r.rating} variant="onDark" />
                    </div>
                  </div>
                  {r.isPeerReview ? (
                    <span className="rounded-full bg-violet-500/20 border border-violet-500/30 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-violet-300">
                      Đánh giá chéo
                    </span>
                  ) : null}
                </div>
                <p className="text-sm leading-relaxed text-slate-300">{r.comment}</p>
                <ReviewReplyBlock reply={r.reply} />
              </div>
              {r.createdAt ? (
                <p className="mt-3 text-xs text-slate-500">
                  {new Date(r.createdAt).toLocaleString("vi-VN", {
                    hour: "2-digit",
                    minute: "2-digit",
                    day: "2-digit",
                    month: "2-digit",
                    year: "numeric",
                  })}
                </p>
              ) : null}
            </motion.div>
          ))}
        </div>
      )}

      {reviews.length > 4 ? (
        <button
          type="button"
          onClick={() => setShowAll((v) => !v)}
          className="mt-6 w-full text-center text-sm font-semibold text-violet-400 hover:text-violet-300 hover:underline cursor-pointer"
        >
          {showAll ? "Thu gọn bớt đánh giá" : `Hiển thị tất cả (${reviews.length}) đánh giá`}
        </button>
      ) : null}

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="border border-white/15 bg-gradient-to-b from-[#1c143d] to-[#0e0824] text-white backdrop-blur-2xl sm:max-w-lg shadow-[0_20px_60px_rgba(0,0,0,0.7)]">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-white">Đánh giá khóa học</DialogTitle>
            <DialogDescription className="text-sm text-slate-300">
              Chia sẻ trải nghiệm sau khi học (tối thiểu 30 ký tự).
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex gap-1.5">
              {[1, 2, 3, 4, 5].map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setReviewRating(s)}
                  onMouseEnter={() => setHoverRating(s)}
                  onMouseLeave={() => setHoverRating(0)}
                  className="cursor-pointer transition-transform hover:scale-110"
                >
                  <Star
                    className="size-8"
                    fill={s <= (hoverRating || reviewRating) ? "#FFD600" : "none"}
                    style={{ color: s <= (hoverRating || reviewRating) ? "#FFD600" : "#64748b" }}
                  />
                </button>
              ))}
            </div>
            <textarea
              value={reviewComment}
              onChange={(e) => setReviewComment(e.target.value)}
              rows={4}
              className="w-full rounded-2xl border border-white/15 bg-white/[0.05] p-3 text-sm text-white placeholder-slate-400 outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/30"
              placeholder="Khóa học giúp bạn điều gì?"
            />
            <button
              type="button"
              onClick={handleSubmit}
              disabled={!reviewRating || reviewComment.trim().length < 30 || submitting}
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-violet-600 via-indigo-600 to-purple-600 hover:from-violet-500 hover:via-indigo-500 hover:to-purple-500 py-3 text-sm font-bold text-white shadow-lg shadow-violet-500/25 active:scale-[0.98] transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
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
