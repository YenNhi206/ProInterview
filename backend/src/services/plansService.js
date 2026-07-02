import mongoose from "mongoose";
import { User } from "../models/User.js";
import { normalizePlanKey } from "../utils/planKeys.js";
import { listSubscriptionCatalog } from "../constants/planCatalog.js";
import { enforceExpiry } from "../utils/planGuard.js";

const MONGO_ERR = "MongoDB chưa kết nối. Kiểm tra MONGO_URI trong .env.";

function isMongoReady() {
  return mongoose.connection.readyState === 1;
}

/** Compat shim — dùng bởi interviewsController (origin/main). */
export async function syncPlanExpiry(userId) {
  const user = await User.findById(userId).select("plan planExpiresAt quota");
  if (user) await enforceExpiry(user);
}

export function getSubscriptionCatalog() {
  return { ok: true, plans: listSubscriptionCatalog() };
}

export async function getCurrentPlan(userId) {
  if (!isMongoReady()) return { ok: false, status: 503, error: MONGO_ERR };
  if (!mongoose.isValidObjectId(userId)) return { ok: false, status: 401, error: "Phiên không hợp lệ." };

  let u = await User.findById(userId).select("plan planExpiresAt quota name email");
  if (!u) return { ok: false, status: 404, error: "Không tìm thấy user." };

  u = await enforceExpiry(u);

  return {
    ok: true,
    plan: u.plan,
    planExpiresAt: u.planExpiresAt,
    quota: u.quota ?? {},
  };
}

export async function activatePlan(userId, body) {
  if (!isMongoReady()) return { ok: false, status: 503, error: MONGO_ERR };
  const plan = normalizePlanKey(body?.plan ?? body?.planKey);
  if (!plan || plan === "free") {
    return { ok: false, status: 400, error: "plan phải là starter_pro hoặc elite_pro (hoặc starterPro / elitePro)." };
  }

  const months = Math.min(36, Math.max(1, Number(body?.months) || 1));
  const expires = new Date();
  expires.setMonth(expires.getMonth() + months);
  // Lượt dùng refresh mỗi tháng trong suốt kỳ hạn — quan trọng với gói năm (planExpiresAt xa
  // nhưng vẫn phải cấp lại quota hàng tháng theo đúng quảng cáo "/tháng" ở trang giá).
  const nextQuotaReset = new Date();
  nextQuotaReset.setMonth(nextQuotaReset.getMonth() + 1);

  const updates = { plan, planExpiresAt: expires, "quota.resetAt": nextQuotaReset };
  if (plan === "starter_pro") {
    updates["quota.cvAnalysisLimit"]           = 10;
    updates["quota.cvAnalysisUsed"]            = 0;
    updates["quota.interviewLimit"]            = 3;
    updates["quota.interviewUsed"]             = 0;
    updates["quota.interviewQuestionsAllowed"] = 5;
  } else if (plan === "elite_pro") {
    updates["quota.cvAnalysisLimit"]           = 30;
    updates["quota.cvAnalysisUsed"]            = 0;
    updates["quota.interviewLimit"]            = 8;
    updates["quota.interviewUsed"]             = 0;
    updates["quota.interviewQuestionsAllowed"] = 5;
  }

  const u = await User.findByIdAndUpdate(userId, { $set: updates }, { new: true }).select("plan planExpiresAt quota").lean();
  if (!u) return { ok: false, status: 404, error: "Không tìm thấy user." };
  return { ok: true, plan: u.plan, planExpiresAt: u.planExpiresAt, quota: u.quota };
}

export async function cancelPlan(userId) {
  if (!isMongoReady()) return { ok: false, status: 503, error: MONGO_ERR };

  const u = await User.findByIdAndUpdate(
    userId,
    {
      $set: {
        plan: "free",
        planExpiresAt: null,
        "quota.cvAnalysisLimit": 3,
        "quota.interviewLimit": 1,
        "quota.interviewQuestionsAllowed": 3,
        "quota.resetAt": null,
        // Dùng $min để clamp used về giới hạn free, không zero ra hoàn toàn
        // (xử lý bằng $min trong update riêng bên dưới)
      },
    },
    { new: false }
  )
    .select("plan planExpiresAt quota")
    .lean();
  if (!u) return { ok: false, status: 404, error: "Không tìm thấy user." };
  // Clamp used counters xuống giới hạn free — không zero ra hoàn toàn
  const final = await User.findByIdAndUpdate(
    userId,
    { $min: { "quota.cvAnalysisUsed": 3, "quota.interviewUsed": 1 } },
    { new: true },
  ).select("plan planExpiresAt quota").lean();
  return { ok: true, plan: final.plan, planExpiresAt: final.planExpiresAt, quota: final.quota };
}
