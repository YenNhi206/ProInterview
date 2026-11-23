import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Briefcase,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Eye,
  EyeOff,
  Loader2,
  Lock,
  Pencil,
  Plus,
  RefreshCw,
  Send,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import { companyApi } from "../../api/companyApi.js";
import { competenciesApi } from "../../api/competenciesApi.js";
import { tryApi } from "../../utils/shared/apiToast.js";
import { useRoleCategories } from "../../hooks/useRoleCategories.js";
import { competencyOptions, shrmLabel } from "../../utils/learningPath/learningPathEditor.js";
import { ROLE_CATEGORIES, roleLabel } from "../../utils/company/rubricEditor.js";
import {
  EMPLOYMENT_TYPES,
  JOB_LEVELS,
  JOB_MAX_COMPETENCIES,
  JOB_MAX_DESCRIPTION,
  JOB_MAX_SKILLS,
  JOB_MIN_DESCRIPTION,
  JOB_STATUS,
  JOB_STATUS_TABS,
  MIN_LEVEL_OPTIONS,
  WORK_MODES,
  addSkills,
  addSuggestedCompetencies,
  attachableRubrics,
  employmentLabel,
  formatJobDate,
  jobActions,
  jobPublishErrors,
  jobSaveErrors,
  levelLabel,
  roleOptionsWithCurrent,
  todayDateInput,
  toJobForm,
  toJobPayload,
  workModeLabel,
} from "../../utils/company/jobPostEditor.js";

const STATUS_STYLE = {
  draft: "bg-slate-700/50 text-slate-300",
  published: "bg-emerald-500/10 text-emerald-400",
  hidden: "bg-rose-500/10 text-rose-400",
  closed: "bg-slate-500/15 text-slate-400",
};
const PAGE_SIZE = 20;
const inputCls = "rounded-lg border border-slate-800 bg-[#120c22] px-3 py-1.5 text-xs text-white focus:border-violet-500 focus:outline-none";
const labelCls = "block text-xs font-semibold uppercase tracking-wider text-slate-400";
const fieldCls = `${inputCls} mt-1.5 w-full py-2 normal-case tracking-normal`;

/**
 * Nhóm vị trí từ `GET /api/role-categories` (dùng chung với câu hỏi công ty, rubric, job).
 * Chưa tải xong / lỗi mạng thì dùng tạm danh sách mặc định của rubricEditor.js.
 */
function useJobRoles() {
  const { roleCategories, labelOf } = useRoleCategories();
  return useMemo(() => {
    if (!roleCategories.length) return { options: ROLE_CATEGORIES, label: roleLabel, suggested: () => [] };
    return {
      options: roleCategories.filter((r) => !r.deprecated).map((r) => ({ id: r.key, label: r.nameVi })),
      label: labelOf,
      suggested: (key) => roleCategories.find((r) => r.key === key)?.suggestedCompetencies || [],
    };
  }, [roleCategories, labelOf]);
}

function StatusBadge({ status }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${STATUS_STYLE[status] || STATUS_STYLE.draft}`}>
      {status === "hidden" ? <EyeOff className="size-3" /> : status === "published" ? <CheckCircle2 className="size-3" /> : status === "closed" ? <Lock className="size-3" /> : null}
      {JOB_STATUS[status] || status}
    </span>
  );
}

/**
 * /company/jobs — JB-15. Company Moderator soạn, đăng, sửa và đóng tin tuyển dụng (API JB-01).
 * Không cần duyệt trước khi đăng (quyết định 8); tin bị Platform Moderator ẩn (JB-04) hiện kèm lý do,
 * không sửa được, vẫn đóng được.
 */
export function CompanyJobs() {
  const roles = useJobRoles();
  const [jobs, setJobs] = useState([]);
  const [counts, setCounts] = useState({});
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1, total: 0 });
  const [status, setStatus] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState("");
  const [framework, setFramework] = useState(null);
  const [editing, setEditing] = useState(null); // null = đóng; { job } (job null = tạo mới)
  const [viewing, setViewing] = useState(null);

  const fetchJobs = useCallback(async () => {
    setLoading(true);
    const res = await tryApi(() => companyApi.listJobs({ status, roleCategory: roleFilter, page, limit: PAGE_SIZE }), {
      fallback: "Không tải được danh sách tin tuyển dụng.",
    });
    setLoading(false);
    if (!res.success) return;
    setJobs(res.jobs || []);
    setCounts(res.counts || {});
    setPagination(res.pagination || { page: 1, totalPages: 1, total: 0 });
  }, [status, roleFilter, page]);

  useEffect(() => {
    fetchJobs();
  }, [fetchJobs]);

  useEffect(() => {
    competenciesApi.getFramework().then((res) => res.success && setFramework(res.framework));
  }, []);

  const totalAll = Object.values(counts).reduce((s, n) => s + (Number(n) || 0), 0);
  const changeTab = (next) => { setStatus(next); setPage(1); };

  const changeStatus = async (job, next) => {
    const confirmText = next === "closed"
      ? `Đóng tin "${job.title}"? Tin sẽ ngừng nhận hồ sơ và không mở lại được.`
      : `Đăng tin "${job.title}"? Ứng viên sẽ thấy tin ngay trên trang việc làm.`;
    if (!window.confirm(confirmText)) return;
    setBusyId(job.id);
    const res = await tryApi(() => companyApi.changeJobStatus(job.id, next), {
      fallback: next === "closed" ? "Không đóng được tin." : "Không đăng được tin.",
      successMessage: next === "closed" ? "Đã đóng tin tuyển dụng." : "Đã đăng tin tuyển dụng.",
    });
    setBusyId("");
    if (res.success) fetchJobs();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="flex items-center gap-2.5 text-2xl font-bold tracking-tight text-white">
            <Briefcase className="size-6 text-violet-400" />
            Tin tuyển dụng
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            Soạn tin với năng lực yêu cầu, kỹ năng, rubric áp dụng và hạn nhận hồ sơ. Tin đăng ngay, không cần chờ duyệt.
          </p>
        </div>
        <button
          onClick={() => setEditing({ job: null })}
          className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-2.5 text-xs font-semibold text-white shadow-lg shadow-violet-600/30 transition hover:bg-violet-500"
        >
          <Plus className="size-4" />
          Tạo tin mới
        </button>
      </div>

      <div className="flex flex-col gap-3 rounded-2xl border border-slate-800 bg-[#120c22]/60 p-3.5 backdrop-blur-xl lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Lọc theo trạng thái">
          {JOB_STATUS_TABS.map((s) => {
            const active = status === s;
            const n = s ? counts[s] || 0 : totalAll;
            return (
              <button
                key={s || "all"}
                role="tab"
                aria-selected={active}
                onClick={() => changeTab(s)}
                className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition ${active ? "bg-violet-600 text-white" : "border border-slate-800 bg-[#0b0716] text-slate-400 hover:text-white"}`}
              >
                {s ? JOB_STATUS[s] : "Tất cả"} <span className="ml-1 opacity-70">{n}</span>
              </button>
            );
          })}
        </div>
        <div className="flex items-center gap-2">
          <select
            value={roleFilter}
            onChange={(e) => { setRoleFilter(e.target.value); setPage(1); }}
            aria-label="Lọc theo vị trí"
            className="rounded-xl border border-slate-800 bg-[#0b0716] px-3 py-1.5 text-xs text-slate-300 focus:border-violet-500 focus:outline-none"
          >
            <option value="">Tất cả vị trí</option>
            {roles.options.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}
          </select>
          <button onClick={fetchJobs} title="Làm mới" aria-label="Làm mới" className="rounded-xl border border-slate-800 bg-[#0b0716] p-2 text-slate-400 transition hover:text-white">
            <RefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-800 bg-[#120c22]/60 backdrop-blur-xl">
        {loading && !jobs.length ? (
          <div className="py-12 text-center text-slate-400">
            <Loader2 className="mx-auto size-6 animate-spin text-violet-500" />
            <span className="mt-2 block text-xs">Đang tải tin tuyển dụng...</span>
          </div>
        ) : jobs.length === 0 ? (
          <div className="py-12 text-center text-slate-400">
            <Briefcase className="mx-auto size-8 text-slate-600" />
            <p className="mt-2 font-medium text-slate-300">{status || roleFilter ? "Không có tin nào khớp bộ lọc" : "Chưa có tin tuyển dụng"}</p>
            <p className="mt-0.5 text-xs text-slate-500">Bấm "Tạo tin mới" để soạn tin đầu tiên của công ty.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-800 bg-[#0b0716]/60 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                <tr>
                  <th className="min-w-[260px] px-4 py-3">Tin tuyển dụng</th>
                  <th className="px-3 py-3">Vị trí</th>
                  <th className="px-3 py-3">Trạng thái</th>
                  <th className="px-3 py-3">Hạn nhận hồ sơ</th>
                  <th className="px-3 py-3">Cập nhật</th>
                  <th className="px-4 py-3 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80">
                {jobs.map((job) => {
                  const actions = jobActions(job.status);
                  const busy = busyId === job.id;
                  return (
                    <tr key={job.id} className="align-top text-slate-300 transition hover:bg-slate-800/30">
                      <td className="px-4 py-3">
                        <button onClick={() => setViewing(job)} className="text-left text-sm font-semibold text-white hover:text-violet-300">
                          {job.title}
                        </button>
                        <p className="mt-0.5 text-[11px] text-slate-500">
                          {[levelLabel(job.level), employmentLabel(job.employmentType), workModeLabel(job.workMode), job.location].filter(Boolean).join(" · ")}
                        </p>
                        {job.status === "hidden" && (
                          <p className="mt-1.5 flex items-start gap-1 rounded-lg border border-rose-500/20 bg-rose-500/10 px-2 py-1 text-[11px] text-rose-300">
                            <AlertTriangle className="mt-0.5 size-3 shrink-0" />
                            <span>Bị Platform Moderator ẩn{job.hiddenReason ? `: ${job.hiddenReason}` : ""}. Tin không còn hiện với ứng viên và không sửa được.</span>
                          </p>
                        )}
                      </td>
                      <td className="px-3 py-3">{job.roleCategoryName || roles.label(job.roleCategory)}</td>
                      <td className="px-3 py-3"><StatusBadge status={job.status} /></td>
                      <td className="px-3 py-3">{formatJobDate(job.closesAt)}</td>
                      <td className="px-3 py-3 text-slate-500">{formatJobDate(job.updatedAt)}</td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap justify-end gap-1.5">
                          <button onClick={() => setViewing(job)} title="Xem" aria-label={`Xem ${job.title}`} className="rounded-lg border border-slate-700 p-1.5 text-slate-300 hover:bg-slate-800">
                            <Eye className="size-3.5" />
                          </button>
                          {actions.edit && (
                            <button onClick={() => setEditing({ job })} className="inline-flex items-center gap-1 rounded-lg border border-slate-700 px-2.5 py-1.5 font-semibold text-slate-200 hover:bg-slate-800">
                              <Pencil className="size-3" /> Sửa
                            </button>
                          )}
                          {actions.publish && (
                            <button disabled={busy} onClick={() => changeStatus(job, "published")} className="inline-flex items-center gap-1 rounded-lg bg-violet-600 px-2.5 py-1.5 font-semibold text-white hover:bg-violet-500 disabled:opacity-50">
                              <Send className="size-3" /> Đăng
                            </button>
                          )}
                          {actions.close && (
                            <button disabled={busy} onClick={() => changeStatus(job, "closed")} className="inline-flex items-center gap-1 rounded-lg border border-rose-500/30 px-2.5 py-1.5 font-semibold text-rose-300 hover:bg-rose-500/10 disabled:opacity-50">
                              <Lock className="size-3" /> Đóng
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        {pagination.totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-slate-800 px-4 py-2.5 text-xs text-slate-400">
            <span>Trang {pagination.page}/{pagination.totalPages} · {pagination.total} tin</span>
            <div className="flex gap-1.5">
              <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)} aria-label="Trang trước" className="rounded-lg border border-slate-800 p-1.5 disabled:opacity-40"><ChevronLeft className="size-3.5" /></button>
              <button disabled={page >= pagination.totalPages} onClick={() => setPage((p) => p + 1)} aria-label="Trang sau" className="rounded-lg border border-slate-800 p-1.5 disabled:opacity-40"><ChevronRight className="size-3.5" /></button>
            </div>
          </div>
        )}
      </div>

      {editing && (
        <JobEditorModal
          job={editing.job}
          framework={framework}
          defaultRole={roleFilter || roles.options[0]?.id || ""}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); fetchJobs(); }}
        />
      )}
      {viewing && <JobDetailModal job={viewing} framework={framework} onClose={() => setViewing(null)} />}
    </div>
  );
}

function JobEditorModal({ job, framework, defaultRole, onClose, onSaved }) {
  const roles = useJobRoles();
  const [form, setForm] = useState(() => toJobForm(job, defaultRole));
  const [skillDraft, setSkillDraft] = useState("");
  const [skillNote, setSkillNote] = useState("");
  const [rubrics, setRubrics] = useState([]);
  const [saving, setSaving] = useState(false);
  const isNew = !form.id;
  const isPublished = form.status === "published";

  const options = useMemo(() => competencyOptions(framework), [framework]);
  const selectableKeys = useMemo(() => (framework ? new Set(options.map((o) => o.key)) : null), [framework, options]);
  const saveBlocking = jobSaveErrors(form, selectableKeys);
  const publishBlocking = jobPublishErrors(form, selectableKeys);
  // Tin đang đăng phải luôn đủ điều kiện đăng (backend kiểm lại khi sửa).
  const blocking = isPublished ? publishBlocking : saveBlocking;
  const descLength = form.description.trim().length;
  const rubricChoices = attachableRubrics(rubrics, form.roleCategory);
  // Tin cũ có thể thuộc nhóm vị trí đã ngừng dùng (API không trả) — vẫn hiện đúng giá trị hiện tại.
  const roleChoices = roleOptionsWithCurrent(roles.options, form.roleCategory, job?.roleCategoryName);
  const staleRole = roleChoices.find((r) => r.id === form.roleCategory)?.stale;
  const staleRubric = form.rubricId && !rubricChoices.some((r) => String(r._id) === form.rubricId);

  useEffect(() => {
    if (!form.roleCategory && roles.options[0]) setForm((f) => ({ ...f, roleCategory: roles.options[0].id }));
  }, [roles.options, form.roleCategory]);

  // Rubric đã duyệt của công ty — chỉ gắn được rubric cùng nhóm vị trí.
  useEffect(() => {
    let active = true;
    companyApi.listRubrics({ status: "approved" }).then((res) => active && setRubrics(res.success ? res.rubrics || [] : []));
    return () => { active = false; };
  }, []);

  const set = (patch) => setForm((f) => ({ ...f, ...patch }));
  const setCompetency = (idx, patch) =>
    setForm((f) => ({ ...f, requiredCompetencies: f.requiredCompetencies.map((c, i) => (i === idx ? { ...c, ...patch } : c)) }));

  const changeRole = (roleCategory) => {
    // Rubric gắn theo nhóm vị trí: đổi vị trí thì bỏ rubric cũ.
    set({ roleCategory, rubricId: "" });
  };

  const commitSkills = () => {
    const { skills, rejected } = addSkills(form.requiredSkills, skillDraft);
    set({ requiredSkills: skills });
    setSkillDraft("");
    setSkillNote(rejected.length ? `Không thêm: ${rejected.join(", ")} (mỗi kỹ năng tối đa 60 ký tự, tối đa ${JOB_MAX_SKILLS} kỹ năng).` : "");
  };

  const save = async (andPublish) => {
    if ((andPublish ? publishBlocking : blocking).length) return;
    setSaving(true);
    const payload = toJobPayload(form);
    const saved = await tryApi(
      () => (isNew ? companyApi.createJob(payload) : companyApi.updateJob(form.id, payload)),
      { fallback: "Không lưu được tin tuyển dụng.", successMessage: andPublish ? undefined : isPublished ? "Đã cập nhật tin đang đăng." : "Đã lưu bản nháp." },
    );
    if (saved.success && andPublish) {
      await tryApi(() => companyApi.changeJobStatus(saved.job.id, "published"), {
        fallback: "Đã lưu bản nháp nhưng chưa đăng được.",
        successMessage: "Đã lưu và đăng tin tuyển dụng.",
      });
    }
    setSaving(false);
    if (saved.success) onSaved();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-3xl border border-slate-800 bg-[#120c22] p-6 shadow-2xl" role="dialog" aria-modal="true" aria-labelledby="job-editor-title">
        <div className="flex items-start justify-between gap-3">
          <h3 id="job-editor-title" className="flex items-center gap-2 text-lg font-bold text-white">
            <Briefcase className="size-5 text-violet-400" />
            {isNew ? "Soạn tin tuyển dụng" : isPublished ? "Sửa tin đang đăng" : "Sửa bản nháp"}
          </h3>
          <button onClick={onClose} aria-label="Đóng" className="rounded-lg p-1 text-slate-400 hover:text-white"><X className="size-4" /></button>
        </div>
        {isPublished && (
          <p className="mt-3 rounded-xl border border-amber-500/20 bg-amber-500/5 p-2.5 text-xs text-amber-300">
            Tin đang hiển thị với ứng viên: thay đổi có hiệu lực ngay và tin vẫn phải đủ điều kiện đăng.
          </p>
        )}

        <div className="mt-5 space-y-4">
          <label className={labelCls}>
            Tiêu đề *
            <input className={`${fieldCls} py-2.5 text-sm`} maxLength={150} value={form.title} onChange={(e) => set({ title: e.target.value })} placeholder="Ví dụ: Kỹ sư Backend Node.js" />
          </label>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className={labelCls}>
              Nhóm vị trí *
              <select className={fieldCls} value={form.roleCategory} onChange={(e) => changeRole(e.target.value)}>
                {roleChoices.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}
              </select>
              {staleRole && (
                <span className="mt-1 block normal-case tracking-normal text-[11px] font-normal text-amber-400">
                  Vị trí này đã ngừng dùng. Tin vẫn lưu được; nếu đổi sang vị trí khác thì không chọn lại được vị trí cũ.
                </span>
              )}
            </label>
            <label className={labelCls}>
              Cấp độ *
              <select className={fieldCls} value={form.level} onChange={(e) => set({ level: e.target.value })}>
                {JOB_LEVELS.map((l) => <option key={l.id} value={l.id}>{l.label}</option>)}
              </select>
            </label>
            <label className={labelCls}>
              Hình thức
              <select className={fieldCls} value={form.employmentType} onChange={(e) => set({ employmentType: e.target.value })}>
                {EMPLOYMENT_TYPES.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
              </select>
            </label>
            <label className={labelCls}>
              Nơi làm việc
              <select className={fieldCls} value={form.workMode} onChange={(e) => set({ workMode: e.target.value })}>
                {WORK_MODES.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
              </select>
            </label>
            <label className={labelCls}>
              Địa điểm
              <input className={fieldCls} maxLength={200} value={form.location} onChange={(e) => set({ location: e.target.value })} placeholder="Ví dụ: Quận 1, TP.HCM" />
            </label>
            <label className={labelCls}>
              Mức lương
              <input className={fieldCls} maxLength={100} value={form.salaryRange} onChange={(e) => set({ salaryRange: e.target.value })} placeholder="Ví dụ: 25–35 triệu hoặc Thỏa thuận" />
            </label>
          </div>

          <label className={labelCls}>
            <span className="flex items-center justify-between">
              <span>Mô tả công việc</span>
              <span className={`normal-case tracking-normal ${descLength < JOB_MIN_DESCRIPTION ? "text-amber-400" : "text-slate-500"}`}>
                {descLength}/{JOB_MAX_DESCRIPTION.toLocaleString("vi-VN")} · cần ≥ {JOB_MIN_DESCRIPTION} để đăng
              </span>
            </span>
            <textarea rows={6} maxLength={JOB_MAX_DESCRIPTION} className={`${fieldCls} resize-y`} value={form.description} onChange={(e) => set({ description: e.target.value })} placeholder="Trách nhiệm, yêu cầu, quyền lợi…" />
          </label>

          <div className="border-t border-slate-800 pt-4">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Năng lực yêu cầu ({form.requiredCompetencies.length}/{JOB_MAX_COMPETENCIES})
              </span>
              <div className="flex gap-3">
                <button
                  type="button"
                  disabled={!roles.suggested(form.roleCategory).length || form.requiredCompetencies.length >= JOB_MAX_COMPETENCIES}
                  onClick={() => set({ requiredCompetencies: addSuggestedCompetencies(form.requiredCompetencies, roles.suggested(form.roleCategory), selectableKeys) })}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-violet-400 hover:text-violet-300 disabled:opacity-40"
                >
                  <Sparkles className="size-3.5" /> Gợi ý theo vị trí
                </button>
                <button
                  type="button"
                  disabled={form.requiredCompetencies.length >= JOB_MAX_COMPETENCIES}
                  onClick={() => set({ requiredCompetencies: [...form.requiredCompetencies, { shrmKey: "", minLevel: 3 }] })}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-violet-400 hover:text-violet-300 disabled:opacity-40"
                >
                  <Plus className="size-3.5" /> Thêm năng lực
                </button>
              </div>
            </div>
            {form.requiredCompetencies.length === 0 ? (
              <p className="rounded-xl border border-dashed border-slate-800 p-3 text-[11px] text-slate-500">
                Chưa có năng lực nào. Cần ít nhất 1 năng lực để đăng tin; ứng viên dùng danh sách này để xem khoảng thiếu.
              </p>
            ) : (
              <div className="space-y-2">
                {form.requiredCompetencies.map((c, idx) => {
                  const stale = c.shrmKey && selectableKeys && !selectableKeys.has(c.shrmKey);
                  return (
                    <div key={idx} className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-800 bg-[#0b0716]/70 p-2.5">
                      <select className={`${inputCls} min-w-[14rem] flex-1`} aria-label={`Năng lực ${idx + 1}`} value={c.shrmKey} onChange={(e) => setCompetency(idx, { shrmKey: e.target.value })}>
                        <option value="">{framework ? "Chọn năng lực…" : "Đang tải bộ tiêu chí…"}</option>
                        {stale && <option value={c.shrmKey}>{shrmLabel(c.shrmKey, framework)} (không còn dùng)</option>}
                        {options.map((o) => (
                          <option key={o.key} value={o.key} disabled={o.key !== c.shrmKey && form.requiredCompetencies.some((x) => x.shrmKey === o.key)}>{o.label}</option>
                        ))}
                      </select>
                      <select className={`${inputCls} w-auto`} aria-label={`Mức tối thiểu năng lực ${idx + 1}`} value={c.minLevel} onChange={(e) => setCompetency(idx, { minLevel: Number(e.target.value) })}>
                        {MIN_LEVEL_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                      </select>
                      <button type="button" aria-label={`Xóa năng lực ${idx + 1}`} onClick={() => set({ requiredCompetencies: form.requiredCompetencies.filter((_, i) => i !== idx) })} className="p-1 text-slate-500 hover:text-rose-400">
                        <Trash2 className="size-4" />
                      </button>
                      {stale && <span className="w-full text-[11px] text-rose-400">Năng lực này đã ngừng dùng, chọn năng lực khác.</span>}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="border-t border-slate-800 pt-4">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Kỹ năng ({form.requiredSkills.length}/{JOB_MAX_SKILLS})
            </span>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {form.requiredSkills.map((s) => (
                <span key={s} className="inline-flex items-center gap-1 rounded-full bg-violet-500/15 px-2.5 py-1 text-[11px] font-semibold text-violet-200">
                  {s}
                  <button type="button" aria-label={`Bỏ kỹ năng ${s}`} onClick={() => set({ requiredSkills: form.requiredSkills.filter((x) => x !== s) })} className="text-violet-300 hover:text-white">
                    <X className="size-3" />
                  </button>
                </span>
              ))}
            </div>
            <div className="mt-2 flex gap-2">
              <input
                className={`${inputCls} flex-1 py-2`}
                value={skillDraft}
                aria-label="Thêm kỹ năng"
                onChange={(e) => setSkillDraft(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); commitSkills(); } }}
                placeholder="Nhập kỹ năng, Enter để thêm (nhiều kỹ năng cách nhau dấu phẩy)"
              />
              <button type="button" onClick={commitSkills} disabled={!skillDraft.trim()} className="rounded-lg border border-slate-700 px-3 text-xs font-semibold text-slate-200 hover:bg-slate-800 disabled:opacity-40">Thêm</button>
            </div>
            {skillNote && <p className="mt-1 text-[11px] text-amber-400">{skillNote}</p>}
          </div>

          <div className="grid gap-3 border-t border-slate-800 pt-4 sm:grid-cols-2">
            <label className={labelCls}>
              Rubric áp dụng
              <select className={fieldCls} value={form.rubricId} onChange={(e) => set({ rubricId: e.target.value })}>
                <option value="">Không gắn rubric</option>
                {staleRubric && <option value={form.rubricId}>Rubric hiện tại (không còn hợp lệ)</option>}
                {rubricChoices.map((r) => <option key={r._id} value={String(r._id)}>{r.title} · v{r.version}</option>)}
              </select>
              <span className="mt-1 block normal-case tracking-normal text-[11px] font-normal text-slate-500">
                {rubricChoices.length ? "Chỉ rubric đã duyệt cùng nhóm vị trí." : "Chưa có rubric đã duyệt cho vị trí này (soạn ở trang Rubric)."}
              </span>
            </label>
            <label className={labelCls}>
              Hạn nhận hồ sơ
              <input type="date" min={todayDateInput()} className={fieldCls} value={form.closesAt} onChange={(e) => set({ closesAt: e.target.value })} />
              <span className="mt-1 block normal-case tracking-normal text-[11px] font-normal text-slate-500">
                Hết hạn lúc 23:59 ngày đã chọn, tin tự đóng. Để trống = không hạn.
              </span>
            </label>
          </div>

          {(isPublished ? publishBlocking : saveBlocking).length > 0 && (
            <ul className="space-y-0.5 rounded-xl border border-rose-500/20 bg-rose-500/5 p-3 text-[11px] text-rose-300">
              <li className="font-semibold">{isPublished ? "Cần sửa để tin vẫn đủ điều kiện đăng:" : "Cần sửa trước khi lưu:"}</li>
              {(isPublished ? publishBlocking : saveBlocking).map((e) => <li key={e}>• {e}</li>)}
            </ul>
          )}
          {!isPublished && saveBlocking.length === 0 && publishBlocking.length > 0 && (
            <ul className="space-y-0.5 rounded-xl border border-amber-500/20 bg-amber-500/5 p-3 text-[11px] text-amber-300">
              <li className="font-semibold">Lưu nháp được; cần hoàn thiện trước khi đăng:</li>
              {publishBlocking.map((e) => <li key={e}>• {e}</li>)}
            </ul>
          )}
        </div>

        <div className="mt-6 flex flex-wrap justify-end gap-2.5 border-t border-slate-800 pt-4">
          <button type="button" onClick={onClose} className="rounded-xl border border-slate-700 px-4 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-800">Hủy</button>
          <button
            type="button"
            disabled={saving || blocking.length > 0}
            title={blocking[0]}
            onClick={() => save(false)}
            className={isPublished
              ? "inline-flex items-center gap-1.5 rounded-xl bg-violet-600 px-5 py-2 text-xs font-semibold text-white shadow-lg shadow-violet-600/30 hover:bg-violet-500 disabled:opacity-50"
              : "inline-flex items-center gap-1.5 rounded-xl border border-violet-500/40 px-4 py-2 text-xs font-semibold text-violet-200 hover:bg-violet-500/10 disabled:opacity-50"}
          >
            {saving ? <Loader2 className="size-3.5 animate-spin" /> : <CheckCircle2 className="size-3.5" />}
            {isPublished ? "Lưu thay đổi" : "Lưu bản nháp"}
          </button>
          {!isPublished && (
            <button
              type="button"
              disabled={saving || publishBlocking.length > 0}
              title={publishBlocking[0]}
              onClick={() => save(true)}
              className="inline-flex items-center gap-1.5 rounded-xl bg-violet-600 px-5 py-2 text-xs font-semibold text-white shadow-lg shadow-violet-600/30 hover:bg-violet-500 disabled:opacity-50"
            >
              <Send className="size-3.5" />
              Lưu và đăng
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function JobDetailModal({ job, framework, onClose }) {
  const roles = useJobRoles();
  const meta = [
    ["Nhóm vị trí", job.roleCategoryName || roles.label(job.roleCategory)],
    ["Cấp độ", levelLabel(job.level)],
    ["Hình thức", employmentLabel(job.employmentType)],
    ["Nơi làm việc", workModeLabel(job.workMode)],
    ["Địa điểm", job.location || "—"],
    ["Mức lương", job.salaryRange || "—"],
    ["Hạn nhận hồ sơ", formatJobDate(job.closesAt)],
    ["Ngày đăng", formatJobDate(job.publishedAt)],
    ["Rubric", job.rubric ? `${job.rubric.title} · v${job.rubric.version}` : "Không gắn"],
  ];
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-3xl border border-slate-800 bg-[#120c22] p-6 shadow-2xl" role="dialog" aria-modal="true" aria-labelledby="job-detail-title">
        <div className="flex items-start justify-between gap-3 border-b border-slate-800 pb-4">
          <h3 id="job-detail-title" className="text-lg font-bold text-white">{job.title}</h3>
          <StatusBadge status={job.status} />
        </div>
        {job.status === "hidden" && (
          <p className="mt-4 rounded-xl border border-rose-500/20 bg-rose-500/10 p-3 text-xs text-rose-300">
            <strong>Bị Platform Moderator ẩn</strong>{job.hiddenAt ? ` ngày ${formatJobDate(job.hiddenAt)}` : ""}{job.hiddenReason ? `. Lý do: ${job.hiddenReason}` : ""}.
          </p>
        )}
        {job.status === "closed" && job.closedReason && (
          <p className="mt-4 rounded-xl border border-slate-800 bg-[#0b0716]/60 p-3 text-xs text-slate-400">
            Đã đóng {job.closedReason === "expired" ? "tự động do quá hạn nhận hồ sơ" : "bởi công ty"}{job.closedAt ? ` ngày ${formatJobDate(job.closedAt)}` : ""}.
          </p>
        )}
        <dl className="mt-4 grid grid-cols-1 gap-2 text-xs sm:grid-cols-3">
          {meta.map(([k, v]) => (
            <div key={k} className="rounded-xl border border-slate-800 bg-[#0b0716]/60 p-2.5">
              <dt className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">{k}</dt>
              <dd className="mt-0.5 text-slate-200">{v}</dd>
            </div>
          ))}
        </dl>
        <div className="mt-4">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Năng lực yêu cầu</p>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {(job.requiredCompetencies || []).length === 0
              ? <span className="text-xs text-slate-500">Chưa có</span>
              : job.requiredCompetencies.map((c) => (
                <span key={c.shrmKey} className="rounded-full bg-violet-500/15 px-2.5 py-1 text-[11px] font-semibold text-violet-200">
                  {c.name || shrmLabel(c.shrmKey, framework)} · mức ≥ {c.minLevel}
                </span>
              ))}
          </div>
        </div>
        <div className="mt-4">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Kỹ năng</p>
          <p className="mt-1.5 text-xs text-slate-300">{(job.requiredSkills || []).join(", ") || "Chưa có"}</p>
        </div>
        <div className="mt-4">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Mô tả công việc</p>
          <p className="mt-1.5 whitespace-pre-line rounded-xl border border-slate-800 bg-[#0b0716]/60 p-3 text-xs leading-relaxed text-slate-300">{job.description || "Chưa có mô tả"}</p>
        </div>
        <div className="mt-6 flex justify-end border-t border-slate-800 pt-4">
          <button onClick={onClose} className="rounded-xl border border-slate-700 px-4 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-800">Đóng</button>
        </div>
      </div>
    </div>
  );
}
