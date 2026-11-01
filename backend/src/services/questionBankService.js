/**
 * questionBankService.js — ngân hàng câu hỏi cho Moderator HITL (spec S1).
 *
 *  - harvest(): thu câu follow-up LLM vừa sinh vào QuestionBank (pending_review) — post-hoc,
 *    KHÔNG chặn phỏng vấn: câu vẫn được phục vụ real-time, moderator kiểm định sau.
 *  - applyDeprecationPolicy(): câu `deprecated` không bao giờ được phục vụ lại; chuỗi dự phòng approved
 *    cùng competency → sinh lại (≤2 lần) → approved bất kỳ → bộ câu tĩnh. Buổi không bao giờ thiếu câu.
 */
import mongoose from "mongoose";
import { QuestionBank, hashQuestionText } from "../models/QuestionBank.js";
import { InterviewSession } from "../models/InterviewSession.js";
import { logger } from "../config/logger.js";
import { listFallbackQuestions } from "../config/fallbackQuestions.js";
import { COMPETENCY_LIBRARY } from "./competencyFramework.js";

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

/** Câu thay thế: approved, pool chung, (cùng competency nếu có), chưa có trong buổi; ít bị flag trước. */
async function findApprovedReplacement(competencyId, excludeHashes) {
  const filter = { status: "approved", orgId: null, textHash: { $nin: [...excludeHashes] } };
  if (competencyId) filter.competencyId = competencyId;
  return QuestionBank.findOne(filter).sort({ flagCount: 1, usageCount: 1 }).lean();
}

async function deprecatedHashSet(hashes) {
  if (!hashes.length) return new Set();
  const rows = await QuestionBank.find(
    { textHash: { $in: hashes }, orgId: null, status: "deprecated" },
    { textHash: 1 },
  ).lean();
  return new Set(rows.map((d) => d.textHash));
}

/** Upsert 1 câu dự phòng tĩnh (approved, source moderator). Không đổi doc đã tồn tại. */
async function upsertFallbackQuestion({ competencyId, text }) {
  const filter = { textHash: hashQuestionText(text), orgId: null };
  const update = {
    $setOnInsert: {
      text,
      originalText: text,
      competencyId,
      competencyName: COMPETENCY_LIBRARY[competencyId]?.nameVi ?? "",
      layer: "behavior",
      source: "moderator",
      status: "approved",
      review: { at: new Date(), note: "fallback tĩnh (config/fallbackQuestions.js)" },
      history: [{ action: "create", reason: "fallback:static" }],
    },
  };
  try {
    return await QuestionBank.findOneAndUpdate(filter, update, { upsert: true, returnDocument: "after" }).lean();
  } catch (err) {
    if (err?.code !== 11000) throw err;
    return QuestionBank.findOne(filter).lean();
  }
}

/**
 * Seed bộ câu dự phòng tĩnh vào QuestionBank — idempotent (chạy lại không tạo trùng, không ghi đè
 * câu moderator đã sửa / khai tử). @returns {{ total, inserted }}
 */
export async function syncFallbackQuestions() {
  const all = listFallbackQuestions();
  const hashFilter = { textHash: { $in: all.map((q) => hashQuestionText(q.text)) }, orgId: null };
  const before = await QuestionBank.countDocuments(hashFilter);
  for (const q of all) await upsertFallbackQuestion(q);
  const after = await QuestionBank.countDocuments(hashFilter);
  return { total: all.length, inserted: after - before };
}

/**
 * Câu dự phòng tĩnh: ưu tiên cùng competency, rồi bất kỳ; bỏ câu đã dùng trong buổi và câu
 * moderator đã khai tử. Câu chọn được upsert vào bank để có questionBankId.
 */
async function pickStaticFallback(competencyId, used) {
  const all = listFallbackQuestions();
  const ordered = [
    ...all.filter((q) => q.competencyId === competencyId),
    ...all.filter((q) => q.competencyId !== competencyId),
  ];
  const deprecated = await deprecatedHashSet(ordered.map((q) => hashQuestionText(q.text)));
  const candidate = ordered.find((q) => {
    const h = hashQuestionText(q.text);
    return !deprecated.has(h) && !used.has(h);
  });
  return candidate ? upsertFallbackQuestion(candidate) : null;
}

export const REGENERATE_ATTEMPTS = 2;

/**
 * Chính sách #2: không phục vụ câu deprecated, và buổi phỏng vấn KHÔNG BAO GIỜ thiếu câu.
 * Chuỗi dự phòng cho mỗi câu deprecated:
 *   1. Câu approved cùng competencyId.
 *   2. `regenerate(count, competencyIds)` — tối đa REGENERATE_ATTEMPTS lần cho các câu còn thiếu.
 *   3. Câu approved bất kỳ competency.
 *   4. Bộ câu dự phòng tĩnh (config/fallbackQuestions.js).
 *
 * @param {object[]} questions shape InterviewSession.questions[]
 * @param {{ regenerate?: (count: number, competencyIds: string[]) => Promise<object[]>, excludeTexts?: string[] }} opts
 * @returns {Promise<{ questions: object[], replaced: number, regenerated: number, fallback: number }>}
 */
export async function applyDeprecationPolicy(questions, { regenerate, excludeTexts = [] } = {}) {
  const list = [...(questions ?? [])];
  const hashes = list.map((q) => hashQuestionText(q?.question));
  const deprecated = await deprecatedHashSet(hashes);
  if (deprecated.size === 0) return { questions: list, replaced: 0, regenerated: 0, fallback: 0 };

  const used = new Set([...hashes.filter((h) => !deprecated.has(h)), ...excludeTexts.map(hashQuestionText)]);
  const stats = { replaced: 0, regenerated: 0, fallback: 0 };
  const take = (i, q, hash, kind) => {
    list[i] = q;
    used.add(hash);
    stats[kind]++;
  };

  // 1. approved cùng competency
  let missing = [];
  for (let i = 0; i < list.length; i++) {
    if (!deprecated.has(hashes[i])) continue;
    const alt = await findApprovedReplacement(list[i].competencyId, used);
    if (alt) take(i, toSessionQuestion(alt, i), alt.textHash, "replaced");
    else missing.push(i);
  }

  // 2. sinh lại tối đa REGENERATE_ATTEMPTS lần cho các câu còn thiếu
  for (let attempt = 0; attempt < REGENERATE_ATTEMPTS && missing.length > 0 && typeof regenerate === "function"; attempt++) {
    let fresh = [];
    try {
      fresh = (await regenerate(missing.length, missing.map((i) => list[i].competencyId).filter(Boolean))) ?? [];
    } catch (err) {
      logger.warn("question_bank_regenerate_failed", { attempt: attempt + 1, error: err?.message });
      continue;
    }
    const freshHashes = fresh.map((q) => hashQuestionText(q?.question));
    const freshDeprecated = await deprecatedHashSet(freshHashes);
    const stillMissing = [];
    for (const i of missing) {
      const k = fresh.findIndex((q, j) => q?.question && !freshDeprecated.has(freshHashes[j]) && !used.has(freshHashes[j]));
      if (k >= 0) {
        take(i, fresh[k], freshHashes[k], "regenerated");
        fresh[k] = null;
      } else {
        stillMissing.push(i);
      }
    }
    missing = stillMissing;
  }

  // 3. approved bất kỳ competency → 4. bộ câu dự phòng tĩnh
  for (const i of missing) {
    const anyApproved = await findApprovedReplacement(null, used);
    if (anyApproved) {
      take(i, toSessionQuestion(anyApproved, i), anyApproved.textHash, "replaced");
      continue;
    }
    let doc = await pickStaticFallback(list[i].competencyId, used);
    if (!doc) {
      // Toàn bộ câu tĩnh đều đã dùng trong buổi hoặc bị khai tử — gần như không xảy ra.
      // Không để thiếu câu: dùng lại câu tĩnh đầu tiên chưa bị khai tử (chấp nhận trùng trong buổi).
      const all = listFallbackQuestions();
      const dep = await deprecatedHashSet(all.map((q) => hashQuestionText(q.text)));
      logger.error("question_bank_fallback_exhausted", { competencyId: list[i].competencyId });
      doc = await upsertFallbackQuestion(all.find((q) => !dep.has(hashQuestionText(q.text))) ?? all[0]);
    }
    take(i, toSessionQuestion(doc, i), doc.textHash, "fallback");
  }

  if (stats.fallback > 0) logger.warn("question_bank_static_fallback_used", stats);
  return { questions: list, ...stats };
}

// ── Moderator: thao tác trên ngân hàng câu hỏi (/api/moderator/questions*) ─────────────────────

const LIST_SORT = { flagCount: { flagCount: -1, updatedAt: -1 }, usageCount: { usageCount: -1, updatedAt: -1 }, updatedAt: { updatedAt: -1 } };

function escapeRegex(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Chỉ pool chung (orgId null) — template Enterprise ngoài phạm vi S1. */
export async function listQuestions({ status, competencyId, source, q, sort = "updatedAt", page = 1, limit = 20 }) {
  const filter = { orgId: null };
  if (status) filter.status = status;
  if (competencyId) filter.competencyId = competencyId;
  if (source) filter.source = source;
  if (q) filter.text = { $regex: escapeRegex(q), $options: "i" };
  const [items, total] = await Promise.all([
    QuestionBank.find(filter)
      .select("-history -moderation -provenance -stats -sampleSessionIds -starGuidance")
      .sort(LIST_SORT[sort] ?? LIST_SORT.updatedAt)
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    QuestionBank.countDocuments(filter),
  ]);
  return { ok: true, questions: items, pagination: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) } };
}

/** Chi tiết + revisions + tối đa 5 session mẫu gần nhất (câu trả lời + điểm AI + điểm moderator). */
export async function getQuestionDetail(id) {
  const question = await QuestionBank.findById(id).lean();
  if (!question) return { ok: false, status: 404, error: "Không tìm thấy câu hỏi." };

  const sampleIds = [...(question.sampleSessionIds ?? [])].reverse().slice(0, 5);
  const sessions = sampleIds.length
    ? await InterviewSession.find({ _id: { $in: sampleIds } }).select("questions answers feedback createdAt").lean()
    : [];
  const byId = new Map(sessions.map((s) => [String(s._id), s]));
  const samples = sampleIds
    .map((sid) => byId.get(String(sid)))
    .filter(Boolean)
    .map((s) => {
      const qi = (s.questions ?? []).findIndex(
        (x) => String(x.questionBankId ?? "") === String(question._id) || hashQuestionText(x.question) === question.textHash,
      );
      const answer = (s.answers ?? []).find((a) => a.questionIndex === qi);
      const evaluation = (s.feedback?.perQuestion ?? []).find((p) => p.questionIndex === qi);
      return {
        sessionId: s._id,
        createdAt: s.createdAt,
        questionIndex: qi,
        transcript: answer?.transcript ?? "",
        aiEvaluation: evaluation
          ? { scores: evaluation.scores, overall: evaluation.overall5, shrmLevel: evaluation.shrmLevel }
          : null,
        moderatorOverride: answer?.moderatorOverride ?? null,
      };
    });
  return { ok: true, question, samples };
}

export async function createQuestion({ text, competencyId, layer, language }, moderatorId) {
  const textHash = hashQuestionText(text);
  if (await QuestionBank.exists({ textHash, orgId: null })) {
    return { ok: false, status: 409, error: "Câu hỏi này đã có trong ngân hàng." };
  }
  try {
    const doc = await QuestionBank.create({
      text,
      originalText: text,
      competencyId,
      competencyName: COMPETENCY_LIBRARY[competencyId]?.nameVi ?? "",
      layer,
      language,
      source: "moderator",
      status: "approved",
      textHash,
      createdBy: moderatorId,
      review: { by: moderatorId, at: new Date(), note: "Moderator tạo" },
      history: [{ action: "create", actorId: moderatorId, reason: "moderator" }],
    });
    return { ok: true, question: doc.toObject() };
  } catch (err) {
    if (err?.code === 11000) return { ok: false, status: 409, error: "Câu hỏi này đã có trong ngân hàng." };
    throw err;
  }
}

/** Sửa text/competency (bắt buộc lý do) → revisions; textHash mới trùng câu khác → 409. */
export async function editQuestion(id, { text, competencyId, reason }, moderatorId) {
  const doc = await QuestionBank.findById(id);
  if (!doc) return { ok: false, status: 404, error: "Không tìm thấy câu hỏi." };

  const nextText = text ?? doc.text;
  const nextCompetency = competencyId ?? doc.competencyId;
  const nextHash = hashQuestionText(nextText);
  if (nextHash !== doc.textHash && (await QuestionBank.exists({ _id: { $ne: doc._id }, textHash: nextHash, orgId: doc.orgId ?? null }))) {
    return { ok: false, status: 409, error: "Nội dung mới trùng với một câu hỏi khác trong ngân hàng." };
  }

  const previousText = doc.text;
  doc.text = nextText;
  doc.textHash = nextHash;
  doc.competencyId = nextCompetency;
  if (competencyId) doc.competencyName = COMPETENCY_LIBRARY[competencyId]?.nameVi ?? doc.competencyName;
  if (!doc.originalText) doc.originalText = previousText;
  doc.revisions.push({ text: nextText, competencyId: nextCompetency, editedBy: moderatorId, editedAt: new Date(), reason });
  doc.history.push({ action: "edit", actorId: moderatorId, reason, previousQuestion: previousText });
  try {
    await doc.save();
  } catch (err) {
    if (err?.code === 11000) return { ok: false, status: 409, error: "Nội dung mới trùng với một câu hỏi khác trong ngân hàng." };
    throw err;
  }
  return { ok: true, question: doc.toObject() };
}

export async function approveQuestion(id, { note = "" } = {}, moderatorId) {
  const doc = await QuestionBank.findByIdAndUpdate(
    id,
    {
      $set: { status: "approved", review: { by: moderatorId, at: new Date(), note } },
      $push: { history: { action: "approve", actorId: moderatorId, reason: note } },
    },
    { returnDocument: "after" },
  ).lean();
  if (!doc) return { ok: false, status: 404, error: "Không tìm thấy câu hỏi." };
  return { ok: true, question: doc };
}

export async function deprecateQuestion(id, { reason }, moderatorId) {
  const doc = await QuestionBank.findByIdAndUpdate(
    id,
    {
      $set: { status: "deprecated", deprecation: { by: moderatorId, at: new Date(), reason } },
      $push: { history: { action: "deprecate", actorId: moderatorId, reason } },
    },
    { returnDocument: "after" },
  ).lean();
  if (!doc) return { ok: false, status: 404, error: "Không tìm thấy câu hỏi." };
  return { ok: true, question: doc };
}

/** Tối đa 100 id (validate ở DTO). Trả số câu đã cập nhật + id không tồn tại. */
export async function bulkUpdateQuestions({ ids, action, reason = "" }, moderatorId) {
  const now = new Date();
  const update =
    action === "approve"
      ? {
          $set: { status: "approved", review: { by: moderatorId, at: now, note: reason || "" } },
          $push: { history: { action: "approve", actorId: moderatorId, reason: reason || "bulk" } },
        }
      : {
          $set: { status: "deprecated", deprecation: { by: moderatorId, at: now, reason } },
          $push: { history: { action: "deprecate", actorId: moderatorId, reason } },
        };
  const res = await QuestionBank.updateMany({ _id: { $in: ids } }, update);
  const found = await QuestionBank.find({ _id: { $in: ids } }, { _id: 1 }).lean();
  const foundSet = new Set(found.map((d) => String(d._id)));
  return { ok: true, updated: res.modifiedCount, notFound: ids.filter((i) => !foundSet.has(String(i))) };
}
