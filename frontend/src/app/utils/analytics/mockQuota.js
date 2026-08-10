/** Bù số liệu quota đã dùng (CV, phỏng vấn AI) cho user Pro/Elite dùng quá ít so
 * với gói đã nâng cấp. Chỉ nâng lên khi số thật thấp hơn ngưỡng — không bao giờ
 * hạ số thật xuống. Seed theo userId + tên field nên mỗi tài khoản, mỗi loại
 * quota ra một con số khác nhau nhưng ổn định giữa các lần tải.
 *
 * Phỏng vấn dùng theo tỉ lệ hạn mức (50-85%, khớp hành vi "mua gói xong vào phỏng
 * vấn ngay 2-3 lần"). CV dùng theo SỐ LẦN CỐ ĐỊNH riêng từng gói (không phải %, vì
 * hạn mức CV cách nhau quá xa giữa 2 gói): starter_pro 3-6 lần, elite_pro 10-13 lần
 * (~11-12) — mỗi tài khoản một con số cụ thể khác nhau trong dải đó. */

import { hashSeed, mulberry32 } from "./seededRandom.js";

const PAID_PLANS = new Set(["starter_pro", "elite_pro"]);
const DEFAULT_RATIO_RANGE = [0.5, 0.85];
const FIELD_RATIO_RANGES = {
  interview: [0.5, 0.85],
};
const CV_COUNT_RANGE_BY_PLAN = {
  starter_pro: [3, 6],
  elite_pro: [10, 13],
};

/** Trả về số đã dùng, nâng lên tối thiểu theo field/plan (xem FIELD_RATIO_RANGES,
 * CV_COUNT_RANGE_BY_PLAN) nếu là user trả phí và số thật đang thấp hơn mức đó. */
export function ensureMinQuotaUsage(userId, used, limit, plan, field) {
  const safeLimit = Number(limit) || 0;
  const safeUsed = Number(used) || 0;
  if (!PAID_PLANS.has(plan) || safeLimit <= 0) return safeUsed;

  const rand = mulberry32(hashSeed(`${userId}:${field}`))();

  let minTarget;
  const cvRange = field === "cvAnalysis" ? CV_COUNT_RANGE_BY_PLAN[plan] : null;
  if (cvRange) {
    const [lo, hi] = cvRange;
    minTarget = Math.min(safeLimit, lo + Math.round(rand * (hi - lo)));
  } else {
    const [minRatio, maxRatio] = FIELD_RATIO_RANGES[field] || DEFAULT_RATIO_RANGE;
    const ratio = minRatio + rand * (maxRatio - minRatio);
    minTarget = Math.min(safeLimit, Math.max(1, Math.round(safeLimit * ratio)));
  }

  return Math.max(safeUsed, minTarget);
}
