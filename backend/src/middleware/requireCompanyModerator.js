import { User } from "../models/User.js";
import { Company } from "../models/Company.js";

/**
 * Middleware CO-03: Kiểm tra quyền Company Moderator và gán companyId vào request.
 *
 * Kiểm tra:
 *   1. User có role 'company_moderator'
 *   2. User đã được gán companyId
 *   3. Công ty đang hoạt động (không bị suspended theo CO-01)
 *
 * Gán vào req:
 *   req.companyId: ObjectId của công ty
 *   req.company: document công ty
 *   req.userRole: 'company_moderator'
 */
export async function requireCompanyModerator(req, res, next) {
  try {
    if (!req.userId) {
      return res.status(401).json({ success: false, error: "Yêu cầu đăng nhập." });
    }

    const u = await User.findById(req.userId).select("role companyId").lean();
    if (!u || u.role !== "company_moderator") {
      return res.status(403).json({
        success: false,
        error: "Chỉ tài khoản kiểm duyệt viên công ty mới được thực hiện thao tác này.",
      });
    }

    if (!u.companyId) {
      return res.status(403).json({
        success: false,
        error: "Tài khoản chưa được liên kết với công ty nào.",
      });
    }

    const company = await Company.findById(u.companyId);
    if (!company) {
      return res.status(403).json({
        success: false,
        error: "Không tìm thấy thông tin công ty.",
      });
    }

    if (company.status === "suspended") {
      return res.status(403).json({
        success: false,
        error: "Công ty của bạn đang bị tạm khóa. Vui lòng liên hệ quản trị viên.",
      });
    }

    req.companyId = u.companyId;
    req.userCompanyId = u.companyId;
    req.company = company;
    req.userRole = u.role;
    next();
  } catch (err) {
    next(err);
  }
}
