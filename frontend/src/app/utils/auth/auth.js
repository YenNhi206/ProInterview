/**
 * Auth: Express API + MongoDB (JWT access + refresh).
 * Session: profile trong localStorage + Bearer access token; refresh token lưu riêng.
 */

import { apiUrl } from "../../api/http.js";
import {
  PLAN_STORAGE_KEY,
  apiPlanToLocalFlags,
  migrateLegacyPlanFlags,
  resolvePlansFromStorageAndUser,
} from "../plans/planSync.js";

export { apiPlanToLocalFlags } from "../plans/planSync.js";

const AUTH_KEY = "prointerview_auth";
const TOKEN_KEY = "prointerview_access_token";
const REFRESH_KEY = "prointerview_refresh_token";

/** Tab / component đồng bộ sau login, logout, refresh token. */
export const AUTH_CHANGED_EVENT = "prointerview-auth-changed";

function notifyAuthChanged() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(AUTH_CHANGED_EVENT));
  }
}

const jsonHeaders = {
  Accept: "application/json",
  "Content-Type": "application/json",
};

/** Lấy message lỗi từ response API (kể cả body không chuẩn). */
function parseApiErrorBody(body) {
  if (!body || typeof body !== "object") return "";
  if (typeof body.error === "string" && body.error.trim()) return body.error.trim();
  if (typeof body.message === "string" && body.message.trim()) return body.message.trim();
  if (body.message && typeof body.message === "object" && typeof body.message.error === "string") {
    return body.message.error.trim();
  }
  return "";
}

function mapAuthHttpError(status, context = "auth") {
  if (status === 403) {
    return context === "google"
      ? "Không gọi được API đăng nhập (403). Dev: khởi động backend cổng 5000 và kiểm tra Vite proxy (vite.config.js → localhost:5000)."
      : "Không có quyền truy cập (403).";
  }
  if (status === 401) {
    return context === "google"
      ? "Không xác thực được Google. Kiểm tra GOOGLE_CLIENT_ID khớp giữa frontend và backend."
      : "Email hoặc mật khẩu không đúng.";
  }
  if (status === 409) return "Email này đã được đăng ký hoặc liên kết tài khoản khác.";
  if (status === 429) return "Quá nhiều lần thử. Bạn đợi vài phút rồi thử lại nhé.";
  if (status === 503) return "Dịch vụ tạm chưa sẵn sàng. Kiểm tra backend đang chạy và biến môi trường.";
  if (status >= 500) {
    return "Backend chưa chạy hoặc đang lỗi. Trong thư mục backend chạy `npm install` rồi `npm run dev` (cổng 5000), sau đó thử lại.";
  }
  return "";
}

function bearerHeaders() {
  const t = getAccessToken();
  const h = { ...jsonHeaders };
  if (t) h.Authorization = `Bearer ${t}`;
  return h;
}

export function getRefreshToken() {
  return localStorage.getItem(REFRESH_KEY) ?? "";
}

function setRefreshToken(value) {
  if (value) localStorage.setItem(REFRESH_KEY, value);
  else localStorage.removeItem(REFRESH_KEY);
}

function persistLoginPayload(body) {
  if (body.token) localStorage.setItem(TOKEN_KEY, body.token);
  if (body.refreshToken) setRefreshToken(body.refreshToken);
  if (body.user) setLoggedIn(body.user);
  else if (body.token || body.refreshToken) notifyAuthChanged();
}

function clearAuthStorage() {
  localStorage.removeItem(AUTH_KEY);
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(REFRESH_KEY);
  notifyAuthChanged();
}

/**
 * Gọi POST /api/auth/refresh — trả true nếu đã có access token mới.
 */
export async function tryRefreshAccessToken() {
  const rt = getRefreshToken();
  if (!rt) return false;
  try {
    const access = getAccessToken();
    const headers = { ...jsonHeaders };
    if (access) headers.Authorization = `Bearer ${access}`;
    const res = await fetch(apiUrl("/api/auth/refresh"), {
      method: "POST",
      headers,
      body: JSON.stringify({ refreshToken: rt }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok || !body.success || !body.token) {
      if (res.status === 401 || res.status === 403) {
        clearAuthStorage();
      }
      return false;
    }
    persistLoginPayload(body);
    return true;
  } catch {
    return false;
  }
}

/** Lỗi tạm thời (backend restart, rate limit) — giữ phiên local, không đăng xuất. */
function isTransientAuthStatus(status) {
  return status === 429 || status === 503 || status >= 500;
}

/**
 * Fetch có Bearer; nếu chưa có access nhưng còn refresh thì làm mới trước.
 * 401 một lần → thử refresh rồi gọi lại (một vòng).
 */
export async function authFetch(path, init = {}) {
  let access = getAccessToken();
  if (!access && getRefreshToken()) {
    await tryRefreshAccessToken();
    access = getAccessToken();
  }

  const run = async (token) => {
    const headers = new Headers(init.headers);
    if (!headers.has("Accept")) headers.set("Accept", "application/json");
    if (token) headers.set("Authorization", `Bearer ${token}`);
    return fetch(apiUrl(path), { ...init, headers });
  };

  let res = await run(access);
  if (res.status === 401 && getRefreshToken()) {
    const ok = await tryRefreshAccessToken();
    if (ok) res = await run(getAccessToken());
  }
  const pathOnly = typeof path === "string" ? path.split("?")[0] : "";
  if (res.status === 401) {
    clearAuthStorage();
  } else if (res.status === 403 && pathOnly.startsWith("/api/auth")) {
    clearAuthStorage();
  }
  return res;
}

const AUTH_ONLY_PATHS = ["/login", "/register", "/forgot-password", "/reset-password", "/verify-email"];

/** `?redirect=` hợp lệ — không trỏ trang auth; /admin chỉ admin; /mentor/* chỉ mentor. */
export function isSafeAppRedirect(path, user) {
  const r = typeof path === "string" ? path.trim() : "";
  if (!r.startsWith("/") || r.startsWith("//")) return false;
  if (AUTH_ONLY_PATHS.some((b) => r === b || r.startsWith(`${b}?`) || r.startsWith(`${b}/`))) {
    return false;
  }
  if (r.startsWith("/admin") && user?.role !== "admin") return false;
  if (r.startsWith("/mentor") && user?.role !== "mentor") return false;
  return true;
}

/** Trang chủ customer (không dùng /dashboard). */
export const CUSTOMER_HOME_PATH = "/";

/** URL cũ /dashboard → trang chủ customer. */
export function resolveLegacyCustomerPath(path) {
  const p = typeof path === "string" ? path.trim() : "";
  if (p === "/dashboard" || p.startsWith("/dashboard/")) return CUSTOMER_HOME_PATH;
  return p;
}

/** Hub customer — admin/mentor không dùng làm đích sau login. */
function isCustomerHubRedirect(path) {
  const r = typeof path === "string" ? path.trim() : "";
  if (!r) return true;
  return r === "/" || r === "/dashboard" || r.startsWith("/dashboard/");
}

/** Mentor sau login chỉ giữ redirect thuộc khu mentor hoặc phòng họp. */
function isMentorPostLoginRedirect(path) {
  const r = typeof path === "string" ? path.trim() : "";
  return r.startsWith("/mentor") || r.startsWith("/meeting/");
}

/** Đường dẫn sau đăng nhập: admin → /admin, mentor → /mentor/dashboard, customer → ?redirect hoặc /. */
export function getPostLoginPath(user, redirectParam) {
  const r = typeof redirectParam === "string" ? redirectParam.trim() : "";
  const role = user?.role;

  if (role === "admin") {
    if (r && isSafeAppRedirect(r, user) && !isCustomerHubRedirect(r)) return r;
    return "/admin";
  }
  if (role === "mentor") {
    if (r && isSafeAppRedirect(r, user) && isMentorPostLoginRedirect(r)) return r;
    return "/mentor/dashboard";
  }

  if (isSafeAppRedirect(r, user)) return resolveLegacyCustomerPath(r);
  return CUSTOMER_HOME_PATH;
}

/** Logo / thương hiệu app: đã đăng nhập → hub theo role; chưa → trang chủ. */
export function getBrandClickPath() {
  if (!isLoggedIn()) return "/";
  const u = getUser();
  if (!u) return "/";
  return getPostLoginPath(u, "");
}

export async function registerUser(data) {
  try {
    const payload = {
      name: data.name,
      email: data.email,
      password: data.password,
      role: data.role ?? "customer",
    };
    if (data.role === "admin" && data.adminInviteCode) {
      payload.adminInviteCode = data.adminInviteCode;
    }
    const res = await fetch(apiUrl("/api/auth/register"), {
      method: "POST",
      headers: jsonHeaders,
      body: JSON.stringify(payload),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      return {
        success: false,
        error: body.error || `Đăng ký thất bại (${res.status})`,
      };
    }
    if (body.success) return { success: true };
    return { success: false, error: body.error || "Đăng ký thất bại." };
  } catch {
    return {
      success: false,
      error:
        "Không kết nối được backend. Hãy chạy `npm run dev` trong thư mục backend và kiểm tra VITE_API_URL.",
    };
  }
}

export async function loginWithGoogleCredential(credential) {
  try {
    const res = await fetch(apiUrl("/api/auth/google"), {
      method: "POST",
      headers: jsonHeaders,
      body: JSON.stringify({ credential }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      const apiError = parseApiErrorBody(body);
      return {
        success: false,
        error:
          apiError ||
          mapAuthHttpError(res.status, "google") ||
          `Đăng nhập Google thất bại (${res.status}).`,
      };
    }
    if (body.success && body.token && body.user) {
      persistLoginPayload(body);
      return { success: true };
    }
    return { success: false, error: body.error || "Đăng nhập Google thất bại." };
  } catch {
    return {
      success: false,
      error:
        "Không kết nối được backend. Hãy chạy backend và kiểm tra VITE_API_URL.",
    };
  }
}

export async function loginUser(email, password) {
  try {
    const res = await fetch(apiUrl("/api/auth/login"), {
      method: "POST",
      headers: jsonHeaders,
      body: JSON.stringify({ email, password }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      const apiError = parseApiErrorBody(body);
      return {
        success: false,
        error:
          apiError ||
          mapAuthHttpError(res.status, "login") ||
          "Email hoặc mật khẩu không đúng.",
      };
    }
    if (body.success && body.token && body.user) {
      persistLoginPayload(body);
      return { success: true };
    }
    return { success: false, error: parseApiErrorBody(body) || "Đăng nhập thất bại." };
  } catch {
    return {
      success: false,
      error:
        "Không kết nối được backend. Hãy chạy `npm run dev` trong thư mục backend.",
    };
  }
}

export async function requestPasswordReset(email) {
  try {
    const res = await fetch(apiUrl("/api/auth/forgot-password"), {
      method: "POST",
      headers: jsonHeaders,
      body: JSON.stringify({ email }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      return { success: false, error: body.error || `Không thể gửi yêu cầu (${res.status}).` };
    }
    return { success: true, resetUrl: body.resetUrl, resetToken: body.resetToken };
  } catch {
    return {
      success: false,
      error: "Không kết nối được backend. Hãy chạy `npm run dev` trong thư mục backend.",
    };
  }
}

export async function resetPassword(token, password) {
  try {
    const res = await fetch(apiUrl("/api/auth/reset-password"), {
      method: "POST",
      headers: jsonHeaders,
      body: JSON.stringify({ token, password }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      return { success: false, error: body.error || `Đặt lại mật khẩu thất bại (${res.status}).` };
    }
    if (body.success) return { success: true };
    return { success: false, error: body.error || "Đặt lại mật khẩu thất bại." };
  } catch {
    return {
      success: false,
      error: "Không kết nối được backend. Hãy chạy backend và thử lại.",
    };
  }
}

export async function verifyEmail(token) {
  try {
    const res = await fetch(apiUrl(`/api/auth/verify-email?token=${encodeURIComponent(token)}`), {
      method: "GET",
      headers: jsonHeaders,
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      return { success: false, error: body.error || `Xác thực thất bại (${res.status}).` };
    }
    return { success: true, message: body.message };
  } catch {
    return { success: false, error: "Không kết nối được backend." };
  }
}

export async function resendVerification(email) {
  try {
    const res = await fetch(apiUrl("/api/auth/resend-verification"), {
      method: "POST",
      headers: jsonHeaders,
      body: JSON.stringify({ email }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      return { success: false, error: body.error || `Gửi lại thất bại (${res.status}).` };
    }
    return { success: true, message: body.message, verifyToken: body.verifyToken };
  } catch {
    return { success: false, error: "Không kết nối được backend." };
  }
}

export async function restoreSession() {
  if (!hasAuthCredentials()) return false;

  const cachedUser = getUser();

  const finishMe = async (res) => {
    if (res.ok) {
      const body = await res.json();
      if (body.success && body.user) {
        setLoggedIn(body.user);
        return true;
      }
    }
    if (isTransientAuthStatus(res.status) && cachedUser && hasAuthCredentials()) {
      setLoggedIn(cachedUser);
      return true;
    }
    if (res.status === 401 || res.status === 403) return false;
    return null;
  };

  const tryMe = async () => {
    const res = await fetch(apiUrl("/api/auth/me"), { headers: bearerHeaders() });
    return finishMe(res);
  };

  if (getAccessToken()) {
    try {
      const ok = await tryMe();
      if (ok === true) return true;
      if (ok === false) {
        clearAuthStorage();
        return false;
      }
    } catch {
      if (cachedUser && hasAuthCredentials()) {
        setLoggedIn(cachedUser);
        return true;
      }
    }
  }

  if (await tryRefreshAccessToken()) {
    try {
      const ok = await tryMe();
      if (ok === true) return true;
      if (ok === false) {
        clearAuthStorage();
        return false;
      }
    } catch {
      if (cachedUser && hasAuthCredentials()) {
        setLoggedIn(cachedUser);
        return true;
      }
    }
  }

  if (cachedUser && hasAuthCredentials()) {
    setLoggedIn(cachedUser);
    return true;
  }

  clearAuthStorage();
  return false;
}

/** Lấy lại profile từ server (có `hasGoogleLogin`, …) — dùng khi localStorage cũ thiếu field. */
export async function refreshUserProfile() {
  if (!getAccessToken() && !getRefreshToken()) return null;
  try {
    const res = await authFetch("/api/auth/me", { headers: { Accept: "application/json" } });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      if (res.status === 401) clearAuthStorage();
      return null;
    }
    if (body.success && body.user) {
      setLoggedIn(body.user);
      return body.user;
    }
    return null;
  } catch {
    return null;
  }
}

export function getAccessToken() {
  return localStorage.getItem(TOKEN_KEY) ?? "";
}

/** Còn access hoặc refresh để gọi API (có thể làm mới access). */
export function hasAuthCredentials() {
  return !!(getAccessToken() || getRefreshToken());
}

/** Route cần JWT — đồng bộ logout giữa các tab trình duyệt. */
export function isProtectedAppPath(pathname) {
  const raw = String(pathname || "");
  const p = raw.split("?")[0];
  if (!p || p === "/") return false;
  if (p === "/checkout") return true;
  if (p.startsWith("/meeting/")) return true;
  if (/^\/courses\/[^/]+\/learn$/.test(p)) return true;
  if (p.startsWith("/cv-analysis/")) return true;
  if (p === "/mentors" || p.startsWith("/mentors/")) return false;
  if (p === "/courses" || /^\/courses\/[^/]+$/.test(p)) return false;
  if (p.startsWith("/admin")) return true;
  if (p === "/mentor" || p.startsWith("/mentor/")) return true;
  if (p === "/interview") return false;
  if (p.startsWith("/interview/")) return true;
  const roots = [
    "/dashboard",
    "/profile",
    "/settings",
    "/my-bookings",
    "/my-courses",
    "/cv-analysis",
    "/booking",
  ];
  if (roots.some((root) => p === root || p.startsWith(`${root}/`))) return true;
  if (p.startsWith("/session/") || p.startsWith("/review/")) return true;
  return false;
}

/**
 * Token còn dùng được cho API: thử /me; hết hạn thì refresh (opaque refresh).
 */
export async function getFreshAccessToken() {
  if (!getAccessToken() && !getRefreshToken()) return "";
  try {
    const res = await authFetch("/api/auth/me", {
      headers: { Accept: "application/json" },
    });
    if (!res.ok) {
      clearAuthStorage();
      return "";
    }
    return getAccessToken();
  } catch {
    return getAccessToken();
  }
}

export async function updateUser(partial) {
  if (!getAccessToken() && !getRefreshToken()) {
    return { success: false, error: "Chưa đăng nhập." };
  }
  try {
    const res = await authFetch("/api/auth/me", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(partial),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      console.log("updateUser:", body.error || res.status);
      return { success: false, error: body.error || `Lỗi ${res.status}` };
    }
    if (body.success && body.user) {
      setLoggedIn({ ...getUser(), ...body.user });
      persistLoginPayload(body);
      return { success: true };
    }
    return { success: false, error: body.error || "Cập nhật thất bại." };
  } catch (e) {
    console.log("updateUser error:", e);
    return { success: false, error: "Không kết nối được server." };
  }
}

export function setLoggedIn(user) {
  localStorage.setItem(AUTH_KEY, JSON.stringify(user));
  syncPlansFromUser(user);
  notifyAuthChanged();
}

export function isLoggedIn() {
  return hasAuthCredentials();
}

export function getUser() {
  try {
    const raw = localStorage.getItem(AUTH_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

/**
 * Đăng xuất: server vô hiệu access (tokenVersion) + xóa refresh sessions; rồi xóa local.
 * Nếu access hết hạn nhưng còn refresh → refresh hoặc gửi refreshToken cho server.
 */
export async function logout() {
  let token = getAccessToken();
  if (!token && getRefreshToken()) {
    await tryRefreshAccessToken();
    token = getAccessToken();
  }
  const refreshToken = getRefreshToken();
  try {
    if (token) {
      await fetch(apiUrl("/api/auth/logout"), {
        method: "POST",
        headers: { ...jsonHeaders, Authorization: `Bearer ${token}` },
      });
    } else if (refreshToken) {
      await fetch(apiUrl("/api/auth/logout"), {
        method: "POST",
        headers: jsonHeaders,
        body: JSON.stringify({ refreshToken }),
      });
    }
  } catch {
    /* vẫn xóa local */
  }
  clearAuthStorage();
}

/** ObjectId phiên refresh hiện tại (phần trước dấu `:` trong refresh token). */
export function getCurrentAuthSessionId() {
  const rt = getRefreshToken();
  const idx = rt.indexOf(":");
  if (idx <= 0) return "";
  return rt.slice(0, idx);
}

export async function fetchAuthSessions() {
  if (!hasAuthCredentials()) {
    return { success: false, error: "Chưa đăng nhập.", sessions: [], security: null };
  }
  try {
    const currentSessionId = getCurrentAuthSessionId();
    const q = currentSessionId
      ? `?currentSessionId=${encodeURIComponent(currentSessionId)}`
      : "";
    const res = await authFetch(`/api/auth/sessions${q}`, {
      method: "GET",
      headers: { Accept: "application/json" },
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      return {
        success: false,
        error: body.error || `Lỗi ${res.status}`,
        sessions: [],
        security: null,
      };
    }
    return {
      success: true,
      sessions: body.sessions || [],
      security: body.security || null,
    };
  } catch {
    return { success: false, error: "Không kết nối được server.", sessions: [], security: null };
  }
}

export async function revokeAuthSession(sessionId) {
  if (!hasAuthCredentials()) {
    return { success: false, error: "Chưa đăng nhập." };
  }
  const id = String(sessionId || "").trim();
  if (!id) return { success: false, error: "Thiếu mã phiên." };
  try {
    const res = await authFetch(`/api/auth/sessions/${encodeURIComponent(id)}`, {
      method: "DELETE",
      headers: { Accept: "application/json" },
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      return { success: false, error: body.error || `Lỗi ${res.status}` };
    }
    if (id === getCurrentAuthSessionId()) {
      clearAuthStorage();
    }
    return { success: true };
  } catch {
    return { success: false, error: "Không kết nối được server." };
  }
}

/** Xóa tài khoản vĩnh viễn trên server; luôn xóa auth local sau khi thành công. */
export async function deleteAccount() {
  if (!hasAuthCredentials()) {
    return { success: false, error: "Chưa đăng nhập." };
  }
  try {
    const res = await authFetch("/api/auth/me", {
      method: "DELETE",
      headers: { Accept: "application/json" },
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      return { success: false, error: body.error || `Lỗi ${res.status}` };
    }
    clearAuthStorage();
    return { success: true, message: body.message || "Đã xóa tài khoản." };
  } catch {
    return { success: false, error: "Không kết nối được server." };
  }
}

export function getInitials(name) {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function looksLikeEmail(value) {
  if (typeof value !== "string") return false;
  const s = value.trim();
  if (!s.includes("@")) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
}

function titleCaseFromLocalEmailPart(local) {
  const cleaned = String(local || "")
    .replace(/[._+-]+/g, " ")
    .replace(/\d+/g, (d) => ` ${d} `)
    .trim();
  if (!cleaned) return "";
  return cleaned
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}

/**
 * Họ tên hiển thị: ưu tiên `name` khi không phải / không trùng email.
 * Tránh hiển thị cả địa chỉ email thay cho tên người dùng.
 */
export function getDisplayName(user, fallback = "Người dùng") {
  if (!user) return fallback;
  const email = (user.email || "").trim().toLowerCase();
  const rawName = (user.name || "").trim();

  if (rawName && !looksLikeEmail(rawName) && rawName.toLowerCase() !== email) {
    return rawName;
  }

  if (email.includes("@")) {
    const nice = titleCaseFromLocalEmailPart(email.split("@")[0]);
    if (nice) return nice;
  }

  if (rawName && !looksLikeEmail(rawName)) return rawName;
  return fallback;
}

/** Từ đầu tiên của tên hiển thị (lời chào ngắn). */
export function getDisplayFirstName(user, fallback = "bạn") {
  const full = getDisplayName(user, fallback);
  const parts = full.trim().split(/\s+/).filter(Boolean);
  return parts[0] || fallback;
}

/* ══════════════════════════════════════════════════════════
   PLAN SYSTEM — 3 tiers
══════════════════════════════════════════════════════════ */

const PLAN_KEY = PLAN_STORAGE_KEY;
export const PLANS_CHANGED_EVENT = "prointerview-plans-changed";

/** Đồng bộ localStorage từ user.plan (sau login /me / admin duyệt CK). */
export function syncPlansFromUser(user) {
  if (!user?.plan) return;
  const flags = apiPlanToLocalFlags(user.plan);
  localStorage.setItem(PLAN_KEY, JSON.stringify(flags));
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(PLANS_CHANGED_EVENT));
  }
}

export function getPlans() {
  const raw = localStorage.getItem(PLAN_KEY);
  let stored = { starterPro: false, elitePro: false };
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      stored = migrateLegacyPlanFlags(parsed);
      if ("voicePro" in parsed || "cvPro" in parsed) {
        localStorage.setItem(PLAN_KEY, JSON.stringify(stored));
      }
    } catch {
      stored = { starterPro: false, elitePro: false };
    }
  }
  const u = getUser();
  const resolved = resolvePlansFromStorageAndUser(stored, u?.plan);
  if (resolved !== stored) {
    localStorage.setItem(PLAN_KEY, JSON.stringify(resolved));
  }
  return resolved;
}

export function setPlan(plan, value = true) {
  const plans = getPlans();
  plans[plan] = value;
  localStorage.setItem(PLAN_KEY, JSON.stringify(plans));
}

export function setActivePlan(plan) {
  const fresh = { starterPro: false, elitePro: false };
  if (plan === "elitePro") {
    fresh.starterPro = true;
    fresh.elitePro = true;
  } else {
    fresh.starterPro = true;
    fresh.elitePro = false;
  }
  localStorage.setItem(PLAN_KEY, JSON.stringify(fresh));
}

export function activateAllPlans() {
  const all = { starterPro: true, elitePro: true };
  localStorage.setItem(PLAN_KEY, JSON.stringify(all));
}

const CV_COUNT_KEY = "prointerview_cv_count";
export const CV_FREE_LIMIT = 5;
export const CV_STARTER_LIMIT = 20;
export const CV_ELITE_LIMIT = 40;

export function getCVAnalysisCount() {
  return parseInt(localStorage.getItem(CV_COUNT_KEY) || "0", 10);
}

export function incrementCVCount() {
  const next = getCVAnalysisCount() + 1;
  localStorage.setItem(CV_COUNT_KEY, next.toString());
  return next;
}

export function getCVRemaining() {
  const plans = getPlans();
  if (plans.elitePro) return Math.max(0, CV_ELITE_LIMIT - getCVAnalysisCount());
  if (plans.starterPro) return Math.max(0, CV_STARTER_LIMIT - getCVAnalysisCount());
  return Math.max(0, CV_FREE_LIMIT - getCVAnalysisCount());
}
