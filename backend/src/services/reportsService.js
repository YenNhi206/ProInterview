import mongoose from "mongoose";
import { Report } from "../models/Report.js";
import { Mentor } from "../models/Mentor.js";
import { Booking } from "../models/Booking.js";
import { Review } from "../models/Review.js";
import { Course } from "../models/Course.js";

const MONGO_ERR = "MongoDB chưa kết nối. Kiểm tra MONGO_URI trong .env.";
function isMongoReady() {
  return mongoose.connection.readyState === 1;
}

export async function createReport(userId, body) {
  if (!isMongoReady()) return { ok: false, status: 503, error: MONGO_ERR };
  const uid = String(userId ?? "").trim();
  if (!mongoose.isValidObjectId(uid)) return { ok: false, status: 401, error: "Phiên đăng nhập không hợp lệ." };

  const targetType = String(body?.targetType ?? "mentor").trim();
  if (!["mentor", "booking", "review", "course"].includes(targetType)) {
    return { ok: false, status: 400, error: "targetType không hợp lệ." };
  }

  let targetIdRaw = String(body?.targetId ?? body?.mentorId ?? "").trim();
  if (!targetIdRaw) return { ok: false, status: 400, error: "Thiếu targetId." };

  // Resolve mentor publicId → _id
  if (targetType === "mentor" && !mongoose.isValidObjectId(targetIdRaw)) {
    const m = await Mentor.findOne({ publicId: targetIdRaw }).select("_id").lean();
    if (!m) return { ok: false, status: 404, error: "Không tìm thấy mentor." };
    targetIdRaw = String(m._id);
  }
  if (!mongoose.isValidObjectId(targetIdRaw)) return { ok: false, status: 400, error: "targetId không hợp lệ." };

  if (targetType === "mentor") {
    const m = await Mentor.findById(targetIdRaw).select("_id").lean();
    if (!m) return { ok: false, status: 404, error: "Không tìm thấy mentor." };
  } else if (targetType === "booking") {
    const b = await Booking.findById(targetIdRaw).select("userId mentorId").lean();
    if (!b) return { ok: false, status: 404, error: "Không tìm thấy booking." };
    const isCustomer = String(b.userId) === uid;
    let isTheirMentor = false;
    if (!isCustomer) {
      const mentorDoc = await Mentor.findOne({ userId: uid }).select("_id").lean();
      isTheirMentor = Boolean(mentorDoc && String(b.mentorId) === String(mentorDoc._id));
    }
    if (!isCustomer && !isTheirMentor) {
      return { ok: false, status: 403, error: "Chỉ báo cáo booking mà bạn tham gia (với tư cách khách hoặc mentor)." };
    }
  } else if (targetType === "review") {
    const rev = await Review.findById(targetIdRaw).select("userId").lean();
    if (!rev) return { ok: false, status: 404, error: "Không tìm thấy review." };
    if (String(rev.userId) === uid) {
      return { ok: false, status: 400, error: "Không báo cáo review do chính bạn viết." };
    }
  } else if (targetType === "course") {
    const c = await Course.findById(targetIdRaw).select("_id").lean();
    if (!c) return { ok: false, status: 404, error: "Không tìm thấy khóa học." };
  }

  const reason = String(body?.reason ?? body?.category ?? "").trim();
  const allow = new Set(["late", "unprofessional", "inappropriate", "no_show", "fraud", "other"]);
  if (!allow.has(reason)) {
    return { ok: false, status: 400, error: "reason không hợp lệ." };
  }

  const title = typeof body?.title === "string" ? body.title.trim().slice(0, 120) : "";
  const descRaw = typeof body?.description === "string" ? body.description.trim() : "";
  if (!descRaw || descRaw.length < 10) {
    return { ok: false, status: 400, error: "description quá ngắn." };
  }
  const description = title ? `Tiêu đề: ${title}\n\n${descRaw}` : descRaw;
  const evidenceUrls = Array.isArray(body?.evidenceUrls)
    ? body.evidenceUrls.map((u) => String(u).trim()).filter(Boolean).slice(0, 10)
    : [];

  const doc = await Report.create({
    reportedBy: uid,
    targetType,
    targetId: targetIdRaw,
    reason,
    description: description.slice(0, 8000),
    evidenceUrls,
  });

  return { ok: true, reportId: String(doc._id) };
}

