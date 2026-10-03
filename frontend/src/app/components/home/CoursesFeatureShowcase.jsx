import React from "react";
import { HOME_SECTION_INNER } from "../layout/customerShellLayout";
import {
  GraduationCap,
  Lock,
  BookOpen,
  CircleCheck,
  Video,
} from "lucide-react";
import { HOME_DEMO_COURSES } from "../../data/homeLandingDemo";
import { COURSES_SHOWCASE_COPY } from "../../constants/brandVoice";
import { homeSectionClasses as ty } from "../../constants/homeTypography";
import { HomeSectionHeader } from "./HomeSectionHeader";
import { SparkleGlyph } from "../decor/SparkleGlyph";

/** Một khóa mẫu cố định (STAR), tab lọc chỉ minh họa UI. */
const DEMO_COURSE = HOME_DEMO_COURSES[0];
const DEMO_FILTER_LABELS = ["Phỏng vấn", "Viết CV", "Technical", "Soft skills"];

const COURSE_CARD_MENTOR_AVATAR = "/mascot-course-card-avatar.png?v=2";
const COURSE_CARD_AVATAR_FALLBACK = "/mascot-courses-ready.png?v=8";

const DEMO_PROGRESS = (() => {
  const a = HOME_DEMO_COURSES[0];
  const b = HOME_DEMO_COURSES[1];
  const aTotal = a?.lessonsCount ?? 12;
  const bTotal = b?.lessonsCount ?? 10;
  const aDone = 3;
  const bDone = 1;
  return [
    {
      id: "1",
      title: a?.title,
      done: aDone,
      total: aTotal,
      pct: Math.round((aDone / aTotal) * 100),
      category: a?.category,
    },
    {
      id: "2",
      title: b?.title,
      done: bDone,
      total: bTotal,
      pct: Math.round((bDone / bTotal) * 100),
      category: b?.category,
    },
  ];
})();

function formatDurationMinutes(totalMin) {
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h <= 0) return `${m} phút`;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function LessonRow({ title, active, locked }) {
  return (
    <li
      className={`flex items-center gap-2 rounded-xl px-2 py-1.5 sm:px-2.5 sm:py-2 ${
        active ? "bg-white/10 text-white" : ""
      }`}
    >
      <span
        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full sm:h-[1.375rem] sm:w-[1.375rem] ${
          active
            ? "bg-[#c7f36b] text-[#0f172a]"
            : locked
              ? "bg-white/5 text-white/30"
              : "bg-white/10 text-white/70"
        }`}
      >
        {locked ? (
          <Lock className="h-2.5 w-2.5" strokeWidth={2.5} />
        ) : (
          <BookOpen className="h-2.5 w-2.5" strokeWidth={2.5} />
        )}
      </span>
      <span
        className={`min-w-0 flex-1 text-[11px] font-semibold leading-snug sm:text-xs ${
          active ? "text-white" : locked ? "text-white/30" : "text-white/70"
        }`}
      >
        {title}
      </span>
    </li>
  );
}

function CoursesLearningMockup() {
  if (!DEMO_COURSE) return null;

  const displayLessons = (DEMO_COURSE.lessons || []).slice(0, 4);
  const moreLessons = Math.max(0, (DEMO_COURSE.lessonsCount ?? 0) - displayLessons.length);

  return (
    <div className="liquid-glass-strong relative mx-auto w-full max-w-[42rem] overflow-visible rounded-[2rem] px-4 pb-5 pt-[5rem] sm:px-5 sm:pb-6 sm:pt-[5.5rem] lg:max-w-none">
      <div
        className="pointer-events-none absolute left-1/2 top-0 z-[2] w-[11rem] -translate-x-1/2 translate-y-[calc(-38%+0.5rem)] sm:w-[12rem] lg:w-[12.2rem]"
        aria-hidden
      >
        <img
          src="/mascot-courses-pose8-removebg.png?v=1"
          alt=""
          className="relative z-[1] block h-auto w-full object-contain"
        />
      </div>

      <div
        className="liquid-glass relative z-[1] flex flex-wrap justify-center gap-1.5 rounded-2xl p-1.5 shadow-sm sm:gap-2 sm:p-2"
        aria-hidden
      >
        {DEMO_FILTER_LABELS.map((label, idx) => (
          <span
            key={label}
            className={`inline-flex items-center rounded-xl px-3 py-1.5 text-[11px] font-bold sm:px-3.5 sm:py-2 sm:text-xs ${
              idx === 0
                ? "liquid-glass !bg-[#c7f36b]/20 text-[#c7f36b] shadow-md"
                : "text-white/70"
            }`}
          >
            {label}
          </span>
        ))}
      </div>

      <div className="relative z-[1] mt-4 grid grid-cols-1 gap-3 sm:grid-cols-[1.05fr_0.95fr] sm:items-stretch sm:gap-3.5">
        <div className="liquid-glass flex flex-col rounded-2xl p-3.5 shadow-lg sm:p-4">
          <div className="mb-2.5 flex items-start gap-2.5 border-b border-white/10 pb-2.5">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-white/20 bg-white/10 sm:h-10 sm:w-10">
              <img
                src={COURSE_CARD_MENTOR_AVATAR}
                alt=""
                className="h-[90%] w-[90%] object-contain object-bottom"
                onError={(e) => {
                  if (e.currentTarget.src !== COURSE_CARD_AVATAR_FALLBACK) {
                    e.currentTarget.src = COURSE_CARD_AVATAR_FALLBACK;
                  }
                }}
              />
            </span>
            <div className="min-w-0 flex-1">
              <p className="line-clamp-2 text-xs font-bold leading-snug text-white sm:text-sm">
                {DEMO_COURSE.title}
              </p>
              <p className="text-[10px] font-medium text-slate-400 sm:text-[11px]">
                {DEMO_COURSE.mentorName} · {DEMO_COURSE.mentorCompany}
              </p>
            </div>
          </div>
          <p className="mb-2.5 text-xs font-bold text-[#c7f36b] sm:text-sm">
            Gồm {DEMO_COURSE.lessonsCount} bài video · {formatDurationMinutes(DEMO_COURSE.duration)}
          </p>
          <ul className="space-y-1.5">
            {displayLessons.map((lesson, idx) => (
              <LessonRow
                key={lesson.id}
                title={lesson.title}
                active={idx === 0}
                locked={idx > 0}
              />
            ))}
          </ul>
          {moreLessons > 0 ? (
            <p className="mt-2 pl-1 text-[10px] font-medium text-slate-400 sm:text-[11px]">
              +{moreLessons} bài khác trong khóa
            </p>
          ) : null}
        </div>

        <div className="flex h-full flex-col justify-between gap-2.5 sm:gap-3">
          <div className="liquid-glass rounded-2xl px-3.5 py-2.5 shadow-sm sm:px-4 sm:py-3">
            <div className="flex items-center gap-2 text-[11px] font-bold text-white sm:text-xs">
              <Video className="h-4 w-4 shrink-0 text-[#c7f36b]" />
              {COURSES_SHOWCASE_COPY.panelVideoTitle}
            </div>
            <p className="mt-1.5 text-[11px] font-medium leading-snug text-slate-400 sm:text-xs">
              {COURSES_SHOWCASE_COPY.panelVideoBody}
            </p>
            <p className="mt-1 text-[10px] text-slate-500 sm:text-[11px]">
              {COURSES_SHOWCASE_COPY.panelVideoNote}
            </p>
          </div>

          {DEMO_PROGRESS.map((mod) => (
            <div
              key={mod.id}
              className="liquid-glass rounded-2xl px-3.5 py-2.5 shadow-sm sm:px-4 sm:py-3"
            >
              <div className="mb-1.5 flex items-start justify-between gap-2">
                <p className="line-clamp-2 text-[11px] font-bold leading-snug text-white sm:text-xs">
                  {mod.title}
                </p>
                <span className="shrink-0 text-[11px] font-bold text-[#c7f36b]">
                  {mod.done}/{mod.total}
                </span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-[#c7f36b] to-[#a3e635]"
                  style={{ width: `${mod.pct}%` }}
                />
              </div>
              <p className="mt-1.5 text-[10px] font-medium text-slate-400 sm:text-[11px]">
                {mod.category}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/** Showcase khóa học — desktop: mockup trái, copy phải (khớp mock). */
export function CoursesFeatureShowcase({ onCtaClick }) {
  return (
    <section id="courses" className={ty.section}>

      <div className={`${ty.sectionShell} ${HOME_SECTION_INNER} !overflow-visible`}>
        <div className={ty.sectionGrid}>
          <div className="relative z-10 flex w-full min-w-0 justify-center max-lg:order-last">
            <div className="w-full min-w-0 max-w-[42rem] lg:max-w-none">
              <CoursesLearningMockup />
            </div>
          </div>

          <div className="relative max-lg:order-first">
            <SparkleGlyph
              className="pointer-events-none absolute right-0 top-0 z-[3] h-8 w-8 rotate-12 drop-shadow-md sm:h-9 sm:w-9"
              tone="violet"
            />
            <HomeSectionHeader
              icon={GraduationCap}
              badge={COURSES_SHOWCASE_COPY.badge}
              lines={[
                { text: COURSES_SHOWCASE_COPY.titleLine1, tone: "dark" },
                { text: COURSES_SHOWCASE_COPY.titleLine2, tone: "accent" },
              ]}
              body={COURSES_SHOWCASE_COPY.body}
            >
              <ul className={ty.coursesBulletList}>
                {COURSES_SHOWCASE_COPY.bullets.map((item) => (
                  <li key={item} className="flex items-start gap-2">
                    <CircleCheck className={ty.bulletIcon} strokeWidth={2.5} />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
              {onCtaClick ? (
                <button
                  type="button"
                  onClick={onCtaClick}
                  className={`mt-1 ${ty.cta}`}
                >
                  {COURSES_SHOWCASE_COPY.cta}
                </button>
              ) : null}
            </HomeSectionHeader>
          </div>
        </div>
      </div>
    </section>
  );
}
