import { Router } from "express";
import { authJwt } from "../middleware/authJwt.js";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { CandidateProfileController } from "../controllers/candidateProfileController.js";
import { requireRole } from "../middleware/requireRole.js";
import { candidateCompanyMetrics, listCandidateCompanyMetrics } from "../services/companyMetricsService.js";

export const profileRouter = Router();

// Mọi route profile yêu cầu đăng nhập
profileRouter.use(authJwt);

// PR-01: Lấy và cập nhật hồ sơ ứng viên
profileRouter.get("/me", asyncHandler(CandidateProfileController.getProfile));
profileRouter.patch("/me", asyncHandler(CandidateProfileController.updateProfile));

// PR-07: Lấy danh sách năng lực và DTO rút gọn cho Application snapshot
profileRouter.get("/me/competencies", asyncHandler(CandidateProfileController.getCompetencies));

// JB-19: chỉ số của ứng viên với từng doanh nghiệp (câu doanh nghiệp đã trả lời + điểm rubric JB-07).
// Chỉ ứng viên xem dữ liệu của chính mình; doanh nghiệp chỉ thấy qua đơn ứng tuyển có đồng ý (JB-08).
profileRouter.get("/me/company-metrics", requireRole("customer"), asyncHandler(async (req, res) => {
  res.json({ success: true, companies: await listCandidateCompanyMetrics(req.userId) });
}));
profileRouter.get("/me/company-metrics/:companyId", requireRole("customer"), asyncHandler(async (req, res) => {
  res.json({ success: true, metrics: await candidateCompanyMetrics(req.userId, req.params.companyId) });
}));
