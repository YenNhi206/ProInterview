import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  PlayCircle,
  CheckCircle,
  Clock,
  BookOpen,
  Pencil as NotePencil,
  MessageCircle as ChatCircle,
  X,
  ChevronLeft as CaretLeft,
  ChevronRight as CaretRight,
  ChevronDown as CaretDown,
  ChevronUp as CaretUp,
  FileText,
  PanelRightOpen,
  PanelRightClose,
  Award as Certificate,
  Download,
  Share2 as Share,
  ExternalLink as ArrowSquareOut,
  PartyPopper as Confetti,
  BadgeCheck as SealCheck,
  Zap as Lightning,
  PauseCircle,
  RotateCcw as ArrowCounterClockwise,
  Volume2 as SpeakerHigh,
  Captions as Subtitles,
  Maximize2 as CornersOut,
  Minimize2 as CornersIn,
  Moon,
  Sun,
} from "lucide-react";
import { useParams, useNavigate, useSearchParams } from "react-router";
import { usePageAnalytics } from "../../hooks/usePageAnalytics.js";
import { trackAction } from "../../utils/analytics/analyticsApi.js";
import {
  fetchCourseById,
  fetchLessonContent,
  fetchLessonQA,
  submitLessonQuestion,
  fetchLessonNotes,
  saveLessonNotes,
} from "../../api/courseApi.js";
import { enrollmentApi } from "../../api/enrollmentApi.js";
import { toastApiError, toastApiSuccess } from "../../utils/shared/apiToast.js";
import { avatarSrc, mediaSrc, DEFAULT_COURSE_THUMB } from "../../utils/shared/mediaUrl.js";
import { enrollmentAccessGranted } from "../../utils/course/enrollmentAccess.js";
import { getUser, authFetch } from "../../utils/auth/auth.js";
import { landingPrimaryButtonClass } from "../../constants/landingTheme";
import { readLearningDarkMode, writeLearningDarkMode } from "../../utils/shared/learningDarkMode.js";

/* ── Helpers ────────────────────────────────────────────────── */
const formatDuration = (minutes) => {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? `${h}h ${m > 0 ? m + "m" : ""}`.trim() : `${m}m`;
};

/* ── Curriculum sidebar (Udemy / Coursera style) ───────────── */
function CurriculumPanel({
  modules,
  lessons,
  completedLessons,
  currentLessonIdx,
  progressPct,
  onSelectLesson,
  onClose,
  onCollapsePanel,
  mentorName,
  mentorAvatar,
  onBookMentor,
}) {
  const moduleList = modules?.length ? modules : [{ id: "all", title: "Tất cả bài học", lessons }];

  const [expanded, setExpanded] = useState(() => {
    const init = {};
    moduleList.forEach((m, i) => {
      init[m.id ?? i] = true;
    });
    return init;
  });

  const moduleKeys = moduleList.map((m, i) => String(m.id ?? i)).join("|");

  useEffect(() => {
    setExpanded((prev) => {
      const next = { ...prev };
      moduleList.forEach((m, i) => {
        const key = m.id ?? i;
        if (next[key] === undefined) next[key] = true;
      });
      return next;
    });
  }, [moduleKeys]);

  useEffect(() => {
    let idx = 0;
    for (let mi = 0; mi < moduleList.length; mi += 1) {
      const mod = moduleList[mi];
      const count = mod.lessons?.length || 0;
      if (currentLessonIdx >= idx && currentLessonIdx < idx + count) {
        const modKey = mod.id ?? mi;
        setExpanded((prev) => ({ ...prev, [modKey]: true }));
        break;
      }
      idx += count;
    }
  }, [currentLessonIdx, moduleKeys]);

  let flatIdx = 0;

  return (
    <div className="flex h-full flex-col bg-[#faf9fc] dark:bg-slate-900">
      <div className="flex shrink-0 items-start justify-between gap-2 border-b border-slate-200/80 px-4 py-4 dark:border-slate-800">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">Nội dung khóa học</p>
          <p className="mt-0.5 text-xs font-medium text-slate-600 dark:text-slate-400">
            {completedLessons.length}/{lessons.length} bài · {progressPct}% hoàn thành
          </p>
          <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-slate-200/70 dark:bg-slate-800">
            <div
              className={`h-full rounded-full transition-all duration-500 ${progressPct === 100 ? "bg-emerald-500" : "bg-[#8037f4]"}`}
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-0.5">
          {onCollapsePanel && (
            <button
              type="button"
              onClick={onCollapsePanel}
              className="hidden rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200 lg:inline-flex"
              aria-label="Thu gọn nội dung khóa học"
              title="Thu gọn"
            >
              <PanelRightClose className="h-4 w-4" />
            </button>
          )}
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200 lg:hidden"
              aria-label="Đóng danh sách bài"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto overscroll-contain py-1">
        {moduleList.map((mod, mi) => {
          const modKey = mod.id ?? mi;
          const isOpen = expanded[modKey] !== false;
          const modLessons = mod.lessons || [];

          return (
            <div key={modKey} className="border-b border-slate-100 last:border-b-0 dark:border-slate-800/80">
              <button
                type="button"
                onClick={() => setExpanded((prev) => ({ ...prev, [modKey]: !isOpen }))}
                className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left hover:bg-slate-50/90 dark:hover:bg-slate-800/50"
              >
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-700 dark:text-slate-300">
                  {mod.title || `Phần ${mi + 1}`}
                </span>
                <span className="flex items-center gap-1 text-[10px] font-medium text-slate-600 dark:text-slate-400">
                  {modLessons.length} bài
                  {isOpen ? <CaretUp className="h-3.5 w-3.5" /> : <CaretDown className="h-3.5 w-3.5" />}
                </span>
              </button>

              {isOpen &&
                modLessons.map((lesson) => {
                  const idx = flatIdx;
                  flatIdx += 1;
                  const isCompleted = completedLessons.includes(lesson.id);
                  const isCurrent = idx === currentLessonIdx;

                  return (
                    <button
                      key={lesson.id}
                      type="button"
                      onClick={() => onSelectLesson(idx)}
                      className={`flex w-full items-start gap-3 border-l-[3px] px-4 py-2.5 text-left transition-colors ${
                        isCurrent
                          ? "border-[#8037f4] bg-violet-50/90 dark:bg-violet-950/40 dark:ring-1 dark:ring-violet-500/30"
                          : "border-transparent hover:bg-slate-50 dark:hover:bg-slate-800/60"
                      }`}
                    >
                      <span
                        className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${
                          isCompleted
                            ? "bg-emerald-100 text-emerald-700"
                            : isCurrent
                              ? "bg-[#8037f4] text-white"
                              : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400"
                        }`}
                      >
                        {isCompleted ? <CheckCircle className="h-3.5 w-3.5" /> : <PlayCircle className="h-3.5 w-3.5" />}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span
                          className={`block text-[13px] leading-snug ${
                            isCurrent
                              ? "font-semibold text-slate-900 dark:text-slate-50"
                              : "font-medium text-slate-800 dark:text-slate-200"
                          }`}
                        >
                          {lesson.title}
                        </span>
                        <span className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[11px] font-medium text-slate-600 dark:text-slate-300">
                          <Clock className="h-3 w-3 shrink-0 text-slate-500 dark:text-slate-400" />
                          {formatDuration(lesson.duration)}
                          {lesson.isPreview && (
                            <span className="rounded-md bg-violet-100 px-1.5 py-0.5 text-[10px] font-semibold text-violet-800 dark:bg-violet-950/70 dark:text-violet-300">
                              Xem thử
                            </span>
                          )}
                        </span>
                      </span>
                    </button>
                  );
                })}
            </div>
          );
        })}
      </div>

      <div className="shrink-0 border-t border-slate-200/80 p-4 dark:border-slate-800">
        <button
          type="button"
          onClick={onBookMentor}
          className="flex w-full items-center gap-3 rounded-xl border border-slate-200 bg-white p-3 text-left shadow-sm transition-all hover:border-violet-200 hover:bg-violet-50/50 dark:border-slate-600 dark:bg-slate-800 dark:shadow-sm dark:hover:border-violet-500/50 dark:hover:bg-slate-700"
        >
          <img src={mentorAvatar} alt={mentorName} className="h-10 w-10 rounded-full object-cover ring-2 ring-white dark:ring-slate-600" />
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-slate-900 dark:text-slate-100">Hỏi mentor trực tiếp</p>
            <p className="truncate text-[11px] font-medium text-slate-600 dark:text-slate-300">{mentorName}</p>
          </div>
          <ArrowSquareOut className="h-4 w-4 shrink-0 text-[#8037f4] dark:text-violet-400" />
        </button>
      </div>
    </div>
  );
}

function LessonOverviewPanel({ lesson }) {
  if (!lesson) return null;
  const resources = Array.isArray(lesson.resources) ? lesson.resources : [];

  return (
    <div className="space-y-8">
      {lesson.description ? (
        <section>
          <h3 className="mb-3 text-base font-semibold tracking-tight text-slate-900 dark:text-slate-100">
            Mô tả bài học
          </h3>
          <p className="text-[15px] font-normal leading-7 text-slate-700 dark:text-slate-300">{lesson.description}</p>
        </section>
      ) : null}

      {lesson.transcript ? (
        <section>
          <h3 className="mb-3 text-base font-semibold tracking-tight text-slate-900 dark:text-slate-100">
            Nội dung bài giảng
          </h3>
          <article className="rounded-2xl border border-slate-200/80 bg-white px-5 py-6 shadow-sm dark:border-slate-800 dark:bg-slate-900/80 sm:px-7 sm:py-7">
            <div className="mb-4 flex items-center gap-2 border-b border-slate-100 pb-3 dark:border-slate-800">
              <FileText className="h-4 w-4 text-slate-500 dark:text-slate-400" />
              <span className="text-xs font-medium uppercase tracking-wider text-slate-600 dark:text-slate-400">
                Transcript
              </span>
            </div>
            <div className="whitespace-pre-wrap text-[15px] font-normal leading-[1.75] text-slate-700 dark:text-slate-300">
              {lesson.transcript}
            </div>
          </article>
        </section>
      ) : null}

      {resources.length > 0 ? (
        <section>
          <h3 className="mb-3 text-base font-semibold tracking-tight text-slate-900 dark:text-slate-100">Tài liệu đính kèm</h3>
          <ul className="space-y-2">
            {resources.map((r) => (
              <li key={r.url || r.name}>
                <a
                  href={r.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-[#8037f4] hover:bg-violet-50 dark:border-slate-700 dark:bg-slate-800 dark:text-violet-300 dark:hover:bg-slate-700"
                >
                  <Download className="h-4 w-4" />
                  {r.name || "Tải tài liệu"}
                </a>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {!lesson.description && !lesson.transcript && resources.length === 0 ? (
        <p className="text-sm font-normal text-slate-600 dark:text-slate-400">Chưa có mô tả chi tiết cho bài học này.</p>
      ) : null}
    </div>
  );
}

function getFullscreenElement() {
  return (
    document.fullscreenElement ||
    document.webkitFullscreenElement ||
    document.msFullscreenElement ||
    null
  );
}

function requestElementFullscreen(el) {
  if (!el) return;
  const fn =
    el.requestFullscreen ||
    el.webkitRequestFullscreen ||
    el.msRequestFullscreen;
  if (fn) {
    Promise.resolve(fn.call(el)).catch(() => {});
  }
}

function exitDocumentFullscreen() {
  const fn =
    document.exitFullscreen ||
    document.webkitExitFullscreen ||
    document.msExitFullscreen;
  if (fn) {
    Promise.resolve(fn.call(document)).catch(() => {});
  }
}

/* ── Video Player ────────────────────────────────────────────── */
function VideoPlayer({ lesson, thumbnail, fullBleed = false }) {
  const containerRef = React.useRef(null);
  const videoRef = React.useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const syncFullscreen = () => {
      const container = containerRef.current;
      const active = getFullscreenElement();
      setIsFullscreen(Boolean(container && active === container));
    };

    const onWebkitBegin = () => setIsFullscreen(true);
    const onWebkitEnd = () => setIsFullscreen(false);

    document.addEventListener("fullscreenchange", syncFullscreen);
    document.addEventListener("webkitfullscreenchange", syncFullscreen);
    syncFullscreen();

    const raf = requestAnimationFrame(() => {
      const video = videoRef.current;
      video?.addEventListener("webkitbeginfullscreen", onWebkitBegin);
      video?.addEventListener("webkitendfullscreen", onWebkitEnd);
    });

    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener("fullscreenchange", syncFullscreen);
      document.removeEventListener("webkitfullscreenchange", syncFullscreen);
      const video = videoRef.current;
      video?.removeEventListener("webkitbeginfullscreen", onWebkitBegin);
      video?.removeEventListener("webkitendfullscreen", onWebkitEnd);
    };
  }, [lesson.videoUrl]);

  const togglePlay = () => {
    const video = videoRef.current;
    if (!video) return;
    if (isPlaying) video.pause();
    else video.play().catch(() => {});
  };

  const toggleFullscreen = (e) => {
    e?.stopPropagation?.();
    const video = videoRef.current;
    const container = containerRef.current;

    if (getFullscreenElement() === container) {
      exitDocumentFullscreen();
      return;
    }

    if (video?.webkitDisplayingFullscreen) {
      exitDocumentFullscreen();
      return;
    }

    if (video?.webkitEnterFullscreen) {
      try {
        video.webkitEnterFullscreen();
        setIsFullscreen(true);
        return;
      } catch {
        /* fall through */
      }
    }
    requestElementFullscreen(container || video);
  };

  const onTimeUpdate = () => {
    setCurrentTime(videoRef.current.currentTime);
  };

  const onLoadedMetadata = () => {
    setDuration(videoRef.current.duration);
  };

  const handleSeek = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const clickedPct = x / rect.width;
    const newTime = clickedPct * duration;
    videoRef.current.currentTime = newTime;
    setCurrentTime(newTime);
  };

  const formatTime = (seconds) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
    return `${m}:${String(s).padStart(2, "0")}`;
  };

  const posterUrl = mediaSrc(thumbnail) || "";

  const shellClass = fullBleed
    ? "relative mx-auto aspect-video w-full max-h-[min(70vh,56.25vw)] overflow-hidden bg-slate-200 dark:bg-slate-950 [&:fullscreen]:fixed [&:fullscreen]:inset-0 [&:fullscreen]:z-[9999] [&:fullscreen]:aspect-auto [&:fullscreen]:h-screen [&:fullscreen]:max-h-none [&:fullscreen]:w-screen [&:fullscreen]:bg-black"
    : "group relative aspect-video w-full overflow-hidden rounded-2xl bg-slate-200 shadow-[0_8px_32px_rgba(15,23,42,0.06)] ring-1 ring-slate-200/60 dark:bg-slate-950 dark:ring-slate-800 [&:fullscreen]:fixed [&:fullscreen]:inset-0 [&:fullscreen]:z-[9999] [&:fullscreen]:aspect-auto [&:fullscreen]:h-screen [&:fullscreen]:max-h-none [&:fullscreen]:w-screen [&:fullscreen]:bg-black";

  const progressPct = duration > 0 ? Math.min(100, (currentTime / duration) * 100) : 0;

  return (
    <div
      ref={containerRef}
      className={shellClass}
      onMouseMove={() => {
        setShowControls(true);
        clearTimeout(window.controlsTimeout);
        window.controlsTimeout = setTimeout(() => isPlaying && setShowControls(false), 3000);
      }}
    >
      {posterUrl ? (
        <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
          <img
            src={posterUrl}
            alt=""
            className="h-full w-full scale-110 object-cover opacity-80 blur-3xl brightness-110 saturate-[1.1] dark:opacity-50 dark:brightness-75 dark:saturate-90"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-white/25 via-transparent to-slate-300/30 dark:from-slate-950/20 dark:via-slate-950/40 dark:to-slate-950/70" />
        </div>
      ) : (
        <div
          className="pointer-events-none absolute inset-0 bg-gradient-to-br from-slate-100 via-violet-50/20 to-slate-200/40 dark:from-slate-900 dark:via-slate-950 dark:to-slate-900"
          aria-hidden
        />
      )}

      <video
        key={lesson.videoUrl || "video"}
        ref={videoRef}
        src={mediaSrc(lesson.videoUrl)}
        poster={thumbnail}
        className="relative z-10 h-full w-full object-contain drop-shadow-md"
        onTimeUpdate={onTimeUpdate}
        onLoadedMetadata={onLoadedMetadata}
        onClick={togglePlay}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        playsInline
      />

      {/* Overlay: pointer-events-none so bottom controls stay clickable when paused */}
      <div
        className={`pointer-events-none absolute inset-0 flex flex-col justify-end transition-opacity duration-300 ${
          showControls ? "opacity-100" : "opacity-0"
        }`}
        style={{ background: "linear-gradient(to top, rgba(0,0,0,0.85), transparent 45%)" }}
      >
        {!isPlaying && (
          <div className="absolute inset-0 flex items-center justify-center">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                togglePlay();
              }}
              className="pointer-events-auto flex h-16 w-16 items-center justify-center rounded-full bg-[#8037f4]/95 text-white shadow-2xl ring-4 ring-white/10 transition-transform hover:scale-105 sm:h-20 sm:w-20"
              aria-label="Phát video"
            >
              <PlayCircle className="h-12 w-12" />
            </button>
          </div>
        )}

        <div className="pointer-events-auto relative z-10 space-y-4 p-4 md:p-6">
          <div
            role="slider"
            aria-label="Tiến độ video"
            tabIndex={0}
            className="group/progress relative h-1.5 w-full cursor-pointer rounded-full bg-white/20"
            onClick={(e) => {
              e.stopPropagation();
              handleSeek(e);
            }}
          >
            <div
              className="absolute left-0 top-0 h-full rounded-full bg-[#a66ff8]"
              style={{ width: `${progressPct}%` }}
            />
            <div
              className="absolute top-1/2 h-4 w-4 scale-0 rounded-full bg-[#8037f4] shadow-lg transition-transform group-hover/progress:scale-100"
              style={{ left: `${progressPct}%`, transform: "translate(-50%, -50%)" }}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  togglePlay();
                }}
                className="text-white transition-colors hover:text-violet-200"
                aria-label={isPlaying ? "Tạm dừng" : "Phát"}
              >
                {isPlaying ? <PauseCircle className="h-6 w-6" /> : <PlayCircle className="h-6 w-6" />}
              </button>

              <div className="group/volume relative flex items-center gap-2">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    const next = !isMuted;
                    setIsMuted(next);
                    if (videoRef.current) videoRef.current.muted = next;
                  }}
                  className="text-white/80 hover:text-white"
                  aria-label={isMuted ? "Bật âm thanh" : "Tắt âm thanh"}
                >
                  {isMuted || volume === 0 ? (
                    <SpeakerHigh className="h-5 w-5 opacity-50" />
                  ) : (
                    <SpeakerHigh className="h-5 w-5" />
                  )}
                </button>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.1"
                  value={isMuted ? 0 : volume}
                  onClick={(e) => e.stopPropagation()}
                  onChange={(e) => {
                    e.stopPropagation();
                    const v = parseFloat(e.target.value);
                    setVolume(v);
                    if (videoRef.current) {
                      videoRef.current.volume = v;
                      videoRef.current.muted = v === 0;
                    }
                    setIsMuted(v === 0);
                  }}
                  className="h-1 w-0 accent-[#8037f4] transition-all group-hover/volume:w-20"
                />
              </div>

              <span className="font-mono text-xs text-white/80">
                {formatTime(currentTime)} / {formatTime(duration)}
              </span>
            </div>

            <button
              type="button"
              onClick={toggleFullscreen}
              className="rounded-md p-1 text-white/80 transition-colors hover:bg-white/10 hover:text-white"
              aria-label={isFullscreen ? "Thu nhỏ (thoát toàn màn hình)" : "Phóng to toàn màn hình"}
              title={isFullscreen ? "Thu nhỏ (Esc)" : "Phóng to"}
            >
              {isFullscreen ? <CornersIn className="h-5 w-5" /> : <CornersOut className="h-5 w-5" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}


/* ── Certificate Modal ────────────────────────────────────────── */
function CertificateModal({
  enrollmentId,
  courseName,
  mentorName,
  onClose,
}) {
  const [certData, setCertData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchCert = async () => {
      setLoading(true);
      try {
        const res = await enrollmentApi.getCertificate(enrollmentId);
        if (res.success) {
          setCertData(res.certificate);
        } else {
          toastApiError(res.error, "Không thể lấy chứng chỉ");
        }
      } catch {
        toastApiError("Lỗi kết nối khi lấy chứng chỉ");
      } finally {
        setLoading(false);
      }
    };
    fetchCert();
  }, [enrollmentId]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm">
      <div className="w-full max-w-lg overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-xl">
        {/* Header */}
        <div className="relative overflow-hidden bg-gradient-to-br from-violet-50 via-white to-violet-50/80 p-8 text-center">
          <div className="pointer-events-none absolute inset-0">
            <div className="absolute left-1/4 top-0 h-40 w-40 rounded-full bg-violet-200/40 blur-3xl" />
            <div className="absolute bottom-0 right-1/4 h-32 w-32 rounded-full bg-violet-100/60 blur-3xl" />
          </div>
          <Confetti className="relative mx-auto mb-3 h-14 w-14 text-[#8037f4]" />
          <h2 className="relative mb-1 text-2xl font-bold text-slate-900">Chúc mừng</h2>
          <p className="relative text-sm text-slate-600">Bạn đã hoàn thành khóa học</p>
        </div>

        {/* Certificate preview */}
        <div className="p-6">
          {loading ? (
            <div className="py-12 flex flex-col items-center justify-center gap-3">
              <div className="animate-spin rounded-full h-8 w-8 border-2 border-[#8037f4] border-t-transparent"></div>
              <p className="text-gray-400 text-sm">Đang tạo chứng chỉ...</p>
            </div>
          ) : certData ? (
            <>
              <div
                className="rounded-2xl p-6 mb-5 text-center relative overflow-hidden"
                style={{
                  background: "linear-gradient(135deg, #f9f4ff, #fff8e1)",
                  border: "2px solid rgba(128, 55, 244,0.15)",
                }}
              >
                <div className="absolute top-3 left-3 w-6 h-6 border-l-2 border-t-2 border-[#8037f4]/30 rounded-tl-lg" />
                <div className="absolute top-3 right-3 w-6 h-6 border-r-2 border-t-2 border-[#8037f4]/30 rounded-tr-lg" />
                <div className="absolute bottom-3 left-3 w-6 h-6 border-l-2 border-b-2 border-[#8037f4]/30 rounded-bl-lg" />
                <div className="absolute bottom-3 right-3 w-6 h-6 border-r-2 border-b-2 border-[#8037f4]/30 rounded-br-lg" />

                <Certificate className="w-10 h-10 mx-auto mb-3" style={{ color: "#FFD600" }} />
                <p className="text-xs text-gray-400 uppercase tracking-widest mb-2">Chứng chỉ hoàn thành</p>
                <h3 className="font-bold text-gray-900 text-lg mb-1 leading-tight">{certData.courseTitle || courseName}</h3>
                <p className="text-sm text-gray-500 mb-3">Được chứng nhận cho <span className="font-semibold text-[#8037f4]">{certData.studentName}</span></p>
                <div className="flex flex-col items-center gap-2">
                  <div className="flex items-center gap-2">
                    <SealCheck className="h-4 w-4 text-emerald-600" />
                    <span className="text-xs text-gray-500">ProInterview Verified · {new Date(certData.issuedAt).toLocaleDateString("vi-VN")}</span>
                  </div>
                  {certData.code && (
                    <span className="text-[10px] text-gray-400 font-mono">ID: {certData.code}</span>
                  )}
                </div>
              </div>

              {/* What's next */}
              <div
                className="rounded-2xl p-4 mb-5"
                style={{ background: "rgba(128, 55, 244,0.05)", border: "1px solid rgba(128, 55, 244,0.1)" }}
              >
                <p className="text-sm font-bold text-[#8037f4] mb-2 flex items-center gap-1.5">
                  <Lightning className="w-4 h-4" />
                  Bước tiếp theo
                </p>
                <ul className="space-y-1.5">
                  {[
                    "Chia sẻ chứng chỉ lên LinkedIn để tăng visibility",
                    "Book 1-1 với mentor để nhận feedback cá nhân",
                    "Áp dụng kiến thức vào Mock Interview thực tế",
                  ].map((item) => (
                    <li key={item} className="flex items-start gap-2 text-xs text-gray-600">
                      <CheckCircle className="w-3.5 h-3.5 text-[#8037f4] shrink-0 mt-0.5" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>

              {/* Actions */}
              <div className="flex gap-3">
                <a
                  href={certData.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`${landingPrimaryButtonClass} flex flex-1 items-center justify-center gap-2 rounded-xl py-3 text-sm`}
                >
                  <Download className="w-4 h-4" />
                  Tải chứng chỉ
                </a>
                <button
                  className="flex-1 py-3 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 border transition-all hover:bg-gray-50"
                  style={{ border: "1px solid rgba(128, 55, 244,0.2)", color: "#8037f4" }}
                >
                  <Share className="w-4 h-4" />
                  Chia sẻ
                </button>
              </div>
            </>
          ) : (
            <div className="py-12 text-center">
              <p className="text-gray-500 text-sm">Không thể tải thông tin chứng chỉ.</p>
            </div>
          )}

          <button
            onClick={onClose}
            className="w-full mt-3 py-2.5 text-sm text-gray-400 hover:text-gray-600 transition-colors"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── QA Section ──────────────────────────────────────────────── */
function QASection({
  courseId,
  lessonId,
  mentorAvatar,
  mentorName,
}) {
  const [items, setItems] = useState([]);
  const [newQuestion, setNewQuestion] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!courseId || !lessonId) return;
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      try {
        const res = await fetchLessonQA(courseId, lessonId);
        if (cancelled) return;
        if (!res.success) {
          toastApiError(res.error, "Không tải được câu hỏi.");
          setItems([]);
          return;
        }
        setItems(res.items || []);
      } catch {
        if (!cancelled) toastApiError("Lỗi kết nối khi tải câu hỏi.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [courseId, lessonId]);

  const addQuestion = async () => {
    const text = newQuestion.trim();
    if (!text || submitting) return;
    setSubmitting(true);
    try {
      const res = await submitLessonQuestion(courseId, lessonId, text);
      if (!res.success) {
        toastApiError(res.error, "Không gửi được câu hỏi.");
        return;
      }
      toastApiSuccess(res.message || "Đã gửi câu hỏi.");
      setNewQuestion("");
      if (res.item) {
        setItems((prev) => [res.item, ...prev]);
      } else {
        const reload = await fetchLessonQA(courseId, lessonId);
        if (reload.success) setItems(reload.items || []);
      }
    } catch {
      toastApiError("Lỗi kết nối khi gửi câu hỏi.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div>
      <div className="mb-3 flex items-center gap-3">
        <input
          value={newQuestion}
          onChange={(e) => setNewQuestion(e.target.value)}
          placeholder="Nhập câu hỏi của bạn..."
          disabled={submitting}
          className="flex-1 rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-800 outline-none transition-all placeholder:text-slate-500 focus:border-violet-300 focus:ring-2 focus:ring-violet-100 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:placeholder:text-slate-500 dark:focus:border-violet-500/50 dark:focus:ring-violet-900/40"
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              addQuestion();
            }
          }}
        />
        <button
          type="button"
          onClick={addQuestion}
          disabled={submitting || !newQuestion.trim()}
          className={`${landingPrimaryButtonClass} shrink-0 px-4 py-2 disabled:opacity-40`}
        >
          <ChatCircle className="mr-1.5 inline h-3.5 w-3.5" />
          {submitting ? "Đang gửi…" : "Gửi"}
        </button>
      </div>
      {loading ? (
        <p className="py-6 text-center text-sm text-slate-500">Đang tải câu hỏi…</p>
      ) : items.length === 0 ? (
        <p className="py-6 text-center text-sm text-slate-500">Chưa có câu hỏi nào. Hãy là người đầu tiên!</p>
      ) : (
        <div className="space-y-3">
          {items.map((item) => (
            <div key={item.id} className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900/80">
              <div className="mb-2 flex items-center gap-3">
                <img
                  src={avatarSrc(item.student?.avatar)}
                  alt={item.student?.name || "Học viên"}
                  className="h-8 w-8 shrink-0 rounded-full object-cover"
                />
                <div>
                  <p className="text-sm font-semibold text-slate-900">{item.student?.name || "Học viên"}</p>
                  <p className="text-[10px] font-medium text-slate-600 dark:text-slate-400">{item.time}</p>
                </div>
              </div>
              <p className="text-sm leading-relaxed text-slate-700">{item.question}</p>
              {item.mentorAnswer ? (
                <div className="mt-3 rounded-xl border border-violet-100 bg-violet-50/80 p-3">
                  <div className="mb-1.5 flex items-center gap-2">
                    <img src={avatarSrc(mentorAvatar)} alt={mentorName} className="h-6 w-6 shrink-0 rounded-full object-cover" />
                    <p className="text-xs font-bold text-[#8037f4]">{mentorName}</p>
                    <span className="text-[10px] uppercase tracking-wide text-slate-400">Mentor</span>
                  </div>
                  <p className="text-sm leading-relaxed text-slate-700">{item.mentorAnswer}</p>
                </div>
              ) : (
                <p className="mt-2 text-xs text-slate-400">Chờ mentor trả lời…</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── Main Component ──────────────────────────────────────────── */
export function CourseLearning() {
  const { id } = useParams();
  const navigate = useNavigate();
  usePageAnalytics();
  const [searchParams] = useSearchParams();
  const [peerPreviewMode, setPeerPreviewMode] = useState(false);

  const [course, setCourse] = useState(null);
  const [enrollment, setEnrollment] = useState(null);
  /** Ghi danh CK đang chờ admin, không set vào `enrollment` để tránh coi như đã học được. */
  const [paymentPendingInfo, setPaymentPendingInfo] = useState(null);
  const [completedLessons, setCompletedLessons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentLessonIdx, setCurrentLessonIdx] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [curriculumOpen, setCurriculumOpen] = useState(() => {
    if (typeof window === "undefined") return true;
    return window.matchMedia("(min-width: 1024px)").matches;
  });
  const [isDarkMode, setIsDarkMode] = useState(readLearningDarkMode);

  const toggleDarkMode = () => {
    setIsDarkMode((prev) => {
      const next = !prev;
      writeLearningDarkMode(next);
      return next;
    });
  };
  const [activeTab, setActiveTab] = useState("overview");
  const [notes, setNotes] = useState("");
  const [showCertificate, setShowCertificate] = useState(false);
  const [justCompleted, setJustCompleted] = useState(false);
  const [lessonContent, setLessonContent] = useState(null);
  const [lessonLoading, setLessonLoading] = useState(false);
  const [notesLoading, setNotesLoading] = useState(false);
  const [notesSaving, setNotesSaving] = useState(false);
  const notesSaveTimer = useRef(null);
  const notesLoadedFor = useRef("");

  // Load course and enrollment data
  useEffect(() => {
    if (!id) return;
    
    const loadData = async () => {
      setLoading(true);
      setEnrollment(null);
      setCompletedLessons([]);
      setPaymentPendingInfo(null);
      try {
      const courseRes = await fetchCourseById(id);
      if (!courseRes.success) {
        toastApiError(courseRes.error, "Không tải được khóa học.");
        setLoading(false);
        return;
      }
      
      const c = courseRes.course;
      const mapLesson = (lesson) => ({
        id: String(lesson._id),
        title: lesson.title,
        duration: lesson.durationMinutes || 0,
        isPreview: !!lesson.isFree,
        _id: String(lesson._id),
      });
      const modules = (c.modules || []).map((module, mi) => ({
        id: String(module._id || `mod-${mi}`),
        title: module.title || `Phần ${mi + 1}`,
        lessons: (module.lessons || []).map(mapLesson),
      }));
      const allLessons = modules.flatMap((m) => m.lessons);
      const flatCourse = {
        id: c._id,
        title: c.title,
        thumbnail: mediaSrc(c.thumbnail, DEFAULT_COURSE_THUMB),
        mentorId: c.mentorId?._id,
        mentorName: c.mentorId?.userId?.name || "Khuất danh",
        mentorAvatar: avatarSrc(c.mentorId?.userId?.avatar) || "https://api.dicebear.com/7.x/avataaars/svg?seed=Lucky",
        modules,
        lessons: allLessons,
      };
      setCourse(flatCourse);

      // Get enrollment data
      const enrollRes = await enrollmentApi.getMyEnrollments();
      if (enrollRes.success) {
        const found = enrollRes.enrollments.find(
          (e) => String(e.courseId?._id || e.courseId || "") === String(id),
        );
        if (found) {
          if (enrollmentAccessGranted(found)) {
            setEnrollment(found);
            setCompletedLessons((found.completedLessons || []).map((lessonId) => String(lessonId)));
            setPaymentPendingInfo(null);
          } else {
            setEnrollment(null);
            setCompletedLessons([]);
            setPaymentPendingInfo({
              courseId: String(id),
              price: Number(c.price || 0),
            });
          }
        } else {
          setEnrollment(null);
          setCompletedLessons([]);
          setPaymentPendingInfo(null);
        }
      }
      // Verify peerPreview against server — do not trust localStorage role alone
      if (searchParams.get("peerReview") === "1") {
        try {
          const meRes = await authFetch("/api/auth/me");
          const meData = await meRes.json();
          if (meData?.user?.role === "mentor") setPeerPreviewMode(true);
        } catch {}
      }
      } catch {
        toastApiError("Lỗi kết nối khi tải khóa học.");
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [id]);

  const lessons = course?.lessons || [];
  const currentLesson = lessons[currentLessonIdx];
  const progressPct = lessons.length > 0 ? Math.round((completedLessons.length / lessons.length) * 100) : 0;

  // Reset play state on lesson change
  useEffect(() => {
    if (!currentLesson) return;
    setNotes("");
    setIsPlaying(false);
    setJustCompleted(false);
  }, [currentLessonIdx, currentLesson, id]);

  // Load notes from API
  useEffect(() => {
    if (!id || !currentLesson?.id || peerPreviewMode) return;
    const key = `${id}:${currentLesson.id}`;
    notesLoadedFor.current = "";
    let cancelled = false;

    const loadNotes = async () => {
      setNotesLoading(true);
      try {
        const res = await fetchLessonNotes(id, currentLesson.id);
        if (cancelled) return;
        if (!res.success) {
          if (res.error !== "Chưa đăng nhập.") {
            toastApiError(res.error, "Không tải được ghi chú.");
          }
          setNotes("");
          return;
        }
        setNotes(res.content || "");
        notesLoadedFor.current = key;
      } catch {
        if (!cancelled) toastApiError("Lỗi kết nối khi tải ghi chú.");
      } finally {
        if (!cancelled) setNotesLoading(false);
      }
    };

    loadNotes();
    return () => {
      cancelled = true;
    };
  }, [id, currentLesson?.id, peerPreviewMode]);

  // Autosave notes (debounced)
  useEffect(() => {
    if (!id || !currentLesson?.id || notesLoading || peerPreviewMode) return;
    const key = `${id}:${currentLesson.id}`;
    if (notesLoadedFor.current !== key) return;

    if (notesSaveTimer.current) clearTimeout(notesSaveTimer.current);
    notesSaveTimer.current = setTimeout(async () => {
      setNotesSaving(true);
      try {
        const res = await saveLessonNotes(id, currentLesson.id, notes);
        if (!res.success && res.error !== "Chưa đăng nhập.") {
          toastApiError(res.error, "Không lưu được ghi chú.");
        }
      } catch {
        toastApiError("Lỗi kết nối khi lưu ghi chú.");
      } finally {
        setNotesSaving(false);
      }
    }, 800);

    return () => {
      if (notesSaveTimer.current) clearTimeout(notesSaveTimer.current);
    };
  }, [notes, id, currentLesson?.id, notesLoading]);

  // Load detailed lesson content
  useEffect(() => {
    if (!id || !currentLesson?.id) return;

    const loadLesson = async () => {
      setLessonLoading(true);
      try {
        const res = await fetchLessonContent(id, currentLesson.id);
        if (res.success) {
          setLessonContent(res.lesson);
        } else {
          toastApiError(res.error, "Không thể lấy nội dung bài học.");
        }
      } catch {
        toastApiError("Lỗi kết nối khi tải nội dung bài học.");
      } finally {
        setLessonLoading(false);
      }
    };

    loadLesson();
  }, [id, currentLesson?._id]);

  // Save progress
  const markComplete = async () => {
    if (!currentLesson || !enrollment || completedLessons.includes(currentLesson.id)) return;
    
    // Optimistic update
    const updated = [...completedLessons, currentLesson.id];
    setCompletedLessons(updated);
    
    try {
      const res = await enrollmentApi.updateProgress(enrollment._id, currentLesson.id, true);
      if (res.success) {
        setJustCompleted(true);
        if (updated.length === lessons.length) {
          trackAction("course_complete", `/courses/${id}/learn`, {
            courseId: id,
            enrollmentId: enrollment._id,
            lessonCount: lessons.length,
          });
          setTimeout(() => setShowCertificate(true), 600);
        }
        setTimeout(() => setJustCompleted(false), 2800);
      } else {
        setCompletedLessons((prev) => prev.filter((lid) => lid !== currentLesson.id));
        toastApiError(res.error, "Không thể lưu tiến độ.");
      }
    } catch {
      setCompletedLessons((prev) => prev.filter((lid) => lid !== currentLesson.id));
      toastApiError("Lỗi kết nối khi lưu tiến độ.");
    }
  };

  const goToLesson = (idx) => {
    if (idx < 0 || idx >= lessons.length) return;
    setCurrentLessonIdx(idx);
    setIsPlaying(false);
    setActiveTab("overview");
    if (typeof window !== "undefined" && !window.matchMedia("(min-width: 1024px)").matches) {
      setCurriculumOpen(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#faf9fc] dark:bg-slate-950">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-primary-fixed border-t-transparent"></div>
      </div>
    );
  }

  if (!loading && paymentPendingInfo && course) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#faf9fc] px-6 dark:bg-slate-950">
        <div className="text-center max-w-md">
          <BookOpen className="w-16 h-16 text-amber-500/80 mx-auto mb-4" />
          <h2 className="mb-2 text-xl font-bold text-slate-900">Chờ xác nhận thanh toán</h2>
          <p className="mb-6 text-sm leading-relaxed text-slate-600">
            Ghi danh khóa học đã được tạo. Sau khi bạn chuyển khoản đúng mã PI và số tiền, SePay sẽ tự xác nhận và mở học đầy đủ (thường trong vài phút).
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <button
              type="button"
              onClick={() =>
                navigate(
                  `/checkout?type=course&courseId=${paymentPendingInfo.courseId}&price=${paymentPendingInfo.price}`,
                )
              }
              className={`${landingPrimaryButtonClass} rounded-xl px-6 py-3 text-sm shadow-md`}
            >
              Tiếp tục thanh toán
            </button>
            <button
              type="button"
              onClick={() => navigate(`/courses/${id}`)}
              className="rounded-xl border border-slate-200 bg-white px-6 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              Về trang khóa học
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (
    !loading &&
    course &&
    !enrollment &&
    !paymentPendingInfo &&
    lessons.length > 0 &&
    !peerPreviewMode
  ) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#faf9fc] px-6 dark:bg-slate-950">
        <div className="text-center max-w-md">
          <BookOpen className="mx-auto mb-4 h-16 w-16 text-violet-300" />
          <h2 className="mb-2 text-xl font-bold text-slate-900">Chưa ghi danh</h2>
          <p className="mb-6 text-sm text-slate-600">
            Vui lòng đăng ký (và thanh toán nếu khóa có phí) từ trang chi tiết khóa học.
          </p>
          <button
            type="button"
            onClick={() => navigate(`/courses/${id}`)}
            className={`${landingPrimaryButtonClass} rounded-xl px-6 py-3 text-sm`}
          >
            Về trang khóa học
          </button>
        </div>
      </div>
    );
  }

  if (!course || (!currentLesson && lessons.length > 0)) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#faf9fc] dark:bg-slate-950">
        <div className="text-center">
          <BookOpen className="mx-auto mb-4 h-16 w-16 text-violet-300" />
          <h2 className="mb-2 text-xl font-bold text-slate-900">Không tìm thấy khóa học</h2>
          <button
            type="button"
            onClick={() => navigate("/courses")}
            className={`${landingPrimaryButtonClass} mt-4 rounded-xl px-6 py-3 text-sm`}
          >
            Khám phá khóa học
          </button>
        </div>
      </div>
    );
  }

  const courseModules = course.modules?.length ? course.modules : [{ id: "all", title: "Bài học", lessons }];

  return (
    <div
      className={`${isDarkMode ? "dark" : ""} flex h-screen flex-col overflow-hidden bg-slate-100 antialiased text-slate-900 dark:bg-slate-950 dark:text-slate-100`}
    >
      {peerPreviewMode ? (
        <div className="shrink-0 border-b border-violet-200 bg-violet-50 px-4 py-2 text-center text-sm text-violet-950 dark:border-violet-500/30 dark:bg-violet-950/40 dark:text-violet-100">
          Xem trước đánh giá chéo, chỉ xem bài, không lưu tiến độ.
        </div>
      ) : null}
      {/* ── Top bar (Coursera / Udemy: breadcrumb + progress) ── */}
      <header className="z-30 flex min-h-14 shrink-0 items-center gap-3 border-b border-slate-200 bg-white px-3 py-2 dark:border-slate-800 dark:bg-slate-900 sm:px-4">
        <div className="min-w-0 flex-1 py-0.5">
          <h1 className="truncate text-base font-semibold leading-tight tracking-tight text-slate-900 dark:text-slate-50 sm:text-lg md:text-xl">
            {course.title}
          </h1>
          <p className="mt-0.5 truncate text-xs font-medium text-slate-600 dark:text-slate-400 sm:text-sm">
            Bài {currentLessonIdx + 1}/{lessons.length}: {currentLesson.title}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2 sm:gap-3">
          <button
            type="button"
            onClick={toggleDarkMode}
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-amber-300"
            aria-label={isDarkMode ? "Bật giao diện sáng" : "Bật giao diện tối"}
            title={isDarkMode ? "Giao diện sáng" : "Giao diện tối"}
          >
            {isDarkMode ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>
          <div className="hidden items-center gap-2 sm:flex">
            <div className="h-2 w-24 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800 md:w-32">
              <div
                className="h-full rounded-full bg-[#8037f4] transition-all duration-500"
                style={{ width: `${progressPct}%` }}
              />
            </div>
            <span className="text-xs font-semibold tabular-nums text-slate-600 dark:text-slate-400">{progressPct}%</span>
          </div>
          {progressPct === 100 && (
            <button
              type="button"
              onClick={() => setShowCertificate(true)}
              className="hidden items-center gap-1 rounded-lg border border-violet-200 bg-violet-50 px-2.5 py-1.5 text-xs font-semibold text-[#8037f4] dark:border-violet-500/40 dark:bg-violet-950/50 dark:text-violet-300 sm:flex"
            >
              <Certificate className="h-3.5 w-3.5" />
              Chứng chỉ
            </button>
          )}
        </div>
      </header>

      <div className="relative flex min-h-0 flex-1">
        {/* ── Main: video + lesson workspace ───────────────── */}
        <div className="flex min-w-0 flex-1 flex-col overflow-y-auto">
          <div className="shrink-0 bg-slate-200 dark:bg-slate-950">
            {lessonLoading ? (
              <div className="flex aspect-video max-h-[min(70vh,56.25vw)] w-full flex-col items-center justify-center gap-3 bg-slate-100 dark:bg-slate-950">
                <div className="h-10 w-10 animate-spin rounded-full border-4 border-violet-400 border-t-transparent" />
                <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Đang tải bài học...</p>
              </div>
            ) : lessonContent ? (
              <VideoPlayer lesson={lessonContent} thumbnail={course.thumbnail} fullBleed />
            ) : (
              <div className="flex aspect-video w-full flex-col items-center justify-center gap-3 bg-slate-100 dark:bg-slate-950">
                <X className="h-10 w-10 text-slate-400" />
                <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Không thể tải nội dung bài học.</p>
              </div>
            )}
          </div>

          {/* Lesson action strip (under video, like Udemy) */}
          <div className="shrink-0 border-b border-slate-200 bg-white px-4 py-4 dark:border-slate-800 dark:bg-slate-900 sm:px-6">
            <div className="mx-auto flex max-w-4xl flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <h2 className="text-lg font-semibold leading-snug tracking-tight text-slate-900 dark:text-slate-50 sm:text-xl">
                  {currentLesson.title}
                </h2>
                <p className="mt-1 flex flex-wrap items-center gap-2 text-sm font-medium text-slate-600 dark:text-slate-400">
                  <span className="flex items-center gap-1">
                    <Clock className="h-3.5 w-3.5" />
                    {formatDuration(currentLesson.duration)}
                  </span>
                  <span className="text-slate-300 dark:text-slate-600">·</span>
                  <span>
                    Bài {currentLessonIdx + 1}/{lessons.length}
                  </span>
                  {completedLessons.includes(currentLesson.id) && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400">
                      <CheckCircle className="h-3 w-3" />
                      Đã hoàn thành
                    </span>
                  )}
                </p>
              </div>
              <div className="flex shrink-0 flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => goToLesson(currentLessonIdx - 1)}
                  disabled={currentLessonIdx === 0}
                  className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 shadow-sm hover:bg-slate-50 disabled:opacity-40 dark:border-slate-500 dark:bg-slate-800 dark:text-slate-100 dark:shadow-none dark:hover:border-slate-400 dark:hover:bg-slate-700 disabled:dark:opacity-40"
                >
                  <CaretLeft className="h-4 w-4" />
                  Trước
                </button>
                {completedLessons.includes(currentLesson.id) ? (
                  <span className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-400">
                    <CheckCircle className="h-4 w-4" />
                    Đã xong
                  </span>
                ) : (
                  <button type="button" onClick={markComplete} className={`${landingPrimaryButtonClass} gap-1.5 px-4 py-2 text-sm`}>
                    <CheckCircle className="h-4 w-4" />
                    Hoàn thành bài
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => goToLesson(currentLessonIdx + 1)}
                  disabled={currentLessonIdx === lessons.length - 1}
                  className={`${landingPrimaryButtonClass} gap-1.5 px-3 py-2 text-sm disabled:opacity-40`}
                >
                  Tiếp
                  <CaretRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>

          <div className="flex-1 bg-[#faf9fc] dark:bg-slate-950">
            <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6">
              <div className="mb-6 flex gap-0 border-b border-slate-200/80 dark:border-slate-800">
                {[
                  { key: "overview", label: "Tổng quan", icon: BookOpen },
                  { key: "notes", label: "Ghi chú", icon: NotePencil },
                  { key: "qa", label: "Hỏi & Đáp", icon: ChatCircle },
                ].map((tab) => (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => setActiveTab(tab.key)}
                    className={`flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-medium transition-colors ${
                      activeTab === tab.key
                        ? "border-[#8037f4] text-[#8037f4]"
                        : "border-transparent text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200"
                    }`}
                  >
                    <tab.icon className="h-4 w-4" />
                    {tab.label}
                  </button>
                ))}
              </div>

              {activeTab === "overview" && <LessonOverviewPanel lesson={lessonContent} />}

              {activeTab === "notes" && (
              <div>
                {(notesSaving || notesLoading) && (
                  <p className="mb-2 text-xs text-slate-400">
                    {notesLoading ? "Đang tải…" : "Đang lưu…"}
                  </p>
                )}
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  disabled={notesLoading}
                  placeholder="Nhập ghi chú của bạn ở đây... Ví dụ: STAR method, S: mô tả bối cảnh rõ ràng trong 1-2 câu..."
                  rows={10}
                  className="w-full resize-none rounded-2xl border border-slate-200/80 bg-white p-5 text-[15px] font-normal leading-7 text-slate-800 shadow-sm outline-none transition-all placeholder:text-slate-500 focus:border-violet-300 focus:ring-2 focus:ring-violet-100/80 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:placeholder:text-slate-500 dark:focus:border-violet-500/40 dark:focus:ring-violet-900/30"
                />
                <div className="mt-3 flex gap-3">
                  <button
                    type="button"
                    onClick={() => setNotes("")}
                    className="rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-600 transition-colors hover:bg-slate-50"
                  >
                    Xóa ghi chú
                  </button>
                  <button
                    type="button"
                    className="rounded-lg border border-violet-200 bg-violet-50 px-4 py-2 text-sm font-semibold text-[#8037f4] transition-all hover:bg-violet-100"
                  >
                    <Download className="mr-1.5 inline h-3.5 w-3.5" />
                    Xuất PDF
                  </button>
                </div>
              </div>
            )}

            {/* Tab: Hỏi & Đáp */}
            {activeTab === "qa" && currentLesson && (
              <QASection
                courseId={id || ""}
                lessonId={currentLesson.id}
                mentorAvatar={course.mentorAvatar}
                mentorName={course.mentorName}
              />
            )}

            </div>
          </div>
        </div>

        {/* Desktop curriculum, có thể thu gọn */}
        <aside
          id="course-curriculum-panel"
          className={`hidden shrink-0 flex-col overflow-hidden border-l border-slate-200/80 bg-[#faf9fc] shadow-sm transition-[width] duration-300 ease-out dark:border-slate-800 dark:bg-slate-900 lg:flex ${
            curriculumOpen ? "w-[min(360px,38vw)]" : "w-0 border-l-0"
          }`}
        >
          {curriculumOpen && (
            <CurriculumPanel
              modules={courseModules}
              lessons={lessons}
              completedLessons={completedLessons}
              currentLessonIdx={currentLessonIdx}
              progressPct={progressPct}
              onSelectLesson={goToLesson}
              onCollapsePanel={() => setCurriculumOpen(false)}
              mentorName={course.mentorName}
              mentorAvatar={course.mentorAvatar}
              onBookMentor={() => navigate(`/mentors/${course.mentorId}`)}
            />
          )}
        </aside>

        {/* Mobile curriculum drawer */}
        {curriculumOpen && (
          <>
            <button
              type="button"
              className="fixed inset-0 z-40 bg-slate-900/50 lg:hidden"
              aria-label="Đóng nội dung khóa học"
              onClick={() => setCurriculumOpen(false)}
            />
            <aside className="fixed bottom-0 right-0 top-14 z-50 flex w-full max-w-sm flex-col border-l border-slate-200 bg-[#faf9fc] shadow-2xl dark:border-slate-800 dark:bg-slate-900 lg:hidden">
              <CurriculumPanel
                modules={courseModules}
                lessons={lessons}
                completedLessons={completedLessons}
                currentLessonIdx={currentLessonIdx}
                progressPct={progressPct}
                onSelectLesson={(idx) => {
                  goToLesson(idx);
                  setCurriculumOpen(false);
                }}
                onClose={() => setCurriculumOpen(false)}
                mentorName={course.mentorName}
                mentorAvatar={course.mentorAvatar}
                onBookMentor={() => navigate(`/mentors/${course.mentorId}`)}
              />
            </aside>
          </>
        )}

        {/* Tab mép phải, mở lại nội dung khi đã thu gọn */}
        {!curriculumOpen && (
          <button
            type="button"
            onClick={() => setCurriculumOpen(true)}
            className="fixed right-0 top-1/2 z-20 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-l-xl border border-r-0 border-slate-200 bg-white text-[#8037f4] shadow-md transition-colors hover:bg-violet-50 dark:border-slate-700 dark:bg-slate-800 dark:text-violet-400 dark:hover:bg-slate-700"
            aria-label="Mở nội dung khóa học"
            title="Mở nội dung khóa học"
          >
            <PanelRightOpen className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* ── Certificate Modal ──────────────────────────────── */}
      {showCertificate && enrollment && (
        <CertificateModal
          enrollmentId={enrollment._id}
          courseName={course.title}
          mentorName={course.mentorName}
          onClose={() => setShowCertificate(false)}
        />
      )}

      {/* Just completed toast */}
      {justCompleted && (
        <div className="animate-in slide-in-from-bottom-3 fixed bottom-6 left-1/2 z-40 flex -translate-x-1/2 items-center gap-3 rounded-xl border border-violet-200 bg-white px-5 py-3.5 text-slate-900 shadow-lg duration-300 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100">
          <CheckCircle className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
          <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">Bài học đã hoàn thành</span>
        </div>
      )}
    </div>
  );
}