import { useMemo, useState } from "react";
import { Star, Building2, Clock, Briefcase, Zap as Lightning, ChevronDown, User } from "lucide-react";
import { ReviewReplyBlock } from "../../reviews/ReviewReplyBlock";
import { mentorDisplayTitle, workEntryPeriodLabel } from "../../../utils/mentor/mentorProfileHelpers.js";

function EmptyBlock({ icon: Icon, message }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-violet-200/80 bg-violet-50/40 px-4 py-8 text-center">
      {Icon ? (
        <div className="flex size-10 items-center justify-center rounded-full bg-white text-violet-500 shadow-sm">
          <Icon size={20} strokeWidth={1.75} aria-hidden />
        </div>
      ) : null}
      <p className="max-w-md text-sm text-slate-600">{message}</p>
    </div>
  );
}

function StarRow({ value, size = "md" }) {
  const rounded = Math.round(Number(value) || 0);
  const iconClass = size === "sm" ? "size-2.5" : "size-4";
  return (
    <span className="inline-flex gap-0.5" aria-hidden>
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          className={`${iconClass} ${
            i <= rounded ? "fill-amber-400 text-amber-400" : "fill-slate-200 text-slate-200"
          }`}
        />
      ))}
    </span>
  );
}

function RatingBadge({ rating }) {
  const value = Number(rating) || 0;
  return (
    <span className="inline-flex items-center gap-1 rounded bg-amber-500 px-2 py-0.5 text-xs font-bold text-white">
      {value.toFixed(1)}
      <span className="inline-flex gap-px">
        {[1, 2, 3, 4, 5].map((i) => (
          <Star
            key={i}
            className={`size-2.5 ${
              i <= Math.round(value) ? "fill-white text-white" : "fill-amber-300/50 text-amber-300/50"
            }`}
            aria-hidden
          />
        ))}
      </span>
    </span>
  );
}

function formatReviewDateTime(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function ReviewSummary({ summary }) {
  const max = Math.max(1, ...summary.buckets.map((b) => b.count));
  return (
    <div className="mb-6 flex flex-col gap-6 border-b border-slate-200/90 pb-6 sm:flex-row sm:items-start">
      <div className="shrink-0 text-center sm:min-w-[130px] sm:text-left">
        {summary.total > 0 ? (
          <>
            <p className="text-5xl font-bold leading-none text-slate-900">
              {summary.average.toFixed(1)}
            </p>
            <div className="mt-2 flex justify-center sm:justify-start">
              <StarRow value={summary.average} />
            </div>
            <p className="mt-2 text-sm font-medium text-slate-600">
              {summary.total} đánh giá
            </p>
          </>
        ) : (
          <p className="text-sm font-medium text-slate-400">Chưa có đánh giá</p>
        )}
      </div>
      <div className="min-w-0 flex-1 space-y-2.5">
        {summary.buckets.map((b) => (
          <div key={b.stars} className="flex items-center gap-3 text-sm">
            <span className="w-[7.5rem] shrink-0 text-slate-600">{b.label}</span>
            <div className="h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-slate-200">
              <div
                className="h-full rounded-full bg-[#8037f4] transition-all"
                style={{ width: `${(b.count / max) * 100}%` }}
              />
            </div>
            <span className="w-8 shrink-0 text-right font-semibold text-slate-800">{b.count}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

const REVIEW_PAGE_SIZE = 3;

function ReviewStarFilters({ active, onChange }) {
  const items = [
    { key: "all", label: "Tất cả", stars: null },
    ...[5, 4, 3, 2, 1].map((n) => ({ key: String(n), label: String(n), stars: n })),
  ];
  return (
    <div className="mb-5 flex flex-wrap gap-2">
      {items.map((item) => {
        const isActive =
          item.stars === null ? active === null : active === item.stars;
        return (
          <button
            key={item.key}
            type="button"
            onClick={() => onChange(item.stars)}
            className={`inline-flex items-center gap-1 rounded-md border px-3 py-1.5 text-sm font-semibold transition-colors ${
              isActive
                ? "border-violet-300 bg-violet-100 text-violet-900"
                : "border-slate-200 bg-white text-slate-700 hover:border-violet-200 hover:bg-violet-50/50"
            }`}
          >
            {item.stars !== null ? (
              <>
                {item.label}
                <Star className="size-3.5 fill-amber-400 text-amber-400" aria-hidden />
              </>
            ) : (
              item.label
            )}
          </button>
        );
      })}
    </div>
  );
}

export function MentorIntroSection({ mentor, bioText, education, awards }) {
  return (
    <section>
      <h2 className="mb-4 text-lg font-bold text-slate-900">
        Giới thiệu chuyên gia {mentor.name}
      </h2>
      {bioText ? (
        <div className="space-y-3 text-sm leading-relaxed text-slate-700">
          {bioText.split(/\n+/).map((para, i) => (
            <p key={i}>{para}</p>
          ))}
        </div>
      ) : (
        <EmptyBlock
          icon={Lightning}
          message="Mentor chưa cập nhật phần giới thiệu. Bạn vẫn có thể đặt lịch và trao đổi trực tiếp trong buổi mentor."
        />
      )}
      {education ? (
        <div className="mt-6 border-t border-slate-100 pt-5">
          <h3 className="mb-2 text-sm font-bold text-slate-900">Học vấn</h3>
          <p className="whitespace-pre-line text-sm text-slate-700">{education}</p>
        </div>
      ) : null}
      {awards ? (
        <div className="mt-5 border-t border-slate-100 pt-5">
          <h3 className="mb-2 text-sm font-bold text-slate-900">Giải thưởng</h3>
          <p className="whitespace-pre-line text-sm text-slate-700">{awards}</p>
        </div>
      ) : null}
    </section>
  );
}

export function MentorWorkSection({ mentor, workEntries, compactTitle = false }) {
  return (
    <section>
      <h2
        className={`font-bold text-slate-900 ${compactTitle ? "mb-3 text-base" : "mb-4 text-lg"}`}
      >
        {compactTitle
          ? "Kinh nghiệm làm việc"
          : `Kinh nghiệm làm việc của chuyên gia ${mentor.name}`}
      </h2>
      {workEntries.length > 0 ? (
        <ul className="space-y-4">
          {workEntries.map((entry, i) => {
            const period = workEntryPeriodLabel(entry);
            const noteLines = String(entry.note || "")
              .split(/\n+/)
              .map((l) => l.trim())
              .filter(Boolean);
            return (
              <li
                key={`${entry.company}-${i}`}
                className="rounded-md border border-violet-200/80 border-l-[5px] border-l-[#8037f4] bg-white px-5 py-5 sm:px-6 sm:py-6"
              >
                <p className="text-base font-bold text-slate-900 sm:text-[17px]">
                  {entry.role || mentorDisplayTitle(mentor)}
                </p>
                <ul className="mt-3 space-y-2 text-sm text-slate-600">
                  {entry.company ? (
                    <li className="flex items-center gap-2">
                      <Building2 className="size-4 shrink-0 text-[#8037f4]" aria-hidden />
                      <span>
                        <span className="text-slate-500">Công ty: </span>
                        <span className="font-medium text-slate-800">{entry.company}</span>
                      </span>
                    </li>
                  ) : null}
                  {period ? (
                    <li className="flex items-center gap-2">
                      <Clock className="size-4 shrink-0 text-[#8037f4]" aria-hidden />
                      <span className="font-medium text-slate-800">{period}</span>
                    </li>
                  ) : null}
                </ul>
                {noteLines.length > 0 ? (
                  <div className="mt-4 space-y-2 text-sm leading-relaxed text-slate-700">
                    {noteLines.length === 1 && !noteLines[0].startsWith("-") ? (
                      <p>{noteLines[0]}</p>
                    ) : (
                      <ul className="space-y-1.5">
                        {noteLines.map((line, j) => (
                          <li key={j} className="flex gap-2">
                            <span className="shrink-0 font-medium text-violet-600">-</span>
                            <span>{line.replace(/^[-•]\s*/, "")}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      ) : (
        <EmptyBlock
          icon={Briefcase}
          message="Chưa có thông tin kinh nghiệm chi tiết. Hãy đặt lịch để tìm hiểu thêm về lộ trình và phong cách mentor."
        />
      )}
    </section>
  );
}

export function MentorSkillsSection({ skillTags, compactTitle = false }) {
  return (
    <section>
      <h2
        className={`font-bold text-slate-900 ${compactTitle ? "mb-3 text-base" : "mb-4 text-lg"}`}
      >
        Kỹ năng
      </h2>
      {skillTags.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {skillTags.map((tag) => (
            <span
              key={tag}
              className="rounded-lg border border-violet-200 bg-violet-50 px-3 py-2 text-sm font-semibold text-violet-900"
            >
              {tag}
            </span>
          ))}
        </div>
      ) : (
        <EmptyBlock
          icon={Lightning}
          message="Mentor chưa liệt kê kỹ năng. Xem phần giới thiệu hoặc đặt lịch để trao đổi thêm."
        />
      )}
    </section>
  );
}

export function MentorReviewsSection({ realReviews, reviewSummary, compactTitle = false }) {
  const [starFilter, setStarFilter] = useState(null);
  const [visibleCount, setVisibleCount] = useState(REVIEW_PAGE_SIZE);

  const filtered = useMemo(() => {
    if (starFilter == null) return realReviews;
    return realReviews.filter((r) => Math.round(Number(r.rating) || 0) === starFilter);
  }, [realReviews, starFilter]);

  const visible = filtered.slice(0, visibleCount);
  const canLoadMore = visibleCount < filtered.length;

  return (
    <section>
      <h2
        className={`font-bold text-slate-900 ${compactTitle ? "mb-3 text-base" : "mb-4 text-lg"}`}
      >
        Đánh giá
      </h2>
      {realReviews.length > 0 ? (
        <>
          <ReviewSummary summary={reviewSummary} />
          <ReviewStarFilters
            active={starFilter}
            onChange={(stars) => {
              setStarFilter(stars);
              setVisibleCount(REVIEW_PAGE_SIZE);
            }}
          />
          <div className="divide-y divide-slate-200/90 border-t border-slate-200/90">
            {visible.length === 0 ? (
              <p className="py-8 text-center text-sm text-slate-500">
                Không có đánh giá {starFilter} sao.
              </p>
            ) : (
              visible.map((review, i) => (
                <article key={review.id || i} className="py-5 first:pt-5">
                  <div className="flex gap-3">
                    <div
                      className="flex size-10 shrink-0 items-center justify-center rounded-full bg-[#8037f4] text-white"
                      aria-hidden
                    >
                      <User className="size-5" strokeWidth={2} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <p className="text-base font-bold text-slate-900">
                          {review.userName || "Học viên"}
                        </p>
                        {review.createdAt ? (
                          <time
                            className="shrink-0 text-xs text-slate-400"
                            dateTime={review.createdAt}
                          >
                            {formatReviewDateTime(review.createdAt)}
                          </time>
                        ) : null}
                      </div>
                      <div className="mt-1.5">
                        <RatingBadge rating={review.rating} />
                      </div>
                      {review.comment ? (
                        <p className="mt-3 text-sm leading-relaxed text-slate-700">
                          {review.comment}
                        </p>
                      ) : null}
                      <ReviewReplyBlock reply={review.reply} />
                    </div>
                  </div>
                </article>
              ))
            )}
          </div>
          {canLoadMore ? (
            <button
              type="button"
              onClick={() => setVisibleCount((n) => n + REVIEW_PAGE_SIZE)}
              className="mx-auto mt-4 flex items-center gap-1 text-sm font-semibold text-[#8037f4] hover:text-violet-700"
            >
              Xem thêm
              <ChevronDown className="size-4" aria-hidden />
            </button>
          ) : null}
        </>
      ) : (
        <EmptyBlock
          icon={Star}
          message="Chưa có đánh giá công khai. Hãy là người đầu tiên trải nghiệm buổi mentor này."
        />
      )}
    </section>
  );
}
