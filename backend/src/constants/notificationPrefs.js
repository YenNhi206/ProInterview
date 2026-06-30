/** Khóa cài đặt thông báo — đồng bộ với frontend Settings.jsx */

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

export const DEFAULT_MENTOR_NOTIFICATION_PREFS = Object.fromEntries(
  MENTOR_NOTIFICATION_PREF_KEYS.map((k) => [k, true]),
);

export const DEFAULT_CUSTOMER_NOTIFICATION_PREFS = Object.fromEntries(
  CUSTOMER_NOTIFICATION_PREF_KEYS.map((k) => [k, true]),
);

function pickBoolMap(source, allowedKeys) {
  if (!source || typeof source !== "object") return {};
  const out = {};
  for (const key of allowedKeys) {
    if (typeof source[key] === "boolean") out[key] = source[key];
  }
  return out;
}

export function mergeNotificationPrefs(role, stored) {
  const isMentor = role === "mentor";
  const defaults = isMentor
    ? DEFAULT_MENTOR_NOTIFICATION_PREFS
    : DEFAULT_CUSTOMER_NOTIFICATION_PREFS;
  const keys = isMentor ? MENTOR_NOTIFICATION_PREF_KEYS : CUSTOMER_NOTIFICATION_PREF_KEYS;
  const slice = isMentor ? stored?.mentor : stored?.customer;
  return { ...defaults, ...pickBoolMap(slice, keys) };
}

/** Payload cho GET /me — chỉ nhánh đúng role */
export function publicNotificationPrefsForRole(role, stored) {
  const merged = mergeNotificationPrefs(role, stored);
  if (role === "mentor") return { mentor: merged };
  return { customer: merged };
}

/**
 * PATCH /me body.notificationPrefs — { mentor: {...} } hoặc { customer: {...} }
 */
export function sanitizeNotificationPrefsPatch(role, body) {
  if (!body || typeof body !== "object") return null;
  const out = {};
  if (role === "mentor" && body.mentor && typeof body.mentor === "object") {
    out.mentor = pickBoolMap(body.mentor, MENTOR_NOTIFICATION_PREF_KEYS);
  }
  if (role === "customer" && body.customer && typeof body.customer === "object") {
    out.customer = pickBoolMap(body.customer, CUSTOMER_NOTIFICATION_PREF_KEYS);
  }
  if (role === "admin") {
    if (body.mentor) out.mentor = pickBoolMap(body.mentor, MENTOR_NOTIFICATION_PREF_KEYS);
    if (body.customer) out.customer = pickBoolMap(body.customer, CUSTOMER_NOTIFICATION_PREF_KEYS);
  }
  if (!Object.keys(out).length) return null;
  return out;
}
