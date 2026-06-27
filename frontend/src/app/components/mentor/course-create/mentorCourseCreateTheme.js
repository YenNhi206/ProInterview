/** Shared tokens — mentor course create */

export const mentorCreateScopeClass = "mentor-course-create";

export const mentorCreateShellClass =
  "border border-slate-200 bg-white p-5 sm:p-8 rounded-[12px] shadow-[0_1px_3px_rgba(15,23,42,0.06)]";

export const mentorSectionCardClass =
  "relative border border-slate-200 border-l-[3px] border-l-[#8037f4] bg-slate-50/40 p-4 sm:p-5 rounded-[10px]";

export const mentorInputClass =
  "w-full rounded-[10px] border border-slate-300 bg-white px-3.5 py-2.5 text-base text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-[#8037f4] focus:ring-2 focus:ring-[#8037f4]/12 sm:text-sm";

export const mentorLabelClass =
  "mb-1.5 block text-sm font-semibold uppercase tracking-wide text-slate-600 sm:text-xs";

export const mentorPrimaryBtnClass =
  "inline-flex items-center justify-center gap-2 rounded-[10px] bg-[#8037f4] px-6 py-2.5 text-base font-semibold text-white shadow-sm transition hover:bg-[#630ed4] active:scale-[0.98] sm:text-sm";

export const mentorGhostBtnClass =
  "inline-flex items-center justify-center rounded-[10px] border border-slate-300 bg-white px-5 py-2.5 text-base font-semibold text-slate-600 transition hover:border-slate-400 hover:bg-slate-50 sm:text-sm";

/** Checkbox — dấu tích lime (brand ProInterview) */
export const mentorCheckboxClass =
  "h-4 w-4 shrink-0 cursor-pointer rounded border-slate-300 accent-[#B4F000] focus:ring-2 focus:ring-[#B4F000]/25";

export const mentorValidationShakeClass =
  "mentor-validation-shake border-red-400 bg-red-50/90 text-red-900 rounded-[10px]";

export const mentorValidationKeyframes = `
@keyframes mentor-shake {
  0%, 100% { transform: translateX(0); }
  15% { transform: translateX(-8px); }
  30% { transform: translateX(8px); }
  45% { transform: translateX(-5px); }
  60% { transform: translateX(5px); }
  75% { transform: translateX(-2px); }
  90% { transform: translateX(2px); }
}
.mentor-validation-shake {
  animation: mentor-shake 0.5s ease-in-out;
}
.mentor-course-create input:not([type="checkbox"]):not([type="radio"]),
.mentor-course-create textarea,
.mentor-course-create select {
  border-radius: 10px !important;
}
.mentor-course-create textarea {
  resize: vertical !important;
}
@media (max-width: 639px) {
  .mentor-course-create [data-slot="select-trigger"] {
    font-size: 1rem !important;
    line-height: 1.5rem;
  }
  .mentor-course-create [data-slot="select-item"] {
    font-size: 1rem !important;
  }
}
`;
