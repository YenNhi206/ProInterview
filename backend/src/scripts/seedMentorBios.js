import "./_devOnlyGuard.js";
/**
 * Điền mô tả ngắn (bio) cho mentor chưa có bio — dùng profileWorkExperience hoặc tạo từ title/công ty.
 * Chạy: npm run seed:mentor-bios (từ thư mục backend)
 */
import "../config/loadEnv.js";
import mongoose from "mongoose";
import { connectDatabase } from "../db/connect.js";
import { Mentor } from "../models/Mentor.js";

const MAX_BIO = 180;

function excerpt(text, max = MAX_BIO) {
  const t = String(text || "")
    .trim()
    .replace(/\s+/g, " ");
  if (!t) return "";
  if (t.length <= max) return t;
  const cut = t.slice(0, max);
  const lastSpace = cut.lastIndexOf(" ");
  const base = lastSpace > 60 ? cut.slice(0, lastSpace) : cut;
  return `${base.trim()}…`;
}

function buildBioFromProfile(m) {
  const fromWork = excerpt(m.profileWorkExperience);
  if (fromWork) return fromWork;

  const title = String(m.title || "Mentor").trim();
  const company = String(m.company || "").trim();
  const companyOk = company && company !== "—";
  const yrs = Number(m.experienceYears);
  const specs = (Array.isArray(m.specialties) ? m.specialties : [])
    .map((s) => String(s).trim())
    .filter(Boolean)
    .slice(0, 3);

  const parts = [];
  if (Number.isFinite(yrs) && yrs > 0) {
    parts.push(`${yrs}+ năm kinh nghiệm`);
  }
  if (companyOk) {
    parts.push(`${title} tại ${company}`);
  } else {
    parts.push(title);
  }
  if (specs.length) {
    parts.push(`hỗ trợ ${specs.join(", ")}`);
  } else {
    parts.push("mock interview, review CV và định hướng nghề nghiệp");
  }

  return excerpt(parts.join(". ") + ".");
}

async function main() {
  const force = process.argv.includes("--force");
  const uri = process.env.MONGO_URI;
  if (!uri) {
    console.error("Thiếu MONGO_URI.");
    process.exit(1);
  }
  await connectDatabase(uri);

  const mentors = force
    ? await Mentor.find({}).lean()
    : await Mentor.find({
        $or: [{ bio: { $exists: false } }, { bio: null }, { bio: "" }, { bio: /^\s*$/ }],
      }).lean();

  let updated = 0;
  for (const m of mentors) {
    const current = String(m.bio || "").trim();
    const bio = buildBioFromProfile(m);
    if (!bio) continue;
    if (!force && current) continue;
    await Mentor.updateOne({ _id: m._id }, { $set: { bio } });
    updated += 1;
    console.log(`  ✓ ${m.name}: ${bio.slice(0, 72)}${bio.length > 72 ? "…" : ""}`);
  }

  const withBio = await Mentor.countDocuments({ bio: { $regex: /\S/ } });
  const total = await Mentor.countDocuments();
  console.log(`\nĐã cập nhật ${updated}/${mentors.length} mentor thiếu bio. Tổng có bio: ${withBio}/${total}.`);
  await mongoose.disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
