import jwt from "jsonwebtoken";

/** Giải mã Bearer token nếu có, set `req.userId` — không chặn request nếu thiếu/hỏng token. */
export async function optionalAuth(req, res, next) {
  const header = req.headers.authorization;
  const secret = process.env.JWT_SECRET;
  if (!header?.startsWith("Bearer ") || !secret) return next();

  const token = header.slice(7).trim();
  if (!token) return next();

  try {
    const payload = jwt.verify(token, secret);
    if (payload.sub) req.userId = payload.sub;
  } catch {
    // Token hết hạn/hỏng — bỏ qua, coi như khách vãng lai.
  }
  next();
}
