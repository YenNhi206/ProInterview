import { Router } from "express";
import { authJwt } from "../middleware/authJwt.js";
import { requireAdmin } from "../middleware/requireAdmin.js";
import { UsersController } from "../controllers/usersController.js";

export const usersRouter = Router();

usersRouter.get("/dashboard-stats", authJwt, UsersController.dashboardStats);
usersRouter.patch("/:id/role", authJwt, requireAdmin, UsersController.patchUserRole);
