import { User } from "../models/User.js";

const FREE_QUOTA = {
  plan: "free",
  planExpiresAt: null,
  "quota.cvAnalysisLimit": 3,
  "quota.interviewLimit": 1,
  "quota.interviewQuestionsAllowed": 3,
};

/**
 * Nếu gói đã hết hạn → tự động hạ về free trong DB và trả user đã cập nhật.
 * Gọi trước khi kiểm tra quota để tránh user giữ Pro/Elite vô thời hạn.
 */
export async function enforceExpiry(user) {
  const isFree = user.plan === "free" || !user.planExpiresAt;
  const isExpired = !isFree && user.planExpiresAt < new Date();

  // 1. Xử lý tài khoản Free cũ nhưng vẫn còn limit > 3 trong DB
  if (isFree && user.quota?.cvAnalysisLimit > 3) {
    const updated = await User.findOneAndUpdate(
      { _id: user._id },
      { $set: FREE_QUOTA },
      { new: true }
    ).lean();
    return updated ?? user;
  }

  // 1.5. Xử lý tài khoản Pro/Elite có limit lệch với gói đang hiển thị trên trang giá
  // (vd: từng bị cấp nhầm 20/40 trước khi commit 3cb3d41 chốt lại 10/30) — ép về đúng giá trị.
  if (!isFree && !isExpired) {
    const isElite = user.plan === "elite_pro";
    const expectedCvLimit = isElite ? 30 : 10;
    const expectedInterviewLimit = isElite ? 8 : 3;
    const expectedQuestions = 5;

    if (
      !user.quota ||
      user.quota.cvAnalysisLimit !== expectedCvLimit ||
      user.quota.interviewLimit !== expectedInterviewLimit ||
      user.quota.interviewQuestionsAllowed !== expectedQuestions
    ) {
      const updated = await User.findOneAndUpdate(
        { _id: user._id },
        {
          $set: {
            "quota.cvAnalysisLimit": expectedCvLimit,
            "quota.interviewLimit": expectedInterviewLimit,
            "quota.interviewQuestionsAllowed": expectedQuestions,
          }
        },
        { new: true }
      ).lean();
      return updated ?? user;
    }
  }

  // 2. Không phải tài khoản hết hạn → không làm gì thêm
  if (!isExpired) return user;

  // 3. Tài khoản đã hết hạn → downgrade về Free
  // Conditional update: only downgrade if plan is still expired at write time.
  // Prevents overwriting a plan that was just upgraded by a concurrent payment confirm.
  const updated = await User.findOneAndUpdate(
    { _id: user._id, plan: { $ne: "free" }, planExpiresAt: { $lt: new Date() } },
    { $set: FREE_QUOTA },
    { new: true },
  ).lean();
  return updated ?? user;
}
