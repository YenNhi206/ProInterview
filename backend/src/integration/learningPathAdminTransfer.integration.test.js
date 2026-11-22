/**
 * LP-11: admin xác nhận tay chuyển khoản lộ trình trên trang đối soát.
 * Xong khi: admin xác nhận được (API cho trang `/admin/learning-path-payments`).
 * Kèm: tiền đến sau khi mã hết hạn → admin xác nhận ngoại lệ có lý do (đề xuất ghi ở LP-10).
 */
import { before, after, describe, it } from "node:test";
import assert from "node:assert/strict";
import { applyTestEnv, startMongoHarness, stopMongoHarness, mintAccessToken, startHttpServer, stopHttpServer } from "../test_helpers/mongoTestHarness.js";

applyTestEnv();
process.env.MAIL_USER = "";
process.env.MAIL_PASS = "";
process.env.UPSTASH_REDIS_REST_URL = "";
process.env.UPSTASH_REDIS_REST_TOKEN = "";
process.env.SEPAY_WEBHOOK_API_KEY = "lp11-test-webhook";

let harness, http, models, mrService, admin, mentor, seq = 0, userSeq = 0;

const PRICE = 1_200_000;
const files = { cv: [{ originalname: "cv.pdf", buffer: Buffer.from("cv") }], jd: [{ originalname: "jd.txt", buffer: Buffer.from("jd") }] };
const requestFields = { position: "Product Analyst", description: "Muốn có lộ trình luyện phỏng vấn Product Analyst trong 1 tháng.", sessionType: "mock_interview" };
const offerBody = { message: "Tôi sẽ đánh giá tư duy sản phẩm và phân tích số liệu rồi đề xuất lộ trình.", availability: "Tối thứ 6" };
const SESSIONS = [{ title: "Phân tích số liệu sản phẩm", objectives: [], shrmKeys: ["data_driven_decision"] }, { title: "Phỏng vấn thử", objectives: [], shrmKeys: [] }];

const pad = (n) => String(n).padStart(2, "0");
function slot(daysFromNow) {
  seq += 1;
  const d = new Date(Date.now() + 86400000 + daysFromNow * 60_000 + seq * 2 * 3_600_000);
  return { date: `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`, timeSlot: `${pad(d.getHours())}:${pad(d.getMinutes())}` };
}
const actor = (user) => mrService.requestActor(String(user._id));

async function call(user, url, method = "GET", body) {
  const res = await fetch(`${http.baseUrl}${url}`, {
    method,
    headers: { "Content-Type": "application/json", ...(user ? { Authorization: `Bearer ${mintAccessToken(user._id)}` } : {}) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  return { status: res.status, ...(await res.json()) };
}
const list = (status) => call(admin, `/api/admin/payments/learning-path-transfers${status ? `?status=${status}` : ""}`);
const confirm = (paymentId, body = {}, user = admin) => call(user, `/api/admin/payments/${paymentId}/confirm-learning-path-transfer`, "PATCH", body);

async function newMentee() {
  userSeq += 1;
  return models.User.create({ name: `Mentee LP11 ${userSeq}`, email: `lp11-mentee-${userSeq}@test.local`, role: "customer" });
}

/** Lộ trình đã chấp nhận và đã checkout: trả `{ mentee, pathId, payment }`. */
async function checkedOut() {
  const mentee = await newMentee();
  const request = await mrService.createRequest(await actor(mentee), requestFields, files);
  const offered = await mrService.sendOffer(await actor(mentor.user), String(request._id), offerBody);
  await mrService.selectOffer(await actor(mentee), String(request._id), String(offered.offers[0]._id));
  const assessed = await mrService.acceptAssessment(await actor(mentor.user), String(request._id), slot(2));
  await models.Booking.updateOne({ _id: assessed.assessmentBookingId }, { $set: { status: "completed" } });
  const lp = (await call(mentor.user, "/api/learning-paths", "POST", { mentorshipRequestId: String(request._id), totalAmount: PRICE, sessions: SESSIONS })).learningPath;
  assert.equal((await call(mentor.user, `/api/learning-paths/${lp.id}/propose`, "POST")).status, 200);
  assert.equal((await call(mentee, `/api/learning-paths/${lp.id}/accept`, "POST", {})).status, 200);
  const out = await call(mentee, `/api/learning-paths/${lp.id}/checkout`, "POST");
  assert.equal(out.status, 200, out.error);
  return { mentee, pathId: lp.id, payment: out.payment };
}

const pathOf = (id) => models.LearningPath.findById(id).lean();
const paidNotifs = (userId, pathId) => models.Notification.countDocuments({ userId, type: "learning_path_paid", "metadata.learningPathId": pathId });

before(async () => {
  harness = await startMongoHarness();
  models = { ...(await import("../models/index.js")), ...(await import("../models/MentorshipRequest.js")) };
  mrService = await import("../services/mentorshipRequestsService.js");
  await Promise.all(Object.values(models).filter((m) => m?.modelName).map((m) => m.init()));
  admin = await models.User.create({ name: "Admin LP11", email: "lp11-admin@test.local", role: "admin" });
  const user = await models.User.create({ name: "Mentor LP11", email: "lp11-mentor@test.local", role: "mentor" });
  const doc = await models.Mentor.findOneAndUpdate(
    { userId: user._id },
    { $set: { userId: user._id, name: "Mentor LP11", title: "Product Lead", publicId: "lp11-mentor", isActive: true, isVerified: true, available: true, pricePerHour: 300000, sessionTypes: [{ type: "mock_interview", durationMinutes: 60, price: 300000 }] } },
    { upsert: true, returnDocument: "after" },
  );
  mentor = { user, doc };
  http = await startHttpServer((await import("../app.js")).createApp());
});

after(async () => {
  if (http) await stopHttpServer(http.server);
  if (harness) await stopMongoHarness(harness);
});

describe("Danh sách đối soát CK lộ trình (LP-11)", () => {
  it("chỉ admin; hàng chờ có ứng viên, mentor, mã PI, trạng thái báo đã chuyển", async () => {
    const { mentee, pathId, payment } = await checkedOut();
    assert.equal((await call(mentee, "/api/admin/payments/learning-path-transfers")).status, 403);
    assert.equal((await call(mentor.user, `/api/admin/payments/${payment.paymentId}/confirm-learning-path-transfer`, "PATCH", {})).status, 403);
    assert.equal((await call(null, "/api/admin/payments/learning-path-transfers")).status, 401);

    let res = await list("pending");
    assert.equal(res.status, 200, res.error);
    let row = res.payments.find((p) => p.paymentId === payment.paymentId);
    assert.ok(row);
    assert.equal(row.learningPathId, pathId);
    assert.equal(row.orderRef, payment.orderRef);
    assert.equal(row.amount, PRICE);
    assert.equal(row.status, "pending");
    assert.equal(row.candidate.email, mentee.email);
    assert.equal(row.mentor.name, "Mentor LP11");
    assert.equal(row.learningPath.status, "pending_payment");
    assert.ok(res.stats.pendingCount >= 1);

    await call(mentee, `/api/learning-paths/${pathId}/submit-transfer`, "PATCH");
    res = await list();
    row = res.payments.find((p) => p.paymentId === payment.paymentId);
    assert.equal(row.status, "submitted");
    assert.ok(row.submittedAt);
    assert.ok(res.stats.submittedCount >= 1);
  });
});

describe("Admin xác nhận tay (LP-11)", () => {
  it("chưa báo đã chuyển thì phải xác nhận ngoại lệ có lý do; báo rồi thì xác nhận thường được; lộ trình active", async () => {
    const { mentee, pathId, payment } = await checkedOut();
    const noSubmit = await confirm(payment.paymentId, {});
    assert.equal(noSubmit.status, 400);
    assert.match(noSubmit.error, /chưa báo/);

    await call(mentee, `/api/learning-paths/${pathId}/submit-transfer`, "PATCH");
    const ok = await confirm(payment.paymentId, { amount: PRICE });
    assert.equal(ok.status, 200, ok.error);
    assert.equal(ok.learningPath.status, "active");
    assert.equal(ok.payment.status, "success");
    assert.equal(ok.payment.providerResponse.confirmedByUserId, String(admin._id));
    assert.equal((await pathOf(pathId)).status, "active");
    assert.equal(await paidNotifs(mentee._id, pathId), 1);
    assert.equal(await paidNotifs(mentor.user._id, pathId), 1);

    const again = await confirm(payment.paymentId, {});
    assert.equal(again.status, 200);
    assert.equal(again.idempotent, true);
    assert.equal(await paidNotifs(mentee._id, pathId), 1, "bấm lại không gửi thông báo trùng");

    const paid = await list("paid");
    const row = paid.payments.find((p) => p.paymentId === payment.paymentId);
    assert.equal(row.status, "paid");
    assert.equal(row.confirmedVia, "admin");
    assert.equal(row.forceConfirm, false);
    assert.ok(paid.stats.paidTotalAmount >= PRICE);
    assert.equal((await list("pending")).payments.some((p) => p.paymentId === payment.paymentId), false);
  });

  it("xác nhận ngoại lệ: thiếu lý do → 400; số tiền theo sao kê lệch → 400; đủ thì ghi forceNote", async () => {
    const { pathId, payment } = await checkedOut();
    assert.equal((await confirm(payment.paymentId, { force: true })).status, 400);
    assert.equal((await confirm(payment.paymentId, { force: true, forceNote: "ok" })).status, 400);
    assert.equal((await confirm(payment.paymentId, { force: true, forceNote: "Đối chiếu sao kê", amount: PRICE - 10_000 })).status, 400);
    assert.equal((await confirm(payment.paymentId, { force: true, forceNote: "Đối chiếu sao kê", amount: "abc" })).status, 400);
    assert.equal((await pathOf(pathId)).status, "pending_payment");

    const ok = await confirm(payment.paymentId, { force: true, forceNote: "Đối chiếu sao kê VCB 22/11", amount: PRICE });
    assert.equal(ok.status, 200, ok.error);
    assert.equal(ok.payment.providerResponse.forceConfirm, true);
    assert.equal(ok.payment.providerResponse.forceNote, "Đối chiếu sao kê VCB 22/11");
  });

  it("tiền đến sau khi mã hết hạn: hiện ở bộ lọc expired; chỉ xác nhận được dạng ngoại lệ", async () => {
    const { mentee, pathId, payment } = await checkedOut();
    await models.Payment.updateOne({ _id: payment.paymentId }, { $set: { paymentExpiresAt: new Date(Date.now() - 60_000) } });

    // Quá hạn nhưng chưa bị hủy: không còn ở hàng chờ, có ở bộ lọc expired.
    assert.equal((await list("pending")).payments.some((p) => p.paymentId === payment.paymentId), false);
    let expired = await list("expired");
    assert.equal(expired.payments.find((p) => p.paymentId === payment.paymentId)?.status, "expired");

    // Ứng viên mở trang → giao dịch bị hủy vì hết hạn; vẫn nằm ở bộ lọc expired.
    await call(mentee, `/api/payments/transfer-status?orderRef=${payment.orderRef}`);
    assert.equal((await models.Payment.findById(payment.paymentId).lean()).status, "cancelled");
    expired = await list("expired");
    assert.ok(expired.payments.some((p) => p.paymentId === payment.paymentId));

    const normal = await confirm(payment.paymentId, {});
    assert.equal(normal.status, 409);
    assert.match(normal.error, /hết hạn/);
    const forced = await confirm(payment.paymentId, { force: true, forceNote: "Tiền về muộn 5 phút, đã đối chiếu sao kê", amount: PRICE });
    assert.equal(forced.status, 200, forced.error);
    assert.equal(forced.learningPath.status, "active");
    const row = await models.Payment.findById(payment.paymentId).lean();
    assert.equal(row.status, "success");
    assert.equal(row.failureReason, undefined);
    // Đã thanh toán thì không còn ở bộ lọc expired.
    assert.equal((await list("expired")).payments.some((p) => p.paymentId === payment.paymentId), false);
  });

  it("SePay đã tự xác nhận: danh sách đã nhận ghi confirmedVia sepay; admin bấm thêm thì idempotent", async () => {
    const { pathId, payment } = await checkedOut();
    const hook = await fetch(`${http.baseUrl}/api/payments/webhook/sepay`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Apikey lp11-test-webhook" },
      body: JSON.stringify({ id: `lp11-${Date.now()}`, transferType: "in", transferAmount: PRICE, content: payment.orderRef }),
    });
    assert.equal(hook.status, 200);
    assert.equal((await pathOf(pathId)).status, "active");
    const row = (await list("paid")).payments.find((p) => p.paymentId === payment.paymentId);
    assert.equal(row.confirmedVia, "sepay");
    const again = await confirm(payment.paymentId, { force: true, forceNote: "Bấm nhầm" });
    assert.equal(again.status, 200);
    assert.equal(again.idempotent, true);
  });

  it("id sai → 400; giao dịch không phải lộ trình → 404", async () => {
    assert.equal((await confirm("khong-phai-id")).status, 400);
    const other = await models.Payment.create({ userId: admin._id, type: "subscription", referenceId: admin._id, amount: 99_000, provider: "transfer", providerRef: `PI${Date.now()}`, status: "pending" });
    assert.equal((await confirm(String(other._id))).status, 404);
  });
});
