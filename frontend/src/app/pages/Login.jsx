import React, { useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { AlertCircle as WarningCircle, Check, ArrowRight, Sparkles as Sparkle, Zap as Lightning } from "lucide-react";
import { loginUser, setLoggedIn, getUser } from "../utils/auth";

/* ── Google SVG icon ──────────────────────── */
const GoogleIcon = () => (
  <svg width="20" viewBox="0 0 18 18" fill="none">
    <path d="M17.64 9.205c0-.639-.057-1.252-.164-1.841H9v3.481h4.844a4.14 4.14 0 01-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
    <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 009 18z" fill="#34A853"/>
    <path d="M3.964 10.71A5.41 5.41 0 013.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 000 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
    <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 00.957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
  </svg>
);

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

  const handleQuickLogin = (role) => {
    const demoUser =
      role === "mentor"
        ? {
            name: "Mentor Demo",
            email: "mentor@prointerview.vn",
            role: "mentor",
            expertise: ["React", "TypeScript", "System Design"],
            experience: "8 years",
            hourlyRate: 500000,
            bio: "Senior Frontend Engineer với 8 năm kinh nghiệm tại Shopee, Grab.",
            avatar: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=400&h=400&fit=crop",
          }
        : {
            name: "Nguyễn Văn User",
            email: "user@prointerview.vn",
            role: "customer",
          };

    setLoggedIn(demoUser);
    const redirect = searchParams.get("redirect");
    if (role === "mentor") {
      navigate(redirect || "/mentor/dashboard");
    } else {
      navigate(redirect || "/dashboard");
    }
  };

  const handleFieldChange =
    (setter) =>
    (e) => {
      setter(e.target.value);
      if (error) setError("");
    };

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-start"
      style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", background: "#fdf3ff", paddingTop: "2rem", paddingBottom: "2rem", paddingLeft: "1rem", paddingRight: "1rem" }}
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
            <div className="mb-10">
              <button
                onClick={() => navigate("/")}
                className="flex items-center gap-2.5 group"
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
            <div className="mb-8">
              <h1
                className="text-3xl font-bold mb-2 tracking-tight"
                style={{ color: "#39264c" }}
              >
                Chào mừng trở lại
              </h1>
              <p style={{ color: "#67537c", fontWeight: 500 }}>
                Đăng nhập để tiếp tục hành trình sự nghiệp của bạn.
              </p>
            </div>

            {/* Success banner */}
            {isRegistered && (
              <div
                className="flex items-start gap-2.5 rounded-2xl px-4 py-3 mb-5"
                style={{ background: "rgba(106,55,212,0.08)", border: "1px solid rgba(106,55,212,0.2)" }}
              >
                <Check className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: "#6a37d4" }} />
                <p className="text-sm font-semibold" style={{ color: "#6a37d4" }}>
                  Đăng ký thành công 🎉 Vui lòng đăng nhập để tiếp tục.
                </p>
              </div>
            )}

            {/* Error banner */}
            {error && (
              <div
                className="flex items-start gap-2.5 rounded-2xl px-4 py-3 mb-5"
                style={{ background: "#fff0f3", border: "1px solid #f74b6d" }}
              >
                <WarningCircle className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: "#b41340" }} />
                <p className="text-sm" style={{ color: "#b41340" }}>{error}</p>
              </div>
            )}

            {/* Social Buttons */}
            <div className="mb-6">
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
                Tiếp tục với Google
              </button>
            </div>

            {/* Demo accounts */}
            <div
              className="rounded-2xl p-4 mb-6"
              style={{ background: "rgba(106,55,212,0.05)", border: "1px dashed rgba(106,55,212,0.25)" }}
            >
              <p className="text-xs font-semibold mb-3 flex items-center gap-1.5" style={{ color: "#67537c" }}>
                <Sparkle style={{ color: "#6a37d4" }} />
                Tài khoản demo — Nhấn để đăng nhập ngay
              </p>
              <div className="grid grid-cols-2 gap-2">
                {(["customer", "mentor"]).map(role => (
                  <button
                    key={role}
                    type="button"
                    onClick={() => handleQuickLogin(role)}
                    className="rounded-xl px-3 py-3 text-left group transition-all card-premium animate-fade-in" style={{ border: "1px solid #ecd4ff" }}
                    onMouseEnter={e => (e.currentTarget.style.borderColor = "#6a37d4")}
                    onMouseLeave={e => (e.currentTarget.style.borderColor = "#ecd4ff")}
                  >
                    <p className="font-semibold text-xs flex items-center gap-1" style={{ color: "#39264c", marginBottom: 6 }}>
                      {role === "customer" ? "👤 Khách hàng" : "👨‍🏫 Người hướng dẫn"}
                      <ArrowRight className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" style={{ color: "#6a37d4" }} />
                    </p>
                    <p style={{ color: "#bca4d2", fontSize: "0.65rem", fontFamily: "monospace" }}>Nhấn để đăng nhập</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Divider */}
            <div className="relative mb-6">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full" style={{ borderTop: "1px solid #ecd4ff" }} />
              </div>
              <div className="relative flex justify-center text-xs">
                <span
                  className="px-4 uppercase tracking-widest font-medium"
                  style={{ background: "#fff", color: "#846e99" }}
                >
                  Hoặc sử dụng email
                </span>
              </div>
            </div>

            {/* Form */}
            <form onSubmit={handleLogin} className="space-y-5">
              <div className="space-y-1.5">
                <label
                  className="text-xs font-bold ml-4"
                  style={{ color: "#67537c" }}
                  htmlFor="email"
                >
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  placeholder="name@company.com"
                  value={email}
                  onChange={handleFieldChange(setEmail)}
                  required
                  className="w-full px-6 py-3.5 text-sm font-medium outline-none transition-all"
                  style={{
                    background: "#f9ecff",
                    border: "none",
                    borderRadius: "9999px",
                    color: "#39264c",
                  }}
                  onFocus={e => {
                    e.currentTarget.style.background = "#fff";
                    e.currentTarget.style.boxShadow = "0 0 0 2px rgba(106,55,212,0.4)";
                  }}
                  onBlur={e => {
                    e.currentTarget.style.background = "#f9ecff";
                    e.currentTarget.style.boxShadow = "none";
                  }}
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex justify-between items-center px-4">
                  <label className="text-xs font-bold" style={{ color: "#67537c" }} htmlFor="password">
                    Mật khẩu
                  </label>
                  <a
                    href="#"
                    className="text-xs font-bold transition-colors"
                    style={{ color: "#6a37d4" }}
                  >
                    Quên mật khẩu?
                  </a>
                </div>
                <input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={handleFieldChange(setPassword)}
                  required
                  className="w-full px-6 py-3.5 text-sm font-medium outline-none transition-all"
                  style={{
                    background: "#f9ecff",
                    border: "none",
                    borderRadius: "9999px",
                    color: "#39264c",
                  }}
                  onFocus={e => {
                    e.currentTarget.style.background = "#fff";
                    e.currentTarget.style.boxShadow = "0 0 0 2px rgba(106,55,212,0.4)";
                  }}
                  onBlur={e => {
                    e.currentTarget.style.background = "#f9ecff";
                    e.currentTarget.style.boxShadow = "none";
                  }}
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-4 font-bold text-base transition-all active:scale-[0.98] disabled:opacity-60"
                style={{
                  background: "linear-gradient(135deg, #6a37d4 0%, #ae8dff 100%)",
                  color: "#f8f0ff",
                  borderRadius: "9999px",
                  border: "none",
                  boxShadow: "0 8px 24px rgba(106,55,212,0.25)",
                  marginTop: "0.5rem",
                }}
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                    Đang đăng nhập...
                  </span>
                ) : (
                  "Đăng nhập"
                )}
              </button>
            </form>

            <p className="mt-8 text-center text-sm font-medium" style={{ color: "#67537c" }}>
              Chưa có tài khoản?{" "}
              <button
                onClick={() => navigate("/register")}
                className="font-bold hover:underline decoration-2 underline-offset-4"
                style={{ color: "#b00d6a" }}
              >
                Đăng ký ngay
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
                top: "50%", left: -96, width: 320, height: 320,
                borderRadius: "9999px",
                background: "#a27cff",
                filter: "blur(80px)",
                opacity: 0.3,
              }}
            />

            {/* Content */}
            <div className="relative z-10 flex flex-col justify-center h-full p-12">
              {/* Testimonial card */}
              <div
                className="mb-8 p-8 transform rotate-1 hover:rotate-0 transition-transform duration-500"
                style={{
                  background: "rgba(255,255,255,0.7)",
                  backdropFilter: "blur(20px)",
                  WebkitBackdropFilter: "blur(20px)",
                  borderRadius: "1rem",
                  border: "1px solid rgba(255,255,255,0.2)",
                }}
              >
                {/* Stars */}
                <div className="flex gap-1 mb-4">
                  {[1,2,3,4,5].map(i => (
                    <span key={i} className="text-xl" style={{ color: "#b00d6a" }}>★</span>
                  ))}
                </div>
                <p
                  className="font-semibold leading-relaxed mb-6 italic"
                  style={{ fontSize: "1.1rem", color: "#2b006e" }}
                >
                  "ProInterview đã giúp mình tự tin hơn gấp 10 lần. Những buổi phỏng vấn giả lập sát thực tế đến kinh ngạc!"
                </p>
                <div className="flex items-center gap-4">
                  <img
                    src="https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=100&h=100&fit=crop&crop=face"
                    alt="Nguyễn Minh Anh"
                    className="w-12 h-12 rounded-full object-cover"
                    style={{ border: "2px solid #fff" }}
                  />
                  <div>
                    <h4 className="font-bold" style={{ color: "#2b006e" }}>Nguyễn Minh Anh</h4>
                    <p className="text-xs font-medium" style={{ color: "rgba(43,0,110,0.7)" }}>
                      Software Engineer tại VNG
                    </p>
                  </div>
                </div>
              </div>

              {/* Tagline */}
              <div className="space-y-6">
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
      <footer
        className="w-full mt-auto"
        style={{ background: "#f9ecff", borderRadius: "3rem 3rem 0 0" }}
      >
        <div className="flex flex-col md:flex-row justify-between items-center px-12 py-10 w-full">
          <span className="text-lg font-bold mb-6 md:mb-0" style={{ color: "#6a37d4" }}>
            ProInterview
          </span>
          <div className="flex flex-wrap justify-center gap-8 mb-6 md:mb-0">
            {["Privacy Policy", "Terms of Service", "Contact", "Twitter"].map(link => (
              <a
                key={link}
                href="#"
                className="text-sm transition-opacity duration-200"
                style={{ color: "#39264c", opacity: 0.6, fontFamily: "Plus Jakarta Sans, sans-serif" }}
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