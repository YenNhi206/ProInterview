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
 * Nếu gói đã hết hạn → tự động hạ về free trong DB và trả user đã cập nhật.
 * Gọi trước khi kiểm tra quota để tránh user giữ Pro/Elite vô thời hạn.
 *
 * Với gói còn hiệu lực, gộp 2 việc vào MỘT update duy nhất (tránh short-circuit làm việc
 * này chặn mất việc kia khi cả hai cùng đến hạn trong 1 lần gọi):
 *  - Sửa limit lệch với gói đang hiển thị trên trang giá (vd: từng bị cấp nhầm 20/40 trước
 *    khi commit 3cb3d41 chốt lại 10/30)
 *  - Reset quota hàng tháng khi tới hạn (`quota.resetAt` có sẵn trong schema nhưng trước đây
 *    không được set/đọc ở đâu — gói năm mua 1 lần chỉ được cấp quota DUY NHẤT cho cả 12 tháng
 *    thay vì mỗi tháng 1 lượt mới như quảng cáo "/tháng" ở trang giá)
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

  if (isFree) return user;

  // 3. Gói còn hiệu lực → sửa limit lệch (nếu có) và reset quota hàng tháng (nếu tới hạn),
  // trong cùng một update để không cái nào chặn mất cái kia.
  const isElite = user.plan === "elite_pro";
  const expectedCvLimit = isElite ? 30 : 10;
  const expectedInterviewLimit = isElite ? 8 : 3;
  const expectedQuestions = 5;
  const limitMismatch =
    !user.quota ||
    user.quota.cvAnalysisLimit !== expectedCvLimit ||
    user.quota.interviewLimit !== expectedInterviewLimit ||
    user.quota.interviewQuestionsAllowed !== expectedQuestions;

  const resetAt = user.quota?.resetAt;
  const resetDue = Boolean(resetAt) && new Date(resetAt) < new Date();

  if (!limitMismatch && !resetDue) return user;

  const setFields = {};
  if (limitMismatch) {
    setFields["quota.cvAnalysisLimit"] = expectedCvLimit;
    setFields["quota.interviewLimit"] = expectedInterviewLimit;
    setFields["quota.interviewQuestionsAllowed"] = expectedQuestions;
  }
  if (resetDue) {
    // Roll forward tới mốc kế tiếp còn ở tương lai — phòng user không hoạt động nhiều tháng liền.
    const nextReset = new Date(resetAt);
    const now = new Date();
    while (nextReset < now) nextReset.setMonth(nextReset.getMonth() + 1);
    setFields["quota.cvAnalysisUsed"] = 0;
    setFields["quota.interviewUsed"] = 0;
    setFields["quota.resetAt"] = nextReset;
  }

  const updated = await User.findOneAndUpdate(
    { _id: user._id },
    { $set: setFields },
    { new: true },
  ).lean();
  return updated ?? user;
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
