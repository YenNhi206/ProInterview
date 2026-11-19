import { Router } from "express";
import { authJwt } from "../middleware/authJwt.js";
import { requireCompanyModerator } from "../middleware/requireCompanyModerator.js";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { CompanyWorkspaceController } from "../controllers/companyWorkspaceController.js";

export const companyRouter = Router();

// Mọi route ở đây bắt buộc qua authJwt và requireCompanyModerator (CO-03)
companyRouter.use(authJwt, requireCompanyModerator);

// Thông tin công ty & Dashboard tóm tắt
companyRouter.get("/profile", asyncHandler(CompanyWorkspaceController.getProfile));
companyRouter.get("/dashboard", asyncHandler(CompanyWorkspaceController.getDashboardStats));

// CO-05: Quản lý ngân hàng câu hỏi công ty
companyRouter.get("/questions", asyncHandler(CompanyWorkspaceController.listQuestions));
companyRouter.post("/questions", asyncHandler(CompanyWorkspaceController.createQuestion));
companyRouter.post("/questions/generate-starter", asyncHandler(CompanyWorkspaceController.generateStarterQuestions));
companyRouter.post("/questions/batch-approve", asyncHandler(CompanyWorkspaceController.batchApproveQuestions));
companyRouter.post("/questions/batch-reject", asyncHandler(CompanyWorkspaceController.batchRejectQuestions));
companyRouter.patch("/questions/:id", asyncHandler(CompanyWorkspaceController.editQuestion));
companyRouter.post("/questions/:id/approve", asyncHandler(CompanyWorkspaceController.approveQuestion));
companyRouter.post("/questions/:id/reject", asyncHandler(CompanyWorkspaceController.rejectQuestion));

// CO-07: Quản lý Rubric đánh giá
companyRouter.get("/rubrics", asyncHandler(CompanyWorkspaceController.listRubrics));
companyRouter.post("/rubrics", asyncHandler(CompanyWorkspaceController.createRubric));
companyRouter.get("/rubrics/:id", asyncHandler(CompanyWorkspaceController.getRubricById));
companyRouter.patch("/rubrics/:id", asyncHandler(CompanyWorkspaceController.updateRubric));
companyRouter.post("/rubrics/:id/submit", asyncHandler(CompanyWorkspaceController.submitRubric));
