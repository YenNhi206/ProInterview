/** Shared tokens — mentor course create (Dark Luxury Studio) */

export const mentorCreateScopeClass = "mentor-course-create";

export const mentorCreateShellClass =
  "border border-white/10 bg-[#160f26]/85 backdrop-blur-xl p-5 sm:p-8 rounded-2xl shadow-[0_16px_48px_rgba(0,0,0,0.45)] text-slate-100";

export const mentorSectionCardClass =
  "relative border border-white/10 border-l-[3px] border-l-[#93f72b] bg-white/[0.03] p-5 sm:p-6 rounded-xl";

export const mentorInputClass =
  "w-full rounded-xl border border-white/15 bg-[#10091e] px-4 py-2.5 text-base text-white outline-none transition placeholder:text-slate-500 focus:border-[#93f72b] focus:ring-2 focus:ring-[#93f72b]/20 sm:text-sm";

export const mentorLabelClass =
  "mb-2 block text-xs font-semibold uppercase tracking-wider text-violet-200/80";

export const mentorPrimaryBtnClass =
  "inline-flex items-center justify-center gap-2 rounded-xl bg-[#93f72b] px-6 py-2.5 text-base font-bold text-slate-950 shadow-[0_0_20px_rgba(147,247,43,0.3)] transition-all hover:bg-[#a8ff4e] hover:shadow-[0_0_28px_rgba(147,247,43,0.5)] active:scale-[0.98] sm:text-sm cursor-pointer";

export const mentorGhostBtnClass =
  "inline-flex items-center justify-center rounded-xl border border-white/15 bg-white/[0.05] px-5 py-2.5 text-base font-semibold text-slate-200 transition-all hover:border-white/30 hover:bg-white/10 sm:text-sm cursor-pointer";

/** Checkbox — dấu tích lime (brand ProInterview) */
export const mentorCheckboxClass =
  "h-4 w-4 shrink-0 cursor-pointer rounded border-white/20 bg-white/5 accent-[#93f72b] focus:ring-2 focus:ring-[#93f72b]/30";

export const mentorValidationShakeClass =
  "mentor-validation-shake border-red-500/40 bg-red-950/40 text-red-200 rounded-xl";

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
  border-radius: 12px !important;
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
