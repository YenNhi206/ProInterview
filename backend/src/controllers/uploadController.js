import { uploadToCloudinary, deleteLocalFile, generateUploadSignature, isCloudinaryConfigured } from "../utils/cloudinaryUpload.js";
import { getPublicBaseUrl } from "../utils/publicBaseUrl.js";
import { logger } from "../config/logger.js";

/**
 * Thử upload lên Cloudinary; nếu chưa cấu hình hoặc lỗi → fallback URL local.
 * Trả về string URL cuối cùng để dùng luôn.
 */
async function resolveUrl(req, file, cloudinaryOptions) {
  try {
    const cdn = await uploadToCloudinary(file.path, cloudinaryOptions);
    if (cdn) {
      deleteLocalFile(file.path);
      logger.info("upload_cloudinary_ok", { folder: cloudinaryOptions.folder, url: cdn.url });
      return { url: cdn.url, absoluteUrl: cdn.url };
    }
  } catch (err) {
    logger.warn("upload_cloudinary_failed", { error: err.message, folder: cloudinaryOptions.folder });
  }
  // Fallback: local static file
  const rel = `/uploads/${file.filename}`;
  const baseUrl = getPublicBaseUrl(req);
  return { url: rel, absoluteUrl: `${baseUrl}${rel}` };
}

export const UploadController = {
  /** Upload ảnh đại diện — avatar (JPEG/PNG/WebP) */
  uploadAvatar: async (req, res, next) => {
    try {
      if (!req.file) return res.status(400).json({ success: false, error: "Không tìm thấy file" });
      const { url, absoluteUrl } = await resolveUrl(req, req.file, {
        folder:        "prointerview/avatars",
        resource_type: "image",
        transformation: [{ width: 400, height: 400, crop: "fill", quality: "auto:good", fetch_format: "auto" }],
      });
      res.json({ success: true, url, absoluteUrl, message: "Upload ảnh đại diện thành công" });
    } catch (error) { next(error); }
  },

  /** Upload CV (PDF/DOC) */
  uploadCV: async (req, res, next) => {
    try {
      if (!req.file) return res.status(400).json({ success: false, error: "Không tìm thấy file" });
      const { url, absoluteUrl } = await resolveUrl(req, req.file, {
        folder:        "prointerview/cv-files",
        resource_type: "raw",
        use_filename:  true,
        unique_filename: true,
      });
      res.json({
        success: true, url, absoluteUrl,
        fileId:   req.file.filename,
        fileName: req.file.originalname,
        message: "Upload CV thành công",
      });
    } catch (error) { next(error); }
  },

  /** Upload JD (PDF) */
  uploadJD: async (req, res, next) => {
    try {
      if (!req.file) return res.status(400).json({ success: false, error: "Không tìm thấy file" });
      const { url, absoluteUrl } = await resolveUrl(req, req.file, {
        folder:        "prointerview/jd-files",
        resource_type: "raw",
        use_filename:  true,
        unique_filename: true,
      });
      res.json({
        success: true, url, absoluteUrl,
        fileId:   req.file.filename,
        fileName: req.file.originalname,
        message: "Upload JD thành công",
      });
    } catch (error) { next(error); }
  },

  /** Upload ảnh bìa khóa học */
  uploadCourseThumbnail: async (req, res, next) => {
    try {
      if (!req.file) return res.status(400).json({ success: false, error: "Không tìm thấy file" });
      const { url, absoluteUrl } = await resolveUrl(req, req.file, {
        folder:        "prointerview/course-thumbnails",
        resource_type: "image",
        transformation: [{ width: 1280, height: 720, crop: "fill", quality: "auto:good", fetch_format: "auto" }],
      });
      res.json({ success: true, url, absoluteUrl, message: "Upload ảnh bìa khóa học thành công" });
    } catch (error) { next(error); }
  },

  /** Upload video bài học */
  uploadCourseVideo: async (req, res, next) => {
    try {
      if (!req.file) return res.status(400).json({ success: false, error: "Không tìm thấy file" });
      const { url, absoluteUrl } = await resolveUrl(req, req.file, {
        folder:        "prointerview/course-videos",
        resource_type: "video",
        use_filename:  true,
        unique_filename: true,
        // eager: [{ streaming_profile: "hd", format: "m3u8" }], // HLS nếu cần
      });
      res.json({ success: true, url, absoluteUrl, message: "Upload video bài học thành công" });
    } catch (error) { next(error); }
  },

  /** Upload ảnh check-in webcam mentor trước buổi họp */
  uploadMeetingCheckIn: async (req, res, next) => {
    try {
      if (!req.file) return res.status(400).json({ success: false, error: "Không tìm thấy file" });
      const { url, absoluteUrl } = await resolveUrl(req, req.file, {
        folder: "prointerview/meeting-checkins",
        resource_type: "image",
        transformation: [{ width: 960, height: 960, crop: "limit", quality: "auto:good", fetch_format: "auto" }],
      });
      res.json({ success: true, url, absoluteUrl, message: "Upload ảnh check-in thành công" });
    } catch (error) {
      next(error);
    }
  },

  /** Tạo chữ ký Cloudinary cho mentor direct-upload video lớn từ browser */
  signCourseVideoUpload: async (req, res, next) => {
    try {
      if (!isCloudinaryConfigured()) {
        return res.status(503).json({ success: false, error: "Cloudinary chưa cấu hình trên server." });
      }
      const timestamp = Math.round(Date.now() / 1000);
      const folder = "prointerview/course-videos";
      const signature = generateUploadSignature({ folder, timestamp });
      res.json({
        success: true,
        signature,
        timestamp,
        apiKey: process.env.CLOUDINARY_API_KEY,
        cloudName: process.env.CLOUDINARY_CLOUD_NAME,
        folder,
      });
    } catch (err) { next(err); }
  },

  /** Upload ảnh thành tựu (Achievement) */
  uploadAchievementImage: async (req, res, next) => {
    try {
      if (!req.file) return res.status(400).json({ success: false, error: "Không tìm thấy file" });
      const { url, absoluteUrl } = await resolveUrl(req, req.file, {
        folder:        "prointerview/achievements",
        resource_type: "image",
        transformation: [{ width: 1200, height: 800, crop: "limit", quality: "auto:good", fetch_format: "auto" }],
      });
      res.json({ success: true, url, absoluteUrl, message: "Upload ảnh thành tựu thành công" });
    } catch (error) { next(error); }
  },
};
