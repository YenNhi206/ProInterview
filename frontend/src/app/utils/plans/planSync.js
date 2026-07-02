/** Logic thuần đồng bộ gói API → flags UI (test được bằng node --test). */

export const PLAN_STORAGE_KEY = "prointerview_plans";

export function apiPlanToLocalFlags(plan) {
  const p = String(plan || "free").toLowerCase();
  if (p === "elite_pro") return { starterPro: true, elitePro: true };
  if (p === "starter_pro") return { starterPro: true, elitePro: false };
  return { starterPro: false, elitePro: false };
}

/** Migrate object cũ voicePro/cvPro → starterPro/elitePro. */
export function migrateLegacyPlanFlags(parsed) {
  if (!parsed || typeof parsed !== "object") {
    return { starterPro: false, elitePro: false };
  }
  if ("voicePro" in parsed || "cvPro" in parsed) {
    return {
      starterPro: !!(parsed.voicePro || parsed.cvPro || parsed.textPro),
      elitePro: !!(parsed.voicePro && parsed.cvPro),
    };
  }
  return { starterPro: false, elitePro: false, ...parsed };
}

/** Nếu profile API có plan trả về flags mới hơn localStorage. */
export function resolvePlansFromStorageAndUser(stored, userPlan) {
  const base = stored ?? { starterPro: false, elitePro: false };
  // "free" là thông tin xác thực từ API (vd. gói vừa hết hạn) — phải ghi đè cache cũ,
  // không được giữ flags Pro/Elite cũ sót lại.
  if (userPlan === "free") return { starterPro: false, elitePro: false };
  if (!userPlan) return base;
  const fromApi = apiPlanToLocalFlags(userPlan);
  if (fromApi.starterPro !== base.starterPro || fromApi.elitePro !== base.elitePro) {
    return fromApi;
  }
  return base;
}
