/** Only return to known Mentor entry points; preserve their search/filter query. */
export function mentorshipBackTarget({ returnTo, mentor = false, detail = false } = {}) {
  if (typeof returnTo === "string" && !/[\r\n\\]/.test(returnTo)) {
    const pathname = returnTo.split(/[?#]/)[0];
    if (pathname === "/mentors") return { to: returnTo, label: "Tìm Mentor" };
    if (!mentor && pathname === "/mentor-requests") return { to: returnTo, label: "Yêu cầu của tôi" };
    if (mentor && pathname === "/mentor/requests") return { to: returnTo, label: "Nhu cầu từ mentee" };
  }
  if (mentor) return detail ? { to: "/mentor/requests", label: "Nhu cầu từ mentee" } : { to: "/mentor/dashboard", label: "Bảng điều khiển" };
  return detail ? { to: "/mentor-requests", label: "Yêu cầu của tôi" } : { to: "/mentors", label: "Tìm Mentor" };
}
