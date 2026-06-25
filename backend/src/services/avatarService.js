/**
 * avatarService.js
 * D-ID Express API (async REST) — avatar lipsync video generation.
 *
 * Flow per question:
 *   1. Check Redis cache (nếu đã render câu hỏi này trước → return instantly)
 *   2. ElevenLabs TTS → audio buffer (qua ttsService.js)
 *   3. Upload audio buffer → Cloudinary → public audio URL
 *   4. POST /talks → D-ID job ID
 *   5. Poll GET /talks/:id until status=done — result_url là presigned S3 URL, tự hết hạn ~24h
 *   6. Nếu opts.persistVideo: mirror result_url → Cloudinary, cache vĩnh viễn (không TTL)
 *      Ngược lại (hoặc mirror lỗi): cache result_url gốc với TTL ngắn (RAW_DID_URL_FALLBACK_TTL)
 *      — không bao giờ cache link tự-hết-hạn này dài hạn.
 *
 * Env vars:
 *   D_ID_API_KEY=<raw key>          — format: Basic base64(key:)
 *   HR_AVATAR_IMAGE_URL=<URL>        — ảnh tĩnh HR avatar (mặc định: Cloudinary PNG cũ)
 *   AVATAR_PROVIDER=did | tavus      — provider switch (mặc định: did)
 */

import crypto from "crypto";
import { uploadToCloudinary } from "../utils/cloudinaryUpload.js";
import { synthesizeSpeech, getElevenLabsVoiceId, isElevenLabsEnabled } from "./ttsService.js";
import { cacheGet, cacheSet } from "./cacheService.js";
import { logEvent } from "./langfuseService.js";
import { calcTTSCost, calcAvatarVideoCost } from "./costCalculator.js";
import { logger } from "../config/logger.js";

const DID_BASE = "https://api.d-id.com";

// Cloudinary PNG portrait dùng làm base image cho D-ID
const DEFAULT_AVATAR_FEMALE_URL =
  "https://res.cloudinary.com/dee4bvivu/image/upload/v1778910708/AI-female_gxbcf1.png";
const DEFAULT_AVATAR_MALE_URL =
  "https://res.cloudinary.com/dee4bvivu/image/upload/v1778910708/AI-male_sdrvje.png";
/** @deprecated use DEFAULT_AVATAR_FEMALE_URL */
const DEFAULT_AVATAR_URL = DEFAULT_AVATAR_FEMALE_URL;

// D-ID result_url là presigned S3 URL, tự hết hạn sau ~24h (X-Amz-Expires=86400). TTL ngắn (1h)
// dùng cho mọi trường hợp cache link D-ID gốc (chưa/không mirror sang Cloudinary), để lần gọi
// sau tự render lại/retry mirror thay vì phục vụ link đã hỏng trong thời gian dài.
const RAW_DID_URL_FALLBACK_TTL = 3600;

// ── Config ───────────────────────────────────────────────────────────────────

function cfg() {
  return {
    apiKey:    process.env.D_ID_API_KEY       ?? "",
    avatarUrl: process.env.HR_AVATAR_IMAGE_URL ?? DEFAULT_AVATAR_FEMALE_URL,
    maleUrl:   process.env.HR_AVATAR_MALE_URL  ?? DEFAULT_AVATAR_MALE_URL,
  };
}

function didHeaders() {
  const { apiKey } = cfg();
  return {
    Authorization: `Basic ${Buffer.from(`${apiKey}:`).toString("base64")}`,
    "Content-Type": "application/json",
  };
}

export function isDIDEnabled() {
  return Boolean(cfg().apiKey);
}

export function getAvatarProvider() {
  const explicit = process.env.AVATAR_PROVIDER?.toLowerCase();
  if (explicit === "did" || explicit === "tavus") return explicit;
  return "did"; // default: D-ID Express API
}

// ── Azure TTS voice map (fallback khi không có ElevenLabs) ───────────────────

const AZURE_VOICES = {
  female: "vi-VN-HoaiMyNeural",
  male:   "vi-VN-NamMinhNeural",
};

// ── D-ID circuit breaker (in-memory, per-process) ────────────────────────────
// Open sau 3 probe failures liên tiếp → skip pregen để tránh tạo job lãng phí.
// Tự reset sau 5 phút (half-open: cho probe tiếp theo qua để test lại).

const didCircuit = {
  failures:  0,
  openSince: 0,
  THRESHOLD: 3,
  RESET_MS:  5 * 60 * 1000,

  isOpen() {
    if (this.failures < this.THRESHOLD) return false;
    if (Date.now() - this.openSince > this.RESET_MS) {
      this.failures = 0; // half-open: let next probe through
      return false;
    }
    return true;
  },
  recordFailure() {
    this.failures++;
    if (this.failures >= this.THRESHOLD) this.openSince = Date.now();
    logger.warn("did_circuit_failure", { failures: this.failures, open: this.isOpen() });
  },
  recordSuccess() {
    if (this.failures > 0) logger.info("did_circuit_reset");
    this.failures  = 0;
    this.openSince = 0;
  },
};

/** Expose circuit state cho /api/ai/config và pre-flight checks. */
export function isCircuitOpen() { return didCircuit.isOpen(); }

// ── Cache key ─────────────────────────────────────────────────────────────────

// Đặt AVATAR_PIPELINE_VERSION (vd: "v2") khi đổi pipeline render (audio format, D-ID config,
// avatar ảnh mới...) để vô hiệu hóa TOÀN BỘ cache video cùng lúc — tránh video cũ lẫn pipeline mới.
// Để trống (mặc định) → không đổi cache key hiện có.
const AVATAR_PIPELINE_VERSION = process.env.AVATAR_PIPELINE_VERSION ?? "";

function buildCacheKey(questionText, avatarImageUrl, azureVoiceId, elevenLabsVoiceId) {
  // Include both voice IDs so changing ElevenLabs clone invalidates stale cached videos.
  const versionPrefix = AVATAR_PIPELINE_VERSION ? `${AVATAR_PIPELINE_VERSION}::` : "";
  const raw = `${versionPrefix}${questionText.trim()}::${avatarImageUrl}::${azureVoiceId ?? "default"}::${elevenLabsVoiceId ?? "azure"}`;
  return `did:v3:${crypto.createHash("md5").update(raw).digest("hex")}`;
}

// ── Audio: ElevenLabs TTS → Cloudinary CDN ───────────────────────────────────

/**
 * Sinh audio từ ElevenLabs rồi upload lên Cloudinary.
 * Trả về public audio URL (D-ID cần URL HTTP accessible).
 * Fallback: nếu ElevenLabs không có key → trả null → D-ID dùng text script thay thế.
 *
 * @param {string} text
 * @param {object} [opts]
 * @param {"male"|"female"} [opts.gender="female"] - Dùng để chọn ElevenLabs voice đúng giới tính
 * @param {string} [opts.voiceId] - Override ElevenLabs voice ID (nếu không set, dùng gender)
 * @param {string} [opts.traceId] - Langfuse trace ID để log chi phí TTS (Phase 0 cost tracking)
 */
async function generateAndUploadAudio(text, opts = {}) {
  if (!isElevenLabsEnabled()) {
    // Voice ID chưa cấu hình đúng (hoặc là placeholder) → D-ID sẽ dùng Azure TTS.
    // Log ở mức info để dễ nhận biết trong production.
    logger.info("avatar_tts_provider", { provider: "did_azure", reason: "ElevenLabs voice ID not configured" });
    return null;
  }

  try {
    const { gender = "female", voiceId, traceId } = opts;
    // Resolve ElevenLabs voice ID from gender — NOT the Azure voice ID (vi-VN-NamMinhNeural).
    // Azure voice IDs are for D-ID text-script fallback only; ElevenLabs uses its own ID format.
    const elevenLabsVoiceId = voiceId || getElevenLabsVoiceId(gender);
    const ttsResult = await synthesizeSpeech(text, { voiceId: elevenLabsVoiceId });
    if (!ttsResult) return null; // ElevenLabs not configured (should not reach here after check above)

    // Upload audio buffer → Cloudinary (resource_type: "video" cho audio files)
    const cdn = await uploadToCloudinary(ttsResult.buffer, {
      folder:        "prointerview/tts-audio",
      resource_type: "video",
      format:        "mp3",
      overwrite:     false,
    });

    if (!cdn) return null; // Cloudinary not configured
    logger.info("avatar_tts_provider", { provider: "elevenlabs", gender, voiceId: elevenLabsVoiceId });

    // Phase 0 cost tracking: ElevenLabs tính phí theo ký tự
    const ttsCost = calcTTSCost(text.length);
    logEvent({
      traceId,
      name: "tts_elevenlabs",
      input: { characters: text.length, gender, voiceId: elevenLabsVoiceId },
      output: { audioUrl: cdn.url },
      metadata: { costUsd: ttsCost.usd, costVnd: Math.round(ttsCost.vnd) },
    });

    return cdn.url;
  } catch (err) {
    logger.warn("avatar_audio_upload_failed", { error: err.message });
    return null;
  }
}

// ── Video: mirror D-ID result sang Cloudinary ────────────────────────────────

/**
 * Tải MP4 từ D-ID CDN về và upload lên Cloudinary của mình.
 * Tránh rủi ro D-ID xoá CDN file (downgrade plan, hết hạn account, đổi chính sách...)
 * làm video cache lâu dài (vd: baseline questions) bị hỏng link.
 *
 * @param {string} resultUrl - D-ID `result_url` (MP4)
 * @returns {Promise<string|null>} URL Cloudinary, hoặc null nếu fetch/upload lỗi (fallback dùng resultUrl gốc)
 */
async function mirrorVideoToCloudinary(resultUrl) {
  try {
    // 60s (không phải 30s) — tải MP4 từ D-ID S3 (us-west-2, không CDN) có thể chậm tùy khoảng cách
    // mạng tới Oregon; quan sát thực tế: 30s không đủ ngay cả từ datacenter, để timeout ngắn sẽ
    // luôn rớt về raw URL (chính là nguồn gốc bug ngắt quãng đang sửa).
    const res = await fetch(resultUrl, { signal: AbortSignal.timeout(60_000) });
    if (!res.ok) {
      logger.warn("avatar_video_mirror_fetch_not_ok", { status: res.status, resultUrl });
      return null;
    }
    const buffer = Buffer.from(await res.arrayBuffer());

    const cdn = await uploadToCloudinary(buffer, {
      folder:        "prointerview/avatar-videos",
      resource_type: "video",
      format:        "mp4",
      overwrite:     false,
    });
    if (!cdn?.url) {
      logger.warn("avatar_video_mirror_upload_failed", { resultUrl });
    }
    return cdn?.url ?? null;
  } catch (err) {
    logger.warn("avatar_video_mirror_failed", { error: err.message, resultUrl });
    return null;
  }
}

// ── D-ID Express API ──────────────────────────────────────────────────────────

/**
 * Tạo D-ID talk job.
 * @param {string} avatarImageUrl - URL ảnh tĩnh (portrait)
 * @param {string|null} audioUrl - Public audio URL từ ElevenLabs/Cloudinary
 * @param {string} questionText - Fallback khi không có audioUrl (D-ID Azure TTS)
 * @param {object} opts
 * @param {string} [opts.voiceId="vi-VN-HoaiMyNeural"] - Azure voice (dùng khi không có ElevenLabs)
 * @returns {string} D-ID talk job ID
 */
async function createDIDTalk(avatarImageUrl, audioUrl, questionText, opts = {}) {
  const voiceId = opts.voiceId ?? "vi-VN-HoaiMyNeural";

  const script = audioUrl
    ? { type: "audio", audio_url: audioUrl }
    : {
        type:     "text",
        input:    questionText,
        provider: { type: "microsoft", voice_id: voiceId },
      };

  const body = {
    source_url: avatarImageUrl,
    script,
    config: {
      stitch:        true,
      result_format: "mp4",
      fluent:        true,
      pad_audio:     0.5,
    },
  };

  const res = await fetch(`${DID_BASE}/talks`, {
    method:  "POST",
    headers: didHeaders(),
    body:    JSON.stringify(body),
    signal:  AbortSignal.timeout(30_000),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(`D-ID create talk failed (${res.status}): ${errText.slice(0, 300)}`);
  }

  const data = await res.json();
  return data.id;
}

/**
 * Poll D-ID talk job đến khi status=done.
 * @param {string} talkId
 * @param {number} [timeoutMs=120000] - 120s per-video budget.
 *   Q2-Q5 chạy song song nhưng D-ID server xử lý tuần tự → Q5 có thể chờ 90-110s.
 *   Đo thực tế: Q1 probe ~46s; Q5 worst-case = 55s (nhẹ tải) đến >60s (tải cao).
 *   120s cho đủ headroom mà vẫn fail fast khi D-ID thực sự stuck.
 *   Budget: frontend timeout 180s − Q1 probe ~46s − ElevenLabs ~10s = 124s còn lại cho poll.
 * @param {AbortSignal} [signal] - Dừng ngay khi client ngắt kết nối (req.on('close')).
 * @returns {string} result_url (MP4 video URL)
 */
async function pollDIDTalk(talkId, timeoutMs = 120_000, signal) {
  const deadline = Date.now() + timeoutMs;
  let interval   = 2000;

  while (Date.now() < deadline) {
    if (signal?.aborted) throw new Error("pregen_aborted_client_disconnect");

    // Abortable sleep: if signal fires mid-sleep, reject immediately instead of
    // waiting up to 8s for the next signal check.
    await new Promise((resolve, reject) => {
      const t = setTimeout(resolve, interval);
      signal?.addEventListener("abort", () => {
        clearTimeout(t);
        reject(new Error("pregen_aborted_client_disconnect"));
      }, { once: true });
    });

    interval = Math.min(interval * 1.3, 8000); // exponential backoff, max 8s

    // Một lần poll timeout/lỗi mạng (10s) là chuyện tạm thời trong vòng poll 120s, không phải lỗi
    // nghiêm trọng — trước đây để fetch() throw thẳng ra ngoài sẽ làm toàn bộ pregenerateVideos()
    // (cả batch nhiều câu) fail oan vì 1 lần network hiccup. Nuốt lỗi tạm thời, tiếp tục poll tới deadline.
    const res = await fetch(`${DID_BASE}/talks/${talkId}`, {
      headers: didHeaders(),
      signal:  AbortSignal.timeout(10_000),
    }).catch((err) => {
      logger.warn("did_poll_transient_error", { talkId, error: err.message });
      return null;
    });

    if (!res || !res.ok) continue;
    const data = await res.json().catch(() => null);
    if (!data) continue;

    if (data.status === "done") return data.result_url;
    if (data.status === "error") {
      throw new Error(`D-ID talk ${talkId} error: ${JSON.stringify(data.error ?? data)}`);
    }
    // status: "created" | "started" → tiếp tục poll
  }

  throw new Error(`D-ID talk ${talkId} timed out after ${timeoutMs}ms`);
}

// ── Public API ─────────────────────────────────────────────────────────────────

/**
 * Trả về 1 MP4 video URL cho câu hỏi đã cho.
 * Cache → generate audio → D-ID render → cache result.
 *
 * @param {string} questionText
 * @param {object} [opts]
 * @param {string} [opts.gender="female"] - "female" | "male"
 * @param {string} [opts.voiceId]         - ElevenLabs voice ID override
 * @param {string} [opts.avatarImageUrl]  - Override avatar image
 * @param {string} [opts.traceId]         - Langfuse trace ID để log cache hit/miss + chi phí (Phase 0)
 * @param {boolean} [opts.persistVideo=false] - Mirror D-ID result sang Cloudinary + cache vĩnh viễn
 *   (tránh rủi ro D-ID xoá CDN file). Dùng cho video dùng chung toàn hệ thống (baseline questions).
 * @param {AbortSignal} [signal]          - Abort polling when client disconnects
 * @returns {Promise<{videoUrl: string, fromCache: boolean, talkId?: string}>}
 */
export async function generateVideoForQuestion(questionText, opts = {}, signal) {
  if (!isDIDEnabled()) {
    throw new Error("D_ID_API_KEY chưa được cấu hình.");
  }

  // Circuit breaker: skip immediately when D-ID is degraded — avoid wasting credits
  if (didCircuit.isOpen()) {
    throw new Error("D-ID circuit open — service degraded, skipping to prevent credit waste");
  }

  const { gender = "female", voiceId, avatarImageUrl, traceId } = opts;
  const { avatarUrl, maleUrl } = cfg();
  const resolvedAvatarUrl = avatarImageUrl ?? (gender === "male" ? maleUrl : avatarUrl);
  // Derive Azure TTS voice from gender when no explicit voiceId provided
  const resolvedVoiceId = voiceId ?? AZURE_VOICES[gender] ?? AZURE_VOICES.female;
  // Resolve ElevenLabs voice ID now so the cache key includes it.
  // Changing the ElevenLabs clone must bust the cache — otherwise stale videos get served.
  const elevenLabsVoiceId = isElevenLabsEnabled() ? getElevenLabsVoiceId(gender) : null;

  // 1. Cache lookup — key includes both Azure fallback voice AND ElevenLabs voice
  const cacheKey = buildCacheKey(questionText, resolvedAvatarUrl, resolvedVoiceId, elevenLabsVoiceId);
  const cached   = await cacheGet(cacheKey);
  if (cached) {
    const cacheCost = calcAvatarVideoCost(true);
    logEvent({
      traceId,
      name: "avatar_video_did",
      input: { questionText: questionText.slice(0, 200) },
      output: { videoUrl: cached },
      metadata: {
        fromCache:   true,
        costUsd:     cacheCost.usd,
        costVnd:     Math.round(cacheCost.vnd),
        persistVideo: Boolean(opts.persistVideo),
      },
    });
    return { videoUrl: cached, fromCache: true };
  }

  // 2. ElevenLabs TTS audio (if configured). Pass gender so the correct voice is selected.
  //    resolvedVoiceId is the Azure voice name — only used as D-ID text-script fallback (step 3).
  const audioUrl = await generateAndUploadAudio(questionText, { gender, traceId });

  // 3. Create D-ID talk — if audioUrl exists, D-ID lipsync with ElevenLabs audio;
  //    otherwise D-ID uses its own Azure TTS with resolvedVoiceId.
  const talkId = await createDIDTalk(resolvedAvatarUrl, audioUrl, questionText, { voiceId: resolvedVoiceId });

  // 4. Poll until done — pass signal so polling stops on client disconnect
  let videoUrl = await pollDIDTalk(talkId, 120_000, signal);
  // result_url là presigned S3 URL của D-ID, tự hết hạn ~24h (X-Amz-Expires) — không bao giờ
  // cache nó với TTL dài (180 ngày). Chỉ link đã mirror sang Cloudinary mới cache vĩnh viễn.
  let cacheTtl = RAW_DID_URL_FALLBACK_TTL;

  // 5. Mirror sang Cloudinary nếu được yêu cầu (vd: baseline questions — cache dùng chung
  //    toàn hệ thống, không phụ thuộc D-ID giữ file CDN lâu dài). Cache vĩnh viễn vì mình
  //    kiểm soát file. Nếu mirror lỗi → giữ URL D-ID gốc với TTL ngắn ở trên, để lần gọi sau
  //    tự retry mirror thay vì phục vụ link đã hỏng.
  if (opts.persistVideo) {
    const mirrored = await mirrorVideoToCloudinary(videoUrl);
    if (mirrored) {
      videoUrl = mirrored;
      cacheTtl = null;
    }
  }

  // 6. Cache result
  await cacheSet(cacheKey, videoUrl, cacheTtl);

  logger.info("avatar_video_generated", { talkId, fromCache: false, textLen: questionText.length });

  const genCost = calcAvatarVideoCost(false);
  logEvent({
    traceId,
    name: "avatar_video_did",
    input: { questionText: questionText.slice(0, 200) },
    output: { videoUrl, talkId },
    metadata: {
      fromCache:    false,
      costUsd:      genCost.usd,
      costVnd:      Math.round(genCost.vnd),
      persistVideo: Boolean(opts.persistVideo),
    },
  });

  return { videoUrl, fromCache: false, talkId };
}

/**
 * Pre-generate videos cho nhiều câu hỏi.
 *
 * Strategy: probe-first để tránh tạo nhiều D-ID job khi service không hoạt động.
 *   1. Chạy Q1 trước (probe) — nếu D-ID timeout/error thì chỉ tốn 1 job thay vì 5.
 *   2. Nếu Q1 thành công → Q2…N chạy song song (D-ID đang ổn, parallel an toàn).
 *   3. Nếu Q1 fail → abort ngay, trả toàn null — không tạo thêm job nào.
 *
 * Trước đây dùng Promise.all cho tất cả: D-ID throttle/stuck → 5 job × 120s = 2 phút
 * waste + 5× credit. Với probe-first: chỉ 1 job × 35s → fail fast, tiết kiệm 80% credit.
 *
 * Batch ≤2 câu (đúng case follow-up — luôn đúng 2 câu) bỏ qua probe-first: "phần còn lại"
 * sau probe chỉ có ≤1 câu nên chạy HOÀN TOÀN tuần tự — đo thực tế với persistVideo bật
 * (mirror Cloudinary), 2 câu tuần tự mất ~195s, vượt timeout FE khiến cả 2 video bị bỏ dù
 * câu 1 đã render xong từ giây 86. Chạy song song ngay đưa về ~max(Q1,Q2) thay vì tổng.
 * An toàn vì generateVideoForQuestion tự fail-fast theo circuit breaker (đã có dữ liệu từ
 * các lần gọi baseline ngay trước đó trong buổi) — không cần probe riêng cho batch nhỏ.
 *
 * @param {string[]} questions - Danh sách câu hỏi text
 * @param {object} [opts]     - Shared options (gender, voiceId, avatarImageUrl)
 * @param {Function} [onProgress] - Callback(done, total) khi mỗi video xong
 * @param {AbortSignal} [signal]  - Abort when HTTP client disconnects
 * @returns {Promise<Array<{videoUrl: string, fromCache: boolean, error?: string}>>}
 */
export async function pregenerateVideos(questions, opts = {}, onProgress, signal) {
  const total = questions.length;
  if (total === 0) return [];
  let done = 0;

  if (total <= 2) {
    const tasks = questions.map(async (questionText) => {
      try {
        const result = await generateVideoForQuestion(questionText, opts, signal);
        didCircuit.recordSuccess();
        done++;
        onProgress?.(done, total);
        return result;
      } catch (err) {
        done++;
        onProgress?.(done, total);
        const isClientAbort = err.message.includes("pregen_aborted_client_disconnect");
        if (!isClientAbort) didCircuit.recordFailure();
        logger.error("pregen_video_failed", { questionText: questionText.slice(0, 80), error: err.message });
        return { videoUrl: null, fromCache: false, error: err.message };
      }
    });
    return Promise.all(tasks);
  }

  // Step 1: Probe — chạy Q1 trước để xác nhận D-ID đang hoạt động.
  // Probe cũng cập nhật circuit breaker để ảnh hưởng đến các request tiếp theo.
  let firstResult;
  try {
    firstResult = await generateVideoForQuestion(questions[0], opts, signal);
    didCircuit.recordSuccess();
    done++;
    onProgress?.(done, total);
  } catch (err) {
    const isClientAbort = err.message.includes("pregen_aborted_client_disconnect");
    if (!isClientAbort) {
      // Chỉ tính failure vào circuit khi D-ID thực sự fail, không phải client abort
      didCircuit.recordFailure();
    }
    logger.error("pregen_video_failed", { questionText: questions[0].slice(0, 80), error: err.message });
    logger.warn("pregen_aborted_early", { reason: "probe_failed", isClientAbort, error: err.message });
    // D-ID không hoạt động — không tạo thêm job, trả về toàn null ngay lập tức
    return questions.map(() => ({ videoUrl: null, fromCache: false, error: err.message }));
  }

  if (total === 1) return [firstResult];

  // Step 2: D-ID đang ổn → Q2…N chạy song song, tiếp tục truyền signal
  const remainingTasks = questions.slice(1).map(async (questionText) => {
    try {
      const result = await generateVideoForQuestion(questionText, opts, signal);
      done++;
      onProgress?.(done, total);
      return result;
    } catch (err) {
      done++;
      onProgress?.(done, total);
      // Record failures from Q2-N as well so the circuit breaker learns about
      // D-ID degradation even when Q1 was a cache hit (0 D-ID calls).
      const isClientAbort = err.message.includes("pregen_aborted_client_disconnect");
      if (!isClientAbort) didCircuit.recordFailure();
      logger.error("pregen_video_failed", { questionText: questionText.slice(0, 80), error: err.message });
      return { videoUrl: null, fromCache: false, error: err.message };
    }
  });

  const remainingResults = await Promise.all(remainingTasks);
  return [firstResult, ...remainingResults];
}

/**
 * Lấy thông tin usage của D-ID account.
 */
export async function getDIDUsage() {
  if (!isDIDEnabled()) return null;
  const res = await fetch(`${DID_BASE}/credits`, {
    headers: didHeaders(),
    signal:  AbortSignal.timeout(10_000),
  });
  if (!res.ok) return null;
  return res.json();
}

/**
 * Danh sách presenters (stock avatars) từ D-ID.
 */
export async function listDIDPresenters() {
  if (!isDIDEnabled()) return [];
  const res = await fetch(`${DID_BASE}/presenters`, {
    headers: didHeaders(),
    signal:  AbortSignal.timeout(10_000),
  });
  if (!res.ok) return [];
  const data = await res.json();
  return data.presenters ?? [];
}
