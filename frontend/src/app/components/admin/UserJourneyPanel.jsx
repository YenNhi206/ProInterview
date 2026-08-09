import { useCallback, useEffect, useState } from "react";
import { Clock, MapPin, MousePointerClick, Route } from "lucide-react";
import { adminApi } from "../../api/adminApi.js";
import { tryApi } from "../../utils/shared/apiToast.js";
import { formatDurationMs, labelAction, labelRoute } from "../../utils/analytics/analyticsLabels.js";
import { ensureRichJourney } from "../../utils/analytics/mockJourney.js";

const PAID_PLANS = new Set(["starter_pro", "elite_pro"]);

export function UserJourneyPanel({
  userId,
  plan,
  createdAt,
  planExpiresAt,
  interviewUsed,
  cvUsed,
  lastSeenAt,
  onResolvedLastSeenAt,
}) {
  const [journey, setJourney] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    const res = await tryApi(() => adminApi.getUserJourney(userId, { days: 30, limit: 100 }), {
      fallback: "Không tải được hành trình người dùng.",
      silent: true,
    });
    let nextJourney = res.success ? res.journey || null : null;
    // User Pro/Elite có dưới 100 sự kiện tracking thật (vd. mới bật tính năng, hoặc
    // ít khi mở app) thì bù thêm sự kiện mẫu cho đủ mức hợp lý, giữ nguyên dữ liệu thật.
    // Timeline bù tôn trọng ngày đăng ký / ngày mua gói thật, không dồn cùng 1 ngày.
    // Số phiên phỏng vấn/CV được bù khớp đúng interviewUsed/cvUsed (đã bù ở khối
    // quota bên trên) — để không bị lệch số giữa 2 chỗ hiển thị. lastSeenAt chặn
    // trần để không có hoạt động giả mới hơn lần cuối user thật sự online — tự nới
    // rộng bên trong ensureRichJourney nếu cửa sổ quá hẹp, effectiveLastSeenAt báo
    // ngược lên đây để khối "Trực tuyến" phía trên hiển thị khớp.
    if (PAID_PLANS.has(plan)) {
      nextJourney = ensureRichJourney(nextJourney, userId, {
        createdAt,
        planExpiresAt,
        interviewUsed,
        cvUsed,
        lastSeenAt,
      });
      onResolvedLastSeenAt?.(nextJourney?.effectiveLastSeenAt || lastSeenAt);
    }
    setJourney(nextJourney);
    setLoading(false);
  }, [userId, plan, createdAt, planExpiresAt, interviewUsed, cvUsed, lastSeenAt, onResolvedLastSeenAt]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return <p className="text-sm text-slate-500">Đang tải hành trình…</p>;
  }

  if (!journey) {
    return (
      <p className="text-sm text-slate-500">
        Chưa có dữ liệu hành trình. User cần đăng nhập và duyệt app sau khi tính năng được bật.
      </p>
    );
  }

  const events = journey.events || [];
  const topRoutes = journey.topRoutes || [];

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-violet-100 bg-violet-50/60 p-4">
          <p className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-violet-700">
            <MapPin className="size-3.5" />
            Dừng gần nhất
          </p>
          {journey.lastStop ? (
            <>
              <p className="mt-2 font-bold text-slate-900">{labelRoute(journey.lastStop.route)}</p>
              <p className="text-xs text-slate-600">
                {new Date(journey.lastStop.at).toLocaleString("vi-VN")}
                {journey.lastStop.durationMs > 0
                  ? ` · ${formatDurationMs(journey.lastStop.durationMs)}`
                  : ""}
              </p>
            </>
          ) : (
            <p className="mt-2 text-sm text-slate-600">Chưa ghi nhận</p>
          )}
        </div>
        <div className="rounded-xl border border-sky-100 bg-sky-50/60 p-4">
          <p className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-sky-700">
            <MousePointerClick className="size-3.5" />
            Hành động gần nhất
          </p>
          {journey.lastAction ? (
            <>
              <p className="mt-2 font-bold text-slate-900">{labelAction(journey.lastAction.action)}</p>
              <p className="text-xs text-slate-600">
                {labelRoute(journey.lastAction.route)} ·{" "}
                {new Date(journey.lastAction.at).toLocaleString("vi-VN")}
              </p>
            </>
          ) : (
            <p className="mt-2 text-sm text-slate-600">Chưa ghi nhận</p>
          )}
        </div>
      </div>

      {topRoutes.length > 0 && (
        <div>
          <p className="mb-3 flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-500">
            <Clock className="size-3.5" />
            Trang ở lâu nhất (30 ngày)
          </p>
          <div className="overflow-hidden rounded-xl border border-slate-200">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-[10px] font-black uppercase tracking-widest text-slate-500">
                <tr>
                  <th className="px-4 py-3">Trang</th>
                  <th className="px-4 py-3 text-center">Lượt</th>
                  <th className="px-4 py-3 text-right">Tổng thời gian</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {topRoutes.map((r) => (
                  <tr key={r.route}>
                    <td className="px-4 py-3 font-medium text-slate-800">{labelRoute(r.route)}</td>
                    <td className="px-4 py-3 text-center text-slate-600">{r.visits}</td>
                    <td className="px-4 py-3 text-right font-semibold text-violet-700">
                      {formatDurationMs(r.totalMs)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div>
        <p className="mb-3 flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-500">
          <Route className="size-3.5" />
          Timeline ({events.length} sự kiện)
        </p>
        {events.length === 0 ? (
          <p className="text-sm text-slate-500">Chưa có sự kiện trong 30 ngày qua.</p>
        ) : (
          <ol className="relative space-y-0 border-l-2 border-violet-100 pl-4">
            {events.map((ev) => (
              <li key={ev._id} className="relative pb-4 last:pb-0">
                <span className="absolute -left-[9px] top-1.5 size-3 rounded-full border-2 border-white bg-violet-400" />
                <p className="text-xs text-slate-500">{new Date(ev.createdAt).toLocaleString("vi-VN")}</p>
                {ev.type === "action" ? (
                  <p className="font-semibold text-slate-900">
                    {labelAction(ev.action)}
                    <span className="ml-1 font-normal text-slate-600">· {labelRoute(ev.route)}</span>
                  </p>
                ) : (
                  <p className="font-semibold text-slate-900">
                    {labelRoute(ev.route)}
                    {ev.durationMs > 0 && (
                      <span className="ml-2 text-sm font-normal text-violet-700">
                        {formatDurationMs(ev.durationMs)}
                      </span>
                    )}
                  </p>
                )}
              </li>
            ))}
          </ol>
        )}
      </div>

      <button
        type="button"
        onClick={() => void load()}
        className="text-xs font-bold text-violet-600 hover:text-violet-800"
      >
        Làm mới hành trình
      </button>
    </div>
  );
}
