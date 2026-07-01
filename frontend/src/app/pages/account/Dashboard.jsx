import { useState, useEffect, useMemo, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { motion, AnimatePresence } from "motion/react";
import { getUser, isLoggedIn, getDisplayName, getInitials, setLoggedIn } from "../../utils/auth/auth.js";
import { toastApiError, toastApiSuccess, tryApi } from "../../utils/shared/apiToast.js";
import { formatVnd } from "../../utils/shared/formatVnd.js";
import { fetchCurrentPlan } from "../../api/plansApi.js";
import { parseDateMs } from "../../utils/booking/bookings.js";
import { listBookings, cancelBooking } from "../../api/bookingsApi.js";
import { fetchDashboardStats } from "../../api/dashboardApi.js";
import {
  apiBookingToLocal,
  buildMentorIssueAlerts,
  buildRefundPendingAlerts,
  groupMentorIssueAlerts,
} from "../../utils/booking/bookingMappers.js";
import { MentorPageShell } from "../../components/mentor/MentorPageShell";
import { DASHBOARD_GREETING_SUB } from "../../constants/brandVoice";
import {
  getUserCancelPolicyFromDateTime,
  userCancelWarningMessage,
} from "../../constants/bookingPolicy";

/** Google Material Symbols Outlined, same family as mock (index.html loads the font). */
function MsIcon({ name, className = "", filled = false, size = 24, style }) {
  return (
    <span
      className={`material-symbols-outlined ${filled ? "ms-filled" : ""} ${className}`.trim()}
      style={{
        fontSize: size,
        lineHeight: 1,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        fontVariationSettings: filled
          ? "'FILL' 1, 'wght' 600, 'GRAD' 0, 'opsz' 24"
          : "'FILL' 0, 'wght' 600, 'GRAD' 0, 'opsz' 24",
        ...style,
      }}
      aria-hidden
    >
      {name}
    </span>
  );
}

function getTimeUntilSessionLabel(dateStr, timeStr) {
  const [d, m, y] = String(dateStr || "").split("/").map(Number);
  const [hh, mm] = String(timeStr || "").split(":").map(Number);
  const startAt = new Date(y, (m || 1) - 1, d || 1, hh || 0, mm || 0, 0, 0);
  if (!Number.isFinite(startAt.getTime())) return "";

  const diffMs = startAt.getTime() - Date.now();
  if (diffMs <= 0) return "Đến giờ";

  const totalMin = Math.floor(diffMs / 60000);
  const h = Math.floor(totalMin / 60);
  const min = totalMin % 60;
  if (h <= 0) return `Còn ${min}m`;
  if (min === 0) return `Còn ${h}h`;
  return `Còn ${h}h ${min}m`;
}

// Modal Hủy Lịch Hẹn
function CancellationModal({ booking, onClose, onConfirm }) {
  const [reason, setReason] = useState("");
  const [customReason, setCustomReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [refundBankName, setRefundBankName] = useState("");
  const [refundAccountNumber, setRefundAccountNumber] = useState("");
  const [refundAccountHolder, setRefundAccountHolder] = useState("");

  const reasons = [
    "Trùng lịch đột xuất",
    "Muốn đổi Mentor khác",
    "Không còn nhu cầu",
    "Khác",
  ];

  const policy = booking
    ? getUserCancelPolicyFromDateTime(booking.date, booking.time)
    : { feePercent: 100, refundPercent: 0 };
  const needsRefundBank = Boolean(
    booking &&
      policy.refundPercent > 0 &&
      ["paid", "partial_refund"].includes(String(booking.paymentStatus || "").toLowerCase()),
  );

  const handleConfirm = async () => {
    if (!booking) return;
    const finalReason = reason === "Khác" ? customReason : reason;
    if (!finalReason) {
      toastApiError("Vui lòng chọn hoặc nhập lý do hủy.");
      return;
    }
    if (needsRefundBank) {
      const acct = String(refundAccountNumber || "").replace(/\D/g, "");
      if (!String(refundBankName || "").trim() || acct.length < 6 || !String(refundAccountHolder || "").trim()) {
        toastApiError("Vui lòng điền đầy đủ ngân hàng, số tài khoản nhận hoàn và tên chủ tài khoản.");
        return;
      }
    }
    setLoading(true);
    await onConfirm(booking.backendId, finalReason, {
      refundReceiveBankName: needsRefundBank ? String(refundBankName || "").trim() : "",
      refundReceiveAccountNumber: needsRefundBank
        ? String(refundAccountNumber || "").replace(/\D/g, "")
        : "",
      refundReceiveAccountHolder: needsRefundBank ? String(refundAccountHolder || "").trim() : "",
    });
    setLoading(false);
  };

  if (!booking) return null;

  return (
    <div className="fixed inset-0 z-[100] overflow-y-auto overscroll-y-contain bg-black/45 backdrop-blur-sm">
      <div className="flex min-h-full items-center justify-center p-4 py-8 sm:p-6">
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          className="grid w-full max-w-md max-h-[min(85dvh,calc(100vh-3rem))] grid-rows-[minmax(0,1fr)_auto] overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-[0_28px_80px_rgba(15,23,42,0.22)]"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="min-h-0 overflow-y-auto overscroll-contain px-5 pb-2 pt-5 sm:px-7 sm:pt-7">
            <h3 className="text-xl font-black uppercase tracking-tight text-slate-900">Hủy lịch hẹn</h3>
            <p className="mb-5 mt-2 text-sm font-medium leading-relaxed text-slate-600">
              Buổi hẹn với <span className="font-bold text-violet-700">{booking.mentorName}</span> vào {booking.date} lúc{" "}
              {booking.time} sẽ bị hủy.
            </p>
            <div className="mb-4 rounded-2xl border border-red-300 bg-red-50 px-4 py-3">
              <p className="text-[11px] font-black uppercase tracking-[0.14em] text-red-600">Cảnh báo</p>
              <p className="mt-1 text-sm font-semibold text-red-700">
                {userCancelWarningMessage(policy)}
              </p>
            </div>

            <div className="mb-4 space-y-2">
              <p className="mb-2 text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Lý do của bạn</p>
              {reasons.map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setReason(r)}
                  className={`w-full rounded-2xl border p-3 text-left text-xs font-bold transition-all ${
                    reason === r
                      ? "border-violet-300 bg-violet-50 text-violet-700"
                      : "border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100"
                  }`}
                >
                  {r}
                </button>
              ))}

              <AnimatePresence>
                {reason === "Khác" && (
                  <motion.textarea
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 80 }}
                    exit={{ opacity: 0, height: 0 }}
                    value={customReason}
                    onChange={(e) => setCustomReason(e.target.value)}
                    placeholder="Nhập lý do cụ thể..."
                    className="mt-2 w-full resize-none rounded-2xl border border-slate-200 bg-white p-3 text-xs text-slate-700 outline-none transition-all placeholder:text-slate-400 focus:border-violet-300"
                  />
                )}
              </AnimatePresence>
            </div>

            {needsRefundBank ? (
              <div className="mb-2 space-y-2 rounded-2xl border border-sky-200 bg-sky-50/90 p-3 sm:p-4">
                <p className="text-[10px] font-black uppercase tracking-[0.14em] text-sky-900">Tài khoản nhận hoàn tiền</p>
                <p className="text-xs leading-snug text-sky-950/80">
                  Tiền vào TK công ty, hệ thống không lưu STK nguồn. Điền STK nhận hoàn. Số tiền hoàn do hệ thống tính,
                  không nhập tay.
                </p>
                <input
                  type="text"
                  value={refundBankName}
                  onChange={(e) => setRefundBankName(e.target.value)}
                  placeholder="Tên ngân hàng (vd. Vietcombank)"
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs text-slate-800 outline-none focus:border-violet-400"
                />
                <input
                  type="text"
                  inputMode="numeric"
                  autoComplete="off"
                  value={refundAccountNumber}
                  onChange={(e) => setRefundAccountNumber(e.target.value)}
                  placeholder="Số tài khoản nhận hoàn"
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 font-mono text-xs text-slate-800 outline-none focus:border-violet-400"
                />
                <input
                  type="text"
                  autoComplete="name"
                  value={refundAccountHolder}
                  onChange={(e) => setRefundAccountHolder(e.target.value)}
                  placeholder="Tên chủ tài khoản (in hoa, không dấu)"
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs text-slate-800 outline-none focus:border-violet-400"
                />
              </div>
            ) : null}
          </div>

          <div className="border-t border-slate-100 bg-white px-5 py-4 sm:px-7">
            <div className="flex gap-3 sm:gap-4">
              <button
                type="button"
                onClick={onClose}
                className="h-12 flex-1 rounded-2xl bg-slate-100 text-[10px] font-black uppercase tracking-widest text-slate-600 transition-all hover:bg-slate-200"
              >
                Đóng
              </button>
              <button
                type="button"
                onClick={handleConfirm}
                disabled={loading}
                className="h-12 min-w-0 flex-1 rounded-2xl bg-red-500 px-4 text-[10px] font-black uppercase tracking-widest text-white transition-all hover:bg-red-600 disabled:opacity-50 sm:flex-[1.2]"
              >
                {loading ? "Đang xử lý..." : "Xác nhận Hủy"}
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}

const ALERT_DOT = {
  violet: "bg-violet-500",
  amber: "bg-amber-500",
  rose: "bg-rose-500",
  slate: "bg-slate-400",
};

function MentorIssueRow({ alert, onOpen }) {
  const dot = ALERT_DOT[alert.tone] || ALERT_DOT.slate;
  return (
    <button
      type="button"
      onClick={() => onOpen(alert.sessionId)}
      className="flex w-full items-center gap-3 rounded-xl border border-violet-200/60 bg-white/90 px-3 py-2.5 text-left transition hover:border-violet-300 hover:bg-white"
    >
      <span className={`h-2 w-2 shrink-0 rounded-full ${dot}`} aria-hidden />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-xs font-bold text-slate-900">{alert.headline}</span>
        <span className="block truncate text-[11px] text-slate-500">
          {alert.date} {alert.time} · {alert.mentorName || "Mentor"}
        </span>
      </span>
      <span className="shrink-0 text-[10px] font-black uppercase tracking-wide text-violet-800">{alert.cta} →</span>
    </button>
  );
}

/** Một khung gọn: ưu tiên hành động trước, buổi chỉ xem gộp thành 1 dòng mở rộng. */
function MentorIssuesCompactPanel({ alerts, refundAlerts, onOpen }) {
  const { action, info, total } = useMemo(() => groupMentorIssueAlerts(alerts), [alerts]);
  const [infoOpen, setInfoOpen] = useState(false);
  const count = total + refundAlerts.length;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-[22px] border-2 border-violet-300/80 bg-gradient-to-br from-violet-50 via-white to-violet-50/50 p-4 shadow-sm sm:p-5"
    >
      <div className="mb-3 flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border-2 border-violet-300 bg-violet-100">
          <MsIcon name="event_busy" size={20} className="text-violet-800" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-black uppercase tracking-wider text-violet-950">
            Cần bạn xử lý ({count})
          </p>
          <p className="mt-0.5 text-[11px] leading-snug text-violet-950/70">
            {action.length > 0
              ? `${action.length} việc ưu tiên`
              : refundAlerts.length > 0
                ? "Điền STK để nhận hoàn"
                : "Theo dõi buổi đã hủy"}
            {info.length > 0 ? ` · ${info.length} buổi hủy` : ""}
          </p>
        </div>
      </div>

      <div className="space-y-1.5">
        {action.map((a) => (
          <MentorIssueRow key={a.alertId} alert={a} onOpen={onOpen} />
        ))}

        {refundAlerts.map((a) => (
          <MentorIssueRow key={a.alertId} alert={a} onOpen={onOpen} />
        ))}

        {info.length === 1 ? (
          <MentorIssueRow alert={info[0]} onOpen={onOpen} />
        ) : info.length > 1 ? (
          <>
            <button
              type="button"
              onClick={() => setInfoOpen((v) => !v)}
              className="flex w-full items-center justify-between rounded-xl border border-dashed border-slate-300 bg-slate-50/80 px-3 py-2 text-left text-xs text-slate-600 hover:bg-slate-50"
            >
              <span>
                {info.length} buổi mentor hủy, {infoOpen ? "thu gọn" : "xem danh sách"}
              </span>
              <MsIcon name={infoOpen ? "expand_less" : "expand_more"} size={20} className="text-slate-500" />
            </button>
            {infoOpen ? info.map((a) => <MentorIssueRow key={a.alertId} alert={a} onOpen={onOpen} />) : null}
          </>
        ) : null}
      </div>
    </motion.div>
  );
}

function getPaymentBadge(paymentStatus, status) {
  if (paymentStatus === "refund_pending") {
    return {
      text: "Chờ hoàn CK",
      className: "bg-amber-500/10 text-amber-400 border-amber-500/30",
    };
  }
  if (paymentStatus === "refunded") {
    return {
      text: "Đã hoàn tiền",
      className: "bg-sky-500/10 text-sky-300 border-sky-500/30",
    };
  }
  if (status === "confirmed" || paymentStatus === "paid") {
    return {
      text: "Đã thanh toán",
      className: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    };
  }
  return {
    text: "Chờ xử lý",
    className: "bg-amber-500/10 text-amber-500 border-amber-500/20",
  };
}

function planDisplayName(plan) {
  const p = String(plan || "free").toLowerCase();
  if (p === "elite_pro") return "Elite Pro";
  if (p === "starter_pro") return "Pro";
  return "Miễn phí";
}

function formatPlanExpires(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return "";
  return d.toLocaleDateString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function PlanUpgradeSuccessBanner({ planInfo, onDismiss }) {
  if (!planInfo) return null;
  const name = planDisplayName(planInfo.plan);
  const expires = formatPlanExpires(planInfo.planExpiresAt);
  const cvLimit = planInfo.quota?.cvAnalysisLimit;
  const interviewLimit = planInfo.quota?.interviewLimit;

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      className="dashboard-glass-soft relative overflow-hidden rounded-2xl border border-emerald-200/80 bg-gradient-to-r from-emerald-50/95 to-white p-4 sm:p-5"
      role="status"
      aria-live="polite"
    >
      <div className="pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full bg-emerald-200/40 blur-2xl" />
      <div className="relative flex gap-3 sm:gap-4">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-500 shadow-md shadow-emerald-500/25">
          <MsIcon name="verified" filled size={26} className="text-white" />
        </div>
        <div className="min-w-0 flex-1 pr-8">
          <p className="text-[10px] font-black uppercase tracking-widest text-emerald-700/80">
            Nâng cấp thành công
          </p>
          <h2 className="mt-0.5 text-base font-black text-slate-900 sm:text-lg">
            Gói {name} đã được kích hoạt
          </h2>
          <p className="mt-1 text-sm leading-relaxed text-slate-600">
            {expires
              ? `Hiệu lực đến ${expires}. `
              : ""}
            Bạn có thể dùng AI phỏng vấn và phân tích CV/JD theo hạn mức gói ngay bây giờ.
          </p>
          {(cvLimit != null || interviewLimit != null) && (
            <p className="mt-2 text-xs font-semibold text-emerald-800/90">
              {interviewLimit != null && (
                <span>
                  Phỏng vấn AI:{" "}
                  {interviewLimit >= 999 ? "không giới hạn" : `${interviewLimit}/tháng`}
                </span>
              )}
              {cvLimit != null && interviewLimit != null ? " · " : null}
              {cvLimit != null && (
                <span>
                  CV/JD: {cvLimit >= 999 ? "không giới hạn" : `${cvLimit}/tháng`}
                </span>
              )}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={onDismiss}
          className="absolute right-2 top-2 rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
          aria-label="Đóng thông báo"
        >
          <MsIcon name="close" size={20} />
        </button>
      </div>
    </motion.div>
  );
}

function LearningStreakCard({ days, loading }) {
  const streakLabel = loading ? "—" : `${days} ngày`;

  return (
    <div className="dashboard-glass-soft flex w-full min-w-0 items-center justify-between gap-3 rounded-2xl p-4 sm:max-w-[240px] sm:p-5 lg:shrink-0">
      <div className="min-w-0">
        <p className="mb-0.5 text-[10px] font-black uppercase tracking-widest text-slate-500/60">
          Hành trình học
        </p>
        <h3 className="text-lg font-black text-slate-900 sm:text-xl">{streakLabel}</h3>
      </div>
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#bff365]">
        <MsIcon name="local_fire_department" filled size={18} className="text-[#131f00]" />
      </div>
    </div>
  );
}

export function Dashboard() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const planUpgradedHandledRef = useRef(false);
  const [planUpgradeBanner, setPlanUpgradeBanner] = useState(null);

  useEffect(() => {
    if (planUpgradedHandledRef.current) return;
    if (searchParams.get("planUpgraded") !== "1") return;
    planUpgradedHandledRef.current = true;

    const next = new URLSearchParams(searchParams);
    next.delete("planUpgraded");
    setSearchParams(next, { replace: true });

    (async () => {
      try {
        const pr = await fetchCurrentPlan();
        if (pr.success) {
          setLoggedIn({
            ...getUser(),
            plan: pr.plan,
            planExpiresAt: pr.planExpiresAt,
          });
          setPlanUpgradeBanner({
            plan: pr.plan,
            planExpiresAt: pr.planExpiresAt,
            quota: pr.quota,
          });
          toastApiSuccess(`Gói ${planDisplayName(pr.plan)} đã sẵn sàng trên tài khoản của bạn.`);
          return;
        }
      } catch {
        /* fallback below */
      }
      const u = getUser();
      if (u?.plan && u.plan !== "free") {
        setPlanUpgradeBanner({
          plan: u.plan,
          planExpiresAt: u.planExpiresAt,
          quota: null,
        });
        toastApiSuccess("Thanh toán gói đã được xác nhận.");
      }
    })();
  }, [searchParams, setSearchParams]);

  useEffect(() => {
    const user = getUser();
    if (user?.role === "admin") {
      navigate("/admin", { replace: true });
      return;
    }
    if (user?.role === "mentor") {
      navigate("/mentor/dashboard", { replace: true });
    }
  }, [navigate]);

  const user = getUser();
  const fullName = getDisplayName(user);
  const initials = getInitials(fullName);

  const [upcomingSessions, setUpcomingSessions] = useState([]);
  const [mentorIssueAlerts, setMentorIssueAlerts] = useState([]);
  const [refundPendingAlerts, setRefundPendingAlerts] = useState([]);
  const [cancellingBooking, setCancellingBooking] = useState(null);
  const [streakStats, setStreakStats] = useState(null);
  const [streakLoading, setStreakLoading] = useState(false);

  const loadData = async () => {
    const now = Date.now();
    const skipStatus = new Set(["cancelled", "no_show"]);

    if (!isLoggedIn()) {
      setStreakStats(null);
      setStreakLoading(false);
      setUpcomingSessions([]);
      setMentorIssueAlerts([]);
      setRefundPendingAlerts([]);
      return;
    }

    setStreakLoading(true);
    let listRes = { success: false, bookings: [] };
    let statsRes = { success: false, stats: null };
    try {
      [listRes, statsRes] = await Promise.all([listBookings(), fetchDashboardStats()]);
    } catch {
      toastApiError("Lỗi kết nối khi tải dashboard.");
    } finally {
      setStreakLoading(false);
    }
    setStreakStats(statsRes.success ? statsRes.stats : null);
    if (!listRes.success && listRes.error) {
      toastApiError(listRes.error);
    }

    const mergeKey = (b) => String(b?.backendId || b?.paymentRef || b?.orderNum || "");
    const map = new Map();
    let mentorAlerts = [];
    let refundAlerts = [];
    if (listRes.success && Array.isArray(listRes.bookings)) {
      mentorAlerts = buildMentorIssueAlerts(listRes.bookings);
      const mentorIds = new Set(mentorAlerts.map((a) => a.sessionId));
      refundAlerts = buildRefundPendingAlerts(listRes.bookings, mentorIds);
      const apiRows = listRes.bookings
        .map(apiBookingToLocal)
        .filter((b) => b && (!skipStatus.has(b.status) && !(b.status === "done" && b.reviewId)));
      for (const b of apiRows) {
        const k = mergeKey(b);
        if (k) map.set(k, b);
      }
    }
    const merged = Array.from(map.values()).sort((a, b) => {
      const ta = parseDateMs(a.date, a.time);
      const tb = parseDateMs(b.date, b.time);
      const aFuture = ta >= now;
      const bFuture = tb >= now;
      if (aFuture && bFuture) return ta - tb;
      if (!aFuture && !bFuture) return tb - ta;
      return aFuture ? -1 : 1;
    });
    const upcoming = merged.filter((b) => {
      const st = String(b.status || "").toLowerCase();
      return st === "confirmed" || st === "in_progress" || (st === "done" && !b.reviewId);
    });
    setUpcomingSessions(upcoming);
    setMentorIssueAlerts(mentorAlerts);
    setRefundPendingAlerts(refundAlerts);
  };

  useEffect(() => {
    void loadData();
    window.addEventListener("focus", loadData);
    return () => window.removeEventListener("focus", loadData);
  }, []);

  const handleCancelConfirm = async (id, reason, refundDest = {}) => {
    const res = await tryApi(() => cancelBooking(id, { reason, ...refundDest }), {
      fallback: "Không thể hủy lịch.",
      silent: true,
    });
    if (!res.success) {
      toastApiError(res.error, "Không thể hủy lịch.");
      return;
    }
    const pol = res.cancellationPolicy;
    const refundAmt = Number(pol?.refundAmountVnd ?? 0);
    const retained = Number(pol?.retainedAmountVnd ?? 0);
    const pct = typeof pol?.refundPercent === "number" ? pol.refundPercent : null;
    if (pol?.ledger === "cancelled_pending_transfer") {
      toastApiSuccess("Đã hủy lịch. Giao dịch chờ chuyển khoản đã hủy, chưa thu tiền.");
    } else if (refundAmt > 0) {
      const tail = retained > 0 ? ` Giữ lại: ${formatVnd(Math.round(retained))}.` : "";
      toastApiSuccess(
        `Đã hủy lịch. Yêu cầu hoàn ${formatVnd(Math.round(refundAmt))}${pct != null ? ` (${pct}%)` : ""} đã ghi nhận.${tail} Admin sẽ CK hoàn, bạn được báo khi hoàn xong.`,
      );
    } else {
      toastApiSuccess(
        pct === 0 ? "Đã hủy lịch. Theo chính sách, không hoàn tiền." : "Đã hủy lịch.",
      );
    }
    setCancellingBooking(null);
    loadData();
  };

  return (
    <MentorPageShell bottomPad="pb-20">
      <style>{`
        .material-symbols-outlined {
          font-family: "Material Symbols Outlined";
          font-weight: normal;
          font-style: normal;
          font-size: 1.5rem;
          line-height: 1;
          letter-spacing: normal;
          text-transform: none;
          display: inline-block;
          white-space: nowrap;
          word-wrap: normal;
          direction: ltr;
          font-variation-settings: "FILL" 0, "wght" 600, "GRAD" 0, "opsz" 24;
          -webkit-font-smoothing: antialiased;
        }
        .material-symbols-outlined.ms-filled {
          font-variation-settings: "FILL" 1, "wght" 600, "GRAD" 0, "opsz" 24;
        }
        .dashboard-glass-soft {
          background: rgba(255, 255, 255, 0.72);
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
          border: 1px solid rgba(204, 195, 216, 0.35);
        }
      `}</style>

      <motion.div className="relative z-10 mx-auto max-w-6xl space-y-5 px-4 py-4 sm:px-6 sm:py-5">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col gap-4 lg:flex-row lg:items-stretch lg:justify-between"
        >
          <div className="flex min-w-0 items-center gap-4">
            <div className="dashboard-glass-soft flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border-2 border-[#8037f4]/20 shadow-md shadow-[#8037f4]/5 sm:h-16 sm:w-16">
              <span className="text-lg font-black tracking-tight text-[#8037f4] sm:text-xl">{initials}</span>
            </div>
            <div className="min-w-0">
              <h1 className="break-words text-xl font-black leading-tight text-slate-900 sm:text-2xl lg:text-3xl">
                Chào, <span className="text-[#8037f4]">{fullName}!</span>
              </h1>
              <p className="mt-1 text-sm font-medium text-slate-600/90">
                {DASHBOARD_GREETING_SUB}
              </p>
            </div>
          </div>
          <LearningStreakCard
            days={streakStats?.learningStreakDays ?? 0}
            loading={streakLoading}
          />
        </motion.div>

        <AnimatePresence>
          {planUpgradeBanner ? (
            <PlanUpgradeSuccessBanner
              planInfo={planUpgradeBanner}
              onDismiss={() => setPlanUpgradeBanner(null)}
            />
          ) : null}
        </AnimatePresence>

        <motion.button
          type="button"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          onClick={() => navigate("/interview")}
          className="group relative flex w-full flex-col items-center gap-4 overflow-hidden rounded-2xl bg-[#8037f4] p-5 text-left shadow-xl shadow-[#8037f4]/25 transition-transform hover:scale-[1.005] sm:p-6 md:flex-row md:gap-6"
        >
          <div className="pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full bg-white/10 blur-3xl" />
          <div className="relative z-10 flex-1">
            <div className="mb-3 inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-white/10 px-3 py-1">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#bfff3f] opacity-75" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-[#bfff3f]" />
              </span>
              <span className="text-[10px] font-black uppercase tracking-widest text-white">Live AI Coach</span>
            </div>
            <h2 className="mb-2 text-xl font-black leading-snug text-white sm:text-2xl">
              Luyện tập phỏng vấn thông minh với AI
            </h2>
            <p className="mb-4 max-w-xl text-sm leading-relaxed text-white/80">
              Giả lập phỏng vấn 1-1, nhận đánh giá chi tiết và cải thiện kỹ năng cùng trợ lý ảo.
            </p>
            <span className="inline-flex items-center gap-2 rounded-full bg-[#bfff3f] px-5 py-2 text-sm font-black text-[#131f00] shadow-md transition-all group-hover:scale-105">
              Luyện tập ngay
              <MsIcon name="play_circle" size={20} className="text-[#131f00]" />
            </span>
          </div>
          <div className="relative z-10 hidden shrink-0 items-center justify-center lg:flex">
            <div className="flex h-28 w-28 animate-pulse items-center justify-center rounded-full bg-white/10">
              <div className="flex h-20 w-20 items-center justify-center rounded-full bg-white/20">
                <MsIcon name="mic" size={48} className="text-white" />
              </div>
            </div>
          </div>
        </motion.button>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 md:grid-cols-3"
        >
          <FeatureCard
            title="Phân tích CV/JD"
            desc="Tối ưu hồ sơ cho mọi vị trí tuyển dụng."
            icon="description"
            iconWellClass="bg-violet-100 text-[#8037f4]"
            hoverBorder="hover:border-[#8037f4]/50"
            onClick={() => navigate("/cv-analysis")}
          />
          <FeatureCard
            title="Khóa học"
            desc="Lộ trình học kỹ năng chuyên môn."
            icon="school"
            iconWellClass="bg-[#bff365] text-[#131f00]"
            hoverBorder="hover:border-[#3b5700]/50"
            onClick={() => navigate("/courses")}
          />
          <FeatureCard
            title="Tìm Mentor"
            desc="Kết nối với chuyên gia đầu ngành."
            icon="group"
            iconWellClass="bg-violet-100 text-[#5b598c]"
            hoverBorder="hover:border-[#5b598c]/50"
            onClick={() => navigate("/mentors")}
          />
        </motion.div>

        <motion.div className="grid grid-cols-12 gap-4 items-start lg:gap-5">
          <div className="col-span-12 space-y-4">
            {mentorIssueAlerts.length > 0 || refundPendingAlerts.length > 0 ? (
              <MentorIssuesCompactPanel
                alerts={mentorIssueAlerts}
                refundAlerts={refundPendingAlerts}
                onOpen={(id) => navigate(`/session/${id}`)}
              />
            ) : null}
            <div
              className={`glass-card p-5 sm:p-6 bg-gradient-to-br from-white to-slate-50 border-slate-200 flex flex-col overflow-hidden ${
                upcomingSessions.length === 0
                  ? "min-h-0 h-auto"
                  : "h-[220px] lg:h-[240px]"
              }`}
            >
               <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-black text-slate-900 uppercase tracking-[0.14em] flex items-center gap-3">
                     <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 border-violet-300/90 bg-violet-100 shadow-sm">
                        <MsIcon name="calendar_month" size={18} className="text-violet-700" />
                     </div>
                     Lịch trình hành trình
                  </h3>
                  {upcomingSessions.length > 0 && (
                    <span className="text-[10px] font-black text-secondary uppercase bg-secondary/10 px-3 py-1 rounded-full border border-secondary/20">
                       {upcomingSessions.length} Buổi hẹn sắp tới
                    </span>
                  )}
               </div>

               <div
                 className={`space-y-4 relative overflow-y-auto pr-1 ${
                   upcomingSessions.length === 0 ? "" : "flex-1 min-h-0"
                 }`}
               >
                 {upcomingSessions.length === 0 ? (
                    <div className="py-8 sm:py-9 text-center border-2 border-dashed border-slate-200 rounded-[28px] bg-slate-50/70">
                       <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full border-2 border-slate-300/90 bg-slate-100 shadow-sm">
                          <MsIcon name="event_busy" size={32} className="text-slate-700" />
                       </div>
                       <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">
                          Chưa có lịch hẹn nào
                       </p>
                    </div>
                 ) : upcomingSessions.slice(0, 2).map((s, i) => (
                    <div key={i} className="group relative p-4 rounded-[24px] bg-white border border-slate-200 hover:bg-slate-50 hover:border-slate-300 transition-all duration-500">
                       <div className="flex gap-3 items-center">
                          <div className="relative shrink-0">
                             <div className="w-14 h-14 rounded-2xl overflow-hidden border-2 border-slate-200 group-hover:border-secondary/40 transition-colors bg-white flex items-center justify-center">
                                {s.mentorAvatar ? (
                                   <img src={s.mentorAvatar} alt={s.mentorName} className="w-full h-full object-cover" />
                                ) : (
                                   <span className="text-xl font-black text-slate-400">{s.mentorName[0]}</span>
                                )}
                             </div>
                             {(s.status === "confirmed" || s.status === "in_progress" || (s.status === "done" && !s.reviewId)) && (
                                <div className="absolute -top-1 -right-1 w-4 h-4 bg-emerald-500 rounded-full border-2 border-[#0E0922] shadow-[0_0_10px_rgba(16,185,129,0.5)]" />
                             )}
                          </div>

                          <div className="flex-1 min-w-0">
                             <div className="flex items-center justify-between mb-1">
                                <p className="text-[10px] font-black text-secondary tracking-wider uppercase">{s.date} • {s.time}</p>
                                {(() => {
                                  const badge = getPaymentBadge(s.paymentStatus, s.status);
                                  return (
                                    <span className={`text-[8px] font-black px-2 py-0.5 rounded-md uppercase border ${badge.className}`}>
                                      {badge.text}
                                    </span>
                                  );
                                })()}
                             </div>
                             <p className="text-[10px] font-bold text-violet-600 mb-1.5">
                               {getTimeUntilSessionLabel(s.date, s.time)}
                             </p>
                             <h4 className="text-base font-black text-slate-900 truncate pr-4">{s.mentorName}</h4>
                             <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-tight mt-1 truncate opacity-60">
                                {s.sessionType === "mock_interview" ? "Phỏng vấn giả định" : "Tư vấn lộ trình"}
                             </p>
                          </div>
                       </div>
                       
                       {(s.status === "confirmed" || s.status === "in_progress" || (s.status === "done" && !s.reviewId)) && (
                          <div className="mt-4 pt-3 border-t border-slate-200 flex gap-2">
                             {s.status === "confirmed" || s.status === "in_progress" ? (
                               <>
                                 <button
                                   className="flex-1 h-10 rounded-xl bg-secondary text-black font-black text-[10px] uppercase tracking-widest hover:scale-[1.02] active:scale-[0.98] transition-all shadow-[0_10px_30px_rgba(232,121,249,0.2)] disabled:opacity-50"
                                   disabled={String(s.paymentStatus || "").toLowerCase() !== "paid"}
                                   onClick={() => navigate(`/meeting/${s.sessionId || s.backendId || s.id}`)}
                                 >
                                    Vào phòng phỏng vấn
                                 </button>
                                 <button 
                                   onClick={() => setCancellingBooking(s)}
                                   className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-red-200 bg-red-50 transition-all hover:border-red-400 hover:bg-red-100"
                                   title="Hủy lịch hẹn (không hoàn tiền)"
                                 >
                                    <MsIcon name="cancel" size={22} className="text-red-700" />
                                 </button>
                               </>
                             ) : (
                               <button 
                                 onClick={() => navigate(`/review/${s.sessionId || s.backendId || s.id}`)}
                                 className="flex-1 h-10 rounded-xl bg-[#bff365] text-slate-900 font-black text-[10px] uppercase tracking-widest hover:scale-[1.02] active:scale-[0.98] transition-all shadow-[0_10px_30px_rgba(191,243,101,0.2)]"
                               >
                                  Gửi đánh giá Mentor
                               </button>
                             )}
                          </div>
                        )}
                    </div>
                 ))}
               </div>
               
               {upcomingSessions.length > 0 && (
                 <button
                   type="button"
                   onClick={() => navigate("/my-bookings")}
                   className="w-full mt-4 py-2 text-[10px] font-black text-slate-500 uppercase tracking-[0.1em] hover:text-slate-800 transition-colors"
                 >
                    {upcomingSessions.length > 2
                      ? `Xem tất cả lịch hẹn (${upcomingSessions.length})`
                      : "Quản lý lịch hẹn"}
                 </button>
               )}
            </div>
          </div>

        </motion.div>
      </motion.div>

      <AnimatePresence>
        {cancellingBooking && (
          <CancellationModal 
            booking={cancellingBooking}
            onClose={() => setCancellingBooking(null)}
            onConfirm={handleCancelConfirm}
          />
        )}
      </AnimatePresence>
    </MentorPageShell>
  );
}

function FeatureCard({ title, desc, icon, iconWellClass, hoverBorder, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200/80 bg-white p-4 text-left shadow-sm transition-all hover:shadow-md ${hoverBorder}`}
    >
      <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${iconWellClass}`}>
        <MsIcon name={icon} size={20} />
      </div>
      <div>
        <h3 className="mb-0.5 text-sm font-black text-slate-900 sm:text-base">{title}</h3>
        <p className="text-xs text-slate-500 leading-snug">{desc}</p>
      </div>
    </button>
  );
}

function LushActionTile({ title, desc, onClick, icon, accent, accent2, isLarge, iconWellClass, iconGlyphClass }) {
  const borderGlow = accent2 || accent;
  const well =
    iconWellClass ||
    "rounded-full border-2 border-slate-300/90 bg-slate-100 shadow-sm";
  const glyph = iconGlyphClass || "text-slate-800";
  return (
    <motion.button
      type="button"
      onClick={onClick}
      whileTap={{ scale: 0.97 }}
      className={`glass-card text-left group relative border-slate-300 active:scale-[0.98] h-full ${isLarge ? "p-8 sm:p-10" : "p-5 sm:p-6 h-[252px]"}`}
      style={{
        borderColor: `${accent}55`,
        boxShadow: isLarge ? `0 0 0 1px ${borderGlow}22, 0 12px 24px rgba(15,23,42,0.08)` : undefined,
      }}
    >
      <div
        className={`flex items-center justify-center group-hover:scale-110 group-hover:-rotate-2 transition-all duration-500 ${isLarge ? "mb-8 h-16 w-16" : "mb-5 h-12 w-12"} ${well}`}
      >
        <MsIcon name={icon} size={isLarge ? 28 : 24} className={glyph} />
      </div>
      <div className="relative z-10">
        <h4
          className={`font-black flex items-center gap-2 sm:gap-3 leading-tight transition-colors ${isLarge ? "text-xl sm:text-2xl mb-3" : "text-sm mb-2"}`}
        >
          <span className="bg-gradient-to-r from-slate-900 to-slate-700 bg-clip-text text-transparent group-hover:from-indigo-700 group-hover:to-violet-700 transition-all">
            {title}
          </span>
        </h4>
        <p
          className={`text-slate-600 font-semibold leading-relaxed group-hover:text-slate-700 transition-colors ${isLarge ? "text-sm" : "text-[11px] sm:text-xs"}`}
        >
          {desc}
        </p>
        {isLarge && (
          <p className="mt-4 text-xs font-black uppercase tracking-[0.1em] text-indigo-600 group-hover:translate-x-1 transition-transform">
            Bắt đầu phiên -&gt;
          </p>
        )}
      </div>
    </motion.button>
  );
}
