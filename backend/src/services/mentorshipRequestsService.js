import mongoose from "mongoose";
import { readOwnedDocument } from "./mentorshipDocumentsService.js";
import Joi from "joi";
import { MentorshipRequest } from "../models/MentorshipRequest.js";
import { Mentor } from "../models/Mentor.js";
import { User } from "../models/User.js";
import { Booking } from "../models/Booking.js";
import { httpError } from "../utils/apiErrors.js";

const text = max => Joi.string().trim().max(max).required();
const requestInput = Joi.object({ title: Joi.string().trim().min(5).max(160).allow(""), position: text(160), description: text(4000).min(20), sessionType: Joi.string().valid("mock_interview", "cv_review", "career_consulting").required(), availability: Joi.string().trim().max(500).allow("").default(""), budget: Joi.number().integer().min(0).max(100000000).empty("").allow(null).default(null), cvSource: Joi.string().max(80).allow(""), jdSource: Joi.string().max(80).allow("") });
const offerInput = Joi.object({ message: text(3000).min(20), availability: text(500) });
function validate(schema, value) {
  const result = schema.validate(value, { abortEarly: true });
  if (result.error) throw httpError(400, "Thông tin chưa hợp lệ. Kiểm tra độ dài nội dung, loại buổi và ngân sách.");
  return result.value;
}
function id(value) { if (!mongoose.isValidObjectId(value)) throw httpError(400, "Mã yêu cầu không hợp lệ."); return value; }
export async function requestActor(userId) {
  const user = await User.findById(userId).select("role isActive").lean();
  if (!user || user.isActive === false) throw httpError(403, "Tài khoản không khả dụng.");
  if (user.role === "customer") return { userId: String(userId), mentor: null };
  if (user.role === "mentor") {
    const mentor = await Mentor.findOne({ userId, isActive: true, isVerified: true }).lean();
    if (mentor) return { userId: String(userId), mentor };
  }
  throw httpError(403, "Tính năng dành cho mentee và Mentor đã được duyệt.");
}
function requireMentee(actor) { if (actor.mentor) throw httpError(403, "Chỉ mentee được đăng hoặc chọn đề nghị."); }
function requireMentor(actor) { if (!actor.mentor) throw httpError(403, "Chỉ Mentor đã được duyệt được gửi đề nghị."); }
export async function loadRequest(requestId) {
  const request = await MentorshipRequest.findById(id(requestId)).lean();
  if (!request) throw httpError(404, "Không tìm thấy yêu cầu.");
  return request;
}
function own(request, actor) { return String(request.userId) === actor.userId; }
function canRead(request, actor) { return own(request, actor) || (actor.mentor && (request.status === "open" || request.offers.some(o => String(o.mentorId) === String(actor.mentor._id)))); }
export async function requestDTO(request, actor) {
  if (!canRead(request, actor)) throw httpError(404, "Không tìm thấy yêu cầu.");
  const owner = own(request, actor);
  const offers = owner ? request.offers : request.offers.filter(o => String(o.mentorId) === String(actor.mentor?._id));
  const mentors = await Mentor.find({ _id: { $in: offers.map(o => o.mentorId) } }).select("name publicId title pricePerHour").lean();
  const byId = new Map(mentors.map(m => [String(m._id), m]));
  const canDownload = owner || String(request.selectedMentorId) === String(actor.mentor?._id);
  const bookings = owner || canDownload ? await Booking.find({ mentorshipRequestId: request._id, status: { $nin: ["cancelled", "no_show"] } }).select("_id status").lean() : [];
  return {
    id: String(request._id), title: request.title, position: request.position, description: request.description,
    sessionType: request.sessionType, availability: request.availability, budget: request.budget,
    status: request.status, createdAt: request.createdAt, offerCount: owner ? request.offers.filter(o => o.status === "pending").length : undefined,
    selectedOfferId: request.selectedOfferId ? String(request.selectedOfferId) : "", canDownload,
    cvName: canDownload ? request.cvName : "", jdName: canDownload ? request.jdName : "",
    bookingId: bookings[0]?._id ? String(bookings[0]._id) : "",
    offers: offers.map(o => { const m = byId.get(String(o.mentorId)); return { id: String(o._id), mentorId: String(o.mentorId), mentorPublicId: m?.publicId || String(o.mentorId), mentorName: m?.name || "Mentor", mentorTitle: m?.title || "", message: o.message, availability: o.availability, priceEstimate: o.priceEstimate, status: o.status, createdAt: o.createdAt }; }),
  };
}
export async function listRequests(actor, scope) {
  let filter;
  if (actor.mentor) filter = scope === "mine" ? { "offers.mentorId": actor.mentor._id } : { status: "open" };
  else filter = { userId: actor.userId };
  const rows = await MentorshipRequest.find(filter).sort({ createdAt: -1 }).limit(100).lean();
  return Promise.all(rows.map(row => requestDTO(row, actor)));
}
export async function createRequest(actor, body, files) {
  requireMentee(actor);
  const { cvSource, jdSource, ...input } = validate(requestInput, body);
  if (!input.title) {
    const label = { mock_interview: "Phỏng vấn thử", cv_review: "Review CV", career_consulting: "Tư vấn nghề nghiệp" }[input.sessionType];
    input.title = `${label} · ${input.position}`.slice(0, 160);
  }
  if ((cvSource && files?.cv?.[0]) || (jdSource && files?.jd?.[0])) throw httpError(400, "Mỗi tài liệu chỉ chọn một nguồn: tệp cũ hoặc tải mới.");
  if ((!cvSource && !files?.cv?.[0]) || (!jdSource && !files?.jd?.[0])) throw httpError(400, "Cần đính kèm cả CV và JD.");
  if (await MentorshipRequest.countDocuments({ userId: actor.userId, status: "open" }) >= 10) throw httpError(400, "Bạn có thể có tối đa 10 yêu cầu đang mở.");
  const [cv, jd] = await Promise.all([cvSource ? readOwnedDocument(actor.userId, cvSource, "cv") : files.cv[0], jdSource ? readOwnedDocument(actor.userId, jdSource, "jd") : files.jd[0]]);
  if ([cv, jd].some(file => !file.buffer?.length || file.buffer.length > 5 * 1024 * 1024)) throw httpError(400, "Tài liệu phải có nội dung và không vượt quá 5MB mỗi file.");
  const request = await MentorshipRequest.create({ ...input, userId: actor.userId, cvName: cv.originalname.slice(0, 240), jdName: jd.originalname.slice(0, 240), cvData: cv.buffer, jdData: jd.buffer });
  // Never pass file buffers to serialization.
  return loadRequest(String(request._id));
}
export async function sendOffer(actor, requestId, body) {
  requireMentor(actor);
  const input = validate(offerInput, body);
  const request = await loadRequest(requestId);
  if (own(request, actor)) throw httpError(403, "Không thể gửi đề nghị cho chính mình.");
  const session = actor.mentor.sessionTypes?.find(s => s.type === request.sessionType);
  const priceEstimate = session?.price > 0 ? session.price : actor.mentor.pricePerHour;
  const updated = await MentorshipRequest.findOneAndUpdate({ _id: request._id, status: "open", "offers.mentorId": { $ne: actor.mentor._id }, "offers.49": { $exists: false } }, { $push: { offers: { mentorId: actor.mentor._id, ...input, priceEstimate } } }, { returnDocument: "after", runValidators: true }).lean();
  if (!updated) throw httpError(409, "Yêu cầu đã đóng, đã đủ đề nghị hoặc bạn đã gửi đề nghị trước đó.");
  return updated;
}
export async function selectOffer(actor, requestId, offerId) {
  requireMentee(actor); id(offerId);
  const original = await loadRequest(requestId);
  const selected = original.offers.find(o => String(o._id) === offerId);
  if (!selected) throw httpError(404, "Không tìm thấy đề nghị.");
  const mentor = await Mentor.findOne({ _id: selected.mentorId, isActive: true, isVerified: true });
  if (!mentor) throw httpError(409, "Mentor không còn khả dụng.");
  const updated = await MentorshipRequest.findOneAndUpdate({ _id: id(requestId), userId: actor.userId, status: "open", offers: { $elemMatch: { _id: offerId, status: "pending" } } }, { $set: { status: "selected", selectedOfferId: offerId, selectedMentorId: selected.mentorId } }, { returnDocument: "after" }).lean();
  if (!updated) throw httpError(409, "Yêu cầu không còn mở hoặc đề nghị không khả dụng.");

  return loadRequest(requestId);
}
export async function closeRequest(actor, requestId) {
  requireMentee(actor);
  const row = await MentorshipRequest.findOneAndUpdate({ _id: id(requestId), userId: actor.userId, status: "open" }, { $set: { status: "closed" } }, { returnDocument: "after" }).lean();
  if (!row) throw httpError(409, "Chỉ có thể đóng yêu cầu đang mở của bạn.");
  return row;
}
export async function withdrawOffer(actor, requestId, offerId) {
  requireMentor(actor); id(offerId);
  const row = await MentorshipRequest.findOneAndUpdate({ _id: id(requestId), status: "open", offers: { $elemMatch: { _id: offerId, mentorId: actor.mentor._id, status: "pending" } } }, { $set: { "offers.$.status": "withdrawn" } }, { returnDocument: "after" }).lean();
  if (!row) throw httpError(409, "Không thể rút đề nghị đã được chọn hoặc không thuộc về bạn.");
  return row;
}
export async function getRequestFile(actor, requestId, kind) {
  if (!["cv", "jd"].includes(kind)) throw httpError(404, "Không tìm thấy tài liệu.");
  const request = await loadRequest(requestId);
  const selected = request.offers.find(o => String(o._id) === String(request.selectedOfferId));
  if (!own(request, actor) && (!actor.mentor || String(selected?.mentorId) !== String(actor.mentor._id))) throw httpError(403, "CV/JD chỉ được chia sẻ với Mentor được chọn.");
  const file = await MentorshipRequest.findById(request._id).select(`+${kind}Data`);
  return { name: file[`${kind}Name`], data: file[`${kind}Data`] };
}
export async function resolveRequestBooking(userId, requestId, mentor) {
  const row = await loadRequest(requestId);
  const offer = row.offers.find(o => String(o._id) === String(row.selectedOfferId));
  if (String(row.userId) !== String(userId) || row.status !== "selected" || !offer || String(offer.mentorId) !== String(mentor._id)) throw httpError(403, "Yêu cầu chưa chọn Mentor này hoặc không thuộc về bạn.");
  return row;
}
