import { User } from "../models/User.js";
import { CVDocument } from "../models/CVDocument.js";
import { CandidateProfile } from "../models/CandidateProfile.js";
import { resolveStoredUploadUrl } from "../utils/resolveStoredUploadUrl.js";
import * as cvDocService from "./cvDocumentService.js";

function formatCvItem(c) {
  if (!c) return null;
  const id = c._id ? c._id.toString() : c.id;
  return {
    id,
    _id: id,
    title: c.title || "CV chính",
    fileName: c.fileName || "cv.pdf",
    fileUrl: c.fileUrl ? resolveStoredUploadUrl(c.fileUrl) : "",
    rawUrl: c.fileUrl || "",
    fileSize: c.fileSize || 0,
    isDefault: Boolean(c.isDefault),
    uploadedAt: c.uploadedAt || c.createdAt || new Date(),
    version: c.version || 1,
  };
}

export async function listSavedCvs(userId) {
  try {
    let docs = await CVDocument.find({ userId }).sort({ isDefault: -1, updatedAt: -1 }).lean();

    // Nếu CVDocument chưa có nhưng user.savedCvs có -> tự động migrate sang CVDocument
    if (docs.length === 0) {
      const user = await User.findById(userId).select("savedCvs").lean();
      if (user && Array.isArray(user.savedCvs) && user.savedCvs.length > 0) {
        for (const item of user.savedCvs) {
          await CVDocument.create({
            userId,
            title: item.title || "CV chính",
            fileName: item.fileName || "cv.pdf",
            fileUrl: item.fileUrl || "",
            fileSize: item.fileSize || 0,
            isDefault: Boolean(item.isDefault),
          });
        }
        docs = await CVDocument.find({ userId }).sort({ isDefault: -1, updatedAt: -1 }).lean();
      }
    }

    const cvs = docs.map(formatCvItem);
    return { ok: true, cvs };
  } catch (err) {
    return { ok: false, status: 500, error: err.message || "Lỗi khi tải danh sách CV." };
  }
}

export async function addSavedCv(userId, { title, fileUrl, fileName, fileSize, isDefault }) {
  try {
    if (!fileUrl || typeof fileUrl !== "string" || !fileUrl.trim()) {
      return { ok: false, status: 400, error: "Đường dẫn file CV không hợp lệ." };
    }
    if (!fileName || typeof fileName !== "string" || !fileName.trim()) {
      return { ok: false, status: 400, error: "Tên file CV không được để trống." };
    }

    const count = await CVDocument.countDocuments({ userId });
    if (count >= 10) {
      return { ok: false, status: 400, error: "Bạn đã lưu tối đa 10 CV. Vui lòng xóa bớt CV cũ trước khi tải lên mới." };
    }

    const newCv = await cvDocService.createCv(userId, {
      title,
      fileUrl,
      fileName,
      fileSize,
      isDefault,
    });

    // Cập nhật journeyProgress của user
    await User.findByIdAndUpdate(userId, {
      $set: { "journeyProgress.uploadedCV": true },
    });

    const cvs = await cvDocService.listUserCvs(userId);
    return { ok: true, cvs: cvs.map(formatCvItem), newCv: formatCvItem(newCv) };
  } catch (err) {
    return { ok: false, status: err.status || 500, error: err.message || "Không thể lưu CV." };
  }
}

export async function setDefaultCv(userId, cvId) {
  try {
    if (!cvId) return { ok: false, status: 400, error: "Thiếu mã CV." };
    await cvDocService.setDefaultCv(userId, cvId);
    const cvs = await cvDocService.listUserCvs(userId);
    return { ok: true, cvs: cvs.map(formatCvItem) };
  } catch (err) {
    return { ok: false, status: err.status || 500, error: err.message || "Không thể đặt CV mặc định." };
  }
}

export async function deleteSavedCv(userId, cvId) {
  try {
    if (!cvId) return { ok: false, status: 400, error: "Thiếu mã CV." };
    await cvDocService.deleteCv(userId, cvId);
    const cvs = await cvDocService.listUserCvs(userId);
    return { ok: true, cvs: cvs.map(formatCvItem) };
  } catch (err) {
    return { ok: false, status: err.status || 500, error: err.message || "Không thể xóa CV." };
  }
}

export async function updateSavedCv(userId, cvId, { title, targetRole }) {
  try {
    if (!cvId) return { ok: false, status: 400, error: "Thiếu mã CV." };
    if (!title || typeof title !== "string" || !title.trim()) {
      return { ok: false, status: 400, error: "Tiêu đề CV không được để trống." };
    }
    await cvDocService.updateCv(userId, cvId, { title: title.trim(), targetRole });
    const cvs = await cvDocService.listUserCvs(userId);
    return { ok: true, cvs: cvs.map(formatCvItem) };
  } catch (err) {
    return { ok: false, status: err.status || 500, error: err.message || "Không thể cập nhật CV." };
  }
}
