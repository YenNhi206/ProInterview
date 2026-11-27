import React, { useEffect, useLayoutEffect, useState } from "react";
import { Outlet, useLocation } from "react-router";
import { SidebarProvider, SidebarInset } from "../ui/sidebar";
import { AppSidebar } from "./Sidebar";
import { MentorWorkspaceNav } from "./MentorWorkspaceNav";
import { CompanyWorkspaceNav, COMPANY_ROLES } from "./CompanyWorkspaceNav.jsx";
import { ModeratorWorkspaceNav } from "./ModeratorWorkspaceNav.jsx";
import { WorkspaceShell, WorkspaceThemeContext } from "./WorkspaceNav.jsx";
import { Navbar } from "./Navbar";
import { Footer } from "./Footer";
import { DiscountPromoModal } from "../home/DiscountPromoModal";
import { resolveDocumentTitle } from "../../utils/shared/documentTitle.js";
import { getUser } from "../../utils/auth/auth.js";
import { useUserPresence } from "../../hooks/useUserPresence.js";
import { usePageAnalytics } from "../../hooks/usePageAnalytics.js";
import { useWorkspaceTheme } from "../../hooks/useWorkspaceTheme.js";
import { SelectThemeContext } from "../ui/AppSelect";
import "../../../styles/mentor-workspace.css";
import "../../../styles/mentor-workspace-light.css";

export function AppLayout() {
  const location = useLocation();
  const user = getUser();
  useUserPresence();
  usePageAnalytics();
  const theme = useWorkspaceTheme(true);
  const light = theme.resolved === "light";

  useLayoutEffect(() => {
    const root = document.documentElement;
    root.dataset.workspaceTheme = light ? "light" : "dark";
  }, [light]);
  const isMentor = user?.role === "mentor";
  const isCompany = COMPANY_ROLES.includes(user?.role);
  const isModerator = user?.role === "moderator";
  const isHome = location.pathname === "/" || location.pathname === "";
  const pathNorm = location.pathname.replace(/^\/+/, "");
  const isAbout = pathNorm === "about";
  const isLegalDoc = pathNorm === "terms" || pathNorm === "privacy";
  const hideNavbar = pathNorm === "interview/room";
  const hideFooter = hideNavbar;
  const showSiteFooter = !isMentor && !hideFooter;
  const [promoModalOpen, setPromoModalOpen] = useState(false);
  const [promoModalPulse, setPromoModalPulse] = useState(0);
  const ambientModifier = isLegalDoc
    ? " app-shell-ambient--legal"
    : light
      ? ""
      : " app-shell-ambient--commerce commerce-theme";

  useEffect(() => {
    document.title = resolveDocumentTitle(location.pathname);
    window.scrollTo(0, 0);
  }, [location.pathname]);

  useEffect(() => {
    document.documentElement.classList.toggle("app-route-home", isHome);
    return () => document.documentElement.classList.remove("app-route-home");
  }, [isHome]);

  // Trang chủ tự mở popup ưu đãi mỗi lần ghé lại (không lưu trạng thái đã đóng).
  useEffect(() => {
    if (isHome) setPromoModalOpen(true);
  }, [isHome]);

  const shellThemeClass = light
    ? "bg-transparent text-slate-900"
    : "bg-transparent text-white commerce-theme";

  const shellClass =
    `pi-typography-shell app-user-shell relative min-h-svh w-full max-w-full min-w-0 antialiased selection:bg-violet-100 selection:text-violet-900 ${isLegalDoc
      ? "overflow-x-hidden bg-slate-50 text-slate-900"
      : isAbout
        ? "bg-[#F9F6F0] text-slate-900"
        : `${isHome ? "overflow-x-clip" : "overflow-x-hidden"} ${shellThemeClass}`
    }`;

  const shellStyle = {
    fontFamily: "'Lexend', 'Plus Jakarta Sans', system-ui, sans-serif",
  };

  const pageAmbient = (
    <div
      className={`app-shell-ambient${ambientModifier}${light ? " mw-light-ambient" : ""}`}
      aria-hidden
    >
      {!light && !isLegalDoc && (
        <>
          <span className="commerce-glow commerce-glow--top-left" />
          <span className="commerce-glow commerce-glow--top-right" />
          <span className="commerce-glow commerce-glow--bottom-left" />
          <span className="commerce-glow commerce-glow--bottom-right" />
        </>
      )}
    </div>
  );

  if (isMentor || isCompany || isModerator) {
    const nav = isMentor ? <MentorWorkspaceNav /> : isCompany ? <CompanyWorkspaceNav /> : <ModeratorWorkspaceNav />;
    return (
      <WorkspaceShell nav={nav} themeable>
        <Outlet />
      </WorkspaceShell>
    );
  }

  return (
    <WorkspaceThemeContext.Provider value={theme}>
      <SelectThemeContext.Provider value={light ? "light" : "dark"}>
        <div className={`${shellClass}${!light && !isLegalDoc ? " commerce-theme" : ""}`} style={shellStyle}>
          {pageAmbient}
          <div
            className="relative z-[1] flex min-h-svh w-full max-w-full min-w-0 flex-col"
          >
            {!hideNavbar && <Navbar variant="customer" />}
            <main
              className={`relative z-[1] min-h-0 flex-1 ${hideNavbar
                ? "flex min-h-svh flex-col pt-0"
                : `pt-[3.75rem] sm:pt-[4.25rem] md:pt-[4.75rem] ${isHome ? "overflow-x-clip" : "overflow-x-hidden"}`
                }`}
            >
              <Outlet />
            </main>
            {showSiteFooter ? <Footer light={light} /> : null}
          </div>
          <DiscountPromoModal
            open={promoModalOpen}
            onClose={() => setPromoModalOpen(false)}
            pulseSignal={promoModalPulse}
          />
        </div>
      </SelectThemeContext.Provider>
    </WorkspaceThemeContext.Provider>
  );
}
