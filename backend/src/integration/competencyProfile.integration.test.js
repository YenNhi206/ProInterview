/**
 * Integration PR-06: gộp hồ sơ năng lực từ phỏng vấn AI, buổi lộ trình, khóa học hoàn thành.
 * "Xong khi": mỗi năng lực có level, số bằng chứng và danh sách nguồn.
 */
import { before, after, describe, it } from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import { applyTestEnv, startMongoHarness, stopMongoHarness, mintAccessToken, startHttpServer, stopHttpServer } from "../test_helpers/mongoTestHarness.js";

applyTestEnv();
process.env.MAIL_USER = "";
process.env.MAIL_PASS = "";

let harness, http, models, svc, baseline;
let seq = 0;
const DAY = 86_400_000;

async function candidate() {
  seq += 1;
  return models.User.create({ name: `PR06 ${seq}`, email: `pr06-${seq}@test.local`, role: "customer" });
}

async function get(user, path) {
  const res = await fetch(`${http.baseUrl}${path}`, { headers: { Authorization: `Bearer ${mintAccessToken(user._id)}` } });
  return { status: res.status, ...(await res.json()) };
}

/** Buổi phỏng vấn AI completed: mỗi phần tử { question, competencyId?, overall5, override?, incomplete?, transcript? }. */
function interview(userId, rows, { status = "completed", daysAgo = 1 } = {}) {
  return models.InterviewSession.create({
    userId,
    hrGender: "female",
    status,
    completedAt: new Date(Date.now() - daysAgo * DAY),
    questions: rows.map((r, i) => ({ id: `q${i}`, question: r.question ?? `Câu hỏi ${i}`, competencyId: r.competencyId ?? "" })),
    answers: rows.map((r, i) => ({
      questionIndex: i,
      transcript: r.transcript ?? "Em đã làm việc này và có kết quả cụ thể.",
      evaluationIncomplete: Boolean(r.incomplete),
      moderatorOverride: r.override ?? null,
    })),
    feedback: { perQuestion: rows.map((r, i) => ({ questionIndex: i, overall5: r.overall5, score: Math.round(r.overall5 * 20) })) },
  });
}

before(async () => {
  harness = await startMongoHarness();
  models = await import("../models/index.js");
  svc = await import("../services/competencyProfileService.js");
  ({ BASELINE_QUESTIONS: baseline } = await import("../config/baselineQuestions.js"));
  await Promise.all(Object.values(models).filter((m) => m?.modelName).map((m) => m.init()));
  http = await startHttpServer((await import("../app.js")).createApp());
});

after(async () => {
  if (http) await stopHttpServer(http.server);
  if (harness) await stopMongoHarness(harness);
});

describe("PR-06: nguồn và cách tính mức", () => {
  it("phỏng vấn AI: gộp theo key từng câu, câu baseline tra theo nội dung, bỏ buổi bỏ dở / chấm thiếu / key lạ", async () => {
    const u = await candidate();
    await interview(u._id, [
      { question: baseline[0].question, overall5: 4 }, // baseline-1 (session cũ, competencyId rỗng) → communication, mức 3
      { question: baseline[1].question, overall5: 3 }, // baseline-2 → problem_solving, mức 2
      { question: baseline[2].question, overall5: 5 }, // baseline-3 không gắn năng lực → bỏ
      { competencyId: "teamwork", overall5: 2, incomplete: true }, // chấm thiếu → bỏ
      { competencyId: "technical_mastery", overall5: 5 }, // key ngoài LP-01 → bỏ
      { competencyId: "leadership", overall5: 2, override: { overall: 4.5, scores: {} } }, // điểm moderator: 3.5
    ]);
    await interview(u._id, [{ competencyId: "communication", overall5: 5 }], { status: "abandoned" });

    const rows = await svc.recomputeCompetencyProfile(u._id);
    const byKey = Object.fromEntries(rows.map((r) => [r.key, r]));
    assert.deepEqual(Object.keys(byKey).sort(), ["communication", "leadership", "problem_solving"]);
    assert.equal(byKey.communication.level, 3);
    assert.equal(byKey.problem_solving.level, 2);
    assert.equal(byKey.leadership.level, 3.5);
    assert.match(byKey.leadership.sources[0].title, /moderator đã chấm lại/);
    for (const r of rows) {
      assert.equal(r.evidenceCount, 1);
      assert.equal(r.sources.length, 1);
      assert.equal(r.sources[0].type, "ai_interview");
      assert.ok(r.name);
    }
  });

  it("trung bình có trọng số: 5 điểm AI + 3 điểm mentor gần nhất, mentor hệ số 2", async () => {
    const u = await candidate();
    // 6 buổi AI về communication, buổi cũ nhất (mức 0) bị bỏ vì chỉ lấy 5 gần nhất.
    for (let d = 6; d >= 1; d -= 1) {
      await interview(u._id, [{ competencyId: "communication", overall5: d === 6 ? 0.5 : 3 }], { daysAgo: d });
    }
    const path = await models.LearningPath.create({ candidateId: u._id, mentorId: new mongoose.Types.ObjectId(), mentorshipRequestId: new mongoose.Types.ObjectId() });
    await models.LearningPathSession.create({
      pathId: path._id, order: 1, title: "Giao tiếp", shrmKeys: ["communication"], status: "done", doneAt: new Date(),
      feedback: { scores: [{ shrmKey: "communication", score: 4 }, { shrmKey: "teamwork", score: null }] },
    });
    // Buổi chưa done không tính.
    await models.LearningPathSession.create({
      pathId: path._id, order: 2, title: "Chưa học", shrmKeys: ["communication"], status: "scheduled",
      feedback: { scores: [{ shrmKey: "communication", score: 0 }] },
    });

    const rows = await svc.recomputeCompetencyProfile(u._id);
    const comm = rows.find((r) => r.key === "communication");
    // AI: 5 × mức 2 (overall5 3 − 1); mentor: 4 × 2 → (10 + 8) / 7 = 2.57
    assert.equal(comm.level, 2.57);
    assert.equal(comm.evidenceCount, 7, "6 điểm AI + 1 điểm mentor (không giới hạn khi đếm)");
    assert.equal(comm.sources[0].type, "mentor_session", "nguồn mới nhất trước");
    assert.equal(comm.sources[0].level, 4);
    assert.ok(!rows.some((r) => r.key === "teamwork"), "điểm null của mentor không tạo năng lực");
  });

  it("khóa học hoàn thành chỉ ghi nguồn: không đổi mức, không tính bằng chứng", async () => {
    const u = await candidate();
    const mentorId = new mongoose.Types.ObjectId();
    const course = await models.Course.create({
      mentorId, title: "Kỹ năng giao tiếp và thuyết phục khi phỏng vấn", description: "Giao tiếp & Trình bày", level: "basic", status: "published",
    });
    const other = await models.Course.create({ mentorId, title: "Lãnh đạo nhóm nhỏ", level: "basic", status: "published" });
    await models.Enrollment.create({ userId: u._id, courseId: course._id, paymentStatus: "paid", progressPercent: 100, completedAt: new Date() });
    await models.Enrollment.create({ userId: u._id, courseId: other._id, paymentStatus: "paid", progressPercent: 40 });

    let rows = await svc.recomputeCompetencyProfile(u._id);
    const onlyCourse = rows.find((r) => r.key === "communication");
    assert.equal(onlyCourse.level, null);
    assert.equal(onlyCourse.evidenceCount, 0);
    assert.equal(onlyCourse.sources[0].type, "course");
    assert.ok(!rows.some((r) => r.key === "leadership"), "khóa chưa hoàn thành không tính");

    await interview(u._id, [{ competencyId: "communication", overall5: 4 }]);
    rows = await svc.recomputeCompetencyProfile(u._id);
    const comm = rows.find((r) => r.key === "communication");
    assert.equal(comm.level, 3, "khóa học không kéo mức");
    assert.equal(comm.evidenceCount, 1);
    assert.equal(comm.sources.length, 2);
  });

  it("chưa có bằng chứng nào: không tạo hồ sơ", async () => {
    const u = await candidate();
    assert.deepEqual(await svc.recomputeCompetencyProfile(u._id), []);
    assert.equal(await models.CandidateProfile.countDocuments({ userId: u._id }), 0);
  });
});

describe("PR-06: API và cập nhật theo sự kiện", () => {
  it("GET /api/profile/me/competencies gộp lại hồ sơ cách cũ (technical_mastery, 6 key khung) rồi trả level, số bằng chứng, nguồn", async () => {
    const u = await candidate();
    await models.CandidateProfile.create({
      userId: u._id,
      competencies: [
        { key: "technical_mastery", level: 4, evidenceCount: 3, sources: [{ type: "ai_interview", title: "cũ" }] },
        { key: "leadership", level: 1, evidenceCount: 0 },
      ],
    });
    await interview(u._id, [{ competencyId: "problem_solving", overall5: 4.5 }]);

    const res = await get(u, "/api/profile/me/competencies");
    assert.equal(res.status, 200);
    assert.deepEqual(res.competencies.map((c) => c.key), ["problem_solving"]);
    const [c] = res.competencies;
    assert.equal(c.level, 3.5);
    assert.equal(c.evidenceCount, 1);
    assert.equal(c.sources.length, 1);
    assert.equal(res.snapshot.competencies[0].key, "problem_solving");
    const saved = await models.CandidateProfile.findOne({ userId: u._id }).lean();
    assert.equal(saved.competenciesVersion, svc.COMPETENCY_PROFILE_VERSION);
    assert.equal(saved.isVerified, true);
  });

  it("hồ sơ mới tạo không có năng lực khung nào", async () => {
    const u = await candidate();
    const res = await get(u, "/api/profile/me/competencies");
    assert.equal(res.status, 200);
    assert.deepEqual(res.competencies, []);
  });

  it("moderator chấm lại → hồ sơ của chủ buổi cập nhật", async () => {
    const u = await candidate();
    const mod = await models.User.create({ name: "Mod PR06", email: `pr06-mod-${seq}@test.local`, role: "moderator" });
    const s = await interview(u._id, [{ competencyId: "teamwork", overall5: 2 }]);
    await svc.recomputeCompetencyProfile(u._id);
    const item = await models.ModerationItem.create({
      type: "evaluation_report", refs: { sessionId: s._id, questionIndex: 0, userId: u._id }, snapshot: {},
    });
    const res = await fetch(`${http.baseUrl}/api/moderator/queue/${item._id}/resolve`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${mintAccessToken(mod._id)}` },
      body: JSON.stringify({ action: "override_score", note: "Ví dụ cụ thể", payload: { scores: { clarity: 4, structure: 4, relevance: 4, credibility: 4 }, shrmLevel: "proficient" } }),
    });
    assert.equal(res.status, 200, await res.text());
    await svc.waitForCompetencyRecomputes();
    const profile = await models.CandidateProfile.findOne({ userId: u._id }).lean();
    assert.equal(profile.competencies.find((c) => c.key === "teamwork").level, 3);
  });

  it("hệ A đã gỡ: /api/users/me/cvs và /api/users/me/verified-competencies trả 404", async () => {
    const u = await candidate();
    assert.equal((await fetch(`${http.baseUrl}/api/users/me/cvs`, { headers: { Authorization: `Bearer ${mintAccessToken(u._id)}` } })).status, 404);
    assert.equal((await fetch(`${http.baseUrl}/api/users/me/verified-competencies`, { headers: { Authorization: `Bearer ${mintAccessToken(u._id)}` } })).status, 404);
  });
});

describe("PR-06: câu baseline và câu follow-up", () => {
  it("key câu baseline có trong bộ tiêu chí; câu 3 để trống", async () => {
    const { isValidCompetencyKey } = await import("../services/competencyFramework.js");
    assert.equal(baseline[0].competencyId, "communication");
    assert.equal(baseline[1].competencyId, "problem_solving");
    assert.equal(baseline[2].competencyId, "");
    for (const q of baseline.slice(0, 2)) assert.ok(isValidCompetencyKey(q.competencyId));
  });

  it("POST /api/interviews/sessions gắn key câu baseline theo config, không tin FE", async () => {
    const u = await candidate();
    const res = await fetch(`${http.baseUrl}/api/interviews/sessions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${mintAccessToken(u._id)}` },
      body: JSON.stringify({ hrGender: "female", questions: baseline.map((q) => ({ ...q, competencyId: "leadership" })) }),
    });
    const body = await res.json();
    assert.ok(res.status === 200 || res.status === 201, JSON.stringify(body));
    const saved = await models.InterviewSession.findOne({ userId: u._id }).lean();
    assert.deepEqual(saved.questions.slice(0, 3).map((q) => q.competencyId), ["communication", "problem_solving", ""]);
  });
});

describe("PR-06: script gộp lại dữ liệu cũ", () => {
  it("dry run không ghi; chạy thật đưa mọi hồ sơ về phiên bản mới, hồ sơ không còn nguồn thành rỗng", async () => {
    const { recomputeAll } = await import("../scripts/recomputeCompetencyProfiles.js");
    const stale = await candidate();
    await models.CandidateProfile.create({ userId: stale._id, competencies: [{ key: "technical_mastery", level: 4, evidenceCount: 2 }] });
    const fresh = await candidate();
    await interview(fresh._id, [{ competencyId: "communication", overall5: 4 }]);
    const silent = () => {};

    const dry = await recomputeAll({ dryRun: true, log: silent });
    assert.ok(dry.total >= 2);
    assert.equal((await models.CandidateProfile.findOne({ userId: stale._id }).lean()).competencies[0].key, "technical_mastery");

    const run = await recomputeAll({ log: silent });
    assert.equal(run.failed, 0);
    const staleAfter = await models.CandidateProfile.findOne({ userId: stale._id }).lean();
    assert.deepEqual(staleAfter.competencies, []);
    assert.equal(staleAfter.competenciesVersion, svc.COMPETENCY_PROFILE_VERSION);
    const freshAfter = await models.CandidateProfile.findOne({ userId: fresh._id }).lean();
    assert.equal(freshAfter.competencies[0].key, "communication");

    assert.equal((await recomputeAll({ dryRun: true, log: silent })).total, 0, "chạy lại không còn gì");
  });
});
