import mongoose from "mongoose";
import { Mentor } from "../models/Mentor.js";
import { Review } from "../models/Review.js";

const MONGO_ERR = "MongoDB chưa kết nối. Kiểm tra MONGO_URI trong .env.";

function isMongoReady() {
  return mongoose.connection.readyState === 1;
}

export async function getMyMentorDoc(userId) {
  if (!isMongoReady()) return { ok: false, status: 503, error: MONGO_ERR };
  const uid = String(userId ?? "").trim();
  if (!mongoose.isValidObjectId(uid)) return { ok: false, status: 401, error: "Phiên đăng nhập không hợp lệ." };
  const doc = await Mentor.findOne({ userId: uid });
  if (!doc) return { ok: false, status: 404, error: "Không tìm thấy hồ sơ mentor." };
  return { ok: true, mentor: doc };
}

export function toPublicMentorMe(doc) {
  const m = doc.toObject ? doc.toObject() : { ...doc };
  return {
    id: m.publicId ?? String(m._id),
    userId: m.userId ? String(m.userId) : null,
    publicId: m.publicId ?? "",
    name: m.name,
    title: m.title,
    company: m.company,
    avatar: m.avatar ?? "",
    bio: m.bio ?? "",
    specialties: m.specialties ?? [],
    fields: m.fields ?? [],
    companies: m.companies ?? [],
    linkedinUrl: m.linkedinUrl ?? "",
    experienceYears: m.experienceYears ?? 0,
    pricePerHour: m.pricePerHour ?? 0,
    sessionTypes: m.sessionTypes ?? [],
    available: m.available !== false,
    responseTime: m.responseTime ?? "",
    timezone: m.timezone ?? "Asia/Ho_Chi_Minh",
    availableSlots: m.availableSlots ?? {},
    blockedDates: m.blockedDates ?? [],
    recurringSchedule: m.recurringSchedule ?? [],
    stats: m.stats ?? {},
    finance: m.finance ?? {},
    isVerified: Boolean(m.isVerified),
    isActive: m.isActive !== false,
  };
}

export async function patchMyMentorProfile(userId, body) {
  const r = await getMyMentorDoc(userId);
  if (!r.ok) return r;
  const m = r.mentor;

  if (typeof body.name === "string" && body.name.trim()) m.name = body.name.trim();
  if (typeof body.title === "string" && body.title.trim()) m.title = body.title.trim();
  if (typeof body.company === "string") m.company = body.company.trim();
  if (typeof body.avatar === "string") m.avatar = body.avatar.trim();
  if (typeof body.bio === "string") m.bio = body.bio.trim();
  if (Array.isArray(body.specialties)) m.specialties = body.specialties.map((x) => String(x).trim()).filter(Boolean);
  if (Array.isArray(body.fields)) m.fields = body.fields.map((x) => String(x).trim()).filter(Boolean);
  if (Array.isArray(body.companies)) m.companies = body.companies.map((x) => String(x).trim()).filter(Boolean);
  if (typeof body.linkedinUrl === "string") m.linkedinUrl = body.linkedinUrl.trim();
  if (body.experienceYears != null) {
    const n = Number(body.experienceYears);
    if (Number.isFinite(n) && n >= 0) m.experienceYears = Math.round(n);
  }
  if (body.pricePerHour != null) {
    const n = Number(body.pricePerHour);
    if (Number.isFinite(n) && n > 0) m.pricePerHour = Math.round(n);
  }
  if (Array.isArray(body.sessionTypes)) {
    m.sessionTypes = body.sessionTypes
      .map((s) => ({
        type: typeof s?.type === "string" ? s.type : undefined,
        durationMinutes: Number.isFinite(Number(s?.durationMinutes)) ? Math.round(Number(s.durationMinutes)) : undefined,
        price: Number.isFinite(Number(s?.price)) ? Math.round(Number(s.price)) : undefined,
      }))
      .filter((s) => s.type);
  }
  if (typeof body.available === "boolean") m.available = body.available;
  if (typeof body.responseTime === "string") m.responseTime = body.responseTime.trim();
  if (typeof body.timezone === "string" && body.timezone.trim()) m.timezone = body.timezone.trim();

  await m.save();
  return { ok: true, mentor: toPublicMentorMe(m) };
}

export async function patchMyAvailability(userId, body) {
  const r = await getMyMentorDoc(userId);
  if (!r.ok) return r;
  const m = r.mentor;

  // availableSlots: object map { "YYYY-MM-DD": ["09:00","10:00"] }
  if (body.availableSlots && typeof body.availableSlots === "object") {
    const out = {};
    for (const [k, v] of Object.entries(body.availableSlots)) {
      if (!k) continue;
      const slots = Array.isArray(v) ? v.map((x) => String(x).trim()).filter(Boolean) : [];
      out[String(k).trim()] = slots;
    }
    m.availableSlots = out;
  }

  // recurringSchedule: [{ dayOfWeek: 0-6 (Mon=0), slots: ["09:00", ...] }]
  if (Array.isArray(body.recurringSchedule)) {
    m.recurringSchedule = body.recurringSchedule
      .map((row) => {
        const d = Number(row?.dayOfWeek);
        const slots = Array.isArray(row?.slots) ? row.slots.map((x) => String(x).trim()).filter(Boolean) : [];
        if (!Number.isFinite(d)) return null;
        return { dayOfWeek: Math.max(0, Math.min(6, Math.round(d))), slots };
      })
      .filter(Boolean);
  }

  await m.save();
  return {
    ok: true,
    availability: {
      mentorId: m.publicId ?? String(m._id),
      timezone: m.timezone ?? "Asia/Ho_Chi_Minh",
      availableSlots: m.availableSlots ?? {},
      recurringSchedule: m.recurringSchedule ?? [],
      blockedDates: m.blockedDates ?? [],
    },
  };
}

export async function blockDates(userId, body) {
  const r = await getMyMentorDoc(userId);
  if (!r.ok) return r;
  const m = r.mentor;
  const dates = Array.isArray(body?.dates) ? body.dates : body?.date ? [body.date] : [];
  const cleaned = dates.map((d) => String(d).trim()).filter(Boolean);
  if (!cleaned.length) return { ok: false, status: 400, error: "Thiếu dates." };
  const set = new Set([...(m.blockedDates ?? []), ...cleaned]);
  m.blockedDates = [...set];
  await m.save();
  return { ok: true, blockedDates: m.blockedDates };
}

export async function getAvailabilityByMentorId(rawId) {
  if (!isMongoReady()) return { ok: false, status: 503, error: MONGO_ERR };
  const or = [{ publicId: rawId }];
  if (mongoose.isValidObjectId(rawId)) {
    or.push({ _id: rawId });
    or.push({ userId: rawId });
  }
  const m = await Mentor.findOne({ $or: or }).select("publicId timezone availableSlots blockedDates recurringSchedule isActive").lean();
  if (!m || m.isActive === false) return { ok: false, status: 404, error: "Not found" };
  return {
    ok: true,
    availability: {
      mentorId: m.publicId ?? String(m._id),
      timezone: m.timezone ?? "Asia/Ho_Chi_Minh",
      availableSlots: m.availableSlots ?? {},
      recurringSchedule: m.recurringSchedule ?? [],
      blockedDates: m.blockedDates ?? [],
    },
  };
}

export async function listReviewsForMentor(rawMentorId) {
  if (!isMongoReady()) return { ok: false, status: 503, error: MONGO_ERR };
  const or = [{ publicId: rawMentorId }];
  if (mongoose.isValidObjectId(rawMentorId)) or.push({ _id: rawMentorId });
  const mentor = await Mentor.findOne({ $or: or }).select("_id isActive publicId").lean();
  if (!mentor || mentor.isActive === false) return { ok: false, status: 404, error: "Not found" };
  const rows = await Review.find({ targetType: "mentor", targetId: mentor._id, isVisible: { $ne: false } })
    .sort({ createdAt: -1 })
    .lean();
  return {
    ok: true,
    reviews: rows.map((r) => ({
      id: String(r._id),
      rating: r.rating,
      comment: r.comment ?? "",
      tags: r.tags ?? [],
      reply: r.reply?.content ? { content: r.reply.content, repliedAt: r.reply.repliedAt } : null,
      createdAt: r.createdAt,
    })),
  };
}

