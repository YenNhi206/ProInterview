import { useEffect, useState } from "react";
import { Link, useParams } from "react-router";
import { motion } from "motion/react";
import {
  Briefcase,
  Building2,
  ExternalLink,
  Mail,
  ShieldCheck,
  Star,
  Calendar,
  User,
  Lock,
  Unlock,
  TrendingUp,
  Check,
  X,
} from "lucide-react";
import {
  adminGlassTable,
  adminPageWrap,
  adminStatGrid4,
} from "../../components/admin/AdminPageShell.jsx";
import { adminApi } from "../../api/adminApi.js";
import { tryApi } from "../../utils/shared/apiToast.js";
import { avatarSrc } from "../../utils/shared/mediaUrl.js";
import { UserOnlineStatus } from "../../components/admin/UserOnlineStatus.jsx";

import { formatVnd } from "../../utils/shared/formatVnd.js";

function vnd(amount) {
  return formatVnd(amount);
}

function formatDate(iso) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("vi-VN", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "—";
  }
}

function InfoBlock({ icon: Icon, label, children }) {
  return (
    <div className="flex gap-3 rounded-xl border border-slate-100 bg-slate-50/80 p-4">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white text-violet-700 shadow-sm">
        <Icon className="h-5 w-5" aria-hidden />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">{label}</p>
        <div className="mt-1 text-sm font-medium text-slate-900">{children}</div>
      </div>
    </div>
  );
}

function StatusPill({ ok, labelOk, labelNo }) {
  return (
    <span
      className={`inline-flex rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-wider ${
        ok
          ? "border-lime-400/25 bg-lime-500/10 text-lime-900"
          : "border-orange-400/25 bg-orange-500/10 text-orange-900"
      }`}
    >
      {ok ? labelOk : labelNo}
    </span>
  );
}

export function AdminMentorDetail() {
  const { id } = useParams();
  const [mentor, setMentor] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [commissionBusy, setCommissionBusy] = useState(false);
  const [priceBusy, setPriceBusy] = useState(false);
  const [bookingFeePct, setBookingFeePct] = useState("");
  const [courseFeePct, setCourseFeePct] = useState("");

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true);
      setError(null);
      const res = await tryApi(() => adminApi.getMentorById(id), {
        fallback: "Không tải được cố vấn.",
        silent: true,
      });
      if (cancelled) return;
      if (!res.success) {
        setError(res.error || "Không tải được cố vấn.");
        setMentor(null);
      } else {
        setMentor(res.mentor || null);
        const b = Number(res.mentor?.pricing?.platformFeeRate);
        const c = Number(res.mentor?.pricing?.coursePlatformFeeRate);
        setBookingFeePct(Number.isFinite(b) && b > 0 ? String(Math.round(b * 1000) / 10) : "");
        setCourseFeePct(Number.isFinite(c) && c > 0 ? String(Math.round(c * 1000) / 10) : "");
        if (!res.mentor) setError("Không tìm thấy cố vấn.");
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  const displayName = mentor?.name || mentor?.userId?.name || "Cố vấn";
  const email = mentor?.userId?.email || "—";
  const expertise = (mentor?.expertise || mentor?.specialties || []).filter(Boolean);
  const rating = Number(mentor?.stats?.rating ?? mentor?.rating ?? 0);
  const reviewCount = Number(mentor?.stats?.reviewCount ?? 0);
  const sessions = Number(mentor?.stats?.sessionsCount ?? mentor?.totalSessions ?? 0);
  const publicPath = mentor?.publicId || mentor?._id;

  const toggleActive = async () => {
    if (!mentor) return;
    setBusy(true);
    const next = !mentor.isActive;
    const res = await tryApi(() => adminApi.updateMentorStatus(mentor._id, next), {
      fallback: "Không cập nhật được trạng thái.",
      successMessage: next ? "Đã kích hoạt cố vấn" : "Đã khóa cố vấn",
    });
    setBusy(false);
    if (res.success) {
      setMentor({ ...mentor, isActive: next, isVerified: next ? true : mentor.isVerified });
    }
  };

  const saveCommissionOverride = async () => {
    if (!mentor) return;
    const b = bookingFeePct.trim() === "" ? null : Number(bookingFeePct) / 100;
    const c = courseFeePct.trim() === "" ? null : Number(courseFeePct) / 100;
    if ((b != null && (!Number.isFinite(b) || b <= 0 || b > 1)) || (c != null && (!Number.isFinite(c) || c <= 0 || c > 1))) {
      return;
    }
    setCommissionBusy(true);
    const res = await tryApi(
      () =>
        adminApi.updateMentorCommission(mentor._id, {
          bookingPlatformFeeRate: b,
          coursePlatformFeeRate: c,
        }),
      {
        fallback: "Không cập nhật được mức phí riêng.",
        successMessage: "Đã lưu mức phí theo hợp đồng.",
      },
    );
    setCommissionBusy(false);
    if (res.success && res.mentor) {
      setMentor(res.mentor);
    }
  };

  const clearCommissionOverride = async () => {
    if (!mentor) return;
    setCommissionBusy(true);
    const res = await tryApi(
      () =>
        adminApi.updateMentorCommission(mentor._id, {
          bookingPlatformFeeRate: null,
          coursePlatformFeeRate: null,
        }),
      {
        fallback: "Không bỏ được override phí.",
        successMessage: "Đã bỏ override phí riêng.",
      },
    );
    setCommissionBusy(false);
    if (res.success && res.mentor) {
      setMentor(res.mentor);
      setBookingFeePct("");
      setCourseFeePct("");
    }
  };

  const approvePrice = async () => {
    if (!mentor) return;
    setPriceBusy(true);
    const res = await tryApi(() => adminApi.approveMentorPrice(mentor._id), {
      fallback: "Không duyệt được yêu cầu đổi giá.",
      successMessage: "Đã duyệt mức giá mới.",
    });
    setPriceBusy(false);
    if (res.success && res.mentor) setMentor(res.mentor);
  };

  const rejectPrice = async () => {
    if (!mentor) return;
    setPriceBusy(true);
    const res = await tryApi(() => adminApi.rejectMentorPrice(mentor._id), {
      fallback: "Không từ chối được yêu cầu đổi giá.",
      successMessage: "Đã từ chối yêu cầu đổi giá.",
    });
    setPriceBusy(false);
    if (res.success && res.mentor) setMentor(res.mentor);
  };

  return (
    <div className={adminPageWrap}>
      {loading && (
        <p className="text-sm text-slate-500">Đang tải hồ sơ cố vấn…</p>
      )}

      {error && !loading && (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-800">{error}</div>
      )}

      {mentor && !loading && (
        <>
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className={`${adminGlassTable} p-5 sm:p-6`}
          >
            <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
              <img
                src={avatarSrc(mentor.avatar || mentor.userId?.avatar)}
                alt=""
                className="h-24 w-24 shrink-0 rounded-2xl border-2 border-violet-100 object-cover shadow-md"
              />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <StatusPill ok={mentor.isVerified} labelOk="Đã duyệt" labelNo="Chưa duyệt" />
                  <StatusPill ok={mentor.isActive} labelOk="Đang hoạt động" labelNo="Đã khóa" />
                  <UserOnlineStatus
                    isOnline={Boolean(mentor.isOnline)}
                    lastSeenAt={mentor.lastSeenAt}
                    isActive={mentor.isActive !== false && mentor.userId?.isActive !== false}
                  />
                </div>
                <h3 className="mt-2 font-headline text-2xl font-black text-slate-900">{displayName}</h3>
                <p className="mt-0.5 text-sm font-medium text-violet-800">{mentor.title || "—"}</p>
                <p className="mt-1 flex items-center gap-1.5 text-sm text-slate-600">
                  <Mail className="h-4 w-4 shrink-0" />
                  {email}
                </p>
                {mentor.company ? (
                  <p className="mt-1 flex items-center gap-1.5 text-sm text-slate-600">
                    <Building2 className="h-4 w-4 shrink-0" />
                    {mentor.company}
                  </p>
                ) : null}
                {publicPath ? (
                  <Link
                    to={`/mentors/${publicPath}`}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-3 inline-flex items-center gap-1 text-sm font-bold text-violet-700 hover:underline"
                  >
                    Xem hồ sơ công khai
                    <ExternalLink className="h-3.5 w-3.5" />
                  </Link>
                ) : null}
              </div>
              <div className="flex shrink-0 flex-col gap-2 sm:items-end">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void toggleActive()}
                  className={`inline-flex items-center justify-center gap-2 rounded-lg border px-4 py-2.5 text-[10px] font-black uppercase tracking-wider disabled:opacity-50 ${
                    mentor.isActive
                      ? "border-amber-400/25 bg-amber-500/10 text-amber-900 hover:bg-amber-500/20"
                      : "border-lime-400/25 bg-lime-500/10 text-lime-900 hover:bg-lime-500/20"
                  }`}
                >
                  {mentor.isActive ? (
                    <>
                      <Lock className="h-4 w-4" />
                      Khóa cố vấn
                    </>
                  ) : (
                    <>
                      <Unlock className="h-4 w-4" />
                      Kích hoạt
                    </>
                  )}
                </button>
              </div>
            </div>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className={adminStatGrid4}>
            <div className="rounded-2xl border border-amber-200 bg-amber-50/80 p-4">
              <p className="text-[10px] font-black uppercase tracking-widest text-amber-900">Đánh giá</p>
              <p className="mt-1 flex items-center gap-1 text-2xl font-black text-amber-950">
                <Star className="h-6 w-6 fill-amber-400 text-amber-400" />
                {rating > 0 ? rating.toFixed(1) : "—"}
              </p>
              <p className="text-xs text-amber-800/80">{reviewCount} lượt đánh giá</p>
            </div>
            <div className="rounded-2xl border border-violet-200 bg-violet-50/80 p-4">
              <p className="text-[10px] font-black uppercase tracking-widest text-violet-900">Buổi mentor</p>
              <p className="mt-1 text-2xl font-black text-violet-950">{sessions}</p>
            </div>
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50/80 p-4">
              <p className="text-[10px] font-black uppercase tracking-widest text-emerald-900">Giá / giờ</p>
              <p className="mt-1 text-2xl font-black text-emerald-950">
                {vnd(mentor.pricePerHour || mentor.hourlyRate)}
              </p>
            </div>
            <div className="rounded-2xl border border-sky-200 bg-sky-50/80 p-4">
              <p className="text-[10px] font-black uppercase tracking-widest text-sky-900">Tham gia</p>
              <p className="mt-1 text-sm font-bold text-sky-950">{formatDate(mentor.createdAt)}</p>
            </div>
          </motion.div>

          <div className="grid gap-4 lg:grid-cols-2">
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className={`${adminGlassTable} p-5`}>
              <h4 className="mb-4 text-sm font-black uppercase tracking-wider text-slate-800">Hồ sơ chuyên môn</h4>
              <div className="space-y-3">
                <InfoBlock icon={Briefcase} label="Chuyên môn">
                  {expertise.length ? (
                    <div className="flex flex-wrap gap-1.5">
                      {expertise.map((tag) => (
                        <span
                          key={tag}
                          className="rounded-full border border-violet-100 bg-violet-50 px-2.5 py-0.5 text-xs font-semibold text-violet-900"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  ) : (
                    "—"
                  )}
                </InfoBlock>
                <InfoBlock icon={User} label="Mã công khai">
                  <code className="text-xs text-slate-600">{mentor.publicId || "—"}</code>
                </InfoBlock>
                <InfoBlock icon={ShieldCheck} label="Vai trò tài khoản">
                  {mentor.userId?.role || "mentor"}
                  {mentor.userId?.plan ? ` · Gói ${mentor.userId.plan}` : ""}
                </InfoBlock>
              </div>
            </motion.div>

            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className={`${adminGlassTable} p-5`}>
              <h4 className="mb-4 text-sm font-black uppercase tracking-wider text-slate-800">Giới thiệu</h4>
              {mentor.bio ? (
                <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-700">{mentor.bio}</p>
              ) : (
                <p className="text-sm text-slate-500">Mentor chưa điền phần giới thiệu.</p>
              )}
            </motion.div>
          </div>

          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className={`${adminGlassTable} p-5`}>
            <h4 className="mb-3 text-sm font-black uppercase tracking-wider text-slate-800">Phí mentor</h4>
            <p className="mb-4 text-xs text-slate-500">Nhập % theo hợp đồng. Để trống = phí tiêu chuẩn.</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="text-xs font-semibold text-slate-600">
                Booking (%)
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.1"
                  value={bookingFeePct}
                  onChange={(e) => setBookingFeePct(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-900"
                  placeholder="30"
                />
              </label>
              <label className="text-xs font-semibold text-slate-600">
                Khóa học (%)
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.1"
                  value={courseFeePct}
                  onChange={(e) => setCourseFeePct(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-900"
                  placeholder="35"
                />
              </label>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                disabled={commissionBusy}
                onClick={() => void saveCommissionOverride()}
                className="rounded-lg border border-violet-300 bg-violet-50 px-4 py-2 text-[11px] font-black uppercase tracking-wider text-violet-900 disabled:opacity-50"
              >
                Lưu
              </button>
              <button
                type="button"
                disabled={commissionBusy}
                onClick={() => void clearCommissionOverride()}
                className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-[11px] font-black uppercase tracking-wider text-slate-700 disabled:opacity-50"
              >
                Xóa
              </button>
            </div>
          </motion.div>

          {mentor.pendingPricePerHour ? (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-2xl border border-amber-200 bg-amber-50/80 p-5"
            >
              <h4 className="mb-1 flex items-center gap-2 text-sm font-black uppercase tracking-wider text-amber-900">
                <TrendingUp className="h-4 w-4" />
                Yêu cầu đổi giá
              </h4>
              <p className="mb-4 text-sm text-amber-900/90">
                Mentor đề xuất mức giá mới:{" "}
                <span className="font-black">{vnd(mentor.pendingPricePerHour)}</span>
                {" "}(hiện tại: {vnd(mentor.pricePerHour || mentor.hourlyRate)})
              </p>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={priceBusy}
                  onClick={() => void approvePrice()}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-lime-400/25 bg-lime-500/10 px-4 py-2 text-[11px] font-black uppercase tracking-wider text-lime-900 hover:bg-lime-500/20 disabled:opacity-50"
                >
                  <Check className="h-3.5 w-3.5" />
                  Duyệt
                </button>
                <button
                  type="button"
                  disabled={priceBusy}
                  onClick={() => void rejectPrice()}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-red-300 bg-red-50 px-4 py-2 text-[11px] font-black uppercase tracking-wider text-red-800 hover:bg-red-100 disabled:opacity-50"
                >
                  <X className="h-3.5 w-3.5" />
                  Từ chối
                </button>
              </div>
            </motion.div>
          ) : null}

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-wrap gap-3"
          >
            <Link
              to={`/admin/bookings`}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-[10px] font-black uppercase tracking-wider text-slate-700 hover:bg-slate-50"
            >
              <Calendar className="h-4 w-4" />
              Lịch hẹn hệ thống
            </Link>
            <Link
              to={`/admin/support`}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-[10px] font-black uppercase tracking-wider text-slate-700 hover:bg-slate-50"
            >
              Hỗ trợ & khiếu nại
            </Link>
          </motion.div>
        </>
      )}
    </div>
  );
}
