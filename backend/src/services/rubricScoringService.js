/**
 * JB-07 (REQ AIS-02, C-03; quyết định JB-07 ngày 23/11/2026): chấm câu doanh nghiệp theo rubric công ty.
 *
 * - Chỉ câu nằm trong `session.companyQuestions` (JB-06). Câu khác chỉ có điểm SHRM/DDI như cũ.
 * - Mỗi câu một lời gọi LLM (prompt `rubric_scoring`, PromptVersion AI-02), chấm các tiêu chí rubric có
 *   gắn câu đó ("câu áp dụng"; rubric cũ chưa gắn thì chấm mọi tiêu chí), thang 0–5 kèm trích dẫn.
 * - Trích dẫn phải là đoạn có thật trong transcript: server so lại sau khi chuẩn hóa khoảng trắng / hoa
 *   thường / dấu nháy; không khớp thì bỏ trích dẫn (giữ điểm). LLM thiếu tiêu chí hoặc điểm sai → `failed`.
 * - Lưu vào `answers[i].rubricScores` + `answers[i].rubricScoring`; đã có `scoredAt` thì không chấm lại.
 *   `failed` (lỗi LLM tạm thời) được chấm bù ở lần `evaluate` sau.
 * - Chi phí ghi CostEvent `rubric_scoring` (AI-12) qua `callLLM({ costKind })`.
 */
import { CompanyRubric } from "../models/CompanyRubric.js";
import { Company } from "../models/Company.js";
import { InterviewSession } from "../models/InterviewSession.js";
import { callLLM, extractJson, activeLLMModel, isLLMConfigured } from "./interviewQuestionService.js";
import { getActivePrompt } from "./promptVersionService.js";
import { createTrace, finalizeTrace } from "./langfuseService.js";
import { buildRubricScoringPrompt, RUBRIC_SCORING_KEY } from "../prompts/rubricScoringPrompt.js";
import { COST_EVENT_KIND } from "../constants/costEventKinds.js";
import { logger } from "../config/logger.js";

export const RUBRIC_SCORE_MAX = 5;
/** Trích dẫn ngắn hơn mức này (sau chuẩn hóa) quá dễ khớp ngẫu nhiên → bỏ. */
export const EVIDENCE_MIN_CHARS = 10;
export const EVIDENCE_MAX_CHARS = 300;
const ANSWER_MAX_CHARS = 6000;
/** Khóa chấm rubric quá hạn sau 2 phút (request trước chết giữa chừng). */
const CLAIM_STALE_MS = 2 * 60 * 1000;

const clip = (s, n) => {
  const t = String(s ?? "").trim();
  return t.length > n ? `${t.slice(0, n - 1).trimEnd()}…` : t;
};

/** Chuẩn hóa để so trích dẫn: NFC, thường, nháy cong → thẳng, gộp khoảng trắng, bỏ nháy / dấu câu ở hai đầu. */
export function normalizeForQuote(text) {
  return String(text ?? "")
    .normalize("NFC")
    .toLowerCase()
    .replace(/[“”«»„]/g, '"')
    .replace(/[‘’‚`]/g, "'")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^["'.,;:!?…\-–—\s]+|["'.,;:!?…\-–—\s]+$/g, "");
}

/**
 * Chuẩn hóa transcript như `normalizeForQuote` (trừ bước bỏ dấu câu hai đầu) và giữ vị trí từng ký tự
 * trong bản gốc, để từ đoạn khớp lấy lại đúng đoạn chữ gốc.
 */
function normalizeWithMap(text) {
  const src = String(text ?? "").normalize("NFC");
  let out = "";
  const map = [];
  let prevSpace = false;
  for (let i = 0; i < src.length; i += 1) {
    const ch = src[i];
    if (/\s/.test(ch)) {
      if (!prevSpace && out.length) {
        out += " ";
        map.push(i);
      }
      prevSpace = true;
      continue;
    }
    prevSpace = false;
    for (const c of ch.toLowerCase().replace(/[“”«»„]/g, '"').replace(/[‘’‚`]/g, "'")) {
      out += c;
      map.push(i);
    }
  }
  return { src, out, map };
}

/**
 * Trích dẫn hợp lệ khi (sau chuẩn hóa) dài ≥ EVIDENCE_MIN_CHARS và nằm nguyên trong transcript.
 * Trả về ĐÚNG đoạn chữ trong transcript (không phải chữ LLM trả về), nên luôn là chuỗi con của transcript.
 * Dài quá EVIDENCE_MAX_CHARS thì cắt ở ranh giới từ, không thêm "…".
 * @returns {string} đoạn trích từ transcript, hoặc "" khi không hợp lệ
 */
export function verifyEvidenceQuote(quote, transcript) {
  const q = normalizeForQuote(quote);
  if (q.length < EVIDENCE_MIN_CHARS) return "";
  const { src, out, map } = normalizeWithMap(transcript);
  const at = out.indexOf(q);
  if (at < 0) return "";
  let exact = src.slice(map[at], map[at + q.length - 1] + 1);
  if (exact.length > EVIDENCE_MAX_CHARS) {
    exact = exact.slice(0, EVIDENCE_MAX_CHARS);
    const cut = exact.search(/\s\S*$/);
    if (cut > EVIDENCE_MAX_CHARS * 0.6) exact = exact.slice(0, cut);
    exact = exact.trimEnd();
  }
  return exact;
}

/** Tiêu chí áp dụng cho một câu: tiêu chí có gắn câu đó; rubric chưa gắn câu nào cho câu này thì mọi tiêu chí. */
export function applicableCriteria(rubric, questionId) {
  const all = Array.isArray(rubric?.criteria) ? rubric.criteria : [];
  const id = String(questionId ?? "");
  const linked = all.filter((c) => (c.questionIds ?? []).some((q) => String(q) === id));
  return linked.length ? linked : all;
}

function levelsOf(criterion) {
  const raw = criterion?.levels;
  const get = (k) => (raw instanceof Map ? raw.get(k) : raw?.[k]);
  return Array.from({ length: RUBRIC_SCORE_MAX + 1 }, (_, i) => [i, String(get(String(i)) ?? "").trim()]).filter(([, d]) => d);
}

/** Danh sách tiêu chí đưa vào prompt. */
export function formatCriteria(criteria) {
  return criteria
    .map((c) => {
      const head = `- criterion_key: ${String(c._id)} | ${c.name}${c.description ? ` — ${clip(c.description, 300)}` : ""}`;
      const levels = levelsOf(c).map(([i, d]) => `    ${i}: ${clip(d, 300)}`);
      return [head, ...(levels.length ? levels : ["    (không có mô tả mức: 0 = không thể hiện, 5 = xuất sắc)"])].join("\n");
    })
    .join("\n");
}

/**
 * Kiểm kết quả LLM: đủ mọi tiêu chí áp dụng, điểm số trong 0–5 (làm tròn), trích dẫn có thật.
 * @throws {Error} khi thiếu tiêu chí hoặc điểm không phải số → câu được đánh `failed`
 */
export function sanitizeRubricScores(parsed, criteria, transcript) {
  const rows = Array.isArray(parsed?.criteria) ? parsed.criteria : [];
  const byKey = new Map(rows.map((r) => [String(r?.criterion_key ?? r?.criterionKey ?? ""), r]));
  return criteria.map((c) => {
    const key = String(c._id);
    const row = byKey.get(key);
    const n = Number(row?.score);
    if (!row || row.score === null || row.score === "" || !Number.isFinite(n)) {
      throw new Error(`LLM thiếu điểm tiêu chí ${key}`);
    }
    return {
      criterionKey: key,
      criterionName: c.name || "",
      shrmKey: c.shrmKey || "",
      weight: Number(c.weight) || 0,
      score: Math.min(RUBRIC_SCORE_MAX, Math.max(0, Math.round(n))),
      evidenceQuote: verifyEvidenceQuote(row.evidence_quote ?? row.evidenceQuote, transcript),
    };
  });
}

async function callAndParse(built, opts) {
  let raw = await callLLM(built.system, built.user, opts);
  try {
    return JSON.parse(extractJson(raw));
  } catch {
    raw = await callLLM(built.jsonRepair, raw, { ...opts, temp: 0, retries: 0, traceName: "rubric_scoring_json_repair" });
    return JSON.parse(extractJson(raw));
  }
}

/** Các câu doanh nghiệp có câu trả lời nhưng chưa chấm xong. */
export function pendingRubricTargets(session) {
  const out = [];
  for (const cq of session?.companyQuestions ?? []) {
    const questionIndex = (session.questions ?? []).findIndex((q) => String(q?.questionBankId ?? "") === String(cq.questionId));
    if (questionIndex < 0) continue;
    const answer = (session.answers ?? []).find((a) => a.questionIndex === questionIndex);
    if (!answer || answer.rubricScoring?.scoredAt) continue;
    out.push({ cq, questionIndex, answer, questionText: session.questions[questionIndex]?.question || "" });
  }
  return out;
}

/**
 * Chấm rubric cho các câu doanh nghiệp còn thiếu trên `session` (document Mongoose) — sửa trực tiếp
 * `answers[i]`, KHÔNG tự lưu: người gọi `session.save()`.
 * @returns {Promise<{ changed: boolean, scored: number, failed: number }>}
 */
export async function scoreCompanyRubrics(session, { userId = null } = {}) {
  const targets = pendingRubricTargets(session);
  if (!targets.length) return { changed: false, scored: 0, failed: 0 };
  if (!isLLMConfigured()) {
    logger.warn("rubric_scoring_skipped_no_llm", { sessionId: String(session._id) });
    return { changed: false, scored: 0, failed: 0 };
  }

  const rubricIds = [...new Set(targets.map((t) => String(t.cq.rubricId ?? "")).filter(Boolean))];
  const rubrics = await CompanyRubric.find({ _id: { $in: rubricIds } }).select("companyId criteria").lean();
  const rubricById = new Map(rubrics.map((r) => [String(r._id), r]));
  const prompt = await getActivePrompt(RUBRIC_SCORING_KEY);
  const model = activeLLMModel("eval");
  let scored = 0;
  let failed = 0;

  await Promise.all(
    targets.map(async ({ cq, questionIndex, answer, questionText }) => {
      const base = { rubricId: cq.rubricId ?? null, companyId: cq.companyId ?? null, promptVersion: prompt.version, model };
      const rubric = rubricById.get(String(cq.rubricId ?? ""));
      const criteria = rubric ? applicableCriteria(rubric, cq.questionId) : [];
      if (!criteria.length) {
        // Rubric bị xóa / rỗng: không chấm được và không thử lại.
        answer.rubricScores = [];
        answer.rubricScoring = { ...base, status: "failed", scoredAt: new Date(), error: "Không tìm thấy rubric của doanh nghiệp." };
        failed += 1;
        return;
      }
      const transcript = String(answer.transcript ?? "").trim();
      if (!transcript) {
        answer.rubricScores = [];
        answer.rubricScoring = { ...base, status: "no_answer", scoredAt: new Date() };
        return;
      }

      const traceId = createTrace({
        name: "rubric_scoring",
        userId,
        metadata: { sessionId: String(session._id), questionIndex, rubricId: String(cq.rubricId), promptVersion: prompt.version, model },
        tags: ["rubric_scoring"],
      });
      try {
        const built = buildRubricScoringPrompt(prompt, {
          question: questionText,
          criteria: formatCriteria(criteria),
          answer: clip(transcript, ANSWER_MAX_CHARS),
        });
        const parsed = await callAndParse(built, {
          maxTokens: 1200,
          temp: 0,
          retries: 1,
          traceId,
          traceName: "rubric_scoring",
          costKind: COST_EVENT_KIND.RUBRIC_SCORING,
          model,
          anthropicModel: model,
        });
        answer.rubricScores = sanitizeRubricScores(parsed, criteria, transcript);
        answer.rubricScoring = { ...base, status: "scored", scoredAt: new Date() };
        finalizeTrace(traceId, "success");
        scored += 1;
      } catch (err) {
        finalizeTrace(traceId, "error", err?.message);
        logger.error("rubric_scoring_failed", { sessionId: String(session._id), questionIndex, error: err?.message });
        answer.rubricScores = [];
        answer.rubricScoring = { ...base, status: "failed", scoredAt: null, error: clip(err?.message, 300) };
        failed += 1;
      }
    }),
  );
  return { changed: true, scored, failed };
}

/**
 * Chấm bù cho session đã có feedback (session chấm trước JB-07, hoặc lần trước LLM lỗi).
 * Giữ khóa `rubricScoringClaimedAt` để 2 request cùng lúc không gọi LLM 2 lần; tự lưu session.
 */
export async function scoreMissingRubricsWithClaim(session, { userId = null } = {}) {
  if (!pendingRubricTargets(session).length) return { changed: false, scored: 0, failed: 0 };
  const now = new Date();
  const claim = await InterviewSession.updateOne(
    {
      _id: session._id,
      $or: [{ rubricScoringClaimedAt: null }, { rubricScoringClaimedAt: { $lt: new Date(now.getTime() - CLAIM_STALE_MS) } }],
    },
    { $set: { rubricScoringClaimedAt: now } },
  );
  if (claim.modifiedCount === 0) return { changed: false, scored: 0, failed: 0 };
  try {
    const result = await scoreCompanyRubrics(session, { userId });
    if (result.changed) await session.save();
    return result;
  } finally {
    await InterviewSession.updateOne({ _id: session._id, rubricScoringClaimedAt: now }, { $set: { rubricScoringClaimedAt: null } });
  }
}

/**
 * Phần rubric trả kèm từng câu trong kết quả `evaluate` (JB-14 hiển thị). Câu không phải của doanh nghiệp
 * không có trong Map → FE không hiện phần này.
 * @returns {Promise<Map<number, { company: {id: string, name: string}|null, rubricStatus: string, rubricScores: object[] }>>}
 */
export async function rubricFeedbackByQuestion(session) {
  const out = new Map();
  const cqs = session?.companyQuestions ?? [];
  if (!cqs.length) return out;
  const companies = await Company.find({ _id: { $in: [...new Set(cqs.map((c) => String(c.companyId)))] } }).select("name").lean();
  const nameById = new Map(companies.map((c) => [String(c._id), c.name]));
  for (const cq of cqs) {
    const questionIndex = (session.questions ?? []).findIndex((q) => String(q?.questionBankId ?? "") === String(cq.questionId));
    if (questionIndex < 0) continue;
    const answer = (session.answers ?? []).find((a) => a.questionIndex === questionIndex);
    const id = String(cq.companyId);
    out.set(questionIndex, {
      company: nameById.has(id) ? { id, name: nameById.get(id) } : null,
      rubricStatus: answer?.rubricScoring?.status ?? "pending",
      rubricScores: (answer?.rubricScores ?? []).map((r) => ({
        criterionKey: r.criterionKey,
        criterionName: r.criterionName,
        shrmKey: r.shrmKey,
        weight: r.weight,
        score: r.score,
        evidenceQuote: r.evidenceQuote,
      })),
    });
  }
  return out;
}
