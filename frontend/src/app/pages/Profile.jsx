import React, { useState } from "react";
import { useNavigate } from "react-router";
import { motion } from "motion/react";
import {
  User,
  Mail as EnvelopeSimple,
  Phone,
  Briefcase,
  Pencil,
  Check,
  Star,
  Mic as Microphone,
  Users,
  TrendingUp as TrendUp,
  Camera,
  Bell,
  ShieldCheck,
  ChevronRight as CaretRight,
  Zap as Lightning,
  Medal,
  ArrowLeft,
  GraduationCap,
  X,
  Trophy,
  Sprout as Plant,
  Sparkles,
  ArrowRight
} from "lucide-react";
import { getUser, updateUser, logout, getInitials } from "../utils/auth";
import { getPlans } from "../utils/auth";

const ACHIEVEMENTS = [
  { icon: Lightning, label: "5 ngày streak", color: "from-amber-400 to-orange-500", earned: true },
  { icon: Microphone, label: "10 buổi phỏng vấn", color: "from-[#6E35E8] to-[#9B6DFF]", earned: true },
  { icon: Star, label: "Điểm STAR 4.0+", color: "from-emerald-500 to-teal-600", earned: true },
  { icon: Users, label: "3 buổi với Mentor", color: "from-sky-500 to-blue-600", earned: false },
  { icon: Medal, label: "Top 10% học viên", color: "from-pink-500 to-rose-600", earned: false },
  { icon: TrendUp, label: "Cải thiện 50%", color: "from-[#9B6DFF] to-purple-600", earned: false },
];

const SETTINGS_SECTIONS = [
  {
    title: "Thông báo",
    icon: Bell,
    items: [
      { label: "Nhắc nhở buổi phỏng vấn", enabled: true },
      { label: "Phản hồi từ mentor", enabled: true },
      { label: "Gợi ý luyện tập hàng tuần", enabled: false },
    ],
  },
  {
    title: "Bảo mật",
    icon: ShieldCheck,
    items: [
      { label: "Xác thực 2 bước", enabled: false },
      { label: "Thông báo đăng nhập mới", enabled: true },
    ],
  },
];

export function Profile() {
  const navigate = useNavigate();
  const user = getUser();
  const [editing, setEditing] = useState(false);
  const [settings, setSettings] = useState(SETTINGS_SECTIONS);
  const [plans, setPlans] = useState(getPlans());
  const [form, setForm] = useState({
    name: user?.name || "",
    email: user?.email || "",
    phone: user?.phone || "",
    position: user?.position || "",
    school: user?.school || "",
    field: user?.field || "",
  });
  const [saveMsg, setSaveMsg] = useState(null);

  const initials = getInitials(form.name || "U");
  const isMentor = user?.role === "mentor";

  const handleSave = () => {
    updateUser({
      name: form.name,
      email: form.email,
      phone: form.phone,
      position: form.position,
      school: form.school,
      field: form.field,
    });
    setEditing(false);
    setSaveMsg("saved");
    setTimeout(() => setSaveMsg(null), 2500);
  };

  const handleLogout = () => {
    logout();
    navigate("/");
  };

  const toggleSetting = (sectionIdx, itemIdx) => {
    setSettings((prev) =>
      prev.map((s, si) =>
        si === sectionIdx
          ? {
              ...s,
              items: s.items.map((item, ii) =>
                ii === itemIdx ? { ...item, enabled: !item.enabled } : item
              ),
            }
          : s
      )
    );
  };

  const STATS = [
    { label: "Tổng phỏng vấn AI", value: "15", icon: Microphone, color: "#6E35E8" },
    { label: "Phỏng vấn Mentor", value: "3", icon: Users, color: "#B4F500" },
    { label: "Điểm STAR tốt nhất", value: "4.8/5", icon: Star, color: "#f59e0b" },
    { label: "Tỷ lệ cải thiện", value: "+71%", icon: TrendUp, color: "#38bdf8" },
  ];

  const FORM_FIELDS = [
    { label: "Họ và tên", key: "name", icon: User },
    { label: "Email", key: "email", icon: EnvelopeSimple },
    { label: "Số điện thoại", key: "phone", icon: Phone },
    { label: "Vị trí/Nghề nghiệp", key: "position", icon: Briefcase },
    { label: "Trường/Tổ chức", key: "school", icon: GraduationCap },
    { label: "Lĩnh vực", key: "field", icon: Sparkles },
  ];

  /* ── Derive plan display info ─────────────────── */
  const planInfo = (() => {
    if (plans.elitePro) return {
      name: "Thượng hạng (Elite)",
      nameIcon: Medal,
      badge: { bg: "bg-primary-fixed/20", border: "border-primary-fixed/30", icon: "text-primary-fixed", text: "text-primary-fixed" },
      cardGrad: "linear-gradient(145deg, #0E0922 0%, #1a0d35 100%)",
      desc: "Không giới hạn · Phân tích hành vi · Mentor 1-1",
      progress: null,
      isPaid: true,
      accent: "#B4F500"
    };
    if (plans.starterPro) return {
      name: "Chuyên nghiệp (Pro)",
      nameIcon: Lightning,
      badge: { bg: "bg-sky-500/20", border: "border-sky-500/30", icon: "text-sky-400", text: "text-sky-400" },
      cardGrad: "linear-gradient(135deg, #6E35E8 0%, #8B4DFF 100%)",
      desc: "Phỏng vấn AI · Nhận diện giọng nói · 10 buổi/tháng",
      progress: { used: 0, max: 10 },
      isPaid: true,
      accent: "#6E35E8"
    };
    return {
      name: "Cơ bản (Free)",
      nameIcon: Plant,
      badge: { bg: "bg-orange-500/20", border: "border-orange-500/30", icon: "text-orange-500", text: "text-orange-500" },
      cardGrad: "linear-gradient(145deg, #2D1B69 0%, #3B2A82 100%)",
      desc: "2 buổi AI miễn phí · 3 lần phân tích CV",
      progress: { used: 2, max: 2 },
      isPaid: false,
      accent: "#f59e0b"
    };
  })();

  // Re-read plans whenever page is focused
  React.useEffect(() => {
    const refresh = () => setPlans(getPlans());
    window.addEventListener("focus", refresh);
    return () => window.removeEventListener("focus", refresh);
  }, []);

  return (
    <div className="min-h-screen text-white font-sans pb-20 relative overflow-hidden" 
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
        .glass-card::before {
           content: '';
           position: absolute;
           inset: 0;
           background: linear-gradient(135deg, rgba(255,255,255,0.05) 0%, transparent 100%);
           pointer-events: none;
        }
        .glass-card:hover { border-color: rgba(180, 245, 0, 0.4); background: rgba(255, 255, 255, 0.06); }
        .font-headline { letter-spacing: -0.04em; }
        .glow-halo { position: relative; display: flex; align-items: center; justify-content: center; }
        .glow-halo::after {
           content: ''; position: absolute; width: 140%; height: 140%;
           background: radial-gradient(circle, rgba(110, 53, 232, 0.2) 0%, transparent 70%);
           border-radius: 50%; z-index: -1; animation: pulse-halo 4s infinite;
        }
        @keyframes pulse-halo {
           0%, 100% { transform: scale(1); opacity: 0.5; }
           50% { transform: scale(1.1); opacity: 0.8; }
        }
        .input-glass {
           background: rgba(255, 255, 255, 0.03);
           border: 1px solid rgba(255, 255, 255, 0.08);
           border-radius: 16px;
           color: white;
           padding: 12px 16px;
           font-size: 0.875rem;
           transition: all 0.3s ease;
        }
        .input-glass:focus {
           background: rgba(255, 255, 255, 0.06);
           border-color: rgba(180, 245, 0, 0.5);
           outline: none;
           box-shadow: 0 0 15px rgba(180, 245, 0, 0.1);
        }
        .input-glass:disabled { opacity: 0.6 cursor: not-allowed; }
      `}</style>

      {/* Rrich Atmospheric Background Glows */}
      <div className="fixed top-0 right-0 w-[1400px] h-[1400px] bg-secondary/10 blur-[200px] rounded-full -translate-y-1/2 translate-x-1/2 pointer-events-none -z-0"></div>
      <div className="fixed bottom-0 left-0 w-[1000px] h-[1000px] bg-primary-fixed/5 blur-[200px] rounded-full translate-y-1/2 -translate-x-1/2 pointer-events-none -z-0"></div>

      <div className="relative z-10 p-8 max-w-6xl mx-auto pt-16">
        <div className="mb-12 flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div>
            <button
              onClick={() => navigate("/dashboard")}
              className="group inline-flex items-center gap-2 mb-6 text-[10px] font-black uppercase tracking-widest text-zinc-500 hover:text-primary-fixed transition-colors"
            >
              <ArrowLeft size={14} className="transition-transform group-hover:-translate-x-1" />
              Quay lại Bảng điều khiển
            </button>
            <h1 className="text-5xl font-black text-white font-headline tracking-tighter mb-2">
              Hồ sơ <span className="text-primary-fixed">cá nhân</span>
            </h1>
            <p className="text-zinc-500 text-sm font-medium">Trung tâm cấu hình và quản trị tài khoản tối ưu</p>
          </div>

          <div className="flex gap-4">
            {editing ? (
               <>
                 <button onClick={() => setEditing(false)} className="px-6 py-3 rounded-2xl bg-white/5 border border-white/10 text-xs font-black uppercase tracking-widest hover:bg-white/10 transition-all flex items-center gap-2">
                    <X size={14} /> Hủy
                 </button>
                 <button onClick={handleSave} className="px-8 py-3 rounded-2xl bg-emerald-600 text-white text-xs font-black uppercase tracking-widest hover:bg-emerald-500 transition-all flex items-center gap-2 shadow-[0_10px_30px_rgba(16,185,129,0.3)]">
                    <Check size={16} /> Lưu thay đổi
                 </button>
               </>
            ) : (
               <button onClick={() => setEditing(true)} className="px-8 py-4 rounded-2xl bg-primary-fixed text-black text-xs font-black uppercase tracking-widest hover:scale-105 active:scale-95 transition-all flex items-center gap-2 shadow-[0_10px_40px_rgba(180,245,0,0.3)]">
                  <Pencil size={16} /> Chỉnh sửa hồ sơ
               </button>
            )}
          </div>
        </div>

        {/* Save toast */}
        {saveMsg === "saved" && (
          <div className="fixed bottom-10 right-10 z-50 flex items-center gap-3 bg-emerald-600/90 backdrop-blur-xl text-white px-8 py-4 rounded-2xl shadow-2xl border border-emerald-400/30 font-black text-xs uppercase tracking-widest animate-in fade-in slide-in-from-bottom-5">
            <Check size={18} /> Đã cập nhật thành công
          </div>
        )}

        <div className="grid lg:grid-cols-12 gap-10">
          {/* LEFT: Avatar & Vital Info */}
          <div className="lg:col-span-4 space-y-10">
            <div className="glass-card p-10 text-center">
               <div className="glow-halo mb-8">
                  <div className="relative group">
                    <div className="w-32 h-32 rounded-[40px] bg-gradient-to-br from-[#FF8C42] to-[#FF5B00] flex items-center justify-center text-4xl font-black text-white shadow-2xl border-4 border-[#0E0922]">
                       {initials}
                    </div>
                    <button className="absolute -bottom-2 -right-2 w-10 h-10 bg-white text-black rounded-2xl flex items-center justify-center shadow-2xl hover:scale-110 active:scale-90 transition-all border-4 border-[#0E0922]">
                       <Camera size={18} />
                    </button>
                  </div>
               </div>
               
               <h2 className="text-2xl font-black text-white tracking-tight mb-1">{form.name || "Người dùng"}</h2>
               <p className="text-xs font-black text-zinc-500 uppercase tracking-widest mb-6">{form.position || "Vị trí chuyên môn"}</p>
               
               {!isMentor && (
                 <div className="pt-8 border-t border-white/5">
                    <div className={`p-4 rounded-2xl ${planInfo.badge.bg} border ${planInfo.badge.border} flex items-center justify-between group`}>
                       <div className="flex items-center gap-3">
                          <planInfo.nameIcon size={18} className={planInfo.badge.icon} />
                          <span className={`${planInfo.badge.text} text-[10px] font-black uppercase tracking-widest`}>{planInfo.name}</span>
                       </div>
                       <button onClick={() => navigate("/pricing")} className="w-8 h-8 rounded-xl bg-white/10 flex items-center justify-center text-white hover:bg-white/20 transition-all">
                          <CaretRight size={14} />
                       </button>
                    </div>
                 </div>
               )}
            </div>

            <div className="glass-card p-8">
               <h3 className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em] mb-8 flex items-center gap-2">
                  <TrendUp size={14} className="text-primary-fixed" /> Thống kê vận hành
               </h3>
               <div className="grid grid-cols-2 gap-6">
                  {STATS.map((stat, i) => (
                    <div key={i}>
                       <p className="text-[8px] font-black text-zinc-600 uppercase mb-2 leading-none">{stat.label}</p>
                       <p className="text-xl font-black text-white tracking-tighter" style={{ color: stat.color }}>{stat.value}</p>
                    </div>
                  ))}
               </div>
            </div>

            <div className="glass-card p-8">
               <h3 className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em] mb-8 flex items-center gap-2">
                  <Trophy size={14} className="text-secondary" /> Huy chương đạt được
               </h3>
               <div className="grid grid-cols-3 gap-6">
                  {ACHIEVEMENTS.map((ach, i) => (
                    <div key={i} className={`text-center group ${ach.earned ? "opacity-100" : "opacity-20 grayscale"}`}>
                       <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${ach.color} flex items-center justify-center mx-auto mb-3 shadow-lg group-hover:scale-110 transition-transform`}>
                          <ach.icon size={20} className="text-white" />
                       </div>
                       <p className="text-[7px] font-black text-zinc-500 uppercase leading-tight line-clamp-2">{ach.label}</p>
                    </div>
                  ))}
               </div>
            </div>
          </div>

          {/* RIGHT: Detail Form & Controls */}
          <div className="lg:col-span-8 space-y-10">
            <div className="glass-card p-10">
               <div className="flex items-center justify-between mb-10">
                  <h2 className="text-xl font-black text-white font-headline tracking-tight flex items-center gap-3">
                     <User size={20} className="text-primary-fixed" /> Thông tin cốt lõi
                  </h2>
               </div>
               <div className="grid md:grid-cols-2 gap-8">
                  {FORM_FIELDS.map(({ label, key, icon: Icon }) => (
                    <div key={key} className="space-y-3">
                       <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest flex items-center gap-2">
                          <Icon size={12} /> {label}
                       </label>
                       <input
                         disabled={!editing}
                         className="input-glass w-full"
                         value={form[key]}
                         onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                         placeholder={editing ? `Nhập ${label.toLowerCase()}...` : "Dữ liệu trống"}
                       />
                    </div>
                  ))}
               </div>
            </div>

            {!isMentor && (
              <div className="glass-card overflow-hidden group">
                 <div className="p-10 flex flex-col md:flex-row md:items-center justify-between gap-10" style={{ background: planInfo.cardGrad }}>
                    <div className="relative z-10">
                       <p className="text-[10px] font-black uppercase tracking-[0.3em] text-white/40 mb-3">Tài khoản hiện tại</p>
                       <h3 className="text-3xl font-black text-white tracking-tighter mb-2 flex items-center gap-3">
                          {planInfo.name} <planInfo.nameIcon size={24} className="text-white/30" />
                       </h3>
                       <p className="text-sm font-medium text-white/60 mb-8 max-w-sm">{planInfo.desc}</p>
                       
                       <button 
                          onClick={() => navigate("/pricing")}
                          className="px-10 py-5 rounded-2xl bg-white text-black font-black text-xs uppercase tracking-widest hover:scale-105 active:scale-95 transition-all shadow-2xl flex items-center gap-3"
                       >
                          Nâng cấp {planInfo.isPaid ? 'Elite' : 'Chuyên nghiệp (Pro)'} <ArrowRight size={16} />
                       </button>
                    </div>

                    <div className="relative">
                       <div className="w-32 h-32 rounded-full border-8 border-white/10 flex items-center justify-center p-6 bg-white/[0.05] backdrop-blur-xl relative overflow-hidden">
                          <Lightning size={40} className="text-white/20 absolute -right-2 -top-2 rotate-12" />
                          <Lightning size={64} className="text-white group-hover:scale-110 transition-transform duration-700" />
                       </div>
                    </div>
                 </div>
                 {planInfo.progress && (
                   <div className="px-10 py-8 bg-black/20 flex flex-col gap-3">
                      <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest">
                         <span className="text-zinc-500">Mức độ vận hành</span>
                         <span className="text-primary-fixed">{planInfo.progress.used} / {planInfo.progress.max} Buổi</span>
                      </div>
                      <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                         <motion.div 
                            initial={{ width: 0 }}
                            animate={{ width: `${(planInfo.progress.used / planInfo.progress.max) * 100}%` }}
                            transition={{ duration: 1.5, ease: "easeOut" }}
                            className="h-full bg-gradient-to-r from-primary-fixed to-emerald-500 shadow-[0_0_15px_rgba(180,245,0,0.5)]"
                         />
                      </div>
                   </div>
                 )}
              </div>
            )}

            <div className="grid md:grid-cols-2 gap-8">
               {settings.map((section, sIdx) => (
                 <div key={sIdx} className="glass-card p-8">
                    <h3 className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em] mb-8 flex items-center gap-2">
                       <section.icon size={14} className="text-secondary" /> {section.title}
                    </h3>
                    <div className="space-y-6">
                       {section.items.map((item, iIdx) => (
                         <div key={iIdx} className="flex items-center justify-between group">
                            <div>
                               <p className="text-sm font-bold text-white group-hover:text-primary-fixed transition-colors">{item.label}</p>
                               <p className="text-[10px] text-zinc-600 mt-0.5">Trình quản lý hệ thống</p>
                            </div>
                            <button
                              onClick={() => toggleSetting(sIdx, iIdx)}
                              className={`relative w-11 h-6 rounded-full transition-all duration-300 ${item.enabled ? "bg-primary-fixed" : "bg-white/10"}`}
                            >
                              <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow-lg transition-transform duration-300 ${item.enabled ? "translate-x-6" : "translate-x-1"}`} />
                            </button>
                         </div>
                       ))}
                    </div>
                 </div>
               ))}
            </div>

            <div className="glass-card p-10 flex flex-col md:flex-row items-center justify-between gap-8 border-red-500/20 hover:border-red-500/40 bg-red-500/[0.02]">
               <div className="text-center md:text-left">
                  <h4 className="text-lg font-black text-white tracking-tight mb-2">Vùng nguy hiểm</h4>
                  <p className="text-xs text-zinc-600 font-medium">Bạn có muốn hủy kích hoạt tài khoản vĩnh viễn?</p>
               </div>
               <button onClick={handleLogout} className="px-8 py-4 rounded-2xl border border-red-500/30 text-red-500 text-[10px] font-black uppercase tracking-widest hover:bg-red-500 hover:text-white transition-all">
                  Đăng xuất tài khoản
               </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}