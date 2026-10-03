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
  default: "min-h-[46px] px-4 py-3 text-sm",
  md: "min-h-[42px] px-3.5 py-2.5 text-sm",
  sm: "min-h-8 px-2.5 py-1 text-xs",
  compact: "min-h-[38px] px-3 py-2 text-xs",
  filter: "min-h-[42px] px-3.5 py-2.5 text-sm",
};

// Radix items cannot use an empty value. Keep an explicit "all" option
// distinct from an unselected field, so placeholders still work in forms.
const EMPTY_OPTION = "__all__";
const isEmpty = (value) => value === undefined || value === null || value === "";

/** Shared select for forms and filters; theme also travels with the portal. */
export function AppSelect({
  value,
  onValueChange,
  options,
  placeholder = "Chọn…",
  disabled = false,
  size = "md",
  theme = "light",
  icon: Icon,
  id,
  triggerClassName,
  contentClassName,
  noRing = false,
  "aria-label": ariaLabel,
  ...triggerProps
}) {
  const hasEmptyOption = options.some((opt) => isEmpty(opt.value));
  const stringValue = isEmpty(value)
    ? (hasEmptyOption ? EMPTY_OPTION : "")
    : String(value);

  const handleValueChange = (val) => {
    if (val === EMPTY_OPTION) {
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
        data-noring={noRing ? "true" : undefined}
        data-ui-theme={theme}
        className={cn(TRIGGER_SIZE[size] || TRIGGER_SIZE.md, triggerClassName)}
        {...triggerProps}
      >
        {Icon && <Icon className="pi-select-leading-icon size-4" aria-hidden="true" />}
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent data-ui-theme={theme} className={contentClassName} position="popper">
        {options.map((opt) => {
          const optValue =
            isEmpty(opt.value)
              ? EMPTY_OPTION
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
