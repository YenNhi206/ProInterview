import React from "react";
import { SidebarMenuButton } from "../ui/sidebar";

const LOGO_MARK_SRC = "/logo-mark-circle.png?v=4";

/**
 * Logo sidebar (mở rộng: wordmark gọn trong ô; thu gọn: mark tròn).
 * Không dùng scale/translate, tránh chồng menu bên dưới.
 */
export function SidebarBrandButton({
  tooltip = "ProInterview",
  onClick,
  badge = null,
}) {
  return (
    <SidebarMenuButton
      size="lg"
      tooltip={tooltip}
      onClick={onClick}
      data-sidebar-brand=""
      className="
        h-14 min-h-14 cursor-pointer overflow-hidden rounded-none py-2
        hover:bg-sidebar-accent active:bg-sidebar-accent/80
        data-[active=true]:bg-transparent
        group-data-[collapsible=icon]:!h-10 group-data-[collapsible=icon]:!w-10
        group-data-[collapsible=icon]:!min-h-10 group-data-[collapsible=icon]:!min-w-10
        group-data-[collapsible=icon]:!justify-center group-data-[collapsible=icon]:!p-0
        group-data-[collapsible=icon]:px-0
        px-3
      "
    >
      <div className="flex w-full min-w-0 items-center justify-between gap-2 group-data-[collapsible=icon]:hidden">
        <div className="min-w-0 flex-1 overflow-hidden">
          <img
            src="/Logo.png"
            alt="ProInterview"
            className="h-9 w-auto max-w-[132px] translate-x-[0.7rem] translate-y-[0.3rem] object-contain object-left brightness-[0.92] contrast-[1.12] saturate-[1.05]"
          />
        </div>
        {badge}
      </div>
      <img
        src={LOGO_MARK_SRC}
        alt=""
        className="hidden h-8 w-8 shrink-0 translate-x-[0.7rem] translate-y-[0.3rem] object-contain object-center group-data-[collapsible=icon]:block"
        aria-hidden
      />
    </SidebarMenuButton>
  );
}
