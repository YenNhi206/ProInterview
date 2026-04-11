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

  const seedPath = join(__dirname, "../data/mentorsSeed.json");
  const seed = JSON.parse(readFileSync(seedPath, "utf8"));

  await connectDatabase(uri);
  const existing = await Mentor.countDocuments();
  if (existing > 0) {
    console.log(`Collection mentors đã có ${existing} bản ghi — bỏ qua seed.`);
    await mongoose.disconnect();
    return;
  }

  await Mentor.insertMany(seed.map(mapSeedRowToMentorDoc));
  console.log(`Đã seed ${seed.length} mentor vào database.`);
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
