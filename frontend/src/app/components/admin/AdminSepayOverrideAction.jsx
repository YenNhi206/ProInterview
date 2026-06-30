import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { AlertTriangle, ShieldCheck } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { buildAdminTransferConfirmBody } from "../../utils/admin/adminTransferConfirm.js";

/**
 * Admin xác nhận CK thủ công, không cần học viên bấm «đã chuyển khoản» trong app.
 * onConfirm nhận { force, forceNote }.
 * groupCount / groupTotalVnd: dùng khi đây là đơn nhiều buổi để hiển thị cảnh báo tổng tiền.
 */
export function AdminSepayOverrideAction({
  onConfirm,
  busy = false,
  iconOnly = true,
  className = "",
  groupCount = 1,
  groupTotalVnd = 0,
}) {
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const handleConfirm = async () => {
    await onConfirm(buildAdminTransferConfirmBody(note));
    setOpen(false);
    setNote("");
  };

  const modal =
    open &&
    typeof document !== "undefined" &&
    createPortal(
      <AnimatePresence>
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[200] flex items-center justify-center bg-black/45 p-4 backdrop-blur-[2px]"
          onClick={() => !busy && setOpen(false)}
        >
          <motion.div
            initial={{ scale: 0.96, y: 12, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            exit={{ scale: 0.96, y: 12, opacity: 0 }}
            role="dialog"
            aria-labelledby="sepay-override-title"
            className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start gap-3">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-700">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div>
                <h3 id="sepay-override-title" className="text-lg font-bold text-slate-900">
                  Xác nhận đã nhận tiền
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">
                  Dùng khi đã kiểm tra sao kê (mã PI + đúng số tiền) nhưng SePay không tự khớp.{" "}
                  <strong>Không cần</strong> học viên bấm «đã chuyển khoản» trong app, có thể nhắn Zalo/email
                  báo admin.
                </p>
                {groupCount > 1 && (
                  <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs leading-relaxed text-amber-800">
                    <strong>Lưu ý:</strong> Đơn này gồm{" "}
                    <strong>{groupCount} buổi</strong> — tổng cộng{" "}
                    <strong>{groupTotalVnd.toLocaleString("vi-VN")}₫</strong>.{" "}
                    Xác nhận 1 buổi sẽ <em>tự động duyệt toàn bộ đơn</em>.{" "}
                    Hãy kiểm tra sao kê đúng tổng số tiền này trước khi xác nhận.
                  </div>
                )}
              </div>
            </div>
            <label className="mt-4 block text-xs font-semibold text-slate-600">
              Ghi chú (tùy chọn)
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={2}
                placeholder="VD: HV nhắn Zalo đã CK, đối chiếu MB 22/05"
                className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 outline-none focus:border-violet-400"
              />
            </label>
            <div className="mt-6 grid grid-cols-2 gap-3">
              <button
                type="button"
                disabled={busy}
                onClick={() => setOpen(false)}
                className="rounded-xl border border-slate-200 bg-slate-50 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-50"
              >
                Hủy
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => void handleConfirm()}
                className="rounded-xl bg-violet-600 py-3 text-sm font-semibold text-white hover:bg-violet-700 disabled:opacity-50"
              >
                {busy ? "Đang xử lý…" : "Xác nhận & duyệt buổi"}
              </button>
            </div>
          </motion.div>
        </motion.div>
      </AnimatePresence>,
      document.body,
    );

  if (iconOnly) {
    return (
      <>
        <button
          type="button"
          title="Xác nhận đã nhận tiền (SePay lỗi / HV báo ngoài app)"
          disabled={busy}
          onClick={(e) => {
            e.stopPropagation();
            setOpen(true);
          }}
          className={`inline-flex size-9 items-center justify-center rounded-xl border border-violet-200 bg-violet-50 text-violet-700 transition hover:border-violet-300 hover:bg-violet-100 disabled:opacity-50 ${className}`}
        >
          <ShieldCheck className="h-4 w-4" />
        </button>
        {modal}
      </>
    );
  }

  return (
    <>
      <button
        type="button"
        disabled={busy}
        onClick={() => setOpen(true)}
        className={`rounded-xl border border-violet-200 bg-white px-3 py-2 text-sm font-semibold text-violet-800 hover:bg-violet-50 disabled:opacity-50 ${className}`}
      >
        Xác nhận đã nhận tiền
      </button>
      {modal}
    </>
  );
}
