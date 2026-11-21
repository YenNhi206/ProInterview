import mongoose from "mongoose";
import * as dashboardStatsService from "../services/dashboardStatsService.js";
import * as userRoleService from "../services/userRoleService.js";
import * as userConsentService from "../services/userConsentService.js";
import * as userCvService from "../services/userCvService.js";
import * as verifiedCompetencyService from "../services/verifiedCompetencyService.js";
import { validateCameraConsent } from "../dto/consent.dto.js";

export class UsersController {
  static async dashboardStats(req, res, next) {
    try {
      const result = await dashboardStatsService.getDashboardStats(req.userId);
      if (!result.ok) {
        return res.status(result.status).json({ success: false, error: result.error });
      }
      res.json({ success: true, stats: result.stats });
    } catch (err) {
      next(err);
    }
  }

  /** PUT /api/users/me/consent/camera — body { accepted, version } */
  static async setCameraConsent(req, res, next) {
    try {
      const { error, value } = validateCameraConsent(req.body);
      if (error) {
        return res.status(400).json({ success: false, error: error.details.map((d) => d.message).join("; ") });
      }
      const result = await userConsentService.setCameraConsent(req.userId, value);
      if (!result.ok) {
        return res.status(result.status).json({ success: false, error: result.error });
      }
      res.json({ success: true, user: result.user });
    } catch (err) {
      next(err);
    }
  }

  /** [ADMIN] Đặt role customer | mentor cho user (bỏ qua mã mời mentor). */
  static async patchUserRole(req, res, next) {
    try {
      const id = req.params.id;
      if (!mongoose.isValidObjectId(id)) {
        return res.status(400).json({ success: false, error: "id không hợp lệ." });
      }
      const result = await userRoleService.setRoleByAdmin(req.userId, id, req.body?.role);
      if (!result.ok) {
        return res.status(result.status).json({ success: false, error: result.error });
      }
      res.json({ success: true, user: result.user });
    } catch (err) {
      next(err);
    }
  }

  /** GET /api/users/me/cvs — Danh sách các CV đã lưu */
  static async listCvs(req, res, next) {
    try {
      const result = await userCvService.listSavedCvs(req.userId);
      if (!result.ok) {
        return res.status(result.status || 400).json({ success: false, error: result.error });
      }
      res.json({ success: true, cvs: result.cvs });
    } catch (err) {
      next(err);
    }
  }

  /** POST /api/users/me/cvs — Lưu CV mới vào kho */
  static async addCv(req, res, next) {
    try {
      const result = await userCvService.addSavedCv(req.userId, req.body || {});
      if (!result.ok) {
        return res.status(result.status || 400).json({ success: false, error: result.error });
      }
      res.status(201).json({ success: true, cvs: result.cvs, newCv: result.newCv });
    } catch (err) {
      next(err);
    }
  }

  /** PATCH /api/users/me/cvs/:cvId/default — Đặt CV làm mặc định */
  static async setDefaultCv(req, res, next) {
    try {
      const result = await userCvService.setDefaultCv(req.userId, req.params.cvId);
      if (!result.ok) {
        return res.status(result.status || 400).json({ success: false, error: result.error });
      }
      res.json({ success: true, cvs: result.cvs });
    } catch (err) {
      next(err);
    }
  }

  /** DELETE /api/users/me/cvs/:cvId — Xóa CV khỏi kho */
  static async deleteCv(req, res, next) {
    try {
      const result = await userCvService.deleteSavedCv(req.userId, req.params.cvId);
      if (!result.ok) {
        return res.status(result.status || 400).json({ success: false, error: result.error });
      }
      res.json({ success: true, cvs: result.cvs });
    } catch (err) {
      next(err);
    }
  }

  /** PATCH /api/users/me/cvs/:cvId — Sửa tên/tiêu đề CV */
  static async updateCv(req, res, next) {
    try {
      const result = await userCvService.updateSavedCv(req.userId, req.params.cvId, req.body || {});
      if (!result.ok) {
        return res.status(result.status || 400).json({ success: false, error: result.error });
      }
      res.json({ success: true, cvs: result.cvs });
    } catch (err) {
      next(err);
    }
  }

  /** GET /api/users/me/verified-competencies — Lấy hồ sơ năng lực đã xác thực */
  static async getVerifiedCompetencies(req, res, next) {
    try {
      const result = await verifiedCompetencyService.getVerifiedCompetencyProfile(req.userId);
      if (!result.ok) {
        return res.status(result.status || 400).json({ success: false, error: result.error });
      }
      res.json({ success: true, profile: result.profile });
    } catch (err) {
      next(err);
    }
  }

  /** POST /api/users/me/verified-competencies/sync — Đồng bộ hoặc làm mới đánh giá năng lực */
  static async syncVerifiedCompetencies(req, res, next) {
    try {
      const sampleIfEmpty = req.body?.sampleIfEmpty !== false;
      const result = await verifiedCompetencyService.syncVerifiedCompetencies(req.userId, { sampleIfEmpty });
      if (!result.ok) {
        return res.status(result.status || 400).json({ success: false, error: result.error });
      }
      res.json({ success: true, profile: result.profile });
    } catch (err) {
      next(err);
    }
  }
}
