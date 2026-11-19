import React, { useCallback, useEffect, useState } from "react";
import { Link } from "react-router";
import { moderatorApi } from "../../api/moderatorApi.js";
import { tryApi } from "../../utils/shared/apiToast.js";
import { ModeratorPageHeader } from "./ModeratorPageHeader.jsx";
import { AdminFilterSelect, AdminListFilterBar } from "../../components/admin/AdminListFilters.jsx";
import { QUEUE_STATUS, QUEUE_TYPE, formatDateTime, formatWaiting } from "../../utils/moderator/moderationLabels.js";

const all = { id: "all", label: "Tất cả" };
const TYPE_OPTIONS = [all, ...Object.entries(QUEUE_TYPE).map(([id, label]) => ({ id, label }))];
/**
 * "all" ở trạng thái = mặc định backend: chỉ item còn mở (open + in_review).
 * Hệ thống chỉ có 1 Platform Moderator (DECISIONS.md #15) nên không có bước nhận việc:
 * bỏ lọc/cột "Người nhận" và trạng thái `in_review` (chỉ sinh ra khi claim).
 */
const STATUS_OPTIONS = [
  { id: "all", label: "Đang mở" },
  ...Object.entries(QUEUE_STATUS).filter(([id]) => id !== "in_review").map(([id, label]) => ({ id, label })),
];
/** Xử lý theo thời gian, cũ nhất trước — không còn lọc/xếp theo ưu tiên (DECISIONS.md #16). */
const DEFAULT_FILTERS = { type: "all", status: "all" };
const PAGE_SIZE = 20;

const card = "rounded-2xl border border-slate-200 bg-white shadow-sm";
const btnGhost = "inline-flex items-center rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50";

export function ModeratorQueue() {
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const [page, setPage] = useState(1);
  const [items, setItems] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await tryApi(() => moderatorApi.listQueue({ ...filters, page, limit: PAGE_SIZE }), { fallback: "Không tải được hàng đợi." });
    setLoading(false);
    if (res.success) {
      setItems(res.items ?? []);
      setPagination(res.pagination ?? null);
    }
  }, [filters, page]);

  useEffect(() => {
    load();
  }, [load]);

  const setFilter = (key) => (value) => {
    setPage(1);
    setFilters((f) => ({ ...f, [key]: value }));
  };

  return (
    <div className="space-y-4">
      <ModeratorPageHeader
        title="Hàng đợi kiểm định"
        subtitle="Báo cáo của người dùng về câu hỏi / điểm chấm AI và các lần chấm thiếu tiêu chí. Mục chờ lâu nhất xếp trước."
      />

      <AdminListFilterBar
        countText={pagination ? `${pagination.total} mục` : ""}
        showReset={JSON.stringify(filters) !== JSON.stringify(DEFAULT_FILTERS)}
        onReset={() => { setPage(1); setFilters(DEFAULT_FILTERS); }}
      >
        <AdminFilterSelect id="mqq-type" label="Loại" value={filters.type} options={TYPE_OPTIONS} onChange={setFilter("type")} />
        <AdminFilterSelect id="mqq-status" label="Trạng thái" value={filters.status} options={STATUS_OPTIONS} onChange={setFilter("status")} />
      </AdminListFilterBar>

      <div className={`${card} overflow-hidden`}>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-[11px] font-black uppercase tracking-widest text-slate-500">
              <tr>
                <th className="px-4 py-3">#</th>
                <th className="px-4 py-3">Loại</th>
                <th className="px-4 py-3">Câu hỏi</th>
                <th className="px-4 py-3">Trạng thái</th>
                <th className="px-4 py-3">Tạo lúc</th>
              </tr>
            </thead>
            <tbody>
              {loading && items.length === 0 ? <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-500">Đang tải…</td></tr> : null}
              {!loading && items.length === 0 ? <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-500">Hàng đợi trống.</td></tr> : null}
              {items.map((it, index) => (
                <tr key={it._id} className="border-t border-slate-100 hover:bg-violet-50/40">
                  <td className="px-4 py-3 text-xs font-bold tabular-nums text-slate-500">{(page - 1) * PAGE_SIZE + index + 1}</td>
                  <td className="px-4 py-3 text-slate-700">{QUEUE_TYPE[it.type] ?? it.type}</td>
                  <td className="px-4 py-3">
                    <Link to={`/moderator/queue/${it._id}`} className="line-clamp-2 font-medium text-[#6E35E8] hover:underline">
                      {it.snapshot?.questionText || "(Không có nội dung câu hỏi)"}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-slate-700">{QUEUE_STATUS[it.status] ?? it.status}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-xs text-slate-500">
                    <span className="block">{formatDateTime(it.createdAt)}</span>
                    {it.status === "open" || it.status === "in_review" ? (
                      <span className="mt-0.5 block font-semibold text-slate-700">Đã chờ {formatWaiting(it.createdAt)}</span>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {pagination && pagination.totalPages > 1 ? (
          <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3 text-xs text-slate-600">
            <span>Trang {pagination.page}/{pagination.totalPages}</span>
            <div className="flex gap-2">
              <button type="button" className={btnGhost} disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Trước</button>
              <button type="button" className={btnGhost} disabled={page >= pagination.totalPages} onClick={() => setPage((p) => p + 1)}>Sau</button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
