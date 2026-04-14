import React from "react";
import { NavLink, Outlet, useNavigate } from "react-router";
import {
  LayoutDashboard,
  Users,
  GraduationCap,
  UserPlus,
  Wallet,
  ArrowLeftRight,
  Banknote,
  Calendar,
  FileQuestion,
  Video,
  BookOpen,
  LineChart,
  Settings,
  Star,
  LifeBuoy,
  LogOut,
  Shield,
} from "lucide-react";
import { logout, getUser } from "../../utils/auth";

const IS = { strokeWidth: 1.75 };

const NAV_SECTIONS = [
  {
    title: "Tổng quan",
    links: [{ to: "/admin", label: "Dashboard", icon: LayoutDashboard, end: true }],
  },
  {
    title: "Người dùng",
    links: [{ to: "/admin/users", label: "Users", icon: Users }],
  },
  {
    title: "Mentor",
    links: [
      { to: "/admin/mentors", label: "Danh sách mentor", icon: GraduationCap },
      { to: "/admin/mentors/pending", label: "Duyệt đăng ký", icon: UserPlus },
    ],
  },
  {
    title: "Tài chính",
    links: [
      { to: "/admin/finance", label: "Tổng quan TC", icon: Wallet },
      { to: "/admin/transactions", label: "Giao dịch", icon: ArrowLeftRight },
      { to: "/admin/payouts", label: "Rút tiền mentor", icon: Banknote },
    ],
  },
  {
    title: "Booking",
    links: [{ to: "/admin/bookings", label: "Sessions", icon: Calendar }],
  },
  {
    title: "Nội dung",
    links: [
      { to: "/admin/content/questions", label: "Câu hỏi mẫu", icon: FileQuestion },
      { to: "/admin/content/videos", label: "Video HR", icon: Video },
      { to: "/admin/content/courses", label: "Khóa học", icon: BookOpen },
    ],
  },
  {
    title: "Phân tích & hệ thống",
    links: [
      { to: "/admin/analytics", label: "Analytics", icon: LineChart },
      { to: "/admin/settings", label: "Cài đặt HT", icon: Settings },
    ],
  },
  {
    title: "Hỗ trợ",
    links: [
      { to: "/admin/reviews", label: "Reviews mentor", icon: Star },
      { to: "/admin/support", label: "Support & disputes", icon: LifeBuoy },
    ],
  },
];

export function AdminLayout() {
  const navigate = useNavigate();
  const user = getUser();

  return (
    <div className="flex min-h-svh w-full bg-[#0a0618] font-sans text-white">
      <aside className="sticky top-0 flex h-svh w-[272px] shrink-0 flex-col border-r border-white/10 bg-[#07060e]/95 backdrop-blur-xl">
        <div className="flex items-center gap-3 border-b border-white/10 px-5 py-5">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-[#6E35E8] to-[#8B4DFF] shadow-lg">
            <Shield className="h-5 w-5 text-white" {...IS} />
          </div>
          <div className="min-w-0">
            <p className="truncate text-[10px] font-bold uppercase tracking-widest text-[#c4ff47]/90">Admin</p>
            <p className="truncate text-xs font-semibold text-white/80">{user?.name ?? "—"}</p>
          </div>
        </div>
        <nav className="flex-1 overflow-y-auto px-3 py-4">
          {NAV_SECTIONS.map((sec) => (
            <div key={sec.title} className="mb-5">
              <p className="mb-2 px-3 text-[10px] font-bold uppercase tracking-[0.18em] text-white/35">{sec.title}</p>
              <ul className="space-y-0.5">
                {sec.links.map(({ to, label, icon: Icon, end }) => (
                  <li key={to}>
                    <NavLink
                      to={to}
                      end={Boolean(end)}
                      className={({ isActive }) =>
                        `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors ${
                          isActive
                            ? "bg-[#c4ff47]/15 text-[#c4ff47] ring-1 ring-[#c4ff47]/25"
                            : "text-white/55 hover:bg-white/[0.06] hover:text-white"
                        }`
                      }
                    >
                      <Icon className="h-4 w-4 shrink-0 opacity-90" {...IS} />
                      {label}
                    </NavLink>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>
        <div className="border-t border-white/10 p-3">
          <button
            type="button"
            onClick={async () => {
              await logout();
              navigate("/");
            }}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-semibold text-red-300/90 transition-colors hover:bg-red-500/10 hover:text-red-200"
          >
            <LogOut className="h-4 w-4 shrink-0" {...IS} />
            Đăng xuất
          </button>
        </div>
      </aside>
      <div className="flex min-h-svh min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-10 flex h-14 items-center border-b border-white/10 bg-[#0a0618]/90 px-6 backdrop-blur-md">
          <span className="text-xs font-semibold text-white/45">Khu vực quản trị · không hiển thị cho học viên</span>
        </header>
        <main className="flex-1 overflow-x-hidden px-6 py-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
