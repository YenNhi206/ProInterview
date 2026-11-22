import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  FileQuestion,
  Plus,
  Sparkles,
  Search,
  CheckCircle2,
  XCircle,
  Edit3,
  History,
  Filter,
  CheckSquare,
  Square,
  Loader2,
  RefreshCw,
  Building2,
  ChevronDown,
  Layers,
  HelpCircle,
  AlertCircle,
  Tag,
  Check,
} from "lucide-react";
import { companyApi } from "../../api/companyApi.js";
import { toastApiError, toastApiSuccess } from "../../utils/shared/apiToast.js";
import { useRoleCategories } from "../../hooks/useRoleCategories.js";

const STATUS_FILTERS = [
  { id: "", label: "Tất cả trạng thái" },
  { id: "approved", label: "Đã duyệt", dot: "bg-emerald-400" },
  { id: "draft", label: "Bản nháp", dot: "bg-amber-400" },
  { id: "rejected", label: "Đã từ chối", dot: "bg-rose-400" },
];

export function CompanyQuestions() {
  // Danh sách vị trí dùng chung từ GET /api/role-categories (config/roleCategories.json ở backend).
  const { roleCategories } = useRoleCategories();
  const ROLE_CATEGORIES = useMemo(
    () => [{ id: "", label: "Tất cả vị trí" }, ...roleCategories.map((r) => ({ id: r.key, label: r.nameVi }))],
    [roleCategories],
  );
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState("");
  const [selectedRole, setSelectedRole] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("");

  // Batch Selection
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [batchActionLoading, setBatchActionLoading] = useState(false);

  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [editQuestion, setEditQuestion] = useState(null);
  const [viewHistoryQuestion, setViewHistoryQuestion] = useState(null);

  // Form states
  const [createForm, setCreateForm] = useState({
    text: "",
    roleCategory: "software_engineer",
    competencyId: "technical_learning",
    layer: "technical",
    seniority: "middle",
    difficulty: "medium",
  });
  const [creating, setCreating] = useState(false);

  // Starter pack role
  const [starterRole, setStarterRole] = useState("software_engineer");
  const [generating, setGenerating] = useState(false);
  const [generateCount, setGenerateCount] = useState(10);

  const fetchQuestions = useCallback(async () => {
    setLoading(true);
    try {
      const res = await companyApi.listQuestions({
        roleCategory: selectedRole,
        status: selectedStatus,
        limit: 100,
      });
      if (res.success) {
        setQuestions(res.questions || []);
        setSelectedIds(new Set()); // Reset selection on reload
      }
    } catch (err) {
      toastApiError(err, "Không thể tải danh sách câu hỏi.");
    } finally {
      setLoading(false);
    }
  }, [selectedRole, selectedStatus]);

  useEffect(() => {
    fetchQuestions();
  }, [fetchQuestions]);

  // Client search filter
  const filteredQuestions = useMemo(() => {
    if (!search.trim()) return questions;
    const term = search.toLowerCase();
    return questions.filter(
      (q) =>
        q.text?.toLowerCase().includes(term) ||
        q.roleCategory?.toLowerCase().includes(term) ||
        q.competencyId?.toLowerCase().includes(term)
    );
  }, [questions, search]);

  // Toggle selection
  const handleToggleSelect = (id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSelectAll = () => {
    if (selectedIds.size === filteredQuestions.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredQuestions.map((q) => q._id)));
    }
  };

  // Actions
  const handleApprove = async (id) => {
    try {
      const res = await companyApi.approveQuestion(id);
      if (res.success) {
        toastApiSuccess("Đã duyệt câu hỏi thành công.");
        fetchQuestions();
      }
    } catch (err) {
      toastApiError(err, "Không thể duyệt câu hỏi.");
    }
  };

  const handleReject = async (id) => {
    const reason = window.prompt("Nhập lý do từ chối câu hỏi (tùy chọn):", "");
    if (reason === null) return;
    try {
      const res = await companyApi.rejectQuestion(id, reason);
      if (res.success) {
        toastApiSuccess("Đã từ chối câu hỏi.");
        fetchQuestions();
      }
    } catch (err) {
      toastApiError(err, "Không thể từ chối câu hỏi.");
    }
  };

  const handleBatchApprove = async () => {
    if (selectedIds.size === 0) return;
    if (!window.confirm(`Bạn có chắc muốn duyệt ${selectedIds.size} câu hỏi đã chọn?`)) return;

    setBatchActionLoading(true);
    try {
      const res = await companyApi.batchApproveQuestions(Array.from(selectedIds));
      if (res.success) {
        toastApiSuccess(res.message || "Duyệt hàng loạt thành công!");
        fetchQuestions();
      }
    } catch (err) {
      toastApiError(err, "Có lỗi xảy ra khi duyệt hàng loạt.");
    } finally {
      setBatchActionLoading(false);
    }
  };

  const handleBatchReject = async () => {
    if (selectedIds.size === 0) return;
    const reason = window.prompt("Nhập lý do từ chối hàng loạt (tùy chọn):", "");
    if (reason === null) return;

    setBatchActionLoading(true);
    try {
      const res = await companyApi.batchRejectQuestions(Array.from(selectedIds), reason);
      if (res.success) {
        toastApiSuccess(res.message || "Từ chối hàng loạt thành công!");
        fetchQuestions();
      }
    } catch (err) {
      toastApiError(err, "Có lỗi xảy ra khi từ chối hàng loạt.");
    } finally {
      setBatchActionLoading(false);
    }
  };

  const handleCreateQuestion = async (e) => {
    e.preventDefault();
    if (!createForm.text.trim()) return;

    setCreating(true);
    try {
      const res = await companyApi.createQuestion(createForm);
      if (res.success) {
        toastApiSuccess("Thêm câu hỏi mới thành công!");
        setShowCreateModal(false);
        setCreateForm({
          text: "",
          roleCategory: "software_engineer",
          competencyId: "technical_learning",
          layer: "technical",
          seniority: "middle",
          difficulty: "medium",
        });
        fetchQuestions();
      }
    } catch (err) {
      toastApiError(err, "Không thể thêm câu hỏi.");
    } finally {
      setCreating(false);
    }
  };

  const handleGenerateStarter = async () => {
    setGenerating(true);
    try {
      const res = await companyApi.generateQuestions({ roleCategory: starterRole, count: generateCount });
      if (res.success) {
        toastApiSuccess(res.message || "Đã sinh bộ câu hỏi nháp.");
        setShowGenerateModal(false);
        fetchQuestions();
      }
    } catch (err) {
      toastApiError(err, "Không thể sinh bộ câu hỏi.");
    } finally {
      setGenerating(false);
    }
  };

  const handleSaveEdit = async (e) => {
    e.preventDefault();
    if (!editQuestion || !editQuestion.text.trim()) return;

    try {
      const res = await companyApi.editQuestion(editQuestion._id, {
        text: editQuestion.text,
        roleCategory: editQuestion.roleCategory,
        difficulty: editQuestion.difficulty,
        reason: editQuestion.editReason || "Chỉnh sửa bởi Company Moderator",
      });
      if (res.success) {
        toastApiSuccess("Cập nhật câu hỏi thành công!");
        setEditQuestion(null);
        fetchQuestions();
      }
    } catch (err) {
      toastApiError(err, "Không thể cập nhật câu hỏi.");
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2.5">
            <FileQuestion className="size-6 text-indigo-400" />
            Ngân hàng câu hỏi công ty
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            Quản lý, biên tập và phê duyệt danh sách câu hỏi phỏng vấn chuẩn hóa cho các vị trí tuyển dụng.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={() => setShowGenerateModal(true)}
            className="inline-flex items-center gap-2 rounded-xl border border-indigo-500/30 bg-indigo-500/10 px-3.5 py-2.5 text-xs font-semibold text-indigo-300 transition hover:bg-indigo-500/20 shadow-sm"
          >
            <Sparkles className="size-4" />
            Sinh bộ câu bằng AI
          </button>
          <button
            onClick={() => setShowCreateModal(true)}
            className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-xs font-semibold text-white shadow-lg shadow-indigo-600/30 transition hover:bg-indigo-500"
          >
            <Plus className="size-4" />
            Thêm câu hỏi mới
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col md:flex-row md:items-center gap-3 rounded-2xl border border-slate-800 bg-slate-900/60 p-3.5 backdrop-blur-xl">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-2.5 size-4 text-slate-500" />
          <input
            type="text"
            placeholder="Tìm kiếm nội dung câu hỏi, vị trí..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-xl border border-slate-800 bg-slate-950/80 pl-9 pr-4 py-2 text-xs text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Role Filter */}
          <select
            value={selectedRole}
            onChange={(e) => setSelectedRole(e.target.value)}
            className="rounded-xl border border-slate-800 bg-slate-950/80 px-3 py-2 text-xs text-slate-300 focus:border-indigo-500 focus:outline-none"
          >
            {ROLE_CATEGORIES.map((role) => (
              <option key={role.id} value={role.id}>
                {role.label}
              </option>
            ))}
          </select>

          {/* Status Filter */}
          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="rounded-xl border border-slate-800 bg-slate-950/80 px-3 py-2 text-xs text-slate-300 focus:border-indigo-500 focus:outline-none"
          >
            {STATUS_FILTERS.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>

          <button
            onClick={fetchQuestions}
            title="Làm mới"
            className="rounded-xl border border-slate-800 bg-slate-950/80 p-2 text-slate-400 hover:text-white transition"
          >
            <RefreshCw className="size-4" />
          </button>
        </div>
      </div>

      {/* Batch Actions Bar (when items selected) */}
      {selectedIds.size > 0 && (
        <div className="flex items-center justify-between rounded-xl border border-indigo-500/30 bg-indigo-950/40 px-4 py-2.5 text-xs backdrop-blur-xl animate-in fade-in duration-200">
          <div className="flex items-center gap-2 font-medium text-indigo-300">
            <CheckSquare className="size-4" />
            Đã chọn <strong>{selectedIds.size}</strong> câu hỏi
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleBatchApprove}
              disabled={batchActionLoading}
              className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 font-semibold text-white shadow-sm hover:bg-emerald-500 transition disabled:opacity-50"
            >
              <CheckCircle2 className="size-3.5" />
              Duyệt đã chọn
            </button>
            <button
              onClick={handleBatchReject}
              disabled={batchActionLoading}
              className="inline-flex items-center gap-1.5 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-1.5 font-semibold text-rose-300 hover:bg-rose-500/20 transition disabled:opacity-50"
            >
              <XCircle className="size-3.5" />
              Từ chối đã chọn
            </button>
            <button
              onClick={() => setSelectedIds(new Set())}
              className="rounded-lg px-2.5 py-1.5 text-slate-400 hover:text-white"
            >
              Bỏ chọn
            </button>
          </div>
        </div>
      )}

      {/* Questions Table */}
      <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/60 backdrop-blur-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-slate-800 bg-slate-950/60 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              <tr>
                <th className="py-3 pl-4 pr-2 w-10 text-center">
                  <button
                    onClick={handleSelectAll}
                    className="text-slate-400 hover:text-white"
                  >
                    {selectedIds.size > 0 && selectedIds.size === filteredQuestions.length ? (
                      <CheckSquare className="size-4 text-indigo-400" />
                    ) : (
                      <Square className="size-4" />
                    )}
                  </button>
                </th>
                <th className="py-3 px-3 min-w-[320px]">Nội dung câu hỏi</th>
                <th className="py-3 px-3">Vị trí</th>
                <th className="py-3 px-3">Năng lực</th>
                <th className="py-3 px-3">Độ khó</th>
                <th className="py-3 px-3">Trạng thái</th>
                <th className="py-3 pl-3 pr-4 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    <Loader2 className="mx-auto size-6 animate-spin text-indigo-500" />
                    <span className="mt-2 block text-xs">Đang tải danh sách câu hỏi...</span>
                  </td>
                </tr>
              ) : filteredQuestions.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    <HelpCircle className="mx-auto size-8 text-slate-600" />
                    <p className="mt-2 font-medium text-slate-300">Chưa có câu hỏi nào</p>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Bạn có thể bấm "Sinh bộ câu bằng AI" hoặc "Thêm câu hỏi mới" để bắt đầu.
                    </p>
                  </td>
                </tr>
              ) : (
                filteredQuestions.map((q) => {
                  const isSelected = selectedIds.has(q._id);
                  const isApproved = q.status === "approved";
                  const isRejected = q.status === "rejected";
                  const isDraft = q.status === "draft";

                  return (
                    <tr
                      key={q._id}
                      className={`transition hover:bg-slate-800/40 ${
                        isSelected ? "bg-indigo-950/20" : ""
                      }`}
                    >
                      <td className="py-3.5 pl-4 pr-2 text-center">
                        <button
                          onClick={() => handleToggleSelect(q._id)}
                          className="text-slate-400 hover:text-white"
                        >
                          {isSelected ? (
                            <CheckSquare className="size-4 text-indigo-400" />
                          ) : (
                            <Square className="size-4" />
                          )}
                        </button>
                      </td>
                      <td className="py-3.5 px-3">
                        <p className="font-medium text-slate-100 leading-snug">
                          {q.text}
                        </p>
                        {q.history && q.history.length > 1 && (
                          <span className="mt-1 inline-flex items-center gap-1 text-[10px] text-slate-400">
                            <History className="size-3" /> {q.history.length} lần chỉnh sửa
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-3 whitespace-nowrap">
                        <span className="rounded-md bg-slate-800 px-2 py-0.5 text-[11px] font-medium text-slate-300">
                          {q.roleCategory || "General"}
                        </span>
                      </td>
                      <td className="py-3.5 px-3 whitespace-nowrap text-slate-400">
                        {q.competencyId || "Chung"}
                      </td>
                      <td className="py-3.5 px-3 whitespace-nowrap">
                        <span
                          className={`rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase ${
                            q.difficulty === "hard"
                              ? "bg-rose-500/10 text-rose-400"
                              : q.difficulty === "easy"
                              ? "bg-emerald-500/10 text-emerald-400"
                              : "bg-amber-500/10 text-amber-400"
                          }`}
                        >
                          {q.difficulty || "medium"}
                        </span>
                      </td>
                      <td className="py-3.5 px-3 whitespace-nowrap">
                        {isApproved && (
                          <span className="inline-flex items-center gap-1 text-emerald-400 font-medium">
                            <CheckCircle2 className="size-3.5" /> Đã duyệt
                          </span>
                        )}
                        {isDraft && (
                          <span className="inline-flex items-center gap-1 text-amber-400 font-medium">
                            <span className="size-1.5 rounded-full bg-amber-400 animate-pulse" />
                            Bản nháp
                          </span>
                        )}
                        {isRejected && (
                          <span className="inline-flex items-center gap-1 text-rose-400 font-medium">
                            <XCircle className="size-3.5" /> Từ chối
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 pl-3 pr-4 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-1.5">
                          {/* Approve btn */}
                          {!isApproved && (
                            <button
                              onClick={() => handleApprove(q._id)}
                              title="Duyệt câu hỏi"
                              className="rounded-lg p-1.5 text-slate-400 hover:bg-emerald-500/10 hover:text-emerald-400 transition"
                            >
                              <CheckCircle2 className="size-4" />
                            </button>
                          )}

                          {/* Reject btn */}
                          {!isRejected && (
                            <button
                              onClick={() => handleReject(q._id)}
                              title="Từ chối câu hỏi"
                              className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-500/10 hover:text-rose-400 transition"
                            >
                              <XCircle className="size-4" />
                            </button>
                          )}

                          {/* Edit btn */}
                          <button
                            onClick={() =>
                              setEditQuestion({
                                ...q,
                                editReason: "",
                              })
                            }
                            title="Chỉnh sửa"
                            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white transition"
                          >
                            <Edit3 className="size-4" />
                          </button>

                          {/* History btn */}
                          {q.history && q.history.length > 0 && (
                            <button
                              onClick={() => setViewHistoryQuestion(q)}
                              title="Xem lịch sử thay đổi"
                              className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-indigo-400 transition"
                            >
                              <History className="size-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal: AI sinh bộ câu nháp (CO-04) */}
      {showGenerateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl">
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-400">
                <Sparkles className="size-5" />
              </div>
              <div>
                <h3 className="font-bold text-white text-base">Sinh bộ câu bằng AI</h3>
                <p className="text-xs text-slate-400">AI soạn 8–12 câu nháp theo khung SHRM/DDI của vị trí</p>
              </div>
            </div>

            <div className="mt-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Chọn vị trí cần sinh câu hỏi
                </label>
                <select
                  value={starterRole}
                  onChange={(e) => setStarterRole(e.target.value)}
                  className="mt-1.5 w-full rounded-xl border border-slate-800 bg-slate-950 px-3.5 py-2.5 text-sm text-white focus:border-indigo-500 focus:outline-none"
                >
                  {ROLE_CATEGORIES.filter((r) => r.id).map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Số câu cần sinh
                </label>
                <select
                  value={generateCount}
                  onChange={(e) => setGenerateCount(Number(e.target.value))}
                  className="mt-1.5 w-full rounded-xl border border-slate-800 bg-slate-950 px-3.5 py-2.5 text-sm text-white focus:border-indigo-500 focus:outline-none"
                >
                  {[8, 9, 10, 11, 12].map((n) => (
                    <option key={n} value={n}>
                      {n} câu
                    </option>
                  ))}
                </select>
              </div>

              <div className="rounded-xl bg-indigo-950/30 border border-indigo-500/20 p-3 text-xs text-indigo-300">
                <p>
                  Câu được tạo ở trạng thái <strong>Bản nháp (draft)</strong>. Bạn xem lại, sửa và duyệt trước khi đưa vào phỏng vấn. Câu trùng với câu đã có của công ty sẽ được bỏ qua. Việc sinh mất khoảng 20–60 giây.
                </p>
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setShowGenerateModal(false)}
                className="rounded-xl border border-slate-700 px-4 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-800"
              >
                Hủy
              </button>
              <button
                type="button"
                disabled={generating}
                onClick={handleGenerateStarter}
                className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-semibold text-white shadow-lg shadow-indigo-600/30 hover:bg-indigo-500 disabled:opacity-50"
              >
                {generating ? (
                  <>
                    <Loader2 className="size-3.5 animate-spin" />
                    Đang sinh câu hỏi...
                  </>
                ) : (
                  <>
                    <Sparkles className="size-3.5" />
                    Bắt đầu sinh
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Thêm câu hỏi mới */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-lg rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl">
            <h3 className="font-bold text-white text-base flex items-center gap-2">
              <Plus className="size-5 text-indigo-400" />
              Thêm câu hỏi mới vào ngân hàng
            </h3>
            <p className="mt-1 text-xs text-slate-400">
              Câu hỏi tạo trực tiếp bởi Company Moderator sẽ được tự động duyệt cho công ty.
            </p>

            <form onSubmit={handleCreateQuestion} className="mt-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Nội dung câu hỏi *
                </label>
                <textarea
                  rows={3}
                  required
                  placeholder="Nhập nội dung câu hỏi phỏng vấn..."
                  value={createForm.text}
                  onChange={(e) => setCreateForm({ ...createForm, text: e.target.value })}
                  className="mt-1.5 w-full rounded-xl border border-slate-800 bg-slate-950 p-3 text-sm text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400">
                    Vị trí
                  </label>
                  <select
                    value={createForm.roleCategory}
                    onChange={(e) => setCreateForm({ ...createForm, roleCategory: e.target.value })}
                    className="mt-1.5 w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-white focus:border-indigo-500 focus:outline-none"
                  >
                    {ROLE_CATEGORIES.filter((r) => r.id).map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400">
                    Độ khó
                  </label>
                  <select
                    value={createForm.difficulty}
                    onChange={(e) => setCreateForm({ ...createForm, difficulty: e.target.value })}
                    className="mt-1.5 w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-white focus:border-indigo-500 focus:outline-none"
                  >
                    <option value="easy">Easy (Dễ)</option>
                    <option value="medium">Medium (Trung bình)</option>
                    <option value="hard">Hard (Khó)</option>
                  </select>
                </div>
              </div>

              <div className="mt-6 flex justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="rounded-xl border border-slate-700 px-4 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-800"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-semibold text-white shadow-lg shadow-indigo-600/30 hover:bg-indigo-500 disabled:opacity-50"
                >
                  {creating ? <Loader2 className="size-3.5 animate-spin" /> : <Check className="size-3.5" />}
                  Lưu câu hỏi
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Chỉnh sửa câu hỏi */}
      {editQuestion && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-lg rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl">
            <h3 className="font-bold text-white text-base flex items-center gap-2">
              <Edit3 className="size-5 text-indigo-400" />
              Chỉnh sửa câu hỏi
            </h3>
            <p className="mt-1 text-xs text-slate-400">
              Mọi thay đổi sẽ được lưu vào lịch sử kiểm định (history tracking).
            </p>

            <form onSubmit={handleSaveEdit} className="mt-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Nội dung câu hỏi *
                </label>
                <textarea
                  rows={3}
                  required
                  value={editQuestion.text}
                  onChange={(e) => setEditQuestion({ ...editQuestion, text: e.target.value })}
                  className="mt-1.5 w-full rounded-xl border border-slate-800 bg-slate-950 p-3 text-sm text-white focus:border-indigo-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400">
                    Vị trí
                  </label>
                  <select
                    value={editQuestion.roleCategory || "software_engineer"}
                    onChange={(e) => setEditQuestion({ ...editQuestion, roleCategory: e.target.value })}
                    className="mt-1.5 w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-white focus:border-indigo-500 focus:outline-none"
                  >
                    {ROLE_CATEGORIES.filter((r) => r.id).map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400">
                    Độ khó
                  </label>
                  <select
                    value={editQuestion.difficulty || "medium"}
                    onChange={(e) => setEditQuestion({ ...editQuestion, difficulty: e.target.value })}
                    className="mt-1.5 w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-white focus:border-indigo-500 focus:outline-none"
                  >
                    <option value="easy">Easy (Dễ)</option>
                    <option value="medium">Medium (Trung bình)</option>
                    <option value="hard">Hard (Khó)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Ghi chú lý do chỉnh sửa
                </label>
                <input
                  type="text"
                  placeholder="Ví dụ: Làm rõ yêu cầu kỹ thuật..."
                  value={editQuestion.editReason}
                  onChange={(e) => setEditQuestion({ ...editQuestion, editReason: e.target.value })}
                  className="mt-1.5 w-full rounded-xl border border-slate-800 bg-slate-950 px-3.5 py-2 text-xs text-white focus:border-indigo-500 focus:outline-none"
                />
              </div>

              <div className="mt-6 flex justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setEditQuestion(null)}
                  className="rounded-xl border border-slate-700 px-4 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-800"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-semibold text-white shadow-lg shadow-indigo-600/30 hover:bg-indigo-500"
                >
                  Lưu thay đổi
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Xem lịch sử thay đổi */}
      {viewHistoryQuestion && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-lg rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-white text-base flex items-center gap-2">
                <History className="size-5 text-indigo-400" />
                Lịch sử chỉnh sửa câu hỏi
              </h3>
              <button
                onClick={() => setViewHistoryQuestion(null)}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <div className="mt-4 max-h-80 overflow-y-auto space-y-3 pr-1">
              {viewHistoryQuestion.history?.map((h, idx) => (
                <div
                  key={idx}
                  className="rounded-xl border border-slate-800 bg-slate-950/60 p-3 text-xs"
                >
                  <div className="flex items-center justify-between text-slate-400">
                    <span className="font-semibold uppercase text-indigo-300">
                      Hành động: {h.action}
                    </span>
                    <span>{h.at ? new Date(h.at).toLocaleString("vi-VN") : "N/A"}</span>
                  </div>
                  {h.reason && <p className="mt-1 text-slate-300">Lý do: {h.reason}</p>}
                  {h.previousQuestion && (
                    <div className="mt-2 rounded bg-slate-900 p-2 text-slate-400 border border-slate-800">
                      <span className="text-[10px] uppercase font-bold text-slate-500 block mb-0.5">
                        Nội dung trước:
                      </span>
                      {h.previousQuestion}
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div className="mt-5 flex justify-end">
              <button
                onClick={() => setViewHistoryQuestion(null)}
                className="rounded-xl border border-slate-700 px-4 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-800"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
