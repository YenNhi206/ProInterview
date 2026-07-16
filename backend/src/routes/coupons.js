import { Router } from "express";
import { authJwt } from "../middleware/authJwt.js";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { CouponsController } from "../controllers/couponsController.js";

export const couponsRouter = Router();

couponsRouter.post("/validate", authJwt, asyncHandler(CouponsController.validate));
