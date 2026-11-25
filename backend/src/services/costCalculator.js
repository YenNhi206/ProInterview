/**
 * costCalculator.js
 * Bảng giá ước tính cho các AI provider — dùng để gắn cost vào Langfuse traces
 * (Phase 0 — đo lường chi phí nền theo plan tối ưu hóa).
 *
 * Giá là ƯỚC TÍNH dựa trên public pricing tại thời điểm viết code (USD).
 * Có thể lệch theo thời gian/plan thực tế — chỉnh qua env var khi cần chính xác hơn.
 * Mục tiêu: so sánh chi phí TƯƠNG ĐỐI giữa model/cache hit-miss, không phải billing chính xác.
 */

const USD_TO_VND = Number(process.env.USD_TO_VND_RATE) || 25400;

// USD / 1M tokens
const LLM_PRICING = {
  // Anthropic Claude — cacheWrite5m = ghi cache TTL 5 phút (mặc định), cacheRead = đọc cache
  "claude-opus":   { input: 15,   output: 75, cacheWrite5m: 18.75, cacheRead: 1.50 },
  "claude-sonnet": { input: 3,    output: 15, cacheWrite5m: 3.75,  cacheRead: 0.30 },
  "claude-haiku":  { input: 1,    output: 5,  cacheWrite5m: 1.25,  cacheRead: 0.10 },
  // OpenAI-compatible
  "gpt-4o-mini":   { input: 0.15, output: 0.60 },
  "gpt-4o":        { input: 2.5,  output: 10 },
  "gemini-2.5-flash": { input: 0.075, output: 0.30 },
  "gemini-2.0-flash": { input: 0,     output: 0 },     // free tier
  "llama-3.3-70b": { input: 0,    output: 0 },         // Groq free tier
};

const DEFAULT_PRICING = { input: 0.5, output: 1.5 }; // fallback cho model không xác định

function findPricing(model) {
  if (!model) return DEFAULT_PRICING;
  const m = model.toLowerCase();
  const key = Object.keys(LLM_PRICING).find((k) => m.includes(k));
  return key ? LLM_PRICING[key] : DEFAULT_PRICING;
}

export function usdToVnd(usd) {
  return usd * USD_TO_VND;
}

/**
 * Tính chi phí 1 lần gọi LLM, có tách riêng chi phí cache write/read (Anthropic prompt caching).
 * @param {object} opts
 * @param {string} opts.model
 * @param {number} [opts.inputTokens=0]      - input tokens KHÔNG tính phần cache (uncached)
 * @param {number} [opts.outputTokens=0]
 * @param {number} [opts.cacheWriteTokens=0] - tokens ghi vào cache (đắt hơn input thường)
 * @param {number} [opts.cacheReadTokens=0]  - tokens đọc từ cache (rẻ hơn input thường nhiều)
 * @returns {{usd: number, vnd: number, breakdown: {inputCost: number, outputCost: number, cacheWriteCost: number, cacheReadCost: number}}}
 */
export function calcLLMCost({ model, inputTokens = 0, outputTokens = 0, cacheWriteTokens = 0, cacheReadTokens = 0 }) {
  const p = findPricing(model);

  const inputCost      = (inputTokens      / 1_000_000) * (p.input ?? 0);
  const outputCost     = (outputTokens     / 1_000_000) * (p.output ?? 0);
  const cacheWriteCost = (cacheWriteTokens / 1_000_000) * (p.cacheWrite5m ?? p.input ?? 0);
  const cacheReadCost  = (cacheReadTokens  / 1_000_000) * (p.cacheRead ?? p.input ?? 0);

  const usd = inputCost + outputCost + cacheWriteCost + cacheReadCost;
  return {
    usd,
    vnd: usdToVnd(usd),
    breakdown: { inputCost, outputCost, cacheWriteCost, cacheReadCost },
  };
}

// ElevenLabs TTS — Creator plan ≈ $22/100,000 ký tự ≈ $0.22/1K ký tự
const ELEVENLABS_COST_PER_1K_CHARS = Number(process.env.ELEVENLABS_COST_PER_1K_CHARS_USD) || 0.22;

/**
 * @param {number} characters - số ký tự gửi cho ElevenLabs TTS
 * @returns {{usd: number, vnd: number}}
 */
export function calcTTSCost(characters = 0) {
  const usd = (characters / 1000) * ELEVENLABS_COST_PER_1K_CHARS;
  return { usd, vnd: usdToVnd(usd) };
}

// D-ID Express — Build plan $98/tháng / 300 credits (1 credit ≈ 1 phút video).
// Video câu hỏi trung bình ~15-20s ≈ 0.25-0.33 phút → ~$0.08-0.11/video.
const DID_COST_PER_VIDEO = Number(process.env.DID_COST_PER_VIDEO_USD) || 0.08;

// ElevenLabs video (AI-16): tính theo credit. Tài liệu API không công bố số credit mỗi giây của
// từng model, nên lấy từ lần chạy thử AI-14 (`scripts/trialElevenLabsVideo.js` đọc credit trước/sau).
//   ELEVENLABS_VIDEO_CREDITS_PER_SECOND — credit mỗi giây video của model đang dùng (bắt buộc để tính phí)
//   ELEVENLABS_USD_PER_CREDIT           — mặc định gói Pro: $99 / 500.000 credit
const DEFAULT_ELEVENLABS_USD_PER_CREDIT = 99 / 500_000;

function envPositive(name) {
  const raw = process.env[name];
  if (raw === undefined || String(raw).trim() === "") return null;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/**
 * @param {number|null} seconds - độ dài video (≈ độ dài audio TTS)
 * @returns {{usd: number, vnd: number, seconds: number|null, credits: number|null, priceUnconfigured?: boolean}}
 */
export function calcElevenLabsVideoCost(seconds) {
  const creditsPerSecond = envPositive("ELEVENLABS_VIDEO_CREDITS_PER_SECOND");
  const usdPerCredit = envPositive("ELEVENLABS_USD_PER_CREDIT") ?? DEFAULT_ELEVENLABS_USD_PER_CREDIT;
  const secs = Number.isFinite(seconds) && seconds > 0 ? seconds : null;
  if (creditsPerSecond == null || secs == null) {
    // Không đoán giá: ghi 0 và đánh dấu để dashboard/QA biết số này chưa đúng.
    return { usd: 0, vnd: 0, seconds: secs, credits: null, priceUnconfigured: true };
  }
  const credits = Math.ceil(secs * creditsPerSecond);
  const usd = credits * usdPerCredit;
  return { usd, vnd: usdToVnd(usd), seconds: secs, credits };
}

/**
 * @param {boolean} fromCache - true nếu video lấy từ cache (chi phí = 0)
 * @param {object} [opts]
 * @param {"did"|"elevenlabs"} [opts.provider="did"]
 * @param {number|null} [opts.seconds] - độ dài video, provider elevenlabs tính theo giây
 * @returns {{usd: number, vnd: number, seconds?: number|null, credits?: number|null, priceUnconfigured?: boolean}}
 */
export function calcAvatarVideoCost(fromCache = false, { provider = "did", seconds = null } = {}) {
  if (fromCache) return { usd: 0, vnd: 0 };
  if (provider === "elevenlabs") return calcElevenLabsVideoCost(seconds);
  return { usd: DID_COST_PER_VIDEO, vnd: usdToVnd(DID_COST_PER_VIDEO) };
}
