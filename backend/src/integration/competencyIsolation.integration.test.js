/** PR-07 hotfix: năng lực "đã xác thực" chỉ đến từ bằng chứng thật của chính tài khoản đó. */
import { after, before, beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { applyTestEnv, mintAccessToken, startHttpServer, startMongoHarness, stopHttpServer, stopMongoHarness } from "../test_helpers/mongoTestHarness.js";

applyTestEnv();

let harness, http, db, oid, User, A, B, C;
let seq = 0;

async function makeUser() {
  seq += 1;
  return User.create({ name: `User ${seq}`, email: `pr07-${seq}@test.local`, role: "customer" });
}

async function api(user, path, method = "GET", body) {
  const res = await fetch(`${http.baseUrl}${path}`, {
    method,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${mintAccessToken(user._id)}` },
    ...(body && { body: JSON.stringify(body) }),
  });
  return { ...(await res.json()), status: res.status };
}

async function addBooking(user, extra = {}) {
  const _id = oid();
  await db.collection("bookings").insertOne({
    _id, userId: user._id, mentorId: oid(), status: "completed",
    date: "20/11/2026", timeSlot: String(_id), createdAt: new Date(), ...extra,
  });
  return _id;
}

async function addInterview(user, score, extra = {}) {
  const _id = oid();
  await db.collection("interview_sessions").insertOne({
    _id,
    userId: user._id,
    hrGender: "female",
    status: "completed",
    createdAt: new Date(),
    answers: [{ questionIndex: 0, transcript: "Em đã tối ưu truy vấn và đo lại kết quả." }],
    feedback: { overallScore: score, perQuestion: [{ questionIndex: 0, score }] },
    ...extra,
  });
  return _id;
}

/** Dữ liệu mà bản lỗi đã ghi vào DB. */
async function poison(user, bookingId) {
  await db.collection("candidateprofiles").insertOne({
    userId: user._id,
    isVerified: true,
    verifiedAt: new Date(),
    competencies: [{
      key: "problem_solving", name: "Giải quyết vấn đề", level: 4, score: 85, evidenceCount: 1,
      sources: [{ type: "mentor_session", refId: bookingId, score: 85, at: new Date() }],
    }],
  });
  await db.collection("users").updateOne({ _id: user._id }, {
    $set: {
      isCompetencyVerified: true,
      verifiedReadinessScore: 86,
      lastVerifiedAt: new Date(),
      verifiedProfileSummary: "86/100",
      verifiedCompetencies: [{ name: "STAR", score: 88 }],
    },
  });
}

/** Mọi API mà ứng viên đọc được trạng thái năng lực. */
async function readAll(user) {
  const comp = await api(user, "/api/profile/me/competencies");
  const me = await api(user, "/api/profile/me");
  const legacy = await api(user, "/api/users/me/verified-competencies");
  for (const res of [comp, me, legacy]) assert.equal(res.status, 200, res.error);
  return { comp, me: me.profile, legacy: legacy.profile };
}

const sourcesOf = (competencies) => competencies.flatMap((c) => c.sources);
const refsOf = (competencies) => sourcesOf(competencies).map((s) => String(s.refId));

async function assertUnverified(user) {
  const { comp, me, legacy } = await readAll(user);
  assert.deepEqual(sourcesOf(comp.competencies), []);
  assert.ok(comp.competencies.every((c) => c.score === 0 && c.evidenceCount === 0));
  assert.equal(comp.snapshot.isVerified, false);
  assert.deepEqual(sourcesOf(me.competencies), []);
  assert.equal(me.isVerified, false);
  assert.equal(me.verifiedAt, null);
  assert.equal(legacy.isCompetencyVerified, false);
  assert.equal(legacy.verifiedReadinessScore, 0);
  assert.deepEqual(legacy.competencies, []);
}

before(async () => {
  harness = await startMongoHarness();
  db = harness.mongoose.connection.db;
  oid = () => new harness.mongoose.Types.ObjectId();
  ({ User } = await import("../models/User.js"));
  http = await startHttpServer((await import("../app.js")).createApp());
});

after(async () => {
  if (http) await stopHttpServer(http.server);
  if (harness) await stopMongoHarness(harness);
});

beforeEach(async () => {
  for (const name of ["users", "bookings", "interview_sessions", "candidateprofiles"]) {
    await db.collection(name).deleteMany({});
  }
  [A, B, C] = [await makeUser(), await makeUser(), await makeUser()];
});

describe("PR-07: cách ly dữ liệu giữa các tài khoản", () => {
  it("test DB chạy strictQuery giống production", () => {
    assert.equal(harness.mongoose.get("strictQuery"), true);
  });

  it("booking completed của A không xuất hiện ở B, C", async () => {
    await addBooking(A);
    await assertUnverified(B);
    await assertUnverified(C);
  });

  it("mentorSessionsCount chỉ đếm buổi completed của chính mình", async () => {
    await addBooking(A);
    await addBooking(A);
    await addBooking(B);
    await addBooking(C, { status: "cancelled" });
    for (const [user, expected] of [[A, 2], [B, 1], [C, 0]]) {
      assert.equal((await readAll(user)).legacy.mentorSessionsCount, expected);
    }
  });

  it("mỗi tài khoản chỉ nhận đúng buổi phỏng vấn và điểm của mình", async () => {
    const a = await addInterview(A, 90);
    const b = await addInterview(B, 40);
    for (const [user, id, score] of [[A, a, 90], [B, b, 40]]) {
      const { comp, me, legacy } = await readAll(user);
      assert.deepEqual(refsOf(comp.competencies), [String(id)]);
      assert.deepEqual(refsOf(me.competencies), [String(id)]);
      assert.equal(legacy.verifiedReadinessScore, score);
      assert.equal(comp.snapshot.isVerified, true);
      assert.equal(me.isVerified, true);
    }
    await assertUnverified(C);
  });

  it("30 tài khoản đọc đồng thời không lẫn dữ liệu", async () => {
    const people = [];
    for (let i = 0; i < 30; i += 1) {
      const user = await makeUser();
      await addBooking(user);
      people.push({ user, id: i % 2 ? await addInterview(user, 30 + i) : null });
    }
    await Promise.all(people.map(async ({ user, id }) => {
      const res = await api(user, "/api/profile/me/competencies");
      assert.deepEqual(refsOf(res.competencies), id ? [String(id)] : []);
    }));
  });
});

describe("PR-07: không tự cấp verified, không điểm giả", () => {
  const syncBodies = { "body rỗng": {}, "sampleIfEmpty=true": { sampleIfEmpty: true }, "sampleIfEmpty=false": { sampleIfEmpty: false } };
  for (const [label, body] of Object.entries(syncBodies)) {
    it(`sync không có dữ liệu (${label})`, async () => {
      const res = await api(A, "/api/users/me/verified-competencies/sync", "POST", body);
      assert.equal(res.profile.isCompetencyVerified, false);
      assert.equal(res.profile.verifiedReadinessScore, 0);
      await assertUnverified(A);
    });
  }

  it("buổi mentor của chính mình không tự thành 85 điểm", async () => {
    await addBooking(A);
    await assertUnverified(A);
  });

  it("tự bấm complete một buổi rỗng không được xác thực", async () => {
    const created = await api(A, "/api/interviews/sessions", "POST", {});
    assert.equal(created.status, 201, created.error);
    const done = await api(A, `/api/interviews/sessions/${created.session._id}/complete`, "POST", {});
    assert.equal(done.status, 200, done.error);
    await assertUnverified(A);
  });

  const invalid = {
    "đang làm dở": { status: "in_progress" },
    "bỏ dở": { status: "abandoned" },
    "chưa chấm": { feedback: {} },
    "chỉ có điểm tổng": { feedback: { overallScore: 90 } },
    "điểm 0": { feedback: { overallScore: 0, perQuestion: [{ questionIndex: 0, score: 0 }] } },
    "không có answers": { answers: [] },
    "transcript toàn khoảng trắng": { answers: [{ questionIndex: 0, transcript: "  \n " }] },
    "chấm thiếu, dùng điểm mặc định": { answers: [{ questionIndex: 0, transcript: "Có trả lời", evaluationIncomplete: true }] },
  };
  for (const [label, extra] of Object.entries(invalid)) {
    it(`buổi không đủ bằng chứng: ${label}`, async () => {
      await addInterview(A, 90, extra);
      await assertUnverified(A);
    });
  }

  it("buổi không hợp lệ mới hơn không đẩy buổi thật ra khỏi 20 buổi gần nhất", async () => {
    const valid = await addInterview(A, 70, { createdAt: new Date("2026-01-01") });
    for (let i = 0; i < 21; i += 1) await addInterview(A, 90, { answers: [] });
    assert.deepEqual(refsOf((await readAll(A)).comp.competencies), [String(valid)]);
  });

  it("điểm là trung bình buổi thật, không sinh điểm năng lực con", async () => {
    await addInterview(A, 20);
    await addInterview(A, 50);
    const { comp, legacy } = await readAll(A);
    assert.equal(comp.competencies.find((c) => c.evidenceCount).score, 35);
    assert.equal(legacy.verifiedReadinessScore, 35);
    assert.deepEqual(legacy.competencies, []);
    assert.ok(legacy.standards.every((s) => s.defaultScore === undefined));
  });

  it("không tự gán verified qua PATCH hồ sơ hoặc tài khoản", async () => {
    const forged = {
      isVerified: true, verifiedAt: new Date(), isCompetencyVerified: true, verifiedReadinessScore: 100,
      competencies: [{ key: "communication", score: 100, evidenceCount: 5 }],
    };
    assert.equal((await api(A, "/api/profile/me", "PATCH", forged)).profile.isVerified, false);
    await api(A, "/api/auth/me", "PATCH", { name: "User A", ...forged });
    assert.equal((await db.collection("users").findOne({ _id: A._id })).isCompetencyVerified, false);
    await assertUnverified(A);
  });
});

describe("PR-07: dữ liệu đã lưu sai", () => {
  it("không được trả ra ở API nào", async () => {
    await poison(B, await addBooking(A));
    await assertUnverified(B);
    const patched = await api(B, "/api/profile/me", "PATCH", { headline: "Kế toán" });
    assert.equal(patched.profile.isVerified, false);
    assert.deepEqual(sourcesOf(patched.profile.competencies), []);
    const { user } = await api(B, "/api/auth/me");
    assert.equal(user.isCompetencyVerified, false);
    assert.equal(user.verifiedReadinessScore, 0);
    assert.deepEqual(user.verifiedCompetencies, []);
  });

  it("có bằng chứng thật thì chỉ giữ bằng chứng thật", async () => {
    await poison(B, await addBooking(A));
    const real = await addInterview(B, 55);
    const { comp, me } = await readAll(B);
    assert.deepEqual(refsOf(comp.competencies), [String(real)]);
    assert.deepEqual(refsOf(me.competencies), [String(real)]);
  });

  it("đọc và sync không âm thầm sửa DB, để còn audit được", async () => {
    await poison(B, await addBooking(A));
    const snapshot = async () => JSON.stringify([
      await db.collection("candidateprofiles").findOne({ userId: B._id }),
      (await db.collection("users").findOne({ _id: B._id })).verifiedCompetencies,
    ]);
    const original = await snapshot();
    await readAll(B);
    await api(B, "/api/users/me/verified-competencies/sync", "POST", {});
    assert.equal(await snapshot(), original);
  });
});
