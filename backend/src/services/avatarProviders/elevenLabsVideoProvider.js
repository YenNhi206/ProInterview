/**
 * Provider video avatar ElevenLabs (AI-15): `POST /v1/flows/video`, poll `GET /v1/flows/video/:id`.
 *
 * - Model mặc định `creatify-aurora` (lip-sync từ ảnh tĩnh + audio). Đây là model avatar duy nhất
 *   có schema trong API reference (25/11/2026); OmniHuman, HeyGen Avatar chưa có `model_id` gọi được.
 * - API không nhận URL công khai: ảnh và audio gửi dạng `inline_base64` (≤ 25MB sau giải mã).
 * - `content_url` khi `completed` là link ký, hết hạn ~1 giờ → link gốc chỉ cache 30 phút; muốn
 *   giữ lâu phải mirror Cloudinary (`persistVideo`).
 * - Không có Azure TTS dự phòng như D-ID: thiếu audio ElevenLabs thì không render được.
 * - Generation `failed` không bị tính phí (theo tài liệu ElevenLabs).
 *
 * Env:
 *   ELEVENLABS_API_KEY            — dùng chung với TTS (cần gói Pro trở lên cho API video)
 *   ELEVENLABS_VIDEO_MODEL        — mặc định `creatify-aurora`
 *   ELEVENLABS_VIDEO_RESOLUTION   — `480p` | `720p` (mặc định `720p`)
 *   ELEVENLABS_VIDEO_POLL_MS      — khoảng cách poll, mặc định 10000 (AI-14: poll cách ≥ 10 giây)
 *   ELEVENLABS_VIDEO_TIMEOUT_MS   — hạn chờ render, mặc định 120000 (như D-ID; FE chờ pregen 150 giây)
 *   ELEVENLABS_API_BASE           — mặc định https://api.elevenlabs.io
 */
import { logger } from "../../config/logger.js";
import { COST_EVENT_KIND } from "../../constants/costEventKinds.js";
import { createCircuitBreaker } from "./circuitBreaker.js";

const DEFAULT_MODEL = "creatify-aurora";
const RESOLUTIONS = new Set(["480p", "720p"]);
const RAW_URL_TTL_SEC = 1800;
const MAX_INLINE_BYTES = 25 * 1024 * 1024;

function positiveNumber(raw, fallback) {
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

function cfg() {
  const resolution = (process.env.ELEVENLABS_VIDEO_RESOLUTION ?? "").trim();
  return {
    apiKey:     process.env.ELEVENLABS_API_KEY ?? "",
    base:       (process.env.ELEVENLABS_API_BASE || "https://api.elevenlabs.io").replace(/\/+$/, ""),
    model:      (process.env.ELEVENLABS_VIDEO_MODEL || DEFAULT_MODEL).trim(),
    resolution: RESOLUTIONS.has(resolution) ? resolution : "720p",
    pollMs:     positiveNumber(process.env.ELEVENLABS_VIDEO_POLL_MS, 10_000),
    timeoutMs:  positiveNumber(process.env.ELEVENLABS_VIDEO_TIMEOUT_MS, 120_000),
  };
}

function headers() {
  return { "xi-api-key": cfg().apiKey, "Content-Type": "application/json" };
}

export function isElevenLabsVideoEnabled() {
  return Boolean(cfg().apiKey);
}

export function getElevenLabsVideoModel() {
  return cfg().model;
}

// Ảnh avatar cố định (2 ảnh theo giới tính) → tải một lần mỗi process.
const imageCache = new Map();

function imageMimeType(url, contentType) {
  const ct = (contentType ?? "").split(";")[0].trim().toLowerCase();
  if (ct.startsWith("image/")) return ct;
  if (/\.jpe?g(\?|$)/i.test(url)) return "image/jpeg";
  if (/\.webp(\?|$)/i.test(url)) return "image/webp";
  return "image/png";
}

async function loadImageReference(imageUrl) {
  if (imageCache.has(imageUrl)) return imageCache.get(imageUrl);
  const res = await fetch(imageUrl, { signal: AbortSignal.timeout(30_000) });
  if (!res.ok) throw new Error(`Không tải được ảnh avatar (${res.status})`);
  const buffer = Buffer.from(await res.arrayBuffer());
  if (buffer.length > MAX_INLINE_BYTES) throw new Error("Ảnh avatar vượt 25MB, ElevenLabs không nhận.");
  const ref = {
    type: "inline_base64",
    content_base64: buffer.toString("base64"),
    mime_type: imageMimeType(imageUrl, res.headers.get("content-type")),
  };
  imageCache.set(imageUrl, ref);
  return ref;
}

/** Chỉ dùng trong test. */
export function __clearElevenLabsImageCacheForTest() {
  imageCache.clear();
}

/**
 * @param {object} p
 * @param {string} p.imageUrl
 * @param {{buffer: Buffer, contentType?: string}|null} p.audio - audio TTS ElevenLabs
 */
async function createJob({ imageUrl, audio }) {
  if (!audio?.buffer?.length) {
    throw new Error("ElevenLabs video cần audio TTS ElevenLabs (thiếu ELEVENLABS_VOICE_ID_* hoặc TTS lỗi).");
  }
  if (audio.buffer.length > MAX_INLINE_BYTES) throw new Error("Audio vượt 25MB, ElevenLabs không nhận.");

  const { base, model, resolution } = cfg();
  const image = await loadImageReference(imageUrl);
  const mime = (audio.contentType ?? "").includes("wav") ? "audio/wav" : "audio/mpeg";

  const res = await fetch(`${base}/v1/flows/video`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({
      model_id: model,
      audio: { type: "inline_base64", content_base64: audio.buffer.toString("base64"), mime_type: mime },
      image,
      resolution,
    }),
    signal: AbortSignal.timeout(60_000),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(`ElevenLabs create video failed (${res.status}): ${errText.slice(0, 300)}`);
  }
  const data = await res.json();
  if (!data?.id) throw new Error("ElevenLabs create video không trả id.");
  return data.id;
}

function abortableSleep(ms, signal) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(resolve, ms);
    signal?.addEventListener("abort", () => {
      clearTimeout(t);
      reject(new Error("pregen_aborted_client_disconnect"));
    }, { once: true });
  });
}

async function waitForResult(generationId, { signal } = {}) {
  const { base, pollMs, timeoutMs } = cfg();
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    if (signal?.aborted) throw new Error("pregen_aborted_client_disconnect");
    await abortableSleep(pollMs, signal);

    const res = await fetch(`${base}/v1/flows/video/${generationId}`, {
      headers: headers(),
      signal: AbortSignal.timeout(15_000),
    }).catch((err) => {
      logger.warn("elevenlabs_video_poll_transient_error", { generationId, error: err.message });
      return null;
    });
    if (!res || !res.ok) continue;
    const data = await res.json().catch(() => null);
    if (!data) continue;

    if (data.status === "completed") {
      if (!data.content_url) throw new Error(`ElevenLabs video ${generationId} completed nhưng thiếu content_url`);
      return data.content_url;
    }
    if (data.status === "failed") {
      throw new Error(`ElevenLabs video ${generationId} failed (${data.failure_reason ?? "unknown"}): ${String(data.error_message ?? "").slice(0, 200)}`);
    }
    // pending | generating → poll tiếp
  }
  throw new Error(`ElevenLabs video ${generationId} timed out after ${timeoutMs}ms`);
}

export const elevenLabsVideoProvider = {
  name: "elevenlabs",
  model: getElevenLabsVideoModel,
  isEnabled: isElevenLabsVideoEnabled,
  missingConfigMessage: "ELEVENLABS_API_KEY chưa được cấu hình.",
  audioInput: "buffer",
  requiresAudio: true,
  rawUrlTtlSec: RAW_URL_TTL_SEC,
  costKind: COST_EVENT_KIND.AVATAR_VIDEO_ELEVENLABS,
  circuit: createCircuitBreaker("elevenlabs"),
  createJob,
  waitForResult,
};
