import { Router } from "express";
import { authJwt } from "../middleware/authJwt.js";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { CandidateProfileController } from "../controllers/candidateProfileController.js";

export const profileRouter = Router();

// Mọi route profile yêu cầu đăng nhập
profileRouter.use(authJwt);

// PR-01: Lấy và cập nhật hồ sơ ứng viên
profileRouter.get("/me", asyncHandler(CandidateProfileController.getProfile));
profileRouter.patch("/me", asyncHandler(CandidateProfileController.updateProfile));

// PR-07: Lấy danh sách năng lực và DTO rút gọn cho Application snapshot
profileRouter.get("/me/competencies", asyncHandler(CandidateProfileController.getCompetencies));
