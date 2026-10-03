import { Plus, Trash2 } from "lucide-react";
import {
  emptyEducationEntry,
  formatEducationEntryPeriod,
} from "../../utils/profile/profileEducationHistory.js";

const fieldClass =
  "w-full rounded-xl border border-white/15 bg-slate-900/50 px-3.5 py-2.5 text-sm font-medium text-slate-100 shadow-sm placeholder:text-slate-400 focus:border-[#c4ace8] focus:outline-none focus:ring-2 focus:ring-[#c4ace8]/30 disabled:cursor-not-allowed disabled:opacity-50 transition-colors";

const labelClass = "mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-300";

function PeriodSummary({ entry }) {
  const period = formatEducationEntryPeriod(entry);
  if (!period) return null;

  return (
    <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1 rounded-xl border border-violet-400/25 bg-violet-500/15 px-3.5 py-2 text-sm">
      <span className="text-slate-300">Thời gian:</span>
      <span className="font-bold text-violet-300">{period}</span>
    </div>
  );
}

export function ProfileEducationHistoryEditor({ entries, onChange, disabled = false }) {
  const list = Array.isArray(entries) && entries.length ? entries : [emptyEducationEntry()];

  const updateEntry = (index, patch) => {
    const next = list.map((e, i) => (i === index ? { ...e, ...patch } : e));
    onChange(next);
  };

  const addEntry = () => {
    onChange([...list, emptyEducationEntry()]);
  };

  const removeEntry = (index) => {
    if (list.length <= 1) {
      onChange([emptyEducationEntry()]);
      return;
    }
    onChange(list.filter((_, i) => i !== index));
  };

  const setCurrentAt = (index, isCurrent) => {
    if (isCurrent) {
      onChange(
        list.map((item, i) => ({
          ...item,
          isCurrent: i === index,
          endMonth: i === index ? "" : item.endMonth,
        })),
      );
      return;
    }
    updateEntry(index, { isCurrent: false });
  };

  return (
    <div className="space-y-4">
      {list.map((entry, index) => (
        <div
          key={index}
          className="space-y-4 rounded-2xl border border-white/10 bg-slate-900/60 p-4 sm:p-5 shadow-md"
        >
          <div className="flex items-center justify-between gap-3 border-b border-white/10 pb-3">
            <h4 className="text-sm font-bold text-white">
              {entry.isCurrent ? "Đang học" : `Học vấn ${index + 1}`}
            </h4>
            {!disabled && list.length > 1 ? (
              <button
                type="button"
                onClick={() => removeEntry(index)}
                className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-semibold text-rose-400 hover:bg-rose-500/15 transition-colors"
              >
                <Trash2 size={14} aria-hidden />
                Xóa
              </button>
            ) : null}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className={labelClass} htmlFor={`edu-school-${index}`}>
                Trường / cơ sở đào tạo
              </label>
              <input
                id={`edu-school-${index}`}
                disabled={disabled}
                className={fieldClass}
                placeholder="VD: Đại học Bách Khoa TP.HCM, FPT University"
                value={entry.school}
                onChange={(e) => updateEntry(index, { school: e.target.value })}
              />
            </div>
            <div>
              <label className={labelClass} htmlFor={`edu-degree-${index}`}>
                Bằng cấp
              </label>
              <input
                id={`edu-degree-${index}`}
                disabled={disabled}
                className={fieldClass}
                placeholder="VD: Cử nhân, Thạc sĩ, Cao đẳng"
                value={entry.degree}
                onChange={(e) => updateEntry(index, { degree: e.target.value })}
              />
            </div>
            <div>
              <label className={labelClass} htmlFor={`edu-major-${index}`}>
                Chuyên ngành
              </label>
              <input
                id={`edu-major-${index}`}
                disabled={disabled}
                className={fieldClass}
                placeholder="VD: Công nghệ thông tin"
                value={entry.major}
                onChange={(e) => updateEntry(index, { major: e.target.value })}
              />
            </div>
          </div>

          <label className="flex cursor-pointer items-start gap-2.5 rounded-xl border border-white/10 bg-white/[0.04] px-3.5 py-2.5">
            <input
              type="checkbox"
              disabled={disabled}
              checked={entry.isCurrent}
              className="mt-0.5 size-4 shrink-0 rounded border-slate-600 bg-slate-800 text-violet-500 focus:ring-violet-400"
              onChange={(e) => setCurrentAt(index, e.target.checked)}
            />
            <span className="text-sm text-slate-200">
              <span className="font-bold text-white">Đang theo học</span>
              <span className="mt-0.5 block text-xs text-slate-400">
                Chỉ một mục được đánh dấu đang học. Khi bật, ô &quot;Đến&quot; sẽ tự ẩn.
              </span>
            </span>
          </label>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className={labelClass} htmlFor={`edu-start-${index}`}>
                Tháng bắt đầu
              </label>
              <input
                id={`edu-start-${index}`}
                type="month"
                disabled={disabled}
                className={`${fieldClass} [color-scheme:dark]`}
                value={entry.startMonth}
                onChange={(e) => updateEntry(index, { startMonth: e.target.value })}
              />
            </div>
            <div>
              <label className={labelClass} htmlFor={`edu-end-${index}`}>
                Tháng kết thúc
              </label>
              <input
                id={`edu-end-${index}`}
                type="month"
                disabled={disabled || entry.isCurrent}
                className={`${fieldClass} [color-scheme:dark]`}
                value={entry.isCurrent ? "" : entry.endMonth}
                onChange={(e) => updateEntry(index, { endMonth: e.target.value })}
              />
              {entry.isCurrent ? (
                <p className="mt-1.5 text-xs text-slate-400">Không cần điền khi vẫn đang học.</p>
              ) : null}
            </div>
          </div>

          <PeriodSummary entry={entry} />

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className={labelClass} htmlFor={`edu-gpa-${index}`}>
                Điểm trung bình <span className="font-normal text-slate-400">(tùy chọn)</span>
              </label>
              <input
                id={`edu-gpa-${index}`}
                disabled={disabled}
                className={fieldClass}
                placeholder="VD: 3.2/4 hoặc 8.5"
                value={entry.gpa}
                onChange={(e) => updateEntry(index, { gpa: e.target.value })}
              />
            </div>
          </div>

          <div>
            <label className={labelClass} htmlFor={`edu-note-${index}`}>
              Mô tả thêm <span className="font-normal text-slate-400">(tùy chọn)</span>
            </label>
            <textarea
              id={`edu-note-${index}`}
              disabled={disabled}
              rows={3}
              className={`${fieldClass} min-h-[72px] resize-y`}
              placeholder="Học bổng, luận văn, hoạt động nổi bật trong quá trình học..."
              value={entry.note}
              onChange={(e) => updateEntry(index, { note: e.target.value })}
            />
          </div>
        </div>
      ))}

      {!disabled ? (
        <button
          type="button"
          onClick={addEntry}
          className="inline-flex items-center gap-2 rounded-xl border border-dashed border-violet-400/40 bg-violet-500/10 px-4 py-2.5 text-xs font-bold text-violet-300 hover:bg-violet-500/20 transition-colors cursor-pointer"
        >
          <Plus size={16} aria-hidden />
          Thêm mốc học vấn khác
        </button>
      ) : null}
    </div>
  );
}

