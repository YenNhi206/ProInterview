import { useState, useEffect, useRef } from "react";
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
  CheckCircle2 as CheckCircle,
  Clock,
  TrendingUp,
  BadgeCheck,
  X,
} from "lucide-react";
import { getUser, getDisplayName } from "../../utils/auth/auth.js";
import { MentorPageShell } from "../../components/mentor/MentorPageShell";
import { MentorStatPanel, MentorStatFrame } from "../../components/mentor/MentorStatFrames";
import { MentorMoneyText } from "../../utils/shared/moneyDisplay.jsx";
import { fetchMentorFinance, requestMentorPayout, updateMentorPayoutAccount } from "../../api/mentorApi.js";
import { toastApiError, toastApiSuccess } from "../../utils/shared/apiToast.js";
import { formatVnd } from "../../utils/shared/formatVnd.js";
import { AppSelect } from "../../components/ui/AppSelect";

const MENTOR_FINANCE_EXTRA_CSS = `
        .glass-tag {
           display: inline-flex;
           align-items: center;
           justify-content: center;
           max-width: 100%;
           white-space: nowrap;
           padding: 4px 10px;
           border-radius: 9999px;
           font-size: 10px;
           font-weight: 700;
           line-height: 1.25;
           letter-spacing: 0;
        }
        @media (min-width: 640px) {
          .glass-tag {
            padding: 5px 12px;
            font-size: 11px;
          }
        }
        .withdraw-modal-card {
           background: #ffffff;
           border-radius: 16px;
           border: 1px solid rgba(128, 55, 244, 0.14);
           box-shadow:
             0 24px 64px rgba(128, 55, 244, 0.1),
             0 8px 24px rgba(15, 23, 42, 0.06);
           overflow: hidden;
        }
        @keyframes mentor-finance-tx-pulse {
          0% { transform: scale3d(1, 1, 1); }
          50% { transform: scale3d(1.008, 1.008, 1.008); }
          100% { transform: scale3d(1, 1, 1); }
        }
        .mentor-finance-tx-row {
          transform-origin: center center;
          transition: background-color 0.2s ease;
        }
        .mentor-finance-tx-row:hover {
          background-color: rgba(248, 250, 252, 0.95);
          animation: mentor-finance-tx-pulse 0.85s ease-in-out;
        }
        @media (prefers-reduced-motion: reduce) {
          .mentor-finance-tx-row:hover { animation: none; }
        }
        @keyframes mentor-withdraw-cta-glow {
          0%, 100% { box-shadow: 0 0 0 0 rgba(147, 247, 43, 0.45), 0 12px 32px rgba(147, 247, 43, 0.28); }
          50% { box-shadow: 0 0 0 6px rgba(147, 247, 43, 0.12), 0 16px 40px rgba(147, 247, 43, 0.38); }
        }
        .mentor-withdraw-cta-ready {
          animation: mentor-withdraw-cta-glow 2.4s ease-in-out infinite;
        }
        @media (prefers-reduced-motion: reduce) {
          .mentor-withdraw-cta-ready { animation: none; }
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

function commissionPolicyNote(policy) {
  if (!policy) return "Mức phí tiêu chuẩn";
  if (policy.isEarlyMentorActive && policy.earlyMentorExpiresAt) {
    return `Ưu đãi Early Mentor đến ${new Date(policy.earlyMentorExpiresAt).toLocaleDateString("vi-VN")}`;
  }
  if (policy.isEarlyMentor && policy.earlyMentorExpiresAt) {
    return `Early Mentor kết thúc ${new Date(policy.earlyMentorExpiresAt).toLocaleDateString("vi-VN")}`;
  }
  return "Mức phí tiêu chuẩn";
}

const withdrawFieldLabel =
  "mb-1.5 block text-xs font-semibold text-slate-700";
const withdrawFieldInput =
  "w-full rounded-lg border border-slate-200/90 bg-white px-3.5 py-2.5 text-sm font-semibold text-slate-900 outline-none transition-all placeholder:text-slate-400 focus:border-[#8037f4] focus:bg-[#faf8ff] focus:ring-2 focus:ring-[#8037f4]/12";

const SUPPORTED_BANKS = [
  "Vietcombank",
  "BIDV",
  "VietinBank",
  "Agribank",
  "Techcombank",
  "MB Bank",
  "ACB",
  "VPBank",
  "TPBank",
  "Sacombank",
  "HDBank",
  "VIB",
  "SHB",
  "OCB",
  "Eximbank",
  "SeABank",
  "PVcomBank",
  "Nam A Bank",
];

const BANK_OTHER = "__other__";

function resolveBankFields(savedName) {
  const name = String(savedName || "").trim();
  if (!name) return { select: "", custom: "" };
  if (SUPPORTED_BANKS.includes(name)) return { select: name, custom: "" };
  return { select: BANK_OTHER, custom: name };
}

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
    isValidBankName(effectiveBankName) &&
    /^\d{8,19}$/.test(accountDigits);
  const isAccountChanged =
    effectiveBankName !== (payoutAccount?.bankName || "").trim() ||
    accountDigits !== (payoutAccount?.accountNumber || "");

  const persistAccount = async () => {
    if (!isAccountReady) return { success: false, error: "Vui lòng nhập đủ thông tin tài khoản nhận tiền." };
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
      className="fixed inset-0 z-[200] flex items-center justify-center overflow-y-auto bg-slate-900/50 p-4 backdrop-blur-sm sm:p-6"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.98, y: 12, opacity: 0 }}
        animate={{ scale: 1, y: 0, opacity: 1 }}
        exit={{ scale: 0.98, y: 12, opacity: 0 }}
        className="withdraw-modal-card my-6 w-full max-w-[28rem] shrink-0"
        onClick={(e) => e.stopPropagation()}
      >
          {success ? (
            <div className="space-y-5 p-6 text-center sm:p-8">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[#93f72b]/20 ring-4 ring-[#93f72b]/10">
                <CheckCircle size={36} className="text-[#630ed4]" strokeWidth={2.5} />
              </div>
              <div>
                <h2 className="text-xl font-bold text-slate-900">Yêu cầu đã gửi</h2>
                <p className="mt-2 text-sm leading-relaxed text-slate-500">
                  Admin sẽ xử lý và chuyển khoản trong 1–2 ngày làm việc.
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="w-full rounded-lg bg-[#8037f4] py-3 text-sm font-semibold text-white transition-colors hover:bg-[#6d2fd6]"
              >
                Đóng
              </button>
            </div>
          ) : (
            <>
              <div className="bg-gradient-to-r from-[#630ed4] to-[#8037f4] px-5 py-4 text-white sm:px-6">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white/15 backdrop-blur-sm">
                      <Wallet size={20} strokeWidth={2.25} />
                    </span>
                    <div>
                      <h2 className="text-lg font-bold leading-tight">Rút tiền</h2>
                      <p className="mt-1 text-sm text-white/85">
                        Số dư khả dụng{" "}
                        <span className="font-bold text-[#93f72b]">
                          {balance.toLocaleString("vi-VN")} Đ
                        </span>
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={onClose}
                    className="shrink-0 rounded-lg p-1.5 text-white/80 transition-colors hover:bg-white/15 hover:text-white"
                    aria-label="Đóng"
                  >
                    <X size={18} />
                  </button>
                </div>
              </div>

              <div className="space-y-5 p-5 sm:p-6">
                <section className="rounded-xl border border-[#8037f4]/10 bg-[#faf8ff]/70 p-4">
                  <p className="mb-3 text-xs font-normal text-[#630ed4]">Tài khoản nhận tiền</p>
                  <div className="space-y-3">
                    <div>
                      <label className={withdrawFieldLabel}>Ngân hàng</label>
                      <AppSelect
                        size="md"
                        value={bankSelect || undefined}
                        onValueChange={(v) => {
                          setBankSelect(v);
                          if (v !== BANK_OTHER) setCustomBankName("");
                        }}
                        placeholder="Chọn ngân hàng"
                        triggerClassName={withdrawFieldInput}
                        options={[
                          ...SUPPORTED_BANKS.map((bank) => ({ value: bank, label: bank })),
                          { value: BANK_OTHER, label: "Ngân hàng khác…" },
                        ]}
                      />
                      {bankSelect === BANK_OTHER ? (
                        <div className="mt-3">
                          <label className={withdrawFieldLabel}>Tên ngân hàng</label>
                          <input
                            type="text"
                            autoComplete="off"
                            placeholder="VD: MSB, SCB, Liên Việt PostBank"
                            maxLength={80}
                            value={customBankName}
                            onChange={(e) => setCustomBankName(e.target.value)}
                            className={withdrawFieldInput}
                          />
                          <p className="mt-1.5 text-[11px] leading-relaxed text-slate-500">
                            Nhập đúng tên ngân hàng trên ứng dụng hoặc thẻ ATM của bạn.
                          </p>
                        </div>
                      ) : null}
                    </div>
                    <div>
                      <label className={withdrawFieldLabel}>Số tài khoản</label>
                      <input
                        type="text"
                        inputMode="numeric"
                        autoComplete="off"
                        placeholder="8–19 chữ số"
                        value={accountNumber}
                        onChange={(e) => setAccountNumber(e.target.value.replace(/\D/g, ""))}
                        className={`${withdrawFieldInput} tabular-nums tracking-wide`}
                      />
                    </div>
                  </div>

                  <div className="mt-3 flex gap-3 rounded-lg border border-[#8037f4]/12 bg-white px-3 py-2.5">
                    <BadgeCheck size={18} className="mt-0.5 shrink-0 text-[#8037f4]" aria-hidden />
                    <div className="min-w-0 text-xs leading-relaxed text-slate-600">
                      <p className="font-semibold text-slate-900">{payoutAccountOwnerName || "Mentor"}</p>
                      <p className="mt-0.5">
                        Tên theo hồ sơ đã xác minh — STK phải trùng chính chủ.
                        {payoutAccountMasked ? (
                          <span className="text-slate-500"> · Đã lưu {payoutAccountMasked}</span>
                        ) : null}
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={persistAccount}
                    disabled={!isAccountReady || savingAccount}
                    className="mt-3 w-full rounded-lg border border-[#8037f4]/25 bg-white py-2 text-sm font-semibold text-[#630ed4] transition-colors hover:bg-[#8037f4]/5 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {savingAccount ? "Đang lưu…" : "Lưu tài khoản"}
                  </button>
                </section>

                <section>
                  <label className={withdrawFieldLabel}>Số tiền muốn rút</label>
                  <div className="relative mt-1">
                    <input
                      type="text"
                      inputMode="numeric"
                      placeholder="500.000"
                      value={amountDigits ? amountValue.toLocaleString("vi-VN") : ""}
                      onChange={(e) => setAmount(e.target.value.replace(/\D/g, ""))}
                      className={`${withdrawFieldInput} py-3 pr-12 text-lg font-bold text-[#630ed4] placeholder:font-medium placeholder:text-slate-400`}
                    />
                    <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-sm font-normal text-slate-400">
                      Đ
                    </span>
                  </div>
                  <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500">
                    <span>
                      Rút:{" "}
                      <strong className="font-normal text-slate-800">
                        {amountValue.toLocaleString("vi-VN")} Đ
                      </strong>
                    </span>
                    <span className="hidden text-slate-300 sm:inline">·</span>
                    <span>Tối thiểu 100.000 Đ</span>
                  </p>
                </section>

                <button
                  type="button"
                  onClick={handleWithdraw}
                  disabled={!hasEnoughAmount || loading || savingAccount || !isAccountReady}
                  className="w-full rounded-lg bg-[#93f72b] py-3.5 text-sm font-bold text-slate-900 shadow-[0_6px_20px_rgba(147,247,43,0.35)] transition-all hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none"
                >
                  {loading ? "Đang xử lý…" : "Xác nhận gửi yêu cầu"}
                </button>

                {!isAccountReady ? (
                  <p className="text-center text-xs text-amber-700">
                    Chọn hoặc nhập tên ngân hàng và STK hợp lệ (8–19 số) để tiếp tục.
                  </p>
                ) : null}
              </div>
            </>
          )}
        </motion.div>
    </motion.div>,
    document.body,
  );
}

/* ── Main Finance Component ────────────────────────────────────────── */
export function MentorFinance() {
  const navigate = useNavigate();
  const user = getUser();
  const [activeTab, setActiveTab] = useState("all");
  const [showWithdraw, setShowWithdraw] = useState(false);
  const [finance, setFinance] = useState(null);
  const [selectedTx, setSelectedTx] = useState(null);
  const transactionSectionRef = useRef(null);

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

  if (!user || user.role !== "mentor") return null;

  const availableBalance = Number(finance?.availableBalance || 0);
  const pendingBalance = Number(finance?.pendingBalance || 0);
  const totalEarned = Number(finance?.totalEarned || 0);
  const bookingIncome = Number(finance?.incomeBreakdown?.booking || 0);
  const courseIncome = Number(finance?.incomeBreakdown?.course || 0);
  const payoutAccount = finance?.payoutAccount || {};
  const payoutAccountMasked = finance?.payoutAccountMasked || "";
  const payoutAccountOwnerName = finance?.payoutAccountOwnerName || getDisplayName(user, "Mentor");
  const transactions = Array.isArray(finance?.history) ? finance.history : [];
  const commissionPolicy = finance?.commissionPolicy || null;
  const filteredTransactions = transactions.filter((tx) => {
    if (activeTab === "all") return true;
    if (activeTab === "income") return tx.type === "income";
    return tx.type === "withdraw";
  });
  const pendingWithdrawCount = transactions.filter(
    (tx) =>
      tx.type === "withdraw" &&
      tx.status !== "paid" &&
      tx.status !== "completed" &&
      tx.status !== "failed",
  ).length;
  const canWithdrawNow = availableBalance >= 100000;
  const withdrawMinAmount = 100000;
  const withdrawProgress = Math.min(100, Math.round((availableBalance / withdrawMinAmount) * 100));
  const withdrawShortfall = Math.max(0, withdrawMinAmount - availableBalance);
  const payoutStatusMeta = (status, { compact = false } = {}) => {
    const purpleTag =
      "border border-[#8037f4]/40 bg-[#8037f4]/12 text-[#8037f4]";
    const greenTag =
      "border border-[#93f72b]/50 bg-[#93f72b]/25 text-slate-800";
    if (status === "paid") {
      return { text: compact ? "Đã chuyển" : "Đã chuyển khoản", className: greenTag };
    }
    if (status === "approved") {
      return {
        text: compact ? "Chờ chuyển khoản" : "Đã duyệt — chờ chuyển khoản",
        className: purpleTag,
      };
    }
    if (status === "completed") {
      return { text: "Hoàn tất", className: greenTag };
    }
    if (status === "failed") {
      return { text: "Từ chối", className: purpleTag };
    }
    return { text: compact ? "Đang xử lý" : "Đang xử lý", className: purpleTag };
  };
  const txDisplayTitle = (tx) => {
    if (tx?.type === "withdraw") return "Yêu cầu rút tiền";
    const raw = String(tx?.description || "").toLowerCase();
    if (tx?.type === "income") {
      if (raw.includes("booking")) return "Thu nhập buổi tư vấn";
      if (raw.includes("khóa học")) return "Thu nhập khóa học";
      return "Thu nhập";
    }
    if (raw.includes("rút tiền")) return "Yêu cầu rút tiền";
    return tx?.description || "Giao dịch";
  };
  return (
    <MentorPageShell
      bottomPad="pb-20"
      showAmbient={false}
      className="!bg-[#f8f9fc]"
      extraStyles={MENTOR_FINANCE_EXTRA_CSS}
    >
      <div className="relative z-10 mx-auto max-w-[1280px] px-4 pb-12 sm:px-6 lg:px-10">

        <motion.header
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
          className="mb-6 flex flex-col gap-4 pt-2 sm:mb-8 lg:flex-row lg:items-start lg:justify-between"
        >
          <div>
            <h1 className="font-headline text-[clamp(1.75rem,4vw,2.75rem)] font-black leading-tight tracking-tight text-slate-900">
              Quản lý <span className="text-[#8037f4]">tài chính</span>
            </h1>
            <p className="mt-2 max-w-xl text-sm text-slate-500">
              Theo dõi thu nhập, giao dịch và dòng tiền.
            </p>
          </div>
        </motion.header>

        <motion.section
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.05, ease: [0.22, 1, 0.36, 1] }}
          className="relative mb-6 overflow-hidden rounded-2xl border border-[#93f72b]/25 bg-gradient-to-br from-slate-900 via-[#1a0d35] to-[#2a1450] p-6 shadow-[0_20px_48px_rgba(128,55,244,0.22)] sm:mb-8 sm:p-8"
        >
          <div
            className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-[#93f72b]/20 blur-3xl"
            aria-hidden
          />
          <div
            className="pointer-events-none absolute -bottom-20 left-1/3 h-40 w-40 rounded-full bg-[#8037f4]/25 blur-3xl"
            aria-hidden
          />
          <div className="relative flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="min-w-0">
              <div className="inline-flex items-center gap-2 rounded-full bg-[#93f72b]/15 px-3 py-1 ring-1 ring-[#93f72b]/30">
                <Wallet size={14} className="text-[#93f72b]" strokeWidth={2.25} />
                <span className="text-[11px] font-bold uppercase tracking-widest text-[#93f72b]">
                  Ví mentor
                </span>
              </div>
              <p className="mentor-stat-num mentor-stat-num--hero mentor-stat-num--on-dark mentor-stat-num--money mt-4 text-[clamp(2rem,5vw,3.25rem)]">
                <MentorMoneyText amount={availableBalance} />
              </p>
              <p className="mt-2 text-sm text-violet-200/90">Số dư khả dụng — rút về tài khoản ngân hàng</p>
              {payoutAccountMasked ? (
                <p className="mt-4 inline-flex max-w-full items-center gap-2 truncate rounded-xl bg-white/10 px-3 py-2 text-xs font-medium text-white/85 ring-1 ring-white/10">
                  <BadgeCheck size={14} className="shrink-0 text-[#93f72b]" />
                  <span className="truncate">{payoutAccountOwnerName} · {payoutAccountMasked}</span>
                </p>
              ) : (
                <p className="mt-4 text-xs text-violet-300/90">
                  Chưa có tài khoản nhận tiền — bạn sẽ nhập khi rút lần đầu.
                </p>
              )}
            </div>
            <div className="flex w-full shrink-0 flex-col gap-4 lg:max-w-[320px]">
              <div className="rounded-xl border border-white/10 bg-white/[0.06] p-4 backdrop-blur-sm">
                <ul className="space-y-3">
                  <li className="flex items-start gap-2.5">
                    <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-white/10">
                      <BadgeCheck size={13} className="text-[#93f72b]" strokeWidth={2.25} />
                    </span>
                    <div className="min-w-0 text-xs leading-relaxed text-violet-100/85">
                      <p className="font-semibold text-white">Điều kiện rút</p>
                      <p className="mt-0.5">Tối thiểu {formatMoney(withdrawMinAmount)} mỗi lần</p>
                    </div>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-white/10">
                      <Clock size={13} className="text-white/70" strokeWidth={2.25} />
                    </span>
                    <div className="min-w-0 text-xs leading-relaxed text-violet-100/85">
                      <p className="font-semibold text-white">Thời gian xử lý</p>
                      <p className="mt-0.5">Admin chuyển khoản trong 1–2 ngày làm việc</p>
                    </div>
                  </li>
                </ul>

                {!canWithdrawNow && availableBalance > 0 ? (
                  <div className="mt-4 border-t border-white/10 pt-4">
                    <div className="mb-2 flex items-center justify-between gap-2 text-[11px]">
                      <span className="font-medium text-violet-200/90">Tiến độ đủ ngưỡng rút</span>
                      <span className="font-bold tabular-nums text-white">{withdrawProgress}%</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-white/10">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-[#93f72b] to-[#b8ff5c] transition-all duration-500"
                        style={{ width: `${withdrawProgress}%` }}
                      />
                    </div>
                    <p className="mt-2 text-[11px] leading-relaxed text-amber-100/90">
                      Còn thiếu <span className="font-semibold text-amber-200">{formatMoney(withdrawShortfall)}</span> để đủ điều kiện rút
                    </p>
                  </div>
                ) : null}

                {pendingWithdrawCount > 0 ? (
                  <button
                    type="button"
                    onClick={() => {
                      setActiveTab("withdraw");
                      transactionSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
                    }}
                    className="mt-4 flex w-full items-center justify-between gap-3 rounded-lg border border-[#93f72b]/25 bg-[#93f72b]/10 px-3 py-2.5 text-left transition hover:bg-[#93f72b]/15"
                  >
                    <span className="flex min-w-0 items-center gap-2.5">
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#93f72b]/25 ring-1 ring-[#93f72b]/35">
                        <Clock size={13} className="text-[#93f72b]" strokeWidth={2.5} />
                      </span>
                      <span className="truncate text-xs font-semibold text-white">
                        {pendingWithdrawCount} yêu cầu đang xử lý
                      </span>
                    </span>
                    <ArrowRight size={14} className="shrink-0 text-[#93f72b]" strokeWidth={2.5} />
                  </button>
                ) : null}
              </div>

              <motion.button
                type="button"
                onClick={() => setShowWithdraw(true)}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className={`inline-flex w-full items-center justify-center gap-2.5 rounded-xl bg-[#93f72b] px-7 py-3.5 text-sm font-black text-slate-900 transition hover:brightness-105 sm:text-base ${
                  canWithdrawNow ? "mentor-withdraw-cta-ready" : ""
                }`}
              >
                <span className="size-2 shrink-0 rounded-full bg-slate-900" aria-hidden />
                Rút tiền ngay
                <ArrowRight size={18} strokeWidth={2.5} />
              </motion.button>
            </div>
          </div>
        </motion.section>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, delay: 0.08, ease: [0.22, 1, 0.36, 1] }}
        >
          <MentorStatPanel>
            <MentorStatFrame
              index={1}
              accent="lime"
              cornerIcon={Wallet}
              moneyAmount={availableBalance}
              title="Số dư khả dụng"
              footer={
                <button
                  type="button"
                  onClick={() => setShowWithdraw(true)}
                  className="mt-3 inline-flex items-center gap-1 text-xs font-bold text-[#8037f4] transition hover:text-[#630ed4]"
                >
                  Rút ngay
                  <ArrowRight size={12} />
                </button>
              }
            />
            <MentorStatFrame
              index={2}
              accent="lime"
              cornerIcon={Clock}
              moneyAmount={pendingBalance}
              title="Chờ giải ngân"
              footer={
                <p className="mt-3 flex items-center gap-1.5 text-xs text-slate-500">
                  <Clock size={12} className="shrink-0 text-slate-600" />
                  Dự kiến sau 7 ngày
                </p>
              }
            />
            <MentorStatFrame
              index={3}
              accent="purple"
              cornerIcon={TrendingUp}
              moneyAmount={totalEarned}
              title="Tổng thu nhập"
              footer={
                <p className="mt-3 flex items-center gap-1.5 text-xs text-violet-500/80">
                  <Clock size={12} className="shrink-0 text-[#8037f4]" />
                  Sau phí nền tảng
                </p>
              }
            />
          </MentorStatPanel>
        </motion.div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          <motion.div
            ref={transactionSectionRef}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.14, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-[0_1px_3px_rgba(15,23,42,0.04)] lg:col-span-8"
          >
            <div className="flex flex-col gap-4 border-b border-slate-100 px-4 py-5 sm:px-6 sm:flex-row sm:items-end sm:justify-between">
              <h2 className="font-headline text-lg font-black tracking-tight text-slate-900">
                <span className="mr-2 text-[#8037f4]">01</span>
                Lịch sử giao dịch
              </h2>
              <div className="flex gap-1 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {TX_FILTER_TABS.map((tab) => {
                  const active = activeTab === tab.id;
                  const isWithdrawTab = tab.id === "withdraw";
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setActiveTab(tab.id)}
                      className={`relative shrink-0 whitespace-nowrap px-3 py-2 text-xs sm:text-sm ${
                        active
                          ? isWithdrawTab
                            ? "font-bold text-slate-900"
                            : "font-bold text-slate-900"
                          : isWithdrawTab
                            ? "font-semibold text-[#8037f4] hover:text-[#630ed4]"
                            : "font-medium text-slate-500 hover:text-slate-700"
                      }`}
                    >
                      <span className="inline-flex items-center gap-1.5">
                        {tab.label}
                        {isWithdrawTab && pendingWithdrawCount > 0 ? (
                          <span className="rounded-full bg-[#93f72b] px-1.5 py-0.5 text-[10px] font-bold leading-none text-slate-900">
                            {pendingWithdrawCount}
                          </span>
                        ) : null}
                      </span>
                      {active && (
                        <motion.span
                          layoutId="mentorFinanceTabUnderline"
                          className={`absolute bottom-0 left-2 right-2 h-0.5 rounded-full ${
                            isWithdrawTab ? "bg-[#93f72b]" : "bg-[#8037f4]"
                          }`}
                          transition={{ type: "spring", stiffness: 420, damping: 32 }}
                        />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/70 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                    <th className="px-4 py-3 text-left sm:px-6">Giao dịch</th>
                    <th className="px-4 py-3 text-left sm:px-6">Ngày</th>
                    <th className="px-4 py-3 text-left sm:px-6">Số tiền</th>
                    <th className="min-w-[7.5rem] px-4 py-3 text-left sm:px-6">Trạng thái</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredTransactions.map((tx) => {
                    const statusMeta = payoutStatusMeta(tx.status, { compact: true });
                    const isWithdraw = tx.type === "withdraw";
                    const isPendingWithdraw =
                      isWithdraw &&
                      tx.status !== "paid" &&
                      tx.status !== "completed" &&
                      tx.status !== "failed";
                    return (
                    <tr
                      key={tx.id}
                      className={`mentor-finance-tx-row cursor-pointer ${
                        isWithdraw ? "bg-gradient-to-r from-[#8037f4]/[0.04] to-transparent" : ""
                      } ${isPendingWithdraw ? "ring-1 ring-inset ring-[#93f72b]/25" : ""}`}
                      onClick={() => setSelectedTx(tx)}
                    >
                      <td className="px-4 py-4 sm:px-6">
                        <div className="flex items-center gap-3">
                          <div
                            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${
                              tx.type === "income"
                                ? "bg-[#93f72b]/25 text-slate-800 ring-1 ring-[#93f72b]/40"
                                : isPendingWithdraw
                                  ? "bg-[#8037f4] text-white ring-2 ring-[#93f72b]/50"
                                  : "bg-[#8037f4]/12 text-[#8037f4] ring-1 ring-[#8037f4]/20"
                            }`}
                          >
                            {tx.type === "income" ? (
                              <ArrowUpRight size={16} strokeWidth={2.5} />
                            ) : (
                              <ArrowDownRight size={16} strokeWidth={2.5} />
                            )}
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-bold text-slate-900">{txDisplayTitle(tx)}</p>
                            <p className="truncate text-[11px] text-slate-500">{tx.id}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-4 sm:px-6">
                        <p className="text-sm font-medium text-slate-700">
                          {new Date(tx.date).toLocaleDateString("vi-VN")}
                        </p>
                      </td>
                      <td className="whitespace-nowrap px-4 py-4 sm:px-6">
                        <p
                          className={`mentor-money-num font-headline text-sm font-bold tabular-nums sm:text-base ${
                            tx.type === "income"
                              ? "text-emerald-600"
                              : isPendingWithdraw
                                ? "text-[#8037f4]"
                                : "text-slate-900"
                          }`}
                        >
                          {tx.type === "income" ? "+" : "−"}
                          {formatVnd(tx.amount || 0)}
                        </p>
                      </td>
                      <td className="whitespace-nowrap px-4 py-4 sm:px-6">
                        <span className={`glass-tag ${statusMeta.className}`}>
                          {statusMeta.text}
                        </span>
                      </td>
                    </tr>
                    );
                  })}
                  {!filteredTransactions.length && (
                    <tr>
                      <td colSpan={4} className="px-6 py-12 text-center text-sm text-slate-500">
                        Không có giao dịch phù hợp bộ lọc hiện tại.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </motion.div>

          <motion.aside
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.18, ease: [0.22, 1, 0.36, 1] }}
            className="flex flex-col gap-4 lg:col-span-4"
          >
            <div className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-[0_1px_3px_rgba(15,23,42,0.04)]">
              <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                Nguồn thu nhập
              </h3>
              <ul className="mt-4 divide-y divide-slate-100">
                <li className="flex items-center justify-between gap-3 py-3 first:pt-0">
                  <span className="flex items-center gap-2 text-sm font-medium text-slate-700">
                    <Calendar size={15} className="text-[#8037f4]" />
                    Từ đặt lịch
                  </span>
                  <span className="font-headline text-sm font-bold text-slate-900">
                    {formatMoney(bookingIncome)}
                  </span>
                </li>
                <li className="flex items-center justify-between gap-3 py-3">
                  <span className="flex items-center gap-2 text-sm font-medium text-slate-700">
                    <BookOpen size={15} className="text-[#8037f4]" />
                    Từ khóa học
                  </span>
                  <span className="font-headline text-sm font-bold text-slate-900">
                    {formatMoney(courseIncome)}
                  </span>
                </li>
              </ul>
            </div>

            {commissionPolicy ? (
              <div className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-[0_1px_3px_rgba(15,23,42,0.04)]">
                <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  Chính sách phí
                </h3>
                <div className="mt-4 space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-bold text-slate-800">Booking</p>
                      {commissionPolicy.bookingRateSource === "mentor_custom" && (
                        <p className="text-[11px] text-violet-600">Mức riêng theo hợp đồng</p>
                      )}
                    </div>
                    <span className="rounded-full bg-[#8037f4]/12 px-3 py-1 text-xs font-bold text-[#8037f4] ring-1 ring-[#8037f4]/20">
                      {percentLabel(commissionPolicy.bookingRate)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-bold text-slate-800">Khóa học</p>
                      {commissionPolicy.courseRateSource === "mentor_custom" && (
                        <p className="text-[11px] text-violet-600">Mức riêng theo hợp đồng</p>
                      )}
                    </div>
                    <span className="rounded-full bg-[#8037f4]/12 px-3 py-1 text-xs font-bold text-[#8037f4] ring-1 ring-[#8037f4]/20">
                      {percentLabel(commissionPolicy.courseRate)}
                    </span>
                  </div>
                </div>
                <p className="mt-4 flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider text-[#8037f4]">
                  {commissionPolicyNote(commissionPolicy)}
                  <ArrowRight size={12} />
                </p>
              </div>
            ) : null}
          </motion.aside>
        </div>
      </div>

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
                payoutAccount: res.payoutAccount || account,
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
        {selectedTx && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] flex items-center justify-center overflow-y-auto bg-slate-900/50 p-4 backdrop-blur-sm sm:p-6"
            onClick={() => setSelectedTx(null)}
          >
            <motion.div
              initial={{ scale: 0.95, y: 20, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              exit={{ scale: 0.95, y: 20, opacity: 0 }}
              className="w-full max-w-lg rounded-2xl border border-[#8037f4]/20 bg-white p-8 shadow-xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="mb-6 flex items-start justify-between gap-3">
                <h3 className="text-2xl font-bold text-[#630ed4]">Chi tiết giao dịch</h3>
                <span className={`glass-tag ${payoutStatusMeta(selectedTx.status).className}`}>
                  {payoutStatusMeta(selectedTx.status).text}
                </span>
              </div>

              <div className="mb-5 rounded-2xl border border-[#8037f4]/20 bg-[#8037f4]/5 px-5 py-4">
                <p className="mb-2 text-sm font-semibold text-[#8037f4]">Số tiền giao dịch</p>
                <p
                  className={`mentor-money-num text-xl sm:text-2xl ${
                    selectedTx.type === "income" ? "text-[#630ed4]" : "text-slate-900"
                  }`}
                >
                  {selectedTx.type === "income" ? "+" : "-"}
                  {Number(selectedTx.amount || 0).toLocaleString("vi-VN")} Đ
                </p>
              </div>

              <div className="space-y-3 text-sm font-medium">
                <p className="text-slate-900">
                  <span className="font-bold text-[#8037f4]">Mã giao dịch:</span> {selectedTx.id}
                </p>
                <p className="text-slate-900">
                  <span className="font-bold text-[#8037f4]">Loại:</span>{" "}
                  {selectedTx.type === "income" ? "Thu nhập" : "Rút tiền"}
                </p>
                <p className="text-slate-900">
                  <span className="font-bold text-[#8037f4]">Mô tả:</span> {txDisplayTitle(selectedTx)}
                </p>
                <p className="text-slate-900">
                  <span className="font-bold text-[#8037f4]">Thời gian:</span>{" "}
                  {new Date(selectedTx.date).toLocaleString("vi-VN")}
                </p>
                {selectedTx.reviewedAt ? (
                  <p className="text-slate-900">
                    <span className="font-bold text-[#8037f4]">Thời gian xử lý:</span>{" "}
                    {new Date(selectedTx.reviewedAt).toLocaleString("vi-VN")}
                  </p>
                ) : null}
                {selectedTx.paidAt ? (
                  <p className="text-slate-900">
                    <span className="font-bold text-[#8037f4]">Thời điểm đã chi:</span>{" "}
                    {new Date(selectedTx.paidAt).toLocaleString("vi-VN")}
                  </p>
                ) : null}
                {selectedTx.transferRef ? (
                  <p className="text-slate-900">
                    <span className="font-bold text-[#8037f4]">Tham chiếu chuyển khoản:</span> {selectedTx.transferRef}
                  </p>
                ) : null}
                {selectedTx.providerRef ? (
                  <p className="text-slate-900">
                    <span className="font-bold text-[#8037f4]">Mã tham chiếu:</span> {selectedTx.providerRef}
                  </p>
                ) : null}
                {selectedTx.rejectReason ? (
                  <div className="rounded-xl border border-[#8037f4]/25 bg-[#8037f4]/8 p-3">
                    <p className="text-sm font-bold text-[#630ed4]">Lý do từ chối</p>
                    <p className="mt-1 text-sm text-slate-800">{selectedTx.rejectReason}</p>
                  </div>
                ) : null}
                {selectedTx.note ? (
                  <div className="rounded-xl border border-[#93f72b]/35 bg-[#93f72b]/15 p-3">
                    <p className="text-sm font-bold text-[#630ed4]">Ghi chú xử lý</p>
                    <p className="mt-1 text-sm text-slate-800">{selectedTx.note}</p>
                  </div>
                ) : null}
              </div>
              <button
                type="button"
                onClick={() => setSelectedTx(null)}
                className="mt-8 w-full rounded-xl bg-[#93f72b] py-3 text-sm font-bold text-[#120B2E] shadow-[0_8px_24px_rgba(147,247,43,0.35)] transition hover:brightness-105"
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
