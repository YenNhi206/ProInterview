import React from "react";
import { Outlet } from "react-router";
import { WorkspaceShell } from "../../components/layout/WorkspaceNav.jsx";
import { CompanyWorkspaceNav } from "../../components/layout/CompanyWorkspaceNav.jsx";
import { useUserPresence } from "../../hooks/useUserPresence.js";

/**
 * Khu vực Company Moderator (HR công ty đối tác) — cùng khung sidebar tối với khu Mentor.
 * Các trang con đang là khung chờ API `/api/company/*` (CO-03 trở đi) — xem docs/capstone/TASKS.md.
 */
export function CompanyLayout() {
  useUserPresence();

  return (
    <WorkspaceShell nav={<CompanyWorkspaceNav />} themeable>
      <div className="mentor-role-shell min-w-0" data-mentor-content>
        <Outlet />
      </div>
    </WorkspaceShell>
  );
}
