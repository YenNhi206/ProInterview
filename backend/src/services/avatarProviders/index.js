/**
 * Chọn provider video avatar theo `AVATAR_PROVIDER=did | elevenlabs` (AI-15). Mặc định `did`
 * cho tới khi QA-08 đo ElevenLabs đạt rồi đổi env, không cần deploy lại code.
 *
 * Mỗi provider có cùng hình dạng:
 *   { name, model(), isEnabled(), missingConfigMessage, audioInput: "url" | "buffer",
 *     requiresAudio, rawUrlTtlSec, costKind, circuit, createJob(p), waitForResult(id, { signal }) }
 */
import { didProvider } from "./didProvider.js";
import { elevenLabsVideoProvider } from "./elevenLabsVideoProvider.js";

export const AVATAR_PROVIDERS = Object.freeze({
  did: didProvider,
  elevenlabs: elevenLabsVideoProvider,
});

export const AVATAR_PROVIDER_NAMES = Object.freeze(Object.keys(AVATAR_PROVIDERS));

const DEFAULT_PROVIDER = "did";

let testOverride = null;

/** Tên provider đang chạy. Giá trị lạ trong env → mặc định (`did`). */
export function getAvatarProvider() {
  if (testOverride) return testOverride.name;
  const explicit = process.env.AVATAR_PROVIDER?.trim().toLowerCase();
  return AVATAR_PROVIDERS[explicit] ? explicit : DEFAULT_PROVIDER;
}

/** Object provider đang chạy. */
export function getActiveAvatarProvider() {
  return testOverride ?? AVATAR_PROVIDERS[getAvatarProvider()];
}

/** Chỉ dùng trong test: thay provider đang chạy bằng provider giả lập (null để bỏ). */
export function __setAvatarProviderForTest(provider) {
  testOverride = provider ?? null;
}
