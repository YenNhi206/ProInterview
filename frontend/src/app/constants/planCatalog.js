/**
 * Bảng giá subscription (VND/tháng) — đồng bộ backend/src/constants/planCatalog.js
 * Gói năm = tháng × 12, không giảm giá.
 */

export const SUBSCRIPTION_PLANS = {
  starterPro: {
    planKey: "starter_pro",
    name: "Pro",
    tagline: "Tăng tốc",
    monthlyAmount: 99000,
    badge: "PHỔ BIẾN",
    accentColor: "#8037f4",
    features: [
      "10 lượt phân tích CV theo từng vị trí ứng tuyển",
      "03 phiên AI Interview cá nhân hóa theo CV và vị trí ứng tuyển (05 câu hỏi/phiên)",
      "Đánh giá câu trả lời và gợi ý cải thiện chi tiết cho từng câu hỏi",
      "Ưu đãi 5% khi booking Mentor và đăng ký khóa học từ Mentor",
    ],
  },
  elitePro: {
    planKey: "elite_pro",
    name: "Elite",
    tagline: "Bứt phá",
    monthlyAmount: 199000,
    badge: "TỐT NHẤT",
    accentColor: "#93f72b",
    features: [
      "30 lượt phân tích CV theo từng vị trí ứng tuyển",
      "08 phiên AI Interview cá nhân hóa theo CV và vị trí ứng tuyển (05 câu hỏi/phiên)",
      "Đánh giá câu trả lời và gợi ý cải thiện chi tiết cho từng câu hỏi",
      "Ưu đãi 10% khi booking Mentor và đăng ký khóa học từ Mentor",
    ],
  },
};

export function resolveCheckoutPlan(planKey) {
  return SUBSCRIPTION_PLANS[planKey] ?? SUBSCRIPTION_PLANS.starterPro;
}

export function getSubscriptionChargeAmount(planKey, billing) {
  const plan = resolveCheckoutPlan(planKey);
  return billing === "yearly" ? plan.monthlyAmount * 12 : plan.monthlyAmount;
}

export function toCheckoutPlanKey(planId) {
  if (planId === "elite_pro" || planId === "elitePro") return "elitePro";
  if (planId === "starter_pro" || planId === "starterPro") return "starterPro";
  return null;
}

export function getPlanDisplayAmount(planId, billing) {
  const key = toCheckoutPlanKey(planId);
  if (!key) return 0;
  return getSubscriptionChargeAmount(key, billing);
}

export function buildPlanCheckoutPath(planIdOrKey, billing) {
  const key = toCheckoutPlanKey(planIdOrKey);
  if (!key) return "/";
  const cycle = billing === "yearly" ? "yearly" : "monthly";
  return `/checkout?plan=${key}&billing=${cycle}`;
}
