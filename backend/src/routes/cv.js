import { Router } from "express";
import { authJwt } from "../middleware/authJwt.js";
import { CVController } from "../controllers/cvController.js";

export const cvRouter = Router();

cvRouter.get("/quota", authJwt, CVController.getQuota);
cvRouter.post("/analyses", authJwt, CVController.createAnalysis);
cvRouter.get("/analyses", authJwt, CVController.list);
cvRouter.get("/analyses/:id", authJwt, CVController.getById);
cvRouter.delete("/analyses/:id", authJwt, CVController.delete);
