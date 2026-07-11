import React, { useState } from "react";
import { Link, useNavigate } from "react-router";
import { CheckCircle2, AlertCircle, Info, Mail } from "lucide-react";
import { BrandLogo } from "../../components/brand/BrandLogo";
import { SparkleGlyph } from "../../components/decor/SparkleGlyph.jsx";
import { AuthPurpleBackdrop } from "../../components/auth/AuthPurpleBackdrop";
import { getBrandClickPath, requestPasswordReset } from "../../utils/auth/auth.js";
import { toastApiError } from "../../utils/shared/apiToast.js";
import { AUTH_COPY } from "../../constants/brandVoice";

const INPUT_CLS =
  "w-full px-4 py-3.5 rounded-xl border border-gray-200 text-base outline-none transition-all " +
  "focus:border-[#8037f4] focus:ring-2 focus:ring-[#8037f4]/15 text-gray-900 placeholder-gray-400 " +
  "bg-white hover:bg-gray-50/50";

const AUTH_STICKS = [
  { x: 12, y: 24, size: 24 },
  { x: 84, y: 18, size: 32 },
  { x: 16, y: 78, size: 20 },
  { x: 78, y: 76, size: 28 },
];

const PRIMARY_BTN =
  "flex w-full items-center justify-center rounded-full py-3.5 text-base font-bold text-white transition-all hover:brightness-110 active:scale-[0.98] disabled:opacity-60";

function AuthTopBar({ right }) {
  const navigate = useNavigate();
  return (
    <div
      className="relative z-10 flex h-20 flex-shrink-0 items-center justify-between border-b px-6 backdrop-blur-md sm:px-10"
      style={{
        borderColor: "rgba(128,55,244,0.12)",
        background: "rgba(255,255,255,0.75)",
      }}
    >
      <button
        type="button"
        onClick={() => navigate(getBrandClickPath())}
        className="group flex items-center gap-2.5"
        aria-label="Về trang chủ"
      >
        <BrandLogo size="auth" />
      </button>
      {right}
    </div>
  );
}

export function ForgotPassword() {
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

  return (
    <div
      className="relative flex min-h-[100dvh] flex-col overflow-y-auto bg-[#dcd2eb]"
      style={{ fontFamily: "'Lexend', 'Plus Jakarta Sans', system-ui, sans-serif" }}
    >
      <AuthPurpleBackdrop />

      <div className="relative z-[1] flex min-h-0 flex-1 flex-col">
        <div className="pointer-events-none absolute inset-4 z-0 hidden md:block md:inset-6" aria-hidden>
          {AUTH_STICKS.map((s, idx) => (
            <SparkleGlyph
              key={`fp-stick-${idx}`}
              className="absolute"
              style={{
                left: `${s.x}%`,
                top: `${s.y}%`,
                width: `${s.size}px`,
                height: `${s.size}px`,
                filter: "drop-shadow(0 1px 2px rgba(15,23,42,0.12)) drop-shadow(0 0 8px rgba(95,0,240,0.35))",
                transform: `translate(-50%, -50%) rotate(${idx % 2 === 0 ? 12 : -20}deg)`,
              }}
            />
          ))}
        </div>

        <AuthTopBar
          right={
            <p className="text-sm text-gray-500">
              Nhớ mật khẩu?{" "}
              <Link to="/login" className="font-semibold hover:underline" style={{ color: "#8037f4" }}>
                Đăng nhập
              </Link>
            </p>
          }
        />

        <div className="relative z-10 flex flex-1 items-center justify-center px-6 py-8 sm:px-10">
          <div className="w-full max-w-md rounded-3xl border border-violet-100/80 bg-white p-8 shadow-[0_12px_40px_rgba(128,55,244,0.08)] sm:p-10">
            {sent ? (
              <div className="text-center">
                <div
                  className="mx-auto mb-5 flex h-[4.25rem] w-[4.25rem] items-center justify-center rounded-full"
                  style={{ background: "rgba(128,55,244,0.1)" }}
                >
                  <CheckCircle2 className="h-9 w-9" style={{ color: "#8037f4" }} strokeWidth={2.25} />
                </div>

                <h1
                  className="mb-2 text-gray-900"
                  style={{ fontSize: "1.75rem", fontWeight: 750, letterSpacing: "-0.025em" }}
                >
                  {AUTH_COPY.forgotPasswordSentTitle}
                </h1>

                <p className="mx-auto mb-1 max-w-sm text-sm leading-relaxed text-gray-600">
                  {AUTH_COPY.forgotPasswordSentBody}
                </p>

                {email ? (
                  <p className="mx-auto mb-6 inline-flex max-w-full items-center justify-center gap-2 rounded-full border border-violet-200/80 bg-violet-50/60 px-4 py-2 text-sm font-semibold text-violet-900">
                    <Mail className="h-4 w-4 shrink-0 text-violet-600" aria-hidden />
                    <span className="truncate">{email}</span>
                  </p>
                ) : (
                  <div className="mb-6" />
                )}

                {import.meta.env.DEV && devResetUrl ? (
                  <details className="mb-5 rounded-2xl border border-dashed border-violet-200/90 bg-violet-50/40 px-4 py-3 text-left">
                    <summary className="cursor-pointer text-xs font-semibold text-violet-700">
                      Dev, link đặt lại (không gửi email)
                    </summary>
                    <a
                      href={devResetUrl}
                      className="mt-2 block break-all text-xs font-medium text-[#8037f4] hover:underline"
                    >
                      {devResetUrl}
                    </a>
                  </details>
                ) : null}

                <Link
                  to="/login"
                  className={PRIMARY_BTN}
                  style={{
                    background: "#8037f4",
                    boxShadow: "0 4px 20px rgba(128,55,244,0.3)",
                  }}
                >
                  Về trang đăng nhập
                </Link>
              </div>
            ) : (
              <>
                <h1
                  className="mb-1 text-gray-900"
                  style={{ fontSize: "1.875rem", fontWeight: 750, letterSpacing: "-0.025em" }}
                >
                  Quên mật khẩu
                </h1>
                <p className="mb-6 text-sm leading-relaxed text-gray-500">{AUTH_COPY.forgotPasswordSubtitle}</p>

                {error && (
                  <div className="mb-5 flex items-start gap-3 rounded-2xl border border-red-300/40 bg-red-50 px-4 py-3 text-sm text-red-700">
                    <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-red-400" />
                    <p className="font-medium">{error}</p>
                  </div>
                )}

                <form onSubmit={onSubmit} className="space-y-4">
                  <div>
                    <label htmlFor="fp-email" className="mb-1.5 block text-sm font-semibold text-gray-700">
                      Email
                    </label>
                    <input
                      id="fp-email"
                      type="email"
                      required
                      autoComplete="email"
                      className={INPUT_CLS}
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="email@example.com"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className={PRIMARY_BTN}
                    style={{
                      background: "#8037f4",
                      boxShadow: "0 4px 20px rgba(128,55,244,0.3)",
                    }}
                  >
                    {loading ? (
                      <span className="flex items-center justify-center gap-2">
                        <span className="h-5 w-5 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                        Đang gửi...
                      </span>
                    ) : (
                      "Gửi link đặt lại"
                    )}
                  </button>

                  <div
                    className="flex items-start gap-2.5 rounded-2xl border px-4 py-3"
                    style={{
                      background: "rgba(128,55,244,0.04)",
                      borderColor: "rgba(128,55,244,0.12)",
                    }}
                  >
                    <Info className="mt-0.5 h-4 w-4 flex-shrink-0 text-violet-500" />
                    <p className="text-xs leading-relaxed text-gray-600">
                      Nếu bạn đăng nhập bằng Google và chưa đặt mật khẩu, dùng nút Google ở trang đăng nhập hoặc đặt
                      mật khẩu trong{" "}
                      <span className="font-semibold text-gray-800">Cài đặt → Bảo mật</span>.
                    </p>
                  </div>
                </form>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
