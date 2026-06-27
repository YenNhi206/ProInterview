import { createPortal } from "react-dom";

export function ArchiveCourseDialog({ open, courseTitle, archiving, onOpenChange, onConfirm }) {
  if (!open) return null;

  const title = courseTitle?.trim() || "khóa học này";

  const modal = (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 sm:p-6">
      <button
        type="button"
        aria-label="Đóng"
        disabled={archiving}
        className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm"
        onClick={() => onOpenChange(false)}
      />
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="archive-course-title"
        aria-describedby="archive-course-desc"
        className="relative z-10 w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-2xl"
      >
        <h2 id="archive-course-title" className="text-xl font-black text-slate-900 tracking-tight">
          Xác nhận xóa khóa học?
        </h2>
        <p id="archive-course-desc" className="mt-4 text-sm leading-relaxed text-slate-600">
          Bạn có chắc muốn xóa <span className="font-semibold text-slate-900">{title}</span>? Khóa học
          sẽ ẩn khỏi trang Khám phá; dữ liệu học viên đã mua khóa vẫn được giữ trên hệ thống.
        </p>
        <div className="mt-8 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button
            type="button"
            disabled={archiving}
            onClick={() => onOpenChange(false)}
            className="rounded-xl border border-slate-200 bg-white px-6 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            Hủy
          </button>
          <button
            type="button"
            disabled={archiving}
            onClick={onConfirm}
            className="rounded-xl bg-red-600 px-6 py-3 text-sm font-bold text-white hover:bg-red-700 disabled:opacity-50"
          >
            {archiving ? "Đang xóa…" : "Xóa khóa học"}
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}
