import { authFetch, hasAuthCredentials } from "../auth/auth.js";

const SESSION_KEY = "prointerview_analytics_session";
const MIN_FLUSH_MS = 800;
const SKIP_ROUTE_PREFIXES = ["/admin"];

let pending = [];
let flushTimer = null;
/** Sau lỗi mạng (vd. ad-block chặn URL có "analytics"), bỏ queue — tránh spam console. */
let analyticsPaused = false;

function isBlockedAnalyticsError(err) {
  const msg = String(err?.message || err || "").toLowerCase();
  return (
    err?.name === "TypeError" ||
    msg.includes("failed to fetch") ||
    msg.includes("networkerror") ||
    msg.includes("blocked")
  );
}

function getClientSessionId() {
  try {
    let id = sessionStorage.getItem(SESSION_KEY);
    if (!id) {
      id = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
      sessionStorage.setItem(SESSION_KEY, id);
    }
    return id;
  } catch {
    return "";
  }
}

function shouldTrackRoute(route) {
  const path = String(route || "");
  if (!path || path === "/login" || path === "/register") return false;
  return !SKIP_ROUTE_PREFIXES.some((p) => path === p || path.startsWith(`${p}/`));
}

function scheduleFlush() {
  if (flushTimer) return;
  flushTimer = window.setTimeout(() => {
    flushTimer = null;
    void flushAnalytics();
  }, MIN_FLUSH_MS);
}

export function queueAnalyticsEvent(event) {
  if (analyticsPaused || !hasAuthCredentials()) return;
  if (!event?.route || !shouldTrackRoute(event.route)) return;

  pending.push({
    ...event,
    clientSessionId: getClientSessionId(),
  });
  scheduleFlush();
}

export async function flushAnalytics() {
  if (analyticsPaused || !hasAuthCredentials() || pending.length === 0) return;
  const batch = pending.splice(0, 30);
  try {
    const res = await authFetch("/api/analytics/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ events: batch }),
    });
    if (!res.ok) {
      // Server từ chối — bỏ batch (analytics best-effort, không retry vô hạn)
      return;
    }
  } catch (err) {
    if (isBlockedAnalyticsError(err)) {
      analyticsPaused = true;
      pending.length = 0;
    }
    // Offline / lỗi mạng khác: bỏ batch, không re-queue (tránh lặp lỗi console)
  }
}

/** Ghi nhận hành động quan trọng (ngoài page view). */
export function trackAction(action, route, metadata = {}) {
  queueAnalyticsEvent({
    type: "action",
    route: route || window.location.pathname || "/",
    action,
    metadata,
    durationMs: 0,
  });
}

export function trackPageView(route, durationMs) {
  queueAnalyticsEvent({
    type: "page_view",
    route,
    durationMs: Math.max(0, Math.round(durationMs)),
    action: "",
    metadata: {},
  });
}

export { shouldTrackRoute };
