import { useState } from "react";
import { Brain, Plus, Trash2, X, ChevronRight } from "lucide-react";
import { saveMentorKnowledge } from "../../api/bookingsApi.js";
import { toastApiError, toastApiSuccess } from "../../utils/shared/apiToast.js";

const IS = { strokeWidth: 1.75, strokeLinecap: "round", strokeLinejoin: "round" };

function ArrayInput({ label, placeholder, items, onChange }) {
  const [draft, setDraft] = useState("");

  const add = () => {
    const v = draft.trim();
    if (!v) return;
    onChange([...items, v]);
    setDraft("");
  };

  return (
    <div>
      <p className="mb-1.5 text-xs font-semibold text-slate-400 uppercase tracking-wide">{label}</p>
      <div className="flex gap-2 mb-2">
        <input
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); add(); } }}
          placeholder={placeholder}
          className="flex-1 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/30 focus:outline-none focus:ring-1 focus:ring-violet-500"
        />
        <button
          type="button"
          onClick={add}
          className="flex items-center gap-1 rounded-lg border border-violet-500/30 bg-violet-500/10 px-3 py-2 text-xs font-bold text-violet-300 hover:bg-violet-500/20"
        >
          <Plus className="h-3.5 w-3.5" {...IS} />
          Thêm
        </button>
      </div>
      {items.length > 0 && (
        <ul className="space-y-1">
          {items.map((item, i) => (
            <li key={i} className="flex items-start gap-2 rounded-lg bg-white/5 px-3 py-2">
              <span className="flex-1 text-sm text-white/80">{item}</span>
              <button
                type="button"
                onClick={() => onChange(items.filter((_, j) => j !== i))}
                className="text-white/30 hover:text-red-400"
              >
                <Trash2 className="h-3.5 w-3.5" {...IS} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/**
 * Modal post-session (legacy) — ưu tiên ghi chú live trong MeetingRoom.
 * Giữ lại nếu cần chỉnh sửa thủ công sau buổi.
 *
 * @param {{ bookingId, defaultRole, defaultField, onClose, onDone }} props
 *   onClose, bỏ qua (navigate ngay)
 *   onDone , sau submit thành công (navigate)
 */
export function KnowledgeCaptureModal({ bookingId, defaultRole = "", defaultField = "", onClose, onDone }) {
  const [menteeRole,     setMenteeRole]     = useState(defaultRole);
  const [field,          setField]          = useState(defaultField);
  const [questionsAsked, setQuestionsAsked] = useState([]);
  const [commonMistakes, setCommonMistakes] = useState([]);
  const [keyInsights,    setKeyInsights]    = useState([]);
  const [fullAdvice,     setFullAdvice]     = useState("");
  const [saving,         setSaving]         = useState(false);

  const hasContent = questionsAsked.length > 0 || commonMistakes.length > 0 || keyInsights.length > 0 || fullAdvice.trim();

  const handleSubmit = async () => {
    if (!hasContent) { onDone(); return; }
    setSaving(true);
    try {
      const res = await saveMentorKnowledge(bookingId, {
        menteeRole: menteeRole.trim(),
        field: field.trim(),
        questionsAsked,
        commonMistakes,
        keyInsights,
        fullAdvice: fullAdvice.trim(),
      });
      if (res.success) {
        toastApiSuccess("Đã lưu insights, AI sẽ học từ kinh nghiệm của bạn!");
        onDone();
      } else {
        toastApiError(res.error, "Không lưu được insights.");
        setSaving(false);
      }
    } catch {
      toastApiError("Lỗi kết nối.");
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg rounded-2xl bg-[#0f0e1a] border border-white/10 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-white/5">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-violet-500/15 border border-violet-500/20">
            <Brain className="h-5 w-5 text-violet-400" {...IS} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-white">Chia sẻ insights cho AI</p>
            <p className="text-xs text-white/40">AI học từ chuyên gia thật, giúp ứng viên sau tốt hơn</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-white/30 hover:text-white/70"
          >
            <X className="h-4 w-4" {...IS} />
          </button>
        </div>

        {/* Body, scrollable */}
        <div className="overflow-y-auto flex-1 px-5 py-4 space-y-5">
          {/* Context row */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="mb-1.5 text-xs font-semibold text-slate-400 uppercase tracking-wide">Vị trí ứng viên</p>
              <input
                value={menteeRole}
                onChange={e => setMenteeRole(e.target.value)}
                placeholder="vd. Frontend Engineer"
                className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/30 focus:outline-none focus:ring-1 focus:ring-violet-500"
              />
            </div>
            <div>
              <p className="mb-1.5 text-xs font-semibold text-slate-400 uppercase tracking-wide">Ngành / Lĩnh vực</p>
              <input
                value={field}
                onChange={e => setField(e.target.value)}
                placeholder="vd. IT, Finance, Marketing"
                className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/30 focus:outline-none focus:ring-1 focus:ring-violet-500"
              />
            </div>
          </div>

          <ArrayInput
            label="Câu hỏi bạn đã hỏi trong buổi"
            placeholder="vd. Hãy kể về lần bạn giải quyết conflict trong team"
            items={questionsAsked}
            onChange={setQuestionsAsked}
          />

          <ArrayInput
            label="Lỗi phổ biến ứng viên hay mắc"
            placeholder="vd. Trả lời chung chung, thiếu số liệu cụ thể"
            items={commonMistakes}
            onChange={setCommonMistakes}
          />

          <ArrayInput
            label="Key insights / lời khuyên ngắn"
            placeholder="vd. PM cần nhấn vào data-driven decision trong mọi câu trả lời"
            items={keyInsights}
            onChange={setKeyInsights}
          />

          <div>
            <p className="mb-1.5 text-xs font-semibold text-slate-400 uppercase tracking-wide">Lời khuyên chi tiết (tùy chọn)</p>
            <textarea
              value={fullAdvice}
              onChange={e => setFullAdvice(e.target.value)}
              placeholder="Ghi thêm bất kỳ insight nào bạn muốn AI ghi nhớ cho role này..."
              rows={3}
              className="w-full resize-none rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/30 focus:outline-none focus:ring-1 focus:ring-violet-500"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex gap-3 px-5 py-4 border-t border-white/5">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-xl border border-white/10 py-2.5 text-sm font-bold text-white/50 hover:text-white/80"
          >
            Bỏ qua
          </button>
          <button
            type="button"
            data-button-surface="none"
            onClick={handleSubmit}
            disabled={saving}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-violet-600 bg-gradient-to-r from-violet-600 to-violet-500 py-2.5 text-sm font-bold !text-white shadow-lg hover:brightness-110 disabled:opacity-60"
          >
            {saving ? (
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
            ) : (
              <>
                <span className="!text-white">{hasContent ? "Lưu & tiếp tục" : "Tiếp tục"}</span>
                <ChevronRight className="h-4 w-4 text-white" {...IS} />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
