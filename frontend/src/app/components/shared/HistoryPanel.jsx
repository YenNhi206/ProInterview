import React, { useState } from "react";
import { useNavigate } from "react-router";
import {
  Mic as Microphone,
  FileText,
  Users,
  Star,
  ChevronRight as CaretRight,
  Check,
  AlertTriangle as Warning,
  X,
  PlusCircle,
  Wrench,
  Trash2 as Trash,
  Clock,
  Calendar as CalendarBlank,
  Building2 as Buildings,
  Briefcase,
  ArrowRight,
  BarChart3 as ChartBar,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

// ─── Interview detail mock feedback ─────────────────────────────────────────
function getInterviewFeedback(item) {
  const avg = item.overall;
  return {
    strengths:
      avg >= 4
        ? [
            "Câu trả lời rõ ràng, logic và dễ hiểu",
            "Ví dụ cụ thể từ kinh nghiệm thực tế",
            "Kết nối tốt giữa kỹ năng và yêu cầu vị trí",
          ]
        : avg >= 3
        ? [
            "Có nền tảng kiến thức tốt về vị trí ứng tuyển",
            "Thái độ tự tin và nhiệt tình",
          ]
        : [
            "Hiểu cơ bản về yêu cầu vị trí",
            "Có nỗ lực cung cấp ví dụ cụ thể",
          ],
    improvements:
      avg >= 4
        ? [
            "Câu trả lời đôi khi hơi dài, có thể cô đọng hơn",
            "Có thể bổ sung thêm số liệu định lượng",
          ]
        : avg >= 3
        ? [
            "Cần bổ sung số liệu cụ thể (%, KPI) để tăng credibility",
            "Phần Result trong STAR model chưa rõ ràng",
            "Tốc độ trả lời đôi khi chậm, cần luyện tập thêm",
          ]
        : [
            "Cần cấu trúc câu trả lời theo STAR model rõ ràng hơn",
            "Thiếu số liệu và bằng chứng cụ thể",
            "Cần luyện tập nhiều hơn với các câu hỏi hành vi",
            "Mất nhiều thời gian suy nghĩ trước khi trả lời",
          ],
    questions: [
      "Giới thiệu về bản thân và điểm mạnh nổi bật?",
      "Tại sao bạn muốn ứng tuyển vị trí này?",
      "Kể về tình huống xử lý deadline gấp?",
      "Điểm yếu lớn nhất và cách cải thiện?",
      `Kinh nghiệm của bạn phù hợp với ${item.company} như thế nào?`,
    ],
  };
}

// ─── Score bar helper ─────────────────────────────────────────────────────────
function ScoreBar({
  label,
  score,
  max,
  color,
}) {
  const pct = (score / max) * 100;
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-gray-600" style={{ fontSize: "0.82rem" }}>
          {label}
        </span>
        <span
          className="font-semibold px-2 py-0.5 rounded-lg"
          style={{
            fontSize: "0.75rem",
            background:
              pct >= 75
                ? "rgba(16,185,129,0.1)"
                : pct >= 55
                ? "rgba(59,130,246,0.1)"
                : "rgba(245,158,11,0.1)",
            color: pct >= 75 ? "#059669" : pct >= 55 ? "#2563eb" : "#d97706",
          }}
        >
          {score}/{max}
        </span>
      </div>
      <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{
            width: `${pct}%`,
            background:
              pct >= 75
                ? "linear-gradient(90deg,#34d399,#10b981)"
                : pct >= 55
                ? "linear-gradient(90deg,#60a5fa,#3b82f6)"
                : "linear-gradient(90deg,#fbbf24,#f59e0b)",
          }}
        />
      </div>
    </div>
  );
}

// ─── Interview Detail Modal ───────────────────────────────────────────────────
function InterviewDetailModal({
  item,
  onClose,
}) {
  const navigate = useNavigate();
  const feedback = getInterviewFeedback(item);
  const [showAllQ, setShowAllQ] = useState(false);

  const scoreColor =
    item.overall >= 4 ? "#10b981" : item.overall >= 3 ? "#3b82f6" : "#f59e0b";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.55)", backdropFilter: "blur(6px)" }}
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col"
        style={{ maxHeight: "90vh" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className="px-6 py-5 flex items-start justify-between"
          style={{ background: "linear-gradient(135deg,#4F46E5,#7C3AED)", flexShrink: 0 }}
        >
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span
                className="text-xs font-semibold px-2.5 py-1 rounded-lg"
                style={{ background: "rgba(255,255,255,0.2)", color: "#fff" }}
              >
                {item.type === "ai" ? "🤖 AI Interview" : "👤 Mock với Mentor"}
              </span>
            </div>
            <h2 className="text-white font-bold" style={{ fontSize: "1.1rem" }}>
              {item.position}
            </h2>
            <p className="text-[#B89DFF] text-sm">
              {item.company}
              {item.mentor && ` · ${item.mentor}`} · {item.duration} phút · {item.date}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl hover:bg-white/20 transition-colors flex-shrink-0"
          >
            <X className="w-5 h-5 text-white" />
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 p-6 space-y-5">
          {/* Overall score */}
          <div
            className="rounded-2xl p-5 flex items-center gap-5"
            style={{ background: "rgba(110, 53, 232,0.05)", border: "1px solid rgba(110, 53, 232,0.12)" }}
          >
            <div
              className="w-20 h-20 rounded-2xl flex flex-col items-center justify-center flex-shrink-0"
              style={{ background: `${scoreColor}18`, border: `2px solid ${scoreColor}40` }}
            >
              <span className="font-bold" style={{ fontSize: "1.8rem", color: scoreColor, lineHeight: 1 }}>
                {item.overall}
              </span>
              <span className="text-xs" style={{ color: scoreColor }}>/ 5</span>
            </div>
            <div>
              <p className="text-gray-800 font-semibold mb-1">Điểm STAR tổng quát</p>
              <div className="flex items-center gap-1 mb-2">
                {[1, 2, 3, 4, 5].map((s) => (
                  <Star
                    key={s}
                    className="w-4 h-4"
                    fill={s <= Math.round(item.overall) ? "#f59e0b" : "none"}
                    style={{ color: s <= Math.round(item.overall) ? "#f59e0b" : "#d1d5db" }}
                  />
                ))}
                <span className="text-gray-500 text-xs ml-1">
                  {item.overall >= 4
                    ? "Rất tốt"
                    : item.overall >= 3
                    ? "Khá tốt"
                    : "Cần cải thiện"}
                </span>
              </div>
              <p className="text-gray-400" style={{ fontSize: "0.78rem" }}>
                {item.type === "ai" ? "Chế độ phỏng vấn AI" : `Phỏng vấn thử với ${item.mentor}`}
              </p>
            </div>
          </div>

          {/* Score breakdown */}
          <div className="bg-white rounded-2xl border border-gray-100 p-5">
            <h4 className="text-gray-800 font-semibold mb-4 flex items-center gap-2" style={{ fontSize: "0.875rem" }}>
              <ChartBar className="w-4 h-4 text-[#6E35E8]" />
              Điểm từng tiêu chí
            </h4>
            <div className="space-y-3.5">
              {[
                { label: "Clarity — Rõ ràng & mạch lạc", score: item.scores.clarity },
                { label: "Structure — Cấu trúc STAR", score: item.scores.structure },
                { label: "Relevance — Liên quan vị trí", score: item.scores.relevance },
                { label: "Credibility — Thuyết phục", score: item.scores.credibility },
              ].map((s) => (
                <ScoreBar key={s.label} label={s.label} score={s.score} max={5} color="" />
              ))}
            </div>
          </div>

          {/* Strengths & improvements */}
          <div className="grid sm:grid-cols-2 gap-4">
            <div
              className="rounded-xl p-4"
              style={{ background: "rgba(16,185,129,0.06)", border: "1px solid rgba(16,185,129,0.15)" }}
            >
              <h4 className="font-semibold mb-3 flex items-center gap-2" style={{ fontSize: "0.82rem", color: "#065f46" }}>
                <Check className="w-4 h-4" /> Điểm mạnh
              </h4>
              <ul className="space-y-1.5">
                {feedback.strengths.map((s, i) => (
                  <li key={i} className="flex items-start gap-2" style={{ fontSize: "0.78rem", color: "#064e3b" }}>
                    <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-emerald-400 flex-shrink-0" />
                    {s}
                  </li>
                ))}
              </ul>
            </div>
            <div
              className="rounded-xl p-4"
              style={{ background: "rgba(245,158,11,0.06)", border: "1px solid rgba(245,158,11,0.18)" }}
            >
              <h4 className="font-semibold mb-3 flex items-center gap-2" style={{ fontSize: "0.82rem", color: "#78350f" }}>
                <Warning className="w-4 h-4" /> Cần cải thiện
              </h4>
              <ul className="space-y-1.5">
                {feedback.improvements.map((s, i) => (
                  <li key={i} className="flex items-start gap-2" style={{ fontSize: "0.78rem", color: "#451a03" }}>
                    <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-amber-400 flex-shrink-0" />
                    {s}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Questions */}
          <div className="bg-white rounded-2xl border border-gray-100 p-5">
            <h4 className="text-gray-800 font-semibold mb-3 flex items-center gap-2" style={{ fontSize: "0.875rem" }}>
              Câu hỏi đã trả lời ({feedback.questions.length})
            </h4>
            <ul className="space-y-2">
              {(showAllQ ? feedback.questions : feedback.questions.slice(0, 3)).map((q, i) => (
                <li key={i} className="flex items-start gap-2.5 p-2.5 rounded-xl bg-gray-50">
                  <span
                    className="flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold"
                    style={{ background: "rgba(110, 53, 232,0.12)", color: "#6E35E8", marginTop: "1px" }}
                  >
                    {i + 1}
                  </span>
                  <span className="text-gray-600" style={{ fontSize: "0.8rem", lineHeight: "1.5" }}>
                    {q}
                  </span>
                </li>
              ))}
            </ul>
            {feedback.questions.length > 3 && (
              <button
                onClick={() => setShowAllQ((v) => !v)}
                className="mt-2 text-xs text-[#6E35E8] hover:text-[#5C28D9] font-medium"
              >
                {showAllQ ? "Thu gọn" : `Xem thêm ${feedback.questions.length - 3} câu hỏi`}
              </button>
            )}
          </div>
        </div>

        {/* Footer CTAs */}
        <div
          className="px-6 py-4 flex gap-3 flex-wrap border-t border-gray-100"
          style={{ flexShrink: 0 }}
        >
          <button
            onClick={() => { onClose(); navigate("/interview"); }}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white transition-all"
            style={{ background: "linear-gradient(135deg,#4F46E5,#7C3AED)", boxShadow: "0 4px 14px rgba(79,70,229,0.3)" }}
          >
            <Microphone className="w-4 h-4" />
            Luyện tập lại
          </button>
          <button
            onClick={() => { onClose(); navigate("/mentors"); }}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold border border-gray-200 text-gray-700 hover:border-[#6E35E8]/40 transition-all"
          >
            <Users className="w-4 h-4" />
            Đặt lịch Mentor
          </button>
          <button
            onClick={onClose}
            className="ml-auto px-4 py-2.5 rounded-xl text-sm text-gray-400 hover:text-gray-600 transition-colors"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── CV Analysis Detail Modal ─────────────────────────────────────────────────
function CVAnalysisDetailModal({
  item,
  onClose,
}) {
  const navigate = useNavigate();
  const [expandedSug, setExpandedSug] = useState(null);

  const matchColor =
    item.matchScore >= 80 ? "#10b981" : item.matchScore >= 65 ? "#3b82f6" : "#f59e0b";

  const SCORE_LABELS = {
    clarity: "Clarity — Rõ ràng",
    structure: "Structure — STAR format",
    relevance: "Relevance — Liên quan JD",
    credibility: "Credibility — Thuyết phục",
  };

  const typeStyle = (type) =>
    type === "add"
      ? { bg: "rgba(16,185,129,0.1)", color: "#059669", label: "Bổ sung" }
      : type === "fix"
      ? { bg: "rgba(59,130,246,0.1)", color: "#2563eb", label: "Chỉnh sửa" }
      : { bg: "rgba(239,68,68,0.1)", color: "#dc2626", label: "Loại bỏ" };

  const priorityStyle = (p) =>
    p === "high"
      ? { bg: "rgba(239,68,68,0.08)", border: "rgba(239,68,68,0.2)", color: "#dc2626", label: "Cao" }
      : p === "medium"
      ? { bg: "rgba(245,158,11,0.08)", border: "rgba(245,158,11,0.2)", color: "#d97706", label: "TB" }
      : { bg: "rgba(107,114,128,0.06)", border: "rgba(107,114,128,0.15)", color: "#6b7280", label: "Thấp" };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.55)", backdropFilter: "blur(6px)" }}
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col"
        style={{ maxHeight: "92vh" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className="px-6 py-5 flex items-start justify-between"
          style={{ background: "linear-gradient(135deg,#4F46E5,#9333ea)", flexShrink: 0 }}
        >
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span
                className="text-xs font-semibold px-2.5 py-1 rounded-lg"
                style={{ background: "rgba(255,255,255,0.2)", color: "#fff" }}
              >
                {item.mode === "jd" ? "📄 Có JD — CV vs JD" : `🗂 Không có JD — ${item.field}`}
              </span>
            </div>
            <h2 className="text-white font-bold" style={{ fontSize: "1.1rem" }}>
              {item.position
                ? `${item.position}${item.company ? ` @ ${item.company}` : ""}`
                : `Ngành ${item.field}`}
            </h2>
            <p className="text-[#B89DFF] text-sm">
              {item.cvFile}
              {item.jdFile && ` · ${item.jdFile}`} · {item.date}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl hover:bg-white/20 transition-colors flex-shrink-0"
          >
            <X className="w-5 h-5 text-white" />
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 p-6 space-y-5">
          {/* Match score + mini stats */}
          <div
            className="rounded-2xl p-5 flex items-center gap-5"
            style={{ background: "rgba(110, 53, 232,0.05)", border: "1px solid rgba(110, 53, 232,0.12)" }}
          >
            {/* Donut */}
            <div className="relative w-24 h-24 flex-shrink-0">
              <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
                <circle cx="50" cy="50" r="40" fill="none" stroke="#f3f4f6" strokeWidth="12" />
                <circle
                  cx="50" cy="50" r="40" fill="none"
                  stroke={matchColor}
                  strokeWidth="12"
                  strokeDasharray={`${item.matchScore * 2.51} 251`}
                  strokeLinecap="round"
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="font-bold" style={{ fontSize: "1.5rem", color: matchColor, lineHeight: 1 }}>
                  {item.matchScore}
                </span>
                <span className="text-xs text-gray-400">%</span>
              </div>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-gray-800 font-semibold mb-2">Điểm khớp</p>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-400" />
                  <span className="text-gray-600" style={{ fontSize: "0.8rem" }}>
                    {item.matchedKeywords.length}/{item.totalKeywords} từ khóa khớp
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-red-400" />
                  <span className="text-gray-600" style={{ fontSize: "0.8rem" }}>
                    {item.missingKeywords.length} từ khóa còn thiếu
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-amber-400" />
                  <span className="text-gray-600" style={{ fontSize: "0.8rem" }}>
                    {item.suggestions.length} gợi ý chỉnh sửa
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Keywords */}
          <div className="bg-white rounded-2xl border border-gray-100 p-5">
            <h4 className="text-gray-800 font-semibold mb-3" style={{ fontSize: "0.875rem" }}>
              Phân tích từ khóa
            </h4>
            <div className="space-y-3">
              <div>
                <p className="text-xs font-semibold text-emerald-600 mb-2">
                  ✓ Khớp ({item.matchedKeywords.length})
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {item.matchedKeywords.map((kw) => (
                    <span
                      key={kw}
                      className="px-2.5 py-1 rounded-full text-xs font-medium"
                      style={{ background: "rgba(16,185,129,0.1)", color: "#059669", border: "1px solid rgba(16,185,129,0.2)" }}
                    >
                      {kw} ✓
                    </span>
                  ))}
                </div>
              </div>
              {item.missingKeywords.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-red-500 mb-2">
                    ✗ Còn thiếu ({item.missingKeywords.length})
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {item.missingKeywords.map((kw) => (
                      <span
                        key={kw}
                        className="px-2.5 py-1 rounded-full text-xs font-medium"
                        style={{ background: "rgba(239,68,68,0.08)", color: "#dc2626", border: "1px solid rgba(239,68,68,0.18)" }}
                      >
                        {kw} ⚠
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Score breakdown */}
          <div className="bg-white rounded-2xl border border-gray-100 p-5">
            <h4 className="text-gray-800 font-semibold mb-4 flex items-center gap-2" style={{ fontSize: "0.875rem" }}>
              <ChartBar className="w-4 h-4 text-[#6E35E8]" />
              Đánh giá chi tiết (4 tiêu chí)
            </h4>
            <div className="space-y-3.5">
              {Object.entries(item.scores).map(([key, val]) => (
                <ScoreBar key={key} label={SCORE_LABELS[key] || key} score={val} max={10} color="" />
              ))}
            </div>
          </div>

          {/* Strengths & weaknesses */}
          <div className="grid sm:grid-cols-2 gap-4">
            <div
              className="rounded-xl p-4"
              style={{ background: "rgba(16,185,129,0.06)", border: "1px solid rgba(16,185,129,0.15)" }}
            >
              <h4 className="font-semibold mb-3 flex items-center gap-2" style={{ fontSize: "0.82rem", color: "#065f46" }}>
                <Check className="w-4 h-4" /> Điểm mạnh
              </h4>
              <ul className="space-y-1.5">
                {item.strengths.map((s, i) => (
                  <li key={i} className="flex items-start gap-2" style={{ fontSize: "0.78rem", color: "#064e3b" }}>
                    <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-emerald-400 flex-shrink-0" />
                    {s}
                  </li>
                ))}
              </ul>
            </div>
            <div
              className="rounded-xl p-4"
              style={{ background: "rgba(245,158,11,0.06)", border: "1px solid rgba(245,158,11,0.18)" }}
            >
              <h4 className="font-semibold mb-3 flex items-center gap-2" style={{ fontSize: "0.82rem", color: "#78350f" }}>
                <Warning className="w-4 h-4" /> Cần cải thiện
              </h4>
              <ul className="space-y-1.5">
                {item.weaknesses.map((s, i) => (
                  <li key={i} className="flex items-start gap-2" style={{ fontSize: "0.78rem", color: "#451a03" }}>
                    <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-amber-400 flex-shrink-0" />
                    {s}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Suggestions */}
          <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
            <div
              className="px-5 py-3 border-b border-gray-100 flex items-center gap-2"
              style={{ background: "rgba(110, 53, 232,0.04)" }}
            >
              <h4 className="text-gray-800 font-semibold" style={{ fontSize: "0.875rem" }}>
                Gợi ý chỉnh sửa ({item.suggestions.length})
              </h4>
            </div>
            <div className="divide-y divide-gray-50">
              {item.suggestions.map((sug, i) => {
                const ts = typeStyle(sug.type);
                const ps = priorityStyle(sug.priority);
                const isOpen = expandedSug === i;
                return (
                  <div key={i}>
                    <button
                      onClick={() => setExpandedSug(isOpen ? null : i)}
                      className="w-full px-5 py-3.5 flex items-center gap-3 hover:bg-gray-50 transition-colors text-left"
                    >
                      <span
                        className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-lg flex-shrink-0"
                        style={{ background: ts.bg, color: ts.color }}
                      >
                        {sug.type === "add" && <PlusCircle className="w-3 h-3" />}
                        {sug.type === "fix" && <Wrench className="w-3 h-3" />}
                        {sug.type === "remove" && <Trash className="w-3 h-3" />}
                        {ts.label}
                      </span>
                      <span className="flex-1 text-gray-800 text-sm font-medium">{sug.title}</span>
                      <span
                        className="flex-shrink-0 text-xs font-medium px-2 py-0.5 rounded-lg"
                        style={{ background: ps.bg, color: ps.color, border: `1px solid ${ps.border}` }}
                      >
                        {ps.label}
                      </span>
                      <CaretRight
                        className="w-4 h-4 text-gray-300 flex-shrink-0 transition-transform"
                        style={{ transform: isOpen ? "rotate(90deg)" : "rotate(0deg)" }}
                      />
                    </button>
                    {isOpen && (
                      <div className="px-5 pb-4 space-y-3">
                        <div
                          className="rounded-xl p-3"
                          style={{ background: "rgba(110, 53, 232,0.04)", border: "1px solid rgba(110, 53, 232,0.1)" }}
                        >
                          <p className="text-xs font-semibold mb-1" style={{ color: "#6E35E8" }}>
                            💡 Lý do
                          </p>
                          <p className="text-gray-600" style={{ fontSize: "0.8rem", lineHeight: "1.6" }}>
                            {sug.reason}
                          </p>
                        </div>
                        {(sug.before || sug.after) && (
                          <div className="grid sm:grid-cols-2 gap-2">
                            {sug.before && (
                              <div
                                className="rounded-xl p-3"
                                style={{ background: "rgba(239,68,68,0.05)", border: "1px solid rgba(239,68,68,0.12)" }}
                              >
                                <p className="text-xs font-semibold mb-1.5" style={{ color: "#dc2626" }}>
                                  ✗ Hiện tại
                                </p>
                                <code
                                  className="text-gray-600 block"
                                  style={{ fontSize: "0.73rem", lineHeight: "1.6", fontFamily: "monospace", whiteSpace: "pre-wrap" }}
                                >
                                  {sug.before}
                                </code>
                              </div>
                            )}
                            {sug.after && (
                              <div
                                className="rounded-xl p-3"
                                style={{ background: "rgba(16,185,129,0.05)", border: "1px solid rgba(16,185,129,0.15)" }}
                              >
                                <p className="text-xs font-semibold mb-1.5" style={{ color: "#059669" }}>
                                  ✓ Nên sửa thành
                                </p>
                                <code
                                  className="text-gray-600 block"
                                  style={{ fontSize: "0.73rem", lineHeight: "1.6", fontFamily: "monospace", whiteSpace: "pre-wrap" }}
                                >
                                  {sug.after}
                                </code>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div
          className="px-6 py-4 flex gap-3 flex-wrap border-t border-gray-100"
          style={{ flexShrink: 0 }}
        >
          <button
            onClick={() => { onClose(); navigate("/interview"); }}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white transition-all"
            style={{ background: "linear-gradient(135deg,#4F46E5,#7C3AED)", boxShadow: "0 4px 14px rgba(79,70,229,0.3)" }}
          >
            <Microphone className="w-4 h-4" />
            Phỏng vấn với AI
          </button>
          <button
            onClick={() => { onClose(); navigate("/cv-analysis"); }}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold border border-gray-200 text-gray-700 hover:border-[#6E35E8]/40 transition-all"
          >
            <FileText className="w-4 h-4" />
            Phân tích lại
          </button>
          <button
            onClick={onClose}
            className="ml-auto px-4 py-2.5 rounded-xl text-sm text-gray-400 hover:text-gray-600 transition-colors"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main HistoryPanel Component ──────────────────────────────────────────────

export function HistoryPanel({ interviewHistory, cvHistory }) {
  const [activeTab, setActiveTab] = useState("interview");
  const [selectedInterview, setSelectedInterview] = useState(null);
  const [selectedCV, setSelectedCV] = useState(null);

  const avgInterviewScore =
    interviewHistory.length > 0
      ? (interviewHistory.reduce((acc, i) => acc + i.overall, 0) / interviewHistory.length).toFixed(1)
      : "—";
  const avgCVMatch =
    cvHistory.length > 0
      ? Math.round(cvHistory.reduce((acc, i) => acc + i.matchScore, 0) / cvHistory.length)
      : 0;
  const bestMatch = cvHistory.length > 0 ? Math.max(...cvHistory.map((i) => i.matchScore)) : 0;

  return (
    <>
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        {/* Tab header */}
        <div className="px-5 pt-5 pb-0">
          <div className="flex items-center gap-1 p-1 rounded-xl bg-gray-100 w-fit mb-4">
            <button
              onClick={() => setActiveTab("interview")}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all"
              style={
                activeTab === "interview"
                  ? { background: "#fff", color: "#4F46E5", boxShadow: "0 1px 4px rgba(0,0,0,0.1)" }
                  : { color: "#6b7280" }
              }
            >
              <Microphone className="w-4 h-4" />
              Phỏng vấn
              <span
                className="px-1.5 py-0.5 rounded-md text-xs font-bold"
                style={
                  activeTab === "interview"
                    ? { background: "rgba(79,70,229,0.1)", color: "#4F46E5" }
                    : { background: "rgba(107,114,128,0.12)", color: "#6b7280" }
                }
              >
                {interviewHistory.length}
              </span>
            </button>
            <button
              onClick={() => setActiveTab("cv")}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all"
              style={
                activeTab === "cv"
                  ? { background: "#fff", color: "#4F46E5", boxShadow: "0 1px 4px rgba(0,0,0,0.1)" }
                  : { color: "#6b7280" }
              }
            >
              <FileText className="w-4 h-4" />
              Phân tích CV/JD
              <span
                className="px-1.5 py-0.5 rounded-md text-xs font-bold"
                style={
                  activeTab === "cv"
                    ? { background: "rgba(79,70,229,0.1)", color: "#4F46E5" }
                    : { background: "rgba(107,114,128,0.12)", color: "#6b7280" }
                }
              >
                {cvHistory.length}
              </span>
            </button>
          </div>

          {/* Mini stats bar */}
          {activeTab === "interview" ? (
            <div className="flex gap-4 pb-4 border-b border-gray-100">
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-[#6E35E8]" />
                <span className="text-gray-400" style={{ fontSize: "0.75rem" }}>
                  {interviewHistory.length} buổi
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <Star className="w-3 h-3 text-amber-400" />
                <span className="text-gray-400" style={{ fontSize: "0.75rem" }}>
                  Điểm TB:{" "}
                  <span className="text-gray-700 font-semibold">{avgInterviewScore}/5</span>
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400" />
                <span className="text-gray-400" style={{ fontSize: "0.75rem" }}>
                  AI:{" "}
                  <span className="text-gray-700 font-semibold">
                    {interviewHistory.filter((i) => i.type === "ai").length}
                  </span>
                  {" · "}Mentor:{" "}
                  <span className="text-gray-700 font-semibold">
                    {interviewHistory.filter((i) => i.type === "mentor").length}
                  </span>
                </span>
              </div>
            </div>
          ) : (
            <div className="flex gap-4 pb-4 border-b border-gray-100">
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-[#9B6DFF]" />
                <span className="text-gray-400" style={{ fontSize: "0.75rem" }}>
                  {cvHistory.length} lần phân tích
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400" />
                <span className="text-gray-400" style={{ fontSize: "0.75rem" }}>
                  Match TB:{" "}
                  <span className="text-gray-700 font-semibold">{avgCVMatch}%</span>
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <Star className="w-3 h-3 text-amber-400" />
                <span className="text-gray-400" style={{ fontSize: "0.75rem" }}>
                  Cao nhất:{" "}
                  <span className="text-gray-700 font-semibold">{bestMatch}%</span>
                </span>
              </div>
            </div>
          )}
        </div>

        {/* List */}
        <div className="divide-y divide-gray-50">
          {activeTab === "interview" &&
            interviewHistory.map((item) => (
              <button
                key={item.id}
                onClick={() => setSelectedInterview(item)}
                className="w-full flex items-center gap-4 px-5 py-3.5 hover:bg-gray-50 transition-colors group text-left"
              >
                <div
                  className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={
                    item.type === "ai"
                      ? { background: "rgba(110, 53, 232,0.1)" }
                      : { background: "rgba(16,185,129,0.1)" }
                  }
                >
                  {item.type === "ai" ? (
                    <Microphone className="w-4 h-4 text-[#6E35E8]" />
                  ) : (
                    <Users className="w-4 h-4 text-emerald-600" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-gray-800 text-sm font-medium truncate">{item.position}</p>
                  <p className="text-gray-400 text-xs">
                    {item.company}
                    {item.mentor && ` · ${item.mentor}`} · {item.date}
                  </p>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0">
                  <div className="text-right">
                    <div className="flex items-center gap-1 justify-end">
                      <Star className="w-3.5 h-3.5 text-amber-400" />
                      <span className="text-gray-800 text-sm font-bold">{item.overall}</span>
                    </div>
                    <p className="text-gray-400 text-xs">{item.duration} phút</p>
                  </div>
                  <CaretRight className="w-4 h-4 text-gray-300 group-hover:text-[#6E35E8] transition-colors" />
                </div>
              </button>
            ))}

          {activeTab === "cv" &&
            cvHistory.map((item) => {
              const matchColor =
                item.matchScore >= 80
                  ? "#10b981"
                  : item.matchScore >= 65
                  ? "#3b82f6"
                  : "#f59e0b";
              return (
                <button
                  key={item.id}
                  onClick={() => setSelectedCV(item)}
                  className="w-full flex items-center gap-4 px-5 py-3.5 hover:bg-gray-50 transition-colors group text-left"
                >
                  <div
                    className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{ background: "rgba(109,53,232,0.1)" }}
                  >
                    <FileText className="w-4 h-4" style={{ color: "#6E35E8" }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-gray-800 text-sm font-medium truncate">
                      {item.position
                        ? `${item.position} @ ${item.company}`
                        : `Ngành ${item.field}`}
                    </p>
                    <p className="text-gray-400 text-xs">
                      {item.cvFile}
                      {item.jdFile && ` · ${item.jdFile}`} · {item.date}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <div className="text-right">
                      <div
                        className="text-sm font-bold"
                        style={{ color: matchColor }}
                      >
                        {item.matchScore}%
                      </div>
                      <p className="text-gray-400 text-xs">
                        {item.matchedKeywords.length}/{item.totalKeywords} kw
                      </p>
                    </div>
                    <CaretRight className="w-4 h-4 text-gray-300 group-hover:text-[#6E35E8] transition-colors" />
                  </div>
                </button>
              );
            })}
        </div>
      </div>

      {/* Modals */}
      {selectedInterview && (
        <InterviewDetailModal
          item={selectedInterview}
          onClose={() => setSelectedInterview(null)}
        />
      )}
      {selectedCV && (
        <CVAnalysisDetailModal
          item={selectedCV}
          onClose={() => setSelectedCV(null)}
        />
      )}
    </>
  );
}