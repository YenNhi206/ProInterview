/**
 * Chọn provider video avatar theo `AVATAR_PROVIDER` (AI-15). Từ AI-17 chỉ còn `elevenlabs`
 * (D-ID đã gỡ); giữ lớp provider để thêm nhà cung cấp khác không phải sửa avatarService.
 *
 * Mỗi provider có cùng hình dạng:
 *   { name, model(), isEnabled(), missingConfigMessage, rawUrlTtlSec, costKind, circuit,
 *     createJob({ imageUrl, audio: { buffer, contentType } }), waitForResult(id, { signal }) }
 */
import { elevenLabsVideoProvider } from "./elevenLabsVideoProvider.js";

export const AVATAR_PROVIDERS = Object.freeze({
  elevenlabs: elevenLabsVideoProvider,
});

export const AVATAR_PROVIDER_NAMES = Object.freeze(Object.keys(AVATAR_PROVIDERS));

const DEFAULT_PROVIDER = "elevenlabs";

let testOverride = null;

/** Tên provider đang chạy. Giá trị lạ trong env (kể cả `did` cũ) → mặc định. */
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
