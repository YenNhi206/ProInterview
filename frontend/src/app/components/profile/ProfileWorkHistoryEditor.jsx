import React from "react";
import { Plus, Trash2, Briefcase, Calendar } from "lucide-react";
import { emptyWorkEntry, formatWorkEntryPeriod } from "../../utils/profile/profileWorkHistory.js";

const fieldClass =
  "w-full rounded-xl border border-white/12 bg-[#0b0820]/90 hover:bg-[#0e0a29] focus:bg-[#120e33] px-3.5 py-2.5 text-sm font-medium text-slate-100 shadow-sm placeholder:text-slate-500 focus:border-violet-400 focus:outline-none focus:ring-2 focus:ring-violet-500/25 disabled:cursor-not-allowed disabled:opacity-50 transition-all";

const labelClass = "mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-300";

function PeriodSummary({ entry }) {
  const period = formatWorkEntryPeriod(entry);
  if (!period) return null;

  return (
    <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1 rounded-xl border border-violet-400/25 bg-violet-500/15 px-3.5 py-2 text-xs sm:text-sm">
      <span className="text-slate-300 flex items-center gap-1.5 font-medium">
        <Calendar size={13} className="text-violet-400" /> Thời gian:
      </span>
      <span className="font-bold text-violet-300">{period}</span>
    </div>
  );
}

export function ProfileWorkHistoryEditor({
  entries,
  onChange,
  disabled = false,
  showMentorRequiredHint = false,
}) {
  const list = Array.isArray(entries) && entries.length ? entries : [emptyWorkEntry()];

  const updateEntry = (index, patch) => {
    const next = list.map((e, i) => (i === index ? { ...e, ...patch } : e));
    onChange(next);
  };

  const addEntry = () => {
    onChange([...list, emptyWorkEntry()]);
  };

  const removeEntry = (index) => {
    if (list.length <= 1) {
      onChange([emptyWorkEntry()]);
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
      {showMentorRequiredHint ? (
        <p className="text-xs font-medium leading-relaxed text-violet-300">
          <span className="font-extrabold text-rose-400" aria-hidden>
            *
          </span>{" "}
          Điền ít nhất <strong className="text-white">chức danh</strong> hoặc <strong className="text-white">công ty</strong> ở một mục bên dưới.
        </p>
      ) : null}

      {list.map((entry, index) => (
        <div
          key={index}
          className="space-y-4 rounded-2xl border border-white/10 bg-[#0d0926]/70 p-4 sm:p-5 shadow-md transition-all hover:border-violet-500/25"
        >
          <div className="flex items-center justify-between gap-3 border-b border-white/10 pb-3">
            <h4 className="text-sm font-bold text-white flex items-center gap-2">
              <Briefcase size={15} className="text-violet-400" />
              {entry.isCurrent ? "Công việc hiện tại" : `Kinh nghiệm ${index + 1}`}
            </h4>
            {!disabled && list.length > 1 ? (
              <button
                type="button"
                onClick={() => removeEntry(index)}
                className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-semibold text-rose-400 hover:bg-rose-500/15 transition-colors cursor-pointer"
              >
                <Trash2 size={13} aria-hidden />
                Xóa
              </button>
            ) : null}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className={labelClass} htmlFor={`work-role-${index}`}>
                Chức danh / Vị trí
              </label>
              <input
                id={`work-role-${index}`}
                disabled={disabled}
                className={fieldClass}
                placeholder="VD: Software Engineer, Product Designer..."
                value={entry.role}
                onChange={(e) => updateEntry(index, { role: e.target.value })}
              />
            </div>
            <div>
              <label className={labelClass} htmlFor={`work-company-${index}`}>
                Công ty / Tổ chức
              </label>
              <input
                id={`work-company-${index}`}
                disabled={disabled}
                className={fieldClass}
                placeholder="VD: FPT Software, VNG Corporation..."
                value={entry.company}
                onChange={(e) => updateEntry(index, { company: e.target.value })}
              />
            </div>
          </div>

          <label className="flex cursor-pointer items-start gap-2.5 rounded-xl border border-white/10 bg-white/[0.03] hover:bg-white/[0.06] px-3.5 py-2.5 transition-colors">
            <input
              type="checkbox"
              disabled={disabled}
              checked={entry.isCurrent}
              className="mt-0.5 size-4 shrink-0 rounded border-slate-600 bg-slate-800 text-violet-500 focus:ring-violet-400 cursor-pointer"
              onChange={(e) => setCurrentAt(index, e.target.checked)}
            />
            <span className="text-sm text-slate-200">
              <span className="font-bold text-white">Đang làm việc tại đây</span>
              <span className="mt-0.5 block text-xs text-slate-400">
                Chỉ một mục được đánh dấu hiện tại. Khi bật, ô &quot;Đến&quot; sẽ tự ẩn.
              </span>
            </span>
          </label>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className={labelClass} htmlFor={`work-start-${index}`}>
                Tháng bắt đầu
              </label>
              <input
                id={`work-start-${index}`}
                type="month"
                disabled={disabled}
                className={`${fieldClass} [color-scheme:dark]`}
                value={entry.startMonth}
                onChange={(e) => updateEntry(index, { startMonth: e.target.value })}
              />
            </div>
            <div>
              <label className={labelClass} htmlFor={`work-end-${index}`}>
                Tháng kết thúc
              </label>
              <input
                id={`work-end-${index}`}
                type="month"
                disabled={disabled || entry.isCurrent}
                className={`${fieldClass} [color-scheme:dark]`}
                value={entry.isCurrent ? "" : entry.endMonth}
                onChange={(e) => updateEntry(index, { endMonth: e.target.value })}
              />
              {entry.isCurrent ? (
                <p className="mt-1.5 text-xs text-slate-400">Không cần điền khi vẫn đang làm việc.</p>
              ) : null}
            </div>
          </div>

          <PeriodSummary entry={entry} />

          <div>
            <label className={labelClass} htmlFor={`work-note-${index}`}>
              Mô tả ngắn <span className="font-normal text-slate-400">(tùy chọn)</span>
            </label>
            <textarea
              id={`work-note-${index}`}
              disabled={disabled}
              rows={3}
              className={`${fieldClass} min-h-[72px] resize-y`}
              placeholder="Nhiệm vụ chính, công nghệ sử dụng, thành tích nổi bật..."
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
          className="w-full inline-flex items-center justify-center gap-2 rounded-xl border border-white/20 border-t-white/35 bg-gradient-to-b from-white/[0.14] via-white/[0.06] to-transparent hover:bg-white/[0.18] px-4 py-3 text-xs font-bold text-white shadow-[0_4px_16px_rgba(0,0,0,0.35),inset_0_1px_1px_rgba(255,255,255,0.2)] backdrop-blur-md transition-all cursor-pointer"
        >
          <Plus size={15} aria-hidden />
          Thêm vị trí kinh nghiệm khác
        </button>
      ) : null}
    </div>
  );
}
