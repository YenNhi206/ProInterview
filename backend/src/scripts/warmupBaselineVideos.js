/**
 * Pre-warm cache video baseline (3 câu × 2 gender = 6 video) TRƯỚC khi launch free trial.
 * Không có script này, user đầu tiên của mỗi gender phải đợi provider video render thật (~60-130s)
 * thay vì cache-hit ngay — xem avatarService.js (persistVideo → mirror Cloudinary, no-TTL).
 *
 * Không cần MongoDB — chỉ cần key của provider đang chạy (`AVATAR_PROVIDER`: D_ID_API_KEY hoặc
 * ELEVENLABS_API_KEY + giọng) và Redis/Cloudinary nếu muốn cache thật sự lâu dài.
 * Đổi provider (AI-15) thì chạy lại: cache key có provider + model nên video cũ không dùng lại.
 *
 * Chạy: npm run warmup:baseline-videos
 */
import "../config/loadEnv.js";
import { getBaselineQuestionTexts } from "../config/baselineQuestions.js";
import { isAvatarVideoEnabled, avatarVideoMissingConfigMessage, getAvatarProvider, getAvatarModel } from "../services/avatarService.js";
import { pregenerateSync } from "../services/videoPregenService.js";

async function run() {
  if (!isAvatarVideoEnabled()) {
    console.error(`${avatarVideoMissingConfigMessage()} Không thể warm-up.`);
    process.exit(1);
  }

  const questions = getBaselineQuestionTexts();
  console.log(`Warm-up ${questions.length} câu baseline × 2 gender (provider=${getAvatarProvider()}, model=${getAvatarModel()})...`);

  for (const gender of ["male", "female"]) {
    console.log(`\n[${gender}] đang pregen...`);
    const result = await pregenerateSync(questions, { gender, persistVideo: true });
    console.log(
      `[${gender}] xong: cacheHits=${result.cacheHits}/${questions.length}, ` +
        `errors=${result.errors.length}, durationMs=${result.durationMs}`,
    );
    if (result.errors.length > 0) {
      console.error(`[${gender}] errors:`, result.errors);
    }
  }

  console.log("\nWarm-up hoàn tất. Verify lại bằng GET /api/ai/interview/pregen-baseline (gender male/female) — cacheHits phải = 3.");
  process.exit(0);
}

run().catch((err) => {
  console.error("Warm-up thất bại:", err?.message || err);
  process.exit(1);
});
