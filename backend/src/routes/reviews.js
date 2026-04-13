import { Router } from "express";
import { authJwt } from "../middleware/authJwt.js";
import { requireMentor } from "../middleware/requireMentor.js";
import { ReviewsController } from "../controllers/reviewsController.js";

export const reviewsRouter = Router();

reviewsRouter.get("/", ReviewsController.list);
reviewsRouter.post("/", authJwt, ReviewsController.create);
reviewsRouter.patch("/:id/reply", authJwt, requireMentor, ReviewsController.reply);
reviewsRouter.delete("/:id", authJwt, ReviewsController.remove);

