/**
 * Learning Path — phía Mentor (LP-07): tạo / sửa bản nháp, gửi đề xuất cho ứng viên.
 * Phía ứng viên (xem, chấp nhận, yêu cầu sửa) ở LP-08; chia tiền từng buổi ở LP-09.
 *
 * State machine: docs/STATE_MACHINES.md mục 13. Quyết định: docs/capstone/DECISIONS.md (1–5, 13).
 */
import mongoose from "mongoose";
import Joi from "joi";
import { LearningPath } from "../models/LearningPath.js";
import { LearningPathSession } from "../models/LearningPathSession.js";
import { MentorshipRequest } from "../models/MentorshipRequest.js";
import { Booking } from "../models/Booking.js";
import { User } from "../models/User.js";
import { Mentor } from "../models/Mentor.js";
import { httpError } from "../utils/apiErrors.js";
import { resolveBookingPlatformFeeRate } from "./mentorCommissionService.js";
import { deliverNotification } from "./notificationDeliveryService.js";
import { splitLearningPathShares } from "../utils/learningPathMoney.js";

export const LEARNING_PATH_MAX_SESSIONS = 12;
/** Giá trọn gói tối thiểu khi gửi đề xuất (VND). Bản nháp được để 0. */
export const LEARNING_PATH_MIN_PRICE = 10_000;
export const LEARNING_PATH_MAX_PRICE = 100_000_000;
/** Mentor chỉ sửa nội dung khi lộ trình chưa gửi hoặc đang bị yêu cầu sửa. */
const EDITABLE_STATUSES = ["draft", "revision_requested"];

const shrmKey = Joi.string().trim().lowercase().pattern(/^[a-z0-9_]{2,60}$/);
const sessionInput = Joi.object({
  title: Joi.string().trim().min(3).max(200).required(),
  objectives: Joi.array().items(Joi.string().trim().min(1).max(500)).max(10).default([]),
  shrmKeys: Joi.array().items(shrmKey).max(10).unique().default([]),
});
const draftFields = {
  goal: Joi.string().trim().max(2000).allow(""),
  totalAmount: Joi.number().integer().min(0).max(LEARNING_PATH_MAX_PRICE),
  sessions: Joi.array().items(sessionInput).max(LEARNING_PATH_MAX_SESSIONS),
};
const createInput = Joi.object({
  mentorshipRequestId: Joi.string().hex().length(24).required(),
  goal: draftFields.goal.default(""),
  totalAmount: draftFields.totalAmount.default(0),
  sessions: draftFields.sessions.default([]),
});
const updateInput = Joi.object(draftFields).min(1);
/** LP-08: ứng viên chấp nhận đúng phiên bản đang xem (tránh chấp nhận bản cũ). */
const acceptInput = Joi.object({ version: Joi.number().integer().min(1) });
const revisionInput = Joi.object({ note: Joi.string().trim().min(5).max(2000).required() });

function validate(schema, value) {
  const result = schema.validate(value ?? {}, { abortEarly: true, stripUnknown: true });
  if (result.error) {
    const field = result.error.details[0]?.path?.join(".") || "";
    throw httpError(400, `Thông tin lộ trình chưa hợp lệ${field ? ` (trường ${field})` : ""}. Kiểm tra số buổi (tối đa ${LEARNING_PATH_MAX_SESSIONS}), tên buổi, mục tiêu, mã năng lực và giá trọn gói.`);
  }
  return result.value;
}

function requireMentor(actor) {
  if (!actor?.mentor) throw httpError(403, "Chỉ Mentor đã được duyệt mới soạn được lộ trình.");
}

function assertPathId(value) {
  if (!mongoose.isValidObjectId(value)) throw httpError(400, "Mã lộ trình không hợp lệ.");
}

async function loadPathForMentor(actor, pathId) {
  requireMentor(actor);
  assertPathId(pathId);
  const path = await LearningPath.findById(pathId).lean();
  if (!path || String(path.mentorId) !== String(actor.mentor._id)) throw httpError(404, "Không tìm thấy lộ trình.");
  return path;
}

async function replaceSessions(pathId, sessions) {
  await LearningPathSession.deleteMany({ pathId, status: "planned", bookingId: null });
  if (!sessions.length) return;
  await LearningPathSession.insertMany(
    sessions.map((s, i) => ({ pathId, order: i + 1, attempt: 1, title: s.title, objectives: s.objectives, shrmKeys: s.shrmKeys, shareAmount: 0 })),
  );
}

/** DTO dùng chung cho mentor và ứng viên. */
export async function learningPathDTO(pathOrId) {
  // ObjectId cũng có thuộc tính `_id` (trỏ về chính nó) nên phải nhận document qua field nghiệp vụ.
  const isDocument = pathOrId && typeof pathOrId === "object" && !(pathOrId instanceof mongoose.Types.ObjectId) && "status" in pathOrId;
  const path = isDocument ? pathOrId : await LearningPath.findById(pathOrId).lean();
  if (!path) throw httpError(404, "Không tìm thấy lộ trình.");
  const [sessions, candidate, request, assessment] = await Promise.all([
    LearningPathSession.find({ pathId: path._id }).sort({ order: 1, attempt: 1 }).lean(),
    User.findById(path.candidateId).select("name").lean(),
    MentorshipRequest.findById(path.mentorshipRequestId).select("title position description sessionType cvName jdName").lean(),
    path.assessmentBookingId ? Booking.findById(path.assessmentBookingId).select("status date timeSlot durationMinutes").lean() : null,
  ]);
  return {
    id: String(path._id),
    candidateId: String(path.candidateId),
    mentorId: String(path.mentorId),
    mentorshipRequestId: String(path.mentorshipRequestId),
    jobPostId: path.jobPostId ? String(path.jobPostId) : "",
    assessmentBookingId: path.assessmentBookingId ? String(path.assessmentBookingId) : "",
    goal: path.goal,
    status: path.status,
    version: path.version,
    revisionNote: path.revisionNote,
    totalAmount: path.totalAmount,
    platformFeeRate: path.platformFeeRate,
    proposedAt: path.proposedAt ?? null,
    acceptedAt: path.acceptedAt ?? null,
    createdAt: path.createdAt,
    updatedAt: path.updatedAt,
    /** LP-20: bối cảnh để Mentor soạn lộ trình (hồ sơ ứng viên đầy đủ có ở PR-01). */
    candidate: { name: candidate?.name || "Ứng viên" },
    request: request
      ? { title: request.title, position: request.position, description: request.description, sessionType: request.sessionType, cvName: request.cvName, jdName: request.jdName }
      : null,
    assessment: assessment
      ? { bookingId: String(assessment._id), status: assessment.status, date: assessment.date, timeSlot: assessment.timeSlot, durationMinutes: assessment.durationMinutes }
      : null,
    sessions: sessions.map((s) => ({
      id: String(s._id),
      order: s.order,
      attempt: s.attempt,
      title: s.title,
      objectives: s.objectives,
      shrmKeys: s.shrmKeys,
      shareAmount: s.shareAmount,
      status: s.status,
      outcome: s.outcome,
      bookingId: s.bookingId ? String(s.bookingId) : "",
      retakeOf: s.retakeOf ? String(s.retakeOf) : "",
    })),
  };
}

/** Mentor: lộ trình mình soạn. Ứng viên: lộ trình đã được gửi cho mình (không thấy bản nháp). */
export async function listLearningPaths(actor) {
  const filter = actor.mentor
    ? { mentorId: actor.mentor._id }
    : { candidateId: actor.userId, status: { $ne: "draft" } };
  const rows = await LearningPath.find(filter).sort({ updatedAt: -1 }).limit(100).lean();
  return Promise.all(rows.map((row) => learningPathDTO(row)));
}

export async function getLearningPath(actor, pathId) {
  assertPathId(pathId);
  const path = await LearningPath.findById(pathId).lean();
  const isMentor = actor.mentor && path && String(path.mentorId) === String(actor.mentor._id);
  const isCandidate = !actor.mentor && path && String(path.candidateId) === actor.userId && path.status !== "draft";
  if (!isMentor && !isCandidate) throw httpError(404, "Không tìm thấy lộ trình.");
  return learningPathDTO(path);
}

/**
 * Mentor được chọn tạo bản nháp từ yêu cầu (đã chọn mentor). Mỗi yêu cầu chỉ có 1 lộ trình chưa hủy
 * (index `mentorshipRequestId_open_unique`, LP-03).
 */
export async function createLearningPathDraft(actor, body) {
  requireMentor(actor);
  const input = validate(createInput, body);
  const request = await MentorshipRequest.findById(input.mentorshipRequestId).lean();
  if (!request || String(request.selectedMentorId || "") !== String(actor.mentor._id)) {
    throw httpError(404, "Không tìm thấy yêu cầu bạn được mentee chọn.");
  }
  if (!["selected", "assessing"].includes(request.status)) {
    throw httpError(409, request.status === "path_proposed" ? "Yêu cầu này đã có lộ trình." : "Yêu cầu chưa chọn Mentor hoặc đã đóng.");
  }

  let path;
  try {
    path = await LearningPath.create({
      candidateId: request.userId,
      mentorId: actor.mentor._id,
      mentorshipRequestId: request._id,
      jobPostId: request.jobPostId ?? null,
      assessmentBookingId: request.assessmentBookingId ?? null,
      goal: input.goal,
      totalAmount: input.totalAmount,
      status: "draft",
    });
  } catch (error) {
    if (error?.code === 11000) throw httpError(409, "Yêu cầu này đã có lộ trình. Mở lộ trình hiện có để chỉnh sửa.");
    throw error;
  }
  await replaceSessions(path._id, input.sessions);
  return learningPathDTO(path._id);
}

/** Sửa bản nháp hoặc lộ trình đang bị yêu cầu sửa. `sessions` (nếu gửi) thay toàn bộ danh sách buổi. */
export async function updateLearningPathDraft(actor, pathId, body) {
  const path = await loadPathForMentor(actor, pathId);
  if (!EDITABLE_STATUSES.includes(path.status)) {
    throw httpError(409, "Chỉ sửa được lộ trình ở trạng thái nháp hoặc đang được yêu cầu sửa.");
  }
  const input = validate(updateInput, body);
  const set = {};
  if (input.goal !== undefined) set.goal = input.goal;
  if (input.totalAmount !== undefined) set.totalAmount = input.totalAmount;
  const updated = await LearningPath.findOneAndUpdate(
    { _id: path._id, status: { $in: EDITABLE_STATUSES } },
    { $set: set },
    { returnDocument: "after" },
  ).lean();
  if (!updated) throw httpError(409, "Lộ trình vừa đổi trạng thái. Vui lòng tải lại trang.");
  if (input.sessions !== undefined) await replaceSessions(path._id, input.sessions);
  return learningPathDTO(path._id);
}

/**
 * Gửi đề xuất cho ứng viên: draft | revision_requested → proposed.
 * Điều kiện (TASKS LP-07): ≥ 1 buổi, có giá (≥ LEARNING_PATH_MIN_PRICE), buổi đánh giá 0đ đã `completed`.
 * Gửi lại sau `revision_requested` thì `version + 1` (LP-08). Chụp `platformFeeRate` theo Mentor lúc gửi
 * (quyết định 4). Yêu cầu mentor → `path_proposed`. Thông báo `learning_path_proposed` cho ứng viên.
 */
export async function proposeLearningPath(actor, pathId) {
  const path = await loadPathForMentor(actor, pathId);
  if (!EDITABLE_STATUSES.includes(path.status)) {
    throw httpError(409, path.status === "proposed" ? "Lộ trình đã được gửi, đang chờ ứng viên phản hồi." : "Lộ trình không còn ở trạng thái gửi được.");
  }
  const sessionCount = await LearningPathSession.countDocuments({ pathId: path._id });
  if (sessionCount < 1) throw httpError(400, "Lộ trình cần ít nhất 1 buổi trước khi gửi.");
  if (!Number.isInteger(path.totalAmount) || path.totalAmount < LEARNING_PATH_MIN_PRICE) {
    throw httpError(400, `Nhập giá trọn gói từ ${LEARNING_PATH_MIN_PRICE.toLocaleString("vi-VN")}₫ trước khi gửi.`);
  }

  const request = await MentorshipRequest.findById(path.mentorshipRequestId).select("assessmentBookingId status").lean();
  const assessmentId = request?.assessmentBookingId || path.assessmentBookingId;
  const assessment = assessmentId
    ? await Booking.findOne({ _id: assessmentId, sessionType: "assessment" }).select("status").lean()
    : null;
  if (assessment?.status !== "completed") {
    throw httpError(400, "Cần hoàn thành buổi đánh giá 0đ với mentee trước khi gửi lộ trình.");
  }

  const { rate } = resolveBookingPlatformFeeRate(actor.mentor);

  // LP-09: chốt phần tiền từng buổi gốc theo giá trọn gói lúc gửi (tổng luôn bằng T, buổi cuối nhận phần dư).
  // Mentor chỉ sửa được ở draft / revision_requested nên mỗi lần gửi lại đều tính lại.
  const originals = await LearningPathSession.find({ pathId: path._id, attempt: 1 }).sort({ order: 1 }).select("_id").lean();
  const shares = splitLearningPathShares(path.totalAmount, originals.length);
  await LearningPathSession.bulkWrite(
    originals.map((row, i) => ({ updateOne: { filter: { _id: row._id }, update: { $set: { shareAmount: shares[i] } } } })),
  );

  const isResubmit = path.status === "revision_requested";
  const now = new Date();
  const updated = await LearningPath.findOneAndUpdate(
    { _id: path._id, status: path.status, version: path.version },
    {
      $set: { status: "proposed", proposedAt: now, platformFeeRate: rate, assessmentBookingId: assessmentId },
      ...(isResubmit ? { $inc: { version: 1 } } : {}),
    },
    { returnDocument: "after" },
  ).lean();
  if (!updated) throw httpError(409, "Lộ trình vừa đổi trạng thái. Vui lòng tải lại trang.");

  await MentorshipRequest.updateOne(
    { _id: path.mentorshipRequestId, status: { $in: ["selected", "assessing"] } },
    { $set: { status: "path_proposed" } },
  );

  await deliverNotification(path.candidateId, {
    type: "learning_path_proposed",
    title: isResubmit ? "Mentor đã gửi lại lộ trình" : "Mentor đã đề xuất lộ trình cho bạn",
    body: `${actor.mentor.name || "Mentor"} ${isResubmit ? "đã chỉnh sửa và gửi lại" : "đã gửi"} lộ trình ${sessionCount} buổi, trọn gói ${updated.totalAmount.toLocaleString("vi-VN")}₫. Xem và chấp nhận hoặc yêu cầu sửa.`,
    metadata: { learningPathId: path._id, mentorId: path.mentorId, actionUrl: `/learning-paths/${path._id}` },
  });

  return learningPathDTO(updated);
}

// ---------------------------------------------------------------------------
// LP-08 — phía ứng viên: chấp nhận / yêu cầu sửa
// ---------------------------------------------------------------------------

function requireCandidate(actor) {
  if (actor?.mentor) throw httpError(403, "Chỉ mentee của lộ trình mới thực hiện được thao tác này.");
}

async function loadPathForCandidate(actor, pathId) {
  requireCandidate(actor);
  assertPathId(pathId);
  const path = await LearningPath.findById(pathId).lean();
  // Bản nháp coi như không tồn tại với ứng viên (giống GET /:id).
  if (!path || String(path.candidateId) !== actor.userId || path.status === "draft") throw httpError(404, "Không tìm thấy lộ trình.");
  return path;
}

async function notifyMentor(path, payload) {
  const mentor = await Mentor.findById(path.mentorId).select("userId").lean();
  if (!mentor?.userId) return;
  await deliverNotification(mentor.userId, {
    ...payload,
    mentorPrefKey: "booking_request",
    metadata: { learningPathId: path._id, actionUrl: `/mentor/learning-paths/${path._id}/edit` },
  });
}

/**
 * Ứng viên chấp nhận lộ trình: proposed → pending_payment (quyết định 1: trả trọn gói ở LP-10).
 * Gửi kèm `version` đang xem thì chỉ chấp nhận đúng phiên bản đó (409 nếu mentor đã gửi bản khác).
 */
export async function acceptLearningPath(actor, pathId, body) {
  const path = await loadPathForCandidate(actor, pathId);
  const input = validate(acceptInput, body);
  if (path.status !== "proposed") {
    throw httpError(409, path.status === "revision_requested" ? "Bạn đã yêu cầu sửa, hãy chờ mentor gửi lại lộ trình." : "Lộ trình không còn ở trạng thái chờ bạn chấp nhận.");
  }
  if (input.version !== undefined && input.version !== path.version) {
    throw httpError(409, "Mentor vừa gửi phiên bản mới. Tải lại trang để xem trước khi chấp nhận.");
  }
  const updated = await LearningPath.findOneAndUpdate(
    { _id: path._id, status: "proposed", version: path.version },
    { $set: { status: "pending_payment", acceptedAt: new Date() } },
    { returnDocument: "after" },
  ).lean();
  if (!updated) throw httpError(409, "Lộ trình vừa đổi trạng thái. Vui lòng tải lại trang.");

  const candidate = await User.findById(path.candidateId).select("name").lean();
  await notifyMentor(path, {
    type: "learning_path_accepted",
    title: "Mentee đã chấp nhận lộ trình",
    body: `${candidate?.name || "Mentee"} đã chấp nhận lộ trình ${updated.totalAmount.toLocaleString("vi-VN")} VND. Lộ trình bắt đầu khi mentee thanh toán trọn gói.`,
  });
  return learningPathDTO(updated);
}

/**
 * Ứng viên yêu cầu sửa: proposed → revision_requested, lưu `revisionNote`.
 * Mentor sửa (PATCH) rồi gửi lại (propose) → version + 1 (LP-07).
 */
export async function requestLearningPathRevision(actor, pathId, body) {
  const path = await loadPathForCandidate(actor, pathId);
  const input = validate(revisionInput, body);
  if (path.status !== "proposed") {
    throw httpError(409, path.status === "revision_requested" ? "Bạn đã gửi yêu cầu sửa, mentor đang chỉnh lại lộ trình." : "Chỉ yêu cầu sửa được khi lộ trình đang chờ bạn phản hồi.");
  }
  const updated = await LearningPath.findOneAndUpdate(
    { _id: path._id, status: "proposed", version: path.version },
    { $set: { status: "revision_requested", revisionNote: input.note } },
    { returnDocument: "after" },
  ).lean();
  if (!updated) throw httpError(409, "Lộ trình vừa đổi trạng thái. Vui lòng tải lại trang.");

  const candidate = await User.findById(path.candidateId).select("name").lean();
  await notifyMentor(path, {
    type: "learning_path_revision_requested",
    title: "Mentee yêu cầu sửa lộ trình",
    body: `${candidate?.name || "Mentee"}: "${input.note.slice(0, 160)}${input.note.length > 160 ? "…" : ""}"`,
  });
  return learningPathDTO(updated);
}
