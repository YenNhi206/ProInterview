import React, { useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import {
  Eye,
  EyeOff as EyeSlash,
  Check,
  AlertCircle as WarningCircle,
  ShieldCheck,
  Zap as Lightning,
  ChevronRight as CaretRight,
  Brain,
} from "lucide-react";
import { registerUser } from "../utils/auth";

/* ── Google SVG icon ──────────────────────── */
const GoogleIcon = () => (
  <svg width="20" viewBox="0 0 18 18" fill="none">
    <path d="M17.64 9.205c0-.639-.057-1.252-.164-1.841H9v3.481h4.844a4.14 4.14 0 01-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
    <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 009 18z" fill="#34A853"/>
    <path d="M3.964 10.71A5.41 5.41 0 013.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 000 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
    <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 00.957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
  </svg>
);

const PERKS = [
  "3 buổi phỏng vấn AI miễn phí ngay sau đăng ký",
  "Phân tích CV/JD không giới hạn",
  "Truy cập 500+ câu hỏi phỏng vấn theo ngành",
  "Bảng điều khiển theo dõi tiến bộ cá nhân",
];

export function Register() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [showPass, setShowPass] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleRegister = async (e) => {
    e.preventDefault();
    if (!agreed) return;
    setLoading(true);
    setError("");

    const result = await registerUser({
      name: form.name.trim(),
      email: form.email.trim(),
      password: form.password,
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

  const inputStyle = {
    background: "#f9ecff",
    border: "none",
    borderRadius: "9999px",
    color: "#39264c",
  };

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-start"
      style={{
        fontFamily: "'Plus Jakarta Sans', sans-serif",
        background: "#fdf3ff",
        paddingTop: "2rem",
        paddingBottom: "2rem",
        paddingLeft: "1rem",
        paddingRight: "1rem",
      }}
    >
      <main className="w-full flex items-center justify-center">
        <div
          className="max-w-6xl w-full grid grid-cols-1 md:grid-cols-2 overflow-hidden"
          style={{
            background: "#fff",
            borderRadius: "2rem",
            boxShadow: "0 40px 60px -5px rgba(57,38,76,0.08)",
          }}
        >
          {/* ── Left: Form ── */}
          <div className="p-8 md:p-12 flex flex-col justify-start pt-10">
            {/* Logo */}
            <div className="mb-8">
              <button
                onClick={() => navigate("/")}
                className="flex items-center gap-2.5"
              >
                <div
                  className="w-9 h-9 rounded-xl flex items-center justify-center shadow-md"
                  style={{ background: "linear-gradient(135deg, #6a37d4, #ae8dff)" }}
                >
                  <Lightning className="w-5 h-5 text-white" />
                </div>
                <span
                  className="text-2xl font-extrabold tracking-tighter"
                  style={{ color: "#6a37d4" }}
                >
                  ProInterview
                </span>
              </button>
            </div>

            {/* Heading */}
            <div className="mb-6">
              <h1 className="text-3xl font-bold mb-2 tracking-tight" style={{ color: "#39264c" }}>
                Tạo tài khoản
              </h1>
              <p style={{ color: "#67537c", fontWeight: 500 }}>
                Miễn phí · Không cần thẻ tín dụng · 3 buổi AI ngay lập tức
              </p>
            </div>

            {/* Google */}
            <div className="mb-5">
              <button
                type="button"
                className="w-full flex items-center justify-center gap-3 py-3 px-4 transition-all duration-300"
                style={{
                  background: "#f9ecff",
                  borderRadius: "9999px",
                  border: "none",
                  fontWeight: 600,
                  fontSize: "0.875rem",
                  color: "#39264c",
                }}
                onMouseEnter={e => (e.currentTarget.style.background = "#f0dbff")}
                onMouseLeave={e => (e.currentTarget.style.background = "#f9ecff")}
              >
                <GoogleIcon />
                Đăng ký với Google
              </button>
            </div>

            {/* Divider */}
            <div className="relative mb-5">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full" style={{ borderTop: "1px solid #ecd4ff" }} />
              </div>
              <div className="relative flex justify-center text-xs">
                <span className="px-4 uppercase tracking-widest font-medium" style={{ background: "#fff", color: "#846e99" }}>
                  Hoặc sử dụng email
                </span>
              </div>
            </div>

            {/* Error banner */}
            {error && (
              <div
                className="flex items-start gap-2.5 rounded-2xl px-4 py-3 mb-4"
                style={{ background: "#fff0f3", border: "1px solid #f74b6d" }}
              >
                <WarningCircle className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: "#b41340" }} />
                <p className="text-sm" style={{ color: "#b41340" }}>{error}</p>
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleRegister} className="space-y-4">
              {/* Name */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold ml-4" style={{ color: "#67537c" }}>
                  Họ và tên
                </label>
                <input
                  type="text"
                  placeholder="Nguyễn Văn A"
                  value={form.name}
                  onChange={e => handleChange("name", e.target.value)}
                  required
                  className="w-full px-6 py-3.5 text-sm font-medium outline-none transition-all"
                  style={inputStyle}
                  onFocus={e => { e.currentTarget.style.background = "#fff"; e.currentTarget.style.boxShadow = "0 0 0 2px rgba(106,55,212,0.4)"; }}
                  onBlur={e => { e.currentTarget.style.background = "#f9ecff"; e.currentTarget.style.boxShadow = "none"; }}
                />
              </div>

              {/* Email */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold ml-4" style={{ color: "#67537c" }}>
                  Email
                </label>
                <input
                  type="email"
                  placeholder="name@company.com"
                  value={form.email}
                  onChange={e => handleChange("email", e.target.value)}
                  required
                  className="w-full px-6 py-3.5 text-sm font-medium outline-none transition-all"
                  style={inputStyle}
                  onFocus={e => { e.currentTarget.style.background = "#fff"; e.currentTarget.style.boxShadow = "0 0 0 2px rgba(106,55,212,0.4)"; }}
                  onBlur={e => { e.currentTarget.style.background = "#f9ecff"; e.currentTarget.style.boxShadow = "none"; }}
                />
              </div>

              {/* Password */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold ml-4" style={{ color: "#67537c" }}>
                  Mật khẩu
                </label>
                <div className="relative">
                  <input
                    type={showPass ? "text" : "password"}
                    placeholder="Tối thiểu 8 ký tự"
                    value={form.password}
                    onChange={e => handleChange("password", e.target.value)}
                    required
                    minLength={8}
                    className="w-full px-6 py-3.5 pr-14 text-sm font-medium outline-none transition-all"
                    style={inputStyle}
                    onFocus={e => { e.currentTarget.style.background = "#fff"; e.currentTarget.style.boxShadow = "0 0 0 2px rgba(106,55,212,0.4)"; }}
                    onBlur={e => { e.currentTarget.style.background = "#f9ecff"; e.currentTarget.style.boxShadow = "none"; }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPass(!showPass)}
                    className="absolute right-5 top-1/2 -translate-y-1/2 transition-colors"
                    style={{ color: "#846e99" }}
                  >
                    {showPass ? <EyeSlash className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {/* Password strength bar */}
                {form.password.length > 0 && (
                  <div className="flex gap-1 px-2 mt-2">
                    {[1, 2, 3].map(lvl => (
                      <div
                        key={lvl}
                        className="flex-1 h-1 rounded-full transition-all"
                        style={{
                          background:
                            form.password.length >= lvl * 4
                              ? lvl === 1 ? "#f74b6d" : lvl === 2 ? "#ae8dff" : "#6a37d4"
                              : "#ecd4ff",
                        }}
                      />
                    ))}
                  </div>
                )}
              </div>

              {/* Agree checkbox */}
              <label className="flex items-start gap-3 cursor-pointer mt-1">
                <button
                  type="button"
                  onClick={() => setAgreed(!agreed)}
                  className="flex items-center justify-center flex-shrink-0 transition-all mt-0.5"
                  style={{
                    width: 18, height: 18,
                    background: agreed ? "#6a37d4" : "transparent",
                    border: `2px solid ${agreed ? "#6a37d4" : "#bca4d2"}`,
                    borderRadius: 5,
                  }}
                >
                  {agreed && <Check className="w-3 h-3 text-white" strokeWidth={3} />}
                </button>
                <span className="text-xs leading-relaxed" style={{ color: "#67537c" }}>
                  Tôi đồng ý với{" "}
                  <a href="#" className="font-bold hover:underline" style={{ color: "#6a37d4" }}>Điều khoản dịch vụ</a>
                  {" "}và{" "}
                  <a href="#" className="font-bold hover:underline" style={{ color: "#6a37d4" }}>Chính sách bảo mật</a>
                  {" "}của ProInterview.
                </span>
              </label>

              {/* Submit */}
              <button
                type="submit"
                disabled={loading || !agreed}
                className="w-full py-4 font-bold text-base transition-all active:scale-[0.98] disabled:opacity-50"
                style={{
                  background: "linear-gradient(135deg, #6a37d4 0%, #ae8dff 100%)",
                  color: "#f8f0ff",
                  borderRadius: "9999px",
                  border: "none",
                  boxShadow: agreed ? "0 8px 24px rgba(106,55,212,0.25)" : "none",
                  marginTop: "0.5rem",
                }}
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                    Đang tạo tài khoản...
                  </span>
                ) : "Tạo tài khoản miễn phí"}
              </button>
            </form>

            {/* Privacy shield */}
            <div
              className="mt-5 rounded-2xl p-4"
              style={{ background: "rgba(106,55,212,0.05)", border: "1px solid rgba(106,55,212,0.15)" }}
            >
              <div className="flex items-center gap-2 mb-3">
                <ShieldCheck className="w-4 h-4 flex-shrink-0" style={{ color: "#6a37d4" }} />
                <h3 className="font-bold text-xs" style={{ color: "#39264c" }}>Cam kết bảo vệ dữ liệu</h3>
              </div>
              <ul className="space-y-2 text-xs leading-relaxed" style={{ color: "#67537c" }}>
                {[
                  "Thông tin cá nhân được mã hóa và lưu trữ an toàn",
                  "Không chia sẻ dữ liệu với bên thứ ba khi chưa có sự đồng ý",
                  "Bạn có quyền xóa tài khoản và dữ liệu bất cứ lúc nào",
                ].map((item, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <Check className="w-3 h-3 flex-shrink-0 mt-0.5" style={{ color: "#6a37d4" }} strokeWidth={3} />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            <p className="mt-6 text-center text-sm font-medium" style={{ color: "#67537c" }}>
              Đã có tài khoản?{" "}
              <button
                onClick={() => navigate("/login")}
                className="font-bold hover:underline decoration-2 underline-offset-4"
                style={{ color: "#b00d6a" }}
              >
                Đăng nhập ngay
              </button>
            </p>
          </div>

          {/* ── Right: Visual Panel ── */}
          <div
            className="hidden md:flex flex-col justify-center relative overflow-hidden"
            style={{ minHeight: 500 }}
          >
            {/* Gradient background */}
            <div
              className="absolute inset-0"
              style={{ background: "linear-gradient(135deg, #6a37d4 0%, #ae8dff 100%)" }}
            />
            {/* Blobs */}
            <div
              className="absolute animate-pulse"
              style={{
                top: -96, right: -96, width: 384, height: 384,
                borderRadius: "9999px",
                background: "#b00d6a",
                filter: "blur(80px)",
                opacity: 0.3,
              }}
            />
            <div
              className="absolute"
              style={{
                bottom: -80, left: -80, width: 320, height: 320,
                borderRadius: "9999px",
                background: "#a27cff",
                filter: "blur(80px)",
                opacity: 0.3,
              }}
            />

            {/* Content */}
            <div className="relative z-10 flex flex-col justify-center h-full p-12">
              {/* Perks card */}
              <div
                className="mb-8 p-8"
                style={{
                  background: "rgba(255,255,255,0.7)",
                  backdropFilter: "blur(20px)",
                  WebkitBackdropFilter: "blur(20px)",
                  borderRadius: "1rem",
                  border: "1px solid rgba(255,255,255,0.2)",
                }}
              >
                <div className="flex items-center gap-3 mb-5 pb-5" style={{ borderBottom: "1px solid rgba(106,55,212,0.15)" }}>
                  <div
                    className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0"
                    style={{ background: "linear-gradient(135deg, #6a37d4, #ae8dff)" }}
                  >
                    <Brain className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <p className="font-bold text-sm" style={{ color: "#2b006e" }}>ProInterview Free</p>
                    <p className="text-xs font-semibold" style={{ color: "#6a37d4" }}>✦ Bắt đầu ngay hôm nay</p>
                  </div>
                </div>
                <p className="text-xs font-bold uppercase tracking-wide mb-3" style={{ color: "#846e99" }}>
                  Bạn nhận được:
                </p>
                <ul className="space-y-3">
                  {PERKS.map((perk, i) => (
                    <li key={i} className="flex items-start gap-2.5">
                      <div
                        className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5"
                        style={{ background: "rgba(106,55,212,0.12)" }}
                      >
                        <Check className="w-3 h-3" style={{ color: "#6a37d4" }} strokeWidth={3} />
                      </div>
                      <span className="text-sm leading-relaxed" style={{ color: "#39264c" }}>{perk}</span>
                    </li>
                  ))}
                </ul>
                <button
                  onClick={() => navigate("/register")}
                  className="mt-5 w-full py-3 rounded-full text-sm font-bold flex items-center justify-center gap-1.5 transition-all hover:brightness-110"
                  style={{ background: "linear-gradient(135deg, #6a37d4, #ae8dff)", color: "#fff", border: "none" }}
                >
                  Bắt đầu miễn phí <CaretRight className="w-4 h-4" />
                </button>
              </div>

              {/* Tagline */}
              <div className="space-y-4">
                <h2
                  className="font-extrabold tracking-tight leading-tight text-white"
                  style={{ fontSize: "2rem" }}
                >
                  Nâng tầm kỹ năng,<br />chinh phục mọi thử thách.
                </h2>
                <div className="flex flex-wrap gap-3">
                  {["AI Phỏng vấn", "Feedback 1:1", "Lộ trình cá nhân"].map(tag => (
                    <span
                      key={tag}
                      className="px-4 py-1.5 text-xs font-bold text-white"
                      style={{
                        borderRadius: "9999px",
                        background: "rgba(255,255,255,0.1)",
                        backdropFilter: "blur(8px)",
                        border: "1px solid rgba(255,255,255,0.2)",
                      }}
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="w-full mt-auto pt-6" style={{ background: "transparent" }}>
        <div className="flex flex-col md:flex-row justify-between items-center px-12 py-6 w-full"
          style={{ background: "#f9ecff", borderRadius: "3rem 3rem 0 0", marginTop: "2rem" }}
        >
          <span className="text-lg font-bold mb-4 md:mb-0" style={{ color: "#6a37d4" }}>ProInterview</span>
          <div className="flex flex-wrap justify-center gap-8 mb-4 md:mb-0">
            {["Privacy Policy", "Terms of Service", "Contact", "Twitter"].map(link => (
              <a
                key={link}
                href="#"
                className="text-sm transition-opacity duration-200"
                style={{ color: "#39264c", opacity: 0.6 }}
                onMouseEnter={e => { e.currentTarget.style.opacity = "1"; e.currentTarget.style.color = "#b00d6a"; }}
                onMouseLeave={e => { e.currentTarget.style.opacity = "0.6"; e.currentTarget.style.color = "#39264c"; }}
              >
                {link}
              </a>
            ))}
          </div>
          <p className="text-sm" style={{ color: "#39264c", opacity: 0.6 }}>
            © 2024 ProInterview. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}