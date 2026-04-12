import React, { useState } from "react";
import { useNavigate, useSearchParams, Link } from "react-router";
import {
  Eye,
  EyeOff as EyeSlash,
  Check,
  AlertCircle as WarningCircle,
  Info,
  Brain,
  Sparkles,
  Bot,
  FileText,
  Crosshair,
} from "lucide-react";
import { registerUser } from "../utils/auth";
import { AuthShell, AUTH_INPUT_CLASS, AUTH_CTA_FRAME_CLASS } from "../components/auth/AuthShell";
import { GoogleSignInBlock } from "../components/auth/GoogleSignInBlock";

const PERKS = [
  { t: "3 buổi phỏng vấn AI miễn phí", Icon: Bot },
  { t: "Phân tích CV/JD", Icon: FileText },
  { t: "Câu hỏi theo ngành", Icon: Crosshair },
];

export function Register() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
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

  const handleRegister = async (e) => {
    e.preventDefault();
    if (!agreed) return;
    setLoading(true);
    setError("");

    if (form.role === "admin" && !form.adminInviteCode.trim()) {
      setError("Vui lòng nhập mã mời quản trị (ADMIN_INVITE_CODE trùng với backend).");
      setLoading(false);
      return;
    }

    const result = await registerUser({
      name: form.name.trim(),
      email: form.email.trim(),
      password: form.password,
      role: form.role,
      ...(form.role === "admin" ? { adminInviteCode: form.adminInviteCode.trim() } : {}),
    });

    setLoading(false);

    if (!result.success) {
      setError(result.error);
      return;
    }

    const redirect = searchParams.get("redirect");
    navigate(redirect || "/login?registered=1");
  };

  const handleChange = (k, v) => {
    setForm((f) => ({ ...f, [k]: v }));
    if (error) setError("");
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
        <Brain className="w-3.5 h-3.5 text-[#c4ff47]" />
        Gói miễn phí
      </div>
      <h2 className="mb-5 text-4xl font-black leading-[1.1] tracking-tight text-white sm:text-5xl">
        Tạo tài khoản,
        <br />
        <span
          className="bg-clip-text text-transparent"
          style={{
            backgroundImage: "linear-gradient(135deg, #c4ff47 0%, #9B6DFF 100%)",
          }}
        >
          bắt đầu miễn phí
        </span>
      </h2>
      <p className="mb-4 max-w-md text-lg font-medium leading-relaxed text-zinc-300">
        Miễn phí · Không cần thẻ · Cùng giao diện tối như trang chủ.
      </p>
      <ul className="max-w-md space-y-3">
        {PERKS.map(({ t, Icon }) => (
          <li
            key={t}
            className="flex items-center gap-4 p-4 rounded-2xl border border-white/[0.1] bg-white/[0.04] transition-colors hover:border-[#c4ff47]/25"
          >
            <div
              className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl border border-[#c4ff47]/25 bg-[#c4ff47]/[0.08]"
              aria-hidden
            >
              <Icon className="h-5 w-5 text-[#c4ff47]" strokeWidth={1.75} />
            </div>
            <span className="font-bold text-white/90">{t}</span>
          </li>
        ))}
      </ul>
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
          to="/login"
          className="hidden items-center gap-1.5 rounded-full border border-white/15 px-4 py-2 text-sm font-semibold text-white/75 transition-colors hover:border-white/25 hover:bg-white/8 hover:text-white sm:inline-flex"
        >
          Đã có tài khoản?{" "}
          <span className="text-[#c4ff47] drop-shadow-[0_0_8px_rgba(196,255,71,0.35)]">Đăng nhập</span>
        </Link>
      }
    >
      <div className="flex items-center gap-2 mb-2">
        <Sparkles className="h-5 w-5 text-[#c4ff47]" strokeWidth={1.75} aria-hidden />
        <span className="text-xs font-bold uppercase tracking-widest text-zinc-400">Đăng ký</span>
      </div>
      <h1 className="text-3xl font-black tracking-tight mb-2 text-white">Tạo tài khoản</h1>
      <p className="font-medium mb-8 text-zinc-300">Miễn phí · Không cần thẻ · 3 buổi AI ngay sau đăng ký</p>

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

      <form onSubmit={handleRegister} className="space-y-4">
        <div>
          <label className="block text-xs font-bold mb-2 ml-1 text-zinc-400">Họ và tên</label>
          <input
            type="text"
            placeholder="Nguyễn Văn A"
            value={form.name}
            onChange={(e) => handleChange("name", e.target.value)}
            required
            className={AUTH_INPUT_CLASS}
          />
        </div>
        <div>
          <label className="block text-xs font-bold mb-2 ml-1 text-zinc-400">Địa chỉ email</label>
          <input
            type="email"
            placeholder="ban@congty.com"
            value={form.email}
            onChange={(e) => handleChange("email", e.target.value)}
            required
            className={AUTH_INPUT_CLASS}
          />
        </div>
        <div>
          <label className="block text-xs font-bold mb-2 ml-1 text-zinc-400">Mật khẩu</label>
          <div className="relative">
            <input
              type={showPass ? "text" : "password"}
              placeholder="Ít nhất 6 ký tự"
              value={form.password}
              onChange={(e) => handleChange("password", e.target.value)}
              required
              minLength={6}
              className={`${AUTH_INPUT_CLASS} pr-12`}
            />
            <button
              type="button"
              onClick={() => setShowPass(!showPass)}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-200 transition-colors"
              aria-label={showPass ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
            >
              {showPass ? <EyeSlash className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
            </button>
          </div>
        </div>

        <div>
          <label className="mb-2 ml-1 block text-xs font-bold text-zinc-400">Loại tài khoản</label>
          <div className="flex flex-wrap gap-2">
            {[
              { id: "customer", label: "Học viên" },
              { id: "mentor", label: "Mentor" },
              { id: "admin", label: "Quản trị viên" },
            ].map(({ id, label }) => (
              <button
                key={id}
                type="button"
                onClick={() => {
                  handleChange("role", id);
                  if (id !== "admin") handleChange("adminInviteCode", "");
                }}
                className={`rounded-full border px-4 py-2 text-xs font-bold transition-all ${
                  form.role === id
                    ? "border-[#c4ff47]/50 bg-[#c4ff47]/15 text-[#e8ffc4]"
                    : "border-white/15 bg-white/[0.04] text-zinc-400 hover:border-white/25 hover:text-zinc-200"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          {form.role === "admin" && (
            <p className="mt-2 text-[11px] leading-relaxed text-amber-200/90">
              Cần biến <span className="font-mono text-[10px]">ADMIN_INVITE_CODE</span> trong backend{" "}
              <span className="font-mono text-[10px]">.env</span> — nhập đúng mã bên dưới.
            </p>
          )}
        </div>

        {form.role === "admin" && (
          <div>
            <label className="mb-2 ml-1 block text-xs font-bold text-zinc-400">Mã mời quản trị</label>
            <input
              type="password"
              autoComplete="off"
              placeholder="Mã từ ADMIN_INVITE_CODE"
              value={form.adminInviteCode}
              onChange={(e) => handleChange("adminInviteCode", e.target.value)}
              className={AUTH_INPUT_CLASS}
            />
          </div>
        )}

        <label className="flex items-start gap-3 cursor-pointer pt-2">
          <button
            type="button"
            onClick={() => setAgreed(!agreed)}
            className="mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-md border-2 transition-colors"
            style={{
              background: agreed
                ? "linear-gradient(135deg, #c4ff47, #8fbc24)"
                : "transparent",
              borderColor: agreed ? "rgba(196,255,71,0.5)" : "rgba(255,255,255,0.28)",
            }}
          >
            {agreed && <Check className="w-3.5 h-3.5 text-[#0a0a0c]" strokeWidth={3} />}
          </button>
          <span className="text-xs leading-relaxed font-medium text-zinc-300">
            Tôi đồng ý với{" "}
            <a href="#" className="font-bold text-[#c4ff47] hover:text-[#e8ffc4] hover:underline underline-offset-2">
              Điều khoản dịch vụ
            </a>{" "}
            và{" "}
            <a href="#" className="font-bold text-[#c4ff47] hover:text-[#e8ffc4] hover:underline underline-offset-2">
              Chính sách bảo mật
            </a>
            .
          </span>
        </label>

        <button
          type="submit"
          disabled={loading || !agreed}
          className={`${AUTH_CTA_FRAME_CLASS} font-black text-base transition-all active:scale-[0.98] disabled:opacity-40 ${
            agreed ? "text-[#0a0814]" : "text-white/50"
          }`}
          style={{
            background: agreed
              ? "linear-gradient(135deg, #c4ff47, #8fbc24)"
              : "rgba(255,255,255,0.08)",
            boxShadow: agreed ? "0 8px 28px rgba(196, 255, 71, 0.22)" : "none",
            border: agreed ? "none" : "1px solid rgba(255,255,255,0.12)",
          }}
        >
          {loading ? (
            <span className="flex items-center justify-center gap-2">
              <span className="w-5 h-5 border-2 border-black/20 border-t-black/70 rounded-full animate-spin" />
              Đang tạo tài khoản...
            </span>
          ) : (
            "Tạo tài khoản miễn phí"
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
        Đã có tài khoản?{" "}
        <Link
          to="/login"
          className="font-black text-[#c4ff47] hover:text-[#e8ffc4] hover:underline underline-offset-4 drop-shadow-[0_0_10px_rgba(196,255,71,0.25)]"
        >
          Đăng nhập ngay
        </Link>
      </p>
    </AuthShell>
  );
}
