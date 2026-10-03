import { useState, useEffect } from "react";
import { useNavigate } from "react-router";
import { Smartphone, Laptop, LogOut, ShieldAlert, Key, ChevronDown, ChevronUp, AlertTriangle } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { toastApiError, toastApiSuccess, tryApi } from "../../utils/shared/apiToast.js";
import {
  fetchAuthSessions,
  revokeAuthSession,
  getCurrentAuthSessionId,
} from "../../utils/auth/auth.js";

function formatRelativeWhen(iso) {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "";
    const now = new Date();
    const time = d.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });
    const sameDay =
      d.getDate() === now.getDate() &&
      d.getMonth() === now.getMonth() &&
      d.getFullYear() === now.getFullYear();
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const isYesterday =
      d.getDate() === yesterday.getDate() &&
      d.getMonth() === yesterday.getMonth() &&
      d.getFullYear() === yesterday.getFullYear();

    if (sameDay) return `Hôm nay lúc ${time}`;
    if (isYesterday) return `Hôm qua lúc ${time}`;
    return d.toLocaleString("vi-VN", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

function deviceDisplayName(sess) {
  const ua = String(sess.userAgent || "");
  if (/iPhone|iPad/i.test(ua)) return "Apple";
  if (/Macintosh|Mac OS X/i.test(ua)) return "Máy Mac";
  if (/Android/i.test(ua) && /Mobile/i.test(ua)) return "Android";
  if (/Android/i.test(ua)) return "Android";
  if (/Windows/i.test(ua)) return "Windows";
  return sess.deviceLabel || "Thiết bị không xác định";
}

function isMobileDevice(sess) {
  const ua = String(sess.userAgent || "");
  return /iPhone|iPad|Android.*Mobile|Mobile/i.test(ua);
}

function sessionMetaLine(sess) {
  const when = formatRelativeWhen(sess.lastUsedAt || sess.createdAt);
  return when || "Chưa có thời gian hoạt động";
}

function SessionRow({ sess, isCurrent, suspicious, onRevoke, revoking, showChevron = true }) {
  const DeviceIcon = isMobileDevice(sess) ? Smartphone : Laptop;

  return (
    <div className="flex items-center justify-between gap-3 p-2.5 sm:p-3 rounded-xl border border-white/[0.07] bg-white/[0.02] hover:bg-white/[0.05] hover:border-violet-500/20 transition-all duration-150">
      <div className="flex items-center gap-2.5 min-w-0">
        <div
          className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
            isCurrent
              ? "bg-violet-500/20 border border-violet-400/35 text-violet-300 shadow-[0_0_10px_rgba(124,58,237,0.2)]"
              : "bg-white/5 border border-white/10 text-slate-400"
          }`}
          aria-hidden="true"
        >
          <DeviceIcon size={16} strokeWidth={1.8} />
        </div>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-1.5">
            <p className="text-xs sm:text-sm font-semibold text-white truncate">{deviceDisplayName(sess)}</p>
            {isCurrent && (
              <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                Thiết bị này
              </span>
            )}
            {suspicious && (
              <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-violet-500/15 text-violet-300 border border-violet-500/30">
                Đăng nhập lạ
              </span>
            )}
          </div>
          <p className="text-[11px] text-slate-400 mt-0.5 leading-none">{sessionMetaLine(sess)}</p>
        </div>
      </div>
      {(isCurrent || showChevron) && (
        <button
          type="button"
          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold border border-rose-500/25 bg-rose-500/10 text-rose-300 hover:bg-rose-500/20 hover:border-rose-500/40 hover:text-rose-100 transition-all disabled:opacity-40 shrink-0 ml-2"
          disabled={revoking}
          onClick={onRevoke}
          aria-label={isCurrent ? "Đăng xuất thiết bị này" : "Thu hồi phiên đăng nhập"}
        >
          <LogOut size={13} aria-hidden="true" />
          <span>{revoking ? "Đang xử lý…" : "Đăng xuất"}</span>
        </button>
      )}
    </div>
  );
}

export function LoginSessionsSection({ SectionCard }) {
  const navigate = useNavigate();
  const currentId = getCurrentAuthSessionId();
  const [sessions, setSessions] = useState([]);
  const [security, setSecurity] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [revokingId, setRevokingId] = useState("");
  const [showAllOthers, setShowAllOthers] = useState(false);
  const [confirmTarget, setConfirmTarget] = useState(null);

  const load = async () => {
    setLoading(true);
    setError("");
    const res = await tryApi(() => fetchAuthSessions(), {
      fallback: "Không tải được danh sách phiên.",
      silent: true,
    });
    if (!res.success) {
      const msg = res.error || "Không tải được danh sách phiên.";
      setError(msg);
      setSessions([]);
      setSecurity(null);
      toastApiError(msg);
    } else {
      setSessions(res.sessions || []);
      setSecurity(res.security || null);
    }
    setLoading(false);
  };

  useEffect(() => {
    void load();
  }, []);

  const handleConfirmRevoke = async () => {
    if (!confirmTarget) return;
    const { id, isCurrent } = confirmTarget;
    setRevokingId(id);
    setConfirmTarget(null);
    const res = await tryApi(() => revokeAuthSession(id), {
      fallback: "Không thu hồi được phiên.",
      successMessage: isCurrent ? "Đã đăng xuất." : "Đã thu hồi phiên đăng nhập.",
    });
    setRevokingId("");
    if (!res.success) return;
    if (isCurrent) {
      navigate("/");
      return;
    }
    await load();
  };

  const currentSession = sessions.find((s) => s.id === currentId || s.isCurrent);
  const otherSessions = sessions.filter((s) => s.id !== currentId && !s.isCurrent);

  return (
    <>
      <SectionCard title="Thiết bị đăng nhập" subtitle="Kiểm tra và đăng xuất thiết bị bạn không còn sử dụng." icon={Key}>
        {security?.hasSuspiciousLogin && (
          <div className="flex items-start gap-2.5 p-3 rounded-xl border border-violet-500/25 bg-violet-950/30 text-violet-200 mb-3" role="status">
            <ShieldAlert size={16} className="text-violet-400 shrink-0 mt-0.5" aria-hidden="true" />
            <div>
              <p className="text-xs font-semibold text-white">Có {security.suspiciousSessionCount} phiên đăng nhập từ thiết bị khác</p>
              <p className="text-[11px] text-slate-300 mt-0.5">Nếu không phải bạn, hãy bấm Đăng xuất thiết bị đó và đổi mật khẩu.</p>
            </div>
          </div>
        )}

        {loading && <p className="text-xs text-slate-400" role="status">Đang tải thiết bị…</p>}
        {error && !loading && (
          <div role="alert" className="space-y-1">
            <p className="settings-text-error text-xs">{error}</p>
            <button type="button" className="settings-text-action text-xs" onClick={load}>Thử lại</button>
          </div>
        )}

        {!loading && !error && sessions.length === 0 && (
          <p className="text-xs text-slate-400">Không có phiên đăng nhập nào.</p>
        )}

        {!loading && !error && sessions.length > 0 && (
          <div className="space-y-3">
            {/* Current Session */}
            {currentSession && (
              <div>
                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">Thiết bị hiện tại</p>
                <SessionRow
                  sess={currentSession}
                  isCurrent
                  suspicious={Boolean(currentSession.isSuspicious)}
                  revoking={revokingId === currentSession.id}
                  onRevoke={() => setConfirmTarget({ id: currentSession.id, label: deviceDisplayName(currentSession), isCurrent: true })}
                />
              </div>
            )}

            {/* Other Sessions (Collapsed to 3 by default) */}
            {otherSessions.length > 0 && (
              <div className="space-y-2 pt-1">
                <div className="flex items-center justify-between gap-2 pt-2 border-t border-white/[0.08]">
                  <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                    Thiết bị khác
                    <span className="text-[10px] font-semibold text-slate-500">({otherSessions.length})</span>
                  </p>
                  {otherSessions.length > 3 && (
                    <button
                      type="button"
                      onClick={() => setShowAllOthers(!showAllOthers)}
                      className="inline-flex items-center gap-1 text-xs font-semibold text-violet-400 hover:text-violet-300 transition-colors"
                    >
                      <span>{showAllOthers ? "Thu gọn" : `Xem tất cả (${otherSessions.length})`}</span>
                      {showAllOthers ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                    </button>
                  )}
                </div>

                <div className={`space-y-2 ${showAllOthers ? "max-h-[220px] overflow-y-auto pr-1" : ""}`}>
                  {(showAllOthers ? otherSessions : otherSessions.slice(0, 3)).map((sess) => (
                    <SessionRow
                      key={sess.id}
                      sess={sess}
                      isCurrent={false}
                      suspicious={Boolean(sess.isSuspicious)}
                      revoking={revokingId === sess.id}
                      onRevoke={() => setConfirmTarget({ id: sess.id, label: deviceDisplayName(sess), isCurrent: false })}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </SectionCard>

      {/* Luxury Dark Glass Confirmation Modal */}
      <AnimatePresence>
        {confirmTarget && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md"
            role="dialog"
            aria-modal="true"
            aria-labelledby="confirm-modal-title"
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
                  <h3 id="confirm-modal-title" className="text-base sm:text-lg font-bold text-white tracking-tight">
                    {confirmTarget.isCurrent ? "Đăng xuất thiết bị này?" : "Xác nhận đăng xuất thiết bị?"}
                  </h3>
                  <p className="text-xs sm:text-sm text-slate-300 mt-1.5 leading-relaxed">
                    {confirmTarget.isCurrent
                      ? "Bạn sẽ được đăng xuất khỏi tài khoản trên thiết bị này và cần đăng nhập lại để tiếp tục sử dụng."
                      : `Bạn có chắc chắn muốn thu hồi phiên đăng nhập trên thiết bị "${confirmTarget.label}" không?`}
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2.5 mt-6 pt-4 border-t border-white/[0.08]">
                <button
                  type="button"
                  className="px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold text-slate-300 hover:text-white hover:bg-white/10 transition-all border border-white/15"
                  onClick={() => setConfirmTarget(null)}
                >
                  Hủy bỏ
                </button>
                <button
                  type="button"
                  className="inline-flex items-center gap-1.5 px-5 py-2 rounded-xl text-xs sm:text-sm font-bold text-white bg-gradient-to-r from-rose-600 to-red-600 shadow-[0_0_16px_rgba(244,63,94,0.4)] hover:shadow-[0_0_24px_rgba(244,63,94,0.65)] hover:-translate-y-0.5 active:translate-y-0 transition-all"
                  onClick={handleConfirmRevoke}
                >
                  <LogOut size={14} />
                  <span>Xác nhận đăng xuất</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
