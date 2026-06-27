import React, { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router";
import { BookOpen, Check } from "lucide-react";
import { fetchCourseById, fetchAllReviewsForCourse } from "../../api/courseApi.js";
import { enrollmentApi } from "../../api/enrollmentApi.js";
import { getUser } from "../../utils/auth/auth.js";
import { toastApiError, toastApiSuccess } from "../../utils/shared/apiToast.js";
import { requireLoginNavigate } from "../../utils/auth/authGate.js";
import { trackAction } from "../../utils/analytics/analyticsApi.js";
import { MentorPageShell } from "../../components/mentor/MentorPageShell";
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
      <MentorPageShell bottomPad="pb-24">
        <div className="flex min-h-[50vh] w-full items-center justify-center py-20">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-violet-300 border-t-violet-700" />
        </div>
      </MentorPageShell>
    );
  }

  if (!course) {
    return (
      <MentorPageShell bottomPad="pb-24">
        <div className="flex min-h-[50vh] flex-col items-center justify-center px-6 py-20 text-center">
          <BookOpen className="mb-4 h-16 w-16 text-slate-300" />
          <h2 className="mb-2 text-xl font-bold text-slate-900">Không tìm thấy khóa học</h2>
          <button
            type="button"
            onClick={() => navigate("/courses")}
            className="rounded-sm bg-[#8037f4] px-6 py-3 font-semibold text-white"
          >
            Khám phá khóa học
          </button>
        </div>
      </MentorPageShell>
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
        navigate(`/checkout?type=course&courseId=${course.id}&price=${course.price}`)
      }
    />
  );

  return (
    <MentorPageShell bottomPad="pb-20">
      <div className={`min-h-full font-sans text-slate-900 ${CUSTOMER_SHELL_GUTTER} ${COURSE_DETAIL_SHELL_MAX} py-4 pb-6`}>
        {adminPreviewMode ? (
          <div className="mb-4 flex flex-col gap-3 rounded-lg border border-violet-200 bg-violet-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-violet-950">
              <span className="font-bold">Preview admin</span>, Đây là trang marketplace học viên thấy
              (chưa mua khóa học nên chỉ xem mô tả / danh sách bài, không vào phòng học đầy đủ).
            </p>
          </div>
        ) : null}
        {mentorPeerReviewMode ? (
          <div className="mb-4 flex flex-col gap-3 rounded-lg border border-violet-200 bg-violet-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-violet-950">
              <span className="font-bold">Đánh giá chéo</span>, Xem đầy đủ video và tài liệu bài học (chỉ đọc) trước khi chấm điểm.
            </p>
            <button
              type="button"
              onClick={() => navigate(`/courses/${id}/learn?peerReview=1`)}
              className="shrink-0 rounded-lg bg-[#8037f4] px-4 py-2 text-sm font-bold text-white hover:bg-[#630ed4]"
            >
              Xem nội dung khóa học
            </button>
          </div>
        ) : null}
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_calc(280px+1rem)] lg:items-start lg:gap-5">
          <div className="min-w-0 space-y-5 lg:space-y-5">
            <header className="overflow-hidden rounded-2xl bg-gradient-to-br from-[#8037f4] via-[#7230e8] to-[#630ed4] px-5 py-5 text-white shadow-[0_12px_40px_rgba(128,55,244,0.28)] sm:px-8 sm:py-6 lg:rounded-md lg:bg-gradient-to-r lg:from-[#8037f4] lg:to-[#630ed4] lg:px-10 lg:py-7 lg:shadow-none">
              {course.category ? (
                <p className="mb-2.5 inline-flex max-w-full truncate rounded-full bg-white/15 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white/95 backdrop-blur-sm sm:text-[11px] lg:hidden">
                  {course.category}
                </p>
              ) : null}
              <h1 className="mb-2 text-xl font-bold leading-snug sm:text-3xl lg:mb-2 lg:text-4xl">
                {course.title}
              </h1>
              {course.description ? (
                <p className="mb-4 line-clamp-3 text-sm leading-relaxed text-white/90 sm:text-base lg:mb-3 lg:text-lg">
                  {course.description}
                </p>
              ) : null}
              <div className="flex flex-col gap-3 sm:gap-3.5 lg:hidden">
                <p className="text-sm font-semibold text-white sm:text-base">{course.mentorName}</p>
                <div className="flex flex-wrap gap-2">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-white/12 px-2.5 py-1 text-xs font-semibold text-white backdrop-blur-sm sm:text-sm">
                    <span className="font-black text-amber-300">
                      {course.rating != null && course.rating > 0 ? course.rating.toFixed(1) : "—"}
                    </span>
                    <StarRating rating={course.rating} size="sm" variant="onDark" />
                  </span>
                  <span className="inline-flex items-center rounded-full bg-white/12 px-2.5 py-1 text-xs font-medium text-white/95 backdrop-blur-sm sm:text-sm">
                    {course.modulesCount} học phần · {course.lessonsCount} bài
                  </span>
                  <span className="inline-flex items-center rounded-full bg-white/12 px-2.5 py-1 text-xs font-medium text-white/95 backdrop-blur-sm sm:text-sm">
                    {formatCourseDuration(course.duration)}
                  </span>
                </div>
              </div>
              <div className="hidden flex-wrap items-center gap-x-6 gap-y-2.5 text-base text-white/90 lg:flex lg:text-lg">
                <span className="font-semibold">{course.mentorName}</span>
                <span className="flex items-center gap-2.5">
                  <span className="text-xl font-bold text-amber-300 lg:text-2xl">
                    {course.rating != null ? course.rating.toFixed(1) : "—"}
                  </span>
                  <StarRating rating={course.rating} size="lg" />
                </span>
                <span>
                  {course.modulesCount} học phần · {course.lessonsCount} bài ·{" "}
                  {formatCourseDuration(course.duration)}
                </span>
              </div>
            </header>

            <div className="w-full lg:hidden">{purchaseCard}</div>

              {course.learningOutcomes.length > 0 ? (
                <section className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-sm sm:p-5 lg:rounded-md lg:shadow-none">
                  <h2 className="mb-3 text-lg font-bold text-slate-900">Bạn sẽ học được gì</h2>
                  <ul className="grid gap-2 sm:grid-cols-2">
                    {course.learningOutcomes.map((outcome, i) => (
                      <li key={i} className="flex items-start gap-2.5 text-sm text-slate-700">
                        <Check className="mt-0.5 size-4 shrink-0 text-emerald-600" strokeWidth={3} />
                        <span>{outcome}</span>
                      </li>
                    ))}
                  </ul>
                </section>
              ) : null}

              <section>
                <h2 className="mb-3 text-base font-bold text-slate-900 sm:text-lg">Danh sách bài học</h2>
                <CourseCurriculumAccordion
                  modules={course.modules}
                  certificateEnabled={course.certificateEnabled}
                  enrolled={hasPaidEnrollment}
                />
              </section>

              <CourseInstructorBlock
                course={course}
                canNavigate={canTakeStudentActions}
                onViewMentor={() => navigate(`/mentors/${course.mentorId}`)}
              />

              <CourseReviewsBlock
                course={course}
                enrolled={hasPaidEnrollment}
                reviews={reviews}
                onReviewSubmitted={() => void reloadReviews()}
              />
      </div>

          <aside className="hidden lg:block">
            <div className="sticky top-6">{purchaseCard}</div>
          </aside>
      </div>
      </div>
    </MentorPageShell>
  );
}
