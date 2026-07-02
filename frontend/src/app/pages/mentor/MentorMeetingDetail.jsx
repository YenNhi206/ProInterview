import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router";
import { 
  Video, 
  Calendar, 
  Clock, 
  Star, 
  FileText, 
  User, 
  Briefcase, 
  Target, 
  CheckCircle2, 
  AlertCircle,
  MoreVertical,
  MessageSquare,
  Zap,
  ShieldCheck,
  ChevronRight,
  TrendingUp,
  Layout,
  X,
  ChevronDown,
  ExternalLink,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { getUser } from "../../utils/auth/auth.js";
import { MentorPageShell } from "../../components/mentor/MentorPageShell";
import { toastApiError, toastApiSuccess } from "../../utils/shared/apiToast.js";
import { AppSelect } from "../../components/ui/AppSelect";
import {
  fetchMentorBookingById,
  listMentorBookings,
  mentorRescheduleBooking,
  mentorCancelBooking,
  completeMentorBooking,
} from "../../api/bookingsApi.js";
import { loadMentorRescheduleSlotOptions } from "../../utils/booking/bookingRescheduleSlots.js";
import { isBookingSlotInFuture } from "../../utils/booking/bookingSchedule.js";
import {
  canMentorCompleteBooking,
  formatUntilStart,
  getMinutesUntilBookingStart,
  isBookingPastScheduledEnd,
} from "../../utils/shared/meetingLinks.js";
import { avatarSrc } from "../../utils/shared/mediaUrl.js";
import { sessionTypeLabel as sharedSessionTypeLabel } from "../../utils/booking/sessionTypeLabels.js";
import { getBookingAttachments } from "../../utils/booking/bookingAttachments.js";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../../components/ui/dropdown-menu";

function normalizeSessionType(type) {
  return String(type || "").trim().replace(/-/g, "_");
}

function sessionTypeLabel(type) {
  return sharedSessionTypeLabel(normalizeSessionType(type));
}

const MENTOR_MEETING_DETAIL_EXTRA_CSS = `
        .neon-border { position: relative; }
        .neon-border::after {
           content: ''; position: absolute; inset: 0;
           border-radius: inherit;
           padding: 1px;
           background: linear-gradient(135deg, rgba(180, 245, 0, 0.4), transparent, rgba(128, 55, 244, 0.4));
           -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
           mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
           -webkit-mask-composite: xor;
           mask-composite: exclude;
           pointer-events: none;
        }
        .reschedule-modal-card {
           background: #ffffff;
           border-radius: 16px;
           border: 1px solid rgba(128, 55, 244, 0.14);
           box-shadow:
             0 24px 64px rgba(128, 55, 244, 0.1),
             0 8px 24px rgba(15, 23, 42, 0.06);
        }
        .reschedule-modal-header {
           border-radius: 16px 16px 0 0;
        }
        .cancel-modal-header {
           border-radius: 16px 16px 0 0;
        }
`;

const rescheduleFieldLabel =
  "mb-1.5 block text-xs font-normal text-slate-600";
const rescheduleFieldInput =
  "w-full rounded-lg border border-slate-200/90 bg-white px-3.5 py-2.5 text-sm font-normal text-slate-900 outline-none transition-all placeholder:text-slate-400 focus:border-[#8037f4] focus:bg-[#faf8ff] focus:ring-2 focus:ring-[#8037f4]/12 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500";

export function MentorMeetingDetail() {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const user = getUser();
  const isMentorUser = user?.role === "mentor";
  const [meeting, setMeeting] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [menteeSessionCount, setMenteeSessionCount] = useState(0);
  const [busyAction, setBusyAction] = useState("");
  const [actionModal, setActionModal] = useState("");
  const [actionError, setActionError] = useState("");
  const [rescheduleForm, setRescheduleForm] = useState({
    newDate: "",
    newTimeSlot: "",
    reason: "",
  });
  const [cancelReason, setCancelReason] = useState("");
  const [slotOptions, setSlotOptions] = useState([]);
  const [loadingSlots, setLoadingSlots] = useState(false);

  function toBookingDateFormat(input) {
    const raw = String(input || "").trim();
    if (!raw) return "";
    const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (iso) return `${iso[3]}/${iso[2]}/${iso[1]}`;
    return raw;
  }

  function formatMeetingDate(dateStr, timeStr = "00:00") {
    const raw = String(dateStr || "").trim();
    const parts = raw.split("/").map((p) => Number(p));
    if (parts.length < 2 || !Number.isFinite(parts[0]) || !Number.isFinite(parts[1])) return raw || "--/--/----";
    const day = parts[0];
    const month = parts[1];
    const year = parts.length >= 3 && Number.isFinite(parts[2]) ? parts[2] : new Date().getFullYear();
    const [hour, minute] = String(timeStr || "00:00").split(":").map((p) => Number(p));
    const dt = new Date(year, month - 1, day, Number.isFinite(hour) ? hour : 0, Number.isFinite(minute) ? minute : 0);
    if (Number.isNaN(dt.getTime())) return raw || "--/--/----";
    return dt.toLocaleDateString("vi-VN");
  }

  useEffect(() => {
    if (!isMentorUser) {
      navigate("/");
      return;
    }
    if (!sessionId) {
      setLoading(false);
      setLoadError("Thiếu mã buổi hẹn.");
      return;
    }
    let active = true;
    setLoading(true);
    setLoadError("");
    (async () => {
      try {
      const res = await fetchMentorBookingById(sessionId);
      if (!active) return;
      if (!res.success || !res.booking) {
        const msg = res.error || "Không tải được chi tiết buổi hẹn.";
        setMeeting(null);
        setLoadError(msg);
        toastApiError(msg);
        return;
      }
      const b = res.booking;
      setMeeting({
        id: b.id,
        userId: b.userId || "",
        mentorId: b.mentorId || "",
        status: b.status || "",
        scheduledTime: b.timeSlot || "--:--",
        scheduledDate: b.date || "",
        duration: Number(b.durationMinutes || 60),
        meetingType: b.sessionType || "custom",
        rescheduleCount: Array.isArray(b.rescheduleHistory) ? b.rescheduleHistory.length : 0,
        notes: b.notes || "",
        cvFileName: b.cvFileName || "",
        jdFileName: b.jdFileName || "",
        cvFileUrl: b.cvFileUrl || "",
        jdFileUrl: b.jdFileUrl || "",
        feedback: b.mentorNotes || "",
        position: sessionTypeLabel(b.sessionType),
        company: b.customerEmail || "",
        overallScore: Number(b.menteeRating || 0),
        starScores: (() => {
          const s = Number(b.menteeRating || 0);
          return s > 0
            ? { situation: s, task: s, action: s, result: s }
            : { situation: 0, task: 0, action: 0, result: 0 };
        })(),
        mentee: {
          name: b.customerName || "Học viên",
          avatar: avatarSrc(b.customerAvatar),
          level: "Mentee",
        },
      });
      setLoadError("");
      } catch {
        if (!active) return;
        const msg = "Lỗi kết nối khi tải buổi hẹn. Backend có thể đang khởi động lại — thử lại sau vài giây.";
        setMeeting(null);
        setLoadError(msg);
        toastApiError(msg);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [sessionId, isMentorUser, navigate]);

  useEffect(() => {
    let active = true;
    (async () => {
      if (!meeting?.userId) return;
      const res = await listMentorBookings();
      if (!active || !res.success) return;
      const rows = Array.isArray(res.bookings) ? res.bookings : [];
      const count = rows.filter((item) => String(item.userId || "") === String(meeting.userId)).length;
      setMenteeSessionCount(count);
    })();
    return () => {
      active = false;
    };
  }, [meeting?.userId]);

  if (!isMentorUser) return null;
  if (loading) {
    return (
      <MentorPageShell bottomPad="pb-32">
        <div className="p-10 text-sm font-normal text-slate-500">Đang tải chi tiết buổi hẹn…</div>
      </MentorPageShell>
    );
  }
  if (!meeting) {
    return (
      <MentorPageShell bottomPad="pb-32">
        <div className="mx-auto max-w-lg p-10">
          <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
            <AlertCircle className="mx-auto mb-4 text-amber-500" size={40} />
            <h2 className="text-lg font-bold text-slate-900">
              {loadError ? "Không tải được buổi hẹn" : "Không tìm thấy buổi hẹn"}
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">
              {loadError ||
                "Buổi hẹn không tồn tại hoặc không thuộc tài khoản mentor của bạn."}
            </p>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="rounded-lg bg-primary-fixed px-5 py-2.5 text-sm font-bold text-slate-900"
              >
                Thử lại
              </button>
              <button
                type="button"
                onClick={() => navigate("/mentor/schedule")}
                className="rounded-lg border border-slate-200 px-5 py-2.5 text-sm font-normal text-slate-700 hover:bg-slate-50"
              >
                Về lịch họp
              </button>
            </div>
          </div>
        </div>
      </MentorPageShell>
    );
  }

  const isCompleted = meeting.status === "completed" || meeting.overallScore > 0;
  const canReschedule = Number(meeting.rescheduleCount || 0) < 1;
  const meetingTypeLabel = sessionTypeLabel(meeting.meetingType);
  const showCompleteReminder =
    !isCompleted &&
    ["confirmed", "in_progress"].includes(String(meeting.status || "")) &&
    isBookingPastScheduledEnd({
      date: meeting.scheduledDate,
      timeSlot: meeting.scheduledTime,
      durationMinutes: meeting.duration,
    });
  const canCompleteSession = canMentorCompleteBooking({
    date: meeting.scheduledDate,
    timeSlot: meeting.scheduledTime,
    durationMinutes: meeting.duration,
  });
  const completeBlockedHint =
    !canCompleteSession && !isCompleted
      ? `Chưa tới giờ bắt đầu (còn ${formatUntilStart(
          getMinutesUntilBookingStart({
            date: meeting.scheduledDate,
            timeSlot: meeting.scheduledTime,
          }),
        )}). Có thể vào phòng trước, kết thúc sau khi buổi bắt đầu.`
      : "";

  const handleMentorReschedule = async () => {
    if (!canReschedule) {
      const msg = "Bạn đã hết lượt dời lịch cho buổi hẹn này.";
      setActionError(msg);
      toastApiError(msg);
      return;
    }
    const newDate = toBookingDateFormat(rescheduleForm.newDate);
    const newTimeSlot = String(rescheduleForm.newTimeSlot || "").trim();
    const reason = String(rescheduleForm.reason || "").trim();
    if (!newDate || !newTimeSlot) {
      setActionError("Vui lòng nhập đủ ngày và giờ mới.");
      return;
    }
    if (!isBookingSlotInFuture(newDate, newTimeSlot)) {
      const msg = "Không thể chọn khung giờ đã qua. Vui lòng chọn thời gian trong tương lai.";
      setActionError(msg);
      toastApiError(msg);
      return;
    }
    setBusyAction("reschedule");
    try {
    const res = await mentorRescheduleBooking(meeting.id, { newDate, newTimeSlot, reason });
    if (!res.success) {
      setActionError(res.error || "Không thể dời lịch.");
      toastApiError(res.error, "Không thể dời lịch.");
      return;
    }
    const b = res.booking || {};
    setMeeting((prev) =>
      prev
        ? {
            ...prev,
            scheduledDate: b.date || prev.scheduledDate,
            scheduledTime: b.timeSlot || prev.scheduledTime,
            status: b.status || prev.status,
            notes: b.notes || prev.notes,
            feedback: b.mentorNotes || prev.feedback,
          }
        : prev,
    );
    toastApiSuccess("Đã dời lịch buổi hẹn.");
    setActionModal("");
    setActionError("");
    } catch {
      setActionError("Lỗi kết nối khi dời lịch.");
      toastApiError("Lỗi kết nối khi dời lịch.");
    } finally {
      setBusyAction("");
    }
  };

  const loadAvailableSlots = async () => {
    if (!meeting?.mentorId) return;
    setLoadingSlots(true);
    setActionError("");
    try {
      const all = await loadMentorRescheduleSlotOptions(meeting.mentorId, {
        allowCurrentSlot: {
          date: meeting.scheduledDate,
          time: meeting.scheduledTime,
        },
      });
      if (all.length === 0) {
        setActionError("Không có khung giờ trống trong tương lai.");
        toastApiError("Không có khung giờ trống trong tương lai.");
      }
      setSlotOptions(all);
      if (all.length > 0) {
        setRescheduleForm((prev) => ({
          ...prev,
          newDate: all[0].date,
          newTimeSlot: all[0].slot,
        }));
      }
    } catch {
      setActionError("Lỗi kết nối khi tải lịch rảnh.");
      toastApiError("Lỗi kết nối khi tải lịch rảnh.");
    } finally {
      setLoadingSlots(false);
    }
  };

  const handleMentorCancel = async () => {
    const reason = String(cancelReason || "").trim();
    if (!reason) {
      setActionError("Bạn cần nhập lý do để hủy lịch.");
      return;
    }
    setBusyAction("cancel");
    try {
    const res = await mentorCancelBooking(meeting.id, { reason });
    if (!res.success) {
      setActionError(res.error || "Không thể hủy buổi mentor.");
      toastApiError(res.error, "Không thể hủy buổi mentor.");
      return;
    }
    setActionModal("");
    setActionError("");
    if (res.lateCancel) {
      toastApiSuccess(
        "Đã hủy buổi (< 24h). Học viên được hoàn 100% ưu tiên — cần điền STK trên trang buổi hẹn.",
      );
    } else if (res.refundPending) {
      toastApiSuccess("Đã hủy. Yêu cầu hoàn tiền đã được ghi nhận.");
    } else {
      toastApiSuccess("Đã hủy. Học viên sẽ chọn đổi lịch, đổi mentor hoặc hoàn tiền trên trang buổi hẹn.");
    }
    navigate("/mentor/schedule");
    } catch {
      setActionError("Lỗi kết nối khi hủy buổi.");
      toastApiError("Lỗi kết nối khi hủy buổi.");
    } finally {
      setBusyAction("");
    }
  };

  const openRescheduleModal = () => {
    if (!canReschedule) {
      const msg = "Bạn đã hết lượt dời lịch cho buổi hẹn này.";
      setActionError(msg);
      toastApiError(msg);
      return;
    }
    setRescheduleForm({
      newDate: meeting.scheduledDate || "",
      newTimeSlot: meeting.scheduledTime || "09:00",
      reason: "",
    });
    setActionError("");
    setActionModal("reschedule");
    loadAvailableSlots();
  };

  const openCancelModal = () => {
    setCancelReason("");
    setActionError("");
    setActionModal("cancel");
  };

  const handleCompleteSession = async () => {
    if (!meeting?.id) return;
    const schedule = {
      date: meeting.scheduledDate,
      timeSlot: meeting.scheduledTime,
      durationMinutes: meeting.duration,
    };
    if (!canMentorCompleteBooking(schedule)) {
      const mins = getMinutesUntilBookingStart(schedule);
      toastApiError(
        mins > 0
          ? `Chưa tới giờ bắt đầu (còn ${formatUntilStart(mins)}). Bạn có thể vào phòng trước nhưng chưa thể kết thúc buổi.`
          : "Chưa tới giờ bắt đầu buổi học.",
      );
      return;
    }
    if (!window.confirm("Kết thúc buổi học? Học viên sẽ có thể đánh giá sau khi hoàn thành.")) return;
    setBusyAction("complete");
    try {
      const res = await completeMentorBooking(meeting.id);
      if (res.success) {
        toastApiSuccess("Đã kết thúc buổi học.");
        setMeeting((prev) => (prev ? { ...prev, status: "completed" } : prev));
      } else {
        toastApiError(res.error, "Không thể kết thúc buổi học.");
      }
    } catch {
      toastApiError("Lỗi kết nối khi kết thúc buổi học.");
    } finally {
      setBusyAction("");
    }
  };

  return (
    <MentorPageShell bottomPad="pb-32" extraStyles={MENTOR_MEETING_DETAIL_EXTRA_CSS}>
      <div className="relative z-10 mx-auto max-w-7xl px-10 pb-10">
        {/* Header Navigation */}
        <div className="mb-16 flex items-center justify-end">
           <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  aria-label="Thao tác buổi hẹn"
                  className="flex h-12 w-12 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-zinc-500 transition-all hover:bg-slate-100 hover:text-slate-900"
                >
                  <MoreVertical size={20} />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="min-w-[220px]">
                {!isCompleted ? (
                  <>
                    <DropdownMenuItem
                      disabled={busyAction !== ""}
                      onSelect={() => navigate(`/meeting/${meeting.id}`)}
                    >
                      <Video className="size-4" />
                      Vào phòng họp ngay
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      disabled={busyAction !== ""}
                      onSelect={openRescheduleModal}
                    >
                      <Calendar className="size-4" />
                      Dời lịch hẹn
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      variant="destructive"
                      disabled={busyAction !== ""}
                      onSelect={openCancelModal}
                    >
                      <AlertCircle className="size-4" />
                      Hủy buổi mentor
                    </DropdownMenuItem>
                  </>
                ) : (
                  <>
                    <DropdownMenuItem
                      onSelect={() => navigate(`/mentor/session-feedback/${meeting.id}`)}
                    >
                      <TrendingUp className="size-4" />
                      Gửi feedback bổ sung
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onSelect={() => toastApiError("Bản ghi video chưa sẵn sàng cho buổi này.")}
                    >
                      <Layout className="size-4" />
                      Xem bản ghi video
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
           </DropdownMenu>
        </div>

        {showCompleteReminder ? (
          <div className="mb-8 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-orange-200 bg-orange-50 px-5 py-4">
            <div className="flex min-w-0 items-start gap-3">
              <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-orange-600" />
              <div>
                <p className="text-sm font-bold text-orange-900">Buổi đã qua giờ kết thúc</p>
                <p className="mt-1 text-xs leading-relaxed text-orange-800/90">
                  Hãy bấm <strong>Kết thúc buổi</strong> để học viên đánh giá và thu nhập được ghi nhận. Nếu quên, hệ thống tự hoàn thành sau 30 phút.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleCompleteSession}
              disabled={busyAction !== "" || !canCompleteSession}
              className="shrink-0 rounded-xl bg-[#93f72b] px-5 py-2.5 text-[10px] font-black uppercase tracking-widest text-slate-900 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {busyAction === "complete" ? "Đang xử lý…" : "Kết thúc buổi"}
            </button>
          </div>
        ) : null}

        <div className="grid lg:grid-cols-12 gap-10">
           {/* Main Session Content */}
           <div className="lg:col-span-8 space-y-10">
              {/* Session Core Info Card */}
              <div className="glass-card p-12 relative overflow-hidden group neon-border">
                 <div className="absolute top-0 right-0 p-12 opacity-5 scale-150 rotate-12 group-hover:rotate-0 transition-all duration-1000">
                    <Video size={180} className="text-violet-700" />
                 </div>
                 <div className="relative z-10">
                    <div className="flex items-center gap-4 mb-8">
                       <span className={`rounded-full px-4 py-1.5 text-xs font-normal ${isCompleted ? "border border-primary-fixed/20 bg-primary-fixed/20 text-violet-700" : "border border-orange-500/20 bg-orange-500/20 text-orange-600"}`}>
                          {isCompleted ? "Đã hoàn thành" : "Sắp diễn ra"}
                       </span>
                       <span className="flex items-center gap-2 text-xs font-normal text-zinc-500">
                         <Layout size={14} /> {meetingTypeLabel}
                       </span>
                    </div>
                    <h1 className="mb-6 max-w-2xl font-headline text-2xl font-black leading-tight tracking-tight text-slate-900 sm:text-3xl">
                       {isCompleted ? 'Báo cáo chi tiết buổi Mentor' : 'Sẵn sàng phỏng vấn cùng Mentee'}
                    </h1>
                    
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-10">
                       <div className="space-y-2">
                          <p className="text-xs font-normal text-zinc-500">Thời gian bắt đầu</p>
                          <p className="text-xl font-black text-slate-900 flex items-center gap-3">
                             <Clock size={20} className="text-violet-700" /> {meeting.scheduledTime}
                          </p>
                       </div>
                       <div className="space-y-2">
                          <p className="text-xs font-normal text-zinc-500">Ngày diễn ra</p>
                          <p className="text-xl font-black text-slate-900 flex items-center gap-3">
                            <Calendar size={20} className="text-violet-700" /> {formatMeetingDate(meeting.scheduledDate, meeting.scheduledTime)}
                          </p>
                       </div>
                       <div className="space-y-2">
                          <p className="text-xs font-normal text-zinc-500">Thời lượng</p>
                          <p className="text-xl font-black text-slate-900 flex items-center gap-3">
                             <ShieldCheck size={20} className="text-violet-700" /> {meeting.duration} phút
                          </p>
                       </div>
                    </div>
                 </div>
              </div>

              {/* STAR Components Analysis (Visible if completed) */}
              {isCompleted && (
                 <div className="glass-card p-12">
                    <div className="flex items-center justify-between mb-12">
                       <h4 className="text-2xl font-black text-slate-900 font-headline tracking-tight flex items-center gap-4">
                          <Target className="text-violet-700" size={24} /> Kết quả STAR Framework
                       </h4>
                       <div className="flex items-center gap-3 px-6 py-3 rounded-2xl bg-slate-50 border border-slate-200">
                          <Star className="text-[#FFD600] fill-current" size={18} />
                          <span className="text-lg font-black text-slate-900">{meeting.overallScore?.toFixed(1)}</span>
                          <span className="text-[10px] font-normal text-zinc-500 uppercase tracking-widest">/ 5.0</span>
                       </div>
                    </div>

                    <div className="space-y-10">
                       {[
                         { label: "Situation", key: "situation", color: "#8037f4", desc: "Xác định hoàn cảnh và bối cảnh cụ thể" },
                         { label: "Task", key: "task", color: "#a66ff8", desc: "Nhiệm vụ và mục tiêu cần đạt được" },
                         { label: "Action", key: "action", color: "#93f72b", desc: "Hành động thực tế đã triển khai" },
                         { label: "Result", key: "result", color: "#FF8C42", desc: "Kết quả cuối cùng và giá trị đạt được" }
                       ].map((item) => {
                         const score = meeting.starScores?.[item.key] || 0;
                         return (
                           <div key={item.key} className="group">
                              <div className="flex items-start justify-between mb-4">
                                 <div className="flex items-center gap-4">
                                    <div className="w-10 h-10 rounded-2xl flex items-center justify-center text-white font-black text-sm" style={{ background: item.color }}>{item.label[0]}</div>
                                    <div>
                                       <p className="text-sm font-black text-slate-900 tracking-tight">{item.label}</p>
                                       <p className="text-[10px] font-normal text-zinc-600 uppercase tracking-widest">{item.desc}</p>
                                    </div>
                                 </div>
                                 <span className="text-sm font-black text-slate-900">{score.toFixed(1)}/5.0</span>
                              </div>
                              <div className="h-2 bg-slate-50 rounded-full overflow-hidden">
                                 <motion.div 
                                    initial={{ width: 0 }}
                                    animate={{ width: `${(score / 5) * 100}%` }}
                                    transition={{ duration: 1.5, ease: "easeOut" }}
                                    className="h-full rounded-full" 
                                    style={{ background: item.color, boxShadow: `0 0 15px ${item.color}40` }} 
                                 />
                              </div>
                           </div>
                         );
                       })}
                    </div>
                 </div>
              )}

              {/* Luxury Minimalist Feedback & Notes */}
              <div className="space-y-10">
                <div className="relative overflow-hidden bg-white rounded-[2.5rem] p-12 shadow-[0_20px_50px_rgba(0,0,0,0.04)] border border-slate-100">
                  {/* Subtle Gradient Accent */}
                  <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-indigo-50/50 to-violet-50/30 blur-3xl -z-10" />
                  
                  <div className="mb-12">
                    <h5 className="mb-3 text-xs font-normal text-indigo-500">Báo cáo phân tích</h5>
                    <h2 className="text-xl font-black sm:text-2xl text-slate-900 tracking-tight">Đánh giá từ chuyên gia</h2>
                  </div>
                  
                  <div className="space-y-1">
                    {(() => {
                      const raw = meeting.feedback || "";
                      if (!raw) return <p className="text-sm text-slate-400 font-normal">Đang chờ cập nhật nội dung đánh giá...</p>;
                      
                      const sections = raw.split(/\n/);
                      return sections.map((line, idx) => {
                        const trimmed = line.trim();
                        if (!trimmed) return null;
                        
                        const cleanLine = trimmed.replace(/^[🎯💪🚀💡📝]\s*/, "");
                        
                        if (cleanLine.includes(":")) {
                           const [title, ...contentParts] = cleanLine.split(":");
                           const content = contentParts.join(":").trim();
                           return (
                             <div key={idx} className="group py-8 first:pt-0 last:pb-0 border-b border-slate-50 last:border-0">
                               <div className="flex items-baseline gap-6">
                                  <div className="w-1.5 h-1.5 rounded-full bg-indigo-400 group-hover:scale-150 transition-transform" />
                                  <div className="flex-1">
                                    <p className="text-[10px] font-normal text-slate-400 uppercase tracking-widest mb-3">{title}</p>
                                    <p className="text-lg font-semibold text-slate-800 leading-relaxed tracking-tight">{content}</p>
                                  </div>
                               </div>
                             </div>
                           );
                        }

                        return (
                          <div key={idx} className="py-6 first:pt-0 last:pb-0">
                            <p className="text-base font-normal text-slate-600 leading-relaxed">{cleanLine}</p>
                          </div>
                        );
                      });
                    })()}
                  </div>
                </div>

                {(() => {
                  const att = getBookingAttachments(meeting);
                  const DocRow = ({ label, name, url }) => (
                    <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-3">
                      <div className="min-w-0 flex-1">
                        <p className="text-[10px] font-normal uppercase tracking-wide text-slate-500">{label}</p>
                        <p className="truncate text-sm font-normal text-slate-800" title={name}>
                          {name || "—"}
                        </p>
                      </div>
                      {url ? (
                        <a
                          href={url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-[#a3e635] px-3.5 py-2 text-xs font-semibold text-slate-900 hover:bg-[#84cc16]"
                        >
                          Mở file <ExternalLink size={14} />
                        </a>
                      ) : name ? (
                        <span className="text-xs text-amber-700">Chưa có file trên hệ thống</span>
                      ) : null}
                    </div>
                  );
                  return (
                    <div className="glass-card p-8 sm:p-10">
                      <h5 className="mb-6 text-xs font-normal text-slate-500">Tài liệu & ghi chú học viên</h5>
                      <div className="space-y-3">
                        {att.position ? (
                          <p className="text-sm text-slate-700">
                            <span className="font-semibold text-slate-900">Vị trí ứng tuyển:</span> {att.position}
                          </p>
                        ) : null}
                        {att.note ? (
                          <p className="text-sm leading-relaxed text-slate-600">
                            <span className="font-semibold text-slate-800">Ghi chú:</span> {att.note}
                          </p>
                        ) : null}
                        <DocRow label="CV học viên" name={att.cvFileName} url={att.cvFileUrl} />
                        {att.jdFileName ? (
                          <DocRow label="JD" name={att.jdFileName} url={att.jdFileUrl} />
                        ) : (
                          <p className="text-xs text-slate-500">Không có JD kèm theo.</p>
                        )}
                        {!att.cvFileName && !att.jdFileName && !att.position && !att.note ? (
                          <p className="text-sm text-slate-500">Học viên chưa gửi tài liệu hoặc ghi chú cho buổi này.</p>
                        ) : null}
                      </div>
                    </div>
                  );
                })()}
              </div>
           </div>

           {/* Mentee Profile Sidebar */}
           <div className="lg:col-span-4 space-y-10">
              <div className="glass-card p-10">
                 <p className="mb-10 text-xs font-normal text-zinc-500">Hồ sơ mentee</p>
                 <div className="flex flex-col items-center text-center mb-10">
                    <img src={meeting.mentee.avatar} className="w-32 h-32 rounded-[40px] object-cover ring-8 ring-white/5 shadow-2xl mb-6" />
                    <h3 className="text-xl font-black sm:text-2xl text-slate-900 tracking-tighter">{meeting.mentee.name}</h3>
                    <p className="mt-2 text-sm font-normal text-violet-700">{meeting.mentee.level}</p>
                 </div>
                 
                 <div className="space-y-6 border-t border-slate-200">
                    <div className="flex items-center gap-4">
                       <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center text-zinc-500"><Briefcase size={18} /></div>
                       <div>
                          <p className="text-xs font-normal text-zinc-600">Vị trí hiện tại</p>
                          <p className="text-xs font-bold text-slate-900">{meeting.position} @ {meeting.company}</p>
                       </div>
                    </div>
                    <div className="flex items-center gap-4">
                       <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center text-zinc-500"><Star size={18} /></div>
                       <div>
                          <p className="text-xs font-normal text-zinc-600">Các buổi đã tham gia</p>
                          <p className="text-xs font-bold text-slate-900">{menteeSessionCount || 1} buổi học tập</p>
                       </div>
                    </div>
                 </div>

                 <button onClick={() => navigate("/mentor/analytics")} className="mt-10 flex w-full items-center justify-center gap-3 rounded-3xl border border-slate-200 bg-slate-50 py-4 text-sm font-normal text-slate-700 transition-all hover:bg-slate-100 hover:text-slate-900">
                    Xem toàn bộ tiến trình <ChevronRight size={14} />
                 </button>
              </div>

              {/* Action Toolbar */}
              <div className="glass-card p-10">
                 <h4 className="mb-8 text-xs font-normal text-zinc-500">Thao tác</h4>
                 <div className="space-y-4">
                    {!isCompleted ? (
                       <>
                         <button
                            onClick={() => navigate(`/meeting/${meeting.id}`)}
                            disabled={busyAction !== ""}
                            className="w-full py-5 rounded-3xl bg-primary-fixed text-black text-[10px] font-black uppercase tracking-widest shadow-[0_15px_40px_rgba(196, 255, 71,0.32)] hover:scale-105 transition-all"
                         >
                             Vào phòng họp ngay
                          </button>
                         <button
                            type="button"
                            onClick={handleCompleteSession}
                            disabled={busyAction !== "" || !canCompleteSession}
                            className="flex w-full items-center justify-center gap-2 py-5 rounded-3xl border border-[#93f72b]/40 bg-[#93f72b]/10 text-[10px] font-black uppercase tracking-widest text-[#2f4200] hover:bg-[#93f72b]/20 transition-all disabled:cursor-not-allowed disabled:opacity-50"
                         >
                            <ShieldCheck size={16} />
                            {busyAction === "complete" ? "Đang kết thúc…" : "Kết thúc buổi"}
                         </button>
                         {completeBlockedHint ? (
                           <p className="text-center text-[11px] leading-relaxed text-amber-800">{completeBlockedHint}</p>
                         ) : null}
                         <button
                            onClick={openRescheduleModal}
                            disabled={busyAction !== ""}
                            className="w-full py-5 rounded-3xl bg-slate-50 border border-slate-200 text-[10px] font-black uppercase tracking-widest hover:bg-slate-100 transition-all"
                         >
                            {busyAction === "reschedule" ? "Đang dời lịch..." : "Dời lịch hẹn"}
                          </button>
                         <button
                            onClick={openCancelModal}
                            disabled={busyAction !== ""}
                            className="w-full py-5 rounded-3xl bg-red-600/10 border border-red-500/20 text-red-500 text-[10px] font-black uppercase tracking-widest hover:bg-red-500/20 transition-all"
                         >
                            {busyAction === "cancel" ? "Đang hủy..." : "Hủy buổi mentor"}
                          </button>
                       </>
                    ) : (
                       <>
                          <button 
                            onClick={() => navigate(`/mentor/session-feedback/${meeting.id}`)}
                            className="w-full py-5 rounded-3xl bg-primary-fixed text-black text-[10px] font-black uppercase tracking-widest shadow-[0_15px_40px_rgba(196, 255, 71,0.32)] hover:scale-105 transition-all flex items-center justify-center gap-2"
                          >
                             <TrendingUp size={16} /> Gửi feedback bổ sung
                          </button>
                          <button
                            type="button"
                            onClick={() => toastApiError("Bản ghi video chưa sẵn sàng cho buổi này.")}
                            className="flex w-full items-center justify-center gap-2 rounded-3xl border border-slate-200 bg-slate-50 py-5 text-sm font-semibold text-slate-700 transition-all hover:bg-slate-100"
                          >
                             <Layout size={16} /> Xem bản ghi video
                          </button>
                       </>
                    )}
                 </div>
              </div>
           </div>
        </div>
      </div>
      <AnimatePresence>
        {actionModal === "reschedule" && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] flex items-center justify-center overflow-y-auto bg-slate-900/50 p-4 backdrop-blur-sm sm:p-6"
            onClick={() => setActionModal("")}
          >
            <motion.div
              initial={{ scale: 0.98, y: 12, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              exit={{ scale: 0.98, y: 12, opacity: 0 }}
              className="reschedule-modal-card my-6 w-full max-w-[28rem] shrink-0"
              onClick={(e) => e.stopPropagation()}
              role="dialog"
              aria-labelledby="reschedule-modal-title"
            >
              <div className="reschedule-modal-header bg-gradient-to-r from-[#630ed4] to-[#8037f4] px-5 py-5 text-white sm:px-6">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white/15">
                      <Calendar size={20} strokeWidth={2.25} />
                    </span>
                    <h2
                      id="reschedule-modal-title"
                      className="text-lg font-bold leading-snug text-white"
                    >
                      Dời lịch hẹn
                    </h2>
                  </div>
                  <button
                    type="button"
                    onClick={() => setActionModal("")}
                    className="shrink-0 rounded-lg p-1.5 text-white/80 transition-colors hover:bg-white/15 hover:text-white"
                    aria-label="Đóng"
                  >
                    <X size={18} />
                  </button>
                </div>
              </div>

              <div className="space-y-5 p-5 sm:p-6">
                <section className="rounded-xl border border-slate-200 bg-slate-50/80 p-4">
                  <p className="mb-3 text-xs font-normal text-slate-500">Lịch hiện tại</p>
                  <div className="flex items-start gap-3">
                    <img
                      src={meeting.mentee.avatar}
                      alt=""
                      className="h-11 w-11 shrink-0 rounded-xl object-cover ring-2 ring-white"
                      onError={(e) => {
                        e.currentTarget.onerror = null;
                        e.currentTarget.src = avatarSrc("");
                      }}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-slate-900">
                        {meeting.mentee.name}
                      </p>
                      <p className="mt-0.5 text-xs text-violet-700">{meetingTypeLabel}</p>
                      <div className="mt-2 flex flex-wrap items-center gap-2 text-sm font-medium text-slate-700">
                        <span className="inline-flex items-center gap-1.5">
                          <Calendar size={14} className="text-violet-600" />
                          {formatMeetingDate(meeting.scheduledDate, meeting.scheduledTime)}
                        </span>
                        <span className="text-slate-300">•</span>
                        <span className="inline-flex items-center gap-1.5">
                          <Clock size={14} className="text-violet-600" />
                          {meeting.scheduledTime}
                        </span>
                      </div>
                    </div>
                  </div>
                </section>

                {!canReschedule && (
                  <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-900">
                    Buổi hẹn này đã dời 1 lần — không thể dời thêm.
                  </p>
                )}

                <div>
                  <label htmlFor="reschedule-new-slot" className={rescheduleFieldLabel}>
                    Chọn thời gian mới <span className="text-red-500">*</span>
                  </label>
                  <AppSelect
                    id="reschedule-new-slot"
                    size="md"
                    value={`${rescheduleForm.newDate}|${rescheduleForm.newTimeSlot}`}
                    onValueChange={(v) => {
                      const [date, time] = String(v).split("|");
                      setRescheduleForm((p) => ({
                        ...p,
                        newDate: date || "",
                        newTimeSlot: time || "",
                      }));
                    }}
                    disabled={!canReschedule || loadingSlots || slotOptions.length === 0}
                    triggerClassName={rescheduleFieldInput}
                    options={
                      loadingSlots
                        ? [{ value: "|", label: "Đang tải khung giờ trống…" }]
                        : slotOptions.length === 0
                          ? [{ value: "|", label: "Không có khung giờ trống phù hợp" }]
                          : slotOptions.map((opt) => ({
                              value: `${opt.date}|${opt.time}`,
                              label: opt.label,
                            }))
                    }
                  />
                </div>

                <div>
                  <label htmlFor="reschedule-reason" className={rescheduleFieldLabel}>
                    Lý do dời lịch
                  </label>
                  <textarea
                    id="reschedule-reason"
                    value={rescheduleForm.reason}
                    onChange={(e) =>
                      setRescheduleForm((p) => ({ ...p, reason: e.target.value }))
                    }
                    placeholder="Nhập lý do (tùy chọn)"
                    rows={3}
                    disabled={!canReschedule}
                    className={`${rescheduleFieldInput} resize-none`}
                  />
                </div>

                {actionError && (
                  <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700">
                    {actionError}
                  </p>
                )}

                <div className="flex flex-col-reverse gap-3 border-t border-slate-100 pt-5 sm:flex-row sm:justify-end">
                  <button
                    type="button"
                    onClick={() => setActionModal("")}
                    className="rounded-lg border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 transition-colors hover:border-slate-300 hover:bg-slate-50"
                  >
                    Đóng
                  </button>
                  <button
                    type="button"
                    onClick={handleMentorReschedule}
                    disabled={
                      busyAction !== "" ||
                      !canReschedule ||
                      loadingSlots ||
                      slotOptions.length === 0
                    }
                    className="rounded-lg bg-primary-fixed px-5 py-2.5 text-sm font-bold text-slate-900 shadow-[0_8px_24px_rgba(196,255,71,0.35)] transition-all hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {busyAction === "reschedule" ? "Đang dời lịch…" : "Xác nhận dời lịch"}
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
        {actionModal === "cancel" && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] flex items-center justify-center overflow-y-auto bg-slate-900/50 p-4 backdrop-blur-sm sm:p-6"
            onClick={() => setActionModal("")}
          >
            <motion.div
              initial={{ scale: 0.98, y: 12, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              exit={{ scale: 0.98, y: 12, opacity: 0 }}
              className="reschedule-modal-card my-6 w-full max-w-[28rem] shrink-0"
              onClick={(e) => e.stopPropagation()}
              role="dialog"
              aria-labelledby="cancel-modal-title"
            >
              <div className="cancel-modal-header bg-gradient-to-r from-[#630ed4] to-[#8037f4] px-5 py-5 text-white sm:px-6">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white/15">
                      <AlertCircle size={20} strokeWidth={2.25} />
                    </span>
                    <h2
                      id="cancel-modal-title"
                      className="text-lg font-bold leading-snug text-white"
                    >
                      Hủy buổi mentor
                    </h2>
                  </div>
                  <button
                    type="button"
                    onClick={() => setActionModal("")}
                    className="shrink-0 rounded-lg p-1.5 text-white/80 transition-colors hover:bg-white/15 hover:text-white"
                    aria-label="Đóng"
                  >
                    <X size={18} />
                  </button>
                </div>
              </div>

              <div className="space-y-5 p-5 sm:p-6">
                <div className="rounded-xl border border-amber-200/80 bg-amber-50/90 px-4 py-3 text-xs leading-relaxed text-amber-950">
                  <p className="font-semibold text-amber-900">Chính sách hủy</p>
                  <ul className="mt-2 list-inside list-disc space-y-1 text-amber-900/90">
                    <li>
                      <span className="font-medium">Trước buổi ≥ 24h:</span> học viên chọn đổi lịch, đổi mentor hoặc hoàn 100%.
                    </li>
                    <li>
                      <span className="font-medium">Dưới 24h:</span> ưu tiên hoàn 100% (học viên điền STK).
                    </li>
                    <li>
                      <span className="font-medium">Sau giờ họp:</span> báo no-show (học viên/admin).
                    </li>
                  </ul>
                </div>

                <div>
                  <label htmlFor="cancel-reason" className={rescheduleFieldLabel}>
                    Lý do hủy <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    id="cancel-reason"
                    value={cancelReason}
                    onChange={(e) => setCancelReason(e.target.value)}
                    placeholder="Nhập lý do hủy buổi…"
                    rows={4}
                    className={`${rescheduleFieldInput} resize-none`}
                  />
                </div>

                {actionError && (
                  <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700">
                    {actionError}
                  </p>
                )}

                <div className="flex flex-col-reverse gap-3 border-t border-slate-100 pt-5 sm:flex-row sm:justify-end">
                  <button
                    type="button"
                    onClick={() => setActionModal("")}
                    className="rounded-lg border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 transition-colors hover:border-slate-300 hover:bg-slate-50"
                  >
                    Đóng
                  </button>
                  <button
                    type="button"
                    onClick={handleMentorCancel}
                    disabled={busyAction !== ""}
                    className="rounded-lg bg-red-600 px-5 py-2.5 text-sm font-bold text-white shadow-[0_8px_24px_rgba(220,38,38,0.25)] transition-all hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {busyAction === "cancel" ? "Đang hủy…" : "Xác nhận hủy"}
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </MentorPageShell>
  );
}