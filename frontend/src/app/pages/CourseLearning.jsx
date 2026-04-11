import React, { useState, useEffect, useCallback } from "react";
import {
  ArrowLeft,
  PlayCircle,
  CheckCircle,
  Circle,
  Clock,
  BookOpen,
  Pencil as NotePencil,
  MessageCircle as ChatCircle,
  X,
  ChevronLeft as CaretLeft,
  ChevronRight as CaretRight,
  Award as Certificate,
  Download,
  Share2 as Share,
  List,
  ExternalLink as ArrowSquareOut,
  PartyPopper as Confetti,
  BadgeCheck as SealCheck,
  Zap as Lightning,
  PauseCircle,
  RotateCcw as ArrowCounterClockwise,
  Volume2 as SpeakerHigh,
  Captions as Subtitles,
  Maximize2 as CornersOut,
} from "lucide-react";
import { useParams, useNavigate } from "react-router";
import { getCourseById } from "../data/coursesData";

/* ── Helpers ────────────────────────────────────────────────── */
const formatDuration = (minutes) => {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? `${h}h ${m > 0 ? m + "m" : ""}`.trim() : `${m}m`;
};

const PROGRESS_KEY = (courseId) => `prointerview_course_progress_${courseId}`;
const NOTES_KEY = (courseId, lessonId) =>
  `prointerview_course_notes_${courseId}_${lessonId}`;

/* ── Video Player ────────────────────────────────────────────── */
function VideoPlayer({
  lesson,
  thumbnail,
  isPlaying,
  onTogglePlay,
}) {
  const [progress, setProgress] = useState(0);
  const [hovered, setHovered] = useState(false);

  useEffect(() => {
    setProgress(0);
    let timer;
    if (isPlaying) {
      timer = setInterval(() => {
        setProgress((p) => {
          if (p >= 100) { clearInterval(timer); return 100; }
          return p + (100 / (lesson.duration * 4));
        });
      }, 250);
    }
    return () => clearInterval(timer);
  }, [isPlaying, lesson.id, lesson.duration]);

  return (
    <div
      className="relative w-full bg-black overflow-hidden rounded-lg"
      style={{ aspectRatio: "16/9" }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Thumbnail / BG */}
      <img
        src={thumbnail}
        alt={lesson.title}
        className="absolute inset-0 w-full h-full object-cover opacity-30"
      />
      <div className="absolute inset-0 bg-gradient-to-b from-black/10 via-transparent to-black/60" />

      {/* Preview badge */}
      {lesson.isPreview && (
        <div
          className="absolute top-4 left-4 text-xs font-bold px-3 py-1.5 rounded-full z-10"
          style={{ background: "#c4ff47", color: "#1F1F1F" }}
        >
          ▶ Xem miễn phí
        </div>
      )}

      {/* Lesson info overlay top-right */}
      <div className="absolute top-4 right-4 z-10">
        <div
          className="text-xs font-semibold px-3 py-1.5 rounded-full flex items-center gap-1.5"
          style={{ background: "rgba(0,0,0,0.6)", color: "rgba(255,255,255,0.85)" }}
        >
          <Clock className="w-3.5 h-3.5" />
          {formatDuration(lesson.duration)}
        </div>
      </div>

      {/* Center play/pause */}
      <button
        onClick={onTogglePlay}
        className="absolute inset-0 flex items-center justify-center z-10 cursor-pointer group"
      >
        <div
          className="w-20 h-20 rounded-full flex items-center justify-center shadow-2xl transition-all duration-200 group-hover:scale-110"
          style={{
            background: isPlaying
              ? "rgba(255,255,255,0.15)"
              : "rgba(110, 53, 232,0.9)",
            backdropFilter: "blur(8px)",
          }}
        >
          {isPlaying ? (
            <PauseCircle className="w-10 h-10 text-white" />
          ) : (
            <PlayCircle className="w-10 h-10 text-white" />
          )}
        </div>
      </button>

      {/* Bottom bar (controls) */}
      <div
        className="absolute bottom-0 left-0 right-0 z-20 p-4 transition-all duration-200"
        style={{
          background: "linear-gradient(to top, rgba(0,0,0,0.85), transparent)",
          opacity: hovered || isPlaying ? 1 : 0.5,
        }}
      >
        {/* Seek bar */}
        <div className="relative h-1.5 bg-white/20 rounded-full mb-3 cursor-pointer group">
          <div
            className="absolute left-0 top-0 h-full rounded-full transition-all duration-200"
            style={{ width: `${progress}%`, background: "#c4ff47" }}
          />
          <div
            className="absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full shadow-md opacity-0 group-hover:opacity-100 transition-opacity"
            style={{ left: `${progress}%`, transform: `translateX(-50%) translateY(-50%)`, background: "#c4ff47" }}
          />
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={onTogglePlay} className="text-white hover:text-[#c4ff47] transition-colors">
              {isPlaying ? (
                <PauseCircle className="w-5 h-5" />
              ) : (
                <PlayCircle className="w-5 h-5" />
              )}
            </button>
            <button className="text-white/60 hover:text-white transition-colors">
              <ArrowCounterClockwise className="w-4.5 h-4.5" />
            </button>
            <span className="text-white/70 text-xs">
              {Math.floor((progress / 100) * lesson.duration)}:{String(Math.floor(((progress / 100) * lesson.duration * 60) % 60)).padStart(2, "0")} / {formatDuration(lesson.duration)}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <button className="text-white/60 hover:text-white transition-colors">
              <SpeakerHigh className="w-4.5 h-4.5" />
            </button>
            <button className="text-white/60 hover:text-white transition-colors">
              <Subtitles className="w-4.5 h-4.5" />
            </button>
            <button className="text-white/60 hover:text-white transition-colors">
              <CornersOut className="w-4.5 h-4.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Certificate Modal ────────────────────────────────────────── */
function CertificateModal({
  courseName,
  mentorName,
  onClose,
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)" }}>
      <div className="bg-white rounded-3xl shadow-2xl max-w-lg w-full overflow-hidden">
        {/* Header */}
        <div
          className="relative p-8 text-center overflow-hidden"
          style={{ background: "linear-gradient(135deg, #1a0a3e 0%, #2d1060 100%)" }}
        >
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute top-0 left-1/4 w-40 h-40 rounded-full blur-3xl opacity-30" style={{ background: "#6E35E8" }} />
            <div className="absolute bottom-0 right-1/4 w-32 h-32 rounded-full blur-3xl opacity-20" style={{ background: "#c4ff47" }} />
          </div>
          <Confetti className="w-14 h-14 mx-auto mb-3" style={{ color: "#c4ff47" }} />
          <h2 className="text-2xl font-bold text-white mb-1">Chúc mừng</h2>
          <p className="text-white/60 text-sm">Bạn đã hoàn thành khóa học</p>
        </div>

        {/* Certificate preview */}
        <div className="p-6">
          <div
            className="rounded-2xl p-6 mb-5 text-center relative overflow-hidden"
            style={{
              background: "linear-gradient(135deg, #f9f4ff, #fff8e1)",
              border: "2px solid rgba(110, 53, 232,0.15)",
            }}
          >
            <div className="absolute top-3 left-3 w-6 h-6 border-l-2 border-t-2 border-[#6E35E8]/30 rounded-tl-lg" />
            <div className="absolute top-3 right-3 w-6 h-6 border-r-2 border-t-2 border-[#6E35E8]/30 rounded-tr-lg" />
            <div className="absolute bottom-3 left-3 w-6 h-6 border-l-2 border-b-2 border-[#6E35E8]/30 rounded-bl-lg" />
            <div className="absolute bottom-3 right-3 w-6 h-6 border-r-2 border-b-2 border-[#6E35E8]/30 rounded-br-lg" />

            <Certificate className="w-10 h-10 mx-auto mb-3" style={{ color: "#FFD600" }} />
            <p className="text-xs text-gray-400 uppercase tracking-widest mb-2">Chứng chỉ hoàn thành</p>
            <h3 className="font-bold text-gray-900 text-lg mb-1 leading-tight">{courseName}</h3>
            <p className="text-sm text-gray-500 mb-3">Được chứng nhận bởi <span className="font-semibold text-[#6E35E8]">{mentorName}</span></p>
            <div className="flex items-center justify-center gap-2">
              <SealCheck className="w-4 h-4" style={{ color: "#c4ff47" }} />
              <span className="text-xs text-gray-500">ProInterview Verified · {new Date().toLocaleDateString("vi-VN")}</span>
            </div>
          </div>

          {/* What's next */}
          <div
            className="rounded-2xl p-4 mb-5"
            style={{ background: "rgba(110, 53, 232,0.05)", border: "1px solid rgba(110, 53, 232,0.1)" }}
          >
            <p className="text-sm font-bold text-[#6E35E8] mb-2 flex items-center gap-1.5">
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
                  <CheckCircle className="w-3.5 h-3.5 text-[#6E35E8] shrink-0 mt-0.5" />
                  {item}
                </li>
              ))}
            </ul>
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <button
              className="flex-1 py-3 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 transition-all hover:brightness-110"
              style={{ background: "#c4ff47", color: "#1F1F1F" }}
            >
              <Download className="w-4 h-4" />
              Tải chứng chỉ
            </button>
            <button
              className="flex-1 py-3 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 border transition-all hover:bg-gray-50"
              style={{ border: "1px solid rgba(110, 53, 232,0.2)", color: "#6E35E8" }}
            >
              <Share className="w-4 h-4" />
              Chia sẻ
            </button>
          </div>

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
  lessonTitle,
  lessonIdx,
  mentorAvatar,
  mentorName,
}) {
  const [questions, setQuestions] = useState([]);
  const [newQuestion, setNewQuestion] = useState("");

  // Load questions from localStorage
  useEffect(() => {
    const raw = localStorage.getItem(`prointerview_course_qa_${courseId}_${lessonIdx}`);
    if (raw) setQuestions(JSON.parse(raw) );
  }, [courseId, lessonIdx]);

  // Save questions to localStorage
  useEffect(() => {
    localStorage.setItem(`prointerview_course_qa_${courseId}_${lessonIdx}`, JSON.stringify(questions));
  }, [questions, courseId, lessonIdx]);

  const addQuestion = () => {
    if (!newQuestion.trim()) return;
    setQuestions([...questions, newQuestion.trim()]);
    setNewQuestion("");
  };

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <p className="text-white/60 text-sm">Hỏi & Đáp với Mentor — được lưu tự động</p>
        <span className="text-xs text-white/30">{questions.length} câu hỏi</span>
      </div>
      <div className="flex items-center gap-3 mb-3">
        <input
          value={newQuestion}
          onChange={(e) => setNewQuestion(e.target.value)}
          placeholder="Nhập câu hỏi của bạn..."
          className="flex-1 rounded-2xl p-4 text-sm outline-none transition-all"
          style={{
            background: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(255,255,255,0.08)",
            color: "rgba(255,255,255,0.8)",
            lineHeight: "1.8",
          }}
          onFocus={(e) => (e.target.style.border = "1px solid rgba(110, 53, 232,0.4)")}
          onBlur={(e) => (e.target.style.border = "1px solid rgba(255,255,255,0.08)")}
        />
        <button
          onClick={addQuestion}
          className="px-4 py-2 rounded-xl text-sm font-semibold transition-all hover:brightness-110"
          style={{ background: "rgba(110, 53, 232,0.2)", color: "#8B4DFF" }}
        >
          <ChatCircle className="w-3.5 h-3.5 inline mr-1.5" />
          Gửi
        </button>
      </div>
      <div className="space-y-3">
        {questions.map((q, idx) => (
          <div key={idx} className="rounded-2xl p-4 bg-gray-900">
            <div className="flex items-center gap-3 mb-2">
              <img src={mentorAvatar} alt={mentorName} className="w-8 h-8 rounded-full object-cover shrink-0" />
              <p className="text-sm font-bold text-[#6E35E8]">{mentorName}</p>
            </div>
            <p className="text-sm text-gray-500 leading-relaxed">{q}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Main Component ──────────────────────────────────────────── */
export function CourseLearning() {
  const { id } = useParams();
  const navigate = useNavigate();

  const course = getCourseById(id || "");
  const lessons = course?.lessons || [];

  // Load progress from localStorage
  const loadProgress = useCallback(() => {
    try {
      const raw = localStorage.getItem(PROGRESS_KEY(id || ""));
      return raw ? (JSON.parse(raw) ) : [];
    } catch {
      return [];
    }
  }, [id]);

  const [completedLessons, setCompletedLessons] = useState(loadProgress);
  const [currentLessonIdx, setCurrentLessonIdx] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [activeTab, setActiveTab] = useState("notes");
  const [notes, setNotes] = useState("");
  const [showCertificate, setShowCertificate] = useState(false);
  const [justCompleted, setJustCompleted] = useState(false);

  const currentLesson = lessons[currentLessonIdx];
  const progressPct = lessons.length > 0 ? Math.round((completedLessons.length / lessons.length) * 100) : 0;

  // Reset play state + load notes on lesson change
  useEffect(() => {
    if (!currentLesson) return;
    const saved = localStorage.getItem(NOTES_KEY(id || "", currentLesson.id)) || "";
    setNotes(saved);
    setIsPlaying(false);
    setJustCompleted(false);
  }, [currentLessonIdx, currentLesson, id]);

  // Save notes
  useEffect(() => {
    if (!currentLesson) return;
    localStorage.setItem(NOTES_KEY(id || "", currentLesson.id), notes);
  }, [notes, currentLesson, id]);

  // Save progress
  const saveProgress = (updated) => {
    localStorage.setItem(PROGRESS_KEY(id || ""), JSON.stringify(updated));
  };

  const markComplete = () => {
    if (!currentLesson || completedLessons.includes(currentLesson.id)) return;
    const updated = [...completedLessons, currentLesson.id];
    setCompletedLessons(updated);
    saveProgress(updated);
    setJustCompleted(true);
    if (updated.length === lessons.length) {
      setTimeout(() => setShowCertificate(true), 600);
    }
    // Auto-dismiss toast
    setTimeout(() => setJustCompleted(false), 2800);
  };

  const goToLesson = (idx) => {
    if (idx < 0 || idx >= lessons.length) return;
    setCurrentLessonIdx(idx);
    setIsPlaying(false);
  };

  if (!course || !currentLesson) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="text-center">
          <BookOpen className="w-16 h-16 text-gray-600 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-white mb-2">Không tìm thấy khóa học</h2>
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="mt-4 rounded-xl px-6 py-3 text-sm font-semibold"
            style={{ background: "#6E35E8", color: "#fff" }}
          >
            Quay lại
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-gray-950 overflow-hidden">
      {/* ── Top bar ─────────────────────────────────────────── */}
      <header
        className="flex items-center gap-4 px-4 py-3 shrink-0 z-30"
        style={{ background: "#111", borderBottom: "1px solid rgba(255,255,255,0.08)" }}
      >
        {/* Logo + Back */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="group flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-white/20 bg-white/10 text-white shadow-[0_1px_0_rgba(255,255,255,0.06)_inset] transition-all hover:border-white/35 hover:bg-white/[0.18] active:scale-[0.97]"
            aria-label="Quay lại trang trước"
          >
            <ArrowLeft className="h-5 w-5 transition-transform group-hover:-translate-x-0.5" strokeWidth={2} />
          </button>
          <div className="w-px h-5 bg-white/10" />
          <div
            className="flex items-center gap-1.5 cursor-pointer"
            onClick={() => navigate("/")}
          >
            <Lightning className="w-5 h-5" style={{ color: "#c4ff47" }} />
            <span className="font-bold text-white text-sm hidden sm:inline">ProInterview</span>
          </div>
        </div>

        {/* Course name */}
        <div className="flex-1 min-w-0 px-4">
          <p className="text-white/80 text-sm font-medium truncate">{course.title}</p>
          <p className="text-white/40 text-xs">
            Bài {currentLessonIdx + 1}/{lessons.length} · {currentLesson.title}
          </p>
        </div>

        {/* Progress */}
        <div className="flex items-center gap-3 shrink-0">
          <div className="hidden md:flex items-center gap-2">
            <div className="w-32 h-1.5 bg-white/10 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{ width: `${progressPct}%`, background: "#c4ff47" }}
              />
            </div>
            <span className="text-white/60 text-xs font-medium">{progressPct}%</span>
          </div>

          {progressPct === 100 && (
            <button
              onClick={() => setShowCertificate(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all hover:brightness-110"
              style={{ background: "rgba(196, 255, 71,0.15)", color: "#c4ff47", border: "1px solid rgba(196, 255, 71,0.3)" }}
            >
              <Certificate className="w-3.5 h-3.5" />
              Chứng chỉ
            </button>
          )}

          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-2 rounded-xl text-white/60 hover:text-white hover:bg-white/10 transition-all"
          >
            <List className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* ── Body ─────────────────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden">
        {/* ── Video + Content Area ──────────────────────────── */}
        <div className="flex-1 flex flex-col overflow-y-auto min-w-0" style={{ background: "#0d0d0d" }}>
          {/* Video Player Container with padding */}
          <div className="p-4 md:p-6">
            <VideoPlayer
              lesson={currentLesson}
              thumbnail={course.thumbnail}
              isPlaying={isPlaying}
              onTogglePlay={() => setIsPlaying(!isPlaying)}
            />
          </div>

          {/* Content below video */}
          <div className="flex-1 p-6 max-w-4xl mx-auto w-full">
            {/* Lesson title + complete btn */}
            <div className="flex items-start justify-between gap-4 mb-6">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs font-medium px-2.5 py-1 rounded-full" style={{ background: "rgba(110, 53, 232,0.2)", color: "#8B4DFF" }}>
                    Bài {currentLessonIdx + 1}
                  </span>
                  {completedLessons.includes(currentLesson.id) && (
                    <span className="text-xs font-medium px-2.5 py-1 rounded-full flex items-center gap-1" style={{ background: "rgba(196, 255, 71,0.15)", color: "#4A7A00" }}>
                      <CheckCircle className="w-3.5 h-3.5" />
                      Đã hoàn thành
                    </span>
                  )}
                </div>
                <h1 className="text-xl font-bold text-white leading-tight">{currentLesson.title}</h1>
                <p className="text-white/50 text-sm mt-1 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5" />
                  {formatDuration(currentLesson.duration)}
                </p>
              </div>

              {/* Mark complete / completed */}
              {completedLessons.includes(currentLesson.id) ? (
                <div
                  className="shrink-0 flex items-center gap-2 px-4 py-2.5 rounded-2xl text-sm font-semibold"
                  style={{ background: "rgba(196, 255, 71,0.1)", color: "#c4ff47", border: "1px solid rgba(196, 255, 71,0.2)" }}
                >
                  <CheckCircle className="w-4.5 h-4.5" />
                  Hoàn thành
                </div>
              ) : (
                <button
                  onClick={markComplete}
                  className="shrink-0 flex items-center gap-2 px-4 py-2.5 rounded-2xl text-sm font-bold transition-all hover:brightness-110 active:scale-[0.98]"
                  style={{ background: "#c4ff47", color: "#1F1F1F" }}
                >
                  <CheckCircle className="w-4.5 h-4.5" />
                  Đánh dấu hoàn thành
                </button>
              )}
            </div>

            {/* Tabs: Ghi chú | Hỏi & Đáp */}
            <div className="flex gap-1 border-b mb-6" style={{ borderColor: "rgba(255,255,255,0.08)" }}>
              {[
                { key: "notes", label: "Ghi chú", icon: NotePencil },
                { key: "qa", label: "Hỏi & Đáp", icon: ChatCircle },
              ].map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-all whitespace-nowrap"
                  style={{
                    borderBottomColor: activeTab === tab.key ? "#6E35E8" : "transparent",
                    color: activeTab === tab.key ? "#8B4DFF" : "rgba(255,255,255,0.4)",
                  }}
                >
                  <tab.icon className="w-4 h-4" />
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Tab: Ghi chú */}
            {activeTab === "notes" && (
              <div>
                <div className="mb-3 flex items-center justify-between">
                  <p className="text-white/60 text-sm">Ghi chú của bạn cho bài này — được lưu tự động</p>
                  <span className="text-xs text-white/30">{notes.length} ký tự</span>
                </div>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Nhập ghi chú của bạn ở đây... Ví dụ: STAR method — S: mô tả bối cảnh rõ ràng trong 1-2 câu..."
                  rows={10}
                  className="w-full rounded-2xl p-4 text-sm resize-none outline-none transition-all"
                  style={{
                    background: "rgba(255,255,255,0.04)",
                    border: "1px solid rgba(255,255,255,0.08)",
                    color: "rgba(255,255,255,0.8)",
                    lineHeight: "1.8",
                  }}
                  onFocus={(e) => (e.target.style.border = "1px solid rgba(110, 53, 232,0.4)")}
                  onBlur={(e) => (e.target.style.border = "1px solid rgba(255,255,255,0.08)")}
                />
                <div className="mt-3 flex gap-3">
                  <button
                    onClick={() => setNotes("")}
                    className="px-4 py-2 rounded-xl text-sm border text-white/40 hover:text-white/60 transition-colors"
                    style={{ border: "1px solid rgba(255,255,255,0.08)" }}
                  >
                    Xóa ghi chú
                  </button>
                  <button
                    className="px-4 py-2 rounded-xl text-sm font-semibold transition-all hover:brightness-110"
                    style={{ background: "rgba(110, 53, 232,0.2)", color: "#8B4DFF" }}
                  >
                    <Download className="w-3.5 h-3.5 inline mr-1.5" />
                    Xuất PDF
                  </button>
                </div>
              </div>
            )}

            {/* Tab: Hỏi & Đáp */}
            {activeTab === "qa" && (
              <QASection
                courseId={id || ""}
                lessonTitle={currentLesson.title}
                lessonIdx={currentLessonIdx}
                mentorAvatar={course.mentorAvatar}
                mentorName={course.mentorName}
              />
            )}

            {/* Prev / Next navigation */}
            <div className="flex items-center justify-between mt-8 pt-6" style={{ borderTop: "1px solid rgba(255,255,255,0.07)" }}>
              <button
                onClick={() => goToLesson(currentLessonIdx - 1)}
                disabled={currentLessonIdx === 0}
                className="flex items-center gap-2 px-5 py-3 rounded-2xl text-sm font-semibold transition-all disabled:opacity-30 disabled:cursor-not-allowed hover:bg-white/5"
                style={{ color: "rgba(255,255,255,0.6)", border: "1px solid rgba(255,255,255,0.1)" }}
              >
                <CaretLeft className="w-4 h-4" />
                Bài trước
              </button>

              <div className="text-center">
                <span className="text-white/30 text-xs">
                  {currentLessonIdx + 1} / {lessons.length}
                </span>
              </div>

              <button
                onClick={() => {
                  if (!completedLessons.includes(currentLesson.id)) markComplete();
                  goToLesson(currentLessonIdx + 1);
                }}
                disabled={currentLessonIdx === lessons.length - 1}
                className="flex items-center gap-2 px-5 py-3 rounded-2xl text-sm font-bold transition-all disabled:opacity-30 disabled:cursor-not-allowed hover:brightness-110"
                style={{ background: "#6E35E8", color: "#fff" }}
              >
                Bài tiếp theo
                <CaretRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* ── Right Sidebar: Lesson List ────────────────────── */}
        <aside
          className={`shrink-0 flex flex-col overflow-hidden transition-all duration-300 ${
            sidebarOpen ? "w-80" : "w-0"
          }`}
          style={{ background: "#111", borderLeft: "1px solid rgba(255,255,255,0.06)" }}
        >
          <div className="flex items-center justify-between px-4 py-3.5 shrink-0" style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
            <div>
              <p className="text-white font-semibold text-sm">Nội dung khóa học</p>
              <p className="text-white/40 text-xs mt-0.5">{completedLessons.length}/{lessons.length} bài hoàn thành</p>
            </div>
            <button
              onClick={() => setSidebarOpen(false)}
              className="p-1.5 rounded-lg text-white/40 hover:text-white hover:bg-white/10 transition-all"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Progress bar */}
          <div className="px-4 py-3 shrink-0" style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-white/50 text-xs">Tiến độ học</span>
              <span className="text-xs font-bold" style={{ color: progressPct === 100 ? "#c4ff47" : "#8B4DFF" }}>{progressPct}%</span>
            </div>
            <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{ width: `${progressPct}%`, background: progressPct === 100 ? "#c4ff47" : "#6E35E8" }}
              />
            </div>
          </div>

          {/* Lesson list */}
          <div className="flex-1 overflow-y-auto py-2">
            {lessons.map((lesson, idx) => {
              const isCompleted = completedLessons.includes(lesson.id);
              const isCurrent = idx === currentLessonIdx;

              return (
                <button
                  key={lesson.id}
                  onClick={() => goToLesson(idx)}
                  className="w-full flex items-start gap-3 px-4 py-3.5 text-left transition-all hover:bg-white/5 relative"
                  style={{
                    background: isCurrent ? "rgba(110, 53, 232,0.12)" : "transparent",
                    borderLeft: isCurrent ? "2px solid #6E35E8" : "2px solid transparent",
                  }}
                >
                  {/* Index / check */}
                  <div
                    className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5 text-xs font-bold transition-all"
                    style={{
                      background: isCompleted
                        ? "rgba(196, 255, 71,0.15)"
                        : isCurrent
                        ? "rgba(110, 53, 232,0.2)"
                        : "rgba(255,255,255,0.06)",
                      color: isCompleted ? "#4A7A00" : isCurrent ? "#8B4DFF" : "rgba(255,255,255,0.3)",
                    }}
                  >
                    {isCompleted ? (
                      <CheckCircle className="w-4 h-4" />
                    ) : (
                      <span>{idx + 1}</span>
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <p
                      className="text-xs font-medium leading-snug"
                      style={{
                        color: isCurrent ? "#fff" : isCompleted ? "rgba(255,255,255,0.5)" : "rgba(255,255,255,0.65)",
                      }}
                    >
                      {lesson.title}
                    </p>
                    <div className="flex items-center gap-1.5 mt-1">
                      <Clock className="w-3 h-3" style={{ color: "rgba(255,255,255,0.2)" }} />
                      <span className="text-[10px]" style={{ color: "rgba(255,255,255,0.3)" }}>
                        {formatDuration(lesson.duration)}
                      </span>
                      {lesson.isPreview && (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded" style={{ background: "rgba(196, 255, 71,0.12)", color: "#4A7A00" }}>
                          Preview
                        </span>
                      )}
                    </div>
                  </div>

                  {isCurrent && isPlaying && (
                    <div className="flex gap-0.5 shrink-0 mt-2.5">
                      {[1, 2, 3].map((b) => (
                        <div
                          key={b}
                          className="w-0.5 rounded-full"
                          style={{
                            height: `${8 + b * 3}px`,
                            background: "#6E35E8",
                            animation: `pulse ${0.5 + b * 0.15}s ease-in-out infinite alternate`,
                          }}
                        />
                      ))}
                    </div>
                  )}
                </button>
              );
            })}
          </div>

          {/* Bottom CTA: Book mentor */}
          <div
            className="p-4 shrink-0"
            style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}
          >
            <button
              onClick={() => navigate(`/mentors/${course.mentorId}`)}
              className="w-full flex items-center gap-3 p-3 rounded-2xl transition-all hover:brightness-110"
              style={{ background: "rgba(110, 53, 232,0.12)", border: "1px solid rgba(110, 53, 232,0.2)" }}
            >
              <img src={course.mentorAvatar} alt={course.mentorName} className="w-9 h-9 rounded-full object-cover shrink-0" />
              <div className="flex-1 min-w-0 text-left">
                <p className="text-xs font-bold" style={{ color: "#8B4DFF" }}>Book 1-1 với Mentor</p>
                <p className="text-[11px] text-white/40 truncate">{course.mentorName}</p>
              </div>
              <ArrowSquareOut className="w-3.5 h-3.5 shrink-0" style={{ color: "#6E35E8" }} />
            </button>
          </div>
        </aside>
      </div>

      {/* ── Certificate Modal ──────────────────────────────── */}
      {showCertificate && (
        <CertificateModal
          courseName={course.title}
          mentorName={course.mentorName}
          onClose={() => setShowCertificate(false)}
        />
      )}

      {/* Just completed toast */}
      {justCompleted && (
        <div
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 flex items-center gap-3 px-5 py-3.5 rounded-2xl shadow-2xl animate-in slide-in-from-bottom-3 duration-300"
          style={{ background: "rgba(196, 255, 71,0.95)", color: "#1F1F1F" }}
        >
          <CheckCircle className="w-5 h-5" />
          <span className="text-sm font-bold">Bài học đã hoàn thành 🎉</span>
        </div>
      )}
    </div>
  );
}