/** Hiển thị trạng thái online admin (theo `lastSeenAt` từ API). */

export function formatLastSeenVi(value) {
  if (!value) return "Chưa hoạt động";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  const diffMs = Date.now() - d.getTime();
  if (diffMs < 60_000) return "Vừa xong";
  if (diffMs < 3600_000) {
    const m = Math.floor(diffMs / 60_000);
    return `${m} phút trước`;
  }
  if (diffMs < 86_400_000) {
    const h = Math.floor(diffMs / 3600_000);
    return `${h} giờ trước`;
  }
  return d.toLocaleString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function UserOnlineStatus({ isOnline, lastSeenAt, isActive = true, compact = false }) {
  if (isActive === false) {
    return (
      <span className="flex flex-col items-center gap-0.5">
        <span className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-red-600">
          <span className="size-2 rounded-full bg-red-500" aria-hidden />
          Đã khóa
        </span>
      </span>
    );
  }

  if (isOnline) {
    return (
      <span className="flex flex-col items-center gap-0.5">
        <span className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-emerald-600">
          <span className="relative flex size-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
            <span className="relative inline-flex size-2 rounded-full bg-emerald-500" />
          </span>
          Đang online
        </span>
      </span>
    );
  }

  return (
    <span className="flex flex-col items-center gap-0.5">
      <span className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-slate-500">
        <span className="size-2 rounded-full bg-slate-300" aria-hidden />
        Không online
      </span>
      {!compact && lastSeenAt ? (
        <span className="text-[10px] font-semibold text-slate-400" title={String(lastSeenAt)}>
          {formatLastSeenVi(lastSeenAt)}
        </span>
      ) : null}
    </span>
  );
}
