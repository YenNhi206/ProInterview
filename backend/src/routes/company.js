import { Router } from "express";
import { authJwt } from "../middleware/authJwt.js";
import { requireCompanyModerator } from "../middleware/requireCompanyModerator.js";
import { companyModeratorAuditLog } from "../middleware/adminAuditLog.js";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { companyQuestionGenLimiter } from "../middleware/rateLimiters.js";
import { CompanyWorkspaceController } from "../controllers/companyWorkspaceController.js";
import { CompanyJobsController } from "../controllers/companyJobsController.js";

export const companyRouter = Router();

// Mọi route ở đây bắt buộc qua authJwt và requireCompanyModerator (CO-03).
// Thao tác ghi (POST/PATCH/...) được ghi vào nhật ký `company_moderator_action`, xem ở /admin/audit-log.
companyRouter.use(authJwt, requireCompanyModerator, companyModeratorAuditLog);

// Thông tin công ty & Dashboard tóm tắt
companyRouter.get("/profile", asyncHandler(CompanyWorkspaceController.getProfile));
companyRouter.get("/dashboard", asyncHandler(CompanyWorkspaceController.getDashboardStats));

// CO-05: Quản lý ngân hàng câu hỏi công ty
companyRouter.get("/questions", asyncHandler(CompanyWorkspaceController.listQuestions));
companyRouter.post("/questions", asyncHandler(CompanyWorkspaceController.createQuestion));
companyRouter.post("/questions/generate", companyQuestionGenLimiter, asyncHandler(CompanyWorkspaceController.generateQuestions));
companyRouter.post("/questions/upload", asyncHandler(CompanyWorkspaceController.uploadQuestions));
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

// JB-01: Tin tuyển dụng (tạo / sửa bản nháp, đăng, đóng). Không cần duyệt trước khi đăng (quyết định 8).
companyRouter.get("/jobs", asyncHandler(CompanyJobsController.list));
companyRouter.post("/jobs", asyncHandler(CompanyJobsController.create));
companyRouter.get("/jobs/:id", asyncHandler(CompanyJobsController.get));
companyRouter.patch("/jobs/:id", asyncHandler(CompanyJobsController.update));
companyRouter.patch("/jobs/:id/status", asyncHandler(CompanyJobsController.changeStatus));
