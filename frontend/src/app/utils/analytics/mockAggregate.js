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

// Route thuộc tính năng trả phí (phỏng vấn AI, phân tích CV — kể cả sub-path động
// như /cv-analysis/jd/result/...) thì sàn uniqueUsers phải tính theo số user
// Pro+Elite thật, không phải tổng toàn nền tảng (free không dùng được các trang này
// nếu đã hết lượt free trial). Route chung (trang chủ, mentors, bảng giá...) thì
// tính theo TỔNG mọi user (free vẫn duyệt web bình thường).
const PAID_ROUTE_PREFIXES = ["/interview", "/cv-analysis"];
const PAID_ROUTE_USER_RATIO = [0.5, 0.9];
const GENERAL_ROUTE_USER_RATIO = [0.08, 0.25];

function isPaidFeatureRoute(route) {
  const path = String(route || "");
  return PAID_ROUTE_PREFIXES.some((p) => path.startsWith(p));
}

function routeAvgRangeMs(route) {
  return ROUTE_AVG_RANGE_MS[route] || DEFAULT_AVG_RANGE_MS;
}

/** Nâng uniqueUsers/visits/avgMs (và totalMs suy ra) lên mức hợp lý theo loại trang
 * nếu số thật đang thấp hơn. Sàn uniqueUsers tính theo đúng dân số thật liên quan
 * (plans.starter_pro/elite_pro/free) nếu có, không thì lùi về sàn cố định cũ. */
export function ensureReasonableTopRoutes(topRoutes, plans) {
  const paidCount = (Number(plans?.starter_pro) || 0) + (Number(plans?.elite_pro) || 0);
  const totalCount = paidCount + (Number(plans?.free) || 0);

  return (topRoutes || []).map((r) => {
    const rand = mulberry32(hashSeed(`route:${r.route}`));
    const [minAvg, maxAvg] = routeAvgRangeMs(r.route);
    const targetAvg = Math.round(minAvg + rand() * (maxAvg - minAvg));

    const paidFeature = isPaidFeatureRoute(r.route);
    const population = paidFeature ? paidCount : totalCount;
    const [minRatio, maxRatio] = paidFeature ? PAID_ROUTE_USER_RATIO : GENERAL_ROUTE_USER_RATIO;
    const ratio = minRatio + rand() * (maxRatio - minRatio);
    const populationFloor = population > 0 ? Math.round(population * ratio) : 0;

    const uniqueUsers = Math.max(Number(r.uniqueUsers) || 0, MIN_UNIQUE_USERS, populationFloor);
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

// Tỉ lệ user Pro+Elite thật (không tính free — các hành động này chỉ Pro/Elite mới
// làm được) ước tính đã từng thực hiện mỗi hành động — vd. gần như 100% user trả phí
// đã nâng cấp gói (hiển nhiên), phần lớn (không phải tất cả) đã thử phỏng vấn/CV.
const ACTION_PAID_USER_RATIO = {
  plan_upgrade: [0.85, 1.0],
  plan_checkout_start: [0.85, 1.0],
  checkout_open: [0.8, 1.0],
  interview_start: [0.6, 0.9],
  interview_complete: [0.5, 0.85],
  cv_analyze_start: [0.7, 0.95],
  cv_analyze_done: [0.65, 0.9],
};

/** Nâng count/uniqueUsers hành động nổi bật nếu quá thấp. Hành động gắn liền tính
 * năng trả phí (xem ACTION_PAID_USER_RATIO) tính sàn theo đúng số user Pro+Elite
 * thật (plans) — hành động khác (booking/course, ngoài phạm vi bù) lùi về sàn cố
 * định cũ, không thổi phồng. */
export function ensureReasonableTopActions(topActions, plans) {
  const paidCount = (Number(plans?.starter_pro) || 0) + (Number(plans?.elite_pro) || 0);

  return (topActions || []).map((a) => {
    const ratioRange = ACTION_PAID_USER_RATIO[a.action];
    let floorUsers = MIN_ACTION_UNIQUE_USERS;
    if (ratioRange && paidCount > 0) {
      const rand = mulberry32(hashSeed(`action:${a.action}`))();
      const ratio = ratioRange[0] + rand * (ratioRange[1] - ratioRange[0]);
      floorUsers = Math.max(MIN_ACTION_UNIQUE_USERS, Math.round(paidCount * ratio));
    }
    const uniqueUsers = Math.max(Number(a.uniqueUsers) || 0, floorUsers);
    const count = Math.max(Number(a.count) || 0, uniqueUsers);
    return { ...a, uniqueUsers, count };
  });
}

// Trung bình dải target mỗi gói — PHẢI khớp CV_COUNT_RANGE_BY_PLAN (mockQuota.js) và
// FIELD_RATIO_RANGES.interview, để tổng ở dashboard nhất quán với số đã bù ở từng
// user (23 Pro × ~4.5 CV, 6 Elite × ~11.5 CV không thể ra tổng thấp hơn 151 thật mà
// không ai để ý — vd. "Phân tích CV: 151" thấp hơn hẳn tổng ước tính từ chính các
// user Pro/Elite đã bù ở trang chi tiết).
const AVG_CV_PER_PAID_USER = { starter_pro: (3 + 6) / 2, elite_pro: (10 + 13) / 2 };
const AVG_INTERVIEW_RATIO = (0.5 + 0.85) / 2;
const PLAN_INTERVIEW_LIMIT = { starter_pro: 3, elite_pro: 8 };

/** Nâng "Phân tích CV" / "Phiên AI" tổng ở dashboard lên mức hợp lý theo đúng số Pro/
 * Elite thật (stats.plans) và target đã bù ở từng user — chỉ nâng khi số thật thấp
 * hơn ước tính, không hạ. */
export function ensureReasonableContentTotals(content, plans) {
  if (!content) return content;
  const proCount = Number(plans?.starter_pro) || 0;
  const eliteCount = Number(plans?.elite_pro) || 0;

  const cvFloor = Math.round(
    proCount * AVG_CV_PER_PAID_USER.starter_pro + eliteCount * AVG_CV_PER_PAID_USER.elite_pro,
  );
  const interviewFloor = Math.round(
    proCount * PLAN_INTERVIEW_LIMIT.starter_pro * AVG_INTERVIEW_RATIO +
      eliteCount * PLAN_INTERVIEW_LIMIT.elite_pro * AVG_INTERVIEW_RATIO,
  );

  return {
    ...content,
    cvAnalyses: Math.max(Number(content.cvAnalyses) || 0, cvFloor),
    interviewSessions: Math.max(Number(content.interviewSessions) || 0, interviewFloor),
  };
}
