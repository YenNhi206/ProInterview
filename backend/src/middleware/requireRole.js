import { User } from "../models/User.js";

/**
 * Thông báo 403 theo role — giữ nguyên văn bản cũ của requireAdmin để không đổi
 * contract lỗi mà FE đang hiển thị.
 */
const DENIED_MESSAGE = {
  admin: "Chỉ quản trị viên mới được thực hiện thao tác này.",
  moderator: "Chỉ kiểm duyệt viên mới được thực hiện thao tác này.",
  enterprise: "Chỉ tài khoản tổ chức mới được thực hiện thao tác này.",
};

function deniedMessage(roles) {
  if (roles.length === 1) {
    return DENIED_MESSAGE[roles[0]] ?? "Bạn không có quyền thực hiện thao tác này.";
  }
  return "Bạn không có quyền thực hiện thao tác này.";
}

/**
 * Dùng SAU `authJwt`. Chặn nếu `req.user.role` không nằm trong danh sách cho phép.
 *
 * Cố ý KHÔNG cho admin tự động vượt mọi cổng: quyền kiểm duyệt (ngân hàng câu hỏi,
 * duyệt khóa học) thuộc về moderator để tách bạch vận hành khỏi kiểm định chất lượng
 * — admin muốn duyệt thì phải được cấp role moderator.
 *
 * Gắn `req.userRole` để handler phía sau khỏi query lại User.
 */
export function requireRole(...roles) {
  const allowed = roles.flat().filter(Boolean);
  return async function roleGate(req, res, next) {
    try {
      const u = await User.findById(req.userId).select("role").lean();
      if (!u || !allowed.includes(u.role)) {
        return res.status(403).json({ success: false, error: deniedMessage(allowed) });
      }
      req.userRole = u.role;
      next();
    } catch (e) {
      next(e);
    }
  };
}

/** Kiểm duyệt viên — chất lượng AI + duyệt khóa học. */
export const requireModerator = requireRole("moderator");

/** Tài khoản tổ chức — cohort, credit, talent pool. */
export const requireEnterprise = requireRole("enterprise");
