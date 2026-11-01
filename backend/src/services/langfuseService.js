/**
 * langfuseService.js
 * Langfuse observability — trace LLM calls (question gen + evaluation).
 * Fire-and-forget: tracing failures never block the main flow.
 *
 * Env vars required:
 *   LANGFUSE_PUBLIC_KEY=pk-lf-...
 *   LANGFUSE_SECRET_KEY=sk-lf-...
 *   LANGFUSE_HOST=https://cloud.langfuse.com   (optional, default shown)
 */

import { randomUUID } from "crypto";
import { calcLLMCost } from "./costCalculator.js";
import { recordCostEvent } from "./costLedgerService.js";

// traceId → { userId, tags } — để logGeneration/logEvent biết userId/tags của trace gốc
// khi ghi vào cost ledger (Langfuse ingest body không cần userId lặp lại ở mỗi generation,
// nhưng ledger Mongo cần để aggregate theo cohort).
const traceContext = new Map();
const TRACE_CONTEXT_TTL_MS = 30 * 60 * 1000; // dọn sau 30 phút tránh leak memory

function cfg() {
  return {
    publicKey: process.env.LANGFUSE_PUBLIC_KEY ?? "",
    secretKey:  process.env.LANGFUSE_SECRET_KEY  ?? "",
    host:       process.env.LANGFUSE_HOST         ?? "https://cloud.langfuse.com",
  };
}

export function isLangfuseEnabled() {
  const { publicKey, secretKey } = cfg();
  return Boolean(publicKey && secretKey);
}

/**
 * Gửi batch ingestion events đến Langfuse API.
 * Fire-and-forget — không await, không throw.
 */
function ingest(events) {
  if (!isLangfuseEnabled()) return;
  const { publicKey, secretKey, host } = cfg();
  const auth = Buffer.from(`${publicKey}:${secretKey}`).toString("base64");
  fetch(`${host}/api/public/ingestion`, {
    method:  "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization:  `Basic ${auth}`,
    },
    body: JSON.stringify({ batch: events }),
  }).catch(() => {}); // never let tracing break the main flow
}

/**
 * Tạo một Langfuse trace (session gốc cho 1 phỏng vấn hoặc 1 evaluation run).
 * Trả về traceId để dùng khi log generations.
 *
 * @param {object} opts
 * @param {string} opts.name       - Tên trace ("generate_questions" | "evaluate_session")
 * @param {string} [opts.userId]   - userId từ req.userId
 * @param {string} [opts.sessionId] - MongoDB sessionId nếu có
 * @param {object} [opts.metadata]
 * @param {string[]} [opts.tags]   - Tags để filter/group trong dashboard (vd: ["question_generation", "personalized"])
 * @returns {string} traceId
 */
export function createTrace({ name, userId, sessionId, metadata = {}, tags = [] }) {
  const traceId = randomUUID();
  ingest([{
    id:        randomUUID(),
    type:      "trace-create",
    timestamp: new Date().toISOString(),
    body: {
      id:        traceId,
      name,
      userId:    userId ? String(userId) : undefined,
      sessionId: sessionId ? String(sessionId) : undefined,
      metadata,
      tags,
    },
  }]);

  traceContext.set(traceId, { userId, tags });
  // unref: timer dọn map không được giữ process sống (test runner / graceful shutdown).
  setTimeout(() => traceContext.delete(traceId), TRACE_CONTEXT_TTL_MS).unref();

  return traceId;
}

/**
 * Log 1 LLM generation (1 lần gọi callLLM) vào trace đã tạo.
 *
 * @param {object} opts
 * @param {string} opts.traceId
 * @param {string} opts.name        - Tên generation ("question_gen" | "evaluation")
 * @param {string} opts.model       - Model name (LLM_MODEL)
 * @param {string} opts.systemPrompt
 * @param {string} opts.userPrompt
 * @param {string} opts.output      - Raw LLM output
 * @param {number} opts.latencyMs
 * @param {object} [opts.usage]     - { inputTokens, outputTokens, totalTokens, cacheWriteTokens, cacheReadTokens }
 * @param {object} [opts.metadata]
 */
export function logGeneration({
  traceId,
  name,
  model,
  systemPrompt,
  userPrompt,
  output,
  latencyMs,
  usage = {},
  metadata = {},
}) {
  if (!traceId) return;
  const generationId = randomUUID();
  const endTime = new Date();
  const startTime = new Date(endTime - latencyMs);

  const cost = calcLLMCost({
    model,
    inputTokens:      usage.inputTokens      ?? 0,
    outputTokens:     usage.outputTokens     ?? 0,
    cacheWriteTokens: usage.cacheWriteTokens ?? 0,
    cacheReadTokens:  usage.cacheReadTokens  ?? 0,
  });

  ingest([{
    id:        randomUUID(),
    type:      "generation-create",
    timestamp: startTime.toISOString(),
    body: {
      id:         generationId,
      traceId,
      name,
      model,
      startTime:  startTime.toISOString(),
      endTime:    endTime.toISOString(),
      input: {
        system: systemPrompt?.slice(0, 2000), // truncate for storage
        user:   userPrompt?.slice(0, 2000),
      },
      output:     output?.slice(0, 4000),
      usage: {
        input:  usage.inputTokens  ?? undefined,
        output: usage.outputTokens ?? undefined,
        total:  usage.totalTokens  ?? undefined,
        unit:   "TOKENS",
      },
      usageDetails: {
        input:                       usage.inputTokens      ?? 0,
        output:                      usage.outputTokens     ?? 0,
        cache_creation_input_tokens: usage.cacheWriteTokens ?? 0,
        cache_read_input_tokens:     usage.cacheReadTokens  ?? 0,
      },
      costDetails: {
        input:      cost.breakdown.inputCost + cost.breakdown.cacheWriteCost,
        output:     cost.breakdown.outputCost,
        cache_read: cost.breakdown.cacheReadCost,
        total:      cost.usd,
      },
      metadata: {
        ...metadata,
        costUsd:          cost.usd,
        costVnd:          Math.round(cost.vnd),
        cacheReadTokens:  usage.cacheReadTokens  ?? 0,
        cacheWriteTokens: usage.cacheWriteTokens ?? 0,
        cacheHit:         (usage.cacheReadTokens ?? 0) > 0,
      },
    },
  }]);

  const ctx = traceContext.get(traceId) ?? {};
  recordCostEvent({
    kind:      "llm_call",
    tags:      ctx.tags ?? [],
    userId:    ctx.userId,
    model,
    costUsd:   cost.usd,
    costVnd:   cost.vnd,
    fromCache: (usage.cacheReadTokens ?? 0) > 0,
    metadata:  { name, cacheReadTokens: usage.cacheReadTokens ?? 0, cacheWriteTokens: usage.cacheWriteTokens ?? 0 },
  });
}

/**
 * Log 1 sự kiện không phải LLM (TTS, avatar video gen, ...) — vẫn cần track chi phí
 * và cache hit/miss cho dashboard Phase 0.
 *
 * @param {object} opts
 * @param {string} opts.traceId
 * @param {string} opts.name       - "tts_elevenlabs" | "avatar_video_did" | ...
 * @param {object} [opts.input]
 * @param {object} [opts.output]
 * @param {object} [opts.metadata] - Nên chứa { costUsd, costVnd, fromCache, ... }
 */
export function logEvent({ traceId, name, input = {}, output = {}, metadata = {} }) {
  if (!traceId) return;
  ingest([{
    id:        randomUUID(),
    type:      "event-create",
    timestamp: new Date().toISOString(),
    body: {
      id: randomUUID(),
      traceId,
      name,
      input,
      output,
      metadata,
    },
  }]);

  const ctx = traceContext.get(traceId) ?? {};
  recordCostEvent({
    kind:      name, // "tts_elevenlabs" | "avatar_video_did"
    tags:      ctx.tags ?? [],
    userId:    ctx.userId,
    costUsd:   metadata.costUsd ?? 0,
    costVnd:   metadata.costVnd ?? 0,
    fromCache: Boolean(metadata.fromCache),
    metadata,
  });
}

/**
 * Đánh dấu trace là completed hoặc error.
 * @param {string} traceId
 * @param {"success"|"error"} level
 * @param {string} [statusMessage]
 */
export function finalizeTrace(traceId, level = "success", statusMessage) {
  if (!traceId) return;
  ingest([{
    id:        randomUUID(),
    type:      "trace-create", // update existing trace
    timestamp: new Date().toISOString(),
    body: {
      id:     traceId,
      level,
      ...(statusMessage && { statusMessage }),
    },
  }]);
}
