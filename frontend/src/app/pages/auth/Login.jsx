import React, { useState } from "react";
import { useNavigate, useSearchParams, Link } from "react-router";
import {
  Eye,
  EyeOff as EyeSlash,
  Check,
  AlertCircle as WarningCircle,
  Info,
} from "lucide-react";
import {
  loginUser,
  getUser,
  isLoggedIn,
  getPostLoginPath,
} from "../../utils/auth/auth.js";
import { toastApiError } from "../../utils/shared/apiToast.js";
import { GoogleSignInBlock } from "../../components/auth/GoogleSignInBlock";
import { StickerLimeSparkle } from "../../components/decor/StickerLimeSparkle.jsx";
import { AUTH_COPY } from "../../constants/brandVoice";
import { AuthShell } from "../../components/auth/AuthShell.jsx";
import { useWorkspaceTheme } from "../../hooks/useWorkspaceTheme.js";

const BRAND_LIME = "#93f72b";

const AUTH_CTA_STYLE = {
  background: BRAND_LIME,
  color: "#0f172a",
  "--pi-button-highlight": "#c7f36b",
  "--pi-button-ring": "#93f72b40",
};

export function Login() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const theme = useWorkspaceTheme(true);
  const light = theme.resolved === "light";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const isRegistered = searchParams.get("registered") === "1";

  React.useEffect(() => {
    if (!isLoggedIn()) return;
    const user = getUser();
    if (!user) return;
    navigate(getPostLoginPath(user, searchParams.get("redirect")), { replace: true });
  }, [navigate, searchParams]);

  React.useEffect(() => {
    document.documentElement.classList.add("app-route-home");
    return () => document.documentElement.classList.remove("app-route-home");
  }, []);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    const result = await loginUser(email.trim(), typeof password === "string" ? password.trim() : password);
    setLoading(false);
    if (!result.success) {
      setError(result.error);
      toastApiError(result.error, "Đăng nhập thất bại.");
      return;
    }
    const user = getUser();
    navigate(getPostLoginPath(user, searchParams.get("redirect")));
  };

  const handleFieldChange = (setter) => (e) => {
    setter(e.target.value);
    if (error) setError("");
  };

  const errorIsGoogleEnvHint = Boolean(
    error && /VITE_GOOGLE|Google chưa được bật|thiếu.*CLIENT_ID|GOOGLE_CLIENT_ID|Authorized JavaScript/i.test(error),
  );
  const errorIsAccountLocked = Boolean(error && /bị khóa/i.test(error));
  const errorIsProxyOrApi = Boolean(
    error && /Vite proxy|Không gọi được API|Không kết nối được backend/i.test(error),
  );

  const inputClass = light
    ? "w-full px-3 py-2 sm:px-4 sm:py-3.5 rounded-xl border border-[#ddd3f5] text-sm sm:text-base outline-none transition-all focus:border-[#7c3aed] focus:ring-2 focus:ring-[#7c3aed]/20 text-[#1e1338] placeholder:text-[#9d98b3] bg-[#fbfaff] hover:bg-white"
    : "w-full px-3 py-2 sm:px-4 sm:py-3.5 rounded-xl border border-white/15 text-sm sm:text-base outline-none transition-all focus:border-[#b79ae8] focus:ring-2 focus:ring-[#b79ae8]/20 text-white placeholder:text-[#a59bb8] bg-[#171226] hover:bg-[#1b152d]";

  const cardClass = light
    ? "rounded-3xl border border-[#ddd3f5] bg-white/95 p-6 shadow-[0_24px_64px_rgba(124,58,237,0.1)] sm:p-10 backdrop-blur-xl"
    : "rounded-3xl border border-[#a998d0]/25 bg-[#211a36] p-6 shadow-[0_24px_64px_rgba(5,3,18,0.35)] sm:p-10";

  return (
    <AuthShell
      headerRight={
        <Link
          to="/register"
          className={`text-xs sm:text-sm font-semibold transition-colors ${
            light ? "text-[#6d28d9] hover:text-[#5b21b6]" : "text-violet-300 hover:text-white"
          }`}
        >
          Đăng ký
        </Link>
      }
    >
      <div className="relative mx-auto w-full max-w-md shrink-0 overflow-visible -mt-[4rem] sm:-mt-[11.2rem]">
        {/* Mascot */}
        <div
          className="pointer-events-none relative z-[5] mb-[-0.25rem] h-[11.85rem] w-full translate-y-[1rem] sm:h-[17.35rem] sm:translate-y-[3rem]"
          aria-hidden
        >
          <img
            src="/mascot-auth-login.png?v=3"
            alt=""
            className="absolute bottom-0 left-[-2.6rem] h-full w-auto max-w-[min(92vw,11.85rem)] origin-bottom-left rotate-[2deg] object-contain object-bottom sm:left-[-7.15rem] sm:max-w-[17.35rem] md:left-[-7.5rem]"
          />
        </div>

        {/* Stickers on top layer */}
        <div
          className="pointer-events-none absolute left-0 right-0 top-0 z-20 h-[15.85rem] w-full translate-y-[3rem] sm:h-[17.35rem]"
          aria-hidden
        >
          <StickerLimeSparkle
            className="absolute bottom-[1.3rem] left-[21.4rem] h-[4.5rem] w-[4.5rem] -rotate-[17deg] max-md:bottom-[-0.7rem] max-md:left-[23.4rem] sm:bottom-[2.3rem] sm:left-[19.4rem]"
          />
          <StickerLimeSparkle
            className="absolute bottom-[0.4rem] left-[25.0rem] h-11 w-11 rotate-[10deg] max-md:bottom-[-2.6rem] max-md:left-[26.0rem] sm:bottom-[2.4rem] sm:left-[23.0rem]"
          />
        </div>

        {/* Form Card */}
        <div className={`relative z-10 w-full -mt-[3.3rem] sm:-mt-[4.15rem] ${cardClass}`}>
          <h1
            className={`mb-1 text-[1.35rem] sm:text-[1.875rem] font-black tracking-tight ${
              light ? "text-[#1e1338]" : "text-white"
            }`}
          >
            Đăng nhập
          </h1>
          <p className={`mb-3 sm:mb-4 text-xs sm:text-sm ${light ? "text-[#5e5875]" : "text-white/80"}`}>
            {AUTH_COPY.loginSubtitle}
          </p>

          {/* Success banner */}
          {isRegistered && (
            <div
              className={`mb-5 flex items-start gap-3 rounded-2xl border px-4 py-3 ${
                light ? "border-emerald-200 bg-emerald-50 text-emerald-900" : "border-white/25 bg-white/10 text-white"
              }`}
            >
              <Check className="mt-0.5 h-5 w-5 flex-shrink-0 text-[#16a34a]" />
              <div>
                <p className="text-sm font-semibold text-[#16a34a]">{AUTH_COPY.loginRegisteredTitle}</p>
                <p className={`mt-0.5 text-xs ${light ? "text-emerald-800" : "text-white/75"}`}>
                  {AUTH_COPY.loginRegisteredBody}
                </p>
              </div>
            </div>
          )}

          {/* Error banner */}
          {error && (
            <div
              className={`mb-5 flex items-start gap-3 rounded-2xl border px-4 py-3 text-sm ${
                errorIsGoogleEnvHint || errorIsAccountLocked || errorIsProxyOrApi
                  ? "border-amber-400/25 bg-amber-50 text-amber-800"
                  : "border-red-300/40 bg-red-50 text-red-700"
              }`}
            >
              {errorIsGoogleEnvHint || errorIsAccountLocked || errorIsProxyOrApi ? (
                <Info className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-500" strokeWidth={2} />
              ) : (
                <WarningCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-red-400" />
              )}
              <div>
                <p className="font-medium">{error}</p>
                {errorIsAccountLocked && (
                  <p className="mt-1.5 text-xs leading-relaxed text-amber-900/80">
                    Bạn thử đăng nhập bằng email/mật khẩu, hoặc liên hệ{" "}
                    <a href="mailto:prointerview.ai@gmail.com" className="font-semibold underline">
                      prointerview.ai@gmail.com
                    </a>
                    .
                  </p>
                )}
                {errorIsProxyOrApi && !errorIsAccountLocked && (
                  <p className="mt-1.5 text-xs leading-relaxed text-amber-900/80">
                    Chạy <code className="rounded bg-amber-100 px-1">npm run dev:full</code> trong thư mục{" "}
                    <code className="rounded bg-amber-100 px-1">frontend</code>. Backend mặc định cổng{" "}
                    <strong>5000</strong> (Vite proxy trỏ <code className="rounded bg-amber-100 px-1">localhost:5000</code>).
                  </p>
                )}
              </div>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-2 sm:space-y-3">
            {/* Email */}
            <div>
              <label htmlFor="login-email" className={`mb-1.5 block text-sm font-semibold ${light ? "text-[#2b1f47]" : "text-white"}`}>
                Email
              </label>
              <input
                id="login-email"
                type="email"
                autoComplete="email"
                placeholder="email@example.com"
                value={email}
                onChange={handleFieldChange(setEmail)}
                required
                className={inputClass}
              />
            </div>

            {/* Password */}
            <div>
              <div className="flex justify-between items-center mb-1.5">
                <label htmlFor="login-password" className={`text-sm font-semibold ${light ? "text-[#2b1f47]" : "text-white"}`}>
                  Mật khẩu
                </label>
                <Link
                  to="/forgot-password"
                  className={`text-sm font-semibold transition-colors ${
                    light ? "text-[#6d28d9] hover:underline" : "text-[#93f72b] hover:underline"
                  }`}
                >
                  Quên mật khẩu?
                </Link>
              </div>
              <div className="relative">
                <input
                  id="login-password"
                  type={showPass ? "text" : "password"}
                  autoComplete="current-password"
                  placeholder="••••••••"
                  value={password}
                  onChange={handleFieldChange(setPassword)}
                  required
                  className={`${inputClass} pr-12`}
                />
                <button
                  data-button-surface="none"
                  type="button"
                  onClick={() => setShowPass(!showPass)}
                  className={`absolute right-4 top-1/2 -translate-y-1/2 rounded-md border-0 bg-transparent p-1 shadow-none transition-colors ${
                    light ? "text-[#7c7595] hover:text-[#1e1338]" : "text-[#b8accd] hover:text-white"
                  }`}
                  aria-label={showPass ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
                >
                  {showPass ? <EyeSlash className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-full py-2.5 sm:py-3.5 text-sm sm:text-base font-bold transition-all hover:brightness-105 active:scale-[0.98] disabled:opacity-60"
              style={AUTH_CTA_STYLE}
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="h-5 w-5 animate-spin rounded-full border-2 border-slate-900/30 border-t-slate-900" />
                  Đang đăng nhập...
                </span>
              ) : (
                "Đăng nhập"
              )}
            </button>
          </form>

          {/* Divider */}
          <div className="my-3 sm:my-5 flex items-center gap-3">
            <div className={`h-px flex-1 ${light ? "bg-[#e5def7]" : "bg-white/25"}`} />
            <span className={`text-xs font-medium ${light ? "text-[#7c7595]" : "text-white/60"}`}>hoặc</span>
            <div className={`h-px flex-1 ${light ? "bg-[#e5def7]" : "bg-white/25"}`} />
          </div>

          <GoogleSignInBlock onError={setError} />

          <p className={`mt-3 sm:mt-5 text-center text-xs sm:text-sm ${light ? "text-[#5e5875]" : "text-white/80"}`}>
            Chưa có tài khoản?{" "}
            <Link
              to="/register"
              className={`font-bold transition-colors ${
                light ? "text-[#6d28d9] hover:underline" : "text-[#93f72b] hover:underline"
              }`}
            >
              Đăng ký ngay
            </Link>
          </p>
        </div>
      </div>
    </AuthShell>
  );
}
