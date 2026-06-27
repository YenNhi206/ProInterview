import mongoose from "mongoose";
import { Booking } from "../models/Booking.js";
import { Notification } from "../models/Notification.js";
import { deliverNotification } from "../services/notificationDeliveryService.js";
import {
  isMailConfigured,
  sendBookingReminderEmailToMentee,
  sendBookingReminderEmailToMentor,
} from "../services/emailService.js";
import { parseBookingStartMs } from "../utils/bookingSchedule.js";

const WINDOW_MS_MIN = 50 * 60 * 1000;
const WINDOW_MS_MAX = 70 * 60 * 1000;
const DEDUP_HOURS = 3;

let intervalHandle = null;

async function alreadyReminded(userId, bookingId) {
  const since = new Date(Date.now() - DEDUP_HOURS * 60 * 60 * 1000);
  const hit = await Notification.findOne({
    userId,
    type: "booking_reminder",
    "metadata.bookingId": new mongoose.Types.ObjectId(String(bookingId)),
    createdAt: { $gte: since },
  })
    .select("_id")
    .lean();
  return Boolean(hit);
}

async function remindMentor(booking) {
  const mentorDoc = booking.mentorId;
  const mentorUser = mentorDoc?.userId;
  const mentorUserId = mentorUser?._id || mentorDoc?.userId;
  if (!mentorUserId) return;

  const mid = String(mentorUserId);
  if (await alreadyReminded(mid, booking._id)) return;

  const slotLabel = `${booking.date} ${booking.timeSlot}`;
  const bookingIdStr = String(booking._id);
  const menteeName = booking.userId?.name || booking.userId?.email || "Học viên";
  const mentorName = mentorDoc?.name || mentorUser?.name || mentorUser?.email || "Mentor";

  const result = await deliverNotification(mid, {
    mentorPrefKey: "session_reminder",
    type: "booking_reminder",
    title: "Buổi mentor sắp bắt đầu",
    body: `Nhắc: buổi hẹn lúc ${slotLabel} (khoảng 1 giờ nữa).`,
    metadata: { bookingId: booking._id, actionUrl: `/mentor/meeting-detail/${bookingIdStr}` },
  });

  if (!result.delivered) return;

  const mentorEmail = mentorUser?.email || "";
  if (mentorEmail && isMailConfigured()) {
    sendBookingReminderEmailToMentor(mentorEmail, {
      mentorName,
      menteeName,
      sessionType: booking.sessionType,
      date: booking.date,
      timeSlot: booking.timeSlot,
      bookingId: bookingIdStr,
    }).catch((e) => console.error("[bookingReminderJob] mentor email:", e?.message || e));
  }
}

async function remindMentee(booking) {
  const mentee = booking.userId;
  const cid = String(mentee?._id || mentee || "");
  if (!cid || !mongoose.isValidObjectId(cid)) return;
  if (await alreadyReminded(cid, booking._id)) return;

  const slotLabel = `${booking.date} ${booking.timeSlot}`;
  const bookingIdStr = String(booking._id);
  const menteeName = mentee?.name || mentee?.email || "Bạn";
  const mentorName = booking.mentorId?.name || "Mentor";

  const result = await deliverNotification(cid, {
    customerPrefKey: "interview_reminder",
    type: "booking_reminder",
    title: "Nhắc buổi mentor",
    body: `Buổi hẹn của bạn lúc ${slotLabel} sẽ bắt đầu trong khoảng 1 giờ.`,
    metadata: { bookingId: booking._id, actionUrl: `/session/${bookingIdStr}` },
  });

  if (!result.delivered) return;

  const menteeEmail = mentee?.email || "";
  if (menteeEmail && isMailConfigured()) {
    sendBookingReminderEmailToMentee(menteeEmail, {
      menteeName,
      mentorName,
      sessionType: booking.sessionType,
      date: booking.date,
      timeSlot: booking.timeSlot,
      bookingId: bookingIdStr,
    }).catch((e) => console.error("[bookingReminderJob] mentee email:", e?.message || e));
  }
}

async function runBookingReminders() {
  if (mongoose.connection.readyState !== 1) return;

  const bookings = await Booking.find({
    status: { $in: ["confirmed", "in_progress", "pending"] },
    paymentStatus: { $in: ["paid", "pending"] },
  })
    .select("_id userId mentorId date timeSlot status paymentStatus sessionType")
    .populate({ path: "userId", select: "name email" })
    .populate({
      path: "mentorId",
      select: "name userId",
      populate: { path: "userId", select: "name email" },
    })
    .lean();

  const now = Date.now();
  for (const b of bookings) {
    const startMs = parseBookingStartMs(b.date, b.timeSlot);
    if (!Number.isFinite(startMs)) continue;
    const diff = startMs - now;
    if (diff < WINDOW_MS_MIN || diff > WINDOW_MS_MAX) continue;
    if (b.status === "pending" && b.paymentStatus !== "paid") continue;

    await remindMentor(b);
    await remindMentee(b);
  }
}

/** Chạy mỗi 5 phút khi server đã kết nối MongoDB */
export function startBookingReminderJob() {
  if (intervalHandle) return;
  const tick = () => {
    runBookingReminders().catch((e) =>
      console.error("[bookingReminderJob]", e?.message || e),
    );
  };
  tick();
  intervalHandle = setInterval(tick, 5 * 60 * 1000);
}
