import { useEffect, useState } from "react";
import { Link } from "react-router";
import { Briefcase, GraduationCap, RefreshCw, Sparkles, Users } from "lucide-react";
import { fetchMyRecommendations } from "../../api/recommendationsApi.js";
import {
  DASHBOARD_RECOMMENDATION_LIMIT,
  normalizeRecommendations,
} from "../../utils/recommendations/dashboardRecommendations.js";
import { avatarSrc, mediaSrc, DEFAULT_COURSE_THUMB } from "../../utils/shared/mediaUrl.js";
import { formatVnd } from "../../utils/shared/formatVnd.js";

function Thumb({ src, alt, fallbackText, round = false }) {
  const [broken, setBroken] = useState(false);
  const shape = round ? "rounded-full" : "rounded-lg";
  if (!src || broken) {
    return (
      <span
        aria-hidden="true"
        className={`flex h-10 w-10 shrink-0 items-center justify-center ${shape} bg-violet-100 text-sm font-black text-[#8037f4]`}
      >
        {(fallbackText || "?").trim().charAt(0).toUpperCase()}
      </span>
    );
  }
  return (
    <img
      src={src}
      alt={alt}
      loading="lazy"
      onError={() => setBroken(true)}
      className={`h-10 w-10 shrink-0 object-cover ${shape} border border-slate-200`}
    />
  );
}

function ItemRow({ to, thumb, title, meta, reason }) {
  return (
    <li>
      <Link
        to={to}
        className="flex items-start gap-3 rounded-xl border border-transparent p-2.5 transition-colors hover:border-slate-200 hover:bg-slate-50"
      >
        {thumb}
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-bold text-slate-900">{title}</span>
          {meta ? <span className="block truncate text-xs text-slate-500">{meta}</span> : null}
          {reason ? <span className="mt-1 block text-xs leading-snug text-[#8037f4]">{reason}</span> : null}
        </span>
      </Link>
    </li>
  );
}

function Column({ icon: Icon, title, moreTo, moreLabel, emptyText, children, count }) {
  return (
    <section className="flex min-w-0 flex-col rounded-xl border border-slate-200 bg-white p-3 sm:p-4">
      <header className="mb-2 flex items-center justify-between gap-2 px-1">
        <h4 className="flex items-center gap-2 text-sm font-black text-slate-900">
          <Icon size={16} className="text-[#8037f4]" aria-hidden="true" />
          {title}
        </h4>
        <Link to={moreTo} className="text-xs font-bold text-slate-500 hover:text-[#8037f4]">
          {moreLabel}
        </Link>
      </header>
      {count ? (
        <ul className="space-y-1">{children}</ul>
      ) : (
        <p className="px-1 py-4 text-xs text-slate-500">{emptyText}</p>
      )}
    </section>
  );
}

function SkeletonColumn() {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4" aria-hidden="true">
      <div className="mb-4 h-4 w-24 animate-pulse rounded bg-slate-100" />
      {[0, 1, 2].map((i) => (
        <div key={i} className="mb-3 flex gap-3">
          <div className="h-10 w-10 animate-pulse rounded-lg bg-slate-100" />
          <div className="flex-1 space-y-2">
            <div className="h-3 w-3/4 animate-pulse rounded bg-slate-100" />
            <div className="h-3 w-1/2 animate-pulse rounded bg-slate-100" />
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * AI-11: khối "Gợi ý cho bạn" trên /dashboard — mentor, khóa học, việc làm từ `GET /api/recommendations/me`
 * (AI-10). Mỗi mục có một dòng lý do và mở trang chi tiết.
 */
export function DashboardRecommendations() {
  const [state, setState] = useState({ loading: true, error: "", data: null });
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let active = true;
    setState((s) => ({ ...s, loading: true, error: "" }));
    fetchMyRecommendations({ limit: DASHBOARD_RECOMMENDATION_LIMIT }).then((res) => {
      if (!active) return;
      if (res.success) setState({ loading: false, error: "", data: normalizeRecommendations(res.recommendations) });
      else setState({ loading: false, error: res.error || "Không tải được gợi ý.", data: null });
    });
    return () => {
      active = false;
    };
  }, [reload]);

  const { loading, error, data } = state;

  return (
    <section
      aria-labelledby="dashboard-reco-title"
      className="rounded-2xl border border-slate-200 bg-gradient-to-br from-white to-slate-50 p-4 sm:p-5"
    >
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 id="dashboard-reco-title" className="flex items-center gap-2 text-base font-black text-slate-900 sm:text-lg">
            <Sparkles size={18} className="text-[#8037f4]" aria-hidden="true" />
            Gợi ý cho bạn
          </h3>
          {data ? <p className="mt-1 text-xs text-slate-500 sm:text-sm">{data.summary}</p> : null}
        </div>
        {data && !data.hasGaps ? (
          <Link
            to="/interview"
            className="shrink-0 rounded-full border border-[#8037f4]/30 bg-violet-50 px-3 py-1.5 text-xs font-bold text-[#8037f4] hover:bg-violet-100"
          >
            Phỏng vấn AI để gợi ý sát hơn
          </Link>
        ) : null}
      </div>

      {loading ? (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3" role="status" aria-label="Đang tải gợi ý">
          <SkeletonColumn />
          <SkeletonColumn />
          <SkeletonColumn />
        </div>
      ) : error ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700" role="alert">
          <span>{error}</span>
          <button
            type="button"
            onClick={() => setReload((v) => v + 1)}
            className="inline-flex items-center gap-1.5 rounded-full border border-red-300 bg-white px-3 py-1 text-xs font-bold text-red-700 hover:bg-red-100"
          >
            <RefreshCw size={13} aria-hidden="true" /> Thử lại
          </button>
        </div>
      ) : data.isEmpty ? (
        <p className="rounded-xl border-2 border-dashed border-slate-200 bg-slate-50/70 p-6 text-center text-sm text-slate-500">
          Chưa có gợi ý phù hợp. Làm một buổi phỏng vấn AI hoặc cập nhật hồ sơ để hệ thống hiểu bạn hơn.
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <Column icon={Users} title="Mentor" moreTo="/mentors" moreLabel="Xem thêm" emptyText="Chưa có mentor phù hợp." count={data.mentors.length}>
            {data.mentors.map((m) => (
              <ItemRow
                key={m.id}
                to={m.href}
                title={m.name}
                meta={m.subtitle}
                reason={m.reason}
                thumb={<Thumb round src={m.avatar ? avatarSrc(m.avatar) : ""} alt={m.name} fallbackText={m.name} />}
              />
            ))}
          </Column>
          <Column icon={GraduationCap} title="Khóa học" moreTo="/courses" moreLabel="Xem thêm" emptyText="Chưa có khóa học phù hợp." count={data.courses.length}>
            {data.courses.map((c) => (
              <ItemRow
                key={c.id}
                to={c.href}
                title={c.title}
                meta={c.isFree ? "Miễn phí" : formatVnd(c.price)}
                reason={c.reason}
                thumb={<Thumb src={mediaSrc(c.thumbnail, DEFAULT_COURSE_THUMB)} alt={c.title} fallbackText={c.title} />}
              />
            ))}
          </Column>
          <Column icon={Briefcase} title="Việc làm" moreTo="/jobs" moreLabel="Xem thêm" emptyText="Chưa có việc làm phù hợp." count={data.jobs.length}>
            {data.jobs.map((j) => (
              <ItemRow
                key={j.id}
                to={j.href}
                title={j.title}
                meta={j.subtitle}
                reason={j.reason}
                thumb={<Thumb src={j.logo ? mediaSrc(j.logo) : ""} alt={j.companyName || j.title} fallbackText={j.companyName || j.title} />}
              />
            ))}
          </Column>
        </div>
      )}
    </section>
  );
}
