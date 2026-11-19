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
import { httpError } from "../utils/apiErrors.js";
import { resolveBookingPlatformFeeRate } from "./mentorCommissionService.js";
import { deliverNotification } from "./notificationDeliveryService.js";

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
  const sessions = await LearningPathSession.find({ pathId: path._id }).sort({ order: 1, attempt: 1 }).lean();
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
    createdAt: path.createdAt,
    updatedAt: path.updatedAt,
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
