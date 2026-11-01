/**
 * Seed bộ câu dự phòng tĩnh (config/fallbackQuestions.js) vào QuestionBank với status approved,
 * source moderator. Idempotent theo textHash: chạy lại không tạo trùng, không ghi đè câu moderator
 * đã sửa / khai tử. Chạy được ở production (dữ liệu thật, không phải seed demo):
 *   npm run db:sync-fallback-questions
 */
import "../config/loadEnv.js";
import mongoose from "mongoose";
import { connectDatabase } from "../db/connect.js";
import { syncFallbackQuestions } from "../services/questionBankService.js";

async function main() {
  const uri = process.env.MONGO_URI;
  if (!uri) {
    console.error("Thiếu MONGO_URI.");
    process.exit(1);
  }
  await connectDatabase(uri);
  const { total, inserted } = await syncFallbackQuestions();
  console.log(`Câu dự phòng tĩnh: ${total} câu, thêm mới ${inserted}, đã có sẵn ${total - inserted}.`);
  await mongoose.disconnect();
}

main().catch(async (e) => {
  console.error(e);
  try {
    await mongoose.disconnect();
  } catch {}
  process.exit(1);
});
