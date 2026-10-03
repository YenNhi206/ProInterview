import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router";
import { motion, AnimatePresence } from "motion/react";
import {
  Bell,
  CheckCircle,
  ShieldCheck,
  CalendarPlus,
  Clock,
  Star,
  ArrowLeftRight,
  Wallet,
  ClipboardCheck,
  KeyRound,
  UserCheck,
  ArrowUpRight,
  CalendarCheck,
  CalendarX,
  CreditCard,
  LogOut,
  Sparkles,
  AlertCircle,
  RefreshCw,
} from "lucide-react";
import { toastApiError, toastApiSuccess } from "../../utils/shared/apiToast.js";
import { logout, getUser, getDisplayName, updateUser, refreshUserProfile, resendVerification } from "../../utils/auth/auth.js";
import { avatarSrc, DEFAULT_AVATAR } from "../../utils/shared/mediaUrl.js";
import { LoginSessionsSection } from "../../components/account/LoginSessionsSection";
import { AccountDangerZone } from "../../components/account/AccountDangerZone";
import { CUSTOMER_SHELL_GUTTER, CUSTOMER_SHELL_MAX } from "../../components/layout/customerShellLayout";
import "../../../styles/settings.css";

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

/* ─── Compact iOS Glass Toggle ───────────────────────────── */
function ToggleSwitch({ enabled, onChange, disabled, labelledBy, describedBy }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={enabled}
      aria-labelledby={labelledBy}
      aria-describedby={describedBy}
      disabled={disabled}
      onClick={() => onChange(!enabled)}
      className={`relative inline-flex h-5.5 w-10 sm:h-6 sm:w-11 shrink-0 cursor-pointer items-center rounded-full border-2 transition-all duration-200 ease-in-out focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-400 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0e0c22] ${
        enabled
          ? "border-violet-400/60 bg-gradient-to-r from-violet-600 via-indigo-600 to-purple-600 shadow-[0_0_14px_rgba(124,58,237,0.5)]"
          : "border-white/15 bg-slate-800/80 hover:border-white/30"
      } ${disabled ? "opacity-40 cursor-not-allowed" : ""}`}
    >
      <span
        aria-hidden="true"
        className={`pointer-events-none inline-block h-4 w-4 sm:h-4.5 sm:w-4.5 transform rounded-full bg-white shadow-md ring-0 transition-transform duration-200 ease-in-out ${
          enabled
            ? "translate-x-4.5 sm:translate-x-5 shadow-[0_2px_6px_rgba(0,0,0,0.5)]"
            : "translate-x-0.5 bg-slate-200"
        }`}
      />
    </button>
  );
}

/* ─── Section Card Wrapper ───────────────────────────────── */
function SectionCard({ children, className = "", title, subtitle, icon: Icon }) {
  return (
    <section className={`rounded-2xl border border-white/10 bg-gradient-to-b from-[#181538]/75 via-[#13112c]/80 to-[#0e0c22]/90 shadow-[0_8px_30px_rgba(0,0,0,0.35)] backdrop-blur-2xl overflow-hidden p-4 sm:p-5 ${className}`}>
      {title && (
        <header className="flex items-center gap-3 pb-3 mb-3 border-b border-white/[0.08]">
          {Icon && (
            <div className="w-8 h-8 rounded-lg bg-violet-500/15 border border-violet-400/25 flex items-center justify-center text-violet-300 shadow-[0_0_10px_rgba(124,58,237,0.15)] shrink-0">
              <Icon size={16} strokeWidth={1.8} aria-hidden="true" />
            </div>
          )}
          <div>
            <h3 className="text-sm sm:text-base font-bold text-white tracking-tight">{title}</h3>
            {subtitle && <p className="text-[11px] text-slate-400 mt-0.5 leading-snug">{subtitle}</p>}
          </div>
        </header>
      )}
      <div className="settings-section-body">{children}</div>
    </section>
  );
}

/* ─── Notifications Tab (2-Column Grid) ───────────────────── */
const DEFAULT_CUSTOMER_NOTIFS = [
  { id: "booking_confirmed", label: "Xác nhận lịch hẹn", description: "Khi thanh toán được duyệt và lịch hẹn được xác nhận.", value: true, icon: CalendarCheck },
  { id: "interview_reminder", label: "Nhắc trước buổi hẹn", description: "Nhắc qua email và ứng dụng trước buổi hẹn khoảng 1 giờ.", value: true, icon: Clock },
  { id: "booking_cancelled", label: "Thay đổi hoặc hủy lịch", description: "Cập nhật đổi lịch, hủy lịch và hoàn tiền từ mentor.", value: true, icon: CalendarX },
  { id: "mentor_feedback", label: "Phản hồi từ mentor", description: "Nhận góp ý và nhận xét sau buổi hẹn.", value: true, icon: UserCheck },
  { id: "streak_reminder", label: "Nhắc luyện tập", description: "Nhắc luyện phỏng vấn AI và hoàn thành mục tiêu tuần.", value: true, icon: Star },
  { id: "plan_expiring", label: "Gói sắp hết hạn", description: "Nhắc trước 7 ngày khi gói Pro hoặc Elite sắp hết hạn.", value: true, icon: CreditCard },
];

const DEFAULT_MENTOR_NOTIFS = [
  { id: "booking_request", label: "Buổi mentor đã thanh toán", description: "Thông báo khi học viên xác nhận thanh toán (CK / SePay).", value: true, icon: CalendarPlus },
  { id: "session_reminder", label: "Nhắc buổi mentor sắp tới", description: "Email và thông báo app khoảng 1 giờ trước buổi.", value: true, icon: Clock },
  { id: "mentee_review", label: "Đánh giá từ học viên", description: "Học viên gửi nhận xét sau buổi học với bạn.", value: true, icon: Star },
  { id: "booking_change", label: "Đổi hoặc hủy lịch", description: "Học viên hủy, đổi lịch hoặc có cập nhật hoàn tiền.", value: true, icon: ArrowLeftRight },
  { id: "payout_update", label: "Cập nhật tài chính", description: "Thu nhập, rút tiền và xác nhận thanh toán từ admin.", value: true, icon: Wallet },
  { id: "peer_review_course", label: "Đánh giá chéo khóa học", description: "Có khóa học cần bạn thực hiện đánh giá chéo.", value: true, icon: ClipboardCheck },
];

function NotificationsTab({ isMentor, push, toggle, saving, userEmail }) {
  const groupAppointments = {
    id: "appointments",
    title: "Lịch hẹn",
    icon: CalendarCheck,
    subtitle: "Thông báo về phiên cố vấn & lịch phỏng vấn",
    items: push.slice(0, 4),
  };

  const groupAccount = {
    id: "account",
    title: isMentor ? "Tài chính & khóa học" : "Luyện tập & tài khoản",
    icon: isMentor ? Wallet : Star,
    subtitle: isMentor ? "Cập nhật doanh thu & hoạt động mentor" : "Nhắc luyện tập AI & gói dịch vụ",
    items: push.slice(4),
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
      {/* Column 1: Lịch hẹn (4 items) */}
      <section
        className="rounded-2xl border border-white/10 bg-gradient-to-b from-[#181538]/75 via-[#13112c]/80 to-[#0e0c22]/90 shadow-[0_8px_30px_rgba(0,0,0,0.35)] backdrop-blur-2xl p-4 sm:p-5"
        aria-labelledby="settings-group-appointments"
      >
        <div className="flex items-center justify-between gap-3 pb-3 mb-3 border-b border-white/[0.08]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-violet-500/15 border border-violet-400/25 flex items-center justify-center text-violet-300 shadow-[0_0_10px_rgba(124,58,237,0.15)] shrink-0">
              <CalendarCheck size={16} strokeWidth={1.8} aria-hidden="true" />
            </div>
            <div>
              <h3 id="settings-group-appointments" className="text-sm sm:text-base font-bold text-white tracking-tight">
                {groupAppointments.title}
              </h3>
              <p className="text-[11px] text-slate-400 leading-snug">
                {groupAppointments.subtitle}
              </p>
            </div>
          </div>
          <span className="text-[11px] font-semibold text-violet-300 px-2 py-0.5 rounded-full bg-violet-500/15 border border-violet-400/30">
            {groupAppointments.items.filter((i) => i.value).length}/{groupAppointments.items.length} bật
          </span>
        </div>

        <div className="space-y-2">
          {groupAppointments.items.map((item) => {
            const Icon = item.icon;
            return (
              <div
                key={item.id}
                className="flex items-center justify-between gap-3 p-3 rounded-xl border border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.05] hover:border-violet-500/20 transition-all duration-150 group"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-all duration-150 ${
                      item.value
                        ? "bg-violet-500/20 border border-violet-400/35 text-violet-300 shadow-[0_0_10px_rgba(124,58,237,0.2)]"
                        : "bg-white/5 border border-white/10 text-slate-500"
                    }`}
                  >
                    <Icon size={15} strokeWidth={1.8} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs sm:text-sm font-semibold text-white group-hover:text-violet-200 transition-colors leading-tight" id={"pref-" + item.id}>
                      {item.label}
                    </p>
                    <p className="text-[11px] text-slate-400 mt-0.5 leading-snug line-clamp-1" id={"pref-" + item.id + "-description"} title={item.description}>
                      {item.description}
                    </p>
                  </div>
                </div>
                <div className="shrink-0 pl-2">
                  <ToggleSwitch
                    enabled={item.value}
                    disabled={saving}
                    onChange={() => toggle(item.id)}
                    labelledBy={"pref-" + item.id}
                    describedBy={"pref-" + item.id + "-description"}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Column 2: Luyện tập & Tài khoản + Delivery status */}
      <div className="space-y-4">
        <section
          className="rounded-2xl border border-white/10 bg-gradient-to-b from-[#181538]/75 via-[#13112c]/80 to-[#0e0c22]/90 shadow-[0_8px_30px_rgba(0,0,0,0.35)] backdrop-blur-2xl p-4 sm:p-5"
          aria-labelledby="settings-group-account"
        >
          <div className="flex items-center justify-between gap-3 pb-3 mb-3 border-b border-white/[0.08]">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-violet-500/15 border border-violet-400/25 flex items-center justify-center text-violet-300 shadow-[0_0_10px_rgba(124,58,237,0.15)] shrink-0">
                <groupAccount.icon size={16} strokeWidth={1.8} aria-hidden="true" />
              </div>
              <div>
                <h3 id="settings-group-account" className="text-sm sm:text-base font-bold text-white tracking-tight">
                  {groupAccount.title}
                </h3>
                <p className="text-[11px] text-slate-400 leading-snug">
                  {groupAccount.subtitle}
                </p>
              </div>
            </div>
            <span className="text-[11px] font-semibold text-violet-300 px-2 py-0.5 rounded-full bg-violet-500/15 border border-violet-400/30">
              {groupAccount.items.filter((i) => i.value).length}/{groupAccount.items.length} bật
            </span>
          </div>

          <div className="space-y-2">
            {groupAccount.items.map((item) => {
              const Icon = item.icon;
              return (
                <div
                  key={item.id}
                  className="flex items-center justify-between gap-3 p-3 rounded-xl border border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.05] hover:border-violet-500/20 transition-all duration-150 group"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-all duration-150 ${
                        item.value
                          ? "bg-violet-500/20 border border-violet-400/35 text-violet-300 shadow-[0_0_10px_rgba(124,58,237,0.2)]"
                          : "bg-white/5 border border-white/10 text-slate-500"
                      }`}
                    >
                      <Icon size={15} strokeWidth={1.8} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs sm:text-sm font-semibold text-white group-hover:text-violet-200 transition-colors leading-tight" id={"pref-" + item.id}>
                        {item.label}
                      </p>
                      <p className="text-[11px] text-slate-400 mt-0.5 leading-snug line-clamp-1" id={"pref-" + item.id + "-description"} title={item.description}>
                        {item.description}
                      </p>
                    </div>
                  </div>
                  <div className="shrink-0 pl-2">
                    <ToggleSwitch
                      enabled={item.value}
                      disabled={saving}
                      onChange={() => toggle(item.id)}
                      labelledBy={"pref-" + item.id}
                      describedBy={"pref-" + item.id + "-description"}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Sync & Channels Tip Card (keeps height balanced with Col 1) */}
        <div className="p-3.5 sm:p-4 rounded-2xl border border-white/[0.08] bg-gradient-to-r from-violet-950/30 via-slate-900/40 to-indigo-950/30 backdrop-blur-xl flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
              <CheckCircle size={15} />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold text-white truncate">Đồng bộ qua Email & Ứng dụng</p>
              <p className="text-[11px] text-slate-400 truncate">{userEmail || "Tự động gửi thông báo theo thời gian thực"}</p>
            </div>
          </div>
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 shrink-0">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            Thời gian thực
          </span>
        </div>
      </div>
    </div>
  );
}

/* ─── Security Tab (2-Column Grid) ───────────────────────── */
const MIN_PASS = 6;
function SecurityTab({ profileFromServer, onProfileSynced }) {
  const [currentPassword,  setCurrentPassword]  = useState("");
  const [newPassword,      setNewPassword]       = useState("");
  const [confirmPassword,  setConfirmPassword]   = useState("");
  const [saving,           setSaving]            = useState(false);
  const [resendingVerify,  setResendingVerify]   = useState(false);
  const [sessionUser,      setSessionUser]       = useState(() => profileFromServer ?? getUser());

  useEffect(() => { setSessionUser(profileFromServer ?? getUser()); }, [profileFromServer]);

  const hasGoogleLogin        = Boolean(sessionUser?.hasGoogleLogin);
  const needsEmailVerification = !hasGoogleLogin && !sessionUser?.isEmailVerified;
  const needsCurrentPassword  = !hasGoogleLogin;

  const handleUpdatePassword = async (event) => {
    event.preventDefault();
    if (saving) return;
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
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
      {/* Column 1: Đổi mật khẩu + Email verification */}
      <div className="space-y-4">
        {needsEmailVerification && (
          <SectionCard
            title="Xác minh email"
            subtitle="Xác minh địa chỉ email để bảo vệ tài khoản và nhận thông báo quan trọng."
            icon={UserCheck}
            className="border-amber-500/30 bg-gradient-to-b from-[#251b36]/80 via-[#1a142c]/80 to-[#120e24]/90"
          >
            <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-xl border border-amber-500/20 bg-amber-500/5">
              <div>
                <p className="text-xs sm:text-sm font-bold text-white">{sessionUser?.email}</p>
                <p className="text-[11px] text-amber-300/80 mt-0.5">Tài khoản chưa được xác thực email.</p>
              </div>
              <button
                type="button"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-amber-500 to-orange-500 shadow-[0_0_12px_rgba(245,158,11,0.35)] hover:shadow-[0_0_20px_rgba(245,158,11,0.5)] hover:-translate-y-0.5 transition-all"
                disabled={resendingVerify}
                onClick={handleResendVerification}
              >
                {resendingVerify ? "Đang gửi…" : "Gửi email xác minh"}
              </button>
            </div>
          </SectionCard>
        )}

        <SectionCard
          title="Đổi mật khẩu"
          subtitle="Mật khẩu mới cần ít nhất 6 ký tự để bảo vệ an toàn cho tài khoản."
          icon={KeyRound}
        >
          <form onSubmit={handleUpdatePassword} className="space-y-3.5">
            {needsCurrentPassword && (
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1" htmlFor="settings-current-password">
                  Mật khẩu hiện tại
                </label>
                <input
                  id="settings-current-password"
                  type="password"
                  autoComplete="current-password"
                  required={needsCurrentPassword}
                  disabled={saving}
                  className="w-full px-3.5 py-2 rounded-xl border border-white/15 bg-slate-900/60 text-white text-xs sm:text-sm placeholder-slate-500 focus:border-violet-400 focus:ring-2 focus:ring-violet-500/25 transition-all outline-none"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="Nhập mật khẩu hiện tại"
                />
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1" htmlFor="settings-new-password">
                  Mật khẩu mới
                </label>
                <input
                  id="settings-new-password"
                  type="password"
                  autoComplete="new-password"
                  required
                  minLength={MIN_PASS}
                  disabled={saving}
                  className="w-full px-3.5 py-2 rounded-xl border border-white/15 bg-slate-900/60 text-white text-xs sm:text-sm placeholder-slate-500 focus:border-violet-400 focus:ring-2 focus:ring-violet-500/25 transition-all outline-none"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Ít nhất 6 ký tự"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1" htmlFor="settings-confirm-password">
                  Xác nhận mật khẩu mới
                </label>
                <input
                  id="settings-confirm-password"
                  type="password"
                  autoComplete="new-password"
                  required
                  minLength={MIN_PASS}
                  disabled={saving}
                  className="w-full px-3.5 py-2 rounded-xl border border-white/15 bg-slate-900/60 text-white text-xs sm:text-sm placeholder-slate-500 focus:border-violet-400 focus:ring-2 focus:ring-violet-500/25 transition-all outline-none"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Nhập lại mật khẩu mới"
                />
              </div>
            </div>

            <div className="pt-1">
              <button
                type="submit"
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold text-white bg-gradient-to-r from-violet-600 via-indigo-600 to-purple-600 shadow-[0_0_16px_rgba(124,58,237,0.4)] hover:shadow-[0_0_24px_rgba(124,58,237,0.6)] hover:-translate-y-0.5 active:translate-y-0 transition-all duration-200 disabled:opacity-40"
                disabled={saving}
              >
                {saving ? "Đang lưu…" : "Cập nhật mật khẩu"}
              </button>
            </div>
          </form>
        </SectionCard>
      </div>

      {/* Column 2: Phiên đăng nhập & Đóng tài khoản */}
      <div className="space-y-4">
        <LoginSessionsSection SectionCard={SectionCard} />
        <AccountDangerZone SectionCard={SectionCard} />
      </div>
    </div>
  );
}

/* ─── Main Component ─────────────────────────────────────── */
const TABS = [
  { id: "notifications", label: "Thông báo", icon: Bell },
  { id: "security",      label: "Bảo mật",   icon: ShieldCheck },
];

export function Settings() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("notifications");
  const [profileFromServer, setProfileFromServer] = useState(() => getUser());
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  useEffect(() => {
    let cancelled = false;
    refreshUserProfile().then((u) => { if (!cancelled) setProfileFromServer(u ?? getUser()); });
    return () => { cancelled = true; };
  }, []);

  const handleLogout = async () => { await logout(); navigate("/"); };
  const isMentor = profileFromServer?.role === "mentor";
  const displayName = getDisplayName(profileFromServer) || "Thành viên";
  const userEmail = profileFromServer?.email || "";
  const userAvatar = avatarSrc(profileFromServer?.avatar);
  const hasAvatar = userAvatar && userAvatar !== DEFAULT_AVATAR;
  const initials = displayName.replace(/\([^)]*\)/g, "").trim().split(/\s+/).slice(-2).map((word) => word[0]).join("").toUpperCase();

  // Notification Preferences State:
  const defaults = isMentor ? DEFAULT_MENTOR_NOTIFS : DEFAULT_CUSTOMER_NOTIFS;
  const storageKey = notifStorageKey(isMentor ? "mentor" : "customer");
  const initialPrefs = () => {
    if (profileFromServer?.notificationPrefs) {
      return mergeNotifFromServer(defaults, profileFromServer.notificationPrefs, isMentor);
    }
    return mergeNotifPrefs(defaults, storageKey);
  };

  const [push, setPush] = useState(initialPrefs);
  const [baseline, setBaseline] = useState(initialPrefs);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const dirty = push.some((item, index) => item.value !== baseline[index]?.value);
  const allOn = push.every((t) => t.value);

  useEffect(() => {
    const defs = isMentor ? DEFAULT_MENTOR_NOTIFS : DEFAULT_CUSTOMER_NOTIFS;
    const next = profileFromServer?.notificationPrefs
      ? mergeNotifFromServer(defs, profileFromServer.notificationPrefs, isMentor)
      : mergeNotifPrefs(defs, storageKey);
    setPush((current) => current.some((item, index) => item.value !== baseline[index]?.value) ? current : next);
    setBaseline(next);
  }, [isMentor, profileFromServer?.notificationPrefs, storageKey]);

  const toggle = (id) => {
    setPush((prev) => prev.map((t) => (t.id === id ? { ...t, value: !t.value } : t)));
    setSaved(false);
    setError("");
  };

  const toggleAll = () => {
    const next = allOn ? false : true;
    setPush((prev) => prev.map((t) => ({ ...t, value: next })));
    setSaved(false);
    setError("");
  };

  const handleSave = async () => {
    if (!dirty || saving) return;
    setSaving(true);
    setError("");
    const prefMap = Object.fromEntries(push.map(({ id, value }) => [id, value]));
    const payload = isMentor
      ? { notificationPrefs: { mentor: prefMap } }
      : { notificationPrefs: { customer: prefMap } };
    const res = await updateUser(payload);
    setSaving(false);
    if (!res.success) {
      setError(res.error || "Không lưu được cài đặt. Hãy thử lại.");
      toastApiError(res.error, "Không lưu được cài đặt.");
      return;
    }
    try {
      localStorage.setItem(storageKey, JSON.stringify(push.map(({ id, value }) => ({ id, value }))));
    } catch { /* optional */ }
    setProfileFromServer(getUser());
    setBaseline(push);
    setSaved(true);
    toastApiSuccess("Đã lưu tùy chọn thông báo.");
  };

  const handleReset = () => {
    setPush(baseline);
    setSaved(false);
    setError("");
  };

  const handleTabKey = (event, index) => {
    const next = event.key === "Home" ? 0 : event.key === "End" ? TABS.length - 1
      : ["ArrowRight", "ArrowDown"].includes(event.key) ? (index + 1) % TABS.length
      : ["ArrowLeft", "ArrowUp"].includes(event.key) ? (index + TABS.length - 1) % TABS.length : null;
    if (next === null) return;
    event.preventDefault();
    setActiveTab(TABS[next].id);
    document.getElementById("settings-tab-" + TABS[next].id)?.focus();
  };

  return (
    <div className="settings-page">
      <div className={`${CUSTOMER_SHELL_GUTTER} pb-10 pt-6 sm:pt-8 settings-container`}>
        <div className={`${CUSTOMER_SHELL_MAX} settings-frame`}>
          {/* Header (Compact) */}
          <motion.header
            className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-5"
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, ease: "easeOut" }}
          >
            <div>
              <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight leading-tight">
                Cài đặt tài khoản
              </h1>
              <p className="text-xs text-slate-300 mt-0.5 font-medium">
                Quản lý thông báo, bảo mật mật khẩu và các thiết bị đăng nhập.
              </p>
            </div>

            {/* Compact Profile Card */}
            <Link
              to="/profile"
              className="group relative flex items-center gap-3 px-3.5 py-2 rounded-xl border border-white/15 bg-gradient-to-br from-[#1c183d]/80 via-[#14122e]/85 to-[#0e0c24]/90 backdrop-blur-xl shadow-[0_6px_24px_rgba(0,0,0,0.3)] hover:border-violet-400/50 hover:shadow-[0_10px_30px_rgba(124,58,237,0.22)] hover:-translate-y-0.5 transition-all duration-200 shrink-0 self-start sm:self-auto"
              aria-label="Chỉnh sửa hồ sơ"
              title={userEmail}
            >
              <div className="relative shrink-0">
                {hasAvatar ? (
                  <img
                    className="w-9 h-9 rounded-full object-cover ring-2 ring-violet-400/40 shadow-[0_0_10px_rgba(124,58,237,0.3)]"
                    src={userAvatar}
                    alt=""
                    onError={(event) => {
                      event.currentTarget.onerror = null;
                      event.currentTarget.src = DEFAULT_AVATAR;
                    }}
                  />
                ) : (
                  <span className="w-9 h-9 rounded-full grid place-items-center bg-gradient-to-br from-violet-600 to-indigo-700 text-white text-xs font-bold ring-2 ring-violet-400/40" aria-hidden="true">
                    {initials}
                  </span>
                )}
                <span className="absolute bottom-0 right-0 w-2 h-2 rounded-full bg-emerald-400 ring-1.5 ring-[#0e0c24]" />
              </div>

              <div className="min-w-0 pr-0.5">
                <p className="text-xs sm:text-sm font-bold text-white group-hover:text-violet-200 transition-colors truncate max-w-[160px] sm:max-w-[200px]">
                  {displayName}
                </p>
                <p className="text-[10px] text-slate-300/80 flex items-center gap-1 mt-0.5">
                  <span className="font-semibold text-violet-300">{isMentor ? "Mentor" : "Học viên"}</span>
                  <span>•</span>
                  <span className="group-hover:text-violet-200 transition-colors">Chỉnh sửa hồ sơ</span>
                </p>
              </div>

              <div className="p-1 rounded-lg bg-white/5 border border-white/10 text-slate-300 group-hover:text-white group-hover:bg-violet-600/30 group-hover:border-violet-400/40 transition-all ml-0.5">
                <ArrowUpRight size={13} aria-hidden="true" />
              </div>
            </Link>
          </motion.header>

          {/* Navigation & Action Dock Toolbar */}
          <motion.div
            className="flex flex-wrap items-center justify-between gap-3 mb-4"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: 0.08, ease: "easeOut" }}
          >
            {/* Apple-style Floating Glass Segmented Dock */}
            <div
              className="relative flex items-center p-1 rounded-xl border border-white/15 bg-gradient-to-b from-[#1c183d]/85 via-[#14122e]/90 to-[#0e0c24]/95 shadow-[0_8px_32px_rgba(5,3,20,0.5),inset_0_1px_1px_rgba(255,255,255,0.12)] backdrop-blur-2xl"
              role="tablist"
              aria-label="Cài đặt tài khoản"
            >
              {TABS.map((tab, index) => {
                const isSelected = activeTab === tab.id;
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    id={"settings-tab-" + tab.id}
                    type="button"
                    role="tab"
                    aria-selected={isSelected}
                    aria-controls={"settings-panel-" + tab.id}
                    tabIndex={isSelected ? 0 : -1}
                    onClick={() => setActiveTab(tab.id)}
                    onKeyDown={(event) => handleTabKey(event, index)}
                    className={`relative px-4 sm:px-5 py-1.5 sm:py-2 rounded-lg text-xs sm:text-sm font-semibold transition-all duration-200 flex items-center gap-2 select-none outline-none focus-visible:ring-2 focus-visible:ring-violet-400 ${
                      isSelected
                        ? "text-white font-bold"
                        : "text-slate-400 hover:text-slate-200 hover:bg-white/[0.04]"
                    }`}
                  >
                    {isSelected && (
                      <motion.div
                        layoutId="settings-active-tab-glow"
                        className="absolute inset-0 rounded-lg bg-gradient-to-r from-violet-600 via-indigo-600 to-purple-600 shadow-[0_0_16px_rgba(124,58,237,0.55)]"
                        transition={{ type: "spring", stiffness: 450, damping: 35 }}
                      />
                    )}
                    <span className="relative z-10 flex items-center gap-1.5">
                      <Icon size={15} strokeWidth={isSelected ? 2.2 : 1.8} className={isSelected ? "text-white" : "text-slate-400"} />
                      {tab.label}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Actions Area: Save Controls (on Notifications tab) + Logout */}
            <div className="flex items-center gap-2.5 ml-auto">
              {activeTab === "notifications" && (
                <>
                  {/* Toggle All button */}
                  <button
                    type="button"
                    onClick={toggleAll}
                    disabled={saving}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border border-white/15 bg-white/5 text-slate-300 hover:text-white hover:bg-white/10 hover:border-violet-400/30 transition-all active:scale-95 disabled:opacity-40"
                  >
                    {allOn ? "Tắt tất cả" : "Bật tất cả"}
                  </button>

                  {/* Status Indicator */}
                  {dirty ? (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-500/15 text-amber-300 border border-amber-500/30 text-xs font-semibold">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                      Chưa lưu
                    </span>
                  ) : saved ? (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 text-xs font-semibold">
                      <CheckCircle size={13} className="text-emerald-400" />
                      Đã lưu
                    </span>
                  ) : null}

                  {dirty && (
                    <button
                      type="button"
                      className="px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-400 hover:text-white transition-all"
                      disabled={saving}
                      onClick={handleReset}
                    >
                      Hủy
                    </button>
                  )}

                  {/* Save button */}
                  <button
                    type="button"
                    className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-violet-600 via-indigo-600 to-purple-600 shadow-[0_0_16px_rgba(124,58,237,0.4)] hover:shadow-[0_0_24px_rgba(124,58,237,0.65)] hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-40 disabled:pointer-events-none transition-all duration-200"
                    disabled={!dirty || saving}
                    onClick={handleSave}
                  >
                    {saving ? (
                      <>
                        <RefreshCw size={13} className="animate-spin" />
                        Đang lưu…
                      </>
                    ) : (
                      <>
                        <Sparkles size={13} />
                        Lưu thay đổi
                      </>
                    )}
                  </button>

                  <span className="h-4 w-px bg-white/15 mx-0.5 hidden sm:block" />
                </>
              )}

              {/* Logout button */}
              <button
                type="button"
                onClick={() => setShowLogoutConfirm(true)}
                aria-label="Đăng xuất"
                title="Đăng xuất khỏi tài khoản"
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold border border-rose-500/25 bg-rose-500/10 text-rose-300 hover:bg-rose-500/20 hover:border-rose-500/50 hover:text-rose-100 hover:shadow-[0_0_16px_rgba(244,63,94,0.35)] transition-all duration-200"
              >
                <LogOut size={14} strokeWidth={1.8} />
                <span>Đăng xuất</span>
              </button>
            </div>
          </motion.div>

          {/* Inline error if save fails */}
          {error && (
            <div className="mb-4 p-3 rounded-xl border border-rose-500/30 bg-rose-500/10 text-rose-300 text-xs font-medium flex items-center gap-2" role="alert">
              <AlertCircle size={15} className="shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Tab Content Panels */}
          <div className="settings-content">
            <div
              id="settings-panel-notifications"
              role="tabpanel"
              aria-labelledby="settings-tab-notifications"
              hidden={activeTab !== "notifications"}
            >
              {activeTab === "notifications" && (
                <NotificationsTab
                  key={isMentor ? "mentor" : "customer"}
                  isMentor={isMentor}
                  push={push}
                  toggle={toggle}
                  saving={saving}
                  userEmail={userEmail}
                />
              )}
            </div>
            <div
              id="settings-panel-security"
              role="tabpanel"
              aria-labelledby="settings-tab-security"
              hidden={activeTab !== "security"}
            >
              {activeTab === "security" && (
                <SecurityTab
                  profileFromServer={profileFromServer}
                  onProfileSynced={setProfileFromServer}
                />
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Main Account Logout Confirmation Modal */}
      <AnimatePresence>
        {showLogoutConfirm && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md"
            role="dialog"
            aria-modal="true"
            aria-labelledby="logout-modal-title"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.94, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.94, y: 10 }}
              transition={{ duration: 0.18, ease: "easeOut" }}
              className="relative w-full max-w-md rounded-2xl border border-white/15 bg-gradient-to-b from-[#1c183d] via-[#14122e] to-[#0e0c24] p-6 shadow-[0_20px_60px_rgba(0,0,0,0.8)]"
            >
              <div className="flex items-start gap-4">
                <div className="w-11 h-11 rounded-xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-center text-rose-400 shadow-[0_0_16px_rgba(244,63,94,0.3)] shrink-0">
                  <LogOut size={20} strokeWidth={2} />
                </div>
                <div className="min-w-0 flex-1">
                  <h3 id="logout-modal-title" className="text-base sm:text-lg font-bold text-white tracking-tight">
                    Xác nhận đăng xuất?
                  </h3>
                  <p className="text-xs sm:text-sm text-slate-300 mt-1.5 leading-relaxed">
                    Bạn có chắc chắn muốn đăng xuất khỏi tài khoản của mình không? Bạn sẽ cần đăng nhập lại để tiếp tục sử dụng.
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2.5 mt-6 pt-4 border-t border-white/[0.08]">
                <button
                  type="button"
                  className="px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold text-slate-300 hover:text-white hover:bg-white/10 transition-all border border-white/15"
                  onClick={() => setShowLogoutConfirm(false)}
                >
                  Hủy bỏ
                </button>
                <button
                  type="button"
                  className="inline-flex items-center gap-1.5 px-5 py-2 rounded-xl text-xs sm:text-sm font-bold text-white bg-gradient-to-r from-rose-600 to-red-600 shadow-[0_0_16px_rgba(244,63,94,0.4)] hover:shadow-[0_0_24px_rgba(244,63,94,0.65)] hover:-translate-y-0.5 active:translate-y-0 transition-all"
                  onClick={() => {
                    setShowLogoutConfirm(false);
                    handleLogout();
                  }}
                >
                  <LogOut size={14} />
                  <span>Xác nhận đăng xuất</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
