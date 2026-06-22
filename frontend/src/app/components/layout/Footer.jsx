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
function InstagramIcon({ className, style }) {
  return (
    <svg className={className} style={style} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 1 0 0 12.324 6.162 6.162 0 0 0 0-12.324zM12 16a4 4 0 1 1 0-8 4 4 0 0 1 0 8zm6.406-11.845a1.44 1.44 0 1 0 0 2.881 1.44 1.44 0 0 0 0-2.881z"/>
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
        background:
          "linear-gradient(180deg, #05040b 0%, #080614 48%, #0b0718 100%)",
        borderTop: "1px solid rgba(128, 55, 244, 0.18)",
        boxShadow: "0 -1px 0 rgba(0, 0, 0, 0.45)",
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
            <div className="mb-6 flex flex-col items-center sm:items-start">
              <p className="text-white/40 text-xs uppercase tracking-[0.15em] mb-4 font-bold">Kết nối với ProInterview</p>
              <div className="flex justify-center sm:justify-start gap-3">
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
                        background: isHovered ? s.color : "rgba(128, 55, 244, 0.08)",
                        border: `1.5px solid ${isHovered ? s.color : "rgba(155, 109, 255, 0.2)"}`,
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
              style={{
                background: "rgba(128, 55, 244, 0.12)",
                border: "1px solid rgba(155, 109, 255, 0.28)",
              }}
            >
              <ShieldCheck className="h-5 w-5 shrink-0 text-[#93f72b]" />
              <span className="text-white/70 text-xs font-semibold">Bảo mật SSL 256-bit</span>
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

      {/* Bottom bar */}
      <div
        className="relative z-[1]"
        style={{
          borderTop: "1px solid rgba(128, 55, 244, 0.14)",
          background: "linear-gradient(180deg, #05040c 0%, #080612 100%)",
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
              <div className="flex justify-center sm:justify-start gap-3">
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
                      className="flex h-11 w-11 items-center justify-center rounded-xl transition-all duration-300"
                      style={{
                        background: isHovered ? s.color : "#ffffff",
                        border: `1.5px solid ${isHovered ? s.color : "rgba(148, 163, 184, 0.35)"}`,
                        transform: isHovered ? "translateY(-4px)" : "none",
                        boxShadow: isHovered ? `0 8px 28px ${s.color}40` : "0 1px 2px rgba(15, 23, 42, 0.06)",
                      }}
                    >
                      <Icon
                        style={{
                          color: isHovered ? "#fff" : "#475569",
                          width: 19,
                          height: 19,
                        }}
                      />
                    </a>
                  );
                })}
              </div>
            </div>

            <div className="inline-flex items-center gap-2.5 rounded-xl border border-violet-200/80 bg-white/90 px-4 py-2.5 shadow-sm">
              <ShieldCheck className="h-5 w-5 shrink-0 text-[#8037f4]" />
              <span className="text-xs font-semibold text-slate-700">Bảo mật SSL 256-bit</span>
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