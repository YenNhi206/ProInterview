import { useCallback, useEffect, useState } from "react";
import { adminApi } from "../api/adminApi.js";
import {
  ADMIN_NAV_COUNTS_CHANGED_EVENT,
  countPayoutsAwaitingAdmin,
  filterPendingMentors,
} from "../utils/admin/adminNavCounts.js";

const REFRESH_MS = 60_000;

/**
 * Số việc cần admin xử lý cho menu: hồ sơ mentor chờ duyệt, yêu cầu rút tiền chờ xử lý.
 * Tải lại khi admin xử lý xong (`ADMIN_NAV_COUNTS_CHANGED_EVENT`), khi quay lại tab, và mỗi phút.
 * Lỗi mạng thì giữ số cũ, không báo lỗi trên menu.
 */
export function useAdminNavCounts() {
  const [counts, setCounts] = useState({ pendingMentors: 0, pendingPayouts: 0 });

  const load = useCallback(async () => {
    const [mentorsRes, payoutsRes] = await Promise.all([
      adminApi.getMentors().catch(() => null),
      adminApi.getPayouts().catch(() => null),
    ]);
    setCounts((prev) => ({
      pendingMentors: mentorsRes?.success ? filterPendingMentors(mentorsRes.mentors).length : prev.pendingMentors,
      pendingPayouts: payoutsRes?.success ? countPayoutsAwaitingAdmin(payoutsRes.payouts) : prev.pendingPayouts,
    }));
  }, []);

  useEffect(() => {
    load();
    const onVisible = () => {
      if (document.visibilityState === "visible") load();
    };
    const timer = window.setInterval(onVisible, REFRESH_MS);
    window.addEventListener(ADMIN_NAV_COUNTS_CHANGED_EVENT, load);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener(ADMIN_NAV_COUNTS_CHANGED_EVENT, load);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [load]);

  return counts;
}
