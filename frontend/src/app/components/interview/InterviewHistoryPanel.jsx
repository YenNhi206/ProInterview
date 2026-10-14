import React, { useEffect, useMemo, useState } from "react";
import { Calendar, ChevronDown, ChevronUp, MessageCircle, Sparkles as Sparkle } from "lucide-react";
import { fetchInterviewSessions, getInterviewSession } from "../../api/interviewsApi.js";

function formatDate(value) {
  if (!value) return "";
  try {
    return new Date(value).toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" });
  } catch {
    return "";
  }
}

function scoreTone(score) {
  const s = Number(score || 0);
  if (s >= 75) return { bg: "bg-emerald-500/20", text: "text-emerald-400", ring: "ring-emerald-500/40" };
  if (s >= 55) return { bg: "bg-violet-500/20", text: "text-violet-300", ring: "ring-violet-500/40" };
  return { bg: "bg-amber-500/20", text: "text-amber-300", ring: "ring-amber-500/40" };
}

export function InterviewHistoryPanel({ compact = false }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [sessions, setSessions] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detail, setDetail] = useState(null);
  const [query, setQuery] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError("");
      const res = await fetchInterviewSessions();
      if (cancelled) return;
      setLoading(false);
      if (!res.success) {
        setError(res.error || "Không tải được lịch sử phỏng vấn.");
        setSessions([]);
        return;
      }
      setSessions(res.list || []);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!selectedId) {
      setDetail(null);
      return;
    }
    let cancelled = false;
    (async () => {
      setDetailLoading(true);
      const res = await getInterviewSession(selectedId);
      if (cancelled) return;
      setDetailLoading(false);
      if (res.success && res.session) setDetail(res.session);
      else setDetail(null);
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedId]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return sessions;
    return sessions.filter((s) => {
      const inferred = String(s?.inferredRole || "").toLowerCase();
      const status = String(s?.status || "").toLowerCase();
      const gender = String(s?.hrGender || "").toLowerCase();
      const overall = String(s?.feedback?.overallScore ?? "").toLowerCase();
      return inferred.includes(q) || status.includes(q) || gender.includes(q) || overall.includes(q);
    });
  }, [sessions, query]);

  const countText = useMemo(() => {
    const total = sessions.length;
    const shown = filtered.length;
    if (loading) return "Đang tải…";
    if (!total) return "Chưa có lịch sử phỏng vấn.";
    return shown === total ? `${total} phiên` : `${shown} / ${total} phiên`;
  }, [filtered.length, loading, sessions.length]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <Sparkle className="h-4 w-4 text-[#93f72b]" />
          <p className="text-sm font-extrabold text-white">Lịch sử phỏng vấn</p>
        </div>
        <div className="text-xs font-semibold text-slate-400">{countText}</div>
      </div>

      {error && (
        <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">
          {error}
        </div>
      )}

      <div className="relative">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Tìm theo vị trí, HR, trạng thái, điểm…"
          className="w-full rounded-xl border border-white/10 bg-white/[0.04] py-2.5 pl-10 pr-3 text-sm text-white placeholder:text-slate-500 focus:border-[#93f72b] focus:outline-none focus:ring-1 focus:ring-[#93f72b]"
        />
        <Calendar className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
      </div>

      {loading ? (
        <div className="py-10 text-center text-sm font-medium text-slate-400">Đang tải lịch sử…</div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/15 bg-white/[0.02] px-4 py-8 text-center">
          <p className="text-sm font-bold text-white">Chưa có phiên phỏng vấn</p>
          <p className="mt-1 text-xs text-slate-400">Hãy tạo một phiên phỏng vấn để có lịch sử.</p>
        </div>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2">
          {filtered.map((s) => {
            const tone = scoreTone(s?.feedback?.overallScore);
            const expanded = selectedId === String(s?._id);
            const id = String(s?._id || s?.sessionId || "");
            const createdAt = s.createdAt || s.completedAt || s.date;
            return (
              <li key={id} className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03] transition-all hover:border-white/20">
                <button
                  type="button"
                  onClick={() => setSelectedId(expanded ? null : id)}
                  className="flex w-full items-start gap-3 px-4 py-4 text-left"
                >
                  <div
                    className={`mt-0.5 inline-flex min-w-[3.25rem] items-center justify-center rounded-xl px-2.5 py-1.5 text-xl font-extrabold ring-1 ${tone.bg} ${tone.text} ${tone.ring}`}
                    title="Điểm tổng"
                  >
                    {Math.round(Number(s?.feedback?.overallScore ?? 0))}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-violet-500/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-violet-300 border border-violet-500/30">
                        {s?.hrGender === "male" ? "HR Nam" : "HR Nữ"}
                      </span>
                      <span className="text-[11px] font-medium text-slate-400">
                        {formatDate(createdAt)}
                      </span>
                      <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-bold text-slate-300">
                        {s?.status || "in_progress"}
                      </span>
                    </div>

                    <p className="mt-2 truncate text-sm font-extrabold text-white">
                      {s?.inferredRole || "Phỏng vấn AI"}
                    </p>
                    <div className="mt-1 flex items-center gap-2 text-xs text-slate-300">
                      <MessageCircle className="h-3.5 w-3.5 text-slate-400" />
                      <span className="line-clamp-1">
                        {s?.feedback?.generalComment
                          ? s.feedback.generalComment
                          : "Chưa có feedback hoặc đang xử lý…"}
                      </span>
                    </div>
                  </div>

                  <div className="flex shrink-0 items-center justify-center">
                    {expanded ? <ChevronUp className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
                  </div>
                </button>

                {expanded && (
                  <div className="border-t border-white/10 bg-black/30 px-4 py-4">
                    {detailLoading ? (
                      <p className="py-4 text-center text-sm text-slate-400">Đang tải chi tiết…</p>
                    ) : !detail ? (
                      <p className="py-4 text-center text-sm text-slate-500">Không tải được chi tiết.</p>
                    ) : (
                      <div className="space-y-3">
                        {detail?.feedback?.overallScore != null ? (
                          <div className="rounded-xl border border-white/10 bg-white/[0.04] p-3">
                            <p className="text-xs font-extrabold uppercase tracking-wide text-violet-400">
                              Đánh giá
                            </p>
                            <p className="mt-1 text-sm font-bold text-white">
                              {Math.round(Number(detail.feedback.overallScore))}/100
                            </p>
                            {detail.feedback.generalComment ? (
                              <p className="mt-1 text-xs leading-relaxed text-slate-300">
                                {detail.feedback.generalComment}
                              </p>
                            ) : null}
                          </div>
                        ) : (
                          <div className="rounded-xl border border-white/10 bg-white/[0.04] p-3">
                            <p className="text-xs font-extrabold uppercase tracking-wide text-violet-400">
                              Feedback
                            </p>
                            <p className="mt-1 text-xs text-slate-400">
                              Phiên này chưa có feedback hoặc đang xử lý.
                            </p>
                          </div>
                        )}

                        <div className="space-y-2">
                          <p className="text-xs font-extrabold uppercase tracking-wide text-violet-400">
                            Chi tiết theo câu
                          </p>
                          <div className="grid gap-2">
                            {(detail?.feedback?.perQuestion || []).map((pq) => (
                              <div key={pq.questionIndex} className="rounded-xl border border-white/10 bg-white/[0.04] p-3">
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                  <p className="text-xs font-bold text-white">
                                    Câu {pq.questionIndex + 1}
                                  </p>
                                  <span className="rounded-full bg-violet-500/20 px-2 py-0.5 text-[10px] font-extrabold text-violet-300 border border-violet-500/30">
                                    {pq.score ?? pq.overall5 ?? 0}
                                  </span>
                                </div>
                                {pq.strengths?.length ? (
                                  <ul className="mt-2 space-y-1 text-xs text-slate-300">
                                    {pq.strengths.slice(0, 3).map((t, i) => (
                                      <li key={i} className="flex gap-2">
                                        <span className="text-[#93f72b]">✓</span>
                                        <span className="line-clamp-1">{t}</span>
                                      </li>
                                    ))}
                                  </ul>
                                ) : null}
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}


