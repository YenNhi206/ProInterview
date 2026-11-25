/**
 * Provider video avatar D-ID Express (`POST /talks`, poll `GET /talks/:id`).
 * Sẽ gỡ ở AI-17 sau khi QA-08 đo ElevenLabs đạt.
 *
 * Env: D_ID_API_KEY (Basic base64(key:)).
 */
import { logger } from "../../config/logger.js";
import { COST_EVENT_KIND } from "../../constants/costEventKinds.js";
import { createCircuitBreaker } from "./circuitBreaker.js";

export const DID_BASE = "https://api.d-id.com";

// result_url là presigned S3 URL, tự hết hạn ~24h. Link gốc (chưa mirror) chỉ cache 1h.
const RAW_URL_TTL_SEC = 3600;

export function didHeaders() {
  const apiKey = process.env.D_ID_API_KEY ?? "";
  return {
    Authorization: `Basic ${Buffer.from(`${apiKey}:`).toString("base64")}`,
    "Content-Type": "application/json",
  };
}

export function isDIDEnabled() {
  return Boolean(process.env.D_ID_API_KEY);
}

/**
 * @param {object} p
 * @param {string} p.imageUrl
 * @param {{url: string|null}|null} p.audio - audio ElevenLabs đã upload Cloudinary; null → D-ID dùng Azure TTS
 * @param {string} p.text
 * @param {string} p.azureVoiceId
 */
async function createJob({ imageUrl, audio, text, azureVoiceId }) {
  const script = audio?.url
    ? { type: "audio", audio_url: audio.url }
    : { type: "text", input: text, provider: { type: "microsoft", voice_id: azureVoiceId ?? "vi-VN-HoaiMyNeural" } };

  const res = await fetch(`${DID_BASE}/talks`, {
    method: "POST",
    headers: didHeaders(),
    body: JSON.stringify({
      source_url: imageUrl,
      script,
      config: { stitch: true, result_format: "mp4", fluent: true, pad_audio: 0.5 },
    }),
    signal: AbortSignal.timeout(30_000),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(`D-ID create talk failed (${res.status}): ${errText.slice(0, 300)}`);
  }
  const data = await res.json();
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

/**
 * Poll tới khi `status=done`. 120s: frontend timeout 180s − probe Q1 ~46s − TTS ~10s.
 * Lỗi mạng một lần poll là tạm thời, nuốt và poll tiếp tới deadline.
 */
async function waitForResult(talkId, { signal, timeoutMs = 120_000 } = {}) {
  const deadline = Date.now() + timeoutMs;
  let interval = 2000;

  while (Date.now() < deadline) {
    if (signal?.aborted) throw new Error("pregen_aborted_client_disconnect");
    await abortableSleep(interval, signal);
    interval = Math.min(interval * 1.3, 8000);

    const res = await fetch(`${DID_BASE}/talks/${talkId}`, {
      headers: didHeaders(),
      signal: AbortSignal.timeout(10_000),
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
  }
  throw new Error(`D-ID talk ${talkId} timed out after ${timeoutMs}ms`);
}

export const didProvider = {
  name: "did",
  model: () => "express",
  isEnabled: isDIDEnabled,
  missingConfigMessage: "D_ID_API_KEY chưa được cấu hình.",
  /** D-ID cần audio dạng URL công khai; không có ElevenLabs thì tự đọc bằng Azure TTS. */
  audioInput: "url",
  requiresAudio: false,
  rawUrlTtlSec: RAW_URL_TTL_SEC,
  costKind: COST_EVENT_KIND.AVATAR_VIDEO_DID,
  circuit: createCircuitBreaker("did"),
  createJob,
  waitForResult,
};
