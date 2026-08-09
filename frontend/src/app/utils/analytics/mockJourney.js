/** Bù dữ liệu hành trình cho user Pro/Elite có quá ít sự kiện tracking thật.
 * Giữ nguyên mọi sự kiện/route thật đã có, chỉ chèn thêm sự kiện giả (seed theo
 * userId nên ổn định giữa các lần tải, khác nhau giữa các tài khoản).
 *
 * Timeline giả tôn trọng mốc thời gian thật: có một giai đoạn "trước khi mua" (đăng
 * ký → mua gói, chỉ dạo web/dashboard/pricing, không có hành động — không được mới
 * hơn hoạt động thật gần nhất) và một giai đoạn "sau khi mua" gồm ĐÚNG số phiên
 * phỏng vấn/phân tích CV còn thiếu so với quota đã dùng (cvUsed/interviewUsed) —
 * bắt đầu → hoàn thành có logic, không phải hành động rời rạc ngẫu nhiên. Phiên
 * dạng này được phép mới hơn hoạt động thật gần nhất (tới tận hiện tại), vì nó đại
 * diện cho usage thật đã tính vào quota mà hệ thống tracking không ghi lại lúc nào —
 * lastStop/lastAction trả về luôn lấy đúng sự kiện mới nhất sau khi gộp. */

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
      durationMs: 15000 + Math.floor(rand() * 75000), // 15 giây - 1 phút 30
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

const SESSION_GAP_MIN_MS = 20 * 60000; // 20 phút
const SESSION_GAP_MAX_MS = 5 * 60 * 60000; // 5 giờ

function sessionGapMs(rand) {
  return SESSION_GAP_MIN_MS + Math.floor(rand() * (SESSION_GAP_MAX_MS - SESSION_GAP_MIN_MS));
}

/** Giai đoạn sau khi mua: sinh ĐÚNG interviewNeeded phiên phỏng vấn + cvNeeded phiên
 * phân tích CV (khớp số quota đã dùng hiển thị ở khối info phía trên), xen thêm vài
 * lượt duyệt trang cho tự nhiên. Khoảng cách giữa các phiên gần hơn khoảng cách
 * duyệt trang thường (mới đủ chỗ nhồi nhiều phiên nếu quota dùng cao). Dừng sớm nếu
 * hết chỗ trước endAt (= hoạt động thật gần nhất) — thà thiếu còn hơn phá mốc thời
 * gian thật. */
function buildPostPurchasePhase({ userId, rand, startAt, endAt, interviewNeeded, cvNeeded }) {
  const events = [];
  let cursor = startAt;
  let ivLeft = Math.max(0, interviewNeeded);
  let cvLeft = Math.max(0, cvNeeded);
  // Tỉ lệ theo số phiên — càng nhiều phiên (quota dùng cao) càng cần nhiều lượt
  // duyệt trang xen giữa, không thì bị dồn cục toàn phiên liên tiếp không tự nhiên.
  let browseLeft = Math.max(2, Math.round((ivLeft + cvLeft) * 0.7));
  let idx = 0;
  let sinceBrowse = 0;

  while ((ivLeft > 0 || cvLeft > 0 || browseLeft > 0) && cursor < endAt) {
    // Random nhưng ép chen sau tối đa 2 phiên liên tiếp, không để dồn cục.
    const doBrowse = browseLeft > 0 && idx > 0 && (sinceBrowse >= 2 || rand() < 0.5);
    let unit;
    if (doBrowse) {
      const durationMs = 15000 + Math.floor(rand() * 75000); // 15 giây - 1 phút 30
      unit = {
        events: [
          {
            _id: `mock-${userId}-browse${idx}`,
            type: "view",
            route: pick(BROWSE_ROUTES, rand),
            createdAt: new Date(cursor).toISOString(),
            durationMs,
          },
        ],
        endAt: cursor + durationMs,
      };
      browseLeft -= 1;
      sinceBrowse = 0;
    } else if (ivLeft > 0 && (cvLeft === 0 || rand() < 0.5)) {
      unit = buildInterviewSession(userId, `int${idx}`, rand, cursor);
      ivLeft -= 1;
      sinceBrowse += 1;
    } else if (cvLeft > 0) {
      unit = buildCvSession(userId, `cv${idx}`, rand, cursor);
      cvLeft -= 1;
      sinceBrowse += 1;
    } else {
      break;
    }

    if (unit.endAt > endAt) break;
    events.push(...unit.events);
    cursor = unit.endAt + sessionGapMs(rand);
    idx += 1;
  }

  return events;
}

/** Trả về journey đã bù, hoặc journey gốc nếu đã đủ sự kiện thật (>= MIN_REAL_EVENTS). */
export function ensureRichJourney(realJourney, userId, { createdAt, planExpiresAt, interviewUsed, cvUsed } = {}) {
  const realEvents = realJourney?.events || [];
  if (realEvents.length >= MIN_REAL_EVENTS) return realJourney;

  const rand = mulberry32(hashSeed(userId));
  const now = Date.now();
  const signupAt = createdAt ? new Date(createdAt).getTime() : now - 60 * DAY_MS;

  // Nếu tài khoản đã có sự kiện plan_upgrade THẬT, dùng đúng thời điểm đó thay vì
  // ước lượng từ planExpiresAt (vốn có thể lệch xa nếu gói đã gia hạn) — ước lượng
  // sai khiến purchasedAt tính ra muộn hơn cả hoạt động thật gần nhất, làm hỏng toàn
  // bộ cửa sổ thời gian bù ở bước sau.
  const realUpgradeEvent = realEvents.find((e) => e.type === "action" && e.action === "plan_upgrade");
  const hasRealUpgradeEvent = Boolean(realUpgradeEvent);
  const purchasedAt = hasRealUpgradeEvent
    ? new Date(realUpgradeEvent.createdAt).getTime()
    : estimatePurchasedAt(signupAt, planExpiresAt, now);

  // Số phiên giả cần thêm = quota đã dùng (đã bù ở khối info) trừ số phiên thật đã
  // có trong sự kiện — để Timeline không lệch số với "CV đã dùng"/"Phỏng vấn AI" hiển
  // thị phía trên.
  const realInterviewCount = realEvents.filter((e) => e.type === "action" && e.action === "interview_complete").length;
  const realCvCount = realEvents.filter((e) => e.type === "action" && e.action === "cv_analyze_done").length;
  const interviewNeeded = Math.max(0, (Number(interviewUsed) || 0) - realInterviewCount);
  const cvNeeded = Math.max(0, (Number(cvUsed) || 0) - realCvCount);

  const preEvents = buildBrowsingPhase({
    userId,
    prefix: "pre",
    rand,
    startAt: signupAt,
    endAt: purchasedAt,
    routePool: PRE_PURCHASE_ROUTES,
  });

  // Độ trễ trước sự kiện ĐẦU TIÊN sau khi mua chỉ vài phút-vài giờ (khách vừa nâng
  // cấp thường thử dùng ngay hôm đó).
  // Phiên phỏng vấn/CV ở đây được PHÉP mới hơn "hoạt động thật gần nhất" (khác quy
  // tắc chung) — vì chúng đại diện cho usage THẬT đã tính vào quota (cvUsed/
  // interviewUsed) nhưng hệ thống tracking không ghi lại lúc nào; khóa cứng ở mốc
  // cũ sẽ khiến quota > 0 mà Timeline không bao giờ chèn được phiên nào (đúng lỗi đã
  // gặp: "CV đã dùng 5" nhưng Timeline trống trơn vì cửa sổ = 0).
  const firstPostDelayMs = 5 * 60000 + Math.floor(rand() * 6 * 60 * 60000); // 5 phút - ~6 giờ
  const postEvents = buildPostPurchasePhase({
    userId,
    rand,
    startAt: purchasedAt + firstPostDelayMs,
    endAt: now,
    interviewNeeded,
    cvNeeded,
  });

  // Đúng luồng thật (Pricing.jsx → Checkout.jsx): bấm nâng cấp ở bảng giá trước,
  // rồi mới mở trang thanh toán, rồi mới hoàn tất — không chỉ mỗi plan_upgrade trơ trọi.
  // Nếu tài khoản đã có sự kiện plan_upgrade THẬT rồi thì bỏ qua, không thêm bản giả
  // trùng lặp (từng gây ra cảnh "Mở trang thanh toán" lặp lại nhiều lần trên Timeline).
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

  // Lấy trực tiếp từ events đã gộp + sắp mới nhất trước — không còn ưu tiên cứng
  // realJourney.lastStop/lastAction, vì phiên phỏng vấn/CV bù theo quota (ở trên)
  // được phép mới hơn hoạt động thật cũ, nên có thể chính nó mới là "gần nhất" thật.
  const lastView = events.find((e) => e.type === "view");
  const lastAction = events.find((e) => e.type === "action");

  return {
    lastStop: lastView
      ? { route: lastView.route, at: lastView.createdAt, durationMs: lastView.durationMs }
      : realJourney?.lastStop || null,
    lastAction: lastAction
      ? { action: lastAction.action, route: lastAction.route, at: lastAction.createdAt }
      : realJourney?.lastAction || null,
    topRoutes,
    events,
  };
}
