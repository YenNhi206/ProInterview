import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router";
import { motion } from "motion/react";
import {
  Calendar,
  ExternalLink,
  FileText,
  Mail,
  Phone,
  ShieldCheck,
  User,
  Users,
} from "lucide-react";
import { adminGlassTable, adminPageWrap } from "../../components/admin/AdminPageShell.jsx";
import { AdminBookingStatusStack } from "../../components/admin/AdminStatusPill.jsx";
import { AdminSepayOverrideAction } from "../../components/admin/AdminSepayOverrideAction.jsx";
import { AdminMentorCheckInPanel } from "../../components/admin/AdminMentorCheckInPanel.jsx";
import { adminApi } from "../../api/adminApi.js";
import { formatTransferConfirmedAt } from "../../utils/admin/adminPaymentUi.js";
import { tryApi } from "../../utils/shared/apiToast.js";
import { parseBookingNotes } from "../../utils/booking/bookingMappers.js";
import { avatarSrc, resolveMediaUrl } from "../../utils/shared/mediaUrl.js";
import { formatVnd as formatVndAmount } from "../../utils/shared/formatVnd.js";

const SESSION_TYPE_VI = {
  mock_interview: "Phỏng vấn giả lập",
  cv_review: "Review CV",
  career_consulting: "Tư vấn nghề nghiệp",
  custom: "Buổi tùy chỉnh",
};

function vnd(amount) {
  return formatVndAmount(amount);
}

function formatWhen(date, timeSlot) {
  const d = String(date || "").trim();
  const t = String(timeSlot || "").trim();
  if (!d && !t) return "—";
  if (d.includes("/")) return t ? `${d} · ${t}` : d;
  const parts = d.split("-");
  if (parts.length === 3) {
    const pretty = `${parts[2].padStart(2, "0")}/${parts[1].padStart(2, "0")}/${parts[0]}`;
    return t ? `${pretty} · ${t}` : pretty;
  }
  return t ? `${d} · ${t}` : d;
}

function pickNoteLine(notes, label) {
  const re = new RegExp(`^${label}\\s*:\\s*(.+)`, "im");
  const m = String(notes || "").match(re);
  return m ? m[1].trim() : "";
}

function AttachmentLink({ label, fileName }) {
  const href = resolveMediaUrl(fileName);
  const display = fileName?.split(/[/\\]/).pop() || fileName || label;
  if (!fileName) return null;
  return (
    <a
      href={href || "#"}
      target="_blank"
      rel="noreferrer"
      className="inline-flex items-center gap-2 rounded-lg border border-violet-200 bg-white px-3 py-2 text-sm font-semibold text-violet-800 hover:bg-violet-50"
    >
      <FileText className="h-4 w-4 shrink-0" />
      <span className="max-w-[12rem] truncate">{display}</span>
      <ExternalLink className="h-3.5 w-3.5 shrink-0 opacity-70" />
    </a>
  );
}

export function AdminBookingDetail() {
  const { id } = useParams();
  const [booking, setBooking] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    setLoading(true);
    setError(null);
    const res = await tryApi(() => adminApi.getBookingById(id), {
      fallback: "Không tải được lịch hẹn.",
      silent: true,
    });
    if (!res.success) {
      setBooking(null);
      setError(res.error || "Không tải được lịch hẹn.");
    } else if (!res.booking) {
      setBooking(null);
      setError("Không tìm thấy lịch hẹn.");
    } else {
      setBooking(res.booking);
    }
    setLoading(false);
  };

  useEffect(() => {
    void load();
  }, [id]);

  const parsed = useMemo(() => parseBookingNotes(booking?.notes), [booking?.notes]);
  const freeNote = useMemo(() => pickNoteLine(booking?.notes, "Ghi chú"), [booking?.notes]);
  const confirmed = booking ? formatTransferConfirmedAt(booking) : null;

  const sessionLabel =
    SESSION_TYPE_VI[String(booking?.sessionType || "").toLowerCase()] ||
    booking?.sessionType ||
    "Buổi mentor";
  const title = parsed.position || sessionLabel;
  const showSessionType = Boolean(parsed.position);
  const paymentRef =
    booking?.paymentRef || (booking?._id ? `PI${String(booking._id).slice(-6)}` : "—");
  const student = booking?.userId;
  const mentor = booking?.mentorId;
  const mentorId = mentor?._id || mentor?.id;
  const studentId = student?._id || student?.id;
  const showSepayPending =
    booking?.paymentMethod === "transfer" &&
    String(booking?.paymentStatus || "").toLowerCase() === "pending";
  const refundPending = String(booking?.paymentStatus || "").toLowerCase() === "refund_pending";

  const confirmCkOverride = async (confirmBody) => {
    if (!booking) return;
    setBusy(true);
    const res = await tryApi(
      () =>
        adminApi.confirmBookingTransferPayment(booking._id || booking.id, confirmBody || { force: true }),
      {
        fallback: "Không xác nhận được chuyển khoản.",
        successMessage: "Đã xác nhận thanh toán.",
      },
    );
    setBusy(false);
    if (res.success) await load();
  };

  return (
    <div className={adminPageWrap}>
      {loading && <p className="text-sm text-slate-500">Đang tải…</p>}

      {error && !loading && (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-800">{error}</div>
      )}

      {booking && !loading && (
        <>
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className={`${adminGlassTable} p-5 sm:p-6`}
          >
            <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0 flex-1">
                {showSessionType ? (
                  <p className="text-[10px] font-black uppercase tracking-widest text-violet-700">{sessionLabel}</p>
                ) : null}
                <h3 className="mt-0.5 font-headline text-2xl font-black text-slate-900">{title}</h3>
                <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-slate-600">
                  <Calendar className="h-4 w-4 shrink-0 text-violet-600" />
                  {formatWhen(booking.date, booking.timeSlot)}
                  {booking.durationMinutes ? (
                    <span className="text-slate-400">· {booking.durationMinutes}p</span>
                  ) : null}
                </p>
                {booking.cancelReason ? (
                  <p className="mt-2 rounded-lg border border-red-100 bg-red-50/80 px-3 py-2 text-sm text-red-800">
                    {booking.cancelReason}
                  </p>
                ) : null}
              </div>
              <AdminBookingStatusStack
                bookingStatus={booking.status}
                paymentStatus={booking.paymentStatus}
                paymentMethod={booking.paymentMethod || "transfer"}
                mentorCancelResolution={booking.mentorCancelResolution}
              />
            </div>

            <div className="mt-5 flex flex-wrap items-end justify-between gap-4 border-t border-slate-100 pt-5">
              <div className="flex flex-wrap gap-6">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Tổng</p>
                  <p className="text-xl font-black text-slate-900">{vnd(booking.totalAmount || booking.price)}</p>
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Mã PI</p>
                  <p className="font-mono text-lg font-black text-violet-800">{paymentRef}</p>
                </div>
              </div>
              {showSepayPending ? (
                <AdminSepayOverrideAction onConfirm={confirmCkOverride} busy={busy} iconOnly={false} />
              ) : null}
            </div>

            {confirmed ? (
              <p
                className={`mt-4 rounded-lg px-3 py-2 text-sm font-semibold ${
                  confirmed.tone === "override"
                    ? "border border-rose-200 bg-rose-50 text-rose-900"
                    : "border border-emerald-200 bg-emerald-50 text-emerald-900"
                }`}
              >
                {confirmed.text}
              </p>
            ) : null}

            {refundPending && booking.refundReceiveAccountNumber ? (
              <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50/80 px-3 py-2 text-sm text-amber-950">
                Hoàn: {booking.refundReceiveBankName || "—"} · {booking.refundReceiveAccountNumber} ·{" "}
                {booking.refundReceiveAccountHolder || "—"}
              </p>
            ) : null}
          </motion.div>

          <div className="grid gap-4 lg:grid-cols-2">
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className={`${adminGlassTable} p-5`}>
              <h4 className="mb-3 flex items-center gap-2 text-xs font-black uppercase tracking-wider text-slate-500">
                <User className="h-4 w-4" />
                Học viên
              </h4>
              <div className="flex gap-4">
                <img
                  src={avatarSrc(student?.avatar)}
                  alt=""
                  className="h-14 w-14 shrink-0 rounded-xl border border-slate-200 object-cover"
                />
                <div className="min-w-0 flex-1 space-y-1">
                  <p className="font-bold text-slate-900">{student?.name || "—"}</p>
                  <p className="flex items-center gap-1.5 text-sm text-slate-600">
                    <Mail className="h-4 w-4 shrink-0" />
                    {student?.email || "—"}
                  </p>
                  {student?.phone ? (
                    <p className="flex items-center gap-1.5 text-sm text-slate-600">
                      <Phone className="h-4 w-4 shrink-0" />
                      {student.phone}
                    </p>
                  ) : null}
                  {studentId ? (
                    <Link to={`/admin/users/${studentId}`} className="text-sm font-bold text-violet-700 hover:underline">
                      Xem
                    </Link>
                  ) : null}
                </div>
              </div>
            </motion.div>

            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className={`${adminGlassTable} p-5`}>
              <h4 className="mb-3 flex items-center gap-2 text-xs font-black uppercase tracking-wider text-slate-500">
                <Users className="h-4 w-4" />
                Cố vấn
              </h4>
              <div className="space-y-1">
                <p className="text-lg font-bold text-slate-900">{mentor?.name || mentor?.userId?.name || "—"}</p>
                {mentor?.userId?.email ? (
                  <p className="flex items-center gap-1.5 text-sm text-slate-600">
                    <Mail className="h-4 w-4 shrink-0" />
                    {mentor.userId.email}
                  </p>
                ) : null}
                {mentorId ? (
                  <Link to={`/admin/mentors/${mentorId}`} className="text-sm font-bold text-violet-700 hover:underline">
                    Xem
                  </Link>
                ) : null}
              </div>
            </motion.div>
          </div>

          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className={`${adminGlassTable} p-5`}>
            <h4 className="mb-4 flex items-center gap-2 text-xs font-black uppercase tracking-wider text-slate-500">
              <ShieldCheck className="h-4 w-4" />
              Xác minh check-in mentor
            </h4>
            <AdminMentorCheckInPanel booking={booking} mentorAvatar={mentor?.avatar} />
          </motion.div>

          {(freeNote || parsed.cvFile || parsed.jdFile || booking.mentorNotes) && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className={`${adminGlassTable} p-5`}>
              <div className="space-y-3">
                {freeNote ? (
                  <p className="whitespace-pre-wrap text-sm text-slate-700">{freeNote}</p>
                ) : null}
                {(parsed.cvFile || parsed.jdFile) && (
                  <div className="flex flex-wrap gap-2">
                    <AttachmentLink label="CV" fileName={parsed.cvFile} />
                    <AttachmentLink label="JD" fileName={parsed.jdFile} />
                  </div>
                )}
                {booking.mentorNotes ? (
                  <p className="whitespace-pre-wrap border-t border-slate-100 pt-3 text-sm text-slate-600">
                    {booking.mentorNotes}
                  </p>
                ) : null}
              </div>
            </motion.div>
          )}
        </>
      )}
    </div>
  );
}
