import React from "react";
import { Outlet } from "react-router";
import { MentorPageShell } from "../../components/mentor/MentorPageShell";
import { WorkspaceShell } from "../../components/layout/WorkspaceNav.jsx";
import { CompanyWorkspaceNav } from "../../components/layout/CompanyWorkspaceNav.jsx";
import { useUserPresence } from "../../hooks/useUserPresence.js";

/**
 * Khu vực Company Moderator (HR công ty đối tác) — cùng khung sidebar và container chuẩn 7xl với Admin, Mentor & Moderator.
 * Các trang con đang là khung chờ API `/api/company/*` (CO-03 trở đi) — xem docs/capstone/TASKS.md.
 */
export function CompanyLayout() {
  useUserPresence();

  return (
    <WorkspaceShell nav={<CompanyWorkspaceNav />} themeable>
      <div className="mentor-role-shell min-w-0" data-mentor-content>
        <MentorPageShell bottomPad="pb-8" showAmbient={false} className="bg-transparent">
          <div className="relative z-10 mx-auto w-full min-w-0 max-w-7xl px-4 pb-12 pt-4 sm:px-6 lg:px-8">
            <Outlet />
          </div>
        </MentorPageShell>
      </div>
    </WorkspaceShell>
  );
}
