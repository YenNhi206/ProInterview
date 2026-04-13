import mongoose from "mongoose";
import * as dashboardStatsService from "../services/dashboardStatsService.js";
import * as userRoleService from "../services/userRoleService.js";

export class UsersController {
  static async dashboardStats(req, res, next) {
    try {
      const result = await dashboardStatsService.getDashboardStats(req.userId);
      if (!result.ok) {
        return res.status(result.status).json({ success: false, error: result.error });
      }
      res.json({ success: true, stats: result.stats });
    } catch (err) {
      next(err);
    }
  }

  /** [ADMIN] Đặt role customer | mentor cho user (bỏ qua mã mời mentor). */
  static async patchUserRole(req, res, next) {
    try {
      const id = req.params.id;
      if (!mongoose.isValidObjectId(id)) {
        return res.status(400).json({ success: false, error: "id không hợp lệ." });
      }
      const result = await userRoleService.setRoleByAdmin(req.userId, id, req.body?.role);
      if (!result.ok) {
        return res.status(result.status).json({ success: false, error: result.error });
      }
      res.json({ success: true, user: result.user });
    } catch (err) {
      next(err);
    }
  }
}
