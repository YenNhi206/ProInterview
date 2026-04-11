import React, { useState } from "react";
import { useNavigate, useSearchParams, Link } from "react-router";
import {
  AlertCircle as WarningCircle,
  Check,
  Info,
  Sparkles,
  Zap as Lightning,
} from "lucide-react";
import { loginUser, getUser } from "../utils/auth";
import { AuthShell, AUTH_INPUT_CLASS, AUTH_CTA_FRAME_CLASS } from "../components/auth/AuthShell";
import { GoogleSignInBlock } from "../components/auth/GoogleSignInBlock";

export function Login() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const isRegistered = searchParams.get("registered") === "1";

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    const result = await loginUser(email.trim(), password);
    setLoading(false);

    if (!result.success) {
      setError(result.error);
      return;
    }

    const user = getUser();
    const redirect = searchParams.get("redirect");
    if (user?.role === "mentor") {
      navigate(redirect || "/mentor/dashboard");
    } else {
      navigate(redirect || "/dashboard");
    }
  };

  const aside = (
    <div className="relative flex h-full flex-col justify-start pl-4 pt-8 sm:pt-10 lg:pl-6">
      <div
        className="mb-5 inline-flex w-fit items-center gap-2 rounded-full border px-4 py-2 text-xs font-bold"
        style={{
          background: "linear-gradient(135deg, rgba(110,53,232,0.22), rgba(196,255,71,0.08))",
          borderColor: "rgba(196, 255, 71, 0.35)",
          color: "#e8f5c8",
          boxShadow: "0 0 24px rgba(196,255,71,0.1)",
        }}
      >
        <Sparkles className="w-3.5 h-3.5 text-[#c4ff47]" />
        Cùng nền với trang chủ
      </div>
      <h2 className="mb-5 text-4xl font-black leading-[1.1] tracking-tight text-white sm:text-5xl">
        Chào bạn,
        <br />
        <span
          className="bg-clip-text text-transparent"
          style={{
            backgroundImage: "linear-gradient(135deg, #c4ff47 0%, #6E35E8 100%)",
          }}
        >
          vào luyện thôi
        </span>
      </h2>
      <p className="mb-5 max-w-md text-lg font-medium leading-relaxed text-zinc-300">
        AI phỏng vấn, mentor 1:1, so khớp CV/JD — trải nghiệm đồng bộ với trang chủ.
      </p>
      <div className="flex flex-wrap gap-3">
        {["Phỏng vấn AI", "CV & JD", "Mentor"].map((tag, i) => (
          <span
            key={tag}
            className="px-4 py-2 rounded-full text-sm font-bold border"
            style={{
              background:
                i === 0
                  ? "rgba(196,255,71,0.1)"
                  : i === 1
                    ? "rgba(255,255,255,0.06)"
                    : "rgba(110,53,232,0.12)",
              borderColor:
                i === 0
                  ? "rgba(196, 255, 71, 0.4)"
                  : i === 1
                    ? "rgba(196, 255, 71, 0.35)"
                    : "rgba(167, 139, 250, 0.35)",
              color: i === 0 ? "#e8ffc4" : "rgba(255,255,255,0.9)",
            }}
          >
            {tag}
          </span>
        ))}
      </div>
      <div
        className="mt-7 max-w-md rounded-3xl p-6"
        style={{
          background: "linear-gradient(180deg, rgba(255,255,255,0.07), rgba(255,255,255,0.03))",
          border: "1px solid rgba(255,255,255,0.12)",
          boxShadow:
            "0 12px 40px rgba(0,0,0,0.3), 0 0 0 1px rgba(196, 255, 71, 0.08) inset",
          backdropFilter: "blur(14px)",
        }}
      >
        <div className="flex gap-1 mb-3 text-lg">
          <span style={{ color: "#c4ff47" }}>★★</span>
          <span style={{ color: "#FF8C42" }}>★</span>
          <span style={{ color: "#c4ff47" }}>★★</span>
        </div>
        <p className="font-semibold leading-relaxed italic text-[15px] text-white/80">
          &ldquo;ProInterview đã giúp mình tự tin hơn — phỏng vấn thử rất sát thực tế.&rdquo;
        </p>
        <p className="mt-4 text-sm font-bold text-zinc-400">— Học viên</p>
      </div>
    </div>
  );

  const errorIsGoogleEnvHint = Boolean(
    error && /VITE_GOOGLE|Google chưa được bật|thiếu.*CLIENT_ID/i.test(error),
  );

  return (
    <AuthShell
      aside={aside}
      footerNote={
        <Link
          to="/register"
          className="hidden items-center gap-1.5 rounded-full border border-white/15 px-4 py-2 text-sm font-semibold text-white/75 transition-colors hover:border-white/25 hover:bg-white/8 hover:text-white sm:inline-flex"
        >
          Chưa có tài khoản?{" "}
          <span className="text-[#c4ff47] drop-shadow-[0_0_8px_rgba(196,255,71,0.35)]">Đăng ký</span>
        </Link>
      }
    >
      <div className="flex items-center gap-2 mb-2">
        <Lightning className="w-5 h-5" style={{ color: "#c4ff47" }} />
        <span className="text-xs font-bold uppercase tracking-widest text-zinc-400">Đăng nhập</span>
      </div>
      <h1 className="text-3xl font-black tracking-tight mb-2 text-white">Chào mừng trở lại</h1>
      <p className="font-medium mb-8 text-zinc-300">Đăng nhập để tiếp tục hành trình của bạn.</p>

      {isRegistered && (
        <div
          className="flex items-start gap-3 rounded-2xl px-4 py-3 mb-6 border"
          style={{
            background: "rgba(196, 255, 71,0.1)",
            borderColor: "rgba(196, 255, 71,0.35)",
          }}
        >
          <Check className="w-5 h-5 flex-shrink-0 mt-0.5" style={{ color: "#c4ff47" }} />
          <p className="text-sm font-semibold" style={{ color: "#d4f573" }}>
            Đăng ký thành công — vui lòng đăng nhập.
          </p>
        </div>
      )}

      {error && (
        <div
          className={`mb-6 flex items-start gap-3 rounded-2xl border px-4 py-3.5 ${
            errorIsGoogleEnvHint
              ? "border-amber-400/25 bg-amber-950/35 text-amber-50"
              : "border-red-400/20 bg-red-950/30 text-red-100"
          }`}
        >
          {errorIsGoogleEnvHint ? (
            <Info className="mt-0.5 h-5 w-5 flex-shrink-0 text-amber-300/90" strokeWidth={2} />
          ) : (
            <WarningCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-red-300/90" />
          )}
          <p className="text-sm font-medium leading-relaxed opacity-95">{error}</p>
        </div>
      )}

      <form onSubmit={handleLogin} className="space-y-5">
        <div>
          <label htmlFor="email" className="block text-xs font-bold mb-2 ml-1 text-zinc-400">
            Địa chỉ email
          </label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            placeholder="ban@congty.com"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              if (error) setError("");
            }}
            required
            className={AUTH_INPUT_CLASS}
          />
        </div>
        <div>
          <div className="flex justify-between items-center mb-2 ml-1">
            <label htmlFor="password" className="text-xs font-bold text-zinc-400">
              Mật khẩu
            </label>
            <span className="text-xs font-bold cursor-not-allowed text-zinc-500">Quên mật khẩu?</span>
          </div>
          <input
            id="password"
            type="password"
            autoComplete="current-password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              if (error) setError("");
            }}
            required
            className={AUTH_INPUT_CLASS}
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className={`${AUTH_CTA_FRAME_CLASS} font-black text-base transition-all active:scale-[0.98] disabled:opacity-60 text-[#0a0814]`}
          style={{
            background: "linear-gradient(135deg, #c4ff47, #8fbc24)",
            boxShadow: "0 8px 28px rgba(196, 255, 71,0.22)",
            border: "none",
          }}
        >
          {loading ? (
            <span className="flex items-center justify-center gap-2">
              <span className="w-5 h-5 border-2 border-black/20 border-t-black/70 rounded-full animate-spin" />
              Đang đăng nhập...
            </span>
          ) : (
            "Đăng nhập"
          )}
        </button>
      </form>

      <div className="relative my-8 flex items-center" role="separator" aria-label="Hoặc">
        <div
          className="h-px flex-1 bg-gradient-to-r from-transparent via-white/[0.14] to-transparent"
          aria-hidden
        />
        <span className="mx-4 shrink-0 rounded-full border border-white/10 bg-white/[0.05] px-3.5 py-1.5 text-[10px] font-bold uppercase tracking-[0.22em] text-zinc-400">
          hoặc
        </span>
        <div
          className="h-px flex-1 bg-gradient-to-l from-transparent via-white/[0.14] to-transparent"
          aria-hidden
        />
      </div>
      <div className="mt-4">
        <GoogleSignInBlock onError={setError} />
      </div>

      <p className="mt-8 text-center text-sm font-semibold text-zinc-300">
        Chưa có tài khoản?{" "}
        <Link
          to="/register"
          className="font-black text-[#c4ff47] hover:text-[#e8ffc4] hover:underline underline-offset-4 drop-shadow-[0_0_10px_rgba(196,255,71,0.25)]"
        >
          Đăng ký ngay
        </Link>
      </p>
    </AuthShell>
  );
}
