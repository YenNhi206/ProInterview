import React, { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router";
import {
  Sparkles as Sparkle,
  Sparkles,
  Mic as Microphone,
  FileText,
  Users,
  TrendingUp as TrendUp,
  Star,
  ChevronRight as CaretRight,
  Check,
  Brain,
  Target as Crosshair,
  Award as Medal,
  ArrowRight,
  Zap as Lightning,
  ShieldCheck,
  CheckCircle2,
  BarChart3 as ChartBar,
  Menu as List,
  X,
  LogIn as SignIn,
  UserPlus,
  Lock,
  Upload as UploadSimple,
  Video as VideoCamera,
  BadgeCheck as SealCheck,
  GraduationCap,
  PlayCircle,
} from "lucide-react";
import { COURSES_DATA } from "../../data/coursesData";
import { isLoggedIn } from "../../utils/auth";
import { Footer } from "../../components/layout/Footer";
import { RecommendedJourney } from "../../components/home/RecommendedJourney";

/* ─── Data ──────────────────────────────────────────────── */
const FEATURES = [
  {
    icon: FileText,
    accentClass: "from-[#c4ff47] to-[#8fbc24]",
    bgClass: "bg-lime-50 dark:bg-lime-950/30",
    dotColor: "#c4ff47",
    borderHover: "rgba(196, 255, 71,0.5)",
    bgHover: "rgba(196, 255, 71,0.07)",
    title: "Phân tích CV/JD",
    desc: "AI phân tích mức độ phù hợp giữa CV và JD, đưa ra gợi ý tối ưu cụ thể cho từng vị trí.",
    route: "/cv-analysis",
    cta: "Phân tích ngay",
  },
  {
    icon: Brain,
    accentClass: "from-[#6E35E8] to-[#9B6DFF]",
    bgClass: "bg-purple-50 dark:bg-purple-950/30",
    dotColor: "#6E35E8",
    borderHover: "rgba(110, 53, 232,0.5)",
    bgHover: "rgba(110, 53, 232,0.08)",
    title: "Phỏng vấn thử với AI",
    desc: "Luyện tập với các câu hỏi HR phổ biến, nhận phản hồi chi tiết theo mô hình STAR sau mỗi câu trả lời.",
    route: "/interview",
    cta: "Phỏng vấn thử",
  },
  {
    icon: Users,
    accentClass: "from-[#FFB800] to-[#FF8C42]",
    bgClass: "bg-amber-50 dark:bg-amber-950/30",
    dotColor: "#FFB800",
    borderHover: "rgba(255,184,0,0.5)",
    bgHover: "rgba(255,184,0,0.07)",
    title: "Mentor 1-1 Thực Tế",
    desc: "Đặt lịch phỏng vấn chuyên ngành 1-1 với HR/Manager từ Shopee, Vingroup, FPT và 200+ công ty hàng đầu.",
    route: "/mentors",
    cta: "Tìm Mentor",
  },
  {
    icon: TrendUp,
    accentClass: "from-sky-400 to-blue-600",
    bgClass: "bg-sky-50 dark:bg-sky-950/30",
    dotColor: "#38BDF8",
    borderHover: "rgba(56,189,248,0.5)",
    bgHover: "rgba(56,189,248,0.07)",
    title: "Theo Dõi Tiến Bộ",
    desc: "Bảng điều khiển cá nhân hóa với biểu đồ tiến bộ, lịch sử phỏng vấn và lộ trình kỹ năng cụ thể.",
    route: "/dashboard",
    cta: "Xem bảng điều khiển",
  },
];

const STEPS = [
  {
    step: "01",
    icon: FileText,
    title: "Phân tích CV/JD",
    desc: "AI phân tích mức độ phù hợp giữa CV và JD, đưa ra gợi ý tối ưu cụ thể cho từng vị trí.",
    color: "#7000ff",
  },
  {
    step: "02",
    icon: Brain,
    title: "Phỏng vấn thử với AI",
    desc: "Luyện tập trả lời với AI chuyên gia, nhận phản hồi chi tiết theo mô hình STAR.",
    color: "#b8f600",
  },
  {
    step: "03",
    icon: Users,
    title: "Mentor 1:1 thực tế",
    desc: "Kết nối và phỏng vấn trực tiếp với các chuyên gia/HR từ những tập đoàn lớn.",
    color: "#7000ff",
  },
  {
    step: "04",
    icon: TrendUp,
    title: "Theo dõi tiến độ",
    desc: "Hệ thống hóa lộ trình phát triển và đo lường sự thăng tiến qua từng buổi tập.",
    color: "#b8f600",
  },
];

const TESTIMONIALS = [
  {
    name: "Phạm Anh Tuấn",
    role: "Software Engineer @ Shopee",
    avatar: "PA",
    grad: "from-[#6E35E8] to-[#9B6DFF]",
    text: "Sau 3 buổi phỏng vấn thử với AI và 1 buổi với mentor từ Shopee, mình tự tin hơn hẳn. Câu hỏi AI đặt ra rất sát thực tế, phản hồi chi tiết giúp mình biết chính xác điểm cần cải thiện.",
    stars: 5,
    tag: "Đã nhận offer",
  },
  {
    name: "Nguyễn Thị Hoa",
    role: "Marketing Executive @ Unilever",
    avatar: "NH",
    grad: "from-pink-500 to-rose-600",
    text: "Phần phân tích CV/JD của ProInterview giúp mình nhận ra CV thiếu nhiều keyword quan trọng. Điểm STAR của mình tăng từ 2.4 lên 4.1 sau 3 tuần luyện tập.",
    stars: 5,
    tag: "Tăng STAR +70%",
  },
  {
    name: "Trần Minh Đức",
    role: "Business Analyst @ KPMG",
    avatar: "TM",
    grad: "from-emerald-500 to-teal-600",
    text: "Tính năng matching CV-JD rất hay, chỉ ra đúng điểm yếu của CV. Mentor từ KPMG chia sẻ insider tips rất thực tế, khác hẳn các tài liệu trên mạng.",
    stars: 5,
    tag: "Mentor 5 sao",
  },
];

const STATS = [
  { value: "10,000+", label: "Ứng viên đã luyện tập" },
  { value: "500+", label: "Mentor chuyên nghiệp" },
  { value: "85%", label: "Tỷ lệ được nhận việc" },
  { value: "4.8/5", label: "Điểm đánh giá" },
];

const NAV_LINKS = [
  { label: "Tính năng", href: "#features" },
  { label: "Khóa học", href: "#courses" },
  { label: "Đánh giá", href: "#testimonials" },
  { label: "Bảng giá", href: "#pricing" },
];

/* ─── Component ─────────────────────────────────────────── */
export function Home() {
  const navigate = useNavigate();
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  // Auth-gate: redirect to login with ?redirect= if not logged in
  const handleFeatureClick = (route) => {
    if (isLoggedIn()) {
      navigate(route);
    } else {
      navigate(`/login?redirect=${encodeURIComponent(route)}`);
    }
  };

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll, {
      passive: true,
    });

    // Check for scrollTo param
    const params = new URLSearchParams(window.location.search);
    const scrollTarget = params.get("scrollTo");
    if (scrollTarget) {
      setTimeout(() => {
        const el = document.getElementById(scrollTarget);
        if (el) {
          el.scrollIntoView({ behavior: "smooth" });
          // Clean up URL
          window.history.replaceState({}, document.title, window.location.pathname);
        }
      }, 500);
    }

    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div
      className="min-h-screen text-white selection:bg-[rgba(196,255,71,0.28)] selection:text-white font-sans overflow-x-hidden relative"
      style={{
        background: "linear-gradient(165deg, #0a0618 0%, #07060e 45%, #12081f 100%)",
        color: "#fff",
      }}
    >
      <style>{`
        .cute-glass {
          background: linear-gradient(180deg, rgba(255,255,255,0.06), rgba(255,255,255,0.03));
          border: 1px solid rgba(255,255,255,0.1);
          backdrop-filter: blur(14px);
          box-shadow: 0 12px 40px rgba(0,0,0,0.28);
        }
        .cute-pill {
          border-radius: 999px;
          border: 1px solid rgba(255,255,255,0.12);
          background: rgba(255,255,255,0.05);
        }
        .cute-card {
          position: relative;
          border-radius: 24px;
          border: 1px solid rgba(255,255,255,0.08);
          background: linear-gradient(180deg, rgba(255,255,255,0.05), rgba(255,255,255,0.025));
          transform-style: preserve-3d;
          transition: transform .28s ease, border-color .25s ease, box-shadow .25s ease;
        }
        .cute-card:hover {
          transform: perspective(1000px) translateY(-7px) rotateX(2.5deg) rotateY(-2.5deg);
          border-color: rgba(196, 255, 71,0.42);
          box-shadow:
            0 16px 40px rgba(0,0,0,0.4),
            0 0 36px -8px rgba(196, 255, 71, 0.22),
            0 0 0 1px rgba(196, 255, 71, 0.1) inset;
        }
        .parallax-layer {
          transform: translateZ(18px);
        }
        .card-glow {
          position: absolute;
          inset: -30% -20% auto auto;
          width: 160px;
          height: 160px;
          border-radius: 999px;
          background: radial-gradient(circle, rgba(110,53,232,0.22), transparent 70%);
          opacity: 0;
          transition: opacity .25s ease;
          pointer-events: none;
        }
        .cute-card:hover .card-glow {
          opacity: 1;
        }
        .card-shine {
          position: absolute;
          inset: 0;
          pointer-events: none;
          overflow: hidden;
          border-radius: inherit;
        }
        .card-shine::after {
          content: "";
          position: absolute;
          top: -120%;
          left: -45%;
          width: 35%;
          height: 300%;
          background: linear-gradient(90deg, transparent, rgba(255,255,255,0.14), transparent);
          transform: rotate(18deg) translateX(-180%);
          transition: transform .65s ease;
        }
        .cute-card:hover .card-shine::after {
          transform: rotate(18deg) translateX(480%);
        }
        .cute-heading {
          letter-spacing: -0.035em;
          font-weight: 850;
          line-height: 1.08;
        }
        .sticker-badge {
          border-radius: 999px;
          border: 1px solid rgba(255,255,255,0.24);
          background: rgba(18,11,46,0.78);
          backdrop-filter: blur(10px);
          box-shadow: 0 10px 24px rgba(0,0,0,0.25);
        }
        .float-icon {
          animation: cuteFloat 3.1s ease-in-out infinite;
        }
        .float-icon-delay {
          animation: cuteFloat 3.1s ease-in-out infinite;
          animation-delay: .4s;
        }
        .float-icon-slow {
          animation: cuteFloat 4.2s ease-in-out infinite;
          animation-delay: .2s;
        }
        .hero-badge-animated {
          animation: heroGlowPulse 2.8s ease-in-out infinite;
        }
        .hero-title-animated {
          background-size: 200% 200%;
          animation: heroGradientFlow 5s ease-in-out infinite;
        }
        .hero-orbit-text {
          display: inline-block;
          animation: heroOrbitPop 4.8s cubic-bezier(0.4, 0, 0.2, 1) infinite;
          transform-origin: center;
          will-change: transform, opacity, filter;
        }
        @keyframes cuteFloat {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-5px); }
        }
        @keyframes heroGlowPulse {
          0%, 100% {
            box-shadow: 0 0 0 rgba(110,53,232,0.0), 0 0 0 rgba(196, 255, 71,0.0);
            transform: translateY(0px);
          }
          50% {
            box-shadow: 0 8px 28px rgba(110,53,232,0.2), 0 0 20px rgba(196, 255, 71,0.12);
            transform: translateY(-1px);
          }
        }
        @keyframes heroGradientFlow {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
        @keyframes heroOrbitPop {
          0% {
            opacity: 1;
            transform: translate(0px, 0px) scale(1) rotate(0deg);
            filter: blur(0px);
          }
          25% {
            opacity: 1;
            transform: translate(5px, -3px) scale(1.02) rotate(2deg);
            filter: blur(0px);
          }
          50% {
            opacity: 1;
            transform: translate(-4px, 2px) scale(0.99) rotate(-2deg);
            filter: blur(0px);
          }
          75% {
            opacity: 1;
            transform: translate(3px, -2px) scale(1.01) rotate(1deg);
            filter: blur(0px);
          }
          100% {
            opacity: 1;
            transform: translate(0px, 0px) scale(1) rotate(0deg);
            filter: blur(0px);
          }
        }
        @keyframes shimmer-bg {
          0% { opacity: 0.4; transform: translate(0,0) scale(1); }
          50% { opacity: 0.7; transform: translate(2%, -2%) scale(1.05); }
          100% { opacity: 0.4; transform: translate(0,0) scale(1); }
        }
        .font-headline {
          letter-spacing: -0.045em;
          text-shadow: 0 2px 24px rgba(0,0,0,0.35);
        }
        .glass-card {
          background: linear-gradient(145deg, rgba(255,255,255,0.07) 0%, rgba(255,255,255,0.02) 100%);
          backdrop-filter: blur(48px);
          border-radius: 28px;
          border: 1px solid rgba(255, 255, 255, 0.1);
          transition: transform 0.45s cubic-bezier(0.16, 1, 0.3, 1), border-color 0.35s ease, box-shadow 0.45s ease;
          position: relative;
          overflow: hidden;
        }
        .glass-card::before {
          content: '';
          position: absolute;
          inset: 0;
          background: linear-gradient(125deg, rgba(236,72,153,0.08) 0%, transparent 42%, rgba(196, 255, 71,0.06) 100%);
          pointer-events: none;
          opacity: 0.85;
        }
        .glass-card:hover {
          border-color: rgba(196, 255, 71, 0.42);
          transform: translateY(-4px) rotate(-0.2deg);
          box-shadow:
            0 24px 48px rgba(0,0,0,0.45),
            0 0 0 1px rgba(196, 255, 71, 0.12) inset,
            0 0 48px -6px rgba(196, 255, 71, 0.28),
            0 0 36px -10px rgba(167, 139, 250, 0.22);
        }
      `}</style>

      {/* Nền blob + shimmer — giống Dashboard */}
      <div
        className="fixed inset-0 pointer-events-none -z-10 opacity-90"
        style={{ animation: "shimmer-bg 14s ease-in-out infinite" }}
        aria-hidden
      >
        <div className="absolute top-[-20%] right-[-10%] h-[70vh] w-[70vh] rounded-full bg-gradient-to-bl from-fuchsia-600/35 via-violet-600/20 to-transparent blur-[100px]" />
        <div className="absolute bottom-[-25%] left-[-15%] h-[85vh] w-[85vh] rounded-full bg-gradient-to-tr from-[#c4ff47]/18 via-cyan-500/10 to-fuchsia-500/20 blur-[110px]" />
        <div className="absolute top-1/2 left-1/2 h-[50vh] w-[50vh] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#6E35E8]/12 blur-[90px]" />
        <div className="absolute top-[30%] right-[5%] h-[40vh] w-[40vh] rounded-full bg-[#c4ff47]/10 blur-[80px]" />
      </div>

      {/* ═══ NAVBAR ════════════════════════════════════════ */}
      <nav
        className="fixed top-0 left-0 right-0 z-50 transition-all duration-300"
        style={{
          background: scrolled
            ? "rgba(18, 11, 46, 0.9)"
            : "rgba(7, 6, 14, 0.72)",
          backdropFilter: scrolled ? "blur(20px) saturate(1.15)" : "blur(16px) saturate(1.1)",
          WebkitBackdropFilter: scrolled
            ? "blur(20px) saturate(1.15)"
            : "blur(16px) saturate(1.1)",
          borderBottom: scrolled
            ? "1px solid rgba(255,255,255,0.12)"
            : "1px solid rgba(255,255,255,0.08)",
          boxShadow: scrolled
            ? "0 1px 0 rgba(255,255,255,0.06), 0 -1px 24px -8px rgba(196, 255, 71, 0.06) inset, 0 12px 40px -12px rgba(0,0,0,0.45)"
            : "0 1px 0 rgba(255,255,255,0.05), 0 8px 32px -8px rgba(0,0,0,0.4)",
        }}
      >
        <div className="max-w-7xl mx-auto px-5 h-16 flex items-center gap-6">
          {/* Logo */}
          <div
            className="flex items-center gap-2.5 cursor-pointer flex-shrink-0"
            onClick={() =>
              window.scrollTo({ top: 0, behavior: "smooth" })
            }
          >
            <div
              className="w-8 h-8 rounded-xl flex items-center justify-center shadow-lg"
              style={{
                background:
                  "linear-gradient(135deg, #6E35E8, #9B6DFF)",
              }}
            >
              <Sparkle className="w-4 h-4 text-white float-icon" />
            </div>
            <span
              className="text-white font-bold"
              style={{
                fontSize: "1.05rem",
                letterSpacing: "-0.02em",
              }}
            >
              ProInterview
            </span>
          </div>

          {/* Desktop nav links */}
          <div className="hidden md:flex items-center gap-1 ml-4">
            {NAV_LINKS.map((l) => (
              <a
                key={l.label}
                href={l.href}
                className="px-4 py-2 rounded-full text-sm font-semibold text-white/65 hover:text-white transition-all cursor-pointer border border-transparent hover:border-white/10 hover:bg-white/6"
                onClick={(e) => {
                  e.preventDefault();
                  document
                    .querySelector(l.href)
                    ?.scrollIntoView({ behavior: "smooth" });
                }}
              >
                {l.label}
              </a>
            ))}
          </div>

          {/* Right side */}
          <div className="ml-auto flex items-center gap-2.5">
            {/* Try button — always visible */}
            <button
              onClick={() => navigate("/interview")}
              className="hidden sm:inline-flex items-center gap-1.5 px-5 py-2 rounded-full text-sm font-extrabold transition-all hover:brightness-110 active:scale-95 shadow-[0_8px_20px_rgba(196, 255, 71,0.22)]"
              style={{
                background:
                  "linear-gradient(135deg, #c4ff47, #8fbc24)",
                color: "#120B2E",
                boxShadow: "0 0 24px rgba(196, 255, 71,0.35)",
              }}
            >
              <Lightning className="w-3.5 h-3.5 text-[#120B2E]" />
              Trải nghiệm thử
            </button>

            {/* Auth buttons */}
            <button
              onClick={() => navigate("/login")}
              className="hidden sm:inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium text-white/75 hover:text-white hover:bg-white/8 transition-colors"
            >
              <SignIn className="w-3.5 h-3.5" />
              Đăng nhập
            </button>
            <button
              onClick={() => navigate("/register")}
              className="hidden sm:inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-semibold border border-white/15 text-white hover:bg-white/8 hover:border-white/25 transition-colors"
            >
              <UserPlus className="w-3.5 h-3.5" />
              Đăng ký
            </button>

            {/* Mobile hamburger */}
            <button
              className="md:hidden p-2 rounded-lg text-white/70 hover:text-white hover:bg-white/8 transition-colors"
              onClick={() => setMobileOpen(!mobileOpen)}
            >
              {mobileOpen ? (
                <X className="w-5 h-5" />
              ) : (
                <List className="w-5 h-5" />
              )}
            </button>
          </div>
        </div>

        {/* Mobile menu */}
        {mobileOpen && (
          <div
            className="md:hidden border-t"
            style={{
              background: "rgba(18,11,46,0.97)",
              borderColor: "rgba(255,255,255,0.08)",
            }}
          >
            <div className="max-w-7xl mx-auto px-5 py-4 flex flex-col gap-1">
              {NAV_LINKS.map((l) => (
                <a
                  key={l.label}
                  href={l.href}
                  className="px-4 py-2.5 rounded-lg text-sm text-white/70 hover:text-white hover:bg-white/8 transition-colors"
                  onClick={(e) => {
                    e.preventDefault();
                    setMobileOpen(false);
                    document
                      .querySelector(l.href)
                      ?.scrollIntoView({ behavior: "smooth" });
                  }}
                >
                  {l.label}
                </a>
              ))}
              <div
                className="mt-3 pt-3 border-t flex flex-col gap-2"
                style={{
                  borderColor: "rgba(255,255,255,0.08)",
                }}
              >
                <button
                  onClick={() => navigate("/login")}
                  className="flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium border border-white/15 text-white hover:bg-white/8 transition-colors"
                >
                  <SignIn className="w-4 h-4" />{" "}
                  Đăng nhập
                </button>
                <button
                  onClick={() => navigate("/register")}
                  className="flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold"
                  style={{
                    background:
                      "linear-gradient(135deg, #c4ff47, #8fbc24)",
                    color: "#120B2E",
                  }}
                >
                  <Lightning className="w-4 h-4 text-[#120B2E]" />{" "}
                  Trải nghiệm thử miễn phí
                </button>
              </div>
            </div>
          </div>
        )}
      </nav>

      {/* ═══ HERO — layout vibe Dashboard (lưới + glass stats) ═══ */}
      <section className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden px-5 pt-20 border-b border-white/[0.07]">
        {/* Lưới 32px giống header Dashboard */}
        <div
          className="absolute inset-0 opacity-[0.11]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,0.55) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.45) 1px, transparent 1px)",
            backgroundSize: "32px 32px",
          }}
          aria-hidden
        />
        {/* Noise grain */}
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage:
              "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E\")",
            backgroundRepeat: "repeat",
            backgroundSize: "200px",
          }}
          aria-hidden
        />

        {/* Hero content */}
        <div className="relative z-10 text-center max-w-4xl mx-auto">
          <div
            className="inline-flex items-center gap-2 mb-7 px-4 py-2 rounded-full border text-xs font-bold cute-glass hero-badge-animated"
            style={{
              background: "rgba(110, 53, 232,0.15)",
              borderColor: "rgba(110, 53, 232,0.35)",
              color: "#B89DFF",
            }}
          >
            <Sparkle className="w-3.5 h-3.5" />
            Nền tảng luyện phỏng vấn với AI
          </div>

          {/* Headline */}
          <h1
            className="text-white mb-6 py-2 leading-[1.08] cute-heading font-headline tracking-tighter"
            style={{
              fontSize: "clamp(2rem, 5.5vw, 3.5rem)",
            }}
          >
            <span className="bg-gradient-to-r from-white via-fuchsia-100 to-zinc-300 bg-clip-text text-transparent">
              Phỏng vấn{" "}
            </span>
            <span
              className="hero-title-animated hero-orbit-text bg-gradient-to-r from-[#c4ff47] via-fuchsia-300 to-violet-300 bg-clip-text text-transparent"
              style={{ padding: "0.1em 0" }}
            >
              1:1 với AI
            </span>
            <span className="text-white/90"> qua mô phỏng hội thoại thông minh</span>
          </h1>

          {/* Sub */}
          <p
            className="text-white/55 max-w-2xl mx-auto mb-10 leading-relaxed"
            style={{ fontSize: "1rem" }}
          >
            ProInterview phân tích CV/JD, tạo câu hỏi phỏng vấn
            cá nhân hóa, và kết nối bạn với Mentor HR thực tế từ
            Shopee, Vingroup, FPT và hơn 200 công ty hàng đầu.
          </p>

          {/* CTA buttons */}
          <div className="flex flex-col sm:flex-row gap-3.5 justify-center mb-16">
            <button
              onClick={() => navigate("/interview")}
              className="inline-flex items-center justify-center gap-2.5 px-8 py-4 rounded-full font-black transition-all hover:brightness-110 active:scale-[0.98] hover:-translate-y-0.5"
              style={{
                background:
                  "linear-gradient(135deg, #c4ff47, #8fbc24)",
                color: "#1a1a1a",
                fontSize: "0.9375rem",
                boxShadow:
                  "0 0 40px rgba(196, 255, 71,0.3), 0 8px 24px rgba(0,0,0,0.3)",
              }}
            >
              <Lightning className="w-5 h-5" />
              Phỏng vấn thử miễn phí
            </button>
            <button
              onClick={() => navigate("/mentors")}
              className="inline-flex items-center justify-center gap-2.5 px-8 py-4 rounded-full font-semibold transition-all hover:bg-white/12 hover:-translate-y-0.5"
              style={{
                background: "rgba(255,255,255,0.07)",
                color: "rgba(255,255,255,0.85)",
                fontSize: "0.9375rem",
                border: "1px solid rgba(255,255,255,0.14)",
                backdropFilter: "blur(8px)",
              }}
            >
              <Users className="w-5 h-5" />
              Tìm Mentor ngay
            </button>
          </div>

          {/* Stats — glass-card giống khối metric Dashboard */}
          <div className="glass-card p-3 sm:p-4">
            <div className="relative z-[1] grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-3">
              {STATS.map((s, i) => (
                <div
                  key={i}
                  className="text-center py-5 px-3 sm:px-4 rounded-2xl border border-white/[0.08] bg-white/[0.04]"
                >
                  <div
                    className="text-white font-black mb-1"
                    style={{
                      fontSize: "clamp(1.25rem, 3.5vw, 1.5rem)",
                      letterSpacing: "-0.03em",
                    }}
                  >
                    {s.value}
                  </div>
                  <div className="text-white/45 text-[11px] font-semibold leading-snug">
                    {s.label}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Bottom fade — hòa vào gradient trang */}
        <div
          className="absolute bottom-0 left-0 right-0 h-28 pointer-events-none"
          style={{
            background: "linear-gradient(to top, #07060e, transparent)",
          }}
          aria-hidden
        />
      </section>



      {/* ═══ HOW IT WORKS ════════════════════════════════════ */}
      <section
        id="features"
        className="relative min-h-screen flex flex-col justify-center py-12 bg-transparent overflow-hidden border-t border-white/[0.06]"
      >
        {/* Nền phẳng (xen kẽ với section có lưới) */}
        <div className="absolute top-0 left-0 w-[500px] h-[500px] bg-[#c4ff47]/[0.07] blur-[120px] rounded-full -translate-x-1/2 -translate-y-1/2" aria-hidden />
        <div className="absolute bottom-0 right-0 w-[500px] h-[500px] bg-[#6E35E8]/10 blur-[120px] rounded-full translate-x-1/2 translate-y-1/2" aria-hidden />

        <div className="max-w-7xl mx-auto px-6 relative z-10 w-full py-8">
          <div className="text-center mb-14">
            <div className="flex justify-center mb-5">
              <span className="h-1 w-10 rounded-full bg-gradient-to-r from-[#c4ff47] to-emerald-400" />
            </div>
            <h2 className="text-4xl md:text-6xl text-white mb-4 leading-[1.1] py-2 cute-heading font-headline tracking-tighter">
              Quy trình tinh gọn,<br/>
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#c4ff47] via-fuchsia-300 to-violet-300">kết quả đột phá</span>
            </h2>
            <p className="text-zinc-400 text-lg max-w-2xl mx-auto leading-relaxed">
              Sẵn sàng chinh phục mọi nhà tuyển dụng với lộ trình chuẩn bị được cá nhân hóa bởi trí tuệ nhân tạo.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            {STEPS.map((s, i) => (
              <div
                key={i}
                className={`glass-card group p-6 sm:p-8 relative overflow-hidden transition-[border-color,box-shadow] duration-300 ${
                  i === 1
                    ? "border-[#c4ff47]/35 shadow-[0_0_0_1px_rgba(196,255,71,0.12)_inset]"
                    : i === 2
                      ? "border-violet-400/35 shadow-[0_0_0_1px_rgba(167,139,250,0.15)_inset]"
                      : "border-white/[0.12]"
                }`}
              >
                <div className="relative z-[1]">
                {/* Hàng nhãn cố định — tránh absolute đè lên icon */}
                <div className="mb-3 min-h-[30px] flex items-center justify-start">
                  {(i === 1 || i === 2) && (
                    <span
                      className={`inline-flex px-2 py-1 text-[10px] sm:text-[11px] font-bold tracking-wide rounded-md border ${
                        i === 1
                          ? "border-[#c4ff47]/55 bg-[#c4ff47]/18 text-[#e8ffc4] shadow-[0_0_14px_rgba(196,255,71,0.22)]"
                          : "border-violet-400/55 bg-violet-950/95 text-violet-50 shadow-[0_0_14px_rgba(139,92,246,0.28)]"
                      }`}
                    >
                      {i === 1 ? "Nổi bật" : "Gợi ý mentor"}
                    </span>
                  )}
                </div>
                <div className="absolute top-0 right-0 p-4 opacity-[0.06] group-hover:opacity-[0.14] transition-opacity pointer-events-none">
                  <span className="text-6xl font-black italic text-white">{s.step}</span>
                </div>

                <div
                  className={`relative w-14 h-14 rounded-2xl flex items-center justify-center mb-8 transition-all duration-500 shadow-xl float-icon parallax-layer ${
                    i % 2 === 0
                      ? "bg-[#c4ff47] text-[#0a0a0c] shadow-[0_0_24px_rgba(196,255,71,0.25)]"
                      : "bg-white/5 text-[#c4ff47] border border-white/10 group-hover:bg-[#c4ff47]/15 group-hover:border-[#c4ff47]/35"
                  }`}
                >
                  <s.icon className="h-7 w-7" />
                </div>

                <h3 className="text-xl font-bold mb-3 text-white parallax-layer font-headline tracking-tight">{s.title}</h3>
                <p className="text-white/45 text-sm leading-relaxed">
                  {s.desc}
                </p>
                </div>
              </div>
            ))}
          </div>

          {/* CTA Section */}
          <div className="mt-16 flex flex-col items-center">
            <button 
              onClick={() => handleFeatureClick("/dashboard")}
              className="group relative bg-primary-fixed text-on-primary-fixed px-12 py-5 rounded-full font-black text-xl tracking-tight uppercase transition-all duration-500 hover:scale-105 active:scale-95 shadow-[0_20px_50px_rgba(196,255,71,0.22)]"
            >
              Bắt đầu ngay
              <div className="absolute inset-0 rounded-full bg-white opacity-0 group-hover:opacity-20 transition-opacity"></div>
            </button>
            <div className="mt-6 flex items-center gap-4">
              <span className="w-12 h-px bg-white/10"></span>
              <span className="text-white/40 text-[10px] uppercase tracking-[0.2em] font-bold">Không cần thẻ tín dụng</span>
              <span className="w-12 h-px bg-white/10"></span>
            </div>
          </div>
        </div>
      </section>

      {/* ═══ INTERVIEW PREVIEW ═══════════════════════════════ */}
      <section
        className="border-t border-white/[0.07] bg-transparent relative"
        style={{
          padding: "64px 0",
          overflow: "hidden",
        }}
      >
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.05]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,0.35) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.35) 1px, transparent 1px)",
            backgroundSize: "32px 32px",
          }}
          aria-hidden
        />
        <div className="max-w-7xl mx-auto px-5 relative z-10">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
            {/* Left copy */}
            <div className="glass-card p-6 sm:p-8 lg:p-10">
              <div className="relative z-[1]">
              <div className="mb-5 h-1 w-10 rounded-full bg-gradient-to-r from-[#c4ff47] to-fuchsia-400" aria-hidden />
              <span
                className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-semibold mb-6 border border-violet-400/30 bg-violet-500/10 text-violet-200"
              >
                <Microphone
                  className="w-3.5 h-3.5"
                />
                Phòng phỏng vấn ảo
              </span>
              <h2
                className="text-white mb-5 leading-tight cute-heading"
                style={{
                  fontSize: "clamp(1.875rem, 4vw, 2.5rem)",
                }}
              >
                Trải nghiệm phỏng vấn{" "}
                <span style={{ color: "#c4ff47" }}>
                  như thật
                </span>
              </h2>
              <p
                className="mb-8 leading-relaxed"
                style={{
                  color: "rgba(255,255,255,0.45)",
                  fontSize: "1.05rem",
                }}
              >
                Phòng phỏng vấn ảo với AI phỏng vấn viên, phản
                hồi trực quan khi bạn đang nói, và đánh giá chi
                tiết từng câu trả lời theo mô hình STAR.
              </p>

              <ul className="space-y-3.5 mb-10">
                {[
                  "AI hỏi 5 câu hỏi cá nhân hóa theo JD",
                  "Nhận diện giọng nói tự động",
                  "Phản hồi tức thì sau mỗi câu trả lời",
                  "Phân tích chi tiết theo mô hình STAR",
                ].map((item, i) => (
                  <li
                    key={i}
                    className="flex items-center gap-3"
                    style={{ color: "rgba(255,255,255,0.7)" }}
                  >
                    <div
                      className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0"
                      style={{
                        background: "rgba(196, 255, 71,0.15)",
                      }}
                    >
                      <Check
                        className="w-3 h-3"
                        style={{ color: "#c4ff47" }}
                      />
                    </div>
                    <span className="text-sm">{item}</span>
                  </li>
                ))}
              </ul>

              <button
                onClick={() => navigate("/interview")}
                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl font-semibold transition-all hover:brightness-110 hover:-translate-y-0.5"
                style={{
                  background:
                    "linear-gradient(135deg, #c4ff47, #8fbc24)",
                  color: "#1a1a1a",
                  boxShadow: "0 0 28px rgba(196, 255, 71,0.25)",
                }}
              >
                Thử ngay miễn phí
                <ArrowRight className="w-4 h-4" />
              </button>
              </div>
            </div>

            {/* Right: mock interview screen with HR video */}
            <div className="relative">
              <div
                className="absolute -inset-6 rounded-[32px] opacity-50 blur-3xl pointer-events-none"
                style={{
                  background:
                    "radial-gradient(circle, rgba(196,255,71,0.2) 0%, rgba(110, 53, 232,0.35) 45%, transparent 70%)",
                }}
                aria-hidden
              />
              <div className="glass-card p-1 sm:p-1.5 rounded-[28px]">
              <div
                className="relative rounded-[24px] overflow-hidden border border-white/[0.08] bg-[#07060e]/95"
                style={{
                  boxShadow: "0 24px 64px rgba(0,0,0,0.5), 0 0 0 1px rgba(196,255,71,0.08) inset",
                }}
              >
                {/* Window chrome */}
                <div
                  className="flex items-center justify-between px-5 py-3.5"
                  style={{
                    background: "#0A0816",
                    borderBottom:
                      "1px solid rgba(255,255,255,0.07)",
                  }}
                >
                  <div className="flex gap-1.5">
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ background: "#FF5F57" }}
                    />
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ background: "#FEBC2E" }}
                    />
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ background: "#28C840" }}
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <div
                      className="w-2 h-2 rounded-full"
                      style={{
                        background: "rgba(110, 53, 232,0.6)",
                      }}
                    />
                    <span
                      className="text-xs"
                      style={{
                        color: "rgba(255,255,255,0.35)",
                      }}
                    >
                      ProInterview — Phỏng vấn AI
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div
                      className="w-2 h-2 rounded-full animate-pulse"
                      style={{ background: "#FF5F57" }}
                    />
                    <span
                      className="text-xs"
                      style={{ color: "#FF5F57" }}
                    >
                      Đang ghi
                    </span>
                  </div>
                </div>

                {/* Interview screen content */}
                <div className="relative" style={{ aspectRatio: "16/10", background: "#0A0816" }}>
                  {/* HR Video */}
                  <div className="absolute inset-0 flex items-center justify-center">
                    <video
                      autoPlay
                      loop
                      muted
                      playsInline
                      className="w-full h-full object-cover"
                      style={{ opacity: 0.95 }}
                    >
                      <source
                        src="https://res.cloudinary.com/dee4bvivu/video/upload/v1774336640/Female_delxmy.mp4"
                        type="video/mp4"
                      />
                    </video>
                  </div>

                  {/* Overlay UI */}
                  <div className="absolute inset-0 pointer-events-none">
                    {/* Top bar with timer and info */}
                    <div className="absolute top-0 left-0 right-0 p-4 flex items-center justify-between"
                      style={{
                        background: "linear-gradient(to bottom, rgba(18,11,46,0.92), transparent)"
                      }}
                    >
                      <div className="flex items-center gap-2">
                        <div
                          className="w-2 h-2 rounded-full animate-pulse"
                          style={{ background: "#FF5F57" }}
                        />
                        <span className="text-white text-xs font-semibold">
                          Đang phỏng vấn
                        </span>
                      </div>
                      <div
                        className="px-3 py-1.5 rounded-lg text-xs font-semibold"
                        style={{
                          background: "rgba(110, 53, 232,0.25)",
                          border: "1px solid rgba(110, 53, 232,0.4)",
                          color: "#B89DFF"
                        }}
                      >
                        03:24 / 15:00
                      </div>
                    </div>

                    {/* Current question display */}
                    <div className="absolute bottom-0 left-0 right-0 p-5"
                      style={{
                        background: "linear-gradient(to top, rgba(18,11,46,0.95), transparent)"
                      }}
                    >
                      <div
                        className="p-4 rounded-xl"
                        style={{
                          background: "rgba(110, 53, 232,0.15)",
                          border: "1px solid rgba(110, 53, 232,0.35)",
                          backdropFilter: "blur(12px)"
                        }}
                      >
                        <div className="flex items-start gap-3">
                          <div
                            className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                            style={{
                              background: "linear-gradient(135deg, #6E35E8, #9B6DFF)",
                            }}
                          >
                            <Sparkle
                              className="w-4 h-4 text-white"
                            />
                          </div>
                          <div className="flex-1">
                            <p className="text-white/50 text-xs mb-1.5 font-semibold">
                              Câu hỏi 2/5
                            </p>
                            <p className="text-white text-sm leading-relaxed">
                              Hãy kể về một lần bạn phải giải quyết xung đột trong nhóm. Bạn đã xử lý như thế nào?
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* Quick stats */}
                      <div className="grid grid-cols-3 gap-2 mt-3">
                        {[
                          { icon: Microphone, label: "Đang nghe", color: "#c4ff47" },
                          { icon: Brain, label: "Phân tích STAR", color: "#6E35E8" },
                          { icon: ChartBar, label: "Điểm: 3.8/5", color: "#FFB800" },
                        ].map((item, i) => (
                          <div
                            key={i}
                            className="flex items-center gap-2 px-2.5 py-2 rounded-lg"
                            style={{
                              background: "rgba(255,255,255,0.06)",
                              border: "1px solid rgba(255,255,255,0.08)"
                            }}
                          >
                            <item.icon
                              className="w-3.5 h-3.5 flex-shrink-0"
                              style={{ color: item.color }}
                            />
                            <span
                              className="text-xs font-medium"
                              style={{ color: "rgba(255,255,255,0.6)" }}
                            >
                              {item.label}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ═══ COURSES SECTION ═════════════════════════════════ */}
      <section
        id="courses"
        className="relative min-h-screen flex flex-col justify-center py-20 bg-transparent overflow-hidden border-t border-white/[0.06]"
      >
        <div className="absolute top-0 right-[-100px] w-[500px] h-[500px] bg-[#c4ff47]/[0.06] blur-[130px] rounded-full" aria-hidden />
        <div className="absolute bottom-[-100px] left-[-100px] w-[600px] h-[600px] bg-[#6E35E8]/12 blur-[150px] rounded-full" aria-hidden />

        <div className="max-w-7xl mx-auto px-6 relative z-10 w-full py-12">
          <div className="flex flex-col md:flex-row items-end gap-10 mb-12">
            <div className="md:w-2/3">
              <div className="h-1 w-10 rounded-full bg-gradient-to-r from-[#c4ff47] to-emerald-400 mb-4" aria-hidden />
              <span className="font-bold uppercase tracking-[0.2em] text-[10px] mb-3 block text-[#c4ff47] drop-shadow-[0_0_12px_rgba(196,255,71,0.25)]">
                Nền tảng học
              </span>
              <h2 className="text-4xl md:text-6xl font-black tracking-tighter leading-[0.95] text-white mb-6">
                Học từ chuyên gia,<br/>
                <span className="text-primary-fixed">sửa lỗi ngay.</span>
              </h2>
              <p className="text-lg text-zinc-400 leading-relaxed max-w-xl">
                Nâng tầm sự nghiệp với feedback trực tiếp từ Mentor hàng đầu. Hoàn thiện từng câu trả lời thông qua bài tập thực tế.
              </p>
            </div>
            <div className="w-full md:w-1/3 flex justify-end">
              <div className="glass-card !rounded-full px-2 py-1.5 flex items-center gap-3 min-w-0 max-w-full">
                <div className="relative z-[1] flex items-center gap-3 w-full">
                <div className="flex -space-x-3 px-2">
                  {[1, 2, 3].map(i => (
                    <img key={i} src={`https://i.pravatar.cc/100?img=${i+10}`} alt="Student" className="w-8 h-8 rounded-full border-2 border-white/15 object-cover" />
                  ))}
                </div>
                <span className="pr-4 pl-1 text-[11px] font-bold text-[#c4ff47]">10k+ Học viên</span>
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
            {COURSES_DATA.slice(0, 3).map((course, idx) => (
              <div
                key={course.id}
                onClick={() =>
                  handleFeatureClick(`/courses/${course.id}`)
                }
                className="group glass-card overflow-hidden cursor-pointer !rounded-[28px]"
              >
                <div className="relative z-[1]">
                {/* Thumbnail */}
                <div className="relative h-48 overflow-hidden">
                  <img
                    src={course.thumbnail}
                    alt={course.title}
                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                  
                  <div className="absolute top-4 left-4 flex gap-2">
                    <span className="bg-secondary/90 backdrop-blur-md text-white px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider">
                      {course.category}
                    </span>
                    <span className="bg-black/60 backdrop-blur-md text-white px-3 py-1 rounded-full text-[10px] font-medium flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-sm">schedule</span>
                      {Math.floor(course.duration / 60)}h {course.duration % 60}m
                    </span>
                  </div>
                  {idx === 0 && (
                    <span className="absolute top-4 right-4 px-2.5 py-1 text-[10px] font-black tracking-wide uppercase sticker-badge text-primary-fixed">
                      New
                    </span>
                  )}
                  
                  <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-500 scale-90 group-hover:scale-100">
                    <div className="w-14 h-14 rounded-full bg-primary-fixed/90 flex items-center justify-center shadow-2xl shadow-primary-fixed/30 transform transition-transform border border-white/20 float-icon-delay parallax-layer">
                      <PlayCircle className="w-7 h-7 text-on-primary-fixed translate-x-0.5" />
                    </div>
                  </div>
                </div>

                <div className="p-7">
                  <h3 className="text-xl font-bold mb-5 text-white group-hover:text-primary-fixed transition-colors leading-tight line-clamp-2 parallax-layer">
                    {course.title}
                  </h3>
                  
                  <div className="flex items-center gap-3 mb-6">
                    <img
                      src={course.mentorAvatar}
                      alt={course.mentorName}
                      className="w-10 h-10 rounded-xl object-cover border border-white/10"
                    />
                    <div>
                      <p className="text-sm font-bold text-white">{course.mentorName}</p>
                      <span className="text-[9px] uppercase tracking-[0.15em] font-black text-zinc-400">
                        Mentor duyệt
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-4 border-t border-white/10">
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-primary-fixed text-lg" style={{ fontVariationSettings: "'FILL' 1" }}>star</span>
                      <span className="font-bold text-white text-sm">{course.rating}</span>
                      <span className="text-white/35 text-xs">({(course.reviewsCount || 0) + 700})</span>
                    </div>
                    <div className="text-lg font-black text-primary-fixed">
                      {new Intl.NumberFormat("vi-VN", {
                        style: "currency",
                        currency: "VND",
                      }).format(course.price)}
                    </div>
                  </div>
                </div>
                </div>
              </div>
            ))}
          </div>

          <div className="text-center">
            <button
              onClick={() => navigate("/courses")}
              className="px-10 py-3.5 rounded-full border border-white/15 text-white font-bold hover:bg-white/[0.06] hover:border-[#c4ff47]/35 transition-all text-sm"
            >
              Xem tất cả khóa học
            </button>
          </div>
        </div>
      </section>



      {/* ═══ TESTIMONIALS ═══════════════════════════════════ */}
      <section
        id="testimonials"
        className="min-h-screen flex flex-col justify-center relative overflow-hidden bg-transparent border-t border-white/[0.07]"
      >
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.05]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,0.35) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.35) 1px, transparent 1px)",
            backgroundSize: "32px 32px",
          }}
          aria-hidden
        />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-[#c4ff47]/[0.04] blur-[150px] rounded-full opacity-60 pointer-events-none" aria-hidden />

        <div className="max-w-7xl mx-auto px-5 relative z-10">
          <div className="text-center mb-16">
            <div className="flex justify-center mb-5">
              <span className="h-1 w-10 rounded-full bg-gradient-to-r from-[#c4ff47] to-violet-400" />
            </div>
            <h2
              className="text-white mb-4 cute-heading"
              style={{
                fontSize: "clamp(1.875rem, 4vw, 2.5rem)",
              }}
            >
              Người dùng nói gì về{" "}
              <span
                style={{
                  background:
                    "linear-gradient(135deg, #6E35E8, #c4ff47)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  backgroundClip: "text",
                }}
              >
                ProInterview
              </span>
            </h2>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {TESTIMONIALS.map((t, i) => (
            <div
                key={i}
              className="glass-card p-6 sm:p-7 !rounded-[28px]"
              >
                <div className="relative z-[1]">
                {/* Stars */}
                <div className="flex gap-1 mb-4">
                  {[...Array(t.stars)].map((_, j) => (
                    <Star
                      key={j}
                      className="w-4 h-4"
                      fill="#FFB800"
                      style={{ color: "#FFB800" }}
                    />
                  ))}
                  <span
                    className="ml-auto text-xs px-2 py-0.5 rounded-full font-medium"
                    style={{
                      background: "rgba(196, 255, 71,0.12)",
                      color: "#c4ff47",
                      border: "1px solid rgba(196, 255, 71,0.2)",
                    }}
                  >
                    {t.tag}
                  </span>
                </div>
                <p
                  className="text-sm leading-relaxed mb-6"
                  style={{ color: "rgba(255,255,255,0.55)" }}
                >
                  "{t.text}"
                </p>
                <div className="flex items-center gap-3">
                  <div
                    className={`w-9 h-9 rounded-full bg-gradient-to-br ${t.grad} flex items-center justify-center text-white text-xs font-bold flex-shrink-0 float-icon-slow`}
                  >
                    {t.avatar}
                  </div>
                  <div>
                    <p className="text-white text-sm font-semibold">
                      {t.name}
                    </p>
                    <p
                      className="text-xs"
                      style={{
                        color: "rgba(255,255,255,0.35)",
                      }}
                    >
                      {t.role}
                    </p>
                  </div>
                </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ PRICING SECTION ═════════════════════════════════════ */}
      <section 
        id="pricing" 
        className="min-h-screen flex flex-col justify-center py-24 relative overflow-hidden bg-transparent border-t border-white/[0.06]"
      >
        <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-24 w-[600px] h-[300px] bg-[#c4ff47]/[0.08] blur-[120px] rounded-full pointer-events-none" aria-hidden />

        <div className="max-w-7xl mx-auto px-6 relative z-10 w-full py-12">
          <header className="text-center mb-10">
            <div className="flex justify-center mb-4">
              <span className="h-1 w-10 rounded-full bg-gradient-to-r from-[#c4ff47] to-emerald-400" />
            </div>
            <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#c4ff47]/12 border border-[#c4ff47]/35 text-[#e8ffc4] text-[10px] font-black tracking-widest uppercase mb-4 shadow-[0_0_20px_rgba(196,255,71,0.12)]">
              <Sparkles className="size-3 text-[#c4ff47]" />
              Đầu tư cho tương lai
            </span>
            <h2 className="text-3xl md:text-5xl font-black font-headline tracking-tighter mb-3 leading-tight text-white">
              Bảng giá <span className="text-primary-fixed">linh hoạt</span>
            </h2>
            <p className="text-zinc-400 max-w-xl mx-auto text-base">
              Chọn gói giải pháp phù hợp với lộ trình sự nghiệp của bạn.
            </p>
          </header>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8 items-stretch">
            {/* Free Tier */}
            <div className="glass-card p-8 !rounded-[28px] flex flex-col h-full group">
              <div className="relative z-[1] flex flex-col flex-1">
              <div className="mb-6">
                <h3 className="font-headline font-bold text-lg mb-1 text-white">Cơ bản (Free)</h3>
                <div className="flex items-baseline gap-1">
                  <span className="text-3xl font-black font-headline text-white">0đ</span>
                  <span className="text-zinc-500 text-xs">/tháng</span>
                </div>
              </div>
              <ul className="space-y-3 mb-8 flex-grow">
                {["2 buổi AI Interview thử nghiệm", "3 lần phân tích CV/JD", "10 câu hỏi mẫu theo ngành"].map((f, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-zinc-300">
                    <CheckCircle2 className="size-4 shrink-0 text-secondary" />
                    {f}
                  </li>
                ))}
              </ul>
              <button onClick={() => navigate("/register")} className="w-full py-3 rounded-full border border-white/10 text-white font-bold text-sm hover:bg-white/5 transition-all mt-auto">
                Bắt đầu ngay
              </button>
              </div>
            </div>

            {/* Pro Tier */}
            <div className="relative glass-card p-8 !rounded-[28px] flex flex-col h-full border-2 border-primary-fixed md:scale-[1.04] z-10 shadow-[0_18px_45px_rgba(196,255,71,0.18)] !overflow-visible">
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary-fixed text-on-primary-fixed px-3 py-0.5 rounded-full text-[10px] font-black tracking-widest uppercase z-[2] shadow-[0_0_20px_rgba(196,255,71,0.35)]">
                PHỔ BIẾN NHẤT
              </div>
              <div className="relative z-[1] flex flex-col flex-1 pt-2">
              <div className="mb-6">
                <h3 className="font-headline font-bold text-lg mb-1 text-white">Chuyên nghiệp (Pro)</h3>
                <div className="flex items-baseline gap-1">
                  <span className="text-3xl font-black font-headline text-white">79.000đ</span>
                  <span className="text-zinc-400 text-xs">/tháng</span>
                </div>
              </div>
              <ul className="space-y-3 mb-8 flex-grow">
                {["10 buổi AI Interview/tháng", "Nhận diện giọng nói AI", "20 lần phân tích CV/JD", "Phản hồi chi tiết từng câu"].map((f, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm font-bold text-white">
                    <CheckCircle2 className="size-4 shrink-0 text-primary-fixed" />
                    {f}
                  </li>
                ))}
              </ul>
              <button onClick={() => navigate("/checkout?plan=starterPro&billing=monthly&planPrice=79000")} className="w-full py-3 rounded-full bg-primary-fixed text-on-primary-fixed font-black text-sm shadow-[0px_0px_20px_rgba(191,255,0,0.3)] hover:brightness-110 transition-all mt-auto">
                Nâng cấp Pro
              </button>
              </div>
            </div>

            {/* Elite Tier */}
            <div className="glass-card p-8 !rounded-[28px] flex flex-col h-full border border-secondary/40 group !overflow-visible">
              <div className="relative z-[1] flex flex-col flex-1">
              <div className="mb-6">
                <h3 className="font-headline font-bold text-lg mb-1 text-secondary-fixed">Thượng hạng (Elite)</h3>
                <div className="flex items-baseline gap-1">
                  <span className="text-3xl font-black font-headline text-white">99.000đ</span>
                  <span className="text-zinc-500 text-xs">/tháng</span>
                </div>
              </div>
              <ul className="space-y-3 mb-8 flex-grow">
                {["AI Interview KHÔNG GIỚI HẠN", "Phân tích hành vi & tư thế", "Nhận diện giọng nói Turbo", "Hỗ trợ ưu tiên 24/7"].map((f, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm font-bold text-white">
                    <ShieldCheck className="size-4 shrink-0 text-secondary-fixed" />
                    {f}
                  </li>
                ))}
              </ul>
              <button onClick={() => navigate("/checkout?plan=elitePro&billing=monthly&planPrice=99000")} className="w-full py-3 rounded-full border border-secondary/50 text-secondary-fixed font-bold text-sm hover:bg-secondary/10 transition-all mt-auto">
                Nâng cấp Elite
              </button>
              </div>
            </div>
          </div>

          {/* CTA Section */}
          <div className="mt-14 glass-card p-8 sm:p-10 !rounded-[28px] text-center relative overflow-hidden">
            <div className="relative z-[1]">
            <h2 className="text-3xl font-headline font-black mb-4 text-white">Bạn vẫn còn băn khoăn?</h2>
            <p className="text-zinc-400 mb-8 max-w-xl mx-auto">Thử gói Free để trải nghiệm sức mạnh của AI. Không cần thẻ tín dụng.</p>
            <div className="flex flex-col md:flex-row items-center justify-center gap-6">
              <button onClick={() => navigate("/register")} className="bg-primary-fixed text-on-primary-fixed font-black px-10 py-3 rounded-full hover:scale-105 transition-all shadow-[0_0_28px_rgba(196,255,71,0.25)]">Bắt đầu miễn phí</button>
            </div>
            </div>
          </div>
        </div>
      </section>

      {/* ═══ FOOTER ══════════════════════════════════════════ */}
      <Footer variant="dark" />
    </div>
  );
}