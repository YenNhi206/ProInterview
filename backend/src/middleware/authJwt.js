import jwt from "jsonwebtoken";

export function authJwt(req, res, next) {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    return res.status(500).json({ success: false, error: "Server thiếu cấu hình JWT_SECRET" });
  }

  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    return res.status(401).json({ success: false, error: "Chưa đăng nhập" });
  }

  const token = header.slice(7).trim();
  if (!token) {
    return res.status(401).json({ success: false, error: "Chưa đăng nhập" });
  }

  try {
    const payload = jwt.verify(token, secret);
    if (!payload.sub) {
      return res.status(401).json({ success: false, error: "Token không hợp lệ" });
    }
    req.userId = payload.sub;
    next();
  } catch {
    return res.status(401).json({ success: false, error: "Phiên đăng nhập hết hạn. Vui lòng đăng nhập lại." });
  }
}
