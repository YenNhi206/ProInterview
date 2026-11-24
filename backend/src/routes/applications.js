/**
 * /api/applications — đơn ứng tuyển của ứng viên (JB-08). Nộp đơn ở `POST /api/jobs/:id/apply`.
 * Company Moderator xem / xử lý đơn qua `/api/company/applications` (JB-09).
 */
import { Router } from "express";
import { authJwt } from "../middleware/authJwt.js";
import { requireRole } from "../middleware/requireRole.js";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { listMyApplications, withdrawApplication } from "../services/applicationsService.js";

export const applicationsRouter = Router();

applicationsRouter.use(authJwt, requireRole("customer"));

applicationsRouter.get("/me", asyncHandler(async (req, res) => {
  res.json({ success: true, applications: await listMyApplications(req.userId) });
}));

applicationsRouter.patch("/:id/withdraw", asyncHandler(async (req, res) => {
  res.json({ success: true, application: await withdrawApplication(req.userId, req.params.id) });
}));
