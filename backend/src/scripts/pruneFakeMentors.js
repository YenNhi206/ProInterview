/**
 * Xóa document trong `mentors` không gắn user (dữ liệu catalog/seed cũ).
 * Mentor thật luôn có userId trỏ tới users.
 */
import "../config/loadEnv.js";
import mongoose from "mongoose";
import { connectDatabase } from "../db/connect.js";
import { Mentor } from "../models/Mentor.js";

async function main() {
  const uri = process.env.MONGO_URI;
  if (!uri) {
    console.error("Thiếu MONGO_URI.");
    process.exit(1);
  }
  await connectDatabase(uri);
  const r = await Mentor.deleteMany({
    $or: [{ userId: { $exists: false } }, { userId: null }],
  });
  console.log(`Đã xóa ${r.deletedCount} bản ghi mentor không có userId.`);
  await mongoose.disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
