import mongoose from "mongoose";
import { versionNameError } from "../prompts/index.js";

const { Schema } = mongoose;

/**
 * Bảng đăng ký phiên bản prompt (AI-02). Chuỗi `version` chính là giá trị đã ghi ở
 * `InterviewSession.questions[].promptVersion`, `feedback.promptVersion`, `QuestionBank.generatedBy`
 * / `provenance` — không thêm field nào vào các model đó.
 *
 * - `template`: object { tênPhần: chuỗi | mảng chuỗi }; `null` với chuỗi cũ không còn nội dung (`legacy`).
 * - Mỗi key tối đa 1 bản `active` (partial unique index). Đổi bản active qua
 *   `promptVersionService.activate()` hoặc `scripts/activatePromptVersion.js`.
 * - Nội dung một version không đổi sau khi tạo: muốn sửa chữ thì tạo version mới.
 */
const fewShotExampleSchema = new Schema(
  {
    input: { type: String, default: "" },
    output: { type: String, default: "" },
    note: { type: String, default: "" },
  },
  { _id: false },
);

const promptVersionSchema = new Schema(
  {
    key: { type: String, required: true, trim: true },
    version: { type: String, required: true, trim: true },
    template: { type: Schema.Types.Mixed, default: null },
    fewShotExamples: { type: [fewShotExampleSchema], default: [] },
    active: { type: Boolean, default: false },
    legacy: { type: Boolean, default: false },
    activatedAt: { type: Date, default: null },
    activatedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    /**
     * AI-07: mỗi lần bản này được bật (kể cả bật lại khi rollback). `activatedAt` chỉ giữ lần gần nhất,
     * Quality Dashboard cần cả chuỗi để so tỉ lệ bị sửa trước / sau mỗi lần đổi version.
     */
    activations: {
      type: [
        new Schema(
          {
            at: { type: Date, required: true },
            by: { type: Schema.Types.ObjectId, ref: "User", default: null },
            previousVersion: { type: String, default: "" },
            note: { type: String, default: "" },
          },
          { _id: false },
        ),
      ],
      default: [],
    },
    note: { type: String, default: "" },
  },
  { collection: "prompt_versions", timestamps: true },
);

// Chuỗi cũ tìm thấy trong DB giữ nguyên tên dù không theo quy ước; version mới phải `<tiền tố>-vN`.
promptVersionSchema.pre("validate", function checkVersionName() {
  if (this.legacy) return;
  const error = versionNameError(this.key, this.version);
  if (error) this.invalidate("version", error);
});

promptVersionSchema.index({ key: 1, version: 1 }, { unique: true });
// Quality Dashboard nhóm theo chuỗi version (không kèm key) → chuỗi phải duy nhất trên toàn bảng.
promptVersionSchema.index({ version: 1 }, { unique: true, name: "version_unique" });
// Mỗi key tối đa 1 bản active.
promptVersionSchema.index(
  { key: 1 },
  { unique: true, partialFilterExpression: { active: true }, name: "key_single_active" },
);

export const PromptVersion =
  mongoose.models.PromptVersion ?? mongoose.model("PromptVersion", promptVersionSchema);
