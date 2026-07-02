import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import { motion } from "motion/react";
import { Camera, ExternalLink, RefreshCw, Search, ShieldCheck, X } from "lucide-react";
import { adminGlassTable, adminPageWrap, AdminPageHeader } from "../../components/admin/AdminPageShell.jsx";
import { AdminListFilterBar } from "../../components/admin/AdminListFilters.jsx";
import { adminApi } from "../../api/adminApi.js";
import { tryApi } from "../../utils/shared/apiToast.js";
import { avatarSrc, resolveMediaUrl } from "../../utils/shared/mediaUrl.js";

function formatCheckInAt(value) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatWhen(date, timeSlot) {
  const d = String(date || "").trim();
  const t = String(timeSlot || "").trim();
  if (!d && !t) return "—";
  return t ? `${d} · ${t}` : d;
}

function mentorNameOf(b) {
  return b?.mentorId?.name || b?.mentorName || "—";
}

function studentNameOf(b) {
  return b?.userId?.name || b?.userId?.email || b?.customerName || "—";
}

export function AdminBookingCheckIns() {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [preview, setPreview] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await tryApi(() => adminApi.getBookings(), {
      fallback: "Không tải được danh sách lịch hẹn.",
      silent: true,
    });
    if (res.success) {
      const rows = (res.bookings || []).filter((b) => b?.mentorCheckInAt);
      setBookings(rows);
    } else {
      setBookings([]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return bookings;
    return bookings.filter((b) => {
      const hay = [
        mentorNameOf(b),
        studentNameOf(b),
        b?.paymentRef,
        b?.date,
        b?.timeSlot,
        String(b._id || ""),
      ]
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [bookings, search]);

  return (
    <div className={adminPageWrap}>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <AdminPageHeader
          kicker="Xác minh mentor"
          title="Ảnh check-in webcam"
          subtitle="Danh sách buổi mentor đã chụp ảnh qua webcam trước khi vào phòng họp. Dùng để đối chiếu danh tính."
        />
        <button
          type="button"
          onClick={() => void load()}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-black uppercase tracking-widest text-slate-700 hover:bg-slate-50 disabled:opacity-60"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          Làm mới
        </button>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-6 grid gap-3 sm:grid-cols-3"
      >
        <div className={`${adminGlassTable} p-4`}>
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Đã check-in</p>
          <p className="mt-1 text-2xl font-black text-emerald-800">{bookings.length}</p>
        </div>
        <div className={`${adminGlassTable} p-4 sm:col-span-2`}>
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Ghi chú</p>
          <p className="mt-1 text-sm text-slate-600">
            Ảnh lưu trên Cloudinary hoặc <span className="font-mono text-xs">/uploads</span> backend, metadata trên
            collection <span className="font-mono text-xs">bookings</span>.
          </p>
        </div>
      </motion.div>

      <AdminListFilterBar
        countText={`Hiển thị ${filtered.length} / ${bookings.length} buổi đã check-in`}
        showReset={Boolean(search.trim())}
        onReset={() => setSearch("")}
      >
        <label className="relative block min-w-[220px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Tìm mentor, học viên, mã PI…"
            className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-3 text-sm outline-none ring-violet-200 focus:ring-2"
          />
        </label>
      </AdminListFilterBar>

      {loading ? (
        <p className="py-16 text-center text-sm text-slate-500">Đang tải…</p>
      ) : filtered.length === 0 ? (
        <div className={`${adminGlassTable} py-16 text-center`}>
          <Camera className="mx-auto h-10 w-10 text-slate-300" />
          <p className="mt-3 text-sm font-semibold text-slate-600">Chưa có buổi nào check-in</p>
          <p className="mt-1 text-xs text-slate-500">
            Khi mentor vào phòng họp và chụp webcam, ảnh sẽ hiện tại đây.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((b) => {
            const id = b._id || b.id;
            const checkInUrl = resolveMediaUrl(b.mentorCheckInImageUrl);
            const profileUrl = avatarSrc(b.mentorId?.avatar, "");
            return (
              <motion.article
                key={String(id)}
                layout
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className={`${adminGlassTable} overflow-hidden`}
              >
                <button
                  type="button"
                  onClick={() => setPreview({ url: checkInUrl, booking: b })}
                  className="group relative block w-full bg-slate-900/5 text-left"
                >
                  {checkInUrl ? (
                    <img
                      src={checkInUrl}
                      alt={`Check-in ${mentorNameOf(b)}`}
                      className="aspect-[16/10] w-full object-cover transition group-hover:brightness-95"
                      loading="lazy"
                    />
                  ) : (
                    <div className="flex aspect-[16/10] items-center justify-center bg-slate-100 text-slate-400">
                      Không tải được ảnh
                    </div>
                  )}
                  <span className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50/95 px-2 py-1 text-[10px] font-black uppercase tracking-wider text-emerald-800">
                    <ShieldCheck className="h-3 w-3" />
                    Check-in
                  </span>
                </button>

                <div className="space-y-3 p-4">
                  <div>
                    <p className="text-sm font-bold text-slate-900">{mentorNameOf(b)}</p>
                    <p className="text-xs text-slate-500">Học viên: {studentNameOf(b)}</p>
                  </div>
                  <dl className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <dt className="font-bold uppercase tracking-wide text-slate-400">Buổi học</dt>
                      <dd className="mt-0.5 font-semibold text-slate-800">{formatWhen(b.date, b.timeSlot)}</dd>
                    </div>
                    <div>
                      <dt className="font-bold uppercase tracking-wide text-slate-400">Check-in lúc</dt>
                      <dd className="mt-0.5 font-semibold text-slate-800">{formatCheckInAt(b.mentorCheckInAt)}</dd>
                    </div>
                  </dl>

                  <div className="flex items-center gap-2">
                    {profileUrl ? (
                      <img src={profileUrl} alt="" className="h-9 w-9 rounded-lg border border-slate-200 object-cover" />
                    ) : null}
                    <p className="text-[11px] text-slate-500">So với avatar hồ sơ</p>
                  </div>

                  <div className="flex flex-wrap gap-2 pt-1">
                    <Link
                      to={`/admin/bookings/${id}`}
                      className="rounded-lg bg-[#a3e635] px-3 py-1.5 text-[10px] font-black uppercase tracking-widest text-slate-900 hover:bg-[#84cc16]"
                    >
                      Chi tiết buổi
                    </Link>
                    {checkInUrl ? (
                      <a
                        href={checkInUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-[10px] font-black uppercase tracking-widest text-slate-700 hover:bg-slate-50"
                      >
                        Mở ảnh
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    ) : null}
                  </div>
                </div>
              </motion.article>
            );
          })}
        </div>
      )}

      {preview?.url ? (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 p-4"
          role="dialog"
          aria-modal="true"
          onClick={() => setPreview(null)}
        >
          <div
            className="relative max-h-[90vh] w-full max-w-4xl overflow-hidden rounded-2xl bg-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setPreview(null)}
              className="absolute right-3 top-3 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-black/50 text-white hover:bg-black/70"
              aria-label="Đóng"
            >
              <X className="h-5 w-5" />
            </button>
            <img src={preview.url} alt="Ảnh check-in phóng to" className="max-h-[70vh] w-full object-contain bg-slate-900" />
            <div className="border-t border-slate-100 p-4 text-sm">
              <p className="font-bold text-slate-900">{mentorNameOf(preview.booking)}</p>
              <p className="text-slate-600">
                {formatWhen(preview.booking?.date, preview.booking?.timeSlot)} · Check-in{" "}
                {formatCheckInAt(preview.booking?.mentorCheckInAt)}
              </p>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
