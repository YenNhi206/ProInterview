import React from "react";
import { ChevronDown, CheckCircle2, CircleDashed } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

/** Tiêu đề mục hồ sơ */
export function ProfileSectionHeading({ children, requiredMark = false, requiredLabel = "" }) {
  return (
    <span className="profile-cv-section-heading inline-flex items-center gap-1.5 font-bold tracking-tight text-white text-sm sm:text-base">
      <span>{children}</span>
      {requiredMark ? (
        <span
          className="text-rose-400 font-extrabold text-xs ml-0.5"
          title={requiredLabel || "Bắt buộc điền"}
          aria-hidden
        >
          *
        </span>
      ) : null}
    </span>
  );
}

/** Mục luôn mở, hiển thị dạng container cao cấp (vd. Thông tin tài khoản & liên lạc). */
export function ProfileCvStaticSection({
  title,
  icon: Icon,
  badge,
  requiredMark = false,
  showDividerBelow = false,
  children,
}) {
  return (
    <section className={`profile-cv-static-section ${showDividerBelow ? "border-b border-white/10 pb-8 mb-8" : "mb-6"}`}>
      {title && (
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2.5">
            {Icon && (
              <div className="flex size-8 items-center justify-center rounded-xl bg-violet-500/15 border border-violet-400/25 text-violet-300">
                <Icon size={16} />
              </div>
            )}
            <ProfileSectionHeading requiredMark={requiredMark}>{title}</ProfileSectionHeading>
          </div>
          {badge && (
            <span className="text-[11px] font-semibold text-slate-400 bg-white/5 border border-white/10 px-2.5 py-1 rounded-full">
              {badge}
            </span>
          )}
        </div>
      )}
      <div className="profile-cv-static-body">{children}</div>
    </section>
  );
}

/** Hàng mục CV dạng accordion cao cấp: Icon + Title + Preview Status + Mũi tên mượt mà. */
export function ProfileCvAccordionSection({
  title,
  icon: Icon,
  preview,
  isFilled = false,
  badge,
  requiredMark = false,
  requiredLabel = "",
  description,
  isOpen,
  onToggle,
  children,
}) {
  return (
    <div
      className={`group rounded-2xl border transition-all duration-200 mb-3 overflow-hidden ${
        isOpen
          ? "border-violet-500/40 bg-gradient-to-b from-[#18133f]/90 to-[#120e30]/95 shadow-[0_8px_32px_rgba(124,58,237,0.14)]"
          : "border-white/10 bg-[#130f30]/50 hover:bg-[#18133d]/70 hover:border-violet-500/25"
      }`}
    >
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={isOpen}
        className="flex w-full items-center justify-between p-4 sm:p-4.5 cursor-pointer select-none text-left transition-colors"
      >
        <div className="flex items-center gap-3.5 min-w-0 pr-3">
          {Icon && (
            <div
              className={`flex size-9 shrink-0 items-center justify-center rounded-xl border transition-colors ${
                isOpen
                  ? "bg-violet-600/25 border-violet-400/40 text-violet-200 shadow-[0_0_12px_rgba(124,58,237,0.3)]"
                  : isFilled
                  ? "bg-emerald-500/15 border-emerald-400/30 text-emerald-300"
                  : "bg-white/5 border-white/10 text-slate-400 group-hover:text-slate-200"
              }`}
            >
              <Icon size={17} strokeWidth={2} />
            </div>
          )}

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <ProfileSectionHeading requiredMark={requiredMark} requiredLabel={requiredLabel}>
                {title}
              </ProfileSectionHeading>
              {badge && (
                <span className="hidden sm:inline-flex items-center text-[10px] font-bold uppercase tracking-wider text-violet-300 bg-violet-500/20 border border-violet-400/25 px-2 py-0.5 rounded-full">
                  {badge}
                </span>
              )}
            </div>

            {preview ? (
              <p className="mt-0.5 text-xs text-slate-400 font-medium truncate max-w-md sm:max-w-lg">
                {preview}
              </p>
            ) : (
              <p className="mt-0.5 text-xs text-slate-500 font-medium">
                {isFilled ? "Đã cập nhật dữ liệu" : "Chưa có thông tin"}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          {isFilled ? (
            <span className="hidden sm:inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-0.5 rounded-full">
              <CheckCircle2 size={12} />
              Đã điền
            </span>
          ) : (
            <span className="hidden sm:inline-flex items-center gap-1 text-[11px] font-medium text-slate-500 bg-white/[0.03] border border-white/5 px-2 py-0.5 rounded-full">
              <CircleDashed size={12} />
              Chưa điền
            </span>
          )}

          <motion.div
            animate={{ rotate: isOpen ? 180 : 0 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            className={`flex size-8 items-center justify-center rounded-xl border transition-colors ${
              isOpen
                ? "bg-violet-500/20 border-violet-400/30 text-violet-200"
                : "bg-white/5 border-white/10 text-slate-400 group-hover:text-white group-hover:bg-white/10"
            }`}
          >
            <ChevronDown size={16} strokeWidth={2.5} aria-hidden />
          </motion.div>
        </div>
      </button>

      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden border-t border-white/10"
          >
            <div className="p-4 sm:p-5 pt-3.5 space-y-3 bg-black/10">
              {description ? (
                <p className="text-xs font-medium text-slate-300/80 leading-relaxed">
                  {description}
                </p>
              ) : null}
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function ProfileCvTextarea({
  value,
  onChange,
  placeholder,
  rows = 4,
  disabled = false,
  maxLength,
  hint,
}) {
  const charCount = (value || "").length;

  return (
    <div className="relative w-full space-y-2">
      <textarea
        rows={rows}
        disabled={disabled}
        maxLength={maxLength}
        className="w-full resize-y min-h-[110px] rounded-xl border border-white/15 bg-[#0b0820]/90 hover:bg-[#0f0b29] focus:bg-[#120e33] p-4 text-sm font-medium text-slate-100 placeholder:text-slate-500 focus:border-violet-400 focus:outline-none focus:ring-2 focus:ring-violet-500/25 disabled:cursor-not-allowed disabled:opacity-50 transition-all duration-200 leading-relaxed shadow-inner"
        placeholder={placeholder}
        value={value}
        onChange={onChange}
      />
      <div className="flex items-center justify-between px-1 text-[11px] text-slate-400 font-medium">
        <span>{hint || "Nội dung chi tiết giúp hồ sơ tạo ấn tượng tốt hơn khi luyện phỏng vấn"}</span>
        {charCount > 0 && (
          <span className="font-mono text-violet-300/80">{charCount} ký tự</span>
        )}
      </div>
    </div>
  );
}

/** Dòng mô tả dưới tiêu đề «Hồ sơ cá nhân» */
export function ProfileCvMentorHint({ isMentor = false }) {
  return (
    <p className="mt-1.5 text-xs sm:text-sm font-medium leading-relaxed text-slate-300/80">
      {isMentor
        ? "Cập nhật hồ sơ để học viên hiểu rõ chuyên môn và kinh nghiệm thực chiến của Mentor."
        : "Thông tin hồ sơ giúp ProInterview cá nhân hóa câu hỏi phỏng vấn AI và ghép nối mentor phù hợp nhất."}
    </p>
  );
}
