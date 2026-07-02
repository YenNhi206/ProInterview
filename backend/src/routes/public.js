import { Router } from "express";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { PublicController } from "../controllers/publicController.js";

export const publicRouter = Router();

publicRouter.get("/home-data", asyncHandler(PublicController.getHomeData));
