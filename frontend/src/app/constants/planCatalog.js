/**
 * Bảng giá subscription (VND/tháng) — đồng bộ backend/src/constants/planCatalog.js
 * Gói năm = tháng × 12, không giảm giá.
 */

export const SUBSCRIPTION_PLANS = {
  starterPro: {
    planKey: "starter_pro",
    name: "Pro",
    tagline: "Luyện tập nghiêm túc",
    monthlyAmount: 99000,
    badge: "PHỔ BIẾN",
    accentColor: "#8037f4",
    features: [
      "3 phiên AI Interview / tháng (5 câu hỏi/phiên)",
      "Nhận diện giọng nói tiếng Việt",
      "20 lượt phân tích CV/JD / tháng",
      "Phản hồi & đánh giá chi tiết",
    ],
  },
  elitePro: {
    planKey: "elite_pro",
    name: "Elite",
    tagline: "Chinh phục mọi vòng phỏng vấn",
    monthlyAmount: 199000,
    badge: "TỐT NHẤT",
    accentColor: "#93f72b",
    features: [
      "8 phiên AI Interview / tháng (5 câu hỏi/phiên)",
      "40 lượt phân tích CV/JD / tháng",
      "Nhận diện giọng nói tiếng Việt",
      "Hỗ trợ ưu tiên 24/7",
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
