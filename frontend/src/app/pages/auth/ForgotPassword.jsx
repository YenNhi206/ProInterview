import React, { useState } from "react";
import { Link } from "react-router";
import { CheckCircle2, AlertCircle, Mail } from "lucide-react";
import { AuthShell } from "../../components/auth/AuthShell.jsx";
import { useWorkspaceTheme } from "../../hooks/useWorkspaceTheme.js";
import { requestPasswordReset } from "../../utils/auth/auth.js";
import { toastApiError } from "../../utils/shared/apiToast.js";
import { AUTH_COPY } from "../../constants/brandVoice";

const BRAND_LIME = "#93f72b";

const AUTH_CTA_STYLE = {
  background: BRAND_LIME,
  color: "#0f172a",
  boxShadow: "0 4px 14px rgba(147, 247, 43, 0.12)",
};

export function ForgotPassword() {
  const theme = useWorkspaceTheme(true);
  const light = theme.resolved === "light";

  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [devResetUrl, setDevResetUrl] = useState("");
  const [error, setError] = useState("");

  const onSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    const trimmed = email.trim();
    const res = await requestPasswordReset(trimmed);
    setLoading(false);
    if (!res.success) {
      const msg = res.error || "Không thể gửi yêu cầu. Vui lòng thử lại.";
      setError(msg);
      toastApiError(msg);
      return;
    }
    setEmail(trimmed);
    setSent(true);
    setDevResetUrl(res.resetUrl || "");
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
        {sent ? (
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
              {AUTH_COPY.forgotPasswordSentTitle}
            </h1>

            <p className={`mx-auto mb-3 max-w-sm text-sm leading-relaxed ${light ? "text-[#5e5875]" : "text-white/80"}`}>
              {AUTH_COPY.forgotPasswordSentBody}
            </p>

            {email && (
              <p
                className={`mx-auto mb-6 inline-flex max-w-full items-center justify-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold ${
                  light
                    ? "border-violet-200 bg-violet-50 text-[#6d28d9]"
                    : "border-white/15 bg-white/5 text-violet-300"
                }`}
              >
                <Mail className="h-4 w-4 shrink-0 text-violet-500" aria-hidden />
                <span className="truncate">{email}</span>
              </p>
            )}

            {import.meta.env.DEV && devResetUrl ? (
              <details
                className={`mb-5 rounded-2xl border border-dashed px-4 py-3 text-left ${
                  light ? "border-violet-300 bg-violet-50/50" : "border-white/20 bg-white/5"
                }`}
              >
                <summary className={`cursor-pointer text-xs font-semibold ${light ? "text-violet-700" : "text-violet-300"}`}>
                  Dev: link đặt lại (không gửi email)
                </summary>
                <a
                  href={devResetUrl}
                  className="mt-2 block break-all text-xs font-medium text-[#7c3aed] hover:underline"
                >
                  {devResetUrl}
                </a>
              </details>
            ) : null}

            <Link
              to="/login"
              className="flex w-full items-center justify-center rounded-full py-3.5 text-base font-bold transition-all hover:brightness-105 active:scale-[0.98]"
              style={AUTH_CTA_STYLE}
            >
              Về trang đăng nhập
            </Link>
          </div>
        ) : (
          <>
            <h1
              className={`mb-1 font-black tracking-tight ${light ? "text-[#1e1338]" : "text-white"}`}
              style={{ fontSize: "1.875rem", letterSpacing: "-0.025em" }}
            >
              Quên mật khẩu
            </h1>
            <p className={`mb-6 text-sm leading-relaxed ${light ? "text-[#5e5875]" : "text-white/80"}`}>
              {AUTH_COPY.forgotPasswordSubtitle}
            </p>

            {error && (
              <div className="mb-5 flex items-start gap-3 rounded-2xl border border-red-300/40 bg-red-50 px-4 py-3 text-sm text-red-700">
                <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-red-400" />
                <p className="font-medium">{error}</p>
              </div>
            )}

            <form onSubmit={onSubmit} className="space-y-4">
              <div>
                <label
                  htmlFor="fp-email"
                  className={`mb-1.5 block text-sm font-semibold ${light ? "text-[#2b1f47]" : "text-white"}`}
                >
                  Email tài khoản
                </label>
                <input
                  id="fp-email"
                  type="email"
                  autoComplete="email"
                  required
                  placeholder="email@example.com"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (error) setError("");
                  }}
                  className={inputClass}
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="flex w-full items-center justify-center rounded-full py-3.5 text-base font-bold transition-all hover:brightness-105 active:scale-[0.98] disabled:opacity-60"
                style={AUTH_CTA_STYLE}
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="h-5 w-5 animate-spin rounded-full border-2 border-slate-900/30 border-t-slate-900" />
                    Đang gửi yêu cầu...
                  </span>
                ) : (
                  "Gửi link đặt lại mật khẩu"
                )}
              </button>
            </form>

            <p className={`mt-6 text-center text-xs sm:text-sm ${light ? "text-[#5e5875]" : "text-white/80"}`}>
              Nhớ mật khẩu?{" "}
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
