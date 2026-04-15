import { Router } from "express";
import { EnrollmentController } from "../controllers/enrollmentController.js";
import { authJwt } from "../middleware/authJwt.js";

export const enrollmentsRouter = Router();

enrollmentsRouter.use(authJwt);

enrollmentsRouter.get("/my", EnrollmentController.getMyEnrollments);
enrollmentsRouter.get("/:id/certificate", EnrollmentController.getCertificate);
enrollmentsRouter.patch("/:id/progress", EnrollmentController.updateProgress);
