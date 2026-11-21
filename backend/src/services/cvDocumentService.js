import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { CVDocument } from "../models/CVDocument.js";
import { CandidateProfile } from "../models/CandidateProfile.js";
import { resolveStoredUploadUrl } from "../utils/resolveStoredUploadUrl.js";
import { validateCvFile } from "./cvValidator.js";
import { httpError } from "../utils/apiErrors.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const UPLOAD_ROOT = path.resolve(__dirname, "../../public/uploads");

/** Đảm bảo thư mục uploads tồn tại */
async function ensureUploadDir() {
  try {
    await fs.mkdir(UPLOAD_ROOT, { recursive: true });
  } catch {}
}

function formatCvResponse(doc) {
  if (!doc) return null;
  const raw = doc.toObject ? doc.toObject() : doc;
  return {
    ...raw,
    id: String(raw._id),
    fileUrl: raw.fileUrl ? resolveStoredUploadUrl(raw.fileUrl) : "",
    rawUrl: raw.fileUrl || "",
  };
}

/**
 * PR-02: Lấy danh sách kho CV của user
 */
export async function listUserCvs(userId) {
  if (!userId) throw httpError(401, "Yêu cầu đăng nhập.");

  const docs = await CVDocument.find({ userId })
    .sort({ isDefault: -1, updatedAt: -1 })
    .lean();

  return docs.map(formatCvResponse);
}

/**
 * PR-02: Lấy chi tiết một CV
 */
export async function getCvById(userId, cvId) {
  if (!userId) throw httpError(401, "Yêu cầu đăng nhập.");
  if (!cvId) throw httpError(400, "Thiếu mã CV.");

  const cv = await CVDocument.findOne({ _id: cvId, userId });
  if (!cv) throw httpError(404, "Không tìm thấy CV hoặc bạn không có quyền truy cập.");

  return formatCvResponse(cv);
}

/**
 * PR-02 & PR-04: Tạo CV mới (tải file lên hoặc tạo từ mẫu)
 */
export async function createCv(userId, data = {}, file = null) {
  if (!userId) throw httpError(401, "Yêu cầu đăng nhập.");

  let fileUrl = data.fileUrl || "";
  let fileName = data.fileName || "cv.pdf";
  let fileSize = Number(data.fileSize) || 0;
  let mimeType = data.mimeType || "application/pdf";
  let fileKey = data.fileKey || "";

  // Nếu có upload tệp vật lý qua Multer
  if (file) {
    validateCvFile({
      originalname: file.originalname,
      mimetype: file.mimetype,
      buffer: file.buffer,
      size: file.size,
    });

    await ensureUploadDir();
    const safeName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, "_");
    const uniqueKey = `cv_${Date.now()}_${safeName}`;
    const targetPath = path.join(UPLOAD_ROOT, uniqueKey);

    if (file.buffer) {
      await fs.writeFile(targetPath, file.buffer);
    }

    fileName = file.originalname;
    fileKey = uniqueKey;
    fileUrl = `/uploads/${uniqueKey}`;
    fileSize = file.size || (file.buffer ? file.buffer.length : 0);
    mimeType = file.mimetype || "application/pdf";
  }

  const existingCount = await CVDocument.countDocuments({ userId });
  const shouldBeDefault = Boolean(data.isDefault) || existingCount === 0;

  if (shouldBeDefault) {
    await CVDocument.updateMany({ userId }, { $set: { isDefault: false } });
  }

  const title = (data.title || "").trim() || `CV ${existingCount + 1}`;

  const cv = await CVDocument.create({
    userId,
    title,
    targetRole: (data.targetRole || "").trim(),
    fileName,
    fileUrl,
    fileKey,
    fileSize,
    mimeType,
    content: data.content || {},
    skills: Array.isArray(data.skills) ? data.skills : [],
    version: 1,
    isDefault: shouldBeDefault,
    isValidCv: true,
  });

  if (shouldBeDefault) {
    await CandidateProfile.updateOne({ userId }, { defaultCvId: cv._id });
  }

  return formatCvResponse(cv);
}

/**
 * PR-02: Cập nhật thông tin và nội dung CV (tăng version nếu sửa nội dung)
 */
export async function updateCv(userId, cvId, updateData) {
  if (!userId) throw httpError(401, "Yêu cầu đăng nhập.");
  if (!cvId) throw httpError(400, "Thiếu mã CV.");

  const cv = await CVDocument.findOne({ _id: cvId, userId });
  if (!cv) throw httpError(404, "Không tìm thấy CV.");

  const { title, targetRole, content, skills, isDefault } = updateData;

  if (title !== undefined) cv.title = String(title).trim();
  if (targetRole !== undefined) cv.targetRole = String(targetRole).trim();

  if (content !== undefined) {
    cv.content = content;
    cv.version = (cv.version || 1) + 1; // Tăng version khi cập nhật nội dung
  }

  if (Array.isArray(skills)) {
    cv.skills = skills;
  }

  if (isDefault === true && !cv.isDefault) {
    await CVDocument.updateMany({ userId }, { $set: { isDefault: false } });
    cv.isDefault = true;
    await CandidateProfile.updateOne({ userId }, { defaultCvId: cv._id });
  }

  await cv.save();
  return formatCvResponse(cv);
}

/**
 * PR-02: Nhân bản (duplicate) một CV
 */
export async function duplicateCv(userId, cvId) {
  if (!userId) throw httpError(401, "Yêu cầu đăng nhập.");
  if (!cvId) throw httpError(400, "Thiếu mã CV.");

  const sourceCv = await CVDocument.findOne({ _id: cvId, userId });
  if (!sourceCv) throw httpError(404, "Không tìm thấy CV gốc để nhân bản.");

  const cloneTitle = `[Bản sao] ${sourceCv.title}`.slice(0, 100);

  const clonedCv = await CVDocument.create({
    userId,
    title: cloneTitle,
    targetRole: sourceCv.targetRole,
    fileName: sourceCv.fileName,
    fileUrl: sourceCv.fileUrl,
    fileKey: sourceCv.fileKey,
    fileSize: sourceCv.fileSize,
    mimeType: sourceCv.mimeType,
    content: sourceCv.content,
    skills: sourceCv.skills,
    version: 1,
    parentCvId: sourceCv._id,
    isDefault: false, // Bản sao không bao giờ làm mặc định ngay
    isValidCv: sourceCv.isValidCv,
  });

  return formatCvResponse(clonedCv);
}

/**
 * PR-02: Đặt CV làm mặc định (bảo đảm đúng 1 CV mặc định)
 */
export async function setDefaultCv(userId, cvId) {
  if (!userId) throw httpError(401, "Yêu cầu đăng nhập.");
  if (!cvId) throw httpError(400, "Thiếu mã CV.");

  const cv = await CVDocument.findOne({ _id: cvId, userId });
  if (!cv) throw httpError(404, "Không tìm thấy CV.");

  // Đặt tất cả CV khác thành false
  await CVDocument.updateMany({ userId }, { $set: { isDefault: false } });

  cv.isDefault = true;
  await cv.save();

  // Cập nhật defaultCvId trong CandidateProfile
  await CandidateProfile.updateOne({ userId }, { defaultCvId: cv._id });

  return formatCvResponse(cv);
}

/**
 * PR-02: Xóa một CV (nếu xóa CV mặc định thì tự động chọn CV mới nhất còn lại làm mặc định)
 */
export async function deleteCv(userId, cvId) {
  if (!userId) throw httpError(401, "Yêu cầu đăng nhập.");
  if (!cvId) throw httpError(400, "Thiếu mã CV.");

  const cv = await CVDocument.findOne({ _id: cvId, userId });
  if (!cv) throw httpError(404, "Không tìm thấy CV.");

  const wasDefault = Boolean(cv.isDefault);
  await CVDocument.deleteOne({ _id: cv._id });

  if (wasDefault) {
    const nextDefault = await CVDocument.findOne({ userId }).sort({ updatedAt: -1 });
    if (nextDefault) {
      nextDefault.isDefault = true;
      await nextDefault.save();
      await CandidateProfile.updateOne({ userId }, { defaultCvId: nextDefault._id });
    } else {
      await CandidateProfile.updateOne({ userId }, { defaultCvId: null });
    }
  }

  return { success: true, message: "Đã xóa CV thành công." };
}
