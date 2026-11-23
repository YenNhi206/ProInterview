import React, { useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import { CheckCircle2, AlertCircle, Info, Eye, EyeOff as EyeSlash } from "lucide-react";
import { AuthShell } from "../../components/auth/AuthShell.jsx";
import { useWorkspaceTheme } from "../../hooks/useWorkspaceTheme.js";
import { resetPassword } from "../../utils/auth/auth.js";
import { toastApiError } from "../../utils/shared/apiToast.js";
import { AUTH_COPY } from "../../constants/brandVoice";

const BRAND_LIME = "#93f72b";

const AUTH_CTA_STYLE = {
  background: BRAND_LIME,
  color: "#0f172a",
  boxShadow: "0 4px 14px rgba(147, 247, 43, 0.12)",
};

export function ResetPassword() {
  const [searchParams] = useSearchParams();
  const token = useMemo(() => (searchParams.get("token") || "").trim(), [searchParams]);

  const theme = useWorkspaceTheme(true);
  const light = theme.resolved === "light";

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  const onSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!token) {
      setError("Mã xác thực (token) không hợp lệ hoặc đã hết hạn. Vui lòng yêu cầu lại link mới.");
      return;
    }
    if (password.length < 6) {
      setError("Mật khẩu mới phải có ít nhất 6 ký tự.");
      return;
    }
    if (password !== confirm) {
      setError("Mật khẩu xác nhận không khớp.");
      return;
    }

    setLoading(true);
    const res = await resetPassword(token, password);
    setLoading(false);

    if (res.success) {
      setDone(true);
    } else {
      const msg = res.error || "Không thể đặt lại mật khẩu. Link có thể đã hết hạn.";
      setError(msg);
      toastApiError(msg);
    }
  };

  const inputClass = light
    ? "w-full px-4 py-3.5 rounded-xl border border-[#ddd3f5] text-sm sm:text-base outline-none transition-all focus:border-[#7c3aed] focus:ring-2 focus:ring-[#7c3aed]/20 text-[#1e1338] placeholder:text-[#9d98b3] bg-[#fbfaff] hover:bg-white"
    : "w-full px-4 py-3.5 rounded-xl border border-white/15 text-sm sm:text-base outline-none transition-all focus:border-[#b79ae8] focus:ring-2 focus:ring-[#b79ae8]/20 text-white placeholder:text-[#a59bb8] bg-[#171226] hover:bg-[#1b152d]";

  const cardClass = light
    ? "w-full max-w-md rounded-3xl border border-[#ddd3f5] bg-white/95 p-8 shadow-[0_24px_64px_rgba(124,58,237,0.08)] sm:p-10 backdrop-blur-xl"
    : "w-full max-w-md rounded-3xl border border-[#a998d0]/25 bg-[#211a36] p-8 shadow-[0_24px_64px_rgba(5,3,18,0.35)] sm:p-10";

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
      <div className={cardClass}>
        {done ? (
          <div className="text-center">
            <div
              className={`mx-auto mb-5 flex h-[4.25rem] w-[4.25rem] items-center justify-center rounded-full ${
                light ? "bg-violet-100 text-[#7c3aed]" : "bg-violet-500/20 text-[#93f72b]"
              }`}
            >
              <CheckCircle2 className="h-9 w-9" strokeWidth={2.25} />
            </div>

            <h1
              className={`mb-2 font-black tracking-tight ${light ? "text-[#1e1338]" : "text-white"}`}
              style={{ fontSize: "1.75rem", letterSpacing: "-0.025em" }}
            >
              {AUTH_COPY.resetPasswordDoneTitle}
            </h1>
            <p className={`mb-8 text-sm leading-relaxed ${light ? "text-[#5e5875]" : "text-white/80"}`}>
              {AUTH_COPY.resetPasswordDoneBody}
            </p>

            <Link
              to="/login"
              className="flex w-full items-center justify-center rounded-full py-3.5 text-base font-bold transition-all hover:brightness-105 active:scale-[0.98]"
              style={AUTH_CTA_STYLE}
            >
              Đăng nhập ngay
            </Link>
          </div>
        ) : (
          <>
            <h1
              className={`mb-1 font-black tracking-tight ${light ? "text-[#1e1338]" : "text-white"}`}
              style={{ fontSize: "1.875rem", letterSpacing: "-0.025em" }}
            >
              Đặt lại mật khẩu
            </h1>
            <p className={`mb-6 text-sm leading-relaxed ${light ? "text-[#5e5875]" : "text-white/80"}`}>
              {AUTH_COPY.resetPasswordSubtitle}
            </p>

            {error && (
              <div className="mb-5 flex items-start gap-3 rounded-2xl border border-red-300/40 bg-red-50 px-4 py-3 text-sm text-red-700">
                <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-red-400" />
                <p className="font-medium">{error}</p>
              </div>
            )}

            {!token && (
              <div
                className={`mb-5 flex items-start gap-2.5 rounded-2xl border px-4 py-3 ${
                  light
                    ? "border-amber-300 bg-amber-50 text-amber-900"
                    : "border-amber-400/25 bg-amber-500/10 text-amber-200"
                }`}
              >
                <Info className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-500" />
                <p className="text-xs leading-relaxed">
                  Bạn cần mở link từ email để có mã xác thực hợp lệ.{" "}
                  <Link to="/forgot-password" className={`font-semibold underline ${light ? "text-[#6d28d9]" : "text-amber-300"}`}>
                    Yêu cầu link mới
                  </Link>
                </p>
              </div>
            )}

            <form onSubmit={onSubmit} className="space-y-4">
              <div>
                <label
                  htmlFor="rp-password"
                  className={`mb-1.5 block text-sm font-semibold ${light ? "text-[#2b1f47]" : "text-white"}`}
                >
                  Mật khẩu mới
                </label>
                <div className="relative">
                  <input
                    id="rp-password"
                    type={showPass ? "text" : "password"}
                    required
                    minLength={6}
                    placeholder="Tối thiểu 6 ký tự"
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      if (error) setError("");
                    }}
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
              </div>

              <div>
                <label
                  htmlFor="rp-confirm"
                  className={`mb-1.5 block text-sm font-semibold ${light ? "text-[#2b1f47]" : "text-white"}`}
                >
                  Xác nhận mật khẩu
                </label>
                <div className="relative">
                  <input
                    id="rp-confirm"
                    type={showConfirm ? "text" : "password"}
                    required
                    minLength={6}
                    placeholder="Nhập lại mật khẩu"
                    value={confirm}
                    onChange={(e) => {
                      setConfirm(e.target.value);
                      if (error) setError("");
                    }}
                    className={`${inputClass} pr-12`}
                  />
                  <button
                    data-button-surface="none"
                    type="button"
                    onClick={() => setShowConfirm(!showConfirm)}
                    className={`absolute right-4 top-1/2 -translate-y-1/2 rounded-md border-0 bg-transparent p-1 shadow-none transition-colors ${
                      light ? "text-[#7c7595] hover:text-[#1e1338]" : "text-[#b8accd] hover:text-white"
                    }`}
                    aria-label={showConfirm ? "Ẩn" : "Hiện"}
                  >
                    {showConfirm ? <EyeSlash className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading || !token}
                className="flex w-full items-center justify-center rounded-full py-3.5 text-base font-bold transition-all hover:brightness-105 active:scale-[0.98] disabled:opacity-60"
                style={AUTH_CTA_STYLE}
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="h-5 w-5 animate-spin rounded-full border-2 border-slate-900/30 border-t-slate-900" />
                    Đang lưu mật khẩu...
                  </span>
                ) : (
                  "Lưu mật khẩu mới"
                )}
              </button>
            </form>

            <p className={`mt-6 text-center text-xs sm:text-sm ${light ? "text-[#5e5875]" : "text-white/80"}`}>
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
          </>
        )}
      </div>
    </AuthShell>
  );
}
