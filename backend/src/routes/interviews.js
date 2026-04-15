import { Router } from "express";
import { authJwt } from "../middleware/authJwt.js";
import { InterviewsController } from "../controllers/interviewsController.js";

export const interviewsRouter = Router();

interviewsRouter.post("/sessions", authJwt, InterviewsController.createSession);
interviewsRouter.patch("/sessions/:id", authJwt, InterviewsController.updateAnswer);
interviewsRouter.post("/sessions/:id/complete", authJwt, InterviewsController.completeSession);
interviewsRouter.get("/sessions", authJwt, InterviewsController.list);
interviewsRouter.get("/sessions/:id", authJwt, InterviewsController.getById);
