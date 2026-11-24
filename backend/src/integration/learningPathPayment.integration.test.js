/**
 * LP-10: đường ray chuyển khoản cho lộ trình — checkout sinh mã PI, Payment `learning_path`,
 * SePay webhook tự xác nhận → lộ trình `active`; hết hạn qua transferPaymentExpiryService.
 * Xong khi: test đúng tiền, sai tiền, webhook gửi lại 2 lần, hết hạn.
 */
import { before, after, describe, it } from "node:test";
import assert from "node:assert/strict";
import { applyTestEnv, startMongoHarness, stopMongoHarness, mintAccessToken, startHttpServer, stopHttpServer } from "../test_helpers/mongoTestHarness.js";

applyTestEnv();
process.env.MAIL_USER = "";
process.env.MAIL_PASS = "";
process.env.UPSTASH_REDIS_REST_URL = "";
process.env.UPSTASH_REDIS_REST_TOKEN = "";
process.env.SEPAY_WEBHOOK_API_KEY = "lp10-test-webhook";

let harness, http, models, mrService, payService, mentor, seq = 0, userSeq = 0;

const PRICE = 900_000;
const files = { cv: [{ originalname: "cv.pdf", buffer: Buffer.from("cv") }], jd: [{ originalname: "jd.txt", buffer: Buffer.from("jd") }] };
const requestFields = { position: "Data Analyst", description: "Muốn có lộ trình luyện phỏng vấn Data Analyst trong 1 tháng.", sessionType: "mock_interview" };
const offerBody = { message: "Tôi sẽ đánh giá năng lực SQL, phân tích và đề xuất lộ trình phù hợp.", availability: "Tối thứ 4" };
const SESSIONS = [
  { title: "SQL và phân tích dữ liệu", objectives: ["Viết truy vấn JOIN"], shrmKeys: ["technical_learning"] },
  { title: "Trình bày insight", objectives: [], shrmKeys: ["communication"] },
  { title: "Phỏng vấn thử tổng hợp", objectives: [], shrmKeys: [] },
];

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
  const json = await res.json();
  // `body` giữ nguyên JSON: transfer-status có trường `status` riêng (pending/paid/expired).
  return { ...json, status: res.status, body: json };
}
const api = (user, path, method, body) => call(user, `/api/learning-paths${path}`, method, body);

async function webhook(orderRef, amount, id = `lp10-${Math.random()}`) {
  const res = await fetch(`${http.baseUrl}/api/payments/webhook/sepay`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: "Apikey lp10-test-webhook" },
    body: JSON.stringify({ id, transferType: "in", transferAmount: amount, content: `${orderRef} thanh toan lo trinh` }),
  });
  return { status: res.status, id, ...(await res.json()) };
}

async function newMentee() {
  userSeq += 1;
  return models.User.create({ name: `Mentee LP10 ${userSeq}`, email: `lp10-mentee-${userSeq}@test.local`, role: "customer" });
}

/** Lộ trình 3 buổi, 900.000đ, mentee đã chấp nhận (pending_payment). */
async function acceptedPath(mentee) {
  const request = await mrService.createRequest(await actor(mentee), requestFields, files);
  const offered = await mrService.sendOffer(await actor(mentor.user), String(request._id), offerBody);
  await mrService.selectOffer(await actor(mentee), String(request._id), String(offered.offers[0]._id));
  const assessed = await mrService.acceptAssessment(await actor(mentor.user), String(request._id), slot(2));
  await models.Booking.updateOne({ _id: assessed.assessmentBookingId }, { $set: { status: "completed" } });
  const lp = (await api(mentor.user, "", "POST", { mentorshipRequestId: String(request._id), goal: "Đậu Data Analyst", totalAmount: PRICE, sessions: SESSIONS })).learningPath;
  assert.equal((await api(mentor.user, `/${lp.id}/propose`, "POST")).status, 200);
  const accepted = await api(mentee, `/${lp.id}/accept`, "POST", {});
  assert.equal(accepted.status, 200, accepted.error);
  assert.equal(accepted.learningPath.status, "pending_payment");
  return accepted.learningPath;
}

async function checkout(mentee, pathId) {
  const res = await api(mentee, `/${pathId}/checkout`, "POST");
  assert.equal(res.status, 200, res.error);
  return res;
}

const pathOf = (id) => models.LearningPath.findById(id).lean();
const paymentsOf = (id) => models.Payment.find({ type: "learning_path", referenceId: id }).lean();
const notifCount = (userId, pathId) => models.Notification.countDocuments({ userId, type: "learning_path_paid", "metadata.learningPathId": pathId });

before(async () => {
  harness = await startMongoHarness();
  models = { ...(await import("../models/index.js")), ...(await import("../models/MentorshipRequest.js")) };
  mrService = await import("../services/mentorshipRequestsService.js");
  payService = await import("../services/learningPathPaymentService.js");
  await Promise.all(Object.values(models).filter((m) => m?.modelName).map((m) => m.init()));
  const user = await models.User.create({ name: "Mentor LP10", email: "lp10-mentor@test.local", role: "mentor" });
  const doc = await models.Mentor.findOneAndUpdate(
    { userId: user._id },
    { $set: { userId: user._id, name: "Mentor LP10", title: "Data Lead", publicId: "lp10-mentor", isActive: true, isVerified: true, available: true, pricePerHour: 300000, sessionTypes: [{ type: "mock_interview", durationMinutes: 60, price: 300000 }] } },
    { upsert: true, returnDocument: "after" },
  );
  mentor = { user, doc };
  http = await startHttpServer((await import("../app.js")).createApp());
});

after(async () => {
  if (http) await stopHttpServer(http.server);
  if (harness) await stopMongoHarness(harness);
});

describe("Checkout lộ trình (LP-10)", () => {
  it("sinh mã PI, Payment learning_path pending đúng giá trọn gói; bấm lại trả cùng mã", async () => {
    const mentee = await newMentee();
    const lp = await acceptedPath(mentee);
    const first = await checkout(mentee, lp.id);

    assert.match(first.payment.orderRef, /^PI\d{12}$/);
    assert.equal(first.payment.amount, PRICE);
    assert.equal(first.payment.status, "pending");
    assert.ok(first.payment.expiresInMs > 0);
    assert.equal(first.learningPath.paymentRef, first.payment.orderRef);
    assert.equal(first.learningPath.status, "pending_payment");

    const rows = await paymentsOf(lp.id);
    assert.equal(rows.length, 1);
    assert.equal(rows[0].status, "pending");
    assert.equal(rows[0].provider, "transfer");
    assert.equal(rows[0].referenceModel, "LearningPath");
    assert.equal(rows[0].amount, PRICE);
    assert.equal(rows[0].providerRef, first.payment.orderRef);
    assert.equal(String(rows[0].userId), String(mentee._id));

    const again = await checkout(mentee, lp.id);
    assert.equal(again.payment.orderRef, first.payment.orderRef);
    assert.equal(again.payment.paymentExpiresAt, first.payment.paymentExpiresAt, "bấm lại không gia hạn mã đang hiện trên QR");
    assert.equal((await paymentsOf(lp.id)).length, 1);
  });

  it("báo đã chuyển khoản ghi submittedAt, lộ trình vẫn chờ thanh toán", async () => {
    const mentee = await newMentee();
    const lp = await acceptedPath(mentee);
    assert.equal((await api(mentee, `/${lp.id}/submit-transfer`, "PATCH")).status, 404, "chưa checkout thì chưa có giao dịch");
    await checkout(mentee, lp.id);
    const submitted = await api(mentee, `/${lp.id}/submit-transfer`, "PATCH");
    assert.equal(submitted.status, 200, submitted.error);
    assert.equal(submitted.payment.status, "submitted");
    assert.ok((await paymentsOf(lp.id))[0].providerResponse.submittedAt);
    assert.equal((await pathOf(lp.id)).status, "pending_payment");
  });

  it("chặn: chưa chấp nhận, mentor, mentee khác", async () => {
    const mentee = await newMentee();
    const other = await newMentee();
    const lp = await acceptedPath(mentee);
    assert.equal((await api(mentor.user, `/${lp.id}/checkout`, "POST")).status, 403);
    assert.equal((await api(other, `/${lp.id}/checkout`, "POST")).status, 404);
    assert.equal((await api(other, `/${lp.id}/submit-transfer`, "PATCH")).status, 404);

    await models.LearningPath.updateOne({ _id: lp.id }, { $set: { status: "proposed" } });
    const early = await api(mentee, `/${lp.id}/checkout`, "POST");
    assert.equal(early.status, 409);
    assert.equal((await paymentsOf(lp.id)).length, 0);
  });

  it("nhiều lần bấm thanh toán cùng lúc: mọi phản hồi cùng một mã PI, đúng mã của bản ghi Payment duy nhất", async () => {
    // Lặp vài vòng để bắt được các thứ tự xen kẽ khác nhau (lỗi cũ chỉ lộ ra trên CI).
    for (let round = 0; round < 4; round += 1) {
      const mentee = await newMentee();
      const lp = await acceptedPath(mentee);
      const results = await Promise.all(Array.from({ length: 5 }, () => api(mentee, `/${lp.id}/checkout`, "POST")));
      assert.ok(results.every((r) => r.status === 200 || r.status === 409), JSON.stringify(results.map((r) => r.status)));
      const ok = results.filter((r) => r.status === 200);
      assert.ok(ok.length >= 1);
      const rows = await paymentsOf(lp.id);
      assert.equal(rows.length, 1);
      const path = await pathOf(lp.id);
      assert.equal(rows[0].status, "pending");
      assert.equal(rows[0].providerRef, path.paymentRef);
      // Mã trả cho trình duyệt phải là mã SePay sẽ khớp — không được có lần nào nhận mã đã bị thay.
      for (const r of ok) assert.equal(r.payment.orderRef, path.paymentRef, `vòng ${round}`);
    }
  });

  it("lần checkout trước dừng giữa chừng (đã ghi mã vào lộ trình, chưa có Payment): lần sau dùng lại đúng mã đó", async () => {
    const mentee = await newMentee();
    const lp = await acceptedPath(mentee);
    await models.LearningPath.updateOne({ _id: lp.id }, { $set: { paymentRef: "PI123456789012" } });
    const res = await checkout(mentee, lp.id);
    assert.equal(res.payment.orderRef, "PI123456789012");
    const rows = await paymentsOf(lp.id);
    assert.equal(rows.length, 1);
    assert.equal(rows[0].providerRef, "PI123456789012");
    assert.equal((await webhook("PI123456789012", PRICE)).status, 200);
    assert.equal((await pathOf(lp.id)).status, "active");
  });

  it("đang mở lại giao dịch hết hạn (lộ trình đã có mã mới, Payment còn mã cũ): lần sau hoàn tất bằng mã mới", async () => {
    const mentee = await newMentee();
    const lp = await acceptedPath(mentee);
    const first = await checkout(mentee, lp.id);
    await models.Payment.updateOne({ type: "learning_path", referenceId: lp.id }, { $set: { status: "cancelled", failureReason: "payment_timeout" } });
    await models.LearningPath.updateOne({ _id: lp.id }, { $set: { paymentRef: "PI999888777666" } });
    const res = await checkout(mentee, lp.id);
    assert.equal(res.payment.orderRef, "PI999888777666");
    assert.notEqual(res.payment.orderRef, first.payment.orderRef);
    const [row] = await paymentsOf(lp.id);
    assert.equal(row.status, "pending");
    assert.equal(row.providerRef, "PI999888777666");
    // Bấm lại lần nữa: mã còn hạn → trả đúng mã đó, không sinh mã khác.
    assert.equal((await checkout(mentee, lp.id)).payment.orderRef, "PI999888777666");
  });
});

describe("SePay xác nhận lộ trình (LP-10)", () => {
  it("đúng tiền: lộ trình active, Payment success, thông báo cho mentee và mentor, poll trạng thái ra paid", async () => {
    const mentee = await newMentee();
    const lp = await acceptedPath(mentee);
    const { payment } = await checkout(mentee, lp.id);

    const hook = await webhook(payment.orderRef, PRICE);
    assert.equal(hook.status, 200, hook.error);

    const path = await pathOf(lp.id);
    assert.equal(path.status, "active");
    assert.ok(path.paidAt);
    const [row] = await paymentsOf(lp.id);
    assert.equal(row.status, "success");
    assert.ok(row.paidAt);
    assert.equal(row.providerResponse.forceConfirm, true);
    const event = await models.SepayWebhookEvent.findOne({ sepayId: hook.id }).lean();
    assert.equal(event.status, "processed");
    assert.equal(event.entityType, "learning_path");
    assert.equal(event.entityId, lp.id);
    // QA-04: mốc đo đối soát; Payment success nằm giữa lúc webhook đến và lúc ghi processed.
    assert.ok(Number.isFinite(event.processingMs) && event.processingMs >= 0);
    assert.equal(event.processingMs, new Date(event.processedAt) - new Date(event.receivedAt));
    assert.ok(new Date(event.receivedAt) <= new Date(row.paidAt));
    assert.ok(new Date(row.paidAt) <= new Date(event.processedAt));

    assert.equal(await notifCount(mentee._id, lp.id), 1);
    assert.equal(await notifCount(mentor.user._id, lp.id), 1);

    const status = await call(mentee, `/api/payments/transfer-status?orderRef=${payment.orderRef}`);
    assert.equal(status.status, 200, status.error);
    assert.equal(status.body.status, "paid");
    assert.equal(status.entityType, "learning_path");
    assert.equal(status.redirectTo, `/learning-paths/${lp.id}`);
    assert.equal(status.sepayAuto, true);
    // Mã của người khác: không lộ trạng thái.
    assert.equal((await call(await newMentee(), `/api/payments/transfer-status?orderRef=${payment.orderRef}`)).entityType, null);

    const seen = await api(mentee, `/${lp.id}`);
    assert.equal(seen.learningPath.status, "active");
    assert.ok(seen.learningPath.paidAt);
    assert.equal((await api(mentee, `/${lp.id}/checkout`, "POST")).status, 409, "đã trả thì không thanh toán lại");
  });

  it("sai tiền: không khớp, lộ trình vẫn chờ; chuyển đúng tiền sau đó thì kích hoạt", async () => {
    const mentee = await newMentee();
    const lp = await acceptedPath(mentee);
    const { payment } = await checkout(mentee, lp.id);

    for (const amount of [PRICE - 1_000, PRICE + 1_000]) {
      const hook = await webhook(payment.orderRef, amount);
      assert.equal(hook.status, 200);
      const event = await models.SepayWebhookEvent.findOne({ sepayId: hook.id }).lean();
      assert.equal(event.status, "unmatched");
      assert.match(event.resultMessage, /amount mismatch/);
      assert.equal(event.processingMs, undefined, "QA-04 chỉ đo giao dịch đã khớp đơn");
    }
    assert.equal((await pathOf(lp.id)).status, "pending_payment");
    assert.equal((await paymentsOf(lp.id))[0].status, "pending");
    assert.equal(await notifCount(mentee._id, lp.id), 0);

    await webhook(payment.orderRef, PRICE);
    assert.equal((await pathOf(lp.id)).status, "active");
  });

  it("webhook gửi lại 2 lần: chỉ xác nhận một lần, một thông báo", async () => {
    const mentee = await newMentee();
    const lp = await acceptedPath(mentee);
    const { payment } = await checkout(mentee, lp.id);

    const id = `lp10-retry-${Date.now()}`;
    const first = await webhook(payment.orderRef, PRICE, id);
    const second = await webhook(payment.orderRef, PRICE, id);
    assert.equal(first.status, 200);
    assert.equal(second.status, 200);
    // SePay gửi lại cùng giao dịch nhưng khác id (ví dụ ngân hàng báo trùng): không còn đơn chờ → unmatched.
    const replay = await webhook(payment.orderRef, PRICE);
    assert.equal((await models.SepayWebhookEvent.findOne({ sepayId: replay.id }).lean()).status, "unmatched");

    assert.equal(await models.SepayWebhookEvent.countDocuments({ sepayId: id }), 1);
    assert.equal((await models.SepayWebhookEvent.findOne({ sepayId: id }).lean()).status, "processed");
    const rows = await paymentsOf(lp.id);
    assert.equal(rows.length, 1);
    assert.equal(rows[0].status, "success");
    assert.equal((await pathOf(lp.id)).status, "active");
    assert.equal(await notifCount(mentee._id, lp.id), 1);
    assert.equal(await notifCount(mentor.user._id, lp.id), 1);

    // Gọi thẳng hàm xác nhận lần nữa (admin bấm trùng / SePay gọi song song): idempotent.
    const again = await payService.confirmLearningPathTransfer(lp.id, { force: true, forceNote: "Bấm trùng" });
    assert.equal(again.ok, true);
    assert.equal(again.idempotent, true);
    assert.equal(await notifCount(mentee._id, lp.id), 1);
  });

  it("hết hạn: webhook không khớp, Payment cancelled, lộ trình vẫn chờ; thanh toán lại có mã mới", async () => {
    const mentee = await newMentee();
    const lp = await acceptedPath(mentee);
    const { payment: oldPayment } = await checkout(mentee, lp.id);
    await models.Payment.updateOne({ type: "learning_path", referenceId: lp.id }, { $set: { paymentExpiresAt: new Date(Date.now() - 60_000) } });

    const late = await webhook(oldPayment.orderRef, PRICE);
    assert.equal((await models.SepayWebhookEvent.findOne({ sepayId: late.id }).lean()).status, "unmatched");
    assert.equal((await pathOf(lp.id)).status, "pending_payment");

    const polled = await call(mentee, `/api/payments/transfer-status?orderRef=${oldPayment.orderRef}`);
    assert.equal(polled.status, 200);
    assert.equal(polled.entityType, "learning_path");
    assert.equal(polled.body.status, "expired");
    assert.equal(polled.redirectTo, null);
    let [row] = await paymentsOf(lp.id);
    assert.equal(row.status, "cancelled");
    assert.equal(row.failureReason, "payment_timeout");
    assert.equal((await api(mentee, `/${lp.id}/submit-transfer`, "PATCH")).status, 409, "mã hết hạn thì không báo đã chuyển được");

    const renewed = await checkout(mentee, lp.id);
    assert.notEqual(renewed.payment.orderRef, oldPayment.orderRef);
    assert.equal(renewed.payment.status, "pending");
    const rows = await paymentsOf(lp.id);
    assert.equal(rows.length, 1, "dùng lại bản ghi Payment của lộ trình");
    [row] = rows;
    assert.equal(row.status, "pending");
    assert.equal(row.providerRef, renewed.payment.orderRef);
    assert.equal(row.failureReason, undefined);
    assert.ok(new Date(row.paymentExpiresAt) > new Date());

    // Chuyển theo mã cũ vẫn không khớp; mã mới thì kích hoạt.
    const stale = await webhook(oldPayment.orderRef, PRICE);
    assert.equal((await models.SepayWebhookEvent.findOne({ sepayId: stale.id }).lean()).status, "unmatched");
    await webhook(renewed.payment.orderRef, PRICE);
    assert.equal((await pathOf(lp.id)).status, "active");
  });

  it("lịch sử thanh toán tự hủy giao dịch lộ trình quá hạn mà không đổi trạng thái lộ trình", async () => {
    const mentee = await newMentee();
    const lp = await acceptedPath(mentee);
    await checkout(mentee, lp.id);
    await models.Payment.updateOne({ type: "learning_path", referenceId: lp.id }, { $set: { paymentExpiresAt: new Date(Date.now() - 60_000) } });
    const history = await call(mentee, "/api/payments/history?type=learning_path");
    assert.equal(history.status, 200, history.error);
    assert.equal(history.payments.length, 1);
    assert.equal(history.payments[0].type, "learning_path");
    assert.equal(history.payments[0].status, "cancelled");
    assert.equal((await pathOf(lp.id)).status, "pending_payment");
  });

  it("tài khoản ứng viên ngừng hoạt động: giữ tiền để đối soát, không kích hoạt lộ trình", async () => {
    const mentee = await newMentee();
    const lp = await acceptedPath(mentee);
    const { payment } = await checkout(mentee, lp.id);
    await models.User.updateOne({ _id: mentee._id }, { $set: { isActive: false } });

    const hook = await webhook(payment.orderRef, PRICE);
    assert.equal((await models.SepayWebhookEvent.findOne({ sepayId: hook.id }).lean()).status, "held_inactive_account");
    assert.equal((await paymentsOf(lp.id))[0].status, "held_inactive_account");
    assert.equal((await pathOf(lp.id)).status, "pending_payment");
    const confirm = await payService.confirmLearningPathTransfer(lp.id, { force: true, forceNote: "Thử xác nhận" });
    assert.equal(confirm.ok, false);
    assert.equal(confirm.status, 409);
  });
});

describe("Hàm xác nhận dùng cho admin (LP-11)", () => {
  it("không force thì cần ứng viên báo đã chuyển; số tiền lệch bị từ chối", async () => {
    const mentee = await newMentee();
    const lp = await acceptedPath(mentee);
    await checkout(mentee, lp.id);

    const noSubmit = await payService.confirmLearningPathTransfer(lp.id, {});
    assert.equal(noSubmit.ok, false);
    assert.equal(noSubmit.status, 400);
    const shortNote = await payService.confirmLearningPathTransfer(lp.id, { force: true, forceNote: "x" });
    assert.equal(shortNote.status, 400);
    const wrongAmount = await payService.confirmLearningPathTransfer(lp.id, { force: true, forceNote: "Đối soát tay", amount: PRICE - 1 });
    assert.equal(wrongAmount.status, 400);
    assert.equal((await pathOf(lp.id)).status, "pending_payment");

    await api(mentee, `/${lp.id}/submit-transfer`, "PATCH");
    const confirmed = await payService.confirmLearningPathTransfer(lp.id, { adminUserId: String(mentor.user._id) });
    assert.equal(confirmed.ok, true, confirmed.error);
    assert.equal(confirmed.learningPath.status, "active");
    assert.equal((await paymentsOf(lp.id))[0].providerResponse.forceConfirm, false);
  });

  it("lần trước ghi Payment success nhưng chưa kích hoạt lộ trình: gọi lại thì hoàn tất", async () => {
    const mentee = await newMentee();
    const lp = await acceptedPath(mentee);
    await checkout(mentee, lp.id);
    await models.Payment.updateOne({ type: "learning_path", referenceId: lp.id }, { $set: { status: "success", paidAt: new Date() } });
    const resumed = await payService.confirmLearningPathTransfer(lp.id, { force: true, forceNote: "Chạy lại sau lỗi" });
    assert.equal(resumed.ok, true, resumed.error);
    assert.equal((await pathOf(lp.id)).status, "active");
    assert.equal(await notifCount(mentee._id, lp.id), 1);
  });
});
