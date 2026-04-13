import mongoose from "mongoose";
import { Report } from "../models/Report.js";
import { Mentor } from "../models/Mentor.js";

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

