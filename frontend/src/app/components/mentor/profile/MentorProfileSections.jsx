import { useMemo, useState } from "react";
import { Star, Building2, Clock, Briefcase, Zap as Lightning, ChevronDown, User } from "lucide-react";
import { ReviewReplyBlock } from "../../reviews/ReviewReplyBlock";
import { mentorDisplayTitle, workEntryPeriodLabel } from "../../../utils/mentor/mentorProfileHelpers.js";

function EmptyBlock({ icon: Icon, message }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-white/15 bg-white/[0.02] px-4 py-8 text-center">
      {Icon ? (
        <div className="flex size-10 items-center justify-center rounded-xl bg-violet-500/15 border border-violet-500/25 text-violet-400 shadow-sm">
          <Icon size={20} strokeWidth={1.75} aria-hidden />
        </div>
      ) : null}
      <p className="max-w-md text-sm text-slate-400">{message}</p>
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
            i <= rounded ? "fill-amber-400 text-amber-400" : "fill-white/10 text-white/20"
          }`}
        />
      ))}
    </span>
  );
}

function RatingBadge({ rating }) {
  const value = Number(rating) || 0;
  return (
    <span className="inline-flex items-center gap-1 rounded-lg bg-amber-500/20 border border-amber-500/30 px-2 py-0.5 text-xs font-bold text-amber-300 shadow-xs">
      {value.toFixed(1)}
      <span className="inline-flex gap-px">
        {[1, 2, 3, 4, 5].map((i) => (
          <Star
            key={i}
            className={`size-2.5 ${
              i <= Math.round(value) ? "fill-amber-300 text-amber-300" : "fill-white/10 text-white/20"
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
    <div className="mb-6 flex flex-col gap-6 border-b border-white/10 pb-6 sm:flex-row sm:items-start">
      <div className="shrink-0 text-center sm:min-w-[130px] sm:text-left">
        {summary.total > 0 ? (
          <>
            <p className="text-5xl font-black leading-none text-white">
              {summary.average.toFixed(1)}
            </p>
            <div className="mt-2.5 flex justify-center sm:justify-start">
              <StarRow value={summary.average} />
            </div>
            <p className="mt-2 text-xs font-semibold text-slate-400">
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
            <span className="w-[7.5rem] shrink-0 text-xs font-medium text-slate-400">{b.label}</span>
            <div className="h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full bg-gradient-to-r from-violet-500 to-indigo-500 transition-all shadow-[0_0_8px_rgba(139,92,246,0.5)]"
                style={{ width: `${(b.count / max) * 100}%` }}
              />
            </div>
            <span className="w-8 shrink-0 text-right font-semibold text-xs text-slate-300">{b.count}</span>
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
            className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-bold transition-all cursor-pointer ${
              isActive
                ? "border-violet-400/50 bg-violet-600/30 text-white shadow-[0_0_12px_rgba(139,92,246,0.3)]"
                : "border-white/10 bg-white/[0.04] text-slate-300 hover:text-white hover:bg-white/[0.08]"
            }`}
          >
            {item.stars !== null ? (
              <>
                {item.label}
                <Star className="size-3 fill-amber-400 text-amber-400" aria-hidden />
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
    <section className="space-y-6">
      <div>
        <h2 className="mb-4 text-xl font-bold text-white">
          Giới thiệu chuyên gia {mentor.name}
        </h2>
        {bioText ? (
          <div className="space-y-3 text-sm leading-relaxed text-slate-300">
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
      </div>

      {education ? (
        <div className="border-t border-white/10 pt-5">
          <h3 className="mb-2 text-base font-bold text-white">Học vấn</h3>
          <p className="whitespace-pre-line text-sm text-slate-300">{education}</p>
        </div>
      ) : null}

      {awards ? (
        <div className="border-t border-white/10 pt-5">
          <h3 className="mb-2 text-base font-bold text-white">Giải thưởng</h3>
          <p className="whitespace-pre-line text-sm text-slate-300">{awards}</p>
        </div>
      ) : null}
    </section>
  );
}

export function MentorWorkSection({ mentor, workEntries, compactTitle = false }) {
  return (
    <section>
      <h2
        className={`font-bold text-white ${compactTitle ? "mb-3 text-base" : "mb-5 text-xl"}`}
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
                className="rounded-2xl border border-white/10 border-l-4 border-l-violet-500 bg-white/[0.03] backdrop-blur-md px-5 py-5 sm:px-6 sm:py-6 shadow-sm"
              >
                <p className="text-base font-bold text-white sm:text-lg">
                  {entry.role || mentorDisplayTitle(mentor)}
                </p>
                <ul className="mt-2.5 space-y-1.5 text-sm text-slate-300">
                  {entry.company ? (
                    <li className="flex items-center gap-2">
                      <Building2 className="size-4 shrink-0 text-violet-400" aria-hidden />
                      <span>
                        <span className="text-slate-400">Công ty: </span>
                        <span className="font-semibold text-white">{entry.company}</span>
                      </span>
                    </li>
                  ) : null}
                  {period ? (
                    <li className="flex items-center gap-2">
                      <Clock className="size-4 shrink-0 text-violet-400" aria-hidden />
                      <span className="font-medium text-slate-300">{period}</span>
                    </li>
                  ) : null}
                </ul>
                {noteLines.length > 0 ? (
                  <div className="mt-4 space-y-2 text-sm leading-relaxed text-slate-300">
                    {noteLines.length === 1 && !noteLines[0].startsWith("-") ? (
                      <p>{noteLines[0]}</p>
                    ) : (
                      <ul className="space-y-1.5">
                        {noteLines.map((line, j) => (
                          <li key={j} className="flex gap-2">
                            <span className="shrink-0 font-bold text-violet-400">•</span>
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
        className={`font-bold text-white ${compactTitle ? "mb-3 text-base" : "mb-5 text-xl"}`}
      >
        Kỹ năng
      </h2>
      {skillTags.length > 0 ? (
        <div className="flex flex-wrap gap-2.5">
          {skillTags.map((tag) => (
            <span
              key={tag}
              className="rounded-xl border border-violet-500/25 bg-violet-500/15 px-3.5 py-2 text-xs sm:text-sm font-semibold text-violet-200"
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
        className={`font-bold text-white ${compactTitle ? "mb-3 text-base" : "mb-5 text-xl"}`}
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
          <div className="divide-y divide-white/10 border-t border-white/10">
            {visible.length === 0 ? (
              <p className="py-8 text-center text-sm text-slate-400">
                Không có đánh giá {starFilter} sao.
              </p>
            ) : (
              visible.map((review, i) => (
                <article key={review.id || i} className="py-5 first:pt-5">
                  <div className="flex gap-3.5">
                    <div
                      className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-600 to-indigo-600 text-white shadow-sm"
                      aria-hidden
                    >
                      <User className="size-5" strokeWidth={2} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <p className="text-base font-bold text-white">
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
                        <p className="mt-2.5 text-sm leading-relaxed text-slate-300">
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
              className="mx-auto mt-5 flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2 text-xs sm:text-sm font-semibold text-violet-300 hover:text-white hover:bg-white/[0.08] transition-all cursor-pointer"
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
