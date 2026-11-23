/**
 * /api/jobs — tin tuyển dụng công khai (JB-03), không cần đăng nhập.
 * Chỉ trả job đang mở: `published`, chưa quá `closesAt`, công ty không bị khóa.
 * `GET /:id/gap` (JB-05) cần đăng nhập ứng viên. Sắp có: `/:id/apply` (JB-08).
 */
import { Router } from "express";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { authJwt } from "../middleware/authJwt.js";
import { requireRole } from "../middleware/requireRole.js";
import { getPublicJob, listPublicJobs } from "../services/publicJobsService.js";
import { getJobGap } from "../services/jobGapService.js";

export const jobsRouter = Router();

jobsRouter.get("/", asyncHandler(async (req, res) => {
  const { jobs, pagination } = await listPublicJobs(req.query);
  res.json({ success: true, jobs, pagination });
}));

jobsRouter.get("/:id", asyncHandler(async (req, res) => {
  res.json({ success: true, job: await getPublicJob(req.params.id) });
}));

/** JB-05: khoảng thiếu năng lực và kỹ năng của ứng viên đang đăng nhập so với job. */
jobsRouter.get("/:id/gap", authJwt, requireRole("customer"), asyncHandler(async (req, res) => {
  res.json({ success: true, gap: await getJobGap(req.params.id, req.userId) });
}));
