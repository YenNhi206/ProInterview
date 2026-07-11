import React, { useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import { CheckCircle2, AlertCircle, Info, Eye, EyeOff as EyeSlash } from "lucide-react";
import { BrandLogo } from "../../components/brand/BrandLogo";
import { SparkleGlyph } from "../../components/decor/SparkleGlyph.jsx";
import { AuthPurpleBackdrop } from "../../components/auth/AuthPurpleBackdrop";
import { getBrandClickPath, resetPassword } from "../../utils/auth/auth.js";
import { toastApiError } from "../../utils/shared/apiToast.js";
import { AUTH_COPY } from "../../constants/brandVoice";

const INPUT_CLS =
  "w-full px-4 py-3.5 rounded-xl border border-gray-200 text-base outline-none transition-all " +
  "focus:border-[#8037f4] focus:ring-2 focus:ring-[#8037f4]/15 text-gray-900 placeholder-gray-400 " +
  "bg-white hover:bg-gray-50/50";

const AUTH_STICKS = [
  { x: 14, y: 22, size: 26 },
  { x: 82, y: 20, size: 36 },
  { x: 18, y: 72, size: 22 },
  { x: 80, y: 74, size: 30 },
];

const PRIMARY_BTN =
  "flex w-full items-center justify-center rounded-full py-3.5 text-base font-bold text-white transition-all hover:brightness-110 active:scale-[0.98] disabled:opacity-60";

export function ResetPassword() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = useMemo(() => (searchParams.get("token") || "").trim(), [searchParams]);

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
      const msg = res.error || "Có lỗi xảy ra. Vui lòng thử lại sau.";
      setError(msg);
      toastApiError(msg);
    }
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
              key={`rp-stick-${idx}`}
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
          <p className="text-sm text-gray-500">
            Đã có mật khẩu?{" "}
            <Link to="/login" className="font-semibold hover:underline" style={{ color: "#8037f4" }}>
              Đăng nhập
            </Link>
          </p>
        </div>

        <div className="relative z-10 flex flex-1 items-center justify-center px-6 py-8 sm:px-10">
          <div className="w-full max-w-md rounded-3xl border border-violet-100/80 bg-white p-8 shadow-[0_12px_40px_rgba(128,55,244,0.08)] sm:p-10">
            {done ? (
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
                  {AUTH_COPY.resetPasswordDoneTitle}
                </h1>
                <p className="mb-8 text-sm leading-relaxed text-gray-600">{AUTH_COPY.resetPasswordDoneBody}</p>
                <Link
                  to="/login"
                  className={PRIMARY_BTN}
                  style={{
                    background: "#8037f4",
                    boxShadow: "0 4px 20px rgba(128,55,244,0.3)",
                  }}
                >
                  Đăng nhập ngay
                </Link>
              </div>
            ) : (
              <>
                <h1
                  className="mb-1 text-gray-900"
                  style={{ fontSize: "1.875rem", fontWeight: 750, letterSpacing: "-0.025em" }}
                >
                  Đặt lại mật khẩu
                </h1>
                <p className="mb-6 text-sm leading-relaxed text-gray-500">{AUTH_COPY.resetPasswordSubtitle}</p>

                {error && (
                  <div className="mb-5 flex items-start gap-3 rounded-2xl border border-red-300/40 bg-red-50 px-4 py-3 text-sm text-red-700">
                    <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-red-400" />
                    <p className="font-medium">{error}</p>
                  </div>
                )}

                {!token && (
                  <div
                    className="mb-5 flex items-start gap-2.5 rounded-2xl border px-4 py-3"
                    style={{
                      background: "rgba(245,158,11,0.08)",
                      borderColor: "rgba(245,158,11,0.25)",
                    }}
                  >
                    <Info className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-600" />
                    <p className="text-xs leading-relaxed text-amber-900/90">
                      Bạn cần mở link từ email để có mã xác thực hợp lệ.{" "}
                      <Link to="/forgot-password" className="font-semibold text-[#8037f4] hover:underline">
                        Yêu cầu link mới
                      </Link>
                    </p>
                  </div>
                )}

                <form onSubmit={onSubmit} className="space-y-4">
                  <div>
                    <label htmlFor="rp-password" className="mb-1.5 block text-sm font-semibold text-gray-700">
                      Mật khẩu mới
                    </label>
                    <div className="relative">
                      <input
                        id="rp-password"
                        type={showPass ? "text" : "password"}
                        autoComplete="new-password"
                        className={`${INPUT_CLS} pr-12`}
                        placeholder="Ít nhất 6 ký tự"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowPass(!showPass)}
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 transition-colors hover:text-gray-600"
                        aria-label={showPass ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
                      >
                        {showPass ? <EyeSlash className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label htmlFor="rp-confirm" className="mb-1.5 block text-sm font-semibold text-gray-700">
                      Xác nhận mật khẩu
                    </label>
                    <div className="relative">
                      <input
                        id="rp-confirm"
                        type={showConfirm ? "text" : "password"}
                        autoComplete="new-password"
                        className={`${INPUT_CLS} pr-12`}
                        placeholder="Nhập lại mật khẩu"
                        value={confirm}
                        onChange={(e) => setConfirm(e.target.value)}
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirm(!showConfirm)}
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 transition-colors hover:text-gray-600"
                        aria-label={showConfirm ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
                      >
                        {showConfirm ? <EyeSlash className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                      </button>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={loading || !token}
                    className={PRIMARY_BTN}
                    style={{
                      background: "#8037f4",
                      boxShadow: "0 4px 20px rgba(128,55,244,0.3)",
                    }}
                  >
                    {loading ? (
                      <span className="flex items-center justify-center gap-2">
                        <span className="h-5 w-5 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                        Đang cập nhật...
                      </span>
                    ) : (
                      "Cập nhật mật khẩu"
                    )}
                  </button>
                </form>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
