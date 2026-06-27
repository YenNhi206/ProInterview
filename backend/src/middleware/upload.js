import multer from "multer";
import path from "path";
import fs from "fs";
import crypto from "crypto";
import { fileURLToPath } from "url";
import { isUploadSizeAllowed } from "../utils/securityGuards.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const uploadDir = path.join(__dirname, "../../public/uploads");

// Tạo thư mục nếu chưa tồn tại
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    // crypto.randomBytes (không phải Math.random) — file CV/JD chứa PII, /uploads public nên
    // tên file phải không đoán/brute-force được.
    const uniqueSuffix = Date.now() + "-" + crypto.randomBytes(16).toString("hex");
    const ext = path.extname(file.originalname);
    cb(null, file.fieldname + "-" + uniqueSuffix + ext);
  },
});

const ALLOWED_EXTS = new Set([".jpg", ".jpeg", ".png", ".webp", ".pdf", ".doc", ".docx", ".mp4", ".mov", ".webm"]);
const ALLOWED_MIMES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "video/mp4",
  "video/quicktime",
  "video/webm",
]);
/** Mặc định 50MB; tăng qua UPLOAD_MAX_MB nếu cần upload video mentor (vd. 500). */
const MAX_UPLOAD_MB = Number(process.env.UPLOAD_MAX_MB) || 50;
export const MAX_UPLOAD_BYTES = MAX_UPLOAD_MB * 1024 * 1024;

export const upload = multer({
  storage: storage,
  limits: {
    fileSize: MAX_UPLOAD_BYTES,
  },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname || "").toLowerCase();
    const mime = String(file.mimetype || "").toLowerCase();
    if (!ALLOWED_EXTS.has(ext) || !ALLOWED_MIMES.has(mime)) {
      return cb(new Error("Định dạng file không được hỗ trợ."));
    }
    return cb(null, true);
  },
});

export function isAllowedUploadPayloadSize(sizeBytes) {
  return isUploadSizeAllowed(sizeBytes, MAX_UPLOAD_BYTES);
}

