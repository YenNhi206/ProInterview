import { Router } from "express";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { CompanyInviteController } from "../controllers/companyInviteController.js";

export const companyInvitesRouter = Router();

// Xác minh token lời mời (public)
companyInvitesRouter.get("/verify/:token", asyncHandler(CompanyInviteController.verify));

// Kích hoạt tài khoản và nhận lời mời (public)
companyInvitesRouter.post("/accept", asyncHandler(CompanyInviteController.accept));
