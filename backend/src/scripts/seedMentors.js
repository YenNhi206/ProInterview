import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import "../config/loadEnv.js";
import mongoose from "mongoose";
import { connectDatabase } from "../db/connect.js";
import { Mentor, mapSeedRowToMentorDoc } from "../models/Mentor.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

async function main() {
  const uri = process.env.MONGO_URI;
  if (!uri) {
    console.error("Thiếu MONGO_URI. Tạo file .env từ .env.example và điền chuỗi kết nối.");
    process.exit(1);
  }

  await connectDatabase(uri);

  if (process.env.SEED_LEGACY_MENTORS !== "1") {
    console.log(
      "Bỏ qua seed mentor ảo từ mentorsSeed.json. Chỉ mentor có User (role mentor) mới hiện trên booking.",
    );
    console.log("Để nạp dữ liệu demo cũ: SEED_LEGACY_MENTORS=1 npm run seed");
    await mongoose.disconnect();
    return;
  }

  const seedPath = join(__dirname, "../data/mentorsSeed.json");
  const seed = JSON.parse(readFileSync(seedPath, "utf8"));

  const existing = await Mentor.countDocuments();
  if (existing > 0) {
    console.log(`Collection mentors đã có ${existing} bản ghi — bỏ qua seed.`);
    await mongoose.disconnect();
    return;
  }

  await Mentor.insertMany(seed.map(mapSeedRowToMentorDoc));
  console.log(`Đã seed ${seed.length} mentor (legacy) vào database.`);
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
