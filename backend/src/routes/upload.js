import { Router } from "express";
import { authJwt } from "../middleware/authJwt.js";
import { requireMentor } from "../middleware/requireMentor.js";
import { UploadController } from "../controllers/uploadController.js";

export const uploadRouter = Router();

uploadRouter.post("/avatar", authJwt, UploadController.uploadAvatar);
uploadRouter.post("/cv", authJwt, UploadController.uploadCV);
uploadRouter.post("/course-thumbnail", authJwt, requireMentor, UploadController.uploadCourseThumbnail);
