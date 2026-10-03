/** Phản hồi mentor trên đánh giá công khai (khóa học / hồ sơ mentor). */
export function ReviewReplyBlock({ reply, className = "" }) {
  const content = typeof reply === "string" ? reply : reply?.content;
  if (!content?.trim()) return null;

  const repliedAt = reply?.repliedAt;
  return (
    <div
      className={`mt-3 rounded-2xl border border-violet-500/20 bg-violet-500/10 px-3.5 py-2.5 backdrop-blur-md ${className}`.trim()}
    >
      <p className="text-[10px] font-bold uppercase tracking-wider text-violet-300">Phản hồi từ Mentor</p>
      <p className="mt-1 text-sm leading-relaxed text-slate-200">{content}</p>
      {repliedAt ? (
        <p className="mt-1.5 text-xs text-slate-400">
          {new Date(repliedAt).toLocaleString("vi-VN", {
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          })}
        </p>
      ) : null}
    </div>
  );
}
