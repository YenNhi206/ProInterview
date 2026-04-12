import { Router } from "express";
import { authJwt } from "../middleware/authJwt.js";
import { PlansController } from "../controllers/plansController.js";

export const plansRouter = Router();

plansRouter.get("/current", authJwt, PlansController.current);
plansRouter.post("/activate", authJwt, PlansController.activate);
plansRouter.post("/cancel", authJwt, PlansController.cancel);
