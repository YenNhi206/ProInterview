import React from "react";
import { Outlet } from "react-router";
import { SidebarProvider, SidebarInset } from "../ui/sidebar";
import { AppSidebar } from "./Sidebar";
import { Navbar } from "./Navbar";

/** Nền mesh + lưới — đồng bộ Dashboard / Home Gen Z */
function AppShellBackdrop() {
  return (
    <>
      <div
        className="pointer-events-none fixed inset-0 z-0 bg-[#120B2E]"
        aria-hidden
      />
      <div
        className="pointer-events-none fixed inset-0 z-0 opacity-[0.95]"
        style={{
          background:
            "radial-gradient(ellipse 90% 55% at 20% -10%, rgba(110, 53, 232, 0.32) 0%, transparent 55%), radial-gradient(ellipse 60% 45% at 100% 20%, rgba(236, 72, 153, 0.12) 0%, transparent 50%), radial-gradient(ellipse 55% 42% at 12% 88%, rgba(196, 255, 71, 0.16) 0%, transparent 52%), radial-gradient(ellipse 45% 38% at 92% 92%, rgba(196, 255, 71, 0.1) 0%, transparent 50%)",
        }}
        aria-hidden
      />
      <div
        className="pointer-events-none fixed inset-0 z-0 opacity-[0.09]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.45) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.45) 1px, transparent 1px)",
          backgroundSize: "32px 32px",
        }}
        aria-hidden
      />
    </>
  );
}

export function AppLayout() {
  return (
    <div className="relative min-h-svh w-full overflow-x-hidden text-foreground">
      <AppShellBackdrop />
      <SidebarProvider
        className="relative z-[1] flex min-h-svh w-full bg-transparent"
        style={{
          "--sidebar-width": "260px",
          "--sidebar-width-icon": "64px",
        }}
      >
        <AppSidebar />
        <SidebarInset className="relative z-[1] flex min-h-svh flex-1 flex-col bg-transparent shadow-none md:peer-data-[variant=inset]:shadow-none md:peer-data-[variant=inset]:m-0 md:peer-data-[variant=inset]:rounded-none">
          <Navbar />
          <div className="relative z-[1] flex-1 min-h-0">
            <Outlet />
          </div>
        </SidebarInset>
      </SidebarProvider>
    </div>
  );
}
