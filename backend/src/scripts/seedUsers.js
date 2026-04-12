import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import "../config/loadEnv.js";
import bcrypt from "bcrypt";
import mongoose from "mongoose";
import { connectDatabase } from "../db/connect.js";
import "../models/index.js";
import { User } from "../models/User.js";
import { createMentorProfileForUser } from "../services/mentorProfileService.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SALT_ROUNDS = 10;

async function main() {
  const uri = process.env.MONGO_URI;
  if (!uri) {
    console.error("Thiếu MONGO_URI. Tạo file .env và điền chuỗi kết nối MongoDB.");
    process.exit(1);
  }

  const seedPath = join(__dirname, "../data/usersSeed.json");
  const seed = JSON.parse(readFileSync(seedPath, "utf8"));

  await connectDatabase(uri);

  const existing = await User.countDocuments();
  if (existing > 0) {
    console.log(`Collection users đã có ${existing} bản ghi — bỏ qua seed user mặc định.`);
    await mongoose.disconnect();
    return;
  }

  const docs = [];
  for (const row of seed) {
    const email = String(row.email || "").trim().toLowerCase();
    const password = String(row.password || "");
    const name = String(row.name || "").trim();
    const role = ["customer", "mentor", "admin"].includes(row.role) ? row.role : "customer";

    if (!email || !password || !name) {
      console.warn("Bỏ qua dòng seed thiếu email/password/name:", row);
      continue;
    }

    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
    docs.push({
      email,
      name,
      role,
      passwordHash,
    });
  }

  if (docs.length === 0) {
    console.error("Không có bản ghi user hợp lệ trong usersSeed.json.");
    await mongoose.disconnect();
    process.exit(1);
  }

  await User.insertMany(docs);
  console.log(`Đã seed ${docs.length} user mặc định (dev).`);
  const mentorUsers = await User.find({ role: "mentor" });
  for (const u of mentorUsers) {
    await createMentorProfileForUser(u).catch((e) => console.error("Mentor profile:", e));
  }
  if (mentorUsers.length) {
    console.log(`Đã tạo / đồng bộ ${mentorUsers.length} hồ sơ Mentor gắn user (role mentor).`);
  }
  for (const d of docs) {
    console.log(`  - ${d.email} (${d.role})`);
  }
  console.log("Mật khẩu: xem src/data/usersSeed.json — chỉ dùng trên môi trường dev.");

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
