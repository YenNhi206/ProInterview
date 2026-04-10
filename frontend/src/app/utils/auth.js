/**
 * Auth for ProInterview MVP
 * – Real users: Supabase Auth (signup via server, login via supabase-js)
 * – Demo users: still use setLoggedIn() directly (no Supabase call)
 * – Session: mirrored to localStorage so the rest of the app can stay sync
 *
 * Plans — 3 tiers:
 *  Free   → { starterPro: false, elitePro: false }
 *  Pro    → { starterPro: true,  elitePro: false }
 *  Elite  → { starterPro: true,  elitePro: true  }
 */

import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { projectId, publicAnonKey } from "/utils/supabase/info.js";

/* ── Supabase singleton ─────────────────────────────────────
   Stored on globalThis so Vite HMR module re-evaluations never
   create a second GoTrueClient on the same storage key.
─────────────────────────────────────────────────────────── */
const SUPABASE_GLOBAL_KEY = "__prointerview_supabase_client__";

export function getSupabaseClient() {
  const g = globalThis;
  if (!g[SUPABASE_GLOBAL_KEY]) {
    g[SUPABASE_GLOBAL_KEY] = createClient(
      `https://${projectId}.supabase.co`,
      publicAnonKey,
      {
        auth: {
          // Explicit storage key avoids conflicts if a second project is ever added
          storageKey: `sb-${projectId}-auth-token`,
          persistSession: true,
          autoRefreshToken: true,
        },
      }
    );
  }
  return g[SUPABASE_GLOBAL_KEY];
}

const SERVER_BASE = `https://${projectId}.supabase.co/functions/v1/make-server-64a0c849`;

/* ── Types ──────────────────────────────────────────────── */

/* ── Error messages (map Supabase → Vietnamese) ─────────── */
function translateAuthError(msg) {
  const m = msg.toLowerCase();
  if (m.includes("invalid login credentials") || m.includes("invalid credentials"))
    return "Email hoặc mật khẩu không đúng. Vui lòng thử lại.";
  if (m.includes("email not confirmed"))
    return "Email chưa được xác nhận. Vui lòng liên hệ hỗ trợ.";
  if (m.includes("user not found"))
    return "Tài khoản không tồn tại. Vui lòng đăng ký.";
  if (m.includes("too many requests"))
    return "Quá nhiều lần thử. Vui lòng đợi vài phút rồi thử lại.";
  if (m.includes("network") || m.includes("fetch"))
    return "Lỗi kết nối mạng. Vui lòng kiểm tra internet và thử lại.";
  return msg;
}

/* ── Register (via server → Supabase Admin) ─────────────── */
export async function registerUser(data) {
  try {
    // Try direct Supabase signup first (public endpoint via client)
    const supabase = getSupabaseClient();
    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
      email: data.email,
      password: data.password,
      options: {
        data: {
          name: data.name,
          role: data.role ?? "customer",
        },
      },
    });

    if (signUpError) {
      console.log("Supabase signUp error:", signUpError.message);
      const msg = signUpError.message.toLowerCase();
      
      // Handle specific errors
      if (msg.includes("user already registered") || msg.includes("already registered")) {
        return { success: false, error: "Email này đã được đăng ký. Vui lòng đăng nhập." };
      }
      if (msg.includes("only request this after") || msg.includes("too many requests") || msg.includes("rate limit")) {
        const match = signUpError.message.match(/after (\d+) seconds/);
        const seconds = match ? match[1] : "vài";
        return { success: false, error: `Bạn đã thử quá nhiều lần. Vui lòng đợi ${seconds} giây và thử lại.` };
      }
      if (msg.includes("password")) {
        return { success: false, error: "Mật khẩu không đủ mạnh. Vui lòng thử mật khẩu khác." };
      }
      if (msg.includes("email") && msg.includes("invalid")) {
        return { success: false, error: "Email không hợp lệ. Vui lòng kiểm tra lại." };
      }
      
      return { success: false, error: `Đăng ký thất bại: ${signUpError.message}` };
    }

    if (!signUpData.user) {
      return { success: false, error: "Đăng ký thất bại. Vui lòng thử lại." };
    }

    console.log("Registration successful:", signUpData.user.id);
    return { success: true };
  } catch (err) {
    console.log("Register unexpected error:", err);
    return { success: false, error: `Lỗi không xác định: ${err instanceof Error ? err.message : String(err)}` };
  }
}

/* ── Login (via Supabase client) ────────────────────────── */
export async function loginUser(
  email,
  password
) {
  try {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      console.log("Login error:", error.message);
      return { success: false, error: translateAuthError(error.message) };
    }

    // Populate local session from Supabase user metadata
    const meta = data.user.user_metadata ?? {};
    const profile = {
      name: meta.name ?? email.split("@")[0],
      email: data.user.email,
      role: meta.role ?? "customer",
      avatar: meta.avatar,
      expertise: meta.expertise,
      experience: meta.experience,
      hourlyRate: meta.hourlyRate,
      bio: meta.bio,
    };

    setLoggedIn(profile);
    localStorage.setItem("prointerview_access_token", data.session.access_token);
    return { success: true };
  } catch (err) {
    console.log("Login unexpected error:", err);
    return { success: false, error: "Đăng nhập thất bại. Vui lòng thử lại." };
  }
}

/* ── Restore session on app load ────────────────────────── */
export async function restoreSession() {
  try {
    const supabase = getSupabaseClient();
    const { data: { session }, error } = await supabase.auth.getSession();

    if (error) {
      console.log("Session restore error:", error.message);
      return false;
    }

    if (!session) return false;

    const meta = session.user.user_metadata ?? {};
    const profile = {
      name: meta.name ?? session.user.email.split("@")[0],
      email: session.user.email,
      role: meta.role ?? "customer",
      avatar: meta.avatar,
      expertise: meta.expertise,
      experience: meta.experience,
      hourlyRate: meta.hourlyRate,
      bio: meta.bio,
    };

    setLoggedIn(profile);
    localStorage.setItem("prointerview_access_token", session.access_token);
    return true;
  } catch (err) {
    console.log("Session restore unexpected error:", err);
    return false;
  }
}

/* ── Get stored access token (for authenticated API calls) ─ */
export function getAccessToken() {
  return localStorage.getItem("prointerview_access_token") ?? "";
}

/* ── Get fresh access token (refreshes expired JWT) ─────── */
export async function getFreshAccessToken() {
  try {
    const supabase = getSupabaseClient();
    const { data: { session }, error } = await supabase.auth.getSession();
    if (error || !session) return "";

    // If token has expired or will expire within 60s, refresh it
    const expiresAt = session.expires_at ?? 0;
    const nowSec    = Math.floor(Date.now() / 1000);
    if (expiresAt - nowSec < 60) {
      const { data: refreshed } = await supabase.auth.refreshSession();
      if (refreshed.session) {
        localStorage.setItem("prointerview_access_token", refreshed.session.access_token);
        return refreshed.session.access_token;
      }
      // Refresh failed (refresh token expired) — do NOT return the expired access token
      return "";
    }
    // Token still valid — make sure localStorage is in sync
    localStorage.setItem("prointerview_access_token", session.access_token);
    return session.access_token;
  } catch {
    return localStorage.getItem("prointerview_access_token") ?? "";
  }
}

/* ── Session (localStorage mirror) ─────────────────────── */
const AUTH_KEY = "prointerview_auth";

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

export function updateUser(partial) {
  const current = getUser();
  if (!current) return;
  setLoggedIn({ ...current, ...partial });
  // Also update Supabase user metadata in background (fire-and-forget)
  getSupabaseClient()
    .auth.updateUser({ data: partial })
    .catch((err) => console.log("updateUser metadata error:", err));
}

export function logout() {
  localStorage.removeItem(AUTH_KEY);
  localStorage.removeItem("prointerview_access_token");
  // Fire-and-forget Supabase signOut (non-blocking so callers stay sync)
  getSupabaseClient()
    .auth.signOut()
    .catch((err) => console.log("signOut error:", err));
}

/* ── Helpers ────────────────────────────────────────────── */
export function getInitials(name) {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/* ══════════════════════════════════════════════════════════
   PLAN SYSTEM — 3 tiers
   ──────────────────────────────────────────────────────────
   Free  : starterPro=false, elitePro=false
   Pro   : starterPro=true,  elitePro=false
   Elite : starterPro=true,  elitePro=true
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

/* ── CV/JD usage counter ──────────────────────────────── */
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