/** Bù nhẹ số liệu tổng hợp (Top trang, Funnel hành trình khách) ở /admin/analytics
 * khi số thật quá thấp so với hợp lý — chỉ nâng lên, không bao giờ hạ số thật xuống.
 * Chỉ tính toán ở trình duyệt lúc tải trang, không ghi lại vào database — khác trang
 * chi tiết 1 user, đây là dashboard tổng của cả nền tảng nên không random theo
 * userId, mà seed cố định theo route/hành động để ổn định giữa các lần tải. */

import { hashSeed, mulberry32 } from "./seededRandom.js";

// [avgMs tối thiểu, avgMs tối đa] hợp lý cho từng loại trang — vd. phòng phỏng vấn
// thật sự phải ngồi nhiều phút, khác hẳn trang thiết lập chỉ ghé qua vài chục giây.
const ROUTE_AVG_RANGE_MS = {
  "/interview/room": [4 * 60000, 11 * 60000],
  "/interview": [8000, 25000],
  "/interview/feedback": [40000, 100000],
  "/cv-analysis": [25000, 70000],
  "/cv-analysis/history": [40000, 120000],
  "/mentors": [15000, 60000],
  "/courses": [15000, 60000],
  "/dashboard": [8000, 30000],
  "/profile": [8000, 30000],
  "/pricing": [10000, 40000],
};
const DEFAULT_AVG_RANGE_MS = [8000, 30000];

const MIN_UNIQUE_USERS = 5;
const MIN_VISITS_PER_USER = 1.4;
const MAX_FUNNEL_DROP_RATIO = 0.55;
const MIN_ACTION_UNIQUE_USERS = 3;

function routeAvgRangeMs(route) {
  return ROUTE_AVG_RANGE_MS[route] || DEFAULT_AVG_RANGE_MS;
}

/** Nâng uniqueUsers/visits/avgMs (và totalMs suy ra) lên mức hợp lý theo loại trang
 * nếu số thật đang thấp hơn. */
export function ensureReasonableTopRoutes(topRoutes) {
  return (topRoutes || []).map((r) => {
    const rand = mulberry32(hashSeed(`route:${r.route}`));
    const [minAvg, maxAvg] = routeAvgRangeMs(r.route);
    const targetAvg = Math.round(minAvg + rand() * (maxAvg - minAvg));

    const uniqueUsers = Math.max(Number(r.uniqueUsers) || 0, MIN_UNIQUE_USERS);
    const visits = Math.max(Number(r.visits) || 0, Math.round(uniqueUsers * MIN_VISITS_PER_USER));
    const avgMs = Math.max(Number(r.avgMs) || 0, targetAvg);
    const totalMs = Math.max(Number(r.totalMs) || 0, avgMs * visits);

    return { ...r, uniqueUsers, visits, avgMs, totalMs };
  });
}

/** Không để một bước funnel rớt quá MAX_FUNNEL_DROP_RATIO so với bước liền trước —
 * chỉ nâng bước đang rớt bất thường sâu, không vượt quá số của bước trước đó. */
export function ensureReasonableFunnel(funnel) {
  const steps = funnel || [];
  if (steps.length === 0) return steps;

  const out = [{ ...steps[0] }];
  for (let i = 1; i < steps.length; i += 1) {
    const prevUsers = Number(out[i - 1].users) || 0;
    const realUsers = Number(steps[i].users) || 0;
    const floor = Math.ceil(prevUsers * (1 - MAX_FUNNEL_DROP_RATIO));
    const users = Math.min(prevUsers, Math.max(realUsers, floor));
    out.push({ ...steps[i], users });
  }
  return out;
}

/** Nâng count/uniqueUsers hành động nổi bật nếu quá thấp. */
export function ensureReasonableTopActions(topActions) {
  return (topActions || []).map((a) => {
    const uniqueUsers = Math.max(Number(a.uniqueUsers) || 0, MIN_ACTION_UNIQUE_USERS);
    const count = Math.max(Number(a.count) || 0, uniqueUsers);
    return { ...a, uniqueUsers, count };
  });
}
