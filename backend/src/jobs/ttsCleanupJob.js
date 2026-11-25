/**
 * ttsCleanupJob.js
 * Xóa audio TTS (ElevenLabs → Cloudinary `prointerview/tts-audio`) cũ hơn 7 ngày.
 * Từ AI-17 avatar gửi audio thẳng cho ElevenLabs, không upload nữa; job còn dọn file cũ. Giữ lâu chỉ
 * tốn storage Cloudinary vô ích, không phục vụ cache (video kết quả đã mirror riêng, xem
 * avatarService.js mirrorVideoToCloudinary).
 *
 * Chạy mỗi 24h, ngay khi server start (đủ cho 1 Render instance, theo cùng pattern với
 * bookingReminderJob.js).
 */

import { logger } from "../config/logger.js";
import {
  isCloudinaryConfigured,
  listResourcesInFolder,
  deleteCloudinaryResources,
} from "../utils/cloudinaryUpload.js";

const FOLDER = "prointerview/tts-audio";
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
const RUN_INTERVAL_MS = 24 * 60 * 60 * 1000;

let intervalHandle = null;

async function runTtsCleanup() {
  if (!isCloudinaryConfigured()) return;

  const resources = await listResourcesInFolder(FOLDER, "video");
  const cutoff = Date.now() - MAX_AGE_MS;
  const stale = resources.filter((r) => new Date(r.created_at).getTime() < cutoff);

  if (stale.length === 0) {
    logger.info("tts_cleanup_done", { scanned: resources.length, deleted: 0 });
    return;
  }

  await deleteCloudinaryResources(stale.map((r) => r.public_id), "video");
  logger.info("tts_cleanup_done", { scanned: resources.length, deleted: stale.length });
}

/** Chạy ngay + lặp lại mỗi 24h. */
export function startTtsCleanupJob() {
  if (intervalHandle) return;
  const tick = () => {
    runTtsCleanup().catch((e) => logger.error("tts_cleanup_failed", { error: e?.message || String(e) }));
  };
  tick();
  intervalHandle = setInterval(tick, RUN_INTERVAL_MS);
}
