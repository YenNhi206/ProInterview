import { User } from "../models/User.js";

/** Sau `authJwt` — chỉ user có `role: "mentor"` mới qua được. */
export async function requireMentor(req, res, next) {
  try {
    const u = await User.findById(req.userId).select("role").lean();
    if (!u || u.role !== "mentor") {
      return res.status(403).json({
        success: false,
        error: "Chỉ mentor mới được thực hiện thao tác này.",
      });
    }
    next();
  } catch (e) {
    next(e);
  }
}

