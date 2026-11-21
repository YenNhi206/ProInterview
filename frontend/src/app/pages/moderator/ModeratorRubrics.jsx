import { useState, useEffect, useCallback } from "react";
import {
  FileText,
  CheckCircle2,
  XCircle,
  Building2,
  Clock,
  Layers,
  ChevronRight,
  Eye,
  RefreshCw,
  AlertCircle,
  Tag,
  Sliders,
} from "lucide-react";
import { companyApi } from "../../api/companyApi.js";
import { toastApiError, toastApiSuccess } from "../../utils/shared/apiToast.js";

const STATUS_TABS = [
  { id: "pending_review", label: "Chờ duyệt", dot: "bg-amber-500" },
  { id: "approved", label: "Đã duyệt", dot: "bg-emerald-500" },
  { id: "rejected", label: "Bị từ chối", dot: "bg-rose-500" },
  { id: "archived", label: "Đã lưu trữ", dot: "bg-slate-400" },
];

export function ModeratorRubrics() {
  const [activeTab, setActiveTab] = useState("pending_review");
  const [rubrics, setRubrics] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedRubric, setSelectedRubric] = useState(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectComment, setRejectComment] = useState("");
  const [processing, setProcessing] = useState(false);

  const fetchRubrics = useCallback(async () => {
    setLoading(true);
    try {
      const res = await companyApi.listModeratorRubrics({ status: activeTab });
      if (res.success) {
        setRubrics(res.rubrics || []);
      }
    } catch (err) {
      toastApiError(err, "Không thể tải danh sách rubric.");
    } finally {
      setLoading(false);
    }
  }, [activeTab]);

  useEffect(() => {
    fetchRubrics();
  }, [fetchRubrics]);

  const handleApprove = async (rubric) => {
    if (!window.confirm(`Xác nhận phê duyệt Rubric "${rubric.title}"?`)) return;
    setProcessing(true);
    try {
      const res = await companyApi.approveModeratorRubric(rubric._id);
      if (res.success) {
        toastApiSuccess("Đã phê duyệt rubric thành công!");
        setShowDetailModal(false);
        fetchRubrics();
      }
    } catch (err) {
      toastApiError(err, "Không thể phê duyệt rubric.");
    } finally {
      setProcessing(false);
    }
  };

  const handleOpenReject = (rubric) => {
    setSelectedRubric(rubric);
    setRejectComment("");
    setShowRejectModal(true);
  };

  const handleRejectConfirm = async (e) => {
    e.preventDefault();
    if (!rejectComment.trim() || !selectedRubric) return;
    setProcessing(true);
    try {
      const res = await companyApi.rejectModeratorRubric(selectedRubric._id, rejectComment);
      if (res.success) {
        toastApiSuccess("Đã từ chối rubric kèm ghi chú.");
        setShowRejectModal(false);
        setShowDetailModal(false);
        fetchRubrics();
      }
    } catch (err) {
      toastApiError(err, "Không thể từ chối rubric.");
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Title */}
      <div>
        <h1 className="text-2xl font-black tracking-tight text-slate-900">
          Duyệt Khung năng lực &amp; Rubric công ty
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Kiểm định chất lượng các bộ tiêu chí phỏng vấn theo khung SHRM/DDI trước khi áp dụng cho ứng viên luyện tập theo Job.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1.5 border-b border-slate-200/80 pb-2">
        {STATUS_TABS.map((tab) => {
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition-all ${
                active
                  ? "bg-[#6E35E8] text-white shadow-sm"
                  : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
              }`}
            >
              <span className={`h-2 w-2 rounded-full ${active ? "bg-white" : tab.dot}`} />
              <span>{tab.label}</span>
            </button>
          );
        })}

        <button
          type="button"
          onClick={fetchRubrics}
          className="ml-auto inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
        >
          <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
          <span>Làm mới</span>
        </button>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-slate-200/80 bg-slate-50/75 text-[11px] font-bold uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-5 py-3.5">Doanh nghiệp</th>
                <th className="px-5 py-3.5">Tiêu đề Rubric</th>
                <th className="px-5 py-3.5">Vị trí &amp; Phiên bản</th>
                <th className="px-5 py-3.5">Số tiêu chí</th>
                <th className="px-5 py-3.5">Ngày cập nhật</th>
                <th className="px-5 py-3.5 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400">
                    Đang tải danh sách rubric...
                  </td>
                </tr>
              ) : rubrics.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400">
                    Không có rubric nào trong mục này.
                  </td>
                </tr>
              ) : (
                rubrics.map((rubric) => (
                  <tr key={rubric._id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-2.5">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-violet-100 text-violet-700 font-bold">
                          <Building2 size={16} />
                        </div>
                        <span className="font-bold text-slate-900">{rubric.companyId?.name || "Công ty đối tác"}</span>
                      </div>
                    </td>

                    <td className="px-5 py-4">
                      <p className="font-bold text-slate-900 text-sm">{rubric.title}</p>
                      {rubric.description && (
                        <p className="text-[11px] text-slate-400 line-clamp-1 mt-0.5">{rubric.description}</p>
                      )}
                    </td>

                    <td className="px-5 py-4">
                      <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-700">
                        <Tag size={11} className="text-slate-400" />
                        {rubric.roleCategory}
                      </span>
                      <span className="ml-1.5 text-[11px] font-mono text-violet-700 font-bold">v{rubric.version}</span>
                    </td>

                    <td className="px-5 py-4">
                      <span className="inline-flex items-center gap-1 font-semibold text-slate-800">
                        <Sliders size={13} className="text-violet-500" />
                        {rubric.criteria?.length || 0} tiêu chí
                      </span>
                    </td>

                    <td className="px-5 py-4 text-slate-400 text-[11px]">
                      {new Date(rubric.updatedAt).toLocaleDateString("vi-VN")}
                    </td>

                    <td className="px-5 py-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedRubric(rubric);
                            setShowDetailModal(true);
                          }}
                          className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                        >
                          <Eye size={13} />
                          <span>Chi tiết</span>
                        </button>

                        {activeTab === "pending_review" && (
                          <>
                            <button
                              type="button"
                              onClick={() => handleApprove(rubric)}
                              disabled={processing}
                              className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-2.5 py-1.5 text-xs font-bold text-white hover:bg-emerald-700 disabled:opacity-50"
                            >
                              <CheckCircle2 size={13} />
                              <span>Duyệt</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => handleOpenReject(rubric)}
                              disabled={processing}
                              className="inline-flex items-center gap-1 rounded-lg bg-rose-600 px-2.5 py-1.5 text-xs font-bold text-white hover:bg-rose-700 disabled:opacity-50"
                            >
                              <XCircle size={13} />
                              <span>Từ chối</span>
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal xem chi tiết rubric (CO-15) */}
      {showDetailModal && selectedRubric && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
          <div className="w-full max-w-2xl max-h-[85vh] flex flex-col rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl">
            <div className="border-b border-slate-100 pb-4 mb-4">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-violet-600">
                    {selectedRubric.companyId?.name} • v{selectedRubric.version}
                  </span>
                  <h2 className="text-xl font-black text-slate-900">{selectedRubric.title}</h2>
                  <p className="text-xs text-slate-500 mt-0.5">Vị trí: {selectedRubric.roleCategory}</p>
                </div>

                <div className="text-right">
                  <span className="rounded-full bg-violet-100 px-3 py-1 text-xs font-bold text-violet-700">
                    Tổng 100% trọng số
                  </span>
                </div>
              </div>
            </div>

            {/* Danh sách tiêu chí */}
            <div className="flex-1 overflow-y-auto space-y-3 pr-1 custom-scrollbar">
              {selectedRubric.criteria?.map((crit, idx) => (
                <div key={idx} className="rounded-2xl border border-slate-200/80 bg-slate-50/50 p-4">
                  <div className="flex items-center justify-between mb-1">
                    <h3 className="font-bold text-slate-900 text-sm">
                      {idx + 1}. {crit.name}
                    </h3>
                    <span className="rounded-lg bg-violet-600/10 px-2.5 py-0.5 font-mono text-xs font-extrabold text-violet-700">
                      {crit.weight}%
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 font-mono">
                    SHRM key: {crit.shrmKey} · {crit.questionIds?.length || 0} câu hỏi áp dụng
                  </p>
                  {crit.description && (
                    <p className="mt-2 text-xs text-slate-700 leading-relaxed">{crit.description}</p>
                  )}
                  {/* CO-14: mô tả thang 0–5 — căn cứ chính để Platform Moderator thẩm định rubric. */}
                  <div className="mt-3 grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                    {["0", "1", "2", "3", "4", "5"].map((level) => (
                      <div key={level} className="rounded-lg border border-slate-200/80 bg-white p-2 text-[11px]">
                        <span className="font-bold text-violet-700">Mức {level}: </span>
                        <span className="text-slate-700">{crit.levels?.[level] || "Chưa có mô tả"}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {/* Footer actions */}
            <div className="border-t border-slate-100 pt-4 mt-4 flex items-center justify-between">
              <button
                type="button"
                onClick={() => setShowDetailModal(false)}
                className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
              >
                Đóng
              </button>

              {activeTab === "pending_review" && (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleOpenReject(selectedRubric)}
                    className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2 text-xs font-bold text-rose-700 hover:bg-rose-100"
                  >
                    Từ chối
                  </button>
                  <button
                    type="button"
                    onClick={() => handleApprove(selectedRubric)}
                    className="rounded-xl bg-emerald-600 px-5 py-2 text-xs font-bold text-white hover:bg-emerald-700"
                  >
                    Phê duyệt Rubric
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal nhập lý do từ chối */}
      {showRejectModal && selectedRubric && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl">
            <h2 className="text-lg font-black text-slate-900 mb-1">Từ chối Rubric</h2>
            <p className="text-xs text-slate-500 mb-4">
              Nhập lý do hoặc hướng dẫn chỉnh sửa để gửi lại cho đối tác doanh nghiệp.
            </p>

            <form onSubmit={handleRejectConfirm} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Lý do từ chối *</label>
                <textarea
                  required
                  rows={4}
                  placeholder="Ví dụ: Tiêu chí 2 mô tả còn chung chung, cần bổ sung rõ các mức thang điểm theo chuẩn..."
                  value={rejectComment}
                  onChange={(e) => setRejectComment(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 p-3 text-xs font-medium focus:border-violet-500 focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowRejectModal(false)}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={processing}
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
