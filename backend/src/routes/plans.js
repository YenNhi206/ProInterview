import { Router } from "express";
import { authJwt } from "../middleware/authJwt.js";
import { requireAdmin } from "../middleware/requireAdmin.js";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { PlansController } from "../controllers/plansController.js";

export const plansRouter = Router();

plansRouter.get("/catalog", asyncHandler(PlansController.catalog));
plansRouter.get("/current", authJwt, asyncHandler(PlansController.current));
// Chỉ admin — kích hoạt plan thủ công (luồng tự động qua finalizePaymentSuccess)
plansRouter.post("/activate", authJwt, requireAdmin, asyncHandler(PlansController.activate));
plansRouter.post("/cancel", authJwt, asyncHandler(PlansController.cancel));
