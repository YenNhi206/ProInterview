import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import { motion } from "motion/react";
import { Star, ExternalLink, ChevronLeft, ChevronRight, User, BookOpen } from "lucide-react";
import { AdminFilterSelect, AdminListFilterBar } from "../../components/admin/AdminListFilters.jsx";
import {
  AdminPageToolbar,
  adminGlassTable,
  adminHeaderRow,
  adminPageWrap,
  adminStatGrid3,
  adminTdCell,
  adminThCell,
} from "../../components/admin/AdminPageShell.jsx";
import { adminApi } from "../../api/adminApi.js";
import { tryApi } from "../../utils/shared/apiToast.js";

const TYPE_TABS = [
  { id: "all", label: "Tất cả" },
  { id: "mentor", label: "Cố vấn" },
  { id: "course", label: "Khóa học" },
];

const VISIBILITY_TABS = [
  { id: "all", label: "Mọi trạng thái" },
  { id: "visible", label: "Đang hiện" },
  { id: "hidden", label: "Đã ẩn" },
];

const TARGET_LABELS = { mentor: "Cố vấn", course: "Khóa học" };
const PAGE_SIZE = 50;

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

function Stars({ rating }) {
  const n = Math.min(5, Math.max(0, Number(rating) || 0));
  return (
    <span className="inline-flex items-center gap-0.5 text-amber-500" aria-label={`${n} sao`}>
      {Array.from({ length: 5 }, (_, i) => (
        <Star key={i} className={`h-3.5 w-3.5 ${i < n ? "fill-current" : "opacity-25"}`} />
      ))}
    </span>
  );
}

export function AdminReviews() {
  const [reviews, setReviews] = useState([]);
  const [counts, setCounts] = useState({ total: 0, mentor: 0, course: 0 });
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState("all");
  const [visibilityFilter, setVisibilityFilter] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [busyId, setBusyId] = useState("");
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: PAGE_SIZE,
    total: 0,
    totalPages: 1,
    hasMore: false,
  });

  const loadAll = useCallback(async () => {
    setLoading(true);
    const res = await tryApi(
      () =>
        adminApi.getReviews({
          page,
          limit: PAGE_SIZE,
          ...(typeFilter !== "all" ? { targetType: typeFilter } : {}),
          ...(visibilityFilter === "visible"
            ? { visible: "true" }
            : visibilityFilter === "hidden"
              ? { visible: "false" }
              : {}),
        }),
      { fallback: "Không tải được đánh giá." },
    );
    if (res.success) {
      setReviews(res.reviews || []);
      setCounts(res.counts || { total: 0, mentor: 0, course: 0 });
      setPagination(
        res.pagination || {
          page,
          limit: PAGE_SIZE,
          total: res.counts?.total ?? 0,
          totalPages: 1,
          hasMore: false,
        },
      );
    }
    setLoading(false);
  }, [typeFilter, visibilityFilter, page]);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  useEffect(() => {
    setPage(1);
  }, [typeFilter, visibilityFilter]);

  const filtered = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return reviews;
    return reviews.filter((r) => {
      const hay = [
        r.userName,
        r.userEmail,
        r.targetLabel,
        r.comment,
        TARGET_LABELS[r.targetType],
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [reviews, searchTerm]);

  const toggleVisibility = async (review) => {
    const id = review?._id;
    if (!id) return;
    const nextVisible = !review.isVisible;
    setBusyId(id);
    const res = await tryApi(() => adminApi.setReviewVisibility(id, nextVisible), {
      fallback: "Không cập nhật được trạng thái hiển thị.",
      successMessage: nextVisible ? "Đã hiện đánh giá" : "Đã ẩn đánh giá",
    });
    setBusyId("");
    if (!res.success) return;
    setReviews((prev) =>
      prev.map((r) => (String(r._id) === String(id) ? { ...r, isVisible: nextVisible } : r)),
    );
  };

  return (
    <div className={adminPageWrap}>
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className={adminHeaderRow}>
        <div className="min-w-0 flex-1">
          <h2 className="font-headline text-3xl font-black uppercase tracking-tighter text-slate-900">
            <span className="text-violet-700">Đánh giá</span>
          </h2>
        </div>
        <AdminPageToolbar
          loading={loading}
          onRefresh={() => void loadAll()}
          searchTerm={searchTerm}
          onSearchChange={setSearchTerm}
          searchPlaceholder="Tìm học viên, đối tượng, nội dung…"
        />
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className={adminStatGrid3}>
        <div className="glass-card flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.03] p-6 shadow-xl backdrop-blur-md transition-all hover:border-violet-500/30">
          <div>
            <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">Tổng đánh giá</p>
            <h3 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white">{counts.total ?? 0}</h3>
          </div>
          <div className="flex h-12 w-12 sm:h-14 sm:w-14 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.05] text-violet-400">
            <Star size={24} strokeWidth={2.2} />
          </div>
        </div>
        <div className="glass-card flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.03] p-6 shadow-xl backdrop-blur-md transition-all hover:border-violet-500/30">
          <div>
            <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">Cố vấn</p>
            <h3 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white">{counts.mentor ?? 0}</h3>
          </div>
          <div className="flex h-12 w-12 sm:h-14 sm:w-14 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.05] text-emerald-400">
            <User size={24} strokeWidth={2.2} />
          </div>
        </div>
        <div className="glass-card flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.03] p-6 shadow-xl backdrop-blur-md transition-all hover:border-violet-500/30">
          <div>
            <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">Khóa học</p>
            <h3 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white">{counts.course ?? 0}</h3>
          </div>
          <div className="flex h-12 w-12 sm:h-14 sm:w-14 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.05] text-sky-400">
            <BookOpen size={24} strokeWidth={2.2} />
          </div>
        </div>
      </motion.div>

      <AdminListFilterBar
        countText={
          searchTerm.trim()
            ? `Tìm trong trang: ${filtered.length} / ${reviews.length} · Tổng ${pagination.total ?? counts.total ?? 0}`
            : `Trang ${pagination.page}/${pagination.totalPages || 1} · ${reviews.length} mục · Tổng ${pagination.total ?? counts.total ?? 0}`
        }
        showReset={typeFilter !== "all" || visibilityFilter !== "all"}
        onReset={() => {
          setTypeFilter("all");
          setVisibilityFilter("all");
          setPage(1);
        }}
      >
        <AdminFilterSelect value={typeFilter} onChange={setTypeFilter} options={TYPE_TABS} />
        <AdminFilterSelect
          value={visibilityFilter}
          onChange={setVisibilityFilter}
          options={VISIBILITY_TABS}
        />
      </AdminListFilterBar>

      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className={adminGlassTable}>
        <div className="max-w-full overflow-x-auto overscroll-x-contain">
          <table className="w-full min-w-[720px] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/90">
                <th className={adminThCell}>Điểm</th>
                <th className={adminThCell}>Loại</th>
                <th className={adminThCell}>Đối tượng</th>
                <th className={adminThCell}>Học viên</th>
                <th className={adminThCell}>Nội dung</th>
                <th className={adminThCell}>Thời gian</th>
                <th className={adminThCell}>Hiển thị</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} className={`${adminTdCell} py-16 text-center text-slate-400`}>
                    <div className="flex flex-col items-center justify-center gap-3">
                      <div className="admin-orbital-loader" />
                      <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Đang tải đánh giá…</span>
                    </div>
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className={`${adminTdCell} py-16 text-center text-slate-400 italic`}>
                    Chưa có đánh giá nào phù hợp.
                  </td>
                </tr>
              ) : (
                filtered.map((r) => (
                  <tr
                    key={r._id}
                    className={`group transition-all duration-200 border-b border-white/[0.06] last:border-0 ${!r.isVisible ? "opacity-60" : ""}`}
                  >
                    <td className={adminTdCell}>
                      <Stars rating={r.rating} />
                    </td>
                    <td className={adminTdCell}>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        {TARGET_LABELS[r.targetType] || r.targetType}
                      </span>
                    </td>
                    <td className={adminTdCell}>
                      <p className="font-semibold text-white transition-colors duration-200 group-hover:text-violet-200">{r.targetLabel}</p>
                      {r.targetId ? (
                        <Link
                          to={
                            r.targetType === "mentor"
                              ? `/admin/mentors/${r.targetId}`
                              : `/courses/${r.targetId}?adminPreview=1`
                          }
                          className="mt-1 inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-violet-400 hover:text-violet-300"
                        >
                          Xem <ExternalLink className="h-3 w-3" />
                        </Link>
                      ) : null}
                    </td>
                    <td className={adminTdCell}>
                      <p className="font-semibold text-white">{r.userName || "—"}</p>
                      {r.userEmail ? (
                        <p className="text-xs text-slate-400">{r.userEmail}</p>
                      ) : null}
                    </td>
                    <td className={`${adminTdCell} max-w-xs`}>
                      <p className="line-clamp-2 text-slate-200">{r.comment || "—"}</p>
                      {r.hasReply ? (
                        <p className="mt-1 text-[10px] font-bold uppercase text-violet-400">Đã phản hồi</p>
                      ) : null}
                      {r.isVerified ? (
                        <p className="mt-1 text-[10px] font-bold uppercase text-emerald-400">Đã xác minh</p>
                      ) : null}
                    </td>
                    <td className={`${adminTdCell} text-slate-400`}>{formatDate(r.createdAt)}</td>
                    <td className={adminTdCell}>
                      <button
                        type="button"
                        data-button-surface="none"
                        disabled={busyId === r._id}
                        onClick={() => void toggleVisibility(r)}
                        className={`inline-flex items-center justify-center rounded-xl border px-3.5 py-1.5 text-[11px] font-extrabold uppercase tracking-wider transition-all disabled:opacity-50 ${r.isVisible
                          ? "border-amber-400/50 bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 hover:border-amber-400"
                          : "border-emerald-400/50 bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30 hover:border-emerald-400"
                          }`}
                      >
                        {busyId === r._id ? "…" : r.isVisible ? "Ẩn" : "Hiện"}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {(pagination.totalPages ?? 1) > 1 ? (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 px-4 py-3">
            <p className="text-xs font-medium text-slate-500">
              Trang {pagination.page} / {pagination.totalPages}
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={loading || page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-slate-700 disabled:opacity-40 hover:bg-slate-50"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
                Trước
              </button>
              <button
                type="button"
                disabled={loading || page >= (pagination.totalPages || 1)}
                onClick={() => setPage((p) => p + 1)}
                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-slate-700 disabled:opacity-40 hover:bg-slate-50"
              >
                Sau
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        ) : null}
      </motion.div>
    </div>
  );
}
