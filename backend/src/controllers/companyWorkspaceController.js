import mongoose from "mongoose";
import { QuestionBank, hashQuestionText } from "../models/QuestionBank.js";
import { CompanyRubric } from "../models/CompanyRubric.js";
import { assertSameCompany } from "../utils/assertSameCompany.js";
import { isValidCompetencyKey } from "../services/competencyFramework.js";
import { isValidRoleCategory } from "../services/roleCategories.js";
import { COMPANY_QUESTION_COUNT, generateCompanyQuestionDrafts } from "../services/companyQuestionGenService.js";

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
    const owned = await QuestionBank.countDocuments({ _id: { $in: [...allQuestionIds] }, orgId: companyId, status: "approved" });
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

    const [questionsTotal, questionsApproved, questionsDraft, rubricsApproved, rubricsPending] =
      await Promise.all([
        QuestionBank.countDocuments({ orgId: companyId }),
        QuestionBank.countDocuments({ orgId: companyId, status: "approved" }),
        QuestionBank.countDocuments({ orgId: companyId, status: "draft" }),
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
    const { status, roleCategory, page = 1, limit = 50 } = req.query;

    const filter = { orgId: companyId };
    if (status) filter.status = status;
    if (roleCategory) filter.roleCategory = roleCategory;

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
      questionText,
      roleCategory = "software_engineer",
      competencyId = "technical_learning",
      layer = "project",
      seniority = "middle",
      difficulty = "medium",
      status = "approved", // Tự thêm thì mặc định duyệt luôn cho công ty
      sampleAnswer = "",
      keyPoints = [],
    } = req.body;

    const cleanText = (req.body.text || req.body.questionText || req.body.question || "").trim();
    if (!cleanText) {
      return res.status(400).json({ success: false, error: "Nội dung câu hỏi không được để trống." });
    }
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
      source: "org_template",
      roleCategory,
      competencyId,
      layer,
      seniority,
      status: ["approved", "draft"].includes(status) ? status : "approved",
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

  async editQuestion(req, res) {
    const question = await QuestionBank.findById(req.params.id);
    if (!question) {
      return res.status(404).json({ success: false, error: "Không tìm thấy câu hỏi." });
    }

    assertSameCompany(req, question.orgId);

    const { difficulty, roleCategory, competencyId, reason } = req.body;
    const cleanText = (req.body.text || req.body.questionText || req.body.question || "").trim();
    const previousQuestion = question.text;

    if (cleanText && cleanText !== question.text) {
      question.text = cleanText;
      question.textHash = hashQuestionText(question.text);
    }

    if (roleCategory && !isValidRoleCategory(roleCategory)) {
      return res.status(400).json({ success: false, error: ROLE_CATEGORY_ERROR });
    }
    if (competencyId && !isValidCompetencyKey(competencyId)) {
      return res.status(400).json({ success: false, error: COMPETENCY_ERROR });
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

    question.status = "approved";
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
    return res.json({ success: true, message: "Đã duyệt câu hỏi.", question });
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

  // Sinh bộ câu hỏi mẫu khởi đầu cho roleCategory
  async generateStarterQuestions(req, res) {
    const companyId = req.companyId;
    const roleCategory = req.body.roleCategory || "software_engineer";
    if (!isValidRoleCategory(roleCategory)) {
      return res.status(400).json({ success: false, error: ROLE_CATEGORY_ERROR });
    }

    const STARTER_TEMPLATES = {
      software_engineer: [
        { text: "Hãy mô tả một kiến trúc hệ thống hoặc module phức tạp bạn từng thiết kế và triển khai từ đầu.", competencyId: "technical_learning", layer: "system", seniority: "middle" },
        { text: "Kể về một sự cố production nghiêm trọng mà bạn từng điều tra và khắc phục. Bạn đã xử lý và rút ra biện pháp phòng ngừa ra sao?", competencyId: "problem_solving", layer: "project", seniority: "middle" },
        { text: "Bạn tiếp cận việc tối ưu hóa hiệu năng (database queries, network latency, caching) trong một ứng dụng có lưu lượng cao như thế nào?", competencyId: "technical_learning", layer: "technical", seniority: "middle" },
        { text: "Kể về lần bạn có bất đồng quan điểm kỹ thuật với Tech Lead hoặc thành viên trong nhóm về giải pháp triển khai.", competencyId: "teamwork", layer: "behavioral", seniority: "middle" },
        { text: "Bạn thực hiện quy trình CI/CD và đảm bảo chất lượng code (Unit test, Integration test, Code review) trong dự án như thế nào?", competencyId: "planning_execution", layer: "technical", seniority: "middle" },
      ],
      frontend: [
        { text: "Bạn quản lý state trong ứng dụng frontend quy mô lớn như thế nào? Khi nào nên dùng local state, context hay global store?", competencyId: "technical_learning", layer: "technical", seniority: "middle" },
        { text: "Hãy kể về lần bạn tối ưu hiệu năng Web Vitals (FCP, LCP, CLS) hoặc dung lượng bundle cho một trang web.", competencyId: "problem_solving", layer: "technical", seniority: "middle" },
        { text: "Cách bạn tổ chức Design System hoặc bộ UI components tái sử dụng để bảo đảm tính nhất quán và dễ mở rộng?", competencyId: "planning_execution", layer: "system", seniority: "middle" },
        { text: "Làm thế nào để xử lý các vấn đề cross-browser compatibility, responsive và accessibility (a11y) trong dự án?", competencyId: "customer_focus", layer: "technical", seniority: "middle" },
        { text: "Kể về một tình huống bạn phải phối hợp chặt chẽ với UI/UX designer và backend engineer để hoàn thiện một tính năng phức tạp.", competencyId: "teamwork", layer: "behavioral", seniority: "middle" },
      ],
      backend: [
        { text: "Hãy giải thích cách bạn thiết kế RESTful hoặc GraphQL API bảo đảm tính bảo mật, phân quyền, và idempotency.", competencyId: "technical_learning", layer: "system", seniority: "middle" },
        { text: "Bạn xử lý vấn đề data consistency và race condition trong hệ thống phân tán hoặc transaction nhiều bảng/microservices ra sao?", competencyId: "problem_solving", layer: "technical", seniority: "senior" },
        { text: "Kể về chiến lược đánh index và tối ưu truy vấn cơ sở dữ liệu (SQL hoặc NoSQL) cho bảng có hàng chục triệu bản ghi.", competencyId: "technical_learning", layer: "technical", seniority: "middle" },
        { text: "Bạn đã từng triển khai caching (Redis, Memcached) như thế nào để giảm tải cho DB mà không gặp lỗi cache stampede hay stale data?", competencyId: "planning_execution", layer: "system", seniority: "middle" },
        { text: "Kể về một lần bạn xử lý lỗ hổng bảo mật (ví dụ injection, auth bypass, rate limit) và bảo vệ dịch vụ backend.", competencyId: "integrity", layer: "technical", seniority: "middle" },
      ],
      fullstack: [
        { text: "Mô tả kiến trúc luồng dữ liệu end-to-end từ giao diện người dùng đến database trong sản phẩm gần nhất của bạn.", competencyId: "technical_learning", layer: "system", seniority: "middle" },
        { text: "Kể về một tính năng phức tạp bạn tự mình làm từ UI/UX, API backend, migration database đến deploy.", competencyId: "planning_execution", layer: "project", seniority: "middle" },
        { text: "Bạn cân bằng thế nào giữa việc chọn giải pháp nhanh để kịp deadline với kiến trúc lâu dài dễ bảo trì?", competencyId: "adaptability", layer: "behavioral", seniority: "middle" },
        { text: "Khi gặp lỗi chỉ xuất hiện trên môi trường production, bạn phối hợp debug giữa frontend log và backend telemetry ra sao?", competencyId: "problem_solving", layer: "technical", seniority: "middle" },
        { text: "Bạn thiết kế kiến trúc xác thực (JWT, session cookie, OAuth2/SSO) cho toàn bộ hệ thống web và mobile như thế nào?", competencyId: "technical_learning", layer: "system", seniority: "middle" },
      ],
      devops: [
        { text: "Hãy mô tả đường ống CI/CD tự động hóa bạn đã xây dựng: từ linting, testing, docker build đến automated rollout.", competencyId: "planning_execution", layer: "system", seniority: "middle" },
        { text: "Kể về kinh nghiệm thiết lập hệ thống giám sát và cảnh báo (Prometheus, Grafana, ELK, Sentry) để phát hiện sự cố sớm.", competencyId: "problem_solving", layer: "technical", seniority: "middle" },
        { text: "Bạn quản lý hạ tầng theo mã (IaC - Terraform, Ansible, Pulumi) và state file như thế nào để an toàn?", competencyId: "technical_learning", layer: "technical", seniority: "middle" },
        { text: "Kể về lần hệ thống bị quá tải hoặc downtime, bạn đã phối hợp phục hồi (disaster recovery) và RCA ra sao?", competencyId: "adaptability", layer: "behavioral", seniority: "middle" },
        { text: "Cách bạn bảo vệ các secrets, credentials và quản lý chính sách mạng (VPC, Security Groups, IAM) trên cloud?", competencyId: "integrity", layer: "system", seniority: "middle" },
      ],
    };

    const templates = STARTER_TEMPLATES[roleCategory] || STARTER_TEMPLATES.software_engineer;
    const created = [];

    for (const t of templates) {
      const textHash = hashQuestionText(t.text);
      const exists = await QuestionBank.findOne({ textHash, orgId: companyId });
      if (!exists) {
        const doc = await QuestionBank.create({
          text: t.text,
          originalText: t.text,
          textHash,
          orgId: companyId,
          source: "org_template",
          roleCategory,
          competencyId: t.competencyId,
          layer: t.layer,
          seniority: t.seniority,
          status: "draft",
          moderation: {
            reason: "Sinh từ bộ câu hỏi mẫu",
          },
          history: [
            {
              action: "create",
              actorId: req.userId,
              reason: "Sinh tự động từ bộ câu hỏi mẫu",
              at: new Date(),
            },
          ],
        });
        created.push(doc);
      }
    }

    return res.json({
      success: true,
      message: `Đã sinh thành công ${created.length} câu hỏi mới dạng bản nháp (draft).`,
      count: created.length,
      questions: created,
    });
  },

  // Duyệt hàng loạt câu hỏi
  async batchApproveQuestions(req, res) {
    const companyId = req.companyId;
    const { ids = [], reason = "Duyệt hàng loạt bởi Company Moderator" } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ success: false, error: "Vui lòng chọn ít nhất một câu hỏi." });
    }

    const result = await QuestionBank.updateMany(
      { _id: { $in: ids }, orgId: companyId },
      {
        $set: {
          status: "approved",
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
      message: `Đã duyệt thành công ${result.modifiedCount} câu hỏi.`,
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

    return res.json({
      success: true,
      message: "Đã gửi rubric lên kiểm duyệt viên nền tảng phê duyệt.",
      rubric,
    });
  },
};
