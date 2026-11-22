import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router";
import { 
  Star, 
  Clock, 
  CheckCircle2, 
  User, 
  Send, 
  Sparkles,
  Target,
  Trophy,
  Lightbulb,
  MessageSquare
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { toastApiError, toastApiSuccess } from "../../utils/shared/apiToast.js";
import { MentorPageShell } from "../../components/mentor/MentorPageShell";
import { MentorPageHeader } from "../../components/mentor/MentorPageHeader.jsx";
import { fetchMentorBookingById, updateMentorNotes } from "../../api/bookingsApi.js";
import { avatarSrc, DEFAULT_AVATAR } from "../../utils/shared/mediaUrl.js";
import { sessionTypeLabel } from "../../utils/booking/sessionTypeLabels.js";

export function MentorSessionFeedback() {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  
  const [booking, setBooking] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  // Form states
  const [rating, setRating] = useState(5);
  const [strengths, setStrengths] = useState("");
  const [weaknesses, setWeaknesses] = useState("");
  const [advice, setAdvice] = useState("");
  const [generalNotes, setGeneralNotes] = useState("");

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await fetchMentorBookingById(sessionId);
        if (!active) return;
        if (res.success && res.booking) {
          setBooking(res.booking);
        } else {
          toastApiError(res.error, "Không tải được thông tin buổi học.");
        }
      } catch {
        if (active) toastApiError("Lỗi kết nối khi tải buổi học.");
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [sessionId]);

  const handleSubmit = async () => {
    if (saving) return;
    setSaving(true);
    
    try {
      const combinedNotes = `
Điểm mạnh: ${strengths || "Đang cập nhật"}
Cần cải thiện: ${weaknesses || "Đang cập nhật"}
Lời khuyên: ${advice || "Đang cập nhật"}

Nhận xét chi tiết:
${generalNotes || "Không có ghi chú thêm."}
      `.trim();

      const res = await updateMentorNotes(sessionId, { notes: combinedNotes });
      
      if (res.success) {
        toastApiSuccess("Đã lưu phản hồi buổi học.");
        setShowSuccess(true);
        setTimeout(() => {
          navigate("/mentor/schedule");
        }, 3000);
      } else {
        toastApiError(res.error, "Có lỗi xảy ra khi lưu đánh giá.");
      }
    } catch {
      toastApiError("Lỗi kết nối máy chủ khi gửi báo cáo.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <MentorPageShell mentorRole>
        <div className="p-20 text-center font-semibold text-slate-400">Đang tải thông tin...</div>
      </MentorPageShell>
    );
  }

  return (
    <MentorPageShell bottomPad="pb-32" mentorRole>
      <div className="relative z-10 mx-auto max-w-4xl px-10 pb-10">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-10"
        >
          {/* Unified Mentor Header */}
          <MentorPageHeader
            backTo={`/mentor/meetings/${sessionId}`}
            backLabel="Quay lại Chi tiết buổi hẹn"
            title="Đánh giá"
            highlight="chuyên sâu"
          />

          <div className="space-y-12">
            <div className="grid lg:grid-cols-12 gap-10">
              {/* Mentee Sidebar */}
              <div className="lg:col-span-4">
                <div className="sticky top-24 space-y-6">
                  <div className="bg-white rounded-[2.5rem] p-8 shadow-[0_20px_50px_rgba(0,0,0,0.04)] border border-slate-100 text-center">
                    <img 
                      src={avatarSrc(booking?.customerAvatar) || DEFAULT_AVATAR} 
                      alt={booking?.customerName}
                      className="w-24 h-24 rounded-[32px] mx-auto mb-6 object-cover ring-8 ring-slate-50 shadow-inner"
                    />
                    <h3 className="text-xl font-black text-slate-900 tracking-tight">{booking?.customerName}</h3>
                    <p className="text-[10px] font-normal text-indigo-500 uppercase tracking-widest mt-2">Học viên</p>
                    
                    <div className="mt-8 pt-8 border-t border-slate-50 space-y-4">
                      <div className="text-left">
                        <p className="text-[9px] font-normal text-slate-400 uppercase tracking-widest mb-1">Vị trí phỏng vấn</p>
                        <p className="text-xs font-normal text-slate-700">{sessionTypeLabel(booking?.sessionType)}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Main Form */}
              <div className="lg:col-span-8 space-y-8">
                {/* Structured Sections */}
                <div className="grid md:grid-cols-2 gap-8">
                  <div className="bg-white rounded-[2.5rem] p-10 shadow-[0_20px_50px_rgba(0,0,0,0.04)] border border-slate-100">
                    <h5 className="text-[10px] font-normal text-emerald-500 uppercase tracking-[0.3em] mb-6">ĐIỂM MẠNH</h5>
                    <textarea 
                      value={strengths}
                      onChange={(e) => setStrengths(e.target.value)}
                      placeholder="Nội dung..."
                      className="w-full h-40 bg-slate-50/30 rounded-2xl p-4 text-sm font-normal text-slate-700 border border-transparent focus:border-emerald-100 focus:bg-white outline-none transition-all resize-none"
                    />
                  </div>

                  <div className="bg-white rounded-[2.5rem] p-10 shadow-[0_20px_50px_rgba(0,0,0,0.04)] border border-slate-100">
                    <h5 className="text-[10px] font-normal text-rose-500 uppercase tracking-[0.3em] mb-6">CẦN CẢI THIỆN</h5>
                    <textarea 
                      value={weaknesses}
                      onChange={(e) => setWeaknesses(e.target.value)}
                      placeholder="Nội dung..."
                      className="w-full h-40 bg-slate-50/30 rounded-2xl p-4 text-sm font-normal text-slate-700 border border-transparent focus:border-rose-100 focus:bg-white outline-none transition-all resize-none"
                    />
                  </div>
                </div>

                <div className="bg-white rounded-[2.5rem] p-10 shadow-[0_20px_50px_rgba(0,0,0,0.04)] border border-slate-100">
                  <h5 className="text-[10px] font-normal text-amber-500 uppercase tracking-[0.3em] mb-6">LỜI KHUYÊN PHÁT TRIỂN</h5>
                  <textarea 
                    value={advice}
                    onChange={(e) => setAdvice(e.target.value)}
                    placeholder="Định hướng tiếp theo cho học viên..."
                    className="w-full h-40 bg-slate-50/30 rounded-2xl p-6 text-sm font-normal text-slate-700 border border-transparent focus:border-amber-100 focus:bg-white outline-none transition-all resize-none"
                  />
                </div>

                {/* Detailed Analysis */}
                <div className="bg-gradient-to-br from-slate-900 to-indigo-950 rounded-[2.5rem] p-12 shadow-2xl shadow-indigo-900/20 text-white">
                  <h5 className="text-[10px] font-normal text-indigo-300 uppercase tracking-[0.3em] mb-8">PHÂN TÍCH CHI TIẾT</h5>
                  <textarea 
                    value={generalNotes}
                    onChange={(e) => setGeneralNotes(e.target.value)}
                    placeholder="Ghi chú bổ sung khác..."
                    className="w-full h-60 bg-white/5 backdrop-blur-md rounded-3xl p-8 text-sm font-normal text-indigo-50 border border-white/10 focus:border-white/20 outline-none transition-all resize-none"
                  />
                </div>

                {/* Action */}
                <div className="pt-10 flex justify-end">
                  <button
                    onClick={handleSubmit}
                    disabled={saving}
                    className="px-12 py-5 rounded-[2rem] bg-indigo-600 text-white text-xs font-semibold uppercase tracking-[0.3em] shadow-2xl shadow-indigo-600/30 hover:bg-indigo-700 hover:-translate-y-1 transition-all disabled:opacity-50"
                  >
                    {saving ? "Đang xử lý..." : "Xác nhận gửi báo cáo"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Success Overlay */}
        <AnimatePresence>
          {showSuccess && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[100] bg-white/80 backdrop-blur-xl flex items-center justify-center p-6"
            >
              <motion.div 
                initial={{ scale: 0.9, y: 20 }}
                animate={{ scale: 1, y: 0 }}
                className="bg-white rounded-[3rem] p-12 shadow-2xl border border-slate-100 text-center max-w-sm w-full"
              >
                <div className="w-24 h-24 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-8">
                  <CheckCircle2 size={48} />
                </div>
                <h2 className="text-xl font-extrabold text-slate-900 mb-4 tracking-tight sm:text-2xl">Tuyệt vời!</h2>
                <p className="text-slate-500 font-normal leading-relaxed mb-8">
                  Đánh giá của bạn đã được gửi đi thành công. Cảm ơn bạn đã đồng hành cùng học viên.
                </p>
                <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: "100%" }}
                    transition={{ duration: 2.5 }}
                    className="h-full bg-emerald-500"
                  />
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </MentorPageShell>
  );
}
