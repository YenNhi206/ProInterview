import { Router } from "express";
import multer from "multer";
import { authJwt } from "../middleware/authJwt.js";
import { injectionRateLimit } from "../middleware/injectionRateLimit.js";
import { analyzeFaceLimiter } from "../middleware/rateLimiters.js";
import { InterviewsController } from "../controllers/interviewsController.js";
import { asyncHandler } from "../middleware/asyncHandler.js";

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

export const interviewsRouter = Router();

// Public — 3 câu hỏi baseline cố định cho free trial (không cần đăng nhập)
interviewsRouter.get("/baseline-questions", asyncHandler(InterviewsController.getBaselineQuestions));

// Session lifecycle
interviewsRouter.post("/sessions", authJwt, asyncHandler(InterviewsController.createSession));
interviewsRouter.patch("/sessions/:id", authJwt, asyncHandler(InterviewsController.updateAnswer));
interviewsRouter.post("/sessions/:id/complete", authJwt, asyncHandler(InterviewsController.completeSession));
interviewsRouter.post("/sessions/:id/evaluate", authJwt, asyncHandler(InterviewsController.evaluateSession));
interviewsRouter.get("/sessions", authJwt, asyncHandler(InterviewsController.list));
interviewsRouter.get("/sessions/:id", authJwt, asyncHandler(InterviewsController.getById));
// Middleware: validate image size trước khi gọi Vision API (tránh lạm dụng credits)
const validateFaceImage = (req, res, next) => {
  const b64 = req.body?.imageBase64;
  if (b64 && b64.length > 1_400_000) {
    // base64 > 1.4 M chars ≈ image > ~1 MB — từ chối
    return res.status(413).json({ success: true, emotion: null, reason: "image_too_large" });
  }
  next();
};

interviewsRouter.post(
  "/sessions/:id/analyze-face",
  authJwt,
  analyzeFaceLimiter,
  validateFaceImage,
  asyncHandler(InterviewsController.analyzeFace),
);

// AI question generation — injectionRateLimit blocks users with ≥3 injection attempts/hour
// Không còn được Interview.jsx gọi (xem generate-followup-questions) — giữ làm rollback path.
interviewsRouter.post(
  "/generate-questions",
  authJwt,
  injectionRateLimit,
  asyncHandler(InterviewsController.generateQuestions),
);

// Mid-interview: 2 câu hỏi cá nhân hóa dựa trên CV/JD + câu trả lời thật của 3 câu baseline
interviewsRouter.post(
  "/sessions/:id/generate-followup-questions",
  authJwt,
  injectionRateLimit,
  asyncHandler(InterviewsController.generateFollowUpQuestions),
);
interviewsRouter.post(
  "/extract-cv-text",
  authJwt,
  upload.single("file"),
  asyncHandler(InterviewsController.extractCvText),
);
