import { Router } from "express";
import { authJwt } from "../middleware/authJwt.js";
import { requireMentor } from "../middleware/requireMentor.js";
import { requireAdmin } from "../middleware/requireAdmin.js";
import { UploadController } from "../controllers/uploadController.js";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { formatApiError } from "../utils/apiErrors.js";
import { upload } from "../middleware/upload.js";
import multer from "multer";

export const uploadRouter = Router();

const handleMulterError = (handler) => (req, res, next) => {
  console.log(`[Upload] Request for: ${req.path}`);
  handler(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      console.error(`[Upload] Multer Error:`, err);
      if (err.code === "LIMIT_FILE_SIZE") {
        return res.status(400).json({ success: false, error: `File quá lớn (tối đa ${process.env.UPLOAD_MAX_MB || 50}MB). Video lớn hơn hãy dùng upload trực tiếp.` });
      }
      return res.status(400).json({ success: false, error: err.message });
    } else if (err) {
      console.error(`[Upload] Server Error:`, err);
      const { status, error } = formatApiError(err);
      return res.status(status).json({ success: false, error });
    }
    next();
  });
};


// Tạo signature cho mentor direct-upload video lớn (không qua multer — không có file)
uploadRouter.post("/sign-video", authJwt, requireMentor, asyncHandler(UploadController.signCourseVideoUpload));

uploadRouter.post("/avatar", authJwt, handleMulterError(upload.single("file")), asyncHandler(UploadController.uploadAvatar));
uploadRouter.post("/cv", authJwt, handleMulterError(upload.single("file")), asyncHandler(UploadController.uploadCV));
uploadRouter.post("/jd", authJwt, handleMulterError(upload.single("file")), asyncHandler(UploadController.uploadJD));
uploadRouter.post("/course-thumbnail", authJwt, requireMentor, handleMulterError(upload.single("file")), asyncHandler(UploadController.uploadCourseThumbnail));
uploadRouter.post("/course-video", authJwt, requireMentor, handleMulterError(upload.single("file")), asyncHandler(UploadController.uploadCourseVideo));
uploadRouter.post("/meeting-checkin", authJwt, requireMentor, handleMulterError(upload.single("file")), asyncHandler(UploadController.uploadMeetingCheckIn));
uploadRouter.post("/achievement-image", authJwt, requireAdmin, handleMulterError(upload.single("file")), asyncHandler(UploadController.uploadAchievementImage));

