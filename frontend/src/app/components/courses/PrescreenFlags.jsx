import { createPortal } from "react-dom";
import { AlertOctagon, AlertTriangle, Bot, Info, ListChecks } from "lucide-react";
import { SEVERITY_LABELS, countFlags, prescreenBadge, sortFlags } from "../../utils/course/prescreenFlags.js";

/** `variant`: `dark` (khung workspace) hoặc `light` (hộp thoại nền trắng của trang duyệt). */
const SEVERITY_STYLE = {
  dark: {
    critical: { Icon: AlertOctagon, box: "border-rose-500/40 bg-rose-500/10", text: "text-rose-300" },
    warning: { Icon: AlertTriangle, box: "border-amber-500/40 bg-amber-500/10", text: "text-amber-300" },
    info: { Icon: Info, box: "border-sky-500/30 bg-sky-500/10", text: "text-sky-300" },
  },
  light: {
    critical: { Icon: AlertOctagon, box: "border-rose-200 bg-rose-50", text: "text-rose-700" },
    warning: { Icon: AlertTriangle, box: "border-amber-200 bg-amber-50", text: "text-amber-700" },
    info: { Icon: Info, box: "border-sky-200 bg-sky-50", text: "text-sky-700" },
  },
};
const TEXT = {
  dark: { main: "text-white", sub: "text-slate-400", head: "text-white", panel: "border-white/10 bg-white/[0.03]", ok: "text-emerald-300", ai: "text-violet-300" },
  light: { main: "text-slate-900", sub: "text-slate-600", head: "text-slate-900", panel: "border-slate-200 bg-slate-50", ok: "text-emerald-700", ai: "text-violet-700" },
};
const TONE_STYLE = {
  dark: {
    ok: "border-emerald-500/40 bg-emerald-500/10 text-emerald-300",
    warn: "border-amber-500/40 bg-amber-500/10 text-amber-300",
    bad: "border-rose-500/40 bg-rose-500/10 text-rose-300",
    muted: "border-white/15 bg-white/5 text-slate-300",
  },
  light: {
    ok: "border-emerald-200 bg-emerald-50 text-emerald-700",
    warn: "border-amber-200 bg-amber-50 text-amber-700",
    bad: "border-rose-200 bg-rose-50 text-rose-700",
    muted: "border-slate-200 bg-slate-50 text-slate-600",
  },
};

/** Nhãn gọn cho thẻ khóa ở trang duyệt (AI-09). */
export function PrescreenBadge({ prescreen, className = "", variant = "dark" }) {
  const { tone, text } = prescreenBadge(prescreen);
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-bold ${TONE_STYLE[variant][tone]} ${className}`} title="Kết quả AI sàng lọc (AI-08), chỉ là gợi ý cho moderator">
      <Bot className="size-3.5" aria-hidden /> {text}
    </span>
  );
}

/** Danh sách cờ, nghiêm trọng trước. `emptyText` khi không có cờ. */
export function PrescreenFlagList({ flags, emptyText = "Không có cờ nào.", variant = "dark" }) {
  const sorted = sortFlags(flags);
  const t = TEXT[variant];
  if (!sorted.length) return <p className={`text-xs font-semibold ${t.ok}`}>{emptyText}</p>;
  return (
    <ul className="space-y-2">
      {sorted.map((f, i) => {
        const st = SEVERITY_STYLE[variant][f.severity] || SEVERITY_STYLE[variant].info;
        return (
          <li key={`${f.code}-${i}`} className={`flex items-start gap-2.5 rounded-xl border px-3 py-2 ${st.box}`}>
            <st.Icon className={`mt-0.5 size-4 shrink-0 ${st.text}`} aria-hidden />
            <div className="min-w-0 text-xs">
              <p className={`font-semibold ${t.main}`}>
                <span className={`mr-1.5 font-black ${st.text}`}>{SEVERITY_LABELS[f.severity] || f.severity}</span>
                {f.message || f.code}
              </p>
              {f.evidence ? <p className={`mt-0.5 break-words ${t.sub}`}>“{f.evidence}”</p> : null}
              {f.source === "ai" ? <p className={`mt-0.5 text-[10px] font-bold uppercase tracking-wider ${t.ai}`}>AI phát hiện</p> : null}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

/** Khối đầy đủ cho Platform Moderator: trạng thái, điểm, tóm tắt AI và danh sách cờ. */
export function PrescreenPanel({ prescreen, variant = "dark" }) {
  const t = TEXT[variant];
  return (
    <section className={`rounded-2xl border p-4 ${t.panel}`} aria-label="Kết quả AI sàng lọc">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className={`flex items-center gap-2 text-sm font-black ${t.head}`}>
          <ListChecks className={`size-4 ${t.ai}`} aria-hidden /> AI sàng lọc
        </p>
        <PrescreenBadge prescreen={prescreen} variant={variant} />
      </div>
      {!prescreen ? (
        <p className={`text-xs ${t.sub}`}>Khóa này gửi duyệt trước khi có AI sàng lọc. Kiểm tra thủ công.</p>
      ) : prescreen.status === "pending" ? (
        <p className={`text-xs ${t.sub}`}>AI đang sàng lọc, tải lại sau ít phút.</p>
      ) : prescreen.status === "failed" ? (
        <p className={`text-xs ${t.sub}`}>AI chưa sàng lọc được{prescreen.error ? ` (${prescreen.error})` : ""}. Kiểm tra thủ công.</p>
      ) : (
        <>
          {prescreen.summary ? <p className={`mb-3 text-xs leading-relaxed ${t.sub}`}>{prescreen.summary}</p> : null}
          <PrescreenFlagList flags={prescreen.flags} emptyText="AI không phát hiện vấn đề nào." variant={variant} />
        </>
      )}
      <p className={`mt-3 text-[10px] ${t.sub}`}>Chỉ là gợi ý. Moderator quyết định duyệt hay từ chối.</p>
    </section>
  );
}

/**
 * Mentor bấm gửi duyệt mà còn cờ nghiêm trọng / cảnh báo (kiểm tra theo luật của AI-08): hỏi lại trước khi gửi.
 * Không chặn: cờ chỉ là gợi ý, Platform Moderator quyết định.
 */
export function PrescreenConfirmDialog({ open, flags, busy, onCancel, onConfirm }) {
  if (!open) return null;
  const c = countFlags(flags);
  const modal = (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 sm:p-6">
      {/* Màu lớp phủ đặt bằng style: luật giao diện sáng đổi mọi `bg-[#0…]` thành nền trắng. */}
      <button type="button" aria-label="Đóng" disabled={busy} className="absolute inset-0 backdrop-blur-sm" style={{ backgroundColor: "rgba(5, 2, 13, 0.6)" }} onClick={onCancel} />
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="prescreen-confirm-title"
        className="relative z-10 max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-white/10 bg-[#150c33] p-6 text-slate-100 shadow-[0_24px_60px_rgba(0,0,0,0.55)] sm:p-8"
      >
        <h2 id="prescreen-confirm-title" className="text-xl font-black tracking-tight text-white">Khóa học còn vấn đề cần xem lại</h2>
        <p className="mt-2 text-sm leading-relaxed text-slate-300">
          {c.critical ? `${c.critical} lỗi nghiêm trọng` : ""}
          {c.critical && c.warning ? " và " : ""}
          {c.warning ? `${c.warning} cảnh báo` : ""}. Platform Moderator sẽ thấy các cờ này khi duyệt; nên sửa trước khi gửi để tránh bị từ chối.
        </p>
        <div className="mt-4">
          <PrescreenFlagList flags={flags} />
        </div>
        <div className="mt-6 flex flex-col-reverse gap-2.5 sm:flex-row sm:justify-end">
          <button type="button" disabled={busy} onClick={onConfirm} className="min-h-[42px] rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 text-xs font-bold text-slate-300 hover:bg-white/10 hover:text-white disabled:opacity-50">
            {busy ? "Đang gửi…" : "Vẫn gửi duyệt"}
          </button>
          <button type="button" disabled={busy} onClick={onCancel} className="min-h-[42px] rounded-xl bg-[#93f72b] px-5 py-2.5 text-xs font-bold text-slate-950 hover:bg-[#a8ff4e] disabled:opacity-50">
            Quay lại sửa
          </button>
        </div>
      </div>
    </div>
  );
  return createPortal(modal, document.body);
}
