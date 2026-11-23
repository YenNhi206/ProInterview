/**
 * LP-14 (M-06): thu nhập mentor cho buổi lộ trình đi qua luồng có sẵn
 * (`PATCH /api/bookings/:id/complete` → `tryCreditMentorForCompletedBooking` → `earningsClearanceJob`).
 * Xong khi: mentor nhận đúng `share − platformFee` mỗi buổi, 0 cho buổi 0đ và buổi học lại;
 * `earningsClearanceJob` (`releaseEligibleEarnings`) chuyển đúng sang `availableBalance`.
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

let harness, http, models, mrService, earnings, mentee, mentor, seq = 0;

const RATE = 0.2;
const TOTAL = 1_000_000;
const files = { cv: [{ originalname: "cv.pdf", buffer: Buffer.from("cv") }], jd: [{ originalname: "jd.txt", buffer: Buffer.from("jd") }] };
const requestFields = { position: "Data Analyst", description: "Muốn có lộ trình luyện phỏng vấn Data Analyst trong 1 tháng.", sessionType: "mock_interview" };
const offerBody = { message: "Tôi sẽ đánh giá năng lực SQL, phân tích và đề xuất lộ trình phù hợp.", availability: "Tối thứ 4" };
const SESSIONS = [
  { title: "SQL và phân tích dữ liệu", objectives: [], shrmKeys: ["communication"] },
  { title: "Trình bày insight", objectives: [], shrmKeys: ["communication"] },
  { title: "Phỏng vấn thử tổng hợp", objectives: [], shrmKeys: [] },
];
const PLAN = planLearningPathMoney(TOTAL, SESSIONS.length, RATE); // 333.333 · 333.333 · 333.334
const PASS = { outcome: "passed", feedback: { summary: "Trả lời rõ ràng, có số liệu cụ thể." } };
const FAIL = { outcome: "not_passed", feedback: { summary: "Còn thiếu ví dụ cụ thể cho phần JOIN.", improvements: ["Luyện thêm truy vấn nhiều bảng"] } };

const pad = (n) => String(n).padStart(2, "0");
function slot() {
  seq += 1;
  const d = new Date(Date.now() + 86400000 + seq * 2 * 3_600_000);
  return { date: `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`, timeSlot: `${pad(d.getHours())}:${pad(d.getMinutes())}` };
}
/** Dời buổi về quá khứ (đã bắt đầu > 15 phút) để mentor được bấm kết thúc. Mỗi buổi một giờ khác nhau. */
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

/** Mentor kết thúc buổi qua API có sẵn (không sửa booking bằng tay). */
async function mentorCompletes(bookingId) {
  await models.Booking.updateOne({ _id: bookingId }, { $set: pastSlot() });
  const res = await call(mentor.user, `/api/bookings/${bookingId}/complete`, "PATCH");
  assert.equal(res.status, 200, JSON.stringify(res));
  return models.Booking.findById(bookingId).lean();
}

/** Ứng viên đặt lịch, mentor kết thúc buổi, mentor ghi kết quả. Trả booking sau khi hoàn thành. */
async function attend(pathId, session, outcome = PASS) {
  const scheduled = await lpApi(mentee, `/${pathId}/sessions/${session.id}/schedule`, "POST", slot());
  assert.equal(scheduled.status, 201, scheduled.error);
  const booking = await mentorCompletes(scheduled.booking.id);
  const rec = await lpApi(mentor.user, `/${pathId}/sessions/${session.id}/outcome`, "PATCH", outcome);
  assert.equal(rec.status, 200, rec.error);
  return booking;
}

before(async () => {
  harness = await startMongoHarness();
  models = { ...(await import("../models/index.js")), ...(await import("../models/MentorshipRequest.js")) };
  mrService = await import("../services/mentorshipRequestsService.js");
  earnings = await import("../services/mentorEarningsService.js");
  await Promise.all(Object.values(models).filter((m) => m?.modelName).map((m) => m.init()));
  mentee = await models.User.create({ name: "Mentee LP14", email: "lp14-mentee@test.local", role: "customer" });
  const user = await models.User.create({ name: "Mentor LP14", email: "lp14-mentor@test.local", role: "mentor" });
  const doc = await models.Mentor.findOneAndUpdate(
    { userId: user._id },
    { $set: { userId: user._id, name: "Mentor LP14", title: "Data Lead", publicId: "lp14-mentor", isActive: true, isVerified: true, available: true, pricePerHour: 300000, pricing: { platformFeeRate: RATE }, sessionTypes: [{ type: "mock_interview", durationMinutes: 60, price: 300000 }] } },
    { upsert: true, returnDocument: "after" },
  );
  mentor = { user, doc };
  http = await startHttpServer((await import("../app.js")).createApp());
});

after(async () => {
  if (http) await stopHttpServer(http.server);
  if (harness) await stopMongoHarness(harness);
});

describe("Thu nhập mentor theo buổi lộ trình (LP-14)", () => {
  let pathId;
  const bookings = {};

  it("buổi đánh giá 0đ: mentor kết thúc buổi, không nhận tiền", async () => {
    const request = await mrService.createRequest(await actor(mentee), requestFields, files);
    const offered = await mrService.sendOffer(await actor(mentor.user), String(request._id), offerBody);
    await mrService.selectOffer(await actor(mentee), String(request._id), String(offered.offers[0]._id));
    const assessed = await mrService.acceptAssessment(await actor(mentor.user), String(request._id), slot());

    const assessment = await mentorCompletes(assessed.assessmentBookingId);
    assert.equal(assessment.sessionType, "assessment");
    assert.equal(assessment.status, "completed");
    assert.ok(assessment.mentorEarningsCreditedAt, "đánh dấu đã xử lý để không tính lại");
    assert.equal(assessment.earningsNetAmount ?? 0, 0);
    assert.equal(assessment.earningsClearAt ?? null, null, "không có gì để giải ngân");
    assert.equal((await finance()).clearingBalance ?? 0, 0);

    const lp = (await lpApi(mentor.user, "", "POST", { mentorshipRequestId: String(request._id), goal: "Đậu Data Analyst", totalAmount: TOTAL, sessions: SESSIONS })).learningPath;
    assert.equal((await lpApi(mentor.user, `/${lp.id}/propose`, "POST")).status, 200);
    assert.equal((await lpApi(mentee, `/${lp.id}/accept`, "POST", {})).status, 200);
    // Đường ray thanh toán đã có test riêng (LP-10); ở đây đặt `active` như sau khi SePay xác nhận.
    await models.LearningPath.updateOne({ _id: lp.id }, { $set: { status: "active", paidAt: new Date() } });
    pathId = lp.id;
  });

  it("buổi 1 đạt: mentor nhận share − platformFee vào clearingBalance", async () => {
    const lp = await getPath(pathId);
    const b = await attend(pathId, byOrder(lp, 1));
    bookings.s1 = b;
    assert.equal(b.paymentMethod, "learning_path");
    assert.equal(b.totalAmount, PLAN[0].shareAmount);
    assert.equal(b.platformFee, PLAN[0].platformFee);
    assert.equal(b.earningsNetAmount, PLAN[0].mentorNet);
    assert.ok(b.earningsClearAt);
    const f = await finance();
    assert.equal(f.clearingBalance, PLAN[0].mentorNet);
    assert.equal(f.totalEarned, PLAN[0].mentorNet);
  });

  it("buổi 2 chưa đạt → buổi học lại 0đ: mentor nhận tiền buổi 2, buổi học lại nhận 0", async () => {
    let lp = await getPath(pathId);
    bookings.s2 = await attend(pathId, byOrder(lp, 2), FAIL);
    assert.equal(bookings.s2.earningsNetAmount, PLAN[1].mentorNet);

    lp = await getPath(pathId);
    const retake = byOrder(lp, 2, 2);
    assert.ok(retake, "có buổi học lại");
    const r = await attend(pathId, retake);
    bookings.retake = r;
    assert.equal(r.totalAmount, 0);
    assert.equal(r.platformFee, 0);
    assert.ok(r.mentorEarningsCreditedAt);
    assert.equal(r.earningsNetAmount ?? 0, 0);

    const f = await finance();
    assert.equal(f.clearingBalance, PLAN[0].mentorNet + PLAN[1].mentorNet, "buổi học lại không cộng tiền");
  });

  it("buổi 3 đạt → lộ trình completed; tổng mentor nhận = T − tổng phí nền tảng", async () => {
    const lp = await getPath(pathId);
    bookings.s3 = await attend(pathId, byOrder(lp, 3));
    assert.equal((await getPath(pathId)).status, "completed");

    const totalNet = PLAN.reduce((s, p) => s + p.mentorNet, 0);
    const totalFee = PLAN.reduce((s, p) => s + p.platformFee, 0);
    assert.equal(totalNet + totalFee, TOTAL);
    const f = await finance();
    assert.equal(f.clearingBalance, totalNet);
    assert.equal(f.totalEarned, totalNet);

    const report = await earnings.reconcileMentorClearingBalances();
    assert.equal(report.mismatches.filter((m) => m.mentorId === String(mentor.doc._id)).length, 0, "đối soát khớp");
  });

  it("kết thúc lại / gọi ghi có lần nữa không cộng trùng", async () => {
    const again = await call(mentor.user, `/api/bookings/${bookings.s1._id}/complete`, "PATCH");
    assert.equal(again.status, 400);
    const credit = await earnings.tryCreditMentorForCompletedBooking(bookings.s1._id);
    assert.equal(credit.skipped, true);
    const totalNet = PLAN.reduce((s, p) => s + p.mentorNet, 0);
    assert.equal((await finance()).clearingBalance, totalNet);
  });

  it("earningsClearanceJob: sau thời gian giữ tiền, chuyển đúng từng buổi sang availableBalance", async () => {
    const totalNet = PLAN.reduce((s, p) => s + p.mentorNet, 0);
    const before = await finance();

    // Chưa tới hạn giữ tiền → không chuyển.
    const early = await earnings.releaseEligibleEarnings(new Date());
    assert.equal(early.releasedCount, 0);

    const later = new Date(Date.now() + (earnings.EARNINGS_HOLD_DAYS + 1) * 86_400_000);
    const res = await earnings.releaseEligibleEarnings(later);
    assert.equal(res.releasedCount, 3, "3 buổi có tiền (buổi 0đ và học lại không có gì để chuyển)");
    assert.equal(res.failedCount, 0);

    const after = await finance();
    assert.equal(after.clearingBalance, 0);
    assert.equal((after.availableBalance ?? 0) - (before.availableBalance ?? 0), totalNet);

    for (const key of ["s1", "s2", "s3"]) {
      const b = await models.Booking.findById(bookings[key]._id).lean();
      assert.ok(b.earningsClearedAt, `${key} đã giải ngân`);
    }
    assert.equal((await models.Booking.findById(bookings.retake._id).lean()).earningsClearedAt ?? null, null);

    const again = await earnings.releaseEligibleEarnings(later);
    assert.equal(again.releasedCount, 0, "chạy lại không chuyển trùng");
    assert.equal((await finance()).availableBalance, after.availableBalance);
  });
});
