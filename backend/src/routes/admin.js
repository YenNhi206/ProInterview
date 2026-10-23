import { adminAuditLog } from "../middleware/adminAuditLog.js";
import { AdminAuditController } from "../controllers/adminAuditController.js";
import { AdminAccountController } from "../controllers/adminAccountController.js";
import { Router } from "express";
import { confirmCartOrderPayment } from "../services/cartService.js";
import { authJwt } from "../middleware/authJwt.js";
import { requireAdmin } from "../middleware/requireAdmin.js";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { AdminController } from "../controllers/adminController.js";
import { AdminCostDashboardController } from "../controllers/adminCostDashboardController.js";
import { upload } from "../middleware/upload.js";

export const adminRouter = Router();

adminRouter.use(authJwt, requireAdmin, adminAuditLog);
adminRouter.get("/audit-log", asyncHandler(AdminAuditController.getAuditLog));
adminRouter.get("/users/:id/impact", asyncHandler(AdminAccountController.impact));
adminRouter.post("/users/:id/close", asyncHandler(AdminAccountController.close));
adminRouter.post("/mentors/:id/payouts", asyncHandler(AdminAccountController.payout));
adminRouter.get("/finance/reconciliation", asyncHandler(AdminAccountController.reconciliation));
adminRouter.post("/finance/release-earnings", asyncHandler(AdminAccountController.release));
adminRouter.get("/payments/held", asyncHandler(AdminAccountController.held));
adminRouter.patch("/payments/:id/refund-held", asyncHandler(AdminAccountController.refundHeld));
adminRouter.post("/cart-orders/:id/confirm-transfer", asyncHandler(async (req, res) => {
  const result = await confirmCartOrderPayment(req.params.id, {
    force: Boolean(req.body?.force), forceNote: req.body?.forceNote,
    amount: req.body?.amount, adminUserId: req.userId,
  });
  res.json({ success: true, order: result.order });
}));

adminRouter.get("/stats", asyncHandler(AdminController.getStats));
adminRouter.get("/cost-dashboard", asyncHandler(AdminCostDashboardController.getCostDashboard));
adminRouter.get("/cost-dashboard/cache-metrics", asyncHandler(AdminCostDashboardController.getCacheMetrics));
adminRouter.get("/reports", asyncHandler(AdminController.getReports));
adminRouter.patch("/reports/:id", asyncHandler(AdminController.updateReport));
adminRouter.get("/reviews", asyncHandler(AdminController.getReviews));
adminRouter.patch("/reviews/:id/visibility", asyncHandler(AdminController.setReviewVisibility));
adminRouter.get("/mentors", asyncHandler(AdminController.getAllMentors));
adminRouter.get("/mentors/:id", asyncHandler(AdminController.getMentorById));
adminRouter.patch("/mentors/:id/status", asyncHandler(AdminController.toggleMentorStatus));
adminRouter.patch("/mentors/:id/reject", asyncHandler(AdminController.rejectMentorApplication));
adminRouter.patch("/mentors/:id/commission", asyncHandler(AdminController.updateMentorCommission));
adminRouter.post("/mentors/:id/approve-price", asyncHandler(AdminController.approveMentorPrice));
adminRouter.post("/mentors/:id/reject-price", asyncHandler(AdminController.rejectMentorPrice));


adminRouter.get("/users", asyncHandler(AdminController.getAllUsers));
adminRouter.get("/users/:id", asyncHandler(AdminController.getUserById));
adminRouter.patch("/users/:id/status", asyncHandler(AdminController.toggleUserStatus));
adminRouter.post("/users/import-cv", upload.single("file"), asyncHandler(AdminController.importUserAndCV));


adminRouter.get("/bookings", asyncHandler(AdminController.getAllBookings));
adminRouter.get("/bookings/:id", asyncHandler(AdminController.getBookingById));
adminRouter.get("/system/transaction-support", asyncHandler(AdminController.getTransactionSupport));
adminRouter.get("/system/overview", asyncHandler(AdminController.getSystemOverview));
adminRouter.get("/content/stats", asyncHandler(AdminController.getContentStats));
adminRouter.get("/content/interview-sessions", asyncHandler(AdminController.getRecentInterviewSessions));
adminRouter.get("/content/course-media", asyncHandler(AdminController.getCourseMediaOverview));
adminRouter.get("/finance/courses", asyncHandler(AdminController.getCourseFinanceSummary));
adminRouter.get("/finance/subscriptions", asyncHandler(AdminController.getSubscriptionFinanceSummary));
adminRouter.get("/finance/platform-summary", asyncHandler(AdminController.getPlatformFinanceSummary));
adminRouter.patch(
  "/bookings/:id/confirm-transfer-payment",
  asyncHandler(AdminController.confirmBookingTransferPayment),
);
adminRouter.patch("/bookings/:id/confirm-refund", asyncHandler(AdminController.confirmBookingRefund));
adminRouter.get("/enrollments/pending-transfer", asyncHandler(AdminController.getPendingEnrollmentTransfers));
adminRouter.get("/enrollments/course-payments", asyncHandler(AdminController.getCoursePaymentEnrollments));
adminRouter.patch(
  "/enrollments/:id/confirm-transfer-payment",
  asyncHandler(AdminController.confirmEnrollmentTransferPayment),
);
adminRouter.post("/payments/normalize-transfer-refs", asyncHandler(AdminController.normalizeTransferReferences));
adminRouter.get("/payments/subscription-pending", asyncHandler(AdminController.getPendingSubscriptionPayments));
adminRouter.patch(
  "/payments/:id/confirm-subscription-transfer",
  asyncHandler(AdminController.confirmSubscriptionTransferPayment),
);
adminRouter.patch("/bookings/:id/status", asyncHandler(AdminController.updateBookingStatus));
adminRouter.get("/payouts", asyncHandler(AdminController.getPayoutRequests));
adminRouter.patch("/payouts/:id/approve", asyncHandler(AdminAccountController.approve));
adminRouter.patch("/payouts/:id/mark-paid", asyncHandler(AdminAccountController.paid));
adminRouter.patch("/payouts/:id/reject", asyncHandler(AdminAccountController.reject));
// Duyệt khóa học đã chuyển sang `/api/moderator/courses/*` (routes/moderator.js) —
// kiểm định nội dung thuộc moderator, không còn là quyền của admin.
adminRouter.get("/interview-metrics", asyncHandler(AdminController.getInterviewMetrics));
adminRouter.get("/analytics/user-behavior", asyncHandler(AdminController.getPlatformBehavior));
adminRouter.get("/analytics/users/:id/journey", asyncHandler(AdminController.getUserJourney));
