// ProInterview — Database script (MongoDB / mongosh)
// Cập nhật: 2026-11-01 · nguồn: backend/src/models/*.js · ERD: docs/LOGICAL_ERD.md
//
// Chạy:
//   mongosh "mongodb://127.0.0.1:27017/prointerview" docs/database/prointerview_schema.mongodb.js
//   VALIDATION_ACTION=error mongosh "<uri>" docs/database/prointerview_schema.mongodb.js
//
// - Idempotent: collection đã có thì chỉ cập nhật validator (collMod) và tạo index còn thiếu.
// - Không xóa, không sửa dữ liệu.
// - Mặc định validationAction = "warn" để không chặn ghi nếu DB cũ lệch schema; đặt
//   VALIDATION_ACTION=error khi tạo DB mới.
// - Validator chỉ khóa các trường bắt buộc và enum cấp cao nhất. Ràng buộc chi tiết (min/max,
//   sub-document, default) vẫn do Mongoose đảm nhiệm — model là nguồn sự thật.
// - Khi sửa model: cập nhật file này + docs/LOGICAL_ERD.md cùng lúc.

const VALIDATION_ACTION = (typeof process !== "undefined" && process.env.VALIDATION_ACTION) || "warn";

const oid = { bsonType: "objectId" };
const oidOrNull = { bsonType: ["objectId", "null"] };
const str = { bsonType: "string" };
const num = { bsonType: ["double", "int", "long", "decimal"] };
const bool = { bsonType: "bool" };
const date = { bsonType: "date" };
const en = (...values) => ({ enum: values });

function ensureCollection(name, { required = [], properties = {} } = {}, indexes = []) {
  const validator = { $jsonSchema: { bsonType: "object", required, properties } };
  const exists = db.getCollectionNames().includes(name);
  if (exists) {
    db.runCommand({ collMod: name, validator, validationLevel: "moderate", validationAction: VALIDATION_ACTION });
  } else {
    db.createCollection(name, { validator, validationLevel: "moderate", validationAction: VALIDATION_ACTION });
  }
  for (const [keys, options = {}] of indexes) {
    db.getCollection(name).createIndex(keys, options);
  }
  print(`${exists ? "~" : "+"} ${name} (${indexes.length} index)`);
}

// ─────────────────────────────────────────────────────────────
// A. Tài khoản · Mentor · Đặt lịch · Tài chính
// ─────────────────────────────────────────────────────────────

ensureCollection("users", {
  required: ["name", "email"],
  properties: {
    name: str,
    email: str,
    role: en("customer", "mentor", "admin", "moderator", "enterprise"),
    plan: en("free", "starter_pro", "elite_pro", "professional", "pro", "basic", "premium"),
    gender: en("male", "female", "other", ""),
    tokenVersion: num,
    isActive: bool,
    isEmailVerified: bool,
  },
}, [
  [{ email: 1 }, { unique: true }],
  [{ supabaseId: 1 }, { unique: true, sparse: true }],
  [{ googleId: 1 }, { unique: true, sparse: true }],
  [{ googleSub: 1 }, { unique: true, sparse: true }],
  [{ role: 1 }],
  [{ plan: 1 }],
]);

ensureCollection("mentors", {
  required: ["name", "title", "company", "pricePerHour"],
  properties: {
    userId: oid,
    publicId: str,
    pricePerHour: num,
    status: en("active", "suspended", "closed"),
    isVerified: bool,
  },
}, [
  [{ userId: 1 }, { unique: true, sparse: true }],
  [{ publicId: 1 }, { unique: true, sparse: true }],
  [{ fields: 1 }],
  [{ "stats.rating": -1 }],
  [{ pricePerHour: 1 }],
  [{ available: 1 }],
]);

ensureCollection("subscriptions", {
  required: ["userId"],
  properties: {
    userId: oid,
    plan: en("free", "starter_pro", "elite_pro"),
    billingCycle: en("monthly", "yearly", ""),
  },
}, [
  [{ userId: 1 }, { unique: true }],
]);

ensureCollection("mentorship_requests", {
  required: ["userId", "title", "position", "description", "sessionType", "cvName", "jdName", "cvData", "jdData"],
  properties: {
    userId: oid,
    sessionType: en("mock_interview", "cv_review", "career_consulting"),
    status: en("open", "selected", "closed"),
    selectedMentorId: oid,
    cvData: { bsonType: "binData" },
    jdData: { bsonType: "binData" },
  },
}, [
  [{ userId: 1, createdAt: -1 }],
  [{ status: 1, createdAt: -1 }],
  [{ "offers.mentorId": 1, createdAt: -1 }],
]);

const ACTIVE_BOOKING = ["pending", "confirmed", "in_progress"];

ensureCollection("bookings", {
  required: ["userId", "mentorId", "date", "timeSlot", "durationMinutes", "sessionType", "price", "platformFee", "vat", "totalAmount"],
  properties: {
    userId: oid,
    mentorId: oid,
    mentorshipRequestId: oid,
    date: str,
    timeSlot: str,
    durationMinutes: num,
    sessionType: en("mock_interview", "cv_review", "career_consulting", "custom"),
    status: en("pending", "confirmed", "in_progress", "completed", "cancelled", "rescheduled", "no_show"),
    price: num,
    platformFee: num,
    vat: num,
    totalAmount: num,
    paymentStatus: en("pending", "paid", "refund_pending", "refunded", "partial_refund", "failed"),
    paymentMethod: en("momo", "zalopay", "vnpay", "card", "transfer", ""),
    cancelledBy: en("user", "mentor", "system", ""),
    mentorCancelResolution: en("", "awaiting_user", "late_cancel_refund", "no_show_refund", "reschedule", "change_mentor", "refund"),
    rebookCreditStatus: en("", "available", "consumed"),
  },
}, [
  [{ userId: 1, status: 1 }],
  [{ mentorId: 1, date: 1 }],
  [{ status: 1 }],
  // Chống đặt trùng slot khi booking còn hiệu lực
  [{ mentorId: 1, date: 1, timeSlot: 1 }, { unique: true, partialFilterExpression: { status: { $in: ACTIVE_BOOKING } } }],
  // Mỗi mentorship request chỉ sinh một booking còn hiệu lực
  [{ mentorshipRequestId: 1 }, {
    unique: true,
    partialFilterExpression: {
      mentorshipRequestId: { $type: "objectId" },
      status: { $in: ["pending", "confirmed", "in_progress", "completed", "rescheduled"] },
    },
  }],
  // Mã chuyển khoản không trùng khi đang chờ thanh toán
  [{ paymentRef: 1 }, { unique: true, partialFilterExpression: { paymentRef: { $gt: "" }, paymentStatus: "pending" } }],
]);

ensureCollection("mentor_knowledge", {
  required: ["bookingId", "mentorId", "mentorUserId"],
  properties: { bookingId: oid, mentorId: oid, mentorUserId: oid },
}, [
  [{ bookingId: 1 }, { unique: true }],
  [{ mentorId: 1, createdAt: -1 }],
  [{ field: 1 }],
  [{ menteeRole: 1 }],
]);

ensureCollection("payments", {
  required: ["userId", "type", "referenceId", "amount", "provider"],
  properties: {
    userId: oid,
    type: en("booking", "subscription", "course"),
    referenceId: oid,
    referenceModel: en("Booking", "Subscription", "Enrollment"),
    amount: num,
    provider: en("momo", "zalopay", "vnpay", "card", "transfer"),
    status: en("pending", "success", "failed", "refund_pending", "refunded", "partial_refund", "cancelled", "held_inactive_account"),
  },
}, [
  [{ userId: 1 }],
  [{ referenceId: 1 }],
  [{ providerRef: 1 }, { unique: true, sparse: true }],
  [{ provider: 1, type: 1, referenceId: 1 }, { unique: true, sparse: true }],
]);

ensureCollection("payout_requests", {
  required: ["mentorId", "amount", "payoutAccount"],
  properties: {
    mentorId: oid,
    amount: num,
    status: en("pending", "approved", "rejected", "processing", "paid"),
    reviewedBy: oidOrNull,
  },
}, [
  [{ mentorId: 1 }],
  [{ status: 1 }],
  [{ requestedAt: 1 }],
  [{ mentorId: 1, status: 1, createdAt: -1 }],
]);

ensureCollection("coupons", {
  required: ["code", "discountValue"],
  properties: {
    code: str,
    discountType: en("percent", "fixed"),
    discountValue: num,
    isActive: bool,
  },
}, [
  [{ code: 1 }, { unique: true }],
]);

ensureCollection("sepaywebhookevents", {
  required: ["sepayId"],
  properties: {
    sepayId: str,
    status: en("received", "processed", "ignored", "unmatched", "failed", "held_inactive_account"),
  },
}, [
  [{ sepayId: 1 }, { unique: true }],
]);

// ─────────────────────────────────────────────────────────────
// B. Khóa học · Giỏ hàng · Đánh giá
// ─────────────────────────────────────────────────────────────

ensureCollection("courses", {
  required: ["mentorId", "title", "level"],
  properties: {
    mentorId: oid,
    title: str,
    level: en("basic", "intermediate", "advanced"),
    status: en("draft", "pending_review", "pending_update", "published", "archived"),
    price: num,
    isFree: bool,
  },
}, [
  [{ mentorId: 1 }],
  [{ status: 1, level: 1 }],
  [{ tags: 1 }],
  [{ "modules.lessons._id": 1 }],
]);

ensureCollection("enrollments", {
  required: ["userId", "courseId"],
  properties: {
    userId: oid,
    courseId: oid,
    cartOrderId: oid,
    paymentStatus: en("pending", "paid"),
    progressPercent: num,
  },
}, [
  [{ userId: 1, courseId: 1 }, { unique: true }],
  [{ paymentRef: 1 }, { unique: true, partialFilterExpression: { paymentRef: { $gt: "" }, paymentStatus: "pending" } }],
]);

ensureCollection("carts", {
  required: ["userId"],
  properties: { userId: oid, courseIds: { bsonType: "array", items: oid } },
}, [
  [{ userId: 1 }, { unique: true }],
]);

ensureCollection("cart_orders", {
  required: ["userId", "orderRef", "items", "totalAmount", "paymentExpiresAt"],
  properties: {
    userId: oid,
    orderRef: str,
    items: {
      bsonType: "array",
      minItems: 1,
      items: { bsonType: "object", required: ["courseId", "enrollmentId", "title", "originalPrice", "price", "platformFeeRate", "platformFee"] },
    },
    totalAmount: num,
    status: en("preparing", "pending", "paid", "expired"),
    active: bool,
  },
}, [
  [{ orderRef: 1 }, { unique: true }],
  // Mỗi user chỉ có một đơn đang mở
  [{ userId: 1 }, { unique: true, partialFilterExpression: { active: true } }],
]);

ensureCollection("courseqas", {
  required: ["courseId", "lessonId", "userId", "question"],
  properties: { courseId: oid, lessonId: oid, userId: oid, question: str },
}, [
  [{ courseId: 1, lessonId: 1, createdAt: -1 }],
  [{ userId: 1 }],
]);

ensureCollection("mentorpeerreviews", {
  required: ["reviewerId", "courseId", "contentRating", "qualityRating", "priceValueRating"],
  properties: {
    reviewerId: oid,
    courseId: oid,
    contentRating: { bsonType: ["int", "double"], minimum: 1, maximum: 5 },
    qualityRating: { bsonType: ["int", "double"], minimum: 1, maximum: 5 },
    priceValueRating: { bsonType: ["int", "double"], minimum: 1, maximum: 5 },
  },
}, [
  [{ reviewerId: 1 }],
  [{ courseId: 1 }],
  [{ reviewerId: 1, courseId: 1 }, { unique: true }],
]);

ensureCollection("reviews", {
  required: ["userId", "targetType", "targetId", "rating"],
  properties: {
    userId: oid,
    targetType: en("mentor", "course"),
    targetId: oid,
    bookingId: oid,
    rating: { bsonType: ["int", "double"], minimum: 1, maximum: 5 },
  },
}, [
  [{ targetType: 1, targetId: 1 }],
  [{ userId: 1, targetType: 1, targetId: 1 }, { unique: true }],
]);

// ─────────────────────────────────────────────────────────────
// C. AI · Kiểm duyệt (Moderator HITL)
// ─────────────────────────────────────────────────────────────

ensureCollection("cv_analyses", {
  required: ["userId", "cvFileName", "mode", "tier", "status"],
  properties: {
    userId: oid,
    mode: en("jd", "field"),
    tier: en("suggestions", "full", "basic"),
    status: en("processing", "completed", "failed", "legacy_mock"),
    planAtTime: en("free", "pro", "enterprise"),
  },
}, [
  [{ userId: 1 }],
  [{ mode: 1 }],
  [{ status: 1 }],
  [{ userId: 1, createdAt: -1 }],
  [{ userId: 1, status: 1 }],
  [{ userId: 1, mode: 1, createdAt: -1 }],
  [{ status: 1, createdAt: 1 }],
]);

ensureCollection("interview_sessions", {
  required: ["userId", "hrGender"],
  properties: {
    userId: oid,
    hrGender: en("male", "female"),
    questionsAllowed: num,
    status: en("in_progress", "completed", "abandoned"),
    questions: { bsonType: "array" },
    answers: { bsonType: "array" },
  },
}, [
  [{ userId: 1, createdAt: -1 }],
  [{ status: 1 }],
  [{ shareToken: 1 }],
  [{ "competencyProfile.roleCategory": 1, status: 1, createdAt: -1 }],
  [{ "competencyProfile.competencyIds": 1, status: 1 }],
]);

ensureCollection("question_bank", {
  required: ["text", "source", "status", "textHash"],
  properties: {
    text: str,
    textHash: str,
    language: en("vi", "en"),
    layer: en("theory", "project", "behavior"),
    seniority: en("intern", "junior", "middle", "senior"),
    source: en("baseline", "llm_followup", "moderator", "org_template", "ai_generated", "moderator_authored", "enterprise_template"),
    status: en("draft", "pending_review", "approved", "rejected", "deprecated"),
    orgId: oidOrNull,
  },
}, [
  [{ competencyId: 1 }],
  [{ roleCategory: 1 }],
  [{ source: 1 }],
  [{ orgId: 1 }],
  [{ status: 1 }],
  [{ textHash: 1 }],
  [{ status: 1, createdAt: 1 }],
  [{ status: 1, competencyId: 1, updatedAt: -1 }],
  [{ status: 1, orgId: 1, roleCategory: 1, competencyId: 1 }],
  [{ textHash: 1, orgId: 1 }, { unique: true }],
  [{ flagCount: -1 }],
]);

ensureCollection("reports", {
  required: ["reportedBy", "targetType", "targetId"],
  properties: {
    reportedBy: oid,
    targetType: en("mentor", "booking", "review", "course", "interview_question", "interview_evaluation"),
    targetId: oid,
    reason: en("late", "unprofessional", "inappropriate", "no_show", "fraud", "other", null),
    reasonCode: en("irrelevant", "inaccurate_scoring", "hallucination", "offensive", "other", null),
    status: en("pending", "reviewing", "resolved", "dismissed"),
  },
}, [
  // Mỗi user báo cáo một câu hỏi/đánh giá AI một lần
  [{ reportedBy: 1, targetType: 1, targetId: 1, questionIndex: 1 }, {
    unique: true,
    partialFilterExpression: { questionIndex: { $type: "number" } },
  }],
]);

ensureCollection("moderation_items", {
  required: ["type"],
  properties: {
    type: en("question_report", "evaluation_report", "evaluation_incomplete"),
    status: en("open", "in_review", "resolved", "dismissed"),
    priority: en("low", "normal", "high"),
    priorityRank: num,
    assignee: oidOrNull,
  },
}, [
  [{ status: 1, priorityRank: -1, createdAt: 1 }],
  [{ "refs.reportId": 1 }, { unique: true, partialFilterExpression: { "refs.reportId": { $type: "objectId" } } }],
  [{ type: 1, "refs.sessionId": 1, "refs.questionIndex": 1 }, {
    unique: true,
    partialFilterExpression: { type: "evaluation_incomplete" },
  }],
]);

// ─────────────────────────────────────────────────────────────
// D. Thông báo · Nhật ký · Vận hành
// ─────────────────────────────────────────────────────────────

ensureCollection("notifications", {
  required: ["userId", "type", "title", "body"],
  properties: {
    userId: oid,
    type: en(
      "booking_confirmed", "booking_cancelled", "booking_reminder", "booking_completed",
      "new_review", "new_booking_request", "payment_success", "payment_failed",
      "plan_upgraded", "plan_expiring", "course_enrolled", "course_completed",
      "certificate_ready", "feedback", "system",
    ),
    isRead: bool,
  },
}, [
  [{ userId: 1, isRead: 1, createdAt: -1 }],
]);

ensureCollection("activities", {
  required: ["userId", "type", "description"],
  properties: {
    userId: oid,
    type: en(
      "interview_completed", "cv_analyzed", "booking_created", "booking_completed",
      "course_enrolled", "course_completed", "plan_upgraded", "review_submitted",
    ),
  },
}, [
  [{ userId: 1, createdAt: -1 }],
]);

ensureCollection("user_events", {
  required: ["userId", "type", "route"],
  properties: { userId: oid, type: en("page_view", "action"), route: str },
}, [
  [{ userId: 1 }],
  [{ userId: 1, createdAt: -1 }],
  [{ type: 1, route: 1, createdAt: -1 }],
  [{ createdAt: -1 }],
]);

ensureCollection("securitylogs", {
  required: ["type"],
  properties: {
    userId: oid,
    type: en("prompt_injection_attempt", "rate_limit_hit", "suspicious_output", "admin_action"),
  },
}, [
  [{ userId: 1 }],
  [{ sessionId: 1 }],
  [{ createdAt: -1 }],
  [{ userId: 1, type: 1, createdAt: -1 }],
]);

ensureCollection("costevents", {
  required: ["kind"],
  properties: { kind: str, costUsd: num, costVnd: num, fromCache: bool },
}, [
  [{ kind: 1 }],
  [{ tags: 1 }],
  [{ createdAt: 1 }],
  [{ kind: 1, createdAt: 1 }],
]);

ensureCollection("achievements", {
  required: ["title", "content"],
  properties: {
    title: str,
    content: str,
    category: en("Tin tức", "Hoạt động", "Sự kiện"),
    isPublished: bool,
  },
}, [
  [{ isPublished: 1, date: -1 }],
]);

print(`Xong: 28 collection · validationAction=${VALIDATION_ACTION}`);
