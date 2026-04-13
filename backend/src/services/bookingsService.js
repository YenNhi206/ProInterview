import mongoose from "mongoose";
import { Booking } from "../models/Booking.js";
import { Mentor } from "../models/Mentor.js";
import { User } from "../models/User.js";
import { ensureMentorProfilesForAllMentorUsers } from "./mentorProfileService.js";
const MONGO_ERR = "MongoDB chưa kết nối. Kiểm tra MONGO_URI trong .env.";

function isMongoReady() {
  return mongoose.connection.readyState === 1;
}

function parseFeeRate(envVal, fallback) {
  const n = Number(String(envVal ?? "").trim());
  if (!Number.isFinite(n) || n < 0 || n > 1) return fallback;
  return n;
}

/** Chuẩn hóa chuỗi ngày từ Booking.jsx (vd. "Thứ 4, 01/03" hoặc "01/03/2026"). */
export function normalizeBookingDate(raw) {
  if (typeof raw !== "string") return "";
  const s = raw.trim();
  if (!s) return "";
  const tail = s.includes(",") ? s.split(",").pop().trim() : s;
  const parts = tail.split("/").map((p) => p.trim());
  if (parts.length === 3) return `${parts[0].padStart(2, "0")}/${parts[1].padStart(2, "0")}/${parts[2]}`;
  if (parts.length === 2) return `${parts[0].padStart(2, "0")}/${parts[1].padStart(2, "0")}`;
  return tail;
}

function buildNotes(body) {
  const direct = typeof body.notes === "string" ? body.notes.trim() : "";
  if (direct) return direct.slice(0, 8000);

  const parts = [];
  const position = typeof body.position === "string" ? body.position.trim() : "";
  const note = typeof body.note === "string" ? body.note.trim() : "";
  const cvFile = typeof body.cvFile === "string" ? body.cvFile.trim() : "";
  const jdFile = typeof body.jdFile === "string" ? body.jdFile.trim() : "";

  if (position) parts.push(`Vị trí ứng tuyển: ${position}`);
  if (note) parts.push(`Ghi chú: ${note}`);
  if (cvFile) parts.push(`CV: ${cvFile}`);
  if (jdFile) parts.push(`JD: ${jdFile}`);
  return parts.join("\n").slice(0, 8000);
}

function mapPaymentMethod(method) {
  const m = String(method ?? "").toLowerCase();
  if (m === "momo") return "momo";
  if (m === "zalopay") return "zalopay";
  if (m === "visa" || m === "card") return "card";
  if (m === "vnpay" || m === "transfer") return "transfer";
  return "card";
}

const SESSION_TYPES = new Set(["mock_interview", "cv_review", "career_consulting", "custom"]);

/**
 * @param {string} userId - JWT sub (User _id)
 * @param {object} body - Khớp payload từ Booking.jsx / Checkout
 */
export async function createBooking(userId, body) {
  if (!isMongoReady()) {
    return { ok: false, status: 503, error: MONGO_ERR };
  }

  const uid = typeof userId === "string" ? userId.trim() : "";
  if (!uid || !mongoose.isValidObjectId(uid)) {
    return { ok: false, status: 401, error: "Phiên đăng nhập không hợp lệ." };
  }

  const user = await User.findById(uid).lean();
  if (!user) {
    return { ok: false, status: 401, error: "Không tìm thấy người dùng." };
  }

  const mentorKey = typeof body.mentorId === "string" ? body.mentorId.trim() : "";
  if (!mentorKey) {
    return { ok: false, status: 400, error: "Thiếu mentorId." };
  }

  await ensureMentorProfilesForAllMentorUsers().catch((e) =>
    console.error("[createBooking] ensureMentorProfilesForAllMentorUsers:", e?.message || e),
  );

  const or = [{ publicId: mentorKey }];
  if (mongoose.isValidObjectId(mentorKey)) or.push({ _id: mentorKey });

  const mentor = await Mentor.findOne({ $or: or }).lean();
  if (!mentor) {
    return { ok: false, status: 404, error: "Không tìm thấy mentor." };
  }
  if (mentor.available === false) {
    return { ok: false, status: 400, error: "Mentor hiện không nhận booking." };
  }
  if (mentor.isActive === false) {
    return { ok: false, status: 400, error: "Mentor hiện không nhận booking." };
  }
  if (!mentor.userId) {
    return { ok: false, status: 404, error: "Mentor chưa có tài khoản đăng nhập — không thể đặt lịch." };
  }
  const mentorAccount = await User.findById(mentor.userId).select("role isActive").lean();
  if (!mentorAccount || mentorAccount.role !== "mentor" || mentorAccount.isActive === false) {
    return { ok: false, status: 404, error: "Mentor không khả dụng để đặt lịch." };
  }

  const timeSlot = String(body.timeSlot ?? body.time ?? "").trim();
  if (!timeSlot || !/^\d{1,2}:\d{2}$/.test(timeSlot)) {
    return { ok: false, status: 400, error: "Thiếu hoặc sai định dạng timeSlot (vd. 09:00)." };
  }
  const [th, tm] = timeSlot.split(":").map(Number);
  const timeNormalized = `${String(th).padStart(2, "0")}:${String(tm || 0).padStart(2, "0")}`;

  const rawDate = typeof body.date === "string" ? body.date.trim() : "";
  if (!rawDate) {
    return { ok: false, status: 400, error: "Thiếu date." };
  }
  const dateNormalized = normalizeBookingDate(rawDate);

  let sessionType = typeof body.sessionType === "string" ? body.sessionType.trim() : "mock_interview";
  if (!SESSION_TYPES.has(sessionType)) sessionType = "mock_interview";

  const durationMinutes =
    Number.isFinite(Number(body.durationMinutes)) && Number(body.durationMinutes) > 0
      ? Math.min(480, Math.round(Number(body.durationMinutes)))
      : 60;

  let basePrice = Number(mentor.pricePerHour);
  const st = Array.isArray(mentor.sessionTypes)
    ? mentor.sessionTypes.find((x) => x && x.type === sessionType)
    : null;
  if (st && typeof st.price === "number" && st.price > 0) basePrice = st.price;

  const bodyPrice = Number(body.price);
  if (Number.isFinite(bodyPrice) && bodyPrice > 0 && basePrice > 0) {
    const drift = Math.abs(bodyPrice - basePrice) / basePrice;
    if (drift > 0.05) {
      return {
        ok: false,
        status: 400,
        error: "Giá gửi lên không khớp với mentor. Vui lòng tải lại trang đặt lịch.",
      };
    }
  }

  const platformRate = parseFeeRate(process.env.BOOKING_PLATFORM_FEE_RATE, 0.15);
  const vatRate = parseFeeRate(process.env.BOOKING_VAT_RATE, 0.1);

  const price = Math.round(basePrice);
  const platformFee = Math.round(price * platformRate);
  const vat = Math.round(price * vatRate);
  const totalAmount = price + vat;

  const dup = await Booking.findOne({
    mentorId: mentor._id,
    date: dateNormalized,
    timeSlot: timeNormalized,
    status: { $in: ["pending", "confirmed", "in_progress"] },
  })
    .select("_id")
    .lean();
  if (dup) {
    return { ok: false, status: 409, error: "Khung giờ này đã được đặt. Chọn giờ khác." };
  }

  const paymentStatusRaw = String(body.paymentStatus ?? "pending").toLowerCase();
  const paymentStatus = paymentStatusRaw === "paid" ? "paid" : "pending";

  let status = "pending";
  if (paymentStatus === "paid") {
    status = "confirmed";
  }

  const meetingLink = typeof body.meetingLink === "string" ? body.meetingLink.trim().slice(0, 2000) : "";
  const timezone =
    typeof body.timezone === "string" && body.timezone.trim()
      ? body.timezone.trim()
      : "Asia/Ho_Chi_Minh";

  const paymentRef =
    typeof body.orderNum === "string"
      ? body.orderNum.trim().slice(0, 120)
      : typeof body.paymentRef === "string"
        ? body.paymentRef.trim().slice(0, 120)
        : "";

  const doc = await Booking.create({
    userId: uid,
    mentorId: mentor._id,
    date: dateNormalized,
    timeSlot: timeNormalized,
    durationMinutes,
    timezone,
    sessionType,
    notes: buildNotes(body),
    meetingLink,
    status,
    price,
    platformFee,
    vat,
    totalAmount,
    paymentStatus,
    paymentMethod: mapPaymentMethod(body.paymentMethod ?? body.method),
    paymentRef,
    paidAt: paymentStatus === "paid" ? new Date() : undefined,
  });

  return {
    ok: true,
    booking: toPublicBooking(doc, mentor),
  };
}

/**
 * @param {object} doc - Mongoose doc hoặc plain (populate mentorId tuỳ chọn)
 * @param {object | null} mentorLean - mentor plain khi create (chưa populate)
 */
export function toPublicBooking(doc, mentorLean) {
  const b = doc.toObject ? doc.toObject() : { ...doc };
  const m =
    mentorLean && typeof mentorLean === "object"
      ? mentorLean
      : b.mentorId && typeof b.mentorId === "object" && "name" in b.mentorId
        ? b.mentorId
        : null;
  const mentorPublicId =
    m?.publicId ?? (m?._id ? String(m._id) : mongoose.isValidObjectId(b.mentorId) ? String(b.mentorId) : "");
  return {
    id: String(b._id),
    userId: String(b.userId),
    mentorId: mentorPublicId,
    mentorName: m?.name ?? "",
    mentorTitle: m?.title ?? "",
    mentorCompany: m?.company ?? "",
    mentorAvatar: m?.avatar ?? "",
    date: b.date,
    timeSlot: b.timeSlot,
    durationMinutes: b.durationMinutes,
    timezone: b.timezone,
    sessionType: b.sessionType,
    notes: b.notes,
    meetingLink: b.meetingLink ?? "",
    status: b.status,
    price: b.price,
    platformFee: b.platformFee,
    vat: b.vat,
    totalAmount: b.totalAmount,
    paymentStatus: b.paymentStatus,
    paymentMethod: b.paymentMethod,
    paymentRef: b.paymentRef ?? "",
    rescheduleHistory: Array.isArray(b.rescheduleHistory) ? b.rescheduleHistory : [],
    cancelReason: b.cancelReason ?? "",
    cancelledBy: b.cancelledBy ?? "",
    cancelledAt: b.cancelledAt,
    createdAt: b.createdAt,
    updatedAt: b.updatedAt,
  };
}

function bookingQueryForUser(rawId) {
  const id = typeof rawId === "string" ? rawId.trim() : "";
  if (!id) return null;
  if (mongoose.isValidObjectId(id)) return { _id: id };
  return { paymentRef: id };
}

async function getMentorByUserId(userId) {
  const uid = String(userId ?? "").trim();
  if (!mongoose.isValidObjectId(uid)) return null;
  return Mentor.findOne({ userId: uid }).lean();
}

export async function listMyBookings(userId) {
  if (!isMongoReady()) return { ok: false, status: 503, error: MONGO_ERR };
  const uid = String(userId).trim();
  if (!mongoose.isValidObjectId(uid)) return { ok: false, status: 401, error: "Phiên đăng nhập không hợp lệ." };

  const rows = await Booking.find({ userId: uid })
    .sort({ createdAt: -1 })
    .populate({ path: "mentorId", select: "name title company avatar publicId" })
    .lean();

  return { ok: true, bookings: rows.map((row) => toPublicBooking(row)) };
}

export async function listMentorBookings(mentorUserId) {
  if (!isMongoReady()) return { ok: false, status: 503, error: MONGO_ERR };
  const mentor = await getMentorByUserId(mentorUserId);
  if (!mentor?._id) {
    return { ok: false, status: 404, error: "Không tìm thấy hồ sơ mentor." };
  }
  const rows = await Booking.find({ mentorId: mentor._id })
    .sort({ createdAt: -1 })
    .populate({ path: "mentorId", select: "name title company avatar publicId" })
    .lean();
  return { ok: true, bookings: rows.map((row) => toPublicBooking(row)) };
}

export async function getMyBooking(userId, rawId) {
  if (!isMongoReady()) return { ok: false, status: 503, error: MONGO_ERR };
  const uid = String(userId).trim();
  const q = bookingQueryForUser(rawId);
  if (!q) return { ok: false, status: 400, error: "Thiếu id booking." };

  const row = await Booking.findOne({ userId: uid, ...q })
    .populate({ path: "mentorId", select: "name title company avatar publicId" })
    .lean();
  if (!row) return { ok: false, status: 404, error: "Không tìm thấy booking." };
  return { ok: true, booking: toPublicBooking(row) };
}

export async function confirmMentorBooking(mentorUserId, rawId) {
  if (!isMongoReady()) return { ok: false, status: 503, error: MONGO_ERR };
  const mentor = await getMentorByUserId(mentorUserId);
  if (!mentor?._id) return { ok: false, status: 404, error: "Không tìm thấy hồ sơ mentor." };
  if (!mongoose.isValidObjectId(rawId)) return { ok: false, status: 400, error: "id booking không hợp lệ." };

  const booking = await Booking.findOne({ _id: rawId, mentorId: mentor._id });
  if (!booking) return { ok: false, status: 404, error: "Không tìm thấy booking." };

  if (booking.status === "cancelled") {
    return { ok: false, status: 400, error: "Booking đã bị hủy." };
  }
  if (booking.status === "completed") {
    return { ok: false, status: 400, error: "Booking đã hoàn thành." };
  }

  booking.status = "confirmed";
  await booking.save();
  return { ok: true, booking: toPublicBooking(booking, mentor) };
}

export async function completeMentorBooking(mentorUserId, rawId) {
  if (!isMongoReady()) return { ok: false, status: 503, error: MONGO_ERR };
  const mentor = await getMentorByUserId(mentorUserId);
  if (!mentor?._id) return { ok: false, status: 404, error: "Không tìm thấy hồ sơ mentor." };
  if (!mongoose.isValidObjectId(rawId)) return { ok: false, status: 400, error: "id booking không hợp lệ." };

  const booking = await Booking.findOne({ _id: rawId, mentorId: mentor._id });
  if (!booking) return { ok: false, status: 404, error: "Không tìm thấy booking." };

  if (booking.status === "cancelled") {
    return { ok: false, status: 400, error: "Booking đã bị hủy." };
  }
  if (booking.status === "completed") {
    return { ok: false, status: 400, error: "Booking đã hoàn thành." };
  }

  booking.status = "completed";
  booking.completedAt = new Date();
  await booking.save();
  return { ok: true, booking: toPublicBooking(booking, mentor) };
}

export async function updateMentorNotes(mentorUserId, rawId, body) {
  if (!isMongoReady()) return { ok: false, status: 503, error: MONGO_ERR };
  const mentor = await getMentorByUserId(mentorUserId);
  if (!mentor?._id) return { ok: false, status: 404, error: "Không tìm thấy hồ sơ mentor." };
  if (!mongoose.isValidObjectId(rawId)) return { ok: false, status: 400, error: "id booking không hợp lệ." };

  const notes = typeof body?.notes === "string" ? body.notes.trim().slice(0, 8000) : "";
  if (!notes) return { ok: false, status: 400, error: "Thiếu notes." };

  const booking = await Booking.findOne({ _id: rawId, mentorId: mentor._id });
  if (!booking) return { ok: false, status: 404, error: "Không tìm thấy booking." };

  booking.mentorNotes = notes;
  await booking.save();
  return { ok: true, booking: toPublicBooking(booking, mentor) };
}

export async function cancelMyBooking(userId, rawId, body) {
  if (!isMongoReady()) return { ok: false, status: 503, error: MONGO_ERR };
  const uid = String(userId).trim();
  const q = bookingQueryForUser(rawId);
  if (!q) return { ok: false, status: 400, error: "Thiếu id booking." };

  const reason = typeof body?.reason === "string" ? body.reason.trim().slice(0, 2000) : "";

  const booking = await Booking.findOne({ userId: uid, ...q });
  if (!booking) return { ok: false, status: 404, error: "Không tìm thấy booking." };

  if (["cancelled", "completed", "no_show"].includes(booking.status)) {
    return { ok: false, status: 400, error: "Không thể hủy booking ở trạng thái này." };
  }

  booking.status = "cancelled";
  booking.cancelledBy = "user";
  booking.cancelReason = reason || "Người dùng hủy";
  booking.cancelledAt = new Date();
  await booking.save();

  const mentor = await Mentor.findById(booking.mentorId).lean();
  return { ok: true, booking: toPublicBooking(booking, mentor) };
}

export async function rescheduleMyBooking(userId, rawId, body) {
  if (!isMongoReady()) return { ok: false, status: 503, error: MONGO_ERR };
  const uid = String(userId).trim();
  const q = bookingQueryForUser(rawId);
  if (!q) return { ok: false, status: 400, error: "Thiếu id booking." };

  const newDateRaw = typeof body?.newDate === "string" ? body.newDate.trim() : "";
  const newTime = String(body?.newTimeSlot ?? body?.newTime ?? "").trim();
  const reason = typeof body?.reason === "string" ? body.reason.trim().slice(0, 2000) : "";
  const changedBy = body?.changedBy === "mentor" ? "mentor" : "user";

  if (!newDateRaw || !newTime || !/^\d{1,2}:\d{2}$/.test(newTime)) {
    return { ok: false, status: 400, error: "Thiếu newDate hoặc newTimeSlot (HH:mm)." };
  }

  const booking = await Booking.findOne({ userId: uid, ...q });
  if (!booking) return { ok: false, status: 404, error: "Không tìm thấy booking." };

  if (["cancelled", "completed", "no_show"].includes(booking.status)) {
    return { ok: false, status: 400, error: "Không thể đổi lịch booking ở trạng thái này." };
  }

  const newDateNorm = normalizeBookingDate(newDateRaw);
  const [th, tm] = newTime.split(":").map(Number);
  const newSlot = `${String(th).padStart(2, "0")}:${String(tm || 0).padStart(2, "0")}`;

  const dup = await Booking.findOne({
    mentorId: booking.mentorId,
    date: newDateNorm,
    timeSlot: newSlot,
    status: { $in: ["pending", "confirmed", "in_progress"] },
    _id: { $ne: booking._id },
  })
    .select("_id")
    .lean();
  if (dup) {
    return { ok: false, status: 409, error: "Khung giờ mới đã có người đặt." };
  }

  const entry = {
    oldDate: booking.date,
    oldTimeSlot: booking.timeSlot,
    newDate: newDateNorm,
    newTimeSlot: newSlot,
    reason,
    changedBy,
    changedAt: new Date(),
  };
  booking.rescheduleHistory = [...(booking.rescheduleHistory || []), entry];
  booking.date = newDateNorm;
  booking.timeSlot = newSlot;
  if (booking.status !== "pending") booking.status = "confirmed";
  await booking.save();

  const mentor = await Mentor.findById(booking.mentorId).lean();
  return { ok: true, booking: toPublicBooking(booking, mentor) };
}
