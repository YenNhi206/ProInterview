import { Router } from "express";
import { authJwt } from "../middleware/authJwt.js";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { AnalyticsController } from "../controllers/analyticsController.js";
import { analyticsEventsLimiter } from "../middleware/rateLimiters.js";

export const analyticsRouter = Router();

analyticsRouter.use(authJwt);
analyticsRouter.post("/events", analyticsEventsLimiter, asyncHandler(AnalyticsController.recordEvents));
