import { Router } from "express";
import { authJwt } from "../middleware/authJwt.js";
import { UsersController } from "../controllers/usersController.js";

export const usersRouter = Router();

usersRouter.get("/dashboard-stats", authJwt, UsersController.dashboardStats);
