import React from "react";
import { Outlet } from "react-router";
import { MentorPageShell } from "../../components/mentor/MentorPageShell";
import { WorkspaceShell } from "../../components/layout/WorkspaceNav.jsx";
import { ModeratorWorkspaceNav } from "../../components/layout/ModeratorWorkspaceNav.jsx";
import { useUserPresence } from "../../hooks/useUserPresence.js";

/**
 * Khu vực kiểm duyệt viên (Platform Moderator) — cùng khung sidebar tối với khu Mentor và Company.
 */
import React from "react";
import { Outlet } from "react-router";
import { MentorPageShell } from "../../components/mentor/MentorPageShell";
import { WorkspaceShell } from "../../components/layout/WorkspaceNav.jsx";
import { ModeratorWorkspaceNav } from "../../components/layout/ModeratorWorkspaceNav.jsx";
import { useUserPresence } from "../../hooks/useUserPresence.js";

/**
 * Khu vực kiểm duyệt viên (Platform Moderator) — cùng khung sidebar tối với khu Mentor và Company.
 */
export function ModeratorLayout() {
  useUserPresence();

  return (
    <WorkspaceShell nav={<ModeratorWorkspaceNav />}>
      <div className="mentor-role-shell min-w-0" data-mentor-content>
        <MentorPageShell bottomPad="pb-8" showAmbient={false} className="bg-transparent">
          <div className="relative z-10 mx-auto w-full min-w-0 max-w-[1280px] px-4 pb-10 pt-2 sm:px-6 lg:px-10">
            <Outlet />
          </div>
        </MentorPageShell>
      </div>
    </WorkspaceShell>
  );
}
