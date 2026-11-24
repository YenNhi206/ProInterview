/**
 * interviewQuestionService.js
 * Pipeline 3 lớp: SHRM/DDI Knowledge → CV/JD Competency Mapping → LLM Generation
 *
 * Flow:
 *  1. resolveTopCompetencies(position, field, cvText, jdText)
 *     → keyword-based, không tốn LLM token
 *  2. getActivePrompt(key) + buildQuestionGenPrompt / buildEvaluationPrompt (prompts/, AI-02)
 *     → chữ prompt theo PromptVersion active; inject SHRM definitions + DDI Key Actions cho competencies được detect
 *  3. callLLM(systemPrompt, userMsg)
 *     → LLM sinh câu hỏi grounded in SHRM/DDI framework
 *  4. Trả về questions + competencyProfile (lưu vào MongoDB cho accumulation)
 */

import {
  resolveTopCompetencies,
  buildCompetencyPromptBlock,
  buildDistributionGuide,
  COMPETENCY_LIBRARY,
  getFramework,
  isValidCompetencyKey,
} from "./competencyFramework.js";
import { sanitizeUserInput } from "../utils/promptSafety.js";
import { validateQuestionSet } from "../utils/outputValidator.js";
import { logger } from "../config/logger.js";
import { SecurityLog } from "../models/SecurityLog.js";
import { createTrace, logGeneration, finalizeTrace } from "./langfuseService.js";
import { getActivePrompt } from "./promptVersionService.js";
import { buildQuestionGenPrompt, QUESTION_GEN_KEY, QUESTION_GEN_DEFAULT_VERSION } from "../prompts/questionGenPrompt.js";
import { buildEvaluationPrompt, EVALUATION_KEY, EVALUATION_DEFAULT_VERSION } from "../prompts/evaluationPrompt.js";
import {
  indexEvaluations,
  findIncomplete,
  mergeRetry,
  isScoreValue,
  SHRM_LEVELS,
} from "../utils/evaluationCompleteness.js";

// ── Prompt version ────────────────────────────────────────────────────────────
// Chữ của prompt sinh câu / chấm điểm nằm trong PromptVersion (AI-02): loader `getActivePrompt`
// đọc bản active trong DB, lỗi thì dùng bản mặc định ở `prompts/`. Version của prompt THỰC SỰ chạy
// được ghi vào QuestionBank.generatedBy.promptVersion / session.feedback.promptVersion để đo prompt
// drift. Muốn đổi chữ: tạo PromptVersion mới rồi activate, không sửa thẳng trong code.
// Hai hằng số dưới là version của bản mặc định (giữ export cho code/test cũ).
export const FOLLOWUP_PROMPT_VERSION = QUESTION_GEN_DEFAULT_VERSION;
export const EVAL_PROMPT_VERSION     = EVALUATION_DEFAULT_VERSION;

// ── Env config (đọc động để hỗ trợ multi-provider) ───────────────────────────
function cfg() {
  return {
    baseUrl:        process.env.LLM_BASE_URL        ?? "https://api.openai.com/v1",
    apiKey:         process.env.LLM_API_KEY          ?? "",
    model:          process.env.LLM_MODEL            ?? "gpt-4o-mini",
    cvUrl:          process.env.CV_ANALYZER_URL      ?? "http://localhost:8000",
    // Anthropic override (khi set thì dùng Claude thay vì OpenAI-compat provider)
    anthropicKey:   process.env.ANTHROPIC_API_KEY    ?? "",
    anthropicQgen:  process.env.ANTHROPIC_QGEN_MODEL ?? "claude-sonnet-4-5",
    anthropicEval:  process.env.ANTHROPIC_EVAL_MODEL ?? "claude-opus-4-8",
  };
}

function isOllama(baseUrl) {
  return /localhost:11434|ollama/.test(baseUrl);
}

function isAnthropicUrl(baseUrl) {
  return /anthropic\.com/i.test(baseUrl);
}

function isGeminiUrl(baseUrl) {
  return /generativelanguage\.googleapis\.com/i.test(baseUrl);
}

/**
 * Gemini (qua lớp OpenAI-compat) tính thinking tokens VÀO chung `max_tokens`, khác hẳn Groq/OpenAI.
 * Đo thực tế với gemini-2.5-flash: prompt 2.746 + thinking 2.121 + completion 165 = 5.032 token,
 * tức reasoning nuốt gần hết ngân sách trước khi model viết chữ nào → JSON bị cắt giữa chừng
 * (finish_reason "length") → repair vá lại chỉ còn 1 câu → validateQuestionSet fail → HTTP 500.
 * Sinh câu hỏi là tác vụ điền JSON theo schema cố định, chất lượng do prompt SHRM/DDI quyết định
 * chứ không cần chain-of-thought → tắt thinking. Riêng 2.5 Pro KHÔNG tắt được (budget tối thiểu
 * 128) nên chỉ áp cho dòng flash; đặt LLM_REASONING_EFFORT để override thủ công khi cần.
 */
function geminiReasoningEffort(baseUrl, model) {
  if (!isGeminiUrl(baseUrl)) return null;
  const override = process.env.LLM_REASONING_EFFORT?.trim();
  if (override) return override === "default" ? null : override;
  return /flash/i.test(model) ? "none" : null;
}

/**
 * Trả về LLM provider đang active.
 * Ưu tiên: LLM_PROVIDER env > detect từ URL > fallback openai_compat
 * @returns {"anthropic"|"openai_compat"}
 */
/** Tên model thực sự được gọi cho loại tác vụ — ghi vào generatedBy.model. */
export function activeLLMModel(kind = "qgen") {
  const c = cfg();
  // AI-08: sàng lọc khóa học dùng model rẻ (mặc định Haiku / LLM_MODEL), đổi bằng biến môi trường.
  if (kind === "prescreen") {
    if (getLLMProvider() === "anthropic") return process.env.ANTHROPIC_PRESCREEN_MODEL || "claude-haiku-4-5";
    return process.env.LLM_PRESCREEN_MODEL || c.model;
  }
  if (getLLMProvider() === "anthropic") return kind === "eval" ? c.anthropicEval : c.anthropicQgen;
  return c.model;
}

/** Có ít nhất một khóa LLM (OpenAI-compatible hoặc Anthropic) — CO-04 kiểm trước khi gọi. */
export function isLLMConfigured() {
  const { apiKey, anthropicKey } = cfg();
  return Boolean(apiKey || anthropicKey);
}

function getLLMProvider() {
  const explicit = process.env.LLM_PROVIDER?.toLowerCase();
  const { anthropicKey, baseUrl } = cfg();
  if (explicit === "anthropic" && anthropicKey) return "anthropic";
  if (isAnthropicUrl(baseUrl) && anthropicKey) return "anthropic";
  return "openai_compat"; // Groq, Gemini, OpenAI, Ollama, OpenRouter — tất cả OpenAI-compat
}

// ── System prompt helpers (prompt caching) ───────────────────────────────────
// `system` đến từ caller dưới 2 dạng:
//   - string                      → prompt nhỏ, dùng 1 lần (vd: repair prompt) — không cache
//   - { static, dynamic }         → static = phần khung lặp lại mỗi lần gọi (đánh dấu cache_control
//                                    cho Anthropic prompt caching), dynamic = phần thay đổi theo request

/** Chuyển `system` thành payload cho Anthropic `system` field (string | content blocks[]). */
function buildAnthropicSystem(system) {
  if (typeof system === "string") return system; // prompt nhỏ, không đáng cache
  const blocks = [{ type: "text", text: system.static, cache_control: { type: "ephemeral" } }];
  if (system.dynamic) blocks.push({ type: "text", text: system.dynamic });
  return blocks;
}

/** Chuyển `system` thành 1 string duy nhất — dùng cho OpenAI-compat system message + Langfuse logging. */
function systemToText(system) {
  if (typeof system === "string") return system;
  return [system.static, system.dynamic].filter(Boolean).join("\n\n");
}

// ── Anthropic native API call ─────────────────────────────────────────────────
/**
 * @param {string|{static: string, dynamic: string}} system
 * @returns {Promise<{text: string, usage: {inputTokens: number, outputTokens: number, cacheWriteTokens: number, cacheReadTokens: number}}>}
 */
async function callAnthropicLLM(system, user, { maxTokens = 4000, temp = 0.6, model = null } = {}) {
  const { anthropicKey, anthropicQgen } = cfg();
  const useModel = model ?? anthropicQgen;

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method:  "POST",
    headers: {
      "Content-Type":      "application/json",
      "x-api-key":         anthropicKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model:       useModel,
      max_tokens:  maxTokens,
      temperature: temp,
      system:      buildAnthropicSystem(system),
      messages: [{ role: "user", content: user }],
    }),
    signal: AbortSignal.timeout(120_000),
  });

  if (!res.ok) {
    const errBody = await res.text().catch(() => "");
    throw new Error(`Anthropic HTTP ${res.status}: ${errBody.slice(0, 400)}`);
  }

  const data = await res.json();
  return {
    text: data.content?.[0]?.text ?? "",
    usage: {
      inputTokens:      data.usage?.input_tokens               ?? 0,
      outputTokens:     data.usage?.output_tokens              ?? 0,
      cacheWriteTokens: data.usage?.cache_creation_input_tokens ?? 0,
      cacheReadTokens:  data.usage?.cache_read_input_tokens     ?? 0,
    },
  };
}

// ── Fuzzy match (tiếng Việt) ──────────────────────────────────────────────────
function normalizeToken(s) {
  return String(s)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function containsFuzzy(a, b) {
  const na = normalizeToken(a);
  const nb = normalizeToken(b);
  if (!na || !nb) return false;
  return na.includes(nb) || nb.includes(na);
}

// ── Rate-limit aware retry ────────────────────────────────────────────────────
// Groq/OpenAI trả 429 kèm thời gian chờ THẬT (header `retry-after`, hoặc "Please try again in
// 23.3s" nhét trong body). Backoff mũ 1s/2s/4s ngắn hơn con số đó cả chục lần → cả 3 attempt
// rơi vào CÙNG một cửa sổ rate-limit, mà mỗi attempt lại tính thêm (input + max_tokens) vào
// quota TPM → tự làm nghẽn chính mình. Luôn ưu tiên khoảng chờ provider yêu cầu.
const RETRYABLE_STATUS    = new Set([408, 409, 425, 429, 500, 502, 503, 504]);
const MAX_RETRY_WAIT_MS   = 25_000; // chờ lâu hơn thì proxy (Render) có nguy cơ cắt request
const LLM_TOTAL_BUDGET_MS = 60_000; // tổng thời gian tối đa cho 1 callLLM, kể cả thời gian chờ

function parseRetryAfterMs(res, errBody) {
  const header = res.headers?.get?.("retry-after");
  if (header) {
    const secs = Number(header);
    if (Number.isFinite(secs) && secs > 0) return Math.ceil(secs * 1000);
  }
  // Groq không phải lúc nào cũng set header — thời gian chờ nằm trong message lỗi
  const m = /try again in\s+([\d.]+)\s*(ms|s)\b/i.exec(String(errBody ?? ""));
  if (m) {
    const value = Number(m[1]);
    if (Number.isFinite(value) && value > 0) {
      return Math.ceil(m[2].toLowerCase() === "ms" ? value : value * 1000);
    }
  }
  return null;
}

/** Lỗi HTTP từ provider — gắn status để controller map sang 503 thay vì 500 chung chung. */
function buildLLMError(status, errBody, retryAfterMs) {
  const err = new Error(`LLM HTTP ${status}: ${String(errBody).slice(0, 400)}`);
  err.llmStatus = status;
  if (status === 429) err.code = "llm_rate_limited";
  if (retryAfterMs) err.retryAfterMs = retryAfterMs;
  return err;
}

// ── LLM helper ────────────────────────────────────────────────────────────────
/**
 * @param {string|{static: string, dynamic: string}} system - string = prompt nhỏ dùng 1 lần;
 *   {static, dynamic} = static được đánh dấu cache_control (Anthropic prompt caching)
 * @param {string} user
 * @param {object} [opts]
 * @param {number} [opts.maxTokens=4000]
 * @param {number} [opts.temp=0.6]
 * @param {number} [opts.retries=2]
 * @param {string} [opts.traceId]    - Langfuse trace ID (fire-and-forget logging)
 * @param {string} [opts.traceName]  - Tên generation cho Langfuse
 * @param {string} [opts.anthropicModel] - Override Anthropic model (dùng eval model cho evaluation)
 */
/**
 * `costKind`: kind ghi vào CostEvent (mặc định `llm_call`); `model`: đổi model cho provider
 * OpenAI-compatible (Anthropic dùng `anthropicModel`), ví dụ model rẻ cho sàng lọc khóa (AI-08).
 */
export async function callLLM(system, user, { maxTokens = 4000, temp = 0.6, retries = 2, traceId, traceName, anthropicModel, costKind, model: modelOverride } = {}) {
  // QA-01: Chế độ mock LLM bằng biến môi trường để test tải không tốn tiền
  if (process.env.MOCK_AI_SERVICES === "true" || process.env.MOCK_AI === "true") {
    return JSON.stringify({
      inferredRole: "Software Engineer",
      inferredSeniority: "junior",
      questions: [
        {
          id: "mock_q1",
          layer: "theory",
          seniority: "junior",
          competencyId: "technical_learning",
          competencyName: "Học hỏi kỹ thuật & Tự phát triển",
          question: "Bạn hãy giải thích cơ chế Event Loop trong JavaScript?",
          starGuidance: {
            situation: ["Khi xử lý tác vụ bất đồng bộ"],
            task: ["Cần đảm bảo UI không bị block"],
            action: ["Dùng Promise hoặc async/await"],
            result: ["Ứng dụng mượt mà"],
          },
          expectedKeywords: ["call stack", "microtask", "macrotask"],
          deepDive: ["Sự khác nhau giữa setTimeout và Promise.resolve?"],
        },
      ],
      overallScore: 85,
      overall5: 4.25,
      summary: "Ứng viên trả lời lưu loát, nắm vững kiến thức nền tảng.",
      strengths: ["Hiểu rõ mô hình bất đồng bộ"],
      improvements: ["Cần phân tích sâu hơn về memory leak"],
      perQuestion: [
        { questionIndex: 0, overallScore: 85, overall5: 4.25, score: 85, shrmLevel: "Vững" },
      ],
      rubricScores: [],
    });
  }

  const provider = getLLMProvider();
  const startMs  = Date.now();

  // ── Anthropic native API ──────────────────────────────────────────────────
  if (provider === "anthropic") {
    let lastErr;
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const { text: output, usage } = await callAnthropicLLM(system, user, { maxTokens, temp, model: anthropicModel });
        logGeneration({
          traceId,
          name:         traceName ?? "llm_call",
          model:        anthropicModel ?? cfg().anthropicQgen,
          ...(costKind && { costKind }),
          systemPrompt: systemToText(system),
          userPrompt:   user,
          output,
          latencyMs:    Date.now() - startMs,
          usage: {
            inputTokens:      usage.inputTokens,
            outputTokens:     usage.outputTokens,
            totalTokens:      usage.inputTokens + usage.outputTokens + usage.cacheWriteTokens + usage.cacheReadTokens,
            cacheWriteTokens: usage.cacheWriteTokens,
            cacheReadTokens:  usage.cacheReadTokens,
          },
        });
        return output;
      } catch (err) {
        lastErr = err;
        if (attempt < retries) {
          await new Promise(r => setTimeout(r, Math.min(1000 * 2 ** attempt, 8_000)));
        }
      }
    }
    throw lastErr;
  }

  // ── OpenAI-compatible API (Groq, Gemini, OpenAI, OpenRouter, Ollama) ──────
  const { baseUrl, apiKey, model: defaultModel } = cfg();
  const model = modelOverride || defaultModel;
  const deadlineMs = startMs + LLM_TOTAL_BUDGET_MS;
  let lastErr;
  for (let attempt = 0; attempt <= retries; attempt++) {
    // Fallback khi provider không nói rõ phải chờ bao lâu
    let waitMs = Math.min(1000 * 2 ** attempt, 8_000);
    try {
      const useJsonMode = !isOllama(baseUrl);
      const reasoningEffort = geminiReasoningEffort(baseUrl, model);
      const res = await fetch(`${baseUrl.replace(/\/+$/, "")}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: "system", content: systemToText(system) },
            { role: "user",   content: user },
          ],
          temperature: temp,
          max_tokens: maxTokens,
          ...(useJsonMode && { response_format: { type: "json_object" } }),
          ...(reasoningEffort && { reasoning_effort: reasoningEffort }),
        }),
        signal: AbortSignal.timeout(120_000),
      });

      if (!res.ok) {
        const errBody = await res.text().catch(() => "");
        console.error(`[LLM] attempt=${attempt} status=${res.status} body=${errBody.slice(0, 400)}`);
        const retryAfterMs = parseRetryAfterMs(res, errBody);
        const err = buildLLMError(res.status, errBody, retryAfterMs);
        if (!RETRYABLE_STATUS.has(res.status)) throw err;
        lastErr = err;
        // Tôn trọng khoảng chờ provider yêu cầu — thử lại sớm hơn chỉ tốn thêm quota TPM
        waitMs = Math.min(retryAfterMs ?? waitMs, MAX_RETRY_WAIT_MS) + 250;
      } else {
        const data   = await res.json();
        const output = data.choices?.[0]?.message?.content ?? "";

        // Langfuse: log generation nếu có traceId (fire-and-forget)
        logGeneration({
          traceId,
          name:         traceName ?? "llm_call",
          model,
          ...(costKind && { costKind }),
          systemPrompt: systemToText(system),
          userPrompt:   user,
          output,
          latencyMs:    Date.now() - startMs,
          usage: {
            inputTokens:  data.usage?.prompt_tokens,
            outputTokens: data.usage?.completion_tokens,
            totalTokens:  data.usage?.total_tokens,
          },
        });

        return output;
      }
    } catch (err) {
      // Lỗi không thể retry (400 sai model, 401 sai key, …) — fail ngay, đừng đốt thêm quota
      if (err?.llmStatus && !RETRYABLE_STATUS.has(err.llmStatus)) throw err;
      lastErr = err;
    }

    if (attempt >= retries) break;
    // Hết ngân sách thời gian → fail nhanh để FE còn kịp hiện lỗi, thay vì treo tới khi proxy cắt
    if (Date.now() + waitMs > deadlineMs) break;
    await new Promise(r => setTimeout(r, waitMs));
  }
  throw lastErr;
}

export function extractJson(text) {
  const start = text.indexOf("{");
  const end   = text.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("Không tìm thấy JSON trong output LLM");
  return text.slice(start, end + 1);
}

// ── Dynamic System Prompt (SHRM/DDI grounded) ─────────────────────────────────

// Câu hỏi generic tuyệt đối cấm — nếu LLM sinh ra sẽ bị detect và log warning
const GENERIC_QUESTION_PATTERNS = [
  /hãy giới thiệu về bản thân/i,
  /điểm mạnh (lớn nhất|của bạn|nổi bật)/i,
  /điểm yếu (lớn nhất|của bạn)/i,
  /tại sao bạn muốn (ứng tuyển|làm việc|join|đầu quân)/i,
  /trong \d+ năm tới.*muốn/i,
  /nói về bản thân/i,
  /kể về (bản thân|bản thân bạn)/i,
  /lý do (nào|gì) (khiến|để) bạn/i,
];

function validateGeneratedQuestions(questions) {
  const warnings = [];
  const questionTexts = new Set();

  for (const q of questions) {
    // Generic question check
    if (GENERIC_QUESTION_PATTERNS.some(p => p.test(q.question))) {
      warnings.push(`[GENERIC] ${q.id}: "${q.question.slice(0, 80)}"`);
    }
    // Missing DDI Key Action
    if (!q.ddiKeyActionTargeted) {
      warnings.push(`[MISSING_DDI] ${q.id}: ddiKeyActionTargeted trống`);
    }
    // Too short
    if (q.question.length < 40) {
      warnings.push(`[TOO_SHORT] ${q.id}: ${q.question.length} chars`);
    }
    // Missing competency
    if (!q.competencyId || q.competencyId === "unknown") {
      warnings.push(`[NO_COMPETENCY] ${q.id}`);
    }
    // Duplicate question
    const key = q.question.slice(0, 50).toLowerCase();
    if (questionTexts.has(key)) {
      warnings.push(`[DUPLICATE] ${q.id}: "${key}"`);
    }
    questionTexts.add(key);
    // Behavior layer missing STAR guidance
    if (q.layer === "behavior") {
      const sg = q.starGuidance;
      const hasStar = sg?.action?.length > 0 && sg?.result?.length > 0;
      if (!hasStar) warnings.push(`[MISSING_STAR] ${q.id}: behavior câu thiếu star_guidance`);
    }
  }
  return warnings;
}

// Prompt sinh câu: chữ ở `prompts/questionGenPrompt.js` (bản mặc định) hoặc PromptVersion active.
// Phần system tĩnh vẫn là prefix giống hệt nhau giữa các lần gọi cùng version → Anthropic cache được.

// ── Public API ─────────────────────────────────────────────────────────────────

/**
 * Sinh N câu hỏi từ CV + JD, grounded in SHRM/DDI framework.
 * Trả về { questions, inferredRole, inferredSeniority, competencyProfile }.
 *
 * @param {string[]} fewShotExamples - Câu hỏi tốt từ sessions cùng role/field (MongoDB accumulation)
 * @param {number} [questionCount=5] - Số câu cần sinh (2 = follow-up mid-interview)
 * @param {{question: string, transcript: string}[]} [priorQA] - Câu hỏi baseline + câu trả lời thật
 *   của ứng viên (chỉ dùng khi questionCount nhỏ, để đào sâu dựa trên ngữ cảnh thực tế)
 */
export async function generateQuestionsFromText({
  cvText = "",
  jdText = "",
  position = "",
  field = "",
  level = "",
  fewShotExamples = [],
  sessionId = null,
  userId = null,
  questionCount = 5,
  priorQA = [],
}) {
  const { apiKey, anthropicKey } = cfg();
  if (!apiKey && !anthropicKey) {
    throw new Error(
      "LLM chưa được cấu hình. Cần ít nhất 1 trong: LLM_API_KEY (Groq/Gemini/OpenAI) hoặc ANTHROPIC_API_KEY."
    );
  }

  // Prompt theo version active (DB lỗi thì bản mặc định) — version ghi vào câu hỏi và trace.
  const prompt = await getActivePrompt(QUESTION_GEN_KEY);

  // Langfuse trace (fire-and-forget — fail silently)
  const traceId = createTrace({
    name:      "generate_questions",
    userId,
    sessionId,
    metadata:  {
      position, field, cvTextLen: cvText.length, jdTextLen: jdText.length, questionCount, isFollowUp: priorQA.length > 0,
      promptVersion: prompt.version, frameworkVersion: getFramework().version,
    },
    tags:      ["question_generation", "personalized"],
  });

  // Sanitize user-supplied text before injecting into LLM prompts
  const { text: cleanCV, injectionAttempts: cvInjections } = sanitizeUserInput(cvText, 6000);
  const { text: cleanJD, injectionAttempts: jdInjections } = sanitizeUserInput(jdText, 4000);

  // priorQA transcripts are also user-controlled free text fed into the LLM prompt — same
  // injection risk class as cvText/jdText, must go through the same sanitization + counting.
  let priorAnswerInjections = 0;
  const cleanPriorQA = priorQA.map(({ question, transcript }) => {
    const { text: cleanTranscript, injectionAttempts } = sanitizeUserInput(transcript ?? "", 2000);
    priorAnswerInjections += injectionAttempts;
    return { question, transcript: cleanTranscript };
  });

  const totalInjections = cvInjections + jdInjections + priorAnswerInjections;
  if (totalInjections > 0) {
    logger.warn("prompt_injection_attempt", {
      sessionId, userId,
      cvAttempts: cvInjections,
      jdAttempts: jdInjections,
      priorAnswerAttempts: priorAnswerInjections,
    });
    // Fire-and-forget — a logging failure must never block question generation
    SecurityLog.create({
      userId,
      sessionId,
      type: "prompt_injection_attempt",
      details: { cvAttempts: cvInjections, jdAttempts: jdInjections, priorAnswerAttempts: priorAnswerInjections },
    }).catch(err => logger.error("security_log_write_failed", { error: err.message }));
  }

  // Step 1: Resolve competencies (keyword-based, zero LLM cost)
  const { roleCategory, competencyIds } = resolveTopCompetencies(
    position, field,
    cleanCV.slice(0, 4000),
    cleanJD.slice(0, 4000),
    questionCount,
  );

  // Step 2: Lắp prompt từ version — static phần khung (cacheable) + dynamic phần competency/few-shot
  const built = buildQuestionGenPrompt(prompt, {
    competencyBlock:   buildCompetencyPromptBlock(competencyIds),
    distributionGuide: buildDistributionGuide(competencyIds),
    fewShotExamples,
    questionCount,
    priorQA: cleanPriorQA,
    cv: cleanCV,
    jd: cleanJD,
    position, field, level,
  });
  const systemPrompt = built.system;
  const userMsg = built.user;

  // Cấp ngân sách output theo số câu thật thay vì 4000 cứng cho mọi trường hợp:
  //  - Groq tính CẢ max_tokens vào hạn mức tokens-per-minute → xin 4000 cho 2 câu đốt 1/3 hạn
  //    mức 12k TPM ở MỖI request, dính 429 ngay từ lần gọi thứ hai trong cùng một phút.
  //  - Ngược lại, 4000 lại QUÁ CHẶT cho bộ 5 câu: đo thật completion = 3.688 token, chỉ còn 8%
  //    margin, chạm trần là JSON cụt.
  // Đo thực tế (đã tắt thinking): ~720 token/câu. Cấp 1.100/câu + 800 khung ⇒ margin ~50%.
  const genMaxTokens = Math.min(6000, 800 + questionCount * 1100);

  // Step 3: LLM call với SHRM/DDI grounded prompt
  let rawContent = await callLLM(systemPrompt, userMsg, { maxTokens: genMaxTokens, traceId, traceName: "question_generation" });

  let parsed;
  try {
    parsed = JSON.parse(extractJson(rawContent));
  } catch {
    rawContent = await callLLM(built.jsonRepair, rawContent, { maxTokens: genMaxTokens, temp: 0, retries: 1, traceId, traceName: "question_json_repair" });
    parsed = JSON.parse(extractJson(rawContent));
  }

  // Step 3b: Validate output structure + screen for suspicious content
  let validation = validateQuestionSet(parsed, questionCount);
  if (!validation.valid) {
    logger.error("llm_output_invalid", { reason: validation.reason, sessionId, userId });

    if (validation.reason.includes("suspicious")) {
      SecurityLog.create({
        userId,
        sessionId,
        type: "suspicious_output",
        details: { reason: validation.reason, response: rawContent.slice(0, 500) },
      }).catch(err => logger.error("security_log_write_failed", { error: err.message }));
    }

    // One retry at temp=0 — deterministic output is more likely to be well-structured
    logger.warn("llm_output_retry", { reason: validation.reason, sessionId, userId });
    let retryRaw = await callLLM(systemPrompt, userMsg, { temp: 0, maxTokens: genMaxTokens, retries: 1, traceId, traceName: "question_retry" });
    try {
      parsed = JSON.parse(extractJson(retryRaw));
    } catch {
      retryRaw = await callLLM(built.jsonRepairRetry, retryRaw, { maxTokens: genMaxTokens, temp: 0, retries: 1, traceId, traceName: "question_retry_repair" });
      parsed = JSON.parse(extractJson(retryRaw));
    }

    // Lần cuối: chấp nhận thiếu câu (miễn còn ≥1 câu hợp lệ) — degrade còn hơn 500
    validation = validateQuestionSet(parsed, questionCount, { allowFewer: true });
    if (!validation.valid) {
      logger.error("llm_output_still_invalid", { reason: validation.reason, sessionId, userId });
      finalizeTrace(traceId, "error", validation.reason);
      throw new Error(`LLM output không hợp lệ sau retry: ${validation.reason}`);
    }
    if (parsed.questions.length < questionCount) {
      logger.warn("llm_output_fewer_questions", {
        reason: `got_${parsed.questions.length}_of_${questionCount}`, sessionId, userId,
      });
    }
  }

  // Step 4: Normalize sang camelCase + enrich với SHRM rubric
  // Mongoose enum không cho qua giá trị lạ — LLM đôi lúc trả "Chưa xác định" hoặc text tự do
  // thay vì đúng 1 trong các giá trị enum được yêu cầu trong prompt, làm session.save() throw
  // validation error. Check thuộc enum thay vì chỉ check truthy (q.layer || "theory" vẫn lọt
  // qua y hệt string rác nếu nó truthy).
  const LAYER_ENUM     = ["theory", "project", "behavior"];
  const SENIORITY_ENUM = ["intern", "junior", "middle", "senior"];
  const questions = parsed.questions.slice(0, questionCount).map((q, i) => {
    const libEntry = COMPETENCY_LIBRARY[q.competency_id] ?? null;
    return {
      id: q.id || `q${i + 1}`,
      layer: LAYER_ENUM.includes(q.layer) ? q.layer : "theory",
      seniority: SENIORITY_ENUM.includes(q.seniority) ? q.seniority : "junior",
      // PR-06 (đề xuất e): key LLM trả phải có trong bộ tiêu chí LP-01; sai thì lấy key mục tiêu của câu.
      competencyId:   isValidCompetencyKey(q.competency_id)
        ? q.competency_id
        : isValidCompetencyKey(competencyIds[i]) ? competencyIds[i] : "",
      competencyName: q.competency_name || libEntry?.nameVi || "",
      ddiKeyActionTargeted: q.ddi_key_action_targeted || "",
      question: q.question || "",
      starGuidance: {
        situation: q.star_guidance?.situation ?? [],
        task:      q.star_guidance?.task      ?? [],
        action:    q.star_guidance?.action    ?? [],
        result:    q.star_guidance?.result    ?? [],
      },
      expectedKeywords:  q.expected_keywords   ?? [],
      deepDive:          q.deep_dive           ?? [],
      shrmRubricExcellent: q.shrm_rubric_excellent || libEntry?.starRubric?.excellent || "",
    };
  });

  // Step 4b: Quality validation — log warnings, không throw (graceful)
  const warnings = validateGeneratedQuestions(questions);
  if (warnings.length > 0) {
    console.warn("[generateQuestions] Quality warnings:\n" + warnings.map(w => `  ${w}`).join("\n"));
  }

  // Step 5: Build competencyProfile để lưu MongoDB (accumulation)
  const competencyProfile = {
    roleCategory,
    competencyIds,
    competencyCoverage: parsed.competency_coverage ?? competencyIds,
    detectedFromText: competencyIds,
    generatedAt: new Date().toISOString(),
  };

  finalizeTrace(traceId, "success");

  return {
    questions,
    inferredRole:      parsed.inferred_role      || position || "",
    inferredSeniority: parsed.inferred_seniority || "junior",
    competencyProfile,
    model:             activeLLMModel("qgen"),
    promptVersion:     prompt.version,
  };
}

/**
 * Đánh giá 5 câu trả lời bằng LLM theo chuẩn SHRM/DDI.
 * @param {{ questions: object[], answers: {questionIndex: number, transcript: string}[] }} param
 * @returns {{ overallComment: string, perQuestion: object[] }}
 */
export async function evaluateTranscripts({ questions, answers, userId, sessionId, prompt: promptOverride, traceName = "evaluate_session" }) {
  const { apiKey, anthropicKey, anthropicEval } = cfg();
  if (!apiKey && !anthropicKey) throw new Error("LLM chưa được cấu hình.");

  // Prompt theo version active (DB lỗi thì bản mặc định) — version ghi vào feedback và trace.
  // Backtest (AI-04) truyền `prompt` để chấm bằng một version cụ thể, không phải bản active.
  const prompt = promptOverride ?? await getActivePrompt(EVALUATION_KEY);

  const traceId = createTrace({
    name:      traceName,
    userId,
    sessionId,
    metadata:  {
      questionCount: questions.length, answerCount: answers.length,
      promptVersion: prompt.version, frameworkVersion: getFramework().version,
    },
    tags:      ["evaluation"],
  });

  // Prompt chấm theo version active (DB lỗi thì bản mặc định); khối Q&A inject SHRM rubric mỗi câu.
  const built = buildEvaluationPrompt(prompt, { questions, answers });
  const systemPrompt = built.system;
  const qaBlocks = built.buildQaBlocks(questions.map((_, i) => i));

  // Dùng Anthropic Opus cho evaluation nếu enabled (chất lượng đánh giá cao hơn)
  // systemPrompt hoàn toàn static (không phụ thuộc questions/answers) → cache toàn bộ.
  const evalAnthropicModel = anthropicKey ? anthropicEval : undefined;
  const rawContent = await callLLM(systemPrompt, qaBlocks, {
    maxTokens: 3500, temp: 0.2, retries: 2,
    traceId, traceName: "evaluation",
    anthropicModel: evalAnthropicModel,
  });

  let parsed;
  try {
    parsed = JSON.parse(extractJson(rawContent));
  } catch {
    const fixed  = await callLLM(built.jsonRepair, rawContent, { maxTokens: 3000, temp: 0, retries: 1, traceId, traceName: "eval_repair" });
    parsed = JSON.parse(extractJson(fixed));
  }

  // Câu thiếu tiêu chí (hoặc LLM bỏ sót cả câu) → retry LLM CHỈ cho các câu đó, tối đa 1 lần.
  const expectedIndexes = questions.map((_, i) => i);
  const byIndex = indexEvaluations(parsed.questions, expectedIndexes);
  let incomplete = findIncomplete(byIndex, expectedIndexes);
  if (incomplete.size > 0) {
    logger.warn("evaluation_incomplete_retry", { sessionId, questionIndexes: [...incomplete.keys()] });
    try {
      const retryBlocks = built.buildQaBlocks([...incomplete.keys()]);
      const retryRaw = await callLLM(systemPrompt, retryBlocks, {
        maxTokens: 2500, temp: 0, retries: 1,
        traceId, traceName: "evaluation_incomplete_retry",
        anthropicModel: evalAnthropicModel,
      });
      const retryParsed = JSON.parse(extractJson(retryRaw));
      const retryByIndex = indexEvaluations(retryParsed.questions, [...incomplete.keys()]);
      for (const idx of incomplete.keys()) byIndex.set(idx, mergeRetry(byIndex.get(idx), retryByIndex.get(idx)));
    } catch (err) {
      logger.warn("evaluation_incomplete_retry_failed", { sessionId, error: err?.message });
    }
    incomplete = findIncomplete(byIndex, expectedIndexes);
  }

  // Vẫn thiếu sau retry: giữ fallback 3 như cũ nhưng đánh dấu để vào hàng đợi moderator.
  const perQuestion = expectedIndexes.map((idx) => {
    const q = byIndex.get(idx) ?? {};
    const incompleteFields = incomplete.get(idx) ?? [];
    const scores = {
      clarity:     clamp(isScoreValue(q.scores?.clarity)     ? q.scores.clarity     : 3),
      structure:   clamp(isScoreValue(q.scores?.structure)   ? q.scores.structure   : 3),
      relevance:   clamp(isScoreValue(q.scores?.relevance)   ? q.scores.relevance   : 3),
      credibility: clamp(isScoreValue(q.scores?.credibility) ? q.scores.credibility : 3),
    };
    const meanScore = (scores.clarity + scores.structure + scores.relevance + scores.credibility) / 4;
    return {
      questionIndex: idx,
      scores,
      overall:     clamp(isScoreValue(q.overall) ? q.overall : meanScore),
      // AI-13: giá trị lạ / thiếu → "" (FE hiện "Chưa đủ dữ liệu"), không gán "proficient".
      shrmLevel:   SHRM_LEVELS.includes(q.shrm_level) ? q.shrm_level : "",
      strengths:    Array.isArray(q.strengths)    ? q.strengths    : [],
      improvements: Array.isArray(q.improvements) ? q.improvements : [],
      suggestion:   q.suggestion ?? "",
      evaluationIncomplete: incompleteFields.length > 0,
      incompleteFields,
    };
  });

  finalizeTrace(traceId, "success");
  return { overallComment: parsed.overall_comment ?? "", perQuestion, promptVersion: prompt.version };
}

function clamp(v, min = 0, max = 5) {
  return Math.min(max, Math.max(min, Number(v) || 0));
}

/**
 * Coverage score: so khớp expected_keywords với nội dung CV+JD.
 */
export function computeCoverage(questions, combinedText) {
  const allKeywords = questions.flatMap(q => q.expectedKeywords ?? []);
  if (!allKeywords.length) return { keywordScore: 0, skillScore: 0 };

  const tokens = combinedText.split(/[\s,;.()\[\]{}"']+/).filter(Boolean);
  const coveredCount = allKeywords.filter(kw =>
    tokens.some(t => containsFuzzy(t, kw))
  ).length;

  const score = Math.round((coveredCount / allKeywords.length) * 100);
  return { keywordScore: score, skillScore: score };
}

/**
 * Extract text từ PDF CV qua Python service.
 */
export async function extractPDFText(fileBuffer, filename, mimetype = "application/pdf") {
  const { cvUrl } = cfg();
  const formData = new FormData();
  const blob = new Blob([fileBuffer], { type: mimetype });
  formData.append("file", blob, filename);

  const res = await fetch(`${cvUrl}/extract-text`, {
    method: "POST",
    body: formData,
    signal: AbortSignal.timeout(60_000),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(`Python extract-text thất bại (${res.status}): ${errText.slice(0, 200)}`);
  }

  const data = await res.json();
  return { text: data.text ?? "", pageCount: data.page_count ?? 0 };
}
