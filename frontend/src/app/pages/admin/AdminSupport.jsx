import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import { motion } from "motion/react";
import { ExternalLink, ChevronLeft, ChevronRight, MessageSquare, AlertCircle, Clock } from "lucide-react";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../../components/ui/dialog";
import { adminApi } from "../../api/adminApi.js";
import { tryApi } from "../../utils/shared/apiToast.js";

const STATUS_TABS = [
  { id: "open", label: "Cần xử lý" },
  { id: "all", label: "Tất cả" },
  { id: "closed", label: "Đã đóng" },
];

const TYPE_TABS = [
  { id: "all", label: "Tất cả" },
  { id: "mentor", label: "Cố vấn" },
  { id: "booking", label: "Buổi hẹn" },
  { id: "course", label: "Khóa học" },
  { id: "review", label: "Đánh giá" },
];

const REASON_LABELS = {
  late: "Trễ hẹn",
  unprofessional: "Thiếu chuyên nghiệp",
  inappropriate: "Không phù hợp",
  no_show: "Không tham gia",
  fraud: "Gian lận",
  other: "Khác",
};

const TARGET_LABELS = {
  mentor: "Cố vấn",
  booking: "Buổi hẹn",
  course: "Khóa học",
  review: "Đánh giá",
};

const STATUS_LABELS = {
  pending: "Chờ xử lý",
  reviewing: "Đang xử lý",
  resolved: "Đã xử lý",
  dismissed: "Đã bác bỏ",
};

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

function parseReportDescription(description = "") {
  let text = String(description || "").trim();
  const isSeed = /^\[Seed report\]/i.test(text);
  if (isSeed) text = text.replace(/^\[Seed report\]\s*/i, "").trim();

  let title = "";
  let body = text;
  const titleBlock = text.match(/^Tiêu đề:\s*(.+?)(?:\n\n|\n|$)/s);
  if (titleBlock) {
    title = titleBlock[1].trim();
    body = text.slice(titleBlock[0].length).trim();
  }

  const bookingNote = body.match(/\(Booking liên quan:\s*([a-f\d]{24})\)/i);
  if (bookingNote) body = body.replace(bookingNote[0], "").trim();

  return { title, body, isSeed, bookingId: bookingNote?.[1] || "" };
}

function statusBadgeClass(status) {
  if (status === "resolved") {
    return "admin-shimmer-badge border border-emerald-500/40 bg-emerald-500/20 text-emerald-300 shadow-[0_0_12px_rgba(16,185,129,0.2)]";
  }
  if (status === "dismissed") {
    return "admin-shimmer-badge border border-white/10 bg-white/5 text-slate-400";
  }
  if (status === "reviewing") {
    return "admin-shimmer-badge border border-sky-500/40 bg-sky-500/20 text-sky-300 shadow-[0_0_12px_rgba(56,189,248,0.2)]";
  }
  return "admin-shimmer-badge border border-amber-500/40 bg-amber-500/20 text-amber-300 shadow-[0_0_12px_rgba(245,158,11,0.2)]";
}

/** Nút hành động, màu sắc tương phản cao, nổi bật, dễ nhìn trên nền tối. */
const actionBtn = {
  amber:
    "inline-flex items-center justify-center rounded-xl border border-amber-400/50 bg-amber-500/20 px-3.5 py-1.5 text-[11px] font-extrabold uppercase tracking-wider text-amber-300 transition-all hover:bg-amber-500/35 hover:border-amber-400 hover:text-amber-100 hover:shadow-[0_0_14px_rgba(245,158,11,0.35)] disabled:opacity-50",
  lime:
    "inline-flex items-center justify-center rounded-xl border border-emerald-400/50 bg-emerald-500/20 px-3.5 py-1.5 text-[11px] font-extrabold uppercase tracking-wider text-emerald-300 transition-all hover:bg-emerald-500/35 hover:border-emerald-400 hover:text-emerald-100 hover:shadow-[0_0_14px_rgba(16,185,129,0.35)] disabled:opacity-50",
  slate:
    "inline-flex items-center justify-center rounded-xl border border-white/15 bg-white/[0.06] px-3.5 py-1.5 text-[11px] font-extrabold uppercase tracking-wider text-slate-200 transition-all hover:border-white/30 hover:bg-white/12 hover:text-white disabled:opacity-50",
};

function targetLink(rep) {
  if (!rep?.targetId) return null;
  if (rep.targetType === "mentor") return `/admin/mentors/${rep.targetId}`;
  if (rep.targetType === "booking") return `/admin/bookings/${rep.targetId}`;
  if (rep.targetType === "course") return `/courses/${rep.targetId}?adminPreview=1`;
  return null;
}

function reportApiParams(page, statusFilter, typeFilter) {
  const params = {
    page,
    limit: PAGE_SIZE,
    ...(typeFilter !== "all" ? { targetType: typeFilter } : {}),
  };
  if (statusFilter === "open") params.open = true;
  else if (statusFilter === "closed") params.closed = true;
  else if (statusFilter !== "all") params.status = statusFilter;
  return params;
}

export function AdminSupport() {
  const [reports, setReports] = useState([]);
  const [counts, setCounts] = useState({ total: 0, open: 0, pending: 0 });
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("open");
  const [typeFilter, setTypeFilter] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [page, setPage] = useState(1);
  const [busyId, setBusyId] = useState("");
  const [pagination, setPagination] = useState({
    page: 1,
    limit: PAGE_SIZE,
    total: 0,
    totalPages: 1,
  });
  const [resolveDialog, setResolveDialog] = useState(null);
  const [resolutionNote, setResolutionNote] = useState("");

  const loadReports = useCallback(async () => {
    setLoading(true);
    const res = await tryApi(() => adminApi.getReports(reportApiParams(page, statusFilter, typeFilter)), {
      fallback: "Không tải được danh sách báo cáo.",
    });
    if (res.success) {
      setReports(res.reports || []);
      setCounts(res.counts || { total: 0, open: 0, pending: 0 });
      setPagination(
        res.pagination || {
          page,
          limit: PAGE_SIZE,
          total: res.counts?.total ?? 0,
          totalPages: 1,
        },
      );
    }
    setLoading(false);
  }, [page, statusFilter, typeFilter]);

  useEffect(() => {
    void loadReports();
  }, [loadReports]);

  useEffect(() => {
    setPage(1);
  }, [statusFilter, typeFilter]);

  const filtered = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return reports;
    return reports.filter((r) => {
      const parsed = parseReportDescription(r.description);
      const hay = [
        parsed.title,
        parsed.body,
        r.targetLabel,
        r.reportedBy?.name,
        r.reportedBy?.email,
        REASON_LABELS[r.reason],
        TARGET_LABELS[r.targetType],
        STATUS_LABELS[r.status],
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [reports, searchTerm]);

  const applyStatus = async (reportId, status, resolution = "") => {
    setBusyId(reportId);
    const res = await tryApi(() => adminApi.updateReportStatus(reportId, { status, resolution }), {
      fallback: "Không cập nhật được báo cáo.",
      successMessage:
        status === "resolved"
          ? "Đã xử lý báo cáo"
          : status === "dismissed"
            ? "Đã bác bỏ báo cáo"
            : "Đã cập nhật",
    });
    setBusyId("");
    if (!res.success) return;
    void loadReports();
  };

  const openResolveDialog = (rep, status) => {
    setResolutionNote(rep.resolution || "");
    setResolveDialog({ id: rep._id, status });
  };

  const confirmResolveDialog = async () => {
    if (!resolveDialog?.id) return;
    await applyStatus(resolveDialog.id, resolveDialog.status, resolutionNote.trim());
    setResolveDialog(null);
    setResolutionNote("");
  };

  return (
    <div className={adminPageWrap}>
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className={adminHeaderRow}>
        <div className="min-w-0 flex-1">
          <h2 className="font-headline text-3xl font-black uppercase tracking-tighter text-white [html[data-workspace-theme=light]_&]:text-slate-900">
            <span className="admin-title-accent text-[#93f72b] [html[data-workspace-theme=light]_&]:text-[#6d28d9]">Hỗ trợ</span> & khiếu nại
          </h2>
        </div>
        <AdminPageToolbar
          loading={loading}
          onRefresh={() => void loadReports()}
          searchTerm={searchTerm}
          onSearchChange={setSearchTerm}
          searchPlaceholder="Tìm người gửi, đối tượng, nội dung…"
        />
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className={adminStatGrid3}>
        <div className="glass-card flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.03] p-6 shadow-xl backdrop-blur-md transition-all hover:border-violet-500/30">
          <div>
            <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">Tổng báo cáo</p>
            <h3 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white">{counts.total ?? 0}</h3>
          </div>
          <div className="flex h-12 w-12 sm:h-14 sm:w-14 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.05] text-violet-400">
            <MessageSquare size={24} strokeWidth={2.2} />
          </div>
        </div>
        <div className="glass-card flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.03] p-6 shadow-xl backdrop-blur-md transition-all hover:border-violet-500/30">
          <div>
            <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">Đang mở</p>
            <h3 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white">{counts.open ?? 0}</h3>
          </div>
          <div className="flex h-12 w-12 sm:h-14 sm:w-14 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.05] text-amber-400">
            <AlertCircle size={24} strokeWidth={2.2} />
          </div>
        </div>
        <div className="glass-card flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.03] p-6 shadow-xl backdrop-blur-md transition-all hover:border-violet-500/30">
          <div>
            <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">Chờ xử lý</p>
            <h3 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white">{counts.pending ?? 0}</h3>
          </div>
          <div className="flex h-12 w-12 sm:h-14 sm:w-14 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.05] text-orange-400">
            <Clock size={24} strokeWidth={2.2} />
          </div>
        </div>
      </motion.div>

      <AdminListFilterBar
        countText={
          searchTerm.trim()
            ? `Tìm trong trang: ${filtered.length} / ${reports.length} · Tổng ${pagination.total ?? counts.total ?? 0}`
            : `Trang ${pagination.page}/${pagination.totalPages || 1} · ${reports.length} mục · Tổng ${pagination.total ?? counts.total ?? 0}`
        }
        showReset={statusFilter !== "open" || typeFilter !== "all"}
        onReset={() => {
          setStatusFilter("open");
          setTypeFilter("all");
          setPage(1);
        }}
      >
        <AdminFilterSelect
          id="support-status"
          label="Trạng thái"
          value={statusFilter}
          onChange={setStatusFilter}
          options={STATUS_TABS}
        />
        <AdminFilterSelect
          id="support-type"
          label="Đối tượng"
          value={typeFilter}
          onChange={setTypeFilter}
          options={TYPE_TABS}
        />
      </AdminListFilterBar>

      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className={adminGlassTable}>
        <div className="max-w-full overflow-x-auto overscroll-x-contain">
          <table className="w-full min-w-[960px] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/90">
                <th className={adminThCell}>Trạng thái</th>
                <th className={adminThCell}>Vấn đề</th>
                <th className={adminThCell}>Đối tượng</th>
                <th className={adminThCell}>Người gửi</th>
                <th className={adminThCell}>Nội dung</th>
                <th className={adminThCell}>Thời gian</th>
                <th className={adminThCell}>Hành động</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-16 text-center">
                    <div className="flex flex-col items-center justify-center gap-3">
                      <div className="admin-orbital-loader" />
                      <p className="text-[11px] font-bold uppercase tracking-widest text-violet-300">Đang tải dữ liệu…</p>
                    </div>
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className={`${adminTdCell} text-center text-slate-500`}>
                    —
                  </td>
                </tr>
              ) : (
                filtered.map((rep) => {
                  const parsed = parseReportDescription(rep.description);
                  const preview = parsed.title
                    ? `${parsed.title}, ${parsed.body}`
                    : parsed.body;
                  const link = targetLink(rep);
                  const busy = busyId === rep._id;
                  const isPending = rep.status === "pending";
                  const isReviewing = rep.status === "reviewing";

                  return (
                    <tr
                      key={rep._id}
                      className="border-b border-white/5 last:border-0 hover:bg-white/[0.03] transition-colors"
                    >
                      <td className={adminTdCell}>
                        <span
                          className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-extrabold uppercase tracking-wider ${statusBadgeClass(rep.status)}`}
                        >
                          {rep.status === "pending" ? (
                            <span className="relative flex h-2 w-2">
                              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-75" />
                              <span className="relative inline-flex h-2 w-2 rounded-full bg-amber-400 shadow-[0_0_8px_#fbbf24]" />
                            </span>
                          ) : rep.status === "reviewing" ? (
                            <span className="relative flex h-2 w-2">
                              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-sky-400 opacity-75" />
                              <span className="relative inline-flex h-2 w-2 rounded-full bg-sky-400 shadow-[0_0_8px_#38bdf8]" />
                            </span>
                          ) : null}
                          {STATUS_LABELS[rep.status] || rep.status}
                        </span>
                      </td>
                      <td className={adminTdCell}>
                        <span className="text-xs font-bold uppercase tracking-wider text-slate-200">
                          {REASON_LABELS[rep.reason] || rep.reason}
                        </span>
                      </td>
                      <td className={adminTdCell}>
                        <p className="font-bold text-white">
                          {TARGET_LABELS[rep.targetType] || rep.targetType}
                        </p>
                        <p className="text-xs text-slate-400">{rep.targetLabel || "—"}</p>
                        {link ? (
                          <Link
                            to={link}
                            className="mt-1 inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider text-[#93f72b] [html[data-workspace-theme=light]_&]:text-[#6d28d9] hover:underline transition-colors"
                          >
                            Xem <ExternalLink className="h-3 w-3" />
                          </Link>
                        ) : null}
                      </td>
                      <td className={adminTdCell}>
                        <p className="font-bold text-white">{rep.reportedBy?.name || "—"}</p>
                        {rep.reportedBy?.email ? (
                          <p className="text-xs text-slate-400">{rep.reportedBy.email}</p>
                        ) : null}
                      </td>
                      <td className={`${adminTdCell} max-w-xs`}>
                        {parsed.isSeed ? (
                          <p className="mb-1 text-[10px] font-bold uppercase text-slate-400">Demo seed</p>
                        ) : null}
                        <p className="line-clamp-2 text-sm text-slate-300">{preview || "—"}</p>
                        {rep.resolution ? (
                          <p className="mt-1 line-clamp-1 text-xs font-semibold text-emerald-400">
                            Đã xử lý: {rep.resolution}
                          </p>
                        ) : null}
                      </td>
                      <td className={`${adminTdCell} text-slate-400`}>{formatDate(rep.createdAt)}</td>
                      <td className={adminTdCell}>
                        {isPending ? (
                          <div className="flex flex-col gap-2">
                            <button
                              type="button"
                              data-button-surface="none"
                              disabled={busy}
                              onClick={() => void applyStatus(rep._id, "reviewing")}
                              className={actionBtn.amber}
                            >
                              Nhận xử lý
                            </button>
                            <button
                              type="button"
                              data-button-surface="none"
                              disabled={busy}
                              onClick={() => openResolveDialog(rep, "dismissed")}
                              className={actionBtn.slate}
                            >
                              Bác bỏ
                            </button>
                          </div>
                        ) : isReviewing ? (
                          <div className="flex flex-col gap-2">
                            <button
                              type="button"
                              data-button-surface="none"
                              disabled={busy}
                              onClick={() => openResolveDialog(rep, "resolved")}
                              className={actionBtn.lime}
                            >
                              Hoàn tất
                            </button>
                            <button
                              type="button"
                              data-button-surface="none"
                              disabled={busy}
                              onClick={() => openResolveDialog(rep, "dismissed")}
                              className={actionBtn.slate}
                            >
                              Bác bỏ
                            </button>
                          </div>
                        ) : (
                          <span className="text-xs font-semibold text-slate-500">Đã đóng</span>
                        )}
                      </td>
                    </tr>
                  );
                })
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

      <Dialog open={Boolean(resolveDialog)} onOpenChange={(open) => !open && setResolveDialog(null)}>
        <DialogContent className="border border-white/10 bg-[#0d061a] text-white shadow-2xl backdrop-blur-2xl sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-white font-extrabold text-lg">
              {resolveDialog?.status === "dismissed" ? "Bác bỏ báo cáo" : "Hoàn tất xử lý"}
            </DialogTitle>
            <DialogDescription className="text-slate-400 text-xs">
              Ghi chú gửi cho người báo cáo (tuỳ chọn). Họ sẽ nhận thông báo trong app.
            </DialogDescription>
          </DialogHeader>
          <textarea
            value={resolutionNote}
            onChange={(e) => setResolutionNote(e.target.value)}
            rows={4}
            placeholder="Ví dụ: Đã liên hệ mentor và cập nhật lịch…"
            className="w-full rounded-xl border border-white/10 bg-white/5 px-3.5 py-2.5 text-sm text-white placeholder:text-slate-500 outline-none focus:border-violet-500/50"
          />
          <DialogFooter className="gap-2 sm:gap-2">
            <button
              type="button"
              data-button-surface="none"
              onClick={() => setResolveDialog(null)}
              className="rounded-xl border border-white/10 px-4 py-2 text-sm font-semibold text-slate-300 hover:bg-white/5 transition"
            >
              Huỷ
            </button>
            <button
              type="button"
              data-button-surface="none"
              disabled={busyId === resolveDialog?.id}
              onClick={() => void confirmResolveDialog()}
              className={
                resolveDialog?.status === "dismissed"
                  ? "rounded-xl border border-rose-500/40 bg-rose-500/20 px-5 py-2 text-sm font-bold uppercase tracking-wide text-rose-300 hover:bg-rose-500/30 transition disabled:opacity-50"
                  : "rounded-xl border border-emerald-500/40 bg-emerald-500/20 px-5 py-2 text-sm font-bold uppercase tracking-wide text-emerald-300 hover:bg-emerald-500/30 transition disabled:opacity-50"
              }
            >
              {resolveDialog?.status === "dismissed" ? "Xác nhận bác bỏ" : "Hoàn tất"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
