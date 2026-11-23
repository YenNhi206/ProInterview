/**
 * Buổi trong lộ trình (capstone FA26).
 * LP-12: ứng viên đặt lịch từng buổi — `planned → scheduled`, tạo Booking gắn buổi theo LP-04
 * (tiền ghi sẵn bằng `learningPathBookingMoney`, `paid`, `confirmed`), chỉ mở khi buổi trước `passed`
 * (`utils/learningPathSchedule.js`).
 * LP-13: mentor ghi kết quả buổi (`scheduled → done` + `outcome` + feedback theo LP-01). `not_passed` lần đầu tạo
 * buổi học lại 0đ; từ lần học lại trở đi mentor đề xuất buổi bổ sung có phí (`pending_payment`, quyết định 2);
 * buổi cuối đạt thì lộ trình `completed`.
 *
 * Booking lộ trình KHÔNG gắn `mentorshipRequestId` (LP-02): chỉ gắn `learningPathId` + `learningPathSessionId`.
 * Hủy / vắng mặt đi qua LP-22 (`closeLearningPathOrAssessmentBooking`): buổi quay về `planned` để đặt lại.
 *
 * State machine: docs/STATE_MACHINES.md mục 14.
 */
import mongoose from "mongoose";
import Joi from "joi";
import { Booking } from "../models/Booking.js";
import { LearningPath } from "../models/LearningPath.js";
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
import { candidateConflictMessage, findCandidateBookingConflict } from "./bookingConflictService.js";
import { deliverNotification } from "./notificationDeliveryService.js";
import { learningPathDTO, loadPathForCandidate, loadPathForMentor } from "./learningPathsService.js";
import { getFramework, suggestOutcome } from "./competencyFramework.js";
import { retakeShareAmount } from "../utils/learningPathMoney.js";
import { LEARNING_PATH_OUTCOME_NEXT as NEXT, needsSupplementarySession, resolveOutcomeNextStep } from "../utils/learningPathOutcome.js";

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
    case BLOCK.AWAITING_PAYMENT:
      return [409, "Buổi bổ sung này cần thanh toán trước khi đặt lịch."];
    case BLOCK.SUPERSEDED:
      return [409, "Buổi này đã có lần học mới hơn. Tải lại trang để đặt lịch đúng buổi."];
    case BLOCK.PREVIOUS_NOT_PASSED: {
      const b = check.blockingSession;
      const label = `buổi ${b.order}${Number(b.attempt) > 1 ? " (học lại)" : ""}`;
      if (b.status === "scheduled") return [409, `Cần hoàn thành ${label} và được mentor đánh giá đạt trước khi đặt buổi này.`];
      if (b.status === "done") return [409, `${label[0].toUpperCase()}${label.slice(1)} chưa đạt. Mentor sẽ mở buổi học lại; bạn đặt buổi học lại trước.`];
      if (b.status === "pending_payment") return [409, `Buổi bổ sung của buổi ${b.order} đang chờ thanh toán. Thanh toán và học buổi đó trước.`];
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
  const ownConflict = await findCandidateBookingConflict(path.candidateId, input);
  if (ownConflict) throw httpError(409, candidateConflictMessage(ownConflict));

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

// ---------------------------------------------------------------------------
// LP-13 — mentor ghi kết quả buổi, đề xuất buổi bổ sung có phí
// ---------------------------------------------------------------------------

/** Giá buổi bổ sung có phí (VND): cùng sàn với giá trọn gói, trần bằng 1 lộ trình. */
export const SUPPLEMENTARY_MIN_PRICE = 10_000;
export const SUPPLEMENTARY_MAX_PRICE = 100_000_000;

const outcomeInput = Joi.object({
  outcome: Joi.string().valid("passed", "not_passed").required(),
  feedback: Joi.object({
    summary: Joi.string().trim().min(10).max(4000).required(),
    strengths: Joi.array().items(Joi.string().trim().min(1).max(1000)).max(10).default([]),
    improvements: Joi.array().items(Joi.string().trim().min(1).max(1000)).max(10).default([]),
  }).required(),
  /** Mức 0–5 theo LP-01 cho từng key của buổi; `null` = chưa đủ dữ liệu. */
  scores: Joi.array().items(Joi.object({
    shrmKey: Joi.string().trim().lowercase().required(),
    score: Joi.number().integer().min(0).max(5).allow(null).required(),
    note: Joi.string().trim().max(1000).allow("").default(""),
  })).max(10).default([]),
});

const supplementaryInput = Joi.object({
  price: Joi.number().integer().min(SUPPLEMENTARY_MIN_PRICE).max(SUPPLEMENTARY_MAX_PRICE).required(),
  note: Joi.string().trim().max(2000).allow("").default(""),
});

function validateOutcome(body, session) {
  const result = outcomeInput.validate(body ?? {}, { abortEarly: true, stripUnknown: true });
  if (result.error) {
    const field = result.error.details[0]?.path?.join(".") || "";
    throw httpError(400, `Kết quả buổi chưa hợp lệ${field ? ` (trường ${field})` : ""}. Chọn đạt / chưa đạt, nhận xét tối thiểu 10 ký tự, điểm năng lực 0–5.`);
  }
  const input = result.value;
  if (input.outcome === "not_passed" && input.feedback.improvements.length === 0) {
    throw httpError(400, "Buổi chưa đạt cần ít nhất một điểm cần cải thiện để mentee biết học lại phần nào.");
  }
  const allowed = new Set(session.shrmKeys || []);
  const seen = new Set();
  for (const row of input.scores) {
    if (!allowed.has(row.shrmKey)) throw httpError(400, `Năng lực "${row.shrmKey}" không thuộc buổi này. Chỉ chấm các năng lực đã gắn cho buổi.`);
    if (seen.has(row.shrmKey)) throw httpError(400, `Năng lực "${row.shrmKey}" bị chấm hai lần.`);
    seen.add(row.shrmKey);
  }
  return input;
}

const capitalize = (text) => `${text[0].toUpperCase()}${text.slice(1)}`;

function sessionLabel(session) {
  return `buổi ${session.order}${Number(session.attempt) > 1 ? " (học lại)" : ""}`;
}

async function loadSessionOfPath(path, sessionId) {
  if (!mongoose.isValidObjectId(sessionId)) throw httpError(400, "Mã buổi không hợp lệ.");
  const session = await LearningPathSession.findOne({ _id: sessionId, pathId: path._id }).lean();
  if (!session) throw httpError(404, "Không tìm thấy buổi này trong lộ trình.");
  return session;
}

/**
 * LP-13: mentor ghi kết quả buổi đã học (`PATCH /api/learning-paths/:id/sessions/:sid/outcome`).
 * Điều kiện: lộ trình `active`, buổi `scheduled`, booking của buổi đã `completed` (mentor kết thúc buổi
 * qua luồng có sẵn; thu nhập mentor tính ở đó — LP-14).
 * Ghi bằng cập nhật có điều kiện (`status: scheduled`) nên hai request ghi cùng buổi chỉ một cái thắng.
 * @returns {Promise<{ learningPath: object, nextStep: string, suggestedOutcome: string|null }>}
 */
export async function recordLearningPathSessionOutcome(actor, pathId, sessionId, body) {
  const path = await loadPathForMentor(actor, pathId);
  const session = await loadSessionOfPath(path, sessionId);
  if (path.status !== "active") throw httpError(409, "Lộ trình không còn đang học nên không ghi kết quả được.");
  if (session.status === "done") throw httpError(409, "Buổi này đã có kết quả.");
  if (session.status !== "scheduled" || !session.bookingId) {
    throw httpError(409, "Buổi này chưa diễn ra (mentee chưa đặt lịch) nên chưa ghi kết quả được.");
  }
  const input = validateOutcome(body, session);

  const booking = await Booking.findById(session.bookingId).select("status").lean();
  if (booking?.status !== "completed") {
    throw httpError(409, "Hãy kết thúc buổi học (đánh dấu hoàn thành) trước khi ghi kết quả.");
  }

  const scoreByKey = Object.fromEntries(input.scores.map((r) => [r.shrmKey, r.score]));
  const suggested = input.scores.length ? suggestOutcome(scoreByKey, session.shrmKeys) : null;
  const now = new Date();
  const done = await LearningPathSession.findOneAndUpdate(
    { _id: session._id, pathId: path._id, status: "scheduled", bookingId: session.bookingId },
    {
      $set: {
        status: "done",
        outcome: input.outcome,
        doneAt: now,
        feedback: {
          summary: input.feedback.summary,
          strengths: input.feedback.strengths,
          improvements: input.feedback.improvements,
          scores: input.scores,
          frameworkVersion: getFramework().version || "",
          suggestedOutcome: suggested,
        },
      },
    },
    { returnDocument: "after" },
  ).lean();
  if (!done) throw httpError(409, "Buổi này vừa được ghi kết quả. Vui lòng tải lại trang.");

  const sessionsAfter = await LearningPathSession.find({ pathId: path._id }).lean();
  const nextStep = resolveOutcomeNextStep(done, input.outcome, sessionsAfter);

  if (nextStep === NEXT.FREE_RETAKE) {
    try {
      await LearningPathSession.create({
        pathId: path._id,
        order: done.order,
        attempt: done.attempt + 1,
        retakeOf: done._id,
        title: done.title,
        objectives: done.objectives,
        shrmKeys: done.shrmKeys,
        shareAmount: retakeShareAmount(done.attempt + 1),
        status: "planned",
      });
    } catch (error) {
      // Unique (pathId, order, attempt): buổi học lại đã có thì thôi.
      if (error?.code !== 11000) throw error;
    }
  } else if (nextStep === NEXT.COMPLETE_PATH) {
    await LearningPath.updateOne({ _id: path._id, status: "active" }, { $set: { status: "completed", completedAt: now } });
  }

  await notifyCandidateOfOutcome(path, done, nextStep);
  return { learningPath: await learningPathDTO(path._id), nextStep, suggestedOutcome: suggested };
}

async function notifyCandidateOfOutcome(path, session, nextStep) {
  const label = sessionLabel(session);
  const [title, body] = {
    [NEXT.OPEN_NEXT]: [`Bạn đã đạt ${label}`, `Mentor đánh giá đạt "${session.title}". Buổi tiếp theo đã mở đặt lịch.`],
    [NEXT.COMPLETE_PATH]: ["Bạn đã hoàn thành lộ trình", `Mentor đánh giá đạt "${session.title}", buổi cuối của lộ trình. Chúc mừng bạn!`],
    [NEXT.FREE_RETAKE]: [`${capitalize(label)} chưa đạt`, `Mentor đã mở buổi học lại miễn phí cho "${session.title}". Xem nhận xét và đặt lịch học lại.`],
    [NEXT.SUPPLEMENTARY_REQUIRED]: [`${capitalize(label)} chưa đạt`, `Buổi học lại miễn phí đã dùng. Mentor sẽ đề xuất buổi bổ sung có phí cho "${session.title}".`],
  }[nextStep];
  await deliverNotification(path.candidateId, {
    type: "learning_path_session_result",
    title,
    body,
    metadata: { learningPathId: path._id, learningPathSessionId: session._id, actionUrl: `/learning-paths/${path._id}` },
  });
}

/**
 * LP-13 (quyết định 2): sau lần học lại vẫn chưa đạt, mentor đề xuất buổi bổ sung có phí
 * (`POST /api/learning-paths/:id/sessions/:sid/supplementary`). Buổi mới `attempt + 1`, `retakeOf` buổi vừa trượt,
 * `shareAmount` = giá đề xuất (thu riêng, ngoài T), ở `pending_payment` nên chưa đặt lịch được tới khi trả tiền.
 * @returns {Promise<{ learningPath: object }>}
 */
export async function proposeSupplementarySession(actor, pathId, sessionId, body) {
  const path = await loadPathForMentor(actor, pathId);
  const session = await loadSessionOfPath(path, sessionId);
  if (path.status !== "active") throw httpError(409, "Lộ trình không còn đang học nên không đề xuất buổi bổ sung được.");
  const result = supplementaryInput.validate(body ?? {}, { abortEarly: true, stripUnknown: true });
  if (result.error) {
    throw httpError(400, `Giá buổi bổ sung phải là số nguyên từ ${SUPPLEMENTARY_MIN_PRICE.toLocaleString("vi-VN")}₫ đến ${SUPPLEMENTARY_MAX_PRICE.toLocaleString("vi-VN")}₫.`);
  }
  const input = result.value;

  const sessions = await LearningPathSession.find({ pathId: path._id }).lean();
  if (!needsSupplementarySession(sessions, session._id)) {
    if (session.status === "done" && session.outcome === "not_passed" && Number(session.attempt) === 1) {
      throw httpError(409, "Lần chưa đạt đầu tiên đã có buổi học lại miễn phí; chỉ đề xuất buổi bổ sung khi buổi học lại vẫn chưa đạt.");
    }
    throw httpError(409, "Chỉ đề xuất buổi bổ sung cho lần học lại mới nhất đã được đánh giá chưa đạt.");
  }

  const attempt = Number(session.attempt) + 1;
  try {
    await LearningPathSession.create({
      pathId: path._id,
      order: session.order,
      attempt,
      retakeOf: session._id,
      title: session.title,
      objectives: session.objectives,
      shrmKeys: session.shrmKeys,
      shareAmount: retakeShareAmount(attempt, input.price),
      status: "pending_payment",
      supplementaryNote: input.note,
      proposedAt: new Date(),
    });
  } catch (error) {
    if (error?.code === 11000) throw httpError(409, "Buổi này đã có đề xuất buổi bổ sung.");
    throw error;
  }

  await deliverNotification(path.candidateId, {
    type: "learning_path_session_result",
    title: `Mentor đề xuất buổi bổ sung cho buổi ${session.order}`,
    body: `Buổi bổ sung "${session.title}" giá ${input.price.toLocaleString("vi-VN")}₫.${input.note ? ` Ghi chú: ${input.note}` : ""}`,
    metadata: { learningPathId: path._id, learningPathSessionId: session._id, actionUrl: `/learning-paths/${path._id}` },
  });
  return { learningPath: await learningPathDTO(path._id) };
}
