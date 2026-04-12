import { Router } from "express";
import { authJwt } from "../middleware/authJwt.js";
import { BookingsController } from "../controllers/bookingsController.js";

export const bookingsRouter = Router();

bookingsRouter.get("/", authJwt, BookingsController.list);
bookingsRouter.post("/", authJwt, BookingsController.create);
bookingsRouter.patch("/:id/reschedule", authJwt, BookingsController.reschedule);
bookingsRouter.get("/:id", authJwt, BookingsController.getById);
bookingsRouter.delete("/:id", authJwt, BookingsController.cancel);
