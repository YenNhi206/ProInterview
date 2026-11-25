/**
 * CO-06: render trước video avatar cho MỌI câu hỏi công ty đang được duyệt (× 2 giới tính).
 *
 * Câu duyệt mới tự xếp hàng render (companyQuestionVideoService). Script này dùng để:
 *   - backfill câu công ty đã duyệt trước khi có CO-06;
 *   - render lại sau khi đổi provider video hoặc AVATAR_PIPELINE_VERSION (cache key đổi).
 * Câu đã có cache thì chỉ đọc cache, không tốn credit. Chạy lại nhiều lần được.
 *
 * Xem trước (không render): npm run warmup:company-videos:dry · Chạy thật: npm run warmup:company-videos
 * DB khác .env: đặt TARGET_MONGO_URI (PowerShell: $env:TARGET_MONGO_URI="..."; npm run warmup:company-videos:dry)
 */
import { pathToFileURL } from "node:url";
import mongoose from "mongoose";
import { connectDatabase } from "../db/connect.js";
import {
  WARM_GENDERS,
  isCompanyVideoWarmEnabled,
  listApprovedCompanyQuestionTexts,
  warmCompanyQuestionTexts,
} from "../services/companyQuestionVideoService.js";

async function main() {
  // Nạp .env trong main(): test import module này không bị .env ghi đè biến môi trường.
  await import("../config/loadEnv.js");
  const uri = process.env.TARGET_MONGO_URI?.trim() || process.env.MONGO_URI;
  if (!uri) {
    console.error("Thiếu MONGO_URI (hoặc TARGET_MONGO_URI).");
    process.exit(1);
  }
  const dryRun =
    process.argv.includes("--dry-run") || process.env.DRY_RUN === "1" || process.env.npm_config_dry_run === "true";
  if (!dryRun && !isCompanyVideoWarmEnabled()) {
    console.error("Chưa cấu hình provider video (ELEVENLABS_API_KEY + giọng) hoặc đang bật MOCK_AI — không render được.");
    process.exit(1);
  }

  const host = uri.replace(/^mongodb(\+srv)?:\/\/([^@/]*@)?/, "").split(/[/?]/)[0];
  console.log(`[CO-06] kết nối tới: ${host}`);
  await connectDatabase(uri);

  const texts = await listApprovedCompanyQuestionTexts();
  console.log(`[CO-06] ${texts.length} câu công ty đã duyệt × ${WARM_GENDERS.length} giới tính = ${texts.length * WARM_GENDERS.length} video.`);

  if (dryRun) {
    console.log("DRY RUN: không render. Câu đã có cache sẽ không tốn credit khi chạy thật.");
  } else {
    const s = await warmCompanyQuestionTexts(texts, { log: (line) => console.log(`[CO-06] ${line}`) });
    console.log(`[CO-06] xong: render mới ${s.renders}, trúng cache ${s.cacheHits}, lỗi ${s.errors}.`);
    if (s.errors > 0) process.exitCode = 2;
  }
  await mongoose.disconnect();
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(async (e) => {
    console.error(e);
    try {
      await mongoose.disconnect();
    } catch {}
    process.exit(1);
  });
}
