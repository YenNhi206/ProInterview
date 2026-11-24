import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import { CheckCircle2, CircleCheckBig, Loader2, Send, Sparkles, Wallet, XCircle } from "lucide-react";
import { getLearningPath, proposeSupplementarySession, recordLearningPathSessionOutcome } from "../../api/learningPathsApi.js";
import { completeMentorBooking } from "../../api/bookingsApi.js";
import { competenciesApi } from "../../api/competenciesApi.js";
import { shrmLabel } from "../../utils/learningPath/learningPathEditor.js";
import {
  OUTCOME_NEXT_STEP_NOTICE, attemptLabel, canProposeSupplementary, outcomeFormErrors, suggestOutcome, toOutcomePayload,
} from "../../utils/learningPath/learningPathTimeline.js";
import { formatVnd } from "../../utils/shared/formatVnd.js";
import { SessionFeedback } from "./LearningPathTimeline.jsx";

const EMPTY_FORM = { outcome: "", summary: "", strengthsText: "", improvementsText: "", scores: {} };
const OUTCOME_LABEL = { passed: "Đạt", not_passed: "Chưa đạt" };

/** Form đề xuất buổi bổ sung có phí (quyết định 2) — chỉ hiện khi buổi học lại mới nhất vẫn chưa đạt. */
function SupplementaryForm({ path, session, onDone }) {
  const [price, setPrice] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const amount = Number(String(price).replace(/\D/g, "")) || 0;

  async function submit() {
    setBusy(true);
    setError("");
    try {
      const { learningPath } = await proposeSupplementarySession(path.id, session.id, { price: amount, note: note.trim() });
      onDone(learningPath, `Đã gửi đề xuất buổi bổ sung ${formatVnd(amount)} cho mentee.`);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="mr-panel lp-block" aria-labelledby="lp-supp-title">
      <div className="lp-block-heading"><div><span className="mr-eyebrow">Buổi bổ sung có phí</span><h2 id="lp-supp-title">Đề xuất thêm một buổi cho buổi {session.order}</h2></div></div>
      <p className="lp-shares">Mentee đã dùng buổi học lại miễn phí mà vẫn chưa đạt. Buổi bổ sung thu riêng (không nằm trong giá trọn gói). Mentee phải thanh toán trước khi đặt lịch.</p>
      <div className="lp-price-row">
        <label className="lp-price-input">Giá buổi bổ sung
          <input inputMode="numeric" value={price} onChange={(e) => setPrice(e.target.value)} onBlur={() => setPrice(amount ? amount.toLocaleString("vi-VN") : "")} placeholder="200.000" />
          <span>VND</span>
        </label>
        <p className="lp-shares">Từ 10.000₫. Phí nền tảng tính theo tỉ lệ của bạn như các buổi khác.</p>
      </div>
      <label>Ghi chú cho mentee <span className="lp-field-hint">tùy chọn</span>
        <textarea rows={2} maxLength={2000} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Buổi này sẽ tập trung vào…" />
      </label>
      {error && <div className="mr-error" role="alert">{error}</div>}
      <div className="lp-picker-actions">
        <button type="button" data-button-surface="none" className="mr-primary" disabled={busy || amount < 10_000} onClick={submit}><Wallet size={15} />{busy ? "Đang gửi…" : "Gửi đề xuất"}</button>
      </div>
    </section>
  );
}

/**
 * LP-21: mentor chấm buổi lộ trình đạt / chưa đạt + nhận xét + điểm năng lực theo LP-01 (API LP-13).
 * Gắn vào trang có sẵn `/mentor/session-feedback/:bookingId` khi booking có `learningPathId`.
 */
export function SessionOutcomeForm({ booking, onBookingChange }) {
  const [path, setPath] = useState(null);
  const [framework, setFramework] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const { learningPath } = await getLearningPath(booking.learningPathId);
      setPath(learningPath);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [booking.learningPathId]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    competenciesApi.getFramework().then((res) => res.success && setFramework(res.framework));
  }, []);

  const session = path?.sessions.find((s) => s.id === booking.learningPathSessionId) || null;
  const keys = session?.shrmKeys || [];
  const numericScores = useMemo(
    () => Object.fromEntries(Object.entries(form.scores).map(([k, v]) => [k, v === "" || v === "null" ? (v === "null" ? null : undefined) : Number(v)])),
    [form.scores],
  );
  const suggestion = suggestOutcome(numericScores, keys, framework?.passThreshold ?? 3);
  const errors = outcomeFormErrors(form);

  async function finishBooking() {
    setBusy(true);
    setError("");
    const res = await completeMentorBooking(booking.id);
    setBusy(false);
    if (res.success) onBookingChange?.({ ...booking, status: "completed" });
    else setError(res.error || "Chưa kết thúc được buổi học.");
  }

  async function submit() {
    if (errors.length) { setError(errors[0]); return; }
    setBusy(true);
    setError("");
    try {
      const res = await recordLearningPathSessionOutcome(path.id, session.id, toOutcomePayload(form));
      setPath(res.learningPath);
      setNotice(OUTCOME_NEXT_STEP_NOTICE[res.nextStep] || "Đã ghi kết quả.");
      setForm(EMPTY_FORM);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <div className="mr-loading" role="status">Đang tải buổi lộ trình…</div>;
  if (!path || !session) return <div className="mr-error" role="alert">{error || "Không tìm thấy buổi này trong lộ trình."}</div>;

  const latestSession = path.sessions.find((s) => s.id === session.id) || session;

  return (
    <div className="lp-outcome">
      <section className="mr-panel lp-block">
        <div className="mr-meta">
          <span className="mr-status active">Buổi {session.order} · {attemptLabel(session.attempt)}</span>
          <Link className="mr-text-button" to={`/mentor/learning-paths/${path.id}/edit`}>Xem cả lộ trình →</Link>
        </div>
        <h2 className="lp-readonly-title">{session.title}</h2>
        <p className="lp-shares">Mentee {path.candidate?.name} · {booking.timeSlot} ngày {booking.date}</p>
        {session.objectives?.length > 0 && <ul className="lp-readonly-objectives">{session.objectives.map((o) => <li key={o}>{o}</li>)}</ul>}
      </section>

      {notice && <div className="mr-notice" role="status"><CheckCircle2 size={18} />{notice}</div>}

      {latestSession.status === "done" ? (
        <section className="mr-panel lp-block">
          <div className="lp-block-heading"><div><span className="mr-eyebrow">Đã chấm</span><h2>Kết quả: {OUTCOME_LABEL[latestSession.outcome]}</h2></div></div>
          <SessionFeedback session={latestSession} framework={framework} />
        </section>
      ) : latestSession.status !== "scheduled" ? (
        <div className="mr-error" role="alert">Buổi này không còn ở trạng thái chờ chấm (có thể đã bị hủy và mentee đang đặt lại).</div>
      ) : booking.status !== "completed" ? (
        <section className="mr-panel lp-block">
          <div className="lp-block-heading"><div><span className="mr-eyebrow">Bước 1</span><h2>Kết thúc buổi học trước khi chấm</h2></div></div>
          <p className="lp-shares">Chỉ chấm được sau khi buổi đã diễn ra. Hệ thống cho kết thúc buổi sau giờ bắt đầu tối thiểu 15 phút.</p>
          <div className="lp-picker-actions">
            <button type="button" data-button-surface="none" className="mr-primary" disabled={busy} onClick={finishBooking}><CircleCheckBig size={15} />Đánh dấu đã học xong</button>
          </div>
        </section>
      ) : (
        <section className="mr-panel lp-block" aria-labelledby="lp-grade-title">
          <div className="lp-block-heading"><div><span className="mr-eyebrow">Chấm buổi</span><h2 id="lp-grade-title">Mentee đã đạt buổi này chưa?</h2></div></div>

          {keys.length > 0 && (
            <div className="lp-score-grid">
              <p className="lp-field-hint">Chấm từng năng lực theo thang 0–5 (tùy chọn). Hệ thống gợi ý kết quả: mọi năng lực ≥ {framework?.passThreshold ?? 3} là đạt. Bạn vẫn là người quyết định.</p>
              {keys.map((k) => (
                <label key={k}>{shrmLabel(k, framework)}
                  <select value={form.scores[k] ?? ""} onChange={(e) => setForm((f) => ({ ...f, scores: { ...f.scores, [k]: e.target.value } }))}>
                    <option value="">— Không chấm —</option>
                    <option value="null">{framework?.nullLabel || "Chưa đủ dữ liệu"}</option>
                    {(framework?.levels || [0, 1, 2, 3, 4, 5].map((score) => ({ score }))).map((l) => (
                      <option key={l.score} value={l.score}>{l.score}{l.label ? ` · ${l.label}` : ""}</option>
                    ))}
                  </select>
                </label>
              ))}
              {suggestion && <p className="lp-suggest"><Sparkles size={14} />Gợi ý từ điểm: <strong>{OUTCOME_LABEL[suggestion]}</strong></p>}
            </div>
          )}

          <div className="lp-outcome-choice" role="radiogroup" aria-label="Kết quả buổi">
            <button type="button" role="radio" data-button-surface="none" aria-checked={form.outcome === "passed"} className="lp-choice is-pass" onClick={() => setForm((f) => ({ ...f, outcome: "passed" }))}>
              <CheckCircle2 size={18} />Đạt<small>Mở buổi tiếp theo (buổi cuối: hoàn thành lộ trình)</small>
            </button>
            <button type="button" role="radio" data-button-surface="none" aria-checked={form.outcome === "not_passed"} className="lp-choice is-fail" onClick={() => setForm((f) => ({ ...f, outcome: "not_passed" }))}>
              <XCircle size={18} />Chưa đạt<small>{Number(session.attempt) === 1 ? "Hệ thống tạo buổi học lại miễn phí" : "Đã dùng học lại miễn phí — bạn đề xuất buổi bổ sung có phí"}</small>
            </button>
          </div>

          <label>Nhận xét chung <span className="lp-field-hint">bắt buộc, tối thiểu 10 ký tự — mentee đọc được</span>
            <textarea rows={4} maxLength={4000} value={form.summary} onChange={(e) => setForm((f) => ({ ...f, summary: e.target.value }))} placeholder="Tóm tắt buổi học và mức độ mentee đạt mục tiêu." />
          </label>
          <div className="lp-two-col">
            <label>Điểm mạnh <span className="lp-field-hint">mỗi dòng một ý</span>
              <textarea rows={4} value={form.strengthsText} onChange={(e) => setForm((f) => ({ ...f, strengthsText: e.target.value }))} />
            </label>
            <label>Cần cải thiện <span className="lp-field-hint">{form.outcome === "not_passed" ? "bắt buộc khi chưa đạt" : "mỗi dòng một ý"}</span>
              <textarea rows={4} value={form.improvementsText} onChange={(e) => setForm((f) => ({ ...f, improvementsText: e.target.value }))} />
            </label>
          </div>

          {error && <div className="mr-error" role="alert">{error}</div>}
          <div className="lp-picker-actions">
            <button type="button" data-button-surface="none" className="mr-primary" disabled={busy || errors.length > 0} onClick={submit} title={errors[0] || ""}>
              {busy ? <Loader2 size={15} className="lp-spin" /> : <Send size={15} />}Ghi kết quả{form.outcome ? `: ${OUTCOME_LABEL[form.outcome]}` : ""}
            </button>
          </div>
          {errors.length > 0 && <p className="lp-field-hint">{errors[0]}</p>}
        </section>
      )}

      {path.status === "active" && canProposeSupplementary(path.sessions, latestSession) && (
        <SupplementaryForm path={path} session={latestSession} onDone={(next, message) => { setPath(next); setNotice(message); }} />
      )}
      {error && !(latestSession.status === "scheduled" && booking.status === "completed") && <div className="mr-error" role="alert">{error}</div>}
    </div>
  );
}
