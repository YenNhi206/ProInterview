/**
 * Khóa cài đặt thông báo theo role — đồng bộ với frontend `utils/account/notificationPrefsConfig.js`.
 *
 * Mỗi role có một nhánh riêng trong `User.settings.notificationPrefs` (`customer`, `mentor`, `moderator`,
 * `company`, `admin`). Chỉ liệt kê loại thông báo role đó thực sự nhận; thêm thông báo mới cho role nào thì
 * thêm khóa vào đây, vào cấu hình FE, rồi truyền `<role>PrefKey` khi gọi `deliverNotification`.
 */

export const MENTOR_NOTIFICATION_PREF_KEYS = [
  "booking_request",
  "session_reminder",
  "mentee_review",
  "booking_change",
  "payout_update",
  "peer_review_course",
];

export const CUSTOMER_NOTIFICATION_PREF_KEYS = [
  "booking_confirmed",
  "interview_reminder",
  "booking_cancelled",
  "mentor_feedback",
  "streak_reminder",
  "plan_expiring",
];

/** Platform Moderator: đề xuất cải tiến AI do job miner tạo (AI-03). */
export const MODERATOR_NOTIFICATION_PREF_KEYS = ["ai_improvement_proposed"];

/** Company Moderator: đơn ứng tuyển mới, ứng viên rút đơn, tin bị ẩn / hiển thị lại. */
export const COMPANY_NOTIFICATION_PREF_KEYS = [
  "application_submitted",
  "application_withdrawn",
  "job_post_visibility",
];

/** Admin: hồ sơ mentor chờ duyệt, yêu cầu rút tiền, buổi hẹn đã trả tiền quá giờ chưa có kết quả. */
export const ADMIN_NOTIFICATION_PREF_KEYS = ["mentor_application_submitted", "payout_requested", "booking_stale"];

/** role → { slice: tên nhánh trong notificationPrefs, keys, payloadKey: field trong payload deliverNotification } */
const ROLE_PREF_CONFIG = {
  customer: { slice: "customer", keys: CUSTOMER_NOTIFICATION_PREF_KEYS, payloadKey: "customerPrefKey" },
  mentor: { slice: "mentor", keys: MENTOR_NOTIFICATION_PREF_KEYS, payloadKey: "mentorPrefKey" },
  moderator: { slice: "moderator", keys: MODERATOR_NOTIFICATION_PREF_KEYS, payloadKey: "moderatorPrefKey" },
  company_moderator: { slice: "company", keys: COMPANY_NOTIFICATION_PREF_KEYS, payloadKey: "companyPrefKey" },
  admin: { slice: "admin", keys: ADMIN_NOTIFICATION_PREF_KEYS, payloadKey: "adminPrefKey" },
};

function allOn(keys) {
  return Object.fromEntries(keys.map((k) => [k, true]));
}

export const DEFAULT_MENTOR_NOTIFICATION_PREFS = allOn(MENTOR_NOTIFICATION_PREF_KEYS);
export const DEFAULT_CUSTOMER_NOTIFICATION_PREFS = allOn(CUSTOMER_NOTIFICATION_PREF_KEYS);

/** Role lạ (vd. `enterprise` chưa migrate) dùng cấu hình gần nhất; mặc định như customer. */
export function notificationPrefConfigForRole(role) {
  if (role === "enterprise") return ROLE_PREF_CONFIG.company_moderator;
  return ROLE_PREF_CONFIG[role] ?? ROLE_PREF_CONFIG.customer;
}

function pickBoolMap(source, allowedKeys) {
  if (!source || typeof source !== "object") return {};
  const out = {};
  for (const key of allowedKeys) {
    if (typeof source[key] === "boolean") out[key] = source[key];
  }
  return out;
}

export function mergeNotificationPrefs(role, stored) {
  const { slice, keys } = notificationPrefConfigForRole(role);
  return { ...allOn(keys), ...pickBoolMap(stored?.[slice], keys) };
}

/** Khóa cài đặt áp dụng cho một payload `deliverNotification` theo role người nhận (undefined = luôn gửi). */
export function notificationPrefKeyForRole(role, payload) {
  return payload?.[notificationPrefConfigForRole(role).payloadKey];
}

/** Payload cho GET /me — chỉ nhánh đúng role */
export function publicNotificationPrefsForRole(role, stored) {
  const { slice } = notificationPrefConfigForRole(role);
  return { [slice]: mergeNotificationPrefs(role, stored) };
}

/**
 * PATCH /me body.notificationPrefs — `{ <nhánh của role>: {...} }`. Nhánh của role khác bị bỏ qua.
 */
export function sanitizeNotificationPrefsPatch(role, body) {
  if (!body || typeof body !== "object") return null;
  const { slice, keys } = notificationPrefConfigForRole(role);
  if (!body[slice] || typeof body[slice] !== "object") return null;
  return { [slice]: pickBoolMap(body[slice], keys) };
}
