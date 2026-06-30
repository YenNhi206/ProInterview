"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./select";
import { cn } from "./utils";

const TRIGGER_SIZE = {
  default:
    "h-auto min-h-[46px] rounded-2xl border-slate-200 bg-white px-5 py-3 text-xs font-bold text-slate-900 shadow-none focus:border-[#8037f4] focus:ring-4 focus:ring-[#8037f4]/10 data-[size=default]:h-auto",
  md: "h-auto min-h-[42px] rounded-lg border-slate-200/90 bg-white px-3.5 py-2.5 text-sm font-medium text-slate-900 shadow-none focus:border-[#8037f4] focus:bg-[#faf8ff] focus:ring-2 focus:ring-[#8037f4]/12 data-[size=default]:h-auto",
  sm: "h-8 min-h-8 rounded-md border-slate-200 bg-white px-2 py-1 text-sm font-semibold text-slate-900 shadow-none focus:border-[#8037f4] focus:ring-2 focus:ring-[#8037f4]/15 data-[size=default]:h-8",
  compact:
    "h-auto min-h-[38px] rounded-lg border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-800 shadow-sm focus:border-[#8037f4] focus:ring-1 focus:ring-[#8037f4]/20 data-[size=default]:h-auto",
  filter:
    "h-[42px] min-h-[42px] rounded-2xl border-slate-200 bg-white py-2.5 pl-3 pr-9 text-sm font-semibold text-slate-900 shadow-none focus:border-[#8037f4] focus:ring-2 focus:ring-[#8037f4]/12 data-[size=default]:h-[42px]",
};

/**
 * Dropdown theo brand ProInterview (Radix) — thay `<select>` native.
 * @param {{ value: string|number, onValueChange: (v: string) => void, options: {value: string|number, label: string, disabled?: boolean}[], placeholder?: string, disabled?: boolean, size?: keyof TRIGGER_SIZE, id?: string, triggerClassName?: string, contentClassName?: string, "aria-label"?: string }} props
 */
export function AppSelect({
  value,
  onValueChange,
  options,
  placeholder = "Chọn…",
  disabled = false,
  size = "md",
  id,
  triggerClassName,
  contentClassName,
  "aria-label": ariaLabel,
}) {
  const stringValue =
    value === undefined || value === null || value === "" ? "__all__" : String(value);

  const handleValueChange = (val) => {
    if (val === "__all__") {
      onValueChange?.("");
    } else {
      onValueChange?.(val);
    }
  };

  return (
    <Select
      value={stringValue}
      onValueChange={handleValueChange}
      disabled={disabled}
    >
      <SelectTrigger
        id={id}
        aria-label={ariaLabel}
        className={cn(TRIGGER_SIZE[size] || TRIGGER_SIZE.md, triggerClassName)}
      >
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent className={contentClassName} position="popper">
        {options.map((opt) => {
          const optValue =
            opt.value === undefined || opt.value === null || opt.value === ""
              ? "__all__"
              : String(opt.value);
          return (
            <SelectItem
              key={optValue}
              value={optValue}
              disabled={opt.disabled}
            >
              {opt.label}
            </SelectItem>
          );
        })}
      </SelectContent>
    </Select>
  );
}
