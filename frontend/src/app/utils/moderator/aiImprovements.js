/**
 * AI-06: nhãn và tính toán hiển thị cho màn `/moderator/ai-improvements`
 * (API AI-05 `GET/PATCH /api/moderator/ai-improvements`, backtest AI-04, đề xuất `rubric_anchor` AI-18).
 */

export const AI_IMPROVEMENT_TABS = [
  { id: "proposed", label: "Chờ duyệt" },
  { id: "approved", label: "Đang bật" },
  { id: "rejected", label: "Đã từ chối" },
  { id: "rolled_back", label: "Đã rollback" },
  { id: "all", label: "Tất cả" },
];

/** tone: success | info | warning | error | neutral (bảng màu ngữ nghĩa, UI_STYLE_GUIDE mục 2.4). */
const STATUS = {
  proposed: { label: "Chờ duyệt", tone: "info" },
  approved: { label: "Đang bật", tone: "success" },
  rejected: { label: "Đã từ chối", tone: "error" },
  rolled_back: { label: "Đã rollback", tone: "neutral" },
};
export const statusBadge = (status) => STATUS[status] ?? { label: status || "—", tone: "neutral" };

const KIND = {
  few_shot: "Ví dụ đã kiểm duyệt",
  rubric_anchor: "Ví dụ neo từ rubric",
  prompt_change: "Sửa prompt",
  calibration: "Hiệu chỉnh điểm",
};
export const kindLabel = (kind) => KIND[kind] ?? kind ?? "—";

const TARGET = { evaluation: "Prompt chấm điểm", question_gen: "Prompt sinh câu hỏi" };
export const targetLabel = (target) => TARGET[target] ?? target ?? "—";

/** Tên nhóm: năng lực (tra `competencyNames`) hoặc vị trí; `_general` = "Chung". */
export function groupLabel(proposal, competencyNames = {}) {
  const key = proposal?.groupKey ?? "";
  if (!key || key === "_general") return "Chung";
  return competencyNames[key] ?? key;
}

/** Dòng bằng chứng ngắn cho bảng. */
export function evidenceText(proposal) {
  const e = proposal?.evidence ?? {};
  if (proposal?.kind === "rubric_anchor") return `Rubric của ${e.companyCount ?? 0} doanh nghiệp`;
  const n = e.overrideCount ?? e.moderationItemIds?.length ?? 0;
  const delta = Number.isFinite(e.avgScoreDelta)
    ? `, lệch TB ${e.avgScoreDelta > 0 ? "+" : ""}${e.avgScoreDelta.toLocaleString("vi-VN")}`
    : "";
  return `${n} lượt kiểm duyệt${delta}`;
}

const VERDICT = {
  better: { label: "Lệch ít hơn", tone: "success" },
  worse: { label: "Lệch nhiều hơn", tone: "warning" },
  same: { label: "Không đổi", tone: "neutral" },
};

/**
 * Trạng thái backtest cho nhãn.
 * @returns {{ label: string, tone: string, running?: boolean }}
 */
export function backtestBadge(backtest) {
  if (!backtest) return { label: "Chưa backtest", tone: "neutral" };
  if (backtest.status === "running") return { label: "Đang backtest…", tone: "info", running: true };
  if (backtest.status === "failed") return { label: "Backtest lỗi", tone: "error" };
  if (backtest.status === "not_applicable") return { label: "Không áp dụng", tone: "neutral" };
  return VERDICT[backtest.verdict] ?? { label: "Đã backtest", tone: "neutral" };
}

export const isBacktestRunning = (backtest) => backtest?.status === "running";

const fmtNum = (v) => (Number.isFinite(v) ? v.toLocaleString("vi-VN", { maximumFractionDigits: 2 }) : "—");
const fmtPct = (v) => (Number.isFinite(v) ? `${Math.round(v * 100)}%` : "—");

/** "0,75 → 0" cho bảng. */
export function maeChangeText(backtest) {
  const b = backtest?.gold?.before?.mae;
  const a = backtest?.gold?.after?.mae;
  if (!Number.isFinite(b) || !Number.isFinite(a)) return "—";
  return `${fmtNum(b)} → ${fmtNum(a)}`;
}

/**
 * Bảng so sánh trước / sau. `better`: "lower" (lệch càng nhỏ càng tốt) | "higher" | null (chỉ để xem).
 * @returns {{ key: string, label: string, before: string, after: string, trend: "better"|"worse"|"same"|null }[]}
 */
export function statRows(side) {
  const before = side?.before ?? {};
  const after = side?.after ?? {};
  const rows = [
    { key: "mae", label: "Lệch trung bình (mức)", better: "lower", fmt: fmtNum },
    { key: "bias", label: "Lệch có dấu (+ là chấm cao hơn)", better: "abs-lower", fmt: fmtNum },
    { key: "exact", label: "Trùng mức chuẩn", better: "higher", fmt: fmtPct },
    { key: "within1", label: "Lệch ≤ 1 mức", better: "higher", fmt: fmtPct },
    { key: "n", label: "Số câu chấm được", better: null, fmt: (v) => (Number.isFinite(v) ? String(v) : "—") },
  ];
  return rows.map(({ key, label, better, fmt }) => {
    const b = before[key];
    const a = after[key];
    let trend = null;
    if (better && Number.isFinite(b) && Number.isFinite(a)) {
      const vb = better === "abs-lower" ? Math.abs(b) : b;
      const va = better === "abs-lower" ? Math.abs(a) : a;
      if (Math.abs(va - vb) < 1e-9) trend = "same";
      else if (better === "higher") trend = va > vb ? "better" : "worse";
      else trend = va < vb ? "better" : "worse";
    }
    return { key, label, before: fmt(b), after: fmt(a), trend };
  });
}

const exampleId = (e) => `${e?.input ?? ""}\u0000${e?.output ?? ""}`;

/** Few-shot có ở bản sau mà bản trước chưa có (ví dụ đề xuất thêm vào). */
export function newExamples(proposal) {
  const before = new Set((proposal?.before?.fewShotExamples ?? []).map(exampleId));
  return (proposal?.after?.fewShotExamples ?? []).filter((e) => !before.has(exampleId(e)));
}

const SCORE_LABELS = { clarity: "Rõ ràng", structure: "Cấu trúc", relevance: "Liên quan", credibility: "Thuyết phục" };
const SHRM_LABELS = { excellent: "Xuất sắc", proficient: "Tốt", developing: "Đang phát triển" };

/**
 * Kết quả chuẩn của few-shot chấm điểm là JSON điểm moderator → câu đọc được
 * ("Tổng 1,5 · Rõ ràng 1,5 · … · Mức SHRM: Đang phát triển"). Không phải JSON điểm thì giữ nguyên.
 */
export function formatExampleOutput(example) {
  const raw = String(example?.output ?? "");
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return raw;
  }
  if (!parsed || typeof parsed !== "object" || !Number.isFinite(parsed.overall)) return raw;
  const num = (v) => v.toLocaleString("vi-VN");
  const parts = [`Tổng ${num(parsed.overall)}`];
  for (const [key, label] of Object.entries(SCORE_LABELS)) {
    if (Number.isFinite(parsed.scores?.[key])) parts.push(`${label} ${num(parsed.scores[key])}`);
  }
  if (parsed.shrm_level) parts.push(`Mức SHRM: ${SHRM_LABELS[parsed.shrm_level] ?? parsed.shrm_level}`);
  return parts.join(" · ");
}

export const isAnchorExample = (e) => String(e?.note ?? "").startsWith("rubric_anchor:");

/** Đề xuất bị hệ thống tự loại (AI-18: backtest tăng độ lệch). */
export const isAutoRejected = (proposal) =>
  proposal?.status === "rejected" && !proposal?.review?.by && String(proposal?.review?.note ?? "").startsWith("Tự loại");

export const REVIEW_ACTIONS = {
  approve: { label: "Duyệt và bật", needsNote: false, done: "Đã duyệt, prompt mới đang chạy." },
  reject: { label: "Từ chối", needsNote: true, done: "Đã từ chối đề xuất." },
  rollback: { label: "Rollback", needsNote: true, done: "Đã rollback về version trước." },
  rebase: { label: "Dựng lại trên bản đang chạy", needsNote: false, done: "Đã dựng lại đề xuất. Chạy backtest lại trước khi duyệt." },
};

/** Lỗi ghi chú trước khi gửi (backend: reject / rollback bắt buộc ≥ 3 ký tự). */
export function reviewNoteError(action, note) {
  if (!REVIEW_ACTIONS[action]?.needsNote) return "";
  return String(note ?? "").trim().length >= 3 ? "" : "Nhập lý do (ít nhất 3 ký tự).";
}

/** Câu hỏi xác nhận nêu rõ hậu quả. */
export function confirmText(action, proposal, activeVersion) {
  const after = proposal?.after?.version ?? "";
  const before = proposal?.before?.version ?? "";
  if (action === "approve") return `Bật ${after} cho ${targetLabel(proposal?.target).toLowerCase()}. Mọi buổi phỏng vấn mới sẽ chạy bản này (thay ${activeVersion || before}).`;
  if (action === "reject") return "Đề xuất bị đóng. Bằng chứng của đề xuất không được dùng lại cho đề xuất sau.";
  if (action === "rollback") return `Bật lại ${before}. Buổi phỏng vấn mới sẽ không còn chạy ${after}.`;
  if (action === "rebase") return `Tạo bản sau mới dựng trên ${activeVersion} (bản đang chạy) cộng ví dụ của đề xuất này. Kết quả backtest cũ bị xóa.`;
  return "";
}

/** Ngày giờ kiểu vi-VN. */
export const formatDateTime = (v) => (v ? new Date(v).toLocaleString("vi-VN", { hour12: false }) : "—");
