import React, { useState } from "react";
import { useNavigate } from "react-router";
import {
  Sparkles as Sparkle,
  MessageCircle as ChatCircleDots,
  Phone,
  Mail as EnvelopeSimple,
  Clock,
  ArrowRight,
  Heart,
  ShieldCheck,
} from "lucide-react";

/* ── Social icon SVGs ── */
function FacebookIcon({ className, style }) {
  return (
    <svg className={className} style={style} viewBox="0 0 24 24" fill="currentColor">
      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
    </svg>
  );
}
function TiktokIcon({ className, style }) {
  return (
    <svg className={className} style={style} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z"/>
    </svg>
  );
}
function YoutubeIcon({ className, style }) {
  return (
    <svg className={className} style={style} viewBox="0 0 24 24" fill="currentColor">
      <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
    </svg>
  );
}
function LinkedinIcon({ className, style }) {
  return (
    <svg className={className} style={style} viewBox="0 0 24 24" fill="currentColor">
      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
    </svg>
  );
}

/* ── Data ── */
const NAV_LINKS = {
  "Sản phẩm": [
    { label: "Phỏng vấn AI", path: "/interview" },
    { label: "Phân tích CV/JD", path: "/cv-analysis" },
    { label: "Mentor 1-1", path: "/mentors" },
    { label: "Bảng điều khiển", path: "/dashboard" },
  ],
  "Dịch vụ": [
    { label: "Bảng giá", path: "/pricing" },
    { label: "Đặt lịch Mentor", path: "/mentors" },
    { label: "Phỏng vấn thử", path: "/interview" },
    { label: "Hồ sơ của tôi", path: "/profile" },
  ],
  "Hỗ trợ": [
    { label: "Trung tâm trợ giúp", path: "#" },
    { label: "Hướng dẫn sử dụng", path: "#" },
    { label: "Điều khoản dịch vụ", path: "#" },
    { label: "Chính sách bảo mật", path: "#" },
  ],
};

const SOCIAL_LINKS = [
  { name: "Facebook",  href: "https://www.facebook.com/janetns.198/",           icon: FacebookIcon,  color: "#1877F2", bgLight: "rgba(24,119,242,0.08)",  bgDark: "rgba(24,119,242,0.1)"  },
  { name: "TikTok",   href: "https://www.tiktok.com/@prointerview",             icon: TiktokIcon,    color: "#010101", bgLight: "rgba(0,0,0,0.06)",       bgDark: "rgba(0,0,0,0.07)"      },
  { name: "YouTube",  href: "https://www.youtube.com/@prointerview",            icon: YoutubeIcon,   color: "#FF0000", bgLight: "rgba(255,0,0,0.07)",     bgDark: "rgba(255,0,0,0.08)"    },
  { name: "LinkedIn", href: "https://www.linkedin.com/company/prointerview",    icon: LinkedinIcon,  color: "#0A66C2", bgLight: "rgba(10,102,194,0.08)",  bgDark: "rgba(10,102,194,0.1)"  },
];

const SUPPORT_ITEMS = [
  { icon: ChatCircleDots, title: "Live Chat",  desc: "Phản hồi trong 2 phút",    color: "#6E35E8", bg: "rgba(110, 53, 232,0.1)" },
  { icon: Phone,          title: "Hotline",    desc: "1800 1234 (miễn phí)",     color: "#FF8C42", bg: "rgba(255,140,66,0.1)" },
  { icon: EnvelopeSimple, title: "Email",      desc: "support@prointerview.vn",  color: "#10b981", bg: "rgba(16,185,129,0.1)" },
];

/* ══════════════════════════════════════════════════════════════
   DARK variant — dùng ở /home (nền tối #0F0B1A)
══════════════════════════════════════════════════════════════ */
function FooterDark() {
  const navigate = useNavigate();
  const [hoveredSocial, setHoveredSocial] = useState(null);

  return (
    <footer
      style={{
        background: "linear-gradient(180deg, #07060e 0%, #0a0618 55%, #12081f 100%)",
        borderTop: "1px solid rgba(255,255,255,0.08)",
        boxShadow: "0 -1px 0 rgba(196, 255, 71, 0.06)",
      }}
    >
      {/* Support 24/7 banner */}
      <div style={{ 
        background: "linear-gradient(135deg, rgba(110, 53, 232,0.14) 0%, rgba(196, 255, 71,0.1) 100%)",
        borderBottom: "1px solid rgba(255,255,255,0.07)"
      }}>
        <div className="max-w-7xl mx-auto px-6 py-10">
          <div className="flex flex-col lg:flex-row items-center justify-between gap-8">
            <div className="text-center lg:text-left max-w-md">
              <div className="flex items-center gap-2.5 justify-center lg:justify-start mb-3">
                <div className="relative w-6 h-6 rounded-full flex items-center justify-center" style={{ background: "rgba(16,185,129,0.2)" }}>
                  <div className="w-3 h-3 rounded-full bg-emerald-400 animate-pulse" />
                  <div className="absolute inset-0 rounded-full bg-emerald-400 animate-ping opacity-20" />
                </div>
                <span className="text-emerald-400 text-sm font-bold tracking-wider">HỖ TRỢ 24/7 • LUÔN SẴN SÀNG</span>
              </div>
              <h3 className="text-white mb-2" style={{ fontSize: "1.5rem", fontWeight: 800, letterSpacing: "-0.03em" }}>
                Chúng tôi luôn ở đây hỗ trợ bạn
              </h3>
              <p className="text-white/60 text-sm leading-relaxed">
                Đội ngũ chuyên nghiệp phản hồi trong 2 phút — kể cả cuối tuần và ngày lễ.
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {SUPPORT_ITEMS.map((item) => {
                const Icon = item.icon;
                return (
                  <div 
                    key={item.title} 
                    className="group flex items-center gap-3 px-5 py-4 rounded-2xl cursor-pointer transition-all hover:scale-[1.03] hover:-translate-y-1"
                    style={{ 
                      background: "rgba(255,255,255,0.05)", 
                      border: "1px solid rgba(196, 255, 71, 0.12)",
                      backdropFilter: "blur(12px)"
                    }}
                  >
                    <div 
                      className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 transition-transform group-hover:scale-110" 
                      style={{ background: item.bg, boxShadow: `0 4px 16px ${item.color}33` }}
                    >
                      <Icon style={{ color: item.color, width: 20, height: 20 }} />
                    </div>
                    <div>
                      <p className="text-white text-sm font-bold">{item.title}</p>
                      <p className="text-white/50 text-xs mt-0.5">{item.desc}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Main body */}
      <div className="max-w-7xl mx-auto px-6 py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-12 lg:gap-10">
          {/* Brand */}
          <div className="lg:col-span-2">
            <div className="flex items-center gap-3 mb-5">
              <div 
                className="w-11 h-11 rounded-2xl flex items-center justify-center"
                style={{ 
                  background: "linear-gradient(135deg,#6E35E8,#9B6DFF)", 
                  boxShadow: "0 8px 24px rgba(110, 53, 232,0.5)" 
                }}
              >
                <Sparkle className="w-6 h-6 text-white" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-white font-extrabold" style={{ fontSize: "1.3rem", letterSpacing: "-0.03em" }}>ProInterview</span>
                  <span 
                    className="text-xs font-extrabold px-2 py-1 rounded-lg" 
                    style={{ background: "linear-gradient(135deg, #c4ff47, #8fbc24)", color: "#120B2E" }}
                  >
                    MVP
                  </span>
                </div>
              </div>
            </div>
            <p className="text-white/65 text-sm leading-relaxed mb-6" style={{ maxWidth: 320 }}>
              Nền tảng luyện phỏng vấn AI thông minh hàng đầu Việt Nam — giúp bạn tự tin chinh phục mọi cơ hội nghề nghiệp.
            </p>
            
            {/* Social links */}
            <div className="mb-6">
              <p className="text-white/40 text-xs uppercase tracking-[0.15em] mb-4 font-bold">Kết nối với chúng tôi</p>
              <div className="flex gap-3">
                {SOCIAL_LINKS.map((s) => {
                  const Icon = s.icon;
                  const isHovered = hoveredSocial === s.name;
                  return (
                    <a 
                      key={s.name} 
                      href={s.href} 
                      target="_blank" 
                      rel="noopener noreferrer" 
                      title={s.name}
                      onMouseEnter={() => setHoveredSocial(s.name)}
                      onMouseLeave={() => setHoveredSocial(null)}
                      className="w-11 h-11 rounded-xl flex items-center justify-center transition-all duration-300"
                      style={{
                        background: isHovered ? s.color : "rgba(255,255,255,0.05)",
                        border: `1.5px solid ${isHovered ? s.color : "rgba(255,255,255,0.1)"}`,
                        transform: isHovered ? "translateY(-4px)" : "none",
                        boxShadow: isHovered ? `0 8px 28px ${s.color}55` : "none",
                      }}
                    >
                      <Icon style={{ color: isHovered ? "#fff" : "rgba(255,255,255,0.6)", width: 19, height: 19 }} />
                    </a>
                  );
                })}
              </div>
            </div>
            
            {/* Security badge */}
            <div 
              className="inline-flex items-center gap-2.5 px-4 py-2.5 rounded-xl"
              style={{ background: "rgba(16,185,129,0.1)", border: "1px solid rgba(16,185,129,0.2)" }}
            >
              <ShieldCheck className="w-5 h-5 text-emerald-400" />
              <span className="text-white/70 text-xs font-semibold">Bảo mật SSL 256-bit</span>
            </div>
          </div>

          {/* Nav columns */}
          {Object.entries(NAV_LINKS).map(([section, links]) => (
            <div key={section}>
              <h4 
                className="text-white font-bold mb-5" 
                style={{ fontSize: "0.9375rem", letterSpacing: "-0.01em" }}
              >
                {section}
              </h4>
              <ul className="space-y-3">
                {links.map((link) => (
                  <li key={link.label}>
                    <button 
                      onClick={() => link.path !== "#" && navigate(link.path)}
                      className="text-white/55 hover:text-white text-sm transition-all duration-200 text-left group flex items-center gap-2"
                    >
                      <ArrowRight 
                        className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-all -translate-x-2 group-hover:translate-x-0" 
                        style={{ color: "#c4ff47" }}
                        
                      />
                      <span className="group-hover:translate-x-1 transition-transform duration-200">
                        {link.label}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>

      {/* Facebook community strip */}
      <div 
        style={{ 
          borderTop: "1px solid rgba(255,255,255,0.06)", 
          background: "linear-gradient(135deg, rgba(24,119,242,0.12) 0%, rgba(24,119,242,0.06) 100%)"
        }}
      >
        <div className="max-w-7xl mx-auto px-6 py-5 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div 
              className="w-12 h-12 rounded-2xl flex items-center justify-center" 
              style={{ 
                background: "linear-gradient(135deg, #1877F2, #0E5FC0)",
                boxShadow: "0 4px 20px rgba(24,119,242,0.4)"
              }}
            >
              <FacebookIcon style={{ color: "#fff", width: 20, height: 20 }} />
            </div>
            <div>
              <p className="text-white font-bold text-sm">Cộng đồng ProInterview</p>
              <p className="text-white/50 text-xs">6,500+ thành viên • Chia sẻ kinh nghiệm mỗi ngày</p>
            </div>
          </div>
          <a 
            href="https://www.facebook.com/janetns.198/" 
            target="_blank" 
            rel="noopener noreferrer"
            className="flex items-center gap-2.5 px-6 py-3 rounded-xl text-sm font-bold transition-all hover:scale-[1.05] active:scale-[0.98] whitespace-nowrap"
            style={{ 
              background: "#1877F2", 
              color: "#fff", 
              boxShadow: "0 6px 24px rgba(24,119,242,0.45)" 
            }}
          >
            <FacebookIcon style={{ width: 17, height: 17 }} />
            Tham gia ngay
          </a>
        </div>
      </div>

      {/* Bottom bar */}
      <div style={{ borderTop: "1px solid rgba(255,255,255,0.05)", background: "rgba(0,0,0,0.2)" }}>
        <div className="max-w-7xl mx-auto px-6 py-5 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-white/35 text-xs">
            © {new Date().getFullYear()} ProInterview. All rights reserved.
          </p>
          <div className="flex items-center gap-1.5 text-white/35 text-xs">
            <span>Made with</span>
            <Heart className="w-3.5 h-3.5 text-red-400 animate-pulse" />
            <span>in Vietnam</span>
            <span className="ml-1">🇻🇳</span>
          </div>
          <div className="flex items-center gap-2 text-white/35 text-xs">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span>24/7 Support Available</span>
          </div>
        </div>
      </div>
    </footer>
  );
}

/* ══════════════════════════════════════════════════════════════
   LIGHT variant — dùng ở dashboard/trang nội bộ (nền sáng)
══════════════════════════════════════════════════════════════ */
function FooterLight() {
  return null;
}

/* ── Public export ── */
export function Footer({ variant = "light" }) {
  return variant === "dark" ? <FooterDark /> : <FooterLight />;
}