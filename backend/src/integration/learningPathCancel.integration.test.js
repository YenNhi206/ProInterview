/**
 * LP-15 (A-04): admin hủy lộ trình đang học, hoàn = T − tổng phần chia các buổi gốc đã học, qua luồng hoàn tiền
 * có sẵn (Payment `refund_pending` → admin xác nhận đã chuyển khoản).
 * Xong khi: test hủy sau buổi 1 và sau buổi học lại; không hoàn trùng.
 */
import { before, after, describe, it } from "node:test";
import assert from "node:assert/strict";
import { applyTestEnv, startMongoHarness, stopMongoHarness, mintAccessToken, startHttpServer, stopHttpServer } from "../test_helpers/mongoTestHarness.js";
import { planLearningPathMoney } from "../utils/learningPathMoney.js";

applyTestEnv();
process.env.MAIL_USER = "";
process.env.MAIL_PASS = "";
process.env.UPSTASH_REDIS_REST_URL = "";
process.env.UPSTASH_REDIS_REST_TOKEN = "";
process.env.SEPAY_WEBHOOK_API_KEY = "lp15-test-webhook";

const RATE = 0.2;
const TOTAL = 900_000;
const files = { cv: [{ originalname: "cv.pdf", buffer: Buffer.from("cv") }], jd: [{ originalname: "jd.txt", buffer: Buffer.from("jd") }] };
const requestFields = { position: "Data Analyst", description: "Muốn có lộ trình luyện phỏng vấn Data Analyst trong 1 tháng.", sessionType: "mock_interview" };
const offerBody = { message: "Tôi sẽ đánh giá năng lực SQL, phân tích và đề xuất lộ trình phù hợp.", availability: "Tối thứ 4" };
const SESSIONS = [
  { title: "SQL", objectives: [], shrmKeys: ["technical_learning"] },
  { title: "Insight", objectives: [], shrmKeys: ["communication"] },
  { title: "Tổng hợp", objectives: [], shrmKeys: [] },
];
const PLAN = planLearningPathMoney(TOTAL, SESSIONS.length, RATE); // 300.000 mỗi buổi, phí 60.000
const PASS = { outcome: "passed", feedback: { summary: "Trả lời rõ ràng, có số liệu cụ thể." } };
const FAIL = { outcome: "not_passed", feedback: { summary: "Còn thiếu ví dụ cụ thể.", improvements: ["Luyện thêm"] } };
const REASON = "Ứng viên chuyển công tác, xin dừng lộ trình.";

let harness, http, models, mrService, admin, mentor, seq = 0, personSeq = 0;

const pad = (n) => String(n).padStart(2, "0");
function slot() {
  seq += 1;
  const d = new Date(Date.now() + 86400000 + seq * 2 * 3_600_000);
  return { date: `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`, timeSlot: `${pad(d.getHours())}:${pad(d.getMinutes())}` };
}
function pastSlot() {
  seq += 1;
  const d = new Date(Date.now() - (seq + 1) * 3 * 3_600_000);
  return { date: `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`, timeSlot: `${pad(d.getHours())}:${pad(d.getMinutes())}` };
}
const actor = (user) => mrService.requestActor(String(user._id));

async function call(user, url, method = "GET", body) {
  const res = await fetch(`${http.baseUrl}${url}`, {
    method,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${mintAccessToken(user._id)}` },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  return { status: res.status, ...(await res.json()) };
}
const lpApi = (user, path, method, body) => call(user, `/api/learning-paths${path}`, method, body);
const byOrder = (path, order, attempt = 1) => path.sessions.find((s) => s.order === order && s.attempt === attempt);
const finance = async () => (await models.Mentor.findById(mentor.doc._id).lean()).finance || {};
const cancel = (pathId, reason = REASON, user = admin) => call(user, `/api/admin/learning-paths/${pathId}/cancel`, "POST", { reason });
const paymentOf = (pathId) => models.Payment.findOne({ type: "learning_path", referenceId: pathId }).lean();

async function newMentee() {
  personSeq += 1;
  return models.User.create({ name: `Mentee LP15 ${personSeq}`, email: `lp15-mentee-${personSeq}@test.local`, role: "customer" });
}

/** Lộ trình 3 buổi 900.000đ đã thanh toán qua SePay (`active`). */
async function activePath(mentee) {
  const request = await mrService.createRequest(await actor(mentee), requestFields, files);
  const offered = await mrService.sendOffer(await actor(mentor.user), String(request._id), offerBody);
  await mrService.selectOffer(await actor(mentee), String(request._id), String(offered.offers[0]._id));
  const assessed = await mrService.acceptAssessment(await actor(mentor.user), String(request._id), slot());
  await models.Booking.updateOne({ _id: assessed.assessmentBookingId }, { $set: { status: "completed" } });
  const lp = (await lpApi(mentor.user, "", "POST", { mentorshipRequestId: String(request._id), goal: "Đậu Data Analyst", totalAmount: TOTAL, sessions: SESSIONS })).learningPath;
  assert.equal((await lpApi(mentor.user, `/${lp.id}/propose`, "POST")).status, 200);
  assert.equal((await lpApi(mentee, `/${lp.id}/accept`, "POST", {})).status, 200);
  const checkout = await lpApi(mentee, `/${lp.id}/checkout`, "POST");
  const hook = await fetch(`${http.baseUrl}/api/payments/webhook/sepay`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: "Apikey lp15-test-webhook" },
    body: JSON.stringify({ id: `lp15-${lp.id}`, transferType: "in", transferAmount: TOTAL, content: `${checkout.payment.orderRef} thanh toan` }),
  });
  assert.equal(hook.status, 200);
  return (await lpApi(mentee, `/${lp.id}`)).learningPath;
}

async function schedule(mentee, pathId, session) {
  const res = await lpApi(mentee, `/${pathId}/sessions/${session.id}/schedule`, "POST", slot());
  assert.equal(res.status, 201, res.error);
  return res.booking.id;
}
async function complete(bookingId) {
  await models.Booking.updateOne({ _id: bookingId }, { $set: pastSlot() });
  const res = await call(mentor.user, `/api/bookings/${bookingId}/complete`, "PATCH");
  assert.equal(res.status, 200, JSON.stringify(res));
}
async function attend(mentee, pathId, session, outcome) {
  await complete(await schedule(mentee, pathId, session));
  const rec = await lpApi(mentor.user, `/${pathId}/sessions/${session.id}/outcome`, "PATCH", outcome);
  assert.equal(rec.status, 200, rec.error);
  return rec.learningPath;
}

before(async () => {
  harness = await startMongoHarness();
  models = { ...(await import("../models/index.js")), ...(await import("../models/MentorshipRequest.js")) };
  mrService = await import("../services/mentorshipRequestsService.js");
  await Promise.all(Object.values(models).filter((m) => m?.modelName).map((m) => m.init()));
  admin = await models.User.create({ name: "Admin LP15", email: "lp15-admin@test.local", role: "admin" });
  const user = await models.User.create({ name: "Mentor LP15", email: "lp15-mentor@test.local", role: "mentor" });
  const doc = await models.Mentor.findOneAndUpdate(
    { userId: user._id },
    { $set: { userId: user._id, name: "Mentor LP15", title: "Data Lead", publicId: "lp15-mentor", isActive: true, isVerified: true, available: true, pricePerHour: 300000, pricing: { platformFeeRate: RATE }, sessionTypes: [{ type: "mock_interview", durationMinutes: 60, price: 300000 }] } },
    { upsert: true, returnDocument: "after" },
  );
  mentor = { user, doc };
  http = await startHttpServer((await import("../app.js")).createApp());
});

after(async () => {
  if (http) await stopHttpServer(http.server);
  if (harness) await stopMongoHarness(harness);
});

describe("LP-15 — hủy sau buổi 1", () => {
  it("hoàn T − phần buổi 1; buổi 2 đã đặt bị hủy; mentor giữ thu nhập buổi 1; xác nhận hoàn 1 lần", async () => {
    const mentee = await newMentee();
    let lp = await activePath(mentee);
    lp = await attend(mentee, lp.id, byOrder(lp, 1), PASS);
    const s2Booking = await schedule(mentee, lp.id, byOrder(lp, 2));
    const earnedBefore = (await finance()).totalEarned;

    const preview = await call(admin, `/api/admin/learning-paths/${lp.id}/cancel-preview`);
    assert.equal(preview.status, 200, preview.error);
    assert.equal(preview.preview.refundAmount, TOTAL - PLAN[0].shareAmount);
    assert.equal(preview.preview.openBookings, 1);

    const res = await cancel(lp.id);
    assert.equal(res.status, 200, res.error);
    assert.equal(res.refundAmount, TOTAL - PLAN[0].shareAmount);
    assert.equal(res.learningPath.status, "cancelled");

    const payment = await paymentOf(lp.id);
    assert.equal(payment.status, "refund_pending");
    assert.equal(payment.refundAmount, 600_000);
    assert.equal((await models.Booking.findById(s2Booking).lean()).status, "cancelled");
    const sessions = await models.LearningPathSession.find({ pathId: lp.id }).lean();
    assert.equal(sessions.find((s) => s.order === 1).status, "done");
    assert.ok(sessions.filter((s) => s.order !== 1).every((s) => s.status === "cancelled"));
    assert.equal((await finance()).totalEarned, earnedBefore, "mentor giữ phần đã nhận, không bị trừ");
    assert.equal(await models.Notification.countDocuments({ userId: mentee._id, type: "learning_path_cancelled" }), 1);

    // Không hoàn trùng: hủy lại → 409; xác nhận hoàn 2 lần → lần 2 bị chặn.
    assert.equal((await cancel(lp.id)).status, 409);
    const confirm = await call(admin, `/api/admin/payments/${payment._id}/confirm-learning-path-refund`, "PATCH", { transferRef: "FT2611240001" });
    assert.equal(confirm.status, 200, confirm.error);
    assert.equal(confirm.payment.status, "partial_refund");
    assert.equal(confirm.payment.refundAmount, 600_000);
    assert.equal((await call(admin, `/api/admin/payments/${payment._id}/confirm-learning-path-refund`, "PATCH", { transferRef: "FT2611240002" })).status, 409);
    assert.equal((await paymentOf(lp.id)).providerResponse.refundTransferRef, "FT2611240001");

    // Báo cáo tài chính: giữ 300.000, phí chỉ của buổi đã học (60.000).
    const fin = await call(admin, "/api/admin/finance/platform-summary");
    assert.equal(fin.platformFinance.learningPath.grossCollected, 300_000);
    assert.equal(fin.platformFinance.learningPath.platformRevenue, PLAN[0].platformFee);
  });
});

describe("LP-15 — hủy sau buổi học lại", () => {
  it("buổi 1 đạt, buổi 2 không đạt + học lại 0đ đạt → hoàn T − (buổi 1 + buổi 2); buổi học lại không trừ tiền hoàn", async () => {
    const mentee = await newMentee();
    let lp = await activePath(mentee);
    lp = await attend(mentee, lp.id, byOrder(lp, 1), PASS);
    lp = await attend(mentee, lp.id, byOrder(lp, 2), FAIL);
    lp = await attend(mentee, lp.id, byOrder(lp, 2, 2), PASS);

    const res = await cancel(lp.id);
    assert.equal(res.status, 200, res.error);
    assert.equal(res.refundAmount, TOTAL - PLAN[0].shareAmount - PLAN[1].shareAmount);
    assert.equal((await paymentOf(lp.id)).refundAmount, 300_000);
  });

  it("buổi đã học xong (booking completed) nhưng mentor chưa ghi kết quả vẫn tính là đã học", async () => {
    const mentee = await newMentee();
    const lp = await activePath(mentee);
    await complete(await schedule(mentee, lp.id, byOrder(lp, 1)));
    const res = await cancel(lp.id);
    assert.equal(res.status, 200, res.error);
    assert.equal(res.refundAmount, TOTAL - PLAN[0].shareAmount);
  });
});

describe("LP-15 — không hoàn trùng và kiểm tra quyền", () => {
  it("hai admin bấm hủy cùng lúc: chỉ một lần thành công, một Payment chờ hoàn", async () => {
    const mentee = await newMentee();
    const lp = await activePath(mentee);
    const results = await Promise.all([cancel(lp.id), cancel(lp.id)]);
    assert.deepEqual(results.map((r) => r.status).sort(), [200, 409]);
    const payments = await models.Payment.find({ type: "learning_path", referenceId: lp.id }).lean();
    assert.equal(payments.length, 1);
    assert.equal(payments[0].refundAmount, TOTAL, "chưa học buổi nào → hoàn toàn bộ");

    const confirm = await call(admin, `/api/admin/payments/${payments[0]._id}/confirm-learning-path-refund`, "PATCH", { transferRef: "FT2611240003" });
    assert.equal(confirm.payment.status, "refunded");
  });

  it("lý do quá ngắn → 400; người không phải admin → 403; lộ trình chưa thanh toán → 409", async () => {
    const mentee = await newMentee();
    const lp = await activePath(mentee);
    assert.equal((await cancel(lp.id, "ok")).status, 400);
    assert.equal((await cancel(lp.id, REASON, mentee)).status, 403);
    assert.equal((await cancel(lp.id, REASON, mentor.user)).status, 403);
    assert.equal((await models.LearningPath.findById(lp.id).lean()).status, "active");

    await models.LearningPath.updateOne({ _id: lp.id }, { $set: { status: "pending_payment" } });
    assert.equal((await cancel(lp.id)).status, 409);
    assert.equal((await call(admin, "/api/admin/learning-paths/abc/cancel", "POST", { reason: REASON })).status, 400);
  });

  it("danh sách đối soát có tab refund kèm số tiền hoàn", async () => {
    const res = await call(admin, "/api/admin/payments/learning-path-transfers?status=refund");
    assert.equal(res.status, 200, res.error);
    assert.ok(res.payments.length >= 1);
    assert.ok(res.payments.every((p) => ["refund_pending", "partial_refund", "refunded"].includes(p.status)));
    assert.ok(res.payments.every((p) => p.refundAmount > 0));
    assert.equal(typeof res.stats.refundPendingCount, "number");
  });
});
