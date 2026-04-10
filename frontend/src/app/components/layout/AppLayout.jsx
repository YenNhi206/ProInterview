import React from "react";
import { Outlet } from "react-router";
import { SidebarProvider, SidebarInset } from "../ui/sidebar";
import { AppSidebar } from "./Sidebar";
import { Navbar } from "./Navbar";

export function AppLayout() {
  return (
    <SidebarProvider
      style={
        {
          "--sidebar-width": "260px",
          "--sidebar-width-icon": "64px",
        }
      }
    >
      <AppSidebar />
      <SidebarInset>
        <Navbar />
        <div className="flex-1 min-h-0">
          <Outlet />
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}