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
  getBrandClickPath,
} from "../../utils/auth/auth.js";
import { toastApiError } from "../../utils/shared/apiToast.js";
import { GoogleSignInBlock } from "../../components/auth/GoogleSignInBlock";
import { BrandLogo } from "../../components/brand/BrandLogo";
import { SparkleGlyph } from "../../components/decor/SparkleGlyph.jsx";
import { StickerLimeSparkle } from "../../components/decor/StickerLimeSparkle.jsx";
import { AUTH_COPY } from "../../constants/brandVoice";
import { AuthPurpleBackdrop } from "../../components/auth/AuthPurpleBackdrop";

const BRAND_LIME = "#93f72b";

/** Nền trang (bên ngoài), trắng ngà, không #fff tinh */
const AUTH_PAGE_BG = "bg-transparent";

/** Ô form đăng nhập/đăng ký, tím brand */
const AUTH_CARD_CLS =
  "rounded-3xl border border-white/15 bg-[#8037f4] p-6 shadow-[0_16px_48px_rgba(15,23,42,0.18)] sm:p-10";

const INPUT_CLS =
  "w-full px-3 py-2 sm:px-4 sm:py-3.5 rounded-xl border border-white/25 text-sm sm:text-base outline-none transition-all " +
  "focus:border-[#93f72b] focus:ring-2 focus:ring-[#93f72b]/25 text-gray-900 placeholder-gray-400 " +
  "bg-white hover:bg-gray-50";

const AUTH_CTA_STYLE = {
  background: BRAND_LIME,
  color: "#0f172a",
  boxShadow: "0 8px 22px rgba(147, 247, 43, 0.35)",
};

/** % = tâm sticker; kích thước lệch, nằm trong vùng inset của lớp nền */
const AUTH_STICKS = [
  { x: 14, y: 22, size: 26 },
  { x: 82, y: 20, size: 36 },
  { x: 18, y: 72, size: 22 },
  { x: 80, y: 74, size: 30 },
];

export function Login() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
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

  return (
    <div
      className={`relative flex min-h-[100dvh] flex-col overflow-y-auto ${AUTH_PAGE_BG}`}
      style={{ fontFamily: "'Lexend', 'Plus Jakarta Sans', system-ui, sans-serif" }}
    >
      <style>{`
        html, body {
          background: radial-gradient(ellipse at 50% 30%, #ffffff 0%, #fdfcff 60%, #f7f3fd 100%) !important;
          background-attachment: fixed !important;
        }
      `}</style>
      <AuthPurpleBackdrop />
      <div className="relative z-[1] flex min-h-0 flex-1 flex-col">
        {/* Top bar */}
        <div
          className="relative z-10 flex h-20 flex-shrink-0 items-center justify-between px-10"
        >
          <button onClick={() => navigate(getBrandClickPath())} className="flex items-center gap-2.5 group">
            <BrandLogo size="auth" />
          </button>
        </div>

        {/* Form + mascot phía trên mép trên thẻ */}
        <div className="relative z-10 flex flex-1 items-start justify-center overflow-x-visible px-6 pb-8 pt-[5.55rem] sm:px-10 sm:pt-[6.05rem]">
          <div className="relative mx-auto w-full max-w-md shrink-0 overflow-visible -mt-[4rem] sm:-mt-[11.2rem]">
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

            <div className={`relative z-10 w-full -mt-[3.3rem] sm:-mt-[4.15rem] ${AUTH_CARD_CLS}`}>

            <h1 className="mb-1 text-white text-[1.35rem] sm:text-[1.875rem]" style={{ fontWeight: 750, letterSpacing: "-0.025em" }}>
              Đăng nhập
            </h1>
            <p className="mb-3 sm:mb-4 text-xs sm:text-sm text-white/80">{AUTH_COPY.loginSubtitle}</p>

            {/* Success banner */}
            {isRegistered && (
              <div className="mb-5 flex items-start gap-3 rounded-2xl border border-white/25 bg-white/10 px-4 py-3">
                <Check className="mt-0.5 h-5 w-5 flex-shrink-0 text-[#93f72b]" />
                <div>
                  <p className="text-sm font-semibold text-[#93f72b]">{AUTH_COPY.loginRegisteredTitle}</p>
                  <p className="mt-0.5 text-xs text-white/75">{AUTH_COPY.loginRegisteredBody}</p>
                </div>
              </div>
            )}

            {/* Error banner */}
            {error && (
              <div className={`mb-5 flex items-start gap-3 rounded-2xl border px-4 py-3 text-sm ${errorIsGoogleEnvHint || errorIsAccountLocked || errorIsProxyOrApi
                  ? "border-amber-400/25 bg-amber-50 text-amber-800"
                  : "border-red-300/40 bg-red-50 text-red-700"
                }`}>
                {errorIsGoogleEnvHint || errorIsAccountLocked || errorIsProxyOrApi
                  ? <Info className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-500" strokeWidth={2} />
                  : <WarningCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-red-400" />}
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
                <label htmlFor="login-email" className="mb-1.5 block text-sm font-semibold text-white">Email</label>
                <input
                  id="login-email" type="email" autoComplete="email"
                  placeholder="email@example.com"
                  value={email} onChange={handleFieldChange(setEmail)}
                  required className={INPUT_CLS}
                />
              </div>

              {/* Password */}
              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <label htmlFor="login-password" className="text-sm font-semibold text-white">Mật khẩu</label>
                  <Link to="/forgot-password" className="text-sm font-semibold text-[#93f72b] hover:underline">
                    Quên mật khẩu?
                  </Link>
                </div>
                <div className="relative">
                  <input
                    id="login-password" type={showPass ? "text" : "password"}
                    autoComplete="current-password" placeholder="••••••••"
                    value={password} onChange={handleFieldChange(setPassword)}
                    required className={`${INPUT_CLS} pr-12`}
                  />
                  <button type="button" onClick={() => setShowPass(!showPass)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                    aria-label={showPass ? "Ẩn mật khẩu" : "Hiện mật khẩu"}>
                    {showPass ? <EyeSlash className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              {/* Submit */}
              <button type="submit" disabled={loading}
                className="w-full rounded-full py-2.5 sm:py-3.5 text-sm sm:text-base font-bold transition-all hover:brightness-105 active:scale-[0.98] disabled:opacity-60"
                style={AUTH_CTA_STYLE}>
                {loading
                  ? <span className="flex items-center justify-center gap-2">
                    <span className="h-5 w-5 animate-spin rounded-full border-2 border-slate-900/30 border-t-slate-900" />
                    Đang đăng nhập...
                  </span>
                  : "Đăng nhập"}
              </button>
            </form>

            {/* Divider */}
            <div className="my-3 sm:my-5 flex items-center gap-3">
              <div className="h-px flex-1 bg-white/25" />
              <span className="text-xs font-medium text-white/60">hoặc</span>
              <div className="h-px flex-1 bg-white/25" />
            </div>

            <GoogleSignInBlock onError={setError} />

            <p className="mt-3 sm:mt-5 text-center text-xs sm:text-sm text-white/80">
              Chưa có tài khoản?{" "}
              <Link to="/register" className="font-bold text-[#93f72b] hover:underline">
                Đăng ký ngay
              </Link>
            </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
