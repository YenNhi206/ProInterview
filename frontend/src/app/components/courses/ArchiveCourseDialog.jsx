import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Check, Loader2, X } from "lucide-react";
import { fetchCourseArchiveEligibility } from "../../api/courseApi.js";

/**
 * Xác nhận xóa khóa học. Mở ra là hỏi backend checklist điều kiện bắt buộc;
 * chỉ cho xóa khi đạt hết điều kiện và mentor đã tick xác nhận.
 */
export function ArchiveCourseDialog({ open, courseId, courseTitle, archiving, onOpenChange, onConfirm }) {
  const [eligibility, setEligibility] = useState(null);
  const [loadError, setLoadError] = useState("");
  const [acknowledged, setAcknowledged] = useState(false);

  useEffect(() => {
    if (!open || !courseId) return undefined;
    let cancelled = false;
    setEligibility(null);
    setLoadError("");
    setAcknowledged(false);
    void fetchCourseArchiveEligibility(courseId).then((res) => {
      if (cancelled) return;
      if (res.success) setEligibility(res.eligibility);
      else setLoadError(res.error || "Không kiểm tra được điều kiện xóa.");
    });
    return () => {
      cancelled = true;
    };
  }, [open, courseId]);

  if (!open) return null;

  const title = courseTitle?.trim() || "khóa học này";
  const canArchive = Boolean(eligibility?.canArchive);
  const canSubmit = canArchive && acknowledged && !archiving;
  /* Còn học viên thì chỉ ngừng bán — họ giữ quyền học trọn đời. */
  const stopSelling = eligibility?.mode === "stop_selling";
  const learners = Number(eligibility?.learners || 0);

  const modal = (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 sm:p-6">
      <button
        type="button"
        aria-label="Đóng"
        disabled={archiving}
        className="absolute inset-0 bg-[#05020d]/70 backdrop-blur-sm"
        onClick={() => onOpenChange(false)}
      />
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="archive-course-title"
        aria-describedby="archive-course-desc"
        className="relative z-10 w-full max-w-lg rounded-2xl border border-white/10 bg-[#150c33] p-6 text-slate-100 shadow-[0_24px_60px_rgba(0,0,0,0.55)] sm:p-8"
      >
        <h2 id="archive-course-title" className="text-xl font-black tracking-tight text-white">
          {stopSelling ? "Ngừng bán khóa học?" : "Xóa khóa học?"}
        </h2>
        {stopSelling ? (
          <div id="archive-course-desc" className="mt-3 space-y-3 text-sm leading-relaxed text-slate-300">
            <p>
              <span className="font-semibold text-white">{title}</span> đang có{" "}
              <span className="font-semibold text-white">{learners} học viên</span> được quyền học trọn đời,
              nên không thể xóa hẳn. Bạn có thể <span className="font-semibold text-white">ngừng bán</span>:
            </p>
            <ul className="space-y-1.5 pl-1">
              <li>• Khóa học ẩn khỏi trang Khám phá và giỏ hàng, không ai mua mới được.</li>
              <li>• {learners} học viên hiện tại vẫn học tiếp bình thường.</li>
              <li>• Bạn không thể tự mở bán lại sau khi ngừng bán.</li>
            </ul>
          </div>
        ) : (
          <p id="archive-course-desc" className="mt-3 text-sm leading-relaxed text-slate-300">
            <span className="font-semibold text-white">{title}</span> sẽ bị gỡ khỏi trang Khám phá và giỏ hàng
            của học viên. Bạn không thể tự khôi phục khóa học sau khi xóa.
          </p>
        )}

        <div className="mt-5 rounded-xl border border-white/10 bg-white/[0.04] p-4">
          <p className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-400">Điều kiện bắt buộc</p>
          {loadError ? (
            <p className="text-sm text-rose-300">{loadError}</p>
          ) : !eligibility ? (
            <p className="flex items-center gap-2 text-sm text-slate-300">
              <Loader2 className="size-4 animate-spin" /> Đang kiểm tra điều kiện…
            </p>
          ) : (
            <ul className="space-y-3">
              {eligibility.checks.map((c) => (
                <li key={c.key} className="flex items-start gap-3">
                  <span
                    className={`mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full ${
                      c.ok ? "bg-[#93f72b]/15 text-[#93f72b]" : "bg-rose-500/15 text-rose-300"
                    }`}
                  >
                    {c.ok ? <Check className="size-3.5" strokeWidth={3} /> : <X className="size-3.5" strokeWidth={3} />}
                  </span>
                  <span className="min-w-0 text-sm">
                    <span className={c.ok ? "text-slate-200" : "font-semibold text-white"}>{c.label}</span>
                    {!c.ok && c.detail ? <span className="mt-0.5 block text-xs text-rose-200/90">{c.detail}</span> : null}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {canArchive ? (
          <label className="mt-5 flex cursor-pointer items-start gap-3 text-sm text-slate-300">
            <input
              type="checkbox"
              checked={acknowledged}
              disabled={archiving}
              onChange={(e) => setAcknowledged(e.target.checked)}
              className="mt-0.5 size-4 shrink-0 cursor-pointer accent-[#93f72b]"
            />
            {stopSelling
              ? "Tôi hiểu khóa học sẽ ngừng bán vĩnh viễn và không thể tự mở bán lại."
              : "Tôi hiểu khóa học sẽ bị gỡ vĩnh viễn và không thể tự khôi phục."}
          </label>
        ) : eligibility ? (
          <p className="mt-5 text-sm text-slate-400">
            {stopSelling ? "Khóa học chưa đủ điều kiện để ngừng bán." : "Khóa học chưa đủ điều kiện để xóa."}
          </p>
        ) : null}

        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button
            type="button"
            disabled={archiving}
            onClick={() => onOpenChange(false)}
            className="rounded-xl border border-white/15 bg-white/[0.04] px-6 py-3 text-sm font-bold text-slate-200 transition hover:bg-white/[0.08] disabled:opacity-50"
          >
            {canArchive ? "Hủy" : "Đóng"}
          </button>
          {canArchive ? (
            <button
              type="button"
              disabled={!canSubmit}
              onClick={onConfirm}
              className={`rounded-xl px-6 py-3 text-sm font-bold transition disabled:cursor-not-allowed disabled:opacity-40 ${
                stopSelling
                  ? "bg-amber-400 text-amber-950 hover:bg-amber-300"
                  : "bg-red-600 text-white hover:bg-red-500"
              }`}
            >
              {stopSelling
                ? archiving
                  ? "Đang ngừng bán…"
                  : "Ngừng bán"
                : archiving
                  ? "Đang xóa…"
                  : "Xóa khóa học"}
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}
