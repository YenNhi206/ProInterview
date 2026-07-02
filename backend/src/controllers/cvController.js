import { CVAnalysis } from "../models/CVAnalysis.js";
import { User } from "../models/User.js";
import { validateSaveAnalysis, formatValidationError } from "../dto/cvAnalysis.dto.js";
import { logger } from "../config/logger.js";
import { enforceExpiry } from "../utils/planGuard.js";
import { resolveStoredUploadUrl } from "../utils/resolveStoredUploadUrl.js";

/** cvFileUrl/jdFileUrl lưu DB có thể là path tương đối (/uploads/...) — chuẩn hóa thành URL đầy đủ trước khi trả FE. */
function withResolvedFileUrls(analysis) {
  if (!analysis) return analysis;
  const doc = analysis.toObject ? analysis.toObject() : { ...analysis };
  if (doc.cvFileUrl) doc.cvFileUrl = resolveStoredUploadUrl(doc.cvFileUrl);
  if (doc.jdFileUrl) doc.jdFileUrl = resolveStoredUploadUrl(doc.jdFileUrl);
  return doc;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Normalize skill item: string "React" → { name: "React" } */
function normalizeSkillItem(item) {
  return typeof item === "string" ? { name: item } : item;
}

/**
 * Transform flat frontend payload → nested DB schema.
 *
 * Frontend (DTO-validated):          DB (CVAnalysisResultSchema):
 *   result.matchScore          →      result.match.score
 *   result.matchedKeywords     →      result.match.matchedKeywords
 *   result.missingKeywords     →      result.match.missingKeywords
 *   result.skills.cv[]         →      normalized to { name, category, ... }
 */
function transformToDb(value) {
  const { matchScore, matchedKeywords, missingKeywords, skills, scores, suggestions, _ui } =
    value.result;

  const normalizedSkills = skills
    ? {
        cv:      (skills.cv ?? []).map(normalizeSkillItem),
        jd:      (skills.jd ?? []).map(normalizeSkillItem),
        matched: skills.matched ?? [],
        missing: skills.missing ?? [],
      }
    : undefined;

  const ui = value.result?._ui;
  return {
    cvFileName:  value.cvFileName,
    cvFileId:    value.cvFileId,
    cvFileUrl:   value.cvFileUrl || ui?.cvFileUrl || undefined,
    cvText:      ui?.cvText ? String(ui.cvText).slice(0, 120_000) : undefined,
    jdFileName:  value.jdFileName,
    jdFileId:    value.jdFileId,
    jdFileUrl:   value.jdFileUrl || ui?.jdFileUrl || undefined,
    jdText:      ui?.jdText ? String(ui.jdText).slice(0, 120_000) : undefined,
    field:       value.field || undefined,
    position:    value.position || undefined,
    mode:        value.mode,
    tier:        value.tier,
    planAtTime:  value.planAtTime,
    meta:        value.meta,
    result: {
      ...(normalizedSkills && { skills: normalizedSkills }),
      match: {
        score:           matchScore,
        matchedKeywords: matchedKeywords ?? [],
        missingKeywords: missingKeywords ?? [],
      },
      ...(scores      && { scores }),
      ...(suggestions && { suggestions }),
      ...(_ui         && { _ui }),
    },
  };
}

// ── Controller ────────────────────────────────────────────────────────────────

export const CVController = {
  /** Lấy quota còn lại */
  getQuota: async (req, res) => {
    try {
      let user = await User.findById(req.userId).select("+quota plan planExpiresAt");
      if (!user) return res.status(404).json({ success: false, error: "Người dùng không tồn tại" });

      user = await enforceExpiry(user);
      res.json({ success: true, quota: user.quota });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  },

  /** Lưu bản phân tích CV (kết quả từ Python / FE) */
  createAnalysis: async (req, res) => {
    const userId = req.userId;

    // ── Step 1: Validate schema + business rules qua DTO ──────────────────
    const { error, value, businessErrors } = validateSaveAnalysis(req.body);

    if (error) {
      const details = formatValidationError(error);
      logger.warn("cv_analysis_schema_invalid", { userId, details });
      return res.status(400).json({
        success: false,
        error: "schema_invalid",
        details,
      });
    }

    if (businessErrors) {
      logger.warn("cv_analysis_business_rule_violation", { userId, businessErrors });
      return res.status(400).json({
        success: false,
        error: "business_rule_violation",
        details: businessErrors,
      });
    }

    // ── Step 2: Kiểm tra quota (với auto-downgrade nếu plan hết hạn) ─────
    let user = await User.findById(userId).select("+quota plan planExpiresAt").catch(() => null);
    if (!user) {
      return res.status(404).json({ success: false, error: "Người dùng không tồn tại" });
    }

    user = await enforceExpiry(user);

    // Atomic: chỉ increment nếu used < limit — tránh race condition
    const updatedUser = await User.findOneAndUpdate(
      { _id: userId, "quota.cvAnalysisUsed": { $lt: user.quota?.cvAnalysisLimit ?? 5 } },
      { $inc: { "quota.cvAnalysisUsed": 1 } },
      { new: true }
    );
    if (!updatedUser) {
      logger.warn("cv_analysis_quota_exceeded", {
        userId,
        used:  user.quota?.cvAnalysisUsed,
        limit: user.quota?.cvAnalysisLimit,
      });
      return res.status(403).json({
        success: false,
        error: "quota_exceeded",
        message: "Bạn đã hết lượt phân tích CV. Vui lòng nâng cấp gói.",
      });
    }

    // ── Step 3: Transform payload → DB schema ─────────────────────────────
    const dbPayload = transformToDb(value);

    // ── Step 4: Persist ───────────────────────────────────────────────────
    try {
      const analysis = await CVAnalysis.create({
        userId,
        ...dbPayload,
        status:      "completed",
        completedAt: new Date(),
      });

      logger.info("cv_analysis_created", {
        userId,
        analysisId:  String(analysis._id),
        mode:        analysis.mode,
        tier:        analysis.tier,
        matchScore:  analysis.result?.match?.score,
      });

      return res.status(201).json({ success: true, analysis: withResolvedFileUrls(analysis) });
    } catch (err) {
      // Rollback quota vì CVAnalysis.create thất bại nhưng quota đã bị tăng
      await User.findByIdAndUpdate(userId, { $inc: { "quota.cvAnalysisUsed": -1 } })
        .catch((e) => logger.error("cv_quota_rollback_failed", { userId, error: e.message }));
      logger.error("cv_analysis_create_failed", { userId, error: err.message });
      return res.status(500).json({ success: false, error: err.message });
    }
  },

  /** Danh sách lịch sử */
  list: async (req, res) => {
    try {
      const list = await CVAnalysis.find({ userId: req.userId })
        .sort({ createdAt: -1 })
        .select("-cvText -jdText"); // loại raw text để giảm payload
      res.json({ success: true, list });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  },

  /** Chi tiết 1 bản ghi */
  getAnalysis: async (req, res) => {
    try {
      const analysis = await CVAnalysis.findOne({ _id: req.params.id, userId: req.userId });
      if (!analysis) return res.status(404).json({ success: false, error: "Không tìm thấy" });
      res.json({ success: true, analysis });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  },

  /** Xóa bản ghi */
  deleteAnalysis: async (req, res) => {
    try {
      const deleted = await CVAnalysis.findOneAndDelete({ _id: req.params.id, userId: req.userId });
      if (!deleted) return res.status(404).json({ success: false, error: "Không tìm thấy để xóa" });
      // Hoàn lại 1 lượt quota (chỉ khi used > 0 để tránh âm).
      await User.findOneAndUpdate(
        { _id: req.userId, "quota.cvAnalysisUsed": { $gt: 0 } },
        { $inc: { "quota.cvAnalysisUsed": -1 } },
      ).catch((e) => logger.error("cv_quota_refund_failed", { userId: req.userId, error: e.message }));
      res.json({ success: true, message: "Đã xóa bản phân tích CV" });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  },

  submitFeedback: async (req, res) => {
    try {
      const { rating } = req.body;
      if (!["helpful", "not_helpful"].includes(rating)) {
        return res.status(400).json({ success: false, error: "rating phải là helpful hoặc not_helpful" });
      }
      const doc = await CVAnalysis.findOneAndUpdate(
        { _id: req.params.id, userId: req.userId },
        { "feedback.rating": rating, "feedback.submittedAt": new Date() },
        { new: true, select: "feedback" }
      );
      if (!doc) return res.status(404).json({ success: false, error: "Không tìm thấy" });
      res.json({ success: true, feedback: doc.feedback });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  },
};
