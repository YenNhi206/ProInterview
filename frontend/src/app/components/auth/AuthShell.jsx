import React, { useLayoutEffect } from "react";
import { useNavigate } from "react-router";
import { BrandLogo } from "../brand/BrandLogo";
import { getBrandClickPath } from "../../utils/auth/auth.js";
import { useWorkspaceTheme } from "../../hooks/useWorkspaceTheme.js";
import { WorkspaceThemeContext } from "../layout/WorkspaceNav.jsx";
import { AuthPurpleBackdrop } from "./AuthPurpleBackdrop";

export function AuthShell({ children, headerRight }) {
  const navigate = useNavigate();
  const theme = useWorkspaceTheme(true);
  const light = theme.resolved === "light";

  useLayoutEffect(() => {
    const root = document.documentElement;
    root.dataset.workspaceTheme = light ? "light" : "dark";
  }, [light]);

  return (
    <WorkspaceThemeContext.Provider value={theme}>
      <div
        className={`relative flex min-h-[100dvh] flex-col overflow-y-auto transition-colors duration-300 ${light ? "bg-[#f8f6fc] text-[#1e1338]" : "bg-[#090414] text-white"
          }`}
        style={{ fontFamily: "'Lexend', 'Plus Jakarta Sans', system-ui, sans-serif" }}
      >
        {/* Background layer */}
        {light ? (
          <div
            className="pointer-events-none fixed inset-0 z-0 bg-gradient-to-b from-[#fbfaff] via-[#f6f2fc] to-[#ede5fa]"
            aria-hidden
          />
        ) : (
          <AuthPurpleBackdrop />
        )}

        <div className="relative z-[1] flex min-h-0 flex-1 flex-col">
          {/* Top Bar */}
          <header className="relative z-10 flex h-20 flex-shrink-0 items-center justify-between px-6 sm:px-10">
            <button
              type="button"
              data-button-surface="none"
              onClick={() => navigate(getBrandClickPath())}
              className="flex items-center gap-2.5 group"
              aria-label="Về trang chủ"
            >
              <BrandLogo size="auth" />
            </button>

            {headerRight ? (
              <div className="flex items-center gap-3">
                {headerRight}
              </div>
            ) : null}
          </header>

          {/* Main content */}
          <main className="relative z-10 flex flex-1 items-start justify-center overflow-x-visible px-6 pb-12 pt-[5.55rem] sm:px-10 sm:pt-[6.05rem]">
            {children}
          </main>
        </div>
      </div>
    </WorkspaceThemeContext.Provider>
  );
}
