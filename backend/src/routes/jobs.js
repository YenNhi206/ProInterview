/**
 * /api/jobs — tin tuyển dụng công khai (JB-03), không cần đăng nhập.
 * Chỉ trả job đang mở: `published`, chưa quá `closesAt`, công ty không bị khóa.
 * Sắp có trên router này: `/:id/gap` (JB-05), `/:id/practice` (JB-06), `/:id/apply` (JB-08).
 */
import { Router } from "express";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { getPublicJob, listPublicJobs } from "../services/publicJobsService.js";

export const jobsRouter = Router();

jobsRouter.get("/", asyncHandler(async (req, res) => {
  const { jobs, pagination } = await listPublicJobs(req.query);
  res.json({ success: true, jobs, pagination });
}));

jobsRouter.get("/:id", asyncHandler(async (req, res) => {
  res.json({ success: true, job: await getPublicJob(req.params.id) });
}));
