import React from "react";
import { Outlet } from "react-router";
import { MentorPageShell } from "../../components/mentor/MentorPageShell";
import { useUserPresence } from "../../hooks/useUserPresence.js";
import { WorkspaceShell } from "../../components/layout/WorkspaceNav.jsx";
import { AdminWorkspaceNav } from "../../components/layout/AdminWorkspaceNav.jsx";
import "../../../styles/mentor-workspace.css";
import "../../../styles/mentor-workspace-light.css";

export function AdminLayout() {
  useUserPresence();

  return (
    <WorkspaceShell nav={<AdminWorkspaceNav />} themeable>
      <div className="admin-shell app-user-shell min-w-0" data-admin-content>
        <div className="relative z-10 flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
          <MentorPageShell fillHeight bottomPad="pb-8" showAmbient={false} className="bg-transparent">
            <div className="relative z-10 mx-auto w-full min-w-0 max-w-7xl px-4 pb-12 pt-4 sm:px-6 lg:px-8">
              <Outlet />
            </div>
          </MentorPageShell>
        </div>
      </div>
    </WorkspaceShell>
  );
}

