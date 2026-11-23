import React, { useState } from "react";
import { useNavigate, useSearchParams, Link } from "react-router";
import {
  Eye,
  EyeOff as EyeSlash,
  Check,
  AlertCircle as WarningCircle,
} from "lucide-react";
import { registerUser } from "../../utils/auth/auth.js";
import { toastApiError } from "../../utils/shared/apiToast.js";
import { GoogleSignInBlock } from "../../components/auth/GoogleSignInBlock";
import { AUTH_COPY } from "../../constants/brandVoice";
import { AuthShell } from "../../components/auth/AuthShell.jsx";
import { useWorkspaceTheme } from "../../hooks/useWorkspaceTheme.js";

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

const AUTH_CTA_STYLE = {
  background: BRAND_LIME,
  color: "#0f172a",
  boxShadow: "0 4px 14px rgba(147, 247, 43, 0.12)",
};

export function Register() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const theme = useWorkspaceTheme(true);
  const light = theme.resolved === "light";

  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    role: "customer",
    adminInviteCode: "",
  });
  const [showPass, setShowPass] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const strength = pwStrength(form.password);

  const handleChange = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (error) setError("");
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    if (!agreed) {
      setError("Vui lòng đồng ý với Điều khoản dịch vụ và Chính sách bảo mật.");
      return;
    }
    setLoading(true);
    setError("");

    const result = await registerUser({
      name: form.name.trim(),
      email: form.email.trim(),
      password: form.password,
      role: form.role,
      adminInviteCode: form.role === "admin" ? form.adminInviteCode : undefined,
    });
    setLoading(false);

    if (!result.success) {
      setError(result.error);
      toastApiError(result.error, "Đăng ký thất bại.");
      return;
    }

    const redirect = searchParams.get("redirect");
    const loginUrl = redirect
      ? `/login?registered=1&redirect=${encodeURIComponent(redirect)}`
      : "/login?registered=1";
    navigate(loginUrl);
  };

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
          to="/login"
          className={`text-xs sm:text-sm font-semibold transition-colors ${
            light ? "text-[#6d28d9] hover:text-[#5b21b6]" : "text-violet-300 hover:text-white"
          }`}
        >
          Đăng nhập
        </Link>
      }
    >
      <div className="relative mx-auto w-full max-w-md shrink-0 overflow-visible">
        {/* Form Card */}
        <div className={`relative z-10 w-full ${cardClass}`}>
          <h1
            className={`mb-1 text-[1.35rem] sm:text-[1.875rem] font-black tracking-tight ${
              light ? "text-[#1e1338]" : "text-white"
            }`}
          >
            Tạo tài khoản
          </h1>
          <p className={`mb-3 sm:mb-4 text-xs sm:text-sm ${light ? "text-[#5e5875]" : "text-white/80"}`}>
            {AUTH_COPY.registerSubtitle}
          </p>

          {/* Error banner */}
          {error && (
            <div className="mb-5 flex items-start gap-3 rounded-2xl border border-red-300/40 bg-red-50 px-4 py-3 text-sm text-red-700">
              <WarningCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-red-400" />
              <p className="font-medium">{error}</p>
            </div>
          )}

          <form onSubmit={handleRegister} className="space-y-2 sm:space-y-3">
            {/* Name */}
            <div>
              <label htmlFor="reg-name" className={`mb-1.5 block text-sm font-semibold ${light ? "text-[#2b1f47]" : "text-white"}`}>
                Họ và tên
              </label>
              <input
                id="reg-name"
                type="text"
                placeholder="Nguyễn Văn A"
                value={form.name}
                onChange={(e) => handleChange("name", e.target.value)}
                required
                className={inputClass}
              />
            </div>

            {/* Email */}
            <div>
              <label htmlFor="reg-email" className={`mb-1.5 block text-sm font-semibold ${light ? "text-[#2b1f47]" : "text-white"}`}>
                Email
              </label>
              <input
                id="reg-email"
                type="email"
                placeholder="email@example.com"
                value={form.email}
                onChange={(e) => handleChange("email", e.target.value)}
                required
                className={inputClass}
              />
            </div>

            {/* Password */}
            <div>
              <label htmlFor="reg-password" className={`mb-1.5 block text-sm font-semibold ${light ? "text-[#2b1f47]" : "text-white"}`}>
                Mật khẩu
              </label>
              <div className="relative">
                <input
                  id="reg-password"
                  type={showPass ? "text" : "password"}
                  placeholder="Tối thiểu 6 ký tự"
                  value={form.password}
                  onChange={(e) => handleChange("password", e.target.value)}
                  required
                  minLength={6}
                  className={`${inputClass} pr-12`}
                />
                <button
                  data-button-surface="none"
                  type="button"
                  onClick={() => setShowPass(!showPass)}
                  className={`absolute right-4 top-1/2 -translate-y-1/2 rounded-md border-0 bg-transparent p-1 shadow-none transition-colors ${
                    light ? "text-[#7c7595] hover:text-[#1e1338]" : "text-[#b8accd] hover:text-white"
                  }`}
                  aria-label={showPass ? "Ẩn" : "Hiện"}
                >
                  {showPass ? <EyeSlash className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>

              {/* Password strength indicator */}
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
                        background:
                          strength >= lvl
                            ? STRENGTH_COLORS[strength - 1]
                            : light
                              ? "#e5def7"
                              : "#352b52",
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
                <label className={`mb-1.5 block text-sm font-semibold ${light ? "text-[#2b1f47]" : "text-white"}`}>
                  Mã mời quản trị
                </label>
                <input
                  type="password"
                  autoComplete="off"
                  placeholder="ADMIN_INVITE_CODE"
                  value={form.adminInviteCode}
                  onChange={(e) => handleChange("adminInviteCode", e.target.value)}
                  className={inputClass}
                />
              </div>
            )}

            {/* Terms checkbox */}
            <label className="flex cursor-pointer items-start gap-2 pt-1">
              <button
                type="button"
                onClick={() => setAgreed(!agreed)}
                className="mt-0.5 flex flex-shrink-0 items-center justify-center rounded-md border-2 transition-all"
                style={{
                  width: "18px",
                  height: "18px",
                  background: agreed ? BRAND_LIME : "transparent",
                  borderColor: agreed ? BRAND_LIME : light ? "#cdbff0" : "rgba(255,255,255,0.45)",
                }}
              >
                {agreed && <Check className="h-3 w-3 text-slate-900" strokeWidth={3} />}
              </button>
              <span className={`text-xs leading-relaxed ${light ? "text-[#5e5875]" : "text-white/75"}`}>
                Tôi đã đọc và đồng ý với{" "}
                <Link
                  to="/terms"
                  onClick={(e) => e.stopPropagation()}
                  className={`font-semibold ${light ? "text-[#6d28d9] hover:underline" : "text-[#93f72b] hover:underline"}`}
                >
                  Điều khoản dịch vụ
                </Link>{" "}
                và{" "}
                <Link
                  to="/privacy"
                  onClick={(e) => e.stopPropagation()}
                  className={`font-semibold ${light ? "text-[#6d28d9] hover:underline" : "text-[#93f72b] hover:underline"}`}
                >
                  Chính sách bảo mật
                </Link>{" "}
                của ProInterview.
              </span>
            </label>

            {/* Submit button */}
            <button
              type="submit"
              disabled={loading || !agreed}
              className="w-full rounded-full py-2.5 sm:py-3.5 text-sm sm:text-base font-bold transition-all hover:brightness-105 active:scale-[0.98] disabled:opacity-60"
              style={{
                ...AUTH_CTA_STYLE,
                boxShadow: agreed ? AUTH_CTA_STYLE.boxShadow : "none",
              }}
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="h-5 w-5 animate-spin rounded-full border-2 border-slate-900/30 border-t-slate-900" />
                  Đang tạo tài khoản...
                </span>
              ) : (
                "Tạo tài khoản"
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
            Đã có tài khoản?{" "}
            <Link
              to="/login"
              className={`font-bold transition-colors ${
                light ? "text-[#6d28d9] hover:underline" : "text-[#93f72b] hover:underline"
              }`}
            >
              Đăng nhập ngay
            </Link>
          </p>
        </div>
      </div>
    </AuthShell>
  );
}
