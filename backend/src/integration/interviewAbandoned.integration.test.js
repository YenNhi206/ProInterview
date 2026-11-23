/**
 * N-07 (AIS-07, C-09): buổi phỏng vấn AI `in_progress` quá 24 giờ → `abandoned`, loại khỏi thống kê.
 */
import { before, after, describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { applyTestEnv, startMongoHarness, stopMongoHarness, mintAccessToken, startHttpServer, stopHttpServer } from "../test_helpers/mongoTestHarness.js";

applyTestEnv();

const HOUR = 3_600_000;
let harness, http, InterviewSession, markAbandonedInterviewSessions, admin, candidate;

async function session(fields = {}, ageMs = 0) {
  const doc = await InterviewSession.create({ userId: candidate._id, hrGender: "female", status: "in_progress", ...fields });
  if (ageMs) {
    // timestamps: true → đặt lại createdAt bằng updateOne (bỏ qua timestamps).
    const at = new Date(Date.now() - ageMs);
    await InterviewSession.collection.updateOne({ _id: doc._id }, { $set: { createdAt: at, updatedAt: at } });
  }
  return doc;
}

async function call(user, url, method = "GET", body) {
  const res = await fetch(`${http.baseUrl}${url}`, {
    method,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${mintAccessToken(user._id)}` },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  return { status: res.status, ...(await res.json()) };
}

before(async () => {
  harness = await startMongoHarness();
  ({ InterviewSession } = await import("../models/InterviewSession.js"));
  ({ markAbandonedInterviewSessions } = await import("../services/interviewSessionCleanupService.js"));
  const { User } = await import("../models/User.js");
  admin = await User.create({ name: "Admin N07", email: "n07-admin@test.local", role: "admin" });
  candidate = await User.create({ name: "Ứng viên N07", email: "n07-candidate@test.local", role: "customer" });
  http = await startHttpServer((await import("../app.js")).createApp());
});

after(async () => {
  if (http) await stopHttpServer(http.server);
  if (harness) await stopMongoHarness(harness);
});

beforeEach(async () => {
  await InterviewSession.deleteMany({});
});

describe("Job đánh abandoned (N-07)", () => {
  it("chỉ buổi in_progress quá 24 giờ bị đánh; chạy lại không đổi gì", async () => {
    const old = await session({}, 25 * HOUR);
    const fresh = await session({}, 23 * HOUR);
    const oldCompleted = await session({ status: "completed", completedAt: new Date() }, 48 * HOUR);

    const now = new Date();
    assert.deepEqual(await markAbandonedInterviewSessions(now), { abandoned: 1 });
    assert.deepEqual(await markAbandonedInterviewSessions(now), { abandoned: 0 });

    const byId = async (d) => InterviewSession.findById(d._id).lean();
    const oldDoc = await byId(old);
    assert.equal(oldDoc.status, "abandoned");
    assert.equal(oldDoc.abandonedAt.getTime(), now.getTime());
    assert.equal((await byId(fresh)).status, "in_progress");
    assert.equal((await byId(oldCompleted)).status, "completed");
  });

  it("đúng mốc 24 giờ thì bị đánh (createdAt ≤ now − 24h)", async () => {
    const created = await session();
    const now = new Date(created.createdAt.getTime() + 24 * HOUR);
    assert.deepEqual(await markAbandonedInterviewSessions(new Date(now.getTime() - 1)), { abandoned: 0 });
    assert.deepEqual(await markAbandonedInterviewSessions(now), { abandoned: 1 });
  });

  it("buổi đã bỏ dở không hoàn thành lại được (409), không bị ghi đè thành completed", async () => {
    const s = await session({}, 30 * HOUR);
    await markAbandonedInterviewSessions();
    const res = await call(candidate, `/api/interviews/sessions/${s._id}/complete`, "POST", { answers: [] });
    assert.equal(res.status, 409);
    assert.equal(res.success, false);
    assert.match(res.error, /bỏ dở/);
    assert.equal((await InterviewSession.findById(s._id).lean()).status, "abandoned");
  });
});

describe("Loại abandoned khỏi thống kê (N-07)", () => {
  it("content stats, interview-metrics, số liệu trang chủ không đếm buổi bỏ dở", async () => {
    await session({ status: "completed", completedAt: new Date() });
    await session();
    await session({}, 30 * HOUR); // sẽ bị đánh abandoned
    await session({ status: "abandoned", abandonedAt: new Date() }); // bỏ dở trong 7 ngày gần nhất
    await markAbandonedInterviewSessions();
    assert.equal(await InterviewSession.countDocuments({ status: "abandoned" }), 2);

    const content = await call(admin, "/api/admin/content/stats");
    assert.equal(content.status, 200, content.error);
    assert.equal(content.content.interviewSessions, 2);
    assert.equal(content.content.interviewOps.sessions7d, 2);

    const metrics = await call(admin, "/api/admin/interview-metrics");
    assert.equal(metrics.status, 200, metrics.error);
    assert.equal(metrics.totalAllTime, 2);
    assert.equal(metrics.sessionsByDay.reduce((sum, d) => sum + d.count, 0), 2);

    const home = await (await fetch(`${http.baseUrl}/api/public/home-data`)).json();
    assert.equal(home.data.stats.totalSessions, 2);
  });
});
