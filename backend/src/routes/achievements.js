import { Router } from "express";
import { AchievementsController } from "../controllers/achievementsController.js";
import { authJwt } from "../middleware/authJwt.js";
import { requireAdmin } from "../middleware/requireAdmin.js";
import { optionalAuth } from "../middleware/optionalAuth.js";
import { asyncHandler } from "../middleware/asyncHandler.js";

export const achievementsRouter = Router();

// Public routes (optionalAuth: nếu có token admin hợp lệ thì cho xem cả bài chưa publish)
achievementsRouter.get("/", optionalAuth, asyncHandler(AchievementsController.getAll));
achievementsRouter.get("/:id", asyncHandler(AchievementsController.getById));

// Admin only routes
achievementsRouter.post("/", authJwt, requireAdmin, asyncHandler(AchievementsController.create));
achievementsRouter.put("/:id", authJwt, requireAdmin, asyncHandler(AchievementsController.update));
achievementsRouter.delete("/:id", authJwt, requireAdmin, asyncHandler(AchievementsController.delete));
