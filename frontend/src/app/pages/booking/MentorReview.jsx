import React, { useState, useMemo } from "react";
import { useParams, useNavigate } from "react-router";
import {
  ArrowLeft,
  Star,
  Check,
  MessageSquareText as ChatText,
  Sparkles as Sparkle,
  PartyPopper as Confetti,
  ThumbsUp,
  ThumbsDown,
  FileText,
  Calendar as CalendarBlank,
  Users,
  ChevronRight as CaretRight,
  Mic as MicrophoneStage,
  BookOpen,
  MessageCircle as ChatDots,
  Timer,
  Target,
  Lightbulb,
  Building2 as Buildings,
  Handshake,
  Clock,
  Pencil,
  Wind,
  Code,
  CheckSquare,
  AlertTriangle as Warning,
} from "lucide-react";
import { getBookingById, saveReview, getReview } from "../../utils/bookings";
import { ReportMentorModal } from "../../components/modals/ReportMentorModal";

/* ──────────────────────────────────────────────────────────
   CONSTANTS
────────────────────────────────────────────────────────── */
const HIGHLIGHT_OPTIONS = [
  { label: "Câu hỏi thực tế & chuyên sâu",  Icon: Target        },
  { label: "Feedback rõ ràng, dễ hiểu",      Icon: Lightbulb     },
  { label: "Chia sẻ kinh nghiệm insider",    Icon: Buildings     },
  { label: "Phong thái chuyên nghiệp",       Icon: Handshake     },
  { label: "Đúng giờ, chuẩn bị kỹ",         Icon: Clock         },
  { label: "Gợi ý cải thiện cụ thể",        Icon: Pencil        },
  { label: "Tốc độ phù hợp, không áp lực",  Icon: Wind          },
  { label: "Kiến thức kỹ thuật sâu",        Icon: Code          },
  { label: "Trả lời tất cả câu hỏi",        Icon: CheckSquare   },
];

const CAT_RATINGS = [
  { key: "communication", label: "Kỹ năng truyền đạt",   Icon: ChatText, desc: "Giải thích rõ ràng, dễ hiểu",         color: "#6E35E8" },
  { key: "expertise",     label: "Kiến thức chuyên môn", Icon: BookOpen,    desc: "Hiểu biết sâu về lĩnh vực",           color: "#8B4DFF" },
  { key: "feedback",      label: "Chất lượng feedback",  Icon: ChatDots,        desc: "Nhận xét cụ thể, có giá trị",         color: "#FF8C42" },
  { key: "punctuality",   label: "Đúng giờ & chuẩn bị", Icon: Timer,           desc: "Sẵn sàng và đúng lịch hẹn",          color: "#B4A000" },
];

const OVERALL_LABELS = ["", "Chưa hài lòng", "Tạm ổn", "Khá tốt", "Tốt lắm!", "Xuất sắc!"];
const OVERALL_COLORS = ["", "#EF4444", "#F59E0B", "#3B82F6", "#10B981", "#6E35E8"];

/* ──────────────────────────────────────────────────────────
   StarRow — single-row rating for a category
────────────────────────────────────────────────────────── */
function StarRow({
  value,
  onChange,
  size = 28,
}) {
  const [hover, setHover] = useState(0);
  return (
    <div className="flex items-center gap-1.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <button
          key={i}
          onMouseEnter={() => setHover(i)}
          onMouseLeave={() => setHover(0)}
          onClick={() => onChange(i)}
          className="transition-transform hover:scale-110 active:scale-95"
        >
          <Star
            style={{ width: size, height: size, color: i <= (hover || value) ? "#FFD600" : "#E5E7EB" }}
            fill={i <= (hover || value) ? "#FFD600" : "none"}
          />
        </button>
      ))}
    </div>
  );
}

/* ──────────────────────────────────────────────────────────
   BigStarRating — large overall rating
────────────────────────────────────────────────────────── */
function BigStarRating({ value, onChange }) {
  const [hover, setHover] = useState(0);
  const active = hover || value;
  return (
    <div className="flex flex-col items-center gap-4">
      <div className="flex items-center gap-3">
        {[1, 2, 3, 4, 5].map((i) => (
          <button
            key={i}
            onMouseEnter={() => setHover(i)}
            onMouseLeave={() => setHover(0)}
            onClick={() => onChange(i)}
            className="transition-all hover:scale-125 active:scale-95"
            style={{ filter: i <= active ? "drop-shadow(0 0 6px rgba(255,214,0,0.5))" : "none" }}
          >
            <Star
              style={{ width: 52, height: 52, color: i <= active ? "#FFD600" : "#E5E7EB" }}
              fill={i <= active ? "#FFD600" : "none"}
            />
          </button>
        ))}
      </div>
      <div
        className="h-8 flex items-center"
        style={{ minWidth: 120, textAlign: "center" }}
      >
        {active > 0 && (
          <span
            className="text-lg font-black transition-all"
            style={{ color: OVERALL_COLORS[active] }}
          >
            {OVERALL_LABELS[active]}
          </span>
        )}
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────
   MentorReview — main component
────────────────────────────────────────────────────────── */
export function MentorReview() {
  const { sessionId } = useParams();
  const navigate = useNavigate();

  const session = useMemo(() => getBookingById(sessionId), [sessionId]);
  const existingReview = useMemo(() => getReview(sessionId ?? ""), [sessionId]);

  /* ── Form state ── */
  const [overallRating, setOverallRating]   = useState(existingReview?.overallRating ?? 0);
  const [catRatings, setCatRatings]         = useState({
    communication: existingReview?.catRatings.communication ?? 0,
    expertise:     existingReview?.catRatings.expertise     ?? 0,
    feedback:      existingReview?.catRatings.feedback      ?? 0,
    punctuality:   existingReview?.catRatings.punctuality   ?? 0,
  });
  const [highlights, setHighlights]         = useState(existingReview?.highlights ?? []);
  const [recommend, setRecommend]           = useState(existingReview?.recommend ?? null);
  const [text, setText]                     = useState(existingReview?.text ?? "");
  const [submitted, setSubmitted]           = useState(!!existingReview);
  const [submitting, setSubmitting]         = useState(false);

  // Report modal state
  const [showReportModal, setShowReportModal] = useState(false);

  const canSubmit = overallRating > 0;
  const catAvg = Object.values(catRatings).filter(v => v > 0);
  const overallCalc = catAvg.length > 0
    ? (catAvg.reduce((a, b) => a + b, 0) / catAvg.length).toFixed(1)
    : overallRating.toFixed(1);

  /* ── Submit handler ── */
  const handleSubmit = () => {
    if (!canSubmit || !session) return;
    setSubmitting(true);
    setTimeout(() => {
      const review = {
        sessionId:     session.sessionId,
        mentorId:      session.mentorId,
        mentorName:    session.mentorName,
        mentorAvatar:  session.mentorAvatar,
        mentorTitle:   session.mentorTitle,
        mentorCompany: session.mentorCompany,
        date:          session.date,
        overallRating,
        catRatings,
        highlights,
        recommend: recommend ?? false,
        text,
        submittedAt: new Date().toISOString(),
      };
      saveReview(review);
      setSubmitting(false);
      setSubmitted(true);
    }, 1200);
  };

  /* ── Not found ── */
  if (!session) {
    return (
      <div className="p-8 text-center text-gray-400">
        <p className="text-lg font-semibold mb-2">Không tìm thấy buổi phỏng vấn</p>
        <button onClick={() => navigate("/dashboard")}
          className="mt-4 px-5 py-2.5 rounded-xl text-sm font-semibold text-white"
          style={{ background: "#6E35E8" }}>
          Về Dashboard
        </button>
      </div>
    );
  }

  /* ──────────────────────────────────────────────────────
     SUBMITTED — success screen
  ────────────────────────────────────────────────────── */
  if (submitted) {
    return (
      <div className="max-w-2xl mx-auto p-6 pb-16">
        <button onClick={() => navigate(-1)}
          className="group flex items-center gap-2 text-gray-500 hover:text-gray-900 text-sm mb-8 transition-colors px-3 py-1.5 rounded-lg hover:bg-gray-100 -ml-3">
          <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-0.5" />
          Quay lại
        </button>

        {/* Hero success */}
        <div
          className="rounded-3xl p-10 text-center mb-6"
          style={{ background: "linear-gradient(145deg, #0E0922 0%, #1a0d35 50%, #0E0922 100%)" }}
        >
          <div
            className="w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-6"
            style={{ background: "rgba(180,240,0,0.15)", border: "2px solid rgba(180,240,0,0.3)" }}
          >
            <Confetti className="w-12 h-12" style={{ color: "#B4F000" }} />
          </div>
          <h1 className="text-white font-black mb-3" style={{ fontSize: "1.75rem", letterSpacing: "-0.03em" }}>
            Cảm ơn bạn đã đánh giá! 🎉
          </h1>
          <p className="mb-6" style={{ color: "rgba(255,255,255,0.55)", fontSize: "0.95rem" }}>
            Nhận xét của bạn giúp <span className="text-white font-semibold">{session.mentorName}</span> cải thiện chất lượng và giúp những học viên khác chọn được mentor phù hợp.
          </p>

          {/* Stars display */}
          <div className="flex items-center justify-center gap-2 mb-3">
            {[1,2,3,4,5].map(i => (
              <Star
                key={i}
                className="w-8 h-8"
                fill={i <= overallRating ? "#FFD600" : "none"}
                style={{ color: i <= overallRating ? "#FFD600" : "rgba(255,255,255,0.2)" }}
              />
            ))}
          </div>
          <p className="font-bold" style={{ color: OVERALL_COLORS[overallRating] || "#B4F000", fontSize: "1.1rem" }}>
            {OVERALL_LABELS[overallRating]}
          </p>

          {/* Recommend badge */}
          {recommend !== null && (
            <div
              className="inline-flex items-center gap-2 mt-4 px-4 py-2 rounded-full text-sm font-bold"
              style={recommend
                ? { background: "rgba(180,240,0,0.15)", color: "#B4F000" }
                : { background: "rgba(255,140,66,0.15)", color: "#FF8C42" }}
            >
              {recommend ? <ThumbsUp className="w-4 h-4" /> : <ThumbsDown className="w-4 h-4" />}
              {recommend ? "Đã giới thiệu cho bạn bè" : "Không chắc sẽ giới thiệu"}
            </div>
          )}
        </div>

        {/* Review summary card */}
        <div className="card-premium p-5 mb-5">
          <div className="flex items-center gap-4 mb-5">
            <img src={session.mentorAvatar} alt={session.mentorName}
              className="w-14 h-14 rounded-2xl object-cover flex-shrink-0" />
            <div>
              <p className="font-bold text-gray-900">{session.mentorName}</p>
              <p className="text-xs text-gray-500">{session.mentorTitle} · {session.mentorCompany}</p>
              <p className="text-xs text-gray-400 mt-0.5">{session.date}</p>
            </div>
          </div>

          {/* Cat ratings summary */}
          <div className="grid grid-cols-2 gap-3 mb-4">
            {CAT_RATINGS.map(cat => (
              <div key={cat.key} className="flex items-center justify-between p-3 rounded-xl"
                style={{ background: "#F9FAFB" }}>
                <div className="flex items-center gap-1.5">
                  <cat.Icon style={{ width: 13, height: 13, color: cat.color }} />
                  <span className="text-xs font-medium text-gray-600">{cat.label}</span>
                </div>
                <div className="flex items-center gap-1">
                  <Star className="w-3.5 h-3.5" style={{ color: "#FFD600" }} />
                  <span className="text-xs font-bold text-gray-800">
                    {catRatings[cat.key] > 0 ? catRatings[cat.key] : "—"}
                  </span>
                </div>
              </div>
            ))}
          </div>

          {/* Highlights */}
          {highlights.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-4">
              {highlights.map(h => {
                const opt = HIGHLIGHT_OPTIONS.find(o => o.label === h);
                return (
                  <span key={h} className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full"
                    style={{ background: "rgba(110, 53, 232,0.08)", color: "#6E35E8" }}>
                    {opt && <opt.Icon style={{ width: 12, height: 12 }} />}
                    {h}
                  </span>
                );
              })}
            </div>
          )}

          {/* Written text */}
          {text && (
            <p className="text-sm text-gray-600 leading-relaxed italic border-l-2 pl-4"
              style={{ borderColor: "#6E35E8" }}>
              "{text}"
            </p>
          )}
        </div>

        {/* Next steps */}
        <div className="card-premium p-5 mb-5">
          <p className="font-semibold text-gray-800 text-sm mb-4">Bước tiếp theo</p>
          <div className="space-y-3">
            {[
              {
                icon: Sparkle, color: "#6E35E8", bg: "rgba(110, 53, 232,0.08)",
                title: "Luyện tập với AI Interview",
                desc: "Áp dụng feedback vừa nhận vào buổi AI mock interview",
                action: () => navigate("/interview"),
              },
              {
                icon: FileText, color: "#FF8C42", bg: "rgba(255,140,66,0.08)",
                title: "Tối ưu CV dựa theo góp ý",
                desc: "Phân tích CV với những keyword mentor đề xuất",
                action: () => navigate("/cv-analysis"),
              },
              {
                icon: CalendarBlank, color: "#B4F000", bg: "rgba(180,240,0,0.10)",
                title: "Đặt buổi tiếp theo",
                desc: "Tiếp tục luyện tập để chinh phục vòng phỏng vấn",
                action: () => navigate("/mentors"),
              },
            ].map(item => (
              <div
                key={item.title}
                onClick={item.action}
                className="flex items-center gap-4 p-4 rounded-2xl cursor-pointer transition-all hover:shadow-sm"
                style={{ border: "1.5px solid #F3F4F6" }}
              >
                <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ background: item.bg }}>
                  <item.icon className="w-5 h-5" style={{ color: item.color }} />
                </div>
                <div className="flex-1">
                  <p className="text-gray-900 font-semibold text-sm">{item.title}</p>
                  <p className="text-gray-400 text-xs">{item.desc}</p>
                </div>
                <CaretRight className="w-4 h-4 flex-shrink-0" style={{ color: item.color }} />
              </div>
            ))}
          </div>
        </div>

        <button
          onClick={() => navigate("/dashboard")}
          className="w-full py-4 rounded-2xl font-bold text-sm text-white flex items-center justify-center gap-2"
          style={{ background: "linear-gradient(135deg,#6E35E8,#8B4DFF)", boxShadow: "0 6px 20px rgba(110, 53, 232,0.3)" }}
        >
          Về Dashboard <CaretRight className="w-4 h-4" />
        </button>
      </div>
    );
  }

  /* ──────────────────────────────────────────────────────
     FORM — review input
  ────────────────────────────────────────────────────── */
  return (
    <div className="max-w-2xl mx-auto p-6 pb-16">

      {/* Back */}
      <button
        onClick={() => navigate(-1)}
        className="group flex items-center gap-2 text-gray-500 hover:text-gray-900 text-sm mb-6 transition-colors px-3 py-1.5 rounded-lg hover:bg-gray-100 -ml-3"
      >
        <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-0.5" />
        Quay lại
      </button>

      {/* Header */}
      <div className="mb-6">
        <h1 className="text-gray-900 mb-1" style={{ fontSize: "1.5rem", fontWeight: 800, letterSpacing: "-0.03em" }}>
          Đánh giá buổi phỏng vấn
        </h1>
        <p className="text-gray-500 text-sm">Nhận xét của bạn sẽ giúp mentor và cộng đồng học viên.</p>
      </div>

      {/* Mentor identity bar */}
      <div
        className="rounded-2xl p-5 flex items-center gap-4 mb-6"
        style={{
          background: "linear-gradient(135deg, #0E0922 0%, #1a0d35 100%)",
          border: "1px solid rgba(139, 77, 255,0.3)",
        }}
      >
        <img
          src={session.mentorAvatar}
          alt={session.mentorName}
          className="w-16 h-16 rounded-2xl object-cover flex-shrink-0"
          style={{ border: "2px solid rgba(180,240,0,0.3)" }}
        />
        <div className="flex-1 min-w-0">
          <p className="text-white font-black" style={{ fontSize: "1.1rem" }}>{session.mentorName}</p>
          <p className="text-sm mt-0.5" style={{ color: "rgba(255,255,255,0.6)" }}>
            {session.mentorTitle}
          </p>
          <p className="text-sm font-semibold" style={{ color: "#B4F000" }}>{session.mentorCompany}</p>
        </div>
        <div className="text-right flex-shrink-0">
          <p className="text-xs font-semibold mb-1" style={{ color: "rgba(255,255,255,0.45)" }}>BUỔI PHỎNG VẤN</p>
          <p className="text-white font-bold text-sm">{session.date}</p>
          <p className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.45)" }}>
            {session.time} – {session.endTime}
          </p>
        </div>
      </div>

      {/* ── SECTION 1: Overall rating ── */}
      <div className="card-premium overflow-hidden mb-4">
        <div
          className="px-5 py-4 border-b border-gray-100 flex items-center gap-2.5"
          style={{ background: "rgba(110, 53, 232,0.04)" }}
        >
          <div className="w-8 h-8 rounded-xl flex items-center justify-center"
            style={{ background: "rgba(255,214,0,0.15)" }}>
            <Star className="w-4 h-4" style={{ color: "#FFD600" }} />
          </div>
          <div>
            <p className="font-bold text-gray-900 text-sm">Đánh giá tổng thể</p>
            <p className="text-xs text-gray-400">Bạn cảm thấy thế nào về buổi phỏng vấn này?</p>
          </div>
        </div>
        <div className="p-6 flex flex-col items-center">
          <BigStarRating value={overallRating} onChange={setOverallRating} />
        </div>
      </div>

      {/* ── SECTION 2: Category ratings ── */}
      <div className="card-premium overflow-hidden mb-4">
        <div
          className="px-5 py-4 border-b border-gray-100 flex items-center gap-2.5"
          style={{ background: "rgba(110, 53, 232,0.04)" }}
        >
          <div className="w-8 h-8 rounded-xl flex items-center justify-center"
            style={{ background: "rgba(110, 53, 232,0.12)" }}>
            <Sparkle className="w-4 h-4" style={{ color: "#6E35E8" }} />
          </div>
          <div>
            <p className="font-bold text-gray-900 text-sm">Đánh giá chi tiết</p>
            <p className="text-xs text-gray-400">Chấm điểm từng tiêu chí (tuỳ chọn)</p>
          </div>
        </div>
        <div className="p-5 space-y-4">
          {CAT_RATINGS.map(cat => (
            <div key={cat.key} className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <div
                  className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ background: `${cat.color}14` }}
                >
                  <cat.Icon className="w-4.5 h-4.5" style={{ color: cat.color, width: 18, height: 18 }} />
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-800">{cat.label}</p>
                  <p className="text-xs text-gray-400">{cat.desc}</p>
                </div>
              </div>
              <StarRow
                value={catRatings[cat.key]}
                onChange={(v) => setCatRatings(prev => ({ ...prev, [cat.key]: v }))}
                size={24}
              />
            </div>
          ))}

          {/* Average indicator */}
          {Object.values(catRatings).some(v => v > 0) && (
            <div
              className="flex items-center justify-between pt-4 mt-2 border-t border-gray-100"
            >
              <span className="text-xs text-gray-400">Điểm trung bình tiêu chí</span>
              <div className="flex items-center gap-1.5">
                <Star className="w-4 h-4" style={{ color: "#FFD600" }} />
                <span className="text-sm font-black text-gray-800">{overallCalc}</span>
                <span className="text-xs text-gray-400">/ 5</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── SECTION 3: Highlights ── */}
      <div className="card-premium overflow-hidden mb-4">
        <div
          className="px-5 py-4 border-b border-gray-100 flex items-center gap-2.5"
          style={{ background: "rgba(110, 53, 232,0.04)" }}
        >
          <div className="w-8 h-8 rounded-xl flex items-center justify-center"
            style={{ background: "rgba(180,240,0,0.12)" }}>
            <ThumbsUp className="w-4 h-4" style={{ color: "#6a9200" }} />
          </div>
          <div>
            <p className="font-bold text-gray-900 text-sm">Điểm nổi bật</p>
            <p className="text-xs text-gray-400">Chọn những gì mentor làm tốt (có thể chọn nhiều)</p>
          </div>
        </div>
        <div className="p-5">
          <div className="flex flex-wrap gap-2.5">
            {HIGHLIGHT_OPTIONS.map(opt => {
              const sel = highlights.includes(opt.label);
              return (
                <button
                  key={opt.label}
                  onClick={() =>
                    setHighlights(prev =>
                      sel ? prev.filter(h => h !== opt.label) : [...prev, opt.label]
                    )
                  }
                  className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all active:scale-95"
                  style={sel
                    ? { background: "#6E35E8", color: "#fff", boxShadow: "0 2px 10px rgba(110, 53, 232,0.25)" }
                    : { background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.65)", border: "1.5px solid rgba(255,255,255,0.12)" }
                  }
                >
                  <opt.Icon
                    style={{ width: 14, height: 14, color: sel ? "#fff" : "#6E35E8", flexShrink: 0 }}
                    fill={sel ? "currentColor" : "none"}
                  />
                  {opt.label}
                  {sel && <Check className="w-3 h-3 ml-0.5" />}
                </button>
              );
            })}
          </div>
          {highlights.length > 0 && (
            <p className="text-xs text-gray-400 mt-3">
              Đã chọn {highlights.length} điểm nổi bật
            </p>
          )}
        </div>
      </div>

      {/* ── SECTION 4: Recommend? ── */}
      <div className="card-premium overflow-hidden mb-4">
        <div
          className="px-5 py-4 border-b border-gray-100 flex items-center gap-2.5"
          style={{ background: "rgba(110, 53, 232,0.04)" }}
        >
          <div className="w-8 h-8 rounded-xl flex items-center justify-center"
            style={{ background: "rgba(255,140,66,0.12)" }}>
            <Users className="w-4 h-4" style={{ color: "#FF8C42" }} />
          </div>
          <div>
            <p className="font-bold text-gray-900 text-sm">Giới thiệu cho bạn bè?</p>
            <p className="text-xs text-gray-400">Bạn có recommend mentor này cho người khác không?</p>
          </div>
        </div>
        <div className="p-5">
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => setRecommend(true)}
              className="flex items-center justify-center gap-2.5 py-4 rounded-2xl text-sm font-bold transition-all active:scale-[0.97]"
              style={recommend === true
                ? { background: "rgba(180,240,0,0.12)", color: "#4a7a00", border: "2px solid rgba(180,240,0,0.4)", boxShadow: "0 4px 16px rgba(180,240,0,0.15)" }
                : { background: "#F9FAFB", color: "#6B7280", border: "2px solid #E5E7EB" }
              }
            >
              <ThumbsUp
                className="w-5 h-5"
                style={{ color: recommend === true ? "#5a9200" : "#9CA3AF" }}
              />
              Có, rất muốn
            </button>
            <button
              onClick={() => setRecommend(false)}
              className="flex items-center justify-center gap-2.5 py-4 rounded-2xl text-sm font-bold transition-all active:scale-[0.97]"
              style={recommend === false
                ? { background: "rgba(239,68,68,0.06)", color: "#dc2626", border: "2px solid rgba(239,68,68,0.25)" }
                : { background: "#F9FAFB", color: "#6B7280", border: "2px solid #E5E7EB" }
              }
            >
              <ThumbsDown
                className="w-5 h-5"
                style={{ color: recommend === false ? "#dc2626" : "#9CA3AF" }}
              />
              Không chắc
            </button>
          </div>
        </div>
      </div>

      {/* ── SECTION 5: Written review ── */}
      <div className="card-premium overflow-hidden mb-6">
        <div
          className="px-5 py-4 border-b border-gray-100 flex items-center gap-2.5"
          style={{ background: "rgba(110, 53, 232,0.04)" }}
        >
          <div className="w-8 h-8 rounded-xl flex items-center justify-center"
            style={{ background: "rgba(110, 53, 232,0.12)" }}>
            <ChatText className="w-4 h-4" style={{ color: "#6E35E8" }} />
          </div>
          <div>
            <p className="font-bold text-gray-900 text-sm">Nhận xét chi tiết</p>
            <p className="text-xs text-gray-400">Chia sẻ trải nghiệm của bạn (tuỳ chọn)</p>
          </div>
        </div>
        <div className="p-5">
          <textarea
            value={text}
            onChange={e => setText(e.target.value)}
            maxLength={500}
            rows={4}
            placeholder={`Ví dụ: Buổi phỏng vấn với ${session.mentorName} rất bổ ích. Mentor đặt câu hỏi thực tế và cho feedback rõ ràng về điểm cần cải thiện. Đặc biệt phần System Design được giải thích rất dễ hiểu...`}
            className="w-full text-sm text-gray-700 resize-none focus:outline-none leading-relaxed rounded-xl p-4 transition-all"
            style={{
              background: "#F9FAFB",
              border: "1.5px solid #E5E7EB",
            }}
            onFocus={e => (e.target.style.borderColor = "rgba(110, 53, 232,0.4)")}
            onBlur={e => (e.target.style.borderColor = "#E5E7EB")}
          />
          <div className="flex justify-between items-center mt-2">
            <p className="text-xs text-gray-400">
              {text.length > 0
                ? `${text.length}/500 ký tự · Cảm ơn bạn đã chia sẻ!`
                : "Không bắt buộc, nhưng rất hữu ích cho mentor"}
            </p>
            {text.length >= 400 && (
              <p className="text-xs" style={{ color: text.length >= 480 ? "#ef4444" : "#f59e0b" }}>
                {500 - text.length} ký tự còn lại
              </p>
            )}
          </div>
        </div>
      </div>

      {/* ── Submit CTA ── */}
      {!canSubmit && (
        <p className="text-center text-sm text-gray-400 mb-4">
          ⭐ Vui lòng chấm điểm tổng thể để gửi đánh giá
        </p>
      )}
      <button
        onClick={handleSubmit}
        disabled={!canSubmit || submitting}
        className="w-full py-4 rounded-2xl font-black text-base flex items-center justify-center gap-3 transition-all active:scale-[0.98]"
        style={canSubmit && !submitting
          ? { background: "linear-gradient(135deg, #6E35E8, #8B4DFF)", color: "#fff", boxShadow: "0 8px 28px rgba(110, 53, 232,0.35)" }
          : { background: "#F0F1F3", color: "#9CA3AF", cursor: "not-allowed" }
        }
      >
        {submitting ? (
          <>
            <div
              className="w-5 h-5 rounded-full border-2 border-white/30 border-t-white animate-spin"
            />
            Đang gửi...
          </>
        ) : (
          <>
            <ThumbsUp className="w-5 h-5" />
            Gửi đánh giá
            <CaretRight className="w-4 h-4" />
          </>
        )}
      </button>

      <p className="text-center text-xs text-gray-400 mt-4">
        Đánh giá của bạn sẽ được hiển thị công khai trên hồ sơ mentor sau khi kiểm duyệt.
      </p>

      {/* Report mentor button */}
      <div className="mt-6 pt-6 border-t border-gray-100">
        <button
          onClick={() => setShowReportModal(true)}
          className="w-full py-3 rounded-xl border text-gray-600 text-sm font-medium hover:border-red-400 hover:text-red-600 transition-all flex items-center justify-center gap-2"
          style={{ borderColor: "#E5E7EB" }}
        >
          <Warning className="w-4 h-4" />
          Báo cáo vấn đề với mentor
        </button>
        <p className="text-center text-xs text-gray-400 mt-2">
          Nếu bạn gặp vấn đề với mentor, vui lòng báo cáo để chúng tôi xem xét
        </p>
      </div>

      {/* Report modal */}
      {showReportModal && (
        <ReportMentorModal
          mentorId={session.mentorId}
          mentorName={session.mentorName}
          relatedMeetingId={session.sessionId}
          onClose={() => setShowReportModal(false)}
        />
      )}
    </div>
  );
}