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
  ArrowLeft,
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
import { getUserCancelPolicyFromHours, userCancelWarningMessage } from "../../constants/bookingPolicy";
import { UserCancelPolicyBrief } from "../../components/booking/UserCancelPolicyBrief";
import { RefundBankFields } from "../../components/booking/RefundBankFields.jsx";
import { CUSTOMER_SHELL_GUTTER, CUSTOMER_SHELL_MAX } from "../../components/layout/customerShellLayout";
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
      className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-xl border border-white/15 bg-white/5 hover:bg-white/10 text-slate-200 transition-all flex-shrink-0 cursor-pointer"
    >
      {copied ? <Check className="size-3.5 text-emerald-400" strokeWidth={2.5} /> : <Copy className="size-3.5 text-violet-300" strokeWidth={2} />}
      <span className={copied ? "text-emerald-300 font-bold" : ""}>{copied ? "Đã sao chép!" : label}</span>
    </button>
  );
}

function MentorAvatarSafe({ src, name, size = "size-14", textClass = "text-base" }) {
  const [err, setErr] = useState(!src);
  const initials = useMemo(() => {
    if (!name) return "M";
    const parts = name.trim().split(/\s+/);
    return parts.length >= 2
      ? (parts[parts.length - 2][0] + parts[parts.length - 1][0]).toUpperCase()
      : name.slice(0, 2).toUpperCase();
  }, [name]);

  useEffect(() => {
    setErr(!src);
  }, [src]);

  if (!src || err) {
    return (
      <div
        className={`${size} rounded-2xl bg-gradient-to-br from-violet-600 via-indigo-700 to-slate-800 flex items-center justify-center font-bold text-white ${textClass} shadow-inner border border-white/20 shrink-0`}
      >
        {initials}
      </div>
    );
  }

  return (
    <img
      src={src}
      alt=""
      onError={() => setErr(true)}
      className={`${size} rounded-2xl object-cover ring-1 ring-white/15 shrink-0`}
    />
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
  if (paymentStatus === "failed") {
    return {
      title: "Chưa thanh toán",
      titleClass: "text-rose-400",
      note: "Đơn đặt lịch đã quá hạn thanh toán chuyển khoản (15 phút). Không có khoản tiền nào bị trừ.",
      noteClass: "text-rose-300/80",
      iconClass: "text-rose-400",
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
  const accent = isJitsi ? "from-violet-600 to-indigo-600" : "from-blue-600 to-sky-600";
  const openLabel = isJitsi ? "Vào phòng phỏng vấn" : `Mở ${platform}`;
  const googleCalUrl = buildGoogleCalendarEventUrl(sessionCalendarPayload(sessionData));

  return (
    <div className="rounded-3xl border border-white/12 bg-gradient-to-b from-[#18133d]/85 via-[#130f32]/90 to-[#0e0c24]/95 shadow-[0_20px_50px_rgba(5,3,20,0.5)] backdrop-blur-2xl overflow-hidden">
      <div className="flex items-center gap-2 border-b border-white/10 px-5 py-4 bg-white/[0.03]">
        <Video className="size-4 text-violet-300" />
        <span className="text-sm font-bold text-white">Phòng họp & link phỏng vấn trực tuyến</span>
      </div>
      <div className="min-w-0 p-5 sm:p-6 space-y-4">
        <div className="flex min-w-0 flex-col gap-4 rounded-2xl border border-white/10 bg-[#0a061c]/80 p-4 sm:flex-row sm:items-center">
          <div className="flex min-w-0 items-start gap-4 sm:flex-1">
            <div className={`size-12 flex-shrink-0 flex items-center justify-center rounded-2xl bg-gradient-to-tr ${accent} shadow-lg shadow-violet-600/30`}>
              {isJitsi ? (
                <Video className="size-6 text-white" />
              ) : (
                <GoogleLogo className="size-6 text-white" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-white">{platform}</p>
              <p className="mt-0.5 break-all text-xs text-violet-300 sm:truncate sm:font-mono">
                {sessionData.meetLink}
              </p>
            </div>
          </div>
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-shrink-0">
            <a
              href={sessionData.meetLink}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-violet-400/40 border-t-white/50 bg-gradient-to-b from-violet-500/85 via-violet-600/75 to-indigo-700/85 px-4 py-2.5 text-xs font-bold text-white shadow-[0_4px_16px_rgba(124,58,237,0.45),inset_0_1px_1px_rgba(255,255,255,0.35)] backdrop-blur-md hover:brightness-110 active:scale-95 transition-all cursor-pointer"
            >
              <span>{openLabel}</span>
              <ExternalLink className="size-3.5" />
            </a>
            <CopyBtn text={sessionData.meetLink} label="Sao chép liên kết" />
          </div>
        </div>

        {googleCalUrl ? (
          <a
            href={googleCalUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/[0.04] hover:bg-white/[0.08] hover:border-violet-400/30 py-3 text-xs sm:text-sm font-bold text-slate-200 hover:text-white transition-all cursor-pointer"
          >
            <Calendar className="size-4 shrink-0 text-violet-300" />
            Thêm vào Google Calendar
          </a>
        ) : null}

        <p className="flex items-center gap-1.5 text-xs text-slate-400">
          <ShieldCheck className="size-3.5 shrink-0 text-violet-400" />
          Vào phòng đúng giờ hẹn. Email xác nhận đã được gửi tới hòm thư của bạn.
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

  const isPaymentExpired = useMemo(() => {
    if (!sessionData) return false;
    const reason = String(sessionData.cancelReason || "").toLowerCase();
    const paySt = String(sessionData.paymentStatus || "").toLowerCase();
    const by = String(sessionData.cancelledBy || "").toLowerCase();
    return (
      reason.includes("thanh toán") ||
      reason.includes("quá hạn") ||
      paySt === "failed" ||
      (by === "system" && paySt !== "paid")
    );
  }, [sessionData]);

  const state = useMemo(() => {
    if (mentorActionMode) return "mentor_action";
    const st = String(sessionData?.status || "").toLowerCase();
    if (st === "cancelled") return "cancelled";
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
      <div className={`relative min-h-screen text-slate-100 ${CUSTOMER_SHELL_GUTTER} pb-24 pt-12`}>
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute -top-40 left-1/4 h-[500px] w-[500px] rounded-full bg-violet-600/15 blur-[120px]" />
        </div>
        <div className={`relative z-10 flex min-h-[50vh] flex-col items-center justify-center ${CUSTOMER_SHELL_MAX} mx-auto text-center`}>
          <div className="size-12 rounded-2xl border border-violet-400/30 bg-violet-500/10 flex items-center justify-center animate-spin mb-4 shadow-[0_0_24px_rgba(124,58,237,0.3)]">
            <div className="size-5 rounded-full border-2 border-violet-400 border-t-transparent" />
          </div>
          <p className="text-sm font-semibold text-slate-300">Đang tải thông tin buổi phỏng vấn…</p>
        </div>
      </div>
    );
  }

  if (!sessionData) {
    return (
      <div className={`relative min-h-screen text-slate-100 ${CUSTOMER_SHELL_GUTTER} pb-24 pt-12`}>
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute -top-40 left-1/4 h-[500px] w-[500px] rounded-full bg-violet-600/15 blur-[120px]" />
        </div>
        <div className={`relative z-10 flex min-h-[50vh] flex-col items-center justify-center ${CUSTOMER_SHELL_MAX} mx-auto text-center`}>
          <div className="rounded-3xl border border-white/12 bg-gradient-to-b from-[#18133d]/85 via-[#130f32]/90 to-[#0e0c24]/95 p-8 max-w-md w-full shadow-[0_20px_50px_rgba(5,3,20,0.5)] backdrop-blur-2xl">
            <WarningCircle className="mx-auto mb-4 h-12 w-12 text-rose-400/80" />
            <p className="text-sm font-medium text-slate-300">{loadError || "Không tìm thấy thông tin buổi phỏng vấn."}</p>
            {!isLoggedIn() ? (
              <button
                type="button"
                onClick={() => navigate(buildLoginPath(id ? `/session/${id}` : "/"))}
                className="mt-6 w-full rounded-xl border border-violet-400/40 border-t-white/50 bg-gradient-to-b from-violet-500/85 via-violet-600/75 to-indigo-700/85 py-3 text-sm font-bold text-white shadow-[0_4px_20px_rgba(124,58,237,0.45)] backdrop-blur-xl hover:brightness-110 active:scale-95 transition-all cursor-pointer"
              >
                Đăng nhập để xem buổi hẹn
              </button>
            ) : (
              <button
                type="button"
                onClick={() => navigate("/")}
                className="mt-6 w-full rounded-xl border border-violet-400/40 border-t-white/50 bg-gradient-to-b from-violet-500/85 via-violet-600/75 to-indigo-700/85 py-3 text-sm font-bold text-white shadow-[0_4px_20px_rgba(124,58,237,0.45)] backdrop-blur-xl hover:brightness-110 active:scale-95 transition-all cursor-pointer"
              >
                Về trang chủ
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`relative min-h-screen text-slate-100 ${CUSTOMER_SHELL_GUTTER} pb-24 pt-6 sm:pt-10`}>
      {/* Ambient background glows */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 left-1/4 h-[550px] w-[550px] rounded-full bg-violet-600/15 blur-[130px]" />
        <div className="absolute top-1/3 -right-20 h-[450px] w-[450px] rounded-full bg-indigo-600/12 blur-[110px]" />
        <div className="absolute bottom-10 left-10 h-[400px] w-[400px] rounded-full bg-fuchsia-600/10 blur-[120px]" />
      </div>

      <div className={`relative z-10 ${CUSTOMER_SHELL_MAX} mx-auto min-w-0 max-w-full antialiased`}>
        {canReportNoShow && !mentorActionMode ? (
          <div className="mb-6 rounded-3xl border border-rose-500/30 bg-gradient-to-r from-rose-500/15 via-[#23122c]/85 to-[#160c1e]/90 p-5 shadow-[0_12px_36px_rgba(225,29,72,0.2)] backdrop-blur-2xl">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <p className="text-sm font-bold text-rose-300">Mentor không tham gia?</p>
                <p className="mt-1 text-xs text-rose-200/80">
                  Nếu mentor không vào buổi sau 15 phút kể từ giờ hẹn, bạn có thể báo no-show để được hoàn ưu tiên 100%.
                </p>
              </div>
              <button
                type="button"
                disabled={reportNoShowBusy}
                onClick={() => void handleReportNoShow()}
                className="shrink-0 rounded-xl border border-rose-400/40 border-t-white/40 bg-gradient-to-b from-rose-500/80 via-rose-600/80 to-rose-700/80 px-4 py-2.5 text-xs font-bold text-white shadow-[0_4px_16px_rgba(225,29,72,0.4)] backdrop-blur-xl hover:brightness-110 active:scale-95 disabled:opacity-50 transition-all cursor-pointer"
              >
                {reportNoShowBusy ? "Đang gửi…" : "Báo mentor no-show"}
              </button>
            </div>
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
      {/*              STATE: CANCELLED                 */}
      {/* ══════════════════════════════════════════════ */}
      {state === "cancelled" && sessionData && (
        <div className="w-full space-y-6">
          {/* 1. Header Banner - Trải dài toàn bộ chiều rộng mép trái sang mép phải */}
          <div className="rounded-3xl border border-white/10 bg-gradient-to-r from-[#1e1338]/90 via-[#160f2e]/95 to-[#0f0a22]/98 p-6 sm:p-7 shadow-[0_20px_50px_rgba(0,0,0,0.5)] backdrop-blur-2xl">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="flex items-center gap-2.5 mb-2 flex-wrap">
                  <span
                    className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
                      isPaymentExpired
                        ? "bg-amber-500/15 text-amber-300 border border-amber-500/30"
                        : "bg-rose-500/15 text-rose-300 border border-rose-500/30"
                    }`}
                  >
                    <span
                      className={`size-1.5 rounded-full ${
                        isPaymentExpired ? "bg-amber-400" : "bg-rose-400"
                      }`}
                    />
                    {isPaymentExpired ? "Quá hạn thanh toán" : "Đã hủy"}
                  </span>
                  <span className="text-xs text-slate-500">·</span>
                  <span className="text-xs text-slate-400 font-medium">Không phát sinh chi phí</span>
                </div>

                <h1 className="text-xl sm:text-2xl lg:text-3xl font-black text-white tracking-tight">
                  {isPaymentExpired
                    ? "Cuộc hẹn đã bị hủy do chưa hoàn tất thanh toán"
                    : sessionData.cancelledBy === "user"
                    ? "Cuộc hẹn đã được hủy theo yêu cầu của bạn"
                    : "Cuộc hẹn phỏng vấn đã bị hủy"}
                </h1>

                <p className="mt-2 text-xs sm:text-sm text-slate-300 leading-relaxed max-w-3xl">
                  {isPaymentExpired
                    ? "Đơn đặt lịch đã tự động đóng vì không ghi nhận chuyển khoản trong 15 phút. Khung giờ này đã được giải phóng để mở lại cho người khác và bạn chưa bị trừ bất kỳ khoản tiền nào."
                    : sessionData.cancelReason
                    ? `Lý do: ${sessionData.cancelReason}`
                    : "Cuộc hẹn này không còn hiệu lực trên hệ thống."}
                </p>
              </div>

              <div className="shrink-0 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 self-start sm:self-auto sm:text-right">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Mã đặt lịch
                </p>
                <p className="text-base font-black text-white font-mono mt-0.5">
                  #{sessionData.orderNum}
                </p>
              </div>
            </div>
          </div>

          {/* 2. Grid 2 Cột Lớn Liền Mạch (Cột Trái 2 span, Cột Phải 1 span) */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
            {/* Cột Trái: Bảng Chi Tiết Buổi Hẹn & Thao Tác (1 Card duy nhất, chia hairline) */}
            <div className="lg:col-span-2 rounded-3xl border border-white/10 bg-[#140e28]/90 shadow-[0_20px_50px_rgba(0,0,0,0.45)] backdrop-blur-2xl divide-y divide-white/[0.08] overflow-hidden">
              {/* Phần thông tin Mentor */}
              <div className="p-6 sm:p-7 flex items-center justify-between gap-4">
                <div className="flex items-center gap-4 min-w-0">
                  <MentorAvatarSafe
                    src={sessionData.mentorAvatar}
                    name={sessionData.mentorName}
                    size="size-14"
                  />
                  <div className="min-w-0">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                      Chuyên gia hướng dẫn
                    </p>
                    <p className="text-lg font-bold text-white truncate mt-0.5">
                      {sessionData.mentorName}
                    </p>
                    <p className="text-xs text-slate-400 truncate">
                      {sessionData.mentorTitle}
                      {sessionData.mentorCompany ? ` · ${sessionData.mentorCompany}` : ""}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => navigate(`/mentors/${sessionData.mentorId}`)}
                  className="shrink-0 text-xs font-bold text-slate-200 hover:text-white px-4 py-2.5 rounded-xl border border-white/12 hover:border-violet-400/40 bg-white/5 hover:bg-white/10 transition-all cursor-pointer"
                >
                  Xem hồ sơ
                </button>
              </div>

              {/* Phần thông tin lịch hẹn */}
              <div className="p-6 sm:p-7 space-y-5">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                  Thông tin lịch hẹn
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-4 gap-x-8 text-sm">
                  <div>
                    <span className="text-xs text-slate-400 block mb-1">Thời gian đã đặt</span>
                    <span className="font-semibold text-slate-200">
                      {sessionData.date} · {sessionData.time} – {sessionData.endTime}
                    </span>
                  </div>

                  <div>
                    <span className="text-xs text-slate-400 block mb-1">Thời lượng</span>
                    <span className="font-semibold text-slate-200">60 phút</span>
                  </div>

                  <div>
                    <span className="text-xs text-slate-400 block mb-1">Vị trí ứng tuyển</span>
                    <span className="font-semibold text-slate-200">
                      {sessionData.position || "—"}
                    </span>
                  </div>

                  <div>
                    <span className="text-xs text-slate-400 block mb-1">Phòng phỏng vấn trực tuyến</span>
                    <span className="font-semibold text-slate-400 flex items-center gap-1.5">
                      <span className="size-1.5 rounded-full bg-slate-500" />
                      Đã vô hiệu hóa
                    </span>
                  </div>
                </div>

                {/* Tài liệu đính kèm (nếu có) */}
                {(sessionData.cvFile || sessionData.jdFile) && (
                  <div className="pt-4 border-t border-white/[0.06] flex flex-wrap items-center gap-3">
                    <span className="text-xs text-slate-400">Tài liệu đã đính kèm:</span>
                    {sessionData.cvFile && (
                      <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl border border-white/10 bg-white/5 text-xs text-slate-300">
                        <FileText className="size-3.5 text-violet-400" />
                        <span className="max-w-[180px] truncate">{sessionData.cvFile}</span>
                        {sessionData.cvFileUrl && (
                          <a
                            href={sessionData.cvFileUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-bold text-violet-300 hover:text-violet-200 ml-1"
                          >
                            Mở
                          </a>
                        )}
                      </div>
                    )}
                    {sessionData.jdFile && (
                      <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl border border-white/10 bg-white/5 text-xs text-slate-300">
                        <FileText className="size-3.5 text-amber-400" />
                        <span className="max-w-[180px] truncate">{sessionData.jdFile}</span>
                        {sessionData.jdFileUrl && (
                          <a
                            href={sessionData.jdFileUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-bold text-violet-300 hover:text-violet-200 ml-1"
                          >
                            Mở
                          </a>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Phần hành động đặt lại lịch */}
              <div className="p-6 sm:p-7 bg-white/[0.015]">
                <div className="flex flex-col sm:flex-row gap-3">
                  <button
                    type="button"
                    onClick={() => navigate(`/booking/${sessionData.mentorId}`)}
                    className="flex-1 flex items-center justify-center gap-2.5 rounded-2xl border border-violet-400/40 border-t-white/40 bg-gradient-to-b from-violet-500/85 via-violet-600/75 to-indigo-700/85 px-6 py-3.5 text-sm font-extrabold text-white shadow-[0_4px_20px_rgba(124,58,237,0.45)] backdrop-blur-xl hover:brightness-110 active:scale-95 transition cursor-pointer"
                  >
                    <Calendar className="size-4" />
                    <span>Đặt lại lịch với {sessionData.mentorName}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => navigate("/mentors")}
                    className="flex items-center justify-center gap-2 rounded-2xl border border-white/15 bg-white/5 px-5 py-3.5 text-sm font-bold text-slate-200 hover:bg-white/10 hover:border-violet-400/40 hover:text-white active:scale-95 transition cursor-pointer"
                  >
                    <User className="size-4" />
                    <span>Tìm chuyên gia khác</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Cột Phải: Tóm tắt thanh toán & Lối tắt (1 Card duy nhất) */}
            <div className="rounded-3xl border border-white/10 bg-[#140e28]/90 shadow-[0_20px_50px_rgba(0,0,0,0.45)] backdrop-blur-2xl p-6 sm:p-7 space-y-6">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-4">
                  Chi tiết thanh toán
                </p>

                <div className="space-y-3">
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-slate-400">Giá niêm yết</span>
                    <span className="font-semibold text-slate-200">{formatVnd(sessionData.price)}</span>
                  </div>

                  <div className="flex justify-between items-center text-sm">
                    <span className="text-slate-400">Số tiền đã trừ</span>
                    <span className="font-semibold text-emerald-400">0 VNĐ</span>
                  </div>

                  <div className="pt-3 border-t border-white/10 flex justify-between items-baseline">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-300">Trạng thái</span>
                    <span className="text-xs font-extrabold px-2.5 py-1 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/30">
                      {isPaymentExpired ? "Chưa thanh toán" : paymentMeta.title}
                    </span>
                  </div>
                </div>

                <div className="mt-4 pt-4 border-t border-white/10 flex items-start gap-2.5 text-xs text-slate-400 leading-relaxed">
                  <ShieldCheck className="size-4 text-violet-400 shrink-0 mt-0.5" />
                  <span>Đơn đặt lịch đã quá hạn thanh toán 15 phút. Bạn chưa bị trừ tiền và không có khoản phí phát sinh.</span>
                </div>
              </div>

              {needsRefundBankForm ? (
                <div className="rounded-2xl border border-amber-400/25 bg-amber-500/10 p-4">
                  <p className="mb-3 text-sm font-bold text-amber-200">{refundBankFormTitle}</p>
                  {Number(sessionData?.cancelRefundAmountVnd) > 0 ? (
                    <p className="mb-3 text-sm text-slate-300">
                      Hoàn dự kiến:{" "}
                      <strong className="text-white">
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
                    className="mt-4 w-full rounded-xl border border-violet-400/40 border-t-white/40 bg-gradient-to-b from-violet-500/85 via-violet-600/75 to-indigo-700/85 py-2.5 text-xs sm:text-sm font-bold text-white shadow-[0_4px_16px_rgba(124,58,237,0.4)] backdrop-blur-xl hover:brightness-110 active:scale-95 disabled:opacity-50 transition cursor-pointer"
                  >
                    {refundDestBusy ? "Đang lưu…" : "Lưu STK nhận hoàn"}
                  </button>
                </div>
              ) : null}

              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => navigate("/my-bookings")}
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl border border-white/10 bg-white/5 hover:bg-white/10 text-xs sm:text-sm font-bold text-slate-300 hover:text-white transition-all cursor-pointer"
                >
                  <ArrowLeft className="size-4" />
                  <span>Quay lại danh sách lịch hẹn</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════ */}
      {/*              STATE: UPCOMING                  */}
      {/* ══════════════════════════════════════════════ */}
      {state === "upcoming" && (
        <div className="flex min-w-0 flex-col gap-6 lg:grid lg:grid-cols-3 lg:items-start lg:gap-6">
            {/* 1 — Trạng thái xác nhận */}
            <div className="order-1 lg:col-span-3">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4 rounded-3xl border border-emerald-500/30 bg-gradient-to-r from-emerald-500/15 via-[#1a143d]/85 to-[#120e2e]/95 p-5 sm:p-6 shadow-[0_16px_40px_rgba(5,3,20,0.4)] backdrop-blur-2xl">
                <div className="flex min-w-0 items-center gap-3.5">
                  <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-emerald-500/20 border border-emerald-400/40 text-emerald-300 shadow-[0_0_20px_rgba(16,185,129,0.3)]">
                    <CheckCircle className="size-6" />
                  </div>
                  <div>
                    <p className="text-base font-bold text-white sm:text-[1.05rem]">
                      Buổi phỏng vấn đã được xác nhận
                    </p>
                    <p className="text-xs text-slate-300 mt-0.5">Sẵn sàng tham gia theo lịch hẹn bên dưới</p>
                  </div>
                </div>
                <div className="shrink-0 sm:text-right rounded-2xl border border-white/10 bg-white/5 px-4 py-2">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Mã đặt lịch
                  </p>
                  <p className="text-sm font-black text-white">#{sessionData.orderNum}</p>
                </div>
              </div>
            </div>

            {/* Cột trái desktop — mobile: children tách ra flex parent (contents) */}
            <div className="max-lg:contents lg:col-span-2 lg:row-start-2 lg:space-y-6">
              <div className="order-3 lg:order-none">
                <SessionMeetingLinkCard sessionData={sessionData} />
              </div>

              <div className="order-6 lg:order-none">
                <div className="rounded-3xl border border-white/12 bg-gradient-to-b from-[#1c1745]/90 via-[#141035]/92 to-[#0c0824]/96 p-6 shadow-[0_20px_50px_rgba(5,3,20,0.45)] backdrop-blur-2xl">
                  <div className="mb-4 flex items-center gap-2.5">
                    <div className="flex size-8 items-center justify-center rounded-xl bg-violet-500/20 border border-violet-400/30 text-violet-300">
                      <Zap className="size-4 text-violet-300" />
                    </div>
                    <span className="text-sm font-bold text-white">Tips từ mentor cho buổi phỏng vấn</span>
                  </div>
                  <div className="space-y-3">
                    {MENTOR_INTERVIEW_TIPS.map(({ Icon, tip }) => (
                      <div
                        key={tip}
                        className="flex items-start gap-3 rounded-2xl border border-white/8 bg-white/[0.03] p-3.5 hover:border-violet-500/30 hover:bg-violet-500/[0.04] transition-all"
                      >
                        <div className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg bg-violet-500/20 text-violet-300 border border-violet-400/25">
                          <Icon className="size-3.5" />
                        </div>
                        <p className="min-w-0 text-xs sm:text-sm leading-relaxed text-slate-300">{tip}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Cột phải desktop — xếp dọc độc lập, không bị kéo theo chiều cao cột trái */}
            <div className="max-lg:contents lg:col-start-3 lg:row-start-2 lg:space-y-6">
              <div className="order-4 lg:order-none">
                <div className="rounded-3xl border border-white/12 bg-gradient-to-b from-[#18133d]/85 via-[#130f32]/90 to-[#0e0c24]/95 p-6 shadow-[0_20px_50px_rgba(5,3,20,0.45)] backdrop-blur-2xl">
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-4">Mentor của bạn</p>
                  <div className="flex items-center gap-3.5 mb-5">
                    <img
                      src={sessionData.mentorAvatar}
                      alt={sessionData.mentorName}
                      className="size-14 rounded-2xl object-cover ring-2 ring-violet-500/40 shadow-md shrink-0"
                    />
                    <div className="min-w-0">
                      <p className="text-white font-bold text-base truncate">{sessionData.mentorName}</p>
                      <p className="text-slate-400 text-xs truncate">{sessionData.mentorTitle}</p>
                      <p className="text-xs font-bold text-violet-300 mt-1 truncate">{sessionData.mentorCompany}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => navigate(`/mentors/${sessionData.mentorId}`)}
                    className="w-full py-2.5 rounded-xl text-xs font-bold text-slate-200 transition-all border border-white/15 bg-white/5 hover:bg-white/10 hover:border-violet-400/40 hover:text-white cursor-pointer"
                  >
                    Xem hồ sơ mentor
                  </button>
                </div>
              </div>

              <div className="order-2 lg:order-none">
                <div className="rounded-3xl border border-white/12 bg-gradient-to-b from-[#18133d]/85 via-[#130f32]/90 to-[#0e0c24]/95 p-6 shadow-[0_20px_50px_rgba(5,3,20,0.45)] backdrop-blur-2xl">
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-4">Chi tiết buổi hẹn</p>
                  <div className="space-y-3.5">
                    {[
                      { icon: Calendar, label: "Ngày", value: sessionData.date },
                      { icon: Clock, label: "Thời gian", value: `${sessionData.time} – ${sessionData.endTime}` },
                      { icon: Timer, label: "Thời lượng", value: "60 phút" },
                    ].map((row) => (
                      <div key={row.label} className="flex items-start gap-3">
                        <div className="size-8 rounded-xl flex items-center justify-center shrink-0 mt-0.5 bg-violet-500/15 border border-violet-400/20 text-violet-300">
                          <row.icon className="size-4" />
                        </div>
                        <div>
                          <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">{row.label}</p>
                          <p className="text-sm font-bold text-white">{row.value}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="order-5 lg:order-none">
                <div className="rounded-3xl border border-white/12 bg-gradient-to-b from-[#18133d]/85 via-[#130f32]/90 to-[#0e0c24]/95 p-6 shadow-[0_20px_50px_rgba(5,3,20,0.45)] backdrop-blur-2xl">
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-4">Tài liệu đã gửi mentor</p>
                  <div className="space-y-2.5">
                    {sessionData.cvFile && (
                      <div className="flex items-center gap-3 p-3 rounded-2xl border border-white/10 bg-white/[0.04]">
                        <FileText className="size-4 shrink-0 text-violet-300" />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold text-slate-200 truncate">{sessionData.cvFile}</p>
                          <p className="text-[10px] text-slate-400">CV đính kèm</p>
                        </div>
                        {sessionData.cvFileUrl ? (
                          <a
                            href={sessionData.cvFileUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs font-bold text-violet-300 hover:text-violet-200 shrink-0"
                          >
                            Mở
                          </a>
                        ) : (
                          <Check className="size-4 shrink-0 text-emerald-400" />
                        )}
                      </div>
                    )}
                    {sessionData.jdFile && (
                      <div className="flex items-center gap-3 p-3 rounded-2xl border border-white/10 bg-white/[0.04]">
                        <FileText className="size-4 shrink-0 text-amber-300" />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold text-slate-200 truncate">{sessionData.jdFile}</p>
                          <p className="text-[10px] text-slate-400">JD đính kèm</p>
                        </div>
                        {sessionData.jdFileUrl ? (
                          <a
                            href={sessionData.jdFileUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs font-bold text-violet-300 hover:text-violet-200 shrink-0"
                          >
                            Mở
                          </a>
                        ) : (
                          <Check className="size-4 shrink-0 text-emerald-400" />
                        )}
                      </div>
                    )}
                    {!sessionData.jdFile && (
                      <p className="text-xs text-slate-400 italic">Không có JD kèm theo.</p>
                    )}
                  </div>
                </div>
              </div>

              <div className="order-7 lg:order-none">
                <div className="rounded-3xl border border-white/12 bg-gradient-to-b from-[#18133d]/85 via-[#130f32]/90 to-[#0e0c24]/95 p-6 shadow-[0_20px_50px_rgba(5,3,20,0.45)] backdrop-blur-2xl">
                  <div className="flex justify-between items-center mb-3">
                    <span className="text-sm font-semibold text-slate-300">{paymentMeta.title}</span>
                    <span className="font-black text-white text-base">{formatVnd(sessionData.price)}</span>
                  </div>
                  <div className="flex items-start gap-2 pt-3 border-t border-white/10 mb-4">
                    <ShieldCheck className="size-4 shrink-0 mt-0.5 text-violet-400" />
                    <p className="text-xs text-slate-400 leading-relaxed">{paymentMeta.note}</p>
                  </div>

                  {needsRefundBankForm ? (
                    <div className="mb-4 rounded-2xl border border-amber-400/25 bg-amber-500/10 p-4">
                      <p className="mb-3 text-sm font-bold text-amber-200">{refundBankFormTitle}</p>
                      {Number(sessionData?.cancelRefundAmountVnd) > 0 ? (
                        <p className="mb-3 text-sm text-slate-300">
                          Hoàn dự kiến:{" "}
                          <strong className="text-white">
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
                        className="mt-4 w-full rounded-xl border border-violet-400/40 border-t-white/40 bg-gradient-to-b from-violet-500/85 via-violet-600/75 to-indigo-700/85 py-2.5 text-xs sm:text-sm font-bold text-white shadow-[0_4px_16px_rgba(124,58,237,0.4)] backdrop-blur-xl hover:brightness-110 active:scale-95 disabled:opacity-50 transition cursor-pointer"
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
                        className="flex w-full items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/5 py-3 text-xs font-bold text-slate-300 hover:border-rose-400/40 hover:bg-rose-500/10 hover:text-rose-200 transition-all cursor-pointer"
                      >
                        <X className="size-4" />
                        Hủy buổi phỏng vấn
                      </button>
                    ) : (
                      <p className="rounded-xl border border-dashed border-white/15 bg-white/[0.03] px-3 py-2 text-center text-xs text-slate-400">
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
        <div className="grid min-w-0 gap-6 lg:grid-cols-3">
          <div className="min-w-0 space-y-6 lg:col-span-2">
            {/* Live banner */}
            <div className="rounded-3xl border border-emerald-500/30 bg-gradient-to-r from-emerald-500/15 via-[#1a143d]/85 to-[#120e2e]/95 p-5 sm:p-6 flex items-center gap-4 shadow-[0_16px_40px_rgba(5,3,20,0.5)] backdrop-blur-2xl">
              <div className="relative flex size-4 items-center justify-center">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex size-3.5 rounded-full bg-emerald-400 shadow-[0_0_12px_rgba(16,185,129,0.8)]" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-white font-black text-base sm:text-lg tracking-tight">
                  Buổi phỏng vấn đang diễn ra
                </p>
                <p className="text-slate-300 text-xs sm:text-sm mt-0.5">
                  Với {sessionData.mentorName} · {sessionData.time} – {sessionData.endTime}
                </p>
              </div>
            </div>

            {/* Join button */}
            {meetingEntry.ok ? (
              <div className="space-y-3">
                {!inLiveWindow && minutesUntilStart > 0 && (
                  <div className="rounded-2xl border border-violet-400/25 bg-violet-500/10 px-5 py-4 text-xs sm:text-sm text-violet-200">
                    Còn khoảng <strong>{minutesUntilStart} phút</strong> đến giờ hẹn. Bạn có thể vào
                    thử phòng sớm, trạng thái buổi học chỉ chuyển sang &quot;đang diễn ra&quot; khi
                    đến khung giờ cho phép.
                  </div>
                )}
                <motion.button
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.98 }}
                  type="button"
                  onClick={() => navigate(`/meeting/${id}`)}
                  className="w-full flex items-center justify-center gap-3 py-4 sm:py-5 rounded-2xl border border-violet-400/40 border-t-white/50 bg-gradient-to-b from-violet-500/90 via-violet-600/80 to-indigo-700/90 text-white font-extrabold text-base sm:text-lg shadow-[0_8px_32px_rgba(124,58,237,0.5),inset_0_1px_1px_rgba(255,255,255,0.4)] backdrop-blur-xl hover:brightness-110 transition-all cursor-pointer"
                >
                  <div className="size-10 rounded-xl bg-white/20 flex items-center justify-center shrink-0 border border-white/30">
                    <Video className="size-5" />
                  </div>
                  <span>{inLiveWindow ? "Vào phòng phỏng vấn ngay" : "Vào thử phòng sớm"}</span>
                </motion.button>
              </div>
            ) : (
              <div className="rounded-2xl border border-amber-400/25 bg-amber-500/10 px-5 py-4 text-xs sm:text-sm text-amber-200">
                {meetingEntry.message ||
                  "Chưa thể vào phòng. Buổi hẹn cần được xác nhận và thanh toán trước."}
              </div>
            )}

            <div className="flex items-center gap-3 py-2 text-xs font-semibold text-slate-400">
              <div className="flex-1 h-px bg-white/10" />
              <span>hoặc sao chép liên kết dưới đây</span>
              <div className="flex-1 h-px bg-white/10" />
            </div>

            {/* Link copy */}
            <div className="flex min-w-0 items-center gap-3 rounded-2xl border border-white/12 bg-white/5 p-4 backdrop-blur-xl">
              <p className="min-w-0 flex-1 break-all text-xs sm:text-sm text-slate-300 sm:truncate sm:font-mono">{sessionData.meetLink}</p>
              <CopyBtn text={sessionData.meetLink} label="Copy" />
            </div>

            {/* Notes area */}
            <div className="rounded-3xl border border-white/12 bg-gradient-to-b from-[#1c1745]/90 via-[#141035]/92 to-[#0c0824]/96 shadow-[0_20px_50px_rgba(5,3,20,0.45)] backdrop-blur-2xl overflow-hidden">
              <div className="px-5 py-4 border-b border-white/10 flex items-center gap-2.5 bg-white/[0.02]">
                <Notebook className="size-4 text-violet-300" />
                <span className="font-bold text-white text-sm">Ghi chú trong buổi phỏng vấn</span>
              </div>
              <div className="p-5">
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full text-sm text-slate-200 resize-none focus:outline-none leading-relaxed placeholder-slate-500"
                  style={{ minHeight: "180px", background: "transparent" }}
                  placeholder="Ghi lại những điểm quan trọng, feedback của mentor, những gì cần cải thiện...&#10;&#10;Ví dụ:&#10;- Câu trả lời về system design cần bổ sung phần scalability&#10;- Nên dùng số liệu cụ thể hơn khi kể về kinh nghiệm&#10;- Mentor gợi ý học thêm về distributed systems"
                />
                <div className="flex justify-between items-center pt-3 border-t border-white/10 mt-2">
                  <p className="text-xs text-slate-400">{notes.length} ký tự</p>
                  <button
                    className="text-xs font-bold px-3.5 py-2 rounded-xl border border-violet-400/30 bg-violet-500/20 text-violet-200 hover:bg-violet-500/30 transition-all cursor-pointer"
                  >
                    Lưu ghi chú
                  </button>
                </div>
              </div>
            </div>

            {/* Quick tips live */}
            <div className="rounded-2xl p-4 flex items-start gap-3 border border-amber-400/25 bg-amber-500/10">
              <Zap className="size-4 shrink-0 mt-0.5 text-amber-300" />
              <div className="text-xs sm:text-sm text-amber-200">
                <p className="font-bold mb-1">Nhớ trong lúc phỏng vấn:</p>
                <p className="text-amber-200/90 leading-relaxed">Lắng nghe kỹ câu hỏi trước khi trả lời · Hỏi lại nếu không rõ · Ghi chú feedback để xem lại sau</p>
              </div>
            </div>
          </div>

          {/* Right col, mentor + session info */}
          <div className="min-w-0 space-y-5">
            <div className="rounded-3xl border border-white/12 bg-gradient-to-b from-[#18133d]/85 via-[#130f32]/90 to-[#0e0c24]/95 p-6 shadow-[0_20px_50px_rgba(5,3,20,0.45)] backdrop-blur-2xl">
              <img
                src={sessionData.mentorAvatar}
                alt={sessionData.mentorName}
                className="size-16 rounded-2xl object-cover mb-3.5 ring-2 ring-violet-500/40 shadow-md"
              />
              <p className="text-white font-bold text-base">{sessionData.mentorName}</p>
              <p className="text-slate-400 text-xs">{sessionData.mentorTitle}</p>
              <p className="text-xs font-bold mt-1 text-violet-300">{sessionData.mentorCompany}</p>
              <div className="mt-4 pt-4 border-t border-white/10 flex items-center gap-2 text-xs font-bold text-emerald-400">
                <div className="size-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(16,185,129,0.8)]" />
                Đang trong phòng họp
              </div>
            </div>

            <div className="rounded-3xl border border-white/12 bg-gradient-to-b from-[#18133d]/85 via-[#130f32]/90 to-[#0e0c24]/95 p-6 shadow-[0_20px_50px_rgba(5,3,20,0.45)] backdrop-blur-2xl space-y-3.5">
              {[
                { label: "Ngày", value: sessionData.date },
                { label: "Thời gian", value: `${sessionData.time} – ${sessionData.endTime}` },
                { label: "Vị trí", value: sessionData.position },
              ].map((r) => (
                <div key={r.label}>
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">{r.label}</p>
                  <p className="text-sm font-bold text-white mt-0.5">{r.value}</p>
                </div>
              ))}
            </div>

            <button
              type="button"
              onClick={() => navigate("/")}
              className="w-full py-3 rounded-xl text-xs sm:text-sm font-bold border border-white/15 bg-white/5 text-slate-300 hover:bg-white/10 hover:text-white transition-all cursor-pointer"
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
        <div className="grid min-w-0 gap-6 lg:grid-cols-3">
          <div className="min-w-0 space-y-6 lg:col-span-2">

            {/* Done header banner */}
            <motion.div
              initial={{ opacity: 0, y: -12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
              className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-3xl border border-emerald-500/30 bg-gradient-to-r from-emerald-500/15 via-[#1a143d]/85 to-[#120e2e]/95 p-5 sm:p-6 shadow-[0_16px_40px_rgba(5,3,20,0.5)] backdrop-blur-2xl relative overflow-hidden"
            >
              <div className="pointer-events-none absolute -right-10 -top-10 size-40 rounded-full bg-emerald-500/10 blur-2xl" />
              <div className="flex items-center gap-4 relative z-10">
                <div className="size-13 rounded-2xl bg-emerald-500/20 border border-emerald-400/40 text-emerald-300 flex items-center justify-center shrink-0 shadow-[0_0_24px_rgba(16,185,129,0.35)]">
                  <Trophy className="size-7" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <h2 className="text-lg sm:text-xl font-black text-white tracking-tight">
                      Buổi phỏng vấn đã hoàn thành
                    </h2>
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-extrabold uppercase tracking-wide bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
                      <CheckCircle className="size-3" />
                      Hoàn tất
                    </span>
                  </div>
                  <p className="mt-1 text-xs sm:text-sm text-slate-300/80 font-medium leading-relaxed">
                    {sessionData.date} · {sessionData.time} – {sessionData.endTime} · với <strong className="text-white font-bold">{sessionData.mentorName}</strong>
                  </p>
                </div>
              </div>
            </motion.div>

            {/* Review CTA Card */}
            {sessionData?.isReviewed ? (
              <motion.div
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.4 }}
                className="rounded-3xl border border-white/12 bg-gradient-to-b from-[#1b1540]/90 via-[#130f32]/92 to-[#0c0822]/96 p-8 sm:p-12 text-center shadow-[0_20px_50px_rgba(5,3,20,0.55)] backdrop-blur-2xl relative overflow-hidden"
              >
                <div className="pointer-events-none absolute -top-12 left-1/2 -translate-x-1/2 size-48 rounded-full bg-emerald-500/15 blur-3xl" />
                <div className="mx-auto mb-5 size-16 rounded-2xl bg-emerald-500/20 border border-emerald-400/40 text-emerald-300 flex items-center justify-center shadow-[0_0_24px_rgba(16,185,129,0.3)]">
                  <CheckCircle className="size-8" />
                </div>
                <h3 className="mb-2 text-xl sm:text-2xl font-black text-white tracking-tight">
                  Cảm ơn bạn đã gửi đánh giá
                </h3>
                <p className="mx-auto mb-6 max-w-md text-xs sm:text-sm leading-relaxed text-slate-300/80">
                  Đánh giá của bạn đã được ghi nhận thành công. Những chia sẻ thực tế này giúp cộng đồng và mentor ngày càng hoàn thiện chất lượng hơn.
                </p>
                <div className="mx-auto inline-flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/15 px-4 py-2 text-xs font-bold text-emerald-300">
                  <Star className="size-4 fill-emerald-400 text-emerald-400" />
                  <span>Đã hoàn tất đánh giá</span>
                </div>
              </motion.div>
            ) : (
              <motion.div
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.4 }}
                className="rounded-3xl border border-white/12 bg-gradient-to-b from-[#1c1745]/90 via-[#141035]/92 to-[#0c0824]/96 p-8 sm:p-12 text-center shadow-[0_20px_50px_rgba(5,3,20,0.55)] backdrop-blur-2xl relative overflow-hidden"
              >
                <div className="pointer-events-none absolute -top-12 left-1/2 -translate-x-1/2 size-56 rounded-full bg-violet-600/20 blur-3xl" />
                
                {/* Glowing Star Icon Badge */}
                <div className="mx-auto mb-5 size-16 rounded-2xl bg-gradient-to-b from-amber-400/25 to-amber-500/10 border border-amber-400/40 text-amber-300 flex items-center justify-center shadow-[0_0_30px_rgba(251,191,36,0.35)]">
                  <Star className="size-8 fill-amber-400 text-amber-400" />
                </div>

                <h3 className="mb-2 text-2xl sm:text-3xl font-black text-white tracking-tight">
                  Bạn thấy buổi phỏng vấn thế nào?
                </h3>
                <p className="mx-auto mb-8 max-w-md text-xs sm:text-sm leading-relaxed text-slate-300">
                  Chia sẻ trải nghiệm giúp <span className="font-bold text-violet-300">{sessionData.mentorName}</span> và cộng đồng ProInterview.
                </p>

                {/* Star Row with Micro-bounce & Glow */}
                <div className="mb-8 flex justify-center gap-2.5 sm:gap-3.5">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <motion.button
                      key={i}
                      whileHover={{ scale: 1.15, y: -2 }}
                      whileTap={{ scale: 0.9 }}
                      type="button"
                      onClick={() =>
                        navigate(`/review/${sessionData.sessionId}`, { state: { initialRating: i } })
                      }
                      className="group rounded-2xl p-2 sm:p-2.5 transition-all bg-white/[0.04] hover:bg-amber-400/15 border border-white/10 hover:border-amber-400/50 cursor-pointer"
                      aria-label={`Đánh giá ${i} sao`}
                    >
                      <Star
                        className="size-9 sm:size-11 text-slate-500 group-hover:text-amber-400 group-hover:fill-amber-400 transition-colors drop-shadow-[0_0_12px_rgba(251,191,36,0)] group-hover:drop-shadow-[0_0_14px_rgba(251,191,36,0.5)]"
                      />
                    </motion.button>
                  ))}
                </div>

                {/* Primary CTA Liquid Glass Button with nested icon circle */}
                <div className="flex flex-col items-center">
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    type="button"
                    onClick={() => navigate(`/review/${sessionData.sessionId}`)}
                    className="inline-flex w-full sm:w-auto items-center justify-center gap-3 rounded-2xl border border-violet-400/40 border-t-white/50 bg-gradient-to-b from-violet-500/85 via-violet-600/75 to-indigo-700/85 px-8 py-4 text-sm sm:text-base font-bold text-white shadow-[0_6px_28px_rgba(124,58,237,0.5),inset_0_1px_1px_rgba(255,255,255,0.35)] backdrop-blur-xl hover:brightness-110 transition-all cursor-pointer group"
                  >
                    <span>Viết đánh giá ngay</span>
                    <span className="size-6 rounded-full bg-white/15 flex items-center justify-center group-hover:translate-x-0.5 transition-transform">
                      <CaretRight className="size-4" />
                    </span>
                  </motion.button>
                  <p className="mt-4 text-xs font-semibold text-slate-400 flex items-center gap-1.5">
                    <Clock className="size-3.5 text-violet-400" />
                    Chỉ mất 1 phút · Đánh giá của bạn rất quan trọng
                  </p>
                </div>
              </motion.div>
            )}

            {/* Mentor feedback */}
            <div className="rounded-3xl border border-white/12 bg-gradient-to-b from-[#18133d]/85 via-[#130f32]/90 to-[#0e0c24]/95 p-6 sm:p-8 shadow-[0_20px_50px_rgba(5,3,20,0.45)] backdrop-blur-2xl">
              <p className="mb-1 text-xs font-bold uppercase tracking-wider text-violet-400 flex items-center gap-1.5">
                <Sparkles className="size-3.5" />
                Kết quả đánh giá
              </p>
              <h2 className="mb-6 text-lg sm:text-xl font-black text-white tracking-tight">
                Nhận xét từ chuyên gia
              </h2>
              <div className="space-y-3">
                {(() => {
                  const raw = sessionData.mentorNotes || "";
                  if (!raw) {
                    return (
                      <div className="rounded-2xl border border-dashed border-white/15 bg-white/[0.02] py-10 px-6 text-center">
                        <ChatText className="size-8 mx-auto text-violet-400 mb-2.5 opacity-60" />
                        <p className="text-sm font-semibold text-slate-300">
                          Mentor đang hoàn thiện bản đánh giá chuyên sâu cho bạn...
                        </p>
                        <p className="text-xs text-slate-400 mt-1">
                          Hệ thống sẽ gửi thông báo email ngay khi mentor cập nhật nhận xét và thang điểm.
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
                          className="rounded-2xl border border-white/10 bg-white/[0.03] p-4.5 sm:p-5 transition-all hover:border-violet-500/25"
                        >
                          <div className="flex items-start gap-3">
                            <div className="mt-1 size-2 rounded-full bg-violet-400 shadow-[0_0_8px_rgba(167,139,250,0.8)] shrink-0" />
                            <div className="min-w-0 flex-1">
                              <p className="mb-1 text-[11px] font-bold uppercase tracking-wider text-violet-300">
                                {title}
                              </p>
                              <p className="text-sm font-medium leading-relaxed text-slate-100">
                                {content}
                              </p>
                            </div>
                          </div>
                        </div>
                      );
                    }

                    return (
                      <div key={idx} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                        <p className="text-sm leading-relaxed text-slate-200">{cleanLine}</p>
                      </div>
                    );
                  });
                })()}
              </div>
            </div>

            {/* Next steps */}
            <div className="rounded-3xl border border-white/12 bg-gradient-to-b from-[#18133d]/85 via-[#130f32]/90 to-[#0e0c24]/95 p-6 sm:p-7 shadow-[0_20px_50px_rgba(5,3,20,0.45)] backdrop-blur-2xl">
              <p className="mb-4 text-sm sm:text-base font-bold text-white flex items-center gap-2">
                <Target className="size-4 text-violet-400" />
                Tiếp theo sau buổi phỏng vấn
              </p>
              <div className="space-y-3">
                {[
                  {
                    icon: Sparkles,
                    title: "Luyện tập với AI Interview",
                    desc: "Áp dụng feedback từ mentor vào các vòng mock interview với Pio AI.",
                    action: () => navigate("/interview"),
                    label: "Bắt đầu ngay",
                  },
                  {
                    icon: FileText,
                    title: "Tối ưu lại CV & JD",
                    desc: "Phân tích và cập nhật từ khóa chuyên môn theo góp ý của mentor.",
                    action: () => navigate("/cv-analysis"),
                    label: "Phân tích CV",
                  },
                  {
                    icon: CheckCircle,
                    title: "Khóa học nâng cao kỹ năng",
                    desc: "Bổ sung kiến thức phỏng vấn hành vi và kỹ thuật chuyên sâu.",
                    action: () => navigate("/courses"),
                    label: "Khám phá khóa học",
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
                    className="flex cursor-pointer items-center justify-between gap-4 rounded-2xl border border-white/10 bg-[#0c0822]/60 hover:bg-[#120d2e]/80 hover:border-violet-500/35 p-4 transition-all duration-200 group"
                  >
                    <div className="flex items-center gap-3.5 min-w-0">
                      <div className="size-10 rounded-xl bg-violet-500/20 border border-violet-400/30 text-violet-300 flex items-center justify-center shrink-0 shadow-[0_0_12px_rgba(124,58,237,0.2)]">
                        <item.icon className="size-5" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-white group-hover:text-violet-200 transition-colors">
                          {item.title}
                        </p>
                        <p className="text-xs text-slate-400 mt-0.5 leading-snug">
                          {item.desc}
                        </p>
                      </div>
                    </div>
                    <span className="shrink-0 text-xs font-bold text-violet-300 flex items-center gap-1 group-hover:translate-x-1 transition-transform">
                      {item.label} →
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right col */}
          <div className="min-w-0 space-y-5">
            {/* Tóm tắt buổi phỏng vấn */}
            <div className="rounded-3xl border border-white/12 bg-gradient-to-b from-[#18133d]/85 via-[#130f32]/90 to-[#0e0c24]/95 p-6 shadow-[0_20px_50px_rgba(5,3,20,0.45)] backdrop-blur-2xl">
              <p className="mb-4 text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
                <Calendar className="size-3.5 text-violet-400" />
                Tóm tắt buổi phỏng vấn
              </p>
              
              <div className="mb-4 flex items-center gap-3.5 p-3 rounded-2xl bg-white/[0.03] border border-white/8">
                <img
                  src={sessionData.mentorAvatar}
                  alt={sessionData.mentorName}
                  className="size-13 rounded-xl object-cover border border-violet-400/30 shadow-md shrink-0"
                />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-white truncate">{sessionData.mentorName}</p>
                  <p className="text-xs text-slate-300/80 truncate mt-0.5">{sessionData.mentorTitle}</p>
                  {sessionData.mentorCompany && (
                    <p className="text-xs font-semibold text-violet-300 truncate mt-0.5">{sessionData.mentorCompany}</p>
                  )}
                </div>
              </div>

              <div className="space-y-3 border-t border-white/10 pt-4 text-xs">
                {[
                  { label: "Ngày", value: sessionData.date },
                  { label: "Giờ", value: `${sessionData.time} – ${sessionData.endTime}` },
                  { label: "Thời lượng", value: "60 phút" },
                  { label: "Vị trí", value: sessionData.position },
                  { label: "Phí", value: formatVnd(sessionData.price), highlight: true },
                ].map((r) => (
                  <div key={r.label} className="flex justify-between items-center gap-3 py-1">
                    <span className="text-slate-400 font-medium">{r.label}</span>
                    <span className={`font-bold tabular-nums text-right ${r.highlight ? "text-violet-300 text-sm font-black" : "text-slate-100"}`}>
                      {r.value}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Trạng thái đánh giá */}
            <div className="rounded-3xl border border-white/12 bg-gradient-to-b from-[#18133d]/85 via-[#130f32]/90 to-[#0e0c24]/95 p-6 shadow-[0_20px_50px_rgba(5,3,20,0.45)] backdrop-blur-2xl">
              <p className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
                <Star className="size-3.5 text-amber-400" />
                Trạng thái đánh giá
              </p>
              {sessionData.isReviewed ? (
                <div>
                  <div className="mb-2 flex items-center gap-2">
                    <div className="size-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(16,185,129,0.8)]" />
                    <span className="text-xs font-bold text-emerald-300">Đã đánh giá mentor</span>
                  </div>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Cảm ơn bạn đã gửi nhận xét sau buổi phỏng vấn.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <span className="relative flex size-2.5">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-75" />
                      <span className="relative inline-flex size-2.5 rounded-full bg-amber-400" />
                    </span>
                    <span className="text-xs font-bold text-amber-300">
                      Chờ đánh giá
                    </span>
                  </div>
                  
                  {/* Liquid glass button matching reference */}
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    type="button"
                    onClick={() => navigate(`/review/${sessionData.sessionId}`)}
                    className="w-full inline-flex items-center justify-center gap-2 rounded-xl border border-violet-400/40 border-t-white/50 bg-gradient-to-b from-violet-500/85 via-violet-600/75 to-indigo-700/85 py-3 text-xs sm:text-sm font-bold text-white shadow-[0_4px_16px_rgba(124,58,237,0.45),inset_0_1px_1px_rgba(255,255,255,0.35)] backdrop-blur-xl hover:brightness-110 transition-all cursor-pointer"
                  >
                    <Star className="size-4 fill-amber-300 text-amber-300" />
                    <span>Đánh giá ngay</span>
                  </motion.button>
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
            className="fixed inset-0 z-50 overflow-y-auto overscroll-y-contain bg-black/75 backdrop-blur-md"
            onClick={() => {
              if (!cancelBusy) setCancelModalOpen(false);
            }}
          >
            <div className="flex min-h-full items-center justify-center p-4 py-8">
              <motion.div
                initial={{ scale: 0.96, y: 16, opacity: 0 }}
                animate={{ scale: 1, y: 0, opacity: 1 }}
                exit={{ scale: 0.96, y: 16, opacity: 0 }}
                className="grid w-full max-w-lg max-h-[min(85dvh,calc(100vh-3rem))] grid-rows-[minmax(0,1fr)_auto] overflow-hidden rounded-3xl border border-white/15 bg-gradient-to-b from-[#1c1745] via-[#141033] to-[#0d0922] shadow-[0_25px_70px_rgba(0,0,0,0.85)] text-slate-100 backdrop-blur-2xl"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="min-h-0 overflow-y-auto overscroll-contain px-5 pb-4 pt-6 sm:px-6">
                  <h4 className="text-xl font-black text-white tracking-tight">Hủy lịch phỏng vấn?</h4>
                  <p className="mt-2 text-sm leading-relaxed text-slate-300">
                    {userCancelWarningMessage(getUserCancelPolicyFromHours(hoursLeft))}
                    {String(sessionData?.paymentStatus || "").toLowerCase() !== "paid"
                      ? " Buổi chưa thanh toán sẽ được hủy, không thu phí."
                      : null}
                  </p>
                  <textarea
                    value={cancelReason}
                    onChange={(e) => setCancelReason(e.target.value)}
                    className="mt-4 min-h-[4.5rem] w-full rounded-xl border border-white/15 bg-white/5 p-3 text-sm text-slate-100 placeholder-slate-500 outline-none focus:border-violet-400 focus:bg-white/10 transition-colors"
                    placeholder="Lý do hủy (tuỳ chọn)"
                  />
                  {needsRefundBankDetails ? (
                    <div className="mt-4 rounded-2xl border border-violet-400/20 bg-violet-500/10 p-4">
                      <p className="mb-3 text-sm font-bold text-violet-200">STK nhận hoàn</p>
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
                <div className="border-t border-white/10 bg-white/[0.02] px-5 py-4 sm:px-6">
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      disabled={cancelBusy}
                      onClick={() => {
                        setCancelModalOpen(false);
                        setCancelReason("");
                        resetRefundBankFields();
                      }}
                      className="rounded-xl border border-white/15 bg-white/5 py-3 text-xs font-bold text-slate-300 hover:bg-white/10 hover:text-white transition disabled:opacity-50 cursor-pointer"
                    >
                      Giữ lịch
                    </button>
                    <button
                      type="button"
                      disabled={cancelBusy}
                      onClick={() => void handleConfirmCancelBooking()}
                      className="rounded-xl border border-rose-400/40 border-t-white/40 bg-gradient-to-b from-rose-500/85 via-rose-600/80 to-rose-700/85 py-3 text-xs font-bold text-white shadow-[0_4px_16px_rgba(225,29,72,0.4)] backdrop-blur-xl hover:brightness-110 active:scale-95 transition disabled:opacity-50 cursor-pointer"
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
  );
}