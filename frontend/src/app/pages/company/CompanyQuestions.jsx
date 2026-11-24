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
  Upload,
  Briefcase,
  Clock,
} from "lucide-react";
import { companyApi } from "../../api/companyApi.js";
import { competenciesApi } from "../../api/competenciesApi.js";
import { tryApi, toastApiSuccess as toastSuccess } from "../../utils/shared/apiToast.js";
import { useRoleCategories } from "../../hooks/useRoleCategories.js";
import { parseQuestionUploadText, QUESTION_UPLOAD_MAX } from "../../utils/company/questionUpload.js";

// Vòng đời câu doanh nghiệp (quyết định CO-16): nháp → công ty duyệt → chờ Platform Moderator → đang dùng.
const STATUS_FILTERS = [
  { id: "", label: "Tất cả trạng thái" },
  { id: "draft", label: "Bản nháp" },
  { id: "pending_platform_review", label: "Chờ Platform Mod duyệt" },
  { id: "approved", label: "Đang dùng (đã duyệt)" },
  { id: "rejected", label: "Đã từ chối" },
];
/** Công ty bấm duyệt được: câu nháp hoặc câu đã từ chối muốn gửi lại. */
const APPROVABLE = new Set(["draft", "rejected"]);
const UPLOAD_MAX = QUESTION_UPLOAD_MAX;
const DEFAULT_COMPETENCY = "technical_learning";

const EMPTY_CREATE_FORM = {
  text: "",
  roleCategory: "software_engineer",
  competencyId: DEFAULT_COMPETENCY,
  jobPostId: "",
};

export function CompanyQuestions() {
  // Danh sách vị trí dùng chung từ GET /api/role-categories (config/roleCategories.json ở backend).
  const { roleCategories, labelOf: roleLabel } = useRoleCategories();
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
  // "" = mọi job, "none" = câu không gắn job, còn lại = id job (CO-13)
  const [selectedJob, setSelectedJob] = useState("");
  const [jobs, setJobs] = useState([]);
  const jobTitleById = useMemo(() => new Map(jobs.map((j) => [j.id, j.title])), [jobs]);

  // Tải câu lên theo job (CO-05, CO-13)
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadForm, setUploadForm] = useState({ jobPostId: "", text: "", competencyId: DEFAULT_COMPETENCY, asDraft: false });
  const [uploadErrors, setUploadErrors] = useState([]);
  const [uploading, setUploading] = useState(false);
  const uploadLines = useMemo(() => parseQuestionUploadText(uploadForm.text), [uploadForm.text]);

  // Batch Selection
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [batchActionLoading, setBatchActionLoading] = useState(false);

  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [editQuestion, setEditQuestion] = useState(null);
  const [viewHistoryQuestion, setViewHistoryQuestion] = useState(null);

  // Form states
  const [createForm, setCreateForm] = useState(EMPTY_CREATE_FORM);
  const [creating, setCreating] = useState(false);

  // Starter pack role
  const [starterRole, setStarterRole] = useState("software_engineer");
  const [generating, setGenerating] = useState(false);
  const [generateCount, setGenerateCount] = useState(10);

  // `authedFetch` không throw: lỗi trả về `{ success: false, error }`, tryApi hiện toast.
  const fetchQuestions = useCallback(async () => {
    setLoading(true);
    const res = await tryApi(
      () =>
        companyApi.listQuestions({
          roleCategory: selectedRole,
          status: selectedStatus,
          jobPostId: selectedJob,
          limit: 100,
        }),
      { fallback: "Không thể tải danh sách câu hỏi." },
    );
    if (res.success) {
      setQuestions(res.questions || []);
      setSelectedIds(new Set()); // Reset selection on reload
    }
    setLoading(false);
  }, [selectedRole, selectedStatus, selectedJob]);

  useEffect(() => {
    fetchQuestions();
  }, [fetchQuestions]);

  // Năng lực SHRM/DDI (LP-01) để chọn khi tải câu lên; chỉ key chưa ngừng dùng.
  const [competencies, setCompetencies] = useState([]);

  useEffect(() => {
    let alive = true;
    tryApi(() => companyApi.listJobs({ limit: 100 }), { silent: true }).then((res) => {
      // Job đã đóng / bị ẩn vẫn liệt kê để lọc câu cũ; tải câu lên chỉ cho job nháp / đang đăng.
      if (alive && res.success) setJobs(res.jobs || []);
    });
    competenciesApi.getFramework().then((res) => {
      if (alive && res.success) setCompetencies((res.framework?.competencies || []).filter((c) => !c.deprecated));
    });
    return () => {
      alive = false;
    };
  }, []);

  const uploadableJobs = useMemo(() => jobs.filter((j) => ["draft", "published"].includes(j.status)), [jobs]);

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
    const res = await tryApi(() => companyApi.approveQuestion(id), { fallback: "Không thể duyệt câu hỏi." });
    if (res.success) {
      toastSuccess(res.message || "Đã duyệt câu hỏi, chờ Platform Moderator duyệt.");
      fetchQuestions();
    }
  };

  const handleReject = async (id) => {
    const reason = window.prompt("Nhập lý do từ chối câu hỏi (tùy chọn):", "");
    if (reason === null) return;
    const res = await tryApi(() => companyApi.rejectQuestion(id, reason), {
      fallback: "Không thể từ chối câu hỏi.",
      successMessage: "Đã từ chối câu hỏi.",
    });
    if (res.success) fetchQuestions();
  };

  const handleBatchApprove = async () => {
    if (selectedIds.size === 0) return;
    if (!window.confirm(`Duyệt ${selectedIds.size} câu hỏi đã chọn? Câu đã duyệt sẽ chờ Platform Moderator duyệt.`)) return;

    setBatchActionLoading(true);
    const res = await tryApi(() => companyApi.batchApproveQuestions(Array.from(selectedIds)), {
      fallback: "Có lỗi xảy ra khi duyệt hàng loạt.",
    });
    setBatchActionLoading(false);
    if (res.success) {
      toastSuccess(res.message || "Duyệt hàng loạt thành công.");
      fetchQuestions();
    }
  };

  const handleBatchReject = async () => {
    if (selectedIds.size === 0) return;
    const reason = window.prompt("Nhập lý do từ chối hàng loạt (tùy chọn):", "");
    if (reason === null) return;

    setBatchActionLoading(true);
    const res = await tryApi(() => companyApi.batchRejectQuestions(Array.from(selectedIds), reason), {
      fallback: "Có lỗi xảy ra khi từ chối hàng loạt.",
    });
    setBatchActionLoading(false);
    if (res.success) {
      toastSuccess(res.message || "Từ chối hàng loạt thành công.");
      fetchQuestions();
    }
  };

  const handleCreateQuestion = async (e) => {
    e.preventDefault();
    if (!createForm.text.trim()) return;

    setCreating(true);
    const body = { text: createForm.text, competencyId: createForm.competencyId };
    // Có job thì vị trí lấy theo job ở backend.
    if (createForm.jobPostId) body.jobPostId = createForm.jobPostId;
    else body.roleCategory = createForm.roleCategory;
    const res = await tryApi(() => companyApi.createQuestion(body), {
      fallback: "Không thể thêm câu hỏi.",
      successMessage: "Đã thêm câu hỏi, chờ Platform Moderator duyệt.",
    });
    setCreating(false);
    if (res.success) {
      setShowCreateModal(false);
      setCreateForm(EMPTY_CREATE_FORM);
      fetchQuestions();
    }
  };

  const openUpload = () => {
    setUploadErrors([]);
    setUploadForm((f) => ({
      ...f,
      jobPostId: f.jobPostId || (selectedJob && selectedJob !== "none" ? selectedJob : uploadableJobs[0]?.id || ""),
    }));
    setShowUploadModal(true);
  };

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!uploadForm.jobPostId || uploadLines.length === 0 || uploadLines.length > UPLOAD_MAX) return;

    setUploading(true);
    setUploadErrors([]);
    const res = await tryApi(
      () =>
        companyApi.uploadQuestions({
          jobPostId: uploadForm.jobPostId,
          questions: uploadLines.map((text) => ({ text, competencyId: uploadForm.competencyId })),
          ...(uploadForm.asDraft ? { status: "draft" } : {}),
        }),
      { fallback: "Không thể tải câu hỏi lên." },
    );
    setUploading(false);
    if (res.success) {
      toastSuccess(res.message || `Đã tải lên ${res.count} câu hỏi.`);
      setShowUploadModal(false);
      setUploadForm((f) => ({ ...f, text: "" }));
      fetchQuestions();
    } else if (res.errors?.length) {
      setUploadErrors(res.errors);
    }
  };

  const handleGenerateStarter = async () => {
    setGenerating(true);
    const res = await tryApi(
      () => companyApi.generateQuestions({ roleCategory: starterRole, count: generateCount }),
      { fallback: "Không thể sinh bộ câu hỏi." },
    );
    setGenerating(false);
    if (res.success) {
      toastSuccess(res.message || "Đã sinh bộ câu hỏi nháp.");
      setShowGenerateModal(false);
      fetchQuestions();
    }
  };

  const handleSaveEdit = async (e) => {
    e.preventDefault();
    if (!editQuestion || !editQuestion.text.trim()) return;

    const res = await tryApi(
      () =>
        companyApi.editQuestion(editQuestion._id, {
          text: editQuestion.text,
          roleCategory: editQuestion.roleCategory,
          jobPostId: editQuestion.jobPostId || null,
          reason: editQuestion.editReason || "Chỉnh sửa bởi Company Moderator",
        }),
      { fallback: "Không thể cập nhật câu hỏi." },
    );
    if (res.success) {
      const backToReview = editQuestion.status === "approved" && res.question?.status === "pending_platform_review";
      toastSuccess(backToReview ? "Đã lưu. Câu đổi nội dung nên cần Platform Moderator duyệt lại." : "Cập nhật câu hỏi thành công.");
      setEditQuestion(null);
      fetchQuestions();
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
            onClick={openUpload}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-900/60 px-3.5 py-2.5 text-xs font-semibold text-slate-200 transition hover:bg-slate-800 shadow-sm"
          >
            <Upload className="size-4" />
            Tải câu theo job
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

          {/* Job Filter (CO-13) */}
          <select
            value={selectedJob}
            onChange={(e) => setSelectedJob(e.target.value)}
            aria-label="Lọc theo tin tuyển dụng"
            className="max-w-[220px] rounded-xl border border-slate-800 bg-slate-950/80 px-3 py-2 text-xs text-slate-300 focus:border-indigo-500 focus:outline-none"
          >
            <option value="">Tất cả job</option>
            <option value="none">Câu không gắn job</option>
            {jobs.map((j) => (
              <option key={j.id} value={j.id}>
                {j.title}
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
                <th className="py-3 px-3">Job</th>
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
                  const isPendingPlatform = q.status === "pending_platform_review";
                  const canApprove = APPROVABLE.has(q.status);
                  const jobTitle = q.jobPostId ? jobTitleById.get(String(q.jobPostId)) || "Job khác" : "";

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
                          {roleLabel(q.roleCategory) || "General"}
                        </span>
                      </td>
                      <td className="py-3.5 px-3 whitespace-nowrap text-slate-400">
                        {q.competencyId || "Chung"}
                      </td>
                      <td className="py-3.5 px-3 max-w-[180px]">
                        {jobTitle ? (
                          <span className="inline-flex items-center gap-1 text-[11px] text-slate-300">
                            <Briefcase className="size-3 shrink-0 text-slate-500" />
                            <span className="truncate">{jobTitle}</span>
                          </span>
                        ) : (
                          <span className="text-[11px] text-slate-500">Dùng chung</span>
                        )}
                      </td>
                      <td className="py-3.5 px-3 whitespace-nowrap">
                        {isApproved && (
                          <span className="inline-flex items-center gap-1 text-emerald-400 font-medium">
                            <CheckCircle2 className="size-3.5" /> Đang dùng
                          </span>
                        )}
                        {isPendingPlatform && (
                          <span
                            className="inline-flex items-center gap-1 text-sky-400 font-medium"
                            title="Công ty đã duyệt, đang chờ Platform Moderator duyệt trước khi dùng trong phỏng vấn"
                          >
                            <Clock className="size-3.5" /> Chờ Platform Mod
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
                        {/* Lý do từ chối (Platform Mod bắt buộc ghi, CO-16) để công ty biết sửa gì */}
                        {isRejected && q.moderation?.reason && (
                          <p className="mt-1 max-w-[200px] whitespace-normal text-[10px] leading-snug text-rose-300/80">
                            {q.moderation.reason}
                          </p>
                        )}
                      </td>
                      <td className="py-3.5 pl-3 pr-4 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-1.5">
                          {/* Approve btn: chỉ câu nháp / đã từ chối */}
                          {canApprove && (
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

      {/* Modal: Tải câu lên theo job (CO-05, CO-13) */}
      {showUploadModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-xl rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl">
            <h3 className="font-bold text-white text-base flex items-center gap-2">
              <Upload className="size-5 text-indigo-400" />
              Tải câu hỏi lên theo job
            </h3>
            <p className="mt-1 text-xs text-slate-400">
              Dán danh sách câu hỏi, mỗi dòng một câu (tối đa {UPLOAD_MAX} câu). Vị trí lấy theo job. Câu trùng với câu đã có của công ty sẽ được bỏ qua.
            </p>

            {uploadableJobs.length === 0 ? (
              <div className="mt-5 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-300">
                Công ty chưa có tin tuyển dụng nháp hoặc đang đăng. Tạo tin tuyển dụng trước khi tải câu theo job.
              </div>
            ) : (
              <form onSubmit={handleUpload} className="mt-5 space-y-4">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label htmlFor="upload-job" className="block text-xs font-semibold uppercase tracking-wider text-slate-400">
                      Tin tuyển dụng *
                    </label>
                    <select
                      id="upload-job"
                      required
                      value={uploadForm.jobPostId}
                      onChange={(e) => setUploadForm({ ...uploadForm, jobPostId: e.target.value })}
                      className="mt-1.5 w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-white focus:border-indigo-500 focus:outline-none"
                    >
                      <option value="" disabled>
                        Chọn job
                      </option>
                      {uploadableJobs.map((j) => (
                        <option key={j.id} value={j.id}>
                          {j.title} · {roleLabel(j.roleCategory)}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label htmlFor="upload-competency" className="block text-xs font-semibold uppercase tracking-wider text-slate-400">
                      Năng lực đánh giá
                    </label>
                    <select
                      id="upload-competency"
                      value={uploadForm.competencyId}
                      onChange={(e) => setUploadForm({ ...uploadForm, competencyId: e.target.value })}
                      className="mt-1.5 w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-white focus:border-indigo-500 focus:outline-none"
                    >
                      {competencies.length === 0 && <option value={DEFAULT_COMPETENCY}>{DEFAULT_COMPETENCY}</option>}
                      {competencies.map((c) => (
                        <option key={c.key} value={c.key}>
                          {c.nameVi}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label htmlFor="upload-text" className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-slate-400">
                    <span>Danh sách câu hỏi *</span>
                    <span className={`normal-case tracking-normal ${uploadLines.length > UPLOAD_MAX ? "text-rose-400" : "text-slate-500"}`}>
                      {uploadLines.length}/{UPLOAD_MAX} câu
                    </span>
                  </label>
                  <textarea
                    id="upload-text"
                    rows={8}
                    required
                    placeholder={"Kể về lần bạn tối ưu hiệu năng một trang web.\nBạn quản lý state trong ứng dụng lớn như thế nào?"}
                    value={uploadForm.text}
                    onChange={(e) => {
                      setUploadForm({ ...uploadForm, text: e.target.value });
                      setUploadErrors([]);
                    }}
                    className="mt-1.5 w-full rounded-xl border border-slate-800 bg-slate-950 p-3 text-sm text-white placeholder-slate-600 focus:border-indigo-500 focus:outline-none"
                  />
                  <p className="mt-1 text-[11px] text-slate-500">Dấu gạch đầu dòng hoặc số thứ tự ở đầu dòng được tự bỏ.</p>
                </div>

                {uploadErrors.length > 0 && (
                  <div role="alert" className="max-h-32 overflow-y-auto rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-300">
                    <p className="font-semibold">Chưa lưu câu nào. Sửa các dòng sau rồi tải lại:</p>
                    <ul className="mt-1 space-y-0.5">
                      {uploadErrors.map((err) => (
                        <li key={err.line}>
                          Câu {err.line}: {err.error}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <label className="flex items-center gap-2 text-xs text-slate-300">
                  <input
                    type="checkbox"
                    checked={uploadForm.asDraft}
                    onChange={(e) => setUploadForm({ ...uploadForm, asDraft: e.target.checked })}
                  />
                  Lưu dạng bản nháp để xem lại trước (không gửi Platform Moderator ngay)
                </label>

                <div className="mt-6 flex justify-end gap-2.5">
                  <button
                    type="button"
                    onClick={() => setShowUploadModal(false)}
                    className="rounded-xl border border-slate-700 px-4 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-800"
                  >
                    Hủy
                  </button>
                  <button
                    type="submit"
                    disabled={uploading || !uploadForm.jobPostId || uploadLines.length === 0 || uploadLines.length > UPLOAD_MAX}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-semibold text-white shadow-lg shadow-indigo-600/30 hover:bg-indigo-500 disabled:opacity-50"
                  >
                    {uploading ? <Loader2 className="size-3.5 animate-spin" /> : <Upload className="size-3.5" />}
                    Tải lên {uploadLines.length > 0 ? `${uploadLines.length} câu` : ""}
                  </button>
                </div>
              </form>
            )}
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
              Câu bạn tự thêm được coi là công ty đã duyệt và chuyển Platform Moderator duyệt trước khi dùng trong phỏng vấn.
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
                    disabled={Boolean(createForm.jobPostId)}
                    title={createForm.jobPostId ? "Vị trí lấy theo job đã chọn" : undefined}
                    onChange={(e) => setCreateForm({ ...createForm, roleCategory: e.target.value })}
                    className="mt-1.5 w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-white focus:border-indigo-500 focus:outline-none disabled:opacity-50"
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
                    Gắn với job
                  </label>
                  <select
                    value={createForm.jobPostId}
                    onChange={(e) => setCreateForm({ ...createForm, jobPostId: e.target.value })}
                    className="mt-1.5 w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-white focus:border-indigo-500 focus:outline-none"
                  >
                    <option value="">Không gắn job (dùng chung)</option>
                    {uploadableJobs.map((j) => (
                      <option key={j.id} value={j.id}>
                        {j.title}
                      </option>
                    ))}
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
            {editQuestion.status === "approved" && (
              <p className="mt-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-[11px] text-amber-300">
                Câu đang được dùng trong phỏng vấn. Đổi nội dung câu thì câu cần Platform Moderator duyệt lại.
              </p>
            )}

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
                    Gắn với job
                  </label>
                  <select
                    value={editQuestion.jobPostId ? String(editQuestion.jobPostId) : ""}
                    onChange={(e) => setEditQuestion({ ...editQuestion, jobPostId: e.target.value })}
                    className="mt-1.5 w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-white focus:border-indigo-500 focus:outline-none"
                  >
                    <option value="">Không gắn job (dùng chung)</option>
                    {jobs.map((j) => (
                      <option key={j.id} value={j.id}>
                        {j.title}
                      </option>
                    ))}
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
