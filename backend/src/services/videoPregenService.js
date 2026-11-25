/**
 * videoPregenService.js
 * Pre-generation orchestrator — sinh toàn bộ video phỏng vấn trước khi bắt đầu.
 *
 * Flow:
 *   1. Nhận danh sách câu hỏi (text[]) từ controller
 *   2. Chạy song song pregenerateVideos() cho tất cả câu
 *   3. Trả về array video URLs theo thứ tự questions[]
 *   4. Progress tracking qua in-memory Map (client poll /status/:jobId)
 *
 * Tại sao không dùng job queue (Bull/BullMQ)?
 * Với 5-10 câu hỏi và render ~10-30s/câu, tổng thời gian 30-90s.
 * HTTP request có timeout 2 phút trên Render → đủ cho parallel generation.
 * Không cần thêm Redis queue overhead cho MVP.
 */

import { randomUUID } from "crypto";
import { pregenerateVideos, isAvatarVideoEnabled, avatarVideoMissingConfigMessage } from "./avatarService.js";
import { createTrace, finalizeTrace } from "./langfuseService.js";
import { logger } from "../config/logger.js";

// In-memory job store (tồn tại trong process — đủ cho 1 Render instance)
const jobStore = new Map();
// Cleanup jobs cũ hơn 30 phút
const JOB_TTL_MS = 30 * 60 * 1000;

/** Xóa jobs cũ (chạy khi tạo job mới, không cần cron) */
function pruneOldJobs() {
  const now = Date.now();
  for (const [id, job] of jobStore.entries()) {
    if (now - job.createdAt > JOB_TTL_MS) jobStore.delete(id);
  }
}

/**
 * Trạng thái job:
 *   pending  → đang chờ bắt đầu
 *   running  → đang render (done/total tracks progress)
 *   done     → tất cả video đã render xong
 *   error    → có lỗi nghiêm trọng
 */

/**
 * Bắt đầu pre-generation job (async, không await toàn bộ).
 * Trả về jobId ngay lập tức để frontend poll tiến độ.
 *
 * @param {string[]} questions  - Danh sách câu hỏi text
 * @param {object}  opts        - { gender, voiceId, avatarImageUrl }
 * @returns {string} jobId
 */
export function startPregenerationJob(questions, opts = {}) {
  pruneOldJobs();

  const jobId = randomUUID();
  const total  = questions.length;

  const job = {
    jobId,
    status:    "running",
    total,
    done:      0,
    videoUrls: new Array(total).fill(null),  // kết quả theo index
    errors:    [],
    createdAt: Date.now(),
    completedAt: null,
  };
  jobStore.set(jobId, job);

  // Bắt đầu render async — không await để trả jobId ngay
  runPregeneration(jobId, questions, opts);

  return jobId;
}

async function runPregeneration(jobId, questions, opts) {
  const job = jobStore.get(jobId);
  if (!job) return;

  logger.info("pregen_start", { jobId, total: questions.length });

  // Phase 0 cost tracking: 1 trace cho cả pregen job (gồm TTS + video gen events)
  const traceId = createTrace({
    name:     "avatar_pregen",
    userId:   opts.userId,
    metadata: { jobId, totalQuestions: questions.length },
    tags:     ["avatar_pregen"],
  });
  const pregenOpts = { ...opts, traceId };

  try {
    const results = await pregenerateVideos(
      questions,
      pregenOpts,
      // Progress callback
      (done, total) => {
        const j = jobStore.get(jobId);
        if (j) j.done = done;
      }
    );

    // Update job with results
    const j = jobStore.get(jobId);
    if (!j) return;

    for (let i = 0; i < results.length; i++) {
      j.videoUrls[i] = results[i].videoUrl ?? null;
      if (results[i].error) j.errors.push({ questionIndex: i, error: results[i].error });
    }

    j.done        = questions.length;
    j.status      = j.errors.length === questions.length ? "error" : "done";
    j.completedAt = Date.now();

    const durationMs = j.completedAt - j.createdAt;
    logger.info("pregen_complete", {
      jobId,
      total:      questions.length,
      errorCount: j.errors.length,
      durationMs,
      cacheHits:  results.filter(r => r.fromCache).length,
    });

    finalizeTrace(traceId, j.status === "error" ? "error" : "success");
  } catch (err) {
    const j = jobStore.get(jobId);
    if (j) {
      j.status = "error";
      j.errors.push({ questionIndex: -1, error: err.message });
      j.completedAt = Date.now();
    }
    logger.error("pregen_failed", { jobId, error: err.message });
    finalizeTrace(traceId, "error", err.message);
  }
}

/**
 * Lấy trạng thái của job.
 * @param {string} jobId
 * @returns {object|null}
 */
export function getPregenerationStatus(jobId) {
  const job = jobStore.get(jobId);
  if (!job) return null;
  return {
    jobId:      job.jobId,
    status:     job.status,
    total:      job.total,
    done:       job.done,
    progress:   Math.round((job.done / job.total) * 100),
    videoUrls:  job.status === "done" || job.status === "error" ? job.videoUrls : null,
    errors:     job.errors,
    durationMs: job.completedAt ? job.completedAt - job.createdAt : null,
  };
}

/**
 * Pre-generate toàn bộ và đợi kết quả (synchronous version).
 * Dùng khi muốn trả hết kết quả trong 1 request (thay vì polling).
 *
 * @param {string[]} questions
 * @param {object} opts
 * @param {AbortSignal} [signal] - Dừng polling khi HTTP client ngắt kết nối
 * @returns {Promise<{videoUrls: string[], errors: object[], durationMs: number, cacheHits: number}>}
 */
export async function pregenerateSync(questions, opts = {}, signal) {
  if (!isAvatarVideoEnabled()) {
    throw new Error(avatarVideoMissingConfigMessage());
  }

  const startMs = Date.now();

  // Phase 0 cost tracking: 1 trace cho cả lượt sync pregen
  const traceId = createTrace({
    name:     "avatar_pregen",
    userId:   opts.userId,
    metadata: { totalQuestions: questions.length, sync: true },
    tags:     ["avatar_pregen"],
  });

  const results = await pregenerateVideos(questions, { ...opts, traceId }, undefined, signal);

  const videoUrls = results.map(r => r.videoUrl ?? null);
  const errors    = results
    .map((r, i) => r.error ? { questionIndex: i, error: r.error } : null)
    .filter(Boolean);
  const cacheHits = results.filter(r => r.fromCache).length;

  finalizeTrace(traceId, errors.length === questions.length ? "error" : "success");

  return {
    videoUrls,
    errors,
    durationMs: Date.now() - startMs,
    cacheHits,
  };
}
