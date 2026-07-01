import { MentorPageShell } from "../../components/mentor/MentorPageShell";
import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router";
import { motion, AnimatePresence } from "motion/react";
import {
  Bell,
  CheckCircle,
  ShieldCheck,
  ChevronRight,
  CalendarPlus,
  Clock,
  Star,
  ArrowLeftRight,
  Wallet,
  ClipboardCheck,
  Fingerprint,
  MonitorSmartphone,
  KeyRound,
  UserCheck,
  ImageIcon,
  CalendarCheck,
  CalendarX,
  CreditCard,
  LogOut,
} from "lucide-react";
import { toastApiError, toastApiSuccess } from "../../utils/shared/apiToast.js";
import { logout, getUser, getDisplayName, updateUser, refreshUserProfile, resendVerification } from "../../utils/auth/auth.js";
import { avatarSrc, DEFAULT_AVATAR } from "../../utils/shared/mediaUrl.js";
import { LoginSessionsSection } from "../../components/account/LoginSessionsSection";
import { AccountDangerZone } from "../../components/account/AccountDangerZone";

const NOTIF_PREFS_KEY_CUSTOMER = "prointerview_notif_prefs";
const NOTIF_PREFS_KEY_MENTOR   = "prointerview_notif_prefs_mentor";

function notifStorageKey(role) {
  return role === "mentor" ? NOTIF_PREFS_KEY_MENTOR : NOTIF_PREFS_KEY_CUSTOMER;
}

function loadNotifPrefs(storageKey) {
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : null;
  } catch { return null; }
}

function mergeNotifPrefs(defaults, storageKey) {
  const saved = loadNotifPrefs(storageKey);
  if (!saved) return defaults;
  return defaults.map((d) => {
    const hit = saved.find((s) => s.id === d.id);
    return hit ? { ...d, value: !!hit.value } : d;
  });
}

function mergeNotifFromServer(defaults, serverPrefs, isMentor) {
  const slice = isMentor ? serverPrefs?.mentor : serverPrefs?.customer;
  if (!slice || typeof slice !== "object") return defaults;
  return defaults.map((d) => ({
    ...d,
    value: typeof slice[d.id] === "boolean" ? slice[d.id] : d.value,
  }));
}

/* ─── Toggle ─────────────────────────────────────────────── */
function ToggleSwitch({ enabled, onChange }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!enabled)}
      aria-checked={enabled}
      role="switch"
      className={`relative h-6 w-11 shrink-0 rounded-full transition-all duration-300 focus:outline-none focus:ring-4 focus:ring-[#8037f4]/20 ${
        enabled ? "bg-[#8037f4]" : "bg-slate-200"
      }`}
    >
      <motion.div
        animate={{ x: enabled ? 20 : 4 }}
        transition={{ type: "spring", stiffness: 500, damping: 30 }}
        className="absolute top-1 h-4 w-4 rounded-full bg-white shadow-md"
      />
    </button>
  );
}

/* ─── Section card ───────────────────────────────────────── */
function SectionCard({ children, className = "", title, subtitle, icon: Icon }) {
  return (
    <div className={`settings-card overflow-hidden ${className}`}>
      {title && (
        <div className="flex flex-col gap-2 border-b border-[rgba(128,55,244,0.12)] px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div className="flex items-center gap-3">
            {Icon && (
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-50 text-[#8037f4]">
                <Icon size={18} strokeWidth={2.2} />
              </div>
            )}
            <h2 className="font-headline text-lg font-bold text-slate-900">{title}</h2>
          </div>
          {subtitle ? <p className="text-xs font-semibold text-slate-500">{subtitle}</p> : null}
        </div>
      )}
      <div className="p-5 sm:p-6">{children}</div>
    </div>
  );
}

/* ─── Save bar ───────────────────────────────────────────── */
function SaveBar({ dirty, saving, saved, onSave, onReset }) {
  if (!dirty && !saved) return null;
  return (
    <motion.div
      initial={{ opacity: 0, y: 50 }}
      animate={{ opacity: 1, y: 0 }}
      className={`fixed bottom-4 left-4 right-4 z-50 flex items-center gap-3 rounded-2xl border px-4 py-3 shadow-[0_12px_40px_rgba(15,23,42,0.12)] backdrop-blur-md transition-all sm:bottom-8 sm:left-auto sm:right-8 sm:gap-5 sm:px-6 sm:py-4 ${
        saved
          ? "border-emerald-200 bg-emerald-50 text-emerald-800"
          : "border-slate-200 bg-white/95"
      }`}
    >
      {saved ? (
        <div className="flex items-center gap-3">
          <CheckCircle className="h-5 w-5" />
          <span className="text-xs font-bold text-emerald-800">Đã đồng bộ thành công</span>
        </div>
      ) : (
        <>
          <span className="text-xs font-semibold text-slate-500">Có thay đổi chưa lưu</span>
          <div className="flex items-center gap-3">
            <button onClick={onReset} className="rounded-full px-4 py-2 text-xs font-semibold text-slate-500 transition hover:text-slate-800">
              Hủy
            </button>
            <motion.button
              onClick={onSave}
              disabled={saving}
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              className="rounded-full bg-[#8037f4] px-5 py-2.5 text-xs font-bold text-white transition disabled:opacity-50"
            >
              {saving ? "Đang lưu…" : "Lưu thay đổi"}
            </motion.button>
          </div>
        </>
      )}
    </motion.div>
  );
}

/* ─── Notifications tab ──────────────────────────────────── */
/* P = purple, L = lime — chỉ 2 màu chủ đạo */
const P = { bg: "rgba(128,55,244,0.10)", color: "#8037f4" };
const L = { bg: "rgba(147,247,43,0.18)", color: "#4a7c00" };

const DEFAULT_CUSTOMER_NOTIFS = [
  { id: "booking_confirmed", label: "Xác nhận lịch hẹn thành công", description: "Khi thanh toán được duyệt và lịch mentor được xác nhận.", value: true, icon: CalendarCheck, iconBg: P.bg, iconColor: P.color },
  { id: "interview_reminder", label: "Nhắc lịch trước buổi hẹn", description: "Email và thông báo app khoảng 1 giờ trước buổi mentor.", value: true, icon: Clock, iconBg: L.bg, iconColor: L.color },
  { id: "booking_cancelled", label: "Lịch hẹn bị hủy hoặc đổi", description: "Khi mentor hủy, đổi lịch hoặc có cập nhật hoàn tiền.", value: true, icon: CalendarX, iconBg: P.bg, iconColor: P.color },
  { id: "mentor_feedback", label: "Phản hồi từ mentor", description: "Khi mentor gửi góp ý sau buổi hoặc nhận xét về bạn.", value: true, icon: UserCheck, iconBg: L.bg, iconColor: L.color },
  { id: "streak_reminder", label: "Nhắc luyện tập đều đặn", description: "Nhắc luyện phỏng vấn AI và hoàn thành mục tiêu tuần.", value: true, icon: Star, iconBg: P.bg, iconColor: P.color },
  { id: "plan_expiring", label: "Gói sắp hết hạn", description: "Nhắc trước 7 ngày khi gói Pro hoặc Elite của bạn sắp hết.", value: true, icon: CreditCard, iconBg: L.bg, iconColor: L.color },
];

const DEFAULT_MENTOR_NOTIFS = [
  { id: "booking_request", label: "Buổi mentor đã thanh toán", description: "Thông báo khi học viên xác nhận thanh toán (CK / SePay).", value: true, icon: CalendarPlus, iconBg: P.bg, iconColor: P.color },
  { id: "session_reminder", label: "Nhắc buổi mentor sắp tới", description: "Email và thông báo app khoảng 1 giờ trước buổi.", value: true, icon: Clock, iconBg: L.bg, iconColor: L.color },
  { id: "mentee_review", label: "Đánh giá từ học viên", description: "Học viên gửi nhận xét sau buổi học với bạn.", value: true, icon: Star, iconBg: P.bg, iconColor: P.color },
  { id: "booking_change", label: "Đổi hoặc hủy lịch", description: "Học viên hủy, đổi lịch hoặc có cập nhật hoàn tiền.", value: true, icon: ArrowLeftRight, iconBg: L.bg, iconColor: L.color },
  { id: "payout_update", label: "Cập nhật tài chính", description: "Thu nhập, rút tiền và xác nhận thanh toán từ admin.", value: true, icon: Wallet, iconBg: P.bg, iconColor: P.color },
  { id: "peer_review_course", label: "Đánh giá chéo khóa học", description: "Có khóa học cần bạn thực hiện đánh giá chéo.", value: true, icon: ClipboardCheck, iconBg: L.bg, iconColor: L.color },
];

function NotificationsTab({ isMentor, profileFromServer, onProfileSynced }) {
  const defaults   = isMentor ? DEFAULT_MENTOR_NOTIFS : DEFAULT_CUSTOMER_NOTIFS;
  const storageKey = notifStorageKey(isMentor ? "mentor" : "customer");

  const initialPrefs = () => {
    if (profileFromServer?.notificationPrefs) {
      return mergeNotifFromServer(defaults, profileFromServer.notificationPrefs, isMentor);
    }
    return mergeNotifPrefs(defaults, storageKey);
  };

  const [push, setPush]   = useState(initialPrefs);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const defs = isMentor ? DEFAULT_MENTOR_NOTIFS : DEFAULT_CUSTOMER_NOTIFS;
    if (profileFromServer?.notificationPrefs) {
      setPush(mergeNotifFromServer(defs, profileFromServer.notificationPrefs, isMentor));
    } else {
      setPush(mergeNotifPrefs(defs, storageKey));
    }
    setDirty(false);
  }, [isMentor, profileFromServer?.notificationPrefs, storageKey]);

  const toggle = (id) => {
    setPush((prev) => prev.map((t) => (t.id === id ? { ...t, value: !t.value } : t)));
    setDirty(true);
  };

  const allOn  = push.every((t) => t.value);
  const allOff = push.every((t) => !t.value);
  const toggleAll = () => {
    const next = allOn ? false : true;
    setPush((prev) => prev.map((t) => ({ ...t, value: next })));
    setDirty(true);
  };

  const handleSave = async () => {
    setSaving(true);
    const prefMap = Object.fromEntries(push.map(({ id, value }) => [id, value]));
    const payload = isMentor
      ? { notificationPrefs: { mentor: prefMap } }
      : { notificationPrefs: { customer: prefMap } };
    const res = await updateUser(payload);
    setSaving(false);
    if (!res.success) { toastApiError(res.error, "Không lưu được cài đặt thông báo."); return; }
    try {
      localStorage.setItem(storageKey, JSON.stringify(push.map(({ id, value }) => ({ id, value }))));
    } catch { /* cache optional */ }
    onProfileSynced?.(getUser());
    setDirty(false);
    toastApiSuccess("Đã lưu, thông báo sẽ áp dụng theo lựa chọn của bạn.");
  };

  const handleReset = () => { setPush(defaults); setDirty(false); };

  return (
    <div className="space-y-6">
      <div className="glass-card !overflow-hidden !rounded-2xl">
        {/* Header */}
        <div className="flex flex-col gap-3 border-b border-[rgba(186,165,255,0.25)] px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div>
            <h2 className="font-headline text-lg font-bold text-slate-900">
              {isMentor ? "Thông báo mentor" : "Trung tâm thông báo"}
            </h2>
            <p className="mt-0.5 text-sm text-slate-500">Chọn loại thông báo bạn muốn nhận</p>
          </div>
          <motion.button
            type="button"
            onClick={toggleAll}
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            className={`shrink-0 rounded-full border px-4 py-2 text-xs font-bold transition ${
              allOff
                ? "border-[#8037f4]/30 bg-violet-50 text-[#8037f4] hover:bg-violet-100"
                : "border-slate-200 bg-slate-50 text-slate-600 hover:border-slate-300 hover:bg-slate-100"
            }`}
          >
            {allOn ? "Tắt tất cả" : "Bật tất cả"}
          </motion.button>
        </div>

        {/* Rows */}
        <div>
          {push.map((item, index) => {
            const ItemIcon = item.icon;
            return (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, x: -16 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.35, delay: index * 0.055, ease: [0.16, 1, 0.3, 1] }}
                className="flex items-center justify-between gap-4 border-b border-[rgba(186,165,255,0.18)] px-5 py-4 last:border-b-0 sm:px-6"
              >
                <div className="flex min-w-0 items-center gap-3.5">
                  <div
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
                    style={{ backgroundColor: item.iconBg }}
                  >
                    <ItemIcon size={17} strokeWidth={2.2} style={{ color: item.iconColor }} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-slate-900">{item.label}</p>
                    <p className="mt-0.5 text-xs leading-relaxed text-slate-500">{item.description}</p>
                  </div>
                </div>
                <ToggleSwitch enabled={item.value} onChange={() => toggle(item.id)} />
              </motion.div>
            );
          })}
        </div>
      </div>

      <SaveBar dirty={dirty} saving={saving} saved={false} onSave={handleSave} onReset={handleReset} />
    </div>
  );
}

/* ─── Security tab ───────────────────────────────────────── */
const MIN_PASS = 6;
const DEFAULT_SECURITY_PREFS = [
  {
    id: "two_factor",
    label: "Xác thực 2 bước",
    description: "Tăng cường bảo vệ tài khoản khi đăng nhập.",
    value: false,
    icon: Fingerprint,
    iconBg: P.bg,
    iconColor: P.color,
  },
  {
    id: "login_alert",
    label: "Thông báo đăng nhập mới",
    description: "Nhận thông báo khi tài khoản đăng nhập từ thiết bị lạ.",
    value: true,
    icon: MonitorSmartphone,
    iconBg: L.bg,
    iconColor: L.color,
  },
];

function SecurityTab({ profileFromServer, onProfileSynced }) {
  const [currentPassword,  setCurrentPassword]  = useState("");
  const [newPassword,      setNewPassword]       = useState("");
  const [confirmPassword,  setConfirmPassword]   = useState("");
  const [saving,           setSaving]            = useState(false);
  const [resendingVerify,  setResendingVerify]   = useState(false);
  const [securityPrefs,    setSecurityPrefs]     = useState(DEFAULT_SECURITY_PREFS);
  const [sessionUser,      setSessionUser]       = useState(() => profileFromServer ?? getUser());

  useEffect(() => { setSessionUser(profileFromServer ?? getUser()); }, [profileFromServer]);

  const hasGoogleLogin        = Boolean(sessionUser?.hasGoogleLogin);
  const needsEmailVerification = !hasGoogleLogin && !sessionUser?.isEmailVerified;
  const needsCurrentPassword  = !hasGoogleLogin;

  const toggleSecurityPref = (id) =>
    setSecurityPrefs((prev) => prev.map((item) => (item.id === id ? { ...item, value: !item.value } : item)));

  const handleUpdatePassword = async () => {
    const np = newPassword.trim();
    const cp = confirmPassword.trim();
    if (np.length < MIN_PASS) { toastApiError(`Mật khẩu mới cần ít nhất ${MIN_PASS} ký tự.`); return; }
    if (np !== cp) { toastApiError("Mật khẩu xác nhận không khớp."); return; }
    if (needsCurrentPassword && !currentPassword.trim()) { toastApiError("Vui lòng nhập mật khẩu hiện tại."); return; }
    setSaving(true);
    try {
      const payload = { newPassword: np };
      if (needsCurrentPassword || currentPassword.trim()) payload.currentPassword = currentPassword.trim();
      const result = await updateUser(payload);
      if (result?.success) {
        setCurrentPassword(""); setNewPassword(""); setConfirmPassword("");
        const u = await refreshUserProfile();
        const next = u ?? getUser();
        setSessionUser(next);
        onProfileSynced?.(next);
        toastApiSuccess("Đã cập nhật mật khẩu.");
      } else {
        toastApiError(result?.error, "Không lưu được mật khẩu.");
      }
    } catch { toastApiError("Lỗi kết nối khi đổi mật khẩu."); }
    finally { setSaving(false); }
  };

  const handleResendVerification = async () => {
    const email = sessionUser?.email?.trim();
    if (!email) { toastApiError("Không tìm thấy email tài khoản."); return; }
    setResendingVerify(true);
    try {
      const result = await resendVerification(email);
      if (result?.success) {
        toastApiSuccess(result.message || "Đã gửi email xác minh. Kiểm tra hộp thư của bạn.");
      } else {
        toastApiError(result?.error, "Không gửi được email xác minh.");
      }
    } catch { toastApiError("Lỗi kết nối khi gửi email xác minh."); }
    finally { setResendingVerify(false); }
  };

  return (
    <div className="space-y-6">
      {needsEmailVerification && (
        <SectionCard title="Xác minh email" subtitle="Tài khoản chưa xác minh. Một số tính năng có thể bị giới hạn." icon={UserCheck}>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm font-medium text-slate-600">
              Email: <span className="font-bold text-slate-900">{sessionUser?.email}</span>
            </p>
            <button type="button" className="btn-primary shrink-0 px-5 py-2.5 text-sm" disabled={resendingVerify} onClick={handleResendVerification}>
              {resendingVerify ? "Đang gửi…" : "Gửi lại email xác minh"}
            </button>
          </div>
        </SectionCard>
      )}

      <SectionCard title="Bảo mật đăng nhập" subtitle="Tùy chọn bảo vệ tài khoản khi đăng nhập." icon={ShieldCheck}>
        <div className="space-y-3">
          {securityPrefs.map((item) => {
            const ItemIcon = item.icon;
            return (
              <div key={item.id} className="flex items-center justify-between gap-4 rounded-2xl border border-[rgba(128,55,244,0.10)] bg-violet-50/30 px-4 py-4 sm:px-5">
                <div className="flex items-center gap-3.5">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white shadow-sm">
                    <ItemIcon size={18} strokeWidth={2} style={{ color: item.iconColor }} />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-slate-900">{item.label}</p>
                    <p className="mt-0.5 text-xs leading-relaxed text-slate-500">{item.description}</p>
                  </div>
                </div>
                <ToggleSwitch enabled={item.value} onChange={() => toggleSecurityPref(item.id)} />
              </div>
            );
          })}
        </div>
      </SectionCard>

      <SectionCard title="Đổi mật khẩu" subtitle="Cập nhật mật khẩu đăng nhập của bạn." icon={KeyRound}>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-1.5 md:col-span-2">
            <label className="text-xs font-semibold text-slate-600">Mật khẩu hiện tại</label>
            {!needsCurrentPassword && (
              <p className="text-xs text-slate-400">Không bắt buộc nếu bạn đăng nhập bằng Google.</p>
            )}
            <input
              type="password"
              autoComplete="current-password"
              placeholder={needsCurrentPassword ? "Nhập mật khẩu hiện tại" : "Để trống hoặc nhập mật khẩu cũ nếu có"}
              className="input-glass w-full"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-600">Mật khẩu mới</label>
            <input type="password" autoComplete="new-password" placeholder="••••••••" className="input-glass w-full" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-600">Xác nhận mật khẩu mới</label>
            <input type="password" autoComplete="new-password" placeholder="••••••••" className="input-glass w-full" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
          </div>
        </div>
        <div className="mt-5">
          <motion.button
            type="button"
            disabled={saving}
            onClick={handleUpdatePassword}
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            className="rounded-xl bg-[#8037f4] px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition disabled:opacity-50"
          >
            {saving ? "Đang lưu…" : "Cập nhật mật khẩu"}
          </motion.button>
        </div>
      </SectionCard>

      <LoginSessionsSection SectionCard={SectionCard} />
      <AccountDangerZone SectionCard={SectionCard} />
    </div>
  );
}

/* ─── Main ───────────────────────────────────────────────── */
const TABS = [
  { id: "notifications", label: "Thông báo",  icon: Bell },
  { id: "security",      label: "Bảo mật",    icon: ShieldCheck },
];

export function Settings() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab]           = useState("notifications");
  const [profileFromServer, setProfileFromServer] = useState(() => getUser());

  useEffect(() => {
    let cancelled = false;
    refreshUserProfile().then((u) => { if (!cancelled) setProfileFromServer(u ?? getUser()); });
    return () => { cancelled = true; };
  }, []);

  const handleLogout = async () => { await logout(); navigate("/"); };

  const isMentor    = profileFromServer?.role === "mentor";
  const displayName = getDisplayName(profileFromServer) || "Thành viên";
  const userEmail   = profileFromServer?.email || "";
  const userAvatar  = avatarSrc(profileFromServer?.avatar);
  const hasAvatar   = userAvatar && userAvatar !== DEFAULT_AVATAR;

  return (
    <MentorPageShell bottomPad="pb-24">
      <style>{`
        .settings-card {
          background: rgba(255, 255, 255, 0.85);
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
          border: 1px solid rgba(128, 55, 244, 0.15);
          border-radius: 24px;
          box-shadow: 0 10px 30px -10px rgba(128, 55, 244, 0.05), 0 1px 3px rgba(128, 55, 244, 0.02);
          transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
        }
        @media (hover: hover) {
          .settings-card:hover {
            border-color: rgba(128, 55, 244, 0.25);
            box-shadow: 0 20px 40px -12px rgba(128, 55, 244, 0.1);
            transform: translateY(-2px);
          }
        }
        .input-glass {
          background: rgba(255,255,255,0.85);
          border: 1px solid rgba(128,55,244,0.16);
          border-radius: 16px;
          color: #0f172a;
          padding: 12px 16px;
          font-size: 0.875rem;
          font-weight: 500;
          letter-spacing: -0.01em;
          transition: all 0.25s ease;
          backdrop-filter: blur(4px);
        }
        .input-glass:focus { 
          border-color: rgba(128,55,244,0.5); 
          outline: none; 
          box-shadow: 0 0 0 3.5px rgba(128,55,244,0.12); 
          background: #ffffff;
        }
        .input-glass::placeholder { color: #94a3b8; }
      `}</style>

      <div className="relative z-10 mx-auto max-w-[1280px] px-4 pb-12 sm:px-6 lg:px-10">
        {/* Header */}
        <motion.header
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
          className="mb-6 pt-2 sm:pt-3 sm:mb-8"
        >
          <h1 className="font-headline text-[clamp(1.75rem,4vw,2.75rem)] font-black leading-tight tracking-tight text-slate-900">
            Cài đặt <span className="text-[#8037f4]">tài khoản</span>
          </h1>
          <p className="mt-2 max-w-xl text-sm text-slate-500">
            {isMentor ? "Thông báo, bảo mật và phiên đăng nhập." : "Thông báo và bảo mật tài khoản."}
          </p>
        </motion.header>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          {/* Sidebar */}
          <aside className="lg:col-span-4 xl:col-span-3">
            <div className="sticky top-24 space-y-3">
              {/* Profile card */}
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.45, delay: 0.05 }}
                className="settings-card overflow-hidden"
              >
                {/* Purple → lime gradient strip */}
                <div className="h-20 bg-gradient-to-br from-[#8037f4] via-[#6d2fd6] to-[#4a1fb8] relative">
                  <div className="absolute inset-0 opacity-30" style={{ background: "radial-gradient(ellipse at 80% 50%, #93f72b 0%, transparent 60%)" }} />
                </div>
                <div className="flex flex-col items-center px-5 pb-6 text-center">
                  <div className="relative z-10 -mt-10 mb-3">
                    {hasAvatar ? (
                      <img
                        src={userAvatar}
                        alt=""
                        className="h-[72px] w-[72px] rounded-full object-cover ring-[4px] ring-violet-50/50 shadow-lg"
                        onError={(e) => { e.currentTarget.onerror = null; e.currentTarget.src = DEFAULT_AVATAR; }}
                      />
                    ) : (
                      <div className="flex h-[72px] w-[72px] items-center justify-center rounded-full border-[3px] border-white bg-violet-100 shadow-lg">
                        <ImageIcon size={26} className="text-[#8037f4]" strokeWidth={1.5} />
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col items-center gap-1">
                    <p className="text-sm font-bold text-slate-900">{displayName}</p>
                    <span className="inline-block rounded-full bg-violet-100/60 px-2.5 py-0.5 text-[9px] font-bold text-[#8037f4] uppercase tracking-wider">
                      {isMentor ? "Mentor" : "Học viên"}
                    </span>
                  </div>
                  <p className="mt-1.5 w-full truncate px-2 text-xs text-slate-500">{userEmail}</p>
                  <Link
                    to="/profile"
                    className="mt-4 inline-flex w-full items-center justify-center rounded-full bg-gradient-to-r from-[#8037f4] to-[#6d28d9] px-4 py-2.5 text-xs font-black uppercase tracking-wide text-white shadow-[0_4px_14px_rgba(128,55,244,0.3)] transition hover:brightness-110"
                  >
                    Chỉnh sửa hồ sơ
                  </Link>
                </div>
              </motion.div>

              {/* Nav */}
              <motion.nav
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.45, delay: 0.1 }}
                className="settings-card overflow-hidden p-2"
                aria-label="Cài đặt tài khoản"
              >
                {TABS.map((tab, index) => {
                  const isActive = tab.id === activeTab;
                  const TabIcon  = tab.icon;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setActiveTab(tab.id)}
                      className={`group relative flex w-full items-center justify-between rounded-xl px-4 py-3 text-left transition-all duration-300 ${
                        isActive
                          ? "text-[#8037f4]"
                          : "text-slate-500 hover:text-slate-900"
                      }`}
                    >
                      {/* Active tab slider background */}
                      {isActive && (
                        <motion.div
                          layoutId="activeSettingTab"
                          className="absolute inset-0 rounded-xl bg-[rgba(128,55,244,0.06)] border border-[rgba(128,55,244,0.15)]"
                          transition={{ type: "spring", stiffness: 350, damping: 28 }}
                        />
                      )}
                      
                      <div className="relative z-10 flex items-center gap-3">
                        <span className={`text-[10px] font-black tabular-nums ${isActive ? "text-[#8037f4]/60" : "text-slate-300"}`}>
                          {String(index + 1).padStart(2, "0")}
                        </span>
                        <TabIcon size={15} strokeWidth={2.2} className={isActive ? "text-[#8037f4]" : "text-slate-400 group-hover:text-slate-600"} />
                        <span className="text-sm font-bold">{tab.label}</span>
                      </div>
                      {isActive && <ChevronRight size={15} className="relative z-10 shrink-0 text-[#8037f4]" />}
                    </button>
                  );
                })}

                <div className="my-1.5 border-t border-slate-100" />

                <button
                  type="button"
                  onClick={handleLogout}
                  className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left text-slate-500 transition hover:bg-[rgba(128,55,244,0.05)] hover:text-slate-700"
                >
                  <span className="text-[10px] font-black tabular-nums text-slate-300">03</span>
                  <LogOut size={15} strokeWidth={2.2} className="text-slate-400" />
                  <span className="text-sm font-bold">Đăng xuất</span>
                </button>
              </motion.nav>
            </div>
          </aside>

          {/* Content */}
          <main className="lg:col-span-8 xl:col-span-9">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeTab}
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                className="min-h-[400px]"
              >
                {activeTab === "notifications" && (
                  <NotificationsTab
                    isMentor={isMentor}
                    profileFromServer={profileFromServer}
                    onProfileSynced={(u) => setProfileFromServer(u ?? getUser())}
                  />
                )}
                {activeTab === "security" && (
                  <SecurityTab
                    profileFromServer={profileFromServer}
                    onProfileSynced={(u) => setProfileFromServer(u)}
                  />
                )}
              </motion.div>
            </AnimatePresence>
          </main>
        </div>
      </div>
    </MentorPageShell>
  );
}
