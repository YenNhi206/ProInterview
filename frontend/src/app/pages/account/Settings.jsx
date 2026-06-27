import { MentorPageShell } from "../../components/mentor/MentorPageShell";
import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router";
import { motion } from "motion/react";
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
} from "lucide-react";
import { toastApiError, toastApiSuccess } from "../../utils/shared/apiToast.js";
import { logout, getUser, getDisplayName, updateUser, refreshUserProfile, resendVerification } from "../../utils/auth/auth.js";
import { avatarSrc, DEFAULT_AVATAR } from "../../utils/shared/mediaUrl.js";
import { LoginSessionsSection } from "../../components/account/LoginSessionsSection";
import { AccountDangerZone } from "../../components/account/AccountDangerZone";

const NOTIF_PREFS_KEY_CUSTOMER = "prointerview_notif_prefs";
const NOTIF_PREFS_KEY_MENTOR = "prointerview_notif_prefs_mentor";

function notifStorageKey(role) {
  return role === "mentor" ? NOTIF_PREFS_KEY_MENTOR : NOTIF_PREFS_KEY_CUSTOMER;
}

/** Tiêu đề / nhãn, in hoa qua CSS */
const SETTINGS_TITLE_CLS =
  "text-xs font-bold uppercase tracking-wide text-slate-800";
/** Mô tả, viết thường, câu bình thường */
const ITEM_DESC_CLS = "text-sm text-slate-500 leading-relaxed tracking-normal";

function loadNotifPrefs(storageKey) {
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
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

/* ─── Reusable components ───────────────────────────────── */
function ToggleSwitch({
  enabled,
  onChange,
  colorClass = "bg-emerald-500",
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!enabled)}
      className={`relative w-11 h-6 rounded-full transition-all duration-300 flex-shrink-0 focus:outline-none focus:ring-4 focus:ring-[#8037f4]/20 ${
        enabled ? colorClass : "bg-slate-300"
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

function SectionCard({ children, className = "", title, subtitle, icon: Icon }) {
  return (
    <div className={`overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-[0_1px_3px_rgba(15,23,42,0.04)] ${className}`}>
      {title && (
        <div className="flex flex-col gap-2 border-b border-slate-100 px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div className="flex items-center gap-3">
            {Icon && (
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-50 text-[#8037f4]">
                <Icon size={18} strokeWidth={2.2} />
              </div>
            )}
            <h2 className="font-headline text-lg font-bold text-slate-900">{title}</h2>
          </div>
          {subtitle ? <p className="text-sm text-slate-500">{subtitle}</p> : null}
        </div>
      )}
      <div className="p-5 sm:p-6">{children}</div>
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
      className={`fixed bottom-8 right-8 left-auto z-50 flex items-center gap-5 rounded-2xl border px-6 py-4 shadow-[0_12px_40px_rgba(15,23,42,0.12)] backdrop-blur-md transition-all ${
        saved
          ? "border-emerald-200 bg-emerald-50 text-emerald-800"
          : "border-slate-200 bg-white/95"
      }`}
    >
      {saved ? (
        <div className="flex items-center gap-3">
          <CheckCircle className="w-5 h-5" />
          <span className="text-xs font-bold text-emerald-800">Đã đồng bộ thành công</span>
        </div>
      ) : (
        <>
          <span className="text-xs font-semibold text-slate-500">Có thay đổi chưa lưu</span>
          <div className="flex items-center gap-3">
            <button
              onClick={onReset}
              className="rounded-full px-4 py-2 text-xs font-semibold text-slate-500 transition hover:text-slate-800"
            >
              Hủy
            </button>
            <button
              onClick={onSave}
              disabled={saving}
              className="rounded-full bg-slate-900 px-5 py-2.5 text-xs font-bold text-white transition hover:bg-[#8037f4] disabled:opacity-50"
            >
              {saving ? "Đang lưu…" : "Lưu thay đổi"}
            </button>
          </div>
        </>
      )}
    </motion.div>
  );
}

/* ─── TAB: Notifications ────────────────────────────────── */
const DEFAULT_CUSTOMER_NOTIFS = [
  {
    id: "interview_reminder",
    label: "Nhắc lịch phỏng vấn",
    description: "Email và thông báo app trước buổi hẹn khoảng 1 giờ.",
    value: true,
    icon: Clock,
    iconBg: "#ede9fe",
    iconColor: "#8037f4",
  },
  {
    id: "mentor_feedback",
    label: "Phản hồi từ mentor",
    description: "Khi mentor gửi góp ý sau buổi hoặc nhận xét của bạn.",
    value: true,
    icon: UserCheck,
    iconBg: "#c4ff47",
    iconColor: "#3a5c00",
  },
  {
    id: "streak_reminder",
    label: "Nhắc luyện tập đều đặn",
    description: "Nhắc luyện phỏng vấn AI và hoàn thành mục tiêu tuần.",
    value: true,
    icon: Star,
    iconBg: "#ede9fe",
    iconColor: "#8037f4",
  },
];

const DEFAULT_MENTOR_NOTIFS = [
  {
    id: "booking_request",
    label: "Buổi mentor đã thanh toán",
    description: "Thông báo khi học viên đã xác nhận thanh toán (CK/SePay).",
    value: true,
    icon: CalendarPlus,
    iconBg: "#ede9fe",
    iconColor: "#8037f4",
  },
  {
    id: "session_reminder",
    label: "Nhắc buổi mentor sắp tới",
    description: "Email và thông báo app trước buổi khoảng 1 giờ.",
    value: true,
    icon: Clock,
    iconBg: "#c4ff47",
    iconColor: "#3a5c00",
  },
  {
    id: "mentee_review",
    label: "Đánh giá từ học viên",
    description: "Học viên gửi nhận xét sau buổi.",
    value: true,
    icon: Star,
    iconBg: "#ede9fe",
    iconColor: "#8037f4",
  },
  {
    id: "booking_change",
    label: "Đổi hoặc hủy lịch",
    description: "Hủy buổi, đổi lịch hoặc cập nhật hoàn tiền.",
    value: true,
    icon: ArrowLeftRight,
    iconBg: "#c4ff47",
    iconColor: "#3a5c00",
  },
  {
    id: "payout_update",
    label: "Cập nhật tài chính",
    description: "Thu nhập, rút tiền và xác nhận từ admin.",
    value: true,
    icon: Wallet,
    iconBg: "#ede9fe",
    iconColor: "#8037f4",
  },
  {
    id: "peer_review_course",
    label: "Đánh giá chéo khóa học",
    description: "Có khóa học cần bạn đánh giá chéo.",
    value: true,
    icon: ClipboardCheck,
    iconBg: "#c4ff47",
    iconColor: "#3a5c00",
  },
];

function NotificationsTab({ isMentor, profileFromServer, onProfileSynced }) {
  const defaults = isMentor ? DEFAULT_MENTOR_NOTIFS : DEFAULT_CUSTOMER_NOTIFS;
  const storageKey = notifStorageKey(isMentor ? "mentor" : "customer");
  const sectionTitle = isMentor ? "Thông báo mentor" : "Trung tâm thông báo";

  const initialPrefs = () => {
    if (profileFromServer?.notificationPrefs) {
      return mergeNotifFromServer(defaults, profileFromServer.notificationPrefs, isMentor);
    }
    return mergeNotifPrefs(defaults, storageKey);
  };

  const [push, setPush] = useState(initialPrefs);
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

  const handleSave = async () => {
    setSaving(true);
    const prefMap = Object.fromEntries(push.map(({ id, value }) => [id, value]));
    const payload = isMentor
      ? { notificationPrefs: { mentor: prefMap } }
      : { notificationPrefs: { customer: prefMap } };
    const res = await updateUser(payload);
    setSaving(false);
    if (!res.success) {
      toastApiError(res.error, "Không lưu được cài đặt thông báo.");
      return;
    }
    try {
      localStorage.setItem(
        storageKey,
        JSON.stringify(push.map(({ id, value }) => ({ id, value }))),
      );
    } catch {
      /* cache optional */
    }
    const u = getUser();
    onProfileSynced?.(u);
    setDirty(false);
    toastApiSuccess("Đã lưu, thông báo sẽ áp dụng theo lựa chọn của bạn.");
  };

  const handleReset = () => {
    setPush(defaults);
    setDirty(false);
  };

  return (
    <div className="animate-in fade-in space-y-6 duration-500">
      <div className="overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-[0_1px_3px_rgba(15,23,42,0.04)]">
        <div className="flex flex-col gap-2 border-b border-slate-100 px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <h2 className="font-headline text-xl font-bold text-slate-900">{sectionTitle}</h2>
          <p className="text-sm text-slate-500">Chọn loại thông báo bạn muốn nhận</p>
        </div>
        <div>
          {push.map((item) => {
            const ItemIcon = item.icon;
            return (
              <div
                key={item.id}
                className="flex items-center justify-between gap-4 border-b border-slate-100 px-5 py-5 last:border-b-0 sm:px-6"
              >
                <div className="flex min-w-0 items-center gap-3.5">
                  {ItemIcon && (
                    <div
                      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl"
                      style={{ backgroundColor: item.iconBg || "#ede9fe" }}
                    >
                      <ItemIcon size={18} strokeWidth={2.2} style={{ color: item.iconColor || "#8037f4" }} />
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-slate-900">{item.label}</p>
                    <p className="mt-0.5 text-xs leading-relaxed text-slate-500">{item.description}</p>
                  </div>
                </div>
                <ToggleSwitch enabled={item.value} onChange={() => toggle(item.id)} />
              </div>
            );
          })}
        </div>
      </div>
      <SaveBar dirty={dirty} saving={saving} saved={false} onSave={handleSave} onReset={handleReset} />
    </div>
  );
}

/* ─── TAB: Security ─────────────────────────────────────── */
const MIN_PASS = 6;
const DEFAULT_SECURITY_PREFS = [
  {
    id: "two_factor",
    label: "Xác thực 2 bước",
    description: "Tăng cường bảo vệ tài khoản khi đăng nhập.",
    value: false,
    icon: Fingerprint,
    iconBg: "#ede9fe",
    iconColor: "#8037f4",
  },
  {
    id: "login_alert",
    label: "Thông báo đăng nhập mới",
    description: "Nhận thông báo khi tài khoản được đăng nhập từ thiết bị lạ.",
    value: true,
    icon: MonitorSmartphone,
    iconBg: "#c4ff47",
    iconColor: "#3a5c00",
  },
];

function SecurityTab({ profileFromServer, onProfileSynced }) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [resendingVerify, setResendingVerify] = useState(false);
  const [securityPrefs, setSecurityPrefs] = useState(DEFAULT_SECURITY_PREFS);
  /** Profile có `hasGoogleLogin` từ server (đồng bộ từ trang Settings + sau đổi MK) */
  const [sessionUser, setSessionUser] = useState(
    () => profileFromServer ?? getUser()
  );

  useEffect(() => {
    setSessionUser(profileFromServer ?? getUser());
  }, [profileFromServer]);

  const hasGoogleLogin = Boolean(sessionUser?.hasGoogleLogin);
  const needsEmailVerification = !hasGoogleLogin && !sessionUser?.isEmailVerified;
  /** Chỉ bắt buộc MK hiện tại khi server báo không có Google */
  const needsCurrentPassword = !hasGoogleLogin;
  const toggleSecurityPref = (id) => {
    setSecurityPrefs((prev) => prev.map((item) => (item.id === id ? { ...item, value: !item.value } : item)));
  };

  const handleUpdatePassword = async () => {
    const np = newPassword.trim();
    const cp = confirmPassword.trim();
    if (np.length < MIN_PASS) {
      toastApiError(`Mật khẩu mới cần ít nhất ${MIN_PASS} ký tự.`);
      return;
    }
    if (np !== cp) {
      toastApiError("Mật khẩu xác nhận không khớp.");
      return;
    }
    if (needsCurrentPassword && !currentPassword.trim()) {
      toastApiError("Vui lòng nhập mật khẩu hiện tại.");
      return;
    }
    setSaving(true);
    try {
      const payload = { newPassword: np };
      if (needsCurrentPassword) {
        payload.currentPassword = currentPassword.trim();
      } else if (currentPassword.trim()) {
        payload.currentPassword = currentPassword.trim();
      }
      const result = await updateUser(payload);
      if (result?.success) {
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
        const u = await refreshUserProfile();
        const next = u ?? getUser();
        setSessionUser(next);
        onProfileSynced?.(next);
        toastApiSuccess("Đã cập nhật mật khẩu.");
      } else {
        toastApiError(result?.error, "Không lưu được mật khẩu.");
      }
    } catch {
      toastApiError("Lỗi kết nối khi đổi mật khẩu.");
    } finally {
      setSaving(false);
    }
  };

  const handleResendVerification = async () => {
    const email = sessionUser?.email?.trim();
    if (!email) {
      toastApiError("Không tìm thấy email tài khoản.");
      return;
    }
    setResendingVerify(true);
    try {
      const result = await resendVerification(email);
      if (result?.success) {
        toastApiSuccess(result.message || "Đã gửi email xác minh. Kiểm tra hộp thư của bạn.");
      } else {
        toastApiError(result?.error, "Không gửi được email xác minh.");
      }
    } catch {
      toastApiError("Lỗi kết nối khi gửi email xác minh.");
    } finally {
      setResendingVerify(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {needsEmailVerification ? (
        <SectionCard
          title="Xác minh email"
          subtitle="Tài khoản chưa xác minh email. Một số tính năng có thể bị giới hạn."
          icon={UserCheck}
        >
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm font-medium text-slate-600">
              Email đăng ký:{" "}
              <span className="font-bold text-slate-900">{sessionUser?.email}</span>
            </p>
            <button
              type="button"
              className="btn-primary shrink-0 px-5 py-2.5 text-sm"
              disabled={resendingVerify}
              onClick={handleResendVerification}
            >
              {resendingVerify ? "Đang gửi…" : "Gửi lại email xác minh"}
            </button>
          </div>
        </SectionCard>
      ) : null}

      <SectionCard title="Bảo mật đăng nhập" subtitle="Tùy chọn bảo vệ tài khoản khi đăng nhập." icon={ShieldCheck}>
        <div className="space-y-3">
          {securityPrefs.map((item) => {
            const ItemIcon = item.icon;
            return (
              <div
                key={item.id}
                className="flex items-center justify-between gap-4 rounded-2xl border border-slate-100 bg-slate-50/90 px-4 py-4 sm:px-5"
              >
                <div className="flex items-center gap-3.5">
                  {ItemIcon && (
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white shadow-sm">
                      <ItemIcon size={18} strokeWidth={2} style={{ color: item.iconColor || "#8037f4" }} />
                    </div>
                  )}
                  <div>
                    <p className="text-sm font-bold text-slate-900">{item.label}</p>
                    <p className="mt-0.5 text-xs font-semibold leading-relaxed text-slate-500">{item.description}</p>
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
              <p className="text-xs text-slate-400">Không bắt buộc nếu bạn đang đăng nhập bằng Google.</p>
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
          <button
            type="button"
            disabled={saving}
            onClick={handleUpdatePassword}
            className="rounded-xl bg-violet-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-violet-700 disabled:opacity-50"
          >
            {saving ? "Đang lưu…" : "Cập nhật mật khẩu"}
          </button>
        </div>
      </SectionCard>

      <LoginSessionsSection SectionCard={SectionCard} />

      <AccountDangerZone SectionCard={SectionCard} />
    </div>
  );
}

/* ─── Main Settings Page ────────────────────────────────── */
const TABS = [
  { id: "notifications", label: "Thông báo", icon: Bell },
  { id: "security", label: "Bảo mật", icon: ShieldCheck },
];

export function Settings() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("notifications");
  /** Đồng bộ GET /me ngay khi vào Cài đặt, tránh tab Bảo mật đọc localStorage cũ thiếu hasGoogleLogin */
  const [profileFromServer, setProfileFromServer] = useState(() => getUser());

  useEffect(() => {
    let cancelled = false;
    refreshUserProfile().then((u) => {
      if (!cancelled) setProfileFromServer(u ?? getUser());
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleLogout = async () => {
    await logout();
    navigate("/");
  };

  const isMentor = profileFromServer?.role === "mentor";
  const displayName = getDisplayName(profileFromServer) || "Thành viên";
  const userEmail = profileFromServer?.email || "";
  const userAvatar = avatarSrc(profileFromServer?.avatar);
  const hasAvatar = userAvatar && userAvatar !== DEFAULT_AVATAR;

  return (
    <MentorPageShell bottomPad="pb-24" showAmbient={false} className="!bg-[#f8f9fc]">
      <style>{`
        .input-glass {
           background: #ffffff;
           border: 1px solid #e2e8f0;
           border-radius: 14px;
           color: #0f172a;
           padding: 12px 16px;
           font-size: 0.875rem;
           font-weight: 500;
           letter-spacing: -0.01em;
           transition: border-color 0.2s ease, background 0.2s ease, box-shadow 0.2s ease;
        }
        .input-glass:focus {
           background: #ffffff;
           border-color: rgba(122, 35, 229, 0.45);
           outline: none;
           box-shadow: 0 0 0 2px rgba(122, 35, 229, 0.12);
        }
        .input-glass::placeholder { color: #94a3b8; }
      `}</style>

      <div className="relative z-10 mx-auto max-w-[1280px] px-4 pb-12 sm:px-6 lg:px-10">
        <motion.header
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
          className="mb-6 pt-2 sm:mb-8"
        >
          <h1 className="font-headline text-[clamp(1.75rem,4vw,2.75rem)] font-black leading-tight tracking-tight text-slate-900">
            Cài đặt <span className="text-[#8037f4]">tài khoản</span>
          </h1>
          <p className="mt-2 max-w-xl text-sm text-slate-500">
            {isMentor ? "Thông báo, bảo mật và phiên đăng nhập." : "Thông báo và bảo mật tài khoản."}
          </p>
        </motion.header>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          <aside className="lg:col-span-4 xl:col-span-3">
            <div className="sticky top-24 space-y-3">
              <div className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-[0_1px_3px_rgba(15,23,42,0.04)]">
                <div className="flex flex-col items-center text-center">
                  {hasAvatar ? (
                    <img
                      src={userAvatar}
                      alt=""
                      className="h-20 w-20 rounded-full object-cover ring-2 ring-slate-100"
                      onError={(e) => {
                        e.currentTarget.onerror = null;
                        e.currentTarget.src = DEFAULT_AVATAR;
                      }}
                    />
                  ) : (
                    <div className="flex h-20 w-20 items-center justify-center rounded-full border-2 border-dashed border-slate-200 bg-slate-50">
                      <ImageIcon size={28} className="text-slate-300" strokeWidth={1.5} />
                    </div>
                  )}
                  <p className="mt-4 text-base font-bold text-slate-900">{displayName}</p>
                  <p className="mt-0.5 truncate text-xs text-slate-500">{userEmail}</p>
                  <Link
                    to="/profile"
                    className="mt-4 inline-flex w-full items-center justify-center rounded-full border border-slate-200 bg-slate-50 px-4 py-2.5 text-xs font-bold text-slate-700 transition hover:border-[#8037f4]/30 hover:bg-violet-50/50 hover:text-[#8037f4]"
                  >
                    Chỉnh sửa hồ sơ
                  </Link>
                </div>
              </div>

              <nav className="space-y-1.5" aria-label="Cài đặt tài khoản">
                {TABS.map((tab, index) => {
                  const isActive = tab.id === activeTab;
                  const order = String(index + 1).padStart(2, "0");
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setActiveTab(tab.id)}
                      className={`group flex w-full items-center justify-between rounded-xl px-4 py-3.5 text-left transition ${
                        isActive
                          ? "bg-violet-50 text-[#8037f4]"
                          : "text-slate-600 hover:bg-white hover:text-slate-900"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <span className={`text-xs font-bold tabular-nums ${isActive ? "text-[#8037f4]/70" : "text-slate-400"}`}>
                          {order}
                        </span>
                        <span className="text-sm font-bold">{tab.label}</span>
                      </div>
                      {isActive && <ChevronRight size={16} className="shrink-0 text-[#8037f4]" />}
                    </button>
                  );
                })}
                <button
                  type="button"
                  onClick={handleLogout}
                  className="flex w-full items-center gap-3 rounded-xl px-4 py-3.5 text-left text-red-600 transition hover:bg-red-50"
                >
                  <span className="text-xs font-bold tabular-nums text-red-400">03</span>
                  <span className="text-sm font-bold">Đăng xuất</span>
                </button>
              </nav>
            </div>
          </aside>

          <main className="lg:col-span-8 xl:col-span-9">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
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
          </main>
        </div>
      </div>
    </MentorPageShell>
  );
}