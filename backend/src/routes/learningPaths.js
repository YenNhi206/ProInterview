/**
 * /api/learning-paths — Learning Path (capstone FA26).
 * LP-07: Mentor tạo / sửa bản nháp, gửi đề xuất. LP-08 thêm accept / request-revision cho ứng viên.
 * LP-10: ứng viên thanh toán trọn gói bằng chuyển khoản (checkout, submit-transfer); SePay xác nhận qua
 * `POST /api/payments/webhook/sepay`, trạng thái poll qua `GET /api/payments/transfer-status?orderRef=PI…`.
 * LP-12: ứng viên đặt lịch từng buổi (`POST /:id/sessions/:sid/schedule`), buổi sau chỉ mở khi buổi trước đạt.
 * LP-23: `GET /:id/competency-hints` năng lực gợi ý cho trình soạn (mentor).
 * LP-13: mentor ghi kết quả buổi (`PATCH /:id/sessions/:sid/outcome`) và đề xuất buổi bổ sung có phí
 * (`POST /:id/sessions/:sid/supplementary`).
 * Quyền: mentee (customer) hoặc Mentor đã duyệt — dùng chung `requestActor` với /api/mentorship-requests.
 */
import { Router } from "express";
import rateLimit from "express-rate-limit";
import { authJwt } from "../middleware/authJwt.js";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { requestActor } from "../services/mentorshipRequestsService.js";
import * as service from "../services/learningPathsService.js";
import * as paymentService from "../services/learningPathPaymentService.js";
import * as sessionsService from "../services/learningPathSessionsService.js";
import { getPathCompetencyHints } from "../services/learningPathCompetencyHintsService.js";

export const learningPathsRouter = Router();

learningPathsRouter.use(
  authJwt,
  asyncHandler(async (req, res, next) => {
    req.pathActor = await requestActor(req.userId);
    next();
  }),
);

const mutationLimit = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.userId,
  message: { success: false, error: "Bạn thao tác quá nhiều. Vui lòng thử lại sau." },
});

learningPathsRouter.get("/", asyncHandler(async (req, res) => {
  res.json({ success: true, learningPaths: await service.listLearningPaths(req.pathActor) });
}));

learningPathsRouter.post("/", mutationLimit, asyncHandler(async (req, res) => {
  res.status(201).json({ success: true, learningPath: await service.createLearningPathDraft(req.pathActor, req.body) });
}));

learningPathsRouter.get("/:id", asyncHandler(async (req, res) => {
  res.json({ success: true, learningPath: await service.getLearningPath(req.pathActor, req.params.id) });
}));

/** LP-23: năng lực gợi ý cho trình soạn (job yêu cầu + hồ sơ ứng viên). Chỉ mentor của lộ trình. */
learningPathsRouter.get("/:id/competency-hints", asyncHandler(async (req, res) => {
  res.json({ success: true, hints: await getPathCompetencyHints(req.pathActor, req.params.id) });
}));

learningPathsRouter.patch("/:id", mutationLimit, asyncHandler(async (req, res) => {
  res.json({ success: true, learningPath: await service.updateLearningPathDraft(req.pathActor, req.params.id, req.body) });
}));

learningPathsRouter.post("/:id/propose", mutationLimit, asyncHandler(async (req, res) => {
  res.json({ success: true, learningPath: await service.proposeLearningPath(req.pathActor, req.params.id) });
}));

// LP-08: ứng viên chấp nhận / yêu cầu sửa lộ trình.
learningPathsRouter.post("/:id/accept", mutationLimit, asyncHandler(async (req, res) => {
  res.json({ success: true, learningPath: await service.acceptLearningPath(req.pathActor, req.params.id, req.body) });
}));

learningPathsRouter.post("/:id/request-revision", mutationLimit, asyncHandler(async (req, res) => {
  res.json({ success: true, learningPath: await service.requestLearningPathRevision(req.pathActor, req.params.id, req.body) });
}));

// LP-10: thanh toán trọn gói (quyết định 1) qua đường ray chuyển khoản + SePay.
learningPathsRouter.post("/:id/checkout", mutationLimit, asyncHandler(async (req, res) => {
  const { learningPath, payment } = await paymentService.checkoutLearningPath(req.pathActor, req.params.id);
  res.json({ success: true, learningPath, payment });
}));

learningPathsRouter.patch("/:id/submit-transfer", mutationLimit, asyncHandler(async (req, res) => {
  const { learningPath, payment } = await paymentService.submitLearningPathTransfer(req.pathActor, req.params.id);
  res.json({ success: true, learningPath, payment });
}));

// LP-12: ứng viên đặt lịch buổi đang mở (buổi trước đã `passed`) → tạo Booking gắn buổi, buổi `scheduled`.
learningPathsRouter.post("/:id/sessions/:sid/schedule", mutationLimit, asyncHandler(async (req, res) => {
  const { learningPath, booking } = await sessionsService.scheduleLearningPathSession(req.pathActor, req.params.id, req.params.sid, req.body);
  res.status(201).json({ success: true, learningPath, booking });
}));

// LP-13: mentor ghi kết quả buổi (đạt / chưa đạt + feedback theo LP-01) sau khi booking của buổi `completed`.
learningPathsRouter.patch("/:id/sessions/:sid/outcome", mutationLimit, asyncHandler(async (req, res) => {
  const { learningPath, nextStep, suggestedOutcome } = await sessionsService.recordLearningPathSessionOutcome(req.pathActor, req.params.id, req.params.sid, req.body);
  res.json({ success: true, learningPath, nextStep, suggestedOutcome });
}));

// LP-13 (quyết định 2): buổi học lại vẫn chưa đạt → mentor đề xuất buổi bổ sung có phí (chờ thanh toán).
learningPathsRouter.post("/:id/sessions/:sid/supplementary", mutationLimit, asyncHandler(async (req, res) => {
  const { learningPath } = await sessionsService.proposeSupplementarySession(req.pathActor, req.params.id, req.params.sid, req.body);
  res.status(201).json({ success: true, learningPath });
}));
