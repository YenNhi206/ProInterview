import {
  listUserCvs,
  getCvById,
  createCv,
  updateCv,
  duplicateCv,
  setDefaultCv,
  deleteCv,
} from "../services/cvDocumentService.js";
import { exportCvToPdf } from "../services/cvExportPdfService.js";
import { User } from "../models/User.js";
import { CVDocument } from "../models/CVDocument.js";

export const CVDocumentController = {
  // PR-02: Danh sách kho CV của user
  async listCvs(req, res) {
    const cvs = await listUserCvs(req.userId);
    return res.json({
      success: true,
      items: cvs,
      cvs, // Alias for backward compatibility
    });
  },

  // PR-02: Chi tiết 1 CV
  async getCv(req, res) {
    const cv = await getCvById(req.userId, req.params.id);
    return res.json({
      success: true,
      cv,
    });
  },

  // PR-02 & PR-04: Thêm CV mới vào kho (upload file hoặc body)
  async createCv(req, res) {
    let payload = req.body || {};
    // Parse content if passed as stringified JSON in multipart form
    if (typeof payload.content === "string") {
      try {
        payload.content = JSON.parse(payload.content);
      } catch {}
    }
    if (typeof payload.skills === "string") {
      try {
        payload.skills = JSON.parse(payload.skills);
      } catch {
        payload.skills = payload.skills.split(",").map((s) => s.trim()).filter(Boolean);
      }
    }

    const cv = await createCv(req.userId, payload, req.file);
    return res.status(201).json({
      success: true,
      message: "Tải lên và lưu CV thành công.",
      cv,
    });
  },

  // PR-02: Cập nhật CV
  async updateCv(req, res) {
    const cv = await updateCv(req.userId, req.params.id, req.body);
    return res.json({
      success: true,
      message: "Cập nhật CV thành công.",
      cv,
    });
  },

  // PR-02: Nhân bản CV
  async duplicateCv(req, res) {
    const cv = await duplicateCv(req.userId, req.params.id);
    return res.status(201).json({
      success: true,
      message: "Nhân bản CV thành công.",
      cv,
    });
  },

  // PR-02: Đặt làm CV mặc định
  async setDefaultCv(req, res) {
    const cv = await setDefaultCv(req.userId, req.params.id);
    return res.json({
      success: true,
      message: "Đã đặt làm CV mặc định.",
      cv,
    });
  },

  // PR-02: Xóa CV khỏi kho
  async deleteCv(req, res) {
    const result = await deleteCv(req.userId, req.params.id);
    return res.json(result);
  },

  // PR-09: Xuất PDF bằng pdfkit + DejaVuSans
  async exportPdf(req, res) {
    const cv = await CVDocument.findOne({ _id: req.params.id, userId: req.userId });
    if (!cv) {
      return res.status(404).json({ success: false, error: "Không tìm thấy CV." });
    }

    const user = await User.findById(req.userId).lean();
    const pdfBuffer = await exportCvToPdf(cv, user);

    const safeTitle = (cv.title || "cv").replace(/[^a-zA-Z0-9_-]/g, "_");
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${safeTitle}.pdf"`);
    res.setHeader("Content-Length", pdfBuffer.length);

    return res.send(pdfBuffer);
  },
};
