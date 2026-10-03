import React from "react";
import { useNavigate, useParams, useSearchParams, Link } from "react-router";
import { AnimatePresence } from "motion/react";
import { fetchMentor, fetchMentorPublicReviews } from "../../api/mentorApi.js";
import { ReportMentorModal } from "../../components/modals/ReportMentorModal";
import { MentorProfileHeader } from "../../components/mentor/profile/MentorProfileHeader";
import { MentorProfileAside } from "../../components/mentor/profile/MentorProfileAside";
import {
  MentorIntroSection,
  MentorWorkSection,
  MentorSkillsSection,
  MentorReviewsSection,
} from "../../components/mentor/profile/MentorProfileSections";
import { toastApiError } from "../../utils/shared/apiToast.js";
import {
  buildReviewRatingSummary,
  buildWorkEntriesForDisplay,
  formatRecurringScheduleRows,
  mentorFieldTags,
} from "../../utils/mentor/mentorProfileHelpers.js";
import { CUSTOMER_SHELL_GUTTER, CUSTOMER_SHELL_MAX } from "../../components/layout/customerShellLayout";
import { formatEducationDisplay } from "../../utils/profile/profileEducationHistory.js";

const PROFILE_TABS = [
  { id: "intro", label: "Giới thiệu" },
  { id: "work", label: "Kinh nghiệm làm việc" },
  { id: "skills", label: "Kỹ năng" },
  { id: "reviews", label: "Đánh giá" },
];

function TabBar({ activeTab, onChange }) {
  return (
    <div
      className="flex gap-2 overflow-x-auto border-b border-white/10 pb-2"
      role="tablist"
      aria-label="Nội dung hồ sơ mentor"
    >
      {PROFILE_TABS.map((tab) => {
        const active = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(tab.id)}
            className={`shrink-0 rounded-xl px-4 py-2.5 text-sm font-bold transition-all cursor-pointer ${
              active
                ? "bg-violet-600/30 border border-violet-400/40 text-white shadow-[0_0_15px_rgba(139,92,246,0.3)]"
                : "border border-transparent text-slate-400 hover:text-white hover:bg-white/[0.04]"
            }`}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}

function SectionDivider() {
  return <hr className="my-8 border-white/10" />;
}

export function MentorProfile() {
  const navigate = useNavigate();
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const rebookFrom =
    searchParams.get("rebookFrom") ||
    (typeof sessionStorage !== "undefined" ? sessionStorage.getItem("prointerview_rebook_from") : "") ||
    "";
  const bookingHref = rebookFrom
    ? `/booking/${id}?rebookFrom=${encodeURIComponent(rebookFrom)}`
    : `/booking/${id}`;

  const [mentor, setMentor] = React.useState(null);
  const [loadingMentor, setLoadingMentor] = React.useState(true);
  const [showReportModal, setShowReportModal] = React.useState(false);
  const [realReviews, setRealReviews] = React.useState([]);
  const [activeTab, setActiveTab] = React.useState("intro");

  React.useEffect(() => {
    if (!id) {
      setMentor(null);
      setLoadingMentor(false);
      return;
    }
    setLoadingMentor(true);
    setMentor(null);
    fetchMentor(id)
      .then((m) => {
        if (m) setMentor(m);
        else toastApiError("Không tìm thấy mentor hoặc không tải được hồ sơ.");
      })
      .catch(() => toastApiError("Lỗi kết nối khi tải hồ sơ mentor."))
      .finally(() => setLoadingMentor(false));
  }, [id]);

  React.useEffect(() => {
    if (!id) return;
    fetchMentorPublicReviews(id).then((res) => {
      if (res.success) setRealReviews(res.reviews);
    });
  }, [id]);

  if (loadingMentor && !mentor) {
    return (
      <div className={`relative z-10 min-h-[calc(100svh-76px)] text-[#f0edf7] pb-32 pt-16 ${CUSTOMER_SHELL_GUTTER}`}>
        <div className="flex min-h-[50vh] flex-col items-center justify-center px-6 text-center">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-violet-400/20 border-t-violet-500" aria-hidden />
          <span className="mt-4 text-sm font-semibold text-slate-300">Đang tải hồ sơ mentor…</span>
        </div>
      </div>
    );
  }

  if (!mentor) {
    return (
      <div className={`relative z-10 min-h-[calc(100svh-76px)] text-[#f0edf7] pb-32 pt-16 ${CUSTOMER_SHELL_GUTTER}`}>
        <div className="mx-auto max-w-md rounded-3xl border border-white/10 bg-white/[0.04] p-8 text-center backdrop-blur-xl">
          <p className="text-base font-semibold text-white">Không tìm thấy mentor.</p>
          <button
            type="button"
            onClick={() => navigate("/mentors")}
            className="mt-4 rounded-xl bg-violet-600 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-violet-500 cursor-pointer"
          >
            Quay lại danh sách
          </button>
        </div>
      </div>
    );
  }

  const ratingDisplay = Number(mentor.rating || 0).toFixed(1);
  const reviewCount = mentor.reviews ?? 0;
  const experienceYears = Number(mentor.experience) || 0;
  const bioText = (mentor.bio || "").trim();
  const skillTags = mentorFieldTags(mentor);
  const workEntries = buildWorkEntriesForDisplay(mentor);
  const scheduleRows = formatRecurringScheduleRows(mentor.recurringSchedule);
  const reviewSummary = buildReviewRatingSummary(realReviews);
  const education = formatEducationDisplay(mentor.profileEducation || "");
  const awards = String(mentor.profileAwards || "").trim();

  const goBook = () => navigate(bookingHref);

  const introFull = (
    <div className="space-y-0">
      <MentorIntroSection
        mentor={mentor}
        bioText={bioText}
        education={education}
        awards={awards}
      />
    </div>
  );

  return (
    <div className={`relative z-10 min-h-[calc(100svh-76px)] text-[#f0edf7] pb-24 pt-6 sm:pt-8 ${CUSTOMER_SHELL_GUTTER}`}>
      <div className={`${CUSTOMER_SHELL_MAX} w-full`}>
        {/* Breadcrumb */}
        <nav className="mb-4 flex flex-wrap items-center gap-2 text-sm sm:text-base font-medium text-slate-300">
          <Link to="/mentors" className="hover:text-white transition-colors">
            Chuyên gia
          </Link>
          <span className="text-slate-500">›</span>
          <span className="text-slate-100 font-semibold truncate max-w-lg">{mentor.name}</span>
        </nav>

        <div className="grid items-start gap-8 lg:grid-cols-12 lg:gap-8">
          <div className="min-w-0 space-y-6 lg:col-span-8">
            <MentorProfileHeader
              mentor={mentor}
              ratingDisplay={ratingDisplay}
              reviewCount={reviewCount}
              experienceYears={experienceYears}
            />

            <div className="rounded-3xl border border-white/10 bg-white/[0.03] backdrop-blur-xl p-5 sm:p-7 shadow-[0_20px_50px_rgba(0,0,0,0.3)]">
              <TabBar activeTab={activeTab} onChange={setActiveTab} />

              <div className="pt-6">
                {activeTab === "intro" ? introFull : null}
                {activeTab === "work" ? (
                  <MentorWorkSection mentor={mentor} workEntries={workEntries} />
                ) : null}
                {activeTab === "skills" ? (
                  <MentorSkillsSection skillTags={skillTags} />
                ) : null}
                {activeTab === "reviews" ? (
                  <MentorReviewsSection
                    realReviews={realReviews}
                    reviewSummary={reviewSummary}
                  />
                ) : null}
              </div>
            </div>
          </div>

          <div className="lg:col-span-4 lg:sticky lg:top-6">
            <MentorProfileAside
              mentor={mentor}
              bookingHref={bookingHref}
              onBook={goBook}
              onReport={() => setShowReportModal(true)}
              scheduleRows={scheduleRows}
            />
          </div>
        </div>
      </div>

      <AnimatePresence>
        {showReportModal ? (
          <ReportMentorModal
            mentorId={mentor.id}
            mentorName={mentor.name}
            onClose={() => setShowReportModal(false)}
          />
        ) : null}
      </AnimatePresence>
    </div>
  );
}
