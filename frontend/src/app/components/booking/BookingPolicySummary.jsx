import {
  MENTOR_CANCEL_POLICY_ROWS,
  USER_CANCEL_POLICY_ROWS,
  USER_CHANGE_SLOT_NOTE,
  getUserCancelPolicyFromHours,
} from "../../constants/bookingPolicy";
import { UserCancelPolicyBrief } from "./UserCancelPolicyBrief";

/**
 * Bảng chính sách hủy/hoàn, `full` khi xác nhận đặt lịch; `compact` rút gọn.
 */
export function BookingPolicySummary({
  variant = "full",
  hoursLeft = null,
  className = "",
}) {
  if (variant === "compact") {
    return <UserCancelPolicyBrief variant="icons" hoursLeft={hoursLeft} className={className} />;
  }

  const activeTier =
    hoursLeft != null && Number.isFinite(hoursLeft)
      ? getUserCancelPolicyFromHours(hoursLeft).tierId
      : null;

  return (
    <div className={`space-y-4 ${className}`.trim()}>
      <PolicyBlock
        title="Đối với bạn (học viên)"
        rows={USER_CANCEL_POLICY_ROWS}
        activeId={activeTier}
        footer={USER_CHANGE_SLOT_NOTE}
      />
      <PolicyBlock title="Khi mentor hủy / no-show" rows={MENTOR_CANCEL_POLICY_ROWS} />
    </div>
  );
}

function PolicyBlock({ title, rows, activeId, footer }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3 text-slate-300">
      <p className="mb-2 text-[10px] font-bold uppercase tracking-wide text-slate-400">{title}</p>
      <ul className="space-y-1.5 text-xs text-slate-300">
        {rows.map((row) => (
          <li
            key={row.id}
            className={
              activeId === row.id
                ? "rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-2 py-1.5 font-medium text-emerald-300"
                : "px-0.5"
            }
          >
            <span className="text-slate-400">• {row.when}:</span>{" "}
            <strong className="text-white">{row.policy}</strong>
          </li>
        ))}
      </ul>
      {footer ? (
        <p className="mt-2 border-t border-white/10 pt-2 text-[11px] leading-relaxed text-slate-400">{footer}</p>
      ) : null}
    </div>
  );
}
