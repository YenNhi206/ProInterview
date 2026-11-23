/**
 * LP-23: GET /api/learning-paths/:id/competency-hints — năng lực gợi ý cho trình soạn lộ trình
 * từ `requiredCompetencies` của job và hồ sơ năng lực ứng viên. Chỉ mentor của lộ trình xem được.
 */
import { before, after, it } from "node:test";
import assert from "node:assert/strict";
import { applyTestEnv, startMongoHarness, stopMongoHarness, mintAccessToken, startHttpServer, stopHttpServer } from "../test_helpers/mongoTestHarness.js";
import { resetAssessmentQuota } from "../test_helpers/assessmentQuota.js";

applyTestEnv();
process.env.MAIL_USER = "";
process.env.MAIL_PASS = "";
process.env.UPSTASH_REDIS_REST_URL = "";
process.env.UPSTASH_REDIS_REST_TOKEN = "";

let harness, http, models, mrService, mentee, mentors, pathId;
const files = { cv: [{ originalname: "cv.pdf", buffer: Buffer.from("cv") }], jd: [{ originalname: "jd.txt", buffer: Buffer.from("jd") }] };
const pad = (n) => String(n).padStart(2, "0");
const actor = (user) => mrService.requestActor(String(user._id));

async function api(user, path) {
  const res = await fetch(`${http.baseUrl}/api/learning-paths${path}`, { headers: { Authorization: `Bearer ${mintAccessToken(user._id)}` } });
  return { status: res.status, ...(await res.json()) };
}

before(async () => {
  harness = await startMongoHarness();
  models = { ...(await import("../models/index.js")), ...(await import("../models/MentorshipRequest.js")) };
  mrService = await import("../services/mentorshipRequestsService.js");
  await Promise.all(Object.values(models).filter((m) => m?.modelName).map((m) => m.init()));
  mentee = await models.User.create({ name: "Mentee LP23", email: "lp23-mentee@test.local", role: "customer" });
  mentors = [];
  for (let i = 0; i < 2; i += 1) {
    const user = await models.User.create({ name: `Mentor LP23 ${i}`, email: `lp23-mentor-${i}@test.local`, role: "mentor" });
    const mentor = await models.Mentor.findOneAndUpdate(
      { userId: user._id },
      { $set: { userId: user._id, name: `Mentor LP23 ${i}`, title: "Senior", publicId: `lp23-mentor-${i}`, isActive: true, isVerified: true, available: true, pricePerHour: 300000, "pricing.platformFeeRate": 0.25, sessionTypes: [{ type: "mock_interview", durationMinutes: 60, price: 300000 }] } },
      { upsert: true, returnDocument: "after" },
    );
    mentors.push({ user, mentor });
  }
  http = await startHttpServer((await import("../app.js")).createApp());

  const request = await mrService.createRequest(await actor(mentee), { position: "Backend Developer", description: "Cần lộ trình luyện phỏng vấn backend cho job đã chọn.", sessionType: "mock_interview" }, files);
  const offered = await mrService.sendOffer(await actor(mentors[0].user), String(request._id), { message: "Tôi hỗ trợ lộ trình backend theo job bạn chọn.", availability: "Tối thứ 3" });
  await mrService.selectOffer(await actor(mentee), String(request._id), String(offered.offers[0]._id));
  await resetAssessmentQuota(mentee._id);
  const d = new Date(Date.now() + 2 * 86400000);
  const row = await mrService.acceptAssessment(await actor(mentors[0].user), String(request._id), { date: `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`, timeSlot: "19:00" });
  await models.Booking.updateOne({ _id: row.assessmentBookingId }, { $set: { status: "completed", completedAt: new Date() } });
  const created = await fetch(`${http.baseUrl}/api/learning-paths`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${mintAccessToken(mentors[0].user._id)}` },
    body: JSON.stringify({ mentorshipRequestId: String(request._id) }),
  }).then((r) => r.json());
  assert.ok(created.success, created.error);
  pathId = created.learningPath.id;

  const company = await models.Company.create({ name: "Công ty LP23", slug: "cong-ty-lp23" });
  const job = await models.JobPost.create({
    companyId: company._id, title: "Backend Node.js", roleCategory: "backend", level: "junior", status: "published",
    requiredCompetencies: [{ shrmKey: "problem_solving", minLevel: 4 }, { shrmKey: "communication", minLevel: 3 }, { shrmKey: "teamwork", minLevel: 2 }],
  });
  await models.LearningPath.updateOne({ _id: pathId }, { $set: { jobPostId: job._id } });
  await models.CandidateProfile.findOneAndUpdate(
    { userId: mentee._id },
    { $set: { userId: mentee._id, competencies: [
      { key: "problem_solving", name: "Giải quyết vấn đề", level: 2, score: 40, evidenceCount: 2, sources: [] },
      { key: "teamwork", name: "Làm việc nhóm", level: 4, score: 80, evidenceCount: 1, sources: [] },
      { key: "leadership", name: "Dẫn dắt", level: 1, score: 20, evidenceCount: 1, sources: [] },
    ] } },
    { upsert: true },
  );
});

after(async () => {
  if (http) await stopHttpServer(http.server);
  if (harness) await stopMongoHarness(harness);
});

it("mentor của lộ trình thấy năng lực gợi ý từ job và hồ sơ ứng viên, thiếu nhiều xếp trước", async () => {
  const res = await api(mentors[0].user, `/${pathId}/competency-hints`);
  assert.equal(res.status, 200, res.error);
  assert.equal(res.hints.jobTitle, "Backend Node.js");
  assert.equal(res.hints.hasJob, true);
  const byKey = Object.fromEntries(res.hints.items.map((i) => [i.shrmKey, i]));
  assert.deepEqual(res.hints.items.slice(0, 2).map((i) => i.shrmKey), ["problem_solving", "leadership"]);
  assert.equal(byKey.problem_solving.status, "gap");
  assert.equal(byKey.problem_solving.gap, 2);
  assert.equal(byKey.communication.status, "unknown");
  assert.equal(byKey.teamwork.status, "met");
  assert.equal(byKey.leadership.fromJob, false);
  assert.equal(res.hints.items.some((i) => i.shrmKey === "technical_mastery"), false);
});

it("mentor khác và ứng viên không xem được (404)", async () => {
  assert.equal((await api(mentors[1].user, `/${pathId}/competency-hints`)).status, 404);
  assert.equal((await api(mentee, `/${pathId}/competency-hints`)).status, 404);
  assert.equal((await api(mentors[0].user, `/not-an-id/competency-hints`)).status, 400);
});
