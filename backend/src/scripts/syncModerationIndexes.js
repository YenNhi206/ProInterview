/**
 * Đồng bộ index cho QuestionBank / ModerationItem / Report (S1 Moderator HITL).
 * syncIndexes tạo index mới trong schema VÀ xoá index không còn khai báo (vd. "stats.flagCount_-1").
 * Chạy được ở production (không phải seed): npm run db:sync-moderation-indexes [-- --dry-run]
 */
import "../config/loadEnv.js";
import mongoose from "mongoose";
import { connectDatabase } from "../db/connect.js";
import { QuestionBank } from "../models/QuestionBank.js";
import { ModerationItem } from "../models/ModerationItem.js";
import { Report } from "../models/Report.js";

const MODELS = [QuestionBank, ModerationItem, Report];

async function main() {
  const uri = process.env.MONGO_URI;
  if (!uri) {
    console.error("Thiếu MONGO_URI.");
    process.exit(1);
  }

  const dryRun = process.argv.includes("--dry-run");
  await connectDatabase(uri);
  for (const Model of MODELS) {
    if (dryRun) {
      const diff = await Model.diffIndexes();
      console.log(`[${Model.modelName}] toCreate=${JSON.stringify(diff.toCreate)} toDrop=${JSON.stringify(diff.toDrop)}`);
    } else {
      const dropped = await Model.syncIndexes();
      console.log(`[${Model.modelName}] synced; dropped=${JSON.stringify(dropped)}`);
    }
  }
  console.log(dryRun ? "DRY RUN hoàn tất (không ghi DB)." : "Đã đồng bộ index.");
  await mongoose.disconnect();
}

main().catch(async (e) => {
  console.error(e);
  try {
    await mongoose.disconnect();
  } catch {}
  process.exit(1);
});
