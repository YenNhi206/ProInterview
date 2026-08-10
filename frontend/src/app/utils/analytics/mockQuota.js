/** Bù số liệu quota đã dùng (CV, phỏng vấn AI) cho user Pro/Elite dùng quá ít so
 * với gói đã nâng cấp. Chỉ nâng lên khi số thật thấp hơn ngưỡng — không bao giờ
 * hạ số thật xuống. Seed theo userId + tên field nên mỗi tài khoản, mỗi loại
 * quota ra một tỉ lệ khác nhau nhưng ổn định giữa các lần tải.
 *
 * Tỉ lệ khác nhau theo field: phỏng vấn dùng nhiều (50-85%, khớp hành vi "mua gói
 * xong vào phỏng vấn ngay 2-3 lần"), CV dùng ít hơn hẳn (10-20%, ~15% — sửa CV
 * thường ít lần hơn phỏng vấn AI trong 1 chu kỳ gói). */

import { hashSeed, mulberry32 } from "./seededRandom.js";

const PAID_PLANS = new Set(["starter_pro", "elite_pro"]);
const DEFAULT_RATIO_RANGE = [0.5, 0.85];
const FIELD_RATIO_RANGES = {
  cvAnalysis: [0.1, 0.2],
  interview: [0.5, 0.85],
};

/** Trả về số đã dùng, nâng lên tối thiểu theo tỉ lệ của field (xem
 * FIELD_RATIO_RANGES) nếu là user trả phí và số thật đang thấp hơn mức đó. */
export function ensureMinQuotaUsage(userId, used, limit, plan, field) {
  const safeLimit = Number(limit) || 0;
  const safeUsed = Number(used) || 0;
  if (!PAID_PLANS.has(plan) || safeLimit <= 0) return safeUsed;

  const [minRatio, maxRatio] = FIELD_RATIO_RANGES[field] || DEFAULT_RATIO_RANGE;
  const rand = mulberry32(hashSeed(`${userId}:${field}`))();
  const ratio = minRatio + rand * (maxRatio - minRatio);
  const minTarget = Math.min(safeLimit, Math.max(1, Math.round(safeLimit * ratio)));

  return Math.max(safeUsed, minTarget);
}
