import * as mentorDashboardService from "../services/mentorDashboardService.js";

export class MentorController {
  static async dashboard(req, res, next) {
    try {
      const result = await mentorDashboardService.getMentorDashboard(req.userId);
      if (!result.ok) return res.status(result.status).json({ success: false, error: result.error });
      res.json({ success: true, dashboard: result.dashboard });
    } catch (e) {
      next(e);
    }
  }

  static async finance(req, res, next) {
    try {
      const result = await mentorDashboardService.getMentorFinance(req.userId);
      if (!result.ok) return res.status(result.status).json({ success: false, error: result.error });
      res.json({ success: true, finance: result.finance });
    } catch (e) {
      next(e);
    }
  }

  static async analytics(req, res, next) {
    try {
      const result = await mentorDashboardService.getMentorAnalytics(req.userId);
      if (!result.ok) return res.status(result.status).json({ success: false, error: result.error });
      res.json({ success: true, analytics: result.analytics });
    } catch (e) {
      next(e);
    }
  }

  static async payout(req, res, next) {
    try {
      const result = await mentorDashboardService.requestPayout(req.userId, req.body ?? {});
      if (!result.ok) return res.status(result.status).json({ success: false, error: result.error });
      res.status(201).json({ success: true, payout: result.payout });
    } catch (e) {
      next(e);
    }
  }
}

