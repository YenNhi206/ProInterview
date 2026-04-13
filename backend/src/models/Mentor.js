import mongoose from "mongoose";

const { Schema } = mongoose;

const sessionTypeSchema = new Schema(
  {
    type: { type: String, enum: ["mock_interview", "cv_review", "career_consulting", "custom"] },
    durationMinutes: { type: Number },
    price: { type: Number },
  },
  { _id: false }
);

const recurringSchema = new Schema(
  {
    dayOfWeek: { type: Number },
    slots: [{ type: String }],
  },
  { _id: false }
);

const mentorSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", unique: true, sparse: true },

    /** ID công khai cho URL (vd. `u` + ObjectId user khi tạo từ tài khoản thật) */
    publicId: { type: String, unique: true, sparse: true, index: true, trim: true },

    name: { type: String, required: true },
    title: { type: String, required: true },
    company: { type: String, required: true },
    avatar: { type: String, default: "" },
    bio: { type: String, default: "" },
    specialties: [{ type: String }],
    fields: [{ type: String }],
    companies: [{ type: String }],
    linkedinUrl: { type: String, default: "" },

    experienceYears: { type: Number, default: 0 },

    pricePerHour: { type: Number, required: true },
    sessionTypes: [sessionTypeSchema],

    available: { type: Boolean, default: true },
    responseTime: { type: String, default: "< 24 giờ" },
    timezone: { type: String, default: "Asia/Ho_Chi_Minh" },
    availableSlots: { type: Map, of: [String] },
    blockedDates: [{ type: String }],
    recurringSchedule: [recurringSchema],

    stats: {
      rating: { type: Number, default: 0, min: 0, max: 5 },
      reviewCount: { type: Number, default: 0 },
      sessionCount: { type: Number, default: 0 },
      totalStudents: { type: Number, default: 0 },
      totalRevenue: { type: Number, default: 0 },
      completionRate: { type: Number, default: 100 },
      profileViews: { type: Number, default: 0 },
      acceptanceRate: { type: Number, default: 100 },
      rebookingRate: { type: Number, default: 0 },
    },

    finance: {
      availableBalance: { type: Number, default: 0 },
      pendingBalance: { type: Number, default: 0 },
      totalEarned: { type: Number, default: 0 },
      bankAccount: {
        bankName: { type: String, default: "" },
        accountNumber: { type: String, default: "" },
        accountName: { type: String, default: "" },
      },
      momoPhone: { type: String, default: "" },
      zalopayPhone: { type: String, default: "" },
      autoPayoutThreshold: { type: Number, default: 500_000 },
    },

    isVerified: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true },
    verifiedAt: { type: Date },
  },
  { collection: "mentors", timestamps: true }
);

mentorSchema.index({ fields: 1 });
mentorSchema.index({ "stats.rating": -1 });
mentorSchema.index({ pricePerHour: 1 });
mentorSchema.index({ available: 1 });

export const Mentor = mongoose.models.Mentor ?? mongoose.model("Mentor", mentorSchema);

/**
 * Giữ hình dạng JSON cũ cho GET /api/mentors (id, price, reviews, tags, field, sessionsDone, …).
 */
export function toPublicMentor(doc) {
  if (!doc) return null;
  const m = doc.toObject ? doc.toObject() : { ...doc };
  const stats = m.stats || {};
  const firstField = Array.isArray(m.fields) && m.fields.length ? m.fields[0] : "";
  return {
    id: m.publicId ?? (m._id ? String(m._id) : undefined),
    name: m.name,
    title: m.title,
    company: m.company,
    field: firstField,
    experience: m.experienceYears ?? 0,
    rating: stats.rating ?? 0,
    reviews: stats.reviewCount ?? 0,
    price: m.pricePerHour ?? 0,
    avatar: m.avatar ?? "",
    tags: Array.isArray(m.specialties) && m.specialties.length ? m.specialties : [],
    available: m.available !== false,
    bio: m.bio ?? "",
    specialties: m.specialties ?? [],
    companies: m.companies ?? [],
    sessionsDone: stats.sessionCount ?? 0,
    responseTime: m.responseTime ?? "",
  };
}
