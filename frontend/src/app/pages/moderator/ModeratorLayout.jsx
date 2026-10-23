import React from "react";
import { NavLink, Outlet } from "react-router";
import { ShieldCheck } from "lucide-react";
import { MentorPageShell } from "../../components/mentor/MentorPageShell";
import { useUserPresence } from "../../hooks/useUserPresence.js";

/**
 * Khu vực kiểm duyệt viên.
 *
 * Cố ý dùng thanh tab đơn giản thay vì sidebar: hiện mới có một mục (duyệt khóa học).
 * Khi package Moderator bổ sung ngân hàng câu hỏi, hàng đợi review và quality dashboard
 * thì nâng lên sidebar giống AdminLayout.
 */
const NAV = [{ to: "/moderator/courses", label: "Duyệt khóa học" }];

function tabClass({ isActive }) {
  const base =
    "rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors";
  return isActive
    ? `${base} bg-[#6E35E8] text-white`
    : `${base} text-[#6E35E8]/80 hover:bg-[#6E35E8]/10 hover:text-[#6E35E8]`;
}

export function ModeratorLayout() {
  useUserPresence();

  return (
    <div className="admin-shell app-user-shell relative min-h-svh w-full bg-[#f3f0f9] text-slate-900 antialiased">
      <div className="app-shell-ambient" aria-hidden />
      <header
        className="sticky top-0 z-30 flex h-16 shrink-0 items-center gap-4 border-b border-[rgba(110,53,232,0.14)] bg-white/95 px-5 backdrop-blur-xl"
        style={{ boxShadow: "0 1px 0 rgba(110, 53, 232, 0.08)" }}
      >
        <ShieldCheck className="size-5 shrink-0 text-[#6E35E8]" aria-hidden />
        <h1 className="shrink-0 font-headline text-[0.9375rem] font-extrabold tracking-tight text-[#6E35E8]">
          Kiểm duyệt
        </h1>
        <nav className="flex min-w-0 items-center gap-1 overflow-x-auto">
          {NAV.map((item) => (
            <NavLink key={item.to} to={item.to} className={tabClass}>
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="flex-1" />
        <span
          className="shrink-0 rounded-md px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-[#2D1B69] sm:text-[10px]"
          style={{ background: "linear-gradient(135deg, #B4F500, #93D600)" }}
        >
          Moderator
        </span>
      </header>
      <MentorPageShell bottomPad="pb-8">
        <div className="relative z-10 mx-auto w-full min-w-0 max-w-7xl px-4 pb-10 pt-6 sm:px-6 lg:px-8">
          <Outlet />
        </div>
      </MentorPageShell>
    </div>
  );
}
