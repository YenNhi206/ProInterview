import { Router } from "express";

import { CoursesController } from "../controllers/coursesController.js";

import { authJwt } from "../middleware/authJwt.js";

import { requireMentor } from "../middleware/requireMentor.js";

import { EnrollmentController } from "../controllers/enrollmentController.js";

import { asyncHandler } from "../middleware/asyncHandler.js";



export const coursesRouter = Router();



coursesRouter.get("/", asyncHandler(CoursesController.list));

coursesRouter.get("/me", authJwt, requireMentor, asyncHandler(CoursesController.listMine));

coursesRouter.get(

  "/:id/mentor/students",

  authJwt,

  requireMentor,

  asyncHandler(CoursesController.mentorStudents),

);

coursesRouter.get("/:id/mentor/qa", authJwt, requireMentor, asyncHandler(CoursesController.mentorQA));

coursesRouter.post(

  "/:id/mentor/qa/:qaId/answers",

  authJwt,

  requireMentor,

  asyncHandler(CoursesController.mentorAnswerQA),

);

coursesRouter.get(

  "/:id/mentor/reviews",

  authJwt,

  requireMentor,

  asyncHandler(CoursesController.mentorReviews),

);

coursesRouter.get(

  "/:id/mentor/analytics",

  authJwt,

  requireMentor,

  asyncHandler(CoursesController.mentorAnalytics),

);

coursesRouter.get(
  "/:id/peer-reviews",
  asyncHandler(CoursesController.peerReviewsPublic),
);

coursesRouter.get("/:id", asyncHandler(CoursesController.getById));

coursesRouter.get("/:id/lessons/:lessonId", authJwt, asyncHandler(CoursesController.getLessonContent));

coursesRouter.get(
  "/:id/lessons/:lessonId/qa",
  authJwt,
  asyncHandler(CoursesController.studentLessonQA),
);

coursesRouter.post(
  "/:id/lessons/:lessonId/qa",
  authJwt,
  asyncHandler(CoursesController.studentCreateLessonQA),
);

coursesRouter.get(
  "/:id/lessons/:lessonId/notes",
  authJwt,
  asyncHandler(CoursesController.studentLessonNotes),
);

coursesRouter.put(
  "/:id/lessons/:lessonId/notes",
  authJwt,
  asyncHandler(CoursesController.studentSaveLessonNotes),
);



// Ghi danh khóa học

coursesRouter.post("/:id/enroll", authJwt, asyncHandler(EnrollmentController.enroll));



// Quản lý khóa học (Mentor)

coursesRouter.post("/", authJwt, requireMentor, asyncHandler(CoursesController.create));

coursesRouter.put("/:id", authJwt, requireMentor, asyncHandler(CoursesController.update));

coursesRouter.patch("/:id/publish", authJwt, requireMentor, asyncHandler(CoursesController.publish));

coursesRouter.get(
  "/:id/archive-eligibility",
  authJwt,
  requireMentor,
  asyncHandler(CoursesController.archiveEligibility),
);

coursesRouter.delete("/:id", authJwt, requireMentor, asyncHandler(CoursesController.archive));

