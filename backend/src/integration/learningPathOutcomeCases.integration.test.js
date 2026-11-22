/**
 * LP-13 — bộ test chi tiết, mỗi test là một tình huống. Đọc tên test như đặc tả hành vi của:
 *   PATCH /api/learning-paths/:id/sessions/:sid/outcome        (mentor ghi kết quả buổi)
 *   POST  /api/learning-paths/:id/sessions/:sid/supplementary  (mentor đề xuất buổi bổ sung có phí)
 * Luồng chính 3 nhánh nằm ở learningPathOutcome.integration.test.js; file này phủ các trường hợp biên.
 *
 * Lộ trình mẫu: 3 buổi, trọn gói 1.000.000đ, phí sàn 20%.
 *   Buổi 1 "SQL" gắn 2 năng lực: technical_learning, communication
 *   Buổi 2 "Insight" gắn 1 năng lực: communication
 *   Buổi 3 "Phỏng vấn thử" không gắn năng lực nào
 */
import { before, beforeEach, after, describe, it } from "node:test";
import assert from "node:assert/strict";
import { applyTestEnv, startMongoHarness, stopMongoHarness, mintAccessToken, startHttpServer, stopHttpServer } from "../test_helpers/mongoTestHarness.js";

applyTestEnv();
process.env.MAIL_USER = "";
process.env.MAIL_PASS = "";
process.env.UPSTASH_REDIS_REST_URL = "";
process.env.UPSTASH_REDIS_REST_TOKEN = "";

let harness, http, models, mrService, mentee, mentor, otherMentor, seq = 0, peopleSeq = 0;

const files = { cv: [{ originalname: "cv.pdf", buffer: Buffer.from("cv") }], jd: [{ originalname: "jd.txt", buffer: Buffer.from("jd") }] };
const requestFields = { position: "Data Analyst", description: "Muốn có lộ trình luyện phỏng vấn Data Analyst trong 1 tháng.", sessionType: "mock_interview" };
const offerBody = { message: "Tôi sẽ đánh giá năng lực SQL, phân tích và đề xuất lộ trình phù hợp.", availability: "Tối thứ 4" };
const SESSIONS = [
  { title: "SQL và phân tích dữ liệu", objectives: ["Viết truy vấn JOIN"], shrmKeys: ["technical_learning", "communication"] },
  { title: "Trình bày insight", objectives: [], shrmKeys: ["communication"] },
  { title: "Phỏng vấn thử tổng hợp", objectives: [], shrmKeys: [] },
];
const TOTAL = 1_000_000;
const FEE_RATE = 0.2;

const PASS = { outcome: "passed", feedback: { summary: "Trả lời rõ ràng, có số liệu cụ thể.", strengths: ["Cấu trúc STAR tốt"] } };
const FAIL = { outcome: "not_passed", feedback: { summary: "Còn thiếu ví dụ cụ thể cho phần JOIN.", improvements: ["Luyện thêm truy vấn nhiều bảng"] } };

const pad = (n) => String(n).padStart(2, "0");
function slot() {
  seq += 1;
  const d = new Date(Date.now() + 2 * 86400000 + seq * 2 * 3_600_000);
  return { date: `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`, timeSlot: `${pad(d.getHours())}:${pad(d.getMinutes())}` };
}
const actor = (user) => mrService.requestActor(String(user._id));

async function api(user, path, method = "GET", body) {
  const res = await fetch(`${http.baseUrl}/api/learning-paths${path}`, {
    method,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${mintAccessToken(user._id)}` },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  return { status: res.status, ...(await res.json()) };
}
const getPath = async (lp, user = mentee) => (await api(user, `/${lp.id}`)).learningPath;
const byOrder = (path, order, attempt = 1) => path.sessions.find((s) => s.order === order && s.attempt === attempt);
const record = (lp, session, body, user = mentor.user) => api(user, `/${lp.id}/sessions/${session.id}/outcome`, "PATCH", body);
const propose = (lp, session, body, user = mentor.user) => api(user, `/${lp.id}/sessions/${session.id}/supplementary`, "POST", body);
const book = (lp, session) => api(mentee, `/${lp.id}/sessions/${session.id}/schedule`, "POST", slot());

/** Ứng viên đặt lịch buổi; `bookingStatus` giả lập trạng thái booking sau buổi học (mặc định mentor đã kết thúc buổi). */
async function attend(lp, session, bookingStatus = "completed") {
  const res = await book(lp, session);
  assert.equal(res.status, 201, res.error);
  if (bookingStatus !== "confirmed") await models.Booking.updateOne({ _id: res.booking.id }, { $set: { status: bookingStatus } });
  return res.booking;
}

/** Lộ trình 3 buổi đã thanh toán (`active`). */
async function activePath() {
  const request = await mrService.createRequest(await actor(mentee), requestFields, files);
  const offered = await mrService.sendOffer(await actor(mentor.user), String(request._id), offerBody);
  await mrService.selectOffer(await actor(mentee), String(request._id), String(offered.offers[0]._id));
  const assessed = await mrService.acceptAssessment(await actor(mentor.user), String(request._id), slot());
  await models.Booking.updateOne({ _id: assessed.assessmentBookingId }, { $set: { status: "completed" } });
  const lp = (await api(mentor.user, "", "POST", { mentorshipRequestId: String(request._id), goal: "Đậu Data Analyst", totalAmount: TOTAL, sessions: SESSIONS })).learningPath;
  assert.equal((await api(mentor.user, `/${lp.id}/propose`, "POST")).status, 200);
  assert.equal((await api(mentee, `/${lp.id}/accept`, "POST", {})).status, 200);
  await models.LearningPath.updateOne({ _id: lp.id }, { $set: { status: "active", paidAt: new Date() } });
  return getPath(lp);
}

/** Đi tới trạng thái "buổi 1 đã học lại mà vẫn chưa đạt" (trượt 2 lần). Trả `{ lp, s1, retake }`. */
async function failTwice() {
  const lp = await activePath();
  const s1 = byOrder(lp, 1);
  await attend(lp, s1);
  assert.equal((await record(lp, s1, FAIL)).status, 200);
  const retake = byOrder(await getPath(lp), 1, 2);
  await attend(lp, retake);
  const res = await record(lp, retake, FAIL);
  assert.equal(res.status, 200, res.error);
  return { lp, s1, retake };
}

async function createMentor(tag) {
  const user = await models.User.create({ name: `Mentor ${tag}`, email: `lp13c-mentor-${tag}@test.local`, role: "mentor" });
  const doc = await models.Mentor.findOneAndUpdate(
    { userId: user._id },
    { $set: { userId: user._id, name: `Mentor ${tag}`, title: "Data Lead", publicId: `lp13c-mentor-${tag}`, isActive: true, isVerified: true, available: true, pricePerHour: 300000, pricing: { platformFeeRate: FEE_RATE }, sessionTypes: [{ type: "mock_interview", durationMinutes: 60, price: 300000 }] } },
    { upsert: true, returnDocument: "after" },
  );
  return { user, doc };
}

/** Người dùng mới cho mỗi nhóm: router giới hạn 60 thao tác/giờ mỗi tài khoản. */
async function freshPeople() {
  peopleSeq += 1;
  const tag = `g${peopleSeq}`;
  mentee = await models.User.create({ name: `Mentee ${tag}`, email: `lp13c-mentee-${tag}@test.local`, role: "customer" });
  mentor = await createMentor(tag);
  otherMentor = await createMentor(`${tag}-other`);
}

before(async () => {
  harness = await startMongoHarness();
  models = { ...(await import("../models/index.js")), ...(await import("../models/MentorshipRequest.js")) };
  mrService = await import("../services/mentorshipRequestsService.js");
  await Promise.all(Object.values(models).filter((m) => m?.modelName).map((m) => m.init()));
  http = await startHttpServer((await import("../app.js")).createApp());
});

after(async () => {
  if (http) await stopHttpServer(http.server);
  if (harness) await stopMongoHarness(harness);
});

// ---------------------------------------------------------------------------
describe("A. Điểm năng lực LP-01 và gợi ý đạt/chưa đạt", () => {
  before(freshPeople);

  it("A1. Không chấm điểm vẫn ghi được; không có gợi ý (suggestedOutcome = null)", async () => {
    const lp = await activePath();
    const s1 = byOrder(lp, 1);
    await attend(lp, s1);
    const res = await record(lp, s1, PASS);
    assert.equal(res.status, 200, res.error);
    assert.equal(res.suggestedOutcome, null);
    assert.deepEqual(byOrder(res.learningPath, 1).feedback.scores, []);
  });

  it("A2. Chấm thiếu 1 trong 2 năng lực của buổi → không gợi ý (chưa đủ dữ liệu)", async () => {
    const lp = await activePath();
    const s1 = byOrder(lp, 1);
    await attend(lp, s1);
    const res = await record(lp, s1, { ...PASS, scores: [{ shrmKey: "communication", score: 5 }] });
    assert.equal(res.status, 200, res.error);
    assert.equal(res.suggestedOutcome, null);
  });

  it("A3. Điểm null (chưa đủ dữ liệu) được chấp nhận và làm mất gợi ý", async () => {
    const lp = await activePath();
    const s1 = byOrder(lp, 1);
    await attend(lp, s1);
    const res = await record(lp, s1, { ...PASS, scores: [{ shrmKey: "technical_learning", score: 4 }, { shrmKey: "communication", score: null }] });
    assert.equal(res.status, 200, res.error);
    assert.equal(res.suggestedOutcome, null);
    assert.equal(byOrder(res.learningPath, 1).feedback.scores[1].score, null);
  });

  it("A4. Đúng ngưỡng 3 ở mọi năng lực → gợi ý đạt", async () => {
    const lp = await activePath();
    const s1 = byOrder(lp, 1);
    await attend(lp, s1);
    const res = await record(lp, s1, { ...PASS, scores: [{ shrmKey: "technical_learning", score: 3 }, { shrmKey: "communication", score: 3 }] });
    assert.equal(res.suggestedOutcome, "passed");
  });

  it("A5. Một năng lực 5 điểm nhưng năng lực kia 2 điểm → gợi ý chưa đạt (không lấy trung bình)", async () => {
    const lp = await activePath();
    const s1 = byOrder(lp, 1);
    await attend(lp, s1);
    const res = await record(lp, s1, { ...FAIL, scores: [{ shrmKey: "technical_learning", score: 5 }, { shrmKey: "communication", score: 2 }] });
    assert.equal(res.suggestedOutcome, "not_passed");
  });

  it("A6. Mentor được chọn ĐẠT dù gợi ý là chưa đạt — mentor quyết định, gợi ý chỉ được lưu lại", async () => {
    const lp = await activePath();
    const s1 = byOrder(lp, 1);
    await attend(lp, s1);
    const res = await record(lp, s1, { ...PASS, scores: [{ shrmKey: "technical_learning", score: 1 }, { shrmKey: "communication", score: 1 }] });
    assert.equal(res.status, 200, res.error);
    assert.equal(res.suggestedOutcome, "not_passed");
    assert.equal(res.nextStep, "open_next");
    const saved = await models.LearningPathSession.findById(s1.id).lean();
    assert.equal(saved.outcome, "passed");
    assert.equal(saved.feedback.suggestedOutcome, "not_passed");
  });

  it("A7. Key viết hoa / có khoảng trắng được chuẩn hóa về chữ thường", async () => {
    const lp = await activePath();
    const s2 = byOrder(lp, 2);
    await models.LearningPathSession.updateOne({ _id: byOrder(lp, 1).id }, { $set: { status: "done", outcome: "passed" } });
    await attend(lp, s2);
    const res = await record(lp, s2, { ...PASS, scores: [{ shrmKey: "  COMMUNICATION ", score: 4 }] });
    assert.equal(res.status, 200, res.error);
    assert.equal(byOrder(res.learningPath, 2).feedback.scores[0].shrmKey, "communication");
    assert.equal(res.suggestedOutcome, "passed");
  });

  it("A8. Lưu frameworkVersion của bộ tiêu chí để đọc đúng thang sau này", async () => {
    const lp = await activePath();
    const s1 = byOrder(lp, 1);
    await attend(lp, s1);
    const res = await record(lp, s1, PASS);
    assert.equal(byOrder(res.learningPath, 1).feedback.frameworkVersion, "2026-11-v1");
  });
});

// ---------------------------------------------------------------------------
describe("B. Dữ liệu gửi lên sai → 400, buổi không đổi", () => {
  let lp, s1;
  before(async () => {
    await freshPeople();
    lp = await activePath();
    s1 = byOrder(lp, 1);
    await attend(lp, s1);
  });

  const cases = [
    ["B1. Thiếu outcome", { feedback: PASS.feedback }],
    ["B2. outcome lạ (\"failed\")", { ...PASS, outcome: "failed" }],
    ["B3. Thiếu feedback", { outcome: "passed" }],
    ["B4. Nhận xét 9 ký tự (dưới tối thiểu 10)", { outcome: "passed", feedback: { summary: "123456789" } }],
    ["B5. Nhận xét toàn khoảng trắng", { outcome: "passed", feedback: { summary: "              " } }],
    ["B6. Chưa đạt nhưng không có điểm cần cải thiện", { outcome: "not_passed", feedback: { summary: "Chưa đạt yêu cầu buổi này." } }],
    ["B7. Điểm 6 (ngoài thang 0–5)", { ...PASS, scores: [{ shrmKey: "communication", score: 6 }] }],
    ["B8. Điểm âm", { ...PASS, scores: [{ shrmKey: "communication", score: -1 }] }],
    ["B9. Điểm lẻ 3.5 (thang chỉ nhận số nguyên)", { ...PASS, scores: [{ shrmKey: "communication", score: 3.5 }] }],
    ["B10. Chấm năng lực không gắn cho buổi (teamwork)", { ...PASS, scores: [{ shrmKey: "teamwork", score: 4 }] }],
    ["B11. Chấm 1 năng lực 2 lần", { ...PASS, scores: [{ shrmKey: "communication", score: 4 }, { shrmKey: "communication", score: 3 }] }],
    ["B12. Hơn 10 điểm mạnh", { outcome: "passed", feedback: { summary: "Nhận xét đủ dài nè.", strengths: Array.from({ length: 11 }, (_, i) => `Điểm ${i}`) } }],
    ["B13. Thiếu field score trong scores", { ...PASS, scores: [{ shrmKey: "communication" }] }],
  ];
  for (const [name, body] of cases) {
    it(`${name} → 400`, async () => {
      const res = await record(lp, s1, body);
      assert.equal(res.status, 400, `mong 400, nhận ${res.status}: ${res.error}`);
      assert.equal(typeof res.error, "string");
      assert.equal((await models.LearningPathSession.findById(s1.id).lean()).status, "scheduled");
    });
  }

  it("B14. Buổi không gắn năng lực nào (buổi 3) mà vẫn gửi điểm → 400", async () => {
    await models.LearningPathSession.updateMany({ pathId: lp.id, order: { $in: [1, 2] } }, { $set: { status: "done", outcome: "passed" } });
    const s3 = byOrder(await getPath(lp), 3);
    await attend(lp, s3);
    const res = await record(lp, s3, { ...PASS, scores: [{ shrmKey: "communication", score: 4 }] });
    assert.equal(res.status, 400);
  });

  it("B15. Nhận xét đúng 10 ký tự → hợp lệ (biên dưới)", async () => {
    const fresh = await activePath();
    const f1 = byOrder(fresh, 1);
    await attend(fresh, f1);
    const ok = await record(fresh, f1, { outcome: "passed", feedback: { summary: "1234567890" } });
    assert.equal(ok.status, 200, ok.error);
  });
});

// ---------------------------------------------------------------------------
describe("C. Trạng thái buổi / booking / lộ trình chưa cho ghi → 409", () => {
  before(freshPeople);

  it("C1. Buổi chưa đặt lịch (planned) → 409", async () => {
    const lp = await activePath();
    const res = await record(lp, byOrder(lp, 1), PASS);
    assert.equal(res.status, 409);
    assert.match(res.error, /chưa diễn ra/);
  });

  for (const status of ["confirmed", "in_progress"]) {
    it(`C2. Booking đang "${status}" (mentor chưa kết thúc buổi) → 409`, async () => {
      const lp = await activePath();
      const s1 = byOrder(lp, 1);
      await attend(lp, s1, status);
      const res = await record(lp, s1, PASS);
      assert.equal(res.status, 409);
      assert.match(res.error, /kết thúc buổi học/);
    });
  }

  it("C3. Ứng viên hủy buổi (luồng LP-22) → buổi về planned → không ghi kết quả được", async () => {
    const lp = await activePath();
    const s1 = byOrder(lp, 1);
    const booking = await attend(lp, s1, "confirmed");
    const cancel = await fetch(`${http.baseUrl}/api/bookings/${booking.id}`, { method: "DELETE", headers: { "Content-Type": "application/json", Authorization: `Bearer ${mintAccessToken(mentee._id)}` }, body: JSON.stringify({ reason: "Bận đột xuất" }) });
    assert.equal(cancel.status, 200, await cancel.text());
    assert.equal((await models.LearningPathSession.findById(s1.id).lean()).status, "planned");
    assert.equal((await record(lp, s1, PASS)).status, 409);
  });

  it("C4. Buổi đã có kết quả → ghi lại bị 409 (không sửa được kết quả)", async () => {
    const lp = await activePath();
    const s1 = byOrder(lp, 1);
    await attend(lp, s1);
    assert.equal((await record(lp, s1, PASS)).status, 200);
    const again = await record(lp, s1, FAIL);
    assert.equal(again.status, 409);
    assert.match(again.error, /đã có kết quả/);
    assert.equal((await models.LearningPathSession.findById(s1.id).lean()).outcome, "passed");
  });

  for (const status of ["completed", "cancelled", "pending_payment"]) {
    it(`C5. Lộ trình "${status}" → 409`, async () => {
      const lp = await activePath();
      const s1 = byOrder(lp, 1);
      await attend(lp, s1);
      await models.LearningPath.updateOne({ _id: lp.id }, { $set: { status } });
      const res = await record(lp, s1, PASS);
      assert.equal(res.status, 409);
      assert.match(res.error, /không còn đang học/);
    });
  }

  it("C6. Buổi học lại vừa tạo (planned) chưa đặt lịch → 409", async () => {
    const lp = await activePath();
    const s1 = byOrder(lp, 1);
    await attend(lp, s1);
    await record(lp, s1, FAIL);
    const retake = byOrder(await getPath(lp), 1, 2);
    assert.equal((await record(lp, retake, PASS)).status, 409);
  });
});

// ---------------------------------------------------------------------------
describe("D. Quyền truy cập", () => {
  let lp, s1;
  before(async () => {
    await freshPeople();
    lp = await activePath();
    s1 = byOrder(lp, 1);
    await attend(lp, s1);
  });

  it("D1. Ứng viên tự ghi kết quả buổi của mình → 403", async () => {
    assert.equal((await record(lp, s1, PASS, mentee)).status, 403);
  });

  it("D2. Mentor khác (không phải mentor của lộ trình) → 404, không lộ lộ trình", async () => {
    assert.equal((await record(lp, s1, PASS, otherMentor.user)).status, 404);
  });

  it("D3. Không gửi token → 401", async () => {
    const res = await fetch(`${http.baseUrl}/api/learning-paths/${lp.id}/sessions/${s1.id}/outcome`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(PASS) });
    assert.equal(res.status, 401);
  });

  it("D4. Mã lộ trình sai định dạng → 400", async () => {
    assert.equal((await api(mentor.user, `/abc/sessions/${s1.id}/outcome`, "PATCH", PASS)).status, 400);
  });

  it("D5. Mã buổi sai định dạng → 400", async () => {
    assert.equal((await api(mentor.user, `/${lp.id}/sessions/xyz/outcome`, "PATCH", PASS)).status, 400);
  });

  it("D6. Buổi thuộc lộ trình khác (ghép id chéo) → 404", async () => {
    const other = await activePath();
    assert.equal((await api(mentor.user, `/${lp.id}/sessions/${byOrder(other, 1).id}/outcome`, "PATCH", PASS)).status, 404);
  });

  it("D7. Mentor khác cũng không đề xuất được buổi bổ sung → 404; ứng viên → 403", async () => {
    assert.equal((await propose(lp, s1, { price: 100_000 }, otherMentor.user)).status, 404);
    assert.equal((await propose(lp, s1, { price: 100_000 }, mentee)).status, 403);
  });

  it("D8. Mentor và ứng viên đều đọc được nhận xét qua GET /:id; mentor khác thì không", async () => {
    assert.equal((await record(lp, s1, PASS)).status, 200);
    assert.equal(byOrder(await getPath(lp, mentee), 1).feedback.summary, PASS.feedback.summary);
    assert.equal(byOrder(await getPath(lp, mentor.user), 1).feedback.summary, PASS.feedback.summary);
    assert.equal((await api(otherMentor.user, `/${lp.id}`)).status, 404);
  });
});

// ---------------------------------------------------------------------------
describe("E. Học lại miễn phí (chưa đạt lần đầu)", () => {
  before(freshPeople);

  it("E1. Buổi học lại sao chép tiêu đề, mục tiêu, năng lực; tiền 0; trỏ retakeOf về buổi trượt", async () => {
    const lp = await activePath();
    const s1 = byOrder(lp, 1);
    await attend(lp, s1);
    const res = await record(lp, s1, FAIL);
    const retake = byOrder(res.learningPath, 1, 2);
    assert.equal(retake.title, s1.title);
    assert.deepEqual(retake.objectives, s1.objectives);
    assert.deepEqual(retake.shrmKeys, s1.shrmKeys);
    assert.equal(retake.shareAmount, 0);
    assert.equal(retake.retakeOf, s1.id);
    assert.equal(retake.feedback.summary, "", "buổi học lại chưa có nhận xét");
  });

  it("E2. Buổi gốc vẫn giữ nhận xét, điểm và outcome not_passed (lịch sử không mất)", async () => {
    const lp = await activePath();
    const s1 = byOrder(lp, 1);
    await attend(lp, s1);
    await record(lp, s1, { ...FAIL, scores: [{ shrmKey: "technical_learning", score: 2 }, { shrmKey: "communication", score: 3 }] });
    const original = byOrder(await getPath(lp), 1);
    assert.equal(original.status, "done");
    assert.equal(original.outcome, "not_passed");
    assert.deepEqual(original.feedback.improvements, FAIL.feedback.improvements);
    assert.equal(original.feedback.scores.length, 2);
    assert.equal(original.shareAmount, byOrder(lp, 1).shareAmount, "tiền buổi gốc không đổi");
  });

  it("E3. Booking buổi học lại: mọi field tiền = 0 nhưng paymentStatus paid (không bị job hủy đơn chưa trả)", async () => {
    const lp = await activePath();
    const s1 = byOrder(lp, 1);
    await attend(lp, s1);
    await record(lp, s1, FAIL);
    const booked = await book(lp, byOrder(await getPath(lp), 1, 2));
    const booking = await models.Booking.findById(booked.booking.id).lean();
    assert.equal(booking.price, 0);
    assert.equal(booking.totalAmount, 0);
    assert.equal(booking.platformFee, 0);
    assert.equal(booking.paymentStatus, "paid");
    assert.match(booking.notes, /Buổi 1 \(học lại\)/);
  });

  it("E4. Trượt buổi CUỐI lần đầu cũng được học lại miễn phí; học lại đạt → lộ trình completed", async () => {
    const lp = await activePath();
    await models.LearningPathSession.updateMany({ pathId: lp.id, order: { $in: [1, 2] } }, { $set: { status: "done", outcome: "passed" } });
    const s3 = byOrder(lp, 3);
    await attend(lp, s3);
    const fail = await record(lp, s3, FAIL);
    assert.equal(fail.nextStep, "free_retake");
    assert.equal(fail.learningPath.status, "active", "trượt buổi cuối chưa hoàn thành lộ trình");
    const retake = byOrder(fail.learningPath, 3, 2);
    await attend(lp, retake);
    const pass = await record(lp, retake, PASS);
    assert.equal(pass.nextStep, "complete_path");
    assert.equal(pass.learningPath.status, "completed");
  });

  it("E5. Thông báo cho ứng viên khi trượt lần đầu có tiêu đề \"Buổi 1 chưa đạt\" và link tới lộ trình", async () => {
    const lp = await activePath();
    const s1 = byOrder(lp, 1);
    await attend(lp, s1);
    await record(lp, s1, FAIL);
    const notif = await models.Notification.findOne({ userId: mentee._id, "metadata.learningPathSessionId": s1.id }).lean();
    assert.equal(notif.type, "learning_path_session_result");
    assert.equal(notif.title, "Buổi 1 chưa đạt");
    assert.equal(notif.metadata.actionUrl, `/learning-paths/${lp.id}`);
  });
});

// ---------------------------------------------------------------------------
describe("F. Buổi bổ sung có phí (chưa đạt từ lần học lại trở đi)", () => {
  beforeEach(freshPeople);

  it("F1. Trượt lần 2: thông báo tiêu đề \"Buổi 1 (học lại) chưa đạt\", không tạo buổi nào", async () => {
    const { lp, retake } = await failTwice();
    const notif = await models.Notification.findOne({ userId: mentee._id, "metadata.learningPathSessionId": retake.id }).lean();
    assert.equal(notif.title, "Buổi 1 (học lại) chưa đạt");
    assert.equal(await models.LearningPathSession.countDocuments({ pathId: lp.id, order: 1 }), 2);
  });

  for (const [name, body] of [
    ["F2. Giá 9.999đ (dưới sàn 10.000đ)", { price: 9_999 }],
    ["F3. Giá lẻ 150.000,5đ", { price: 150_000.5 }],
    ["F4. Giá vượt trần 100.000.000đ", { price: 100_000_001 }],
    ["F5. Thiếu giá", { note: "Không có giá" }],
    ["F6. Giá là chuỗi chữ", { price: "hai trăm nghìn" }],
  ]) {
    it(`${name} → 400`, async () => {
      const { lp, retake } = await failTwice();
      assert.equal((await propose(lp, retake, body)).status, 400);
    });
  }

  it("F7. Giá đúng sàn 10.000đ được nhận; thông báo cho ứng viên ghi giá và ghi chú", async () => {
    const { lp, retake } = await failTwice();
    const res = await propose(lp, retake, { price: 10_000, note: "Ôn lại JOIN" });
    assert.equal(res.status, 201, res.error);
    const notif = await models.Notification.findOne({ userId: mentee._id, title: "Mentor đề xuất buổi bổ sung cho buổi 1", "metadata.learningPathId": lp.id }).lean();
    assert.match(notif.body, /10\.000₫/);
    assert.match(notif.body, /Ôn lại JOIN/);
  });

  it("F8. Không đề xuất được cho buổi đã ĐẠT → 409", async () => {
    const lp = await activePath();
    const s1 = byOrder(lp, 1);
    await attend(lp, s1);
    await record(lp, s1, PASS);
    assert.equal((await propose(lp, s1, { price: 100_000 })).status, 409);
  });

  it("F9. Không đề xuất được cho buổi chưa học (planned) → 409", async () => {
    const lp = await activePath();
    assert.equal((await propose(lp, byOrder(lp, 1), { price: 100_000 })).status, 409);
  });

  it("F10. Đề xuất trên buổi gốc (attempt 1) sau khi học lại đã trượt → 409, phải đề xuất trên lần mới nhất", async () => {
    const { lp, s1 } = await failTwice();
    assert.equal((await propose(lp, s1, { price: 100_000 })).status, 409);
  });

  it("F11. Bấm đề xuất 2 lần cùng lúc → chỉ 1 buổi bổ sung được tạo", async () => {
    const { lp, retake } = await failTwice();
    const [a, b] = await Promise.all([propose(lp, retake, { price: 100_000 }), propose(lp, retake, { price: 100_000 })]);
    assert.deepEqual([a.status, b.status].sort(), [201, 409]);
    assert.equal(await models.LearningPathSession.countDocuments({ pathId: lp.id, order: 1, attempt: 3 }), 1);
  });

  it("F12. Lộ trình bị hủy thì không đề xuất được → 409", async () => {
    const { lp, retake } = await failTwice();
    await models.LearningPath.updateOne({ _id: lp.id }, { $set: { status: "cancelled" } });
    assert.equal((await propose(lp, retake, { price: 100_000 })).status, 409);
  });

  it("F13. Buổi bổ sung chờ thanh toán không ghi kết quả được (chưa diễn ra) → 409", async () => {
    const { lp, retake } = await failTwice();
    const extra = byOrder((await propose(lp, retake, { price: 100_000 })).learningPath, 1, 3);
    assert.equal((await record(lp, extra, PASS)).status, 409);
  });

  it("F14. Giả lập đã thanh toán (pending_payment → planned): đặt lịch được, booking tính đúng giá và phí sàn 20%", async () => {
    const { lp, retake } = await failTwice();
    const extra = byOrder((await propose(lp, retake, { price: 250_000 })).learningPath, 1, 3);
    await models.LearningPathSession.updateOne({ _id: extra.id }, { $set: { status: "planned" } }); // phần LP-24 đề xuất
    assert.equal(byOrder(await getPath(lp), 1, 3).canSchedule, true);
    const booked = await book(lp, extra);
    assert.equal(booked.status, 201, booked.error);
    const booking = await models.Booking.findById(booked.booking.id).lean();
    assert.equal(booking.totalAmount, 250_000);
    assert.equal(booking.platformFee, 50_000);
  });

  it("F15. Học buổi bổ sung đạt → mở buổi 2; tổng tiền lộ trình T không đổi", async () => {
    const { lp, retake } = await failTwice();
    const extra = byOrder((await propose(lp, retake, { price: 250_000 })).learningPath, 1, 3);
    await models.LearningPathSession.updateOne({ _id: extra.id }, { $set: { status: "planned" } });
    await attend(lp, extra);
    const res = await record(lp, extra, PASS);
    assert.equal(res.status, 200, res.error);
    assert.equal(res.nextStep, "open_next");
    assert.equal(byOrder(res.learningPath, 2).canSchedule, true);
    assert.equal(res.learningPath.totalAmount, TOTAL);
  });

  it("F16. Buổi bổ sung (attempt 3) vẫn trượt → không có buổi miễn phí, đề xuất tiếp được attempt 4", async () => {
    const { lp, retake } = await failTwice();
    const extra = byOrder((await propose(lp, retake, { price: 250_000 })).learningPath, 1, 3);
    await models.LearningPathSession.updateOne({ _id: extra.id }, { $set: { status: "planned" } });
    await attend(lp, extra);
    const res = await record(lp, extra, FAIL);
    assert.equal(res.nextStep, "supplementary_required");
    assert.equal(byOrder(res.learningPath, 1, 4), undefined);
    const again = await propose(lp, extra, { price: 300_000 });
    assert.equal(again.status, 201, again.error);
    const fourth = byOrder(again.learningPath, 1, 4);
    assert.equal(fourth.status, "pending_payment");
    assert.equal(fourth.shareAmount, 300_000);
    assert.equal(fourth.retakeOf, extra.id);
  });
});

// ---------------------------------------------------------------------------
describe("G. Hoàn thành lộ trình", () => {
  before(freshPeople);

  it("G1. Đạt buổi 1, 2 → vẫn active; đạt buổi 3 → completed + completedAt + thông báo hoàn thành", async () => {
    const lp = await activePath();
    for (const order of [1, 2, 3]) {
      const s = byOrder(await getPath(lp), order);
      await attend(lp, s);
      const res = await record(lp, s, PASS);
      assert.equal(res.learningPath.status, order === 3 ? "completed" : "active", `sau buổi ${order}`);
    }
    const row = await models.LearningPath.findById(lp.id).lean();
    assert.ok(row.completedAt instanceof Date);
    assert.equal(await models.Notification.countDocuments({ userId: mentee._id, title: "Bạn đã hoàn thành lộ trình", "metadata.learningPathId": lp.id }), 1);
  });

  it("G2. Sau khi hoàn thành không còn buổi nào mở đặt lịch", async () => {
    const lp = await activePath();
    await models.LearningPathSession.updateMany({ pathId: lp.id, order: { $in: [1, 2] } }, { $set: { status: "done", outcome: "passed" } });
    const s3 = byOrder(lp, 3);
    await attend(lp, s3);
    const res = await record(lp, s3, PASS);
    assert.ok(res.learningPath.sessions.every((s) => s.canSchedule === false));
  });

  it("G3. Lộ trình có một buổi bị hủy (cancelled) không chặn việc hoàn thành", async () => {
    const lp = await activePath();
    await models.LearningPathSession.updateMany({ pathId: lp.id, order: 1 }, { $set: { status: "done", outcome: "passed" } });
    // Giả lập một lần học cũ của buổi 2 bị hủy cùng lộ trình cũ; lần mới nhất vẫn là buổi gốc.
    await models.LearningPathSession.create({ pathId: lp.id, order: 2, attempt: 9, title: "Lần học đã hủy", shareAmount: 0, status: "cancelled" });
    for (const order of [2, 3]) {
      const s = byOrder(await getPath(lp), order);
      await attend(lp, s);
      await record(lp, s, PASS);
    }
    assert.equal((await models.LearningPath.findById(lp.id).lean()).status, "completed");
  });

  it("G4. Đạt buổi giữa: thông báo \"Bạn đã đạt buổi 2\" kèm câu buổi tiếp theo đã mở", async () => {
    const lp = await activePath();
    await models.LearningPathSession.updateOne({ _id: byOrder(lp, 1).id }, { $set: { status: "done", outcome: "passed" } });
    const s2 = byOrder(lp, 2);
    await attend(lp, s2);
    await record(lp, s2, PASS);
    const notif = await models.Notification.findOne({ userId: mentee._id, "metadata.learningPathSessionId": s2.id }).lean();
    assert.equal(notif.title, "Bạn đã đạt buổi 2");
    assert.match(notif.body, /Buổi tiếp theo đã mở đặt lịch/);
  });
});
