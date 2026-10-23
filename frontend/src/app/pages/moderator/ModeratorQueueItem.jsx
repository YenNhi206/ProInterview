import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router";
import { ArrowLeft } from "lucide-react";
import { moderatorApi } from "../../api/moderatorApi.js";
import { tryApi } from "../../utils/shared/apiToast.js";
import { getUser } from "../../utils/auth/auth.js";
import { AppSelect } from "../../components/ui/AppSelect";
import { Slider } from "../../components/ui/slider";
import { PriorityBadge } from "./ModeratorQueue.jsx";
import {
  COMPETENCIES,
  QUEUE_STATUS,
  QUEUE_TYPE,
  REASON_CODE,
  SCORE_DIMENSIONS,
  SHRM_LEVELS,
  competencyLabel,
  formatDateTime,
} from "../../utils/moderator/moderationLabels.js";

const card = "rounded-2xl border border-slate-200 bg-white p-5 shadow-sm";
const label = "text-[11px] font-black uppercase tracking-widest text-slate-500";
const btn = "inline-flex items-center justify-center rounded-xl px-3 py-2 text-xs font-bold transition-colors disabled:opacity-50";
const btnPrimary = `${btn} bg-[#6E35E8] text-white hover:bg-[#5b2bc4]`;
const btnGhost = `${btn} border border-slate-200 bg-white text-slate-700 hover:bg-slate-50`;
const inputClass = "w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:border-[#6E35E8] focus:outline-none";

const ACTIONS = [
  { id: "override_score", label: "Chấm lại điểm" },
  { id: "edit_question", label: "Sửa câu hỏi", needsQuestion: true },
  { id: "deprecate_question", label: "Khai tử câu hỏi", needsQuestion: true },
  { id: "dismiss", label: "Bác bỏ (giữ nguyên)" },
];

function ScoreSliders({ scores, onChange }) {
  return (
    <div className="space-y-3">
      {SCORE_DIMENSIONS.map((d) => (
        <div key={d.id}>
          <div className="mb-1 flex justify-between text-xs font-semibold text-slate-700">
            <span id={`ovr-${d.id}`}>{d.label}</span>
            <span className="tabular-nums">{scores[d.id].toFixed(1)}</span>
          </div>
          <Slider
            aria-labelledby={`ovr-${d.id}`}
            min={0}
            max={5}
            step={0.5}
            value={[scores[d.id]]}
            onValueChange={([v]) => onChange({ ...scores, [d.id]: v })}
          />
        </div>
      ))}
    </div>
  );
}

function ActionPanel({ data, onResolved }) {
  const { item, question } = data;
  const ai = item.snapshot?.aiEvaluation;
  const [action, setAction] = useState(item.type === "question_report" ? "deprecate_question" : "override_score");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [scores, setScores] = useState(() =>
    Object.fromEntries(SCORE_DIMENSIONS.map((d) => [d.id, Number(ai?.scores?.[d.id] ?? 3)])),
  );
  const [shrmLevel, setShrmLevel] = useState(ai?.shrmLevel || "proficient");
  const [edit, setEdit] = useState({ text: question?.text ?? item.snapshot?.questionText ?? "", competencyId: question?.competencyId ?? "" });

  const me = getUser();
  const assignedToOther = item.assignee && String(item.assignee._id ?? item.assignee) !== String(me?.id);
  const closed = item.status === "resolved" || item.status === "dismissed";
  const available = ACTIONS.filter((a) => !a.needsQuestion || item.refs?.questionBankId);
  const overall = useMemo(
    () => Math.round((SCORE_DIMENSIONS.reduce((s, d) => s + scores[d.id], 0) / SCORE_DIMENSIONS.length) * 10) / 10,
    [scores],
  );

  const run = async (fn, successMessage) => {
    setBusy(true);
    const res = await tryApi(fn, { successMessage });
    setBusy(false);
    if (res.success) onResolved();
  };

  const submit = () => {
    const payload =
      action === "override_score"
        ? { scores, shrmLevel }
        : action === "edit_question"
          ? {
              ...(edit.text.trim() !== question?.text && { text: edit.text.trim() }),
              ...(edit.competencyId && edit.competencyId !== question?.competencyId && { competencyId: edit.competencyId }),
            }
          : undefined;
    run(() => moderatorApi.resolveQueueItem(item._id, { action, note: note.trim(), payload }), "Đã xử lý mục kiểm định.");
  };

  if (closed) {
    return (
      <div className={card}>
        <p className={label}>Kết quả</p>
        <p className="mt-2 text-sm text-slate-800">
          {QUEUE_STATUS[item.status]} — {ACTIONS.find((a) => a.id === item.resolution?.action)?.label ?? item.resolution?.action}
        </p>
        {item.resolution?.note ? <p className="mt-1 text-sm text-slate-600">Ghi chú: {item.resolution.note}</p> : null}
        <p className="mt-1 text-xs text-slate-500">{formatDateTime(item.resolution?.at)}</p>
        {data.moderatorOverride ? (
          <p className="mt-2 text-sm text-[#6E35E8]">Điểm moderator: <b>{data.moderatorOverride.overall}/5</b></p>
        ) : null}
      </div>
    );
  }

  return (
    <div className={`${card} space-y-4`}>
      <p className={label}>Xử lý</p>
      {assignedToOther ? (
        <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-800">Mục này đang được {item.assignee?.name || "moderator khác"} xử lý.</p>
      ) : item.status === "open" ? (
        <button type="button" className={btnGhost} disabled={busy} onClick={() => run(() => moderatorApi.claimQueueItem(item._id), "Đã nhận xử lý.")}>
          Nhận xử lý mục này
        </button>
      ) : null}

      <div className="grid grid-cols-2 gap-2">
        {available.map((a) => (
          <button
            key={a.id}
            type="button"
            onClick={() => setAction(a.id)}
            className={`${btn} border ${action === a.id ? "border-[#6E35E8] bg-violet-50 text-[#6E35E8]" : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"}`}
          >
            {a.label}
          </button>
        ))}
      </div>

      {action === "override_score" ? (
        <div className="space-y-3">
          <ScoreSliders scores={scores} onChange={setScores} />
          <div className="flex items-center justify-between text-sm">
            <span className="font-semibold text-slate-700">Tổng (trung bình)</span>
            <span className="font-bold tabular-nums text-[#6E35E8]">{overall.toFixed(1)}/5</span>
          </div>
          <AppSelect value={shrmLevel} onValueChange={setShrmLevel} options={SHRM_LEVELS.map((l) => ({ value: l.id, label: l.label }))} aria-label="Mức SHRM" />
        </div>
      ) : null}

      {action === "edit_question" ? (
        <div className="space-y-2">
          <textarea className={inputClass} rows={4} value={edit.text} maxLength={500} onChange={(e) => setEdit((v) => ({ ...v, text: e.target.value }))} />
          <AppSelect
            value={edit.competencyId}
            onValueChange={(v) => setEdit((s) => ({ ...s, competencyId: v }))}
            options={COMPETENCIES.map((c) => ({ value: c.id, label: c.label }))}
            aria-label="Năng lực"
          />
        </div>
      ) : null}

      <label className="block text-xs font-bold text-slate-600">
        Ghi chú {action === "edit_question" || action === "deprecate_question" ? "(lý do — lưu vào lịch sử câu hỏi)" : "(gửi kèm thông báo cho người dùng)"}
        <textarea className={`${inputClass} mt-1`} rows={2} maxLength={1000} value={note} onChange={(e) => setNote(e.target.value)} />
      </label>

      <button
        type="button"
        className={`${btnPrimary} w-full`}
        disabled={busy || assignedToOther || (action === "deprecate_question" && note.trim().length < 3)}
        onClick={submit}
      >
        Xác nhận
      </button>
    </div>
  );
}

export function ModeratorQueueItem() {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    const res = await tryApi(() => moderatorApi.getQueueItem(id), { fallback: "Không tải được mục kiểm định." });
    if (res.success) setData(res);
    else setError(res.error || "Không tải được mục kiểm định.");
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  if (error) return <p className="text-sm text-red-600">{error}</p>;
  if (!data) return <p className="text-sm text-slate-500">Đang tải…</p>;

  const { item, report, question } = data;
  const ai = item.snapshot?.aiEvaluation;

  return (
    <div className="space-y-4">
      <Link to="/moderator/queue" className="inline-flex items-center gap-1 text-sm font-semibold text-[#6E35E8] hover:underline">
        <ArrowLeft className="size-4" /> Hàng đợi
      </Link>
      <div className="flex flex-wrap items-center gap-2">
        <PriorityBadge priority={item.priority} />
        <h2 className="text-xl font-extrabold text-slate-900">{QUEUE_TYPE[item.type] ?? item.type}</h2>
        <span className="text-sm text-slate-500">· {QUEUE_STATUS[item.status]} · tạo {formatDateTime(item.createdAt)}</span>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,24rem)]">
        <div className="space-y-4">
          <section className={card}>
            <p className={label}>Câu hỏi</p>
            <p className="mt-2 text-[15px] font-semibold text-slate-900">{item.snapshot?.questionText || "—"}</p>
            {question ? (
              <p className="mt-1 text-xs text-slate-500">
                {competencyLabel(question.competencyId)} · trong ngân hàng: {question.status} · bị báo {question.flagCount ?? 0} lần
              </p>
            ) : null}
          </section>

          <section className={card}>
            <p className={label}>Câu trả lời của ứng viên</p>
            <p className="mt-2 whitespace-pre-line text-sm text-slate-800">{item.snapshot?.transcript || "(Không có câu trả lời)"}</p>
          </section>

          <section className={card}>
            <p className={label}>Điểm AI {ai?.promptVersion ? `(${ai.promptVersion})` : ""}</p>
            {ai ? (
              <table className="mt-2 w-full text-sm">
                <tbody>
                  {SCORE_DIMENSIONS.map((d) => (
                    <tr key={d.id} className="border-t border-slate-100">
                      <td className="py-1.5 text-slate-600">{d.label}</td>
                      <td className="py-1.5 text-right font-semibold tabular-nums text-slate-900">
                        {ai.scores?.[d.id] ?? "—"}
                        {ai.incompleteFields?.includes(d.id) ? <span className="ml-2 text-xs font-normal text-amber-700">(thiếu — fallback 3)</span> : null}
                      </td>
                    </tr>
                  ))}
                  <tr className="border-t border-slate-200">
                    <td className="py-1.5 font-semibold text-slate-700">Tổng</td>
                    <td className="py-1.5 text-right font-bold tabular-nums text-slate-900">{ai.overall ?? "—"}/5</td>
                  </tr>
                </tbody>
              </table>
            ) : (
              <p className="mt-2 text-sm text-slate-500">Chưa có kết quả chấm.</p>
            )}
          </section>

          {report ? (
            <section className={card}>
              <p className={label}>Báo cáo của người dùng</p>
              <p className="mt-2 text-sm text-slate-800">
                <b>{REASON_CODE[report.reasonCode] ?? report.reasonCode}</b> — {report.reportedBy?.name || "Người dùng"}
              </p>
              {report.description ? <p className="mt-1 whitespace-pre-line text-sm text-slate-600">{report.description}</p> : null}
            </section>
          ) : null}
        </div>

        <ActionPanel key={`${item._id}-${item.status}-${item.assignee?._id ?? ""}`} data={data} onResolved={load} />
      </div>
    </div>
  );
}
