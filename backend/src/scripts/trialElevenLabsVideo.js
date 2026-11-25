/**
 * AI-14: chạy thử video avatar ElevenLabs (`POST /v1/flows/video`) bằng key thật, lấy số liệu để
 * chọn model và điền đơn giá cho AI-16. TỐN CREDIT THẬT — phải thêm `--yes`.
 *
 *   node src/scripts/trialElevenLabsVideo.js --yes [--models creatify-aurora,veed-fabric]
 *        [--genders female,male] [--resolution 720p] [--extra "câu dài nhất trong bộ câu hỏi"]
 *
 * Mỗi (model × giới tính × câu): TTS ElevenLabs → tạo video → poll (ELEVENLABS_VIDEO_POLL_MS, mặc định
 * 10 giây) → ghi thời gian tạo, độ dài audio, credit tiêu (đọc `GET /v1/user/subscription`
 * `character_count` trước/sau, chạy tuần tự để không lẫn). Câu: 3 câu baseline + `--extra`.
 *
 * In bảng Markdown, ghi mẫu gốc vào `docs/report/nfr-raw/ai14-<thời điểm>.json`. Cột khẩu hình tiếng
 * Việt và cử chỉ để trống: người xem video tự chấm. Không ghi DB, không ghi cache.
 *
 * Cần: ELEVENLABS_API_KEY (gói Pro trở lên), ELEVENLABS_VOICE_ID_FEMALE / _MALE.
 */
import { writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const RAW_DIR = path.resolve(__dirname, "../../../docs/report/nfr-raw");
const P95_TARGET_SECONDS = 130;

function argValue(args, name) {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
}

function listArg(args, name, fallback) {
  const v = argValue(args, name);
  return v ? v.split(",").map((s) => s.trim()).filter(Boolean) : fallback;
}

export function percentile(values, p) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.max(0, Math.ceil((p / 100) * sorted.length) - 1)];
}

/** Gộp theo model: p50/p95 thời gian (giây), credit/giây trung bình, số lỗi. */
export function summarizeByModel(samples) {
  const byModel = new Map();
  for (const s of samples) {
    if (!byModel.has(s.model)) byModel.set(s.model, []);
    byModel.get(s.model).push(s);
  }
  return [...byModel.entries()].map(([model, rows]) => {
    const ok = rows.filter((r) => r.ok);
    const times = ok.map((r) => r.renderSeconds);
    const rates = ok.filter((r) => r.credits != null && r.audioSeconds > 0).map((r) => r.credits / r.audioSeconds);
    const p95 = percentile(times, 95);
    return {
      model,
      n: rows.length,
      failed: rows.length - ok.length,
      p50Seconds: percentile(times, 50),
      p95Seconds: p95,
      creditsPerSecond: rates.length ? Math.round((rates.reduce((a, b) => a + b, 0) / rates.length) * 10) / 10 : null,
      meetsP95: p95 != null && p95 <= P95_TARGET_SECONDS && ok.length === rows.length,
    };
  });
}

async function main() {
  const args = process.argv.slice(2);
  if (!args.includes("--yes")) {
    console.error("Script gọi ElevenLabs thật và TỐN CREDIT. Chạy lại với --yes nếu chắc chắn.");
    process.exit(1);
  }

  await import("../config/loadEnv.js");
  const { getBaselineQuestionTexts } = await import("../config/baselineQuestions.js");
  const { synthesizeSpeech, getElevenLabsVoiceId, isElevenLabsEnabled, getElevenLabsUsage } = await import("../services/ttsService.js");
  const { elevenLabsVideoProvider } = await import("../services/avatarProviders/elevenLabsVideoProvider.js");

  if (!elevenLabsVideoProvider.isEnabled() || !isElevenLabsEnabled()) {
    console.error("Thiếu ELEVENLABS_API_KEY hoặc ELEVENLABS_VOICE_ID_FEMALE / _MALE.");
    process.exit(1);
  }

  const models = listArg(args, "--models", ["creatify-aurora"]);
  const genders = listArg(args, "--genders", ["female", "male"]);
  const resolution = argValue(args, "--resolution");
  if (resolution) process.env.ELEVENLABS_VIDEO_RESOLUTION = resolution;
  const extra = argValue(args, "--extra");
  const questions = [...getBaselineQuestionTexts(), ...(extra ? [extra] : [])];

  const avatarImage = {
    female: process.env.HR_AVATAR_IMAGE_URL ?? "https://res.cloudinary.com/dee4bvivu/image/upload/v1778910708/AI-female_gxbcf1.png",
    male: process.env.HR_AVATAR_MALE_URL ?? "https://res.cloudinary.com/dee4bvivu/image/upload/v1778910708/AI-male_sdrvje.png",
  };
  const creditsUsed = async () => (await getElevenLabsUsage().catch(() => null))?.character_count ?? null;

  console.log(`[AI-14] ${models.length} model × ${genders.length} giới tính × ${questions.length} câu = ${models.length * genders.length * questions.length} video`);
  const samples = [];

  for (const model of models) {
    process.env.ELEVENLABS_VIDEO_MODEL = model;
    for (const gender of genders) {
      for (const [qi, text] of questions.entries()) {
        const sample = { model, gender, question: qi + 1, textLen: text.length, ok: false };
        try {
          const tts = await synthesizeSpeech(text, { voiceId: getElevenLabsVoiceId(gender) });
          sample.audioSeconds = Math.round((tts.buffer.length / 16_000) * 10) / 10;
          const before = await creditsUsed();
          const t0 = Date.now();
          const id = await elevenLabsVideoProvider.createJob({ imageUrl: avatarImage[gender], audio: tts });
          sample.generationId = id;
          sample.videoUrl = await elevenLabsVideoProvider.waitForResult(id);
          sample.renderSeconds = Math.round((Date.now() - t0) / 100) / 10;
          const after = await creditsUsed();
          // character_count gồm cả credit TTS của câu này (đã trừ trước `before`), nên hiệu là credit video.
          sample.credits = before != null && after != null ? after - before : null;
          sample.ok = true;
        } catch (err) {
          sample.error = err.message;
        }
        samples.push(sample);
        console.log(`  ${model} ${gender} câu ${qi + 1}: ${sample.ok ? `${sample.renderSeconds}s, ${sample.credits ?? "?"} credit` : `LỖI ${sample.error}`}`);
      }
    }
  }

  const summary = summarizeByModel(samples);
  console.log("\n| Model | Số video | Lỗi | p50 (s) | p95 (s) | Credit / giây | p95 ≤ 130 s | Khẩu hình tiếng Việt | Cử chỉ |");
  console.log("|:--|--:|--:|--:|--:|--:|:--|:--|:--|");
  for (const s of summary) {
    console.log(`| ${s.model} | ${s.n} | ${s.failed} | ${s.p50Seconds ?? "—"} | ${s.p95Seconds ?? "—"} | ${s.creditsPerSecond ?? "—"} | ${s.meetsP95 ? "ĐẠT" : "KHÔNG ĐẠT"} | (người xem chấm) | (người xem chấm) |`);
  }

  mkdirSync(RAW_DIR, { recursive: true });
  const file = path.join(RAW_DIR, `ai14-${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
  writeFileSync(file, `${JSON.stringify({ kind: "ai14_elevenlabs_video", measuredAt: new Date().toISOString(), resolution: process.env.ELEVENLABS_VIDEO_RESOLUTION || "720p", summary, samples }, null, 2)}\n`, "utf8");
  console.log(`\nMẫu gốc (có link video để xem, link hết hạn ~1 giờ): ${path.relative(process.cwd(), file)}`);
  console.log("Chọn model → đặt ELEVENLABS_VIDEO_MODEL; điền ELEVENLABS_VIDEO_CREDITS_PER_SECOND theo cột Credit / giây (AI-16).");
  if (!summary.some((s) => s.meetsP95)) {
    console.log("Không model nào đạt p95 ≤ 130 giây: báo nhóm (D-ID đã gỡ ở AI-17; còn giọng trình duyệt + ảnh tĩnh).");
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((err) => {
    console.error(err?.message || err);
    process.exit(1);
  });
}
