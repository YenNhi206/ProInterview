/**
 * Backtest đề xuất cải tiến AI (AI-04, REQ AIS-06, DESIGN.md mục 6 bước 3).
 *
 * Chấm cùng một bộ câu trả lời bằng bản prompt TRƯỚC (`proposal.before.version`) và SAU
 * (`proposal.after.version`), rồi lưu kết quả vào `proposal.backtest` để Platform Mod so sánh trước
 * khi duyệt (AI-05):
 *   - Bộ 20 câu chuẩn AI-01 (`data/ai01/answers.json` + `gold.json`): độ lệch so với điểm chuẩn
 *     (lệch tuyệt đối trung bình, lệch có dấu, tỉ lệ trùng mức, tỉ lệ lệch ≤ 1 mức).
 *   - 10 câu trả lời cũ trong DB: ưu tiên câu moderator đã chấm lại (điểm moderator làm mốc), trừ câu
 *     đã thành few-shot của bản sau (tránh chấm lại chính ví dụ mẫu); còn thiếu thì lấy câu đã chấm gần
 *     nhất cùng năng lực của nhóm. Câu không có mốc chỉ đo mức thay đổi giữa hai bản.
 *
 * Điểm AI (0–5) quy ra mức LP-01 bằng `aiAnswerToLevel` (cùng hệ số `aiCalibration` như production).
 * Chỉ áp dụng cho target `evaluation`: đề xuất `question_gen` không có bộ chuẩn để chấm, ghi
 * `status: "not_applicable"`. Backtest không đổi trạng thái đề xuất và không bật version nào.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { AIImprovementProposal } from "../models/AIImprovementProposal.js";
import { InterviewSession } from "../models/InterviewSession.js";
import { EVALUATION_KEY } from "../prompts/evaluationPrompt.js";
import { getPromptByVersion } from "./promptVersionService.js";
import { aiAnswerToLevel, getCompetency, getFramework } from "./competencyFramework.js";
import { GENERAL_GROUP } from "./aiImprovementMinerService.js";
import { httpError } from "../utils/apiErrors.js";
import { logger } from "../config/logger.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const AI01_DIR = path.resolve(__dirname, "../data/ai01");

/** Số câu trả lời cũ lấy từ DB. */
export const OLD_ANSWER_COUNT = 10;
/** Số câu gửi trong một lần gọi LLM (bằng số câu một buổi phỏng vấn). */
export const BATCH_SIZE = 5;
/** |MAE sau − MAE trước| dưới ngưỡng này coi là không đổi. */
export const SAME_EPSILON = 0.05;

const round = (n, d = 3) => (n === null || n === undefined ? null : Math.round(n * 10 ** d) / 10 ** d);

/** Bộ AI-01 đã ghép điểm chuẩn. Câu chưa có điểm chuẩn bị bỏ. */
export function loadAi01Dataset(dir = AI01_DIR) {
  const answers = JSON.parse(readFileSync(path.join(dir, "answers.json"), "utf8"));
  const gold = JSON.parse(readFileSync(path.join(dir, "gold.json"), "utf8"));
  const goldById = new Map((gold.items ?? []).map((g) => [g.id, g.gold]));
  const items = answers.items
    .filter((it) => Number.isFinite(goldById.get(it.id)))
    .map((it) => ({ ...it, gold: goldById.get(it.id) }));
  return { version: answers.version, items };
}

/** Câu hỏi dạng `InterviewSession.questions[]` cho `buildEvaluationPrompt`. */
function questionFromCompetency({ question, competencyId, layer }) {
  const c = getCompetency(competencyId);
  return {
    question,
    competencyId,
    layer: layer || "behavior",
    competencyName: c?.nameVi ?? competencyId ?? "",
    ddiKeyActionTargeted: Array.isArray(c?.ddiKeyActions) ? c.ddiKeyActions.join("; ") : "",
    shrmRubricExcellent: c?.starRubric?.excellent ?? "",
  };
}

/** Điểm thống kê của một bản prompt so với mốc. `pairs`: [{ level, reference }]. */
export function deviationStats(pairs) {
  const rows = pairs.filter((p) => Number.isFinite(p.reference));
  const scored = rows.filter((p) => Number.isFinite(p.level));
  if (!scored.length) return { n: 0, unscored: rows.length, mae: null, bias: null, exact: null, within1: null };
  let abs = 0;
  let signed = 0;
  let exact = 0;
  let within1 = 0;
  for (const { level, reference } of scored) {
    const d = level - reference;
    abs += Math.abs(d);
    signed += d;
    if (Math.round(level) === reference) exact += 1;
    if (Math.abs(d) <= 1) within1 += 1;
  }
  const n = scored.length;
  return {
    n,
    unscored: rows.length - n,
    mae: round(abs / n),
    bias: round(signed / n),
    exact: round(exact / n),
    within1: round(within1 / n),
  };
}

/** "better" | "worse" | "same" | null theo MAE (thấp hơn là tốt hơn). */
export function verdictOf(beforeMae, afterMae, epsilon = SAME_EPSILON) {
  if (!Number.isFinite(beforeMae) || !Number.isFinite(afterMae)) return null;
  const delta = afterMae - beforeMae;
  if (Math.abs(delta) < epsilon) return "same";
  return delta < 0 ? "better" : "worse";
}

async function defaultEvaluate(args) {
  const { evaluateTranscripts } = await import("./interviewQuestionService.js");
  return evaluateTranscripts(args);
}

/**
 * Chấm danh sách câu bằng một prompt, theo lô `BATCH_SIZE`. Trả mức LP-01 (hoặc null) theo thứ tự.
 * Lô lỗi → các câu trong lô là null (không chặn lô khác).
 */
async function scoreWithPrompt(prompt, rows, { evaluate, calibration }) {
  const levels = [];
  for (let start = 0; start < rows.length; start += BATCH_SIZE) {
    const batch = rows.slice(start, start + BATCH_SIZE);
    const questions = batch.map((r) => r.question);
    const answers = batch.map((r, i) => ({ questionIndex: i, transcript: r.transcript }));
    try {
      const result = await evaluate({ questions, answers, prompt, traceName: "ai_backtest" });
      const byIndex = new Map((result?.perQuestion ?? []).map((q) => [q.questionIndex, q]));
      batch.forEach((_, i) => {
        const level = aiAnswerToLevel(byIndex.get(i), { answer: answers[i], calibration });
        levels.push(Number.isFinite(level) ? round(level, 2) : null);
      });
    } catch (err) {
      logger.warn("ai_backtest_batch_failed", { version: prompt.version, start, error: err?.message });
      batch.forEach(() => levels.push(null));
    }
  }
  return levels;
}

const normalize = (s) => String(s ?? "").replace(/\s+/g, " ").trim();

/** Câu trả lời cũ trong DB cho nhóm của đề xuất. */
export async function collectOldAnswers(proposal, { limit = OLD_ANSWER_COUNT, calibration } = {}) {
  const fewShotInputs = (proposal.after?.fewShotExamples ?? []).map((e) => normalize(e.input));
  const usedAsExample = (transcript) => {
    // Few-shot cắt transcript dài (`clip`) → so 200 ký tự đầu.
    const t = normalize(transcript).slice(0, 200);
    return Boolean(t) && fewShotInputs.some((input) => input.includes(t));
  };
  const groupKey = proposal.groupKey;
  const competencyFilter = groupKey && groupKey !== GENERAL_GROUP ? { "questions.competencyId": groupKey } : {};

  const sessions = await InterviewSession.find({ status: "completed", "answers.transcript": { $nin: [null, ""] }, ...competencyFilter })
    .sort({ completedAt: -1, _id: -1 })
    .limit(200)
    .select("questions answers.questionIndex answers.transcript answers.moderatorOverride")
    .lean();

  const withOverride = [];
  const plain = [];
  for (const s of sessions) {
    for (const a of s.answers ?? []) {
      const q = s.questions?.[a.questionIndex];
      if (!q || !normalize(a.transcript)) continue;
      if (groupKey && groupKey !== GENERAL_GROUP && q.competencyId !== groupKey) continue;
      if (usedAsExample(a.transcript)) continue;
      const override = a.moderatorOverride;
      const reference = override && Number.isFinite(override.overall)
        ? aiAnswerToLevel({ moderatorOverride: override }, { calibration })
        : null;
      const row = {
        sessionId: s._id,
        questionIndex: a.questionIndex,
        competencyId: q.competencyId || "",
        reference: Number.isFinite(reference) ? reference : null,
        transcript: a.transcript,
        question: q.question ? {
          ...questionFromCompetency({ question: q.question, competencyId: q.competencyId, layer: q.layer }),
          ...(q.competencyName && { competencyName: q.competencyName }),
          ...(q.ddiKeyActionTargeted && { ddiKeyActionTargeted: q.ddiKeyActionTargeted }),
          ...(q.shrmRubricExcellent && { shrmRubricExcellent: q.shrmRubricExcellent }),
        } : null,
      };
      if (!row.question) continue;
      (row.reference !== null ? withOverride : plain).push(row);
    }
  }
  return [...withOverride, ...plain].slice(0, limit);
}

/**
 * Chạy backtest cho một đề xuất và ghi `proposal.backtest`.
 * @param {string|import("mongoose").Types.ObjectId} proposalId
 * @param {{ evaluate?: Function, dataset?: object, oldAnswerLimit?: number }} [opts]
 *   `evaluate`: thay `evaluateTranscripts` (test); `dataset`: thay bộ AI-01.
 * @returns {Promise<object>} `backtest` đã lưu
 */
export async function runBacktest(proposalId, { evaluate = defaultEvaluate, dataset, oldAnswerLimit = OLD_ANSWER_COUNT } = {}) {
  const proposal = await AIImprovementProposal.findById(proposalId).lean();
  if (!proposal) throw httpError(404, "Không tìm thấy đề xuất cải tiến AI.");

  const ranAt = new Date();
  if (proposal.target !== "evaluation") {
    const backtest = {
      status: "not_applicable",
      ranAt,
      reason: "Backtest chỉ áp dụng cho prompt chấm điểm; bộ AI-01 không đo được prompt sinh câu.",
    };
    await AIImprovementProposal.updateOne({ _id: proposal._id }, { $set: { backtest } });
    return backtest;
  }

  const calibration = getFramework().aiCalibration;
  try {
    const promptKey = proposal.after?.promptKey || EVALUATION_KEY;
    const [beforePrompt, afterPrompt] = await Promise.all([
      getPromptByVersion(promptKey, proposal.before?.version),
      getPromptByVersion(promptKey, proposal.after?.version),
    ]);

    const ai01 = dataset ?? loadAi01Dataset();
    const goldRows = ai01.items.map((it) => ({
      id: it.id,
      competencyId: it.competencyId,
      reference: it.gold,
      transcript: it.transcript,
      question: questionFromCompetency(it),
    }));
    const oldRows = await collectOldAnswers(proposal, { limit: oldAnswerLimit, calibration });

    const all = [...goldRows, ...oldRows];
    const [beforeLevels, afterLevels] = await Promise.all([
      scoreWithPrompt(beforePrompt, all, { evaluate, calibration }),
      scoreWithPrompt(afterPrompt, all, { evaluate, calibration }),
    ]);

    const items = goldRows.map((r, i) => ({
      id: r.id, competencyId: r.competencyId, gold: r.reference, before: beforeLevels[i], after: afterLevels[i],
    }));
    const oldAnswers = oldRows.map((r, j) => {
      const i = goldRows.length + j;
      return {
        sessionId: r.sessionId, questionIndex: r.questionIndex, competencyId: r.competencyId,
        reference: r.reference, before: beforeLevels[i], after: afterLevels[i],
      };
    });

    const gold = {
      before: deviationStats(items.map((r) => ({ level: r.before, reference: r.gold }))),
      after: deviationStats(items.map((r) => ({ level: r.after, reference: r.gold }))),
    };
    // Mức thay đổi giữa hai bản trên câu cũ (kể cả câu không có mốc moderator).
    const changed = oldAnswers.filter((r) => Number.isFinite(r.before) && Number.isFinite(r.after));
    const old = {
      count: oldAnswers.length,
      withReference: oldAnswers.filter((r) => r.reference !== null).length,
      before: deviationStats(oldAnswers.map((r) => ({ level: r.before, reference: r.reference }))),
      after: deviationStats(oldAnswers.map((r) => ({ level: r.after, reference: r.reference }))),
      meanAbsChange: changed.length
        ? round(changed.reduce((s, r) => s + Math.abs(r.after - r.before), 0) / changed.length)
        : null,
    };

    const maeDelta = Number.isFinite(gold.before.mae) && Number.isFinite(gold.after.mae)
      ? round(gold.after.mae - gold.before.mae)
      : null;
    const backtest = {
      status: gold.before.n && gold.after.n ? "done" : "failed",
      ranAt,
      dataset: ai01.version,
      calibration: { offset: calibration?.offset ?? 0, maxLevel: calibration?.maxLevel ?? null, status: calibration?.status ?? "" },
      beforeVersion: beforePrompt.version,
      afterVersion: afterPrompt.version,
      gold,
      old,
      maeDelta,
      verdict: verdictOf(gold.before.mae, gold.after.mae),
      items,
      oldAnswers,
      ...(gold.before.n && gold.after.n ? {} : { error: "LLM không chấm được câu nào trong bộ AI-01." }),
    };
    await AIImprovementProposal.updateOne({ _id: proposal._id }, { $set: { backtest } });
    logger.info("ai_backtest_done", {
      proposalId: String(proposal._id), before: backtest.beforeVersion, after: backtest.afterVersion,
      maeBefore: gold.before.mae, maeAfter: gold.after.mae, verdict: backtest.verdict,
    });
    return backtest;
  } catch (err) {
    const backtest = { status: "failed", ranAt, error: err?.message ?? String(err) };
    await AIImprovementProposal.updateOne({ _id: proposal._id }, { $set: { backtest } });
    logger.error("ai_backtest_failed", { proposalId: String(proposal._id), error: backtest.error });
    return backtest;
  }
}

/** Backtest mọi đề xuất `proposed` chưa có kết quả (`backtest: null`). Dùng cho job và script. */
export async function backtestPendingProposals(opts = {}) {
  const pending = await AIImprovementProposal.find({ status: "proposed", backtest: null }).select("_id").lean();
  const results = [];
  for (const { _id } of pending) {
    results.push({ proposalId: _id, backtest: await runBacktest(_id, opts) });
  }
  return results;
}
