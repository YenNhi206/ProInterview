import express from "express";
import mongoose from "mongoose";
import { AuthController } from "../controllers/authController.js";
import { authJwt } from "../middleware/authJwt.js";

const router = express.Router();

router.use((req, res, next) => {
  if (mongoose.connection.readyState === 1) return next();
  return res.status(503).json({
    success: false,
    error:
      "Cơ sở dữ liệu chưa kết nối. Kiểm tra MONGO_URI trong backend .env và đảm bảo MongoDB đang chạy.",
  });
});

router.post("/register", AuthController.register);
router.post("/login", AuthController.login);
router.post("/google", AuthController.google);
router.get("/me", authJwt, AuthController.me);
router.patch("/me", authJwt, AuthController.patchMe);

export const authRouter = router;
