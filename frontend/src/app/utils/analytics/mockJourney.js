/** Bù dữ liệu hành trình cho user Pro/Elite có quá ít sự kiện tracking thật.
 * Giữ nguyên mọi sự kiện/route thật đã có, chỉ chèn thêm sự kiện giả (seed theo
 * userId nên ổn định giữa các lần tải, khác nhau giữa các tài khoản) cho tới khi
 * đạt tổng hợp lý với gói đang dùng.
 *
 * Timeline giả tôn trọng mốc thời gian thật: có một giai đoạn "trước khi mua" (đăng
 * ký → mua gói, chỉ dạo web/dashboard/pricing, không có hành động) và một giai đoạn
 * "sau khi mua" (mua gói → hoạt động thật gần nhất) gồm các phiên có logic — bắt đầu
 * phỏng vấn/phân tích CV rồi mới hoàn thành, chứ không phải hành động rời rạc ngẫu
 * nhiên — xen với vài lượt duyệt trang thường. Sự kiện giả không bao giờ mới hơn
 * hoạt động thật gần nhất (nếu không sẽ chôn sự kiện thật xuống dưới Timeline). */

import { hashSeed, mulberry32, pick } from "./seededRandom.js";

const PRE_PURCHASE_ROUTES = ["/", "/pricing", "/mentors", "/courses", "/cv-analysis", "/dashboard"];

const BROWSE_ROUTES = ["/mentors", "/courses", "/dashboard", "/profile"];

const MIN_REAL_EVENTS = 25;
const MIN_ROUTE_COUNT = 4;
const DAY_MS = 24 * 60 * 60 * 1000;
const MIN_GAP_MS = 18 * 60 * 60 * 1000; // 18h
const MAX_GAP_MS = 46 * 60 * 60 * 1000; // 46h

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

/** Chỉ sinh sự kiện xem trang (không hành động) — dùng cho giai đoạn trước khi mua,
 * khi user chỉ đang dạo web chứ chưa dùng tính năng trả phí. */
function buildBrowsingPhase({ userId, prefix, rand, startAt, endAt, routePool }) {
  const days = Math.max(0, (endAt - startAt) / DAY_MS);
  if (days <= 0) return [];
  const count = Math.max(2, Math.min(8, Math.floor(days / 1.3)));
  const events = [];
  let cursor = endAt - gapMs(rand);
  for (let i = 0; i < count && cursor > startAt; i += 1) {
    events.push({
      _id: `mock-${userId}-${prefix}-${i}`,
      type: "view",
      route: pick(routePool, rand),
      createdAt: new Date(cursor).toISOString(),
      durationMs: 3000 + Math.floor(rand() * 40000),
    });
    cursor -= gapMs(rand);
  }
  return events;
}

/** Phiên phỏng vấn AI: bắt đầu → ngồi trong phòng → hoàn thành. */
function buildInterviewSession(userId, prefix, rand, startAt) {
  const enterDelay = 5000 + Math.floor(rand() * 15000);
  const roomDurationMs = 3 * 60000 + Math.floor(rand() * 12 * 60000); // 3-15 phút
  const t0 = startAt;
  const t1 = t0 + enterDelay;
  const t2 = t1 + roomDurationMs;
  return {
    events: [
      {
        _id: `mock-${userId}-${prefix}-start`,
        type: "action",
        action: "interview_start",
        route: "/interview",
        createdAt: new Date(t0).toISOString(),
        durationMs: 0,
      },
      {
        _id: `mock-${userId}-${prefix}-room`,
        type: "view",
        route: "/interview/room",
        createdAt: new Date(t1).toISOString(),
        durationMs: roomDurationMs,
      },
      {
        _id: `mock-${userId}-${prefix}-done`,
        type: "action",
        action: "interview_complete",
        route: "/interview/room",
        createdAt: new Date(t2).toISOString(),
        durationMs: 0,
      },
    ],
    endAt: t2,
  };
}

/** Phiên phân tích CV: bắt đầu → chờ xử lý → hoàn thành → xem lại kết quả. */
function buildCvSession(userId, prefix, rand, startAt) {
  const t0 = startAt;
  const processingMs = 20000 + Math.floor(rand() * 100000); // 20s - 2 phút
  const t1 = t0 + 3000 + Math.floor(rand() * 8000);
  const t2 = t1 + processingMs;
  const t3 = t2 + 5000 + Math.floor(rand() * 10000);
  const resultViewMs = 30000 + Math.floor(rand() * 90000); // 30s - 2 phút xem kết quả
  return {
    events: [
      {
        _id: `mock-${userId}-${prefix}-start`,
        type: "action",
        action: "cv_analyze_start",
        route: "/cv-analysis",
        createdAt: new Date(t0).toISOString(),
        durationMs: 0,
      },
      {
        _id: `mock-${userId}-${prefix}-processing`,
        type: "view",
        route: "/cv-analysis",
        createdAt: new Date(t1).toISOString(),
        durationMs: processingMs,
      },
      {
        _id: `mock-${userId}-${prefix}-done`,
        type: "action",
        action: "cv_analyze_done",
        route: "/cv-analysis",
        createdAt: new Date(t2).toISOString(),
        durationMs: 0,
      },
      {
        _id: `mock-${userId}-${prefix}-result`,
        type: "view",
        route: "/cv-analysis/history",
        createdAt: new Date(t3).toISOString(),
        durationMs: resultViewMs,
      },
    ],
    endAt: t3 + resultViewMs,
  };
}

/** Giai đoạn sau khi mua: xen kẽ phiên phỏng vấn / phân tích CV có logic với vài
 * lượt duyệt trang thường, không vượt quá endAt (= hoạt động thật gần nhất). */
function buildPostPurchasePhase({ userId, rand, startAt, endAt, eventBudget }) {
  const events = [];
  let cursor = startAt;
  let remaining = eventBudget;

  // Ưu tiên chèn trước ít nhất 1 phiên phỏng vấn + 1 phiên CV nếu còn đủ vốn/chỗ —
  // trước đây chọn hoàn toàn ngẫu nhiên nên nhiều tài khoản ít vốn (needed nhỏ) hết
  // vốn/hết chỗ trước khi bao giờ roll trúng, timeline chỉ toàn duyệt trang suông.
  const priorityUnits = [
    { build: buildInterviewSession, cost: 3, prefix: "int0" },
    { build: buildCvSession, cost: 4, prefix: "cv0" },
  ];
  for (const { build, cost, prefix } of priorityUnits) {
    if (remaining < cost || cursor >= endAt) continue;
    const unit = build(userId, prefix, rand, cursor);
    if (unit.endAt > endAt) continue;
    events.push(...unit.events);
    remaining -= unit.events.length;
    cursor = unit.endAt + gapMs(rand);
  }

  let unitIdx = 1;
  const maxUnits = Math.max(1, Math.floor(eventBudget / 1.5));
  while (remaining > 0 && cursor < endAt && unitIdx < maxUnits) {
    const roll = rand();
    let unit;
    if (roll < 0.2 && remaining >= 3) {
      unit = buildInterviewSession(userId, `int${unitIdx}`, rand, cursor);
    } else if (roll < 0.4 && remaining >= 4) {
      unit = buildCvSession(userId, `cv${unitIdx}`, rand, cursor);
    } else {
      const durationMs = 3000 + Math.floor(rand() * 60000);
      unit = {
        events: [
          {
            _id: `mock-${userId}-browse${unitIdx}`,
            type: "view",
            route: pick(BROWSE_ROUTES, rand),
            createdAt: new Date(cursor).toISOString(),
            durationMs,
          },
        ],
        endAt: cursor + durationMs,
      };
    }

    if (unit.endAt > endAt) break;
    events.push(...unit.events);
    remaining -= unit.events.length;
    unitIdx += 1;
    cursor = unit.endAt + gapMs(rand);
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
  const preCount = Math.max(2, Math.round(needed * 0.2));
  const postBudget = needed - preCount;

  // Sự kiện giả không bao giờ được mới hơn hoạt động thật gần nhất — nếu không,
  // nó sẽ chen lên đầu Timeline (sắp mới nhất trước) và che mất sự kiện thật.
  const mostRecentRealAt = realEvents.length
    ? Math.max(...realEvents.map((e) => new Date(e.createdAt).getTime()))
    : null;
  const postEndAt = mostRecentRealAt !== null ? Math.min(now, mostRecentRealAt) : now;

  const preEvents = buildBrowsingPhase({
    userId,
    prefix: "pre",
    rand,
    startAt: signupAt,
    endAt: purchasedAt,
    routePool: PRE_PURCHASE_ROUTES,
  });

  // Độ trễ trước sự kiện ĐẦU TIÊN sau khi mua chỉ vài phút-vài giờ (khách vừa nâng
  // cấp thường thử dùng ngay hôm đó) — không dùng gapMs() (18-46h) ở đây, vì nếu
  // hoạt động thật gần nhất (postEndAt) đến sớm hơn mốc đó thì cả giai đoạn này,
  // kể cả phiên ưu tiên, sẽ bị bỏ trống hoàn toàn ngay từ dòng đầu tiên.
  const firstPostDelayMs = 5 * 60000 + Math.floor(rand() * 6 * 60 * 60000); // 5 phút - ~6 giờ
  const postEvents = buildPostPurchasePhase({
    userId,
    rand,
    startAt: purchasedAt + firstPostDelayMs,
    endAt: postEndAt,
    eventBudget: postBudget,
  });

  // Đúng luồng thật (Pricing.jsx → Checkout.jsx): bấm nâng cấp ở bảng giá trước,
  // rồi mới mở trang thanh toán, rồi mới hoàn tất — không chỉ mỗi plan_upgrade trơ trọi.
  // Nếu tài khoản đã có sự kiện plan_upgrade THẬT rồi thì bỏ qua, không thêm bản giả
  // trùng lặp (từng gây ra cảnh "Mở trang thanh toán" lặp lại nhiều lần trên Timeline).
  const hasRealUpgradeEvent = realEvents.some((e) => e.type === "action" && e.action === "plan_upgrade");
  const checkoutStartAt = Math.max(signupAt, purchasedAt - (2 * 60000 + Math.floor(rand() * 8 * 60000)));
  const checkoutOpenAt = Math.max(checkoutStartAt, purchasedAt - (30000 + Math.floor(rand() * 90000)));

  const purchaseFunnelEvents = hasRealUpgradeEvent
    ? []
    : [
        {
          _id: `mock-${userId}-checkout-start`,
          type: "action",
          action: "plan_checkout_start",
          route: "/pricing",
          createdAt: new Date(checkoutStartAt).toISOString(),
          durationMs: 0,
        },
        {
          _id: `mock-${userId}-checkout-open`,
          type: "action",
          action: "checkout_open",
          route: "/checkout",
          createdAt: new Date(checkoutOpenAt).toISOString(),
          durationMs: 0,
        },
        {
          _id: `mock-${userId}-upgrade`,
          type: "action",
          action: "plan_upgrade",
          route: "/checkout",
          createdAt: new Date(purchasedAt).toISOString(),
          durationMs: 0,
        },
      ];

  const synthetic = [...preEvents, ...purchaseFunnelEvents, ...postEvents];
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
  const fallbackRoutes = ["/interview/room", "/cv-analysis", "/mentors", "/courses", "/dashboard"];
  let idx = 0;
  while (routeStats.size < MIN_ROUTE_COUNT && idx < fallbackRoutes.length) {
    const route = fallbackRoutes[idx];
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
