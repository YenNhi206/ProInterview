import React from "react";

/**
 * Tiêu đề trang khu vực Moderator. Nền shell (app-user-shell) là nền tối nên chữ tiêu đề phải sáng —
 * thẻ nội dung bên dưới vẫn là card trắng.
 */
export function ModeratorPageHeader({ title, subtitle, actions }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h2 className="text-xl font-extrabold text-white">{title}</h2>
        {subtitle ? <p className="mt-0.5 text-sm text-slate-300">{subtitle}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-end gap-3">{actions}</div> : null}
    </div>
  );
}
