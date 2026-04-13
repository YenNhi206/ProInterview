import { Router } from "express";
import { authJwt } from "../middleware/authJwt.js";
import { requireMentor } from "../middleware/requireMentor.js";
import { BookingsController } from "../controllers/bookingsController.js";

export const bookingsRouter = Router();

bookingsRouter.get("/", authJwt, BookingsController.list);
bookingsRouter.post("/", authJwt, BookingsController.create);
bookingsRouter.get("/mentor/list", authJwt, requireMentor, BookingsController.listForMentor);
bookingsRouter.patch("/:id/confirm", authJwt, requireMentor, BookingsController.confirmForMentor);
bookingsRouter.patch("/:id/complete", authJwt, requireMentor, BookingsController.completeForMentor);
bookingsRouter.patch("/:id/notes", authJwt, requireMentor, BookingsController.updateNotesForMentor);
bookingsRouter.patch("/:id/reschedule", authJwt, BookingsController.reschedule);
bookingsRouter.get("/:id", authJwt, BookingsController.getById);
bookingsRouter.delete("/:id", authJwt, BookingsController.cancel);
