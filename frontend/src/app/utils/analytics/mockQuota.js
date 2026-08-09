/** Bù số liệu quota đã dùng (CV, phỏng vấn AI) cho user Pro/Elite dùng quá ít so
 * với gói đã nâng cấp. Chỉ nâng lên khi số thật thấp hơn ngưỡng — không bao giờ
 * hạ số thật xuống. Seed theo userId + tên field nên mỗi tài khoản, mỗi loại
 * quota ra một tỉ lệ khác nhau nhưng ổn định giữa các lần tải. */

import { hashSeed, mulberry32 } from "./seededRandom.js";

const PAID_PLANS = new Set(["starter_pro", "elite_pro"]);
const MIN_USAGE_RATIO = 0.5;
const MAX_USAGE_RATIO = 0.85;

/** Trả về số đã dùng, nâng lên tối thiểu 50-85% hạn mức nếu là user trả phí và
 * số thật đang thấp hơn mức đó. */
export function ensureMinQuotaUsage(userId, used, limit, plan, field) {
  const safeLimit = Number(limit) || 0;
  const safeUsed = Number(used) || 0;
  if (!PAID_PLANS.has(plan) || safeLimit <= 0) return safeUsed;

  const rand = mulberry32(hashSeed(`${userId}:${field}`))();
  const ratio = MIN_USAGE_RATIO + rand * (MAX_USAGE_RATIO - MIN_USAGE_RATIO);
  const minTarget = Math.min(safeLimit, Math.max(1, Math.round(safeLimit * ratio)));

  return Math.max(safeUsed, minTarget);
}
