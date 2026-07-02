import React, { useState, useEffect, useMemo } from "react";
import { useParams, useNavigate } from "react-router";
import { motion, AnimatePresence } from "motion/react";
import {
  Calendar,
  Clock,
  Video,
  Copy,
  Check,
  Star,
  MessageSquareText as ChatText,
  FileText,
  Sparkles,
  ShieldCheck,
  ExternalLink,
  Timer,
  StickyNote as Notepad,
  CheckCircle,
  ChevronRight as CaretRight,
  Chrome as GoogleLogo,
  Trophy,
  ThumbsUp,
  AlertCircle as WarningCircle,
  Zap,
  User,
  X,
  CircleDollarSign,
  Eye,
  Target,
} from "lucide-react";
import { toastApiError, toastApiSuccess } from "../../utils/shared/apiToast.js";
import { formatVnd } from "../../utils/shared/formatVnd.js";
import { isLoggedIn } from "../../utils/auth/auth.js";
import { buildLoginPath } from "../../utils/auth/authGate.js";
import {
  cancelBooking,
  fetchBookingById,
  reportBookingNoShow,
  resolveMentorCancelBooking,
  updateBookingRefundDestination,
} from "../../api/bookingsApi.js";
import { loadMentorRescheduleSlotOptions } from "../../utils/booking/bookingRescheduleSlots.js";
import { isBookingSlotInFuture } from "../../utils/booking/bookingSchedule.js";
import { apiBookingToLocal } from "../../utils/booking/bookingMappers.js";
import {
  buildGoogleCalendarEventUrl,
  canEnterMeetingRoom,
  getMeetingProvider,
  getMinutesUntilBookingStart,
  isBookingInLiveWindow,
  MEETING_PROVIDER_LABELS,
} from "../../utils/shared/meetingLinks.js";
import { MentorCancelSessionPanel } from "./MentorCancelSessionPanel";
import {
  BRAND_LIME,
  BRAND_LIME_BORDER,
  BRAND_LIME_SOFT,
  BRAND_PURPLE,
  BRAND_PURPLE_BORDER,
  BRAND_PURPLE_HOVER,
  BRAND_PURPLE_SOFT,
  BRAND_PURPLE_SOFT_LIGHT,
} from "../../constants/brandColors";
import { getUserCancelPolicyFromHours, userCancelWarningMessage } from "../../constants/bookingPolicy";
import { UserCancelPolicyBrief } from "../../components/booking/UserCancelPolicyBrief";
import { RefundBankFields } from "../../components/booking/RefundBankFields.jsx";
import { CUSTOMER_SHELL_GUTTER, CUSTOMER_SHELL_MAX } from "../../components/layout/customerShellLayout";
import { MentorPageShell } from "../../components/mentor/MentorPageShell";
import { BANK_OTHER, effectiveBankName, refundBankValidationMessage, resolveBankFields } from "../../constants/vietnamBanks.js";

function toBookingDateFormat(input) {
  const s = String(input || "").trim();
  if (!s) return "";
  const tail = s.includes(",") ? s.split(",").pop().trim() : s;
  const parts = tail.split("/").map((p) => p.trim());
  if (parts.length === 3) return `${parts[0].padStart(2, "0")}/${parts[1].padStart(2, "0")}/${parts[2]}`;
  if (parts.length === 2) return `${parts[0].padStart(2, "0")}/${parts[1].padStart(2, "0")}`;
  return tail;
}

/* ─── Types ────────────────────────────────────────────── */

function isMongoObjectId(value) {
  return typeof value === "string" && /^[a-f\d]{24}$/i.test(value.trim());
}

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

function getPaymentMeta(paymentStatus) {
  if (paymentStatus === "refund_pending") {
    return {
      title: "Chờ hoàn tiền",
      titleClass: "text-amber-700",
      note: "Admin sẽ chuyển khoản hoàn sau khi có STK nhận hoàn của bạn.",
      noteClass: "text-amber-700",
      iconClass: "text-amber-500",
    };
  }
  if (paymentStatus === "refunded") {
    return {
      title: "Đã hoàn tiền",
      titleClass: "text-sky-600",
      note: "Khoản thanh toán đã được hoàn về ví/tài khoản theo chính sách.",
      noteClass: "text-sky-600",
      iconClass: "text-sky-500",
    };
  }
  if (paymentStatus === "paid") {
    return {
      title: "Đã thanh toán",
      titleClass: "text-gray-500",
      note: "Hoàn tiền 100% nếu mentor không tham gia đúng giờ.",
      noteClass: "text-gray-400",
      iconClass: "",
    };
  }
  return {
    title: "Chờ xử lý thanh toán",
    titleClass: "text-amber-600",
    note: "Đơn đang chờ SePay xác nhận chuyển khoản.",
    noteClass: "text-amber-600",
    iconClass: "text-amber-500",
  };
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
        return new Date(new Date().getFullYear(), m - 1, d, h, min, 0).getTime();
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
  const elapsedSinceStartSec = diff < 0 ? Math.floor(-diff / 1000) : 0;
  const days = Math.floor(totalSec / 86400);
  const hours = Math.floor((totalSec % 86400) / 3600);
  const minutes = Math.floor((totalSec % 3600) / 60);
  const seconds = totalSec % 60;
  return { days, hours, minutes, seconds, totalSec, elapsedSinceStartSec };
}

const MENTOR_INTERVIEW_TIPS = [
  {
    Icon: ChatText,
    tip: "Trả lời theo cấu trúc STAR: Tình huống → Nhiệm vụ → Hành động → Kết quả",
  },
  {
    Icon: Timer,
    tip: "Giữ mỗi câu trả lời trong 2–3 phút, đừng quá ngắn hoặc quá dài",
  },
  {
    Icon: Eye,
    tip: "Nhìn thẳng camera để tạo giao tiếp bằng mắt ảo, không nhìn màn hình",
  },
  {
    Icon: Notepad,
    tip: "Chuẩn bị sẵn giấy để ghi chú những điểm mentor nhận xét",
  },
  {
    Icon: Target,
    tip: "Hỏi mentor về những gì thực sự diễn ra trong quy trình tuyển dụng",
  },
];

function meetingPlatformLabel(meetLink) {
  const provider = getMeetingProvider(meetLink);
  return MEETING_PROVIDER_LABELS[provider] || "Phòng họp trực tuyến";
}

function sessionCalendarPayload(sessionData) {
  const platform = meetingPlatformLabel(sessionData.meetLink);
  const title = `Phỏng vấn với ${sessionData.mentorName || "mentor"}, ProInterview`;
  const details = [
    `Mã đặt lịch: ${sessionData.orderNum}`,
    `Mentor: ${sessionData.mentorName || "—"}`,
    `Nền tảng: ${platform}`,
    `Link: ${sessionData.meetLink}`,
  ].join("\n");
  return {
    title,
    date: sessionData.date,
    time: sessionData.time,
    endTime: sessionData.endTime,
    details,
    location: sessionData.meetLink,
    uid: sessionData.backendId || sessionData.sessionId,
  };
}

function SessionMeetingLinkCard({ sessionData }) {
  const platform = meetingPlatformLabel(sessionData.meetLink);
  const isJitsi = getMeetingProvider(sessionData.meetLink) === "jitsi";
  const accent = isJitsi ? BRAND_PURPLE : "#4285F4";
  const openLabel = isJitsi ? "Vào phòng" : `Mở ${platform}`;
  const googleCalUrl = buildGoogleCalendarEventUrl(sessionCalendarPayload(sessionData));

  return (
    <div className="card-premium overflow-hidden">
      <div
        className="flex items-center gap-2 border-b border-gray-100 px-5 py-4"
        style={{ background: BRAND_PURPLE_SOFT_LIGHT }}
      >
        <Video className="h-4 w-4" style={{ color: BRAND_PURPLE }} />
        <span className="text-sm font-semibold text-gray-800">Phòng họp & lịch hẹn</span>
      </div>
      <div className="min-w-0 p-5">
        <div
          className="mb-4 flex min-w-0 flex-col gap-4 rounded-2xl p-4 sm:flex-row sm:items-center"
          style={{
            background: isJitsi ? BRAND_PURPLE_SOFT_LIGHT : "rgba(66,133,244,0.05)",
            border: `1.5px solid ${isJitsi ? BRAND_PURPLE_BORDER : "rgba(66,133,244,0.2)"}`,
          }}
        >
          <div className="flex min-w-0 items-start gap-4 sm:flex-1">
            <div
              className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl"
              style={{ background: accent }}
            >
              {isJitsi ? (
                <Video className="h-6 w-6 text-white" />
              ) : (
                <GoogleLogo className="h-6 w-6 text-white" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-gray-900">{platform}</p>
              <p className="mt-0.5 break-all text-xs sm:truncate sm:font-mono" style={{ color: accent }}>
                {sessionData.meetLink}
              </p>
            </div>
          </div>
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-shrink-0">
            <a
              href={sessionData.meetLink}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-1.5 rounded-xl px-3 py-2.5 text-xs font-bold text-white transition-all hover:opacity-90 sm:py-2"
              style={{ background: accent }}
            >
              {openLabel} <ExternalLink className="h-3.5 w-3.5" />
            </a>
            <CopyBtn text={sessionData.meetLink} label="Sao chép liên kết" />
          </div>
        </div>

        {googleCalUrl ? (
          <a
            href={googleCalUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mb-3 flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white py-3 text-sm font-semibold text-slate-700 transition-colors hover:border-violet-200 hover:bg-violet-50"
          >
            <Calendar className="h-4 w-4 shrink-0" style={{ color: BRAND_PURPLE }} />
            Thêm vào Google Calendar
          </a>
        ) : null}

        <p className="flex items-center gap-1.5 text-xs text-gray-500">
          <ShieldCheck className="h-3.5 w-3.5 shrink-0" style={{ color: BRAND_PURPLE }} />
          Vào phòng đúng giờ hẹn. Email xác nhận đã được gửi.
        </p>
      </div>
    </div>
  );
}

/* ─── Main Component ───────────────────────────────────── */
export function SessionDetail() {
  const { id } = useParams();
  const navigate = useNavigate();

  /* ── Resolve session data, GET /api/bookings/:id (không dùng mock local) ── */
  const [apiBooking, setApiBooking] = useState(undefined);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    if (!id) {
      setApiBooking(null);
      setLoadError("");
      return;
    }
    if (!isLoggedIn()) {
      navigate(buildLoginPath(`/session/${id}`), { replace: true });
      return;
    }
    if (!isMongoObjectId(id)) {
      setApiBooking(null);
      setLoadError("Mã buổi hẹn không hợp lệ.");
      return;
    }
    let cancelled = false;
    setApiBooking(undefined);
    setLoadError("");
    (async () => {
      try {
        const r = await fetchBookingById(id);
        if (cancelled) return;
        if (r.success && r.booking) {
          setApiBooking(r.booking);
          setLoadError("");
        } else {
          const msg = r.error || "Không tải được buổi hẹn.";
          setApiBooking(null);
          setLoadError(msg);
          toastApiError(msg);
        }
      } catch {
        if (cancelled) return;
        const msg = "Lỗi kết nối khi tải buổi hẹn.";
        setApiBooking(null);
        setLoadError(msg);
        toastApiError(msg);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id, navigate]);

  const sessionData = useMemo(() => {
    if (apiBooking && typeof apiBooking === "object") return apiBookingToLocal(apiBooking);
    return null;
  }, [apiBooking]);

  const mongoBookingId = useMemo(() => {
    if (!sessionData) return "";
    const raw = sessionData.backendId || sessionData.sessionId;
    return isMongoObjectId(raw) ? String(raw).trim() : "";
  }, [sessionData]);

  const sessionLoading = isLoggedIn() && isMongoObjectId(id) && apiBooking === undefined;

  /* ── Countdown ── */
  const { totalSec, elapsedSinceStartSec } = useCountdown(
    sessionData?.date ?? "02/03/2026",
    sessionData?.time ?? "14:00"
  );
  const hoursLeft = totalSec / 3600;
  const needsRefundBankDetails = Boolean(
    sessionData &&
      hoursLeft >= 12 &&
      ["paid", "partial_refund"].includes(String(sessionData.paymentStatus || "").toLowerCase()),
  );

  /* ── Session state logic ── */
  const autoState = totalSec <= 0 ? "done" : totalSec <= 3600 ? "live" : "upcoming";
  const paymentMeta = getPaymentMeta(sessionData?.paymentStatus);

  const mentorActionMode = useMemo(() => {
    if (!sessionData) return null;
    const st = String(sessionData.status || "").toLowerCase();
    const res = String(sessionData.mentorCancelResolution || "");
    const byMentor = String(sessionData.cancelledBy || "") === "mentor";
    if (st === "no_show" || res === "no_show_refund") return "no_show";
    if (!byMentor) return null;
    if (st === "cancelled" && res === "awaiting_user") return "choose";
    if (st === "cancelled" && res === "late_cancel_refund") return "late_refund";
    if (st === "cancelled" && res === "change_mentor") return "change_mentor_done";
    if (st === "cancelled" && (res === "refund" || res === "reschedule")) return "resolution_done";
    if (st === "cancelled") return "cancelled_generic";
    return null;
  }, [sessionData]);

  const state = useMemo(() => {
    if (mentorActionMode) return "mentor_action";
    const st = String(sessionData?.status || "").toLowerCase();
    if (st === "completed" || st === "done") return "done";
    if (st === "no_show") return "mentor_action";
    return autoState;
  }, [mentorActionMode, sessionData?.status, autoState]);

  const meetingEntry = useMemo(() => {
    if (!apiBooking || typeof apiBooking !== "object") return { ok: false, message: "" };
    return canEnterMeetingRoom(apiBooking);
  }, [apiBooking]);

  const inLiveWindow = useMemo(() => {
    if (!apiBooking) return false;
    return isBookingInLiveWindow(apiBooking);
  }, [apiBooking]);

  const minutesUntilStart = useMemo(() => {
    if (!apiBooking) return 0;
    return getMinutesUntilBookingStart(apiBooking);
  }, [apiBooking]);

  useEffect(() => {
    if (!sessionData) return;
    if (sessionData.refundReceiveBankName) {
      const resolved = resolveBankFields(sessionData.refundReceiveBankName);
      setRefundBankSelect(resolved.select);
      setRefundCustomBankName(resolved.custom);
    }
    if (sessionData.refundReceiveAccountNumber) setRefundAccountNumber(sessionData.refundReceiveAccountNumber);
    if (sessionData.refundReceiveAccountHolder) setRefundAccountHolder(sessionData.refundReceiveAccountHolder);
  }, [sessionData?.sessionId]);

  /* ── Notes ── */
  const [notes, setNotes] = useState("");
  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelBusy, setCancelBusy] = useState(false);
  const [refundBankSelect, setRefundBankSelect] = useState("");
  const [refundCustomBankName, setRefundCustomBankName] = useState("");
  const [refundAccountNumber, setRefundAccountNumber] = useState("");
  const [refundAccountHolder, setRefundAccountHolder] = useState("");
  const [refundDestBusy, setRefundDestBusy] = useState(false);
  const getRefundBankName = () => effectiveBankName(refundBankSelect, refundCustomBankName);
  const assertRefundBankFilled = () => {
    const bankMsg = refundBankValidationMessage(refundBankSelect, refundCustomBankName);
    if (bankMsg) {
      toastApiError(bankMsg);
      return false;
    }
    const acct = String(refundAccountNumber || "").replace(/\D/g, "");
    if (acct.length < 6 || !String(refundAccountHolder || "").trim()) {
      toastApiError("Vui lòng điền số tài khoản và tên chủ tài khoản.");
      return false;
    }
    return true;
  };
  const resetRefundBankFields = () => {
    setRefundBankSelect("");
    setRefundCustomBankName("");
    setRefundAccountNumber("");
    setRefundAccountHolder("");
  };
  const handleRefundBankSelectChange = (value) => {
    setRefundBankSelect(value);
    if (value !== BANK_OTHER) setRefundCustomBankName("");
  };
  const [mentorResolutionStep, setMentorResolutionStep] = useState("");
  const [resolutionBusy, setResolutionBusy] = useState(false);
  const [reportNoShowBusy, setReportNoShowBusy] = useState(false);
  const [rescheduleDate, setRescheduleDate] = useState("");
  const [rescheduleSlot, setRescheduleSlot] = useState("");
  const [rescheduleSlotOptions, setRescheduleSlotOptions] = useState([]);
  const [loadingRescheduleSlots, setLoadingRescheduleSlots] = useState(false);
  const needsMentorCancelChoice = mentorActionMode === "choose" && Boolean(mongoBookingId && isLoggedIn());

  const needRescheduleSlots = Boolean(sessionData?.mentorId && mentorResolutionStep === "reschedule");

  useEffect(() => {
    if (!needRescheduleSlots) {
      setRescheduleSlotOptions([]);
      return;
    }
    let cancelled = false;
    setLoadingRescheduleSlots(true);
    void (async () => {
      try {
        const options = await loadMentorRescheduleSlotOptions(sessionData.mentorId);
        if (cancelled) return;
        setRescheduleSlotOptions(options);
        if (options.length > 0) {
          setRescheduleDate(options[0].date);
          setRescheduleSlot(options[0].slot);
        }
      } catch {
        if (!cancelled) toastApiError("Lỗi kết nối khi tải slot đổi lịch.");
      } finally {
        if (!cancelled) setLoadingRescheduleSlots(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [needRescheduleSlots, sessionData?.mentorId]);

  const handleResolveMentorCancel = async (choice) => {
    if (!mongoBookingId) return;
    if (choice === "change_mentor") {
      setResolutionBusy(true);
      let res;
      try {
        res = await resolveMentorCancelBooking(mongoBookingId, { choice: "change_mentor" });
      } catch {
        setResolutionBusy(false);
        toastApiError("Lỗi kết nối khi ghi nhận lựa chọn.");
        return;
      }
      setResolutionBusy(false);
      if (!res.success) {
        toastApiError(res.error, "Không ghi nhận lựa chọn.");
        return;
      }
      const credit = Number(res.rebookCreditVnd ?? res.booking?.rebookCreditVnd ?? 0);
      toastApiSuccess(
        credit > 0
          ? `Đã kích hoạt credit ${formatVnd(credit)}, chọn mentor khác, không cần CK lại nếu giá ≤ credit.`
          : "Hãy chọn mentor mới để đặt lịch.",
      );
      if (res.booking) setApiBooking(res.booking);
      try {
        sessionStorage.setItem("prointerview_rebook_from", mongoBookingId);
      } catch {
        /* ignore */
      }
      navigate(`/mentors?rebookFrom=${encodeURIComponent(mongoBookingId)}`);
      return;
    }
    if (choice === "refund") {
      const acct = String(refundAccountNumber || "").replace(/\D/g, "");
      if (!assertRefundBankFilled()) return;
      setResolutionBusy(true);
      let res;
      try {
        res = await resolveMentorCancelBooking(mongoBookingId, {
          choice: "refund",
          refundReceiveBankName: getRefundBankName(),
          refundReceiveAccountNumber: acct,
          refundReceiveAccountHolder: String(refundAccountHolder || "").trim(),
        });
      } catch {
        setResolutionBusy(false);
        toastApiError("Lỗi kết nối khi gửi yêu cầu hoàn tiền.");
        return;
      }
      setResolutionBusy(false);
      if (!res.success) {
        toastApiError(res.error, "Không gửi yêu cầu hoàn tiền.");
        return;
      }
      toastApiSuccess("Đã gửi yêu cầu hoàn 100%. Admin sẽ CK khi đối soát.");
      if (res.booking) setApiBooking(res.booking);
      setMentorResolutionStep("");
      return;
    }
    if (choice === "reschedule") {
      if (!rescheduleDate || !rescheduleSlot) {
        toastApiError("Vui lòng chọn ngày và giờ mới.");
        return;
      }
      if (!isBookingSlotInFuture(rescheduleDate, rescheduleSlot)) {
        toastApiError("Không thể chọn khung giờ đã qua. Vui lòng chọn thời gian trong tương lai.");
        return;
      }
      setResolutionBusy(true);
      let res;
      try {
        res = await resolveMentorCancelBooking(mongoBookingId, {
          choice: "reschedule",
          newDate: rescheduleDate,
          newTimeSlot: rescheduleSlot,
        });
      } catch {
        setResolutionBusy(false);
        toastApiError("Lỗi kết nối khi đổi lịch.");
        return;
      }
      setResolutionBusy(false);
      if (!res.success) {
        toastApiError(res.error, "Không đổi được lịch.");
        return;
      }
      toastApiSuccess("Đã đổi lịch, buổi hẹn được khôi phục với thời gian mới.");
      if (res.booking) setApiBooking(res.booking);
      setMentorResolutionStep("");
    }
  };

  const mentorResolution = String(sessionData?.mentorCancelResolution || "");

  const needsRefundBankForm = Boolean(
    mongoBookingId &&
      isLoggedIn() &&
      String(sessionData?.paymentStatus || "").toLowerCase() === "refund_pending" &&
      String(sessionData?.refundReceiveAccountNumber || "").replace(/\D/g, "").length < 6,
  );

  const refundBankFormTitle =
    mentorResolution === "no_show_refund"
      ? "Mentor không tham gia, hoàn 100%"
      : mentorResolution === "late_cancel_refund"
        ? "Mentor hủy gấp, hoàn 100% ưu tiên"
        : String(sessionData?.cancelledBy || "") === "mentor"
          ? "Điền STK nhận hoàn tiền"
          : "Điền STK nhận hoàn tiền";

  const canReportNoShow = Boolean(
    mongoBookingId &&
      isLoggedIn() &&
      sessionData &&
      elapsedSinceStartSec >= 15 * 60 &&
      !["cancelled", "no_show", "done", "completed"].includes(String(sessionData.status || "")) &&
      String(sessionData.paymentStatus || "").toLowerCase() === "paid",
  );

  const handleReportNoShow = async () => {
    if (!mongoBookingId) return;
    setReportNoShowBusy(true);
    try {
      const res = await reportBookingNoShow(mongoBookingId, {
        note: "Học viên báo mentor không tham gia buổi hẹn.",
      });
      if (!res.success) {
        toastApiError(res.error, "Không gửi được báo no-show.");
        return;
      }
      toastApiSuccess("Đã ghi nhận no-show. Hoàn 100%, vui lòng điền STK nếu được yêu cầu.");
      if (res.booking) setApiBooking(res.booking);
    } catch {
      toastApiError("Lỗi kết nối khi gửi báo no-show.");
    } finally {
      setReportNoShowBusy(false);
    }
  };

  const handleSubmitRefundDestination = async () => {
    if (!mongoBookingId) return;
    const acct = String(refundAccountNumber || "").replace(/\D/g, "");
    if (!assertRefundBankFilled()) return;
    setRefundDestBusy(true);
    try {
      const res = await updateBookingRefundDestination(mongoBookingId, {
        refundReceiveBankName: getRefundBankName(),
        refundReceiveAccountNumber: acct,
        refundReceiveAccountHolder: String(refundAccountHolder || "").trim(),
      });
      if (!res.success) {
        toastApiError(res.error, "Không lưu được STK nhận hoàn.");
        return;
      }
      toastApiSuccess("Đã lưu tài khoản nhận hoàn. Admin sẽ CK khi đối soát.");
      if (res.booking) setApiBooking(res.booking);
    } catch {
      toastApiError("Lỗi kết nối khi lưu STK nhận hoàn.");
    } finally {
      setRefundDestBusy(false);
    }
  };

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

  const canCancelOnServer = Boolean(
    mongoBookingId &&
      isLoggedIn() &&
      sessionData &&
      !["cancelled", "done", "no_show", "completed"].includes(String(sessionData.status || "")),
  );

  const handleConfirmCancelBooking = async () => {
    if (!mongoBookingId) return;
    if (needsRefundBankDetails) {
      if (!assertRefundBankFilled()) return;
    }
    setCancelBusy(true);
    let res;
    try {
      res = await cancelBooking(mongoBookingId, {
        reason: String(cancelReason || "").trim(),
        refundReceiveBankName: needsRefundBankDetails ? getRefundBankName() : "",
        refundReceiveAccountNumber: needsRefundBankDetails
          ? String(refundAccountNumber || "").replace(/\D/g, "")
          : "",
        refundReceiveAccountHolder: needsRefundBankDetails ? String(refundAccountHolder || "").trim() : "",
      });
    } catch {
      setCancelBusy(false);
      toastApiError("Lỗi kết nối khi hủy lịch.");
      return;
    }
    setCancelBusy(false);
    if (!res.success) {
      toastApiError(res.error, "Không hủy được lịch.");
      return;
    }
    const pol = res.cancellationPolicy;
    const refundAmt = Number(pol?.refundAmountVnd ?? 0);
    const refundPct = typeof pol?.refundPercent === "number" ? pol.refundPercent : null;
    const paid =
      sessionData?.paymentStatus === "paid" ||
      String(res.booking?.paymentStatus || "").toLowerCase() === "paid";
    let extra = "";
    if (refundAmt > 0) {
      extra = ` Yêu cầu hoàn ${formatVnd(Math.round(refundAmt))}${refundPct != null ? ` (${refundPct}%)` : ""} đã ghi nhận. Admin CK hoàn sau, bạn được báo khi xong.`;
    } else if (paid && refundPct === 0) {
      extra = " Theo chính sách, không hoàn tiền cho khoảng thời gian này.";
    } else if (pol?.ledger === "cancelled_pending_transfer") {
      extra = " Giao dịch chờ CK đã hủy, chưa thu tiền.";
    }
    toastApiSuccess(`Đã hủy lịch.${extra}`);
    setCancelModalOpen(false);
    setCancelReason("");
    resetRefundBankFields();
    navigate("/my-bookings");
  };

  if (sessionLoading) {
    return (
      <MentorPageShell bottomPad="pb-20">
        <div
          className={`relative z-10 flex min-h-[40vh] items-center justify-center pb-10 pt-8 sm:pt-10 ${CUSTOMER_SHELL_GUTTER}`}
        >
          <div className={`${CUSTOMER_SHELL_MAX} w-full text-center text-sm font-medium text-slate-500 antialiased`}>
            Đang tải thông tin buổi phỏng vấn…
          </div>
        </div>
      </MentorPageShell>
    );
  }

  if (!sessionData) {
    return (
      <MentorPageShell bottomPad="pb-20">
        <div
          className={`relative z-10 flex min-h-[40vh] flex-col items-center justify-center pb-10 pt-8 text-center sm:pt-10 ${CUSTOMER_SHELL_GUTTER}`}
        >
          <div className={`${CUSTOMER_SHELL_MAX} w-full text-slate-500 antialiased`}>
            <WarningCircle className="mx-auto mb-3 h-12 w-12 text-slate-300" />
            <p>{loadError || "Không tìm thấy thông tin buổi phỏng vấn."}</p>
            {!isLoggedIn() ? (
              <button
                type="button"
                onClick={() => navigate(buildLoginPath(id ? `/session/${id}` : "/"))}
                className="mt-4 rounded-xl bg-[#a3e635] px-4 py-2 text-sm font-medium text-slate-900 hover:bg-[#84cc16]"
              >
                Đăng nhập để xem buổi hẹn
              </button>
            ) : (
              <button
                type="button"
                onClick={() => navigate("/")}
                className="mt-4 rounded-xl bg-[#a3e635] px-4 py-2 text-sm font-medium text-slate-900 hover:bg-[#84cc16]"
              >
                Về trang chủ
              </button>
            )}
          </div>
        </div>
      </MentorPageShell>
    );
  }

  return (
    <MentorPageShell bottomPad="pb-20">
      <div className={`relative z-10 pb-10 pt-8 sm:pt-10 ${CUSTOMER_SHELL_GUTTER}`}>
        <div
          className={`${CUSTOMER_SHELL_MAX} w-full min-w-0 max-w-full antialiased selection:bg-[rgba(122,35,229,0.18)] selection:text-slate-900`}
        >
      {canReportNoShow && !mentorActionMode ? (
        <div className="mb-6 rounded-2xl border border-red-200 bg-red-50/90 p-4">
          <p className="text-sm font-bold text-red-900">Mentor không tham gia?</p>
          <p className="mt-1 text-xs text-red-900/80">
            Nếu mentor không vào buổi sau 15 phút kể từ giờ hẹn, bạn có thể báo no-show để được hoàn ưu tiên 100%.
          </p>
          <button
            type="button"
            disabled={reportNoShowBusy}
            onClick={() => void handleReportNoShow()}
            className="mt-3 rounded-xl bg-red-600 px-4 py-2 text-xs font-semibold text-white disabled:opacity-50"
          >
            {reportNoShowBusy ? "Đang gửi…" : "Báo mentor no-show"}
          </button>
        </div>
      ) : null}

      {state === "mentor_action" && sessionData ? (
        <MentorCancelSessionPanel
          sessionData={sessionData}
          mode={mentorActionMode || "cancelled_generic"}
          needsChoose={needsMentorCancelChoice}
          mentorResolutionStep={mentorResolutionStep}
          setMentorResolutionStep={setMentorResolutionStep}
          resolutionBusy={resolutionBusy}
          onResolve={(choice) => void handleResolveMentorCancel(choice)}
          rescheduleDate={rescheduleDate}
          rescheduleSlot={rescheduleSlot}
          setRescheduleDate={setRescheduleDate}
          setRescheduleSlot={setRescheduleSlot}
          rescheduleSlotOptions={rescheduleSlotOptions}
          loadingRescheduleSlots={loadingRescheduleSlots}
          refundBankSelect={refundBankSelect}
          setRefundBankSelect={setRefundBankSelect}
          refundCustomBankName={refundCustomBankName}
          setRefundCustomBankName={setRefundCustomBankName}
          refundAccountNumber={refundAccountNumber}
          setRefundAccountNumber={setRefundAccountNumber}
          refundAccountHolder={refundAccountHolder}
          setRefundAccountHolder={setRefundAccountHolder}
          refundBankFormTitle={refundBankFormTitle}
          needsRefundBankForm={needsRefundBankForm}
          refundDestBusy={refundDestBusy}
          onSubmitRefundDestination={() => void handleSubmitRefundDestination()}
          onGoRebookMentors={() => {
            try {
              sessionStorage.setItem("prointerview_rebook_from", mongoBookingId);
            } catch {
              /* ignore */
            }
            navigate(`/mentors?rebookFrom=${encodeURIComponent(mongoBookingId)}`);
          }}
        />
      ) : null}

      {/* ══════════════════════════════════════════════ */}
      {/*              STATE: UPCOMING                  */}
      {/* ══════════════════════════════════════════════ */}
      {state === "upcoming" && (
        <div className="flex min-w-0 flex-col gap-5 lg:grid lg:grid-cols-3 lg:items-start lg:gap-5">
            {/* 1 — Trạng thái xác nhận */}
            <div className="order-1 lg:col-span-3">
            <div
              className="flex flex-col gap-3 rounded-2xl border px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:gap-4"
              style={{
                background: BRAND_LIME_SOFT,
                borderColor: BRAND_LIME_BORDER,
              }}
            >
              <div className="flex min-w-0 items-center gap-3">
                <div
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl"
                  style={{ background: "rgba(128, 55, 244, 0.1)" }}
                >
                  <CheckCircle className="h-6 w-6" style={{ color: BRAND_PURPLE }} />
                </div>
                <p className="text-base font-bold text-slate-900 sm:text-[1.05rem]">
                  Buổi phỏng vấn đã được xác nhận
                </p>
              </div>
              <div className="shrink-0 sm:text-right">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Mã đặt lịch
                </p>
                <p className="text-sm font-bold text-slate-900">#{sessionData.orderNum}</p>
              </div>
            </div>
            </div>

            {/* Cột trái desktop — mobile: children tách ra flex parent (contents) */}
            <div className="max-lg:contents lg:col-span-2 lg:row-start-2 lg:space-y-5">
            <div className="order-3 lg:order-none">
            <SessionMeetingLinkCard sessionData={sessionData} />
            </div>

            <div className="order-6 lg:order-none">
            <div className="card-premium p-5">
              <div className="mb-4 flex items-center gap-2">
                <div
                  className="flex h-8 w-8 items-center justify-center rounded-lg"
                  style={{ background: BRAND_LIME_SOFT }}
                >
                  <Zap className="h-4 w-4" style={{ color: BRAND_PURPLE }} />
                </div>
                <span className="text-sm font-semibold text-gray-800">Tips từ mentor cho buổi phỏng vấn</span>
              </div>
              <div className="space-y-2.5">
                {MENTOR_INTERVIEW_TIPS.map(({ Icon, tip }) => (
                  <div
                    key={tip}
                    className="flex items-start gap-3 rounded-xl border border-slate-100 bg-slate-50/80 p-3"
                  >
                    <div
                      className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg"
                      style={{ background: "rgba(128, 55, 244, 0.08)" }}
                    >
                      <Icon className="h-3.5 w-3.5" style={{ color: BRAND_PURPLE }} />
                    </div>
                    <p className="min-w-0 text-sm leading-relaxed text-slate-600">{tip}</p>
                  </div>
                ))}
              </div>
            </div>
            </div>
            </div>

            {/* Cột phải desktop — xếp dọc độc lập, không bị kéo theo chiều cao cột trái */}
            <div className="max-lg:contents lg:col-start-3 lg:row-start-2 lg:space-y-4">
            <div className="order-4 lg:order-none">
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
                  <p className="text-xs font-semibold mt-0.5" style={{ color: "#8037f4" }}>{sessionData.mentorCompany}</p>
                </div>
              </div>
              <button
                onClick={() => navigate(`/mentors/${sessionData.mentorId}`)}
                className="w-full py-2.5 rounded-xl text-sm font-medium text-gray-600 transition-all border border-gray-200 hover:border-[#8037f4]/40 hover:text-[#8037f4]"
              >
                Xem hồ sơ mentor
              </button>
            </div>
            </div>

            <div className="order-2 lg:order-none">
            <div className="card-premium p-5">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4">Chi tiết buổi hẹn</p>
              <div className="space-y-3">
                {[
                  { icon: Calendar, label: "Ngày", value: sessionData.date },
                  { icon: Clock, label: "Thời gian", value: `${sessionData.time} – ${sessionData.endTime}` },
                  { icon: Timer, label: "Thời lượng", value: "60 phút" },
                ].map((row) => (
                  <div key={row.label} className="flex items-start gap-3">
                    <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5" style={{ background: "rgba(128, 55, 244,0.07)" }}>
                      <row.icon className="w-3.5 h-3.5" style={{ color: "#8037f4" }} />
                    </div>
                    <div>
                      <p className="text-xs text-gray-400">{row.label}</p>
                      <p className="text-sm font-medium text-gray-800">{row.value}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            </div>

            <div className="order-5 lg:order-none">
            <div className="card-premium p-5">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4">Tài liệu đã gửi mentor</p>
              <div className="space-y-2">
                {sessionData.cvFile && (
                  <div className="flex items-center gap-3 p-3 rounded-xl" style={{ background: "#F9FAFB" }}>
                    <FileText className="w-4 h-4 flex-shrink-0" style={{ color: "#8037f4" }} />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-gray-700 truncate">{sessionData.cvFile}</p>
                      <p className="text-xs text-gray-400">CV đính kèm</p>
                    </div>
                    {sessionData.cvFileUrl ? (
                      <a
                        href={sessionData.cvFileUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs font-semibold shrink-0"
                        style={{ color: "#8037f4" }}
                      >
                        Mở
                      </a>
                    ) : (
                      <Check className="w-4 h-4 flex-shrink-0" style={{ color: "#4A7A00" }} />
                    )}
                  </div>
                )}
                {sessionData.jdFile && (
                  <div className="flex items-center gap-3 p-3 rounded-xl" style={{ background: "#F9FAFB" }}>
                    <FileText className="w-4 h-4 flex-shrink-0" style={{ color: "#FF8C42" }} />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-gray-700 truncate">{sessionData.jdFile}</p>
                      <p className="text-xs text-gray-400">JD đính kèm</p>
                    </div>
                    {sessionData.jdFileUrl ? (
                      <a
                        href={sessionData.jdFileUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs font-semibold shrink-0"
                        style={{ color: "#8037f4" }}
                      >
                        Mở
                      </a>
                    ) : (
                      <Check className="w-4 h-4 flex-shrink-0" style={{ color: "#4A7A00" }} />
                    )}
                  </div>
                )}
                {!sessionData.jdFile && (
                  <p className="text-xs text-gray-400 italic">Không có JD kèm theo.</p>
                )}
              </div>
            </div>
            </div>

            <div className="order-7 lg:order-none">
            <div className="card-premium p-5">
              <div className="flex justify-between items-center mb-3">
                <span className={`text-sm font-semibold ${paymentMeta.titleClass}`}>{paymentMeta.title}</span>
                <span className="font-bold text-gray-900">{formatVnd(sessionData.price)}</span>
              </div>
              <div className="flex items-start gap-2 pt-3 border-t border-gray-100 mb-4">
                <ShieldCheck
                  className={`w-4 h-4 flex-shrink-0 mt-0.5 ${paymentMeta.iconClass}`}
                  style={paymentMeta.iconClass ? undefined : { color: "#8037f4" }}
                />
                <p className={`text-xs ${paymentMeta.noteClass}`}>{paymentMeta.note}</p>
              </div>

              {needsRefundBankForm ? (
                <div className="mb-4 rounded-2xl border border-amber-200/90 bg-amber-50/60 p-4">
                  <p className="mb-3 text-sm font-bold text-slate-900">{refundBankFormTitle}</p>
                  {Number(sessionData?.cancelRefundAmountVnd) > 0 ? (
                    <p className="mb-3 text-sm text-slate-600">
                      Hoàn dự kiến:{" "}
                      <strong className="text-slate-900">
                        {formatVnd(
                          Math.round(
                            sessionData.rebookCreditRemainderVnd ?? sessionData.cancelRefundAmountVnd,
                          ),
                        )}
                      </strong>
                    </p>
                  ) : null}
                  <RefundBankFields
                    bankSelect={refundBankSelect}
                    onBankSelectChange={handleRefundBankSelectChange}
                    customBankName={refundCustomBankName}
                    onCustomBankNameChange={setRefundCustomBankName}
                    accountNumber={refundAccountNumber}
                    onAccountNumberChange={setRefundAccountNumber}
                    accountHolder={refundAccountHolder}
                    onAccountHolderChange={setRefundAccountHolder}
                  />
                  <button
                    type="button"
                    disabled={refundDestBusy}
                    onClick={() => void handleSubmitRefundDestination()}
                    className="mt-4 w-full rounded-xl py-2.5 text-sm font-semibold text-white disabled:opacity-50"
                    style={{ background: "#8037f4" }}
                  >
                    {refundDestBusy ? "Đang lưu…" : "Lưu STK nhận hoàn"}
                  </button>
                </div>
              ) : null}

              <div className="space-y-3">
                {canCancelOnServer ? (
                  <button
                    type="button"
                    onClick={() => setCancelModalOpen(true)}
                    className="card-premium animate-fade-in flex w-full items-center justify-center gap-2 rounded-xl border border-violet-200 bg-white py-3 text-sm font-semibold text-violet-800 transition hover:border-violet-300 hover:bg-violet-50"
                  >
                    <X className="h-4 w-4" />
                    Hủy buổi phỏng vấn
                  </button>
                ) : (
                  <p className="rounded-xl border border-dashed border-gray-200 bg-gray-50 px-3 py-2 text-center text-xs text-gray-500">
                    {isLoggedIn()
                      ? "Chỉ lịch đặt trên tài khoản (từ trang cố vấn) mới hủy được tự động qua hệ thống."
                      : "Đăng nhập và mở lịch từ mục Đặt lịch để hủy online."}
                  </p>
                )}

                <UserCancelPolicyBrief variant="icons" hoursLeft={hoursLeft} />
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
        <div className="grid min-w-0 gap-5 lg:grid-cols-3">
          <div className="min-w-0 space-y-5 lg:col-span-2">
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
            {meetingEntry.ok ? (
              <div className="space-y-3">
                {!inLiveWindow && minutesUntilStart > 0 && (
                  <div className="rounded-2xl border border-violet-200 bg-violet-50 px-5 py-4 text-sm text-violet-900">
                    Còn khoảng <strong>{minutesUntilStart} phút</strong> đến giờ hẹn. Bạn có thể vào
                    thử phòng sớm, trạng thái buổi học chỉ chuyển sang &quot;đang diễn ra&quot; khi
                    đến khung giờ cho phép.
                  </div>
                )}
              <button
                type="button"
                onClick={() => navigate(`/meeting/${id}`)}
                className="w-full flex items-center justify-center gap-3 py-5 rounded-2xl text-white font-bold transition-all hover:opacity-95 active:scale-[0.98]"
                style={{
                  background: "#8037f4",
                  boxShadow: "0 8px 32px rgba(128, 55, 244, 0.35)",
                  fontSize: "1.1rem",
                }}
              >
                <Video className="w-6 h-6" />
                {inLiveWindow ? "Vào phòng phỏng vấn ngay" : "Vào thử phòng sớm"}
              </button>
              </div>
            ) : (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-800">
                {meetingEntry.message ||
                  "Chưa thể vào phòng. Buổi hẹn cần được xác nhận và thanh toán trước."}
              </div>
            )}


            <div className="flex items-center gap-3 py-2 text-sm text-gray-500">
              <div className="flex-1 h-px bg-gray-200" />
              <span>hoặc sao chép liên kết dưới đây</span>
              <div className="flex-1 h-px bg-gray-200" />
            </div>

            {/* Link copy */}
            <div
              className="flex min-w-0 items-center gap-3 rounded-2xl border p-4"
              style={{ borderColor: "rgba(66,133,244,0.25)", background: "rgba(66,133,244,0.04)" }}
            >
              <p className="min-w-0 flex-1 break-all text-sm text-gray-700 sm:truncate sm:font-mono">{sessionData.meetLink}</p>
              <CopyBtn text={sessionData.meetLink} label="Copy" />
            </div>

            {/* Notes area */}
            <div className="card-premium overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2" style={{ background: "rgba(128, 55, 244,0.03)" }}>
                <Notebook className="w-4 h-4" style={{ color: "#8037f4" }} />
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
                    style={{ background: "rgba(128, 55, 244,0.08)", color: "#8037f4" }}
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

          {/* Right col, mentor + session info */}
          <div className="min-w-0 space-y-4">
            <div className="card-premium p-5">
              <img
                src={sessionData.mentorAvatar}
                alt={sessionData.mentorName}
                className="w-16 h-16 rounded-2xl object-cover mb-3"
              />
              <p className="text-gray-900 font-bold">{sessionData.mentorName}</p>
              <p className="text-gray-500 text-xs">{sessionData.mentorTitle}</p>
              <p className="text-xs font-semibold mt-1" style={{ color: "#8037f4" }}>{sessionData.mentorCompany}</p>
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
              type="button"
              onClick={() => navigate("/")}
              className="w-full py-3 rounded-xl text-sm font-semibold border border-gray-200 text-gray-600 hover:border-[#8037f4]/40 hover:text-[#8037f4] transition-all"
            >
              Về trang chủ →
            </button>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════ */}
      {/*               STATE: DONE                     */}
      {/* ══════════════════════════════════════════════ */}
      {state === "done" && (
        <div className="grid min-w-0 gap-5 lg:grid-cols-3">
          <div className="min-w-0 space-y-5 lg:col-span-2">

            {/* Done header */}
            <div className="flex items-center gap-4 rounded-md border border-violet-200/80 bg-white p-5 shadow-sm">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-md bg-violet-100">
                <Trophy className="h-6 w-6" style={{ color: BRAND_PURPLE }} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-base font-bold text-violet-950">Buổi phỏng vấn đã hoàn thành</p>
                <p className="mt-0.5 text-sm text-violet-600">
                  {sessionData.date} · {sessionData.time} – {sessionData.endTime} · với {sessionData.mentorName}
                </p>
              </div>
            </div>

            {/* Review CTA */}
            {sessionData?.isReviewed ? (
              <div className="rounded-md border border-violet-200/80 bg-white p-8 text-center shadow-sm sm:p-10">
                <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-md bg-violet-100">
                  <CheckCircle className="h-8 w-8" style={{ color: BRAND_PURPLE }} />
                </div>
                <h3 className="mb-2 text-xl font-bold text-violet-950">Cảm ơn bạn đã đóng góp</h3>
                <p className="mx-auto mb-6 max-w-md text-sm leading-relaxed text-violet-600">
                  Đánh giá của bạn đã được gửi thành công. Những chia sẻ này giúp cộng đồng ngày càng phát triển hơn.
                </p>
                <div className="mx-auto inline-flex items-center gap-2 rounded-md border border-violet-200/80 bg-violet-50/60 px-4 py-2.5">
                  <Star className="h-4 w-4" style={{ color: BRAND_LIME }} fill="currentColor" />
                  <span className="text-xs font-bold uppercase tracking-wide text-violet-700">Đã hoàn thành đánh giá</span>
                </div>
              </div>
            ) : (
              <div className="rounded-md border border-violet-200/80 bg-white p-8 shadow-sm sm:p-10">
                <div className="flex flex-col items-center text-center">
                  <div
                    className="mb-5 flex h-14 w-14 items-center justify-center rounded-md border"
                    style={{ borderColor: BRAND_LIME_BORDER, backgroundColor: BRAND_LIME_SOFT }}
                  >
                    <Star className="h-7 w-7" style={{ color: BRAND_LIME }} fill="currentColor" />
                  </div>
                  <h3 className="mb-2 text-xl font-bold text-violet-950">Bạn thấy buổi phỏng vấn thế nào?</h3>
                  <p className="mb-8 max-w-md text-sm leading-relaxed text-violet-600">
                    Chia sẻ trải nghiệm giúp{" "}
                    <span className="font-bold" style={{ color: BRAND_PURPLE }}>
                      {sessionData.mentorName}
                    </span>{" "}
                    và cộng đồng.
                  </p>

                  <div className="mb-8 flex gap-2 sm:gap-3">
                    {[1, 2, 3, 4, 5].map((i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() =>
                          navigate(`/review/${sessionData.sessionId}`, { state: { initialRating: i } })
                        }
                        className="rounded-md p-1 transition hover:scale-105 active:scale-95"
                        aria-label={`Đánh giá ${i} sao`}
                      >
                        <Star
                          className="h-10 w-10 text-violet-200 transition-colors sm:h-11 sm:w-11"
                          onMouseEnter={(e) => {
                            e.currentTarget.style.color = BRAND_LIME;
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.color = "";
                          }}
                        />
                      </button>
                    ))}
                  </div>

                  <button
                    type="button"
                    onClick={() => navigate(`/review/${sessionData.sessionId}`)}
                    className="flex w-full items-center justify-center gap-2 rounded-md py-3.5 text-sm font-bold text-white shadow-sm transition hover:brightness-110"
                    style={{ backgroundColor: BRAND_PURPLE }}
                  >
                    Viết đánh giá ngay <CaretRight className="h-4 w-4" />
                  </button>
                  <p className="mt-4 text-xs font-medium text-violet-500">Chỉ mất 1 phút · Đánh giá của bạn rất quan trọng</p>
                </div>
              </div>
            )}

            {/* Mentor feedback */}
            <div className="rounded-md border border-violet-200/80 bg-white p-6 shadow-sm sm:p-8">
              <p className="mb-1 text-[10px] font-bold uppercase tracking-wider" style={{ color: BRAND_PURPLE }}>
                Kết quả đánh giá
              </p>
              <h2 className="mb-6 text-lg font-bold text-violet-950">Nhận xét từ chuyên gia</h2>
              <div className="space-y-1">
                {(() => {
                  const raw = sessionData.mentorNotes || "";
                  if (!raw) {
                    return (
                      <div className="rounded-md border border-dashed border-violet-200 bg-violet-50/40 py-8 text-center">
                        <p className="text-sm font-medium text-violet-600">
                          Mentor đang hoàn thiện bản đánh giá chuyên sâu cho bạn...
                        </p>
                      </div>
                    );
                  }

                  const sections = raw.split(/\n/);
                  return sections.map((line, idx) => {
                    const trimmed = line.trim();
                    if (!trimmed) return null;

                    const cleanLine = trimmed.replace(/^[🎯💪🚀💡📝]\s*/, "");

                    if (cleanLine.includes(":")) {
                      const [title, ...contentParts] = cleanLine.split(":");
                      const content = contentParts.join(":").trim();
                      return (
                        <div
                          key={idx}
                          className="border-b border-violet-100 py-4 first:pt-0 last:border-0 last:pb-0"
                        >
                          <div className="flex items-baseline gap-3">
                            <div
                              className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full"
                              style={{ backgroundColor: BRAND_PURPLE }}
                            />
                            <div className="min-w-0 flex-1">
                              <p className="mb-1 text-[10px] font-bold uppercase tracking-wide text-neutral-600">
                                {title}
                              </p>
                              <p className="text-sm font-semibold leading-relaxed text-neutral-900">{content}</p>
                            </div>
                          </div>
                        </div>
                      );
                    }

                    return (
                      <div key={idx} className="py-3 first:pt-0 last:pb-0">
                        <p className="text-sm leading-relaxed text-neutral-900">{cleanLine}</p>
                      </div>
                    );
                  });
                })()}
              </div>
            </div>

            {/* Next steps */}
            <div className="rounded-md border border-violet-200/80 bg-white p-5 shadow-sm">
              <p className="mb-4 text-sm font-semibold text-violet-950">Tiếp theo sau buổi phỏng vấn</p>
              <div className="space-y-2">
                {[
                  {
                    icon: Sparkles,
                    iconColor: BRAND_PURPLE,
                    labelColor: BRAND_PURPLE,
                    bg: BRAND_PURPLE_SOFT_LIGHT,
                    title: "Luyện tập với AI Interview",
                    desc: "Áp dụng feedback vào mock interview AI",
                    action: () => navigate("/interview"),
                    label: "Bắt đầu →",
                  },
                  {
                    icon: FileText,
                    iconColor: BRAND_PURPLE,
                    labelColor: BRAND_PURPLE,
                    bg: BRAND_PURPLE_SOFT,
                    title: "Tối ưu lại CV",
                    desc: "Phân tích CV với keyword mentor vừa đề xuất",
                    action: () => navigate("/cv-analysis"),
                    label: "Phân tích →",
                  },
                  {
                    icon: CheckCircle,
                    iconColor: BRAND_LIME,
                    labelColor: BRAND_PURPLE,
                    bg: BRAND_LIME_SOFT,
                    title: "Khóa học gợi ý",
                    desc: "Bổ sung kỹ năng sau buổi phỏng vấn với mentor",
                    action: () => navigate("/courses"),
                    label: "Khóa học →",
                  },
                ].map((item) => (
                  <div
                    key={item.title}
                    role="button"
                    tabIndex={0}
                    onClick={item.action}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") item.action();
                    }}
                    className="flex cursor-pointer items-center gap-4 rounded-md border border-violet-100 p-4 transition hover:border-violet-200 hover:bg-violet-50/40"
                  >
                    <div
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md"
                      style={{ background: item.bg }}
                    >
                      <item.icon className="h-5 w-5" style={{ color: item.iconColor }} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-violet-950">{item.title}</p>
                      <p className="text-xs text-neutral-900">{item.desc}</p>
                    </div>
                    <span className="shrink-0 text-xs font-bold" style={{ color: item.labelColor }}>
                      {item.label}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right col */}
          <div className="min-w-0 space-y-4">
            <div className="rounded-md border border-violet-200/80 bg-white p-5 shadow-sm">
              <p className="mb-4 text-xs font-bold uppercase tracking-wider text-violet-500">
                Tóm tắt buổi phỏng vấn
              </p>
              <div className="mb-4 flex items-center gap-3">
                <img
                  src={sessionData.mentorAvatar}
                  alt={sessionData.mentorName}
                  className="h-12 w-12 rounded-md object-cover"
                />
                <div>
                  <p className="text-sm font-bold text-violet-950">{sessionData.mentorName}</p>
                  <p className="text-xs text-violet-600">{sessionData.mentorTitle}</p>
                </div>
              </div>
              <div className="space-y-2.5 border-t border-violet-100 pt-3">
                {[
                  { label: "Ngày", value: sessionData.date },
                  { label: "Giờ", value: `${sessionData.time} – ${sessionData.endTime}` },
                  { label: "Thời lượng", value: "60 phút" },
                  { label: "Vị trí", value: sessionData.position },
                  { label: "Phí", value: formatVnd(sessionData.price) },
                ].map((r) => (
                  <div key={r.label} className="flex justify-between gap-3 text-sm">
                    <span className="text-violet-500">{r.label}</span>
                    <span className="max-w-[140px] text-right font-medium text-violet-900">{r.value}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-md border border-violet-200/80 bg-white p-5 shadow-sm">
              <p className="mb-3 text-xs font-bold uppercase tracking-wider text-violet-500">Trạng thái đánh giá</p>
              {sessionData.isReviewed ? (
                <div>
                  <div className="mb-2 flex items-center gap-1.5">
                    <div className="h-2 w-2 rounded-full" style={{ backgroundColor: BRAND_LIME }} />
                    <span className="text-xs font-semibold text-neutral-900">Đã đánh giá mentor</span>
                  </div>
                  <p className="text-xs text-violet-600">Cảm ơn bạn đã gửi nhận xét sau buổi phỏng vấn.</p>
                </div>
              ) : (
                <div>
                  <div className="mb-3 flex items-center gap-1.5">
                    <div className="h-2 w-2 rounded-full" style={{ backgroundColor: BRAND_PURPLE }} />
                    <span className="text-xs font-semibold" style={{ color: BRAND_PURPLE_HOVER }}>
                      Chờ đánh giá
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => navigate(`/review/${sessionData.sessionId}`)}
                    className="w-full rounded-md py-2.5 text-sm font-bold text-white transition hover:brightness-110"
                    style={{ backgroundColor: BRAND_PURPLE }}
                  >
                    Đánh giá ngay
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <AnimatePresence>
        {cancelModalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 overflow-y-auto overscroll-y-contain bg-black/40 backdrop-blur-sm"
            onClick={() => {
              if (!cancelBusy) setCancelModalOpen(false);
            }}
          >
            <div className="flex min-h-full items-center justify-center p-4 py-8">
              <motion.div
                initial={{ scale: 0.96, y: 16, opacity: 0 }}
                animate={{ scale: 1, y: 0, opacity: 1 }}
                exit={{ scale: 0.96, y: 16, opacity: 0 }}
                className="grid w-full max-w-lg max-h-[min(85dvh,calc(100vh-3rem))] grid-rows-[minmax(0,1fr)_auto] overflow-hidden rounded-3xl border border-violet-200/80 bg-white shadow-xl shadow-violet-500/10"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="min-h-0 overflow-y-auto overscroll-contain px-5 pb-2 pt-5 sm:px-6 sm:pt-6">
                  <h4 className="text-xl font-black text-slate-900">Hủy lịch phỏng vấn?</h4>
                  <p className="mt-2 text-sm leading-relaxed text-slate-600">
                    {userCancelWarningMessage(getUserCancelPolicyFromHours(hoursLeft))}
                    {String(sessionData?.paymentStatus || "").toLowerCase() !== "paid"
                      ? " Buổi chưa thanh toán sẽ được hủy, không thu phí."
                      : null}
                  </p>
                  <textarea
                    value={cancelReason}
                    onChange={(e) => setCancelReason(e.target.value)}
                    className="mt-4 min-h-[4.5rem] w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-900 outline-none focus:border-[#8037f4] focus:bg-white focus:ring-2 focus:ring-[#8037f4]/10"
                    placeholder="Lý do hủy (tuỳ chọn)"
                  />
                  {needsRefundBankDetails ? (
                    <div className="mt-4 rounded-xl border border-violet-100 bg-violet-50/40 p-4">
                      <p className="mb-3 text-sm font-semibold text-slate-900">STK nhận hoàn</p>
                      <RefundBankFields
                        bankSelect={refundBankSelect}
                        onBankSelectChange={handleRefundBankSelectChange}
                        customBankName={refundCustomBankName}
                        onCustomBankNameChange={setRefundCustomBankName}
                        accountNumber={refundAccountNumber}
                        onAccountNumberChange={setRefundAccountNumber}
                        accountHolder={refundAccountHolder}
                        onAccountHolderChange={setRefundAccountHolder}
                      />
                    </div>
                  ) : null}
                </div>
                <div className="border-t border-slate-100 bg-white px-5 py-4 sm:px-6">
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      disabled={cancelBusy}
                      onClick={() => {
                        setCancelModalOpen(false);
                        setCancelReason("");
                        resetRefundBankFields();
                      }}
                      className="rounded-xl border border-violet-200 bg-white py-3 text-xs font-bold text-violet-800 transition hover:border-violet-300 hover:bg-violet-50 disabled:opacity-50"
                    >
                      Giữ lịch
                    </button>
                    <button
                      type="button"
                      disabled={cancelBusy}
                      onClick={() => void handleConfirmCancelBooking()}
                      className="rounded-xl bg-[#8037f4] py-3 text-xs font-bold text-white shadow-sm transition hover:bg-[#630ed4] disabled:opacity-50"
                    >
                      {cancelBusy ? "Đang xử lý…" : "Xác nhận hủy"}
                    </button>
                  </div>
                </div>
              </motion.div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
        </div>
      </div>
    </MentorPageShell>
  );
}