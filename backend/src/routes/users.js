import { adminAuditLog } from "../middleware/adminAuditLog.js";
import { Router } from "express";
import { authJwt } from "../middleware/authJwt.js";
import { requireAdmin } from "../middleware/requireAdmin.js";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { UsersController } from "../controllers/usersController.js";

export const usersRouter = Router();

usersRouter.get("/dashboard-stats", authJwt, asyncHandler(UsersController.dashboardStats));
usersRouter.put("/me/consent/camera", authJwt, asyncHandler(UsersController.setCameraConsent));
usersRouter.patch("/:id/role", authJwt, requireAdmin, adminAuditLog, asyncHandler(UsersController.patchUserRole));
