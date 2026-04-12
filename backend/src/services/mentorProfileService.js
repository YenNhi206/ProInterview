import mongoose from "mongoose";
import { User } from "../models/User.js";
import { Mentor } from "../models/Mentor.js";

/** Chuỗi an toàn: tránh .trim() trên number/null từ DB lệch schema. */
function pickStr(...vals) {
  for (const v of vals) {
    if (v == null) continue;
    const s = typeof v === "string" ? v.trim() : String(v).trim();
    if (s) return s;
  }
  return "";
}

/**
 * Tạo document Mentor gắn với user (đăng ký role mentor).
 * publicId ổn định theo user để URL /mentors/:id hoạt động.
 */
export async function createMentorProfileForUser(user) {
  if (!user?._id) return null;
  const uid = user._id;
  const existing = await Mentor.findOne({ userId: uid }).select("_id").lean();
  if (existing) return existing;

  const name = pickStr(user.name) || "Mentor";
  const title = pickStr(user.desiredPosition, user.position) || "Mentor";
  const company = pickStr(user.currentCompany) || "—";
  const hr = Number(user.hourlyRate);
  const pricePerHour = Number.isFinite(hr) && hr > 0 ? Math.round(hr) : 350_000;
  const skills = Array.isArray(user.skills) ? user.skills.map((s) => String(s).trim()).filter(Boolean) : [];
  const fields = skills.length ? [skills[0]] : [];
  const exp = Number(user.experience);
  const experienceYears = Number.isFinite(exp) && exp >= 0 ? Math.round(exp) : 0;
  const publicId = `u${String(uid)}`;

  let doc;
  try {
    doc = await Mentor.create({
      userId: uid,
      publicId,
      name,
      title,
      company,
      avatar: typeof user.avatar === "string" ? user.avatar : "",
      bio: pickStr(user.bio),
      specialties: skills,
      fields,
      companies: company && company !== "—" ? [company] : [],
      experienceYears,
      pricePerHour,
      sessionTypes: [{ type: "mock_interview", durationMinutes: 60, price: pricePerHour }],
      available: true,
      isActive: true,
    });
  } catch (err) {
    if (err && err.code === 11000) {
      const again = await Mentor.findOne({ userId: uid }).select("_id").lean();
      if (again) return again;
    }
    console.error("[createMentorProfileForUser]", pickStr(user.email) || uid, err?.message || err);
    throw err;
  }
  return doc;
}

/** Đồng bộ hồ sơ mentor cho mọi user đang có role mentor nhưng chưa có bản ghi Mentor (migration / seed). */
export async function ensureMentorProfilesForAllMentorUsers() {
  if (mongoose.connection.readyState !== 1) return { ok: false, error: "MongoDB chưa kết nối." };
  const users = await User.find({ role: "mentor", isActive: { $ne: false } }).lean();
  let created = 0;
  let errors = 0;
  for (const u of users) {
    const existed = await Mentor.findOne({ userId: u._id }).select("_id").lean();
    if (existed) continue;
    try {
      await createMentorProfileForUser(u);
      created += 1;
    } catch (e) {
      errors += 1;
      console.error("[ensureMentorProfilesForAllMentorUsers]", u.email, e?.message || e);
    }
  }
  return { ok: true, created, errors, totalMentorUsers: users.length };
}
