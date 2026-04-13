import * as reportsService from "../services/reportsService.js";

export class ReportsController {
  static async create(req, res, next) {
    try {
      const result = await reportsService.createReport(req.userId, req.body ?? {});
      if (!result.ok) return res.status(result.status).json({ success: false, error: result.error });
      res.status(201).json({ success: true, reportId: result.reportId });
    } catch (e) {
      next(e);
    }
  }
}

