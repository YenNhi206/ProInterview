import { normalizePlanKey } from "../utils/planKeys.js";

/** Bảng giá subscription (VND/tháng) — nguồn sự thật phía server. Gói năm = tháng × 12, không giảm. */
export const SUBSCRIPTION_PLAN_CATALOG = {
  starter_pro: {
    planKey: "starter_pro",
    checkoutKey: "starterPro",
    name: "Pro",
    monthlyAmount: 99000,
  },
  elite_pro: {
    planKey: "elite_pro",
    checkoutKey: "elitePro",
    name: "Elite",
    monthlyAmount: 199000,
  },
};

export function normalizeBillingCycle(raw) {
  return String(raw ?? "monthly").toLowerCase() === "yearly" ? "yearly" : "monthly";
}

/** Số tiền CK/gateway cho gói subscription. */
export function resolveSubscriptionAmount(planKey, billing) {
  const key = normalizePlanKey(planKey);
  if (!key || key === "free") return null;
  const catalog = SUBSCRIPTION_PLAN_CATALOG[key];
  if (!catalog) return null;
  const cycle = normalizeBillingCycle(billing);
  return cycle === "yearly" ? catalog.monthlyAmount * 12 : catalog.monthlyAmount;
}

export function listSubscriptionCatalog() {
  return Object.values(SUBSCRIPTION_PLAN_CATALOG).map((p) => ({
    ...p,
    yearlyAmount: p.monthlyAmount * 12,
  }));
}

/** Ưu đãi % khi booking mentor / mua khóa học từ mentor (quảng cáo ở trang /pricing). Platform tự gánh, mentor không bị ảnh hưởng thu nhập. */
export const PERK_DISCOUNT_RATE = { starter_pro: 0.05, elite_pro: 0.1 };

export function resolvePlanPerkDiscountRate(planKey) {
  const key = normalizePlanKey(planKey);
  return PERK_DISCOUNT_RATE[key] ?? 0;
}
