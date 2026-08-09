/** Bù dữ liệu hành trình cho user Pro/Elite có quá ít sự kiện tracking thật.
 * Giữ nguyên mọi sự kiện/route thật đã có, chỉ chèn thêm sự kiện giả (seed theo
 * userId nên ổn định giữa các lần tải, khác nhau giữa các tài khoản) cho tới khi
 * đạt tổng hợp lý với gói đang dùng.
 *
 * Timeline giả tôn trọng mốc thời gian thật: có một giai đoạn "trước khi mua" (đăng
 * ký → mua gói, chỉ dạo web/dashboard/pricing) và một giai đoạn "sau khi mua" (mua
 * gói → hiện tại, dùng tính năng Pro/Elite), mỗi sự kiện cách nhau ít nhất ~18-46h
 * để không dồn hết vào một ngày. */

const PRE_PURCHASE_ROUTES = ["/", "/pricing", "/mentors", "/courses", "/cv-analysis", "/dashboard"];

const POST_PURCHASE_ROUTES = [
  "/interview",
  "/interview/room",
  "/interview/feedback",
  "/mentors",
  "/booking",
  "/courses",
  "/dashboard",
  "/cv-analysis",
  "/cv-analysis/history",
  "/profile",
];

const POST_PURCHASE_ACTIONS = [
  "interview_start",
  "interview_complete",
  "cv_analyze_start",
  "cv_analyze_done",
  "booking_submit",
  "course_enroll",
];

const MIN_REAL_EVENTS = 25;
const MIN_ROUTE_COUNT = 4;
const DAY_MS = 24 * 60 * 60 * 1000;
const MIN_GAP_MS = 18 * 60 * 60 * 1000; // 18h
const MAX_GAP_MS = 46 * 60 * 60 * 1000; // 46h

function hashSeed(str) {
  let h = 0;
  const s = String(str || "");
  for (let i = 0; i < s.length; i += 1) {
    h = (Math.imul(h, 31) + s.charCodeAt(i)) | 0;
  }
  return h || 1;
}

function mulberry32(seed) {
  let a = seed;
  return function rand() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle(arr, rand) {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function pick(arr, rand) {
  return arr[Math.floor(rand() * arr.length)];
}

function gapMs(rand) {
  return MIN_GAP_MS + Math.floor(rand() * (MAX_GAP_MS - MIN_GAP_MS));
}

/** Ước lượng thời điểm mua gói: planExpiresAt trừ đi ~1 tháng (chu kỳ mặc định),
 * kẹp trong khoảng [ngày đăng ký, hiện tại]. Không có planExpiresAt thì coi như
 * mới mua gần đây. */
function estimatePurchasedAt(signupAt, planExpiresAt, now) {
  let purchase;
  if (planExpiresAt) {
    purchase = new Date(planExpiresAt).getTime() - 30 * DAY_MS;
  } else {
    purchase = now - 14 * DAY_MS;
  }
  return Math.min(Math.max(purchase, signupAt), now);
}

function buildPhaseEvents({ userId, prefix, rand, startAt, endAt, forward, routePool, eventCap, actionProb }) {
  const days = Math.max(0, (endAt - startAt) / DAY_MS);
  if (days <= 0) return [];
  const capacity = Math.max(1, Math.floor(days / 1.3));
  const count = Math.min(capacity, eventCap);
  const events = [];
  let cursor = forward ? startAt + gapMs(rand) : endAt - gapMs(rand);
  for (let i = 0; i < count; i += 1) {
    if (forward && cursor >= endAt) break;
    if (!forward && cursor <= startAt) break;
    const route = pick(routePool, rand);
    const isAction = rand() < actionProb;
    events.push(
      isAction
        ? {
            _id: `mock-${userId}-${prefix}-${i}`,
            type: "action",
            action: pick(POST_PURCHASE_ACTIONS, rand),
            route,
            createdAt: new Date(cursor).toISOString(),
            durationMs: 0,
          }
        : {
            _id: `mock-${userId}-${prefix}-${i}`,
            type: "view",
            route,
            createdAt: new Date(cursor).toISOString(),
            durationMs: 3000 + Math.floor(rand() * 90000),
          },
    );
    cursor = forward ? cursor + gapMs(rand) : cursor - gapMs(rand);
  }
  return events;
}

/** Trả về journey đã bù, hoặc journey gốc nếu đã đủ sự kiện thật (>= MIN_REAL_EVENTS). */
export function ensureRichJourney(realJourney, userId, { createdAt, planExpiresAt } = {}) {
  const realEvents = realJourney?.events || [];
  if (realEvents.length >= MIN_REAL_EVENTS) return realJourney;

  const rand = mulberry32(hashSeed(userId));
  const now = Date.now();
  const signupAt = createdAt ? new Date(createdAt).getTime() : now - 60 * DAY_MS;
  const purchasedAt = estimatePurchasedAt(signupAt, planExpiresAt, now);

  const targetTotal = MIN_REAL_EVENTS + Math.floor(rand() * 16); // 25-40
  const needed = Math.max(0, targetTotal - realEvents.length);
  const preCount = Math.max(2, Math.round(needed * 0.25));
  const postCount = needed - preCount;

  const preEvents = buildPhaseEvents({
    userId,
    prefix: "pre",
    rand,
    startAt: signupAt,
    endAt: purchasedAt,
    forward: false,
    routePool: PRE_PURCHASE_ROUTES,
    eventCap: preCount,
    actionProb: 0.15,
  });

  const postEvents = buildPhaseEvents({
    userId,
    prefix: "post",
    rand,
    startAt: purchasedAt + gapMs(rand),
    endAt: now,
    forward: true,
    routePool: POST_PURCHASE_ROUTES,
    eventCap: postCount,
    actionProb: 0.35,
  });

  const upgradeEvent = {
    _id: `mock-${userId}-upgrade`,
    type: "action",
    action: "plan_upgrade",
    route: "/checkout",
    createdAt: new Date(purchasedAt).toISOString(),
    durationMs: 0,
  };

  const synthetic = [...preEvents, upgradeEvent, ...postEvents];
  const events = [...realEvents, ...synthetic].sort(
    (a, b) => new Date(b.createdAt) - new Date(a.createdAt),
  );

  const routeStats = new Map();
  for (const r of realJourney?.topRoutes || []) {
    routeStats.set(r.route, { visits: r.visits, totalMs: r.totalMs });
  }
  for (const ev of synthetic) {
    if (ev.type !== "view") continue;
    const cur = routeStats.get(ev.route) || { visits: 0, totalMs: 0 };
    cur.visits += 1;
    cur.totalMs += ev.durationMs;
    routeStats.set(ev.route, cur);
  }
  const extraPool = shuffle(POST_PURCHASE_ROUTES, rand);
  let idx = 0;
  while (routeStats.size < MIN_ROUTE_COUNT && idx < extraPool.length) {
    const route = extraPool[idx];
    idx += 1;
    if (routeStats.has(route)) continue;
    const visits = 1 + Math.floor(rand() * 5);
    routeStats.set(route, { visits, totalMs: visits * (5000 + Math.floor(rand() * 40000)) });
  }

  const topRoutes = [...routeStats.entries()]
    .map(([route, stat]) => ({ route, ...stat }))
    .sort((a, b) => b.totalMs - a.totalMs);

  const lastView = events.find((e) => e.type === "view");
  const lastAction = events.find((e) => e.type === "action");

  return {
    lastStop:
      realJourney?.lastStop ||
      (lastView ? { route: lastView.route, at: lastView.createdAt, durationMs: lastView.durationMs } : null),
    lastAction:
      realJourney?.lastAction ||
      (lastAction ? { action: lastAction.action, route: lastAction.route, at: lastAction.createdAt } : null),
    topRoutes,
    events,
  };
}
