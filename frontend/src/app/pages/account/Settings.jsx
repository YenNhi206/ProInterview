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
  User,
  Sliders,
  Check,
  Lock,
  Smartphone,
  Mail,
  Zap,
  Camera,
} from "lucide-react";
import { toastApiError, toastApiSuccess } from "../../utils/shared/apiToast.js";
import { logout, getUser, getDisplayName, updateUser, refreshUserProfile, resendVerification } from "../../utils/auth/auth.js";
import { avatarSrc, DEFAULT_AVATAR } from "../../utils/shared/mediaUrl.js";
import { LoginSessionsSection } from "../../components/account/LoginSessionsSection";
import { AccountDangerZone } from "../../components/account/AccountDangerZone";
import { CUSTOMER_SHELL_GUTTER, CUSTOMER_SHELL_MAX } from "../../components/layout/customerShellLayout";
import { saveCameraConsent } from "../../api/interviewsApi.js";
import { hasCameraConsent } from "../../utils/interview/cameraConsent.js";
import "../../../styles/settings.css";
import "../../../styles/commerce-theme.css";

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
    return hit ? { ...d, value: Boolean(hit.value) } : d;
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

/* ─── Premium iOS Glass Toggle ───────────────────────────── */
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
      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 transition-all duration-200 ease-in-out focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-400 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0e0c22] ${
        enabled
          ? "border-violet-400/60 bg-gradient-to-r from-violet-600 via-indigo-600 to-fuchsia-600 shadow-[0_0_14px_rgba(124,58,237,0.5)]"
          : "border-white/15 bg-slate-800/80 hover:border-white/30"
      } ${disabled ? "opacity-40 cursor-not-allowed" : ""}`}
    >
      <span
        aria-hidden="true"
        className={`pointer-events-none inline-block h-4.5 w-4.5 transform rounded-full bg-white shadow-md ring-0 transition-transform duration-200 ease-in-out ${
          enabled
            ? "translate-x-5 shadow-[0_2px_6px_rgba(0,0,0,0.5)]"
            : "translate-x-0.5 bg-slate-200"
        }`}
      />
    </button>
  );
}

/* ─── Luxury Section Card Wrapper ────────────────────────── */
function SectionCard({ children, className = "", title, subtitle, icon: Icon, badge }) {
  return (
    <section className={`rounded-3xl border border-white/10 bg-gradient-to-b from-[#18133d]/85 via-[#130f32]/90 to-[#0e0a24]/95 shadow-[0_20px_50px_rgba(5,3,20,0.45)] backdrop-blur-2xl overflow-hidden p-5 sm:p-7 ${className}`}>
      {title && (
        <header className="flex items-center justify-between pb-4 mb-4 border-b border-white/[0.08]">
          <div className="flex items-center gap-3">
            {Icon && (
              <div className="size-9 rounded-xl bg-violet-500/15 border border-violet-400/25 flex items-center justify-center text-violet-300 shadow-[0_0_12px_rgba(124,58,237,0.18)] shrink-0">
                <Icon size={17} strokeWidth={2} aria-hidden="true" />
              </div>
            )}
            <div>
              <h3 className="text-sm sm:text-base font-bold text-white tracking-tight">{title}</h3>
              {subtitle && <p className="text-xs text-slate-300/80 mt-0.5 leading-snug">{subtitle}</p>}
            </div>
          </div>
          {badge && (
            <span className="text-[11px] font-bold text-violet-300 px-2.5 py-1 rounded-full bg-violet-500/15 border border-violet-400/30 shrink-0">
              {badge}
            </span>
          )}
        </header>
      )}
      <div className="settings-section-body">{children}</div>
    </section>
  );
}

/* ─── Notifications Tab (2-Column Grid) ───────────────────── */
const DEFAULT_CUSTOMER_NOTIFS = [
  { id: "booking_confirmed", label: "Xác nhận lịch hẹn", description: "Khi thanh toán được duyệt và lịch hẹn được xác nhận thành công.", value: true, icon: CalendarCheck },
  { id: "interview_reminder", label: "Nhắc trước buổi hẹn", description: "Nhắc qua email và thông báo trước phiên cố vấn khoảng 1 giờ.", value: true, icon: Clock },
  { id: "booking_cancelled", label: "Thay đổi hoặc hủy lịch", description: "Cập nhật đổi lịch, hủy lịch và thông tin hoàn tiền từ mentor.", value: true, icon: CalendarX },
  { id: "mentor_feedback", label: "Phản hồi từ mentor", description: "Nhận góp ý, đánh giá và nhận xét sau buổi phỏng vấn.", value: true, icon: UserCheck },
  { id: "streak_reminder", label: "Nhắc luyện tập AI", description: "Nhắc luyện phỏng vấn cùng Pio AI để duy trì mục tiêu tuần.", value: true, icon: Star },
  { id: "plan_expiring", label: "Gói sắp hết hạn", description: "Nhắc trước 7 ngày khi gói Pro hoặc Elite của bạn sắp hết hạn.", value: true, icon: CreditCard },
];

const DEFAULT_MENTOR_NOTIFS = [
  { id: "booking_request", label: "Buổi mentor đã thanh toán", description: "Thông báo khi học viên hoàn tất thanh toán đặt lịch.", value: true, icon: CalendarPlus },
  { id: "session_reminder", label: "Nhắc buổi mentor sắp tới", description: "Email và thông báo ứng dụng trước phiên cố vấn 1 giờ.", value: true, icon: Clock },
  { id: "mentee_review", label: "Đánh giá từ học viên", description: "Học viên gửi nhận xét và chấm điểm sau buổi học với bạn.", value: true, icon: Star },
  { id: "booking_change", label: "Đổi hoặc hủy lịch", description: "Học viên yêu cầu đổi lịch hoặc hủy phiên cố vấn.", value: true, icon: ArrowLeftRight },
  { id: "payout_update", label: "Cập nhật tài chính & thu nhập", description: "Thông báo thu nhập, quyết toán và chuyển khoản từ hệ thống.", value: true, icon: Wallet },
  { id: "peer_review_course", label: "Đánh giá chéo khóa học", description: "Có khóa học đồng nghiệp cần bạn thực hiện thẩm định.", value: true, icon: ClipboardCheck },
];

function NotificationsTab({ isMentor, push, toggle, saving, userEmail }) {
  const groupAppointments = {
    id: "appointments",
    title: "Lịch hẹn & Phiên cố vấn",
    icon: CalendarCheck,
    subtitle: "Thông báo về phiên cố vấn 1:1 & lịch phỏng vấn",
    items: push.slice(0, 4),
  };

  const groupAccount = {
    id: "account",
    title: isMentor ? "Tài chính & Khóa học" : "Luyện tập & Gói tài khoản",
    icon: isMentor ? Wallet : Star,
    subtitle: isMentor ? "Cập nhật doanh thu & hoạt động mentor" : "Nhắc luyện tập cùng Pio AI & gói dịch vụ",
    items: push.slice(4),
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
      {/* Column 1: Lịch hẹn (4 items) */}
      <section
        className="rounded-3xl border border-white/10 bg-gradient-to-b from-[#18133d]/85 via-[#130f32]/90 to-[#0e0a24]/95 shadow-[0_20px_50px_rgba(5,3,20,0.45)] backdrop-blur-2xl p-5 sm:p-7"
        aria-labelledby="settings-group-appointments"
      >
        <div className="flex items-center justify-between gap-3 pb-4 mb-4 border-b border-white/[0.08]">
          <div className="flex items-center gap-3">
            <div className="size-9 rounded-xl bg-violet-500/15 border border-violet-400/25 flex items-center justify-center text-violet-300 shadow-[0_0_12px_rgba(124,58,237,0.18)] shrink-0">
              <CalendarCheck size={17} strokeWidth={2} aria-hidden="true" />
            </div>
            <div>
              <h3 id="settings-group-appointments" className="text-sm sm:text-base font-bold text-white tracking-tight">
                {groupAppointments.title}
              </h3>
              <p className="text-xs text-slate-300/80 leading-snug">
                {groupAppointments.subtitle}
              </p>
            </div>
          </div>
          <span className="text-xs font-bold text-violet-300 px-3 py-1 rounded-full bg-violet-500/15 border border-violet-400/30">
            {groupAppointments.items.filter((i) => i.value).length}/{groupAppointments.items.length} bật
          </span>
        </div>

        <div className="space-y-3">
          {groupAppointments.items.map((item) => {
            const Icon = item.icon;
            return (
              <div
                key={item.id}
                className="flex items-center justify-between gap-3 p-3.5 sm:p-4 rounded-2xl border border-white/[0.08] bg-[#0c0822]/60 hover:bg-[#120d2e]/80 hover:border-violet-500/30 transition-all duration-200 group"
              >
                <div className="flex items-center gap-3.5 min-w-0 pr-2">
                  <div
                    className={`size-9 rounded-xl flex items-center justify-center shrink-0 transition-all duration-200 ${
                      item.value
                        ? "bg-violet-500/20 border border-violet-400/35 text-violet-300 shadow-[0_0_12px_rgba(124,58,237,0.25)]"
                        : "bg-white/5 border border-white/10 text-slate-500"
                    }`}
                  >
                    <Icon size={16} strokeWidth={2} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs sm:text-sm font-bold text-white group-hover:text-violet-200 transition-colors leading-tight" id={"pref-" + item.id}>
                      {item.label}
                    </p>
                    <p className="text-xs text-slate-400 mt-1 leading-relaxed" id={"pref-" + item.id + "-description"}>
                      {item.description}
                    </p>
                  </div>
                </div>
                <div className="shrink-0 pl-1">
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
      <div className="space-y-6">
        <section
          className="rounded-3xl border border-white/10 bg-gradient-to-b from-[#18133d]/85 via-[#130f32]/90 to-[#0e0a24]/95 shadow-[0_20px_50px_rgba(5,3,20,0.45)] backdrop-blur-2xl p-5 sm:p-7"
          aria-labelledby="settings-group-account"
        >
          <div className="flex items-center justify-between gap-3 pb-4 mb-4 border-b border-white/[0.08]">
            <div className="flex items-center gap-3">
              <div className="size-9 rounded-xl bg-violet-500/15 border border-violet-400/25 flex items-center justify-center text-violet-300 shadow-[0_0_12px_rgba(124,58,237,0.18)] shrink-0">
                <groupAccount.icon size={17} strokeWidth={2} aria-hidden="true" />
              </div>
              <div>
                <h3 id="settings-group-account" className="text-sm sm:text-base font-bold text-white tracking-tight">
                  {groupAccount.title}
                </h3>
                <p className="text-xs text-slate-300/80 leading-snug">
                  {groupAccount.subtitle}
                </p>
              </div>
            </div>
            <span className="text-xs font-bold text-violet-300 px-3 py-1 rounded-full bg-violet-500/15 border border-violet-400/30">
              {groupAccount.items.filter((i) => i.value).length}/{groupAccount.items.length} bật
            </span>
          </div>

          <div className="space-y-3">
            {groupAccount.items.map((item) => {
              const Icon = item.icon;
              return (
                <div
                  key={item.id}
                  className="flex items-center justify-between gap-3 p-3.5 sm:p-4 rounded-2xl border border-white/[0.08] bg-[#0c0822]/60 hover:bg-[#120d2e]/80 hover:border-violet-500/30 transition-all duration-200 group"
                >
                  <div className="flex items-center gap-3.5 min-w-0 pr-2">
                    <div
                      className={`size-9 rounded-xl flex items-center justify-center shrink-0 transition-all duration-200 ${
                        item.value
                          ? "bg-violet-500/20 border border-violet-400/35 text-violet-300 shadow-[0_0_12px_rgba(124,58,237,0.25)]"
                          : "bg-white/5 border border-white/10 text-slate-500"
                      }`}
                    >
                      <Icon size={16} strokeWidth={2} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs sm:text-sm font-bold text-white group-hover:text-violet-200 transition-colors leading-tight" id={"pref-" + item.id}>
                        {item.label}
                      </p>
                      <p className="text-xs text-slate-400 mt-1 leading-relaxed" id={"pref-" + item.id + "-description"}>
                        {item.description}
                      </p>
                    </div>
                  </div>
                  <div className="shrink-0 pl-1">
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

        {/* Sync & Channels Card */}
        <div className="p-4 sm:p-5 rounded-3xl border border-white/10 bg-gradient-to-r from-violet-950/30 via-[#130f30]/80 to-indigo-950/30 backdrop-blur-2xl flex items-center justify-between gap-4 shadow-lg">
          <div className="flex items-center gap-3.5 min-w-0">
            <div className="size-10 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0 shadow-[0_0_14px_rgba(16,185,129,0.2)]">
              <CheckCircle size={18} strokeWidth={2.2} />
            </div>
            <div className="min-w-0">
              <p className="text-xs sm:text-sm font-bold text-white truncate">Đồng bộ qua Email & Ứng dụng</p>
              <p className="text-xs text-slate-400 truncate mt-0.5">{userEmail || "Tự động gửi thông báo theo thời gian thực"}</p>
            </div>
          </div>
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 shrink-0">
            <span className="size-2 rounded-full bg-emerald-400 animate-pulse" />
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
        toastApiSuccess("Đã cập nhật mật khẩu thành công.");
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
        toastApiSuccess(result.message || "Đã gửi email xác minh. Vui lòng kiểm tra hộp thư của bạn.");
      } else {
        toastApiError(result?.error, "Không gửi được email xác minh.");
      }
    } catch { toastApiError("Lỗi kết nối khi gửi email xác minh."); }
    finally { setResendingVerify(false); }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
      {/* Column 1: Đổi mật khẩu + Email verification */}
      <div className="space-y-6">
        {needsEmailVerification && (
          <SectionCard
            title="Xác minh địa chỉ Email"
            subtitle="Xác minh email để bảo vệ tài khoản và nhận đầy đủ thông báo lịch hẹn."
            icon={UserCheck}
            className="border-amber-500/30 bg-gradient-to-b from-[#251b36]/80 via-[#1a142c]/80 to-[#120e24]/90"
          >
            <div className="flex flex-wrap items-center justify-between gap-3 p-4 rounded-2xl border border-amber-500/20 bg-amber-500/10">
              <div>
                <p className="text-xs sm:text-sm font-bold text-white">{sessionUser?.email}</p>
                <p className="text-xs text-amber-300/80 mt-1">Tài khoản chưa được kích hoạt xác thực email.</p>
              </div>
              <button
                type="button"
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-amber-200 border border-amber-500/35 border-t-amber-400/50 bg-gradient-to-b from-amber-500/25 via-amber-500/10 to-transparent shadow-[0_4px_16px_rgba(245,158,11,0.2),inset_0_1px_1px_rgba(255,255,255,0.2)] backdrop-blur-md hover:brightness-110 active:scale-95 transition-all cursor-pointer"
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
          subtitle="Mật khẩu cần ít nhất 6 ký tự để đảm bảo an toàn cho tài khoản của bạn."
          icon={KeyRound}
        >
          <form onSubmit={handleUpdatePassword} className="space-y-4">
            {needsCurrentPassword && (
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5" htmlFor="settings-current-password">
                  Mật khẩu hiện tại
                </label>
                <input
                  id="settings-current-password"
                  type="password"
                  autoComplete="current-password"
                  required={needsCurrentPassword}
                  disabled={saving}
                  className="w-full px-4 py-3 rounded-xl border border-white/12 bg-[#0b0820]/90 text-white text-sm placeholder-slate-500 focus:border-violet-400 focus:ring-2 focus:ring-violet-500/25 transition-all outline-none"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="Nhập mật khẩu hiện tại"
                />
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5" htmlFor="settings-new-password">
                  Mật khẩu mới
                </label>
                <input
                  id="settings-new-password"
                  type="password"
                  autoComplete="new-password"
                  required
                  minLength={MIN_PASS}
                  disabled={saving}
                  className="w-full px-4 py-3 rounded-xl border border-white/12 bg-[#0b0820]/90 text-white text-sm placeholder-slate-500 focus:border-violet-400 focus:ring-2 focus:ring-violet-500/25 transition-all outline-none"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Ít nhất 6 ký tự"
                />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5" htmlFor="settings-confirm-password">
                  Xác nhận mật khẩu mới
                </label>
                <input
                  id="settings-confirm-password"
                  type="password"
                  autoComplete="new-password"
                  required
                  minLength={MIN_PASS}
                  disabled={saving}
                  className="w-full px-4 py-3 rounded-xl border border-white/12 bg-[#0b0820]/90 text-white text-sm placeholder-slate-500 focus:border-violet-400 focus:ring-2 focus:ring-violet-500/25 transition-all outline-none"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Nhập lại mật khẩu mới"
                />
              </div>
            </div>

            <div className="pt-2">
              <button
                type="submit"
                className="inline-flex items-center gap-2 px-5 py-3 rounded-xl text-xs sm:text-sm font-bold text-white border border-white/25 border-t-white/45 bg-gradient-to-b from-white/[0.22] via-white/[0.10] to-transparent shadow-[0_6px_24px_rgba(0,0,0,0.5),inset_0_1px_1px_rgba(255,255,255,0.3)] backdrop-blur-xl hover:bg-white/[0.25] active:scale-95 transition-all cursor-pointer disabled:opacity-40"
                disabled={saving}
              >
                {saving ? "Đang lưu…" : "Cập nhật mật khẩu"}
              </button>
            </div>
          </form>
        </SectionCard>
      </div>

      {/* Column 2: Phiên đăng nhập & Đóng tài khoản */}
      <div className="space-y-6">
        <CameraConsentSection sessionUser={sessionUser} onProfileSynced={onProfileSynced} />
        <LoginSessionsSection SectionCard={SectionCard} />
        <AccountDangerZone SectionCard={SectionCard} />
      </div>
    </div>
  );
}

/* ─── Quyền riêng tư: consent camera phỏng vấn AI ─────────── */
function CameraConsentSection({ sessionUser, onProfileSynced }) {
  const [enabled, setEnabled] = useState(() => hasCameraConsent(sessionUser));
  const [saving, setSaving] = useState(false);

  useEffect(() => { setEnabled(hasCameraConsent(sessionUser)); }, [sessionUser]);

  // Tắt = rút consent (BE xoá acceptedAt); bật = cấp lại theo version hiện tại.
  const handleChange = async (next) => {
    if (saving) return;
    setSaving(true);
    const res = await saveCameraConsent(next);
    setSaving(false);
    if (!res.success) {
      toastApiError(res.error, "Không lưu được lựa chọn camera.");
      return;
    }
    setEnabled(hasCameraConsent(res.user));
    onProfileSynced?.({ ...(sessionUser ?? {}), ...res.user });
    toastApiSuccess(next ? "Đã cho phép phân tích qua camera." : "Đã tắt phân tích qua camera.");
  };

  return (
    <SectionCard title="Quyền riêng tư" subtitle="Camera trong phỏng vấn AI" icon={Camera}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <p id="settings-camera-consent-label" className="text-sm font-semibold text-white">
            Cho phép phân tích qua camera
          </p>
          <p id="settings-camera-consent-desc" className="mt-1 text-xs leading-relaxed text-slate-300/80">
            Phân tích giao tiếp bằng mắt, độ ổn định và biểu cảm. Không lưu video; mỗi câu gửi 1 ảnh tới Google Cloud
            Vision rồi bỏ, chỉ lưu chỉ số. Tắt thì phỏng vấn vẫn chạy nhưng không bật camera.
          </p>
        </div>
        <ToggleSwitch
          enabled={enabled}
          onChange={handleChange}
          disabled={saving}
          labelledBy="settings-camera-consent-label"
          describedBy="settings-camera-consent-desc"
        />
      </div>
    </SectionCard>
  );
}

/* ─── Main Component ─────────────────────────────────────── */
const TABS = [
  { id: "notifications", label: "Thông báo", icon: Bell },
  { id: "security",      label: "Bảo mật & Thiết bị",   icon: ShieldCheck },
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
    <div className="settings-page min-h-screen">
      <div className={`${CUSTOMER_SHELL_GUTTER} pb-24 pt-10 sm:pt-14 md:pt-16 settings-container`}>
        <div className={`${CUSTOMER_SHELL_MAX} settings-frame space-y-8`}>
          
          {/* Top Page Header with Apple/Linear Tab Switcher */}
          <motion.header
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
            className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/10 pb-6"
          >
            <div>
              <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black tracking-tight text-white flex items-center gap-3">
                Cài đặt tài khoản
                <span className="inline-flex items-center gap-1.5 text-xs font-bold text-violet-300 bg-violet-500/20 border border-violet-400/30 px-3 py-1 rounded-full">
                  <Sliders size={12} />
                  {isMentor ? "Mentor" : "Học viên"}
                </span>
              </h1>
              <p className="text-slate-300/80 text-xs sm:text-sm mt-1.5 font-medium leading-relaxed max-w-2xl">
                Quản lý các kênh thông báo, bảo mật mật khẩu, thiết bị đăng nhập và các tùy chọn bảo vệ tài khoản.
              </p>
            </div>

            {/* Account Suite Tab Switcher */}
            <div
              className="relative flex items-center p-1 sm:p-1.5 rounded-2xl border border-white/15 bg-gradient-to-b from-[#1c183d]/85 via-[#14122e]/90 to-[#0e0c24]/95 shadow-[0_8px_32px_rgba(5,3,20,0.5),inset_0_1px_1px_rgba(255,255,255,0.12)] backdrop-blur-2xl shrink-0 self-start sm:self-auto"
              role="tablist"
              aria-label="Điều hướng tài khoản"
            >
              <Link
                to="/profile"
                className="relative flex items-center justify-center gap-2 px-4 sm:px-5 py-2 sm:py-2.5 rounded-xl text-xs sm:text-sm font-semibold text-slate-400 hover:text-slate-200 hover:bg-white/[0.04] transition-all duration-200 select-none"
              >
                <User size={15} />
                <span>Hồ sơ cá nhân</span>
              </Link>
              <span
                className="relative flex items-center justify-center gap-2 px-4 sm:px-5 py-2 sm:py-2.5 rounded-xl text-xs sm:text-sm font-bold text-white bg-gradient-to-b from-white/[0.18] via-white/[0.08] to-transparent border border-white/20 border-t-white/35 shadow-[0_4px_16px_rgba(0,0,0,0.45),0_1px_2px_rgba(0,0,0,0.3),inset_0_1px_1px_rgba(255,255,255,0.25)] backdrop-blur-md select-none"
              >
                <ShieldCheck size={15} className="text-violet-200" />
                <span>Cài đặt & Bảo mật</span>
              </span>
            </div>
          </motion.header>

          {/* Navigation Dock Toolbar & Action Area */}
          <motion.div
            className="flex flex-wrap items-center justify-between gap-4"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: 0.08, ease: "easeOut" }}
          >
            {/* Apple-style Floating Glass Segmented Dock */}
            <div
              className="relative flex items-center p-1 sm:p-1.5 rounded-2xl border border-white/15 bg-gradient-to-b from-[#1c183d]/85 via-[#14122e]/90 to-[#0e0c24]/95 shadow-[0_8px_32px_rgba(5,3,20,0.5),inset_0_1px_1px_rgba(255,255,255,0.12)] backdrop-blur-2xl"
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
                    className={`relative px-4 sm:px-5 py-2 sm:py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-all duration-200 flex items-center gap-2 select-none outline-none cursor-pointer ${
                      isSelected
                        ? "text-white font-bold"
                        : "text-slate-400 hover:text-slate-200 hover:bg-white/[0.04]"
                    }`}
                  >
                    {isSelected && (
                      <motion.div
                        layoutId="settings-active-tab-glow"
                        className="absolute inset-0 rounded-xl bg-gradient-to-b from-white/[0.18] via-white/[0.08] to-transparent border border-white/20 border-t-white/35 shadow-[0_4px_16px_rgba(0,0,0,0.45),0_1px_2px_rgba(0,0,0,0.3),inset_0_1px_1px_rgba(255,255,255,0.25)] backdrop-blur-md"
                        transition={{ type: "spring", stiffness: 450, damping: 35 }}
                      />
                    )}
                    <span className="relative z-10 flex items-center gap-2">
                      <Icon size={16} strokeWidth={isSelected ? 2.2 : 1.8} className={isSelected ? "text-white" : "text-slate-400"} />
                      {tab.label}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Actions Area: Save Controls + Logout */}
            <div className="flex items-center gap-3 ml-auto">
              {activeTab === "notifications" && (
                <>
                  {/* Toggle All button */}
                  <button
                    type="button"
                    onClick={toggleAll}
                    disabled={saving}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold border border-white/20 border-t-white/35 bg-gradient-to-b from-white/[0.14] via-white/[0.06] to-transparent shadow-[0_4px_16px_rgba(0,0,0,0.4),inset_0_1px_1px_rgba(255,255,255,0.22)] backdrop-blur-md text-slate-100 hover:text-white hover:bg-white/[0.2] transition-all cursor-pointer disabled:opacity-40"
                  >
                    {allOn ? "Tắt tất cả" : "Bật tất cả"}
                  </button>

                  {/* Status Indicator */}
                  {dirty ? (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500/15 text-amber-300 border border-amber-500/30 text-xs font-bold">
                      <span className="size-2 rounded-full bg-amber-400 animate-pulse" />
                      Chưa lưu
                    </span>
                  ) : saved ? (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 text-xs font-bold">
                      <CheckCircle size={14} className="text-emerald-400" />
                      Đã lưu
                    </span>
                  ) : null}

                  {dirty && (
                    <button
                      type="button"
                      className="px-3.5 py-2 rounded-xl text-xs font-bold text-slate-400 hover:text-white transition-all cursor-pointer"
                      disabled={saving}
                      onClick={handleReset}
                    >
                      Hủy
                    </button>
                  )}

                  {/* Save button */}
                  <button
                    type="button"
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs sm:text-sm font-bold text-white border border-white/25 border-t-white/50 bg-gradient-to-b from-white/[0.22] via-white/[0.10] to-transparent shadow-[0_6px_24px_rgba(0,0,0,0.5),inset_0_1px_1px_rgba(255,255,255,0.3)] backdrop-blur-xl hover:bg-white/[0.25] active:scale-95 disabled:opacity-40 disabled:pointer-events-none transition-all cursor-pointer"
                    disabled={!dirty || saving}
                    onClick={handleSave}
                  >
                    {saving ? (
                      <>
                        <RefreshCw size={14} className="animate-spin" />
                        Đang lưu…
                      </>
                    ) : (
                      <>
                        <Sparkles size={14} />
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
                className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl text-xs font-bold border border-rose-500/35 border-t-rose-400/50 bg-gradient-to-b from-rose-500/20 via-rose-500/10 to-transparent shadow-[0_4px_16px_rgba(244,63,94,0.2),inset_0_1px_1px_rgba(255,255,255,0.2)] text-rose-200 hover:text-white hover:bg-rose-500/30 backdrop-blur-md transition-all cursor-pointer"
              >
                <LogOut size={14} strokeWidth={2} />
                <span>Đăng xuất</span>
              </button>
            </div>
          </motion.div>

          {/* Inline error if save fails */}
          {error && (
            <div className="p-4 rounded-2xl border border-rose-500/30 bg-rose-500/10 text-rose-300 text-xs font-medium flex items-center gap-2.5" role="alert">
              <AlertCircle size={16} className="shrink-0" />
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
              exit={{ opacity: 0, scale: 0.94 }}
              transition={{ duration: 0.18, ease: "easeOut" }}
              className="relative w-full max-w-md rounded-3xl border border-white/15 bg-gradient-to-b from-[#1c183d] via-[#14122e] to-[#0e0c24] p-6 sm:p-7 shadow-[0_20px_60px_rgba(0,0,0,0.8)]"
            >
              <div className="flex items-start gap-4">
                <div className="size-11 rounded-2xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-center text-rose-400 shadow-[0_0_16px_rgba(244,63,94,0.3)] shrink-0">
                  <LogOut size={20} strokeWidth={2} />
                </div>
                <div className="min-w-0 flex-1">
                  <h3 id="logout-modal-title" className="text-base sm:text-lg font-bold text-white tracking-tight">
                    Xác nhận đăng xuất?
                  </h3>
                  <p className="text-xs sm:text-sm text-slate-300 mt-1.5 leading-relaxed">
                    Bạn có chắc chắn muốn đăng xuất khỏi tài khoản của mình không? Bạn sẽ cần đăng nhập lại để tiếp tục sử dụng dịch vụ.
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 mt-6 pt-4 border-t border-white/[0.08]">
                <button
                  type="button"
                  className="px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold text-slate-300 hover:text-white hover:bg-white/10 transition-all border border-white/15 cursor-pointer"
                  onClick={() => setShowLogoutConfirm(false)}
                >
                  Hủy bỏ
                </button>
                <button
                  type="button"
                  className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-xs sm:text-sm font-bold text-white border border-rose-500/40 border-t-rose-400/60 bg-gradient-to-b from-rose-500/90 via-rose-600/80 to-rose-700 shadow-[0_6px_24px_rgba(244,63,94,0.5),inset_0_1px_1px_rgba(255,255,255,0.3)] backdrop-blur-xl hover:brightness-110 active:scale-95 transition-all cursor-pointer"
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
