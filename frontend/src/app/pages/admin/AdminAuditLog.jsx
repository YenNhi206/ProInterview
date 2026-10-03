import { useEffect, useState } from "react";
import { financeRequest } from "../../api/financeOperationsApi.js";
import { AppSelect } from "../../components/ui/AppSelect";

export function AdminAuditLog() {
  const [page, setPage] = useState(1); const [success, setSuccess] = useState(""); const [method, setMethod] = useState("");
  const [data, setData] = useState(null); const [error, setError] = useState(""); const [revision, setRevision] = useState(0);
  useEffect(() => {
    let active = true; setData(null); setError("");
    financeRequest(`/api/admin/audit-log?${new URLSearchParams({ page, limit: 25, success, method })}`)
      .then((res) => { if (active) setData(res); }).catch((err) => { if (active) setError(err.message); });
    return () => { active = false; };
  }, [page, success, method, revision]);
  return <div className="space-y-6"><h1 className="text-3xl font-black">Nhật ký thao tác admin</h1><p className="text-slate-500">Ghi lại người thao tác, yêu cầu và kết quả. Các trường bí mật được che trước khi lưu.</p>
    <div className="flex flex-wrap gap-3">
      <AppSelect
        aria-label="Kết quả"
        triggerClassName="w-full sm:w-52"
        value={success}
        onValueChange={(value) => { setSuccess(value); setPage(1); }}
        options={[
          { value: "", label: "Mọi kết quả" },
          { value: "true", label: "Thành công" },
          { value: "false", label: "Không thành công" },
        ]}
      />
      <AppSelect
        aria-label="Phương thức"
        triggerClassName="w-full sm:w-48"
        value={method}
        onValueChange={(value) => { setMethod(value); setPage(1); }}
        options={[
          { value: "", label: "Mọi thao tác" },
          ...["POST", "PATCH", "PUT", "DELETE"].map((value) => ({ value, label: value })),
        ]}
      />
      <button onClick={() => setRevision((n) => n + 1)} className="px-3 text-violet-700">Tải lại</button></div>
    {error && <p role="alert" className="text-red-700">{error}</p>}{!data && !error && <p>Đang tải…</p>}
    <div className="space-y-3">{data?.entries.map((row) => <article className="rounded-xl border bg-white p-4" key={row._id}>
      <div className="flex flex-wrap justify-between gap-2"><strong>{row.userId?.name || "Admin"}</strong><span className="text-xs text-slate-500">{new Date(row.createdAt).toLocaleString("vi-VN")}</span></div>
      <p className="mt-2 break-all font-mono text-sm">{row.details.method} {row.details.path}</p><p className={`mt-2 text-sm ${row.details.success ? "text-emerald-700" : "text-red-700"}`}>HTTP {row.details.statusCode} · {row.details.success ? "Thành công" : "Không thành công"}</p>
      {row.details.body && <details className="mt-3 text-sm"><summary className="cursor-pointer">Chi tiết yêu cầu</summary><pre className="mt-2 overflow-auto whitespace-pre-wrap break-all rounded bg-slate-50 p-3">{JSON.stringify(row.details.body, null, 2)}</pre></details>}
    </article>)}</div>{data?.entries.length === 0 && <p>Chưa có thao tác phù hợp.</p>}
    {data && <div className="flex gap-4"><button disabled={page === 1} onClick={() => setPage(page - 1)} className="disabled:opacity-40">Trang trước</button><span>{page}/{data.pagination.totalPages}</span><button disabled={page >= data.pagination.totalPages} onClick={() => setPage(page + 1)} className="disabled:opacity-40">Trang sau</button></div>}
  </div>;
}
