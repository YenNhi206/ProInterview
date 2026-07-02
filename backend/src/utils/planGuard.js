import { User } from "../models/User.js";

const FREE_QUOTA = {
  plan: "free",
  planExpiresAt: null,
  "quota.cvAnalysisLimit": 3,
  "quota.interviewLimit": 1,
  "quota.interviewQuestionsAllowed": 3,
  "quota.resetAt": null,
};

/**
 * Reset quota hàng tháng cho gói trả phí còn hiệu lực (`quota.resetAt` đã có sẵn trong schema
 * nhưng trước đây không được set/đọc ở đâu cả — plan năm mua 1 lần chỉ được cấp quota DUY NHẤT
 * cho cả 12 tháng thay vì mỗi tháng 1 lượt mới như quảng cáo "/tháng" ở trang giá).
 * Chỉ áp dụng khi gói còn hiệu lực (planExpiresAt chưa qua) — gói đã hết hạn xử lý ở nhánh
 * downgrade-về-free bên trên, không reset quota Pro/Elite cho gói đã chết.
 */
async function resetQuotaCycleIfDue(user) {
  if (user.plan === "free") return user;
  const resetAt = user.quota?.resetAt;
  if (!resetAt || new Date(resetAt) >= new Date()) return user;

  // Roll forward tới mốc kế tiếp còn ở tương lai — phòng user không hoạt động nhiều tháng liền.
  const nextReset = new Date(resetAt);
  const now = new Date();
  while (nextReset < now) nextReset.setMonth(nextReset.getMonth() + 1);

  const updated = await User.findOneAndUpdate(
    { _id: user._id, plan: { $ne: "free" }, "quota.resetAt": { $lt: new Date() } },
    {
      $set: {
        "quota.cvAnalysisUsed": 0,
        "quota.interviewUsed": 0,
        "quota.resetAt": nextReset,
      },
    },
    { new: true },
  ).lean();
  return updated ?? user;
}

/**
 * Nếu gói đã hết hạn → tự động hạ về free trong DB và trả user đã cập nhật.
 * Gọi trước khi kiểm tra quota để tránh user giữ Pro/Elite vô thời hạn.
 * Nếu gói còn hiệu lực nhưng đã tới hạn reset hàng tháng → reset lượt dùng (xem resetQuotaCycleIfDue).
 */
export async function enforceExpiry(user) {
  const isFree = user.plan === "free" || !user.planExpiresAt;
  const isExpired = !isFree && new Date(user.planExpiresAt) < new Date();

  // 1. Tài khoản Free cũ nhưng vẫn còn limit > 3 trong DB (dữ liệu cũ trước khi vá) → ép về FREE_QUOTA.
  if (isFree && user.quota?.cvAnalysisLimit > 3) {
    const updated = await User.findOneAndUpdate(
      { _id: user._id },
      { $set: FREE_QUOTA },
      { new: true }
    ).lean();
    return updated ?? user;
  }

  // 2. Gói đã hết hạn → downgrade về Free.
  // Conditional update: only downgrade if plan is still expired at write time.
  // Prevents overwriting a plan that was just upgraded by a concurrent payment confirm.
  if (isExpired) {
    const updated = await User.findOneAndUpdate(
      { _id: user._id, plan: { $ne: "free" }, planExpiresAt: { $lt: new Date() } },
      { $set: FREE_QUOTA },
      { new: true },
    ).lean();
    return updated ?? user;
  }

  // 3. Gói còn hiệu lực (hoặc Free với limit đã đúng) → kiểm tra reset quota hàng tháng.
  return resetQuotaCycleIfDue(user);
}

/**
 * Chặn phân tích CV (endpoint tốn LLM/Python) khi user đã hết quota — trước đây quota chỉ được
 * kiểm tra ở bước lưu lịch sử (`POST /api/cv/analyses`), nên user hết lượt vẫn gọi thẳng
 * `/api/cv/analyze*` (bypass UI) và chạy phân tích không giới hạn, chỉ bị chặn khi lưu.
 * Đây là kiểm tra read-only (không tăng quota — quota vẫn được tăng ở bước lưu, tránh đếm trùng
 * khi FE cascade qua nhiều endpoint /analyze/suggestions → /analyze/full → /analyze cho 1 lượt).
 */
export async function requireCvAnalysisQuota(req, res, next) {
  try {
    const user = await User.findById(req.userId).select("quota plan planExpiresAt");
    if (!user) return res.status(404).json({ success: false, error: "Người dùng không tồn tại" });
    const effective = await enforceExpiry(user);
    const used = effective.quota?.cvAnalysisUsed ?? 0;
    const limit = effective.quota?.cvAnalysisLimit ?? 3;
    if (used >= limit) {
      // Elite là gói cao nhất — "nâng cấp" không giúp được gì, chỉ có thể chờ reset hàng tháng.
      const message =
        effective.plan === "elite_pro"
          ? `Bạn đã dùng hết lượt phân tích CV tháng này.${
              effective.quota?.resetAt
                ? ` Quota sẽ làm mới vào ${new Date(effective.quota.resetAt).toLocaleDateString("vi-VN")}.`
                : " Quota sẽ tự làm mới vào đầu chu kỳ sau."
            }`
          : "Bạn đã hết lượt phân tích CV. Vui lòng nâng cấp gói.";
      return res.status(403).json({ success: false, error: "quota_exceeded", message });
    }
    next();
  } catch (err) {
    next(err);
  }
}
