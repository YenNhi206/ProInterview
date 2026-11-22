/**
 * Buổi trong lộ trình (capstone FA26).
 * LP-12: ứng viên đặt lịch từng buổi — `planned → scheduled`, tạo Booking gắn buổi theo LP-04
 * (tiền ghi sẵn bằng `learningPathBookingMoney`, `paid`, `confirmed`), chỉ mở khi buổi trước `passed`
 * (`utils/learningPathSchedule.js`). Ghi kết quả buổi (LP-13) sẽ thêm vào file này.
 *
 * Booking lộ trình KHÔNG gắn `mentorshipRequestId` (LP-02): chỉ gắn `learningPathId` + `learningPathSessionId`.
 * Hủy / vắng mặt đi qua LP-22 (`closeLearningPathOrAssessmentBooking`): buổi quay về `planned` để đặt lại.
 *
 * State machine: docs/STATE_MACHINES.md mục 14.
 */
import mongoose from "mongoose";
import Joi from "joi";
import { Booking } from "../models/Booking.js";
import { LearningPathSession } from "../models/LearningPathSession.js";
import { Mentor } from "../models/Mentor.js";
import { MentorshipRequest } from "../models/MentorshipRequest.js";
import { User } from "../models/User.js";
import { httpError } from "../utils/apiErrors.js";
import { isBookingSlotInFuture } from "../utils/bookingSchedule.js";
import { isTransferPaymentExpired } from "../utils/transferPaymentExpiry.js";
import { learningPathBookingMoney } from "../utils/learningPathBookingMoney.js";
import { LEARNING_PATH_SCHEDULE_BLOCK as BLOCK, checkSessionSchedulable } from "../utils/learningPathSchedule.js";
import { mentorSlotClosedReason, normalizeBookingDate } from "./bookingsService.js";
import { expireBookingTransferIfNeeded } from "./transferPaymentExpiryService.js";
import { deliverNotification } from "./notificationDeliveryService.js";
import { learningPathDTO, loadPathForCandidate } from "./learningPathsService.js";

/** Loại buổi của booking lộ trình lấy theo yêu cầu mentor; yêu cầu thiếu hoặc lạ thì coi là phỏng vấn thử. */
const PATH_BOOKING_SESSION_TYPES = new Set(["mock_interview", "cv_review", "career_consulting"]);
/** Trạng thái booking đang giữ khung giờ của mentor (khớp partial unique index mentorId + date + timeSlot). */
const SLOT_HOLDING_STATUSES = ["pending", "confirmed", "in_progress"];

const scheduleInput = Joi.object({
  date: Joi.string().trim().required(),
  timeSlot: Joi.string().trim().pattern(/^([01]?\d|2[0-3]):[0-5]\d$/).required(),
  durationMinutes: Joi.number().integer().min(30).max(120).default(60),
  note: Joi.string().trim().max(1000).allow("").default(""),
});

function validateSchedule(body) {
  const result = scheduleInput.validate(body ?? {}, { abortEarly: true, stripUnknown: true });
  if (result.error) {
    throw httpError(400, "Thông tin đặt lịch chưa hợp lệ. Chọn ngày (DD/MM/YYYY), giờ (HH:mm) và thời lượng 30–120 phút.");
  }
  const input = result.value;
  const date = normalizeBookingDate(input.date);
  if (!/^\d{2}\/\d{2}\/\d{4}$/.test(date)) throw httpError(400, "Ngày đặt lịch không hợp lệ (dùng DD/MM/YYYY).");
  const [h, m] = input.timeSlot.split(":").map(Number);
  return { ...input, date, timeSlot: `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}` };
}

function blockMessage(check) {
  switch (check.reason) {
    case BLOCK.SESSION_NOT_FOUND:
      return [404, "Không tìm thấy buổi này trong lộ trình."];
    case BLOCK.PATH_NOT_ACTIVE:
      return [409, "Lộ trình chưa được thanh toán hoặc đã kết thúc nên chưa đặt lịch được."];
    case BLOCK.SESSION_NOT_PLANNED:
      return [409, "Buổi này đã được đặt lịch hoặc đã học xong."];
    case BLOCK.SUPERSEDED:
      return [409, "Buổi này đã có lần học mới hơn. Tải lại trang để đặt lịch đúng buổi."];
    case BLOCK.PREVIOUS_NOT_PASSED: {
      const b = check.blockingSession;
      const label = `buổi ${b.order}${Number(b.attempt) > 1 ? " (học lại)" : ""}`;
      if (b.status === "scheduled") return [409, `Cần hoàn thành ${label} và được mentor đánh giá đạt trước khi đặt buổi này.`];
      if (b.status === "done") return [409, `${label[0].toUpperCase()}${label.slice(1)} chưa đạt. Mentor sẽ mở buổi học lại; bạn đặt buổi học lại trước.`];
      return [409, `Hãy đặt lịch ${label} trước. Các buổi mở lần lượt khi buổi trước đạt.`];
    }
    default:
      return [409, "Chưa đặt lịch được buổi này."];
  }
}

/** Giải phóng khung giờ đang bị một đơn CK hết hạn giữ (cùng cách `createBooking`), còn lại báo trùng. */
async function assertMentorSlotFree(mentorId, date, timeSlot) {
  const dup = await Booking.findOne({ mentorId, date, timeSlot, status: { $in: SLOT_HOLDING_STATUSES } });
  if (!dup) return;
  const expiredTransfer =
    dup.status === "pending" &&
    dup.paymentStatus === "pending" &&
    String(dup.paymentMethod || "").toLowerCase() === "transfer" &&
    isTransferPaymentExpired(dup);
  if (expiredTransfer) {
    const { expired } = await expireBookingTransferIfNeeded(dup);
    if (expired) return;
  }
  throw httpError(409, "Khung giờ này mentor đã có lịch. Vui lòng chọn giờ khác.");
}

function bookingNotes(session, path, input) {
  const retake = Number(session.attempt) > 1 ? " (học lại)" : "";
  return [
    `Lộ trình · Buổi ${session.order}${retake}: ${session.title}`,
    session.objectives?.length ? `Mục tiêu: ${session.objectives.join("; ")}` : "",
    path.goal ? `Mục tiêu lộ trình: ${path.goal}` : "",
    input.note ? `Ghi chú của mentee: ${input.note}` : "",
    `Lộ trình: /mentor/learning-paths/${path._id}/edit`,
  ].filter(Boolean).join("\n").slice(0, 8000);
}

/**
 * LP-12: ứng viên đặt lịch buổi đang mở của lộ trình `active`.
 * Giữ buổi trước (`planned → scheduled` có điều kiện, kèm `bookingId` sinh sẵn) rồi mới tạo Booking,
 * nên hai request đặt cùng buổi chỉ một cái thắng; tạo Booking lỗi (trùng khung giờ) thì trả buổi về `planned`.
 * @returns {Promise<{ learningPath: object, booking: object }>}
 */
export async function scheduleLearningPathSession(actor, pathId, sessionId, body) {
  const path = await loadPathForCandidate(actor, pathId);
  if (!mongoose.isValidObjectId(sessionId)) throw httpError(400, "Mã buổi không hợp lệ.");
  const input = validateSchedule(body);

  const sessions = await LearningPathSession.find({ pathId: path._id }).lean();
  const check = checkSessionSchedulable(path, sessions, sessionId);
  if (!check.ok) throw httpError(...blockMessage(check));
  const session = check.session;

  const mentor = await Mentor.findById(path.mentorId)
    .select("name userId isActive isVerified availableSlots recurringSchedule blockedDates")
    .lean();
  if (!mentor?.userId || mentor.isActive === false || mentor.isVerified === false) {
    throw httpError(409, "Mentor của lộ trình đang tạm ngưng nhận lịch. Vui lòng liên hệ hỗ trợ.");
  }
  if (!isBookingSlotInFuture(input.date, input.timeSlot)) throw httpError(400, "Chọn thời gian trong tương lai cho buổi học.");
  const slotClosed = mentorSlotClosedReason(mentor, input.date, input.timeSlot);
  if (slotClosed) throw httpError(400, slotClosed);
  await assertMentorSlotFree(mentor._id, input.date, input.timeSlot);

  const bookingId = new mongoose.Types.ObjectId();
  const claimed = await LearningPathSession.findOneAndUpdate(
    { _id: session._id, pathId: path._id, status: "planned", bookingId: null },
    { $set: { status: "scheduled", bookingId } },
    { returnDocument: "after" },
  ).lean();
  if (!claimed) throw httpError(409, "Buổi này vừa được đặt lịch. Vui lòng tải lại trang.");

  const request = await MentorshipRequest.findById(path.mentorshipRequestId).select("sessionType cvName jdName").lean();
  let booking;
  try {
    booking = await Booking.create({
      _id: bookingId,
      userId: path.candidateId,
      mentorId: mentor._id,
      learningPathId: path._id,
      learningPathSessionId: session._id,
      sessionType: PATH_BOOKING_SESSION_TYPES.has(request?.sessionType) ? request.sessionType : "mock_interview",
      status: "confirmed",
      date: input.date,
      timeSlot: input.timeSlot,
      durationMinutes: input.durationMinutes,
      notes: bookingNotes(session, path, input),
      cvFileName: request?.cvName || "",
      jdFileName: request?.jdName || "",
      ...learningPathBookingMoney({
        shareAmount: session.shareAmount,
        platformFeeRate: path.platformFeeRate,
        paidAt: path.paidAt || new Date(),
      }),
    });
  } catch (error) {
    await LearningPathSession.updateOne(
      { _id: session._id, bookingId, status: "scheduled" },
      { $set: { status: "planned", bookingId: null } },
    );
    if (error?.code === 11000) throw httpError(409, "Khung giờ này mentor đã có lịch. Vui lòng chọn giờ khác.");
    throw error;
  }

  const candidate = await User.findById(path.candidateId).select("name").lean();
  const retake = Number(session.attempt) > 1 ? " (học lại)" : "";
  await deliverNotification(mentor.userId, {
    type: "booking_confirmed",
    mentorPrefKey: "booking_request",
    title: `Mentee đã đặt buổi ${session.order}${retake} của lộ trình`,
    body: `${candidate?.name || "Mentee"} đặt buổi "${session.title}" lúc ${input.timeSlot} ngày ${input.date}.`,
    metadata: {
      bookingId: booking._id,
      learningPathId: path._id,
      learningPathSessionId: session._id,
      actionUrl: `/mentor/meeting-detail/${booking._id}`,
    },
  });

  return {
    learningPath: await learningPathDTO(path._id),
    booking: {
      id: String(booking._id),
      status: booking.status,
      date: booking.date,
      timeSlot: booking.timeSlot,
      durationMinutes: booking.durationMinutes,
      learningPathSessionId: String(session._id),
    },
  };
}
