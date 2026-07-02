import { Router } from "express";
import { authJwt } from "../middleware/authJwt.js";
import { requireMentor } from "../middleware/requireMentor.js";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { MentorController } from "../controllers/mentorController.js";

export const mentorRouter = Router();

mentorRouter.get("/dashboard", authJwt, requireMentor, asyncHandler(MentorController.dashboard));
mentorRouter.get("/finance", authJwt, requireMentor, asyncHandler(MentorController.finance));
mentorRouter.get("/analytics", authJwt, requireMentor, asyncHandler(MentorController.analytics));
mentorRouter.get("/peer-reviews", authJwt, requireMentor, asyncHandler(MentorController.peerReviewQueue));
mentorRouter.post("/peer-reviews/:courseId", authJwt, requireMentor, asyncHandler(MentorController.submitPeerReview));
mentorRouter.get("/reviews", authJwt, requireMentor, asyncHandler(MentorController.reviews));
mentorRouter.post("/payout", authJwt, requireMentor, asyncHandler(MentorController.payout));
mentorRouter.get("/payouts", authJwt, requireMentor, asyncHandler(MentorController.payoutHistory));
mentorRouter.patch("/payout-account", authJwt, requireMentor, asyncHandler(MentorController.payoutAccount));
mentorRouter.post("/request-price-change", authJwt, requireMentor, asyncHandler(MentorController.requestPriceChange));
