import { adminAuditLog } from "../middleware/adminAuditLog.js";
import { Router } from "express";
import { authJwt } from "../middleware/authJwt.js";
import { requireAdmin } from "../middleware/requireAdmin.js";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { UsersController } from "../controllers/usersController.js";

export const usersRouter = Router();

usersRouter.get("/dashboard-stats", authJwt, asyncHandler(UsersController.dashboardStats));
usersRouter.put("/me/consent/camera", authJwt, asyncHandler(UsersController.setCameraConsent));

// Multi-CV Vault routes
usersRouter.get("/me/cvs", authJwt, asyncHandler(UsersController.listCvs));
usersRouter.post("/me/cvs", authJwt, asyncHandler(UsersController.addCv));
usersRouter.patch("/me/cvs/:cvId/default", authJwt, asyncHandler(UsersController.setDefaultCv));
usersRouter.patch("/me/cvs/:cvId", authJwt, asyncHandler(UsersController.updateCv));
usersRouter.delete("/me/cvs/:cvId", authJwt, asyncHandler(UsersController.deleteCv));

// Verified Competency Profile routes
usersRouter.get("/me/verified-competencies", authJwt, asyncHandler(UsersController.getVerifiedCompetencies));
usersRouter.post("/me/verified-competencies/sync", authJwt, asyncHandler(UsersController.syncVerifiedCompetencies));

usersRouter.patch("/:id/role", authJwt, requireAdmin, adminAuditLog, asyncHandler(UsersController.patchUserRole));
