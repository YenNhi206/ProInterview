/* ─────────────────────────────────────────────────────────
   bookings.ts  –  Unified booking store (mock + localStorage)
───────────────────────────────────────────────────────── */

import { UPCOMING_SESSIONS, MENTORS } from "../data/mockData";
import { createMeetingSession } from "./meetings";
import { getUser } from "./auth";

/* ══════════════════════════════════════════════════════════
   REVIEW SYSTEM
══════════════════════════════════════════════════════════ */

const REVIEW_PREFIX = "PI_REVIEW_";

export function saveReview(review) {
  localStorage.setItem(`${REVIEW_PREFIX}${review.sessionId}`, JSON.stringify(review));
}

export function getReview(sessionId) {
  try {
    const raw = localStorage.getItem(`${REVIEW_PREFIX}${sessionId}`);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

export function getReviewsByMentor(mentorId) {
  return Object.keys(localStorage)
    .filter(k => k.startsWith(REVIEW_PREFIX))
    .map(k => { try { return JSON.parse(localStorage.getItem(k) || "null"); } catch { return null; } })
    .filter((r) => r !== null && r.mentorId === mentorId)
    .sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime());
}

export function getAllReviews() {
  return Object.keys(localStorage)
    .filter(k => k.startsWith(REVIEW_PREFIX))
    .map(k => { try { return JSON.parse(localStorage.getItem(k) || "null"); } catch { return null; } })
    .filter((r) => r !== null)
    .sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime());
}

/* ── Constants ──────────────────────────────────────────── */
const INDEX_KEY = "PI_BOOKINGS_INDEX";      // stores array of orderNums
const PREFIX = "PI_BOOKING_";

/* ── Generate a Google Meet-style link ──────────────────── */
export function genMeetLink(seed) {
  const chars = "abcdefghijklmnopqrstuvwxyz";
  const digits = seed.replace(/\D/g, "").padEnd(12, "3456789");
  const pick = (offset, len) =>
    Array.from({ length: len }, (_, i) =>
      chars[parseInt(digits[(offset + i) % digits.length]) % 26]
    ).join("");
  return `https://meet.google.com/${pick(0, 3)}-${pick(3, 4)}-${pick(7, 3)}`;
}

/* ── Convert UPCOMING_SESSIONS mock to BookingData ───────── */
function mockToBookingData(s) {
  const mentor = MENTORS.find((m) => m.id === s.mentorId) ?? MENTORS[0];
  return {
    orderNum: s.orderNum,
    sessionId: s.id,               // dashboard uses s.id ("1","2")
    mentorId: s.mentorId,
    mentorName: s.mentor,
    mentorTitle: mentor.title,
    mentorCompany: mentor.company,
    mentorAvatar: s.mentorAvatar,
    date: s.date,
    time: s.time,
    endTime: s.endTime,
    price: s.price,
    meetLink: s.meetLink,
    position: s.position,
    note: "",
    cvFile: s.cvFile,
    jdFile: s.jdFile,
    status: s.status,
    createdAt: new Date(2026, 1, 20).toISOString(),
    rescheduledFrom: s.rescheduledFrom,
    cancelledAt: s.cancelledAt,
    cancellationReason: s.cancellationReason,
  };
}

/* ── Parse date string to ISO timestamp (handles both formats) ─────────── */
function parseDateToTimestamp(dateStr, timeStr) {
  try {
    // Handle both formats:
    // 1. "DD/MM/YYYY" (from mock data)
    // 2. "Thứ X, DD/MM" or "Chủ nhật, DD/MM" (from booking form)
    
    // Remove day name prefix if present
    const cleaned = dateStr.includes(",") ? dateStr.split(",")[1].trim() : dateStr;
    const parts = cleaned.split("/");
    
    const [h, min] = timeStr.split(":").map(Number);
    
    if (parts.length === 3) {
      // Format: DD/MM/YYYY
      const [d, m, y] = parts.map(Number);
      return new Date(y, m - 1, d, h, min || 0).toISOString();
    } else if (parts.length === 2) {
      // Format: DD/MM (no year) — assume current year 2026
      const [d, m] = parts.map(Number);
      return new Date(2026, m - 1, d, h, min || 0).toISOString();
    }
    
    // Fallback: use current timestamp
    return new Date().toISOString();
  } catch {
    return new Date().toISOString();
  }
}

/* ── Parse date string to milliseconds timestamp ─────────── */
function parseDateMs(date, time) {
  try {
    // Remove day name prefix if present
    const cleaned = date.includes(",") ? date.split(",")[1].trim() : date;
    const parts = cleaned.split("/");
    const [h] = time.split(":").map(Number);
    
    if (parts.length === 3) {
      const [d, m, y] = parts.map(Number);
      return new Date(y, m - 1, d, h).getTime();
    } else if (parts.length === 2) {
      // Format: DD/MM (no year) — assume 2026
      const [d, m] = parts.map(Number);
      return new Date(2026, m - 1, d, h).getTime();
    }
    
    return Date.now();
  } catch {
    return Date.now();
  }
}

/* ── Save a booking ──────────────────────────────────────── */
export function saveBooking(data) {
  const user = getUser();
  const full = {
    ...data,
    sessionId: data.orderNum,
    createdAt: new Date().toISOString(),
  };
  
  // Save individual record
  localStorage.setItem(`${PREFIX}${data.orderNum}`, JSON.stringify(full));
  
  // Update index
  const idx = getIndex();
  if (!idx.includes(data.orderNum)) {
    idx.unshift(data.orderNum); // newest first
    localStorage.setItem(INDEX_KEY, JSON.stringify(idx));
  }
  
  // Auto-create meeting session if booking is confirmed
  if (data.status === "confirmed" && user) {
    const scheduledTime = parseDateToTimestamp(data.date, data.time);
    
    const meeting = createMeetingSession({
      sessionId: data.sessionId,
      bookingId: data.orderNum,
      mentorEmail: data.mentorEmail || `mentor-${data.mentorId}@prointerview.vn`,
      customerEmail: user.email,
      scheduledTime,
    });
    
    // Store join code in booking for easy access
    full.joinCode = meeting.joinCode;
    localStorage.setItem(`${PREFIX}${data.orderNum}`, JSON.stringify(full));
  }
  
  return full;
}

/* ── Get index of saved order nums ──────────────────────── */
function getIndex() {
  try {
    const raw = localStorage.getItem(INDEX_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

/* ── Read one booking from localStorage ─────────────────── */
function readFromStorage(orderNum) {
  try {
    const raw = localStorage.getItem(`${PREFIX}${orderNum}`);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

/* ── Get ALL bookings (localStorage + mock), sorted by date ─ */
export function getAllBookings() {
  const stored = getIndex()
    .map(readFromStorage)
    .filter((b) => b !== null);

  // Only add mock sessions whose orderNum isn't already in stored
  const storedOrderNums = new Set(stored.map((b) => b.orderNum));
  const mock = UPCOMING_SESSIONS
    .filter((s) => !storedOrderNums.has(s.orderNum))
    .map(mockToBookingData);

  const all = [...stored, ...mock];

  // Sort: upcoming first (soonest), then past
  const now = Date.now();
  return all.sort((a, b) => {
    const ta = parseDateMs(a.date, a.time);
    const tb = parseDateMs(b.date, b.time);
    const aFuture = ta >= now;
    const bFuture = tb >= now;
    if (aFuture && bFuture) return ta - tb;   // both upcoming: soonest first
    if (!aFuture && !bFuture) return tb - ta; // both past: latest first
    return aFuture ? -1 : 1;                  // upcoming before past
  });
}

/* ── Find a single booking by any ID (orderNum or sessionId) */
export function getBookingById(id) {
  if (!id) return null;

  // 1. Try direct localStorage lookup (fresh booking by orderNum)
  const direct = readFromStorage(id);
  if (direct) return direct;

  // 2. Scan all stored bookings for matching sessionId
  for (const orderNum of getIndex()) {
    const b = readFromStorage(orderNum);
    if (b && (b.sessionId === id || b.orderNum === id)) return b;
  }

  // 3. Fall back to mock data (match by id or orderNum)
  const mock = UPCOMING_SESSIONS.find((s) => s.id === id || s.orderNum === id);
  if (mock) return mockToBookingData(mock);

  return null;
}