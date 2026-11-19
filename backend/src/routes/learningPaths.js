/**
 * /api/learning-paths — Learning Path (capstone FA26).
 * LP-07: Mentor tạo / sửa bản nháp, gửi đề xuất. LP-08 thêm accept / request-revision cho ứng viên.
 * Quyền: mentee (customer) hoặc Mentor đã duyệt — dùng chung `requestActor` với /api/mentorship-requests.
 */
import { Router } from "express";
import rateLimit from "express-rate-limit";
import { authJwt } from "../middleware/authJwt.js";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { requestActor } from "../services/mentorshipRequestsService.js";
import * as service from "../services/learningPathsService.js";

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

learningPathsRouter.patch("/:id", mutationLimit, asyncHandler(async (req, res) => {
  res.json({ success: true, learningPath: await service.updateLearningPathDraft(req.pathActor, req.params.id, req.body) });
}));

learningPathsRouter.post("/:id/propose", mutationLimit, asyncHandler(async (req, res) => {
  res.json({ success: true, learningPath: await service.proposeLearningPath(req.pathActor, req.params.id) });
}));
