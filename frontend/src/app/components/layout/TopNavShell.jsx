import React from "react";
import { CUSTOMER_SHELL_MAX } from "./customerShellLayout";

export function TopNavShell({
  variant = "light",
  scrolled = true,
  alignTop = false,
  shellMax = CUSTOMER_SHELL_MAX,
  children,
}) {

  const pillStyle = {
    borderRadius: "40px",
  };



  return (

    <nav

      className={`top-nav-shell-outer fixed left-0 right-0 z-[100] pointer-events-none lg:px-24 ${

        alignTop ? "top-0 pt-3 sm:pt-4" : "top-4"

      }`}

      style={{ transform: "translateY(var(--pi-promo-h, 0px))" }}

    >

      <div
        className={`top-nav-pill pointer-events-auto mx-auto flex min-h-[44px] w-full max-w-full min-w-0 flex-nowrap items-center justify-between gap-2 px-3 py-1 max-lg:px-3.5 sm:h-12 sm:min-h-12 sm:py-0 sm:px-6 md:h-14 md:min-h-14 md:px-8 liquid-glass-strong ${shellMax}`}
        style={pillStyle}
      >

        {children}

      </div>

    </nav>

  );

}


