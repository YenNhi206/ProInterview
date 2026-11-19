import { useEffect, useState } from "react";
import { Flag, Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "../ui/dialog";
import { submitAiReport } from "../../api/reportsApi.js";
import { tryApi } from "../../utils/shared/apiToast.js";
import { AI_REPORT_NOTE_MAX, AI_REPORT_REASONS, AI_REPORT_TARGETS } from "../../utils/interview/feedbackModeration.js";

/**
 * "Báo sai" một câu trên trang Feedback (N-10): ứng viên chọn báo sai câu hỏi hay điểm chấm, lý do và
 * ghi chú tùy chọn → POST /api/reports → vào hàng đợi kiểm định của Platform Moderator.
 *
 * @param {{ open, onOpenChange, sessionId, questionIndex, questionText, targets: string[], onReported: (targetType) => void }} props
 *   `targets`: loại còn báo được (loại đã báo bị backend chặn 409).
 */
/** Ứng viên thường thắc mắc điểm hơn câu hỏi → mặc định "Điểm chấm" nếu còn báo được. */
const defaultTarget = (targets) =>
  targets.includes("interview_evaluation") ? "interview_evaluation" : (targets[0] ?? "interview_evaluation");

export function ReportAiResultDialog({ open, onOpenChange, sessionId, questionIndex, questionText, targets, onReported }) {
  const [targetType, setTargetType] = useState(() => defaultTarget(targets));
  const [reasonCode, setReasonCode] = useState("");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setTargetType(defaultTarget(targets));
    setReasonCode("");
    setNote("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const reasons = AI_REPORT_REASONS[targetType] ?? [];

  const submit = async (e) => {
    e.preventDefault();
    if (!reasonCode || submitting) return;
    setSubmitting(true);
    const res = await tryApi(
      () => submitAiReport({ targetType, sessionId, questionIndex, reasonCode, note }),
      { fallback: "Không gửi được báo cáo.", successMessage: "Đã gửi. Kiểm duyệt viên sẽ xem lại và báo kết quả cho bạn." },
    );
    setSubmitting(false);
    // 409: đã báo loại này cho câu này rồi → coi như đã gửi để ẩn lựa chọn đó.
    if (res.success || res.status === 409) {
      onReported(targetType);
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="border-violet-200 bg-white text-violet-950 sm:max-w-md">
        <form onSubmit={submit} className="space-y-4">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-violet-950">
              <Flag className="size-4 text-orange-500" aria-hidden /> Báo sai kết quả AI
            </DialogTitle>
            <DialogDescription className="text-violet-600">
              Câu {questionIndex + 1}: <span className="line-clamp-2">{questionText}</span>
            </DialogDescription>
          </DialogHeader>

          <fieldset>
            <legend className="mb-2 text-xs font-semibold text-violet-800">Bạn thấy sai ở đâu?</legend>
            <div className="grid grid-cols-2 gap-2">
              {Object.entries(AI_REPORT_TARGETS).map(([id, label]) => {
                const disabled = !targets.includes(id);
                const active = targetType === id;
                return (
                  <button
                    key={id}
                    type="button"
                    disabled={disabled}
                    aria-pressed={active}
                    onClick={() => { setTargetType(id); setReasonCode(""); }}
                    className={`rounded-lg border px-3 py-2 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                      active ? "border-[#8037f4] bg-violet-50 text-[#8037f4]" : "border-violet-200 text-violet-800 hover:bg-violet-50"
                    }`}
                  >
                    {label}
                    {disabled ? <span className="block text-[10px] font-normal">Đã báo</span> : null}
                  </button>
                );
              })}
            </div>
          </fieldset>

          <fieldset>
            <legend className="mb-2 text-xs font-semibold text-violet-800">Lý do</legend>
            <div className="space-y-1.5">
              {reasons.map((r) => (
                <label key={r.id} className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm text-violet-900 hover:bg-violet-50">
                  <input
                    type="radio"
                    name="ai-report-reason"
                    value={r.id}
                    checked={reasonCode === r.id}
                    onChange={() => setReasonCode(r.id)}
                    className="accent-[#8037f4]"
                  />
                  {r.label}
                </label>
              ))}
            </div>
          </fieldset>

          <div>
            <label htmlFor="ai-report-note" className="mb-1.5 block text-xs font-semibold text-violet-800">
              Ghi chú thêm (không bắt buộc)
            </label>
            <textarea
              id="ai-report-note"
              rows={3}
              maxLength={AI_REPORT_NOTE_MAX}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Ví dụ: Tôi đã nêu kết quả cụ thể nhưng điểm Thuyết phục vẫn thấp."
              className="w-full rounded-lg border border-violet-200 px-3 py-2 text-sm text-violet-950 placeholder:text-violet-400 focus:border-[#8037f4] focus:outline-none"
            />
            <p className="mt-1 text-right text-[10px] tabular-nums text-violet-400">{note.length}/{AI_REPORT_NOTE_MAX}</p>
          </div>

          <DialogFooter>
            <button type="button" onClick={() => onOpenChange(false)} className="rounded-lg border border-violet-200 px-4 py-2 text-sm font-semibold text-violet-800 hover:bg-violet-50">
              Hủy
            </button>
            <button
              type="submit"
              disabled={!reasonCode || submitting}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#8037f4] px-4 py-2 text-sm font-semibold text-white hover:brightness-105 disabled:opacity-50"
            >
              {submitting ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
              Gửi báo cáo
            </button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
