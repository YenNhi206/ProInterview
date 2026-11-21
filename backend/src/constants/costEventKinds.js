/**
 * Loại chi phí AI ghi vào `CostEvent.kind` (AI-12).
 * Nguồn duy nhất: schema `CostEvent` dùng làm enum, `langfuseService` và các luồng mới
 * (JB-07 chấm rubric, AI-08 sàng lọc khóa học) import hằng số từ đây.
 */

export const COST_EVENT_KIND = Object.freeze({
  LLM_CALL:         "llm_call",
  TTS_ELEVENLABS:   "tts_elevenlabs",
  AVATAR_VIDEO_DID: "avatar_video_did",
  RUBRIC_SCORING:   "rubric_scoring",   // JB-07: chấm câu trả lời theo rubric công ty
  COURSE_PRESCREEN: "course_prescreen", // AI-08: AI sàng lọc khóa học trước khi moderator duyệt
});

export const COST_EVENT_KINDS = Object.freeze(Object.values(COST_EVENT_KIND));

export function isValidCostEventKind(kind) {
  return COST_EVENT_KINDS.includes(kind);
}

/**
 * Ngưỡng cảnh báo Slack theo ngày (UTC) cho từng kind. Vượt một trong hai ngưỡng thì gửi alert,
 * tối đa 1 lần / kind / ngày. Ghi đè bằng biến môi trường, ví dụ
 * `COST_ALERT_RUBRIC_SCORING_DAILY_USD=5`, `COST_ALERT_COURSE_PRESCREEN_DAILY_COUNT=100`.
 *
 * Mặc định tính cho model rẻ (gpt-4o-mini): một lần chấm rubric cả buổi khoảng $0,002–0,005,
 * một lần sàng lọc khóa khoảng $0,001–0,003. Ngưỡng count bắt lỗi vòng lặp gọi lại khi
 * costUsd ước lượng bằng 0 (model không có trong bảng giá).
 */
const DEFAULT_DAILY_THRESHOLDS = Object.freeze({
  [COST_EVENT_KIND.RUBRIC_SCORING]:   { maxDailyUsd: 2, maxDailyCount: 300 },
  [COST_EVENT_KIND.COURSE_PRESCREEN]: { maxDailyUsd: 1, maxDailyCount: 50 },
});

function envNumber(name, fallback) {
  const raw = process.env[name];
  if (raw === undefined || String(raw).trim() === "") return fallback;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

/** @returns {{ maxDailyUsd: number, maxDailyCount: number } | null} */
export function getCostKindDailyThreshold(kind) {
  const defaults = DEFAULT_DAILY_THRESHOLDS[kind];
  if (!defaults) return null;
  const prefix = `COST_ALERT_${kind.toUpperCase()}_DAILY`;
  return {
    maxDailyUsd:   envNumber(`${prefix}_USD`, defaults.maxDailyUsd),
    maxDailyCount: envNumber(`${prefix}_COUNT`, defaults.maxDailyCount),
  };
}

export const COST_KINDS_WITH_DAILY_THRESHOLD = Object.freeze(Object.keys(DEFAULT_DAILY_THRESHOLDS));
