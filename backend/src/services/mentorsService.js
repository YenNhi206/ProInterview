import mongoose from "mongoose";
import { Mentor, toPublicMentor } from "../models/Mentor.js";
import { ensureMentorProfilesForAllMentorUsers } from "./mentorProfileService.js";

function isMongoReady() {
  return mongoose.connection.readyState === 1;
}

const MONGO_ERR = "MongoDB chưa kết nối. Kiểm tra MONGO_URI trong .env và đã chạy mongod chưa.";

/** Chỉ mentor đã liên kết tài khoản User role `mentor` (không còn mentor catalog/seed ảo). */
function isBookableMentorDoc(m) {
  const u = m?.userId;
  if (!u || typeof u !== "object" || !("role" in u)) return false;
  if (u.role !== "mentor") return false;
  if (u.isActive === false) return false;
  if (m.isActive === false) return false;
  return true;
}

export async function listMentors() {
  if (!isMongoReady()) {
    return { ok: false, status: 503, error: MONGO_ERR };
  }
  const repair = await ensureMentorProfilesForAllMentorUsers().catch((e) => {
    console.error("[listMentors] ensureMentorProfilesForAllMentorUsers:", e?.message || e);
    return { ok: false };
  });
  if (repair?.created > 0) {
    console.log(`[listMentors] Đã tạo ${repair.created} hồ sơ mentor thiếu (user role mentor).`);
  }
  const mentors = await Mentor.find({ userId: { $exists: true, $ne: null } })
    .populate({ path: "userId", select: "role isActive email" })
    .lean();
  const eligible = mentors.filter(isBookableMentorDoc);
  return {
    ok: true,
    mentors: eligible.map((m) => toPublicMentor(m)),
  };
}

export async function getMentorById(rawId) {
  if (!isMongoReady()) {
    return { ok: false, status: 503, error: MONGO_ERR };
  }
  const repair = await ensureMentorProfilesForAllMentorUsers().catch((e) => {
    console.error("[getMentorById] ensureMentorProfilesForAllMentorUsers:", e?.message || e);
    return { ok: false };
  });
  if (repair?.created > 0) {
    console.log(`[getMentorById] Đã tạo ${repair.created} hồ sơ mentor thiếu.`);
  }
  const or = [{ publicId: rawId }];
  if (mongoose.isValidObjectId(rawId)) {
    or.push({ _id: rawId });
    or.push({ userId: rawId });
  }
  const mentor = await Mentor.findOne({ $or: or })
    .populate({ path: "userId", select: "role isActive email" })
    .lean();
  if (!mentor || !isBookableMentorDoc(mentor)) {
    return { ok: false, status: 404, error: "Not found" };
  }
  return { ok: true, mentor: toPublicMentor(mentor) };
}
