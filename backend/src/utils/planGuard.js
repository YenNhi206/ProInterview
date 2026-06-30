import { User } from "../models/User.js";

const FREE_QUOTA = {
  plan: "free",
  planExpiresAt: null,
  "quota.cvAnalysisLimit": 5,
  "quota.interviewLimit": 1,
  "quota.interviewQuestionsAllowed": 3,
};

/**
 * Nếu gói đã hết hạn → tự động hạ về free trong DB và trả user đã cập nhật.
 * Gọi trước khi kiểm tra quota để tránh user giữ Pro/Elite vô thời hạn.
 */
export async function enforceExpiry(user) {
  if (user.plan === "free" || !user.planExpiresAt) return user;
  if (user.planExpiresAt >= new Date()) return user;

  // Conditional update: only downgrade if plan is still expired at write time.
  // Prevents overwriting a plan that was just upgraded by a concurrent payment confirm.
  const updated = await User.findOneAndUpdate(
    { _id: user._id, plan: { $ne: "free" }, planExpiresAt: { $lt: new Date() } },
    { $set: FREE_QUOTA },
    { new: true },
  ).lean();
  return updated ?? user;
}
