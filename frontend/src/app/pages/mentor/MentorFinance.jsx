import { useState, useEffect, useRef, useMemo } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router";
import { motion, AnimatePresence } from "motion/react";
import {
  ArrowUpRight,
  ArrowDownRight,
  ArrowRight,
  Wallet,
  Calendar,
  BookOpen,
  Route,
  CheckCircle2 as CheckCircle,
  Clock,
  TrendingUp,
  BadgeCheck,
  X,
  PenLine,
  ShieldCheck,
  DollarSign,
  AlertCircle,
  RefreshCw,
  Sparkles,
} from "lucide-react";
import { MentorListExpandButton } from "../../components/mentor/MentorListExpandButton.jsx";
import { useMentorListExpand } from "../../hooks/useMentorListExpand.js";
import { MentorScrollFadeRow } from "../../components/mentor/MentorScrollFadeRow.jsx";
import { getUser, getDisplayName } from "../../utils/auth/auth.js";
import { MentorPageShell } from "../../components/mentor/MentorPageShell.jsx";
import { MentorPageHeader } from "../../components/mentor/MentorPageHeader.jsx";
import { MentorStatPanel, MentorStatFrame } from "../../components/mentor/MentorStatFrames.jsx";
import { MentorMoneyText } from "../../utils/shared/moneyDisplay.jsx";
import {
  fetchMentorFinance,
  requestMentorPayout,
  updateMentorPayoutAccount,
  requestMentorPriceChange,
} from "../../api/mentorApi.js";
import { toastApiError, toastApiSuccess } from "../../utils/shared/apiToast.js";
import { AppSelect } from "../../components/ui/AppSelect";
import {
  ALL_MONTHS,
  filterRows,
  formatDateVN,
  incomeStatusMeta,
  incomeSubtitle,
  incomeTitle,
  listMonths,
  monthLabel,
  percentText,
  summarizeRows,
  withdrawTitle,
} from "../../utils/mentor/financeHistory.js";
import {
  SUPPORTED_BANKS,
  BANK_OTHER,
  resolveBankFields,
} from "../../constants/vietnamBanks.js";

const MENTOR_FINANCE_EXTRA_CSS = `
  .glass-tag {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    max-width: 100%;
    white-space: nowrap;
    padding: 3px 10px;
    border-radius: 9999px;
    font-size: 11px;
    font-weight: 700;
    line-height: 1.3;
  }
  @keyframes mentor-finance-tx-pulse {
    0% { transform: scale3d(1, 1, 1); }
    50% { transform: scale3d(1.006, 1.006, 1.006); }
    100% { transform: scale3d(1, 1, 1); }
  }
  .mentor-finance-tx-row {
    transform-origin: center center;
    transition: background-color 0.2s ease, border-color 0.2s ease;
  }
  .mentor-finance-tx-row:hover {
    background-color: rgba(255, 255, 255, 0.04);
  }
  @keyframes mentor-withdraw-cta-glow {
    0%, 100% { box-shadow: 0 0 0 0 rgba(147, 247, 43, 0.45), 0 8px 24px rgba(147, 247, 43, 0.25); }
    50% { box-shadow: 0 0 0 6px rgba(147, 247, 43, 0.12), 0 12px 32px rgba(147, 247, 43, 0.35); }
  }
  .mentor-withdraw-cta-ready {
    animation: mentor-withdraw-cta-glow 2.4s ease-in-out infinite;
  }
`;

const TX_FILTER_TABS = [
  { id: "all", label: "Tất cả" },
  { id: "income", label: "Thu nhập" },
  { id: "withdraw", label: "Rút tiền" },
];

function formatMoney(amount) {
  return `${Number(amount || 0).toLocaleString("vi-VN")} Đ`;
}

const withdrawFieldLabel = "mb-1.5 block text-xs font-bold text-slate-300";
const withdrawFieldInput =
  "w-full rounded-xl border border-white/10 bg-[#120a20] px-3.5 py-2.5 text-sm font-semibold text-white outline-none transition-all placeholder:text-slate-500 focus:border-[#93f72b] focus:ring-1 focus:ring-[#93f72b]/30";

function isValidBankName(name) {
  const n = String(name || "").trim();
  if (!n || n.length < 2 || n.length > 80) return false;
  if (SUPPORTED_BANKS.includes(n)) return true;
  return /^[\p{L}\p{N}\s.&()-]+$/u.test(n);
}

function percentLabel(rate) {
  const n = Number(rate || 0) * 100;
  if (!Number.isFinite(n)) return "0%";
  const rounded = Math.round(n * 10) / 10;
  return Number.isInteger(rounded) ? `${rounded}%` : `${rounded.toFixed(1)}%`;
}

/* ── Withdrawal Modal ────────────────────────────────────────────────── */
function WithdrawalModal({
  balance,
  payoutAccount,
  payoutAccountOwnerName,
  payoutAccountMasked,
  onSavePayoutAccount,
  onSubmit,
  onClose,
}) {
  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(false);
  const [savingAccount, setSavingAccount] = useState(false);
  const [success, setSuccess] = useState(false);
  const initialBank = resolveBankFields(payoutAccount?.bankName);
  const [bankSelect, setBankSelect] = useState(initialBank.select);
  const [customBankName, setCustomBankName] = useState(initialBank.custom);
  const [accountNumber, setAccountNumber] = useState(payoutAccount?.accountNumber || "");

  useEffect(() => {
    const next = resolveBankFields(payoutAccount?.bankName);
    setBankSelect(next.select);
    setCustomBankName(next.custom);
    setAccountNumber(payoutAccount?.accountNumber || "");
  }, [payoutAccount]);

  const effectiveBankName =
    bankSelect === BANK_OTHER ? customBankName.trim() : bankSelect.trim();

  const amountDigits = String(amount || "").replace(/\D/g, "");
  const amountValue = Number(amountDigits || 0);
  const hasEnoughAmount = amountValue >= 100000;
  const accountDigits = accountNumber.replace(/\D/g, "");
  const isAccountReady =
    isValidBankName(effectiveBankName) && /^\d{8,19}$/.test(accountDigits);
  const isAccountChanged =
    effectiveBankName !== (payoutAccount?.bankName || "").trim() ||
    accountDigits !== (payoutAccount?.accountNumber || "");

  const persistAccount = async () => {
    if (!isAccountReady)
      return { success: false, error: "Vui lòng nhập đủ thông tin tài khoản nhận tiền." };
    setSavingAccount(true);
    const result = await onSavePayoutAccount?.({
      bankName: effectiveBankName,
      accountNumber: accountDigits,
    });
    setSavingAccount(false);
    return result;
  };

  const handleWithdraw = async () => {
    const n = amountValue;
    if (!Number.isFinite(n) || n < 100000) return;
    if (n > balance) return;
    if (!isAccountReady) return;
    if (isAccountChanged) {
      const saved = await persistAccount();
      if (!saved?.success) return;
    }
    setLoading(true);
    const res = await onSubmit?.(Math.round(n));
    setLoading(false);
    if (!res?.success) return;
    setSuccess(true);
  };

  return createPortal(
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[200] flex items-center justify-center overflow-y-auto bg-black/75 p-4 backdrop-blur-md sm:p-6"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.96, y: 14, opacity: 0 }}
        animate={{ scale: 1, y: 0, opacity: 1 }}
        exit={{ scale: 0.96, y: 14, opacity: 0 }}
        transition={{ duration: 0.22, ease: "easeOut" }}
        className="relative my-6 w-full max-w-[28rem] shrink-0 overflow-hidden rounded-2xl border border-white/10 bg-[#140c24] text-white shadow-[0_25px_60px_rgba(0,0,0,0.7)]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Hairline Glow */}
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#93f72b]/50 to-transparent" />

        {success ? (
          <div className="space-y-5 p-6 text-center sm:p-8">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-[#93f72b]/30 bg-[#93f72b]/15 shadow-[0_0_24px_rgba(147,247,43,0.25)]">
              <CheckCircle size={36} className="text-[#93f72b]" strokeWidth={2.5} />
            </div>
            <div>
              <h2 className="text-xl font-black text-white">Yêu cầu rút tiền đã gửi</h2>
              <p className="mt-2 text-xs leading-relaxed text-slate-400">
                Admin sẽ xử lý và chuyển khoản tới bạn trong 1–2 ngày làm việc.
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="w-full rounded-xl bg-[#93f72b] py-3 text-xs font-bold text-slate-950 shadow-[0_0_20px_rgba(147,247,43,0.35)] transition hover:bg-[#a8ff4e]"
            >
              Hoàn tất
            </button>
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="border-b border-white/[0.08] bg-[#160f28] px-6 py-5">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[#93f72b]/30 bg-[#93f72b]/15 text-[#93f72b]">
                    <Wallet size={20} strokeWidth={2.2} />
                  </span>
                  <div>
                    <h2 className="text-base font-bold text-white leading-tight">Yêu cầu rút tiền</h2>
                    <p className="mt-0.5 text-xs text-slate-400">
                      Số dư khả dụng:{" "}
                      <span className="font-bold text-[#93f72b]">
                        {balance.toLocaleString("vi-VN")} Đ
                      </span>
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-xl border border-white/10 bg-white/5 p-1.5 text-slate-400 hover:text-white transition"
                  aria-label="Đóng"
                >
                  <X size={15} />
                </button>
              </div>
            </div>

            {/* Body */}
            <div className="space-y-5 p-6">
              <section className="space-y-3">
                <label className={withdrawFieldLabel}>Tài khoản ngân hàng nhận tiền</label>
                <div className="space-y-2.5">
                  <AppSelect
                    size="default"
                    value={bankSelect}
                    onValueChange={(val) => {
                      setBankSelect(val);
                      if (val !== BANK_OTHER) setCustomBankName("");
                    }}
                    options={[
                      ...SUPPORTED_BANKS.map((b) => ({ value: b, label: b })),
                      { value: BANK_OTHER, label: "Ngân hàng khác…" },
                    ]}
                  />

                  {bankSelect === BANK_OTHER && (
                    <input
                      type="text"
                      placeholder="Nhập tên ngân hàng của bạn"
                      value={customBankName}
                      onChange={(e) => setCustomBankName(e.target.value)}
                      className={withdrawFieldInput}
                    />
                  )}

                  <input
                    type="text"
                    inputMode="numeric"
                    autoComplete="off"
                    placeholder="Số tài khoản (8–19 chữ số)"
                    value={accountNumber}
                    onChange={(e) => setAccountNumber(e.target.value.replace(/\D/g, ""))}
                    className={`${withdrawFieldInput} tabular-nums tracking-wide`}
                  />
                </div>

                <div className="flex gap-2.5 rounded-xl border border-white/[0.08] bg-white/[0.02] p-3 text-xs leading-relaxed text-slate-400">
                  <BadgeCheck size={16} className="shrink-0 text-[#93f72b] mt-0.5" />
                  <div className="min-w-0">
                    <p className="font-bold text-white">{payoutAccountOwnerName || "Mentor"}</p>
                    <p className="mt-0.5 text-[11px]">
                      Tên chủ tài khoản nhận phải trùng khớp hồ sơ Mentor đã xác minh.
                      {payoutAccountMasked ? (
                        <span className="text-[#93f72b]"> · Đã lưu {payoutAccountMasked}</span>
                      ) : null}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={persistAccount}
                  disabled={!isAccountReady || savingAccount}
                  className="w-full rounded-xl border border-white/10 bg-white/5 py-2 text-xs font-semibold text-slate-300 hover:border-[#93f72b]/40 hover:text-[#93f72b] transition disabled:opacity-40"
                >
                  {savingAccount ? "Đang lưu…" : "Lưu thông tin tài khoản"}
                </button>
              </section>

              <section>
                <label className={withdrawFieldLabel}>Số tiền muốn rút (VND)</label>
                <div className="relative mt-1">
                  <input
                    type="text"
                    inputMode="numeric"
                    placeholder="VD: 500.000"
                    value={amountDigits ? amountValue.toLocaleString("vi-VN") : ""}
                    onChange={(e) => setAmount(e.target.value.replace(/\D/g, ""))}
                    className={`${withdrawFieldInput} py-3 pr-12 text-lg font-bold text-[#93f72b] placeholder:font-medium placeholder:text-slate-600`}
                  />
                  <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-sm font-bold text-slate-400">
                    Đ
                  </span>
                </div>
                <div className="mt-2 flex items-center justify-between text-xs text-slate-400">
                  <span>Tối thiểu 100.000 Đ</span>
                  {amountValue > 0 && (
                    <span className="text-white font-semibold">
                      Rút: {amountValue.toLocaleString("vi-VN")} Đ
                    </span>
                  )}
                </div>
              </section>

              <button
                type="button"
                onClick={handleWithdraw}
                disabled={
                  !hasEnoughAmount ||
                  amountValue > balance ||
                  loading ||
                  savingAccount ||
                  !isAccountReady
                }
                className="w-full rounded-xl bg-[#93f72b] py-3.5 text-xs font-bold text-slate-950 shadow-[0_0_20px_rgba(147,247,43,0.35)] transition hover:bg-[#a8ff4e] disabled:cursor-not-allowed disabled:opacity-40"
              >
                {loading ? "Đang xử lý yêu cầu…" : "Xác nhận gửi yêu cầu rút tiền"}
              </button>

              {amountValue > balance && amountValue > 0 ? (
                <p className="text-center text-xs text-rose-400">
                  Số tiền vượt quá số dư khả dụng ({balance.toLocaleString("vi-VN")} Đ).
                </p>
              ) : !isAccountReady ? (
                <p className="text-center text-xs text-amber-300">
                  Vui lòng chọn ngân hàng và nhập số tài khoản hợp lệ (8–19 số).
                </p>
              ) : null}
            </div>
          </>
        )}
      </motion.div>
    </motion.div>,
    document.body
  );
}

/* ── Main Finance Component ────────────────────────────────────────── */
export function MentorFinance() {
  const navigate = useNavigate();
  const user = getUser();
  const [activeTab, setActiveTab] = useState("all");
  const [activeMonth, setActiveMonth] = useState(ALL_MONTHS);
  const [showWithdraw, setShowWithdraw] = useState(false);
  const [finance, setFinance] = useState(null);
  const [selectedTx, setSelectedTx] = useState(null);
  const transactionSectionRef = useRef(null);
  const [newPriceInput, setNewPriceInput] = useState("");
  const [submittingPrice, setSubmittingPrice] = useState(false);

  useEffect(() => {
    if (!user || user.role !== "mentor") {
      navigate("/");
      return;
    }
    void (async () => {
      try {
        const res = await fetchMentorFinance();
        if (res.success && res.finance) setFinance(res.finance);
        else if (!res.success) toastApiError(res.error, "Không tải được tài chính mentor.");
      } catch {
        toastApiError("Lỗi kết nối khi tải tài chính.");
      }
    })();
  }, [navigate, user?.role]);

  const transactions = Array.isArray(finance?.history) ? finance.history : [];
  const txMonths = useMemo(() => listMonths(transactions), [transactions]);
  const filteredTransactions = useMemo(
    () => filterRows(transactions, { month: activeMonth, tab: activeTab }),
    [transactions, activeTab, activeMonth]
  );
  // Tổng theo tháng đang chọn (cả thu nhập lẫn rút tiền), không phụ thuộc tab.
  const monthSummary = useMemo(
    () => summarizeRows(filterRows(transactions, { month: activeMonth })),
    [transactions, activeMonth]
  );
  const {
    visibleItems: visibleTransactions,
    showExpandButton: showTxExpandButton,
    expanded: txExpanded,
    toggleExpanded: toggleTxExpanded,
  } = useMentorListExpand(filteredTransactions, `${activeTab}:${activeMonth}`);

  if (!user || user.role !== "mentor") return null;

  const availableBalance = Number(finance?.availableBalance || 0);
  const pendingBalance = Number(finance?.pendingBalance || 0);
  const totalEarned = Number(finance?.totalEarned || 0);
  const bookingIncome = Number(finance?.incomeBreakdown?.booking || 0);
  const courseIncome = Number(finance?.incomeBreakdown?.course || 0);
  // LP-16: thu nhập từ các buổi lộ trình học (tách khỏi đặt lịch thường).
  const learningPathIncome = Number(finance?.incomeBreakdown?.learningPath || 0);
  // Đối soát: tổng trong ví so với tổng các giao dịch đã ghi; khoản chưa ghi vào ví tách riêng.
  const reconciliation = finance?.reconciliation || null;
  const payoutAccount = finance?.payoutAccount || {};
  const payoutAccountMasked = finance?.payoutAccountMasked || "";
  const payoutAccountOwnerName = finance?.payoutAccountOwnerName || getDisplayName(user, "Mentor");
  const commissionPolicy = finance?.commissionPolicy || null;
  const currentPricePerHour = Number(finance?.pricePerHour || 0);
  const pendingPricePerHour = finance?.pendingPricePerHour ?? null;
  const newPriceDigits = newPriceInput.replace(/\D/g, "");
  const newPriceValue = Number(newPriceDigits || 0);
  const isPriceChangeValid = newPriceValue > 0 && newPriceValue !== currentPricePerHour;

  const handleRequestPriceChange = async () => {
    if (!isPriceChangeValid) return;
    setSubmittingPrice(true);
    try {
      const res = await requestMentorPriceChange(newPriceValue);
      if (!res.success) {
        toastApiError(res.error, "Không gửi được yêu cầu đổi giá.");
        return;
      }
      toastApiSuccess("Đã gửi yêu cầu đổi giá, chờ Admin duyệt.");
      setNewPriceInput("");
      setFinance((prev) => ({ ...(prev || {}), pendingPricePerHour: newPriceValue }));
    } catch {
      toastApiError("Lỗi kết nối khi gửi yêu cầu đổi giá.");
    } finally {
      setSubmittingPrice(false);
    }
  };

  const pendingWithdrawCount = transactions.filter(
    (tx) =>
      tx.type === "withdraw" &&
      tx.status !== "paid" &&
      tx.status !== "completed" &&
      tx.status !== "failed"
  ).length;

  const canWithdrawNow = availableBalance >= 100000;
  const withdrawMinAmount = 100000;
  const withdrawProgress = Math.min(100, Math.round((availableBalance / withdrawMinAmount) * 100));
  const withdrawShortfall = Math.max(0, withdrawMinAmount - availableBalance);

  const payoutStatusMeta = (status, { compact = false } = {}) => {
    const purpleTag =
      "border border-violet-500/30 bg-violet-500/15 text-violet-300";
    const greenTag =
      "border border-[#93f72b]/30 bg-[#93f72b]/15 text-[#93f72b]";
    if (status === "paid") {
      return { text: compact ? "Đã chuyển" : "Đã chuyển khoản", className: greenTag };
    }
    if (status === "approved") {
      return {
        text: compact ? "Chờ chuyển" : "Đã duyệt — chờ chuyển",
        className: purpleTag,
      };
    }
    if (status === "completed") {
      return { text: "Hoàn tất", className: greenTag };
    }
    if (status === "failed") {
      return { text: "Từ chối", className: "border border-rose-500/30 bg-rose-500/15 text-rose-300" };
    }
    return { text: compact ? "Đang xử lý" : "Đang xử lý", className: purpleTag };
  };

  const txDisplayTitle = (tx) => (tx?.type === "withdraw" ? withdrawTitle(tx) : incomeTitle(tx));
  const txDisplaySubtitle = (tx) => {
    if (tx?.type === "withdraw") return tx.rejectReason ? `Lý do từ chối: ${tx.rejectReason}` : "Yêu cầu rút tiền";
    const sub = incomeSubtitle(tx);
    return tx?.refunded ? [sub, "Đã hoàn tiền cho học viên"].filter(Boolean).join(" · ") : sub;
  };

  /** Tag trạng thái của khoản thu: giữ tiền (tím), đã khả dụng (xanh), chưa ghi vào ví (vàng). */
  const incomeStatusTag = (tx) => {
    const meta = incomeStatusMeta(tx);
    const className =
      meta.tone === "done"
        ? "border border-[#93f72b]/30 bg-[#93f72b]/15 text-[#93f72b]"
        : meta.tone === "warning"
          ? "border border-amber-500/40 bg-amber-500/15 text-amber-300"
          : "border border-violet-500/30 bg-violet-500/15 text-violet-300";
    return { text: meta.label, className, detail: meta.detail };
  };

  return (
    <MentorPageShell mentorRole bottomPad="pb-16" fillHeight={false} className="bg-transparent" extraStyles={MENTOR_FINANCE_EXTRA_CSS}>
      <div className="relative z-10 mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-6">
        {/* Unified Mentor Header */}
        <MentorPageHeader
          title="Quản lý"
          highlight="tài chính"
          actions={
            <button
              type="button"
              onClick={() => setShowWithdraw(true)}
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 px-5 py-2.5 text-xs font-bold text-white shadow-[0_0_20px_rgba(124,58,237,0.35)] transition hover:from-violet-500 hover:to-indigo-500"
            >
              <Wallet size={15} />
              Rút tiền ngay
            </button>
          }
        />

        {/* Hero Wallet Card */}
        <motion.section
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
          className="relative mb-6 overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-b from-[#181128]/95 to-[#120a20]/95 p-6 sm:p-8 shadow-[0_16px_40px_rgba(0,0,0,0.35)] backdrop-blur-xl"
        >
          {/* Top Hairline Glow */}
          <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#93f72b]/50 to-transparent" />

          {/* Radial glow background */}
          <div className="pointer-events-none absolute -right-20 -top-20 h-56 w-56 rounded-full bg-[#93f72b]/10 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-24 left-1/4 h-56 w-56 rounded-full bg-[#8037f4]/15 blur-3xl" />

          <div className="relative flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="min-w-0 flex-1">
              <div className="inline-flex items-center gap-2 rounded-full border border-[#93f72b]/30 bg-[#93f72b]/15 px-3 py-1">
                <Wallet size={13} className="text-[#93f72b]" strokeWidth={2.2} />
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#93f72b]">
                  Ví mentor
                </span>
              </div>

              <p className="mentor-stat-num mt-3 text-[clamp(2.25rem,4.5vw,3.25rem)] font-black text-white tracking-tight">
                <MentorMoneyText amount={availableBalance} />
              </p>
              <p className="mt-1.5 text-xs text-slate-300">
                Số dư khả dụng — rút về tài khoản ngân hàng chính chủ
              </p>

              <div className="mt-3.5 max-w-xl rounded-xl border border-white/10 bg-white/[0.03] p-3.5 text-xs leading-relaxed text-slate-300 backdrop-blur-sm">
                <span className="font-semibold text-white">Đang giữ {finance?.holdDays || 7} ngày: </span>
                <strong className="text-[#93f72b]">
                  {Number(finance?.clearingBalance || 0).toLocaleString("vi-VN")} Đ
                </strong>
                <p className="mt-1 text-[11px] text-slate-400">
                  Buổi mentor tính từ lúc hoàn tất; khóa học tính từ lúc thanh toán. Khoản có khiếu nại sẽ được giữ tới khi xử lý xong.
                </p>
              </div>

              {payoutAccountMasked ? (
                <div className="mt-3.5 inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-slate-200">
                  <BadgeCheck size={14} className="shrink-0 text-[#93f72b]" />
                  <span>
                    {payoutAccountOwnerName} · <strong className="text-white">{payoutAccountMasked}</strong>
                  </span>
                </div>
              ) : (
                <p className="mt-3.5 text-xs text-slate-400">
                  Chưa có tài khoản nhận tiền — bạn sẽ nhập khi rút lần đầu.
                </p>
              )}
            </div>

            {/* Right Rules Card */}
            <div className="flex w-full shrink-0 flex-col gap-3.5 lg:max-w-[320px]">
              <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4 backdrop-blur-sm">
                <ul className="space-y-3">
                  <li className="flex items-start gap-2.5">
                    <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-white/5 border border-white/10">
                      <BadgeCheck size={13} className="text-[#93f72b]" strokeWidth={2.2} />
                    </span>
                    <div className="min-w-0 text-xs text-slate-300">
                      <p className="font-bold text-white">Điều kiện rút</p>
                      <p className="mt-0.5 text-slate-400">Tối thiểu {formatMoney(withdrawMinAmount)} mỗi lần</p>
                    </div>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-white/5 border border-white/10">
                      <Clock size={13} className="text-slate-300" strokeWidth={2.2} />
                    </span>
                    <div className="min-w-0 text-xs text-slate-300">
                      <p className="font-bold text-white">Thời gian xử lý</p>
                      <p className="mt-0.5 text-slate-400">Admin chuyển khoản trong 1–2 ngày làm việc</p>
                    </div>
                  </li>
                </ul>

                {!canWithdrawNow && availableBalance > 0 && (
                  <div className="mt-3.5 border-t border-white/10 pt-3">
                    <div className="mb-1.5 flex items-center justify-between text-[11px]">
                      <span className="text-slate-400">Tiến độ đủ ngưỡng rút</span>
                      <span className="font-bold text-white">{withdrawProgress}%</span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
                      <div
                        className="h-full rounded-full bg-[#93f72b] transition-all duration-500 shadow-[0_0_8px_rgba(147,247,43,0.8)]"
                        style={{ width: `${withdrawProgress}%` }}
                      />
                    </div>
                    <p className="mt-1.5 text-[11px] text-amber-300">
                      Còn thiếu {formatMoney(withdrawShortfall)} để đủ điều kiện rút
                    </p>
                  </div>
                )}

                {pendingWithdrawCount > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      setActiveTab("withdraw");
                      transactionSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
                    }}
                    className="mt-3 flex w-full items-center justify-between gap-2 rounded-xl border border-[#93f72b]/30 bg-[#93f72b]/10 p-2.5 text-left transition hover:bg-[#93f72b]/15"
                  >
                    <span className="flex items-center gap-2 text-xs font-bold text-[#b8ff78]">
                      <Clock size={13} className="text-[#93f72b]" />
                      {pendingWithdrawCount} yêu cầu đang xử lý
                    </span>
                    <ArrowRight size={13} className="text-[#93f72b]" />
                  </button>
                )}
              </div>

              <motion.button
                type="button"
                onClick={() => setShowWithdraw(true)}
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.99 }}
                className={`inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#93f72b] px-6 py-3 text-xs font-black text-slate-950 transition hover:bg-[#a8ff4e] ${
                  canWithdrawNow ? "mentor-withdraw-cta-ready" : ""
                }`}
              >
                <span className="h-1.5 w-1.5 rounded-full bg-slate-950" />
                Rút tiền ngay
                <ArrowRight size={14} />
              </motion.button>
            </div>
          </div>
        </motion.section>

        {/* 2 thẻ KPI: số dư khả dụng đã hiện ở khối Ví mentor phía trên nên không lặp lại ở đây */}
        <MentorStatPanel className="mb-6" columns={2}>
          <MentorStatFrame
            index={1}
            accent="purple"
            cornerIcon={Clock}
            moneyAmount={pendingBalance}
            title="Chờ giải ngân"
            subtitle="Đã yêu cầu rút, admin chuyển khoản trong 1–2 ngày làm việc"
            compact
          />
          <MentorStatFrame
            index={2}
            accent="purple"
            cornerIcon={TrendingUp}
            moneyAmount={totalEarned}
            title="Tổng thu nhập"
            subtitle="Sau phí nền tảng"
            compact
          />
        </MentorStatPanel>

        {/* 2-Column: Transaction History & Sidebar */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 items-start">
          {/* Left: Transaction History (Col 8) */}
          <div
            ref={transactionSectionRef}
            className="overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-b from-[#181128]/95 to-[#120a20]/95 shadow-[0_16px_40px_rgba(0,0,0,0.35)] backdrop-blur-xl lg:col-span-8 relative"
          >
            {/* Top Hairline Glow */}
            <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />

            <div className="flex flex-col gap-4 border-b border-white/[0.08] px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
              <h2 className="font-headline text-base font-black text-white">
                <span className="mr-2 text-[#93f72b]">01</span>
                Lịch sử giao dịch
              </h2>

              {/* Filter Tabs */}
              <div className="flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.03] p-1">
                {TX_FILTER_TABS.map((tab) => {
                  const active = activeTab === tab.id;
                  return (
                    <button data-button-surface="none"
                      key={tab.id}
                      type="button"
                      onClick={() => setActiveTab(tab.id)}
                      className={`mw-tab rounded-lg px-3 py-1.5 text-xs font-bold transition-all ${
                        active
                          ? "bg-[#93f72b] text-slate-950 shadow-[0_0_12px_rgba(147,247,43,0.35)]"
                          : "text-slate-400 hover:text-white"
                      }`}
                    >
                      {tab.label}
                      {tab.id === "withdraw" && pendingWithdrawCount > 0 && (
                        <span className="ml-1.5 rounded-full bg-slate-950/20 px-1.5 py-0.2 text-[10px] font-black">
                          {pendingWithdrawCount}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Chọn tháng + tổng của tháng: mentor đối chiếu được khi có nhiều giao dịch */}
            <div className="border-b border-white/[0.08] px-5 py-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="w-full sm:w-56">
                  <AppSelect
                    size="default"
                    value={activeMonth}
                    onValueChange={setActiveMonth}
                    aria-label="Chọn tháng"
                    options={[
                      { value: ALL_MONTHS, label: monthLabel(ALL_MONTHS) },
                      ...txMonths.map((m) => ({ value: m, label: monthLabel(m) })),
                    ]}
                  />
                </div>
                <p className="text-[11px] text-slate-400">
                  Thực nhận = Học viên trả − Phí nền tảng{monthSummary.adjustment ? " + Điều chỉnh" : ""}
                </p>
              </div>
              {monthSummary.notCreditedCount > 0 && (
                <p className="mt-2.5 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-[11px] leading-relaxed text-amber-200">
                  Có {monthSummary.notCreditedCount} khoản ({formatMoney(monthSummary.notCreditedNet)}) chưa được ghi vào ví nên không tính vào Thực nhận. Liên hệ admin để đối soát.
                </p>
              )}
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
              <table className="w-full min-w-[46rem]">
                <thead>
                  <tr className="border-b border-white/[0.08] bg-white/[0.02] text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    <th className="px-5 py-3 text-left">Giao dịch</th>
                    <th className="px-4 py-3 text-left">Ngày</th>
                    <th className="px-4 py-3 text-right">Học viên trả</th>
                    <th className="px-4 py-3 text-right">Phí nền tảng</th>
                    <th className="px-4 py-3 text-right">Thực nhận</th>
                    <th className="min-w-[9rem] px-5 py-3 text-left">Trạng thái</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.05]">
                  {visibleTransactions.map((tx) => {
                    const isWithdraw = tx.type === "withdraw";
                    const statusMeta = isWithdraw
                      ? payoutStatusMeta(tx.status, { compact: true })
                      : incomeStatusTag(tx);
                    return (
                      <tr
                        key={tx.id}
                        className="mentor-finance-tx-row cursor-pointer transition"
                        onClick={() => setSelectedTx(tx)}
                      >
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-3">
                            <div
                              className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border ${
                                tx.type === "income"
                                  ? "border-[#93f72b]/30 bg-[#93f72b]/15 text-[#93f72b]"
                                  : "border-violet-500/30 bg-violet-500/15 text-violet-300"
                              }`}
                            >
                              {tx.type === "income" ? (
                                <ArrowUpRight size={15} strokeWidth={2.2} />
                              ) : (
                                <ArrowDownRight size={15} strokeWidth={2.2} />
                              )}
                            </div>
                            <div className="min-w-0">
                              <p className="text-xs font-bold text-white">{txDisplayTitle(tx)}</p>
                              <p className="truncate text-[10px] text-slate-400 mt-0.5">{txDisplaySubtitle(tx)}</p>
                            </div>
                          </div>
                        </td>
                        <td className="whitespace-nowrap px-4 py-3.5">
                          <p className="text-xs text-slate-300">{formatDateVN(tx.date)}</p>
                        </td>
                        <td className="whitespace-nowrap px-4 py-3.5 text-right">
                          <p className="text-xs tabular-nums text-slate-300">
                            {isWithdraw ? "—" : formatMoney(tx.grossAmount)}
                          </p>
                        </td>
                        <td className="whitespace-nowrap px-4 py-3.5 text-right">
                          {isWithdraw ? (
                            <p className="text-xs text-slate-400">—</p>
                          ) : (
                            <>
                              <p className="text-xs tabular-nums text-slate-300">−{formatMoney(tx.platformFee)}</p>
                              <p className="text-[10px] text-slate-400">{percentText(tx.platformFeeRate)}</p>
                            </>
                          )}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3.5 text-right">
                          <p
                            className={`text-xs font-bold tabular-nums ${
                              isWithdraw ? "text-slate-300" : tx.credited === false ? "text-slate-400 line-through" : "text-[#93f72b]"
                            }`}
                          >
                            {isWithdraw ? "−" : "+"}
                            {formatMoney(tx.amount)}
                          </p>
                          {!isWithdraw && Number(tx.adjustment) !== 0 && tx.adjustment != null && (
                            <p className="text-[10px] text-slate-400">
                              gồm điều chỉnh {tx.adjustment > 0 ? "+" : "−"}{formatMoney(Math.abs(tx.adjustment))}
                            </p>
                          )}
                        </td>
                        <td className="whitespace-nowrap px-5 py-3.5">
                          <span className={`glass-tag ${statusMeta.className}`}>
                            {statusMeta.text}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                  {!filteredTransactions.length && (
                    <tr>
                      <td colSpan={6} className="px-6 py-12 text-center text-xs text-slate-400">
                        Không có giao dịch phù hợp bộ lọc hiện tại.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {showTxExpandButton && (
              <div className="border-t border-white/[0.08] p-3">
                <MentorListExpandButton expanded={txExpanded} onToggle={toggleTxExpanded} />
              </div>
            )}
          </div>

          {/* Right Column: Breakdown & Settings (Col 4) */}
          <div className="flex flex-col gap-5 lg:col-span-4">
            {/* Income Sources */}
            <div className="rounded-2xl border border-white/10 bg-gradient-to-b from-[#181128]/95 to-[#120a20]/95 p-5 shadow-[0_16px_40px_rgba(0,0,0,0.35)] backdrop-blur-xl relative overflow-hidden">
              <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />
              <h3 className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Nguồn thu nhập
              </h3>
              <ul className="mt-3.5 divide-y divide-white/[0.06]">
                <li className="flex items-center justify-between gap-3 py-2.5 first:pt-0">
                  <span className="flex items-center gap-2 text-xs font-semibold text-slate-300">
                    <Calendar size={14} className="text-[#93f72b]" />
                    Từ đặt lịch
                  </span>
                  <span className="font-bold text-xs text-white">
                    {formatMoney(bookingIncome)}
                  </span>
                </li>
                <li className="flex items-center justify-between gap-3 py-2.5">
                  <span className="flex items-center gap-2 text-xs font-semibold text-slate-300">
                    <Route size={14} className="text-sky-400" />
                    Từ lộ trình
                  </span>
                  <span className="font-bold text-xs text-white">
                    {formatMoney(learningPathIncome)}
                  </span>
                </li>
                <li className="flex items-center justify-between gap-3 py-2.5">
                  <span className="flex items-center gap-2 text-xs font-semibold text-slate-300">
                    <BookOpen size={14} className="text-violet-400" />
                    Từ khóa học
                  </span>
                  <span className="font-bold text-xs text-white">
                    {formatMoney(courseIncome)}
                  </span>
                </li>
                <li className="flex items-center justify-between gap-3 pt-2.5">
                  <span className="text-xs font-bold text-white">Tổng đã ghi vào ví</span>
                  <span className="font-black text-xs text-white">
                    {formatMoney(bookingIncome + learningPathIncome + courseIncome)}
                  </span>
                </li>
              </ul>
              <p className="mt-2 text-[11px] leading-relaxed text-slate-400">
                Số sau khi trừ phí nền tảng, tính cả khoản đang giữ.
              </p>
              {Number(reconciliation?.notCreditedCount || 0) > 0 && (
                <p className="mt-2.5 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-[11px] leading-relaxed text-amber-200">
                  {reconciliation.notCreditedCount} khoản ({formatMoney(reconciliation.notCreditedTotal)}) chưa được ghi vào ví, không tính ở trên.
                </p>
              )}
            </div>

            {/* Price Per Hour Setting */}
            <div className="rounded-2xl border border-white/10 bg-gradient-to-b from-[#181128]/95 to-[#120a20]/95 p-5 shadow-[0_16px_40px_rgba(0,0,0,0.35)] backdrop-blur-xl relative overflow-hidden">
              <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />
              <h3 className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                <PenLine size={13} className="text-[#93f72b]" />
                Cập nhật mức phí Mentor
              </h3>
              <p className="mt-2.5 text-xs text-slate-300">
                Mức giá hiện tại:{" "}
                <span className="font-bold text-[#93f72b]">{formatMoney(currentPricePerHour)}/giờ</span>
              </p>

              {pendingPricePerHour ? (
                <div className="mt-3 rounded-xl border border-[#93f72b]/30 bg-[#93f72b]/10 p-3">
                  <p className="flex items-center gap-1.5 text-xs font-bold text-[#b8ff78]">
                    <Clock size={13} className="shrink-0" />
                    Đang chờ Admin duyệt giá mới
                  </p>
                  <p className="mt-1 text-xs font-black text-white">
                    {formatMoney(pendingPricePerHour)}/giờ
                  </p>
                </div>
              ) : (
                <div className="mt-3 space-y-2.5">
                  <label className={withdrawFieldLabel}>Mức giá mới (VND/giờ)</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    placeholder="VD: 350.000"
                    value={newPriceDigits ? newPriceValue.toLocaleString("vi-VN") : ""}
                    onChange={(e) => setNewPriceInput(e.target.value.replace(/\D/g, ""))}
                    className={withdrawFieldInput}
                  />
                  <button
                    type="button"
                    onClick={handleRequestPriceChange}
                    disabled={!isPriceChangeValid || submittingPrice}
                    className="w-full rounded-xl bg-[#93f72b] py-2.5 text-xs font-bold text-slate-950 shadow-[0_0_16px_rgba(147,247,43,0.3)] transition hover:bg-[#a8ff4e] disabled:opacity-40"
                  >
                    {submittingPrice ? "Đang gửi…" : "Gửi yêu cầu đổi giá"}
                  </button>
                </div>
              )}
            </div>

            {/* Commission Policy */}
            {commissionPolicy && (
              <div className="rounded-2xl border border-white/10 bg-gradient-to-b from-[#181128]/95 to-[#120a20]/95 p-5 shadow-[0_16px_40px_rgba(0,0,0,0.35)] backdrop-blur-xl relative overflow-hidden">
                <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />
                <h3 className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Chính sách phí nền tảng
                </h3>
                <div className="mt-3 space-y-2.5">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-xs font-semibold text-slate-300">Booking 1:1</span>
                    <span className="rounded-lg border border-[#93f72b]/30 bg-[#93f72b]/10 px-2.5 py-0.5 text-xs font-bold text-[#93f72b]">
                      {percentLabel(commissionPolicy.bookingRate)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-xs font-semibold text-slate-300">Khóa học</span>
                    <span className="rounded-lg border border-violet-500/30 bg-violet-500/15 px-2.5 py-0.5 text-xs font-bold text-violet-300">
                      {percentLabel(commissionPolicy.courseRate)}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Withdrawal Modal */}
      <AnimatePresence>
        {showWithdraw && (
          <WithdrawalModal
            balance={availableBalance}
            payoutAccount={payoutAccount}
            payoutAccountOwnerName={payoutAccountOwnerName}
            payoutAccountMasked={payoutAccountMasked}
            onSavePayoutAccount={async (account) => {
              try {
                const res = await updateMentorPayoutAccount(account);
                if (!res.success) {
                  toastApiError(res.error, "Không lưu được tài khoản nhận tiền.");
                  return { success: false };
                }
                setFinance((prev) => ({
                  ...(prev || {}),
                  payoutAccount: account,
                  payoutAccountMasked: res.payoutAccountMasked || prev?.payoutAccountMasked,
                  payoutAccountOwnerName: res.payoutAccountOwnerName || prev?.payoutAccountOwnerName,
                }));
                toastApiSuccess("Đã lưu tài khoản nhận tiền.");
                return { success: true };
              } catch {
                toastApiError("Lỗi kết nối khi lưu tài khoản nhận tiền.");
                return { success: false };
              }
            }}
            onSubmit={async (amount) => {
              try {
                const res = await requestMentorPayout(amount);
                if (!res.success) {
                  toastApiError(res.error, "Không gửi được yêu cầu rút tiền.");
                  return { success: false };
                }
                toastApiSuccess("Đã gửi yêu cầu rút tiền.");
                const optimisticRow = {
                  id: res.payout?.id || `local-${Date.now()}`,
                  type: "withdraw",
                  amount: Number(amount || 0),
                  status: "pending",
                  date: new Date().toISOString(),
                  description: "Yêu cầu rút tiền",
                  bankName: res.payout?.bankName || "",
                  accountMasked: res.payout?.payoutAccountMasked || "",
                };
                setFinance((prev) => ({
                  ...(prev || {}),
                  availableBalance: Math.max(0, Number(prev?.availableBalance || 0) - Number(amount || 0)),
                  pendingBalance: Number(prev?.pendingBalance || 0) + Number(amount || 0),
                  history: [optimisticRow, ...(Array.isArray(prev?.history) ? prev.history : [])],
                }));
                const refreshed = await fetchMentorFinance();
                if (refreshed.success && refreshed.finance) setFinance(refreshed.finance);
                return { success: true };
              } catch {
                toastApiError("Lỗi kết nối khi gửi yêu cầu rút tiền.");
                return { success: false };
              }
            }}
            onClose={() => setShowWithdraw(false)}
          />
        )}

        {/* Transaction Detail Modal */}
        {selectedTx && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] flex items-center justify-center overflow-y-auto bg-black/75 p-4 backdrop-blur-md sm:p-6"
            onClick={() => setSelectedTx(null)}
          >
            <motion.div
              initial={{ scale: 0.96, y: 14, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              exit={{ scale: 0.96, y: 14, opacity: 0 }}
              transition={{ duration: 0.22, ease: "easeOut" }}
              className="relative w-full max-w-lg overflow-hidden rounded-2xl border border-white/10 bg-[#140c24] p-6 text-white shadow-[0_25px_60px_rgba(0,0,0,0.7)] backdrop-blur-xl"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Top Hairline Glow */}
              <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#93f72b]/50 to-transparent" />

              <div className="mb-5 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="text-lg font-black text-white">Chi tiết giao dịch</h3>
                  <p className="text-xs text-slate-400 mt-0.5">Mã: {selectedTx.id}</p>
                </div>
                {(() => {
                  const meta = selectedTx.type === "income" ? incomeStatusTag(selectedTx) : payoutStatusMeta(selectedTx.status);
                  return <span className={`glass-tag shrink-0 ${meta.className}`}>{meta.text}</span>;
                })()}
              </div>

              {selectedTx.type === "income" ? (
                <div className="mb-5 rounded-xl border border-white/10 bg-white/[0.03] p-4 text-xs">
                  <p className="mb-2 font-semibold text-white">Cách tính thực nhận</p>
                  <dl className="space-y-1.5 tabular-nums">
                    <div className="flex justify-between">
                      <dt className="text-slate-400">Học viên thanh toán</dt>
                      <dd className="font-semibold text-white">{formatMoney(selectedTx.grossAmount)}</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-slate-400">Phí nền tảng ({percentText(selectedTx.platformFeeRate)})</dt>
                      <dd className="font-semibold text-white">−{formatMoney(selectedTx.platformFee)}</dd>
                    </div>
                    {Number(selectedTx.adjustment) !== 0 && selectedTx.adjustment != null && (
                      <div className="flex justify-between">
                        <dt className="text-slate-400">Điều chỉnh{selectedTx.refunded ? " (hoàn tiền cho học viên)" : ""}</dt>
                        <dd className="font-semibold text-white">
                          {selectedTx.adjustment > 0 ? "+" : "−"}{formatMoney(Math.abs(selectedTx.adjustment))}
                        </dd>
                      </div>
                    )}
                    <div className="flex justify-between border-t border-white/10 pt-2">
                      <dt className="font-bold text-white">Thực nhận</dt>
                      <dd className={`font-headline text-lg font-black ${selectedTx.credited === false ? "text-slate-400 line-through" : "text-[#93f72b]"}`}>
                        +{formatMoney(selectedTx.amount)}
                      </dd>
                    </div>
                  </dl>
                  {incomeStatusTag(selectedTx).detail && (
                    <p className={`mt-3 rounded-lg px-3 py-2 leading-relaxed ${selectedTx.credited === false ? "border border-amber-500/30 bg-amber-500/10 text-amber-200" : "bg-white/[0.04] text-slate-300"}`}>
                      {incomeStatusTag(selectedTx).detail}
                    </p>
                  )}
                </div>
              ) : (
                <div className="mb-5 rounded-xl border border-white/10 bg-white/[0.03] p-4">
                  <p className="text-xs text-slate-400">Số tiền rút</p>
                  <p className="mt-1 font-headline text-2xl font-black text-white">−{formatMoney(selectedTx.amount)}</p>
                </div>
              )}

              <div className="space-y-2.5 text-xs">
                <div className="flex justify-between gap-4 border-b border-white/[0.05] pb-2">
                  <span className="shrink-0 text-slate-400">Nội dung</span>
                  <span className="text-right font-semibold text-white">{txDisplayTitle(selectedTx)}</span>
                </div>
                {txDisplaySubtitle(selectedTx) && selectedTx.type === "income" && (
                  <div className="flex justify-between gap-4 border-b border-white/[0.05] pb-2">
                    <span className="shrink-0 text-slate-400">Chi tiết</span>
                    <span className="text-right font-semibold text-white">{txDisplaySubtitle(selectedTx)}</span>
                  </div>
                )}
                <div className="flex justify-between border-b border-white/[0.05] pb-2">
                  <span className="text-slate-400">
                    {selectedTx.type === "income"
                      ? selectedTx.source === "course" ? "Ngày học viên thanh toán" : "Ngày hoàn tất buổi"
                      : "Ngày gửi yêu cầu"}
                  </span>
                  <span className="font-semibold text-white">
                    {new Date(selectedTx.date).toLocaleString("vi-VN")}
                  </span>
                </div>
                {selectedTx.type === "income" && selectedTx.creditedAt && (
                  <div className="flex justify-between border-b border-white/[0.05] pb-2">
                    <span className="text-slate-400">Ghi vào ví lúc</span>
                    <span className="font-semibold text-white">{new Date(selectedTx.creditedAt).toLocaleString("vi-VN")}</span>
                  </div>
                )}
                {selectedTx.type === "income" && selectedTx.clearAt && (
                  <div className="flex justify-between border-b border-white/[0.05] pb-2">
                    <span className="text-slate-400">Hết thời gian giữ</span>
                    <span className="font-semibold text-white">{formatDateVN(selectedTx.clearAt)}</span>
                  </div>
                )}
                {selectedTx.type === "income" && selectedTx.clearedAt && (
                  <div className="flex justify-between border-b border-white/[0.05] pb-2">
                    <span className="text-slate-400">Vào số dư khả dụng</span>
                    <span className="font-semibold text-white">{new Date(selectedTx.clearedAt).toLocaleString("vi-VN")}</span>
                  </div>
                )}
                {selectedTx.type === "withdraw" && selectedTx.bankName && (
                  <div className="flex justify-between border-b border-white/[0.05] pb-2">
                    <span className="text-slate-400">Tài khoản nhận</span>
                    <span className="font-semibold text-white">{selectedTx.bankName} {selectedTx.accountMasked}</span>
                  </div>
                )}
                {selectedTx.reviewedAt && (
                  <div className="flex justify-between border-b border-white/[0.05] pb-2">
                    <span className="text-slate-400">Thời gian duyệt</span>
                    <span className="font-semibold text-white">
                      {new Date(selectedTx.reviewedAt).toLocaleString("vi-VN")}
                    </span>
                  </div>
                )}
                {selectedTx.paidAt && (
                  <div className="flex justify-between border-b border-white/[0.05] pb-2">
                    <span className="text-slate-400">Thời gian chi trả</span>
                    <span className="font-semibold text-white">
                      {new Date(selectedTx.paidAt).toLocaleString("vi-VN")}
                    </span>
                  </div>
                )}
                {selectedTx.transferRef && (
                  <div className="flex justify-between border-b border-white/[0.05] pb-2">
                    <span className="text-slate-400">Mã tham chiếu ngân hàng</span>
                    <span className="font-semibold text-[#93f72b]">{selectedTx.transferRef}</span>
                  </div>
                )}
                {selectedTx.rejectReason && (
                  <div className="rounded-xl border border-rose-500/30 bg-rose-950/40 p-3 text-rose-300">
                    <p className="font-bold">Lý do từ chối:</p>
                    <p className="mt-1">{selectedTx.rejectReason}</p>
                  </div>
                )}
                {selectedTx.note && (
                  <div className="rounded-xl border border-[#93f72b]/30 bg-[#93f72b]/10 p-3 text-[#b8ff78]">
                    <p className="font-bold">Ghi chú xử lý:</p>
                    <p className="mt-1">{selectedTx.note}</p>
                  </div>
                )}
              </div>

              <button
                type="button"
                onClick={() => setSelectedTx(null)}
                className="mt-6 w-full rounded-xl bg-white/10 py-2.5 text-xs font-bold text-white transition hover:bg-white/15"
              >
                Đóng
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </MentorPageShell>
  );
}
