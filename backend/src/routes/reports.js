import { Router } from "express";
import { authJwt } from "../middleware/authJwt.js";
import { ReportsController } from "../controllers/reportsController.js";

export const reportsRouter = Router();

reportsRouter.post("/", authJwt, ReportsController.create);

