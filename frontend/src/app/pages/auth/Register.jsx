import React, { useState } from "react";
import { useNavigate, useSearchParams, Link } from "react-router";
import {
  Eye,
  EyeOff as EyeSlash,
  Check,
  AlertCircle as WarningCircle,
  Info,
  ShieldCheck,
  Mail,
} from "lucide-react";
import { registerUser, getBrandClickPath } from "../../utils/auth/auth.js";
import { toastApiError } from "../../utils/shared/apiToast.js";
import { GoogleSignInBlock } from "../../components/auth/GoogleSignInBlock";
import { BrandLogo } from "../../components/brand/BrandLogo";
import { SparkleGlyph } from "../../components/decor/SparkleGlyph.jsx";
import { StickerLimeSparkle } from "../../components/decor/StickerLimeSparkle.jsx";
import { AUTH_COPY } from "../../constants/brandVoice";
import { AuthPurpleBackdrop } from "../../components/auth/AuthPurpleBackdrop";

function pwStrength(pw) {
  if (!pw) return 0;
  let s = 0;
  if (pw.length >= 6) s++;
  if (pw.length >= 10) s++;
  if (/[A-Z]/.test(pw) || /[0-9]/.test(pw) || /[^a-zA-Z0-9]/.test(pw)) s++;
  return Math.min(s, 3);
}
const STRENGTH_COLORS = ["#FF8C42", "#FFB800", "#22c55e"];
const STRENGTH_LABELS = ["Yếu", "Trung bình", "Mạnh"];

const BRAND_LIME = "#93f72b";

/** Nền trang (bên ngoài), trắng ngà, không #fff tinh */
const AUTH_PAGE_BG = "bg-transparent";

/** Ô form, tím brand (cùng Login) */
const AUTH_CARD_CLS =
  "rounded-3xl border border-white/15 bg-[#8037f4] p-6 shadow-[0_16px_48px_rgba(15,23,42,0.18)] sm:p-10";

/** Cùng style ô nhập với Login */
const INPUT_REG_CLS =
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

export function Register() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [form, setForm] = useState({
    name: "", email: "", password: "",
    role: "customer", adminInviteCode: "",
  });
  const [showPass, setShowPass] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const strength = pwStrength(form.password);

  const handleRegister = async (e) => {
    e.preventDefault();
    if (!agreed) return;
    setLoading(true);
    setError("");
    if (form.role === "admin" && !form.adminInviteCode.trim()) {
      const msg = "Vui lòng nhập mã mời quản trị.";
      setError(msg);
      toastApiError(msg);
      setLoading(false);
      return;
    }
    const result = await registerUser({
      name: form.name.trim(), email: form.email.trim(), password: form.password,
      role: form.role,
      ...(form.role === "admin" ? { adminInviteCode: form.adminInviteCode.trim() } : {}),
    });
    setLoading(false);
    if (!result.success) {
      setError(result.error);
      toastApiError(result.error, "Đăng ký thất bại.");
      return;
    }
    setRegisteredEmail(form.email.trim());
  };

  const [registeredEmail, setRegisteredEmail] = useState("");

  React.useEffect(() => {
    document.documentElement.classList.add("app-route-home");
    return () => document.documentElement.classList.remove("app-route-home");
  }, []);

  const handleChange = (k, v) => {
    setForm((f) => ({ ...f, [k]: v }));
    if (error) setError("");
  };

  const errorIsGoogleEnvHint = Boolean(
    error && /VITE_GOOGLE|Google chưa được bật|thiếu.*CLIENT_ID/i.test(error),
  );

  if (registeredEmail) {
    return (
      <div className={`relative flex min-h-[100dvh] flex-col items-center justify-center overflow-y-auto px-6 py-12 text-center ${AUTH_PAGE_BG}`}>
        <style>{`
          html, body {
            background: radial-gradient(ellipse at 50% 30%, #ffffff 0%, #fdfcff 60%, #f7f3fd 100%) !important;
            background-attachment: fixed !important;
          }
        `}</style>
        <AuthPurpleBackdrop />
        <div className={`relative z-10 w-full max-w-md ${AUTH_CARD_CLS}`}>
          <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-white/15">
            <Mail className="h-10 w-10 text-[#93f72b]" />
          </div>
          <h1 className="mb-4 text-3xl font-black tracking-tight text-white">Kiểm tra email của bạn</h1>
          <p className="mb-8 leading-relaxed text-white/80">
            {AUTH_COPY.verifyEmailLead}{" "}
            <strong className="text-white">{registeredEmail}</strong>
          </p>
          <div className="space-y-4">
            <Link
              to="/login"
              className="inline-flex w-full items-center justify-center rounded-2xl px-6 py-4 text-base font-black transition-all hover:brightness-105 active:scale-[0.98]"
              style={AUTH_CTA_STYLE}
            >
              Về trang đăng nhập
            </Link>
            <button
              onClick={() => setRegisteredEmail("")}
              className="text-sm font-bold text-white/70 transition-colors hover:text-[#93f72b]"
            >
              Quay lại đăng ký
            </button>
          </div>
        </div>
      </div>
    );
  }

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

        {/* Form + mascot, mép trên thẻ căn với /login (items-start + slot giống login) */}
        <div className="relative z-10 flex flex-1 items-start justify-center overflow-x-visible px-6 pb-8 pt-[5.8rem] sm:px-10 sm:pt-[6.3rem]">
          <div className="relative mx-auto w-full max-w-md shrink-0 overflow-visible -mt-[3rem] sm:-mt-[7.5rem]">
            <div
              className="pointer-events-none relative z-[5] mb-[-0.25rem] h-[11.85rem] w-full shrink-0 translate-y-[1rem] sm:h-[17.35rem] sm:translate-y-[2.5rem]"
              aria-hidden
            />
            <div className={`relative z-10 w-full -mt-[8.15rem] sm:-mt-[12.15rem] ${AUTH_CARD_CLS}`}>

            <h1 className="mb-1 text-white text-[1.35rem] sm:text-[1.875rem]" style={{ fontWeight: 750, letterSpacing: "-0.025em" }}>
              Tạo tài khoản
            </h1>
            <p className="mb-3 sm:mb-4 text-xs sm:text-sm text-white/80">{AUTH_COPY.registerSubtitle}</p>

            {/* Error */}
            {error && (
              <div className={`mb-5 flex items-start gap-3 rounded-2xl border px-4 py-3 text-sm ${errorIsGoogleEnvHint
                  ? "border-amber-400/25 bg-amber-50 text-amber-800"
                  : "border-red-300/40 bg-red-50 text-red-700"
                }`}>
                {errorIsGoogleEnvHint
                  ? <Info className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-500" strokeWidth={2} />
                  : <WarningCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-red-400" />}
                <p className="font-medium">{error}</p>
              </div>
            )}

            <form onSubmit={handleRegister} className="space-y-2 sm:space-y-3">
              {/* Name */}
              <div>
                <label htmlFor="reg-name" className="mb-1.5 block text-sm font-semibold text-white">Họ và tên</label>
                <input id="reg-name" type="text" placeholder="Nguyễn Văn A"
                  value={form.name} onChange={(e) => handleChange("name", e.target.value)}
                  required className={INPUT_REG_CLS} />
              </div>

              {/* Email */}
              <div>
                <label htmlFor="reg-email" className="mb-1.5 block text-sm font-semibold text-white">Email</label>
                <input id="reg-email" type="email" placeholder="email@example.com"
                  value={form.email} onChange={(e) => handleChange("email", e.target.value)}
                  required className={INPUT_REG_CLS} />
              </div>

              {/* Password */}
              <div>
                <label htmlFor="reg-password" className="mb-1.5 block text-sm font-semibold text-white">Mật khẩu</label>
                <div className="relative">
                  <input id="reg-password" type={showPass ? "text" : "password"}
                    placeholder="Tối thiểu 6 ký tự"
                    value={form.password} onChange={(e) => handleChange("password", e.target.value)}
                    required minLength={6} className={`${INPUT_REG_CLS} pr-12`} />
                  <button type="button" onClick={() => setShowPass(!showPass)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                    aria-label={showPass ? "Ẩn" : "Hiện"}>
                    {showPass ? <EyeSlash className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
                {/* Chừa chỗ cố định từ đầu; chỉ hiện thanh + nhãn khi đã gõ MK */}
                <div
                  className="mt-1 flex min-h-[1.125rem] items-center gap-1.5"
                  aria-live="polite"
                  aria-hidden={form.password.length === 0}
                >
                  <div
                    className={`flex flex-1 items-center gap-1.5 transition-opacity duration-200 ${
                      form.password.length > 0 ? "opacity-100" : "pointer-events-none opacity-0"
                    }`}
                  >
                    {[1, 2, 3].map((lvl) => (
                      <div
                        key={lvl}
                        className="h-0.5 flex-1 rounded-full transition-all duration-300"
                        style={{
                          background: strength >= lvl ? STRENGTH_COLORS[strength - 1] : "#E5E7EB",
                        }}
                      />
                    ))}
                    <span
                      className="ml-0.5 min-w-[4.5rem] text-xs font-semibold"
                      style={{ color: STRENGTH_COLORS[strength - 1] }}
                    >
                      {form.password.length > 0 ? STRENGTH_LABELS[strength - 1] : ""}
                    </span>
                  </div>
                </div>
              </div>


              {form.role === "admin" && (
                <div>
                  <label className="mb-1.5 block text-sm font-semibold text-white">Mã mời quản trị</label>
                  <input type="password" autoComplete="off" placeholder="ADMIN_INVITE_CODE"
                    value={form.adminInviteCode} onChange={(e) => handleChange("adminInviteCode", e.target.value)}
                    className={INPUT_REG_CLS} />
                </div>
              )}

              {/* Terms */}
              <label className="flex cursor-pointer items-start gap-2">
                <button type="button" onClick={() => setAgreed(!agreed)}
                  className="mt-0.5 flex flex-shrink-0 items-center justify-center rounded-md border-2 transition-all"
                  style={{
                    width: "18px", height: "18px",
                    background: agreed ? BRAND_LIME : "transparent",
                    borderColor: agreed ? BRAND_LIME : "rgba(255,255,255,0.45)",
                  }}>
                  {agreed && <Check className="h-3 w-3 text-slate-900" strokeWidth={3} />}
                </button>
                 <span className="text-xs leading-relaxed text-white/75">
                  Tôi đã đọc và đồng ý với{" "}
                  <Link to="/terms" onClick={(e) => e.stopPropagation()} className="font-semibold text-[#93f72b] hover:underline">Điều khoản dịch vụ</Link>
                  {" "}và{" "}
                  <Link to="/privacy" onClick={(e) => e.stopPropagation()} className="font-semibold text-[#93f72b] hover:underline">Chính sách bảo mật</Link>
                  {" "}của ProInterview.
                </span>
              </label>

              {/* Submit */}
              <button type="submit" disabled={loading || !agreed}
                className="w-full rounded-full py-2.5 sm:py-3.5 text-sm sm:text-base font-bold transition-all hover:brightness-105 active:scale-[0.98] disabled:opacity-60"
                style={{
                  ...AUTH_CTA_STYLE,
                  boxShadow: agreed ? AUTH_CTA_STYLE.boxShadow : "none",
                }}>
                {loading
                  ? <span className="flex items-center justify-center gap-2">
                    <span className="h-5 w-5 animate-spin rounded-full border-2 border-slate-900/30 border-t-slate-900" />
                    Đang tạo tài khoản...
                  </span>
                  : "Tạo tài khoản"}
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
              Đã có tài khoản?{" "}
              <Link to="/login" className="font-bold text-[#93f72b] hover:underline">
                Đăng nhập ngay
              </Link>
            </p>

            </div>

            {/* Mascot + sparkle, giữ vị trí cũ; pointer-events-none để không chặn ô mật khẩu */}
            <div
              className="pointer-events-none absolute bottom-0 right-0 z-20 w-full overflow-visible -translate-y-[35.05rem] max-md:-translate-y-[27.55rem] sm:-translate-y-[34.9rem]"
              aria-hidden
            >
              <img
                src="/mascot-auth-register.png?v=6"
                alt=""
                width={280}
                height={280}
                className="pointer-events-none absolute bottom-0 right-[-2.35rem] z-10 h-[17rem] w-[17rem] max-h-none max-w-none origin-bottom-right -rotate-[2deg] object-contain object-bottom max-md:right-[-1.45rem] max-md:h-[14rem] max-md:w-[14rem] sm:right-[-2.85rem] sm:h-[18.25rem] sm:w-[18.25rem] md:right-[-3.25rem]"
              />
              <StickerLimeSparkle
                className="absolute bottom-[2.6rem] right-[0.2rem] z-30 h-[4.5rem] w-[4.5rem] rotate-[15deg] max-md:bottom-[1.5rem] max-md:right-[-0.4rem] sm:bottom-[3.6rem] sm:right-[-1.8rem]"
              />
              <StickerLimeSparkle
                className="absolute bottom-[5.9rem] right-[12.2rem] z-30 h-11 w-11 -rotate-[10deg] max-md:bottom-[3.9rem] max-md:right-[8.2rem] sm:bottom-[7.9rem] sm:right-[10.2rem]"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
