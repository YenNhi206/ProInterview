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

/** Map trường profile từ User sang Mentor (dùng khi tạo mới và khi đồng bộ sau mỗi lần save). */
export function buildMentorProfileFieldsFromUser(user) {
  const name = pickStr(user.name) || "Mentor";
  const title = pickStr(user.desiredPosition, user.position) || "Mentor";
  const company = pickStr(user.currentCompany) || "—";
  const hr = Number(user.hourlyRate);
  const pricePerHour = Number.isFinite(hr) && hr > 0 ? Math.round(hr) : 350_000;
  const skillsRaw =
    Array.isArray(user.skills) && user.skills.length
      ? user.skills
      : Array.isArray(user.expertise)
        ? user.expertise
        : [];
  const skills = skillsRaw.map((s) => String(s).trim()).filter(Boolean);
  const fieldArr = skills.length ? [skills[0]] : [];
  const exp = Number(user.experience);
  const experienceYears = Number.isFinite(exp) && exp >= 0 ? Math.round(exp) : 0;
  return {
    name,
    title,
    company,
    avatar: typeof user.avatar === "string" ? user.avatar : "",
    bio: pickStr(user.bio),
    specialties: skills,
    fields: fieldArr,
    companies: company && company !== "—" ? [company] : [],
    experienceYears,
    pricePerHour,
    sessionTypes: [{ type: "mock_interview", durationMinutes: 60, price: pricePerHour }],
  };
}

/**
 * Cập nhật document Mentor đã có theo User (sau đổi role hoặc PATCH profile).
 */
export async function syncMentorProfileFromUser(user) {
  if (!user?._id) return null;
  // Giá đã có hiệu lực chỉ đổi qua yêu cầu đổi giá + admin duyệt (`approveMentorPrice`).
  // Hàm này chạy sau mỗi lần User.save (cả lúc đăng nhập), nên không được ghi lại giá
  // từ `User.hourlyRate` (thường trống → 350.000) đè lên giá admin đã duyệt.
  const { pricePerHour: _price, sessionTypes: _sessionTypes, ...fields } = buildMentorProfileFieldsFromUser(user);
  return Mentor.findOneAndUpdate({ userId: user._id }, { $set: fields }, { new: true });
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

  const profile = buildMentorProfileFieldsFromUser(user);
  const publicId = `u${String(uid)}`;

  let doc;
  try {
    doc = await Mentor.create({
      userId: uid,
      publicId,
      ...profile,
      available: true,
      isActive: true,
      isVerified: true,
      verifiedAt: new Date(),
      adminReview: {
        status: "approved",
        reason: "",
        reviewedAt: new Date(),
        reviewedBy: null,
      },
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
  // Mentor đã duyệt nhưng còn available=false (đăng ký cũ) — bật lại để nhận booking.
  const repaired = await Mentor.updateMany(
    {
      userId: { $exists: true, $ne: null },
      isActive: true,
      isVerified: true,
      available: false,
      "adminReview.status": "approved",
    },
    { $set: { available: true } },
  );

  return {
    ok: true,
    created,
    errors,
    totalMentorUsers: users.length,
    repairedAvailable: repaired.modifiedCount ?? 0,
  };
}
