import { useState, useEffect, useCallback } from "react";
import { CheckCircle2, XCircle, Building2, Briefcase, RefreshCw, Search, Tag, PencilLine } from "lucide-react";
import { companyApi } from "../../api/companyApi.js";
import { tryApi, toastApiSuccess } from "../../utils/shared/apiToast.js";
import { useRoleCategories } from "../../hooks/useRoleCategories.js";

/**
 * CO-16: Platform Moderator duyệt tầng hai câu hỏi doanh nghiệp (`pending_platform_review` → `approved` | `rejected`).
 * Tách khỏi trang ngân hàng câu chung `/moderator/questions`. Chỉ câu đã duyệt ở đây mới vào phỏng vấn.
 */
const STATUS_TABS = [
  { id: "pending_platform_review", label: "Chờ duyệt", dot: "bg-amber-500" },
  { id: "approved", label: "Đã duyệt", dot: "bg-emerald-500" },
  { id: "rejected", label: "Bị từ chối", dot: "bg-rose-500" },
];
const PAGE_SIZE = 20;

export function ModeratorCompanyQuestions() {
  const { labelOf } = useRoleCategories();
  const [activeTab, setActiveTab] = useState("pending_platform_review");
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [questions, setQuestions] = useState([]);
  const [counts, setCounts] = useState({});
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [selected, setSelected] = useState(() => new Set());
  // { ids: string[] } khi đang mở hộp nhập lý do từ chối
  const [rejectTarget, setRejectTarget] = useState(null);
  const [rejectReason, setRejectReason] = useState("");

  const isPendingTab = activeTab === "pending_platform_review";

  const fetchQuestions = useCallback(async () => {
    setLoading(true);
    const res = await tryApi(
      () => companyApi.listModeratorCompanyQuestions({ status: activeTab, q: query, page, limit: PAGE_SIZE }),
      { fallback: "Không thể tải danh sách câu hỏi doanh nghiệp." },
    );
    if (res.success) {
      setQuestions(res.questions || []);
      setCounts(res.counts || {});
      setTotalPages(res.pagination?.totalPages || 1);
    }
    setSelected(new Set());
    setLoading(false);
  }, [activeTab, query, page]);

  useEffect(() => {
    fetchQuestions();
  }, [fetchQuestions]);

  const changeTab = (id) => {
    setActiveTab(id);
    setPage(1);
  };

  const submitSearch = (e) => {
    e.preventDefault();
    setPage(1);
    setQuery(search.trim());
  };

  const toggle = (id) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const allSelected = questions.length > 0 && questions.every((q) => selected.has(q._id));
  const toggleAll = () => setSelected(allSelected ? new Set() : new Set(questions.map((q) => q._id)));

  const approve = async (ids) => {
    if (ids.length === 0) return;
    if (ids.length > 1 && !window.confirm(`Duyệt ${ids.length} câu hỏi? Câu được duyệt sẽ dùng trong phỏng vấn.`)) return;
    setProcessing(true);
    const res =
      ids.length === 1
        ? await tryApi(() => companyApi.approveModeratorCompanyQuestion(ids[0]), {
            fallback: "Không thể duyệt câu hỏi.",
            successMessage: "Đã duyệt câu hỏi.",
          })
        : await tryApi(() => companyApi.bulkModeratorCompanyQuestions("approve", ids), {
            fallback: "Không thể duyệt hàng loạt.",
          });
    setProcessing(false);
    if (res.success) {
      if (ids.length > 1) toastApiSuccess(`Đã duyệt ${res.updated} câu hỏi.`);
      fetchQuestions();
    }
  };

  const openReject = (ids) => {
    if (ids.length === 0) return;
    setRejectTarget({ ids });
    setRejectReason("");
  };

  const confirmReject = async (e) => {
    e.preventDefault();
    const reason = rejectReason.trim();
    if (!reason || !rejectTarget) return;
    const { ids } = rejectTarget;
    setProcessing(true);
    const res =
      ids.length === 1
        ? await tryApi(() => companyApi.rejectModeratorCompanyQuestion(ids[0], reason), {
            fallback: "Không thể từ chối câu hỏi.",
            successMessage: "Đã từ chối câu hỏi kèm lý do.",
          })
        : await tryApi(() => companyApi.bulkModeratorCompanyQuestions("reject", ids, reason), {
            fallback: "Không thể từ chối hàng loạt.",
          });
    setProcessing(false);
    if (res.success) {
      if (ids.length > 1) toastApiSuccess(`Đã từ chối ${res.updated} câu hỏi.`);
      setRejectTarget(null);
      fetchQuestions();
    }
  };

  const selectedIds = [...selected];
  const colCount = isPendingTab ? 6 : 5;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-black tracking-tight text-slate-900">Duyệt câu hỏi doanh nghiệp</h1>
        <p className="mt-1 text-sm text-slate-500">
          Câu hỏi doanh nghiệp đã duyệt phía công ty cần Platform Moderator duyệt lần hai trước khi dùng trong phỏng vấn AI.
          Ngân hàng câu chung nằm ở trang “Ngân hàng câu hỏi”.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-1.5 border-b border-slate-200/80 pb-2">
        {STATUS_TABS.map((tab) => {
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => changeTab(tab.id)}
              className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition-all ${
                active ? "bg-[#6E35E8] text-white shadow-sm" : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
              }`}
            >
              <span className={`h-2 w-2 rounded-full ${active ? "bg-white" : tab.dot}`} />
              <span>{tab.label}</span>
              <span className={`rounded-full px-1.5 text-[10px] ${active ? "bg-white/20" : "bg-slate-100 text-slate-500"}`}>
                {counts[tab.id] ?? 0}
              </span>
            </button>
          );
        })}

        <form onSubmit={submitSearch} className="ml-auto flex items-center gap-1.5">
          <div className="relative">
            <Search size={13} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Tìm nội dung câu hỏi"
              maxLength={100}
              className="w-56 rounded-xl border border-slate-200 bg-white py-1.5 pl-8 pr-3 text-xs focus:border-violet-500 focus:outline-none"
            />
          </div>
          <button
            type="button"
            onClick={fetchQuestions}
            className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
          >
            <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
            <span>Làm mới</span>
          </button>
        </form>
      </div>

      {isPendingTab && selectedIds.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-violet-200 bg-violet-50 px-4 py-2.5 text-xs">
          <span className="font-bold text-violet-800">Đã chọn {selectedIds.length} câu</span>
          <button
            type="button"
            disabled={processing}
            onClick={() => approve(selectedIds)}
            className="ml-auto inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1.5 font-bold text-white hover:bg-emerald-700 disabled:opacity-50"
          >
            <CheckCircle2 size={13} /> Duyệt đã chọn
          </button>
          <button
            type="button"
            disabled={processing}
            onClick={() => openReject(selectedIds)}
            className="inline-flex items-center gap-1 rounded-lg bg-rose-600 px-3 py-1.5 font-bold text-white hover:bg-rose-700 disabled:opacity-50"
          >
            <XCircle size={13} /> Từ chối đã chọn
          </button>
        </div>
      )}

      <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-slate-200/80 bg-slate-50/75 text-[11px] font-bold uppercase tracking-wider text-slate-500">
              <tr>
                {isPendingTab && (
                  <th className="w-10 px-4 py-3.5">
                    <input type="checkbox" checked={allSelected} onChange={toggleAll} aria-label="Chọn tất cả" />
                  </th>
                )}
                <th className="px-5 py-3.5">Câu hỏi</th>
                <th className="px-5 py-3.5">Doanh nghiệp &amp; Job</th>
                <th className="px-5 py-3.5">Vị trí &amp; Năng lực</th>
                <th className="px-5 py-3.5">{isPendingTab ? "Gửi lúc" : "Duyệt lúc"}</th>
                <th className="px-5 py-3.5 text-right">{isPendingTab ? "Thao tác" : "Ghi chú"}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
              {loading ? (
                <tr>
                  <td colSpan={colCount} className="py-12 text-center text-slate-400">
                    <div className="sticky left-0 w-[min(100%,calc(100vw-4rem))]">
                      Đang tải danh sách câu hỏi...
                    </div>
                  </td>
                </tr>
              ) : questions.length === 0 ? (
                <tr>
                  <td colSpan={colCount} className="py-12 text-center text-slate-400">
                    <div className="sticky left-0 w-[min(100%,calc(100vw-4rem))]">
                      Không có câu hỏi nào trong mục này.
                    </div>
                  </td>
                </tr>
              ) : (
                questions.map((q) => (
                  <tr key={q._id} className="align-top transition-colors hover:bg-slate-50/60">
                    {isPendingTab && (
                      <td className="px-4 py-4">
                        <input
                          type="checkbox"
                          checked={selected.has(q._id)}
                          onChange={() => toggle(q._id)}
                          aria-label="Chọn câu hỏi"
                        />
                      </td>
                    )}
                    <td className="max-w-md px-5 py-4">
                      <p className="text-sm font-semibold leading-relaxed text-slate-900">{q.text}</p>
                      {q.lastEdit?.previousQuestion && q.lastEdit.previousQuestion !== q.text && (
                        <p className="mt-1.5 flex items-start gap-1 text-[11px] text-slate-400">
                          <PencilLine size={11} className="mt-0.5 shrink-0" />
                          <span>
                            Đã sửa từ: <span className="italic">{q.lastEdit.previousQuestion}</span>
                          </span>
                        </p>
                      )}
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-1.5 font-bold text-slate-900">
                        <Building2 size={13} className="text-violet-500" />
                        {q.company?.name || "Công ty đối tác"}
                      </div>
                      <div className="mt-1 flex items-center gap-1.5 text-[11px] text-slate-500">
                        <Briefcase size={11} />
                        {q.jobPost?.title || "Dùng chung theo vị trí"}
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-700">
                        <Tag size={11} className="text-slate-400" />
                        {labelOf(q.roleCategory)}
                      </span>
                      <p className="mt-1 font-mono text-[11px] text-slate-500">{q.competencyId}</p>
                    </td>
                    <td className="px-5 py-4 text-[11px] text-slate-400">
                      {new Date(isPendingTab ? q.updatedAt : q.review?.at || q.updatedAt).toLocaleString("vi-VN")}
                    </td>
                    <td className="px-5 py-4 text-right">
                      {isPendingTab ? (
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            disabled={processing}
                            onClick={() => approve([q._id])}
                            className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-2.5 py-1.5 text-xs font-bold text-white hover:bg-emerald-700 disabled:opacity-50"
                          >
                            <CheckCircle2 size={13} />
                            <span>Duyệt</span>
                          </button>
                          <button
                            type="button"
                            disabled={processing}
                            onClick={() => openReject([q._id])}
                            className="inline-flex items-center gap-1 rounded-lg bg-rose-600 px-2.5 py-1.5 text-xs font-bold text-white hover:bg-rose-700 disabled:opacity-50"
                          >
                            <XCircle size={13} />
                            <span>Từ chối</span>
                          </button>
                        </div>
                      ) : (
                        <span className="text-[11px] text-slate-500">{q.review?.note || q.moderation?.reason || "—"}</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-end gap-2 text-xs">
          <button
            type="button"
            disabled={page <= 1 || loading}
            onClick={() => setPage((p) => p - 1)}
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
            onClick={() => setPage((p) => p + 1)}
            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-40"
          >
            Sau
          </button>
        </div>
      )}

      {rejectTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm">
          <div className="max-h-[90vh] overflow-y-auto w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl">
            <h2 className="mb-1 text-lg font-black text-slate-900">
              Từ chối {rejectTarget.ids.length > 1 ? `${rejectTarget.ids.length} câu hỏi` : "câu hỏi"}
            </h2>
            <p className="mb-4 text-xs text-slate-500">Lý do được gửi lại cho doanh nghiệp để chỉnh sửa.</p>
            <form onSubmit={confirmReject} className="space-y-4">
              <div>
                <label htmlFor="company-question-reject-reason" className="mb-1 block text-xs font-bold text-slate-700">
                  Lý do từ chối *
                </label>
                <textarea
                  id="company-question-reject-reason"
                  required
                  rows={4}
                  maxLength={500}
                  placeholder="Ví dụ: Câu hỏi hỏi về tuổi / tình trạng hôn nhân, không phù hợp chuẩn tuyển dụng..."
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 p-3 text-xs font-medium focus:border-violet-500 focus:outline-none"
                />
              </div>
              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setRejectTarget(null)}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={processing || !rejectReason.trim()}
                  className="rounded-xl bg-rose-600 px-5 py-2 text-xs font-bold text-white hover:bg-rose-700 disabled:opacity-50"
                >
                  {processing ? "Đang xử lý..." : "Xác nhận từ chối"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
