import React from "react";
import {
  adminPageKicker,
  adminPageSubtitle,
  adminPageTitle,
} from "../../components/admin/AdminPageShell.jsx";

/** Khung nội dung chung cho các màn admin (stub / MVP), đồng bộ nền sáng mentor/user. */
export function AdminPanel({ title, description, bullets = [], children }) {
  return (
    <div className="space-y-6">
      <div className="glass-card border-slate-200/90 px-6 py-5">
        <p className={`mb-1 ${adminPageKicker}`}>Admin Workspace</p>
        <h1 className={adminPageTitle}>{title}</h1>
        {description && <p className={`mt-2 max-w-3xl ${adminPageSubtitle}`}>{description}</p>}
      </div>
      {bullets.length > 0 && (
        <ul className="list-inside list-disc space-y-1.5 rounded-2xl border border-white/10 bg-white/[0.04] p-5 text-sm font-semibold text-slate-300">
          {bullets.map((b) => (
            <li key={b}>{b}</li>
          ))}
        </ul>
      )}
      {children ?? (
        <p className="rounded-2xl border border-dashed border-white/15 bg-white/[0.02] px-5 py-8 text-center text-sm text-slate-400">
          Giao diện đang ở dạng khung, API quản trị &amp; bảng dữ liệu sẽ nối trong bước tiếp theo.
        </p>
      )}
    </div>
  );
}
