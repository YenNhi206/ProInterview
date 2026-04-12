import * as plansService from "../services/plansService.js";

export class PlansController {
  static async current(req, res, next) {
    try {
      const result = await plansService.getCurrentPlan(req.userId);
      if (!result.ok) {
        return res.status(result.status).json({ success: false, error: result.error });
      }
      res.json({ success: true, plan: result.plan, planExpiresAt: result.planExpiresAt, quota: result.quota });
    } catch (err) {
      next(err);
    }
  }

  static async activate(req, res, next) {
    try {
      const result = await plansService.activatePlan(req.userId, req.body ?? {});
      if (!result.ok) {
        return res.status(result.status).json({ success: false, error: result.error });
      }
      res.json({
        success: true,
        plan: result.plan,
        planExpiresAt: result.planExpiresAt,
        quota: result.quota,
      });
    } catch (err) {
      next(err);
    }
  }

  static async cancel(req, res, next) {
    try {
      const result = await plansService.cancelPlan(req.userId);
      if (!result.ok) {
        return res.status(result.status).json({ success: false, error: result.error });
      }
      res.json({
        success: true,
        plan: result.plan,
        planExpiresAt: result.planExpiresAt,
        quota: result.quota,
      });
    } catch (err) {
      next(err);
    }
  }
}
