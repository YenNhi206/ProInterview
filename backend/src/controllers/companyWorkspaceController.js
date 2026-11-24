import mongoose from "mongoose";
import {
  QuestionBank,
  hashQuestionText,
  QUESTION_STATUSES,
  COMPANY_REVIEWED_STATUSES,
} from "../models/QuestionBank.js";
import { CompanyRubric } from "../models/CompanyRubric.js";
import { JobPost } from "../models/JobPost.js";
import { assertSameCompany } from "../utils/assertSameCompany.js";
import { isValidCompetencyKey } from "../services/competencyFramework.js";
import { scheduleRubricReview } from "../services/rubricReviewService.js";
import { isValidRoleCategory } from "../services/roleCategories.js";
import { COMPANY_QUESTION_COUNT, generateCompanyQuestionDrafts } from "../services/companyQuestionGenService.js";

/**
 * Quyết định CO-16 (23/11/2026): Company Moderator duyệt xong thì câu chuyển `pending_platform_review`,
 * chưa vào phỏng vấn. Platform Moderator duyệt tiếp mới thành `approved` (CO-16), và video avatar
 * (CO-06) chỉ render lúc đó, nên các thao tác ở đây không xếp hàng render video.
 */
const COMPANY_APPROVED_STATUS = "pending_platform_review";
/** Trạng thái Company Moderator được bấm duyệt: câu nháp, hoặc câu đã từ chối muốn duyệt lại. */
const COMPANY_APPROVABLE_STATUSES = ["draft", "rejected"];

/** Giới hạn một lượt tải câu lên theo job (CO-05). */
export const COMPANY_QUESTION_UPLOAD_MAX = 50;
const QUESTION_TEXT_MAX_LENGTH = 1000;
const QUESTION_LAYERS = ["theory", "project", "behavior"];
const QUESTION_SENIORITIES = ["intern", "junior", "middle", "senior"];

/**
 * Tìm tin tuyển dụng của chính công ty theo id (CO-05). Job công ty khác → 403 (assertSameCompany).
 * @returns {Promise<{ job?: object, status?: number, error?: string }>}
 */
async function findCompanyJob(req, jobPostId) {
  if (!mongoose.isValidObjectId(jobPostId)) {
    return { status: 400, error: "Mã tin tuyển dụng không hợp lệ." };
  }
  const job = await JobPost.findById(jobPostId).select("companyId roleCategory level title").lean();
  if (!job) return { status: 404, error: "Không tìm thấy tin tuyển dụng." };
  assertSameCompany(req, job.companyId);
  return { job };
}

function isDuplicateKeyError(err) {
  return err?.code === 11000;
}

/** Thang mô tả của mỗi tiêu chí rubric: 6 mức 0–5 (CO-07). */
const RUBRIC_LEVELS = ["0", "1", "2", "3", "4", "5"];
const RUBRIC_MAX_CRITERIA = 10;
const RUBRIC_LEVEL_MAX_LENGTH = 500;

/**
 * Chuẩn hóa `criteria` gửi lên khi tạo / sửa rubric (CO-14). Chỉ nhận field của model, kiểm:
 * `shrmKey` thuộc bộ tiêu chí LP-01 (không deprecated), trọng số nguyên 1–100, mô tả mức 0–5,
 * câu áp dụng phải là câu đã duyệt của chính công ty. Mô tả mức được để trống khi soạn nháp;
 * đủ 6 mức mới gửi duyệt được (xem `submitRubric`).
 * @returns {{ criteria?: object[], error?: string }}
 */
async function normalizeRubricCriteria(input, companyId) {
  if (!Array.isArray(input)) return { error: "Danh sách tiêu chí không hợp lệ." };
  if (input.length > RUBRIC_MAX_CRITERIA) return { error: `Rubric tối đa ${RUBRIC_MAX_CRITERIA} tiêu chí.` };

  const criteria = [];
  const allQuestionIds = new Set();
  for (const [i, raw] of input.entries()) {
    const label = `Tiêu chí ${i + 1}`;
    const name = String(raw?.name ?? "").trim();
    if (!name) return { error: `${label}: tên không được để trống.` };
    const weight = Number(raw?.weight);
    if (!Number.isInteger(weight) || weight < 1 || weight > 100) {
      return { error: `${label}: trọng số phải là số nguyên từ 1 đến 100.` };
    }
    const shrmKey = String(raw?.shrmKey ?? "").trim();
    if (!isValidCompetencyKey(shrmKey)) {
      return { error: `${label}: năng lực "${shrmKey}" không có trong bộ tiêu chí SHRM/DDI hoặc đã ngừng dùng.` };
    }
    const levels = {};
    for (const level of RUBRIC_LEVELS) {
      const text = String(raw?.levels?.[level] ?? "").trim();
      if (text.length > RUBRIC_LEVEL_MAX_LENGTH) {
        return { error: `${label}: mô tả mức ${level} tối đa ${RUBRIC_LEVEL_MAX_LENGTH} ký tự.` };
      }
      levels[level] = text;
    }
    const questionIds = [...new Set((raw?.questionIds ?? []).map(String))];
    if (questionIds.some((id) => !mongoose.isValidObjectId(id))) return { error: `${label}: mã câu hỏi không hợp lệ.` };
    questionIds.forEach((id) => allQuestionIds.add(id));
    criteria.push({ name, weight, shrmKey, description: String(raw?.description ?? "").trim(), levels, questionIds });
  }

  if (allQuestionIds.size) {
    // Câu Company Mod đã duyệt, kể cả đang chờ Platform Mod (CO-16); câu chưa `approved` chưa vào phỏng vấn.
    const owned = await QuestionBank.countDocuments({
      _id: { $in: [...allQuestionIds] },
      orgId: companyId,
      status: { $in: COMPANY_REVIEWED_STATUSES },
    });
    if (owned !== allQuestionIds.size) {
      return { error: "Chỉ gắn được câu hỏi đã duyệt của công ty bạn." };
    }
  }
  return { criteria };
}

/** Mức chưa có mô tả của từng tiêu chí — rubric chỉ gửi duyệt khi danh sách này rỗng. */
function missingLevelDescriptions(criteria = []) {
  const missing = [];
  criteria.forEach((c, i) => {
    const levels = c.levels instanceof Map ? Object.fromEntries(c.levels) : c.levels || {};
    const empty = RUBRIC_LEVELS.filter((l) => !String(levels[l] ?? "").trim());
    if (empty.length) missing.push(`tiêu chí ${i + 1} (mức ${empty.join(", ")})`);
  });
  return missing;
}

// Đề xuất (l) trong TASKS.md: roleCategory và key năng lực của câu hỏi / rubric công ty phải nằm trong danh sách chung
// (`config/roleCategories.json`, `config/competencies.json`) để luyện theo job (JB-06), chấm rubric (JB-07)
// và hồ sơ năng lực (PR-06) tra được.
const ROLE_CATEGORY_ERROR = "Vị trí (roleCategory) không có trong danh sách nhóm vị trí (GET /api/role-categories).";
const COMPETENCY_ERROR = "Mã năng lực không có trong bộ tiêu chí SHRM/DDI (GET /api/competencies).";

/**
 * Lỗi key năng lực đầu tiên của tiêu chí rubric đã lưu, hoặc "". Tạo / sửa đã kiểm trong
 * `normalizeRubricCriteria` (CO-14); hàm này chặn gửi duyệt rubric cũ lưu key sai trước khi có kiểm tra.
 */
function rubricCriteriaError(criteria) {
  if (!Array.isArray(criteria)) return "";
  const bad = criteria.find((c) => !isValidCompetencyKey(String(c?.shrmKey ?? "").trim()));
  return bad ? `Tiêu chí "${bad?.name || "?"}": ${COMPETENCY_ERROR}` : "";
}

export const CompanyWorkspaceController = {
  // Lấy thông tin công ty hiện tại của user
  async getProfile(req, res) {
    return res.json({
      success: true,
      company: req.company,
    });
  },

  // Dashboard tóm tắt cho Company Moderator
  async getDashboardStats(req, res) {
    const companyId = req.companyId;

    const [questionsTotal, questionsApproved, questionsDraft, questionsPendingPlatform, rubricsApproved, rubricsPending] =
      await Promise.all([
        QuestionBank.countDocuments({ orgId: companyId }),
        QuestionBank.countDocuments({ orgId: companyId, status: "approved" }),
        QuestionBank.countDocuments({ orgId: companyId, status: "draft" }),
        QuestionBank.countDocuments({ orgId: companyId, status: COMPANY_APPROVED_STATUS }),
        CompanyRubric.countDocuments({ companyId, status: "approved" }),
        CompanyRubric.countDocuments({ companyId, status: "pending_review" }),
      ]);

    return res.json({
      success: true,
      stats: {
        questions: {
          total: questionsTotal,
          approved: questionsApproved,
          draft: questionsDraft,
          pendingPlatformReview: questionsPendingPlatform,
        },
        rubrics: {
          approved: rubricsApproved,
          pending: rubricsPending,
        },
      },
    });
  },

  // ===== CO-05: Quản lý ngân hàng câu hỏi công ty =====
  async listQuestions(req, res) {
    const companyId = req.companyId;
    const { status, roleCategory, jobPostId, page = 1, limit = 50 } = req.query;

    const filter = { orgId: companyId };
    if (status) {
      if (!QUESTION_STATUSES.includes(status)) {
        return res.status(400).json({ success: false, error: "Trạng thái câu hỏi không hợp lệ." });
      }
      filter.status = status;
    }
    if (roleCategory) filter.roleCategory = roleCategory;
    // CO-05: lọc theo job; `jobPostId=none` lấy câu không gắn job.
    if (jobPostId === "none") {
      filter.jobPostId = null;
    } else if (jobPostId) {
      if (!mongoose.isValidObjectId(jobPostId)) {
        return res.status(400).json({ success: false, error: "Mã tin tuyển dụng không hợp lệ." });
      }
      filter.jobPostId = jobPostId;
    }

    const p = Math.max(1, Number(page) || 1);
    const l = Math.min(100, Math.max(1, Number(limit) || 50));

    const [items, total] = await Promise.all([
      QuestionBank.find(filter)
        .sort({ updatedAt: -1 })
        .skip((p - 1) * l)
        .limit(l)
        .lean(),
      QuestionBank.countDocuments(filter),
    ]);

    return res.json({
      success: true,
      questions: items,
      pagination: { page: p, limit: l, total },
    });
  },

  async createQuestion(req, res) {
    const companyId = req.companyId;
    const {
      competencyId = "technical_learning",
      layer = "project",
      seniority = "middle",
      // Tự thêm thì coi như công ty đã duyệt → chờ Platform Mod (CO-16); gửi "draft" để lưu nháp.
      status,
    } = req.body;

    const cleanText = (req.body.text || req.body.questionText || req.body.question || "").trim();
    if (!cleanText) {
      return res.status(400).json({ success: false, error: "Nội dung câu hỏi không được để trống." });
    }

    let job = null;
    if (req.body.jobPostId) {
      const found = await findCompanyJob(req, req.body.jobPostId);
      if (found.error) return res.status(found.status).json({ success: false, error: found.error });
      job = found.job;
    }
    const roleCategory = req.body.roleCategory || job?.roleCategory || "software_engineer";
    if (!isValidRoleCategory(roleCategory)) {
      return res.status(400).json({ success: false, error: ROLE_CATEGORY_ERROR });
    }
    if (!isValidCompetencyKey(competencyId)) {
      return res.status(400).json({ success: false, error: COMPETENCY_ERROR });
    }

    const textHash = hashQuestionText(cleanText);
    const existing = await QuestionBank.findOne({ textHash, orgId: companyId });
    if (existing) {
      return res.status(409).json({ success: false, error: "Câu hỏi này đã tồn tại trong bộ câu hỏi của công ty." });
    }

    const question = await QuestionBank.create({
      text: cleanText,
      originalText: cleanText,
      textHash,
      orgId: companyId,
      jobPostId: job?._id ?? null,
      source: "org_template",
      roleCategory,
      competencyId,
      layer,
      seniority,
      status: status === "draft" ? "draft" : COMPANY_APPROVED_STATUS,
      moderation: {
        reviewedBy: req.userId,
        reviewedAt: new Date(),
        reason: "Tạo trực tiếp bởi Company Moderator",
      },
      history: [
        {
          action: "create",
          actorId: req.userId,
          reason: "Tạo mới bởi Company Moderator",
          at: new Date(),
        },
      ],
    });

    return res.status(201).json({ success: true, question });
  },

  /**
   * CO-05: tải lên hàng loạt câu của công ty cho một job.
   * Body `{ jobPostId, questions: [string | { text, competencyId?, layer?, seniority? }], status? }`.
   * Câu trùng `textHash` với câu đã có của công ty (mọi trạng thái) hoặc trùng nhau trong lượt thì bỏ qua.
   * Một dòng sai thì từ chối cả lượt (không lưu gì) và trả danh sách lỗi theo dòng.
   */
  async uploadQuestions(req, res) {
    const companyId = req.companyId;
    const { jobPostId, questions, status } = req.body ?? {};
    if (!jobPostId) {
      return res.status(400).json({ success: false, error: "Vui lòng chọn tin tuyển dụng." });
    }
    const found = await findCompanyJob(req, jobPostId);
    if (found.error) return res.status(found.status).json({ success: false, error: found.error });
    const { job } = found;

    if (!Array.isArray(questions) || questions.length === 0) {
      return res.status(400).json({ success: false, error: "Danh sách câu hỏi không được để trống." });
    }
    if (questions.length > COMPANY_QUESTION_UPLOAD_MAX) {
      return res.status(400).json({
        success: false,
        error: `Mỗi lượt tải lên tối đa ${COMPANY_QUESTION_UPLOAD_MAX} câu.`,
      });
    }
    if (!isValidRoleCategory(job.roleCategory)) {
      return res.status(400).json({ success: false, error: ROLE_CATEGORY_ERROR });
    }

    const rows = [];
    const errors = [];
    questions.forEach((raw, i) => {
      const item = typeof raw === "string" ? { text: raw } : raw ?? {};
      const text = String(item.text ?? item.question ?? "").trim();
      const competencyId = String(item.competencyId ?? "").trim() || "technical_learning";
      const line = i + 1;
      if (!text) return errors.push({ line, error: "Nội dung câu hỏi không được để trống." });
      if (text.length > QUESTION_TEXT_MAX_LENGTH) {
        return errors.push({ line, error: `Câu hỏi tối đa ${QUESTION_TEXT_MAX_LENGTH} ký tự.` });
      }
      if (!isValidCompetencyKey(competencyId)) return errors.push({ line, error: COMPETENCY_ERROR });
      const layer = QUESTION_LAYERS.includes(item.layer) ? item.layer : "project";
      const seniority = QUESTION_SENIORITIES.includes(item.seniority)
        ? item.seniority
        : QUESTION_SENIORITIES.includes(job.level) ? job.level : "middle";
      rows.push({ text, competencyId, layer, seniority, textHash: hashQuestionText(text) });
    });
    if (errors.length) {
      return res.status(400).json({ success: false, error: "Có câu hỏi không hợp lệ, chưa lưu câu nào.", errors });
    }

    // Bỏ câu trùng trong lượt rồi trùng với câu đã có của công ty (unique index { textHash, orgId }).
    const seen = new Set();
    const unique = rows.filter((r) => (seen.has(r.textHash) ? false : seen.add(r.textHash)));
    const existing = await QuestionBank.find({ orgId: companyId, textHash: { $in: unique.map((r) => r.textHash) } })
      .select("textHash")
      .lean();
    const existingHashes = new Set(existing.map((q) => q.textHash));
    const toCreate = unique.filter((r) => !existingHashes.has(r.textHash));

    const finalStatus = status === "draft" ? "draft" : COMPANY_APPROVED_STATUS;
    const now = new Date();
    const created = [];
    for (const r of toCreate) {
      try {
        created.push(
          await QuestionBank.create({
            text: r.text,
            originalText: r.text,
            textHash: r.textHash,
            orgId: companyId,
            jobPostId: job._id,
            source: "org_template",
            roleCategory: job.roleCategory,
            competencyId: r.competencyId,
            layer: r.layer,
            seniority: r.seniority,
            status: finalStatus,
            createdBy: req.userId,
            moderation:
              finalStatus === "draft"
                ? { reason: "Tải lên theo job" }
                : { reviewedBy: req.userId, reviewedAt: now, reason: "Company Moderator tải lên theo job" },
            history: [{ action: "create", actorId: req.userId, reason: `Tải lên cho job "${job.title}"`, at: now }],
          }),
        );
      } catch (err) {
        // Hai lượt tải song song cùng câu: lượt sau đụng unique index → tính là câu trùng.
        if (!isDuplicateKeyError(err)) throw err;
      }
    }

    const skippedDuplicates = rows.length - created.length;
    const skipped = skippedDuplicates ? ` Bỏ qua ${skippedDuplicates} câu trùng với câu đã có.` : "";
    const waiting = finalStatus === COMPANY_APPROVED_STATUS ? ", chờ Platform Moderator duyệt" : " ở trạng thái nháp";
    return res.status(201).json({
      success: true,
      message: `Đã tải lên ${created.length} câu cho job "${job.title}"${waiting}.${skipped}`,
      count: created.length,
      skippedDuplicates,
      questions: created,
    });
  },

  async editQuestion(req, res) {
    const question = await QuestionBank.findById(req.params.id);
    if (!question) {
      return res.status(404).json({ success: false, error: "Không tìm thấy câu hỏi." });
    }

    assertSameCompany(req, question.orgId);

    const { difficulty, roleCategory, competencyId, reason } = req.body;
    const cleanText = (req.body.text || req.body.questionText || req.body.question || "").trim();
    const previousQuestion = question.text;
    const textChanged = Boolean(cleanText) && cleanText !== question.text;

    if (roleCategory && !isValidRoleCategory(roleCategory)) {
      return res.status(400).json({ success: false, error: ROLE_CATEGORY_ERROR });
    }
    if (competencyId && !isValidCompetencyKey(competencyId)) {
      return res.status(400).json({ success: false, error: COMPETENCY_ERROR });
    }

    // CO-05: đổi job của câu (`null` hoặc "" = bỏ gắn job).
    if (req.body.jobPostId !== undefined) {
      if (!req.body.jobPostId) {
        question.jobPostId = null;
      } else {
        const found = await findCompanyJob(req, req.body.jobPostId);
        if (found.error) return res.status(found.status).json({ success: false, error: found.error });
        question.jobPostId = found.job._id;
      }
    }

    if (textChanged) {
      const textHash = hashQuestionText(cleanText);
      const duplicate = await QuestionBank.exists({ orgId: question.orgId, textHash, _id: { $ne: question._id } });
      if (duplicate) {
        return res.status(409).json({ success: false, error: "Câu hỏi này đã tồn tại trong bộ câu hỏi của công ty." });
      }
      question.text = cleanText;
      question.textHash = textHash;
      // Platform Mod duyệt nội dung (CO-16): đổi chữ câu đã duyệt thì phải duyệt lại.
      if (question.status === "approved") question.status = COMPANY_APPROVED_STATUS;
    }

    if (difficulty) question.difficulty = difficulty;
    if (roleCategory) question.roleCategory = roleCategory;
    if (competencyId) question.competencyId = competencyId;

    question.history.push({
      action: "edit",
      actorId: req.userId,
      reason: reason || "Chỉnh sửa bởi Company Moderator",
      previousQuestion,
      at: new Date(),
    });

    await question.save();
    return res.json({ success: true, message: "Cập nhật câu hỏi thành công.", question });
  },

  async approveQuestion(req, res) {
    const question = await QuestionBank.findById(req.params.id);
    if (!question) {
      return res.status(404).json({ success: false, error: "Không tìm thấy câu hỏi." });
    }

    assertSameCompany(req, question.orgId);

    if (!COMPANY_APPROVABLE_STATUSES.includes(question.status)) {
      return res.status(409).json({
        success: false,
        error: question.status === "approved"
          ? "Câu hỏi đã được Platform Moderator duyệt."
          : "Câu hỏi đã được duyệt, đang chờ Platform Moderator duyệt.",
      });
    }

    question.status = COMPANY_APPROVED_STATUS;
    question.moderation = {
      reviewedBy: req.userId,
      reviewedAt: new Date(),
      reason: req.body?.reason || "Duyệt bởi Company Moderator",
    };
    question.history.push({
      action: "approve",
      actorId: req.userId,
      reason: req.body?.reason || "Duyệt bởi Company Moderator",
      at: new Date(),
    });

    await question.save();
    return res.json({ success: true, message: "Đã duyệt câu hỏi, chờ Platform Moderator duyệt.", question });
  },

  async rejectQuestion(req, res) {
    const question = await QuestionBank.findById(req.params.id);
    if (!question) {
      return res.status(404).json({ success: false, error: "Không tìm thấy câu hỏi." });
    }

    assertSameCompany(req, question.orgId);

    question.status = "rejected";
    question.moderation = {
      reviewedBy: req.userId,
      reviewedAt: new Date(),
      reason: req.body?.reason || "Từ chối bởi Company Moderator",
    };
    question.history.push({
      action: "reject",
      actorId: req.userId,
      reason: req.body?.reason || "Từ chối bởi Company Moderator",
      at: new Date(),
    });

    await question.save();
    return res.json({ success: true, message: "Đã từ chối câu hỏi.", question });
  },

  // CO-04: AI sinh bộ 8–12 câu nháp theo roleCategory (quyết định 11)
  async generateQuestions(req, res) {
    const roleCategory = req.body?.roleCategory;
    if (!isValidRoleCategory(roleCategory)) {
      return res.status(400).json({ success: false, error: ROLE_CATEGORY_ERROR });
    }
    const { min, max } = COMPANY_QUESTION_COUNT;
    const count = req.body?.count === undefined ? COMPANY_QUESTION_COUNT.default : Number(req.body.count);
    if (!Number.isInteger(count) || count < min || count > max) {
      return res.status(400).json({ success: false, error: `Số câu cần sinh phải là số nguyên từ ${min} đến ${max}.` });
    }

    try {
      const result = await generateCompanyQuestionDrafts({
        companyId: req.companyId, roleCategory, count, userId: req.userId,
      });
      const n = result.questions.length;
      const skipped = result.skippedDuplicates ? ` Bỏ qua ${result.skippedDuplicates} câu trùng với câu đã có.` : "";
      return res.status(201).json({
        success: true,
        message: `Đã sinh ${n} câu hỏi nháp, chờ bạn duyệt.${skipped}`,
        count: n,
        skippedDuplicates: result.skippedDuplicates,
        promptVersion: result.promptVersion,
        questions: result.questions,
      });
    } catch (err) {
      // 502/503 tự trả thông báo riêng: errorHandler ở production đổi lỗi 5xx thành câu chung.
      if ([400, 502, 503].includes(err?.status)) {
        return res.status(err.status).json({ success: false, error: err.message });
      }
      throw err;
    }
  },

  // Duyệt hàng loạt câu hỏi
  async batchApproveQuestions(req, res) {
    const companyId = req.companyId;
    const { ids = [], reason = "Duyệt hàng loạt bởi Company Moderator" } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ success: false, error: "Vui lòng chọn ít nhất một câu hỏi." });
    }

    if (ids.some((id) => !mongoose.isValidObjectId(id))) {
      return res.status(400).json({ success: false, error: "Mã câu hỏi không hợp lệ." });
    }

    // Chỉ chuyển câu nháp / đã từ chối; câu đã duyệt (kể cả Platform Mod đã duyệt) giữ nguyên.
    const result = await QuestionBank.updateMany(
      { _id: { $in: ids }, orgId: companyId, status: { $in: COMPANY_APPROVABLE_STATUSES } },
      {
        $set: {
          status: COMPANY_APPROVED_STATUS,
          "moderation.reviewedBy": req.userId,
          "moderation.reviewedAt": new Date(),
          "moderation.reason": reason,
        },
        $push: {
          history: {
            action: "approve",
            actorId: req.userId,
            reason,
            at: new Date(),
          },
        },
      }
    );
    return res.json({
      success: true,
      message: `Đã duyệt ${result.modifiedCount} câu hỏi, chờ Platform Moderator duyệt.`,
      modifiedCount: result.modifiedCount,
    });
  },

  // Từ chối hàng loạt câu hỏi
  async batchRejectQuestions(req, res) {
    const companyId = req.companyId;
    const { ids = [], reason = "Từ chối hàng loạt bởi Company Moderator" } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ success: false, error: "Vui lòng chọn ít nhất một câu hỏi." });
    }
    if (ids.some((id) => !mongoose.isValidObjectId(id))) {
      return res.status(400).json({ success: false, error: "Mã câu hỏi không hợp lệ." });
    }

    const result = await QuestionBank.updateMany(
      { _id: { $in: ids }, orgId: companyId },
      {
        $set: {
          status: "rejected",
          "moderation.reviewedBy": req.userId,
          "moderation.reviewedAt": new Date(),
          "moderation.reason": reason,
        },
        $push: {
          history: {
            action: "reject",
            actorId: req.userId,
            reason,
            at: new Date(),
          },
        },
      }
    );

    return res.json({
      success: true,
      message: `Đã từ chối ${result.modifiedCount} câu hỏi.`,
      modifiedCount: result.modifiedCount,
    });
  },

  // ===== CO-07: Quản lý Rubric đánh giá =====
  async listRubrics(req, res) {
    const companyId = req.companyId;
    const { roleCategory, status } = req.query;

    const filter = { companyId };
    if (roleCategory) filter.roleCategory = roleCategory;
    if (status) filter.status = status;

    const rubrics = await CompanyRubric.find(filter)
      .sort({ updatedAt: -1 })
      .lean();

    return res.json({ success: true, rubrics });
  },

  async getRubricById(req, res) {
    const rubric = await CompanyRubric.findById(req.params.id).lean();
    if (!rubric) {
      return res.status(404).json({ success: false, error: "Không tìm thấy rubric." });
    }

    assertSameCompany(req, rubric.companyId);
    return res.json({ success: true, rubric });
  },

  async createRubric(req, res) {
    const companyId = req.companyId;
    const { title, roleCategory, description = "", criteria = [] } = req.body;

    if (!title || !title.trim()) {
      return res.status(400).json({ success: false, error: "Tiêu đề rubric không được để trống." });
    }
    if (!roleCategory || !roleCategory.trim()) {
      return res.status(400).json({ success: false, error: "Vị trí ứng tuyển (roleCategory) không được để trống." });
    }
    if (!isValidRoleCategory(roleCategory.trim())) {
      return res.status(400).json({ success: false, error: ROLE_CATEGORY_ERROR });
    }

    // Đếm version cho roleCategory này
    const maxVersionDoc = await CompanyRubric.findOne({ companyId, roleCategory })
      .sort({ version: -1 })
      .select("version")
      .lean();

    const nextVersion = (maxVersionDoc?.version || 0) + 1;

    const normalized = await normalizeRubricCriteria(criteria, companyId);
    if (normalized.error) return res.status(400).json({ success: false, error: normalized.error });

    const rubric = await CompanyRubric.create({
      companyId,
      title: title.trim(),
      roleCategory: roleCategory.trim(),
      description: description.trim(),
      version: nextVersion,
      status: "draft",
      criteria: normalized.criteria,
      createdBy: req.userId,
    });

    return res.status(201).json({ success: true, rubric });
  },

  async updateRubric(req, res) {
    const rubric = await CompanyRubric.findById(req.params.id);
    if (!rubric) {
      return res.status(404).json({ success: false, error: "Không tìm thấy rubric." });
    }

    assertSameCompany(req, rubric.companyId);

    if (rubric.status === "approved" || rubric.status === "archived") {
      return res.status(400).json({
        success: false,
        error: "Không thể chỉnh sửa rubric đã duyệt hoặc đã lưu trữ. Hãy tạo một bản nháp phiên bản mới.",
      });
    }

    if (rubric.status === "pending_review") {
      return res.status(409).json({ success: false, error: "Rubric đang chờ Platform Moderator duyệt, chưa sửa được." });
    }

    const { title, description, criteria } = req.body;
    if (title && title.trim()) rubric.title = title.trim();
    if (description !== undefined) rubric.description = description;
    if (criteria !== undefined) {
      const normalized = await normalizeRubricCriteria(criteria, rubric.companyId);
      if (normalized.error) return res.status(400).json({ success: false, error: normalized.error });
      rubric.criteria = normalized.criteria;
    }

    await rubric.save();
    return res.json({ success: true, message: "Cập nhật rubric thành công.", rubric });
  },

  /**
   * CO-07: Gửi duyệt rubric.
   * Yêu cầu:
   *   1. Có ít nhất 1 tiêu chí
   *   2. Tổng trọng số các tiêu chí phải chính xác bằng 100%
   *   3. Không tạo ModerationItem (để không lọt vào hàng đợi HITL phỏng vấn)
   */
  async submitRubric(req, res) {
    const rubric = await CompanyRubric.findById(req.params.id);
    if (!rubric) {
      return res.status(404).json({ success: false, error: "Không tìm thấy rubric." });
    }

    assertSameCompany(req, rubric.companyId);

    if (!["draft", "rejected"].includes(rubric.status)) {
      return res.status(409).json({ success: false, error: "Chỉ gửi duyệt được rubric bản nháp hoặc bị từ chối." });
    }

    if (!rubric.criteria || rubric.criteria.length === 0) {
      return res.status(400).json({
        success: false,
        error: "Rubric phải có ít nhất một tiêu chí đánh giá.",
      });
    }

    // Rubric soạn trước khi có kiểm tra key (dữ liệu cũ) cũng phải sửa key trước khi gửi duyệt.
    const submitCriteriaError = rubricCriteriaError(rubric.criteria);
    if (submitCriteriaError) return res.status(400).json({ success: false, error: submitCriteriaError });

    const totalWeight = rubric.criteria.reduce((sum, c) => sum + (Number(c.weight) || 0), 0);
    if (totalWeight !== 100) {
      return res.status(400).json({
        success: false,
        error: `Tổng trọng số các tiêu chí phải bằng 100% (hiện tại: ${totalWeight}%).`,
      });
    }

    const missing = missingLevelDescriptions(rubric.criteria);
    if (missing.length) {
      return res.status(400).json({
        success: false,
        error: `Cần mô tả đủ 6 mức (0–5) cho mỗi tiêu chí trước khi gửi duyệt. Còn thiếu: ${missing.join("; ")}.`,
      });
    }

    rubric.status = "pending_review";
    await rubric.save();
    // CO-09: AI kiểm tra rubric cho Platform Moderator, chạy nền, không chặn gửi duyệt.
    scheduleRubricReview(rubric._id, req.userId);

    return res.json({
      success: true,
      message: "Đã gửi rubric lên kiểm duyệt viên nền tảng phê duyệt.",
      rubric,
    });
  },
};
