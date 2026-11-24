/**
 * /api/jobs — tin tuyển dụng công khai (JB-03), không cần đăng nhập.
 * Chỉ trả job đang mở: `published`, chưa quá `closesAt`, công ty không bị khóa.
 * `GET /:id/gap` (JB-05) cần đăng nhập ứng viên. Sắp có: `/:id/apply` (JB-08).
 * `GET /recent` (JB-20): job ứng viên xem gần đây; `GET /:id` ghi lượt xem khi có token ứng viên.
 */
import { Router } from "express";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { authJwt } from "../middleware/authJwt.js";
import { requireRole } from "../middleware/requireRole.js";
import { getPublicJob, listPublicJobs } from "../services/publicJobsService.js";
import { getJobGap } from "../services/jobGapService.js";
import { optionalAuth } from "../middleware/optionalAuth.js";
import { listRecentJobs, recordJobView } from "../services/recentJobsService.js";
import { logger } from "../config/logger.js";

export const jobsRouter = Router();

jobsRouter.get("/", asyncHandler(async (req, res) => {
  const { jobs, pagination } = await listPublicJobs(req.query);
  res.json({ success: true, jobs, pagination });
}));

/** JB-20: job xem gần đây, chỉ job đang mở có câu doanh nghiệp hợp lệ. Đặt trước "/:id". */
jobsRouter.get("/recent", authJwt, requireRole("customer"), asyncHandler(async (req, res) => {
  res.json({ success: true, jobs: await listRecentJobs(req.userId) });
}));

jobsRouter.get("/:id", optionalAuth, asyncHandler(async (req, res) => {
  const job = await getPublicJob(req.params.id);
  if (req.userId) {
    // JB-20: ghi lượt xem của ứng viên; lỗi ghi không làm hỏng trang job.
    await recordJobView(req.userId, req.params.id).catch((err) =>
      logger.warn("recent_job_view_failed", { userId: String(req.userId), jobId: req.params.id, error: err.message }),
    );
  }
  res.json({ success: true, job });
}));

/** JB-05: khoảng thiếu năng lực và kỹ năng của ứng viên đang đăng nhập so với job. */
jobsRouter.get("/:id/gap", authJwt, requireRole("customer"), asyncHandler(async (req, res) => {
  res.json({ success: true, gap: await getJobGap(req.params.id, req.userId) });
}));
