import { Router } from "express";
import { CoursesController } from "../controllers/coursesController.js";
import { authJwt } from "../middleware/authJwt.js";
import { requireMentor } from "../middleware/requireMentor.js";
import { EnrollmentController } from "../controllers/enrollmentController.js";

export const coursesRouter = Router();

coursesRouter.get("/", CoursesController.list);
coursesRouter.get("/:id", CoursesController.getById);
coursesRouter.get("/:id/lessons/:lessonId", authJwt, CoursesController.getLessonContent);

// Ghi danh khóa học
coursesRouter.post("/:id/enroll", authJwt, EnrollmentController.enroll);

// Quản lý khóa học (Mentor)
coursesRouter.post("/", authJwt, requireMentor, CoursesController.create);
coursesRouter.put("/:id", authJwt, requireMentor, CoursesController.update);
coursesRouter.patch("/:id/publish", authJwt, requireMentor, CoursesController.publish);
coursesRouter.delete("/:id", authJwt, requireMentor, CoursesController.archive);
