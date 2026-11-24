/**
 * CO-09 (REQ PM-02): AI gợi ý cho Platform Moderator khi duyệt rubric công ty.
 *
 * Gọi nền sau khi Company Mod gửi rubric (`pending_review`), và khi moderator bấm "Chạy lại" trong màn duyệt.
 * Kết quả chỉ là cảnh báo: không tự duyệt, không tự từ chối, không tạo ModerationItem (rubric không vào
 * hàng đợi HITL, xem CO-07).
 *
 * 1. Luật (không tốn LLM): tổng trọng số khác 100, key năng lực không có trong bộ tiêu chí LP-01,
 *    hai tiêu chí cùng key, thiếu mô tả mức, hai mức của một tiêu chí chép y hệt nhau, hai tiêu chí
 *    dùng chung một thang, mô tả mức quá ngắn, tên tiêu chí trùng.
 * 2. LLM model rẻ (`activeLLMModel("prescreen")`, prompt `rubric_review` theo PromptVersion): tiêu chí
 *    map sai năng lực SHRM/DDI (kèm key gợi ý), thang mơ hồ, mức chồng lấn, thang không tăng dần,
 *    hai tiêu chí đo trùng.
 * 3. Ghi `CompanyRubric.aiReview`. Rubric không đổi nội dung (`contentHash` trùng, lần trước `done`)
 *    thì không gọi LLM lại.
 */
import { createHash } from "node:crypto";
import { CompanyRubric } from "../models/CompanyRubric.js";
import { callLLM, extractJson, activeLLMModel, isLLMConfigured } from "./interviewQuestionService.js";
import { getActivePrompt } from "./promptVersionService.js";
import { createTrace, finalizeTrace } from "./langfuseService.js";
import { getFramework, getCompetency, isValidCompetencyKey } from "./competencyFramework.js";
import { RUBRIC_REVIEW_KEY, RUBRIC_REVIEW_AI_FLAG_CODES, buildRubricReviewPrompt } from "../prompts/rubricReviewPrompt.js";
import { logger } from "../config/logger.js";

export const RUBRIC_LEVEL_KEYS = ["0", "1", "2", "3", "4", "5"];
export const REVIEW_RULES = Object.freeze({ minLevelLength: 15 });

const FIELD_LIMIT = 500;
const MAX_AI_FLAGS = 15;

const clip = (s, n = FIELD_LIMIT) => {
  const t = String(s ?? "").replace(/\s+/g, " ").trim();
  return t.length > n ? `${t.slice(0, n)}…` : t;
};

/** So khớp lỏng: chữ thường, bỏ dấu câu và khoảng trắng thừa. */
const loose = (s) => String(s ?? "").toLowerCase().replace(/[.,;:!?"'()\-–—]/g, " ").replace(/\s+/g, " ").trim();

function levelsOf(criterion) {
  const raw = criterion?.levels instanceof Map ? Object.fromEntries(criterion.levels) : criterion?.levels || {};
  return Object.fromEntries(RUBRIC_LEVEL_KEYS.map((l) => [l, String(raw[l] ?? "").trim()]));
}

/** Các trường quyết định kết quả — dùng để băm và để dựng bản tóm tắt. */
function relevantContent(rubric) {
  return {
    title: rubric.title ?? "",
    roleCategory: rubric.roleCategory ?? "",
    description: rubric.description ?? "",
    criteria: (rubric.criteria ?? []).map((c) => ({
      name: c?.name ?? "",
      shrmKey: c?.shrmKey ?? "",
      weight: Number(c?.weight) || 0,
      description: c?.description ?? "",
      levels: levelsOf(c),
    })),
  };
}

export function rubricContentHash(rubric) {
  return createHash("sha256").update(JSON.stringify(relevantContent(rubric))).digest("hex");
}

/** Cờ theo luật (source `rule`). `criterionIndex` 0-based. */
export function ruleFlags(rubric) {
  const flags = [];
  const add = (code, severity, criterionIndex, message, evidence = "") =>
    flags.push({ code, severity, criterionIndex, message, evidence: clip(evidence, 200), suggestedShrmKey: "", source: "rule" });
  const { criteria } = relevantContent(rubric);

  if (!criteria.length) {
    add("no_criteria", "critical", null, "Rubric chưa có tiêu chí nào.");
    return flags;
  }
  const total = criteria.reduce((s, c) => s + c.weight, 0);
  if (total !== 100) add("weight_sum", "critical", null, `Tổng trọng số là ${total}%, phải bằng 100%.`);

  const firstByKey = new Map();
  const firstByName = new Map();
  const firstByScale = new Map();
  criteria.forEach((c, i) => {
    const label = `Tiêu chí ${i + 1}`;
    if (!isValidCompetencyKey(c.shrmKey)) {
      add("invalid_shrm_key", "critical", i, `${label}: năng lực "${c.shrmKey}" không có trong bộ tiêu chí SHRM/DDI hoặc đã ngừng dùng.`);
    } else if (firstByKey.has(c.shrmKey)) {
      const name = getCompetency(c.shrmKey)?.nameVi || c.shrmKey;
      add("duplicate_shrm_key", "warning", i, `${label} và tiêu chí ${firstByKey.get(c.shrmKey) + 1} cùng đo năng lực "${name}"; điểm năng lực này bị tính hai lần.`);
    } else {
      firstByKey.set(c.shrmKey, i);
    }

    const nameKey = loose(c.name);
    if (nameKey && firstByName.has(nameKey)) {
      add("duplicate_name", "warning", i, `${label} trùng tên với tiêu chí ${firstByName.get(nameKey) + 1}.`, c.name);
    } else if (nameKey) {
      firstByName.set(nameKey, i);
    }

    const empty = RUBRIC_LEVEL_KEYS.filter((l) => !c.levels[l]);
    if (empty.length) add("missing_level", "critical", i, `${label}: chưa mô tả mức ${empty.join(", ")}.`);

    const seen = new Map();
    for (const l of RUBRIC_LEVEL_KEYS) {
      const k = loose(c.levels[l]);
      if (!k) continue;
      if (seen.has(k)) {
        add("duplicate_level", "warning", i, `${label}: mức ${seen.get(k)} và mức ${l} có mô tả giống hệt nhau, người chấm không phân biệt được.`, c.levels[l]);
      } else {
        seen.set(k, l);
      }
    }

    const short = RUBRIC_LEVEL_KEYS.filter((l) => c.levels[l] && c.levels[l].length < REVIEW_RULES.minLevelLength);
    if (short.length) {
      add("short_level", "info", i, `${label}: mô tả mức ${short.join(", ")} quá ngắn (dưới ${REVIEW_RULES.minLevelLength} ký tự), khó biết ứng viên cần thể hiện gì.`,
        short.map((l) => `${l}: ${c.levels[l]}`).join("; "));
    }

    const scaleKey = RUBRIC_LEVEL_KEYS.map((l) => loose(c.levels[l])).join("|");
    if (empty.length < RUBRIC_LEVEL_KEYS.length) {
      if (firstByScale.has(scaleKey)) {
        add("copied_scale", "warning", i, `${label} dùng y nguyên thang mô tả của tiêu chí ${firstByScale.get(scaleKey) + 1}.`);
      } else {
        firstByScale.set(scaleKey, i);
      }
    }
  });
  return flags;
}

/** Bộ tiêu chí năng lực gửi LLM: mọi key còn dùng, kèm tên và định nghĩa. */
export function buildCompetencyCatalog() {
  return getFramework()
    .competencies.filter((c) => isValidCompetencyKey(c.key))
    .map((c) => `- ${c.key} — ${c.nameVi} — ${clip(c.definition, 300)}`)
    .join("\n");
}

/** Bản rubric dạng chữ gửi LLM. */
export function buildRubricDigest(rubric) {
  const r = relevantContent(rubric);
  const lines = [
    `Tiêu đề: ${clip(r.title, 200)}`,
    `Nhóm vị trí: ${r.roleCategory}`,
    r.description ? `Mô tả: ${clip(r.description)}` : "",
    ...r.criteria.map((c, i) => {
      const comp = getCompetency(c.shrmKey);
      return [
        `Tiêu chí ${i + 1}: ${clip(c.name, 200)} (trọng số ${c.weight}%)`,
        `  shrmKey: ${c.shrmKey}${comp ? ` — ${comp.nameVi}` : " — (không có trong bộ tiêu chí)"}`,
        c.description ? `  Mô tả: ${clip(c.description)}` : "",
        ...RUBRIC_LEVEL_KEYS.map((l) => `  Mức ${l}: ${clip(c.levels[l]) || "(trống)"}`),
      ].filter(Boolean).join("\n");
    }),
  ];
  return lines.filter(Boolean).join("\n");
}

/** Chỉ giữ cờ đúng mã, đúng tiêu chí; key gợi ý phải có trong bộ tiêu chí và khác key đang chọn. */
export function sanitizeAiFlags(rawFlags, rubric) {
  if (!Array.isArray(rawFlags)) return [];
  const criteria = rubric.criteria ?? [];
  return rawFlags
    .filter((f) => RUBRIC_REVIEW_AI_FLAG_CODES.includes(f?.code))
    .map((f) => {
      const n = Number(f.criterion);
      const criterionIndex = Number.isInteger(n) && n >= 1 && n <= criteria.length ? n - 1 : null;
      const current = criterionIndex === null ? "" : criteria[criterionIndex]?.shrmKey;
      const suggested = String(f.suggested_shrm_key ?? "").trim();
      return {
        code: f.code,
        severity: f.severity === "critical" ? "critical" : "warning",
        criterionIndex,
        message: clip(f.message, 300) || f.code,
        evidence: clip(f.evidence, 200),
        suggestedShrmKey: f.code === "shrm_mismatch" && isValidCompetencyKey(suggested) && suggested !== current ? suggested : "",
        source: "ai",
      };
    })
    .slice(0, MAX_AI_FLAGS);
}

async function callAndParse(built, opts) {
  let raw = await callLLM(built.system, built.user, opts);
  try {
    return JSON.parse(extractJson(raw));
  } catch {
    raw = await callLLM(built.jsonRepair, raw, { ...opts, temp: 0, retries: 0, traceName: "rubric_review_json_repair" });
    return JSON.parse(extractJson(raw));
  }
}

async function runAi(rubric, userId) {
  if (!isLLMConfigured()) return { ok: false, error: "Dịch vụ AI chưa được cấu hình." };
  const prompt = await getActivePrompt(RUBRIC_REVIEW_KEY);
  const built = buildRubricReviewPrompt(prompt, { competencies: buildCompetencyCatalog(), rubric: buildRubricDigest(rubric) });
  const model = activeLLMModel("prescreen");
  const traceId = createTrace({
    name: "rubric_review",
    userId,
    metadata: { rubricId: String(rubric._id), promptVersion: prompt.version, model },
    tags: ["rubric_review"],
  });
  try {
    const parsed = await callAndParse(built, {
      maxTokens: 1500,
      temp: 0,
      retries: 1,
      traceId,
      traceName: "rubric_review",
      model,
      anthropicModel: model,
    });
    finalizeTrace(traceId, "success");
    return {
      ok: true,
      model,
      promptVersion: prompt.version,
      summary: clip(parsed?.summary, 500),
      flags: sanitizeAiFlags(parsed?.flags, rubric),
    };
  } catch (err) {
    finalizeTrace(traceId, "error", err?.message);
    logger.error("rubric_review_llm_failed", { rubricId: String(rubric._id), error: err?.message });
    return { ok: false, model, promptVersion: prompt.version, error: "AI chưa kiểm tra được rubric." };
  }
}

const SEVERITY_ORDER = { critical: 0, warning: 1, info: 2 };

/**
 * Kiểm tra một rubric. Lỗi LLM không ném ra ngoài: `status: "failed"`, cờ luật vẫn được ghi.
 * @param {string|import("mongoose").Types.ObjectId} rubricId
 * @param {{ force?: boolean, userId?: string|null }} [opts]
 * @returns {Promise<object|null>} `aiReview` đã ghi; rubric không tồn tại → null
 */
export async function reviewRubric(rubricId, { force = false, userId = null } = {}) {
  const rubric = await CompanyRubric.findById(rubricId).lean();
  if (!rubric) return null;

  const contentHash = rubricContentHash(rubric);
  const prev = rubric.aiReview;
  if (!force && prev?.status === "done" && prev.contentHash === contentHash) return prev;

  await CompanyRubric.updateOne(
    { _id: rubric._id },
    { $set: { aiReview: { status: "pending", contentHash, flags: [], at: new Date() } } },
    { timestamps: false },
  );

  const ai = await runAi(rubric, userId);
  const flags = [...ruleFlags(rubric), ...(ai.flags ?? [])].sort(
    (a, b) => (SEVERITY_ORDER[a.severity] ?? 3) - (SEVERITY_ORDER[b.severity] ?? 3),
  );
  const result = {
    status: ai.ok ? "done" : "failed",
    summary: ai.summary || "",
    flags,
    model: ai.model || "",
    promptVersion: ai.promptVersion || "",
    contentHash,
    error: ai.ok ? "" : ai.error,
    at: new Date(),
  };

  // Ghi có điều kiện: công ty sửa rubric trong lúc chờ LLM thì bỏ kết quả cũ.
  const written = await CompanyRubric.updateOne(
    { _id: rubric._id, "aiReview.contentHash": contentHash },
    { $set: { aiReview: result } },
    { timestamps: false },
  );
  if (written.matchedCount === 0) return null;

  logger.info("rubric_review_done", { rubricId: String(rubric._id), status: result.status, flags: flags.map((f) => f.code) });
  return result;
}

const inflight = new Set();

/** Chạy nền sau khi công ty gửi duyệt rubric (không chặn response). */
export function scheduleRubricReview(rubricId, userId = null) {
  const p = reviewRubric(rubricId, { userId })
    .catch((err) => logger.error("rubric_review_failed", { rubricId: String(rubricId), error: err?.message }))
    .finally(() => inflight.delete(p));
  inflight.add(p);
  return p;
}

/** Chỉ dùng trong test: chờ mọi lượt kiểm tra nền chạy xong. */
export async function waitForPendingRubricReviews() {
  while (inflight.size) await Promise.all([...inflight]);
}
