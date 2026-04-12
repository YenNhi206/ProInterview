import mongoose from "mongoose";

const { Schema } = mongoose;

const userSchema = new Schema(
  {
    supabaseId: { type: String, unique: true, sparse: true },
    googleId: { type: String, unique: true, sparse: true, trim: true },
    /** Dữ liệu cũ (đăng nhập Google trước khi đổi tên field) — ưu tiên đồng bộ sang `googleId` */
    googleSub: { type: String, unique: true, sparse: true, trim: true, select: false },

    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
    passwordHash: { type: String, select: false },
    avatar: { type: String, default: "" },

    role: { type: String, enum: ["customer", "mentor", "admin"], default: "customer" },
    plan: { type: String, enum: ["free", "starter_pro", "elite_pro"], default: "free" },
    planExpiresAt: { type: Date, default: null },

    quota: {
      cvAnalysisUsed: { type: Number, default: 0 },
      cvAnalysisLimit: { type: Number, default: 3 },
      interviewUsed: { type: Number, default: 0 },
      interviewLimit: { type: Number, default: 1 },
      interviewQuestionsAllowed: { type: Number, default: 3 },
      resetAt: { type: Date, default: Date.now },
    },

    phone: { type: String, default: "" },
    dob: { type: String, default: "" },
    gender: { type: String, enum: ["male", "female", "other", ""], default: "" },
    desiredPosition: { type: String, default: "" },
    /** Legacy — đồng bộ dần sang `desiredPosition` */
    position: { type: String, default: "" },
    experience: { type: Number, default: 0 },
    currentCompany: { type: String, default: "" },
    skills: [{ type: String }],
    /** Legacy — đồng bộ dần sang `skills` */
    expertise: [{ type: String }],

    /** Tương thích API profile cũ (FE đang gửi /me) */
    school: { type: String, default: "" },
    bio: { type: String, default: "" },
    hourlyRate: { type: Number },

    settings: {
      emailNotifications: { type: Boolean, default: true },
      profileVisibility: { type: String, enum: ["public", "private"], default: "public" },
      shareInterviewResults: { type: Boolean, default: false },
    },

    integrations: {
      googleCalendar: {
        connected: { type: Boolean, default: false },
        accessToken: { type: String, default: "" },
        refreshToken: { type: String, default: "" },
        connectedAt: { type: Date },
      },
      linkedin: {
        connected: { type: Boolean, default: false },
        profileUrl: { type: String, default: "" },
        connectedAt: { type: Date },
      },
    },

    journeyProgress: {
      uploadedCV: { type: Boolean, default: false },
      analyzedCVJD: { type: Boolean, default: false },
      completedInterview: { type: Boolean, default: false },
      bookedMentor: { type: Boolean, default: false },
      receivedOffer: { type: Boolean, default: false },
    },

    isEmailVerified: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true },
    lastLoginAt: { type: Date },
  },
  { collection: "users", timestamps: true }
);

userSchema.index({ email: 1 });
userSchema.index({ role: 1 });
userSchema.index({ plan: 1 });

/**
 * Mỗi khi User được lưu qua Mongoose (đăng ký, PATCH /me, …) mà role là mentor
 * thì đảm bảo có document tương ứng trong collection `mentors`.
 * (Cập nhật trực tiếp trong Compass không chạy hook — dùng sync khi start API hoặc npm run sync:mentor-profiles.)
 */
userSchema.post("save", async function userPostSaveMentorSync(doc) {
  try {
    const d = doc;
    if (!d || d.isActive === false) return;
    if (d.role !== "mentor") return;
    const { createMentorProfileForUser } = await import("../services/mentorProfileService.js");
    await createMentorProfileForUser(d);
  } catch (e) {
    console.error("[User.post save] đồng bộ mentors:", e?.message || e);
  }
});

export const User = mongoose.models.User ?? mongoose.model("User", userSchema);

/**
 * Payload gửi về FE — giữ các alias trường cũ (position, expertise, field, experience string).
 */
export function toPublicUser(doc) {
  if (!doc) return null;
  const plain = doc.toObject ? doc.toObject({ getters: true }) : { ...doc };
  const googleId = plain.googleId ?? doc.googleId;
  const googleSub = plain.googleSub ?? doc.googleSub;
  const skills =
    Array.isArray(plain.skills) && plain.skills.length
      ? plain.skills
      : Array.isArray(plain.expertise)
        ? plain.expertise
        : [];
  const out = {
    id: plain._id ? plain._id.toString() : undefined,
    email: plain.email,
    name: plain.name,
    role: plain.role,
    avatar: plain.avatar,
    phone: plain.phone ?? "",
    position: (plain.desiredPosition || plain.position || "").trim(),
    school: plain.school ?? "",
    field: skills[0] ?? "",
    expertise: skills,
    experience:
      plain.experience != null && plain.experience !== ""
        ? String(plain.experience)
        : "",
    hourlyRate: plain.hourlyRate,
    bio: plain.bio ?? "",
    plan: plain.plan,
    planExpiresAt: plain.planExpiresAt,
    /** Đổi mật khẩu: không bắt buộc mật khẩu cũ nếu đã liên kết Google */
    hasGoogleLogin: Boolean(
      (typeof googleId === "string" && googleId.trim()) ||
        (typeof googleSub === "string" && googleSub.trim())
    ),
  };
  return out;
}
