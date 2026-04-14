import express from "express";
import mongoose from "mongoose";
import { AuthController } from "../controllers/authController.js";
import { authJwt } from "../middleware/authJwt.js";
import { authWriteLimiter, refreshLimiter } from "../middleware/rateLimiters.js";

const router = express.Router();

router.use((req, res, next) => {
  if (mongoose.connection.readyState === 1) return next();
  return res.status(503).json({
    success: false,
    error:
      "Cơ sở dữ liệu chưa kết nối. Kiểm tra MONGO_URI trong backend .env và đảm bảo MongoDB đang chạy.",
  });
});

router.post("/register", authWriteLimiter, AuthController.register);
router.post("/login", authWriteLimiter, AuthController.login);
router.post("/google", authWriteLimiter, AuthController.google);
router.post("/refresh", refreshLimiter, AuthController.refresh);
router.get("/me", authJwt, AuthController.me);
router.patch("/me", authJwt, AuthController.patchMe);
router.post("/logout", authJwt, AuthController.logout);
router.get("/sessions", authJwt, AuthController.sessions);
router.delete("/sessions/:sessionId", authJwt, AuthController.revokeSession);

export const authRouter = router;
