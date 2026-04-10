import React, { useState } from "react";
import { useNavigate } from "react-router";
import {
  Star,
  TrendingUp as TrendUp,
  Check,
  AlertCircle as Warning,
  ChevronDown as CaretDown,
  ChevronUp as CaretUp,
  Download as DownloadSimple,
  Share2 as ShareNetwork,
  Mic as Microphone,
  Users,
  LayoutGrid as SquaresFour,
  Target,
  Lightbulb,
  BookOpen,
  ArrowLeft,
  Eye,
  Frown as SmileyNervous,
  Activity as PersonSimpleWalk,
  Volume2 as SpeakerHigh,
  MessageSquareText as ChatTeardropDots,
  Quote as Quotes,
  Activity as WaveTriangle,
  GraduationCap,
  Lock,
  Zap as Lightning,
} from "lucide-react";
import { CourseRecommendations } from "../components/CourseRecommendations";
import { getPlans } from "../utils/auth";

const FREE_LIMIT = 3;
const QUESTIONS_FEEDBACK = [
  {
    q: "Hãy giới thiệu về bản thân và điểm mạnh nổi bật nhất của bạn?",
    scores: { clarity: 4, structure: 4, relevance: 4.5, credibility: 3.5 },
    overall: 4.0,
    strengths: ["Giới thiệu rõ ràng, có cấu trúc", "Nêu được điểm mạnh liên quan đến JD"],
    improvements: ["Cần cụ thể hơn về thành tích có số liệu", "Phần kết luận chưa impact"],
    suggestion: "Thay vì nói 'tôi là người chăm chỉ', hãy nói: 'Trong 2 năm tại [Công ty X], tôi đã hoàn thành 95% sprint đúng deadline và được đánh giá performance 'Exceeds Expectations' 2 quý liên tiếp.'",
  },
  {
    q: "Tại sao bạn muốn ứng tuyển vào vị trí này tại công ty chúng tôi?",
    scores: { clarity: 4.5, structure: 3.5, relevance: 5, credibility: 4 },
    overall: 4.2,
    strengths: ["Nghiên cứu kỹ về công ty và vị trí", "Kết nối tốt giữa kinh nghiệm và yêu cầu JD"],
    improvements: ["Thêm ví dụ cụ thể về sản phẩm của công ty bạn đã dùng", "Phần 'tôi có thể đóng góp gì' còn sơ sài"],
    suggestion: "Thêm: 'Tôi đã dùng [Sản phẩm] trong 2 năm và nhận thấy [vấn đề X]. Với background frontend của mình, tôi có thể đóng góp vào cải thiện trải nghiệm [Y].'",
  },
  {
    q: "Hãy kể về một tình huống khó khăn nhất bạn đã gặp phải và cách bạn giải quyết nó?",
    scores: { clarity: 3.5, structure: 3, relevance: 3.5, credibility: 3 },
    overall: 3.3,
    strengths: ["Kể câu chuyện có thực tế", "Thể hiện được kỹ năng giải quyết vấn đề"],
    improvements: ["Chưa rõ STAR (Situation-Task-Action-Result)", "Kết quả chưa có số liệu cụ thể", "Câu chuyện hơi lan man"],
    suggestion: "Cấu trúc lại theo STAR: S - Bối cảnh dự án bị delay 2 sprint. T - Nhiệm vụ của bạn là gì. A - 3 hành động cụ thể bạn đã làm. R - Kết quả: dự án hoàn thành đúng deadline, team đạt KPI.",
  },
  {
    q: "Bạn thấy điểm yếu lớn nhất của mình là gì và bạn đang làm gì để cải thiện?",
    scores: { clarity: 4, structure: 3.5, relevance: 4, credibility: 3.5 },
    overall: 3.8,
    strengths: ["Trả lời thành thật và tự nhận thức tốt", "Có kế hoạch cải thiện cụ thể"],
    improvements: ["Điểm yếu nêu ra quá 'safe', nghe giả tạo", "Cần thêm ví dụ về cách bạn đang cải thiện"],
    suggestion: "Chọn điểm yếu thật nhưng không ảnh hưởng core của vị trí. Ví dụ: 'Tôi hay perfectionist nên đôi khi mất thêm thời gian. Gần đây tôi đang luyện timeboxing - đặt deadline cứng cho mỗi task.'",
  },
  {
    q: "Trong 5 năm tới, bạn muốn phát triển theo hướng nào?",
    scores: { clarity: 4.5, structure: 4, relevance: 4, credibility: 4.5 },
    overall: 4.3,
    strengths: ["Có vision rõ ràng và realistic", "Kết nối tốt với lộ trình phát triển của công ty"],
    improvements: ["Thêm milestone cụ thể theo từng năm", "Đề cập đến cách công ty này giúp đạt được mục tiêu"],
    suggestion: "Năm 1-2: Master [kỹ năng X] và contribute vào [project Y]. Năm 3-4: Lead một team nhỏ. Năm 5: Tech Lead hoặc Engineering Manager. Và đây là lý do công ty này là bước đi đúng nhất.",
  },
];

const STAR_LABELS = ["clarity", "structure", "relevance", "credibility"];
const STAR_NAMES = {
  clarity: "Clarity (Rõ ràng)",
  structure: "Structure (STAR)",
  relevance: "Relevance (JD)",
  credibility: "Credibility (Thuyết phục)",
};

const BEHAVIORAL_SCORES = {
  eyeContact:    { label: "Ánh mắt & giao tiếp", score: 3.5 },
  nervousHabits: { label: "Thói quen lo lắng",   score: 4.0 },
  posture:       { label: "Tư thế",               score: 4.5 },
};

const SPEAKING_SCORES = {
  pace:        { label: "Tốc độ nói", score: 3.5 },
  fillerWords: { label: "Từ đệm",     score: 3.0 },
};

export function InterviewFeedback() {
  const navigate = useNavigate();
  const [expandedQ, setExpandedQ] = useState(null);
  const plans = getPlans();
  const isPro = plans.starterPro || plans.elitePro;

  // Read transcripts recorded in InterviewRoom
  const [transcripts] = useState(() => {
    try {
      const raw = sessionStorage.getItem("prointerview_transcripts");
      if (raw) return JSON.parse(raw) ;
    } catch (_) {}
    return [];
  });

  // Tất cả 5 câu — nhưng non-Pro chỉ được xem 3 câu đầu
  const allQuestions = QUESTIONS_FEEDBACK;
  const visibleQuestions = isPro ? allQuestions : allQuestions.slice(0, FREE_LIMIT);

  const hasAnyTranscript = transcripts.some((t) => t && t.trim().length > 0);

  const avgScores = STAR_LABELS.reduce((acc, key) => {
    acc[key] = visibleQuestions.reduce((sum, q) => sum + q.scores[key], 0) / visibleQuestions.length;
    return acc;
  }, {});

  const overallAvg = visibleQuestions.reduce((sum, q) => sum + q.overall, 0) / visibleQuestions.length;

  const renderStars = (score, max = 5) => (
    <div className="flex items-center gap-0.5">
      {[...Array(max)].map((_, i) => (
        <Star
          key={i}
          className={`w-3.5 h-3.5 ${i < Math.floor(score) ? "text-amber-400 fill-amber-400" : i < score ? "text-amber-400 fill-amber-200" : "text-gray-200 fill-gray-200"}`}
        />
      ))}
      <span className="ml-1.5 text-gray-700 text-sm font-semibold">{score.toFixed(1)}</span>
    </div>
  );

  const scoreColor = (s) =>
    s >= 4 ? "bg-emerald-500" : s >= 3 ? "bg-amber-400" : "bg-red-400";

  const scoreBadge = (s) =>
    s >= 4
      ? { cls: "bg-emerald-100 text-emerald-700", label: "Tốt" }
      : s >= 3
      ? { cls: "bg-amber-100 text-amber-700", label: "Khá" }
      : { cls: "bg-red-100 text-red-600", label: "Cần cải thiện" };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <button
          onClick={() => navigate("/interview")}
          className="group inline-flex items-center gap-2 mb-4 text-sm text-muted-foreground hover:text-foreground transition-colors px-3 py-1.5 rounded-lg hover:bg-muted -ml-3"
        >
          <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-0.5" />
          Thực hiện buổi phỏng vấn mới
        </button>
        <div className="inline-flex items-center gap-2 bg-emerald-100 text-emerald-700 text-xs font-semibold px-3 py-1.5 rounded-full mb-3">
          <Check className="w-3.5 h-3.5" /> Hoàn thành phỏng vấn
        </div>
        <h1 className="text-gray-900 mb-1" style={{ fontSize: "1.5rem", fontWeight: 700 }}>
          Kết quả phỏng vấn của bạn
        </h1>
        <p className="text-gray-500 text-sm">
          Frontend Developer @ Shopee · 32 phút ·{" "}
          {isPro ? allQuestions.length : FREE_LIMIT}/{allQuestions.length} câu hỏi
          {!isPro && (
            <span className="ml-2 inline-flex items-center gap-1 text-[#8B4DFF] font-semibold text-xs px-2 py-0.5 rounded-full" style={{ background: "rgba(139, 77, 255,0.08)", border: "1px solid rgba(139, 77, 255,0.2)" }}>
              <Lock className="w-3 h-3" /> 2 câu bị khóa
            </span>
          )}
        </p>
      </div>

      {/* ── Overall Score Banner ─────────────────────────── */}
      <div className="rounded-2xl mb-6 overflow-hidden" style={{ background: "linear-gradient(135deg, #6E35E8 0%, #9B6DFF 100%)" }}>
        {/* Top: big score + STAR */}
        <div className="p-6 text-white">
          <div className="flex flex-col sm:flex-row items-center gap-6">
            <div className="text-center flex-shrink-0">
              <div className="text-white/60 text-sm mb-1">
                Tổng điểm{!isPro && <span className="ml-1 text-white/40 text-xs">({FREE_LIMIT} câu)</span>}
              </div>
              <div style={{ fontSize: "4rem", fontWeight: 800, lineHeight: 1 }}>{overallAvg.toFixed(1)}</div>
              <div className="text-white/60 text-sm">/5 sao</div>
              <div className="flex gap-0.5 justify-center mt-2">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} className={`w-4 h-4 ${i < Math.round(overallAvg) ? "text-amber-400 fill-amber-400" : "text-white/30 fill-white/20"}`} />
                ))}
              </div>
            </div>
            <div className="hidden sm:block w-px h-24 bg-white/20 flex-shrink-0" />
            <div className="flex-1 grid grid-cols-2 gap-3 w-full">
              {STAR_LABELS.map((key) => (
                <div key={key} className="bg-white/10 backdrop-blur-sm rounded-xl px-4 py-3">
                  <p className="text-white/60 text-xs mb-1">{STAR_NAMES[key]}</p>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-1.5 bg-white/20 rounded-full overflow-hidden">
                      <div className="h-full bg-white rounded-full" style={{ width: `${(avgScores[key] / 5) * 100}%` }} />
                    </div>
                    <span className="text-white font-bold text-sm">{avgScores[key].toFixed(1)}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Bottom: Behavioral + Speaking grid */}
        <div className="bg-white/10 border-t border-white/10 px-6 py-4 grid sm:grid-cols-2 gap-4">
          {/* Behavioral Performance */}
          <div>
            <p className="text-white/70 text-xs font-semibold uppercase tracking-wide mb-3 flex items-center gap-1.5">
              <Eye className="w-3.5 h-3.5" /> Hiệu suất hành vi
            </p>
            <div className="space-y-2">
              {Object.values(BEHAVIORAL_SCORES).map((item) => {
                const badge = scoreBadge(item.score);
                return (
                  <div key={item.label}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-white/80 text-xs">{item.label}</span>
                      <div className="flex items-center gap-2">
                        <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${badge.cls}`}>{badge.label}</span>
                        <span className="text-white font-bold text-xs">{item.score}/5</span>
                      </div>
                    </div>
                    <div className="h-1.5 bg-white/20 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${scoreColor(item.score)}`}
                        style={{ width: `${(item.score / 5) * 100}%` }}
                      />
                    </div>
                    <p className="text-white/50 text-[11px] mt-1">{item.detail}</p>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Speaking Quality */}
          <div>
            <p className="text-white/70 text-xs font-semibold uppercase tracking-wide mb-3 flex items-center gap-1.5">
              <SpeakerHigh className="w-3.5 h-3.5" /> Chất lượng lời nói
            </p>
            <div className="space-y-2">
              {Object.values(SPEAKING_SCORES).map((item) => {
                const badge = scoreBadge(item.score);
                return (
                  <div key={item.label}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-white/80 text-xs">{item.label}</span>
                      <div className="flex items-center gap-2">
                        <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${badge.cls}`}>{badge.label}</span>
                        <span className="text-white font-bold text-xs">{item.score}/5</span>
                      </div>
                    </div>
                    <div className="h-1.5 bg-white/20 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${scoreColor(item.score)}`}
                        style={{ width: `${(item.score / 5) * 100}%` }}
                      />
                    </div>
                    <p className="text-white/50 text-[11px] mt-1">{item.detail}</p>
                  </div>
                );
              })}
            </div>

            {/* Quick tips */}
            <div className="mt-4 pt-3 border-t border-white/10">
              <p className="text-white/70 text-xs font-semibold mb-2 flex items-center gap-1.5">
                <ChatTeardropDots className="w-3.5 h-3.5" /> Nhận xét nhanh
              </p>
              <ul className="space-y-1">
                {[
                  "Giảm tốc độ nói xuống còn 140–160 từ/phút",
                  "Luyện bỏ từ đệm bằng cách dừng thay vì nói 'ừm'",
                  "Duy trì ánh mắt 60–70% thời gian trả lời",
                ].map((tip, i) => (
                  <li key={i} className="flex items-start gap-1.5 text-white/60 text-[11px]">
                    <span className="text-[#B4F500] flex-shrink-0 mt-0.5">•</span>
                    {tip}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* Per-question feedback */}
      <div className="mb-6">
        <h2 className="text-gray-800 mb-4" style={{ fontSize: "1rem", fontWeight: 600 }}>
          B. Phân tích từng câu hỏi
        </h2>
        <div className="space-y-3">
          {/* ── Câu hỏi đã mở khóa ─── */}
          {visibleQuestions.map((item, i) => (
            <div key={i} className="card-premium overflow-hidden">
              <button
                onClick={() => setExpandedQ(expandedQ === i ? null : i)}
                className="w-full flex items-center justify-between p-5 text-left hover:bg-gray-50/50 transition-colors"
              >
                <div className="flex items-start gap-4 flex-1 min-w-0">
                  <div className="w-7 h-7 rounded-full bg-[#6E35E8]/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-[#6E35E8] text-xs font-bold">{i + 1}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-gray-800 text-sm font-medium leading-relaxed truncate pr-4">{item.q}</p>
                    <div className="flex items-center gap-3 mt-2">
                      {renderStars(item.overall)}
                      <div className={`px-2 py-0.5 rounded-full text-xs font-semibold ${scoreBadge(item.overall).cls}`}>
                        {scoreBadge(item.overall).label}
                      </div>
                    </div>
                  </div>
                </div>
                {expandedQ === i ? <CaretUp className="w-4 h-4 text-gray-400 flex-shrink-0" /> : <CaretDown className="w-4 h-4 text-gray-400 flex-shrink-0" />}
              </button>

              {expandedQ === i && (
                <div className="border-t border-gray-50 px-5 pb-5">
                  {/* Voice transcript */}
                  {transcripts[i] && transcripts[i].trim().length > 0 ? (
                    <div
                      className="mt-4 mb-4 rounded-2xl overflow-hidden"
                      style={{ border: "1.5px solid rgba(110, 53, 232,0.15)" }}
                    >
                      <div
                        className="px-4 py-2.5 flex items-center gap-2"
                        style={{ background: "rgba(110, 53, 232,0.06)", borderBottom: "1px solid rgba(110, 53, 232,0.1)" }}
                      >
                        <div className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: "rgba(110, 53, 232,0.15)" }}>
                          <Microphone className="w-3 h-3" style={{ color: "#6E35E8" }} />
                        </div>
                        <span className="text-xs font-semibold" style={{ color: "#6E35E8" }}>
                          Câu trả lời của bạn — được ghi nhận từ giọng nói
                        </span>
                        <span className="ml-auto text-xs text-gray-400">
                          {transcripts[i].trim().split(/\s+/).filter(Boolean).length} từ
                        </span>
                      </div>
                      <div className="px-4 py-3" style={{ background: "rgba(110, 53, 232,0.03)" }}>
                        <div className="flex items-start gap-2">
                          <Quotes className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: "rgba(110, 53, 232,0.3)" }} />
                          <p className="text-gray-700 leading-relaxed flex-1" style={{ fontSize: "0.82rem" }}>
                            {transcripts[i].trim()}
                          </p>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div
                      className="mt-4 mb-4 rounded-xl px-4 py-3 flex items-center gap-2.5"
                      style={{ background: "rgba(107,114,128,0.05)", border: "1px dashed rgba(107,114,128,0.2)" }}
                    >
                      <Microphone className="w-4 h-4 text-gray-300" />
                      <p className="text-gray-400 text-xs">
                        Chưa có ghi âm cho câu này — trả lời bằng giọng nói trong lần phỏng vấn tiếp theo để xem transcript tại đây.
                      </p>
                    </div>
                  )}

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 py-4">
                    {STAR_LABELS.map((key) => (
                      <div key={key} className="text-center p-2 rounded-xl bg-gray-50">
                        <p className="text-gray-400 text-xs mb-1">{key.charAt(0).toUpperCase() + key.slice(1)}</p>
                        <div className="flex justify-center">{renderStars(item.scores[key])}</div>
                      </div>
                    ))}
                  </div>
                  <div className="grid sm:grid-cols-2 gap-4 mb-4">
                    <div>
                      <h4 className="text-gray-700 text-xs font-semibold mb-2 flex items-center gap-1.5">
                        <Check className="w-3.5 h-3.5 text-emerald-500" /> Điểm mạnh
                      </h4>
                      <ul className="space-y-1.5">
                        {item.strengths.map((s, j) => (
                          <li key={j} className="text-gray-600 text-xs flex items-start gap-1.5">
                            <span className="text-emerald-500 flex-shrink-0 mt-0.5">•</span>{s}
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div>
                      <h4 className="text-gray-700 text-xs font-semibold mb-2 flex items-center gap-1.5">
                        <Warning className="w-3.5 h-3.5 text-amber-500" /> Cần cải thiện
                      </h4>
                      <ul className="space-y-1.5">
                        {item.improvements.map((s, j) => (
                          <li key={j} className="text-gray-600 text-xs flex items-start gap-1.5">
                            <span className="text-amber-500 flex-shrink-0 mt-0.5">•</span>{s}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                  <div className="bg-[#6E35E8]/5 rounded-xl p-4 border border-[#6E35E8]/10">
                    <div className="flex items-center gap-2 mb-2">
                      <Lightbulb className="w-4 h-4 text-[#6E35E8]" />
                      <p className="text-[#6E35E8] text-xs font-semibold">Gợi ý câu trả lời tốt hơn</p>
                    </div>
                    <p className="text-gray-700 text-xs leading-relaxed">{item.suggestion}</p>
                  </div>
                </div>
              )}
            </div>
          ))}

          {/* ── Câu hỏi bị khóa (non-Pro) ─── */}
          {!isPro && allQuestions.slice(FREE_LIMIT).map((item, idx) => {
            const i = FREE_LIMIT + idx;
            return (
              <div
                key={`locked-${i}`}
                className="relative rounded-2xl overflow-hidden"
                style={{
                  border: "1.5px solid rgba(139, 77, 255,0.2)",
                  background: "#fdfcff",
                }}
              >
                {/* Question header — hiện câu hỏi nhưng mờ */}
                <div className="flex items-center gap-4 p-5" style={{ filter: "blur(2px)", userSelect: "none", pointerEvents: "none" }}>
                  <div
                    className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0"
                    style={{ background: "rgba(139, 77, 255,0.12)" }}
                  >
                    <span className="text-[#8B4DFF] text-xs font-bold">{i + 1}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-gray-800 text-sm font-medium leading-relaxed truncate pr-4">{item.q}</p>
                    <div className="flex items-center gap-2 mt-2">
                      {[...Array(5)].map((_, si) => (
                        <Star key={si} className="w-3.5 h-3.5 text-gray-200 fill-gray-200" />
                      ))}
                      <span className="ml-1 text-gray-300 text-xs">—</span>
                    </div>
                  </div>
                </div>

                {/* Lock overlay */}
                <div
                  className="absolute inset-0 flex flex-col items-center justify-center gap-4 px-6"
                  style={{ background: "rgba(250,248,255,0.88)", backdropFilter: "blur(2px)" }}
                >
                  {/* Badge */}
                  <div
                    className="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold"
                    style={{ background: "rgba(139, 77, 255,0.1)", border: "1px solid rgba(139, 77, 255,0.25)", color: "#8B4DFF" }}
                  >
                    <Lock className="w-3.5 h-3.5" />
                    Câu hỏi {i + 1} · Chỉ dành cho gói Pro
                  </div>

                  <div className="text-center">
                    <p className="text-gray-700 text-sm font-semibold mb-1">
                      Phân tích chi tiết bị khóa
                    </p>
                    <p className="text-gray-400 text-xs leading-relaxed max-w-xs">
                      Nâng cấp Pro để xem điểm số, điểm mạnh, điểm yếu và gợi ý cải thiện cho câu hỏi này.
                    </p>
                  </div>

                  <button
                    onClick={() => navigate("/pricing")}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all hover:scale-[1.03] active:scale-[0.97]"
                    style={{
                      background: "linear-gradient(135deg, #6E35E8, #8B4DFF)",
                      color: "#fff",
                      boxShadow: "0 4px 16px rgba(110, 53, 232,0.35)",
                    }}
                  >
                    <Lightning className="w-4 h-4" />
                    Nâng cấp Pro để mở khóa
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* ── Banner nâng cấp sau danh sách câu hỏi (non-Pro) ── */}
        {!isPro && (
          <div
            className="mt-5 rounded-2xl p-5 flex flex-col sm:flex-row items-center gap-4"
            style={{
              background: "linear-gradient(135deg, rgba(110, 53, 232,0.06) 0%, rgba(139, 77, 255,0.04) 100%)",
              border: "1.5px solid rgba(139, 77, 255,0.2)",
            }}
          >
            <div className="flex-1 text-center sm:text-left">
              <p className="text-gray-800 text-sm font-bold mb-1">
                Mở khóa phân tích đầy đủ 5/5 câu hỏi
              </p>
              <p className="text-gray-500 text-xs leading-relaxed">
                Nâng cấp gói Pro để xem toàn bộ phản hồi, điểm số chi tiết và gợi ý cải thiện cho tất cả câu hỏi trong buổi phỏng vấn.
              </p>
            </div>
            <button
              onClick={() => navigate("/pricing")}
              className="flex-shrink-0 flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-bold transition-all hover:scale-[1.03] whitespace-nowrap"
              style={{
                background: "linear-gradient(135deg, #6E35E8, #8B4DFF)",
                color: "#fff",
                boxShadow: "0 4px 16px rgba(110, 53, 232,0.3)",
              }}
            >
              <Lightning className="w-4 h-4" />
              Nâng cấp ngay
            </button>
          </div>
        )}
      </div>

      {/* Action buttons */}
      <div className="flex flex-wrap gap-3 pb-6">
        <button
          onClick={() => navigate("/interview")}
          className="flex items-center gap-2 text-white px-5 py-2.5 rounded-xl text-sm font-semibold transition-all shadow-md"
          style={{ background: "linear-gradient(135deg, #6E35E8, #9B6DFF)", boxShadow: "0 4px 16px rgba(110, 53, 232,0.3)" }}
        >
          <Microphone className="w-4 h-4" />
          Phỏng vấn lại
        </button>

        {/* Book Mentor */}
        <button
          onClick={() => navigate("/mentors")}
          className="relative flex items-center gap-2.5 px-6 py-2.5 rounded-xl text-sm font-bold transition-all overflow-hidden group"
          style={{
            background: "linear-gradient(135deg, #FF8C42 0%, #FFB800 100%)",
            color: "#fff",
            boxShadow: "0 4px 20px rgba(255,140,66,0.45)",
          }}
        >
          <span
            className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500"
            style={{
              background: "linear-gradient(105deg, transparent 30%, rgba(255,255,255,0.25) 50%, transparent 70%)",
              backgroundSize: "200% 100%",
            }}
          />
          <Users className="w-4 h-4 flex-shrink-0" />
          <span className="relative">🎯 Đặt lịch Mentor 1-1</span>
          <span className="relative text-xs px-2 py-0.5 rounded-full font-semibold flex-shrink-0" style={{ background: "rgba(0,0,0,0.2)" }}>
            Cải thiện 3×
          </span>
        </button>

        <button
          onClick={() => navigate("/dashboard")}
          className="flex items-center gap-2 bg-white border border-gray-200 hover:border-gray-300 text-gray-600 px-5 py-2.5 rounded-xl text-sm font-medium transition-all"
        >
          <SquaresFour className="w-4 h-4" />
          Bảng điều khiển
        </button>
        <button className="flex items-center gap-2 bg-white border border-gray-200 hover:border-gray-300 text-gray-600 px-5 py-2.5 rounded-xl text-sm font-medium transition-all">
          <DownloadSimple className="w-4 h-4" />
          Tải PDF
        </button>
      </div>

      {/* ── Course Recommendations ─────────────────────────── */}
      <div className="mb-8">
        <CourseRecommendations
          tags={["star-method", "behavioral-interview", "interview-skills"]}
          title="Khóa học giúp bạn cải thiện điểm yếu"
          subtitle="Dựa trên kết quả phỏng vấn, chúng tôi gợi ý các khóa học phù hợp nhất"
          variant="banner"
          maxCourses={3}
          weakAreas={["Structure (STAR) — 3.2/5", "Credibility — 3.4/5", "Từ đệm"]}
        />
      </div>
    </div>
  );
}