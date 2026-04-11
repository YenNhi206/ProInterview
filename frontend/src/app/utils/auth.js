/**
 * Auth: Express API + MongoDB (JWT).
 * Session: profile trong localStorage + Bearer token cho API.
 */

import { apiUrl } from "./api.js";

const AUTH_KEY = "prointerview_auth";
const TOKEN_KEY = "prointerview_access_token";

const jsonHeaders = {
  Accept: "application/json",
  "Content-Type": "application/json",
};

function bearerHeaders() {
  const t = getAccessToken();
  const h = { ...jsonHeaders };
  if (t) h.Authorization = `Bearer ${t}`;
  return h;
}

export async function registerUser(data) {
  try {
    const res = await fetch(apiUrl("/api/auth/register"), {
      method: "POST",
      headers: jsonHeaders,
      body: JSON.stringify({
        name: data.name,
        email: data.email,
        password: data.password,
        role: data.role ?? "customer",
      }),
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
      return {
        success: false,
        error: body.error || `Đăng nhập Google thất bại (${res.status}).`,
      };
    }
    if (body.success && body.token && body.user) {
      localStorage.setItem(TOKEN_KEY, body.token);
      setLoggedIn(body.user);
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
      return {
        success: false,
        error: body.error || "Email hoặc mật khẩu không đúng.",
      };
    }
    if (body.success && body.token && body.user) {
      localStorage.setItem(TOKEN_KEY, body.token);
      setLoggedIn(body.user);
      return { success: true };
    }
    return { success: false, error: body.error || "Đăng nhập thất bại." };
  } catch {
    return {
      success: false,
      error:
        "Không kết nối được backend. Hãy chạy `npm run dev` trong thư mục backend.",
    };
  }
}

export async function restoreSession() {
  const token = localStorage.getItem(TOKEN_KEY);
  if (!token) return false;
  try {
    const res = await fetch(apiUrl("/api/auth/me"), {
      headers: bearerHeaders(),
    });
    if (!res.ok) {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(AUTH_KEY);
      return false;
    }
    const body = await res.json();
    if (body.success && body.user) {
      setLoggedIn(body.user);
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

/** Lấy lại profile từ server (có `hasGoogleLogin`, …) — dùng khi localStorage cũ thiếu field. */
export async function refreshUserProfile() {
  const token = getAccessToken();
  if (!token) return null;
  try {
    const res = await fetch(apiUrl("/api/auth/me"), { headers: bearerHeaders() });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      if (res.status === 401) {
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem(AUTH_KEY);
      }
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

/** Token hợp lệ cho các API cần Bearer (kiểm tra nhanh qua /me). */
export async function getFreshAccessToken() {
  const token = getAccessToken();
  if (!token) return "";
  try {
    const res = await fetch(apiUrl("/api/auth/me"), {
      headers: { Accept: "application/json", Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      localStorage.removeItem(TOKEN_KEY);
      return "";
    }
    return token;
  } catch {
    return token;
  }
}

export async function updateUser(partial) {
  const token = getAccessToken();
  if (!token) return { success: false, error: "Chưa đăng nhập." };
  try {
    const res = await fetch(apiUrl("/api/auth/me"), {
      method: "PATCH",
      headers: { ...jsonHeaders, Authorization: `Bearer ${token}` },
      body: JSON.stringify(partial),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      console.log("updateUser:", body.error || res.status);
      return { success: false, error: body.error || `Lỗi ${res.status}` };
    }
    if (body.success && body.user) {
      setLoggedIn({ ...getUser(), ...body.user });
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
}

export function isLoggedIn() {
  return !!localStorage.getItem(AUTH_KEY);
}

export function getUser() {
  try {
    const raw = localStorage.getItem(AUTH_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function logout() {
  localStorage.removeItem(AUTH_KEY);
  localStorage.removeItem(TOKEN_KEY);
}

export function getInitials(name) {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/* ══════════════════════════════════════════════════════════
   PLAN SYSTEM — 3 tiers
══════════════════════════════════════════════════════════ */

const PLAN_KEY = "prointerview_plans";

export function getPlans() {
  const raw = localStorage.getItem(PLAN_KEY);
  if (!raw) return { starterPro: false, elitePro: false };
  try {
    const parsed = JSON.parse(raw);
    if ("voicePro" in parsed || "cvPro" in parsed) {
      const migrated = {
        starterPro: !!(parsed.voicePro || parsed.cvPro || parsed.textPro),
        elitePro: !!(parsed.voicePro && parsed.cvPro),
      };
      localStorage.setItem(PLAN_KEY, JSON.stringify(migrated));
      return migrated;
    }
    return { starterPro: false, elitePro: false, ...parsed };
  } catch {
    return { starterPro: false, elitePro: false };
  }
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
export const CV_FREE_LIMIT = 3;
export const CV_STARTER_LIMIT = 20;

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
  if (plans.elitePro) return Infinity;
  if (plans.starterPro) return Math.max(0, CV_STARTER_LIMIT - getCVAnalysisCount());
  return Math.max(0, CV_FREE_LIMIT - getCVAnalysisCount());
}
