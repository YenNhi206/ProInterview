import { useState, useEffect } from "react";
import { useNavigate } from "react-router";
import { motion } from "motion/react";
import {
  Bell,
  Lock,
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
import { getUser, logout, getPlans } from "../utils/auth";

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
         <div className="flex items-center gap-3 mb-8 pb-4 border-b border-white/5">
            <div className="w-9 h-9 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-primary-fixed">
               {Icon && <Icon size={18} />}
            </div>
            <div>
               <h3 className="text-[10px] font-black text-white uppercase tracking-[0.2em]">{title}</h3>
            </div>
         </div>
      )}
      {children}
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
          <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Hệ thống có thay đổi</span>
          <div className="flex items-center gap-4">
            <button
              onClick={onReset}
              className="text-[10px] font-black uppercase tracking-widest text-zinc-400 hover:text-white px-4 py-2 transition-colors"
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
            <div key={item.id} className="flex items-center justify-between gap-6 p-5 rounded-2xl bg-white/[0.02] border border-white/5 group">
              <div>
                <p className="text-sm font-bold text-white mb-0.5">{item.label}</p>
                <p className="text-[10px] text-zinc-600 font-medium uppercase tracking-widest">{item.description}</p>
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
               <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Mật khẩu mới</label>
               <input type="password" placeholder="••••••••" className="input-glass w-full" />
            </div>
         </div>
         <button className="px-8 py-4 rounded-xl bg-white/5 border border-white/10 text-[10px] font-black uppercase tracking-widest hover:bg-white/10 transition-all">
            Cập nhật mật khẩu
         </button>
      </SectionCard>

      <SectionCard title="Phiên đăng nhập" icon={Key}>
         <div className="space-y-4">
            <div className="flex items-center justify-between p-6 rounded-2xl bg-white/[0.02] border border-white/5">
               <div className="flex items-center gap-5">
                  <div className="w-11 h-11 rounded-xl bg-primary-fixed/10 flex items-center justify-center text-primary-fixed">
                     <Monitor size={20} />
                  </div>
                  <div>
                     <p className="text-sm font-bold text-white">Browser · Windows Desktop</p>
                     <p className="text-[10px] text-zinc-600 font-black uppercase tracking-widest">Hà Nội · <span className="text-emerald-500">Đang hoạt động</span></p>
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
      accent: "#B4F500"
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
               <p className="text-[10px] text-zinc-600 font-medium">Sao lưu lịch sử luyện tập và cấu hình (JSON).</p>
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
               <p className="text-xs text-zinc-600 font-medium">Tiến trình và đặc quyền sẽ bị gỡ bỏ vĩnh viễn.</p>
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

  return (
    <div className="min-h-screen text-white font-sans pb-32 relative overflow-hidden" 
         style={{ background: "linear-gradient(145deg, #0E0922 0%, #07060E 100%)" }}>
      
      <style>{`
        .glass-card {
           background: rgba(255, 255, 255, 0.04);
           backdrop-filter: blur(40px);
           border-radius: 32px;
           border: 1px solid rgba(255, 255, 255, 0.08);
           transition: all 0.6s cubic-bezier(0.16, 1, 0.3, 1);
           position: relative;
           overflow: hidden;
        }
        .font-headline { letter-spacing: -0.04em; }
        .input-glass {
           background: rgba(255, 255, 255, 0.03);
           border: 1px solid rgba(255, 255, 255, 0.08);
           border-radius: 12px;
           color: white;
           padding: 12px 16px;
           font-size: 0.8125rem;
           transition: all 0.3s ease;
        }
        .input-glass:focus {
           background: rgba(255, 255, 255, 0.06);
           border-color: rgba(180, 245, 0, 0.5);
           outline: none;
        }
      `}</style>

      {/* Rrich Atmospheric Background Glows */}
      <div className="fixed top-0 right-0 w-[1400px] h-[1400px] bg-secondary/10 blur-[200px] rounded-full -translate-y-1/2 translate-x-1/2 pointer-events-none -z-0"></div>
      <div className="fixed bottom-0 left-0 w-[1000px] h-[1000px] bg-primary-fixed/5 blur-[200px] rounded-full translate-y-1/2 -translate-x-1/2 pointer-events-none -z-0"></div>

      {/* ── Web Hero Banner ── */}
      <div className="relative pt-16 pb-12 border-b border-white/5">
         <div className="absolute inset-0 opacity-[0.03]" style={{
            backgroundImage: "linear-gradient(rgba(255,255,255,0.5) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.5) 1px,transparent 1px)",
            backgroundSize: "40px 40px"
         }} />
         <div className="max-w-6xl mx-auto px-8 relative z-10">
            <h1 className="text-5xl lg:text-6xl font-black text-white font-headline tracking-tighter mb-3">
               Hệ thống <span className="text-primary-fixed">Cài đặt</span>
            </h1>
            <p className="text-zinc-500 text-sm font-medium max-w-2xl">
               Quản trị cấu hình bảo mật và cá nhân hóa trải nghiệm ProInterview Web.
            </p>
         </div>
      </div>

      <div className="max-w-6xl mx-auto px-8 relative z-10 mt-16">
         <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
            {/* Sidebar Navigation */}
            <aside className="lg:col-span-3">
               <div className="sticky top-24 p-2 bg-white/[0.02] border border-white/5 rounded-[28px]">
                  {TABS.map((tab) => {
                     const isActive = tab.id === activeTab;
                     return (
                        <button
                           key={tab.id}
                           onClick={() => setActiveTab(tab.id)}
                           className={`w-full flex items-center justify-between px-6 py-4 rounded-[20px] text-left transition-all relative group mb-1 last:mb-0 ${
                              isActive ? "bg-white text-black shadow-xl" : "text-zinc-500 hover:text-white hover:bg-white/5"
                           }`}
                        >
                           <div className="flex items-center gap-4">
                              <tab.icon size={18} className={`transition-transform duration-500 ${isActive ? "scale-110" : "group-hover:translate-x-1"}`} />
                              <span className="text-[10px] font-black uppercase tracking-widest">{tab.label}</span>
                           </div>
                           {isActive && <ChevronRight size={14} className="text-black/30" />}
                        </button>
                     );
                  })}
                  <div className="pt-2 mt-2 border-t border-white/5">
                     <button onClick={logout} className="w-full flex items-center gap-4 px-6 py-4 rounded-[20px] text-left text-red-500 hover:bg-red-500/10 transition-all">
                        <LogOut size={18} />
                        <span className="text-[10px] font-black uppercase tracking-widest">Đăng xuất</span>
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