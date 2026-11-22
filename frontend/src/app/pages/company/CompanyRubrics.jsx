import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  Eye,
  Loader2,
  Pencil,
  Plus,
  RefreshCw,
  Send,
  Sliders,
  Sparkles,
  Trash2,
  XCircle,
} from "lucide-react";
import { companyApi } from "../../api/companyApi.js";
import { competenciesApi } from "../../api/competenciesApi.js";
import { tryApi } from "../../utils/shared/apiToast.js";
import { useRoleCategories } from "../../hooks/useRoleCategories.js";
import { competencyOptions, shrmLabel } from "../../utils/learningPath/learningPathEditor.js";
import {
  ROLE_CATEGORIES,
  RUBRIC_LEVELS,
  RUBRIC_MAX_CRITERIA,
  RUBRIC_STATUS,
  emptyCriterion,
  isRubricEditable,
  missingLevels,
  roleLabel,
  saveErrors,
  submitErrors,
  suggestLevels,
  toEditorState,
  toPayload,
  totalWeight,
} from "../../utils/company/rubricEditor.js";

const STATUS_STYLE = {
  approved: "bg-emerald-500/10 text-emerald-400",
  pending_review: "bg-amber-500/10 text-amber-400",
  rejected: "bg-rose-500/10 text-rose-400",
  draft: "bg-slate-700/50 text-slate-400",
  archived: "bg-slate-800 text-slate-500",
};
const STATUS_ICON = { approved: CheckCircle2, pending_review: Clock, rejected: XCircle };

const inputCls = "rounded-lg border border-slate-800 bg-slate-900 px-3 py-1.5 text-xs text-white focus:border-violet-500 focus:outline-none";

/**
 * Vị trí tuyển từ `GET /api/role-categories` (danh sách chung với câu hỏi công ty và tin tuyển dụng).
 * Khi chưa tải xong (hoặc lỗi mạng) dùng tạm danh sách mặc định trong rubricEditor.js.
 */
function useRubricRoles() {
  const { roleCategories, labelOf } = useRoleCategories();
  if (!roleCategories.length) return { options: ROLE_CATEGORIES, label: roleLabel };
  return { options: roleCategories.map((r) => ({ id: r.key, label: r.nameVi })), label: labelOf };
}

function StatusBadge({ status }) {
  const Icon = STATUS_ICON[status];
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${STATUS_STYLE[status] || STATUS_STYLE.draft}`}>
      {Icon ? <Icon className="size-3" /> : null}
      {RUBRIC_STATUS[status] || status}
    </span>
  );
}

/**
 * /company/rubrics — CO-14. Company Moderator soạn rubric theo vị trí: tiêu chí, trọng số (tổng 100%),
 * năng lực SHRM/DDI (bộ tiêu chí LP-01), mô tả thang 0–5, câu hỏi áp dụng; gửi Platform Moderator duyệt,
 * bị từ chối thì thấy lý do, sửa và gửi lại.
 */
export function CompanyRubrics() {
  const roles = useRubricRoles();
  const [rubrics, setRubrics] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedRole, setSelectedRole] = useState("");
  const [framework, setFramework] = useState(null);
  const [editing, setEditing] = useState(null); // null = đóng; { rubric } (rubric null = tạo mới)
  const [viewRubric, setViewRubric] = useState(null);

  const fetchRubrics = useCallback(async () => {
    setLoading(true);
    const res = await tryApi(() => companyApi.listRubrics({ roleCategory: selectedRole }), { fallback: "Không thể tải danh sách rubric." });
    setLoading(false);
    if (res.success) setRubrics(res.rubrics || []);
  }, [selectedRole]);

  useEffect(() => {
    fetchRubrics();
  }, [fetchRubrics]);

  useEffect(() => {
    competenciesApi.getFramework().then((res) => res.success && setFramework(res.framework));
  }, []);

  const submit = async (id) => {
    if (!window.confirm("Gửi rubric này cho Platform Moderator thẩm định? Trong lúc chờ duyệt bạn sẽ không sửa được.")) return;
    const res = await tryApi(() => companyApi.submitRubric(id), {
      fallback: "Không thể gửi duyệt rubric.",
      successMessage: "Đã gửi rubric. Vui lòng chờ Platform Moderator duyệt.",
    });
    if (res.success) fetchRubrics();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="flex items-center gap-2.5 text-2xl font-bold tracking-tight text-white">
            <Sliders className="size-6 text-violet-400" />
            Rubric đánh giá năng lực ứng viên
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            Tiêu chuẩn chấm điểm riêng cho từng vị trí, gắn với khung SHRM/DDI. Platform Moderator duyệt trước khi dùng để chấm ứng viên.
          </p>
        </div>
        <button
          onClick={() => setEditing({ rubric: null })}
          className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-2.5 text-xs font-semibold text-white shadow-lg shadow-violet-600/30 transition hover:bg-violet-500"
        >
          <Plus className="size-4" />
          Tạo Rubric mới
        </button>
      </div>

      <div className="flex items-center justify-between rounded-2xl border border-slate-800 bg-slate-900/60 p-3.5 backdrop-blur-xl">
        <select
          value={selectedRole}
          onChange={(e) => setSelectedRole(e.target.value)}
          aria-label="Lọc theo vị trí"
          className="rounded-xl border border-slate-800 bg-slate-950 px-3 py-1.5 text-xs text-slate-300 focus:border-violet-500 focus:outline-none"
        >
          <option value="">Tất cả vị trí</option>
          {roles.options.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}
        </select>
        <button onClick={fetchRubrics} title="Làm mới" aria-label="Làm mới" className="rounded-xl border border-slate-800 bg-slate-950 p-2 text-slate-400 transition hover:text-white">
          <RefreshCw className="size-4" />
        </button>
      </div>

      <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
        {loading ? (
          <div className="col-span-full py-12 text-center text-slate-400">
            <Loader2 className="mx-auto size-6 animate-spin text-violet-500" />
            <span className="mt-2 block text-xs">Đang tải danh sách rubric...</span>
          </div>
        ) : rubrics.length === 0 ? (
          <div className="col-span-full rounded-2xl border border-slate-800 bg-slate-900/40 py-12 text-center text-slate-400">
            <Sliders className="mx-auto size-8 text-slate-600" />
            <p className="mt-2 font-medium text-slate-300">Chưa có rubric nào</p>
            <p className="mt-0.5 text-xs text-slate-500">Bấm "Tạo Rubric mới" để xây dựng bộ tiêu chí đánh giá.</p>
          </div>
        ) : (
          rubrics.map((r) => {
            const editable = isRubricEditable(r.status);
            return (
              <div key={r._id} className="flex flex-col justify-between rounded-2xl border border-slate-800 bg-slate-900/60 p-5 backdrop-blur-xl transition hover:border-slate-700">
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="rounded-md bg-slate-800 px-2.5 py-0.5 text-[11px] font-semibold text-slate-300">
                      v{r.version} • {roles.label(r.roleCategory)}
                    </span>
                    <StatusBadge status={r.status} />
                  </div>
                  <h3 className="mt-3 text-base font-bold leading-snug text-white">{r.title}</h3>
                  {r.description && <p className="mt-1 line-clamp-2 text-xs text-slate-400">{r.description}</p>}

                  {r.status === "rejected" && r.moderationNote?.comment && (
                    <div className="mt-3 rounded-xl border border-rose-500/20 bg-rose-500/10 p-2.5 text-xs text-rose-300">
                      <strong>Lý do từ chối:</strong> {r.moderationNote.comment}
                      <span className="mt-1 block text-rose-300/80">Bấm "Sửa" để chỉnh theo góp ý rồi gửi lại.</span>
                    </div>
                  )}

                  <div className="mt-4 border-t border-slate-800/80 pt-3">
                    <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Tiêu chí ({r.criteria?.length || 0})</p>
                    <div className="space-y-1.5">
                      {r.criteria?.slice(0, 3).map((c, idx) => (
                        <div key={idx} className="flex items-center justify-between text-xs text-slate-300">
                          <span className="truncate pr-2">• {c.name}</span>
                          <span className="shrink-0 font-medium text-slate-400">{c.weight}%</span>
                        </div>
                      ))}
                      {r.criteria?.length > 3 && <p className="text-[10px] italic text-slate-500">+{r.criteria.length - 3} tiêu chí khác...</p>}
                    </div>
                  </div>
                </div>

                <div className="mt-6 flex items-center justify-between gap-2 border-t border-slate-800/80 pt-3.5">
                  <button onClick={() => setViewRubric(r)} className="inline-flex items-center gap-1 text-xs font-semibold text-violet-400 hover:text-violet-300">
                    <Eye className="size-3.5" /> Xem chi tiết
                  </button>
                  {editable && (
                    <div className="flex items-center gap-2">
                      <button onClick={() => setEditing({ rubric: r })} className="inline-flex items-center gap-1 rounded-lg border border-slate-700 px-3 py-1.5 text-xs font-semibold text-slate-200 hover:bg-slate-800">
                        <Pencil className="size-3" /> Sửa
                      </button>
                      <button onClick={() => submit(r._id)} className="inline-flex items-center gap-1.5 rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-violet-500">
                        <Send className="size-3" /> Gửi duyệt
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {editing && (
        <RubricEditorModal
          rubric={editing.rubric}
          framework={framework}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); fetchRubrics(); }}
        />
      )}
      {viewRubric && <RubricDetailModal rubric={viewRubric} framework={framework} onClose={() => setViewRubric(null)} />}
    </div>
  );
}

function RubricEditorModal({ rubric, framework, onClose, onSaved }) {
  const roles = useRubricRoles();
  const [form, setForm] = useState(() => toEditorState(rubric));
  const [openLevels, setOpenLevels] = useState(() => new Set([0]));
  const [questions, setQuestions] = useState([]);
  const [saving, setSaving] = useState(false);
  const isNew = !form.id;

  const options = useMemo(() => competencyOptions(framework), [framework]);
  const selectableKeys = useMemo(() => (framework ? new Set(options.map((o) => o.key)) : null), [framework, options]);
  const total = totalWeight(form.criteria);
  const blocking = saveErrors(form, selectableKeys);
  const submitBlocking = submitErrors(form, selectableKeys);

  // Câu đã duyệt của công ty cho vị trí đang chọn — để gắn vào từng tiêu chí.
  useEffect(() => {
    let active = true;
    companyApi.listQuestions({ status: "approved", roleCategory: form.roleCategory, limit: 100 }).then((res) => {
      if (active) setQuestions(res.success ? res.questions || res.items || [] : []);
    });
    return () => { active = false; };
  }, [form.roleCategory]);

  const setCriterion = (idx, patch) =>
    setForm((f) => ({ ...f, criteria: f.criteria.map((c, i) => (i === idx ? { ...c, ...patch } : c)) }));
  const toggleLevels = (idx) =>
    setOpenLevels((s) => { const next = new Set(s); next.has(idx) ? next.delete(idx) : next.add(idx); return next; });

  const save = async (andSubmit) => {
    if ((andSubmit ? submitBlocking : blocking).length) return;
    setSaving(true);
    const payload = toPayload(form);
    const saved = await tryApi(
      () => (isNew ? companyApi.createRubric(payload) : companyApi.updateRubric(form.id, payload)),
      { fallback: "Không lưu được rubric.", successMessage: andSubmit ? undefined : "Đã lưu bản nháp." },
    );
    if (saved.success && andSubmit) {
      await tryApi(() => companyApi.submitRubric(saved.rubric._id), {
        fallback: "Đã lưu nhưng chưa gửi duyệt được.",
        successMessage: "Đã lưu và gửi rubric cho Platform Moderator.",
      });
    }
    setSaving(false);
    if (saved.success) onSaved();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-3xl border border-slate-800 bg-slate-900 p-6 shadow-2xl" role="dialog" aria-modal="true" aria-labelledby="rubric-editor-title">
        <h3 id="rubric-editor-title" className="flex items-center gap-2 text-lg font-bold text-white">
          <Sliders className="size-5 text-violet-400" />
          {isNew ? "Soạn rubric mới" : `Sửa rubric v${rubric.version}`}
        </h3>
        {rubric?.status === "rejected" && rubric.moderationNote?.comment && (
          <p className="mt-3 rounded-xl border border-rose-500/20 bg-rose-500/10 p-2.5 text-xs text-rose-300">
            <strong>Lý do bị từ chối:</strong> {rubric.moderationNote.comment}
          </p>
        )}

        <div className="mt-5 space-y-4">
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400">
            Tên rubric *
            <input className={`${inputCls} mt-1.5 w-full py-2.5 text-sm normal-case tracking-normal`} value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} placeholder="Ví dụ: Khung đánh giá Senior Frontend Engineer" />
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400">
              Vị trí ứng tuyển *
              <select
                className={`${inputCls} mt-1.5 w-full py-2 normal-case tracking-normal disabled:opacity-60`}
                value={form.roleCategory}
                disabled={!isNew}
                title={isNew ? undefined : "Vị trí cố định theo phiên bản rubric"}
                onChange={(e) => setForm((f) => ({ ...f, roleCategory: e.target.value, criteria: f.criteria.map((c) => ({ ...c, questionIds: [] })) }))}
              >
                {roles.options.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}
              </select>
            </label>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400">
              Mô tả ngắn
              <input className={`${inputCls} mt-1.5 w-full py-2 normal-case tracking-normal`} value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} placeholder="Phạm vi áp dụng của rubric" />
            </label>
          </div>

          <div className="border-t border-slate-800 pt-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Tiêu chí</span>
                <span className={`rounded px-2 py-0.5 text-xs font-bold ${total === 100 ? "bg-emerald-500/10 text-emerald-400" : "bg-rose-500/10 text-rose-400"}`}>
                  Tổng: {total}% / 100%
                </span>
              </div>
              <button
                type="button"
                disabled={form.criteria.length >= RUBRIC_MAX_CRITERIA}
                onClick={() => { setForm((f) => ({ ...f, criteria: [...f.criteria, emptyCriterion()] })); setOpenLevels((s) => new Set(s).add(form.criteria.length)); }}
                className="inline-flex items-center gap-1 text-xs font-semibold text-violet-400 hover:text-violet-300 disabled:opacity-40"
              >
                <Plus className="size-3.5" /> Thêm tiêu chí
              </button>
            </div>

            <div className="space-y-3">
              {form.criteria.map((c, idx) => {
                const missing = missingLevels(c);
                const open = openLevels.has(idx);
                const stale = c.shrmKey && selectableKeys && !selectableKeys.has(c.shrmKey);
                return (
                  <div key={idx} className="space-y-2.5 rounded-xl border border-slate-800 bg-slate-950/70 p-3.5">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-500">{idx + 1}.</span>
                      <input className={`${inputCls} min-w-0 flex-1`} aria-label={`Tên tiêu chí ${idx + 1}`} placeholder="Tên tiêu chí (vd: Thiết kế API)" value={c.name} onChange={(e) => setCriterion(idx, { name: e.target.value })} />
                      <input
                        type="number" min={1} max={100} aria-label={`Trọng số tiêu chí ${idx + 1}`}
                        className={`${inputCls} w-16 shrink-0 text-right`}
                        value={c.weight || ""}
                        onChange={(e) => setCriterion(idx, { weight: Number(e.target.value) })}
                      />
                      <span className="text-xs text-slate-400">%</span>
                      {form.criteria.length > 1 && (
                        <button type="button" aria-label={`Xóa tiêu chí ${idx + 1}`} onClick={() => setForm((f) => ({ ...f, criteria: f.criteria.filter((_, i) => i !== idx) }))} className="p-1 text-slate-500 transition hover:text-rose-400">
                          <Trash2 className="size-4" />
                        </button>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[11px] text-slate-400">Năng lực SHRM/DDI:</span>
                      <select
                        className={`${inputCls} w-auto min-w-[14rem]`}
                        aria-label={`Năng lực của tiêu chí ${idx + 1}`}
                        value={c.shrmKey}
                        onChange={(e) => setCriterion(idx, { shrmKey: e.target.value })}
                      >
                        <option value="">{framework ? "Chọn năng lực…" : "Đang tải bộ tiêu chí…"}</option>
                        {stale && <option value={c.shrmKey}>{shrmLabel(c.shrmKey, framework)} (không còn dùng)</option>}
                        {options.map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}
                      </select>
                      {stale && <span className="text-[11px] text-rose-400">Năng lực này đã ngừng dùng, chọn năng lực khác.</span>}
                    </div>

                    <div className="rounded-lg border border-slate-800">
                      <button type="button" onClick={() => toggleLevels(idx)} aria-expanded={open} className="flex w-full items-center justify-between px-3 py-2 text-left text-[11px] font-semibold text-slate-300">
                        <span>
                          Mô tả thang 0–5{" "}
                          <span className={missing.length ? "text-amber-400" : "text-emerald-400"}>
                            {missing.length ? `(còn thiếu ${missing.length} mức)` : "(đủ 6 mức)"}
                          </span>
                        </span>
                        {open ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
                      </button>
                      {open && (
                        <div className="space-y-2 border-t border-slate-800 p-3">
                          <button
                            type="button"
                            disabled={!c.shrmKey || !framework}
                            onClick={() => setCriterion(idx, { levels: suggestLevels(framework, c.shrmKey, c.levels) })}
                            className="inline-flex items-center gap-1 text-[11px] font-semibold text-violet-400 hover:text-violet-300 disabled:opacity-40"
                          >
                            <Sparkles className="size-3" /> Điền gợi ý từ khung SHRM/DDI vào các mức còn trống
                          </button>
                          {RUBRIC_LEVELS.map((l) => (
                            <label key={l} className="flex items-start gap-2 text-[11px] text-slate-400">
                              <span className="mt-1.5 w-12 shrink-0 font-bold text-violet-400">Mức {l}</span>
                              <textarea
                                rows={2}
                                maxLength={500}
                                className={`${inputCls} w-full resize-y`}
                                value={c.levels[l]}
                                onChange={(e) => setCriterion(idx, { levels: { ...c.levels, [l]: e.target.value } })}
                                placeholder={`Ứng viên ở mức ${l} thể hiện…`}
                              />
                            </label>
                          ))}
                        </div>
                      )}
                    </div>

                    <details className="rounded-lg border border-slate-800">
                      <summary className="cursor-pointer px-3 py-2 text-[11px] font-semibold text-slate-300">
                        Câu hỏi áp dụng ({c.questionIds.length})
                      </summary>
                      <div className="max-h-48 space-y-1 overflow-y-auto border-t border-slate-800 p-3">
                        {questions.length === 0 ? (
                          <p className="text-[11px] text-slate-500">Chưa có câu hỏi đã duyệt cho vị trí {roles.label(form.roleCategory)}. Duyệt câu ở trang Câu hỏi phỏng vấn trước.</p>
                        ) : (
                          questions.map((q) => {
                            const qid = String(q._id);
                            const checked = c.questionIds.includes(qid);
                            return (
                              <label key={qid} className="flex items-start gap-2 text-[11px] text-slate-300">
                                <input
                                  type="checkbox"
                                  className="mt-0.5 accent-violet-500"
                                  checked={checked}
                                  onChange={() => setCriterion(idx, { questionIds: checked ? c.questionIds.filter((x) => x !== qid) : [...c.questionIds, qid] })}
                                />
                                <span>{q.text || q.question}</span>
                              </label>
                            );
                          })
                        )}
                      </div>
                    </details>
                  </div>
                );
              })}
            </div>
          </div>

          {submitBlocking.length > 0 && (
            <ul className="space-y-0.5 rounded-xl border border-amber-500/20 bg-amber-500/5 p-3 text-[11px] text-amber-300">
              <li className="font-semibold">Cần hoàn thiện trước khi gửi duyệt:</li>
              {submitBlocking.map((e) => <li key={e}>• {e}</li>)}
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
            className="inline-flex items-center gap-1.5 rounded-xl border border-violet-500/40 px-4 py-2 text-xs font-semibold text-violet-200 hover:bg-violet-500/10 disabled:opacity-50"
          >
            {saving ? <Loader2 className="size-3.5 animate-spin" /> : <CheckCircle2 className="size-3.5" />}
            Lưu bản nháp
          </button>
          <button
            type="button"
            disabled={saving || submitBlocking.length > 0}
            title={submitBlocking[0]}
            onClick={() => save(true)}
            className="inline-flex items-center gap-1.5 rounded-xl bg-violet-600 px-5 py-2 text-xs font-semibold text-white shadow-lg shadow-violet-600/30 hover:bg-violet-500 disabled:opacity-50"
          >
            <Send className="size-3.5" />
            Lưu và gửi duyệt
          </button>
        </div>
      </div>
    </div>
  );
}

function RubricDetailModal({ rubric, framework, onClose }) {
  const roles = useRubricRoles();
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-3xl border border-slate-800 bg-slate-900 p-6 shadow-2xl" role="dialog" aria-modal="true">
        <div className="flex items-start justify-between gap-3 border-b border-slate-800 pb-4">
          <div>
            <span className="rounded-md bg-slate-800 px-2 py-0.5 text-[11px] font-semibold text-slate-400">
              Phiên bản {rubric.version} • {roles.label(rubric.roleCategory)}
            </span>
            <h3 className="mt-1 text-lg font-bold text-white">{rubric.title}</h3>
          </div>
          <StatusBadge status={rubric.status} />
        </div>
        {rubric.moderationNote?.comment && (
          <p className={`mt-4 rounded-xl border p-3 text-xs ${rubric.status === "rejected" ? "border-rose-500/20 bg-rose-500/10 text-rose-300" : "border-slate-800 bg-slate-950/60 text-slate-300"}`}>
            <strong>{rubric.status === "rejected" ? "Lý do từ chối" : "Nhận xét của Platform Moderator"}:</strong> {rubric.moderationNote.comment}
          </p>
        )}
        {rubric.description && <p className="mt-4 rounded-xl border border-slate-800 bg-slate-950/60 p-3 text-xs text-slate-300">{rubric.description}</p>}

        <div className="mt-4 space-y-3">
          {rubric.criteria?.map((c, idx) => (
            <div key={idx} className="rounded-xl border border-slate-800 bg-slate-950/70 p-4">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-semibold text-white">{idx + 1}. {c.name}</span>
                <span className="rounded bg-violet-500/20 px-2 py-0.5 text-xs font-bold text-violet-300">{c.weight}%</span>
              </div>
              <p className="mt-0.5 text-[11px] text-slate-400">
                Năng lực: {shrmLabel(c.shrmKey, framework)} · {c.questionIds?.length || 0} câu hỏi áp dụng
              </p>
              <div className="mt-3 grid grid-cols-1 gap-2 border-t border-slate-800/80 pt-2.5 sm:grid-cols-2">
                {RUBRIC_LEVELS.map((l) => (
                  <div key={l} className="rounded border border-slate-800 bg-slate-900 p-2 text-[11px]">
                    <span className="mb-0.5 block font-bold text-violet-400">Mức {l}</span>
                    <span className="text-slate-300">{c.levels?.[l] || "Chưa có mô tả"}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-6 flex justify-end border-t border-slate-800 pt-4">
          <button onClick={onClose} className="rounded-xl border border-slate-700 px-4 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-800">Đóng</button>
        </div>
      </div>
    </div>
  );
}
