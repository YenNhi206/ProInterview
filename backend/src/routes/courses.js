import { Router } from "express";
import { CoursesController } from "../controllers/coursesController.js";
import { authJwt } from "../middleware/authJwt.js";
import { EnrollmentController } from "../controllers/enrollmentController.js";

export const coursesRouter = Router();

coursesRouter.get("/", CoursesController.list);
coursesRouter.get("/:id", CoursesController.getById);

// Ghi danh khóa học
coursesRouter.post("/:id/enroll", authJwt, EnrollmentController.enroll);
