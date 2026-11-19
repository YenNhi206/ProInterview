import React from "react";

/**
 * Tiêu đề trang khu vực Moderator. Nền shell (app-user-shell) là nền tối nên chữ tiêu đề phải sáng —
 * thẻ nội dung bên dưới vẫn là card trắng.
 */
export function ModeratorPageHeader({ title, subtitle, actions }) {
  return (
    <div className="mb-2 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="font-headline text-[clamp(1.75rem,4vw,2.75rem)] font-black leading-tight tracking-tight text-white">{title}</h1>
        {subtitle ? <p className="mt-2 max-w-2xl text-sm text-slate-300">{subtitle}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-end gap-3">{actions}</div> : null}
    </div>
  );
}
