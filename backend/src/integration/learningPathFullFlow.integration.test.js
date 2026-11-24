/**
 * LP-17 (C-07, M-04, M-06): test integration trọn luồng Learning Path, từ yêu cầu mentor đến lộ trình `completed`,
 * đúng cổng GĐ 1 trong docs/plan/TASKS.md:
 *   yêu cầu → mentor gửi đề nghị → ứng viên chọn → buổi đánh giá 0đ → mentor soạn lộ trình 3 buổi →
 *   ứng viên yêu cầu sửa → mentor gửi lại (version 2) → chấp nhận → checkout → SePay tự xác nhận →
 *   buổi 1 đạt → buổi 2 không đạt → học lại miễn phí → đạt → buổi 3 đạt → `completed`;
 *   5 booking cùng một yêu cầu không lỗi; mentor nhận `share − platformFee` mỗi buổi gốc, 0 cho buổi 0đ và học lại.
 * Mỗi bước đi qua API thật (trừ tạo yêu cầu / đề nghị / chọn mentor gọi service vì cần upload file).
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
process.env.SEPAY_WEBHOOK_API_KEY = "lp17-test-webhook";

const RATE = 0.2;
const FIRST_TOTAL = 1_000_000;
const TOTAL = 900_000; // giá sau khi mentor sửa theo yêu cầu của ứng viên
const files = { cv: [{ originalname: "cv.pdf", buffer: Buffer.from("cv") }], jd: [{ originalname: "jd.txt", buffer: Buffer.from("jd") }] };
const requestFields = { position: "Data Analyst", description: "Muốn có lộ trình luyện phỏng vấn Data Analyst trong 1 tháng.", sessionType: "mock_interview" };
const offerBody = { message: "Tôi sẽ đánh giá năng lực SQL, phân tích và đề xuất lộ trình phù hợp.", availability: "Tối thứ 4" };
const SESSIONS = [
  { title: "SQL và phân tích dữ liệu", objectives: ["Viết truy vấn JOIN"], shrmKeys: ["technical_learning"] },
  { title: "Trình bày insight", objectives: [], shrmKeys: ["communication"] },
  { title: "Phỏng vấn thử tổng hợp", objectives: [], shrmKeys: [] },
];
const PLAN = planLearningPathMoney(TOTAL, SESSIONS.length, RATE); // 300.000 mỗi buổi, phí 60.000
const PASS = { outcome: "passed", feedback: { summary: "Trả lời rõ ràng, có số liệu cụ thể." } };
const FAIL = { outcome: "not_passed", feedback: { summary: "Còn thiếu ví dụ cụ thể.", improvements: ["Luyện thêm phần trình bày insight"] } };

let harness, http, models, mrService, mentee, mentor, seq = 0;

const pad = (n) => String(n).padStart(2, "0");
/** Khung giờ tương lai, mỗi lần khác nhau và cách nhau 2 giờ (ứng viên không bị chồng giờ). */
function slot() {
  seq += 1;
  const d = new Date(Date.now() + 86400000 + seq * 2 * 3_600_000);
  return { date: `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`, timeSlot: `${pad(d.getHours())}:${pad(d.getMinutes())}` };
}
/** Dời buổi về quá khứ để mentor được bấm kết thúc buổi. */
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
const getPath = async (id) => (await lpApi(mentee, `/${id}`)).learningPath;
const byOrder = (path, order, attempt = 1) => path.sessions.find((s) => s.order === order && s.attempt === attempt);
const finance = async () => (await models.Mentor.findById(mentor.doc._id).lean()).finance || {};

async function mentorCompletes(bookingId) {
  await models.Booking.updateOne({ _id: bookingId }, { $set: pastSlot() });
  const res = await call(mentor.user, `/api/bookings/${bookingId}/complete`, "PATCH");
  assert.equal(res.status, 200, JSON.stringify(res));
  return models.Booking.findById(bookingId).lean();
}

/** Ứng viên đặt lịch buổi, mentor kết thúc buổi rồi ghi kết quả. */
async function attend(pathId, session, outcome) {
  const scheduled = await lpApi(mentee, `/${pathId}/sessions/${session.id}/schedule`, "POST", slot());
  assert.equal(scheduled.status, 201, scheduled.error);
  const booking = await mentorCompletes(scheduled.booking.id);
  const rec = await lpApi(mentor.user, `/${pathId}/sessions/${session.id}/outcome`, "PATCH", outcome);
  assert.equal(rec.status, 200, rec.error);
  return { booking, result: rec };
}

before(async () => {
  harness = await startMongoHarness();
  models = { ...(await import("../models/index.js")), ...(await import("../models/MentorshipRequest.js")) };
  mrService = await import("../services/mentorshipRequestsService.js");
  await Promise.all(Object.values(models).filter((m) => m?.modelName).map((m) => m.init()));
  mentee = await models.User.create({ name: "Mentee LP17", email: "lp17-mentee@test.local", role: "customer" });
  const user = await models.User.create({ name: "Mentor LP17", email: "lp17-mentor@test.local", role: "mentor" });
  const doc = await models.Mentor.findOneAndUpdate(
    { userId: user._id },
    { $set: { userId: user._id, name: "Mentor LP17", title: "Data Lead", publicId: "lp17-mentor", isActive: true, isVerified: true, available: true, pricePerHour: 300000, pricing: { platformFeeRate: RATE }, sessionTypes: [{ type: "mock_interview", durationMinutes: 60, price: 300000 }] } },
    { upsert: true, returnDocument: "after" },
  );
  mentor = { user, doc };
  http = await startHttpServer((await import("../app.js")).createApp());
});

after(async () => {
  if (http) await stopHttpServer(http.server);
  if (harness) await stopMongoHarness(harness);
});

describe("LP-17 — trọn luồng Learning Path từ yêu cầu đến completed", () => {
  const ctx = {};

  it("1. yêu cầu → đề nghị → chọn mentor → buổi đánh giá 0đ (mentor không nhận tiền)", async () => {
    const request = await mrService.createRequest(await actor(mentee), requestFields, files);
    const offered = await mrService.sendOffer(await actor(mentor.user), String(request._id), offerBody);
    await mrService.selectOffer(await actor(mentee), String(request._id), String(offered.offers[0]._id));
    ctx.requestId = String(request._id);

    const res = await call(mentor.user, `/api/mentorship-requests/${ctx.requestId}/accept-assessment`, "POST", slot());
    assert.equal(res.status, 201, res.error);
    assert.equal(res.request.status, "assessing");
    const assessment = await mentorCompletes(res.request.assessment.bookingId);
    assert.equal(assessment.sessionType, "assessment");
    assert.equal(assessment.totalAmount, 0);
    assert.equal((await finance()).clearingBalance ?? 0, 0);
    ctx.assessmentBookingId = String(assessment._id);
  });

  it("2. mentor soạn lộ trình 3 buổi → ứng viên yêu cầu sửa → mentor gửi lại version 2 → ứng viên chấp nhận", async () => {
    const draft = await lpApi(mentor.user, "", "POST", { mentorshipRequestId: ctx.requestId, goal: "Đậu Data Analyst", totalAmount: FIRST_TOTAL, sessions: SESSIONS });
    assert.equal(draft.status, 201, draft.error);
    ctx.pathId = draft.learningPath.id;
    assert.equal((await lpApi(mentor.user, `/${ctx.pathId}/propose`, "POST")).status, 200);

    const revision = await lpApi(mentee, `/${ctx.pathId}/request-revision`, "POST", { note: "Giảm giá một chút giúp mình." });
    assert.equal(revision.status, 200, revision.error);
    assert.equal(revision.learningPath.status, "revision_requested");

    assert.equal((await lpApi(mentor.user, `/${ctx.pathId}`, "PATCH", { totalAmount: TOTAL })).status, 200);
    const resent = await lpApi(mentor.user, `/${ctx.pathId}/propose`, "POST");
    assert.equal(resent.status, 200, resent.error);
    assert.equal(resent.learningPath.version, 2);

    const accepted = await lpApi(mentee, `/${ctx.pathId}/accept`, "POST", { version: 2 });
    assert.equal(accepted.status, 200, accepted.error);
    assert.equal(accepted.learningPath.status, "pending_payment");
    assert.deepEqual(accepted.learningPath.sessions.map((s) => s.shareAmount), PLAN.map((p) => p.shareAmount));
  });

  it("3. checkout → chuyển khoản trọn gói → SePay tự xác nhận → lộ trình active", async () => {
    const checkout = await lpApi(mentee, `/${ctx.pathId}/checkout`, "POST");
    assert.equal(checkout.status, 200, checkout.error);
    const orderRef = checkout.payment.orderRef;
    assert.match(orderRef, /^PI/);

    const res = await fetch(`${http.baseUrl}/api/payments/webhook/sepay`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Apikey lp17-test-webhook" },
      body: JSON.stringify({ id: "lp17-transfer-1", transferType: "in", transferAmount: TOTAL, content: `${orderRef} thanh toan lo trinh` }),
    });
    assert.equal(res.status, 200);

    const path = await getPath(ctx.pathId);
    assert.equal(path.status, "active");
    const payments = await models.Payment.find({ type: "learning_path", referenceId: ctx.pathId }).lean();
    assert.equal(payments.length, 1, "một Payment cho cả lộ trình");
    assert.equal(payments[0].status, "success");
    assert.equal(payments[0].amount, TOTAL);
    assert.equal(payments[0].providerRef, orderRef);
  });

  it("4. buổi 1 đạt → mở buổi 2; mentor nhận share − platformFee", async () => {
    const path = await getPath(ctx.pathId);
    const { booking, result } = await attend(ctx.pathId, byOrder(path, 1), PASS);
    assert.equal(result.nextStep, "open_next");
    assert.equal(booking.paymentMethod, "learning_path");
    assert.equal(booking.totalAmount, PLAN[0].shareAmount);
    assert.equal(booking.earningsNetAmount, PLAN[0].mentorNet);
    ctx.bookings = [ctx.assessmentBookingId, String(booking._id)];
  });

  it("5. buổi 2 không đạt → buổi học lại 0đ, buổi 3 chưa mở → học lại đạt → mở buổi 3", async () => {
    let path = await getPath(ctx.pathId);
    const s2 = byOrder(path, 2);
    const failed = await attend(ctx.pathId, s2, FAIL);
    assert.equal(failed.result.nextStep, "free_retake");
    ctx.bookings.push(String(failed.booking._id));

    path = failed.result.learningPath;
    const retake = byOrder(path, 2, 2);
    assert.ok(retake, "có buổi học lại");
    assert.equal(retake.shareAmount, 0);
    assert.equal(retake.retakeOf, s2.id);
    assert.equal(byOrder(path, 3).canSchedule, false, "buổi 3 chỉ mở khi buổi 2 đạt");
    const blocked = await lpApi(mentee, `/${ctx.pathId}/sessions/${byOrder(path, 3).id}/schedule`, "POST", slot());
    assert.ok(blocked.status >= 400, "không đặt được buổi 3 khi buổi 2 chưa đạt");

    const passed = await attend(ctx.pathId, retake, PASS);
    assert.equal(passed.result.nextStep, "open_next");
    assert.equal(passed.booking.totalAmount, 0, "học lại lần đầu miễn phí");
    assert.equal(passed.booking.earningsNetAmount ?? 0, 0);
    ctx.bookings.push(String(passed.booking._id));
  });

  it("6. buổi 3 đạt → lộ trình completed", async () => {
    const path = await getPath(ctx.pathId);
    const { booking, result } = await attend(ctx.pathId, byOrder(path, 3), PASS);
    assert.equal(result.nextStep, "complete_path");
    assert.equal((await getPath(ctx.pathId)).status, "completed");
    ctx.bookings.push(String(booking._id));
  });

  it("7. tổng kết: 5 booking cùng một yêu cầu, thu nhập mentor = T − phí nền tảng, không tính buổi 0đ và học lại", async () => {
    assert.equal(new Set(ctx.bookings).size, 5, "1 buổi 0đ + 3 buổi gốc + 1 buổi học lại, không lỗi trùng index");
    const rows = await models.Booking.find({ _id: { $in: ctx.bookings } }).lean();
    assert.equal(rows.length, 5);
    assert.ok(rows.every((b) => b.status === "completed"));

    const expectedNet = PLAN.reduce((sum, p) => sum + p.mentorNet, 0);
    const f = await finance();
    assert.equal(f.totalEarned, expectedNet);
    assert.equal(f.clearingBalance, expectedNet);
    assert.equal(expectedNet, TOTAL - PLAN.reduce((sum, p) => sum + p.platformFee, 0));
  });
});
