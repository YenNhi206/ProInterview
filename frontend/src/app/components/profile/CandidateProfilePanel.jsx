import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import { BadgeCheck, Briefcase, ChevronDown, ChevronUp, FileText, Loader2, Save, Target } from "lucide-react";
import { profileApi } from "../../api/profileApi.js";
import { competenciesApi } from "../../api/competenciesApi.js";
import { tryApi } from "../../utils/shared/apiToast.js";
import { SOURCE_TYPE_LABEL, competencyCards, parseTargetRoles } from "../../utils/profile/candidateProfile.js";

const card = "rounded-2xl border border-white/10 bg-white/[0.03] p-5 sm:p-6";
const input = "w-full rounded-xl border border-white/15 bg-[#120e2a] px-3.5 py-2.5 text-sm text-white placeholder:text-slate-500 focus:border-violet-400 focus:outline-none";
const label = "flex flex-col gap-1.5 text-xs font-bold text-slate-300";
const date = (v) => (v ? new Date(v).toLocaleDateString("vi-VN") : "");

/**
 * PR-10: hồ sơ ứng viên trên /profile — tiêu đề nghề nghiệp, vị trí mục tiêu, CV mặc định và thẻ năng lực
 * "đã xác thực" (bấm xem nguồn: phỏng vấn AI, buổi mentor, khóa học). Dữ liệu năng lực do backend gộp
 * (PR-06/PR-07); FE chỉ hiển thị, không tự tính.
 */
export function CandidateProfilePanel({ onSummary }) {
  const [profile, setProfile] = useState(null);
  const [cvs, setCvs] = useState([]);
  const [competencies, setCompetencies] = useState([]);
  const [framework, setFramework] = useState(null);
  const [form, setForm] = useState({ headline: "", targetRoles: "", yearsOfExperience: "" });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [openKey, setOpenKey] = useState("");

  useEffect(() => {
    let active = true;
    // getMe trước: lần đầu vào, backend tự tạo CandidateProfile; gọi song song với getCompetencies thì
    // hai request cùng tạo hồ sơ và một request lỗi trùng khóa userId.
    profileApi
      .getMe()
      .then((p) => Promise.all([p, profileApi.listCvs(), profileApi.getCompetencies(), competenciesApi.getFramework()]))
      .then(([p, c, comp, fw]) => {
        if (!active) return;
        if (p.success) {
          setProfile(p.profile);
          setForm({
            headline: p.profile.headline || "",
            targetRoles: (p.profile.targetRoles?.length ? p.profile.targetRoles : [p.profile.targetRole].filter(Boolean)).join(", "),
            yearsOfExperience: p.profile.yearsOfExperience ? String(p.profile.yearsOfExperience) : "",
          });
        }
        if (c.success) setCvs(c.items || c.cvs || []);
        if (comp.success) setCompetencies(comp.competencies || []);
        if (fw.success) setFramework(fw.framework);
        setLoading(false);
      });
    return () => { active = false; };
  }, []);

  const cards = useMemo(() => competencyCards(competencies, framework), [competencies, framework]);
  const verifiedCount = cards.filter((c) => c.verified).length;

  // Trang /profile dùng để tính mức độ hoàn thiện (mục "Kho lưu trữ CV", "Năng lực xác thực").
  useEffect(() => {
    if (!loading) onSummary?.({ cvCount: cvs.length, verifiedCount });
  }, [loading, cvs.length, verifiedCount, onSummary]);
  const defaultCvId = String(profile?.defaultCvId?._id || profile?.defaultCvId || "");

  const save = async (patch) => {
    setSaving(true);
    const res = await tryApi(() => profileApi.updateMe(patch), { fallback: "Không lưu được hồ sơ.", successMessage: "Đã lưu hồ sơ ứng viên." });
    setSaving(false);
    if (res.success) setProfile(res.profile);
  };

  const saveInfo = (e) => {
    e.preventDefault();
    const roles = parseTargetRoles(form.targetRoles);
    save({
      headline: form.headline,
      targetRoles: roles,
      targetRole: roles[0] || "",
      yearsOfExperience: form.yearsOfExperience === "" ? 0 : Number(form.yearsOfExperience),
    });
  };

  if (loading) {
    return (
      <section className={card} aria-busy="true">
        <p className="flex items-center gap-2 text-sm text-slate-400"><Loader2 size={16} className="animate-spin" /> Đang tải hồ sơ ứng viên…</p>
      </section>
    );
  }
  if (!profile) return null;

  return (
    <section className={`${card} space-y-6`} aria-labelledby="candidate-profile-title">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="candidate-profile-title" className="text-xl font-black tracking-tight text-white">Hồ sơ ứng viên</h2>
          <p className="mt-1 text-xs text-slate-400">Thông tin nhà tuyển dụng thấy khi bạn ứng tuyển, cùng các năng lực đã được hệ thống xác thực.</p>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-lime-400/30 bg-lime-400/10 px-3 py-1 text-xs font-bold text-lime-300">
          <BadgeCheck size={14} /> {verifiedCount} năng lực đã xác thực
        </span>
      </div>

      <form onSubmit={saveInfo} className="grid gap-4 sm:grid-cols-2">
        <label className={`${label} sm:col-span-2`}>
          Tiêu đề nghề nghiệp
          <input className={input} maxLength={200} value={form.headline} onChange={(e) => setForm((f) => ({ ...f, headline: e.target.value }))} placeholder="Ví dụ: Frontend Developer · 2 năm React" />
        </label>
        <label className={label}>
          <span className="flex items-center gap-1.5"><Target size={13} /> Vị trí mục tiêu (cách nhau bằng dấu phẩy, tối đa 5)</span>
          <input className={input} value={form.targetRoles} onChange={(e) => setForm((f) => ({ ...f, targetRoles: e.target.value }))} placeholder="Frontend Developer, Fullstack Developer" />
        </label>
        <label className={label}>
          <span className="flex items-center gap-1.5"><Briefcase size={13} /> Số năm kinh nghiệm</span>
          <input className={input} type="number" min={0} max={50} value={form.yearsOfExperience} onChange={(e) => setForm((f) => ({ ...f, yearsOfExperience: e.target.value }))} placeholder="0" />
        </label>
        <div className="sm:col-span-2 flex justify-end">
          <button type="submit" data-button-surface="none" disabled={saving} className="inline-flex items-center gap-2 rounded-xl bg-[#93f72b] px-5 py-2.5 text-xs font-black text-slate-950 hover:bg-[#a8ff4e] disabled:opacity-60">
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Lưu thông tin
          </button>
        </div>
      </form>

      <div className="border-t border-white/10 pt-5">
        <h3 className="flex items-center gap-2 text-sm font-black text-white"><FileText size={15} /> CV mặc định</h3>
        {cvs.length ? (
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <select
              className={`${input} sm:max-w-md`}
              aria-label="Chọn CV mặc định"
              value={defaultCvId}
              disabled={saving}
              onChange={(e) => e.target.value && save({ defaultCvId: e.target.value })}
            >
              {!defaultCvId && <option value="">Chọn CV mặc định…</option>}
              {cvs.map((cv) => <option key={cv.id} value={cv.id}>{cv.title}{cv.targetRole ? ` · ${cv.targetRole}` : ""}</option>)}
            </select>
            <Link to="/cvs" className="text-xs font-bold text-lime-300 hover:underline">Quản lý kho CV →</Link>
          </div>
        ) : (
          <p className="mt-2 text-xs text-slate-400">
            Bạn chưa có CV nào. <Link to="/cvs" className="font-bold text-lime-300 hover:underline">Tải CV lên kho CV →</Link>
          </p>
        )}
      </div>

      <div className="border-t border-white/10 pt-5">
        <h3 className="flex items-center gap-2 text-sm font-black text-white"><BadgeCheck size={15} /> Năng lực</h3>
        <p className="mt-1 text-xs text-slate-400">Mức 1–5 gộp từ phỏng vấn AI, buổi mentor và khóa học. Bấm vào năng lực để xem nguồn.</p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {cards.map((c) => {
            const open = openKey === c.key;
            return (
              <div key={c.key} className={`rounded-2xl border p-4 ${c.verified ? "border-lime-400/25 bg-lime-400/[0.04]" : "border-white/10 bg-white/[0.02]"}`}>
                <button type="button" data-button-surface="none" onClick={() => setOpenKey(open ? "" : c.key)} aria-expanded={open} disabled={!c.verified} className="flex w-full items-start justify-between gap-3 text-left disabled:cursor-default">
                  <span className="min-w-0">
                    <span className="block text-sm font-bold text-white">{c.name}</span>
                    <span className="mt-0.5 block text-[11px] text-slate-400">
                      {c.verified ? `Đã xác thực · ${c.evidenceCount} bằng chứng` : "Chưa có bằng chứng"}
                    </span>
                  </span>
                  <span className="flex shrink-0 items-center gap-2">
                    <span className={`text-sm font-black tabular-nums ${c.verified ? "text-lime-300" : "text-slate-500"}`}>{c.verified ? `${c.level}/5` : "—"}</span>
                    {c.verified && (open ? <ChevronUp size={15} className="text-slate-400" /> : <ChevronDown size={15} className="text-slate-400" />)}
                  </span>
                </button>
                {c.verified && (
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10" aria-hidden>
                    <div className="h-full rounded-full bg-lime-400" style={{ width: `${(c.level / 5) * 100}%` }} />
                  </div>
                )}
                {open && (
                  <ul className="mt-3 space-y-1.5 border-t border-white/10 pt-3">
                    {c.sources.map((s, i) => (
                      <li key={`${s.refId || i}`} className="flex items-start justify-between gap-2 text-[11px] text-slate-300">
                        <span><strong className="text-slate-200">{SOURCE_TYPE_LABEL[s.type] || s.type}</strong> · {s.title}</span>
                        <span className="shrink-0 text-slate-500">{s.score != null ? `${s.score}/100 · ` : ""}{date(s.at)}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
