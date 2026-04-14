import rateLimit from "express-rate-limit";

/** Đăng ký / đăng nhập / Google — chống brute-force theo IP. */
export const authWriteLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 40,
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
