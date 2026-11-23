import mongoose from "mongoose";

const { Schema } = mongoose;

const courseSchema = new Schema(
  {
    mentorId: { type: Schema.Types.ObjectId, ref: "Mentor", required: true },

    title: { type: String, required: true },
    description: { type: String, default: "" },
    shortDescription: { type: String, default: "", maxlength: 500 },
    thumbnail: { type: String, default: "" },
    level: { type: String, enum: ["basic", "intermediate", "advanced"], required: true },
    tags: [{ type: String }],
    topics: [{ type: String, enum: ["Technical", "Behavioral", "Resume", "Negotiation", "Other"] }],
    language: { type: String, default: "vi" },

    whatYoullLearn: [{ type: String }],
    requirements: [{ type: String }],

    modules: [
      {
        title: { type: String },
        order: { type: Number },
        lessons: [
          {
            title: { type: String },
            type: { type: String, enum: ["video", "document", "quiz"] },
            videoUrl: { type: String, default: "" },
            documentUrl: { type: String, default: "" },
            durationMinutes: { type: Number, default: 0 },
            description: { type: String, default: "" },
            transcript: { type: String, default: "" },
            resources: [{ name: String, url: String }],
            order: { type: Number },
            isFree: { type: Boolean, default: false },
          },
        ],
      },
    ],

    settings: {
      autoEnroll: { type: Boolean, default: true },
      certificateEnabled: { type: Boolean, default: true },
      qaEnabled: { type: Boolean, default: true },
    },

    isFree: { type: Boolean, default: false },
    price: { type: Number, default: 0 },
    discountPrice: { type: Number, default: 0 },
    discountEndsAt: { type: Date },

    stats: {
      enrollmentCount: { type: Number, default: 0 },
      rating: { type: Number, default: 0 },
      reviewCount: { type: Number, default: 0 },
      completionRate: { type: Number, default: 0 },
      totalRevenue: { type: Number, default: 0 },
    },

    status: { type: String, enum: ["draft", "pending_review", "pending_update", "published", "archived"], default: "draft" },
    /** Bản chỉnh sửa chờ admin duyệt khi khóa đang published. */
    pendingUpdate: { type: Schema.Types.Mixed, default: null },
    /** Ghi nhận từ chối / gỡ marketplace (admin). */
    adminReview: {
      reason: { type: String, default: "" },
      reviewedAt: { type: Date },
      reviewedBy: { type: Schema.Types.ObjectId, ref: "User" },
      lastAction: { type: String, enum: ["reject", "archive", ""], default: "" },
    },
    publishedAt: { type: Date },
    /**
     * AI-08: kết quả AI sàng lọc lần gửi duyệt gần nhất (`coursePrescreenService.js`). Chỉ là gợi ý cho
     * Platform Moderator, không tự duyệt / từ chối. `contentHash` = băm nội dung đã sàng lọc: gửi lại
     * nội dung y hệt thì không gọi LLM lần nữa.
     */
    aiPrescreen: {
      type: new Schema(
        {
          status: { type: String, enum: ["pending", "done", "failed"], default: "pending" },
          score: { type: Number, min: 0, max: 100, default: null },
          summary: { type: String, default: "" },
          flags: [
            {
              _id: false,
              code: { type: String, required: true },
              severity: { type: String, enum: ["info", "warning", "critical"], default: "warning" },
              message: { type: String, default: "" },
              evidence: { type: String, default: "" },
              source: { type: String, enum: ["rule", "ai"], default: "rule" },
            },
          ],
          /** `course` = khóa mới (pending_review); `pending_update` = bản chỉnh sửa của khóa đang bán. */
          target: { type: String, enum: ["course", "pending_update"], default: "course" },
          model: { type: String, default: "" },
          promptVersion: { type: String, default: "" },
          contentHash: { type: String, default: "" },
          error: { type: String, default: "" },
          at: { type: Date, default: null },
        },
        { _id: false },
      ),
      default: null,
    },
    totalLessons: { type: Number, default: 0 },
    totalDurationMinutes: { type: Number, default: 0 },
  },
  { collection: "courses", timestamps: true }
);

courseSchema.index({ mentorId: 1 });
courseSchema.index({ status: 1, level: 1 });
courseSchema.index({ tags: 1 });
courseSchema.index({ "modules.lessons._id": 1 });

courseSchema.pre("save", function () {
  if (this.isModified("modules")) {
    let count = 0;
    let duration = 0;
    this.modules.forEach((mod) => {
      if (mod.lessons) {
        count += mod.lessons.length;
        mod.lessons.forEach((lesson) => {
          duration += lesson.durationMinutes || 0;
        });
      }
    });
    this.totalLessons = count;
    this.totalDurationMinutes = duration;
  }
  // Keep isFree in sync with price so access-control logic is always consistent.
  if (this.isModified("price") || this.isNew) {
    this.isFree = Number(this.price ?? 0) <= 0;
  }
});

export const Course = mongoose.models.Course ?? mongoose.model("Course", courseSchema);
