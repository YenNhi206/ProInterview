import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useNavigate, useParams, useSearchParams } from "react-router";
import {
  AlertTriangle, ArrowDown, ArrowLeft, ArrowUp, Briefcase, CheckCircle2, Circle, ClipboardCheck,
  FileText, Layers, Lightbulb, MessageSquareWarning, Plus, Send, Trash2, UserRound,
} from "lucide-react";
import { createLearningPath, getLearningPath, getLearningPathCompetencyHints, proposeLearningPath, updateLearningPath } from "../../api/learningPathsApi.js";
import { addHintSession, hintSourceLabel, hintStatusLabel, sessionsCoverKey } from "../../utils/learningPath/competencyHints.js";
import { getMentorshipRequest } from "../../api/mentorshipRequestsApi.js";
import { competenciesApi } from "../../api/competenciesApi.js";
import {
  MAX_SESSIONS, PATH_STATUS, competencyOptions, formatPriceInput, emptySession, fromDTO, isEditable, moveSession,
  parsePrice, previewShares, proposeChecklist, saveErrors, shrmLabel, toPayload, toggleShrm, unselectableShrmKeys,
} from "../../utils/learningPath/learningPathEditor.js";
import { formatVnd } from "../../utils/shared/formatVnd.js";
import { MentorPageShell } from "../../components/mentor/MentorPageShell.jsx";
import { MentorPageHeader } from "../../components/mentor/MentorPageHeader.jsx";
import { LearningPathTimeline } from "../../components/learningPath/LearningPathTimeline.jsx";
import { canProposeSupplementary } from "../../utils/learningPath/learningPathTimeline.js";
import "../../../styles/mentorship-requests.css";
import "../../../styles/learning-paths.css";

const TYPES = { mock_interview: "Phỏng vấn thử", cv_review: "Review CV", career_consulting: "Tư vấn nghề nghiệp" };
const ASSESSMENT_STATUS = { pending: "Chờ xác nhận", confirmed: "Đã hẹn", in_progress: "Đang diễn ra", completed: "Đã hoàn thành", cancelled: "Đã hủy", no_show: "Vắng mặt" };
const EMPTY_STATE = { goal: "", totalAmount: "", sessions: [] };
const snapshot = (state) => JSON.stringify(toPayload(state));

/**
 * LP-20: trình soạn lộ trình của Mentor — thêm / sắp xếp buổi, mục tiêu, năng lực SHRM, giá trọn gói,
 * xem hồ sơ ứng viên; lưu nháp và gửi cho mentee (API LP-07).
 */
export function MentorLearningPathEditor() {
  const { pathId } = useParams();
  const [search] = useSearchParams();
  const requestId = search.get("requestId");
  const isNew = !pathId;
  const navigate = useNavigate();
  const location = useLocation();

  const [path, setPath] = useState(null);
  const [context, setContext] = useState(null);
  const [state, setState] = useState(EMPTY_STATE);
  const [saved, setSaved] = useState(snapshot(EMPTY_STATE));
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState(location.state?.notice || "");
  const [confirming, setConfirming] = useState(false);
  const dialogRef = useRef(null);
  // Bộ tiêu chí SHRM/DDI dùng chung (LP-01): danh sách năng lực để chọn cho từng buổi.
  const [framework, setFramework] = useState(null);
  const [frameworkError, setFrameworkError] = useState("");

  useEffect(() => {
    let active = true;
    competenciesApi.getFramework().then((res) => {
      if (!active) return;
      if (res.success && res.framework) setFramework(res.framework);
      else setFrameworkError(res.error || "Không tải được danh sách năng lực.");
    });
    return () => { active = false; };
  }, []);
  const options = useMemo(() => competencyOptions(framework), [framework]);

  // LP-23: năng lực gợi ý từ job + hồ sơ ứng viên (chỉ có khi lộ trình đã lưu).
  const [hints, setHints] = useState(null);
  const [hintsError, setHintsError] = useState("");
  useEffect(() => {
    if (!pathId) { setHints(null); return undefined; }
    let active = true;
    setHintsError("");
    getLearningPathCompetencyHints(pathId)
      .then((res) => active && setHints(res.hints || null))
      .catch((e) => active && setHintsError(e.message || "Không tải được năng lực gợi ý."));
    return () => { active = false; };
  }, [pathId]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    const load = isNew
      ? (requestId ? getMentorshipRequest(requestId) : Promise.reject(new Error("Thiếu yêu cầu mentee để soạn lộ trình.")))
          .then(({ request }) => {
            if (request.learningPath) {
              navigate(`/mentor/learning-paths/${request.learningPath.id}/edit`, { replace: true });
              return;
            }
            if (!active) return;
            setPath(null);
            setContext({
              mentorshipRequestId: request.id,
              candidateName: "Mentee",
              request: { title: request.title, position: request.position, description: request.description, sessionType: request.sessionType, cvName: request.cvName, jdName: request.jdName },
              assessment: request.assessment,
            });
            const initial = { goal: "", totalAmount: "", sessions: [emptySession()] };
            setState(initial);
            setSaved(snapshot(EMPTY_STATE));
          })
      : getLearningPath(pathId).then(({ learningPath }) => {
          if (!active) return;
          applyPath(learningPath);
        });
    load.catch((e) => active && setError(e.message)).finally(() => active && setLoading(false));
    return () => { active = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathId, requestId]);

  function applyPath(learningPath) {
    setPath(learningPath);
    setContext({
      mentorshipRequestId: learningPath.mentorshipRequestId,
      candidateName: learningPath.candidate?.name || "Mentee",
      request: learningPath.request,
      assessment: learningPath.assessment,
    });
    const next = fromDTO(learningPath);
    setState(next);
    setSaved(snapshot(next));
  }

  const editable = isNew || isEditable(path?.status);
  const dirty = editable && snapshot(state) !== saved;
  const checklist = useMemo(() => proposeChecklist(state, context?.assessment?.status, framework), [state, context, framework]);
  const canPropose = editable && checklist.every((c) => c.ok);
  const shares = useMemo(() => previewShares(state.totalAmount, state.sessions.length), [state.totalAmount, state.sessions.length]);

  useEffect(() => {
    if (!dirty) return undefined;
    const warn = (event) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  useEffect(() => {
    if (confirming && dialogRef.current && !dialogRef.current.open) dialogRef.current.showModal();
  }, [confirming]);

  const patchSession = (index, patch) =>
    setState((prev) => ({ ...prev, sessions: prev.sessions.map((s, i) => (i === index ? { ...s, ...patch } : s)) }));

  /** Lưu (tạo mới hoặc PATCH). Trả id lộ trình sau khi lưu, hoặc null nếu lỗi. */
  async function persist() {
    const problems = saveErrors(state, framework);
    if (problems.length) {
      setError(problems.join(" "));
      return null;
    }
    const payload = toPayload(state);
    if (isNew) {
      const { learningPath } = await createLearningPath({ mentorshipRequestId: context.mentorshipRequestId, ...payload });
      setSaved(snapshot(state));
      return learningPath;
    }
    const { learningPath } = await updateLearningPath(path.id, payload);
    applyPath(learningPath);
    return learningPath;
  }

  async function onSave() {
    if (busy) return;
    setBusy(true); setError(""); setNotice("");
    try {
      const result = await persist();
      if (!result) return;
      if (isNew) navigate(`/mentor/learning-paths/${result.id}/edit`, { replace: true, state: { notice: "Đã lưu bản nháp lộ trình." } });
      else setNotice("Đã lưu bản nháp.");
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function onPropose() {
    if (busy) return;
    setBusy(true); setError(""); setNotice("");
    try {
      const target = isNew || dirty ? await persist() : path;
      if (!target) { setConfirming(false); return; }
      const { learningPath } = await proposeLearningPath(target.id);
      setConfirming(false);
      if (isNew) {
        navigate(`/mentor/learning-paths/${learningPath.id}/edit`, { replace: true, state: { notice: "Đã gửi lộ trình cho mentee." } });
      } else {
        applyPath(learningPath);
        setNotice(learningPath.version > 1 ? "Đã gửi lại lộ trình đã chỉnh sửa cho mentee." : "Đã gửi lộ trình cho mentee.");
      }
    } catch (e) {
      setError(e.message);
      setConfirming(false);
    } finally {
      setBusy(false);
    }
  }

  const status = isNew ? "draft" : path?.status;
  const requestLink = context ? `/mentor/requests/${context.mentorshipRequestId}` : "/mentor/requests";
  const totalPreview = parsePrice(state.totalAmount);

  return (
    <MentorPageShell bottomPad="pb-24" showAmbient={false} className="bg-transparent text-white">
      <div className="relative z-10 mx-auto max-w-7xl px-4 pb-12 sm:px-6 lg:px-8 py-5">
        <div className="mr-page mr-page-mentor mr-page-detail lp-page lp-editor !max-w-none !p-0">
          <MentorPageHeader
            backTo="/mentor/learning-paths"
            backLabel="Quay lại Lộ trình học"
            title={editable ? (isNew ? "Soạn lộ trình mới" : "Chỉnh sửa lộ trình") : "Lộ trình học"}
          />

      {error && <div className="mr-error" role="alert">{error}</div>}
      {notice && <div className="mr-notice" role="status"><CheckCircle2 size={18} />{notice}</div>}

      {loading ? (
        <div className="mr-loading" role="status">Đang tải lộ trình…</div>
      ) : !context ? null : (
        <div className="mr-detail-layout">
          <div className="mr-detail-main">
            <section className="mr-panel mr-detail-overview" aria-labelledby="lp-title">
              <div className="mr-meta">
                <span className={`mr-status ${status}`}><span className="mr-status-dot" />{PATH_STATUS[status] || status}</span>
                <span>{path?.version > 1 ? `Bản ${path.version}` : path?.proposedAt ? `Gửi ngày ${new Date(path.proposedAt).toLocaleDateString("vi-VN")}` : "Chưa gửi"}</span>
              </div>
              <h2 id="lp-title">{context.request?.title || "Lộ trình cho mentee"}</h2>
              <div className="mr-detail-type">
                <Briefcase size={14} /><span>{context.request?.position}</span>
                <span aria-hidden>·</span><span>{context.candidateName}</span>
              </div>
              {status === "revision_requested" && (
                <div className="lp-revision" role="note">
                  <MessageSquareWarning size={16} />
                  <div><strong>Mentee yêu cầu chỉnh sửa</strong>{path?.revisionNote || "Mentee chưa để lại ghi chú."}</div>
                </div>
              )}
            </section>

            <section className="mr-panel lp-block" aria-labelledby="lp-goal-title">
              <div className="lp-block-heading"><div><span className="mr-eyebrow">Bước 1</span><h2 id="lp-goal-title">Mục tiêu và giá trọn gói</h2></div></div>
              {editable ? (
                <>
                  <label>Mục tiêu lộ trình
                    <textarea rows={3} maxLength={2000} value={state.goal} onChange={(e) => setState((p) => ({ ...p, goal: e.target.value }))} placeholder="Ví dụ: Tự tin vượt vòng phỏng vấn kỹ thuật Backend sau 4 buổi." />
                  </label>
                  <div className="lp-price-row">
                    <label className="lp-price-input">Giá trọn gói
                      <input inputMode="numeric" value={state.totalAmount} onChange={(e) => setState((p) => ({ ...p, totalAmount: e.target.value }))} onBlur={() => setState((p) => ({ ...p, totalAmount: formatPriceInput(p.totalAmount) }))} placeholder="1.000.000" aria-describedby="lp-shares" />
                      <span>VND</span>
                    </label>
                    <p className="lp-shares" id="lp-shares">
                      {shares.length
                        ? <>Ước tính mỗi buổi: <strong>{shares.length > 1 && shares[0] !== shares.at(-1) ? `${formatVnd(shares[0])} (buổi cuối ${formatVnd(shares.at(-1))})` : formatVnd(shares[0])}</strong>. Mentee trả một lần cho cả lộ trình; phí nền tảng tính theo tỉ lệ của bạn lúc gửi. Buổi học lại lần đầu miễn phí.</>
                        : "Mentee thanh toán trọn gói một lần. Nhập giá để xem ước tính mỗi buổi."}
                    </p>
                  </div>
                </>
              ) : (
                <dl className="mr-detail-dl">
                  <div><dt>Mục tiêu</dt><dd>{path.goal || "—"}</dd></div>
                  <div><dt>Giá trọn gói</dt><dd className="mr-detail-amount">{formatVnd(path.totalAmount)}</dd></div>
                </dl>
              )}
            </section>

            {editable && (
              <section className="mr-panel lp-block lp-hints" aria-labelledby="lp-hints-title">
                <div className="lp-block-heading">
                  <div><span className="mr-eyebrow"><Lightbulb size={13} aria-hidden /> Gợi ý</span><h2 id="lp-hints-title">Năng lực nên rèn</h2></div>
                </div>
                {isNew ? (
                  <p className="lp-field-hint">Lưu bản nháp để xem năng lực gợi ý từ job và hồ sơ của mentee.</p>
                ) : hintsError ? (
                  <p className="lp-field-hint" role="alert">{hintsError}</p>
                ) : !hints ? (
                  <p className="lp-field-hint">Đang tải gợi ý…</p>
                ) : hints.items.length === 0 ? (
                  <p className="lp-field-hint">
                    {hints.hasJob ? "Job chưa có năng lực yêu cầu." : "Yêu cầu này không gắn job và hồ sơ mentee chưa có năng lực nào dưới mức đạt."} Bạn tự chọn năng lực cho từng buổi.
                  </p>
                ) : (
                  <>
                    <p className="lp-field-hint">
                      {hints.jobTitle ? <>Theo job <strong>{hints.jobTitle}</strong> và hồ sơ năng lực của mentee. </> : "Theo hồ sơ năng lực của mentee. "}
                      Thiếu nhiều xếp trước; bạn vẫn sửa buổi tự do.
                    </p>
                    <ul className="lp-hint-list">
                      {hints.items.map((h) => {
                        const covered = sessionsCoverKey(state.sessions, h.shrmKey);
                        const full = state.sessions.length >= MAX_SESSIONS;
                        return (
                          <li key={h.shrmKey} className={`lp-hint is-${h.status}`}>
                            <div className="lp-hint-text">
                              <strong>{h.name}</strong>
                              <span>{hintStatusLabel(h)} · {hintSourceLabel(h)}</span>
                            </div>
                            {h.status === "met" ? null : (
                              <button
                                type="button"
                                data-button-surface="none"
                                className="lp-chip"
                                disabled={covered || full}
                                title={covered ? "Đã có buổi rèn năng lực này" : full ? `Tối đa ${MAX_SESSIONS} buổi` : "Thêm một buổi điền sẵn năng lực này"}
                                onClick={() => setState((p) => ({ ...p, sessions: addHintSession(p.sessions, h) }))}
                              >
                                {covered ? "Đã có buổi" : <><Plus size={13} aria-hidden /> Thêm buổi</>}
                              </button>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  </>
                )}
              </section>
            )}

            <section className="mr-panel lp-block" aria-labelledby="lp-sessions-title">
              <div className="lp-block-heading">
                <div><span className="mr-eyebrow">Bước 2</span><h2 id="lp-sessions-title">Các buổi học</h2></div>
                <span className="lp-counter">{state.sessions.length}/{MAX_SESSIONS} buổi</span>
              </div>

              {editable ? (
                <>
                  {state.sessions.length === 0 && <p className="lp-empty-sessions">Chưa có buổi nào. Thêm ít nhất 1 buổi để gửi cho mentee.</p>}
                  <ol className="lp-sessions">
                    {state.sessions.map((s, i) => (
                      <li className="lp-session" key={s.uid}>
                        <span className="lp-session-index" aria-hidden>{i + 1}</span>
                        <div className="lp-session-body">
                          <div className="lp-session-top">
                            <label>Tên buổi {i + 1}
                              <input value={s.title} maxLength={200} onChange={(e) => patchSession(i, { title: e.target.value })} placeholder="Ví dụ: Kể chuyện dự án theo STAR" />
                            </label>
                            <div className="lp-session-tools">
                              <button type="button" data-button-surface="none" className="lp-icon-btn" aria-label={`Đưa buổi ${i + 1} lên`} disabled={i === 0} onClick={() => setState((p) => ({ ...p, sessions: moveSession(p.sessions, i, -1) }))}><ArrowUp size={15} /></button>
                              <button type="button" data-button-surface="none" className="lp-icon-btn" aria-label={`Đưa buổi ${i + 1} xuống`} disabled={i === state.sessions.length - 1} onClick={() => setState((p) => ({ ...p, sessions: moveSession(p.sessions, i, 1) }))}><ArrowDown size={15} /></button>
                              <button type="button" data-button-surface="none" className="lp-icon-btn is-danger" aria-label={`Xóa buổi ${i + 1}`} onClick={() => setState((p) => ({ ...p, sessions: p.sessions.filter((_, j) => j !== i) }))}><Trash2 size={15} /></button>
                            </div>
                          </div>
                          <label>Mục tiêu buổi <span className="lp-field-hint">Mỗi dòng một mục tiêu, tối đa 10</span>
                            <textarea rows={3} value={s.objectivesText} onChange={(e) => patchSession(i, { objectivesText: e.target.value })} placeholder={"Trình bày 2 dự án bằng STAR\nTrả lời câu hỏi đào sâu"} />
                          </label>
                          <div className="lp-chip-group" role="group" aria-label={`Năng lực rèn ở buổi ${i + 1}`}>
                            <span>Năng lực rèn luyện</span>
                            {frameworkError && <span className="lp-field-hint">{frameworkError}</span>}
                            <div className="lp-chips">
                              {options.map((c) => (
                                <button key={c.key} type="button" data-button-surface="none" className="lp-chip" aria-pressed={s.shrmKeys.includes(c.key)} onClick={() => patchSession(i, { shrmKeys: toggleShrm(s.shrmKeys, c.key) })}>
                                  {c.label}
                                </button>
                              ))}
                              {unselectableShrmKeys(s.shrmKeys, framework).map((k) => (
                                <button key={k} type="button" data-button-surface="none" className="lp-chip" aria-pressed="true" title="Năng lực không còn trong bộ tiêu chí, bấm để bỏ chọn" onClick={() => patchSession(i, { shrmKeys: toggleShrm(s.shrmKeys, k) })}>
                                  {shrmLabel(k, framework)} (không còn dùng)
                                </button>
                              ))}
                            </div>
                          </div>
                        </div>
                      </li>
                    ))}
                  </ol>
                  <button type="button" data-button-surface="none" className="lp-add-session" disabled={state.sessions.length >= MAX_SESSIONS} onClick={() => setState((p) => ({ ...p, sessions: [...p.sessions, emptySession()] }))}>
                    <Plus size={16} />{state.sessions.length >= MAX_SESSIONS ? `Đã đủ ${MAX_SESSIONS} buổi` : "Thêm buổi"}
                  </button>
                </>
              ) : ["active", "completed"].includes(status) && path ? (
                // LP-21: lộ trình đang học — tiến độ từng buổi, chấm buổi đã học, đề xuất buổi bổ sung.
                <LearningPathTimeline
                  path={path}
                  framework={framework}
                  renderAction={(s) => {
                    if (!s.bookingId) return null;
                    if (s.status === "scheduled") {
                      return <Link className="mr-primary lp-attempt-action" to={`/mentor/session-feedback/${s.bookingId}`}><ClipboardCheck size={15} />Chấm buổi này</Link>;
                    }
                    if (status === "active" && canProposeSupplementary(path.sessions, s)) {
                      return <Link className="mr-secondary lp-attempt-action" to={`/mentor/session-feedback/${s.bookingId}`}>Đề xuất buổi bổ sung có phí →</Link>;
                    }
                    return null;
                  }}
                />
              ) : (
                <ol className="lp-sessions">
                  {state.sessions.map((s, i) => (
                    <li className="lp-session" key={s.uid}>
                      <span className="lp-session-index" aria-hidden>{i + 1}</span>
                      <div className="lp-session-body">
                        <p className="lp-readonly-title">{s.title}</p>
                        {s.objectivesText && <ul className="lp-readonly-objectives">{s.objectivesText.split("\n").map((o) => <li key={o}>{o}</li>)}</ul>}
                        {s.shrmKeys.length > 0 && <div className="lp-chips">{s.shrmKeys.map((k) => <span key={k} className="lp-chip is-static">{shrmLabel(k, framework)}</span>)}</div>}
                      </div>
                    </li>
                  ))}
                </ol>
              )}
            </section>
          </div>

          <aside className="mr-detail-sidebar" aria-label="Hồ sơ mentee và gửi lộ trình">
            <section className="mr-panel">
              <div className="mr-detail-section-label"><UserRound size={17} /><h2>Hồ sơ mentee</h2></div>
              <div className="lp-profile-head">
                <div className="mr-avatar">{context.candidateName.charAt(0)}</div>
                <div><strong>{context.candidateName}</strong><p>{context.request?.position}</p></div>
              </div>
              {context.request?.description && <p className="lp-profile-need">{context.request.description}</p>}
              <dl className="mr-detail-dl">
                <div><dt>Hình thức ban đầu</dt><dd>{TYPES[context.request?.sessionType] || "—"}</dd></div>
                <div><dt>Buổi đánh giá 0đ</dt><dd>{context.assessment ? `${ASSESSMENT_STATUS[context.assessment.status] || context.assessment.status} · ${context.assessment.timeSlot} ${context.assessment.date}` : "Chưa hẹn"}</dd></div>
                <div><dt>Tài liệu</dt><dd><FileText size={12} style={{ display: "inline", marginRight: 6 }} />{[context.request?.cvName, context.request?.jdName].filter(Boolean).join(" · ") || "—"}</dd></div>
              </dl>
              <Link className="mr-text-button lp-profile-link" to={requestLink}>Xem yêu cầu và tải CV/JD →</Link>
            </section>

            <section className="mr-panel lp-send" aria-labelledby="lp-send-title">
              <div className="mr-detail-section-label"><ClipboardCheck size={17} /><h2 id="lp-send-title">{editable ? "Gửi cho mentee" : "Trạng thái"}</h2></div>
              {editable ? (
                <>
                  <ul className="lp-checklist">
                    {checklist.map((c) => (
                      <li key={c.key} className={c.ok ? "is-ok" : ""}>{c.ok ? <CheckCircle2 size={15} /> : <Circle size={15} />}{c.label}</li>
                    ))}
                  </ul>
                  {context.assessment?.status !== "completed" && (
                    <p className="lp-send-note"><AlertTriangle size={12} style={{ display: "inline", marginRight: 5 }} />Bạn vẫn lưu nháp được; nút gửi mở khi buổi đánh giá 0đ hoàn thành.</p>
                  )}
                  {dirty && <p className="lp-dirty">Có thay đổi chưa lưu.</p>}
                  <div className="lp-send-actions">
                    <button type="button" data-button-surface="none" className="mr-primary" disabled={busy || !canPropose} onClick={() => setConfirming(true)}>
                      <Send size={15} />{status === "revision_requested" ? "Gửi lại cho mentee" : "Gửi cho mentee"}
                    </button>
                    <button type="button" data-button-surface="none" className="mr-secondary" disabled={busy || (!dirty && !isNew)} onClick={onSave}>
                      {busy ? "Đang lưu…" : "Lưu nháp"}
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <p className="lp-send-note">
                    {status === "proposed" && "Đang chờ mentee chấp nhận hoặc yêu cầu chỉnh sửa. Bạn sẽ nhận thông báo khi mentee phản hồi."}
                    {status === "pending_payment" && "Mentee đã chấp nhận, đang chờ thanh toán trọn gói."}
                    {status === "active" && "Mentee đã thanh toán. Lộ trình đang diễn ra."}
                    {status === "completed" && "Lộ trình đã hoàn thành."}
                    {status === "cancelled" && "Lộ trình đã bị hủy."}
                  </p>
                  <p className="lp-card-facts"><span><Layers size={14} />{state.sessions.length} buổi · {formatVnd(path.totalAmount)}</span></p>
                </>
              )}
            </section>
            <Link className="mr-text-button" to={requestLink}><ArrowLeft size={13} /> Về yêu cầu của mentee</Link>
          </aside>
        </div>
      )}

      {confirming && (
        <dialog ref={dialogRef} className="mr-confirm" aria-label="Xác nhận gửi lộ trình" onCancel={(e) => { if (busy) e.preventDefault(); else setConfirming(false); }}>
          <h3>{status === "revision_requested" ? "Gửi lại lộ trình đã chỉnh sửa?" : "Gửi lộ trình cho mentee?"}</h3>
          <p>
            Lộ trình {state.sessions.length} buổi, trọn gói {formatVnd(Number.isFinite(totalPreview) ? totalPreview : 0)}. Sau khi gửi bạn không sửa được cho tới khi mentee yêu cầu chỉnh sửa.
            {dirty || isNew ? " Thay đổi chưa lưu sẽ được lưu trước khi gửi." : ""}
          </p>
          <div>
            <button data-button-surface="none" className="mr-secondary" disabled={busy} onClick={() => setConfirming(false)}>Quay lại</button>
            <button data-button-surface="none" className="mr-primary" disabled={busy} onClick={onPropose}>{busy ? "Đang gửi…" : "Gửi lộ trình"}</button>
          </div>
        </dialog>
      )}
        </div>
      </div>
    </MentorPageShell>
  );
}
