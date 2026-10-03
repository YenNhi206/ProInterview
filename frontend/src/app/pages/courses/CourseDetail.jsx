import React, { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate, useSearchParams, Link } from "react-router";
import { motion, AnimatePresence } from "motion/react";
import { BookOpen, Check, ArrowLeft, Sparkles, AlertCircle, Loader2, Users, Layers, FileText } from "lucide-react";
import { fetchCourseById, fetchAllReviewsForCourse } from "../../api/courseApi.js";
import { enrollmentApi } from "../../api/enrollmentApi.js";
import { getUser } from "../../utils/auth/auth.js";
import { toastApiError, toastApiSuccess } from "../../utils/shared/apiToast.js";
import { requireLoginNavigate } from "../../utils/auth/authGate.js";
import { trackAction } from "../../utils/analytics/analyticsApi.js";
import { normalizeCourseStats } from "../../utils/course/courseStats.js";
import { enrollmentAccessGranted } from "../../utils/course/enrollmentAccess.js";
import { mediaSrc, DEFAULT_COURSE_THUMB, avatarSrc } from "../../utils/shared/mediaUrl.js";
import {
  CUSTOMER_SHELL_GUTTER,
  COURSE_DETAIL_SHELL_MAX,
} from "../../components/layout/customerShellLayout";
import {
  isAdminCoursePreviewMode,
} from "../../utils/admin/adminCoursePreview.js";
import {
  CoursePurchaseCard,
  CourseCurriculumAccordion,
  CourseInstructorBlock,
  CourseReviewsBlock,
  StarRating,
  formatCourseDuration,
} from "../../components/courses/CourseDetailSections";

function mapApiCourse(c) {
  const stats = normalizeCourseStats(c.stats);
  const modules = (c.modules || []).map((mod, idx) => ({
    id: mod._id || `mod-${idx}`,
    title: mod.title || `Phần ${idx + 1}`,
    lessons: (mod.lessons || []).map((lesson) => ({
      id: lesson._id,
      title: lesson.title,
      type: lesson.type || "video",
      duration: lesson.durationMinutes || 0,
      isPreview: !!lesson.isFree,
      videoUrl: lesson.videoUrl || "",
    })),
  }));

  let previewVideoUrl = "";
  for (const mod of c.modules || []) {
    for (const lesson of mod.lessons || []) {
      if (lesson.isFree && lesson.videoUrl) {
        previewVideoUrl = lesson.videoUrl;
        break;
      }
    }
    if (previewVideoUrl) break;
  }

  return {
    id: c._id,
    title: c.title,
    description: c.description,
    thumbnail: mediaSrc(c.thumbnail, DEFAULT_COURSE_THUMB),
    category: c.topics?.[0] || "Kỹ năng khác",
    mentorId: c.mentorId?._id,
    mentorUserId: c.mentorId?.userId?._id || "",
    mentorName: c.mentorId?.userId?.name || "Khuất danh",
    mentorAvatar: avatarSrc(c.mentorId?.userId?.avatar),
    mentorTitle: c.mentorId?.userId?.desiredPosition || "Chuyên gia",
    mentorCompany: c.mentorId?.userId?.currentCompany || "ProInterview",
    rating: stats.rating,
    reviewsCount: stats.reviewsCount,
    studentsCount: c.stats?.enrollmentCount || 0,
    duration: c.totalDurationMinutes || 120,
    lessonsCount: c.totalLessons || 0,
    modulesCount: modules.length,
    price: c.price || 0,
    learningOutcomes: c.whatYoullLearn?.length ? c.whatYoullLearn : [],
    requirements: c.requirements || [],
    modules,
    previewVideoUrl,
    certificateEnabled: c.settings?.certificateEnabled !== false,
  };
}

export function CourseDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [course, setCourse] = useState(null);
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [enrollmentRow, setEnrollmentRow] = useState(null);
  const currentUser = getUser();

  const reloadReviews = useCallback(async () => {
    if (!id) return;
    const [revRes, courseRes] = await Promise.all([fetchAllReviewsForCourse(id), fetchCourseById(id)]);
    if (revRes.success) setReviews(revRes.reviews || []);
    if (courseRes.success) setCourse(mapApiCourse(courseRes.course));
  }, [id]);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const [res, revRes] = await Promise.all([
          fetchCourseById(id),
          fetchAllReviewsForCourse(id),
        ]);
        if (cancelled) return;
        if (res.success) {
          setCourse(mapApiCourse(res.course));
        } else {
          toastApiError(res.error, "Không tải được khóa học.");
        }
        if (revRes.success) setReviews(revRes.reviews || []);
      } catch {
        if (!cancelled) toastApiError("Lỗi kết nối khi tải khóa học.");
      } finally {
        if (!cancelled) setLoading(false);
      }

      try {
        const enr = await enrollmentApi.getMyEnrollments();
        if (cancelled) return;
        if (enr.success) {
          const row = enr.enrollments.find(
            (e) => String(e.courseId?._id || e.courseId || "") === String(id),
          );
          setEnrollmentRow(row || null);
        }
      } catch {
        /* optional */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  const hasPaidEnrollment = enrollmentAccessGranted(enrollmentRow);
  const hasPendingPayment = !!enrollmentRow && !enrollmentAccessGranted(enrollmentRow);
  const isMentorViewer = currentUser?.role === "mentor";
  const isOwnerMentor =
    isMentorViewer && String(currentUser?.id || "") === String(course?.mentorUserId || "");
  const canTakeStudentActions = !isMentorViewer || isOwnerMentor;
  const isReadOnlyMentorView = isMentorViewer && !isOwnerMentor;
  const isAdminViewer = currentUser?.role === "admin";
  const adminPreviewMode = isAdminViewer && isAdminCoursePreviewMode(searchParams);
  const mentorPeerReviewMode =
    !!course && searchParams.get("peerReview") === "1" && isReadOnlyMentorView;

  const handleEnroll = async () => {
    if (!id || !course) return;
    if (course.price > 0) {
      navigate(`/checkout?type=course&courseId=${id}&price=${course.price}`);
      return;
    }
    try {
      const res = await enrollmentApi.enroll(id);
      if (res.success) {
        trackAction("course_enroll", `/courses/${id}`, { courseId: id, paid: false });
        setEnrollmentRow(res.enrollment || enrollmentRow);
        toastApiSuccess("Đăng ký miễn phí thành công!");
      } else {
        if (res.error === "Chưa đăng nhập.") {
          requireLoginNavigate(navigate, `/courses/${id}`);
          return;
        }
        toastApiError(res.error, "Không thể đăng ký miễn phí.");
      }
    } catch {
      toastApiError("Lỗi kết nối khi đăng ký miễn phí.");
    }
  };

  if (loading) {
    return (
      <div className={`relative z-10 min-h-[calc(100svh-76px)] text-[#f0edf7] pb-24 pt-16 ${CUSTOMER_SHELL_GUTTER}`}>
        <div className="flex flex-col items-center justify-center py-28 text-center">
          <div className="relative flex items-center justify-center">
            <div className="absolute h-16 w-16 animate-ping rounded-full bg-violet-400/20" />
            <div className="h-14 w-14 rounded-2xl bg-white/[0.06] backdrop-blur-xl border border-white/10 flex items-center justify-center shadow-lg shadow-violet-500/10">
              <Loader2 className="h-7 w-7 animate-spin text-violet-400" />
            </div>
          </div>
          <p className="mt-4 text-sm font-semibold text-slate-300">Đang tải thông tin khóa học...</p>
        </div>
      </div>
    );
  }

  if (!course) {
    return (
      <div className={`relative z-10 min-h-[calc(100svh-76px)] text-[#f0edf7] pb-24 pt-8 ${CUSTOMER_SHELL_GUTTER}`}>
        <div className="mx-auto flex max-w-md flex-col items-center justify-center p-8 text-center rounded-3xl border border-white/10 bg-white/[0.04] backdrop-blur-xl shadow-[0_15px_40px_rgba(0,0,0,0.4)]">
          <BookOpen className="mb-4 size-14 text-violet-400" />
          <h2 className="mb-2 text-xl font-bold text-white">Không tìm thấy khóa học</h2>
          <p className="mb-6 text-sm text-slate-300">Khóa học không tồn tại hoặc đã bị ẩn.</p>
          <button
            type="button"
            onClick={() => navigate("/courses")}
            className="rounded-2xl bg-gradient-to-r from-violet-600 to-indigo-600 px-6 py-3 font-semibold text-white shadow-lg shadow-violet-500/25 hover:from-violet-500 hover:to-indigo-500 transition-all cursor-pointer"
          >
            Khám phá khóa học
          </button>
        </div>
      </div>
    );
  }

  const purchaseCard = (
    <CoursePurchaseCard
      course={course}
      hasPaidEnrollment={hasPaidEnrollment}
      hasPendingPayment={hasPendingPayment}
      canTakeStudentActions={canTakeStudentActions}
      isReadOnlyMentorView={isReadOnlyMentorView}
      onEnroll={handleEnroll}
      onContinueLearn={() => navigate(`/courses/${course.id}/learn`)}
      onContinuePayment={() =>
        navigate(enrollmentRow?.cartOrderId ? `/cart?order=${enrollmentRow.cartOrderId}` : `/checkout?type=course&courseId=${course.id}&price=${course.price}`)
      }
    />
  );

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
      className={`relative z-10 min-h-[calc(100svh-76px)] text-[#f0edf7] pb-24 pt-6 sm:pt-8 ${CUSTOMER_SHELL_GUTTER}`}
    >
      <div className={`${COURSE_DETAIL_SHELL_MAX} w-full mx-auto space-y-6`}>
        {adminPreviewMode ? (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col gap-3 rounded-2xl border border-violet-400/30 bg-violet-950/40 p-4 text-violet-200 sm:flex-row sm:items-center sm:justify-between backdrop-blur-md"
          >
            <p className="text-sm">
              <span className="font-bold text-white">Preview admin</span>: Đây là trang marketplace học viên thấy
              (chưa mua khóa học nên chỉ xem mô tả / danh sách bài, không vào phòng học đầy đủ).
            </p>
          </motion.div>
        ) : null}

        {mentorPeerReviewMode ? (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col gap-3 rounded-2xl border border-violet-400/30 bg-violet-950/40 p-4 text-violet-200 sm:flex-row sm:items-center sm:justify-between backdrop-blur-md"
          >
            <p className="text-sm">
              <span className="font-bold text-white">Đánh giá chéo</span>: Xem đầy đủ video và tài liệu bài học (chỉ đọc) trước khi chấm điểm.
            </p>
            <button
              type="button"
              onClick={() => navigate(`/courses/${id}/learn?peerReview=1`)}
              className="shrink-0 rounded-xl bg-violet-600 px-4 py-2 text-sm font-bold text-white hover:bg-violet-500 shadow-sm transition-all"
            >
              Xem nội dung khóa học
            </button>
          </motion.div>
        ) : null}

        {/* 2-COLUMN UNIFIED HERO & CONTENT FLOW - RATIO 7/5 (58% / 42%) */}
        <div className="grid gap-8 lg:grid-cols-12 lg:items-start lg:gap-10">
          {/* CỘT TRÁI: 7/12 (~58%) THOÁNG ĐÃNG, CHUẨN REFERENCE */}
          <div className="min-w-0 space-y-8 lg:col-span-7">
            {/* Header giới thiệu khóa học */}
            <motion.header
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="border-b border-white/10 pb-8 pt-2"
            >
              {/* Breadcrumb */}
              <nav className="mb-4 flex flex-wrap items-center gap-2 text-sm sm:text-base font-medium text-slate-300">
                <Link to="/courses" className="hover:text-white transition-colors">
                  Khóa học
                </Link>
                <span className="text-slate-500">›</span>
                <span className="text-slate-100 font-semibold truncate max-w-lg">{course.title}</span>
              </nav>

              <h1 className="mb-4 text-2xl font-black leading-tight tracking-tight sm:text-3xl lg:text-[34px] text-white">
                {course.title}
              </h1>

              {/* Meta Chips Row */}
              <div className="mb-4 flex flex-wrap items-center gap-3 text-xs sm:text-sm">
                {course.category && (
                  <span className="rounded-lg bg-blue-500/20 border border-blue-500/30 px-2.5 py-1 text-xs font-semibold text-blue-300">
                    {course.category}
                  </span>
                )}
                <span className="inline-flex items-center gap-1.5 text-slate-300">
                  <span className="font-bold text-amber-300">★ {course.rating ? course.rating.toFixed(1) : "5.0"}</span>
                  <span className="text-slate-400">· {course.reviewsCount || 0} đánh giá</span>
                </span>
                <span className="inline-flex items-center gap-1.5 text-slate-300">
                  <Users className="size-3.5 text-slate-400" />
                  <span>{course.studentsCount || 0} học viên</span>
                </span>
                <span className="inline-flex items-center gap-1.5 text-slate-300">
                  <Layers className="size-3.5 text-slate-400" />
                  <span>{course.modulesCount} chương</span>
                </span>
                <span className="inline-flex items-center gap-1.5 text-slate-300">
                  <FileText className="size-3.5 text-slate-400" />
                  <span>{course.lessonsCount} bài</span>
                </span>
              </div>

              {course.description ? (
                <p className="mb-4 text-sm leading-relaxed text-slate-300 sm:text-base">
                  {course.description}
                </p>
              ) : null}

              <p className="text-sm text-slate-400">
                Giảng viên <span className="font-semibold text-white">{course.mentorName}</span>
              </p>
            </motion.header>

            {/* Mobile preview/purchase card */}
            <div className="w-full lg:hidden">{purchaseCard}</div>

            {/* Bạn sẽ học được gì - Dạng 2 cột số thứ tự như ảnh mẫu */}
            {course.learningOutcomes.length > 0 ? (
              <motion.section
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.15 }}
                className="border-b border-white/10 pb-8"
              >
                <h2 className="mb-4 text-xl font-bold text-white">Bạn sẽ học được gì</h2>
                <div className="grid gap-3 sm:grid-cols-2">
                  {course.learningOutcomes.map((outcome, i) => (
                    <div
                      key={i}
                      className="flex items-start gap-2.5 text-sm font-medium text-slate-200 leading-snug"
                    >
                      <span className="size-5 rounded-full bg-blue-500/15 border border-blue-500/30 text-blue-400 flex items-center justify-center shrink-0 mt-0.5 shadow-[0_0_8px_rgba(59,130,246,0.2)]">
                        <Check className="size-3" strokeWidth={2.5} />
                      </span>
                      <span>
                        <span className="text-slate-400 mr-1">{i + 1}.</span>
                        {outcome}
                      </span>
                    </div>
                  ))}
                </div>
              </motion.section>
            ) : null}

            {/* Danh sách bài học */}
            <motion.section
              id="course-curriculum"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.2 }}
              className="border-b border-white/10 pb-8 scroll-mt-24"
            >
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-xl font-bold text-white">Nội dung khóa học</h2>
                <span className="text-xs font-semibold text-slate-400">
                  {course.modulesCount} học phần · {course.lessonsCount} bài học
                </span>
              </div>
              <CourseCurriculumAccordion
                modules={course.modules}
                certificateEnabled={course.certificateEnabled}
                enrolled={hasPaidEnrollment}
              />
            </motion.section>

            {/* Đánh giá từ học viên */}
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.25 }}
            >
              <CourseReviewsBlock
                course={course}
                enrolled={hasPaidEnrollment}
                reviews={reviews}
                onReviewSubmitted={() => void reloadReviews()}
              />
            </motion.div>
          </div>

          {/* CỘT PHẢI: 5/12 (~42%) RỘNG RÃI, CÂN ĐỐI, CÓ STICKY */}
          <motion.aside
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, delay: 0.15, ease: [0.16, 1, 0.3, 1] }}
            className="space-y-6 lg:col-span-5 lg:sticky lg:top-6"
          >
            <div className="hidden lg:block">{purchaseCard}</div>

            <CourseInstructorBlock
              course={course}
              canNavigate={canTakeStudentActions}
              onViewMentor={() => navigate(`/mentors/${course.mentorId}`)}
            />
          </motion.aside>
        </div>
      </div>
    </motion.div>
  );
}
