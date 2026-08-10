/** Bù dữ liệu hành trình cho user Pro/Elite có quá ít sự kiện tracking thật.
 * Giữ nguyên mọi sự kiện/route thật đã có, chỉ chèn thêm sự kiện giả (seed theo
 * userId nên ổn định giữa các lần tải, khác nhau giữa các tài khoản).
 *
 * Timeline giả tôn trọng mốc thời gian thật: có một giai đoạn "trước khi mua" (đăng
 * ký → mua gói, chỉ dạo web/dashboard/pricing, không có hành động — không được mới
 * hơn hoạt động thật gần nhất) và một giai đoạn "sau khi mua" gồm ĐÚNG số phiên
 * phỏng vấn/phân tích CV còn thiếu so với quota đã dùng (cvUsed/interviewUsed) —
 * bắt đầu → hoàn thành có logic, không phải hành động rời rạc ngẫu nhiên. Phiên
 * dạng này được phép mới hơn hoạt động thật gần nhất theo tracking sự kiện (vì nó
 * đại diện cho usage thật đã tính vào quota mà hệ thống tracking không ghi lại lúc
 * nào), nhưng KHÔNG được vượt quá lastSeenAt thật (lần cuối user online) — không thể
 * có hoạt động sau lần cuối được ghi nhận online. lastStop/lastAction trả về luôn
 * lấy đúng sự kiện mới nhất sau khi gộp. */

import { hashSeed, mulberry32, pick } from "./seededRandom.js";

// Số lượt duyệt trang xen giữa = số phiên phỏng vấn/CV × hệ số này — user thật ghé
// trang chủ/dashboard/hồ sơ nhiều lần trong lúc dùng app, không chỉ 1-2 lượt cho có.
// Dùng chung ở buildPostPurchasePhase (sinh thật) và extendActivityCeiling (ước
// lượng cửa sổ cần) — phải khớp nhau, đổi 1 chỗ mà quên chỗ kia sẽ lại thiếu chỗ
// chứa như các lần trước.
const BROWSE_MULTIPLIER = 1.8;

// Trang chủ/Bảng điều khiển/Hồ sơ là những trang ghé MỖI LẦN mở app (điểm vào +
// kiểm tra tài khoản), nên phải xuất hiện dày hơn hẳn so với trang tính năng cụ thể
// (mentors/courses, chỉ ghé khi thật sự cần) — lặp lại nhiều lần trong mảng để
// pick() (chọn ngẫu nhiên đều) tự nhiên ưu tiên chúng hơn, không cần đổi cơ chế pick.
const BROWSE_ROUTES = [
  "/",
  "/",
  "/",
  "/dashboard",
  "/dashboard",
  "/dashboard",
  "/profile",
  "/profile",
  "/mentors",
  "/courses",
];

const MIN_REAL_EVENTS = 100;
const MIN_ROUTE_COUNT = 4;
const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_GAP_MS = 46 * 60 * 60 * 1000; // 46h — trần "bữa sau quay lại" trong buildPreDecisionPhase

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

/** Phiên phân tích CV dùng thử MIỄN PHÍ (trước khi mua gói) — ngắn hơn bản trả phí,
 * không có bước xem lại "Lịch sử phân tích CV" (tính năng chỉ Pro/Elite mới có). */
function buildFreeCvTrialSession(userId, prefix, rand, startAt) {
  const t0 = startAt;
  const processingMs = 15000 + Math.floor(rand() * 60000); // 15s - 1 phút 15 (thử nhanh)
  const t1 = t0 + 3000 + Math.floor(rand() * 8000);
  const t2 = t1 + processingMs;
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
    ],
    endAt: t2,
  };
}

/** Phiên phỏng vấn dùng thử MIỄN PHÍ (route /interview/trial, khác /interview/room
 * của bản trả phí) — ngắn hơn, chỉ 3 câu baseline theo đúng flow trial thật. */
function buildFreeInterviewTrialSession(userId, prefix, rand, startAt) {
  const enterDelay = 5000 + Math.floor(rand() * 15000);
  const roomDurationMs = 2 * 60000 + Math.floor(rand() * 6 * 60000); // 2-8 phút
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
        route: "/interview/trial",
        createdAt: new Date(t1).toISOString(),
        durationMs: roomDurationMs,
      },
      {
        _id: `mock-${userId}-${prefix}-done`,
        type: "action",
        action: "interview_complete",
        route: "/interview/trial",
        createdAt: new Date(t2).toISOString(),
        durationMs: 0,
      },
    ],
    endAt: t2,
  };
}

/** Giai đoạn trước khi mua, theo đúng flow thật: (1) mới đăng ký, dạo trang chủ rồi
 * dùng thử miễn phí CV + phỏng vấn, xem bảng giá rồi RỜI ĐI (chưa mua) — (2) cách
 * đó một khoảng lớn (nghỉ ≥ nửa ngày, "bữa sau"), quay lại xem bảng giá + lướt web
 * (mentors/khóa học) rồi mới mua. Bỏ qua bước nào không đủ chỗ (window quá hẹp) —
 * thà thiếu còn hơn chồng lấn/vượt purchasedAt. */
function buildPreDecisionPhase({ userId, rand, signupAt, purchasedAt }) {
  const events = [];
  if (purchasedAt <= signupAt) return events;

  let cursor = signupAt + 30000 + Math.floor(rand() * 5 * 60000); // vài chục giây - 5 phút sau đăng ký

  const pushView = (route, minMs, maxMs, prefix) => {
    if (cursor >= purchasedAt) return false;
    const durationMs = minMs + Math.floor(rand() * (maxMs - minMs));
    events.push({
      _id: `mock-${userId}-${prefix}`,
      type: "view",
      route,
      createdAt: new Date(cursor).toISOString(),
      durationMs,
    });
    cursor += durationMs;
    return true;
  };

  const pushSession = (buildFn, prefix) => {
    if (cursor >= purchasedAt) return false;
    const unit = buildFn(userId, prefix, rand, cursor);
    if (unit.endAt >= purchasedAt) return false;
    events.push(...unit.events);
    cursor = unit.endAt;
    return true;
  };

  const idleGap = (minMs, maxMs) => {
    cursor += minMs + Math.floor(rand() * (maxMs - minMs));
  };

  // Visit 1: đăng ký xong, dạo trang chủ → thử CV miễn phí → thử phỏng vấn miễn phí
  // → xem giá rồi rời đi (chưa mua).
  pushView("/", 8000, 28000, "pre-home");
  idleGap(10000, 40000);
  pushSession(buildFreeCvTrialSession, "pre-cvtrial");
  idleGap(60000, 5 * 60000);
  pushSession(buildFreeInterviewTrialSession, "pre-ivtrial");
  idleGap(30000, 90000);
  pushView("/pricing", 15000, 50000, "pre-pricing1");

  // Nghỉ 1 khoảng lớn ("bữa sau" mới quay lại) — chỉ áp dụng nếu còn đủ xa
  // purchasedAt, không thì bỏ qua để không lấn vào lúc mua.
  const remaining = purchasedAt - cursor;
  const RETURN_GAP_MIN_MS = 8 * 60 * 60000; // tối thiểu 8h mới coi là "bữa sau"
  if (remaining > RETURN_GAP_MIN_MS * 1.6) {
    idleGap(RETURN_GAP_MIN_MS, Math.min(remaining - RETURN_GAP_MIN_MS * 1.2, MAX_GAP_MS * 2));
  }

  // Visit 2: quay lại xem giá + lướt web (mentors/khóa học) rồi mới mua (phễu nâng
  // cấp gói nối tiếp ngay sau, ở ensureRichJourney).
  pushView("/pricing", 15000, 45000, "pre-pricing2");
  idleGap(20000, 80000);
  pushView(pick(["/mentors", "/courses"], rand), 10000, 35000, "pre-browse2a");
  idleGap(15000, 60000);
  pushView(pick(["/mentors", "/courses", "/"], rand), 10000, 35000, "pre-browse2b");

  return events;
}

const SESSION_GAP_FLOOR_MS = 2 * 60000; // 2 phút — tối thiểu tuyệt đối giữa 2 phiên
// 3 ngày — tối đa khi còn dư dả thời gian. Trước là 5 giờ nên dù cửa sổ có được nới
// rộng cỡ nào, mọi phiên vẫn luôn dồn cục trong 1 ngày (5h << 24h).
const SESSION_GAP_MAX_MS = 3 * DAY_MS;

/** Khoảng cách tới đơn vị (phiên/duyệt trang) tiếp theo — co giãn theo thời gian còn
 * lại chia cho số đơn vị còn phải chèn, để KHÔNG dùng hết cửa sổ thời gian giữa
 * chừng rồi bỏ cuộc (quota nói cần N phiên nhưng chỉ chèn được 1-2 vì gap cố định
 * quá dài so với cửa sổ hẹp). Vẫn có chút ngẫu nhiên (60-100% mức tính được). */
function adaptiveGapMs(rand, remainingTimeMs, remainingUnits) {
  const avg = remainingUnits > 0 ? remainingTimeMs / (remainingUnits + 1) : SESSION_GAP_MAX_MS;
  const capped = Math.max(SESSION_GAP_FLOOR_MS, Math.min(SESSION_GAP_MAX_MS, avg));
  return Math.floor(capped * (0.6 + rand() * 0.4));
}

/** Giai đoạn sau khi mua: sinh ĐÚNG interviewNeeded phiên phỏng vấn + cvNeeded phiên
 * phân tích CV (khớp số quota đã dùng hiển thị ở khối info phía trên), xen thêm vài
 * lượt duyệt trang cho tự nhiên. Khoảng cách giữa các đơn vị co giãn theo thời gian
 * còn lại (adaptiveGapMs) — quota càng cao thì gap càng ngắn tự động, để chèn được
 * ĐỦ số phiên cần thiết thay vì hết cửa sổ giữa chừng rồi bỏ cuộc. Chỉ dừng sớm khi
 * cửa sổ thời gian thật sự quá hẹp (không đủ chứa nổi 1 phiên trọn vẹn nữa). */
function buildPostPurchasePhase({ userId, rand, startAt, endAt, interviewNeeded, cvNeeded }) {
  const events = [];
  let cursor = startAt;
  let ivLeft = Math.max(0, interviewNeeded);
  let cvLeft = Math.max(0, cvNeeded);
  // Tỉ lệ theo số phiên — càng nhiều phiên (quota dùng cao) càng cần nhiều lượt
  // duyệt trang xen giữa, không thì bị dồn cục toàn phiên liên tiếp không tự nhiên.
  let browseLeft = Math.max(3, Math.round((ivLeft + cvLeft) * BROWSE_MULTIPLIER));
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
    const remainingUnits = ivLeft + cvLeft + browseLeft;
    const remainingTimeMs = Math.max(0, endAt - unit.endAt);
    cursor = unit.endAt + adaptiveGapMs(rand, remainingTimeMs, remainingUnits);
    idx += 1;
  }

  return events;
}

/** Nới activityCeiling rộng thêm nếu cửa sổ [purchasedAt, activityCeiling] không đủ
 * chứa số phiên interviewNeeded/cvNeeded, trải dài nhiều ngày (không dồn cục). Dùng
 * chung bởi ensureRichJourney (trang chi tiết, có dữ liệu sự kiện thật) VÀ
 * estimateDisplayLastSeenAt (danh sách nhiều user, không có dữ liệu sự kiện) — để 2
 * nơi cho ra con số cùng logic, không lệch nhau. */
function extendActivityCeiling({ rand, now, purchasedAt, activityCeiling, firstPostDelayMs, interviewNeeded, cvNeeded }) {
  if (interviewNeeded <= 0 && cvNeeded <= 0) return activityCeiling;

  const browseEstimate = Math.max(3, Math.round((interviewNeeded + cvNeeded) * BROWSE_MULTIPLIER));
  const totalUnits = interviewNeeded + cvNeeded + browseEstimate;
  const sessionsDurationMs =
    firstPostDelayMs +
    interviewNeeded * 16 * 60000 + // phỏng vấn tối đa ~15 phút + vài chục giây vào phòng
    cvNeeded * 5 * 60000 + // phiên CV tối đa ~4-5 phút
    browseEstimate * 2 * 60000; // lượt duyệt trang tối đa ~1-2 phút
  const avgUnitGapMs = SESSION_GAP_FLOOR_MS + Math.floor(rand() * (SESSION_GAP_MAX_MS - SESSION_GAP_FLOOR_MS));
  const desiredSpanMs = sessionsDurationMs + totalUnits * avgUnitGapMs;
  const rawCeiling = purchasedAt + desiredSpanMs;

  // Khi desiredSpanMs vượt quá khoảng cách tới hiện tại, KHÔNG kẹp cứng về đúng
  // "now" — làm vậy mọi tài khoản bị vượt trần đều hiện y hệt giờ:phút:giây admin
  // đang mở trang, trông như dàn dựng. Thay vào đó chọn ngẫu nhiên 1 điểm giữa mức
  // tối thiểu cần (đủ chứa thời lượng phiên) và hiện tại — vẫn seed theo userId nên
  // mỗi tài khoản một thời điểm khác nhau.
  let neededCeiling = rawCeiling;
  if (rawCeiling > now) {
    const minFeasible = Math.min(now, purchasedAt + sessionsDurationMs);
    neededCeiling = minFeasible + Math.floor(rand() * Math.max(0, now - minFeasible));
  }
  return Math.max(activityCeiling, Math.min(now, neededCeiling));
}

/** Ước lượng NHẸ "lastSeenAt hiển thị" — dùng cho danh sách nhiều user cùng lúc (vd.
 * /admin/users) nơi không tải toàn bộ hành trình từng người nên không biết số phiên
 * thật đã có; coi interviewUsed/cvUsed (đã bù quota) là số phiên cần luôn, không trừ
 * bớt — có thể nới hơi rộng hơn 1 chút so với trang chi tiết (chấp nhận được, chỉ để
 * hiển thị, không sinh Timeline ở đây). */
export function estimateDisplayLastSeenAt(userId, { createdAt, planExpiresAt, lastSeenAt, interviewUsed, cvUsed }) {
  const rand = mulberry32(hashSeed(userId));
  const now = Date.now();
  let activityCeiling = lastSeenAt ? Math.min(now, new Date(lastSeenAt).getTime()) : now;
  const signupAt = createdAt ? new Date(createdAt).getTime() : activityCeiling - 60 * DAY_MS;
  const purchasedAt = estimatePurchasedAt(signupAt, planExpiresAt, activityCeiling);
  const firstPostDelayMs = 5 * 60000 + Math.floor(rand() * 6 * 60 * 60000); // 5 phút - ~6 giờ

  activityCeiling = extendActivityCeiling({
    rand,
    now,
    purchasedAt,
    activityCeiling,
    firstPostDelayMs,
    interviewNeeded: Number(interviewUsed) || 0,
    cvNeeded: Number(cvUsed) || 0,
  });

  return new Date(activityCeiling).toISOString();
}

/** Trả về journey đã bù, hoặc journey gốc nếu đã đủ sự kiện thật (>= MIN_REAL_EVENTS). */
export function ensureRichJourney(
  realJourney,
  userId,
  { createdAt, planExpiresAt, interviewUsed, cvUsed, lastSeenAt } = {},
) {
  const realEvents = realJourney?.events || [];
  if (realEvents.length >= MIN_REAL_EVENTS) return realJourney;

  const rand = mulberry32(hashSeed(userId));
  const now = Date.now();
  // Sự kiện giả không được mới hơn "lastSeenAt" thật (khối info "Trực tuyến ·
  // ...") — nếu không sẽ có cảnh vô lý: hoạt động trong Timeline có ngày mới hơn cả
  // lần cuối user được ghi nhận online. Có thể được NỚI RỘNG thêm bên dưới nếu cửa sổ
  // quá hẹp so với số phiên cần bù — effectiveLastSeenAt trả về để nơi gọi (khối
  // "Trực tuyến") hiển thị đúng con số đã nới, không lệch với Timeline.
  let activityCeiling = lastSeenAt ? Math.min(now, new Date(lastSeenAt).getTime()) : now;
  const signupAt = createdAt ? new Date(createdAt).getTime() : activityCeiling - 60 * DAY_MS;

  // Nếu tài khoản đã có sự kiện plan_upgrade THẬT, dùng đúng thời điểm đó thay vì
  // ước lượng từ planExpiresAt (vốn có thể lệch xa nếu gói đã gia hạn) — ước lượng
  // sai khiến purchasedAt tính ra muộn hơn cả hoạt động thật gần nhất, làm hỏng toàn
  // bộ cửa sổ thời gian bù ở bước sau.
  const realUpgradeEvent = realEvents.find((e) => e.type === "action" && e.action === "plan_upgrade");
  const hasRealUpgradeEvent = Boolean(realUpgradeEvent);
  const purchasedAt = hasRealUpgradeEvent
    ? new Date(realUpgradeEvent.createdAt).getTime()
    : estimatePurchasedAt(signupAt, planExpiresAt, activityCeiling);

  // Số phiên giả cần thêm = quota đã dùng (đã bù ở khối info) trừ số phiên thật đã
  // có trong sự kiện — để Timeline không lệch số với "CV đã dùng"/"Phỏng vấn AI" hiển
  // thị phía trên.
  const realInterviewCount = realEvents.filter((e) => e.type === "action" && e.action === "interview_complete").length;
  const realCvCount = realEvents.filter((e) => e.type === "action" && e.action === "cv_analyze_done").length;
  const interviewNeeded = Math.max(0, (Number(interviewUsed) || 0) - realInterviewCount);
  const cvNeeded = Math.max(0, (Number(cvUsed) || 0) - realCvCount);

  // Độ trễ trước sự kiện ĐẦU TIÊN sau khi mua chỉ vài phút-vài giờ (khách vừa nâng
  // cấp thường thử dùng ngay hôm đó).
  const firstPostDelayMs = 5 * 60000 + Math.floor(rand() * 6 * 60 * 60000); // 5 phút - ~6 giờ

  // Tài khoản vừa đăng ký/mua gói/offline gần như cùng lúc (cửa sổ vài phút) không đủ
  // chỗ chứa nổi dù chỉ 1 phiên phỏng vấn (tối thiểu ~3 phút) — nới "lastSeenAt hiệu
  // dụng" rộng thêm cho số phiên cần bù, kẹp không vượt quá hiện tại. Thà "trực
  // tuyến" trông muộn hơn thật một chút còn hơn quota > 0 mà Timeline trống trơn.
  //
  // TRẢI DÀI NHIỀU NGÀY thay vì tính vừa khít — nếu chỉ nới đủ tối thiểu, mọi phiên
  // bị dồn cục vào ~1 ngày (nhìn giả trân, "phân tích CV" 8 lần trong 1 buổi tối).
  // Mỗi đơn vị giả định cách nhau trung bình 1 khoảng ngẫu nhiên trong
  // [SESSION_GAP_FLOOR_MS, SESSION_GAP_MAX_MS] — seed theo userId nên mỗi tài khoản
  // một độ dài khác nhau (đúng yêu cầu), rồi buildPostPurchasePhase (adaptiveGapMs)
  // sẽ tự trải các phiên tương ứng ra hết cửa sổ vừa nới thay vì dồn lại gần nhau.
  activityCeiling = extendActivityCeiling({
    rand,
    now,
    purchasedAt,
    activityCeiling,
    firstPostDelayMs,
    interviewNeeded,
    cvNeeded,
  });

  const preEvents = buildPreDecisionPhase({ userId, rand, signupAt, purchasedAt });

  // Phiên phỏng vấn/CV ở đây được PHÉP mới hơn "hoạt động thật gần nhất theo tracking
  // sự kiện" (khác quy tắc chung) — vì chúng đại diện cho usage THẬT đã tính vào
  // quota (cvUsed/interviewUsed) nhưng hệ thống tracking không ghi lại lúc nào; khóa
  // cứng ở mốc cũ sẽ khiến quota > 0 mà Timeline không bao giờ chèn được phiên nào
  // (đúng lỗi đã gặp: "CV đã dùng 5" nhưng Timeline trống trơn vì cửa sổ = 0). Vẫn
  // không được vượt quá activityCeiling (đã tự nới rộng nếu cần ở trên).
  const postEvents = buildPostPurchasePhase({
    userId,
    rand,
    startAt: purchasedAt + firstPostDelayMs,
    endAt: activityCeiling,
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

  // Chặn trần lượt ghé của route gắn với quota (kể cả lượt ghé thật cộng vào) đúng
  // bằng số quota đã dùng hiển thị ở khối info — để "Lượt" luôn khớp mắt thường với
  // "CV đã dùng"/"Phỏng vấn AI", tránh lượt ghé thật lẻ tẻ (vd. vào rồi thoát không
  // tính quota) làm số liệu trông như lệch nhau.
  const capRouteVisits = (route, maxVisits) => {
    const cur = routeStats.get(route);
    if (!cur) return;
    const cap = Math.max(0, Number(maxVisits) || 0);
    if (cur.visits <= cap) return;
    if (cap === 0) {
      routeStats.delete(route);
      return;
    }
    const avgMs = cur.totalMs / cur.visits;
    routeStats.set(route, { visits: cap, totalMs: Math.round(avgMs * cap) });
  };
  capRouteVisits("/interview/room", interviewUsed);
  // "/cv-analysis" dùng chung cho cả phiên CV trả phí lẫn lượt dùng thử miễn phí
  // (buildFreeCvTrialSession, không có bước xem lịch sử) — nếu cộng riêng cvTrialCount
  // vào trần của "/cv-analysis" thì nó sẽ nhỉnh hơn "/cv-analysis/history" đúng bằng
  // cvTrialCount, nhìn lệch nhau. Chặn CẢ HAI cùng một mức (cvUsed) để 2 dòng luôn
  // khớp số — lượt dùng thử dư ra (nếu có) bị gộp vào trong mức đó, không hiển thị
  // tách riêng ở bảng tổng hợp (Timeline chi tiết bên dưới vẫn còn nguyên).
  capRouteVisits("/cv-analysis", cvUsed);
  capRouteVisits("/cv-analysis/history", cvUsed);

  // Không dùng route gắn quota ở đây — bị chặn trần phía trên rồi, thêm lại từ
  // fallback sẽ phá mất trần vừa set.
  const fallbackRoutes = ["/mentors", "/courses", "/dashboard", "/profile", "/pricing"];
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
    // Có thể đã nới rộng hơn lastSeenAt thật truyền vào (xem minSessionSpanMs ở
    // trên) — nơi gọi nên dùng giá trị này để hiển thị "Trực tuyến" khớp với Timeline.
    effectiveLastSeenAt: new Date(activityCeiling).toISOString(),
  };
}
