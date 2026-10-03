import { ChevronDown } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

/** Tiêu đề mục, gạch chân ngắn dưới chữ (scoped `.profile-page`). */
export function ProfileSectionHeading({ children, requiredMark = false }) {
  return (
    <span className="profile-cv-section-heading font-extrabold tracking-wide text-white">
      {children}
      {requiredMark ? (
        <span className="ml-0.5 font-extrabold text-rose-400" aria-hidden>
          *
        </span>
      ) : null}
    </span>
  );
}

/** Mục luôn mở, không có mũi tên (vd. Liên hệ tài khoản). */
export function ProfileCvStaticSection({
  title,
  requiredMark = false,
  showDividerBelow = false,
  children,
}) {
  return (
    <section
      className={`profile-cv-static-section${showDividerBelow ? " profile-cv-accordion-item--split" : ""}`}
    >
      <ProfileSectionHeading requiredMark={requiredMark}>{title}</ProfileSectionHeading>
      <div className="profile-cv-static-body">{children}</div>
    </section>
  );
}

/** Hàng mục CV: tiêu đề + mũi tên; bấm để mở/đóng ô nhập với animation mượt mà. */
export function ProfileCvAccordionSection({
  title,
  requiredMark = false,
  description,
  isOpen,
  onToggle,
  showDividerBelow = false,
  children,
}) {
  return (
    <div
      className={`profile-cv-accordion-item${showDividerBelow ? " profile-cv-accordion-item--split" : ""} transition-colors duration-200`}
    >
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={isOpen}
        className="profile-cv-accordion-trigger group py-3.5 flex items-center justify-between w-full cursor-pointer select-none"
      >
        <ProfileSectionHeading requiredMark={requiredMark}>{title}</ProfileSectionHeading>
        <motion.div
          animate={{ rotate: isOpen ? 180 : 0 }}
          transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
          className="text-violet-300 group-hover:text-white shrink-0 p-1 rounded-lg group-hover:bg-white/5 transition-colors"
        >
          <ChevronDown size={18} strokeWidth={2.5} aria-hidden />
        </motion.div>
      </button>

      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden"
          >
            <div className="profile-cv-accordion-panel pt-1 pb-4">
              {description ? (
                <p className="mb-4 text-xs font-medium text-slate-300 leading-relaxed">{description}</p>
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
    <div className="relative w-full space-y-1.5">
      <textarea
        rows={rows}
        disabled={disabled}
        maxLength={maxLength}
        className="w-full resize-y min-h-[120px] rounded-2xl border border-white/15 bg-[#0e0c24]/80 hover:bg-[#120f2e]/85 focus:bg-[#151236] p-4 text-sm font-medium text-slate-100 placeholder:text-slate-400/70 focus:border-violet-400 focus:outline-none focus:ring-2 focus:ring-violet-500/25 disabled:cursor-not-allowed disabled:opacity-50 transition-all duration-200 leading-relaxed shadow-inner"
        style={{ outline: "none" }}
        placeholder={placeholder}
        value={value}
        onChange={onChange}
      />
      <div className="flex items-center justify-between px-1 text-[11px] text-slate-400 font-medium">
        <span>{hint || "Chia sẻ chi tiết giúp hồ sơ tạo ấn tượng tốt hơn"}</span>
        {charCount > 0 && (
          <span className="font-mono text-violet-300/80">{charCount} ký tự</span>
        )}
      </div>
    </div>
  );
}

/** Dòng mô tả dưới tiêu đề «Hồ sơ cá nhân», không in đậm. */
export function ProfileCvMentorHint({ isMentor = false }) {
  return (
    <p className="mt-2 text-xs sm:text-sm font-medium leading-relaxed text-slate-300/90">
      {isMentor
        ? "Hoàn thiện hồ sơ để học viên hiểu rõ hơn về kinh nghiệm, chuyên môn và cách Mentor có thể đồng hành trong quá trình luyện tập."
        : "Hoàn thiện thông tin của bạn để ProInterview hiểu rõ hơn về học vấn, kinh nghiệm và mục tiêu nghề nghiệp, từ đó hỗ trợ luyện phỏng vấn phù hợp hơn."}
    </p>
  );
}

