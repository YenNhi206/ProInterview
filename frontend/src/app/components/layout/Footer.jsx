import React, { useState } from "react";
import { useNavigate, useLocation } from "react-router";
import { Heart, Mail, ShieldCheck } from "lucide-react";
import { BrandLogo } from "../brand/BrandLogo";
import { FOOTER_TAGLINE } from "../../constants/brandVoice";
import { HOME_SECTION_INNER } from "./customerShellLayout";

const FOOTER_SHELL_DEFAULT = "mx-auto w-full max-w-7xl px-6";

/* ── Social icon SVGs ── */
function FacebookIcon({ className, style }) {
  return (
    <svg className={className} style={style} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
      <path fill="currentColor" d="M12 2.04c-5.5 0-10 4.49-10 10.02c0 5 3.66 9.15 8.44 9.9v-7H7.9v-2.9h2.54V9.85c0-2.51 1.49-3.89 3.78-3.89c1.09 0 2.23.2 2.23.2v2.46h-1.26c-1.24 0-1.63.77-1.63 1.56v1.88h2.78l-.45 2.9h-2.33v7a10 10 0 0 0 8.44-9.9c0-5.53-4.5-10.02-10-10.02Z"/>
    </svg>
  );
}
function TiktokIcon({ className, style }) {
  return (
    <svg className={className} style={style} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 448 512">
      <path fill="currentColor" d="M448 209.91a210.06 210.06 0 0 1-122.77-39.25v178.72A162.55 162.55 0 1 1 162.6 186.8v86.27a76.28 76.28 0 1 0 76.24 76.27V0h86.27c5.21 82.26 70.36 147.24 152.89 152.88z"/>
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
    <svg className={className} style={style} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
      <path fill="currentColor" d="M19 3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14m-.5 15.5v-5.3a3.26 3.26 0 0 0-3.16-3.8a3.07 3.07 0 0 0-2.84 1.63v-1.4h-3.18v8.87h3.18v-4.88c0-1.3.25-2.55 1.85-2.55c1.58 0 1.6 1.48 1.6 2.63v4.8h3.17M7.05 18.5h3.18V9.63H7.05v8.87M8.63 5.46a1.84 1.84 0 0 0-1.84 1.84a1.85 1.85 0 0 0 1.84 1.85a1.84 1.84 0 0 0 1.85-1.85a1.85 1.85 0 0 0-1.85-1.84Z"/>
    </svg>
  );
}
function InstagramIcon({ className, style }) {
  return (
    <svg className={className} style={style} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
      <path fill="currentColor" d="M7.8 2h8.4C19.4 2 22 4.6 22 7.8v8.4a5.8 5.8 0 0 1-5.8 5.8H7.8C4.6 22 2 19.4 2 16.2V7.8A5.8 5.8 0 0 1 7.8 2m-.2 2A3.6 3.6 0 0 0 4 7.6v8.8C4 18.39 5.61 20 7.6 20h8.8a3.6 3.6 0 0 0 3.6-3.6V7.6C20 5.61 18.39 4 16.4 4H7.6m9.65 1.5a1.25 1.25 0 0 1 1.25 1.25A1.25 1.25 0 0 1 17.25 8A1.25 1.25 0 0 1 16 6.75a1.25 1.25 0 0 1 1.25-1.25M12 7a5 5 0 0 1 5 5a5 5 0 0 1-5 5a5 5 0 0 1-5-5a5 5 0 0 1 5-5m0 2a3 3 0 0 0-3 3a3 3 0 0 0 3 3a3 3 0 0 0 3-3a3 3 0 0 0-3-3Z"/>
    </svg>
  );
}

/* ── Data ── */
const NAV_LINKS = {
  "Giải pháp": [
    { label: "Luyện phỏng vấn với AI", path: "/interview" },
    { label: "Tối ưu CV theo vị trí ứng tuyển", path: "/cv-analysis" },
    { label: "Kết nối Mentor 1:1", path: "/mentors" },
    { label: "Khóa học từ Mentor", path: "/courses" },
  ],
  "Về ProInterview": [
    { label: "Giới thiệu", path: "/about" },
    { label: "Tin tức & Hoạt động", path: "/achievements" },
    { label: "Điều khoản dịch vụ", path: "/terms" },
    { label: "Chính sách bảo mật", path: "/privacy" },
  ],
};

const FOOTER_MAIN_GRID =
  "grid w-full grid-cols-1 gap-10 sm:grid-cols-2 lg:grid-cols-[minmax(0,2.25fr)_minmax(0,1fr)_minmax(0,1fr)] lg:items-start lg:gap-x-10 xl:gap-x-14";

const CONTACT_EMAIL = "prointerview.ai@gmail.com";

function FooterNavColumn({ section, links, navigate, variant = "light" }) {
  const headingClass =
    variant === "dark"
      ? "mb-4 text-center sm:text-left text-[0.9375rem] font-bold tracking-tight text-white/90"
      : "mb-4 text-center sm:text-left text-[0.9375rem] font-bold tracking-tight text-slate-900";
  const linkClass =
    variant === "dark"
      ? "text-center sm:text-left text-sm text-white/55 transition-colors hover:text-white"
      : "text-center sm:text-left text-sm text-slate-600 transition-colors hover:text-[#8037f4]";

  return (
    <nav className="flex flex-col items-center sm:items-start text-center sm:text-left" aria-label={section}>
      <h4 className={headingClass}>{section}</h4>
      <ul className="flex flex-col items-center sm:items-start space-y-2.5">
        {links.map((link) => (
          <li key={link.label}>
            <button
              type="button"
              onClick={() => link.path !== "#" && navigate(link.path)}
              className={linkClass}
            >
              {link.label}
            </button>
          </li>
        ))}
      </ul>
    </nav>
  );
}

const SOCIAL_LINKS = [
  { name: "Facebook",  href: "https://www.facebook.com/ProInterviewAI",         icon: FacebookIcon,  color: "#1877F2", bgLight: "rgba(24,119,242,0.08)",  bgDark: "rgba(24,119,242,0.1)"  },
  { name: "TikTok",   href: "https://www.tiktok.com/@prointerview",             icon: TiktokIcon,    color: "#010101", bgLight: "rgba(0,0,0,0.06)",       bgDark: "rgba(0,0,0,0.07)"      },
  { name: "LinkedIn", href: "https://www.linkedin.com/company/prointerviewai/", icon: LinkedinIcon,  color: "#0A66C2", bgLight: "rgba(10,102,194,0.08)",  bgDark: "rgba(10,102,194,0.1)"  },
  { name: "Instagram", href: "https://www.instagram.com/prointerviewvn/",       icon: InstagramIcon, color: "#E4405F", bgLight: "rgba(228,64,95,0.08)",   bgDark: "rgba(228,64,95,0.1)"   },
];

/* ══════════════════════════════════════════════════════════════
   DARK variant, trang nền tối (tùy chọn)
══════════════════════════════════════════════════════════════ */
function FooterDark() {
  const navigate = useNavigate();
  const [hoveredSocial, setHoveredSocial] = useState(null);

  return (
    <footer
      className="relative overflow-hidden"
      style={{
        background: "rgba(255, 255, 255, 0.01)",
        backgroundBlendMode: "luminosity",
        borderTop: "1.5px solid rgba(255, 255, 255, 0.45)",
        boxShadow: "inset 0 1px 1px rgba(255, 255, 255, 0.1)",
        backdropFilter: "blur(4px)",
        WebkitBackdropFilter: "blur(4px)",
      }}
    >
      {/* Ánh violet rất nhẹ, không làm sáng cả khối */}
      <div
        className="pointer-events-none absolute z-0 h-[min(72vw,520px)] w-[min(72vw,520px)] rounded-full bg-[#630ed4]/14 blur-[100px] sm:h-[520px] sm:w-[520px] sm:blur-[110px]"
        style={{ left: "-14%", top: "38%" }}
        aria-hidden
      />

      {/* Main body */}
      <div className="relative z-[1] max-w-7xl mx-auto px-6 py-16">
        <div className={FOOTER_MAIN_GRID}>
          {/* Brand */}
          <div className="sm:col-span-2 lg:col-span-1 flex flex-col items-center sm:items-start text-center sm:text-left">
            <div className="mb-1 flex items-center justify-center sm:justify-start gap-3">
              <BrandLogo size="footer" />
            </div>
            <p className="text-white/65 text-sm leading-relaxed mb-6" style={{ maxWidth: 320 }}>
              {FOOTER_TAGLINE}
            </p>

            <div className="mb-6 flex flex-col items-center sm:items-start">
              <p className="mb-2 text-xs font-bold uppercase tracking-[0.15em] text-white/40">Liên hệ</p>
              <a
                href={`mailto:${CONTACT_EMAIL}`}
                className="inline-flex max-w-[min(100%,320px)] items-center sm:items-start justify-center sm:justify-start gap-2 break-all text-sm font-semibold text-[#93f72b] transition-colors hover:text-white"
              >
                <Mail className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                {CONTACT_EMAIL}
              </a>
            </div>

            {/* Social links */}
            <div className="mb-6 flex flex-col items-center sm:items-start relative group">
              <p className="text-white/40 text-xs uppercase tracking-[0.15em] mb-4 font-bold relative z-10">Kết nối với ProInterview</p>
              
              {/* Vùng màu gradient phức tạp để nổi bật hiệu ứng Glassmorphism */}
              <div className="absolute top-9 left-1/2 -translate-x-1/2 sm:translate-x-0 sm:left-[-15px] w-[260px] h-[75px] bg-gradient-to-r from-purple-600/60 via-purple-500/30 to-[#93f72b]/30 blur-[20px] rounded-full z-0 pointer-events-none transition-opacity duration-500 opacity-80 group-hover:opacity-100" />

              <div className="flex justify-center sm:justify-start gap-[20px] relative z-10">
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
                      className={`w-[56px] h-[56px] rounded-full flex items-center justify-center text-white transition-all duration-300 ${isHovered ? 'liquid-glass-strong -translate-y-[3px] shadow-[0_8px_30px_rgba(0,0,0,0.3)]' : 'liquid-glass'}`}
                      style={{ textDecoration: "none" }}
                    >
                      <Icon style={{ 
                        width: 22, 
                        height: 22,
                        fill: "currentColor",
                        filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.2))",
                        transition: "transform 0.3s ease",
                        transform: isHovered ? "scale(1.1)" : "none"
                      }} />
                    </a>
                  );
                })}
              </div>
            </div>
            
          </div>

          {Object.entries(NAV_LINKS).map(([section, links]) => (
            <FooterNavColumn
              key={section}
              section={section}
              links={links}
              navigate={navigate}
              variant="dark"
            />
          ))}
        </div>
      </div>

      <div
        className="relative z-[1]"
        style={{
          borderTop: "1px solid rgba(255, 255, 255, 0.1)",
        }}
      >
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
            <div className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#93f72b]" />
            <span>24/7 Support Available</span>
          </div>
        </div>
      </div>
    </footer>
  );
}

/* ══════════════════════════════════════════════════════════════
   LIGHT variant, cùng nền / chữ với trang home (#f3f0f9)
══════════════════════════════════════════════════════════════ */
function FooterLight({ shellInner = FOOTER_SHELL_DEFAULT }) {
  const navigate = useNavigate();
  const [hoveredSocial, setHoveredSocial] = useState(null);

  return (
    <footer className="relative overflow-hidden border-t border-violet-200/50 bg-[#f3f0f9]">
      <div
        className="pointer-events-none absolute z-0 h-[min(72vw,520px)] w-[min(72vw,520px)] rounded-full bg-[#8037f4]/10 blur-[100px] sm:h-[520px] sm:w-[520px] sm:blur-[110px]"
        style={{ left: "-14%", top: "38%" }}
        aria-hidden
      />

      <div className={`relative z-[1] ${shellInner} py-16`}>
        <div className={FOOTER_MAIN_GRID}>
          <div className="sm:col-span-2 lg:col-span-1 flex flex-col items-center sm:items-start text-center sm:text-left">
            <div className="-mt-1 mb-1 flex items-center justify-center sm:justify-start gap-3">
              <BrandLogo size="footer" />
            </div>
            <p className="mb-6 max-w-[320px] text-sm leading-relaxed text-slate-600">
              {FOOTER_TAGLINE}
            </p>

            <div className="mb-6 flex flex-col items-center sm:items-start">
              <p className="mb-2 text-xs font-bold uppercase tracking-[0.15em] text-slate-500">Liên hệ</p>
              <a
                href={`mailto:${CONTACT_EMAIL}`}
                className="inline-flex max-w-[min(100%,320px)] items-center sm:items-start justify-center sm:justify-start gap-2 break-all text-sm font-semibold text-[#8037f4] underline-offset-2 transition-colors hover:text-[#630ed4] hover:underline"
              >
                <Mail className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                {CONTACT_EMAIL}
              </a>
            </div>

            <div className="mb-6 flex flex-col items-center sm:items-start">
              <p className="mb-4 text-xs font-bold uppercase tracking-[0.15em] text-slate-500">
                Kết nối với ProInterview
              </p>
              <div className="flex justify-center sm:justify-start gap-[20px]">
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
                      className="w-[56px] h-[56px] rounded-full flex items-center justify-center text-[#475569]"
                      style={{
                        background: isHovered 
                          ? "linear-gradient(135deg, rgba(0, 0, 0, 0.08) 0%, rgba(0, 0, 0, 0.02) 100%)" 
                          : "linear-gradient(135deg, rgba(0, 0, 0, 0.04) 0%, rgba(0, 0, 0, 0.01) 100%)",
                        borderTop: `1px solid ${isHovered ? "rgba(255, 255, 255, 0.8)" : "rgba(255, 255, 255, 0.6)"}`,
                        borderLeft: `1px solid ${isHovered ? "rgba(255, 255, 255, 0.8)" : "rgba(255, 255, 255, 0.6)"}`,
                        borderBottom: `1px solid ${isHovered ? "rgba(0, 0, 0, 0.1)" : "rgba(0, 0, 0, 0.05)"}`,
                        borderRight: `1px solid ${isHovered ? "rgba(0, 0, 0, 0.1)" : "rgba(0, 0, 0, 0.05)"}`,
                        backdropFilter: "blur(12px)",
                        WebkitBackdropFilter: "blur(12px)",
                        transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
                        transform: isHovered ? "translateY(-3px)" : "none",
                        boxShadow: isHovered 
                          ? "0 10px 30px rgba(0, 0, 0, 0.08), inset 0 1px 3px rgba(255, 255, 255, 1)" 
                          : "0 4px 20px rgba(0, 0, 0, 0.04), inset 0 1px 2px rgba(255, 255, 255, 0.8)",
                        textDecoration: "none"
                      }}
                    >
                      <Icon
                        style={{
                          width: 22,
                          height: 22,
                          fill: "currentColor",
                          transition: "transform 0.3s ease",
                          transform: isHovered ? "scale(1.1)" : "none"
                        }}
                      />
                    </a>
                  );
                })}
              </div>
            </div>
          </div>

          {Object.entries(NAV_LINKS).map(([section, links]) => (
            <FooterNavColumn
              key={section}
              section={section}
              links={links}
              navigate={navigate}
              variant="light"
            />
          ))}
        </div>
      </div>

      <div className="relative z-[1] border-t border-slate-200/90 bg-white/85">
        <div className={`${shellInner} flex flex-col items-center justify-between gap-3 py-5 sm:flex-row`}>
          <p className="text-xs text-slate-500">
            © {new Date().getFullYear()} ProInterview. All rights reserved.
          </p>
          <div className="flex items-center gap-1.5 text-xs text-slate-500">
            <span>Made with</span>
            <Heart className="h-3.5 w-3.5 animate-pulse text-red-500" />
            <span>in Vietnam</span>
            <span className="ml-1">🇻🇳</span>
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <div className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#93f72b]" />
            <span>24/7 Support Available</span>
          </div>
        </div>
      </div>
    </footer>
  );
}

/* ── Public export ── */
export function Footer({ variant = "light" }) {
  const location = useLocation();
  const isHome = location.pathname === "/" || location.pathname === "";
  const shellInner = isHome ? HOME_SECTION_INNER : FOOTER_SHELL_DEFAULT;

  return variant === "dark" ? <FooterDark /> : <FooterLight shellInner={shellInner} />;
}