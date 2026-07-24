import React, { useEffect, useState } from "react";
import { Outlet, useLocation } from "react-router";
import { SidebarProvider, SidebarInset } from "../ui/sidebar";
import { AppSidebar } from "./Sidebar";
import { Navbar } from "./Navbar";
import { Footer } from "./Footer";
import { PromoBanner } from "./PromoBanner";
import { resolveDocumentTitle } from "../../utils/shared/documentTitle.js";
import { getUser } from "../../utils/auth/auth.js";
import { useUserPresence } from "../../hooks/useUserPresence.js";
import { usePageAnalytics } from "../../hooks/usePageAnalytics.js";

const PROMO_BANNER_KEY = "pi_promo_banner_dismissed_v1";
const PROMO_BANNER_HEIGHT = 40;

export function AppLayout() {
  const location = useLocation();
  const user = getUser();
  useUserPresence();
  usePageAnalytics();
  const isMentor = user?.role === "mentor";
  const isHome = location.pathname === "/" || location.pathname === "";
  const pathNorm = location.pathname.replace(/^\/+/, "");
  const isAbout = pathNorm === "about";
  const isCvAnalysisHub = pathNorm === "cv-analysis";
  const allowHorizontalScroll = isCvAnalysisHub;
  const isLegalDoc = pathNorm === "terms" || pathNorm === "privacy";
  const hideNavbar = pathNorm === "interview/room";
  const hideFooter = hideNavbar;
  const showSiteFooter = !isMentor && !hideFooter;
  const [showPromo, setShowPromo] = useState(
    () => typeof window !== "undefined" && !window.localStorage.getItem(PROMO_BANNER_KEY)
  );
  const showPromoBanner = showPromo && !isMentor && !hideNavbar;
  const ambientModifier = isHome
    ? " app-shell-ambient--home"
    : isLegalDoc
      ? " app-shell-ambient--legal"
      : "";

  useEffect(() => {
    document.title = resolveDocumentTitle(location.pathname);
    window.scrollTo(0, 0);
  }, [location.pathname]);

  useEffect(() => {
    document.documentElement.classList.toggle("app-route-home", isHome);
    return () => document.documentElement.classList.remove("app-route-home");
  }, [isHome]);

  useEffect(() => {
    document.documentElement.style.setProperty(
      "--pi-promo-h",
      showPromoBanner ? `${PROMO_BANNER_HEIGHT}px` : "0px"
    );
    return () => document.documentElement.style.setProperty("--pi-promo-h", "0px");
  }, [showPromoBanner]);

  const dismissPromoBanner = () => {
    window.localStorage.setItem(PROMO_BANNER_KEY, "1");
    setShowPromo(false);
  };

  const shellClass =
    `pi-typography-shell app-user-shell relative min-h-svh w-full max-w-full min-w-0 text-slate-900 antialiased selection:bg-violet-100 selection:text-violet-900 ${isLegalDoc
      ? "overflow-x-hidden bg-slate-50"
      : isAbout
        ? "bg-[#F9F6F0]"
        : allowHorizontalScroll
          ? "bg-transparent"
          : "overflow-x-hidden bg-[#f3f0f9]"
    }`;

  const shellStyle = {
    fontFamily: "'Lexend', 'Plus Jakarta Sans', system-ui, sans-serif",
  };

  if (isMentor) {
    return (
      <div
        className="pi-typography-shell relative min-h-svh w-full max-w-full min-w-0 bg-[#f8f9fc] text-slate-900 antialiased selection:bg-violet-100 selection:text-violet-900"
        style={{ fontFamily: "'Lexend', 'Plus Jakarta Sans', system-ui, sans-serif" }}
      >
        <Navbar variant="mentor" />
        <main className="relative z-[1] min-h-0 flex-1 pt-[3.75rem] sm:pt-[4.25rem] md:pt-[4.75rem]">
          <Outlet />
        </main>
      </div>
    );
  }

  return (
    <div className={shellClass} style={shellStyle}>
      <div
        className={`app-shell-ambient${ambientModifier}`}
        aria-hidden
      />
      <div
        className="relative z-[1] flex min-h-svh w-full max-w-full min-w-0 flex-col"
      >
        {showPromoBanner && <PromoBanner onClose={dismissPromoBanner} />}
        {!hideNavbar && <Navbar variant="customer" />}
        <main
          className={`relative z-[1] min-h-0 flex-1 ${hideNavbar
            ? "flex min-h-svh flex-col pt-0"
            : `pt-[3.75rem] sm:pt-[4.25rem] md:pt-[4.75rem] overflow-x-hidden`
            }`}
        >
          {showPromoBanner && <div style={{ height: PROMO_BANNER_HEIGHT }} aria-hidden />}
          <Outlet />
        </main>
        {showSiteFooter ? <Footer variant="light" /> : null}
      </div>
    </div>
  );
}
