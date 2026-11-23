import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router";
import { ArrowDown, ArrowLeft, ArrowUp, Download, Loader2, Plus, RefreshCw, Save, Sparkles, Trash2, Wand2 } from "lucide-react";
import { cvsApi } from "../../api/cvsApi.js";
import { tryApi, toastApiError, toastApiSuccess } from "../../utils/shared/apiToast.js";
import {
  appendBullet,
  applyBulletSuggestion,
  emptyCertification,
  emptyEducation,
  emptyExperience,
  emptyProject,
  extractBulletSuggestions,
  findBulletMatches,
  isContentChanged,
  normalizeCvContent,
  pdfFileName,
  splitList,
  toSavePayload,
} from "../../utils/cv/cvEditor.js";
import "../../../styles/mentorship-requests.css";
import "../../../styles/cv-vault.css";

/**
 * PR-13: trình sửa CV `/cvs/:id/edit` — sửa theo mục, áp gợi ý AI vào bullet, lưu (mỗi lần lưu nội dung
 * backend tăng `version`, PR-02), tải PDF (PR-09). Logic thuần ở `utils/cv/cvEditor.js`.
 */
export function CvEditor() {
  const { id } = useParams();
  const [cv, setCv] = useState(null);
  const [saved, setSaved] = useState(null); // nội dung + tiêu đề đã lưu, để biết còn thay đổi chưa lưu
  const [draft, setDraft] = useState(null);
  const [meta, setMeta] = useState({ title: "", targetRole: "" });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [suggestionGroups, setSuggestionGroups] = useState([]);
  const [groupId, setGroupId] = useState("");
  const [appliedKeys, setAppliedKeys] = useState(() => new Set());

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    const [res, analyses] = await Promise.all([cvsApi.get(id), cvsApi.listAnalyses()]);
    if (res.success && res.cv) {
      const content = normalizeCvContent(res.cv.content);
      // CV tải tệp lên có kỹ năng tách sẵn ở `cv.skills`, `content.skills` còn rỗng: lấy làm giá trị ban đầu
      // để lần lưu đầu không xóa mất kỹ năng (khi lưu gửi cả hai, xem `save`).
      if (content.skills.length === 0 && Array.isArray(res.cv.skills)) content.skills = res.cv.skills.map(String);
      setCv(res.cv);
      setDraft(content);
      setMeta({ title: res.cv.title || "", targetRole: res.cv.targetRole || "" });
      setSaved({ content, title: res.cv.title || "", targetRole: res.cv.targetRole || "" });
    } else {
      setError(res.error || "Không tải được CV.");
    }
    if (analyses.success) {
      const groups = extractBulletSuggestions(analyses.list || analyses.analyses || []);
      setSuggestionGroups(groups);
      setGroupId((cur) => cur || groups[0]?.analysisId || "");
    }
    setLoading(false);
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const dirty = Boolean(
    saved &&
      draft &&
      (isContentChanged(saved.content, draft) ||
        meta.title.trim() !== saved.title.trim() ||
        meta.targetRole.trim() !== saved.targetRole.trim()),
  );

  // Cảnh báo khi đóng tab lúc còn thay đổi chưa lưu.
  useEffect(() => {
    if (!dirty) return undefined;
    const onBeforeUnload = (e) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty]);

  const save = async () => {
    if (!meta.title.trim()) {
      toastApiError("Tên CV không được để trống.");
      return null;
    }
    setSaving(true);
    const content = toSavePayload(draft);
    const res = await tryApi(
      // `skills` cấp ngoài cũng gửi: PDF (PR-09) ưu tiên `cv.skills` hơn `content.skills`.
      () => cvsApi.update(id, { title: meta.title.trim(), targetRole: meta.targetRole.trim(), content, skills: content.skills }),
      { fallback: "Không lưu được CV." },
    );
    setSaving(false);
    if (!res.success) return null;
    const next = normalizeCvContent(res.cv?.content ?? content);
    setCv(res.cv);
    setDraft(next);
    setSaved({ content: next, title: res.cv?.title ?? meta.title.trim(), targetRole: res.cv?.targetRole ?? meta.targetRole.trim() });
    toastApiSuccess(`Đã lưu CV (bản ${res.cv?.version ?? ""}).`);
    return res;
  };

  const downloadPdf = async () => {
    // PDF xuất từ bản đã lưu trên server, nên lưu trước nếu còn thay đổi.
    if (dirty && !(await save())) return;
    setDownloading(true);
    const res = await tryApi(() => cvsApi.downloadPdf(id), { fallback: "Không tải được PDF." });
    setDownloading(false);
    if (!res.success) return;
    const url = URL.createObjectURL(res.blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = pdfFileName(meta.title);
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const update = (patch) => setDraft((d) => ({ ...d, ...patch }));
  const setPersonal = (key, value) => setDraft((d) => ({ ...d, personalInfo: { ...d.personalInfo, [key]: value } }));
  const listOps = (key, makeEmpty) => ({
    add: () => setDraft((d) => ({ ...d, [key]: [...d[key], makeEmpty()] })),
    remove: (i) => setDraft((d) => ({ ...d, [key]: d[key].filter((_, j) => j !== i) })),
    move: (i, delta) =>
      setDraft((d) => {
        const list = [...d[key]];
        const j = i + delta;
        if (j < 0 || j >= list.length) return d;
        [list[i], list[j]] = [list[j], list[i]];
        return { ...d, [key]: list };
      }),
    set: (i, field, value) => setDraft((d) => ({ ...d, [key]: d[key].map((x, j) => (j === i ? { ...x, [field]: value } : x)) })),
  });
  const exps = listOps("experiences", emptyExperience);
  const edus = listOps("educations", emptyEducation);
  const projs = listOps("projects", emptyProject);
  const certs = listOps("certifications", emptyCertification);

  const setBullet = (ei, bi, value) =>
    setDraft((d) => ({
      ...d,
      experiences: d.experiences.map((e, i) => (i === ei ? { ...e, bullets: e.bullets.map((b, j) => (j === bi ? value : b)) } : e)),
    }));
  const addBulletLine = (ei) =>
    setDraft((d) => ({ ...d, experiences: d.experiences.map((e, i) => (i === ei ? { ...e, bullets: [...e.bullets, ""] } : e)) }));
  const removeBullet = (ei, bi) =>
    setDraft((d) => ({
      ...d,
      experiences: d.experiences.map((e, i) => (i === ei ? { ...e, bullets: e.bullets.filter((_, j) => j !== bi) } : e)),
    }));

  const group = suggestionGroups.find((g) => g.analysisId === groupId) || null;

  const applySuggestion = (item, key, target) => {
    setDraft((d) => (target.bulletIndex == null ? appendBullet(d, target.expIndex, item.rewritten) : applyBulletSuggestion(d, target, item.rewritten)));
    setAppliedKeys((s) => new Set(s).add(key));
  };

  if (loading) {
    return (
      <div className="mr-page cv-vault">
        <div className="mr-loading" role="status">Đang tải CV…</div>
      </div>
    );
  }

  if (error || !draft) {
    return (
      <div className="mr-page cv-vault">
        <Link to="/cvs" className="mr-back"><ArrowLeft size={15} /> Kho CV</Link>
        <div className="mr-error" role="alert">
          {error || "Không tải được CV."}
          <button type="button" data-button-surface="none" onClick={load}><RefreshCw size={14} /> Tải lại</button>
        </div>
      </div>
    );
  }

  return (
    <div className="mr-page cv-vault cv-editor">
      <Link to="/cvs" className="mr-back"><ArrowLeft size={15} /> Kho CV</Link>

      <header className="mr-heading">
        <div>
          <h1>Sửa CV</h1>
          <p>
            Bản {cv?.version || 1}
            {dirty ? " · Có thay đổi chưa lưu" : " · Đã lưu"}
            {cv?.fileName ? ` · Tệp gốc: ${cv.fileName} (nội dung sửa ở đây không đổi tệp gốc)` : ""}
          </p>
        </div>
        <div className="cv-editor-actions">
          <button type="button" data-button-surface="none" className="mr-secondary" disabled={downloading || saving} onClick={downloadPdf}>
            {downloading ? <Loader2 size={15} className="cv-spin" /> : <Download size={15} />}
            {dirty ? "Lưu và tải PDF" : "Tải PDF"}
          </button>
          <button type="button" data-button-surface="none" className="mr-primary" disabled={saving || !dirty} onClick={save}>
            {saving ? <Loader2 size={15} className="cv-spin" /> : <Save size={15} />} Lưu
          </button>
        </div>
      </header>

      <div className="cv-editor-layout">
        <div className="cv-editor-main">
          <section className="mr-panel">
            <h3>Thông tin CV</h3>
            <div className="mr-form-grid">
              <label>
                Tên CV *
                <input value={meta.title} maxLength={120} onChange={(e) => setMeta((m) => ({ ...m, title: e.target.value }))} />
              </label>
              <label>
                Vị trí mục tiêu
                <input value={meta.targetRole} maxLength={120} onChange={(e) => setMeta((m) => ({ ...m, targetRole: e.target.value }))} placeholder="Ví dụ: Frontend Developer" />
              </label>
            </div>
          </section>

          <section className="mr-panel">
            <h3>Thông tin cá nhân</h3>
            <div className="mr-form-grid">
              {[
                ["fullName", "Họ và tên"],
                ["email", "Email"],
                ["phone", "Số điện thoại"],
                ["location", "Địa chỉ"],
                ["website", "Website"],
                ["linkedin", "LinkedIn"],
                ["github", "GitHub"],
              ].map(([key, label]) => (
                <label key={key}>
                  {label}
                  <input value={draft.personalInfo[key]} maxLength={200} onChange={(e) => setPersonal(key, e.target.value)} />
                </label>
              ))}
            </div>
          </section>

          <section className="mr-panel">
            <h3>Tóm tắt</h3>
            <label className="cv-editor-full">
              <span className="sr-only">Tóm tắt</span>
              <textarea rows={4} maxLength={2000} value={draft.summary} onChange={(e) => update({ summary: e.target.value })} placeholder="2–3 câu về kinh nghiệm và thế mạnh của bạn" />
            </label>
          </section>

          <section className="mr-panel">
            <SectionHeading title="Kinh nghiệm làm việc" onAdd={exps.add} addLabel="Thêm kinh nghiệm" />
            {draft.experiences.length === 0 && <p className="mr-muted">Chưa có kinh nghiệm.</p>}
            {draft.experiences.map((exp, i) => (
              <div key={i} className="cv-editor-item">
                <ItemToolbar label={exp.position || exp.company || `Kinh nghiệm ${i + 1}`} index={i} count={draft.experiences.length} ops={exps} />
                <div className="mr-form-grid">
                  <label>Công ty<input value={exp.company} maxLength={150} onChange={(e) => exps.set(i, "company", e.target.value)} /></label>
                  <label>Vị trí<input value={exp.position} maxLength={150} onChange={(e) => exps.set(i, "position", e.target.value)} /></label>
                  <label>Bắt đầu<input value={exp.startDate} maxLength={30} placeholder="06/2024" onChange={(e) => exps.set(i, "startDate", e.target.value)} /></label>
                  <label>
                    Kết thúc
                    <input value={exp.isCurrent ? "" : exp.endDate} maxLength={30} placeholder="12/2025" disabled={exp.isCurrent} onChange={(e) => exps.set(i, "endDate", e.target.value)} />
                  </label>
                </div>
                <label className="cv-editor-check">
                  <input type="checkbox" checked={exp.isCurrent} onChange={(e) => exps.set(i, "isCurrent", e.target.checked)} /> Đang làm ở đây
                </label>
                <label className="cv-editor-full">
                  Mô tả ngắn
                  <textarea rows={2} maxLength={1000} value={exp.description} onChange={(e) => exps.set(i, "description", e.target.value)} />
                </label>
                <div className="cv-editor-bullets">
                  <span className="cv-editor-label">Thành tích / công việc chính</span>
                  {exp.bullets.map((b, bi) => (
                    <div key={bi} className="cv-editor-bullet">
                      <span aria-hidden="true">•</span>
                      <textarea rows={2} maxLength={500} value={b} aria-label={`Bullet ${bi + 1}`} onChange={(e) => setBullet(i, bi, e.target.value)} />
                      <button type="button" data-button-surface="none" className="cv-icon-button" aria-label="Xóa bullet" onClick={() => removeBullet(i, bi)}><Trash2 size={13} /></button>
                    </div>
                  ))}
                  <button type="button" data-button-surface="none" className="mr-text-button" onClick={() => addBulletLine(i)}><Plus size={13} /> Thêm bullet</button>
                </div>
              </div>
            ))}
          </section>

          <section className="mr-panel">
            <SectionHeading title="Học vấn" onAdd={edus.add} addLabel="Thêm học vấn" />
            {draft.educations.length === 0 && <p className="mr-muted">Chưa có học vấn.</p>}
            {draft.educations.map((edu, i) => (
              <div key={i} className="cv-editor-item">
                <ItemToolbar label={edu.institution || `Học vấn ${i + 1}`} index={i} count={draft.educations.length} ops={edus} />
                <div className="mr-form-grid">
                  <label>Trường<input value={edu.institution} maxLength={150} onChange={(e) => edus.set(i, "institution", e.target.value)} /></label>
                  <label>Bằng cấp<input value={edu.degree} maxLength={100} onChange={(e) => edus.set(i, "degree", e.target.value)} /></label>
                  <label>Chuyên ngành<input value={edu.fieldOfStudy} maxLength={100} onChange={(e) => edus.set(i, "fieldOfStudy", e.target.value)} /></label>
                  <label>GPA<input value={edu.gpa} maxLength={20} onChange={(e) => edus.set(i, "gpa", e.target.value)} /></label>
                  <label>Bắt đầu<input value={edu.startDate} maxLength={30} onChange={(e) => edus.set(i, "startDate", e.target.value)} /></label>
                  <label>Kết thúc<input value={edu.endDate} maxLength={30} onChange={(e) => edus.set(i, "endDate", e.target.value)} /></label>
                </div>
              </div>
            ))}
          </section>

          <section className="mr-panel">
            <h3>Kỹ năng</h3>
            <ListInput value={draft.skills} onChange={(skills) => update({ skills })} placeholder="React, Node.js, MongoDB" label="Kỹ năng (cách nhau bằng dấu phẩy)" />
          </section>

          <section className="mr-panel">
            <SectionHeading title="Dự án" onAdd={projs.add} addLabel="Thêm dự án" />
            {draft.projects.length === 0 && <p className="mr-muted">Chưa có dự án.</p>}
            {draft.projects.map((p, i) => (
              <div key={i} className="cv-editor-item">
                <ItemToolbar label={p.name || `Dự án ${i + 1}`} index={i} count={draft.projects.length} ops={projs} />
                <div className="mr-form-grid">
                  <label>Tên dự án<input value={p.name} maxLength={150} onChange={(e) => projs.set(i, "name", e.target.value)} /></label>
                  <label>Vai trò<input value={p.role} maxLength={100} onChange={(e) => projs.set(i, "role", e.target.value)} /></label>
                  <label>Link<input value={p.link} maxLength={300} onChange={(e) => projs.set(i, "link", e.target.value)} /></label>
                </div>
                <ListInput value={p.technologies} onChange={(v) => projs.set(i, "technologies", v)} placeholder="React, Express" label="Công nghệ" />
                <label className="cv-editor-full">
                  Mô tả
                  <textarea rows={3} maxLength={1500} value={p.description} onChange={(e) => projs.set(i, "description", e.target.value)} />
                </label>
              </div>
            ))}
          </section>

          <section className="mr-panel">
            <SectionHeading title="Chứng chỉ" onAdd={certs.add} addLabel="Thêm chứng chỉ" />
            {draft.certifications.length === 0 && <p className="mr-muted">Chưa có chứng chỉ.</p>}
            {draft.certifications.map((c, i) => (
              <div key={i} className="cv-editor-item">
                <ItemToolbar label={c.name || `Chứng chỉ ${i + 1}`} index={i} count={draft.certifications.length} ops={certs} />
                <div className="mr-form-grid">
                  <label>Tên<input value={c.name} maxLength={150} onChange={(e) => certs.set(i, "name", e.target.value)} /></label>
                  <label>Đơn vị cấp<input value={c.issuer} maxLength={150} onChange={(e) => certs.set(i, "issuer", e.target.value)} /></label>
                  <label>Ngày cấp<input value={c.issueDate} maxLength={30} onChange={(e) => certs.set(i, "issueDate", e.target.value)} /></label>
                </div>
              </div>
            ))}
          </section>
        </div>

        <aside className="cv-editor-aside">
          <section className="mr-panel">
            <h3><Sparkles size={15} /> Gợi ý AI cho bullet</h3>
            {suggestionGroups.length === 0 ? (
              <p className="mr-muted">
                Chưa có gợi ý. <Link to="/cv-analysis" className="mr-text-button">Phân tích CV</Link> để AI đề xuất cách viết lại từng bullet.
              </p>
            ) : (
              <>
                <label>
                  Lần phân tích
                  <select value={groupId} onChange={(e) => setGroupId(e.target.value)}>
                    {suggestionGroups.map((g) => (
                      <option key={g.analysisId} value={g.analysisId}>
                        {g.label} · {g.createdAt ? new Date(g.createdAt).toLocaleDateString("vi-VN") : ""}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="cv-suggestions">
                  {group?.items.map((item, idx) => (
                    <SuggestionCard
                      key={`${group.analysisId}-${idx}`}
                      item={item}
                      draft={draft}
                      applied={appliedKeys.has(`${group.analysisId}-${idx}`)}
                      onApply={(target) => applySuggestion(item, `${group.analysisId}-${idx}`, target)}
                    />
                  ))}
                </div>
                <p className="mr-muted">Áp dụng chỉ đổi bản đang sửa; bấm Lưu để giữ lại.</p>
              </>
            )}
          </section>
        </aside>
      </div>
    </div>
  );
}

function SectionHeading({ title, onAdd, addLabel }) {
  return (
    <div className="cv-editor-section-heading">
      <h3>{title}</h3>
      <button type="button" data-button-surface="none" className="mr-secondary" onClick={onAdd}><Plus size={14} /> {addLabel}</button>
    </div>
  );
}

function ItemToolbar({ label, index, count, ops }) {
  return (
    <div className="cv-editor-item-toolbar">
      <strong>{label}</strong>
      <div>
        <button type="button" data-button-surface="none" className="cv-icon-button" aria-label="Chuyển lên" disabled={index === 0} onClick={() => ops.move(index, -1)}><ArrowUp size={13} /></button>
        <button type="button" data-button-surface="none" className="cv-icon-button" aria-label="Chuyển xuống" disabled={index === count - 1} onClick={() => ops.move(index, 1)}><ArrowDown size={13} /></button>
        <button
          type="button"
          data-button-surface="none"
          className="cv-icon-button cv-danger"
          aria-label={`Xóa ${label}`}
          onClick={() => window.confirm(`Xóa "${label}"?`) && ops.remove(index)}
        >
          <Trash2 size={13} />
        </button>
      </div>
    </div>
  );
}

/** Ô nhập danh sách cách nhau dấu phẩy; giữ nguyên chữ đang gõ, chỉ tách khi rời ô. */
function ListInput({ value, onChange, placeholder, label }) {
  const [text, setText] = useState(value.join(", "));
  const joined = value.join(", ");
  useEffect(() => setText(joined), [joined]);
  return (
    <label className="cv-editor-full">
      {label}
      <input value={text} placeholder={placeholder} onChange={(e) => setText(e.target.value)} onBlur={() => onChange(splitList(text))} />
    </label>
  );
}

function SuggestionCard({ item, draft, applied, onApply }) {
  const matches = useMemo(() => findBulletMatches(draft, item.original), [draft, item.original]);
  const [expIndex, setExpIndex] = useState(0);
  const match = matches[0];

  return (
    <article className={`cv-suggestion${applied ? " is-applied" : ""}`}>
      {item.original && <p className="cv-suggestion-before">{item.original}</p>}
      <p className="cv-suggestion-after">{item.rewritten}</p>
      {item.reasoning && <p className="mr-muted">{item.reasoning}</p>}
      {applied ? (
        <span className="mr-status selected">Đã áp dụng</span>
      ) : match ? (
        <button type="button" data-button-surface="none" className="mr-secondary" onClick={() => onApply(match)}>
          <Wand2 size={13} /> Thay bullet ở “{draft.experiences[match.expIndex]?.position || draft.experiences[match.expIndex]?.company || `kinh nghiệm ${match.expIndex + 1}`}”
        </button>
      ) : draft.experiences.length ? (
        <div className="cv-suggestion-append">
          <span className="mr-muted">Không tìm thấy câu gốc trong CV.</span>
          <select value={expIndex} onChange={(e) => setExpIndex(Number(e.target.value))} aria-label="Chọn kinh nghiệm để thêm bullet">
            {draft.experiences.map((e, i) => (
              <option key={i} value={i}>{e.position || e.company || `Kinh nghiệm ${i + 1}`}</option>
            ))}
          </select>
          <button type="button" data-button-surface="none" className="mr-secondary" onClick={() => onApply({ expIndex, bulletIndex: null })}>
            <Plus size={13} /> Thêm thành bullet mới
          </button>
        </div>
      ) : (
        <span className="mr-muted">Thêm một kinh nghiệm để áp dụng gợi ý.</span>
      )}
    </article>
  );
}
