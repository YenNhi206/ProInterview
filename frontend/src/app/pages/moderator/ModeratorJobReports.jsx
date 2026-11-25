import { useCallback, useEffect, useState } from "react";
import { Briefcase, Building2, ChevronDown, ChevronUp, EyeOff, Eye, Flag, RefreshCw, Search, ShieldCheck } from "lucide-react";
import { moderatorApi } from "../../api/moderatorApi.js";
import { tryApi } from "../../utils/shared/apiToast.js";
import { hideReasonError, isSafeEvidenceUrl, jobReportReasonLabel, JOB_VISIBILITY_LABEL } from "../../utils/moderator/jobReports.js";

/**
 * JB-17: Platform Moderator xử lý báo cáo tin tuyển dụng, tách khỏi hàng đợi phỏng vấn `/moderator/queue`.
 * Tab "Báo cáo": item `job_post_report` → giữ tin (`dismiss`) hoặc ẩn tin (`hide_job`).
 * Tab "Tin tuyển dụng": ẩn / bỏ ẩn tin trực tiếp (`PATCH /api/moderator/jobs/:id/visibility`).
 */
const TABS = [
  { id: "reports", label: "Báo cáo chờ xử lý", icon: Flag },
  { id: "jobs", label: "Tin tuyển dụng", icon: Briefcase },
];
const PAGE_SIZE = 20;
const date = (v) => (v ? new Date(v).toLocaleString("vi-VN") : "—");

export function ModeratorJobReports() {
  const [tab, setTab] = useState("reports");
  // { kind: "report" | "job", id, title } khi đang mở hộp nhập lý do ẩn tin
  const [hideTarget, setHideTarget] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);
  const reload = () => setReloadKey((k) => k + 1);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-black tracking-tight text-slate-900">Báo cáo tin tuyển dụng</h1>
        <p className="mt-1 text-sm text-slate-500">
          Xử lý báo cáo của ứng viên về tin tuyển dụng: giữ tin hoặc ẩn tin. Tin bị ẩn không còn hiện ở trang việc làm,
          doanh nghiệp được thông báo kèm lý do.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-1.5 border-b border-slate-200/80 pb-2">
        {TABS.map((t) => {
          const Icon = t.icon;
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition-all ${
                active ? "bg-[#6E35E8] text-white shadow-sm" : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
              }`}
            >
              <Icon size={14} />
              {t.label}
            </button>
          );
        })}
        <button
          type="button"
          onClick={reload}
          className="ml-auto inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
        >
          <RefreshCw size={13} /> Làm mới
        </button>
      </div>

      {tab === "reports" ? (
        <ReportsTab reloadKey={reloadKey} onHide={setHideTarget} onChanged={reload} />
      ) : (
        <JobsTab reloadKey={reloadKey} onHide={setHideTarget} onChanged={reload} />
      )}

      {hideTarget && (
        <HideJobDialog
          target={hideTarget}
          onClose={() => setHideTarget(null)}
          onDone={() => {
            setHideTarget(null);
            reload();
          }}
        />
      )}
    </div>
  );
}

function ReportsTab({ reloadKey, onHide, onChanged }) {
  const [items, setItems] = useState([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState("");
  const [details, setDetails] = useState({});
  const [busyId, setBusyId] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const res = await tryApi(() => moderatorApi.listQueue({ type: "job_post_report", page, limit: PAGE_SIZE }), {
      fallback: "Không tải được báo cáo tin tuyển dụng.",
    });
    if (res.success) {
      setItems(res.items || []);
      setTotalPages(res.pagination?.totalPages || 1);
    }
    setLoading(false);
  }, [page]);

  useEffect(() => {
    load();
  }, [load, reloadKey]);

  const toggle = async (item) => {
    const id = String(item._id);
    if (expanded === id) {
      setExpanded("");
      return;
    }
    setExpanded(id);
    if (!details[id]) {
      const res = await tryApi(() => moderatorApi.getQueueItem(id), { fallback: "Không tải được chi tiết báo cáo." });
      if (res.success) setDetails((d) => ({ ...d, [id]: res.report || null }));
    }
  };

  const keepJob = async (item) => {
    if (!window.confirm(`Giữ tin "${item.snapshot?.jobTitle || "này"}" và đóng báo cáo?`)) return;
    setBusyId(String(item._id));
    const res = await tryApi(() => moderatorApi.resolveQueueItem(item._id, { action: "dismiss", note: "Tin không vi phạm" }), {
      fallback: "Không xử lý được báo cáo.",
      successMessage: "Đã giữ tin và đóng báo cáo.",
    });
    setBusyId("");
    if (res.success) onChanged();
  };

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="border-b border-slate-200/80 bg-slate-50/75 text-[11px] font-bold uppercase tracking-wider text-slate-500">
            <tr>
              <th className="px-5 py-3.5">Tin bị báo cáo</th>
              <th className="px-5 py-3.5">Mức ưu tiên</th>
              <th className="px-5 py-3.5">Báo cáo lúc</th>
              <th className="px-5 py-3.5 text-right">Thao tác</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
            {loading ? (
              <tr>
                <td colSpan={4} className="py-12 text-center text-slate-400"><div className="sticky left-0 w-[min(100%,calc(100vw-4rem))]">Đang tải báo cáo...</div></td>
              </tr>
            ) : items.length === 0 ? (
              <tr>
                <td colSpan={4} className="py-12 text-center text-slate-400">
                  <div className="sticky left-0 w-[min(100%,calc(100vw-4rem))]">
                    <ShieldCheck className="mx-auto mb-2 h-6 w-6 text-emerald-500" />
                    Không có báo cáo tin tuyển dụng nào đang chờ.
                  </div>
                </td>
              </tr>
            ) : (
              items.map((item) => {
                const id = String(item._id);
                const open = expanded === id;
                const report = details[id];
                return (
                  <ReportRow
                    key={id}
                    item={item}
                    open={open}
                    report={report}
                    busy={busyId === id}
                    onToggle={() => toggle(item)}
                    onKeep={() => keepJob(item)}
                    onHide={() => onHide({ kind: "report", id, title: item.snapshot?.jobTitle || "" })}
                  />
                );
              })
            )}
          </tbody>
        </table>
      </div>
      <Pager page={page} totalPages={totalPages} loading={loading} onPage={setPage} />
    </div>
  );
}

function ReportRow({ item, open, report, busy, onToggle, onKeep, onHide }) {
  const high = item.priority === "high";
  return (
    <>
      <tr className="align-top hover:bg-slate-50/60">
        <td className="px-5 py-4">
          <p className="text-sm font-bold text-slate-900">{item.snapshot?.jobTitle || "Tin tuyển dụng"}</p>
          <p className="mt-1 flex items-center gap-1.5 text-[11px] text-slate-500">
            <Building2 size={11} /> {item.snapshot?.companyName || "—"}
          </p>
        </td>
        <td className="px-5 py-4">
          <span
            className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${
              high ? "bg-rose-100 text-rose-700" : "bg-slate-100 text-slate-600"
            }`}
          >
            {high ? "Cao" : "Bình thường"}
          </span>
        </td>
        <td className="px-5 py-4 text-[11px] text-slate-400">{date(item.createdAt)}</td>
        <td className="px-5 py-4 text-right">
          <div className="flex flex-wrap items-center justify-end gap-1.5">
            <button
              type="button"
              onClick={onToggle}
              aria-expanded={open}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              {open ? <ChevronUp size={13} /> : <ChevronDown size={13} />} Chi tiết
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={onKeep}
              className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-2.5 py-1.5 text-xs font-bold text-white hover:bg-emerald-700 disabled:opacity-50"
            >
              <Eye size={13} /> Giữ tin
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={onHide}
              className="inline-flex items-center gap-1 rounded-lg bg-rose-600 px-2.5 py-1.5 text-xs font-bold text-white hover:bg-rose-700 disabled:opacity-50"
            >
              <EyeOff size={13} /> Ẩn tin
            </button>
          </div>
        </td>
      </tr>
      {open && (
        <tr className="bg-slate-50/60">
          <td colSpan={4} className="px-5 py-4 text-xs text-slate-700">
            {report === undefined ? (
              <span className="text-slate-400">Đang tải chi tiết...</span>
            ) : report === null ? (
              <span className="text-slate-400">Không tìm thấy báo cáo gốc.</span>
            ) : (
              <dl className="grid gap-2 sm:grid-cols-[140px_1fr]">
                <dt className="font-bold text-slate-500">Lý do</dt>
                <dd className="font-semibold text-slate-900">{jobReportReasonLabel(report.reason)}</dd>
                <dt className="font-bold text-slate-500">Mô tả</dt>
                <dd className="whitespace-pre-wrap">{report.description || "—"}</dd>
                <dt className="font-bold text-slate-500">Người báo cáo</dt>
                <dd>{report.reportedBy?.name || "—"}</dd>
                {report.evidenceUrls?.length > 0 && (
                  <>
                    <dt className="font-bold text-slate-500">Bằng chứng</dt>
                    <dd className="flex flex-col gap-1">
                      {report.evidenceUrls.map((url) =>
                        isSafeEvidenceUrl(url) ? (
                          <a key={url} href={url} target="_blank" rel="noreferrer noopener" className="break-all text-violet-700 hover:underline">
                            {url}
                          </a>
                        ) : (
                          <span key={url} className="break-all text-slate-500">{url}</span>
                        ),
                      )}
                    </dd>
                  </>
                )}
              </dl>
            )}
          </td>
        </tr>
      )}
    </>
  );
}

function JobsTab({ reloadKey, onHide, onChanged }) {
  const [status, setStatus] = useState("published");
  const [reported, setReported] = useState(true);
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [jobs, setJobs] = useState([]);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const res = await tryApi(
      () => moderatorApi.listJobs({ status, reported: reported ? "true" : "", q: query, page, limit: PAGE_SIZE }),
      { fallback: "Không tải được danh sách tin tuyển dụng." },
    );
    if (res.success) {
      setJobs(res.jobs || []);
      setTotalPages(res.pagination?.totalPages || 1);
    }
    setLoading(false);
  }, [status, reported, query, page]);

  useEffect(() => {
    load();
  }, [load, reloadKey]);

  const unhide = async (job) => {
    if (!window.confirm(`Bỏ ẩn tin "${job.title}"? Tin sẽ hiện lại ở trang việc làm.`)) return;
    setBusyId(job.id);
    const res = await tryApi(() => moderatorApi.setJobVisibility(job.id, { hidden: false }), {
      fallback: "Không bỏ ẩn được tin.",
      successMessage: "Đã bỏ ẩn tin.",
    });
    setBusyId("");
    if (res.success) onChanged();
  };

  return (
    <div className="space-y-3">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          setPage(1);
          setQuery(search.trim());
        }}
        className="flex flex-wrap items-center gap-2"
      >
        <select
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            setPage(1);
          }}
          aria-label="Trạng thái tin"
          className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs"
        >
          <option value="published">Đang hiển thị</option>
          <option value="hidden">Đã ẩn</option>
        </select>
        <label className="inline-flex items-center gap-1.5 text-xs text-slate-600">
          <input
            type="checkbox"
            checked={reported}
            onChange={(e) => {
              setReported(e.target.checked);
              setPage(1);
            }}
          />
          Chỉ tin có báo cáo đang mở
        </label>
        <div className="relative ml-auto">
          <Search size={13} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Tìm theo tiêu đề"
            maxLength={100}
            className="w-56 rounded-xl border border-slate-200 bg-white py-1.5 pl-8 pr-3 text-xs focus:border-violet-500 focus:outline-none"
          />
        </div>
      </form>

      <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-slate-200/80 bg-slate-50/75 text-[11px] font-bold uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-5 py-3.5">Tin tuyển dụng</th>
                <th className="px-5 py-3.5">Trạng thái</th>
                <th className="px-5 py-3.5">Báo cáo đang mở</th>
                <th className="px-5 py-3.5 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
              {loading ? (
                <tr>
                  <td colSpan={4} className="py-12 text-center text-slate-400"><div className="sticky left-0 w-[min(100%,calc(100vw-4rem))]">Đang tải tin tuyển dụng...</div></td>
                </tr>
              ) : jobs.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-12 text-center text-slate-400"><div className="sticky left-0 w-[min(100%,calc(100vw-4rem))]">Không có tin nào khớp bộ lọc.</div></td>
                </tr>
              ) : (
                jobs.map((job) => (
                  <tr key={job.id} className="align-top hover:bg-slate-50/60">
                    <td className="px-5 py-4">
                      <p className="text-sm font-bold text-slate-900">{job.title}</p>
                      <p className="mt-1 flex items-center gap-1.5 text-[11px] text-slate-500">
                        <Building2 size={11} /> {job.companyName || "—"}
                      </p>
                    </td>
                    <td className="px-5 py-4">
                      <span
                        className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${
                          job.status === "hidden" ? "bg-slate-200 text-slate-700" : "bg-emerald-100 text-emerald-700"
                        }`}
                      >
                        {JOB_VISIBILITY_LABEL[job.status] || job.status}
                      </span>
                      {job.status === "hidden" && job.hiddenReason && (
                        <p className="mt-1 max-w-[260px] text-[11px] text-slate-500">Lý do: {job.hiddenReason}</p>
                      )}
                    </td>
                    <td className="px-5 py-4 font-bold text-slate-900">{job.openReports ?? 0}</td>
                    <td className="px-5 py-4 text-right">
                      {job.status === "hidden" ? (
                        <button
                          type="button"
                          disabled={busyId === job.id}
                          onClick={() => unhide(job)}
                          className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                        >
                          <Eye size={13} /> Bỏ ẩn
                        </button>
                      ) : (
                        <button
                          type="button"
                          disabled={busyId === job.id}
                          onClick={() => onHide({ kind: "job", id: job.id, title: job.title })}
                          className="inline-flex items-center gap-1 rounded-lg bg-rose-600 px-2.5 py-1.5 text-xs font-bold text-white hover:bg-rose-700 disabled:opacity-50"
                        >
                          <EyeOff size={13} /> Ẩn tin
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <Pager page={page} totalPages={totalPages} loading={loading} onPage={setPage} />
      </div>
    </div>
  );
}

/** Nhập lý do ẩn tin. Báo cáo → `hide_job` trên item; tin → `PATCH /jobs/:id/visibility`. */
function HideJobDialog({ target, onClose, onDone }) {
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const error = hideReasonError(reason);

  const submit = async (e) => {
    e.preventDefault();
    if (error) return;
    setSaving(true);
    const text = reason.trim();
    const res =
      target.kind === "report"
        ? await tryApi(() => moderatorApi.resolveQueueItem(target.id, { action: "hide_job", note: text }), {
            fallback: "Không ẩn được tin.",
            successMessage: "Đã ẩn tin và đóng các báo cáo của tin này.",
          })
        : await tryApi(() => moderatorApi.setJobVisibility(target.id, { hidden: true, reason: text }), {
            fallback: "Không ẩn được tin.",
            successMessage: "Đã ẩn tin.",
          });
    setSaving(false);
    if (res.success) onDone();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm">
      <div className="max-h-[90vh] overflow-y-auto w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl">
        <h2 className="mb-1 text-lg font-black text-slate-900">Ẩn tin tuyển dụng</h2>
        <p className="mb-4 text-xs text-slate-500">
          {target.title ? <>Tin “{target.title}” sẽ</> : "Tin sẽ"} biến khỏi trang việc làm. Doanh nghiệp nhận thông báo kèm lý do.
        </p>
        <form onSubmit={submit} className="space-y-4">
          <div>
            <label htmlFor="hide-job-reason" className="mb-1 block text-xs font-bold text-slate-700">
              Lý do ẩn tin *
            </label>
            <textarea
              id="hide-job-reason"
              rows={4}
              maxLength={500}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Ví dụ: Tin yêu cầu ứng viên đóng phí trước khi phỏng vấn."
              className="w-full rounded-xl border border-slate-200 p-3 text-xs font-medium focus:border-violet-500 focus:outline-none"
            />
            {reason && error && <p className="mt-1 text-[11px] text-rose-600">{error}</p>}
          </div>
          <div className="flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={saving || Boolean(error)}
              className="rounded-xl bg-rose-600 px-5 py-2 text-xs font-bold text-white hover:bg-rose-700 disabled:opacity-50"
            >
              {saving ? "Đang xử lý..." : "Ẩn tin"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function Pager({ page, totalPages, loading, onPage }) {
  if (totalPages <= 1) return null;
  return (
    <div className="flex items-center justify-end gap-2 border-t border-slate-100 px-4 py-3 text-xs">
      <button
        type="button"
        disabled={page <= 1 || loading}
        onClick={() => onPage(page - 1)}
        className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-40"
      >
        Trước
      </button>
      <span className="text-slate-500">
        Trang {page}/{totalPages}
      </span>
      <button
        type="button"
        disabled={page >= totalPages || loading}
        onClick={() => onPage(page + 1)}
        className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-40"
      >
        Sau
      </button>
    </div>
  );
}
