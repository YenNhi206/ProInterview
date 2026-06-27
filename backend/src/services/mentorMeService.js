import mongoose from "mongoose";
import { Mentor } from "../models/Mentor.js";
import { Notification } from "../models/Notification.js";
import { Review } from "../models/Review.js";
import { User } from "../models/User.js";

const MONGO_ERR = "MongoDB chưa kết nối. Kiểm tra MONGO_URI trong .env.";

export const MENTOR_PENDING_NOTIFICATION_TITLE = "Đăng ký mentor — đang chờ duyệt";

/** Tạo / mở lại thông báo «chờ duyệt mentor» (có thể đánh dấu đã đọc qua API notifications). */
export async function ensureMentorPendingNotification(userId) {
  if (!isMongoReady() || !mongoose.isValidObjectId(userId)) return null;
  const uid = new mongoose.Types.ObjectId(userId);
  const filter = { userId: uid, type: "system", title: MENTOR_PENDING_NOTIFICATION_TITLE };
  const existing = await Notification.findOne(filter).sort({ createdAt: -1 });
  if (existing) return existing;
  return Notification.create({
    userId: uid,
    type: "system",
    title: MENTOR_PENDING_NOTIFICATION_TITLE,
    body: "Hồ sơ mentor đã gửi. Admin sẽ phản hồi trong 24–48 giờ làm việc.",
    metadata: { actionUrl: "/profile" },
  });
}

export async function markMentorPendingNotificationsRead(userId) {
  if (!isMongoReady() || !mongoose.isValidObjectId(userId)) return;
  await Notification.updateMany(
    {
      userId: new mongoose.Types.ObjectId(userId),
      type: "system",
      title: MENTOR_PENDING_NOTIFICATION_TITLE,
    },
    { $set: { isRead: true, readAt: new Date() } },
  );
}

function isMongoReady() {
  return mongoose.connection.readyState === 1;
}

function normalizeList(value) {
  if (Array.isArray(value)) return value.map((x) => String(x).trim()).filter(Boolean);
  if (typeof value === "string") {
    return value
      .split(",")
      .map((x) => x.trim())
      .filter(Boolean);
  }
  return [];
}

function formatMonthVi(ym) {
  const s = String(ym ?? "").trim();
  if (!/^\d{4}-\d{2}$/.test(s)) return s || "—";
  const [y, m] = s.split("-");
  return `${m}/${y}`;
}

function workHistoryJsonToText(raw) {
  const s = String(raw ?? "").trim();
  if (!s.startsWith("{")) return "";
  try {
    const data = JSON.parse(s);
    if (data?.version !== 1 || !Array.isArray(data.entries)) return "";
    return data.entries
      .map((e) => {
        const role = String(e?.role ?? "").trim() || "—";
        const company = String(e?.company ?? "").trim() || "—";
        let period = "—";
        if (e?.isCurrent && e?.startMonth) {
          period = `${formatMonthVi(e.startMonth)} — Hiện tại`;
        } else if (e?.startMonth && e?.endMonth) {
          period = `${formatMonthVi(e.startMonth)} — ${formatMonthVi(e.endMonth)}`;
        } else if (e?.startMonth) {
          period = `Từ ${formatMonthVi(e.startMonth)}`;
        } else if (e?.isCurrent) {
          period = "Hiện tại";
        }
        const tag = e?.isCurrent ? " [Hiện tại]" : "";
        const line = `${role} · ${company}${tag} (${period})`;
        const note = String(e?.note ?? "").trim();
        return note ? `${line}\n  ${note}` : line;
      })
      .join("\n");
  } catch {
    return "";
  }
}

/** Ghép KN từ JSON lịch sử, ô mô tả hoặc chức danh / công ty / số năm (form Profile). */
function buildProfileWorkExperienceText(user, body, title, company, experienceYears) {
  const fromUser = String(user?.profileWorkExperience ?? "").trim();
  const fromBody = String(body?.workExperience ?? body?.profileWorkExperience ?? "").trim();
  if (fromBody.startsWith("{")) return fromBody;
  if (fromUser.startsWith("{")) return fromUser;
  const fromJson = workHistoryJsonToText(fromUser) || workHistoryJsonToText(fromBody);
  if (fromJson) return fromJson;
  if (fromUser && !fromUser.startsWith("{")) return fromUser;
  if (fromBody && !fromBody.startsWith("{")) return fromBody;
  const lines = [];
  if (title) lines.push(`Chức danh: ${title}`);
  if (company && company !== "Freelancer") lines.push(`Công ty: ${company}`);
  if (Number.isFinite(experienceYears) && experienceYears > 0) {
    lines.push(`Số năm kinh nghiệm: ${experienceYears}`);
  }
  return lines.join("\n");
}

export async function getMyMentorDoc(userId) {
  if (!isMongoReady()) return { ok: false, status: 503, error: MONGO_ERR };
  const uid = String(userId ?? "").trim();
  if (!mongoose.isValidObjectId(uid)) return { ok: false, status: 401, error: "Phiên đăng nhập không hợp lệ." };
  const doc = await Mentor.findOne({ userId: uid });
  if (!doc) return { ok: false, status: 404, error: "Không tìm thấy hồ sơ mentor." };
  return { ok: true, mentor: doc };
}

export async function applyForMentor(userId, body) {
  if (!isMongoReady()) return { ok: false, status: 503, error: MONGO_ERR };
  const uid = String(userId ?? "").trim();
  if (!mongoose.isValidObjectId(uid)) return { ok: false, status: 401, error: "Phiên đăng nhập không hợp lệ." };

  const user = await User.findById(uid).select(
    "name email role isActive avatar bio desiredPosition position currentCompany experience skills expertise school profileExtracurricular profileEducation profileWorkExperience profileAwards",
  );
  if (!user || user.isActive === false) {
    return { ok: false, status: 404, error: "Không tìm thấy tài khoản hợp lệ." };
  }
  if (user.role === "admin") {
    return { ok: false, status: 400, error: "Tài khoản admin không thể đăng ký mentor." };
  }

  const title = String(body?.title || "").trim();
  const bio = String(body?.bio || "").trim();
  const company = String(body?.company || "").trim() || "Freelancer";
  const linkedinUrl = String(body?.linkedinProfile || body?.linkedinUrl || "").trim();
  const portfolioUrl = String(body?.portfolioLink || body?.portfolioUrl || "").trim();
  const specialties = normalizeList(body?.tags?.length ? body.tags : body?.skills);
  let companies = normalizeList(body?.companies?.length ? body.companies : body?.careerHistory);
  const fields = normalizeList(body?.fields);
  const targetRate = Number(body?.targetRate ?? body?.pricePerHour);
  const experienceYears = Number(body?.yearsOfExperience ?? body?.experienceYears);
  const responseTime =
    String(body?.responseTime ?? "").trim() || "< 24 giờ";
  const timezone =
    String(body?.timezone ?? "").trim() || "Asia/Ho_Chi_Minh";

  if (!bio) {
    return { ok: false, status: 400, error: "Vui lòng điền Giới thiệu bản thân." };
  }
  if (!specialties.length) {
    return { ok: false, status: 400, error: "Vui lòng điền Kỹ năng & chứng chỉ." };
  }
  const workRaw = String(
    body?.workExperience ?? body?.profileWorkExperience ?? user.profileWorkExperience ?? "",
  ).trim();
  let hasWork =
    companies.length > 0 ||
    title.length > 0 ||
    String(body?.company || "").trim().length > 0;
  if (!hasWork && workRaw.startsWith("{")) {
    try {
      const data = JSON.parse(workRaw);
      if (data?.version === 1 && Array.isArray(data.entries)) {
        hasWork = data.entries.some(
          (e) =>
            String(e?.role ?? "").trim() ||
            String(e?.company ?? "").trim() ||
            String(e?.note ?? "").trim(),
        );
      }
    } catch {
      /* ignore */
    }
  } else if (!hasWork && workRaw && !workRaw.startsWith("{")) {
    hasWork = true;
  }
  if (!hasWork) {
    return { ok: false, status: 400, error: "Vui lòng điền Kinh nghiệm làm việc." };
  }
  if (!Number.isFinite(targetRate) || targetRate <= 0) {
    return { ok: false, status: 400, error: "Vui lòng nhập mức phí mong muốn (VNĐ/60 phút)." };
  }

  const mentorTitle = title || String(body?.company || "").trim() || "Mentor";
  const expYears =
    Number.isFinite(experienceYears) && experienceYears >= 0 ? Math.round(experienceYears) : 0;

  if (companies.length === 0 && company && company !== "Freelancer") {
    companies = [company];
  }

  const profileEducation = String(
    body?.profileEducation ?? body?.education ?? user.profileEducation ?? user.school ?? "",
  ).trim();
  const profileWorkExperience = buildProfileWorkExperienceText(
    user,
    body,
    mentorTitle,
    company,
    expYears,
  );
  const profileExtracurricular = String(
    body?.profileExtracurricular ?? body?.extracurricular ?? user.profileExtracurricular ?? "",
  ).trim();
  const profileAwards = String(body?.profileAwards ?? body?.awards ?? user.profileAwards ?? "").trim();

  if (bio) user.bio = bio;
  if (profileEducation) user.profileEducation = profileEducation;
  if (profileWorkExperience) user.profileWorkExperience = profileWorkExperience;
  if (profileExtracurricular) user.profileExtracurricular = profileExtracurricular;
  if (profileAwards) user.profileAwards = profileAwards;
  if (mentorTitle) {
    user.desiredPosition = mentorTitle;
    user.position = mentorTitle;
  }
  if (company) user.currentCompany = company;
  if (expYears >= 0) user.experience = expYears;
  if (specialties.length) {
    user.skills = specialties;
    user.expertise = specialties;
  }
  await user.save();

  const baseProfile = {
    name: String(user.name || "Mentor").trim() || "Mentor",
    title: mentorTitle,
    company,
    avatar: String(user.avatar || "").trim(),
    bio,
    specialties,
    fields,
    companies,
    profileEducation,
    profileWorkExperience,
    profileExtracurricular,
    profileAwards,
    linkedinUrl,
    portfolioUrl,
    experienceYears: expYears,
    pricePerHour: Number.isFinite(targetRate) && targetRate > 0 ? Math.round(targetRate) : 350_000,
    responseTime,
    timezone,
    isActive: false,
    available: false,
    isVerified: false,
    adminReview: {
      status: "pending",
      reason: "",
      reviewedAt: null,
      reviewedBy: null,
    },
  };

  let mentor = await Mentor.findOne({ userId: uid });
  if (!mentor) {
    mentor = await Mentor.create({
      userId: uid,
      publicId: `u${uid}`,
      ...baseProfile,
      sessionTypes: [{ type: "mock_interview", durationMinutes: 60, price: baseProfile.pricePerHour }],
    });
  } else {
    if (mentor.adminReview?.status === "approved") {
      // Preserve approval/verification status when an approved mentor updates their profile
      const { isVerified, adminReview, isActive, available, ...profileUpdate } = baseProfile;
      Object.assign(mentor, profileUpdate);
    } else {
      Object.assign(mentor, baseProfile);
    }
    if (!Array.isArray(mentor.sessionTypes) || mentor.sessionTypes.length === 0) {
      mentor.sessionTypes = [{ type: "mock_interview", durationMinutes: 60, price: baseProfile.pricePerHour }];
    }
    await mentor.save();
  }

  /** Không đổi role User tại đây — chỉ admin phê duyệt mới cấp `mentor` (PATCH /api/admin/mentors/:id/status). */

  try {
    await ensureMentorPendingNotification(uid);
  } catch {
    /* không chặn đăng ký nếu tạo thông báo lỗi */
  }

  return { ok: true, mentor: toPublicMentorMe(mentor) };
}

export function toPublicMentorMe(doc) {
  const m = doc.toObject ? doc.toObject() : { ...doc };
  const adminReview = m.adminReview || {};
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
    portfolioUrl: m.portfolioUrl ?? "",
    profileEducation: m.profileEducation ?? "",
    profileWorkExperience: m.profileWorkExperience ?? "",
    profileExtracurricular: m.profileExtracurricular ?? "",
    profileAwards: m.profileAwards ?? "",
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
    adminReview: {
      status: String(adminReview.status || "pending"),
      reason: String(adminReview.reason || ""),
      reviewedAt: adminReview.reviewedAt || null,
    },
  };
}

export async function getMyMentorProfile(userId) {
  const r = await getMyMentorDoc(userId);
  if (!r.ok) return r;
  return { ok: true, mentor: toPublicMentorMe(r.mentor) };
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
  if (typeof body.portfolioUrl === "string") m.portfolioUrl = body.portfolioUrl.trim();
  else if (typeof body.portfolioLink === "string") m.portfolioUrl = body.portfolioLink.trim();
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
      .map((s) => {
        const dur = Math.round(Number(s?.durationMinutes));
        const pr = Math.round(Number(s?.price));
        return {
          type: typeof s?.type === "string" ? s.type : undefined,
          durationMinutes: Number.isFinite(dur) && dur >= 15 && dur <= 480 ? dur : undefined,
          price: Number.isFinite(pr) && pr > 0 ? pr : undefined,
        };
      })
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
  const m = await Mentor.findOne({ $or: or })
    .select("publicId timezone availableSlots blockedDates recurringSchedule isActive available isVerified")
    .lean();
  if (!m || m.isActive === false || m.available === false || m.isVerified !== true) {
    return { ok: false, status: 404, error: "Not found" };
  }
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
    .populate({ path: "userId", select: "name avatar desiredPosition" })
    .lean();
  return {
    ok: true,
    reviews: rows.map((r) => {
      const u = r.userId && typeof r.userId === "object" ? r.userId : null;
      return {
        id: String(r._id),
        rating: r.rating,
        comment: r.comment ?? "",
        tags: r.tags ?? [],
        reply: r.reply?.content ? { content: r.reply.content, repliedAt: r.reply.repliedAt } : null,
        createdAt: r.createdAt,
        userName: u?.name || "",
        userAvatar: u?.avatar || "",
      };
    }),
  };
}

