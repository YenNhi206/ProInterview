import React, { useState, useEffect, useMemo } from "react";
import { useParams, useNavigate, useLocation } from "react-router";
import {
  ArrowLeft,
  Star,
  Check,
  Sparkles,
  Trophy,
  ThumbsUp,
  ThumbsDown,
  ChevronRight,
  User,
  AlertCircle
} from "lucide-react";
import { toast } from "sonner";
import { isLoggedIn } from "../../utils/auth";
import { buildLoginPath } from "../../utils/authGate";
import { submitReview } from "../../utils/reviewsApi";
import { fetchBookingById } from "../../utils/bookingsApi";
import { apiBookingToLocal } from "../../utils/bookingMappers";

function isMongoObjectId(value) {
  return typeof value === "string" && /^[a-f\d]{24}$/i.test(value.trim());
}

const HIGHLIGHT_OPTIONS = [
  "Câu hỏi thực tế & chuyên sâu",
  "Feedback rõ ràng, dễ hiểu",
  "Chia sẻ kinh nghiệm insider",
  "Phong thái chuyên nghiệp",
  "Đúng giờ, chuẩn bị kỹ",
  "Gợi ý cải thiện cụ thể",
  "Kiến thức kỹ thuật sâu",
  "Trả lời tận tâm"
];

const OVERALL_LABELS = ["", "Chưa hài lòng", "Tạm ổn", "Khá tốt", "Tốt lắm!", "Xuất sắc!"];

export function MentorReview() {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();

  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  
  // Use initialRating from navigation state if available
  const [overallRating, setOverallRating] = useState(location.state?.initialRating || 0);
  const [highlights, setHighlights] = useState([]);
  const [text, setText] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [hoverRating, setHoverRating] = useState(0);

  useEffect(() => {
    const loadSession = async () => {
      setLoading(true);
      setLoadError("");
      setSession(null);
      try {
        if (!isLoggedIn()) {
          setLoadError("Vui lòng đăng nhập để đánh giá buổi phỏng vấn.");
          return;
        }
        if (!isMongoObjectId(sessionId)) {
          setLoadError("Mã buổi hẹn không hợp lệ.");
          return;
        }
        const res = await fetchBookingById(sessionId);
        if (res.success && res.booking) {
          setSession(apiBookingToLocal(res.booking));
        } else {
          setLoadError(res.error || "Không tải được buổi hẹn.");
        }
      } catch (err) {
        console.error("Failed to load session:", err);
        setLoadError("Lỗi kết nối máy chủ.");
      } finally {
        setLoading(false);
      }
    };
    loadSession();
  }, [sessionId]);

  const canSubmit = overallRating > 0;

  const handleSubmit = async () => {
    if (!canSubmit || !session) return;
    setSubmitting(true);
    
    try {
      const res = await submitReview({
        targetType: "mentor",
        targetId: session.mentorId,
        bookingId: session.backendId || session.sessionId,
        rating: overallRating,
        comment: text,
        tags: highlights
      });

      if (res.success) {
        toast.success("Cảm ơn bạn đã gửi đánh giá!");
        setSubmitted(true);
      } else {
        toast.error(res.error || "Không thể gửi đánh giá.");
      }
    } catch (error) {
      toast.error("Lỗi kết nối máy chủ.");
    } finally {
      setSubmitting(false);
    }
  };
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] antialiased">
        <div className="w-12 h-12 rounded-full border-4 border-slate-100 border-t-indigo-500 animate-spin mb-4" />
        <p className="text-slate-400 font-bold text-xs uppercase tracking-widest">Đang tải thông tin...</p>
      </div>
    );
  }

  if (session?.isReviewed) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-8 antialiased">
        <div className="w-16 h-16 rounded-3xl bg-emerald-50 flex items-center justify-center mb-6">
          <Check className="w-8 h-8 text-emerald-500" />
        </div>
        <p className="text-xl font-black text-slate-900 mb-2">Bạn đã đánh giá buổi này</p>
        <p className="text-slate-500 mb-8 text-center max-w-xs text-sm font-medium">
          Cảm ơn phản hồi của bạn cho mentor {session.mentorName}.
        </p>
        <button
          onClick={() => navigate(`/session/${session.backendId || session.sessionId}`)}
          className="px-8 py-3 rounded-2xl text-sm font-black text-white shadow-xl shadow-violet-900/20"
          style={{ background: "linear-gradient(135deg, #6E35E8, #8B4DFF)" }}
        >
          Xem buổi phỏng vấn
        </button>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-8 antialiased">
        <div className="w-16 h-16 rounded-3xl bg-slate-50 flex items-center justify-center mb-6">
          <AlertCircle className="w-8 h-8 text-slate-300" />
        </div>
        <p className="text-xl font-black text-slate-900 mb-2">Không tìm thấy thông tin</p>
        <p className="text-slate-500 mb-8 text-center max-w-xs text-sm font-medium">
          {loadError || "Buổi phỏng vấn này không tồn tại hoặc bạn không có quyền xem."}
        </p>
        {!isLoggedIn() ? (
          <button
            onClick={() => navigate(buildLoginPath(`/review/${sessionId}`))}
            className="px-8 py-3 rounded-2xl text-sm font-black text-white shadow-xl shadow-violet-900/20"
            style={{ background: "linear-gradient(135deg, #6E35E8, #8B4DFF)" }}
          >
            Đăng nhập
          </button>
        ) : (
          <button
            onClick={() => navigate("/dashboard")}
            className="px-8 py-3 rounded-2xl text-sm font-black text-white shadow-xl shadow-violet-900/20"
            style={{ background: "linear-gradient(135deg, #6E35E8, #8B4DFF)" }}
          >
            Về Dashboard
          </button>
        )}
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="mx-auto max-w-2xl p-6 py-20 antialiased">
        <div className="relative overflow-hidden rounded-[3rem] p-12 text-center shadow-2xl shadow-violet-900/10 border border-slate-100 bg-white">
          <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-indigo-50 to-violet-50 blur-3xl -z-10" />
          
          <div className="w-24 h-24 rounded-[2rem] flex items-center justify-center mx-auto mb-8 shadow-xl shadow-indigo-900/10 bg-white border border-indigo-50">
            <Trophy className="w-10 h-10 text-indigo-500" />
          </div>
          
          <h1 className="app-page-title mb-3">
            Đã lưu đánh giá! 🎉
          </h1>
          <p className="text-slate-500 mb-10 text-lg font-medium leading-relaxed max-w-md mx-auto">
            Cảm ơn bạn đã đóng góp. Nhận xét của bạn giúp <span className="text-indigo-600 font-bold">{session.mentorName}</span> phát triển và hỗ trợ cộng đồng tốt hơn.
          </p>

          <div className="flex items-center justify-center gap-3 mb-10">
            {[1,2,3,4,5].map(i => (
              <Star
                key={i}
                className="w-10 h-10"
                fill={i <= overallRating ? "#FFD600" : "none"}
                style={{ color: i <= overallRating ? "#FFD600" : "#E2E8F0" }}
              />
            ))}
          </div>

          <button
            onClick={() => navigate("/dashboard")}
            className="w-full py-5 rounded-[2rem] font-black text-lg text-white shadow-2xl shadow-indigo-900/20 transition-all hover:scale-[1.02] active:scale-95"
            style={{ background: "linear-gradient(135deg, #6E35E8, #8B4DFF)" }}
          >
            Về trang cá nhân
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl p-6 py-10 antialiased">
      <button
        onClick={() => navigate(-1)}
        className="group flex items-center gap-2 text-slate-400 hover:text-slate-900 text-[11px] font-black uppercase tracking-widest mb-10 transition-all"
      >
        <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-1" />
        Quay lại
      </button>

      {/* Header Card */}
      <div className="relative overflow-hidden bg-white rounded-[2.5rem] p-10 shadow-[0_20px_50px_rgba(0,0,0,0.04)] border border-slate-100 mb-8">
        <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-indigo-50/50 to-violet-50/30 blur-3xl -z-10" />
        
        <div className="flex items-center gap-6">
          <img
            src={session.mentorAvatar}
            alt={session.mentorName}
            className="w-20 h-20 rounded-[1.5rem] object-cover shadow-lg shadow-indigo-900/10 border-2 border-white"
          />
          <div className="flex-1">
            <h5 className="text-[10px] font-black text-indigo-500 uppercase tracking-[0.3em] mb-2">ĐÁNH GIÁ MENTOR</h5>
            <h2 className="text-2xl font-black text-slate-900 tracking-tight">{session.mentorName}</h2>
            <p className="text-sm font-bold text-slate-400 mt-1">{session.date} · {session.time}</p>
          </div>
        </div>
      </div>

      {/* Star Rating Section */}
      <div className="bg-white rounded-[2.5rem] p-10 shadow-[0_20px_50px_rgba(0,0,0,0.02)] border border-slate-100 mb-8 text-center">
        <h3 className="text-lg font-black text-slate-900 mb-8 tracking-tight">Trải nghiệm của bạn thế nào?</h3>
        
        <div className="flex flex-col items-center gap-6">
          <div className="flex items-center gap-4">
            {[1, 2, 3, 4, 5].map((i) => (
              <button
                key={i}
                onMouseEnter={() => setHoverRating(i)}
                onMouseLeave={() => setHoverRating(0)}
                onClick={() => setOverallRating(i)}
                className="transition-all hover:scale-125 active:scale-90"
              >
                <Star
                  className="w-12 h-12"
                  fill={i <= (hoverRating || overallRating) ? "#FFD600" : "none"}
                  style={{ color: i <= (hoverRating || overallRating) ? "#FFD600" : "#F1F5F9" }}
                />
              </button>
            ))}
          </div>
          
          <div className="h-6 flex items-center">
            <span className="text-xs font-black uppercase tracking-widest text-indigo-500">
              {OVERALL_LABELS[hoverRating || overallRating]}
            </span>
          </div>
        </div>
      </div>

      {/* Highlights Section */}
      <div className="bg-white rounded-[2.5rem] p-10 shadow-[0_20px_50px_rgba(0,0,0,0.02)] border border-slate-100 mb-8">
        <h3 className="text-sm font-black text-slate-900 mb-6 uppercase tracking-widest">Điểm nổi bật</h3>
        <div className="flex flex-wrap gap-3">
          {HIGHLIGHT_OPTIONS.map(opt => {
            const isSelected = highlights.includes(opt);
            return (
              <button
                key={opt}
                onClick={() =>
                  setHighlights(prev =>
                    isSelected ? prev.filter(h => h !== opt) : [...prev, opt]
                  )
                }
                className={`px-6 py-3 rounded-2xl text-xs font-bold transition-all border-2 ${
                  isSelected 
                    ? "bg-slate-900 border-slate-900 text-white shadow-lg shadow-slate-900/20" 
                    : "bg-white border-slate-100 text-slate-400 hover:border-slate-200"
                }`}
              >
                {opt}
              </button>
            );
          })}
        </div>
      </div>

      {/* Detailed Feedback Section */}
      <div className="bg-white rounded-[2.5rem] p-10 shadow-[0_20px_50px_rgba(0,0,0,0.02)] border border-slate-100 mb-10">
        <h3 className="text-sm font-black text-slate-900 mb-6 uppercase tracking-widest">Nhận xét chi tiết</h3>
        <textarea
          value={text}
          onChange={e => setText(e.target.value)}
          placeholder={`Ví dụ: Buổi phỏng vấn với ${session.mentorName} rất bổ ích. Mentor đặt câu hỏi thực tế và cho feedback rõ ràng...`}
          className="w-full min-h-[160px] bg-slate-50/50 rounded-3xl p-6 text-sm font-bold text-slate-700 placeholder:text-slate-300 outline-none focus:ring-4 focus:ring-violet-50 border border-slate-100 transition-all resize-none"
        />
        <p className="text-[10px] font-bold text-slate-400 mt-4 text-right uppercase tracking-widest">
          {text.length} / 2000 ký tự
        </p>
      </div>

      {/* Submit Button */}
      <div className="flex flex-col gap-4">
        <button
          onClick={handleSubmit}
          disabled={!canSubmit || submitting}
          className="w-full py-6 rounded-[2rem] font-black text-lg text-white shadow-2xl shadow-indigo-900/20 transition-all disabled:opacity-50 disabled:scale-100 hover:scale-[1.02] active:scale-95 flex items-center justify-center gap-3"
          style={{ background: "linear-gradient(135deg, #6E35E8, #8B4DFF)" }}
        >
          {submitting ? (
            <div className="w-6 h-6 rounded-full border-3 border-white/30 border-t-white animate-spin" />
          ) : (
            <>
              Gửi đánh giá <ChevronRight className="w-5 h-5" />
            </>
          )}
        </button>
        <p className="text-center text-[10px] font-black text-slate-400 uppercase tracking-widest">
          Chỉ mất 1 phút · Đánh giá của bạn rất quan trọng
        </p>
      </div>
    </div>
  );
}