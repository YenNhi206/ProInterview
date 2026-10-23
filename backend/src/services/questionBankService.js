/**
 * questionBankService.js — ngân hàng câu hỏi cho Moderator HITL (spec S1).
 *
 *  - harvest(): thu câu follow-up LLM vừa sinh vào QuestionBank (pending_review) — post-hoc,
 *    KHÔNG chặn phỏng vấn: câu vẫn được phục vụ real-time, moderator kiểm định sau.
 *  - applyDeprecationPolicy(): câu đã `deprecated` không bao giờ được phục vụ lại — thay bằng câu
 *    `approved` cùng competency, không có thì regenerate 1 lần.
 */
import mongoose from "mongoose";
import { QuestionBank, hashQuestionText } from "../models/QuestionBank.js";
import { logger } from "../config/logger.js";

const SAMPLE_SESSION_LIMIT = 20;

/** QuestionBank doc → shape `InterviewSession.questions[]` (kèm questionBankId). */
export function toSessionQuestion(doc, index = 0) {
  return {
    id: `qb${index + 1}`,
    layer: doc.layer || "behavior",
    seniority: doc.seniority || "junior",
    competencyId: doc.competencyId || "",
    competencyName: doc.competencyName || "",
    ddiKeyActionTargeted: doc.ddiKeyActionTargeted || "",
    shrmRubricExcellent: doc.shrmRubricExcellent || "",
    question: doc.text,
    starGuidance: {
      situation: doc.starGuidance?.situation ?? [],
      task: doc.starGuidance?.task ?? [],
      action: doc.starGuidance?.action ?? [],
      result: doc.starGuidance?.result ?? [],
    },
    expectedKeywords: doc.expectedKeywords ?? [],
    deepDive: doc.deepDive ?? [],
    questionBankId: doc._id,
    promptVersion: doc.generatedBy?.promptVersion || "",
  };
}

/** Phần nội dung câu hỏi chỉ ghi lúc tạo mới ($setOnInsert) — moderator sửa sau không bị ghi đè. */
function insertFieldsFor(q, { model, promptVersion, sessionId, source }) {
  const text = String(q.question || "").trim();
  return {
    text,
    originalText: text,
    layer: q.layer,
    seniority: q.seniority,
    competencyId: q.competencyId || "",
    competencyName: q.competencyName || "",
    ddiKeyActionTargeted: q.ddiKeyActionTargeted || "",
    shrmRubricExcellent: q.shrmRubricExcellent || "",
    starGuidance: q.starGuidance ?? {},
    expectedKeywords: q.expectedKeywords ?? [],
    deepDive: q.deepDive ?? [],
    source,
    status: "pending_review",
    generatedBy: { model: model || "", promptVersion: promptVersion || "" },
    provenance: {
      originSessionId: sessionId && mongoose.isValidObjectId(sessionId) ? sessionId : null,
      llmModel: model || "",
      promptVersion: promptVersion || "",
      generatedAt: new Date(),
    },
    history: [{ action: "create", reason: `harvest:${source}` }],
  };
}

/**
 * Upsert từng câu theo { textHash, orgId: null }. Cùng câu sinh nhiều lần → 1 document,
 * usageCount tăng dần, sampleSessionIds giữ 20 session gần nhất.
 * @returns {Promise<(import("mongoose").Types.ObjectId|null)[]>} questionBankId theo đúng thứ tự `questions`
 */
export async function harvest(questions, { sessionId = null, model = "", promptVersion = "", source = "llm_followup" } = {}) {
  const ids = [];
  const now = new Date();
  for (const q of questions ?? []) {
    const text = String(q?.question || "").trim();
    if (!text) {
      ids.push(null);
      continue;
    }
    const filter = { textHash: hashQuestionText(text), orgId: null };
    const update = {
      $setOnInsert: insertFieldsFor(q, { model, promptVersion, sessionId, source }),
      $inc: { usageCount: 1 },
      $set: { lastUsedAt: now },
      ...(sessionId && mongoose.isValidObjectId(sessionId) && {
        $push: { sampleSessionIds: { $each: [sessionId], $slice: -SAMPLE_SESSION_LIMIT } },
      }),
    };
    let doc;
    try {
      doc = await QuestionBank.findOneAndUpdate(filter, update, { upsert: true, returnDocument: "after", projection: { _id: 1 } });
    } catch (err) {
      // 2 request harvest cùng câu đồng thời: upsert thứ 2 đụng unique index → document đã tồn tại,
      // chạy lại thì match và chỉ $inc.
      if (err?.code !== 11000) throw err;
      doc = await QuestionBank.findOneAndUpdate(filter, update, { returnDocument: "after", projection: { _id: 1 } });
    }
    ids.push(doc?._id ?? null);
  }
  return ids;
}

/** Câu thay thế: approved, pool chung, cùng competency, chưa có trong buổi; ít bị flag trước. */
async function findApprovedReplacement(competencyId, excludeHashes) {
  const filter = { status: "approved", orgId: null, textHash: { $nin: [...excludeHashes] } };
  if (competencyId) filter.competencyId = competencyId;
  return QuestionBank.findOne(filter).sort({ flagCount: 1, usageCount: 1 }).lean();
}

/**
 * Chính sách #2: không phục vụ câu deprecated.
 *  1. Thay bằng câu approved cùng competencyId.
 *  2. Không có → `regenerate(count, competencyIds)` đúng 1 lần cho các câu còn thiếu.
 *  3. Câu regenerate vẫn deprecated → thử approved bất kỳ competency; vẫn không có thì bỏ câu đó
 *     (thà ít câu hơn còn hơn phục vụ câu đã khai tử).
 *
 * @param {object[]} questions shape InterviewSession.questions[]
 * @param {{ regenerate?: (count: number, competencyIds: string[]) => Promise<object[]>, excludeTexts?: string[] }} opts
 * @returns {Promise<{ questions: object[], replaced: number, regenerated: number, dropped: number }>}
 */
export async function applyDeprecationPolicy(questions, { regenerate, excludeTexts = [] } = {}) {
  const list = [...(questions ?? [])];
  const hashes = list.map((q) => hashQuestionText(q?.question));
  const deprecatedRows = await QuestionBank.find(
    { textHash: { $in: hashes }, orgId: null, status: "deprecated" },
    { textHash: 1 },
  ).lean();
  const deprecated = new Set(deprecatedRows.map((d) => d.textHash));
  if (deprecated.size === 0) return { questions: list, replaced: 0, regenerated: 0, dropped: 0 };

  const used = new Set([...hashes.filter((h) => !deprecated.has(h)), ...excludeTexts.map(hashQuestionText)]);
  let replaced = 0;
  const missing = [];
  for (let i = 0; i < list.length; i++) {
    if (!deprecated.has(hashes[i])) continue;
    const alt = await findApprovedReplacement(list[i].competencyId, used);
    if (alt) {
      list[i] = toSessionQuestion(alt, i);
      used.add(alt.textHash);
      replaced++;
    } else {
      missing.push(i);
    }
  }

  let regenerated = 0;
  let dropped = 0;
  if (missing.length > 0) {
    let fresh = [];
    if (typeof regenerate === "function") {
      try {
        fresh = (await regenerate(missing.length, missing.map((i) => list[i].competencyId).filter(Boolean))) ?? [];
      } catch (err) {
        logger.warn("question_bank_regenerate_failed", { error: err?.message });
      }
    }
    const freshHashes = fresh.map((q) => hashQuestionText(q?.question));
    const freshDeprecated = new Set(
      freshHashes.length
        ? (await QuestionBank.find({ textHash: { $in: freshHashes }, orgId: null, status: "deprecated" }, { textHash: 1 }).lean())
            .map((d) => d.textHash)
        : [],
    );
    for (const i of missing) {
      const k = fresh.findIndex((q, j) => q && !freshDeprecated.has(freshHashes[j]) && !used.has(freshHashes[j]));
      if (k >= 0) {
        list[i] = fresh[k];
        used.add(freshHashes[k]);
        fresh[k] = null;
        regenerated++;
        continue;
      }
      const anyApproved = await findApprovedReplacement(null, used);
      if (anyApproved) {
        list[i] = toSessionQuestion(anyApproved, i);
        used.add(anyApproved.textHash);
        replaced++;
      } else {
        list[i] = null;
        dropped++;
      }
    }
  }

  if (dropped > 0) logger.warn("question_bank_deprecated_dropped", { dropped });
  return { questions: list.filter(Boolean), replaced, regenerated, dropped };
}
