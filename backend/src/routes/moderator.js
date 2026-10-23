import { Router } from "express";
import { authJwt } from "../middleware/authJwt.js";
import { requireModerator } from "../middleware/requireRole.js";
import { adminAuditLog } from "../middleware/adminAuditLog.js";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { AdminController } from "../controllers/adminController.js";

/**
 * Moderator — lớp kiểm định chất lượng, tách khỏi vận hành của admin.
 *
 * Duyệt khóa học chuyển hẳn từ `/api/admin/courses/*` sang đây: admin KHÔNG còn
 * duyệt được nữa (xem requireRole.js — cổng này không cho admin đi vòng).
 * Handler tái dùng AdminController vì logic duyệt không đổi, chỉ đổi người có quyền.
 *
 * `adminAuditLog` ghi `type: "admin_action"` theo req.userId nên thao tác của moderator
 * vẫn hiện trong trang /admin/audit-log — không mất vết kiểm toán sau khi chuyển quyền.
 */
export const moderatorRouter = Router();

moderatorRouter.use(authJwt, requireModerator, adminAuditLog);

// Thống kê nội dung — moderator cần để xếp thứ tự hàng đợi duyệt.
// Admin vẫn giữ bản của mình ở /api/admin/content/stats (dùng ở trang Phỏng vấn AI).
moderatorRouter.get("/content/stats", asyncHandler(AdminController.getContentStats));

// ── Duyệt khóa học ────────────────────────────────────────────────────────────
moderatorRouter.get("/courses/pending", asyncHandler(AdminController.getPendingCourses));
moderatorRouter.get("/courses/published", asyncHandler(AdminController.getPublishedCourses));
moderatorRouter.patch("/courses/:id/approve", asyncHandler(AdminController.approveCourse));
moderatorRouter.patch("/courses/:id/reject", asyncHandler(AdminController.rejectCourse));
moderatorRouter.patch("/courses/:id/archive", asyncHandler(AdminController.archiveCourse));
