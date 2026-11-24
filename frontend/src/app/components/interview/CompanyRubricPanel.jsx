import { Building2, Hourglass, Quote } from "lucide-react";
import { RUBRIC_SCORE_MAX, rubricScoreTone } from "../../utils/interview/companyRubricFeedback.js";

const BAR = { high: "bg-[#b5e636]", mid: "bg-violet-400", low: "bg-orange-400" };

/** Nhãn nhỏ ở đầu câu: câu này là câu hỏi của doanh nghiệp nào (JB-14). */
export function CompanyQuestionBadge({ companyName }) {
  return (
    <span className="inline-flex max-w-full items-center gap-1 rounded-full bg-violet-100 px-2 py-0.5 text-[11px] font-semibold text-violet-800">
      <Building2 className="h-3 w-3 shrink-0" aria-hidden />
      <span className="truncate">Câu hỏi của {companyName}</span>
    </span>
  );
}

/**
 * JB-14: điểm theo tiêu chí rubric của doanh nghiệp, kèm trích dẫn từ câu trả lời (JB-07).
 * @param {{ rubric: ReturnType<import("../../utils/interview/companyRubricFeedback.js").companyRubricView> }} props
 */
export function CompanyRubricPanel({ rubric }) {
  if (!rubric) return null;
  return (
    <section className="mb-4 mt-3 overflow-hidden rounded-lg border border-violet-200/80" aria-label={`Điểm theo tiêu chí của ${rubric.companyName}`}>
      <div className="flex flex-wrap items-center gap-2 border-b border-violet-100 bg-violet-50/60 px-4 py-2.5">
        <Building2 className="h-4 w-4 shrink-0 text-violet-600" aria-hidden />
        <h4 className="min-w-0 flex-1 text-xs font-bold text-violet-950">
          Điểm theo tiêu chí của {rubric.companyName}
        </h4>
        {rubric.average !== null ? (
          <span className="text-xs font-bold tabular-nums text-violet-900">
            Trung bình {rubric.average.toFixed(1)}<span className="font-normal text-violet-400">/{RUBRIC_SCORE_MAX}</span>
          </span>
        ) : null}
      </div>

      {rubric.status !== "scored" ? (
        <p className="flex items-start gap-2 bg-white px-4 py-3 text-xs leading-relaxed text-violet-700">
          <Hourglass className="mt-0.5 h-3.5 w-3.5 shrink-0 text-violet-400" aria-hidden />
          {rubric.message}
        </p>
      ) : (
        <ul className="divide-y divide-violet-100 bg-white">
          {rubric.criteria.map((c) => (
            <li key={c.key} className="px-4 py-3">
              <div className="flex items-center justify-between gap-3">
                <span className="text-xs font-semibold text-violet-950">{c.name}</span>
                <span className="shrink-0 text-sm font-bold tabular-nums text-violet-950">
                  {c.score}<span className="text-xs font-normal text-violet-400">/{RUBRIC_SCORE_MAX}</span>
                </span>
              </div>
              <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-violet-100" aria-hidden>
                <div className={`h-full rounded-full ${BAR[rubricScoreTone(c.score)]}`} style={{ width: `${(c.score / RUBRIC_SCORE_MAX) * 100}%` }} />
              </div>
              {c.quote ? (
                <blockquote className="mt-2 flex items-start gap-1.5 text-xs italic leading-relaxed text-violet-700">
                  <Quote className="mt-0.5 h-3 w-3 shrink-0 text-violet-300" aria-hidden />
                  <span>{c.quote}</span>
                </blockquote>
              ) : (
                <p className="mt-2 text-[11px] text-violet-400">Không tìm thấy đoạn nào trong câu trả lời thể hiện tiêu chí này.</p>
              )}
            </li>
          ))}
        </ul>
      )}
      <p className="border-t border-violet-100 bg-violet-50/40 px-4 py-2 text-[10px] leading-relaxed text-violet-500">
        Chấm bằng AI theo bộ tiêu chí doanh nghiệp đã duyệt, trích dẫn lấy nguyên văn từ câu trả lời của bạn.
      </p>
    </section>
  );
}
