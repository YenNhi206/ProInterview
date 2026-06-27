import rateLimit from "express-rate-limit";

const isProd = process.env.NODE_ENV === "production";

/** Đăng ký / đăng nhập / Google — chống brute-force theo IP. */
export const authWriteLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isProd ? 40 : 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: "Quá nhiều yêu cầu. Thử lại sau ít phút." },
});

/** Làm mới access token — giới hạn nhẹ theo IP. */
export const refreshLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: "Quá nhiều yêu cầu làm mới phiên. Thử lại sau." },
});

/**
 * Google Vision face snapshot — tối đa 10 lần/phút/user.
 * 5 câu × 1 snapshot = 5 calls/session; dư cho retry không gây block.
 */
export const analyzeFaceLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  keyGenerator: (req) => req.userId ?? req.ip,
  standardHeaders: false,
  legacyHeaders: false,
  handler: (_req, res) =>
    res.status(429).json({ success: true, emotion: null, reason: "rate_limited" }),
});

/**
 * Pregen video baseline (free trial, public) — giới hạn theo IP.
 * Cache key cố định (3 câu × gender) nên sau lần đầu luôn cache-hit; limiter chỉ
 * để chặn flood request, không liên quan chi phí D-ID.
 */
export const baselineTrialLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: "Quá nhiều yêu cầu. Thử lại sau ít phút." },
});

/** CV Analysis — tối đa 5 lần phân tích/phút/user. Chống bot đốt Gemini quota. */
export const cvAnalyzeLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: isProd ? 5 : 30,
  keyGenerator: (req) => req.userId ?? req.ip,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: "Quá nhiều yêu cầu phân tích. Vui lòng thử lại sau 1 phút." },
});

/** Analytics events — tối đa 60 request/phút/user. Chống flood UserEvent collection. */
export const analyticsEventsLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: isProd ? 60 : 600,
  keyGenerator: (req) => req.userId ?? req.ip,
  standardHeaders: false,
  legacyHeaders: false,
  message: { success: false, error: "Quá nhiều sự kiện analytics. Thử lại sau." },
});
