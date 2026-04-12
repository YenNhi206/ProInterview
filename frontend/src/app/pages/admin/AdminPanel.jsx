import React from "react";

/** Khung nội dung chung cho các màn admin (stub / MVP). */
export function AdminPanel({ title, description, bullets = [], children }) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-black tracking-tight text-white sm:text-3xl">{title}</h1>
        {description && (
          <p className="mt-2 max-w-3xl text-sm leading-relaxed text-white/55">{description}</p>
        )}
      </div>
      {bullets.length > 0 && (
        <ul className="list-inside list-disc space-y-1.5 rounded-2xl border border-white/10 bg-white/[0.04] p-5 text-sm text-white/70">
          {bullets.map((b) => (
            <li key={b}>{b}</li>
          ))}
        </ul>
      )}
      {children ?? (
        <p className="rounded-2xl border border-dashed border-white/15 bg-white/[0.02] px-5 py-8 text-center text-sm text-white/45">
          Giao diện đang ở dạng khung — API quản trị &amp; bảng dữ liệu sẽ nối trong bước tiếp theo.
        </p>
      )}
    </div>
  );
}
