import React, { useState, useEffect } from "react";
import { NavLink, Outlet, useNavigate, useLocation, Link } from "react-router";
import {
  LayoutDashboard,
  FileQuestion,
  Sliders,
  Briefcase,
  Users,
  Building2,
  LogOut,
  ChevronRight,
  ExternalLink,
  ShieldCheck,
  Bell,
  Menu,
  X,
} from "lucide-react";
import { companyApi } from "../../api/companyApi.js";
import { getUser, logout, getDisplayName, getInitials } from "../../utils/auth/auth.js";
import { useUserPresence } from "../../hooks/useUserPresence.js";

const NAV_ITEMS = [
  { to: "/company", label: "Tổng quan", icon: LayoutDashboard, end: true },
  { to: "/company/questions", label: "Ngân hàng câu hỏi", icon: FileQuestion },
  { to: "/company/rubrics", label: "Rubric đánh giá", icon: Sliders },
  { to: "/company/jobs", label: "Tin tuyển dụng", icon: Briefcase },
  { to: "/company/applications", label: "Đơn ứng tuyển", icon: Users },
];

export function CompanyLayout() {
  useUserPresence();
  const navigate = useNavigate();
  const location = useLocation();
  const user = getUser();

  const [company, setCompany] = useState(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    let mounted = true;
    async function loadCompany() {
      try {
        const res = await companyApi.getProfile();
        if (mounted && res.success && res.company) {
          setCompany(res.company);
        }
      } catch (err) {
        // Ignored or handled gracefully
      }
    }
    loadCompany();
    return () => {
      mounted = false;
    };
  }, []);

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  const navClass = ({ isActive }) =>
    `flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium transition-all ${
      isActive
        ? "bg-indigo-600 text-white shadow-lg shadow-indigo-600/20"
        : "text-slate-400 hover:bg-slate-800/60 hover:text-slate-100"
    }`;

  return (
    <div className="min-h-screen bg-[#090b10] text-slate-100 flex flex-col md:flex-row antialiased">
      {/* Mobile Header */}
      <div className="md:hidden flex h-16 items-center justify-between border-b border-slate-800/80 bg-slate-900/80 px-4 backdrop-blur-xl">
        <div className="flex items-center gap-2">
          <div className="flex size-9 items-center justify-center rounded-xl bg-indigo-600 text-white font-bold">
            <Building2 className="size-5" />
          </div>
          <span className="font-bold text-white tracking-tight truncate max-w-[180px]">
            {company?.name || "Workspace"}
          </span>
        </div>
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="rounded-lg p-2 text-slate-400 hover:bg-slate-800 hover:text-white"
        >
          {mobileMenuOpen ? <X className="size-6" /> : <Menu className="size-6" />}
        </button>
      </div>

      {/* Sidebar Desktop */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 w-64 flex-col border-r border-slate-800/80 bg-[#0d0f17] px-4 py-6 transition-transform md:static md:flex ${
          mobileMenuOpen ? "flex" : "hidden md:flex"
        }`}
      >
        {/* Company Identity */}
        <div className="flex items-center gap-3 px-2 pb-6 border-b border-slate-800/80">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-500 text-white shadow-lg shadow-indigo-500/20">
            {company?.logo ? (
              <img src={company.logo} alt="" className="size-6 rounded-md object-contain" />
            ) : (
              <Building2 className="size-5" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="truncate font-semibold text-white text-sm tracking-tight">
              {company?.name || "Doanh nghiệp"}
            </h2>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="inline-block size-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">
                Company Portal
              </span>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="mt-6 flex-1 space-y-1.5">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                onClick={() => setMobileMenuOpen(false)}
                className={navClass}
              >
                <Icon className="size-4 shrink-0" />
                <span>{item.label}</span>
              </NavLink>
            );
          })}
        </nav>

        {/* Footer / User Profile */}
        <div className="border-t border-slate-800/80 pt-4">
          <div className="flex items-center justify-between px-2 py-2 rounded-xl bg-slate-900/60 border border-slate-800">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-indigo-500/20 text-xs font-bold text-indigo-300">
                {getInitials(getDisplayName(user))}
              </div>
              <div className="min-w-0">
                <p className="text-xs font-semibold text-white truncate">{getDisplayName(user)}</p>
                <p className="text-[10px] text-slate-400 truncate">{user?.email}</p>
              </div>
            </div>
            <button
              onClick={handleLogout}
              title="Đăng xuất"
              className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-500/10 hover:text-rose-400 transition"
            >
              <LogOut className="size-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col min-w-0 bg-[#090b10] overflow-y-auto">
        <header className="sticky top-0 z-30 hidden md:flex h-16 items-center justify-between border-b border-slate-800/80 bg-[#090b10]/80 px-8 backdrop-blur-xl">
          <div className="flex items-center gap-2 text-sm text-slate-400">
            <span>Workspace</span>
            <ChevronRight className="size-4" />
            <span className="font-medium text-slate-200">
              {company?.name || "Bảng điều khiển"}
            </span>
          </div>

          <div className="flex items-center gap-3">
            <div className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-400">
              <ShieldCheck className="size-3.5" />
              Company Moderator Verified
            </div>
          </div>
        </header>

        <div className="p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
