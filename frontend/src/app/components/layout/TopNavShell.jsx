import React from "react";
import { CUSTOMER_SHELL_MAX } from "./customerShellLayout";

export function TopNavShell({
  variant = "light",
  scrolled = true,
  alignTop = false,
  shellMax = CUSTOMER_SHELL_MAX,
  children,
}) {

  const isDark = variant === "dark";



  const pillStyle = isDark

    ? {

        background: "rgba(18, 10, 38, 0.78)",

        backdropFilter: "blur(20px)",

        WebkitBackdropFilter: "blur(20px)",

        border: "1px solid rgba(148, 120, 255, 0.28)",

        borderRadius: "40px 10px 40px 10px",

        boxShadow: "0 4px 28px rgba(0, 0, 0, 0.45), 0 0 0 1px rgba(128, 55, 244, 0.15) inset",

      }

    : {

        background: "rgba(255, 255, 255, 0.94)",

        backdropFilter: "blur(20px)",

        WebkitBackdropFilter: "blur(20px)",

        border: "2px solid rgba(186, 165, 255, 0.55)",

        borderRadius: "40px 10px 40px 10px",

        boxShadow:

          "0 0 0 1px rgba(255,255,255,0.9) inset, 0 4px 28px rgba(128, 55, 244, 0.12), 0 2px 10px rgba(0,0,0,0.04)",

      };



  return (

    <nav

      className={`top-nav-shell-outer fixed left-0 right-0 z-[100] pointer-events-none lg:px-24 ${

        alignTop ? "top-0 pt-3 sm:pt-4" : "top-4"

      }`}

      style={{ transform: "translateY(var(--pi-promo-h, 0px))" }}

    >

      <div

        className={`top-nav-pill pointer-events-auto mx-auto flex min-h-[44px] w-full max-w-full min-w-0 flex-nowrap items-center justify-between gap-2 px-3 py-1 max-lg:px-3.5 sm:h-12 sm:min-h-12 sm:py-0 sm:px-6 md:h-14 md:min-h-14 md:px-8 ${shellMax}`}

        style={pillStyle}

      >

        {children}

      </div>

    </nav>

  );

}


