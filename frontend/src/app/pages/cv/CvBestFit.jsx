import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router";
import { ArrowRight, CheckCircle2, FileText, Loader2, RefreshCw, Trophy } from "lucide-react";
import { cvsApi } from "../../api/cvsApi.js";
import { bestFitCvs } from "../../api/cvApi.js";
import { sortCvs } from "../../utils/cv/cvVault.js";
import {
  BEST_FIT_JD_MAX,
  BEST_FIT_MAX_CVS,
  bestFitInputError,
  cvContentText,
  setBestFitHandoff,
  toggleCvSelection,
  txtFileName,
} from "../../utils/cv/bestFit.js";
import "../../../styles/mentorship-requests.css";
import "../../../styles/cv-vault.css";
import "../../../styles/cv-best-fit.css";

/** Dựng File của CV để đưa sang trang phân tích chi tiết: tệp đã tải lên, hoặc .txt từ CV soạn trên web. */
async function cvToFile(cv) {
  if (cv.fileUrl) {
    const res = await fetch(cv.fileUrl);
    if (!res.ok) throw new Error("Không tải được tệp CV.");
    const blob = await res.blob();
    return new File([blob], cv.fileName || "cv.pdf", { type: cv.mimeType || blob.type || "application/pdf" });
  }
  const text = cvContentText(cv.content);
  if (!text) throw new Error("CV này chưa có nội dung để phân tích.");
  return new File([text], txtFileName(cv.title), { type: "text/plain" });
}

/**
 * PR-12: chọn 2–5 CV trong kho, dán JD, xếp hạng CV hợp nhất (`POST /api/cv/best-fit`, PR-05),
 * rồi mở phân tích chi tiết CV + JD (`/cv-analysis/jd`) với CV và JD đã điền sẵn.
 */
export function CvBestFit() {
  const navigate = useNavigate();
  const [cvs, setCvs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [reload, setReload] = useState(0);
  const [selected, setSelected] = useState([]);
  const [jdText, setJdText] = useState("");
  const [running, setRunning] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);
  const [opening, setOpening] = useState("");

  useEffect(() => {
    let active = true;
    setLoading(true);
    setLoadError("");
    cvsApi.list().then((res) => {
      if (!active) return;
      if (res.success) {
        const list = sortCvs(res.cvs || []);
        setCvs(list);
        // Chọn sẵn tối đa 3 CV mới nhất cho người có nhiều CV.
        setSelected((prev) => (prev.length ? prev : list.slice(0, Math.min(3, BEST_FIT_MAX_CVS)).map((c) => c.id)));
      } else setLoadError(res.error || "Không tải được kho CV.");
      setLoading(false);
    });
    return () => { active = false; };
  }, [reload]);

  const inputError = bestFitInputError(selected, jdText);
  const byId = new Map(cvs.map((c) => [c.id, c]));

  async function run() {
    if (running || inputError) return;
    setRunning(true);
    setError("");
    setResult(null);
    const res = await bestFitCvs({ cvIds: selected, jdText: jdText.trim() });
    setRunning(false);
    if (res.success) setResult(res.bestFit);
    else setError(res.error);
  }

  async function openDetail(cvId) {
    const cv = byId.get(cvId);
    if (!cv) return;
    setOpening(cvId);
    setError("");
    try {
      const cvFile = await cvToFile(cv);
      const jdFile = new File([jdText.trim()], "jd.txt", { type: "text/plain" });
      setBestFitHandoff({ cvFile, jdFile, cvTitle: cv.title });
      navigate("/cv-analysis/jd?from=best-fit");
    } catch (e) {
      setError(e.message || "Không mở được phân tích chi tiết.");
      setOpening("");
    }
  }

  return (
    <div className="mr-page cv-vault cv-best-fit">
      <header className="mr-heading">
        <div>
          <h1>Chọn CV hợp nhất cho JD</h1>
          <p>Chọn 2–{BEST_FIT_MAX_CVS} CV trong kho và dán mô tả công việc. Hệ thống xếp hạng CV, chỉ ra điểm mạnh và khoảng thiếu; chọn CV hợp nhất để phân tích chi tiết.</p>
        </div>
        <Link to="/cvs" className="mr-secondary">Kho CV</Link>
      </header>

      {loadError && (
        <div className="mr-error" role="alert">
          {loadError}
          <button data-button-surface="none" onClick={() => setReload((v) => v + 1)}><RefreshCw size={14} /> Tải lại</button>
        </div>
      )}

      {loading ? (
        <div className="mr-loading" role="status">Đang tải kho CV…</div>
      ) : cvs.length < 2 ? (
        <div className="mr-empty mr-panel">
          <FileText size={30} />
          <h2>Cần ít nhất 2 CV trong kho</h2>
          <p>Bạn đang có {cvs.length} CV. Tải thêm phiên bản CV để so sánh, hoặc phân tích một CV với JD.</p>
          <div className="cv-bf-empty-actions">
            <Link to="/cvs" className="mr-primary">Tải CV vào kho</Link>
            <Link to="/cv-analysis/jd" className="mr-text-button">Phân tích một CV với JD →</Link>
          </div>
        </div>
      ) : (
        <>
          <section className="mr-panel cv-bf-form" aria-labelledby="cv-bf-step1">
            <h2 id="cv-bf-step1">1. Chọn CV để so sánh <small>{selected.length}/{BEST_FIT_MAX_CVS}</small></h2>
            <ul className="cv-bf-pick">
              {cvs.map((cv) => {
                const checked = selected.includes(cv.id);
                const disabled = !checked && selected.length >= BEST_FIT_MAX_CVS;
                return (
                  <li key={cv.id}>
                    <label className={`cv-bf-option${checked ? " is-checked" : ""}${disabled ? " is-disabled" : ""}`}>
                      <input type="checkbox" checked={checked} disabled={disabled || running} onChange={() => setSelected((s) => toggleCvSelection(s, cv.id))} />
                      <span className="cv-bf-option-text">
                        <strong>{cv.title}</strong>
                        <span>{cv.targetRole || "Chưa đặt vị trí"} · {cv.fileName || "CV soạn trên ProInterview"}</span>
                      </span>
                    </label>
                  </li>
                );
              })}
            </ul>

            <h2>2. Dán mô tả công việc (JD)</h2>
            <label className="sr-only" htmlFor="cv-bf-jd">Mô tả công việc</label>
            <textarea
              id="cv-bf-jd"
              rows={7}
              maxLength={BEST_FIT_JD_MAX}
              value={jdText}
              disabled={running}
              onChange={(e) => setJdText(e.target.value)}
              placeholder="Dán nội dung tin tuyển dụng: vị trí, yêu cầu kỹ năng, kinh nghiệm, trách nhiệm…"
            />
            <div className="cv-bf-submit">
              <p className="cv-bf-hint">{inputError || "Không trừ lượt phân tích CV. Có thể mất tới 1 phút."}</p>
              <button type="button" data-button-surface="none" className="mr-primary" disabled={Boolean(inputError) || running} onClick={run}>
                {running ? <><Loader2 size={15} className="cv-spin" /> Đang xếp hạng…</> : <><Trophy size={15} /> Xếp hạng CV</>}
              </button>
            </div>
          </section>

          {error && <div className="mr-error" role="alert">{error}</div>}

          {result && (
            <section className="cv-bf-results" aria-labelledby="cv-bf-result-title" aria-live="polite">
              <h2 id="cv-bf-result-title">Kết quả xếp hạng</h2>
              {result.mode === "skills" && (
                <p className="cv-bf-note">AI chưa chấm được lần này, kết quả xếp theo mức khớp kỹ năng.</p>
              )}
              <ol className="cv-bf-ranking">
                {result.ranking.map((r) => {
                  const best = r.cvId === result.bestCvId;
                  return (
                    <li key={r.cvId} className={`mr-panel cv-bf-rank${best ? " is-best" : ""}`}>
                      <div className="cv-bf-rank-head">
                        <span className="cv-bf-rank-no" aria-label={`Hạng ${r.rank}`}>{r.rank}</span>
                        <div className="cv-bf-rank-title">
                          <h3>{r.title || byId.get(r.cvId)?.title || "CV"}</h3>
                          {best && <span className="mr-status selected"><CheckCircle2 size={11} /> Hợp nhất</span>}
                        </div>
                        <span className="cv-bf-score">{r.score === null ? "—" : `${Math.round(r.score)}`}<small>/100</small></span>
                      </div>
                      {r.error ? (
                        <p className="cv-bf-error">{r.error}</p>
                      ) : (
                        <>
                          {r.reason && <p className="cv-bf-reason">{r.reason}</p>}
                          <div className="cv-bf-cols">
                            {r.strengths?.length > 0 && (
                              <div><h4>Điểm mạnh</h4><ul>{r.strengths.map((x) => <li key={x}>{x}</li>)}</ul></div>
                            )}
                            {r.gaps?.length > 0 && (
                              <div><h4>Khoảng thiếu</h4><ul>{r.gaps.map((x) => <li key={x}>{x}</li>)}</ul></div>
                            )}
                          </div>
                          {(r.matchingSkills?.length > 0 || r.missingSkills?.length > 0) && (
                            <div className="cv-bf-skills">
                              {r.matchingSkills?.map((s) => <span key={`m-${s}`} className="is-match">{s}</span>)}
                              {r.missingSkills?.map((s) => <span key={`x-${s}`} className="is-missing">{s}</span>)}
                            </div>
                          )}
                        </>
                      )}
                      <div className="cv-actions">
                        <button
                          type="button"
                          data-button-surface="none"
                          className={best ? "mr-primary" : "mr-secondary"}
                          disabled={Boolean(opening) || Boolean(r.error)}
                          onClick={() => openDetail(r.cvId)}
                        >
                          {opening === r.cvId ? <Loader2 size={14} className="cv-spin" /> : null}
                          Phân tích chi tiết CV này <ArrowRight size={14} />
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ol>
            </section>
          )}
        </>
      )}
    </div>
  );
}
