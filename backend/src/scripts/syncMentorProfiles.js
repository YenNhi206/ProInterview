/**
 * Tạo bản ghi Mentor cho mọi User đang có role mentor nhưng chưa có Mentor (sau đổi logic / DB cũ).
 * Chạy: node src/scripts/syncMentorProfiles.js (từ thư mục backend, có MONGO_URI trong .env)
 */
import "../config/loadEnv.js";
import mongoose from "mongoose";
import { connectDatabase } from "../db/connect.js";
import "../models/index.js";
import { ensureMentorProfilesForAllMentorUsers } from "../services/mentorProfileService.js";

async function main() {
  const uri = process.env.MONGO_URI;
  if (!uri) {
    console.error("Thiếu MONGO_URI.");
    process.exit(1);
  }
  await connectDatabase(uri);
  const r = await ensureMentorProfilesForAllMentorUsers();
  if (!r.ok) {
    console.error(r.error);
    process.exit(1);
  }
  console.log(
    `Đã tạo ${r.created} hồ sơ mentor mới (lỗi: ${r.errors ?? 0}, tổng user role mentor: ${r.totalMentorUsers}).`,
  );
  await mongoose.disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
