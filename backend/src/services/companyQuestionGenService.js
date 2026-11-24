/**
 * CO-04 (quyết định 11): AI sinh bộ 8–12 câu nháp cho một nhóm vị trí của công ty.
 *
 * Câu lưu vào QuestionBank với `orgId = companyId`, `source: "org_template"`, `status: "draft"`,
 * `provenance.promptVersion` = version prompt thực sự chạy. Company Moderator duyệt / sửa / từ chối
 * ở CO-05. Trang câu hỏi của Platform Moderator chỉ đọc `orgId: null` nên không thấy các câu này.
 *
 * Chống trùng theo `textHash` trong phạm vi công ty (index unique `{ textHash, orgId }`): câu trùng
 * với câu đã có (mọi trạng thái, kể cả đã từ chối) hoặc trùng nhau trong cùng lượt sinh bị bỏ qua.
 */
import { QuestionBank, hashQuestionText } from "../models/QuestionBank.js";
import { getRoleCategory } from "./roleCategories.js";
import {
  COMPETENCY_LIBRARY,
  ROLE_COMPETENCY_MAP,
  buildCompetencyPromptBlock,
  isValidCompetencyKey,
} from "./competencyFramework.js";
import { callLLM, extractJson, activeLLMModel, isLLMConfigured } from "./interviewQuestionService.js";
import { getActivePrompt } from "./promptVersionService.js";
import { createTrace, finalizeTrace } from "./langfuseService.js";
import { COMPANY_QUESTION_GEN_KEY, buildCompanyQuestionGenPrompt } from "../prompts/companyQuestionGenPrompt.js";
import { httpError } from "../utils/apiErrors.js";
import { logger } from "../config/logger.js";

export const COMPANY_QUESTION_COUNT = Object.freeze({ min: 8, max: 12, default: 10 });

const LAYERS = ["theory", "project", "behavior"];
const SENIORITIES = ["intern", "junior", "middle", "senior"];
const MIN_QUESTION_LENGTH = 15;
const MAX_QUESTION_LENGTH = 600;
/** Số câu đã có đưa vào prompt để LLM tránh lặp ý (giới hạn token). */
const EXISTING_IN_PROMPT = 30;

const strList = (v, max = 6) =>
  (Array.isArray(v) ? v : [])
    .filter((x) => typeof x === "string" && x.trim())
    .map((x) => x.trim().slice(0, 500))
    .slice(0, max);

/** Năng lực mục tiêu của vị trí: theo `interviewRole` trong roleCategories.json, chỉ giữ key hợp lệ. */
export function targetCompetencies(roleCategory) {
  const row = getRoleCategory(roleCategory);
  const ids = ROLE_COMPETENCY_MAP[row?.interviewRole] ?? ROLE_COMPETENCY_MAP.default;
  return ids.filter((id) => isValidCompetencyKey(id));
}

/** Chia `count` câu xoay vòng qua các năng lực, ưu tiên năng lực đứng trước. */
function distributionGuide(competencyIds, count) {
  const lines = [];
  for (let i = 0; i < count; i++) {
    const c = COMPETENCY_LIBRARY[competencyIds[i % competencyIds.length]];
    lines.push(`  Q${i + 1}: "${c.nameVi}" (${c.id}) — layer ưu tiên: ${c.relevantLayers?.[0] ?? "behavior"}`);
  }
  return lines.join("\n");
}

/**
 * Chuẩn hóa output LLM thành dữ liệu QuestionBank; câu rỗng, quá ngắn/dài hoặc trùng trong lượt
 * thì bỏ. `competency_id` lạ thì gán năng lực theo vị trí câu (không lưu key ngoài LP-01).
 */
export function normalizeGeneratedQuestions(rawQuestions, competencyIds, count) {
  const out = [];
  const seen = new Set();
  for (const q of Array.isArray(rawQuestions) ? rawQuestions : []) {
    if (out.length >= count) break;
    const text = String(q?.question ?? q?.text ?? "").replace(/\s+/g, " ").trim();
    if (text.length < MIN_QUESTION_LENGTH || text.length > MAX_QUESTION_LENGTH) continue;
    const textHash = hashQuestionText(text);
    if (seen.has(textHash)) continue;
    seen.add(textHash);

    const rawKey = q?.competency_id ?? q?.competencyId;
    const competencyId = isValidCompetencyKey(rawKey) ? rawKey : competencyIds[out.length % competencyIds.length];
    const lib = COMPETENCY_LIBRARY[competencyId];
    const star = q?.star_guidance ?? q?.starGuidance ?? {};
    out.push({
      text,
      textHash,
      competencyId,
      competencyName: lib?.nameVi ?? "",
      layer: LAYERS.includes(q?.layer) ? q.layer : "behavior",
      seniority: SENIORITIES.includes(q?.seniority) ? q.seniority : "middle",
      ddiKeyActionTargeted: String(q?.ddi_key_action_targeted ?? q?.ddiKeyActionTargeted ?? "").slice(0, 500),
      starGuidance: {
        situation: strList(star.situation),
        task: strList(star.task),
        action: strList(star.action),
        result: strList(star.result),
      },
      expectedKeywords: strList(q?.expected_keywords ?? q?.expectedKeywords, 8),
      deepDive: strList(q?.deep_dive ?? q?.deepDive, 3),
      shrmRubricExcellent: String(q?.shrm_rubric_excellent ?? "").slice(0, 1000) || lib?.starRubric?.excellent || "",
    });
  }
  return out;
}

async function callAndParse(system, user, jsonRepair, opts) {
  let raw = await callLLM(system, user, opts);
  try {
    return JSON.parse(extractJson(raw));
  } catch {
    raw = await callLLM(jsonRepair, raw, { ...opts, temp: 0, retries: 1, traceName: "company_question_json_repair" });
    return JSON.parse(extractJson(raw));
  }
}

/**
 * @param {object} p
 * @param {import("mongoose").Types.ObjectId|string} p.companyId
 * @param {string} p.roleCategory   key hợp lệ trong roleCategories.json (controller đã kiểm)
 * @param {number} [p.count=10]     8–12
 * @param {import("mongoose").Types.ObjectId|string} p.userId  Company Moderator bấm sinh
 * @returns {Promise<{ questions: object[], requested: number, skippedDuplicates: number, promptVersion: string }>}
 */
export async function generateCompanyQuestionDrafts({ companyId, roleCategory, count = COMPANY_QUESTION_COUNT.default, userId }) {
  if (!isLLMConfigured()) throw httpError(503, "Dịch vụ AI chưa được cấu hình, chưa sinh được câu hỏi.");
  const role = getRoleCategory(roleCategory);
  if (!role) throw httpError(400, "Vị trí (roleCategory) không có trong danh sách nhóm vị trí.");

  const competencyIds = targetCompetencies(roleCategory);
  const existing = await QuestionBank.find({ orgId: companyId, roleCategory, status: { $ne: "rejected" } })
    .sort({ createdAt: -1 })
    .limit(EXISTING_IN_PROMPT)
    .select("text")
    .lean();

  const prompt = await getActivePrompt(COMPANY_QUESTION_GEN_KEY);
  const built = buildCompanyQuestionGenPrompt(prompt, {
    roleName: role.nameVi,
    questionCount: count,
    competencyBlock: buildCompetencyPromptBlock(competencyIds),
    distributionGuide: distributionGuide(competencyIds, count),
    existingQuestions: existing.map((q) => q.text),
  });

  const traceId = createTrace({
    name: "company_question_generation",
    userId,
    metadata: { companyId: String(companyId), roleCategory, count, promptVersion: prompt.version },
    tags: ["company_question_generation"],
  });

  let parsed;
  try {
    parsed = await callAndParse(built.system, built.user, built.jsonRepair, {
      maxTokens: Math.min(8000, 800 + count * 600),
      temp: 0.7,
      traceId,
      traceName: "company_question_generation",
    });
  } catch (err) {
    finalizeTrace(traceId, "error", err.message);
    logger.error("company_question_gen_failed", { companyId: String(companyId), roleCategory, error: err.message });
    throw httpError(502, "AI chưa sinh được bộ câu hỏi, vui lòng thử lại.");
  }

  const drafts = normalizeGeneratedQuestions(parsed?.questions, competencyIds, count);
  if (!drafts.length) {
    finalizeTrace(traceId, "error", "no_valid_questions");
    throw httpError(502, "AI trả về kết quả không hợp lệ, vui lòng thử lại.");
  }

  const taken = new Set(
    (await QuestionBank.find({ orgId: companyId, textHash: { $in: drafts.map((d) => d.textHash) } })
      .select("textHash").lean()).map((d) => d.textHash),
  );
  const fresh = drafts.filter((d) => !taken.has(d.textHash));

  const now = new Date();
  const model = activeLLMModel("qgen");
  const docs = fresh.map((d) => ({
    ...d,
    originalText: d.text,
    orgId: companyId,
    source: "org_template",
    roleCategory,
    status: "draft",
    language: "vi",
    provenance: { llmModel: model, promptVersion: prompt.version, generatedAt: now },
    generatedBy: { model, promptVersion: prompt.version },
    history: [{ action: "create", actorId: userId, reason: "AI sinh bộ câu nháp (CO-04)", at: now }],
    createdBy: userId,
  }));

  // Ghi từng câu (tối đa 12): hai lượt sinh song song cùng ra một câu thì index unique
  // `{ textHash, orgId }` chặn bản sau, các câu còn lại vẫn lưu.
  const inserted = [];
  for (const doc of docs) {
    try {
      inserted.push(await QuestionBank.create(doc));
    } catch (err) {
      if (err?.code !== 11000) throw err;
    }
  }

  finalizeTrace(traceId, "success");
  return {
    questions: inserted,
    requested: count,
    skippedDuplicates: drafts.length - inserted.length,
    promptVersion: prompt.version,
  };
}
