import { AlertCircle, CheckCircle, Clock, XCircle } from "lucide-react";
import { labelPaymentStatus } from "../../utils/admin/adminPaymentUi.js";

const PILL =
  "inline-flex w-fit max-w-full items-center justify-center gap-1.5 whitespace-nowrap rounded-full border px-3 py-1.5 text-xs font-bold leading-none admin-shimmer-badge transition-all duration-300 hover:scale-105 cursor-default";

function StatusRow({ caption, children }) {
  return (
    <div className="flex w-full flex-col items-center gap-1">
      <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">{caption}</p>
      {children}
    </div>
  );
}

/** Một badge trạng thái, dùng xếp dọc, không gom chung một khối. */
export function StatusPill({ icon: Icon, label, toneClass }) {
  return (
    <span className={`${PILL} ${toneClass}`}>
      {Icon ? <Icon size={12} className="shrink-0 opacity-90" aria-hidden /> : null}
      {label}
    </span>
  );
}

const BOOKING_TONES = {
  pending: { Icon: Clock, label: "Chờ duyệt buổi", tone: "border-amber-500/30 bg-amber-500/10 text-amber-400" },
  confirmed: { Icon: CheckCircle, label: "Đã duyệt buổi", tone: "border-cyan-500/30 bg-cyan-500/10 text-cyan-400" },
  paid: { Icon: CheckCircle, label: "Đã duyệt buổi", tone: "border-cyan-500/30 bg-cyan-500/10 text-cyan-400" },
  cancelled: { Icon: XCircle, label: "Đã hủy", tone: "border-rose-500/30 bg-rose-500/10 text-rose-400" },
  in_progress: { Icon: AlertCircle, label: "Đang diễn ra", tone: "border-sky-500/30 bg-sky-500/10 text-sky-400" },
  completed: { Icon: CheckCircle, label: "Hoàn thành", tone: "border-emerald-500/30 bg-emerald-500/10 text-emerald-400" },
  no_show: { Icon: XCircle, label: "Không tham gia", tone: "border-rose-500/30 bg-rose-500/15 text-rose-400" },
};

const PAYMENT_TONES = {
  pending: { Icon: Clock, label: "Chờ đối soát", tone: "border-violet-500/30 bg-violet-500/10 text-violet-400" },
  paid: { Icon: CheckCircle, label: "Đã thanh toán", tone: "border-emerald-500/30 bg-emerald-500/10 text-emerald-400" },
  refund_pending: { Icon: Clock, label: "Chờ hoàn tiền", tone: "border-sky-500/30 bg-sky-500/10 text-sky-400" },
  refunded: { Icon: CheckCircle, label: "Đã hoàn tiền", tone: "border-white/10 bg-white/5 text-slate-300" },
  partial_refund: { Icon: AlertCircle, label: "Hoàn một phần", tone: "border-indigo-500/30 bg-indigo-500/10 text-indigo-400" },
};

export function BookingStatusPill({ status }) {
  const key = String(status || "").toLowerCase();
  const cfg = BOOKING_TONES[key] || {
    Icon: AlertCircle,
    label: status || "—",
    tone: "border-slate-200 bg-slate-100 text-slate-600",
  };
  return <StatusPill icon={cfg.Icon} label={cfg.label} toneClass={cfg.tone} />;
}

export function PaymentStatusPill({ status }) {
  const key = String(status || "").toLowerCase();
  const cfg = PAYMENT_TONES[key] || {
    Icon: AlertCircle,
    label: labelPaymentStatus(key),
    tone: "border-slate-200 bg-slate-50 text-slate-600",
  };
  return <StatusPill icon={cfg.Icon} label={cfg.label} toneClass={cfg.tone} />;
}

/**
 * Cột trạng thái lịch hẹn: 2 dòng độc lập
 * - Buổi hẹn (admin/mentor duyệt lịch)
 * - Thanh toán (SePay đối soát tiền CK)
 */
export function AdminBookingStatusStack({
  bookingStatus,
  paymentStatus,
  paymentMethod = "transfer",
  mentorCancelResolution = "",
}) {
  const showPayment = paymentMethod === "transfer" && paymentStatus;
  const extra =
    String(mentorCancelResolution || "") === "awaiting_user" ? (
      <StatusRow caption="Hủy / đổi lịch">
        <StatusPill
          icon={Clock}
          label="Chờ học viên chọn"
          toneClass="border-violet-200 bg-violet-50 text-violet-700"
        />
      </StatusRow>
    ) : null;

  return (
    <div className="mx-auto flex min-w-[10.5rem] flex-col items-center gap-2.5 py-0.5">
      <StatusRow caption="Buổi hẹn">
        <BookingStatusPill status={bookingStatus} />
      </StatusRow>
      {showPayment ? (
        <StatusRow caption="Thanh toán">
          <PaymentStatusPill status={paymentStatus} />
        </StatusRow>
      ) : null}
      {extra}
    </div>
  );
}
