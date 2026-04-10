/**
 * Meeting verification system
 * Xác thực mentor & customer đã gặp nhau thực sự
 */

const MEETINGS_KEY = "prointerview_meetings";

function getMeetings() {
  try {
    return JSON.parse(localStorage.getItem(MEETINGS_KEY) || "[]");
  } catch {
    return [];
  }
}

function saveMeetings(meetings) {
  localStorage.setItem(MEETINGS_KEY, JSON.stringify(meetings));
}

// Generate 6-digit join code
export function generateJoinCode() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// Create meeting session when booking is confirmed
export function createMeetingSession(data) {
  const meeting = {
    ...data,
    joinCode: generateJoinCode(),
    mentorJoined: false,
    customerJoined: false,
    status: "pending",
  };
  
  const meetings = getMeetings();
  meetings.push(meeting);
  saveMeetings(meetings);
  
  return meeting;
}

// Join meeting with code
export function joinMeeting(
  sessionId,
  joinCode,
  userEmail,
  role
) {
  const meetings = getMeetings();
  const meetingIdx = meetings.findIndex(
    (m) => m.sessionId === sessionId && m.joinCode === joinCode
  );

  if (meetingIdx === -1) {
    return { success: false, error: "Mã tham gia không hợp lệ" };
  }

  const meeting = meetings[meetingIdx];

  // Verify user
  if (role === "mentor" && meeting.mentorEmail !== userEmail) {
    return { success: false, error: "Bạn không phải mentor của buổi này" };
  }
  if (role === "customer" && meeting.customerEmail !== userEmail) {
    return { success: false, error: "Bạn không phải khách hàng của buổi này" };
  }

  // Update join status
  const now = new Date().toISOString();
  if (role === "mentor") {
    meeting.mentorJoined = true;
    meeting.mentorJoinedAt = now;
  } else {
    meeting.customerJoined = true;
    meeting.customerJoinedAt = now;
  }

  // Update status
  if (meeting.mentorJoined && meeting.customerJoined) {
    meeting.status = "active";
  }

  meetings[meetingIdx] = meeting;
  saveMeetings(meetings);

  return { success: true, meeting };
}

// Get meeting by session ID
export function getMeetingBySession(sessionId) {
  return getMeetings().find((m) => m.sessionId === sessionId) || null;
}

// Complete meeting
export function completeMeeting(sessionId, notes) {
  const meetings = getMeetings();
  const idx = meetings.findIndex((m) => m.sessionId === sessionId);
  if (idx !== -1) {
    meetings[idx].status = "completed";
    if (notes) meetings[idx].meetingNotes = notes;
    saveMeetings(meetings);
  }
}

// Get upcoming meetings for user
export function getUpcomingMeetings(userEmail, role) {
  const meetings = getMeetings();
  const now = new Date();
  
  return meetings.filter((m) => {
    if (role === "mentor" && m.mentorEmail !== userEmail) return false;
    if (role === "customer" && m.customerEmail !== userEmail) return false;
    
    const scheduledTime = new Date(m.scheduledTime);
    return scheduledTime > now && m.status !== "cancelled";
  }).sort((a, b) => new Date(a.scheduledTime).getTime() - new Date(b.scheduledTime).getTime());
}

// Get past meetings for user
export function getPastMeetings(userEmail, role) {
  const meetings = getMeetings();
  const now = new Date();
  
  return meetings.filter((m) => {
    if (role === "mentor" && m.mentorEmail !== userEmail) return false;
    if (role === "customer" && m.customerEmail !== userEmail) return false;
    
    const scheduledTime = new Date(m.scheduledTime);
    return scheduledTime <= now || m.status === "completed";
  }).sort((a, b) => new Date(b.scheduledTime).getTime() - new Date(a.scheduledTime).getTime());
}

// Verify both joined (for payment/review unlock)
export function bothJoined(sessionId) {
  const meeting = getMeetingBySession(sessionId);
  return meeting ? meeting.mentorJoined && meeting.customerJoined : false;
}
