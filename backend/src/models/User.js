import mongoose from "mongoose";
import { resolveStoredUploadUrl } from "../utils/resolveStoredUploadUrl.js";
import { publicNotificationPrefsForRole } from "../constants/notificationPrefs.js";

const { Schema } = mongoose;

const userSchema = new Schema(
  {
    supabaseId: { type: String, unique: true, sparse: true },
    googleId: { type: String, unique: true, sparse: true, trim: true },
    /** Dữ liệu cũ (đăng nhập Google trước khi đổi tên field) — ưu tiên đồng bộ sang `googleId` */
    googleSub: { type: String, unique: true, sparse: true, trim: true, select: false },

    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, select: false },
    avatar: { type: String, default: "" },

    role: { type: String, enum: ["customer", "mentor", "admin"], default: "customer" },
    plan: { type: String, enum: ["free", "starter_pro", "elite_pro"], default: "free" },
    planExpiresAt: { type: Date, default: null },

    quota: {
      cvAnalysisUsed: { type: Number, default: 0 },
      cvAnalysisLimit: { type: Number, default: 5 },
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
    profileWorkExperience: { type: String, default: "" },
    profileEducation: { type: String, default: "" },
    profileExtracurricular: { type: String, default: "" },
    profileAwards: { type: String, default: "" },
    hourlyRate: { type: Number },

    settings: {
      emailNotifications: { type: Boolean, default: true },
      profileVisibility: { type: String, enum: ["public", "private"], default: "public" },
      shareInterviewResults: { type: Boolean, default: false },
      /** Bật/tắt loại thông báo in-app — { mentor: {...}, customer: {...} } */
      notificationPrefs: { type: Schema.Types.Mixed, default: () => ({}) },
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
    /** Lần cuối có request/presence từ client — admin dùng để hiển thị online. */
    lastSeenAt: { type: Date, default: null },

    /** Tăng khi logout / đổi mật khẩu — JWT phải khớp `tv` trong payload (vô hiệu token cũ phía server). */
    tokenVersion: { type: Number, default: 0 },

    /** Đăng nhập sai liên tiếp (email/mật khẩu) — reset khi đăng nhập thành công. */
    failedLoginAttempts: { type: Number, default: 0 },
    /** Sau N lần sai → khóa đăng nhập đến thời điểm này. */
    lockUntil: { type: Date, default: null },

    /**
     * Quên mật khẩu: chỉ lưu hash token (không bao giờ lưu token thô).
     * Khi đặt lại mật khẩu thành công → xóa 2 field này.
     */
    resetPasswordTokenHash: { type: String, select: false, default: "" },
    resetPasswordExpiresAt: { type: Date, select: false, default: null },

    /** Xác thực email */
    emailVerificationTokenHash: { type: String, select: false, default: "" },
    emailVerificationExpiresAt: { type: Date, select: false, default: null },

    /**
     * Refresh token (thiết bị): chỉ lưu hash; token gửi client = `sessionId:secret` (opaque).
     * select: false — không lôi nhầm vào toPublicUser.
     */
    authSessions: {
      type: [
        {
          tokenHash: { type: String, required: true },
          expiresAt: { type: Date, required: true },
          createdAt: { type: Date, default: Date.now },
          lastUsedAt: { type: Date, default: Date.now },
          userAgent: { type: String, default: "" },
          ip: { type: String, default: "" },
          fingerprint: { type: String, default: "" },
        },
      ],
      default: [],
      select: false,
    },

    /** Access JWT đã thu hồi (logout / revoke phiên hiện tại) — theo jti + hết hạn. */
    revokedAccessJtis: {
      type: [{ jti: { type: String, required: true }, expAt: { type: Date, required: true } }],
      default: [],
      select: false,
    },
  },
  { collection: "users", timestamps: true }
);

userSchema.index({ role: 1 });
userSchema.index({ plan: 1 });

/**
 * Mỗi khi User được lưu qua Mongoose (đăng ký, PATCH /me, …) mà role là mentor
 * thì tạo Mentor nếu thiếu, rồi đồng bộ tên/title/công ty/giá… từ User sang `mentors`.
 * (Cập nhật trực tiếp trong Compass không chạy hook — dùng sync khi start API hoặc npm run sync:mentor-profiles.)
 */
userSchema.post("save", async function userPostSaveMentorSync(doc) {
  try {
    const d = doc;
    if (!d || d.isActive === false) return;
    if (d.role !== "mentor") return;
    const { createMentorProfileForUser, syncMentorProfileFromUser } = await import(
      "../services/mentorProfileService.js"
    );
    const result = await createMentorProfileForUser(d);
    // createMentorProfileForUser trả về:
    //   - existing doc (chỉ có _id, vì .select("_id")) nếu Mentor đã tồn tại
    //   - full doc mới tạo (có userId) nếu vừa được tạo
    // Chỉ sync khi doc đã tồn tại (existing) để cập nhật thay đổi từ User.
    // Khi vừa tạo mới, createMentorProfileForUser đã ghi đầy đủ → không ghi 2 lần.
    const isExisting = result?._id && !result.userId; // existing chỉ select("_id"), không có userId
    if (isExisting) {
      await syncMentorProfileFromUser(d);
    }
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
    avatar: resolveStoredUploadUrl(plain.avatar),
    phone: plain.phone ?? "",
    position: (plain.desiredPosition || plain.position || "").trim(),
    currentCompany: plain.currentCompany ?? "",
    school: plain.school ?? "",
    field: skills[0] ?? "",
    expertise: skills,
    experience:
      plain.experience != null && plain.experience !== ""
        ? String(plain.experience)
        : "",
    hourlyRate: plain.hourlyRate,
    bio: plain.bio ?? "",
    profileWorkExperience: plain.profileWorkExperience ?? "",
    profileEducation: plain.profileEducation ?? "",
    profileExtracurricular: plain.profileExtracurricular ?? "",
    profileAwards: plain.profileAwards ?? "",
    plan: plain.plan,
    planExpiresAt: plain.planExpiresAt,
    /** Đổi mật khẩu: không bắt buộc mật khẩu cũ nếu đã liên kết Google */
    hasGoogleLogin: Boolean(
      (typeof googleId === "string" && googleId.trim()) ||
        (typeof googleSub === "string" && googleSub.trim())
    ),
    isEmailVerified: Boolean(plain.isEmailVerified),
    notificationPrefs: publicNotificationPrefsForRole(
      plain.role,
      plain.settings?.notificationPrefs,
    ),
  };
  return out;
}
