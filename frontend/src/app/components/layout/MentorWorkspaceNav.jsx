import { MENTOR_MAIN_NAV, MENTOR_SECONDARY_NAV } from "./mentorNav.js";
import { WorkspaceNav } from "./WorkspaceNav.jsx";

function handleMentorNotification(notification, navigate) {
  const bookingId = notification.metadata?.bookingId || notification.bookingId;
  if (bookingId) navigate(`/mentor/meeting-detail/${bookingId}`);
  else if (notification.type === "payment") navigate("/mentor/finance");
}

export function MentorWorkspaceNav() {
  return (
    <WorkspaceNav
      homeUrl="/mentor/dashboard"
      heading="Không gian Mentor"
      label="Mentor"
      mainNav={MENTOR_MAIN_NAV}
      secondaryNav={MENTOR_SECONDARY_NAV}
      separatorIndex={3}
      onNotification={handleMentorNotification}
    />
  );
}
