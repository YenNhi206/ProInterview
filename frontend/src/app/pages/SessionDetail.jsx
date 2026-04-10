import React, { useState, useEffect, useMemo } from "react";
import { useParams, useNavigate } from "react-router";
import {
  ArrowLeft,
  Calendar,
  Clock,
  Video,
  Copy,
  Check,
  Star,
  MessageSquareText as ChatText,
  FileText,
  Sparkles as Sparkle,
  BellRing as BellRinging,
  ShieldCheck,
  ExternalLink as ArrowSquareOut,
  Timer,
  StickyNote as Notepad,
  CheckCircle,
  ChevronRight as CaretRight,
  Chrome as GoogleLogo,
  Trophy,
  ThumbsUp,
  PartyPopper as Confetti,
  AlertCircle as WarningCircle,
  Zap as Lightning,
  User,
  X,
  CircleDollarSign as CurrencyCircleDollar,
} from "lucide-react";
import { getBookingById, getReview } from "../utils/bookings";

/* ─── Types ────────────────────────────────────────────── */

/* ─── Helpers ──────────────────────────────────────────── */
function CopyBtn({ text, label = "Sao chép" }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => {
        navigator.clipboard.writeText(text).catch(() => {});
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }}
      className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg transition-all flex-shrink-0"
      style={{
        background: copied ? "rgba(180,240,0,0.12)" : "#F3F4F6",
        color: copied ? "#4A7A00" : "#6B7280",
      }}
    >
      {copied ? <Check className="w-3 h-3" strokeWidth={3} /> : <Copy className="w-3 h-3" strokeWidth={2} />}
      {copied ? "Đã sao chép!" : label}
    </button>
  );
}

function StarRating({ value, onChange }) {
  const [hover, setHover] = useState(0);
  return (
    <div className="flex items-center gap-2">
      {[1, 2, 3, 4, 5].map((i) => (
        <button
          key={i}
          onMouseEnter={() => setHover(i)}
          onMouseLeave={() => setHover(0)}
          onClick={() => onChange(i)}
          className="transition-transform hover:scale-110 active:scale-95"
        >
          <Star
            className="w-9 h-9"
            fill={i <= (hover || value) ? "#FFD600" : "none"}
            style={{ color: i <= (hover || value) ? "#FFD600" : "#D1D5DB" }}
          />
        </button>
      ))}
      {(hover || value) > 0 && (
        <span className="text-sm font-semibold text-gray-600 ml-2">
          {["", "Chưa hài lòng", "Tạm ổn", "Khá tốt", "Tốt", "Xuất sắc!"][hover || value]}
        </span>
      )}
    </div>
  );
}

/* ─── Countdown ────────────────────────────────────────── */
function useCountdown(targetDate, targetTime) {
  const target = useMemo(() => {
    try {
      // Remove day name prefix if present (e.g., "Thứ 2, 27/02" -> "27/02")
      const cleaned = targetDate.includes(",") 
        ? targetDate.split(",")[1].trim() 
        : targetDate;
      
      const parts = cleaned.split("/").map(Number);
      const [h, min] = targetTime.split(":").map(Number);
      
      if (parts.length === 3) {
        // Format: DD/MM/YYYY
        const [d, m, y] = parts;
        return new Date(y, m - 1, d, h, min, 0).getTime();
      } else if (parts.length === 2) {
        // Format: DD/MM (no year) - assume 2026
        const [d, m] = parts;
        return new Date(2026, m - 1, d, h, min, 0).getTime();
      }
      
      // Fallback: parse as is
      return new Date(`${cleaned} ${targetTime}`).getTime();
    } catch (err) {
      console.error("Countdown parse error:", err, "date:", targetDate, "time:", targetTime);
      // Fallback to 1 hour from now
      return Date.now() + 3600000;
    }
  }, [targetDate, targetTime]);

  const [diff, setDiff] = useState(target - Date.now());

  useEffect(() => {
    const iv = setInterval(() => setDiff(target - Date.now()), 1000);
    return () => clearInterval(iv);
  }, [target]);

  const totalSec = Math.max(0, Math.floor(diff / 1000));
  const days = Math.floor(totalSec / 86400);
  const hours = Math.floor((totalSec % 86400) / 3600);
  const minutes = Math.floor((totalSec % 3600) / 60);
  const seconds = totalSec % 60;
  return { days, hours, minutes, seconds, totalSec };
}

/* ─── Main Component ───────────────────────────────────── */
export function SessionDetail() {
  const { id } = useParams();
  const navigate = useNavigate();

  /* ── Resolve session data ── */
  const sessionData = useMemo(() => {
    return getBookingById(id);
  }, [id]);

  /* ── Demo state switcher (for demo purposes) ── */
  const [demoState, setDemoState] = useState("upcoming");

  /* ── Countdown ── */
  const { days, hours, minutes, seconds, totalSec } = useCountdown(
    sessionData?.date ?? "02/03/2026",
    sessionData?.time ?? "14:00"
  );

  /* ── Session state logic ── */
  const autoState = totalSec <= 0 ? "done" : totalSec <= 3600 ? "live" : "upcoming";
  const state = demoState; // use demo for now

  /* ── Checklist ── */
  const [checklist, setChecklist] = useState([
    { id: "quiet", label: "Tìm nơi yên tĩnh, ít tiếng ồn", done: false },
    { id: "headset", label: "Chuẩn bị tai nghe và microphone", done: false },
    { id: "camera", label: "Kiểm tra camera hoạt động", done: false },
    { id: "cv-review", label: "Đọc lại CV một lần trước buổi hẹn", done: false },
    { id: "jd-review", label: "Nghiên cứu kỹ JD và công ty target", done: false },
    { id: "questions", label: "Chuẩn bị 3–5 câu hỏi muốn hỏi mentor", done: false },
    { id: "wifi", label: "Kiểm tra kết nối Internet ổn định", done: false },
  ]);
  const checklistDone = checklist.filter((c) => c.done).length;

  /* ── Notes ── */
  const [notes, setNotes] = useState("");

  /* ── Rating / Feedback ── */
  const [rating, setRating] = useState(0);
  const [feedback, setFeedback] = useState("");
  const [highlights, setHighlights] = useState([]);
  const [submitted, setSubmitted] = useState(false);

  const HIGHLIGHT_OPTIONS = [
    "Câu hỏi thực tế và chuyên sâu",
    "Feedback rõ ràng, dễ hiểu",
    "Chia sẻ kinh nghiệm insider",
    "Phong thái chuyên nghiệp",
    "Đúng giờ, chuẩn bị kỹ",
    "Gợi ý cải thiện cụ thể",
    "Tốc độ phù hợp, không áp lực",
  ];

  if (!sessionData) {
    return (
      <div className="p-8 text-center text-gray-400">
        <WarningCircle className="w-12 h-12 mx-auto mb-3 text-gray-300" />
        <p>Không tìm thấy thông tin buổi phỏng vấn.</p>
        <button
          onClick={() => navigate("/dashboard")}
          className="mt-4 px-4 py-2 rounded-xl text-sm font-medium text-white"
          style={{ background: "#6E35E8" }}
        >
          Về Dashboard
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto p-6 pb-12">
      {/* ── Back ── */}
      <button
        onClick={() => navigate("/dashboard")}
        className="group flex items-center gap-2 text-gray-500 hover:text-gray-900 text-sm mb-6 transition-colors px-3 py-1.5 rounded-lg hover:bg-gray-100 -ml-3"
      >
        <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-0.5" />
        Quay lại Dashboard
      </button>

      {/* ══════════════════════════════════════════════ */}
      {/*              STATE: UPCOMING                  */}
      {/* ══════════════════════════════════════════════ */}
      {state === "upcoming" && (
        <div className="grid lg:grid-cols-3 gap-5">
          {/* LEFT COL */}
          <div className="lg:col-span-2 space-y-5">

            {/* ── Status header ── */}
            <div
              className="rounded-2xl p-5 flex items-center gap-4"
              style={{ background: "linear-gradient(135deg, #1F1B2E 0%, #2D2640 100%)", border: "1px solid rgba(180,240,0,0.15)" }}
            >
              <div className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0" style={{ background: "rgba(180,240,0,0.12)" }}>
                <Calendar className="w-6 h-6" style={{ color: "#B4F000" }} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-white font-bold" style={{ fontSize: "1.05rem" }}>Buổi phỏng vấn đã được xác nhận</p>
                <p className="text-white/50 text-sm mt-0.5">{sessionData.date} · {sessionData.time}–{sessionData.endTime} · Zoom / Google Meet</p>
              </div>
              <div className="flex-shrink-0 text-right">
                <p className="text-xs font-semibold" style={{ color: "rgba(180,240,0,0.7)" }}>MÃ ĐẶT LỊCH</p>
                <p className="text-white font-bold text-sm">#{sessionData.orderNum}</p>
              </div>
            </div>

            {/* ── Countdown ── */}
            <div className="card-premium overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between" style={{ background: "rgba(110, 53, 232,0.03)" }}>
                <div className="flex items-center gap-2">
                  <Timer className="w-4 h-4" style={{ color: "#6E35E8" }} />
                  <span className="font-semibold text-gray-800 text-sm">Đếm ngược đến buổi phỏng vấn</span>
                </div>
                <span className="text-xs text-gray-400">{sessionData.date} lúc {sessionData.time}</span>
              </div>
              <div className="p-6">
                <div className="grid grid-cols-4 gap-3">
                  {[
                    { label: "Ngày", val: String(days).padStart(2, "0") },
                    { label: "Giờ", val: String(hours).padStart(2, "0") },
                    { label: "Phút", val: String(minutes).padStart(2, "0") },
                    { label: "Giây", val: String(seconds).padStart(2, "0") },
                  ].map((item) => (
                    <div key={item.label} className="text-center">
                      <div
                        className="rounded-2xl py-4 mb-2 font-black tabular-nums"
                        style={{
                          background: "linear-gradient(135deg, #1F1B2E, #2D2640)",
                          color: "#B4F000",
                          fontSize: "2.25rem",
                          letterSpacing: "-0.05em",
                          lineHeight: 1,
                        }}
                      >
                        {item.val}
                      </div>
                      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">{item.label}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* ── Google Meet link ── */}
            <div className="card-premium overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2" style={{ background: "rgba(110, 53, 232,0.03)" }}>
                <Video className="w-4 h-4" style={{ color: "#6E35E8" }} />
                <span className="font-semibold text-gray-800 text-sm">Link tham gia phòng họp</span>
              </div>
              <div className="p-5">
                {/* Meet link card */}
                <div
                  className="rounded-2xl p-4 mb-4 flex items-center gap-4"
                  style={{ background: "rgba(66,133,244,0.05)", border: "1.5px solid rgba(66,133,244,0.2)" }}
                >
                  <div
                    className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{ background: "#4285F4" }}
                  >
                    <GoogleLogo className="w-6 h-6 text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-gray-900 font-bold text-sm">Google Meet</p>
                    <p
                      className="font-mono text-xs mt-0.5 truncate"
                      style={{ color: "#4285F4" }}
                    >
                      {sessionData.meetLink}
                    </p>
                  </div>
                  <div className="flex flex-col gap-2 flex-shrink-0">
                    <a
                      href={sessionData.meetLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1.5 text-xs font-bold px-3 py-2 rounded-xl text-white transition-all hover:opacity-90"
                      style={{ background: "#4285F4" }}
                    >
                      Mở Meet <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                    <CopyBtn text={sessionData.meetLink} label="Sao chép liên kết" />
                  </div>
                </div>

                {/* Add to calendar */}
                <div className="flex items-center gap-3">
                  <button
                    className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold transition-all hover:opacity-90 border card-premium animate-fade-in" style={{ color: "#374151" }}
                  >
                    <Calendar className="w-4 h-4 text-gray-500" />
                    Thêm vào Google Calendar
                  </button>
                  <button
                    className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-semibold transition-all border card-premium animate-fade-in" style={{ color: "#374151" }}
                  >
                    <Bell className="w-4 h-4 text-gray-500" />
                    Đặt nhắc nhở
                  </button>
                </div>

                <p className="text-xs text-gray-400 mt-3 flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5" style={{ color: "#6E35E8" }} />
                  Link sẽ chỉ hoạt động đúng giờ phỏng vấn. Email xác nhận đã được gửi.
                </p>
              </div>
            </div>

            {/* ── Checklist ── */}
            <div className="card-premium overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between" style={{ background: "rgba(110, 53, 232,0.03)" }}>
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4" style={{ color: "#6E35E8" }} />
                  <span className="font-semibold text-gray-800 text-sm">Checklist chuẩn bị trước buổi</span>
                </div>
                <span
                  className="text-xs font-bold px-3 py-1 rounded-full"
                  style={{
                    background: checklistDone === checklist.length ? "rgba(180,240,0,0.15)" : "rgba(110, 53, 232,0.08)",
                    color: checklistDone === checklist.length ? "#4A7A00" : "#6E35E8",
                  }}
                >
                  {checklistDone}/{checklist.length} hoàn thành
                </span>
              </div>
              <div className="p-5">
                {/* Progress bar */}
                <div className="w-full h-1.5 bg-gray-100 rounded-full mb-5 overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${(checklistDone / checklist.length) * 100}%`,
                      background: checklistDone === checklist.length
                        ? "linear-gradient(90deg, #B4F000, #8CC700)"
                        : "linear-gradient(90deg, #6E35E8, #8B4DFF)",
                    }}
                  />
                </div>
                <div className="space-y-3">
                  {checklist.map((item) => (
                    <button
                      key={item.id}
                      onClick={() =>
                        setChecklist((prev) =>
                          prev.map((c) => c.id === item.id ? { ...c, done: !c.done } : c)
                        )
                      }
                      className="w-full flex items-center gap-3 text-left transition-all"
                    >
                      <div
                        className="w-5 h-5 rounded-md flex items-center justify-center flex-shrink-0 transition-all"
                        style={{
                          background: item.done ? "#6E35E8" : "#fff",
                          border: item.done ? "2px solid #6E35E8" : "2px solid #D1D5DB",
                        }}
                      >
                        {item.done && <Check className="w-3 h-3 text-white" />}
                      </div>
                      <span
                        className="text-sm transition-all"
                        style={{
                          color: item.done ? "#9CA3AF" : "#374151",
                          textDecoration: item.done ? "line-through" : "none",
                        }}
                      >
                        {item.label}
                      </span>
                    </button>
                  ))}
                </div>
                {checklistDone === checklist.length && (
                  <div
                    className="mt-4 rounded-xl p-3 flex items-center gap-2"
                    style={{ background: "rgba(180,240,0,0.1)", border: "1px solid rgba(180,240,0,0.3)" }}
                  >
                    <PartyPopper className="w-5 h-5" style={{ color: "#4A7A00" }} />
                    <p className="text-sm font-semibold" style={{ color: "#4A7A00" }}>
                      Bạn đã sẵn sàng 100%! Chúc buổi phỏng vấn thành công.
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* ── Tips ── */}
            <div className="card-premium p-5">
              <div className="flex items-center gap-2 mb-4">
                <Zap className="w-4 h-4" style={{ color: "#FFD600" }} />
                <span className="font-semibold text-gray-800 text-sm">Tips từ mentor cho buổi phỏng vấn</span>
              </div>
              <div className="space-y-3">
                {[
                  { icon: "💬", tip: "Trả lời theo cấu trúc STAR: Tình huống → Nhiệm vụ → Hành động → Kết quả" },
                  { icon: "⏱", tip: "Giữ mỗi câu trả lời trong 2–3 phút, đừng quá ngắn hoặc quá dài" },
                  { icon: "👁", tip: "Nhìn thẳng camera để tạo giao tiếp bằng mắt ảo, không nhìn màn hình" },
                  { icon: "📝", tip: "Chuẩn bị sẵn giấy để ghi chú những điểm mentor nhận xét" },
                  { icon: "🎯", tip: "Hỏi mentor về những gì thực sự diễn ra trong quy trình tuyển dụng" },
                ].map((t, i) => (
                  <div key={i} className="flex items-start gap-3 p-3 rounded-xl" style={{ background: "#F9FAFB" }}>
                    <span style={{ fontSize: "1.1rem" }}>{t.icon}</span>
                    <p className="text-sm text-gray-600 leading-relaxed">{t.tip}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* RIGHT COL */}
          <div className="space-y-4">
            {/* ── Mentor card ── */}
            <div className="card-premium p-5">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4">Mentor của bạn</p>
              <div className="flex items-center gap-3 mb-4">
                <img
                  src={sessionData.mentorAvatar}
                  alt={sessionData.mentorName}
                  className="w-14 h-14 rounded-2xl object-cover flex-shrink-0"
                />
                <div>
                  <p className="text-gray-900 font-bold">{sessionData.mentorName}</p>
                  <p className="text-gray-500 text-xs">{sessionData.mentorTitle}</p>
                  <p className="text-xs font-semibold mt-0.5" style={{ color: "#6E35E8" }}>{sessionData.mentorCompany}</p>
                </div>
              </div>
              <button
                onClick={() => navigate(`/mentors/${sessionData.mentorId}`)}
                className="w-full py-2.5 rounded-xl text-sm font-medium text-gray-600 transition-all border border-gray-200 hover:border-[#6E35E8]/40 hover:text-[#6E35E8]"
              >
                Xem hồ sơ mentor
              </button>
            </div>

            {/* ── Session info ── */}
            <div className="card-premium p-5">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4">Chi tiết buổi hẹn</p>
              <div className="space-y-3">
                {[
                  { icon: Calendar, label: "Ngày", value: sessionData.date },
                  { icon: Clock, label: "Thời gian", value: `${sessionData.time} – ${sessionData.endTime}` },
                  { icon: Timer, label: "Thời lượng", value: "60 phút" },
                  { icon: Video, label: "Hình thức", value: "Google Meet" },
                  { icon: User, label: "Vị trí", value: sessionData.position },
                ].map((row) => (
                  <div key={row.label} className="flex items-start gap-3">
                    <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5" style={{ background: "rgba(110, 53, 232,0.07)" }}>
                      <row.icon className="w-3.5 h-3.5" style={{ color: "#6E35E8" }} />
                    </div>
                    <div>
                      <p className="text-xs text-gray-400">{row.label}</p>
                      <p className="text-sm font-medium text-gray-800">{row.value}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* ── Uploaded files ── */}
            <div className="card-premium p-5">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4">Tài liệu đã gửi mentor</p>
              <div className="space-y-2">
                {sessionData.cvFile && (
                  <div className="flex items-center gap-3 p-3 rounded-xl" style={{ background: "#F9FAFB" }}>
                    <FileText className="w-4 h-4 flex-shrink-0" style={{ color: "#6E35E8" }} />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-gray-700 truncate">{sessionData.cvFile}</p>
                      <p className="text-xs text-gray-400">CV đính kèm</p>
                    </div>
                    <Check className="w-4 h-4 flex-shrink-0" style={{ color: "#4A7A00" }} />
                  </div>
                )}
                {sessionData.jdFile && (
                  <div className="flex items-center gap-3 p-3 rounded-xl" style={{ background: "#F9FAFB" }}>
                    <FileText className="w-4 h-4 flex-shrink-0" style={{ color: "#FF8C42" }} />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-gray-700 truncate">{sessionData.jdFile}</p>
                      <p className="text-xs text-gray-400">JD đính kèm</p>
                    </div>
                    <Check className="w-4 h-4 flex-shrink-0" style={{ color: "#4A7A00" }} />
                  </div>
                )}
                {!sessionData.jdFile && (
                  <p className="text-xs text-gray-400 italic">Không có JD kèm theo.</p>
                )}
              </div>
            </div>

            {/* ── Price & refund ── */}
            <div className="card-premium p-5">
              <div className="flex justify-between items-center mb-3">
                <span className="text-sm text-gray-500">Đã thanh toán</span>
                <span className="font-bold text-gray-900">{sessionData.price.toLocaleString("vi")}đ</span>
              </div>
              <div className="flex items-start gap-2 pt-3 border-t border-gray-100 mb-4">
                <ShieldCheck className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: "#6E35E8" }} />
                <p className="text-xs text-gray-400">Hoàn tiền 100% nếu mentor không tham gia đúng giờ.</p>
              </div>

              {/* Cancel button with refund policy */}
              <div className="space-y-3">
                <button
                  onClick={() => {
                    if (window.confirm('Bạn có chắc muốn hủy buổi phỏng vấn này không?\n\n' + 
                      (totalSec > 172800 ? '✓ Hủy trước 48 giờ: Hoàn 100%' : 
                       totalSec > 86400 ? '• Hủy trong 24-48h: Hoàn 50%' : 
                       '✗ Hủy trong 24h: Không hoàn tiền'))) {
                      // TODO: Implement cancel booking logic
                      alert('Đã gửi yêu cầu hủy. Chúng tôi sẽ liên hệ trong vòng 24h.');
                    }
                  }}
                  className="w-full py-3 rounded-xl text-sm font-semibold transition-all border flex items-center justify-center gap-2 card-premium animate-fade-in" style={{ color: "#6B7280" }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = "#EF4444";
                    e.currentTarget.style.color = "#EF4444";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = "#E5E7EB";
                    e.currentTarget.style.color = "#6B7280";
                  }}
                >
                  <X className="w-4 h-4" />
                  Hủy buổi phỏng vấn
                </button>

                {/* Refund info based on time */}
                <div className="rounded-xl p-3 space-y-1.5" style={{ background: "#F9FAFB" }}>
                  <div className="flex items-center gap-2">
                    <CircleDollarSign className="w-4 h-4 flex-shrink-0" style={{ color: totalSec > 172800 ? "#10b981" : totalSec > 86400 ? "#f59e0b" : "#ef4444" }} />
                    <p className="text-xs font-semibold" style={{ color: totalSec > 172800 ? "#10b981" : totalSec > 86400 ? "#f59e0b" : "#ef4444" }}>
                      {totalSec > 172800 ? "Hoàn 100% nếu hủy ngay" : 
                       totalSec > 86400 ? "Hoàn 50% nếu hủy ngay" : 
                       "Không hoàn tiền nếu hủy"}
                    </p>
                  </div>
                  <ul className="text-xs text-gray-500 space-y-0.5 ml-6">
                    <li className={totalSec > 172800 ? "text-emerald-600" : ""}>• Hủy trước 48h: Hoàn 100%</li>
                    <li className={totalSec > 86400 && totalSec <= 172800 ? "text-amber-600" : ""}>• Hủy 24-48h: Hoàn 50%</li>
                    <li className={totalSec <= 86400 ? "text-red-600" : ""}>• Hủy trong 24h: Không hoàn</li>
                  </ul>
                  <p className="text-xs text-gray-400 pt-2 border-t border-gray-200">
                    Liên hệ <strong className="text-gray-600">support@prointerview.vn</strong> để đổi lịch miễn phí
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════ */}
      {/*                STATE: LIVE                    */}
      {/* ══════════════════════════════════════════════ */}
      {state === "live" && (
        <div className="grid lg:grid-cols-3 gap-5">
          <div className="lg:col-span-2 space-y-5">
            {/* Live banner */}
            <div
              className="rounded-2xl p-5 flex items-center gap-4"
              style={{ background: "linear-gradient(135deg, #1F1B2E, #2D2640)", border: "1px solid rgba(180,240,0,0.2)" }}
            >
              <div className="relative">
                <div className="w-4 h-4 rounded-full" style={{ background: "#B4F000" }} />
                <div
                  className="absolute inset-0 w-4 h-4 rounded-full animate-ping"
                  style={{ background: "rgba(180,240,0,0.4)" }}
                />
              </div>
              <div className="flex-1">
                <p className="text-white font-bold" style={{ fontSize: "1.05rem" }}>
                  Buổi phỏng vấn đang diễn ra
                </p>
                <p className="text-white/50 text-sm">
                  Với {sessionData.mentorName} · {sessionData.time} – {sessionData.endTime}
                </p>
              </div>
            </div>

            {/* Join button */}
            <a
              href={sessionData.meetLink}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-3 py-5 rounded-2xl text-white font-bold transition-all hover:opacity-95 active:scale-[0.98]"
              style={{
                background: "#4285F4",
                boxShadow: "0 8px 32px rgba(66,133,244,0.35)",
                fontSize: "1.1rem",
              }}
            >
              <Video className="w-6 h-6" />
              Tham gia Google Meet ngay
              <ExternalLink className="w-5 h-5" />
            </a>

            <div className="flex items-center gap-3 py-2 text-sm text-gray-500">
              <div className="flex-1 h-px bg-gray-200" />
              <span>hoặc sao chép liên kết dưới đây</span>
              <div className="flex-1 h-px bg-gray-200" />
            </div>

            {/* Link copy */}
            <div
              className="flex items-center gap-3 p-4 rounded-2xl border"
              style={{ borderColor: "rgba(66,133,244,0.25)", background: "rgba(66,133,244,0.04)" }}
            >
              <p className="flex-1 font-mono text-sm text-gray-700 truncate">{sessionData.meetLink}</p>
              <CopyBtn text={sessionData.meetLink} label="Copy" />
            </div>

            {/* Notes area */}
            <div className="card-premium overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2" style={{ background: "rgba(110, 53, 232,0.03)" }}>
                <Notebook className="w-4 h-4" style={{ color: "#6E35E8" }} />
                <span className="font-semibold text-gray-800 text-sm">Ghi chú trong buổi phỏng vấn</span>
              </div>
              <div className="p-5">
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full text-sm text-gray-700 resize-none focus:outline-none leading-relaxed"
                  style={{ minHeight: "200px", background: "transparent" }}
                  placeholder="Ghi lại những điểm quan trọng, feedback của mentor, những gì cần cải thiện...&#10;&#10;Ví dụ:&#10;- Câu trả lời về system design cần bổ sung phần scalability&#10;- Nên dùng số liệu cụ thể hơn khi kể về kinh nghiệm&#10;- Mentor gợi ý học thêm về distributed systems"
                />
                <div className="flex justify-between items-center pt-3 border-t border-gray-100 mt-2">
                  <p className="text-xs text-gray-400">{notes.length} ký tự</p>
                  <button
                    className="text-xs font-medium px-3 py-1.5 rounded-lg transition-all"
                    style={{ background: "rgba(110, 53, 232,0.08)", color: "#6E35E8" }}
                  >
                    Lưu ghi chú
                  </button>
                </div>
              </div>
            </div>

            {/* Quick tips live */}
            <div
              className="rounded-2xl p-4 flex items-start gap-3"
              style={{ background: "rgba(255,214,0,0.07)", border: "1px solid rgba(255,214,0,0.2)" }}
            >
              <Zap className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: "#997F00" }} />
              <div className="text-sm" style={{ color: "#7A6200" }}>
                <p className="font-semibold mb-1">Nhớ trong lúc phỏng vấn:</p>
                <p>Lắng nghe kỹ câu hỏi trước khi trả lời · Hỏi lại nếu không rõ · Ghi chú feedback để xem lại sau</p>
              </div>
            </div>
          </div>

          {/* Right col — mentor + session info */}
          <div className="space-y-4">
            <div className="card-premium p-5">
              <img
                src={sessionData.mentorAvatar}
                alt={sessionData.mentorName}
                className="w-16 h-16 rounded-2xl object-cover mb-3"
              />
              <p className="text-gray-900 font-bold">{sessionData.mentorName}</p>
              <p className="text-gray-500 text-xs">{sessionData.mentorTitle}</p>
              <p className="text-xs font-semibold mt-1" style={{ color: "#6E35E8" }}>{sessionData.mentorCompany}</p>
              <div
                className="mt-4 pt-4 border-t border-gray-100 flex items-center gap-2 text-xs"
                style={{ color: "#4A7A00" }}
              >
                <div className="w-2 h-2 rounded-full" style={{ background: "#B4F000" }} />
                Đang trong phòng họp
              </div>
            </div>

            <div className="card-premium p-5 space-y-3">
              {[
                { label: "Ngày", value: sessionData.date },
                { label: "Thời gian", value: `${sessionData.time} – ${sessionData.endTime}` },
                { label: "Vị trí", value: sessionData.position },
              ].map((r) => (
                <div key={r.label}>
                  <p className="text-xs text-gray-400">{r.label}</p>
                  <p className="text-sm font-medium text-gray-800">{r.value}</p>
                </div>
              ))}
            </div>

            <button
              onClick={() => setDemoState("done")}
              className="w-full py-3 rounded-xl text-sm font-semibold border border-gray-200 text-gray-600 hover:border-[#6E35E8]/40 hover:text-[#6E35E8] transition-all"
            >
              Kết thúc buổi phỏng vấn →
            </button>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════ */}
      {/*               STATE: DONE                     */}
      {/* ══════════════════════════════════════════════ */}
      {state === "done" && (() => {
        const existingReview = getReview(sessionData.sessionId);
        return (
        <div className="grid lg:grid-cols-3 gap-5">
          <div className="lg:col-span-2 space-y-5">

            {/* Done header */}
            <div
              className="rounded-2xl p-5 flex items-center gap-4"
              style={{ background: "linear-gradient(135deg, #0E0922 0%, #1a0d35 100%)", border: "1px solid rgba(180,240,0,0.2)" }}
            >
              <div className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0"
                style={{ background: "rgba(180,240,0,0.12)" }}>
                <Trophy className="w-6 h-6 text-[#B4F000]" />
              </div>
              <div className="flex-1">
                <p className="text-white font-bold" style={{ fontSize: "1.05rem" }}>Buổi phỏng vấn đã hoàn thành 🎉</p>
                <p className="text-white/50 text-sm">{sessionData.date} · {sessionData.time} – {sessionData.endTime} · với {sessionData.mentorName}</p>
              </div>
            </div>

            {/* Review CTA */}
            {existingReview ? (
              <div className="bg-white rounded-2xl border-2 shadow-sm overflow-hidden"
                style={{ borderColor: "rgba(180,240,0,0.4)", boxShadow: "0 4px 20px rgba(180,240,0,0.08)" }}>
                <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between"
                  style={{ background: "rgba(180,240,0,0.06)" }}>
                  <div className="flex items-center gap-2">
                    <PartyPopper className="w-4 h-4" style={{ color: "#4a7a00" }} />
                    <span className="font-bold text-gray-800 text-sm">Bạn đã đánh giá buổi này</span>
                  </div>
                  <div className="flex items-center gap-1">
                    {[1,2,3,4,5].map(i => (
                      <Star key={i} style={{ width:16, height:16, color: i <= existingReview.overallRating ? "#FFD600" : "#E5E7EB" }}
                        fill={i <= existingReview.overallRating ? "#FFD600" : "none"} />
                    ))}
                  </div>
                </div>
                <div className="p-5">
                  {existingReview.highlights.length > 0 && (
                    <div className="flex flex-wrap gap-2 mb-3">
                      {existingReview.highlights.map(h => (
                        <span key={h} className="text-xs px-2.5 py-1.5 rounded-lg font-medium"
                          style={{ background: "rgba(110, 53, 232,0.08)", color: "#6E35E8" }}>{h}</span>
                      ))}
                    </div>
                  )}
                  {existingReview.text && (
                    <p className="text-sm text-gray-600 leading-relaxed italic border-l-2 pl-3 mb-3"
                      style={{ borderColor: "#6E35E8" }}>"{existingReview.text}"</p>
                  )}
                  <button onClick={() => navigate(`/review/${sessionData.sessionId}`)}
                    className="text-xs font-medium px-3 py-1.5 rounded-lg transition-all"
                    style={{ background: "rgba(110, 53, 232,0.08)", color: "#6E35E8" }}>
                    Chỉnh sửa đánh giá →
                  </button>
                </div>
              </div>
            ) : (
              <div className="bg-white rounded-2xl border-2 shadow-sm overflow-hidden"
                style={{ borderColor: "rgba(110, 53, 232,0.18)", boxShadow: "0 4px 24px rgba(110, 53, 232,0.10)" }}>
                <div className="p-7 flex flex-col items-center text-center gap-4">
                  <div className="w-16 h-16 rounded-2xl flex items-center justify-center"
                    style={{ background: "linear-gradient(135deg,rgba(255,214,0,0.15),rgba(110, 53, 232,0.12))" }}>
                    <Star className="w-8 h-8" style={{ color: "#FFD600" }} fill="#FFD600" />
                  </div>
                  <div>
                    <h3 className="font-black text-gray-900 mb-1.5" style={{ fontSize: "1.15rem" }}>
                      Đánh giá {sessionData.mentorName}
                    </h3>
                    <p className="text-gray-500 text-sm leading-relaxed">
                      Chia sẻ trải nghiệm — giúp mentor cải thiện và học viên khác chọn đúng người.
                    </p>
                  </div>
                  <div className="flex gap-1.5">
                    {[1,2,3,4,5].map(i => (
                      <Star key={i} style={{ width:32, height:32, color: "#E5E7EB" }} />
                    ))}
                  </div>
                  <button
                    onClick={() => navigate(`/review/${sessionData.sessionId}`)}
                    className="w-full py-4 rounded-2xl font-black text-base transition-all active:scale-[0.97]"
                    style={{ background: "linear-gradient(135deg,#6E35E8,#8B4DFF)", color:"#fff", boxShadow:"0 6px 20px rgba(110, 53, 232,0.30)" }}>
                    <Star className="inline w-5 h-5 mr-2 mb-0.5" fill="currentColor" />
                    Viết đánh giá ngay
                  </button>
                  <p className="text-xs text-gray-400">Chỉ mất 1–2 phút · Giúp ích rất nhiều cho cộng đồng</p>
                </div>
              </div>
            )}

            {/* Next steps */}
            <div className="card-premium p-5">
              <p className="font-semibold text-gray-800 text-sm mb-4">Tiếp theo sau buổi phỏng vấn</p>
              <div className="space-y-3">
                {[
                  { icon: Sparkles, color: "#6E35E8", bg: "rgba(110, 53, 232,0.08)",
                    title: "Luyện tập với AI Interview", desc: "Áp dụng feedback vào mock interview AI",
                    action: () => navigate("/interview"), label: "Bắt đầu →" },
                  { icon: FileText, color: "#FF8C42", bg: "rgba(255,140,66,0.08)",
                    title: "Tối ưu lại CV", desc: "Phân tích CV với keyword mentor vừa đề xuất",
                    action: () => navigate("/cv-analysis"), label: "Phân tích →" },
                  { icon: Calendar, color: "#B4F000", bg: "rgba(180,240,0,0.10)",
                    title: "Đặt lịch buổi tiếp theo", desc: "Tiếp tục luyện tập để chinh phục phỏng vấn",
                    action: () => navigate("/mentors"), label: "Tìm mentor →" },
                ].map(item => (
                  <div key={item.title} onClick={item.action}
                    className="flex items-center gap-4 p-4 rounded-2xl cursor-pointer transition-all hover:shadow-sm"
                    style={{ border: "1.5px solid #F3F4F6" }}>
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: item.bg }}>
                      <item.icon className="w-5 h-5" style={{ color: item.color }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-gray-900 font-semibold text-sm">{item.title}</p>
                      <p className="text-gray-400 text-xs">{item.desc}</p>
                    </div>
                    <span className="text-xs font-bold flex-shrink-0" style={{ color: item.color }}>{item.label}</span>
                  </div>
                ))}
              </div>
            </div>

            <button onClick={() => navigate("/dashboard")}
              className="w-full py-4 rounded-2xl font-bold text-sm text-white flex items-center justify-center gap-2"
              style={{ background: "linear-gradient(135deg,#6E35E8,#8B4DFF)", boxShadow: "0 6px 20px rgba(110, 53, 232,0.3)" }}>
              Về Dashboard <CaretRight className="w-4 h-4" />
            </button>
          </div>

          {/* Right col */}
          <div className="space-y-4">
            <div className="card-premium p-5">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4">Tóm tắt buổi phỏng vấn</p>
              <div className="flex items-center gap-3 mb-4">
                <img src={sessionData.mentorAvatar} alt={sessionData.mentorName}
                  className="w-12 h-12 rounded-2xl object-cover" />
                <div>
                  <p className="text-gray-900 font-bold text-sm">{sessionData.mentorName}</p>
                  <p className="text-gray-500 text-xs">{sessionData.mentorTitle}</p>
                </div>
              </div>
              <div className="space-y-2.5 pt-3 border-t border-gray-100">
                {[
                  { label: "Ngày",       value: sessionData.date },
                  { label: "Giờ",        value: `${sessionData.time} – ${sessionData.endTime}` },
                  { label: "Thời lượng", value: "60 phút" },
                  { label: "Vị trí",     value: sessionData.position },
                  { label: "Phí",        value: `${sessionData.price.toLocaleString("vi")}đ` },
                ].map(r => (
                  <div key={r.label} className="flex justify-between text-sm">
                    <span className="text-gray-400">{r.label}</span>
                    <span className="text-gray-700 font-medium text-right max-w-[140px]">{r.value}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="card-premium p-5">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Trạng thái đánh giá</p>
              {existingReview ? (
                <div>
                  <div className="flex items-center gap-1.5 mb-2">
                    <div className="w-2 h-2 rounded-full" style={{ background: "#B4F000" }} />
                    <span className="text-xs font-semibold" style={{ color: "#4a7a00" }}>Đã đánh giá</span>
                  </div>
                  <div className="flex items-center gap-1">
                    {[1,2,3,4,5].map(i => (
                      <Star key={i} style={{ width:18, height:18, color: i <= existingReview.overallRating ? "#FFD600" : "#E5E7EB" }}
                        fill={i <= existingReview.overallRating ? "#FFD600" : "none"} />
                    ))}
                  </div>
                </div>
              ) : (
                <div>
                  <div className="flex items-center gap-1.5 mb-3">
                    <div className="w-2 h-2 rounded-full bg-amber-400" />
                    <span className="text-xs font-semibold text-amber-600">Chờ đánh giá</span>
                  </div>
                  <button onClick={() => navigate(`/review/${sessionData.sessionId}`)}
                    className="w-full py-2.5 rounded-xl text-sm font-bold transition-all"
                    style={{ background: "linear-gradient(135deg,#6E35E8,#8B4DFF)", color: "#fff" }}>
                    Đánh giá ngay
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
        );
      })()}
    </div>
  );
}