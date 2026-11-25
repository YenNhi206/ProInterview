/**
 * avatarService.js
 * Video avatar lip-sync cho câu hỏi phỏng vấn, qua lớp provider (AI-15).
 *
 * Provider chọn bằng `AVATAR_PROVIDER=did | elevenlabs` (mặc định `did`), xem `avatarProviders/`.
 *
 * Flow mỗi câu:
 *   1. Tra cache Redis (key có provider + model) → có thì trả ngay
 *   2. ElevenLabs TTS → audio buffer (ttsService.js)
 *      - D-ID cần URL công khai → upload Cloudinary; thiếu ElevenLabs thì D-ID tự đọc bằng Azure TTS
 *      - ElevenLabs video nhận audio base64 trực tiếp; thiếu audio thì không render được
 *   3. Provider tạo job → poll tới khi xong → URL video tự hết hạn (D-ID ~24h, ElevenLabs ~1h)
 *   4. opts.persistVideo: mirror sang Cloudinary, cache không TTL.
 *      Ngược lại (hoặc mirror lỗi): cache link gốc với TTL ngắn của provider — không bao giờ cache
 *      link tự hết hạn với TTL dài.
 *
 * Env:
 *   AVATAR_PROVIDER=did | elevenlabs — provider đang chạy
 *   HR_AVATAR_IMAGE_URL / HR_AVATAR_MALE_URL — ảnh tĩnh avatar nữ / nam
 *   AVATAR_PIPELINE_VERSION — đổi để vô hiệu toàn bộ cache video
 *   D_ID_API_KEY (provider did), ELEVENLABS_* (provider elevenlabs, xem elevenLabsVideoProvider.js)
 */

import crypto from "crypto";
import { uploadToCloudinary } from "../utils/cloudinaryUpload.js";
import { synthesizeSpeech, getElevenLabsVoiceId, isElevenLabsEnabled } from "./ttsService.js";
import { cacheGet, cacheSet } from "./cacheService.js";
import { logEvent } from "./langfuseService.js";
import { calcTTSCost, calcAvatarVideoCost } from "./costCalculator.js";
import { logger } from "../config/logger.js";
import { createStepTimer } from "../utils/stepTimer.js";
import { getAvatarProvider, getActiveAvatarProvider } from "./avatarProviders/index.js";
import { DID_BASE, didHeaders, isDIDEnabled } from "./avatarProviders/didProvider.js";

export { getAvatarProvider, isDIDEnabled };

const DEFAULT_AVATAR_FEMALE_URL =
  "https://res.cloudinary.com/dee4bvivu/image/upload/v1778910708/AI-female_gxbcf1.png";
const DEFAULT_AVATAR_MALE_URL =
  "https://res.cloudinary.com/dee4bvivu/image/upload/v1778910708/AI-male_sdrvje.png";

function cfg() {
  return {
    avatarUrl: process.env.HR_AVATAR_IMAGE_URL ?? DEFAULT_AVATAR_FEMALE_URL,
    maleUrl:   process.env.HR_AVATAR_MALE_URL  ?? DEFAULT_AVATAR_MALE_URL,
  };
}

/** Provider đang chạy đã cấu hình đủ để render video chưa. */
export function isAvatarVideoEnabled() {
  return getActiveAvatarProvider().isEnabled();
}

/** Model của provider đang chạy (D-ID: `express`; ElevenLabs: `ELEVENLABS_VIDEO_MODEL`). */
export function getAvatarModel() {
  return getActiveAvatarProvider().model();
}

/** Câu báo lỗi khi provider đang chạy thiếu cấu hình. */
export function avatarVideoMissingConfigMessage() {
  return getActiveAvatarProvider().missingConfigMessage;
}

/** Circuit breaker của provider đang chạy (cho /api/ai/config và kiểm tra trước pregen). */
export function isCircuitOpen() {
  return getActiveAvatarProvider().circuit.isOpen();
}

// ── Azure TTS voice map (chỉ D-ID dùng khi không có ElevenLabs) ───────────────

const AZURE_VOICES = {
  female: "vi-VN-HoaiMyNeural",
  male:   "vi-VN-NamMinhNeural",
};

// ── Cache key ─────────────────────────────────────────────────────────────────

const AVATAR_PIPELINE_VERSION = process.env.AVATAR_PIPELINE_VERSION ?? "";

/**
 * Key gồm nội dung câu, ảnh, giọng, provider và model, để đổi provider/model không trả video cũ.
 * D-ID giữ nguyên dạng key cũ (`did:v3:`) để không phải render lại video baseline đã cache;
 * provider khác dùng `avatar:<provider>:<model>:`.
 */
export function buildCacheKey({ provider, model, questionText, avatarImageUrl, azureVoiceId, elevenLabsVoiceId }) {
  const versionPrefix = AVATAR_PIPELINE_VERSION ? `${AVATAR_PIPELINE_VERSION}::` : "";
  const raw = `${versionPrefix}${questionText.trim()}::${avatarImageUrl}::${azureVoiceId ?? "default"}::${elevenLabsVoiceId ?? "azure"}`;
  const hash = crypto.createHash("md5").update(raw).digest("hex");
  if (provider === "did") return `did:v3:${hash}`;
  return `avatar:${provider}:${model}:${hash}`;
}

// ── Audio ─────────────────────────────────────────────────────────────────────

// TTS mặc định `mp3_44100_128` → 16.000 byte mỗi giây; dùng ước lượng độ dài video để tính phí.
const MP3_128K_BYTES_PER_SECOND = 16_000;

function estimateAudioSeconds(buffer) {
  if (!buffer?.length) return null;
  return Math.round((buffer.length / MP3_128K_BYTES_PER_SECOND) * 10) / 10;
}

/**
 * ElevenLabs TTS → audio buffer; `uploadUrl` thì upload thêm lên Cloudinary để lấy URL công khai.
 * Trả null khi ElevenLabs chưa cấu hình hoặc lỗi (D-ID sẽ dùng Azure TTS).
 *
 * @returns {Promise<{buffer: Buffer, contentType: string, url: string|null, seconds: number|null}|null>}
 */
async function generateAudio(text, { gender = "female", traceId, uploadUrl }) {
  if (!isElevenLabsEnabled()) {
    logger.info("avatar_tts_provider", { provider: "did_azure", reason: "ElevenLabs voice ID not configured" });
    return null;
  }

  try {
    const elevenLabsVoiceId = getElevenLabsVoiceId(gender);
    const ttsResult = await synthesizeSpeech(text, { voiceId: elevenLabsVoiceId });
    if (!ttsResult) return null;

    let url = null;
    if (uploadUrl) {
      const cdn = await uploadToCloudinary(ttsResult.buffer, {
        folder:        "prointerview/tts-audio",
        resource_type: "video",
        format:        "mp3",
        overwrite:     false,
      });
      if (!cdn) return null; // Cloudinary chưa cấu hình → D-ID không đọc được audio
      url = cdn.url;
    }
    logger.info("avatar_tts_provider", { provider: "elevenlabs", gender, voiceId: elevenLabsVoiceId });

    const ttsCost = calcTTSCost(text.length);
    logEvent({
      traceId,
      name: "tts_elevenlabs",
      input: { characters: text.length, gender, voiceId: elevenLabsVoiceId },
      output: { audioUrl: url },
      metadata: { costUsd: ttsCost.usd, costVnd: Math.round(ttsCost.vnd) },
    });

    return {
      buffer: ttsResult.buffer,
      contentType: ttsResult.contentType,
      url,
      seconds: estimateAudioSeconds(ttsResult.buffer),
    };
  } catch (err) {
    logger.warn("avatar_audio_failed", { error: err.message });
    return null;
  }
}

// ── Mirror video sang Cloudinary ─────────────────────────────────────────────

/**
 * Tải MP4 từ CDN của provider về và upload Cloudinary, vì link của provider tự hết hạn.
 * @returns {Promise<string|null>} URL Cloudinary, hoặc null nếu lỗi (giữ link gốc TTL ngắn)
 */
async function mirrorVideoToCloudinary(resultUrl) {
  try {
    // 60s: tải MP4 từ S3 không có CDN có thể chậm; 30s từng làm mirror luôn rớt về link gốc.
    const res = await fetch(resultUrl, { signal: AbortSignal.timeout(60_000) });
    if (!res.ok) {
      logger.warn("avatar_video_mirror_fetch_not_ok", { status: res.status });
      return null;
    }
    const buffer = Buffer.from(await res.arrayBuffer());
    const cdn = await uploadToCloudinary(buffer, {
      folder:        "prointerview/avatar-videos",
      resource_type: "video",
      format:        "mp4",
      overwrite:     false,
    });
    if (!cdn?.url) logger.warn("avatar_video_mirror_upload_failed");
    return cdn?.url ?? null;
  } catch (err) {
    logger.warn("avatar_video_mirror_failed", { error: err.message });
    return null;
  }
}

// ── Public API ─────────────────────────────────────────────────────────────────

function isMockMode() {
  return process.env.MOCK_AI_SERVICES === "true" || process.env.MOCK_AI === "true";
}

/**
 * Trả về 1 MP4 video URL cho câu hỏi.
 *
 * @param {string} questionText
 * @param {object} [opts]
 * @param {"female"|"male"} [opts.gender="female"]
 * @param {string} [opts.voiceId]         - Azure voice override (chỉ D-ID không có ElevenLabs)
 * @param {string} [opts.avatarImageUrl]  - Override ảnh avatar
 * @param {string} [opts.traceId]         - Langfuse trace ID (chi phí, cache hit/miss)
 * @param {boolean} [opts.persistVideo=false] - Mirror sang Cloudinary + cache không TTL
 * @param {AbortSignal} [signal]          - Dừng poll khi client ngắt kết nối
 * @returns {Promise<{videoUrl: string, fromCache: boolean, talkId?: string, provider: string}>}
 */
export async function generateVideoForQuestion(questionText, opts = {}, signal) {
  const provider = getActiveAvatarProvider();

  // QA-01: chế độ mock — không gọi provider, không ghi CostEvent.
  if (isMockMode()) {
    return {
      videoUrl: "https://res.cloudinary.com/prointerview/video/upload/mock_avatar_demo.mp4",
      fromCache: true,
      talkId: `mock_talk_${provider.name}_01`,
      provider: provider.name,
    };
  }

  if (!provider.isEnabled()) throw new Error(provider.missingConfigMessage);

  // Circuit breaker: provider đang lỗi liên tục → bỏ qua để khỏi tốn credit.
  if (provider.circuit.isOpen()) {
    throw new Error(`${provider.name} circuit open — service degraded, skipping to prevent credit waste`);
  }

  const model = provider.model();
  const { gender = "female", voiceId, avatarImageUrl, traceId } = opts;
  const { avatarUrl, maleUrl } = cfg();
  const resolvedAvatarUrl = avatarImageUrl ?? (gender === "male" ? maleUrl : avatarUrl);
  const resolvedVoiceId = voiceId ?? AZURE_VOICES[gender] ?? AZURE_VOICES.female;
  // Voice ElevenLabs nằm trong cache key: đổi giọng clone phải render lại.
  const elevenLabsVoiceId = isElevenLabsEnabled() ? getElevenLabsVoiceId(gender) : null;
  const persistVideo = Boolean(opts.persistVideo);
  const logBase = { provider: provider.name, model, textLen: questionText.length, persistVideo };

  // N-11: 1 dòng `avatar_video_timing` mỗi video (cả khi lỗi) để đo NFR-02.
  const timing = createStepTimer();

  const cacheKey = buildCacheKey({
    provider: provider.name, model, questionText,
    avatarImageUrl: resolvedAvatarUrl, azureVoiceId: resolvedVoiceId, elevenLabsVoiceId,
  });
  const cached = await timing.step("cacheLookupMs", () => cacheGet(cacheKey));
  if (cached) {
    logger.info("avatar_video_timing", timing.summary({ ...logBase, fromCache: true, ok: true }));
    const cacheCost = calcAvatarVideoCost(true, { provider: provider.name });
    logEvent({
      traceId,
      name: provider.costKind,
      input: { questionText: questionText.slice(0, 200) },
      output: { videoUrl: cached },
      metadata: { fromCache: true, costUsd: cacheCost.usd, costVnd: Math.round(cacheCost.vnd), persistVideo, provider: provider.name, model },
    });
    return { videoUrl: cached, fromCache: true, provider: provider.name };
  }

  let audio = null;
  let talkId;
  let videoUrl;
  try {
    audio = await timing.step("ttsMs", () => generateAudio(questionText, {
      gender, traceId, uploadUrl: provider.audioInput === "url",
    }));
    if (provider.requiresAudio && !audio) {
      throw new Error(`${provider.name} cần audio ElevenLabs TTS (thiếu ELEVENLABS_VOICE_ID_* hoặc TTS lỗi).`);
    }

    talkId = await timing.step("videoCreateMs", () => provider.createJob({
      imageUrl: resolvedAvatarUrl, audio, text: questionText, azureVoiceId: resolvedVoiceId,
    }));
    videoUrl = await timing.step("videoRenderMs", () => provider.waitForResult(talkId, { signal }));
  } catch (err) {
    logger.warn("avatar_video_timing", timing.summary({
      ...logBase,
      fromCache: false,
      ok: false,
      failedStep: timing.current,
      error: err.message,
      talkId,
      ttsProvider: audio ? "elevenlabs" : "did_azure",
    }));
    throw err;
  }

  let cacheTtl = provider.rawUrlTtlSec;
  let mirrored = null;
  if (persistVideo) {
    mirrored = await timing.step("mirrorMs", () => mirrorVideoToCloudinary(videoUrl));
    if (mirrored) {
      videoUrl = mirrored;
      cacheTtl = null;
    }
  }

  await timing.step("cacheWriteMs", () => cacheSet(cacheKey, videoUrl, cacheTtl));

  logger.info("avatar_video_generated", { talkId, provider: provider.name, model, fromCache: false, textLen: questionText.length });
  logger.info("avatar_video_timing", timing.summary({
    ...logBase,
    fromCache: false,
    ok: true,
    talkId,
    ttsProvider: audio ? "elevenlabs" : "did_azure",
    mirrored: Boolean(mirrored),
  }));

  const genCost = calcAvatarVideoCost(false, { provider: provider.name, seconds: audio?.seconds ?? null });
  logEvent({
    traceId,
    name: provider.costKind,
    input: { questionText: questionText.slice(0, 200) },
    output: { videoUrl, talkId },
    metadata: {
      fromCache: false,
      costUsd: genCost.usd,
      costVnd: Math.round(genCost.vnd),
      persistVideo,
      provider: provider.name,
      model,
      ...(genCost.seconds != null ? { videoSeconds: genCost.seconds } : {}),
      ...(genCost.credits != null ? { credits: genCost.credits } : {}),
      ...(genCost.priceUnconfigured ? { priceUnconfigured: true } : {}),
    },
  });

  return { videoUrl, fromCache: false, talkId, provider: provider.name };
}

/**
 * Pre-generate video cho nhiều câu.
 *
 * Probe-first để không tạo nhiều job khi provider đang hỏng:
 *   1. Chạy Q1 trước — lỗi thì chỉ tốn 1 job, trả toàn null.
 *   2. Q1 xong → Q2…N chạy song song.
 * Batch ≤ 2 câu (follow-up) chạy song song ngay: tuần tự 2 câu có mirror từng mất ~195s, vượt
 * timeout FE. Circuit breaker của provider đã có dữ liệu từ các câu baseline trước đó.
 *
 * @param {string[]} questions
 * @param {object} [opts]         - như generateVideoForQuestion
 * @param {Function} [onProgress] - (done, total)
 * @param {AbortSignal} [signal]
 * @returns {Promise<Array<{videoUrl: string|null, fromCache: boolean, error?: string}>>}
 */
export async function pregenerateVideos(questions, opts = {}, onProgress, signal) {
  const total = questions.length;
  if (total === 0) return [];
  const circuit = getActiveAvatarProvider().circuit;
  let done = 0;

  const isClientAbort = (err) => err.message.includes("pregen_aborted_client_disconnect");

  async function runOne(questionText, { recordSuccess }) {
    try {
      const result = await generateVideoForQuestion(questionText, opts, signal);
      if (recordSuccess) circuit.recordSuccess();
      done++;
      onProgress?.(done, total);
      return result;
    } catch (err) {
      done++;
      onProgress?.(done, total);
      if (!isClientAbort(err)) circuit.recordFailure();
      logger.error("pregen_video_failed", { questionText: questionText.slice(0, 80), error: err.message });
      return { videoUrl: null, fromCache: false, error: err.message };
    }
  }

  if (total <= 2) {
    return Promise.all(questions.map((q) => runOne(q, { recordSuccess: true })));
  }

  // Probe
  let firstResult;
  try {
    firstResult = await generateVideoForQuestion(questions[0], opts, signal);
    circuit.recordSuccess();
    done++;
    onProgress?.(done, total);
  } catch (err) {
    if (!isClientAbort(err)) circuit.recordFailure();
    logger.error("pregen_video_failed", { questionText: questions[0].slice(0, 80), error: err.message });
    logger.warn("pregen_aborted_early", { reason: "probe_failed", isClientAbort: isClientAbort(err), error: err.message });
    return questions.map(() => ({ videoUrl: null, fromCache: false, error: err.message }));
  }

  if (total === 1) return [firstResult];

  // Ghi lỗi Q2…N vào circuit để học được cả khi Q1 trúng cache (0 lời gọi provider).
  const remainingResults = await Promise.all(questions.slice(1).map((q) => runOne(q, { recordSuccess: false })));
  return [firstResult, ...remainingResults];
}

// ── D-ID riêng (gỡ ở AI-17) ──────────────────────────────────────────────────

/** Thông tin usage của tài khoản D-ID. */
export async function getDIDUsage() {
  if (!isDIDEnabled()) return null;
  const res = await fetch(`${DID_BASE}/credits`, {
    headers: didHeaders(),
    signal:  AbortSignal.timeout(10_000),
  });
  if (!res.ok) return null;
  return res.json();
}

/** Danh sách presenter (avatar có sẵn) của D-ID. */
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
