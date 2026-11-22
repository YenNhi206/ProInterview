import React from "react";
import { Link } from "react-router";
import { motion } from "motion/react";
import { ArrowLeft, Sparkles } from "lucide-react";

/**
 * Header chuẩn thống nhất cho tất cả các trang Mentor trong ProInterview:
 * - Eyebrow: Pill badge viền tím violet sang trọng, có icon + text in hoa
 * - Title: Font Headline cực nét, màu trắng nổi bật, hỗ trợ highlight tím
 * - Subtitle: Màu text-slate-300 dễ đọc trên nền tối
 * - Actions: Khu vực nút thao tác bên phải (hoặc bên dưới khi màn hình nhỏ)
 * - Back Link: Tuỳ chọn quay lại trang trước mượt mà
 */
export function MentorPageHeader({
  icon: Icon = Sparkles,
  eyebrow,
  title,
  highlight,
  subtitle,
  backTo,
  backLabel = "Quay lại",
  backState,
  actions,
  className = "",
  children,
}) {
  return (
    <motion.header
      initial={{ opacity: 0, y: -12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
      className={`mb-8 flex flex-col gap-5 pt-2 lg:flex-row lg:items-end lg:justify-between lg:gap-8 ${className}`.trim()}
    >
      <div className="min-w-0 max-w-3xl flex-1">
        {/* Back navigation link if provided */}
        {backTo && (
          <Link
            to={backTo}
            state={backState}
            className="group mb-3 inline-flex items-center gap-1.5 text-xs font-semibold text-slate-400 transition hover:text-violet-300"
          >
            <ArrowLeft size={13} className="transition-transform group-hover:-translate-x-1" />
            <span>{backLabel}</span>
          </Link>
        )}

        {/* Main H1 Title */}
        {title && (
          <h1 className="font-headline text-2xl font-black leading-[1.18] tracking-tight text-white sm:text-3xl lg:text-[2.25rem]">
            {title}
            {highlight && (
              <>
                {" "}
                <span className="text-violet-400">{highlight}</span>
              </>
            )}
          </h1>
        )}

        {/* Subtitle */}
        {subtitle && (
          <p className="mt-2.5 max-w-2xl text-xs sm:text-sm leading-relaxed text-slate-300">
            {subtitle}
          </p>
        )}

        {/* Extra children if needed */}
        {children}
      </div>

      {/* Right-aligned Actions */}
      {actions && (
        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          {actions}
        </div>
      )}
    </motion.header>
  );
}

export default MentorPageHeader;
