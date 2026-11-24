/**
 * AI-09: hiển thị kết quả sàng lọc khóa học (AI-08) cho Platform Moderator và mentor.
 * `flags[]`: { code, severity: critical | warning | info, message, evidence, source: rule | ai }.
 */

export const SEVERITY_ORDER = { critical: 0, warning: 1, info: 2 };
export const SEVERITY_LABELS = { critical: "Nghiêm trọng", warning: "Cảnh báo", info: "Lưu ý" };

/** Sắp cờ: nghiêm trọng trước, rồi cảnh báo, rồi lưu ý (giữ thứ tự gốc trong cùng mức). */
export function sortFlags(flags) {
  return [...(flags || [])]
    .map((f, i) => ({ f, i }))
    .sort((a, b) => (SEVERITY_ORDER[a.f.severity] ?? 3) - (SEVERITY_ORDER[b.f.severity] ?? 3) || a.i - b.i)
    .map(({ f }) => f);
}

/** Đếm cờ theo mức. */
export function countFlags(flags) {
  const out = { critical: 0, warning: 0, info: 0 };
  for (const f of flags || []) if (out[f.severity] !== undefined) out[f.severity] += 1;
  return out;
}

/**
 * Nhãn tổng cho thẻ khóa ở trang duyệt.
 * @returns {{ tone: "ok"|"warn"|"bad"|"muted", text: string }}
 */
export function prescreenBadge(prescreen) {
  if (!prescreen) return { tone: "muted", text: "Chưa sàng lọc" };
  if (prescreen.status === "pending") return { tone: "muted", text: "AI đang sàng lọc…" };
  if (prescreen.status === "failed") return { tone: "muted", text: "AI sàng lọc lỗi, kiểm tra thủ công" };
  const c = countFlags(prescreen.flags);
  const score = prescreen.score ?? null;
  const scoreText = score === null ? "" : ` · ${score}/100`;
  if (c.critical) return { tone: "bad", text: `${c.critical} lỗi nghiêm trọng${scoreText}` };
  if (c.warning) return { tone: "warn", text: `${c.warning} cảnh báo${scoreText}` };
  return { tone: "ok", text: `Không có cảnh báo${scoreText}` };
}
