import { useState, useEffect } from "react";
import { useNavigate } from "react-router";
import { motion } from "motion/react";
import {
  Bell,
  Moon,
  Sun,
  LogOut,
  Zap,
  CheckCircle,
  ShieldCheck,
  Palette as PaintBrush,
  Download,
  UserCircle,
  Trash2 as Trash,
  Monitor,
  Key,
  ChevronRight,
  ArrowRight
} from "lucide-react";
import { logout, getPlans } from "../utils/auth";

/* ─── Reusable components ───────────────────────────────── */
function ToggleSwitch({
  enabled,
  onChange,
  colorClass = "bg-primary-fixed",
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!enabled)}
      className={`relative w-11 h-6 rounded-full transition-all duration-300 flex-shrink-0 focus:outline-none focus:ring-4 focus:ring-primary-fixed/20 ${
        enabled ? colorClass : "bg-white/10"
      }`}
    >
      <div
        className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow-lg transition-transform duration-300 ${
          enabled ? "translate-x-6" : "translate-x-1"
        }`}
      />
    </button>
  );
}

function SectionCard({
  children,
  className = "",
  title,
  icon: Icon
}) {
  return (
    <div className={`glass-card p-8 ${className}`}>
      {title && (
         <div className="relative z-10 mb-8 flex items-center gap-3 border-b border-white/[0.08] pb-4">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/[0.06] text-[#c4ff47]">
               {Icon && <Icon size={18} strokeWidth={2} />}
            </div>
            <div>
               <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/90">{title}</h3>
            </div>
         </div>
      )}
      <div className="relative z-10">{children}</div>
    </div>
  );
}

function SaveBar({
  dirty,
  saving,
  saved,
  onSave,
  onReset,
}) {
  if (!dirty && !saved) return null;
  return (
    <motion.div
      initial={{ opacity: 0, y: 50 }}
      animate={{ opacity: 1, y: 0 }}
      className={`fixed bottom-10 right-10 left-auto z-50 flex items-center gap-6 px-10 py-5 rounded-[32px] shadow-[0_20px_50px_rgba(0,0,0,0.5)] border backdrop-blur-3xl transition-all ${
        saved
          ? "bg-emerald-600 border-emerald-400 text-white"
          : "bg-[#1a0d35]/95 border-white/10"
      }`}
    >
      {saved ? (
        <div className="flex items-center gap-3">
          <CheckCircle className="w-5 h-5" />
          <span className="text-[10px] font-black uppercase tracking-widest text-white">Đã đồng bộ thành công</span>
        </div>
      ) : (
        <>
          <span className="text-[10px] font-bold uppercase tracking-widest text-white/45">Hệ thống có thay đổi</span>
          <div className="flex items-center gap-4">
            <button
              onClick={onReset}
              className="px-4 py-2 text-[10px] font-bold uppercase tracking-widest text-white/50 transition-colors hover:text-white"
            >
              Hủy
            </button>
            <button
              onClick={onSave}
              disabled={saving}
              className="px-8 py-3 rounded-2xl bg-primary-fixed text-black text-[10px] font-black uppercase tracking-widest hover:scale-105 active:scale-95 transition-all shadow-lg disabled:opacity-50"
            >
              {saving ? "..." : "Lưu thay đổi"}
            </button>
          </div>
        </>
      )}
    </motion.div>
  );
}

/* ─── TAB: Notifications ────────────────────────────────── */
const DEFAULT_NOTIFS = [
  { id: "interview_reminder", label: "Nhắc nhở buổi phỏng vấn", description: "Thông báo trước 1 giờ khi có lịch", value: true },
  { id: "mentor_feedback", label: "Phản hồi từ Mentor", description: "Khi mentor gửi đánh giá luyện tập", value: true },
  { id: "streak_reminder", label: "Nhắc nhở duy trì streak", description: "Giữ ngọn lửa phỏng vấn của bạn", value: true },
];

function NotificationsTab() {
  const [push, setPush] = useState(DEFAULT_NOTIFS);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const toggle = (id) => {
    setPush((prev) => prev.map((t) => (t.id === id ? { ...t, value: !t.value } : t)));
    setDirty(true);
    setSaved(false);
  };

  const handleSave = () => {
    setSaving(true);
    setTimeout(() => { setSaving(false); setDirty(false); setSaved(true); setTimeout(() => setSaved(false), 2500); }, 600);
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <SectionCard title="Trung tâm Thông báo" icon={Bell}>
        <div className="space-y-4">
          {push.map((item) => (
            <div key={item.id} className="group flex items-center justify-between gap-6 rounded-2xl border border-white/[0.08] bg-white/[0.04] p-5">
              <div>
                <p className="mb-0.5 text-sm font-bold text-white">{item.label}</p>
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/45">{item.description}</p>
              </div>
              <ToggleSwitch enabled={item.value} onChange={() => toggle(item.id)} />
            </div>
          ))}
        </div>
      </SectionCard>
      <SaveBar dirty={dirty} saving={saving} saved={saved} onSave={handleSave} onReset={() => { setPush(DEFAULT_NOTIFS); setDirty(false); }} />
    </div>
  );
}

/* ─── TAB: Security ─────────────────────────────────────── */
function SecurityTab() {
  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <SectionCard title="Cấu hình Bảo mật" icon={ShieldCheck}>
         <div className="grid md:grid-cols-2 gap-8 mb-8">
            <div className="space-y-3">
               <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Mật khẩu hiện tại</label>
               <input type="password" placeholder="••••••••" className="input-glass w-full" />
            </div>
            <div className="space-y-3">
               <label className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/45">Mật khẩu mới</label>
               <input type="password" placeholder="••••••••" className="input-glass w-full" />
            </div>
         </div>
         <button className="px-8 py-4 rounded-xl bg-white/5 border border-white/10 text-[10px] font-black uppercase tracking-widest hover:bg-white/10 transition-all">
            Cập nhật mật khẩu
         </button>
      </SectionCard>

      <SectionCard title="Phiên đăng nhập" icon={Key}>
         <div className="space-y-4">
            <div className="flex items-center justify-between rounded-2xl border border-white/[0.08] bg-white/[0.04] p-6">
               <div className="flex items-center gap-5">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#c4ff47]/12 text-[#c4ff47]">
                     <Monitor size={20} strokeWidth={2} />
                  </div>
                  <div>
                     <p className="text-sm font-bold text-white">Browser · Windows Desktop</p>
                     <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-white/45">Hà Nội · <span className="text-emerald-400">Đang hoạt động</span></p>
                  </div>
               </div>
            </div>
         </div>
      </SectionCard>
    </div>
  );
}

/* ─── TAB: Appearance ───────────────────────────────────── */
function AppearanceTab() {
  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <SectionCard title="Giao diện Web" icon={PaintBrush}>
         <div className="grid sm:grid-cols-3 gap-6">
            {["light", "dark", "system"].map((t) => (
               <button key={t} className={`flex flex-col items-center gap-4 p-6 rounded-[24px] border-2 transition-all ${t === 'dark' ? 'border-primary-fixed bg-primary-fixed/5' : 'border-white/[0.05] opacity-50'}`}>
                  {t === 'light' ? <Sun size={20} /> : t === 'dark' ? <Moon size={20} className="text-primary-fixed" /> : <Monitor size={20} />}
                  <span className="text-[10px] font-black uppercase tracking-widest">{t === 'light' ? 'Sáng' : t === 'dark' ? 'Tối' : 'Hệ thống'}</span>
               </button>
            ))}
         </div>
      </SectionCard>
    </div>
  );
}

/* ─── TAB: Account ──────────────────────────────────────── */
function AccountTab() {
  const navigate = useNavigate();
  const plans = getPlans();
  
  const planInfo = (() => {
    if (plans.elitePro) return {
      name: "Thượng hạng (Elite)",
      desc: "Trải nghiệm không giới hạn · Phân tích hành vi · Mentor 1-1",
      grad: "linear-gradient(135deg, #0E0922 0%, #1a0d35 100%)",
      accent: "#c4ff47"
    };
    if (plans.starterPro) return {
      name: "Chuyên nghiệp (Pro)",
      desc: "Phỏng vấn AI · Nhận diện giọng nói · 10 buổi/tháng",
      grad: "linear-gradient(135deg, #6E35E8 0%, #8B4DFF 100%)",
      accent: "#6E35E8"
    };
    return {
      name: "Cơ bản (Free)",
      desc: "2 buổi AI miễn phí · 3 lần phân tích CV",
      grad: "linear-gradient(145deg, #20134a 0%, #2e2069 100%)",
      accent: "#f59e0b"
    };
  })();

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="glass-card overflow-hidden group">
         <div className="p-10 flex flex-col lg:flex-row lg:items-center justify-between gap-10" style={{ background: planInfo.grad }}>
            <div className="relative z-10 max-w-lg">
               <p className="text-[10px] font-black uppercase tracking-[0.3em] text-white/40 mb-3">Gói dịch vụ</p>
               <h3 className="text-3xl font-black text-white tracking-tighter mb-2 flex items-center gap-3">
                  {planInfo.name} <Zap size={24} className="text-primary-fixed" />
               </h3>
               <p className="text-sm font-medium text-white/60 mb-8">{planInfo.desc}</p>
               
               <div className="flex flex-wrap gap-4">
                  <button onClick={() => navigate("/pricing")} className="px-8 py-4 rounded-xl bg-white text-black font-black text-[10px] uppercase tracking-widest transition-all shadow-xl flex items-center gap-2">
                     Khám phá các Gói <ArrowRight size={14} />
                  </button>
                  <button onClick={() => navigate("/pricing")} className="px-8 py-4 rounded-xl bg-white/10 border border-white/20 text-white font-black text-[10px] uppercase tracking-widest hover:bg-white/20 transition-all">
                     Bảng giá
                  </button>
               </div>
            </div>
            <Zap size={80} className="text-white/5 absolute -right-4 -bottom-4 rotate-12" />
         </div>
      </div>

      <SectionCard title="Dữ liệu" icon={Download}>
         <div className="flex items-center justify-between gap-8">
            <div>
               <p className="text-sm font-bold text-white mb-1">Xuất dữ liệu hệ thống</p>
               <p className="text-[10px] font-medium text-white/45">Sao lưu lịch sử luyện tập và cấu hình (JSON).</p>
            </div>
            <button className="w-12 h-12 rounded-xl bg-white/5 border border-white/10 text-white hover:bg-white/10 transition-all flex items-center justify-center">
               <Download size={20} />
            </button>
         </div>
      </SectionCard>

      <SectionCard title="Tài khoản" icon={Trash}>
         <div className="bg-red-500/[0.02] border border-red-500/10 p-8 rounded-2xl flex flex-col lg:flex-row lg:items-center justify-between gap-8">
            <div className="max-w-md">
               <h4 className="text-red-500 text-[10px] font-black uppercase tracking-widest mb-2">Vùng xóa dữ liệu</h4>
               <p className="text-xs font-medium text-white/45">Tiến trình và đặc quyền sẽ bị gỡ bỏ vĩnh viễn.</p>
            </div>
            <button className="px-8 py-4 rounded-xl bg-red-600 text-white text-[10px] font-black uppercase tracking-widest hover:bg-red-500 transition-all shadow-lg">
               Xác nhận xóa
            </button>
         </div>
      </SectionCard>
    </div>
  );
}

/* ─── Main Settings Page ────────────────────────────────── */
const TABS = [
  { id: "notifications", label: "Thông báo", icon: Bell },
  { id: "security", label: "Bảo mật", icon: ShieldCheck },
  { id: "appearance", label: "Giao diện", icon: PaintBrush },
  { id: "account", label: "Tài khoản", icon: UserCircle },
];

export function Settings() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("notifications");

  const handleLogout = () => {
    logout();
    navigate("/");
  };

  return (
    <div className="pi-page-dashboard-bg relative min-h-screen overflow-x-hidden pb-32 font-sans text-white selection:bg-[rgba(196,255,71,0.28)] selection:text-white">
      <style>{`
        .glass-card {
           background: linear-gradient(145deg, rgba(255,255,255,0.07) 0%, rgba(255,255,255,0.02) 100%);
           backdrop-filter: blur(48px);
           border-radius: 28px;
           border: 1px solid rgba(255, 255, 255, 0.1);
           transition: transform 0.45s cubic-bezier(0.16, 1, 0.3, 1), border-color 0.35s ease, box-shadow 0.45s ease;
           position: relative;
           overflow: hidden;
        }
        .glass-card::before {
           content: '';
           position: absolute;
           inset: 0;
           background: linear-gradient(125deg, rgba(236,72,153,0.08) 0%, transparent 42%, rgba(196, 255, 71,0.06) 100%);
           pointer-events: none;
           opacity: 0.85;
        }
        .glass-card:hover {
           border-color: rgba(196, 255, 71, 0.42);
           transform: translateY(-3px);
           box-shadow:
             0 24px 48px rgba(0,0,0,0.45),
             0 0 0 1px rgba(196, 255, 71, 0.12) inset,
             0 0 40px -8px rgba(196, 255, 71, 0.22);
        }
        .settings-glass-nav {
           background: linear-gradient(145deg, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0.02) 100%);
           backdrop-filter: blur(40px);
           border: 1px solid rgba(255, 255, 255, 0.1);
        }
        .settings-glass-nav:hover { border-color: rgba(255,255,255,0.14); }
        .font-headline {
          letter-spacing: -0.045em;
          text-shadow: 0 2px 24px rgba(0,0,0,0.35);
        }
        .input-glass {
           background: rgba(255, 255, 255, 0.05);
           border: 1px solid rgba(255, 255, 255, 0.1);
           border-radius: 14px;
           color: white;
           padding: 12px 16px;
           font-size: 0.875rem;
           font-weight: 500;
           letter-spacing: -0.01em;
           transition: border-color 0.2s ease, background 0.2s ease, box-shadow 0.2s ease;
        }
        .input-glass:focus {
           background: rgba(255, 255, 255, 0.08);
           border-color: rgba(196, 255, 71, 0.45);
           outline: none;
           box-shadow: 0 0 0 2px rgba(196, 255, 71, 0.12);
        }
        .input-glass::placeholder { color: rgba(255,255,255,0.32); }
        @keyframes settings-shimmer {
          0% { opacity: 0.4; transform: translate(0,0) scale(1); }
          50% { opacity: 0.7; transform: translate(2%, -2%) scale(1.05); }
          100% { opacity: 0.4; transform: translate(0,0) scale(1); }
        }
      `}</style>

      <div
        className="pointer-events-none fixed inset-0 -z-10 opacity-90"
        style={{ animation: "settings-shimmer 14s ease-in-out infinite" }}
      >
        <div className="absolute top-[-20%] right-[-10%] h-[70vh] w-[70vh] rounded-full bg-gradient-to-bl from-fuchsia-600/35 via-violet-600/20 to-transparent blur-[100px]" />
        <div className="absolute bottom-[-25%] left-[-15%] h-[85vh] w-[85vh] rounded-full bg-gradient-to-tr from-[#c4ff47]/18 via-cyan-500/10 to-fuchsia-500/20 blur-[110px]" />
        <div className="absolute left-1/2 top-1/2 h-[50vh] w-[50vh] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#6E35E8]/12 blur-[90px]" />
      </div>

      {/* ── Hero ── */}
      <header className="relative border-b border-white/[0.07] pb-10 pt-8 sm:pb-12 sm:pt-10">
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.11]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,0.55) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.45) 1px,transparent 1px)",
            backgroundSize: "32px 32px",
          }}
          aria-hidden
        />
        <div className="relative z-10 mx-auto max-w-6xl px-6 sm:px-8">
          <p className="mb-3 text-[10px] font-bold uppercase tracking-[0.22em] text-white/45">Bảng điều khiển</p>
          <h1 className="font-headline mb-3 text-4xl font-black tracking-tighter text-white sm:text-5xl md:text-6xl">
            <span className="bg-gradient-to-r from-white via-fuchsia-100 to-zinc-300 bg-clip-text text-transparent">
              Hệ thống{" "}
            </span>
            <span className="bg-gradient-to-r from-[#c4ff47] via-lime-300 to-emerald-300 bg-clip-text text-transparent">
              Cài đặt
            </span>
          </h1>
          <p className="max-w-2xl text-sm leading-relaxed text-white/55">
            Quản trị cấu hình bảo mật và cá nhân hóa trải nghiệm ProInterview Web.
          </p>
        </div>
      </header>

      <div className="relative z-10 mx-auto mt-10 max-w-6xl px-6 sm:mt-12 sm:px-8">
         <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
            {/* Sidebar Navigation */}
            <aside className="lg:col-span-3">
               <div className="settings-glass-nav sticky top-24 rounded-[28px] p-2">
                  {TABS.map((tab) => {
                     const isActive = tab.id === activeTab;
                     return (
                        <button
                           key={tab.id}
                           type="button"
                           onClick={() => setActiveTab(tab.id)}
                           className={`group relative mb-1 flex w-full items-center justify-between rounded-[20px] px-5 py-4 text-left transition-all last:mb-0 ${
                              isActive ? "bg-white text-black shadow-lg shadow-black/25" : "text-white/50 hover:bg-white/[0.06] hover:text-white"
                           }`}
                        >
                           <div className="flex items-center gap-3">
                              <tab.icon size={18} strokeWidth={2} className={`shrink-0 transition-transform duration-300 ${isActive ? "scale-105 text-black" : "group-hover:translate-x-0.5"}`} />
                              <span className="text-[10px] font-bold uppercase tracking-[0.18em]">{tab.label}</span>
                           </div>
                           {isActive && <ChevronRight size={14} className="shrink-0 text-black/35" strokeWidth={2} />}
                        </button>
                     );
                  })}
                  <div className="mt-2 border-t border-white/[0.08] pt-2">
                     <button type="button" onClick={handleLogout} className="flex w-full items-center gap-3 rounded-[20px] px-5 py-4 text-left text-red-400 transition-colors hover:bg-red-500/10 hover:text-red-300">
                        <LogOut size={18} strokeWidth={2} />
                        <span className="text-[10px] font-bold uppercase tracking-[0.18em]">Đăng xuất</span>
                     </button>
                  </div>
               </div>
            </aside>

            {/* Dynamic Content Area */}
            <main className="lg:col-span-9">
               <div className="min-h-[400px]">
                  {activeTab === "notifications" && <NotificationsTab />}
                  {activeTab === "security" && <SecurityTab />}
                  {activeTab === "appearance" && <AppearanceTab />}
                  {activeTab === "account" && <AccountTab />}
               </div>
            </main>
         </div>
      </div>
    </div>
  );
}