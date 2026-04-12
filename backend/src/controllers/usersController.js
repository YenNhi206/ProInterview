import * as dashboardStatsService from "../services/dashboardStatsService.js";

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
}
