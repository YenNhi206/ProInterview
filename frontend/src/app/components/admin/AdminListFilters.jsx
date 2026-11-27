import { RotateCcw } from "lucide-react";
import { AppSelect } from "../ui/AppSelect";

export function AdminFilterSelect({ id, label, value, options, onChange, theme }) {
  return (
    <div className="flex min-w-[11rem] flex-col gap-1 sm:min-w-[12.5rem]">
      <label
        htmlFor={id}
        className="text-[10px] font-black uppercase tracking-widest text-slate-400 [html[data-workspace-theme=light]_&]:text-slate-600"
      >
        {label}
      </label>
      <AppSelect
        id={id}
        theme={theme}
        size="filter"
        value={value}
        onValueChange={onChange}
        options={options.map((o) => ({ value: o.id, label: o.label }))}
      />
    </div>
  );
}

/** Thanh lọc gọn: dropdown + đặt lại (không hiện chip «Đang lọc»). */
export function AdminListFilterBar({ children, countText, onReset, showReset = false }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 backdrop-blur-md [html[data-workspace-theme=light]_&]:border-slate-200/80 [html[data-workspace-theme=light]_&]:bg-white [html[data-workspace-theme=light]_&]:shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-wrap items-end gap-4">
          {children}
          {showReset ? (
            <div className="flex flex-col gap-1">
              <span
                className="text-[10px] font-black uppercase tracking-widest text-transparent select-none"
                aria-hidden
              >
                &nbsp;
              </span>
              <button
                type="button"
                onClick={onReset}
                className="inline-flex h-[42px] shrink-0 items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.05] px-4 text-xs font-semibold uppercase tracking-wider text-slate-200 shadow-sm transition hover:border-violet-400 hover:bg-white/10 hover:text-white [html[data-workspace-theme=light]_&]:border-slate-200 [html[data-workspace-theme=light]_&]:bg-slate-50 [html[data-workspace-theme=light]_&]:text-slate-700 [html[data-workspace-theme=light]_&]:hover:border-violet-500 [html[data-workspace-theme=light]_&]:hover:bg-violet-50 [html[data-workspace-theme=light]_&]:hover:text-violet-700"
              >
                <RotateCcw className="h-4 w-4 shrink-0 opacity-80" aria-hidden />
                Đặt lại
              </button>
            </div>
          ) : null}
        </div>
        {countText ? (
          <p className="shrink-0 text-xs font-medium text-slate-400 [html[data-workspace-theme=light]_&]:text-slate-600 sm:pb-1">
            {countText}
          </p>
        ) : null}
      </div>
    </div>
  );
}
