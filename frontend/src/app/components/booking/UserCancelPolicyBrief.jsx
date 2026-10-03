import { CircleDollarSign, UserRound } from "lucide-react";
import {
  MENTOR_CANCEL_POLICY_BRIEF,
  USER_CANCEL_POLICY_BRIEF,
  getUserCancelPolicyFromHours,
} from "../../constants/bookingPolicy";
import { BOOKING_POLICY_COPY } from "../../constants/brandVoice";

function PolicyLineList({ lines, activeTier, compact }) {
  return (
    <ul className={`mt-1.5 list-none space-y-1 ${compact ? "text-[11px]" : "text-xs"}`}>
      {lines.map((line) => (
        <li
          key={line.id}
          className={
            activeTier === line.id
              ? "font-semibold text-violet-400"
              : "font-normal text-slate-300"
          }
        >
          {line.text}
        </li>
      ))}
    </ul>
  );
}

function PolicySection({ icon: Icon, title, lines, activeTier, compact }) {
  return (
    <div className="flex gap-3">
      {Icon ? (
        <div
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-violet-500/20 border border-violet-500/30 text-violet-300"
          aria-hidden
        >
          <Icon className="h-4 w-4" strokeWidth={2.25} />
        </div>
      ) : null}
      <div className="min-w-0 flex-1">
        <p
          className={`font-bold text-white ${compact ? "text-[11px]" : "text-sm leading-snug"}`}
        >
          {title}
        </p>
        <PolicyLineList lines={lines} activeTier={activeTier} compact={compact} />
      </div>
    </div>
  );
}

/**
 * Chính sách hủy/hoàn, `variant="icons"` (đặt lịch / sidebar buổi hẹn) hoặc `plain`.
 */
export function UserCancelPolicyBrief({
  hoursLeft = null,
  className = "",
  title,
  variant = "plain",
}) {
  const activeTier =
    hoursLeft != null && Number.isFinite(hoursLeft)
      ? getUserCancelPolicyFromHours(hoursLeft).tierId
      : null;

  const userTitle = title ?? BOOKING_POLICY_COPY.refundTitle;
  const isIcons = variant === "icons";

  const body = (
    <>
      <PolicySection
        icon={isIcons ? CircleDollarSign : null}
        title={userTitle}
        lines={USER_CANCEL_POLICY_BRIEF}
        activeTier={activeTier}
        compact={!isIcons}
      />
      <div className={`border-t border-white/10 ${isIcons ? "my-4" : "my-3"}`} />
      <PolicySection
        icon={isIcons ? UserRound : null}
        title={MENTOR_CANCEL_POLICY_BRIEF.title}
        lines={MENTOR_CANCEL_POLICY_BRIEF.items}
        activeTier={null}
        compact={!isIcons}
      />
    </>
  );

  if (isIcons) {
    return (
      <div
        className={`rounded-2xl border border-white/10 bg-white/[0.02] p-4 ${className}`.trim()}
      >
        {body}
      </div>
    );
  }

  return <div className={`space-y-3 ${className}`.trim()}>{body}</div>;
}
