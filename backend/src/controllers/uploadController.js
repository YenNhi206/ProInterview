import sharp from "sharp";
import { uploadToCloudinary, deleteLocalFile, generateUploadSignature, isCloudinaryConfigured } from "../utils/cloudinaryUpload.js";
import { getPublicBaseUrl } from "../utils/publicBaseUrl.js";
import { logger } from "../config/logger.js";
import { httpError } from "../utils/apiErrors.js";

const isProd = () => process.env.NODE_ENV === "production";

// Cạnh dài nhất sau resize — đủ nét cho avatar/thumbnail/achievement, tránh vượt giới hạn
// 10MB/ảnh của Cloudinary free plan (ảnh chụp thẳng từ điện thoại thường 10-20MB).
const MAX_IMAGE_DIMENSION = 2000;

/** Resize + nén ảnh trước khi upload. Lỗi (ảnh hỏng, định dạng lạ...) thì dùng file gốc, để Cloudinary/limit tự xử lý. */
async function compressImage(filePath) {
  try {
    return await sharp(filePath)
      .rotate() // giữ đúng chiều theo EXIF trước khi bỏ metadata
      .resize({ width: MAX_IMAGE_DIMENSION, height: MAX_IMAGE_DIMENSION, fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: 82 })
      .toBuffer();
  } catch (err) {
    logger.warn("image_compress_failed", { error: err.message, filePath });
    return filePath;
  }
}

/**
 * Thử upload lên Cloudinary. Ở production, Render dùng ổ đĩa tạm (ephemeral disk) —
 * file fallback local sẽ mất ngay khi service redeploy/restart, nên nếu Cloudinary
 * chưa cấu hình hoặc lỗi thì phải báo lỗi rõ cho client, KHÔNG được âm thầm fallback
 * local (từng gây ảnh vỡ trên production vì DB đã lưu URL local không còn tồn tại).
 * Ở dev vẫn fallback local để không bắt buộc phải cấu hình Cloudinary khi code local.
 */
async function resolveUrl(req, file, cloudinaryOptions) {
  const source =
    cloudinaryOptions.resource_type === "image" ? await compressImage(file.path) : file.path;

  let cdn = null;
  try {
    cdn = await uploadToCloudinary(source, cloudinaryOptions);
  } catch (err) {
    logger.warn("upload_cloudinary_failed", { error: err.message, folder: cloudinaryOptions.folder });
    if (isProd()) {
      deleteLocalFile(file.path);
      throw httpError(503, "Lưu file lên Cloudinary thất bại, vui lòng thử lại.");
    }
  }

  if (cdn) {
    deleteLocalFile(file.path);
    logger.info("upload_cloudinary_ok", { folder: cloudinaryOptions.folder, url: cdn.url });
    return { url: cdn.url, absoluteUrl: cdn.url };
  }

  if (isProd()) {
    throw httpError(503, "Cloudinary chưa được cấu hình trên server. Không thể lưu file.");
  }

  // Fallback: local static file — chỉ dùng ở dev.
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
