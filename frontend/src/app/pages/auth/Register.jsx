import React, { useState } from "react";
import { useNavigate, useSearchParams, Link } from "react-router";
import {
  Eye,
  EyeOff as EyeSlash,
  Check,
  AlertCircle as WarningCircle,
  Info,
  Brain,
  Star,
  ShieldCheck,
  Mail,
} from "lucide-react";
import { registerUser, getBrandClickPath } from "../../utils/auth";
import { buildLoginPath } from "../../utils/authGate";
import { GoogleSignInBlock } from "../../components/auth/GoogleSignInBlock";
import { BrandLogo } from "../../components/brand/BrandLogo";
import { SparkleGlyph } from "../../components/decor/SparkleGlyph.jsx";

const PERKS = [
  "3 buổi phỏng vấn AI miễn phí ngay sau đăng ký",
  "Phân tích CV/JD không giới hạn",
  "Truy cập 500+ câu hỏi phỏng vấn theo ngành",
  "Bảng điều khiển theo dõi tiến bộ cá nhân",
];

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

/** Form đăng ký: ô hơi thấp hơn Login để vừa một màn hình */
const INPUT_REG_CLS =
  "w-full px-4 py-3 rounded-xl border border-gray-200 text-base outline-none transition-all " +
  "focus:border-[#6E35E8] focus:ring-2 focus:ring-[#6E35E8]/15 text-gray-900 placeholder-gray-400 " +
  "bg-white hover:bg-gray-50/50";
/** % = tâm sticker; kích thước lệch — nằm trong vùng inset của lớp nền */
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
  const loginHref = buildLoginPath(searchParams.get("redirect") || undefined);

  const strength = pwStrength(form.password);

  const handleRegister = async (e) => {
    e.preventDefault();
    if (!agreed) return;
    setLoading(true);
    setError("");
    if (form.role === "admin" && !form.adminInviteCode.trim()) {
      setError("Vui lòng nhập mã mời quản trị.");
      setLoading(false);
      return;
    }
    const result = await registerUser({
      name: form.name.trim(), email: form.email.trim(), password: form.password,
      role: form.role,
      ...(form.role === "admin" ? { adminInviteCode: form.adminInviteCode.trim() } : {}),
    });
    setLoading(false);
    if (!result.success) { setError(result.error); return; }
    setRegisteredEmail(form.email.trim());
  };

  const [registeredEmail, setRegisteredEmail] = useState("");

  const handleChange = (k, v) => {
    setForm((f) => ({ ...f, [k]: v }));
    if (error) setError("");
  };

  const errorIsGoogleEnvHint = Boolean(
    error && /VITE_GOOGLE|Google chưa được bật|thiếu.*CLIENT_ID/i.test(error),
  );

  if (registeredEmail) {
    return (
      <div className="h-screen bg-[#fcfaff] flex flex-col items-center justify-center px-6 text-center">
        <div className="w-full max-w-md bg-white rounded-3xl border border-gray-200 p-8 shadow-sm">
          <div className="h-20 w-20 bg-[#6E35E8]/10 rounded-full flex items-center justify-center mb-6 mx-auto">
            <Mail className="h-10 w-10 text-[#6E35E8]" />
          </div>
          <h1 className="text-3xl font-black mb-4 tracking-tight">Kiểm tra email của bạn</h1>
          <p className="text-gray-600 mb-8 leading-relaxed">
            Chúng tôi đã gửi link xác thực đến <strong className="text-gray-900">{registeredEmail}</strong>.
            Vui lòng nhấn vào link trong email để kích hoạt tài khoản trước khi đăng nhập.
          </p>
          <div className="space-y-4">
            <Link
              to={loginHref}
              className="w-full inline-flex items-center justify-center rounded-2xl px-6 py-4 text-base font-black text-white transition-all active:scale-[0.98]"
              style={{ background: "linear-gradient(135deg, #6E35E8, #9B6DFF)" }}
            >
              Về trang đăng nhập
            </Link>
            <button
              onClick={() => setRegisteredEmail("")}
              className="text-sm font-bold text-gray-500 hover:text-[#6E35E8] transition-colors"
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
      className="h-screen overflow-hidden flex relative"
      style={{ fontFamily: "'Lexend', 'Plus Jakarta Sans', system-ui, sans-serif" }}
    >
      {/* ── LEFT ───────────────────────────────────────────── */}
      <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden bg-[#fcfaff]">
        <div className="pointer-events-none absolute inset-4 z-0 hidden md:block md:inset-6" aria-hidden>
          {AUTH_STICKS.map((s, idx) => (
            <SparkleGlyph
              key={`register-stick-${idx}`}
              className="absolute"
              style={{
                left: `${s.x}%`,
                top: `${s.y}%`,
                width: `${s.size}px`,
                height: `${s.size}px`,
                opacity: 1,
                filter: "drop-shadow(0 1px 2px rgba(15,23,42,0.12)) drop-shadow(0 0 8px rgba(95,0,240,0.35))",
                transform: `translate(-50%, -50%) rotate(${
                  typeof s.tilt === "number" ? s.tilt : idx % 4 === 0 ? 0 : idx % 4 === 1 ? -18 : idx % 4 === 2 ? 24 : -30
                }deg)`,
              }}
            />
          ))}
        </div>

        {/* Top bar */}
        <div
          className="relative z-10 flex h-20 flex-shrink-0 items-center justify-between border-b px-10"
          style={{ borderColor: "rgba(110,53,232,0.1)" }}
        >
          <button onClick={() => navigate(getBrandClickPath())} className="flex items-center gap-2.5 group">
            <BrandLogo />
          </button>
          <p className="text-sm text-gray-500">
            Đã có tài khoản?{" "}
            <Link to={loginHref} className="font-semibold hover:underline" style={{ color: "#6E35E8" }}>
              Đăng nhập
            </Link>
          </p>
        </div>

        {/* Form — centered within panel */}
        <div className="relative z-10 flex min-h-0 flex-1 flex-col items-center justify-center overflow-y-auto px-8 py-2 sm:px-10">
          <div className="w-full max-w-sm shrink-0">

            <h1 className="text-gray-900 mb-0.5"
              style={{ fontSize: "1.625rem", fontWeight: 750, letterSpacing: "-0.025em" }}>
              Tạo tài khoản
            </h1>
            <p className="text-gray-500 text-xs sm:text-sm mb-2">
              Miễn phí · 3 buổi AI · Không cần thẻ
            </p>

            {/* Error */}
            {error && (
              <div className={`mb-3 flex items-start gap-2 rounded-xl border px-3 py-2 text-sm ${errorIsGoogleEnvHint
                  ? "border-amber-400/25 bg-amber-50 text-amber-800"
                  : "border-red-300/40 bg-red-50 text-red-700"
                }`}>
                {errorIsGoogleEnvHint
                  ? <Info className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-500" strokeWidth={2} />
                  : <WarningCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-red-400" />}
                <p className="font-medium">{error}</p>
              </div>
            )}

            <form onSubmit={handleRegister} className="space-y-2">
              {/* Name */}
              <div>
                <label htmlFor="reg-name" className="mb-1 block text-xs font-semibold text-gray-700 sm:text-sm">Họ và tên</label>
                <input id="reg-name" type="text" placeholder="Nguyễn Văn A"
                  value={form.name} onChange={(e) => handleChange("name", e.target.value)}
                  required className={INPUT_REG_CLS} />
              </div>

              {/* Email */}
              <div>
                <label htmlFor="reg-email" className="mb-1 block text-xs font-semibold text-gray-700 sm:text-sm">Email</label>
                <input id="reg-email" type="email" placeholder="email@example.com"
                  value={form.email} onChange={(e) => handleChange("email", e.target.value)}
                  required className={INPUT_REG_CLS} />
              </div>

              {/* Password */}
              <div>
                <label htmlFor="reg-password" className="mb-1 block text-xs font-semibold text-gray-700 sm:text-sm">Mật khẩu</label>
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
                {form.password.length > 0 && (
                  <div className="mt-1 flex items-center gap-1.5">
                    {[1, 2, 3].map((lvl) => (
                      <div key={lvl} className="h-0.5 flex-1 rounded-full transition-all duration-300"
                        style={{ background: strength >= lvl ? STRENGTH_COLORS[strength - 1] : "#E5E7EB" }} />
                    ))}
                    <span className="ml-0.5 text-[10px] font-semibold sm:text-xs" style={{ color: STRENGTH_COLORS[strength - 1] }}>
                      {STRENGTH_LABELS[strength - 1]}
                    </span>
                  </div>
                )}
              </div>


              {form.role === "admin" && (
                <div>
                  <label className="mb-1 block text-xs font-semibold text-gray-700 sm:text-sm">Mã mời quản trị</label>
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
                    background: agreed ? "linear-gradient(135deg,#6E35E8,#8B4DFF)" : "transparent",
                    borderColor: agreed ? "rgba(110,53,232,0.6)" : "#D1D5DB",
                  }}>
                  {agreed && <Check className="w-3 h-3 text-white" strokeWidth={3} />}
                </button>
                <span className="text-xs leading-snug text-gray-500 sm:text-sm">
                  Tôi đồng ý{" "}
                  <a href="#" className="font-semibold text-[#6E35E8] hover:underline">Điều khoản</a>{" "}và{" "}
                  <a href="#" className="font-semibold text-[#6E35E8] hover:underline">Bảo mật</a>.
                </span>
              </label>

              {/* Submit */}
              <button type="submit" disabled={loading || !agreed}
                className="w-full rounded-full py-3 text-sm font-bold text-white transition-all hover:brightness-110 active:scale-[0.98] disabled:opacity-50 sm:text-base"
                style={{
                  background: "linear-gradient(135deg, #6E35E8, #9B6DFF)",
                  boxShadow: agreed ? "0 4px 20px rgba(110,53,232,0.3)" : "none",
                }}>
                {loading
                  ? <span className="flex items-center justify-center gap-2">
                    <span className="w-5 h-5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                    Đang tạo tài khoản...
                  </span>
                  : "Tạo tài khoản"}
              </button>
            </form>

            {/* Divider */}
            <div className="my-3 flex items-center gap-3 sm:my-4">
              <div className="flex-1 h-px bg-gray-100" />
              <span className="text-xs font-medium text-gray-400">hoặc</span>
              <div className="flex-1 h-px bg-gray-100" />
            </div>

            <GoogleSignInBlock onError={setError} />

            <p className="mt-3 flex items-start justify-center gap-1.5 text-center text-[11px] leading-snug text-gray-500">
              <ShieldCheck className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-[#6E35E8]" strokeWidth={2} />
              <span>
                Mã hóa an toàn · Không bán dữ liệu.
              </span>
            </p>

          </div>
        </div>
      </div>

      {/* ── RIGHT ──────────────────────────────────────────── */}
      <div
        className="hidden lg:flex flex-col flex-1 h-full relative overflow-hidden"
        style={{ background: "linear-gradient(165deg, #FAF8FF 0%, #F0E8FF 42%, #E6E0FF 100%)" }}
      >
        <div className="absolute -top-20 -right-20 w-96 h-96 rounded-full opacity-25 blur-3xl pointer-events-none"
          style={{ background: "radial-gradient(circle, #6E35E8 0%, transparent 70%)" }} />
        <div className="absolute -bottom-24 -left-16 w-[22rem] h-[22rem] rounded-full opacity-20 blur-3xl pointer-events-none"
          style={{ background: "radial-gradient(circle, #9B6DFF 0%, transparent 72%)" }} />

        {/* Badge + card: badge trong luồng flex để không đè lên thẻ khi căn giữa dọc */}
        <div className="relative z-10 flex min-h-0 flex-1 flex-col px-10 pb-6 pt-8">
          <div className="mb-4 shrink-0 self-start">
            <div className="flex items-center gap-2 rounded-2xl bg-white px-4 py-2.5 shadow-lg"
              style={{ border: "1px solid rgba(180,245,0,0.35)" }}>
              <div className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full" style={{ background: "#B4F500" }}>
                <Check className="h-3 w-3 text-gray-900" strokeWidth={3} />
              </div>
              <span className="text-sm font-semibold text-gray-700">Miễn phí hoàn toàn</span>
            </div>
          </div>

          <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-5">
          <div className="bg-white rounded-3xl p-8 max-w-sm w-full shadow-2xl"
            style={{ border: "1px solid rgba(110,53,232,0.08)" }}>
            <div className="flex items-center gap-3 mb-5 pb-5"
              style={{ borderBottom: "1px solid rgba(110,53,232,0.08)" }}>
              <div className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0"
                style={{ background: "linear-gradient(135deg, #6E35E8, #9B6DFF)" }}>
                <Brain className="w-6 h-6 text-white" />
              </div>
              <div>
                <p className="text-gray-900 font-bold">ProInterview Free</p>
                <p className="text-xs font-semibold" style={{ color: "#B4F500" }}>✦ Bắt đầu ngay hôm nay</p>
              </div>
            </div>

            <p className="text-[11px] font-bold uppercase tracking-widest text-gray-400 mb-3">Bạn nhận được:</p>
            <ul className="space-y-3 mb-5">
              {PERKS.map((item) => (
                <li key={item} className="flex items-start gap-3">
                  <div className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5"
                    style={{ background: "rgba(110,53,232,0.1)" }}>
                    <Check className="w-3 h-3 text-[#6E35E8]" strokeWidth={3} />
                  </div>
                  <span className="text-gray-600 text-sm leading-relaxed">{item}</span>
                </li>
              ))}
            </ul>

            <button type="button"
              onClick={() => document.getElementById("reg-name")?.focus()}
              className="flex w-full items-center justify-center gap-1.5 rounded-full py-3 text-sm font-black text-[#0f172a] transition-all hover:scale-105 active:scale-[0.98]"
              style={{
                background: "linear-gradient(135deg, #B4F500, #93D600)",
                boxShadow: "0 8px 20px rgba(15,23,42,0.1)",
              }}>
              Bắt đầu miễn phí →
            </button>
          </div>

          {/* Social proof */}
          <div className="shrink-0 text-center">
            <p className="mb-2 font-bold text-gray-700" style={{ fontSize: "1.15rem", letterSpacing: "-0.02em" }}>
              <span style={{ color: "#6E35E8" }}>10,000+</span> ứng viên đã tin dùng
            </p>
            <div className="flex items-center justify-center gap-2">
              <div className="flex -space-x-2">
                {[["#6E35E8", "N"], ["#ec4899", "T"], ["#3b82f6", "A"], ["#f97316", "M"]].map(([bg, l], i) => (
                  <div key={i} className="w-8 h-8 rounded-full border-2 border-white flex items-center justify-center text-white text-xs font-bold"
                    style={{ background: bg }}>{l}</div>
                ))}
              </div>
              <div className="flex gap-0.5 ml-1">
                {[1, 2, 3, 4, 5].map((i) => <Star key={i} className="w-3.5 h-3.5 fill-current" style={{ color: "#FFB800" }} />)}
              </div>
              <span className="text-gray-600 text-sm font-semibold">4.8</span>
            </div>
          </div>
          </div>
        </div>
      </div>
    </div>
  );
}
