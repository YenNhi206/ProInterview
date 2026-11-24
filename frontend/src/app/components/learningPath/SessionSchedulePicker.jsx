import { useEffect, useMemo, useState } from "react";
import { CalendarCheck, Loader2, X } from "lucide-react";
import { fetchMentorAvailability } from "../../api/mentorApi.js";
import { fetchBookedSlots } from "../../api/bookingsApi.js";
import { scheduleLearningPathSession } from "../../api/learningPathsApi.js";
import { buildSlotOptions, isoToBookingDate } from "../../utils/learningPath/learningPathTimeline.js";

const DURATIONS = [30, 45, 60, 90, 120];

/**
 * LP-19: ứng viên chọn giờ cho buổi đang mở — chỉ hiện khung giờ mentor mở (lịch tuần / lịch riêng, trừ ngày chặn)
 * và chưa ai đặt trong 21 ngày tới. Mentor chưa khai báo lịch thì backend nhận mọi giờ → cho nhập tay.
 * Backend vẫn kiểm lại mọi điều kiện (giờ tương lai, lịch mentor, trùng lịch của mentee) và trả lỗi tiếng Việt.
 */
export function SessionSchedulePicker({ path, session, onScheduled, onCancel }) {
  const [options, setOptions] = useState(undefined); // undefined = đang tải, null = nhập tay
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [manualDate, setManualDate] = useState("");
  const [duration, setDuration] = useState(60);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    Promise.all([fetchMentorAvailability(path.mentorId), fetchBookedSlots(path.mentorId)])
      .then(([availability, booked]) => {
        if (!active) return;
        const built = buildSlotOptions(availability, booked.success ? booked.booked : {});
        setOptions(built);
        if (built?.length) setDate(built[0].date);
      })
      .catch(() => active && setOptions(null));
    return () => { active = false; };
  }, [path.mentorId]);

  const day = useMemo(() => options?.find((o) => o.date === date) || null, [options, date]);
  const manual = options === null;
  const chosenDate = manual ? isoToBookingDate(manualDate) : date;
  const ready = Boolean(chosenDate && /^\d{2}:\d{2}$/.test(time));

  async function submit() {
    if (!ready || busy) return;
    setBusy(true);
    setError("");
    try {
      const { learningPath } = await scheduleLearningPathSession(path.id, session.id, {
        date: chosenDate, timeSlot: time, durationMinutes: duration, note: note.trim(),
      });
      onScheduled(learningPath, `Đã đặt buổi ${session.order} lúc ${time} ngày ${chosenDate}. Mentor đã nhận thông báo.`);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="lp-picker" role="group" aria-label={`Đặt lịch buổi ${session.order}`}>
      <div className="lp-picker-head">
        <strong>Chọn giờ học buổi {session.order}{Number(session.attempt) > 1 ? " (học lại)" : ""}</strong>
        <button type="button" data-button-surface="none" className="lp-icon-btn" aria-label="Đóng" onClick={onCancel}><X size={15} /></button>
      </div>

      {options === undefined && <p className="lp-field-hint"><Loader2 size={13} className="lp-spin" /> Đang tải lịch rảnh của mentor…</p>}

      {manual && (
        <div className="lp-picker-manual">
          <p className="lp-field-hint">Mentor chưa khai báo lịch rảnh nên bạn tự chọn ngày giờ. Nên nhắn mentor trước để chắc mentor rảnh.</p>
          <label>Ngày<input type="date" value={manualDate} onChange={(e) => setManualDate(e.target.value)} /></label>
          <label>Giờ bắt đầu<input type="time" value={time} onChange={(e) => setTime(e.target.value)} /></label>
        </div>
      )}

      {Array.isArray(options) && options.length === 0 && (
        <p className="lp-field-hint">Mentor chưa có giờ trống trong 3 tuần tới. Hãy nhắn mentor mở thêm lịch rồi quay lại.</p>
      )}

      {Array.isArray(options) && options.length > 0 && (
        <>
          <div className="lp-chips" role="group" aria-label="Chọn ngày">
            {options.map((o) => (
              <button key={o.date} type="button" data-button-surface="none" className="lp-chip" aria-pressed={o.date === date} onClick={() => { setDate(o.date); setTime(""); }}>
                {o.label}
              </button>
            ))}
          </div>
          <div className="lp-chips" role="group" aria-label="Chọn giờ">
            {day?.times.map((t) => (
              <button key={t} type="button" data-button-surface="none" className="lp-chip" aria-pressed={t === time} onClick={() => setTime(t)}>{t}</button>
            ))}
          </div>
        </>
      )}

      {options !== undefined && (options === null || options.length > 0) && (
        <div className="lp-picker-extra">
          <label>Thời lượng
            <select value={duration} onChange={(e) => setDuration(Number(e.target.value))}>
              {DURATIONS.map((d) => <option key={d} value={d}>{d} phút</option>)}
            </select>
          </label>
          <label>Ghi chú cho mentor <span className="lp-field-hint">tùy chọn</span>
            <textarea rows={2} maxLength={1000} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ví dụ: Em muốn tập trung phần window function." />
          </label>
        </div>
      )}

      {error && <div className="mr-error" role="alert">{error}</div>}

      <div className="lp-picker-actions">
        <button type="button" data-button-surface="none" className="mr-secondary" onClick={onCancel}>Hủy</button>
        <button type="button" data-button-surface="none" className="mr-primary" disabled={!ready || busy} onClick={submit}>
          <CalendarCheck size={15} />{busy ? "Đang đặt…" : ready ? `Đặt ${time} · ${chosenDate}` : "Chọn ngày và giờ"}
        </button>
      </div>
    </div>
  );
}
