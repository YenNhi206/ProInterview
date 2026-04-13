import { User } from "../models/User.js";

/** Sau `authJwt` — chỉ user có `role: "admin"` mới qua được. */
export async function requireAdmin(req, res, next) {
  try {
    const u = await User.findById(req.userId).select("role").lean();
    if (!u || u.role !== "admin") {
      return res.status(403).json({
        success: false,
        error: "Chỉ quản trị viên mới được thực hiện thao tác này.",
      });
    }
    next();
  } catch (e) {
    next(e);
  }
}
