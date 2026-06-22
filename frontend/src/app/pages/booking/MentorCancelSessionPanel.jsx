import { motion } from "motion/react";
import { AlertCircle as WarningCircle } from "lucide-react";
import { AppSelect } from "../../components/ui/AppSelect";
import { formatVnd } from "../../utils/shared/formatVnd.js";

/**
 * Giao diện xử lý sau khi mentor hủy / no-show — học viên chọn phương án hoặc điền STK.
 */
export function MentorCancelSessionPanel({
  sessionData,
  mode,
  needsChoose,
  mentorResolutionStep,
  setMentorResolutionStep,
  resolutionBusy,
  onResolve,
  rescheduleDate,
  rescheduleSlot,
  setRescheduleDate,
  setRescheduleSlot,
  rescheduleSlotOptions,
  loadingRescheduleSlots,
  refundBankName,
  setRefundBankName,
  refundAccountNumber,
  setRefundAccountNumber,
  refundAccountHolder,
  setRefundAccountHolder,
  refundBankFormTitle,
  needsRefundBankForm,
  refundDestBusy,
  onSubmitRefundDestination,
  onGoRebookMentors,
}) {
  if (!sessionData) return null;

  const refundAmt = Number(sessionData.cancelRefundAmountVnd || sessionData.price || 0);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="mb-8 space-y-6"
    >
      <motion.div className="rounded-[22px] border-2 border-violet-300/80 bg-gradient-to-br from-violet-50 via-white to-violet-50/40 p-6 shadow-sm sm:p-8">
        <div className="mb-6 flex items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border-2 border-violet-300 bg-violet-100">
            <WarningCircle className="h-6 w-6 text-violet-800" />
          </div>
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-violet-800">
              {mode === "no_show"
                ? "Mentor không tham gia"
                : mode === "late_refund"
                  ? "Mentor hủy gấp"
                  : "Mentor đã hủy lịch hẹn"}
            </p>
            <h2 className="mt-1 text-xl font-black tracking-tight text-slate-900">
              {mode === "choose"
                ? "Chọn phương án xử lý"
                : mode === "late_refund" || mode === "no_show"
                  ? "Hoàn tiền ưu tiên 100%"
                  : mode === "change_mentor_done"
                    ? "Đã chọn đổi mentor"
                    : "Buổi hẹn không còn hiệu lực"}
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">
              {mode === "choose" ? (
                <>
                  Buổi <strong>{sessionData.date}</strong> lúc <strong>{sessionData.time}</strong> với{" "}
                  <strong>{sessionData.mentorName}</strong> đã bị mentor hủy (≥ 24h trước buổi, đã thanh toán).
                  Chọn đổi lịch, đổi mentor hoặc hoàn 100%
                  {refundAmt > 0 ? (
                    <>
                      {" "}
                      (<strong>{formatVnd(refundAmt)}</strong>)
                    </>
                  ) : null}
                  .
                </>
              ) : mode === "late_refund" ? (
                <>Mentor hủy khi còn dưới 24 giờ. Hoàn ưu tiên 100% — điền STK nhận hoàn bên dưới.</>
              ) : mode === "no_show" ? (
                <>Buổi ghi nhận no-show. Hoàn ưu tiên 100% — điền STK nếu chưa có.</>
              ) : mode === "change_mentor_done" ? (
                <>Đã kích hoạt credit — chọn mentor khác để đặt lịch mới.</>
              ) : (
                <>
                  Buổi <strong>{sessionData.date}</strong> lúc <strong>{sessionData.time}</strong> không còn hiệu
                  lực.
                </>
              )}
            </p>
          </div>
        </div>

        {needsChoose ? (
          <>
            {!mentorResolutionStep ? (
              <div className="grid gap-3 sm:grid-cols-3">
                <button
                  type="button"
                  onClick={() => setMentorResolutionStep("reschedule")}
                  className="rounded-2xl border-2 border-violet-200 bg-white px-4 py-4 text-left transition hover:border-violet-500 hover:shadow-md"
                >
                  <p className="text-xs font-black uppercase tracking-wider text-violet-900">Đổi lịch</p>
                  <p className="mt-2 text-[11px] leading-relaxed text-slate-600">Giữ mentor — chọn ngày/giờ mới</p>
                </button>
                <button
                  type="button"
                  disabled={resolutionBusy}
                  onClick={() => onResolve("change_mentor")}
                  className="rounded-2xl border-2 border-violet-200 bg-white px-4 py-4 text-left transition hover:border-violet-500 hover:shadow-md disabled:opacity-50"
                >
                  <p className="text-xs font-black uppercase tracking-wider text-violet-900">Đổi mentor</p>
                  <p className="mt-2 text-[11px] leading-relaxed text-slate-600">Dùng credit đã trả — mentor khác</p>
                </button>
                <button
                  type="button"
                  onClick={() => setMentorResolutionStep("refund")}
                  className="rounded-2xl border-2 border-violet-200 bg-white px-4 py-4 text-left transition hover:border-violet-500 hover:shadow-md"
                >
                  <p className="text-xs font-black uppercase tracking-wider text-violet-900">Hoàn tiền 100%</p>
                  <p className="mt-2 text-[11px] leading-relaxed text-slate-600">Admin CK sau khi có STK</p>
                </button>
              </div>
            ) : null}

            {mentorResolutionStep === "reschedule" ? (
              <div className="mt-4 space-y-3 rounded-2xl border border-violet-100 bg-white p-4">
                <p className="text-xs font-black uppercase tracking-wider text-violet-900">Chọn khung giờ mới</p>
                {loadingRescheduleSlots ? (
                  <p className="text-xs text-gray-500">Đang tải lịch trống…</p>
                ) : rescheduleSlotOptions.length === 0 ? (
                  <p className="text-xs text-amber-700">Không có slot trống — chọn hoàn tiền hoặc liên hệ support.</p>
                ) : (
                  <AppSelect
                    size="md"
                    value={`${rescheduleDate}|${rescheduleSlot}`}
                    onValueChange={(v) => {
                      const [d, s] = String(v).split("|");
                      setRescheduleDate(d);
                      setRescheduleSlot(s);
                    }}
                    options={rescheduleSlotOptions.map((o) => ({
                      value: `${o.date}|${o.slot}`,
                      label: o.label,
                    }))}
                  />
                )}
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={resolutionBusy || rescheduleSlotOptions.length === 0}
                    onClick={() => onResolve("reschedule")}
                    className="rounded-xl px-5 py-2.5 text-xs font-black uppercase tracking-wider text-white disabled:opacity-50"
                    style={{ background: "#8037f4" }}
                  >
                    {resolutionBusy ? "Đang xử lý…" : "Xác nhận đổi lịch"}
                  </button>
                </div>
              </div>
            ) : null}

            {mentorResolutionStep === "refund" ? (
              <RefundForm
                refundBankName={refundBankName}
                setRefundBankName={setRefundBankName}
                refundAccountNumber={refundAccountNumber}
                setRefundAccountNumber={setRefundAccountNumber}
                refundAccountHolder={refundAccountHolder}
                setRefundAccountHolder={setRefundAccountHolder}
                busy={resolutionBusy}
                onSubmit={() => onResolve("refund")}
                submitLabel="Xác nhận hoàn 100%"
              />
            ) : null}
          </>
        ) : null}

        {mode === "change_mentor_done" ? (
          <button
            type="button"
            onClick={onGoRebookMentors}
            className="w-full rounded-2xl py-4 text-xs font-black uppercase tracking-wider text-white"
            style={{ background: "#8037f4" }}
          >
            Chọn mentor mới →
          </button>
        ) : null}

        {(mode === "late_refund" || mode === "no_show" || (needsRefundBankForm && !needsChoose)) &&
        mentorResolutionStep !== "refund" ? (
          <RefundForm
            title={refundBankFormTitle}
            refundAmount={refundAmt}
            refundBankName={refundBankName}
            setRefundBankName={setRefundBankName}
            refundAccountNumber={refundAccountNumber}
            setRefundAccountNumber={setRefundAccountNumber}
            refundAccountHolder={refundAccountHolder}
            setRefundAccountHolder={setRefundAccountHolder}
            busy={refundDestBusy}
            onSubmit={onSubmitRefundDestination}
            submitLabel="Lưu STK nhận hoàn"
            tone={mode === "no_show" ? "rose" : "amber"}
          />
        ) : null}
      </motion.div>

      <div className="card-premium flex flex-wrap items-center gap-4 p-5">
        {sessionData.mentorAvatar ? (
          <img src={sessionData.mentorAvatar} alt="" className="h-14 w-14 rounded-2xl border object-cover" />
        ) : null}
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-slate-900">{sessionData.mentorName}</p>
          <p className="text-xs text-slate-500">
            {sessionData.date} · {sessionData.time} – {sessionData.endTime}
          </p>
          <p className="text-xs font-semibold text-violet-700">#{sessionData.orderNum}</p>
        </div>
        <p className="text-lg font-black text-slate-900">{formatVnd(sessionData.price || 0)}</p>
      </div>
    </motion.div>
  );
}

function RefundForm({
  title = "Tài khoản nhận hoàn",
  refundAmount = 0,
  refundBankName,
  setRefundBankName,
  refundAccountNumber,
  setRefundAccountNumber,
  refundAccountHolder,
  setRefundAccountHolder,
  busy,
  onSubmit,
  submitLabel,
  tone = "violet",
}) {
  const border =
    tone === "rose" ? "border-rose-200 bg-rose-50/50" : tone === "amber" ? "border-amber-200 bg-amber-50/50" : "border-violet-100 bg-white";

  return (
    <div className={`mt-4 space-y-3 rounded-2xl border p-4 ${border}`}>
      <p className="text-xs font-black uppercase tracking-wider text-slate-900">{title}</p>
      {refundAmount > 0 ? (
        <p className="text-sm text-slate-700">
          Số hoàn dự kiến: <strong>{formatVnd(Math.round(refundAmount))}</strong>
        </p>
      ) : null}
      <input
        type="text"
        value={refundBankName}
        onChange={(e) => setRefundBankName(e.target.value)}
        placeholder="Tên ngân hàng"
        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-violet-400"
      />
      <input
        type="text"
        inputMode="numeric"
        value={refundAccountNumber}
        onChange={(e) => setRefundAccountNumber(e.target.value)}
        placeholder="Số tài khoản"
        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 font-mono text-sm outline-none focus:border-violet-400"
      />
      <input
        type="text"
        value={refundAccountHolder}
        onChange={(e) => setRefundAccountHolder(e.target.value)}
        placeholder="Tên chủ tài khoản (in hoa, không dấu)"
        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-violet-400"
      />
      <div className="flex flex-wrap gap-2 pt-1">
        <button
          type="button"
          disabled={busy}
          onClick={onSubmit}
          className="rounded-xl px-5 py-2.5 text-xs font-black uppercase tracking-wider text-white disabled:opacity-50"
          style={{ background: "#8037f4" }}
        >
          {busy ? "Đang xử lý…" : submitLabel}
        </button>
      </div>
    </div>
  );
}
