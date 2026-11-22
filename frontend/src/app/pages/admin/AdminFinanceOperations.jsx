import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router";
import { financeRequest } from "../../api/financeOperationsApi.js";
import { formatVnd } from "../../utils/shared/formatVnd.js";

export function AdminFinanceOperations() {
  const [report, setReport] = useState(null); const [held, setHeld] = useState(null); const [page, setPage] = useState(1);
  const [error, setError] = useState(""); const [message, setMessage] = useState(""); const [busy, setBusy] = useState(false);
  const [refund, setRefund] = useState(null); const [reference, setReference] = useState(""); const [reason, setReason] = useState("");
  const load = useCallback(async () => {
    setError("");
    try { const [r, h] = await Promise.all([financeRequest("/api/admin/finance/reconciliation"), financeRequest(`/api/admin/payments/held?page=${page}`)]); setReport(r.report); setHeld(h); }
    catch (err) { setError(err.message); }
  }, [page]);
  useEffect(() => { void load(); }, [load]);
  const release = async () => {
    setBusy(true); setMessage("");
    try { const { result } = await financeRequest("/api/admin/finance/release-earnings", "POST", {});
      setMessage(`Đã giải phóng ${result.releasedCount} khoản; ${result.heldCount} khoản tiếp tục giữ; ${result.failedCount} khoản cần đối soát.`); await load();
    } catch (err) { setError(err.message); } finally { setBusy(false); }
  };
  const confirmRefund = async () => {
    setBusy(true);
    try { await financeRequest(`/api/admin/payments/${refund._id}/refund-held`, "PATCH", { transferRef: reference, reason, amount: refund.amount });
      setRefund(null); setMessage("Đã ghi nhận chuyển khoản hoàn tiền."); await load();
    } catch (err) { setError(err.message); } finally { setBusy(false); }
  };
  return <div className="space-y-6">
    <div>
      <h1 className="font-headline text-2xl font-black uppercase tracking-tight text-white sm:text-3xl">
        <span className="bg-gradient-to-r from-violet-400 to-indigo-400 bg-clip-text text-transparent">Giải ngân</span> &amp; đối soát
      </h1>
      <p className="mt-1 text-xs text-slate-400">Thu nhập mới được giữ 3 ngày từ lúc hoàn tất buổi mentor hoặc thanh toán khóa học. Khoản có khiếu nại mở tiếp tục được giữ.</p>
    </div>
    <div className="flex flex-wrap gap-3">
      <button disabled={busy} onClick={release} className="rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 px-5 py-3 text-xs font-black uppercase tracking-wider text-white shadow-lg shadow-violet-600/30 transition hover:brightness-110 disabled:opacity-40">Giải phóng khoản đủ hạn</button>
      <button onClick={load} className="rounded-xl border border-white/10 bg-white/[0.04] px-5 py-3 text-xs font-black uppercase tracking-wider text-slate-200 hover:bg-white/[0.08] hover:border-white/20 transition">Đối soát lại</button>
      <Link to="/admin/payouts" className="inline-flex items-center px-4 py-3 text-xs font-black uppercase tracking-wider text-violet-400 hover:text-violet-300 transition">Yêu cầu rút tiền →</Link>
    </div>
    {error && <p role="alert" className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-xs font-semibold text-red-300">{error}</p>}
    {message && <p role="status" className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-xs font-semibold text-emerald-300">{message}</p>}
    <section className="space-y-3 rounded-2xl border border-white/10 bg-white/[0.03] p-5 backdrop-blur-xl shadow-sm">
      <h2 className="text-lg font-black text-white">Đối chiếu số dư đang giữ</h2>
      {!report && <p className="text-xs text-slate-400">Đang tải…</p>}
      {report && <>
        <p className="text-xs text-slate-400">Đã kiểm tra {report.checked} mentor. Đối soát chỉ báo cáo chênh lệch, không tự sửa số dư.</p>
        {report.mismatches.length === 0 ? <p className="text-xs font-semibold text-emerald-400">Số dư đang giữ khớp với các khoản chưa giải phóng.</p> : report.mismatches.map((m) => <div key={m.mentorId} className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs"><Link to={`/admin/mentors/${m.mentorId}`} className="font-bold text-violet-300">{m.name}</Link><p className="mt-1 text-slate-300">Trong ví: {formatVnd(m.actual)} · Theo giao dịch: {formatVnd(m.expected)} · Chênh lệch: {formatVnd(m.diff)}</p></div>)}
        <p className="text-xs text-slate-400">Khoản giải phóng lỗi quá 24 giờ: {report.alerts?.staleFailedClearances || 0} · Giao dịch đang giữ: {report.alerts?.heldPayments || 0}</p>
        <h3 className="pt-2 text-sm font-bold text-white">Đối chiếu tiền chờ rút</h3>
        {report.payoutMismatches?.length === 0 && <p className="text-xs font-semibold text-emerald-400">Khớp với các yêu cầu rút chưa hoàn tất.</p>}
        {report.payoutMismatches?.map((m) => <p key={m.mentorId} className="text-xs text-amber-300">{m.name}: trong ví {formatVnd(m.actual)}, theo yêu cầu rút {formatVnd(m.expected)}.</p>)}
        {report.alerts?.suspendedMentorsWithBalance.map((m) => <p key={m.mentorId} className="text-xs text-amber-300">{m.name} đang ngừng hoạt động và còn {formatVnd(m.availableBalance)} cần giải ngân. Mở chi tiết người dùng để tạo yêu cầu.</p>)}
      </>}
    </section>
    <section className="space-y-4 rounded-2xl border border-white/10 bg-white/[0.03] p-5 backdrop-blur-xl shadow-sm">
      <h2 className="text-lg font-black text-white">Tiền nhận khi tài khoản bị khóa</h2>
      <p className="text-xs text-slate-400">Chỉ xác nhận hoàn sau khi đã chuyển tiền qua ngân hàng; ghi đúng mã giao dịch và số tiền của từng khoản.</p>
      {held?.payments.length === 0 && <p className="text-xs text-slate-400">Không có khoản tiền đang chờ xử lý.</p>}
      {held?.payments.map((p) => <article key={p._id} className="flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-4"><div><Link className="font-bold text-violet-300" to={`/admin/users/${p.userId?._id}`}>{p.userId?.name || "Tài khoản đã đóng"}</Link><p className="text-xs text-slate-300">{formatVnd(p.amount)} · {p.type}</p><p className="text-[11px] text-slate-400">{p.heldReason}</p></div><button className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-xs font-semibold text-white hover:bg-white/10 transition" onClick={() => { setRefund(p); setReference(""); setReason(""); }}>Ghi nhận hoàn tiền</button></article>)}
      {held && <div className="flex items-center gap-4 text-xs text-slate-300"><button disabled={page === 1} onClick={() => setPage(page - 1)} className="rounded-lg border border-white/10 px-3 py-1.5 disabled:opacity-40 hover:bg-white/5">Trang trước</button><span>{page}/{held.pagination.totalPages}</span><button disabled={page >= held.pagination.totalPages} onClick={() => setPage(page + 1)} className="rounded-lg border border-white/10 px-3 py-1.5 disabled:opacity-40 hover:bg-white/5">Trang sau</button></div>}
    </section>
    {refund && <section role="dialog" aria-modal="false" aria-label="Ghi nhận hoàn tiền" className="space-y-4 rounded-2xl border border-violet-500/40 bg-[#0d061a] p-6 shadow-2xl backdrop-blur-2xl">
      <h2 className="text-lg font-bold text-white">Xác nhận đã hoàn {formatVnd(refund.amount)}</h2>
      <label className="block text-xs font-medium text-slate-300">Mã giao dịch ngân hàng<input value={reference} onChange={(e) => setReference(e.target.value)} className="mt-2 block w-full rounded-xl border border-white/10 bg-white/5 p-3 text-sm text-white focus:border-violet-500/50 outline-none" /></label>
      <label className="block text-xs font-medium text-slate-300">Lý do / ghi chú đối soát<textarea value={reason} onChange={(e) => setReason(e.target.value)} className="mt-2 block w-full rounded-xl border border-white/10 bg-white/5 p-3 text-sm text-white focus:border-violet-500/50 outline-none" /></label>
      <div className="flex gap-3">
        <button disabled={busy || reference.trim().length < 3 || reason.trim().length < 3} onClick={confirmRefund} className="rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 px-5 py-3 text-xs font-black uppercase tracking-wider text-white shadow-lg shadow-violet-600/30 disabled:opacity-40 hover:brightness-110">Xác nhận đã chuyển hoàn</button>
        <button disabled={busy} onClick={() => setRefund(null)} className="rounded-xl border border-white/10 px-4 py-3 text-xs font-semibold text-slate-300 hover:bg-white/5">Hủy</button>
      </div>
    </section>}
  </div>;
}
