import { Router } from "express";
import { authJwt } from "../middleware/authJwt.js";
import { requireModerator } from "../middleware/requireRole.js";
import { moderatorAuditLog } from "../middleware/adminAuditLog.js";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { AdminController } from "../controllers/adminController.js";
import { ModeratorController } from "../controllers/moderatorController.js";
import { ModeratorRubricController } from "../controllers/moderatorRubricController.js";

/**
 * Moderator — lớp kiểm định chất lượng, tách khỏi vận hành của admin.
 *
 * Duyệt khóa học chuyển hẳn từ `/api/admin/courses/*` sang đây: admin KHÔNG còn
 * duyệt được nữa (xem requireRole.js — cổng này không cho admin đi vòng).
 * Handler tái dùng AdminController vì logic duyệt không đổi, chỉ đổi người có quyền.
 *
 * `moderatorAuditLog` ghi `type: "moderator_action"` theo req.userId nên thao tác của moderator
 * vẫn hiện trong trang /admin/audit-log (lọc `?actor=moderator`), tách riêng khỏi thao tác admin.
 */
export const moderatorRouter = Router();

moderatorRouter.use(authJwt, requireModerator, moderatorAuditLog);

// Thống kê nội dung — moderator cần để xếp thứ tự hàng đợi duyệt.
// Admin vẫn giữ bản của mình ở /api/admin/content/stats (dùng ở trang Phỏng vấn AI).
moderatorRouter.get("/content/stats", asyncHandler(AdminController.getContentStats));

// ── Duyệt khóa học ────────────────────────────────────────────────────────────
moderatorRouter.get("/courses/pending", asyncHandler(AdminController.getPendingCourses));
moderatorRouter.get("/courses/published", asyncHandler(AdminController.getPublishedCourses));
moderatorRouter.patch("/courses/:id/approve", asyncHandler(AdminController.approveCourse));
moderatorRouter.patch("/courses/:id/reject", asyncHandler(AdminController.rejectCourse));
moderatorRouter.patch("/courses/:id/archive", asyncHandler(AdminController.archiveCourse));

// ── Ngân hàng câu hỏi (HITL — spec S1 §3) ────────────────────────────────────
// "/questions/bulk" phải đứng trước "/questions/:id" để không bị bắt nhầm làm :id.
moderatorRouter.get("/questions", asyncHandler(ModeratorController.listQuestions));
moderatorRouter.post("/questions/bulk", asyncHandler(ModeratorController.bulkQuestions));
moderatorRouter.post("/questions", asyncHandler(ModeratorController.createQuestion));
moderatorRouter.get("/questions/:id", asyncHandler(ModeratorController.getQuestion));
moderatorRouter.patch("/questions/:id", asyncHandler(ModeratorController.editQuestion));
moderatorRouter.patch("/questions/:id/approve", asyncHandler(ModeratorController.approveQuestion));
moderatorRouter.patch("/questions/:id/deprecate", asyncHandler(ModeratorController.deprecateQuestion));

// ── Hàng đợi kiểm định ───────────────────────────────────────────────────────
moderatorRouter.get("/queue", asyncHandler(ModeratorController.listQueue));
moderatorRouter.get("/queue/:id", asyncHandler(ModeratorController.getQueueItem));
moderatorRouter.patch("/queue/:id/claim", asyncHandler(ModeratorController.claimQueueItem));
moderatorRouter.patch("/queue/:id/resolve", asyncHandler(ModeratorController.resolveQueueItem));

// ── JB-04: tin tuyển dụng bị báo cáo, ẩn / bỏ ẩn ────────────────────────────
// Báo cáo tin nằm trong hàng đợi với `type=job_post_report` (GET /queue?type=job_post_report), xử lý bằng
// PATCH /queue/:id/resolve { action: "hide_job" | "dismiss", note }.
moderatorRouter.get("/jobs", asyncHandler(ModeratorController.listJobs));
moderatorRouter.patch("/jobs/:id/visibility", asyncHandler(ModeratorController.setJobVisibility));

// ── Quality dashboard ────────────────────────────────────────────────────────
moderatorRouter.get("/quality/stats", asyncHandler(ModeratorController.qualityStats));

// ── CO-08: Phê duyệt Rubric doanh nghiệp ─────────────────────────────────────
moderatorRouter.get("/rubrics", asyncHandler(ModeratorRubricController.list));
moderatorRouter.get("/rubrics/:id", asyncHandler(ModeratorRubricController.getById));
moderatorRouter.post("/rubrics/:id/approve", asyncHandler(ModeratorRubricController.approve));
moderatorRouter.post("/rubrics/:id/reject", asyncHandler(ModeratorRubricController.reject));
