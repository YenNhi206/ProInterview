/**
 * Integration AI-10: GET /api/recommendations/me — gợi ý mentor, khóa học, job theo luật có trọng số.
 * "Xong khi": mỗi gợi ý kèm một dòng lý do.
 */
import { before, after, describe, it } from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import { applyTestEnv, startMongoHarness, stopMongoHarness, mintAccessToken, startHttpServer, stopHttpServer } from "../test_helpers/mongoTestHarness.js";

applyTestEnv();
process.env.MAIL_USER = "";
process.env.MAIL_PASS = "";

let harness, http, models;
let seq = 0;
const DESCRIPTION = "Xây dựng dịch vụ backend cho nền tảng thanh toán, tối ưu hiệu năng và độ tin cậy của hệ thống.";

async function call(user, path) {
  const res = await fetch(`${http.baseUrl}${path}`, {
    headers: user ? { Authorization: `Bearer ${mintAccessToken(user._id)}` } : {},
  });
  return { status: res.status, ...(await res.json()) };
}

async function user(role = "customer") {
  seq += 1;
  return models.User.create({ name: `AI10 ${role} ${seq}`, email: `ai10-${role}-${seq}@test.local`, role });
}

async function mentor({ specialties = [], rating = 0, reviewCount = 0, verified = true, title = "Kỹ sư phần mềm" } = {}) {
  const u = await user("mentor");
  let m = await models.Mentor.findOne({ userId: u._id });
  if (!m) m = await models.Mentor.create({ userId: u._id, name: u.name, title, company: "ACME", pricePerHour: 200000 });
  await models.Mentor.updateOne(
    { _id: m._id },
    { $set: { publicId: `ai10-m-${seq}`, title, specialties, fields: [], bio: "", isVerified: verified, isActive: true, "stats.rating": rating, "stats.reviewCount": reviewCount } },
  );
  return models.Mentor.findById(m._id).lean();
}

before(async () => {
  harness = await startMongoHarness();
  models = await import("../models/index.js");
  await Promise.all(Object.values(models).filter((m) => m?.modelName).map((m) => m.init()));
  http = await startHttpServer((await import("../app.js")).createApp());
});

after(async () => {
  if (http) await stopHttpServer(http.server);
  if (harness) await stopMongoHarness(harness);
});

describe("GET /api/recommendations/me (AI-10)", () => {
  it("gợi ý theo năng lực còn thiếu; mỗi gợi ý có lý do và link", async () => {
    const candidate = await user();
    await models.CandidateProfile.create({
      userId: candidate._id,
      targetRole: "Backend",
      competencies: [
        { key: "communication", level: 1, evidenceCount: 2 }, // thiếu nhiều nhất
        { key: "leadership", level: 2, evidenceCount: 1 },
        { key: "problem_solving", level: 4, evidenceCount: 3 }, // đã đạt
        { key: "teamwork", level: 1, evidenceCount: 0 }, // chưa có bằng chứng → không tính thiếu
        { key: "technical_mastery", level: 1, evidenceCount: 5 }, // key không có trong bộ tiêu chí
      ],
    });

    const commMentor = await mentor({ specialties: ["Giao tiếp", "Kỹ năng thuyết phục khi phỏng vấn"], rating: 4, reviewCount: 3 });
    const topRated = await mentor({ specialties: ["Kubernetes"], rating: 5, reviewCount: 80 });
    const teacher = await mentor({ specialties: ["Golang"] });
    await mentor({ specialties: ["Giao tiếp"], rating: 5, reviewCount: 99, verified: false }); // chưa xác minh

    const reqId = new mongoose.Types.ObjectId();
    const path = await models.LearningPath.create({ candidateId: (await user())._id, mentorId: teacher._id, mentorshipRequestId: reqId });
    await models.LearningPathSession.create({ pathId: path._id, order: 1, title: "Buổi 1", shrmKeys: ["leadership"], status: "done" });

    const commCourse = await models.Course.create({
      mentorId: commMentor._id, title: "Trình bày và thuyết phục trong phỏng vấn", description: "Kỹ năng giao tiếp", level: "basic", status: "published", price: 100000,
    });
    const popular = await models.Course.create({
      mentorId: topRated._id, title: "Kubernetes nâng cao", level: "advanced", status: "published", price: 100000, stats: { rating: 5, reviewCount: 40 },
    });
    const enrolled = await models.Course.create({
      mentorId: commMentor._id, title: "Giao tiếp nâng cao", description: "Giao tiếp", level: "basic", status: "published", price: 0, isFree: true,
    });
    await models.Course.create({ mentorId: commMentor._id, title: "Giao tiếp bản nháp", level: "basic", status: "draft" });
    await models.Enrollment.create({ userId: candidate._id, courseId: enrolled._id, paymentStatus: "paid" });

    const company = await models.Company.create({ name: "Công ty AI10", slug: `ai10-co-${seq}` });
    const goodJob = await models.JobPost.create({
      companyId: company._id, title: "Backend Engineer", roleCategory: "backend", level: "middle", description: DESCRIPTION,
      requiredCompetencies: [{ shrmKey: "problem_solving", minLevel: 3 }, { shrmKey: "communication", minLevel: 3 }],
      status: "published", publishedAt: new Date(Date.now() - 60_000),
    });
    const otherJob = await models.JobPost.create({
      companyId: company._id, title: "Data Analyst", roleCategory: "data", level: "junior", description: DESCRIPTION,
      requiredCompetencies: [{ shrmKey: "leadership", minLevel: 4 }], status: "published", publishedAt: new Date(),
    });
    await models.JobPost.create({
      companyId: company._id, title: "Job đã đóng", roleCategory: "backend", level: "middle", description: DESCRIPTION,
      requiredCompetencies: [{ shrmKey: "problem_solving", minLevel: 1 }], status: "closed",
    });

    const res = await call(candidate, "/api/recommendations/me");
    assert.equal(res.status, 200);
    const r = res.recommendations;

    assert.deepEqual(r.basis.gaps.map((g) => g.key), ["communication", "leadership"]);

    // Mentor: 2 mentor khớp năng lực thiếu đứng trước mentor 5★ không khớp; mentor chưa xác minh không có.
    const mentorIds = r.mentors.map((m) => m.id);
    assert.equal(mentorIds.length, 3);
    assert.deepEqual(new Set(mentorIds.slice(0, 2)), new Set([commMentor.publicId, teacher.publicId]));
    assert.equal(mentorIds[2], topRated.publicId);
    const byId = Object.fromEntries(r.mentors.map((m) => [m.id, m]));
    assert.match(byId[commMentor.publicId].reason, /Giao tiếp/);
    assert.match(byId[teacher.publicId].reason, /Đã dạy 1 buổi lộ trình về "Lãnh đạo/);
    assert.match(byId[topRated.publicId].reason, /5★ \(80 đánh giá\)/);
    assert.equal(byId[commMentor.publicId].actionUrl, `/mentors/${commMentor.publicId}`);

    // Khóa: khóa khớp năng lực trước khóa nổi tiếng; bỏ khóa đã ghi danh và bản nháp.
    assert.deepEqual(r.courses.map((c) => c.id), [String(commCourse._id), String(popular._id)]);
    assert.match(r.courses[0].reason, /Bổ trợ năng lực "Giao tiếp/);
    assert.equal(r.courses[0].actionUrl, `/courses/${commCourse._id}`);

    // Job: job đã đạt 1/2 năng lực + đúng vị trí mục tiêu đứng đầu; không có job đóng.
    assert.deepEqual(r.jobs.map((j) => j.id), [String(goodJob._id), String(otherJob._id)]);
    assert.match(r.jobs[0].reason, /Bạn đã đạt 1\/2 năng lực job yêu cầu, đúng vị trí mục tiêu/);
    assert.match(r.jobs[1].reason, /Tin mới đăng/);
    assert.equal(r.jobs[0].company.name, "Công ty AI10");
    assert.equal(r.jobs[0].actionUrl, `/jobs/${goodJob._id}`);

    for (const list of [r.mentors, r.courses, r.jobs]) {
      for (const item of list) {
        assert.equal(typeof item.reason, "string");
        assert.ok(item.reason.length > 0 && !item.reason.includes("\n"));
        assert.ok(item.actionUrl.startsWith("/"));
      }
    }
  });

  it("chưa có hồ sơ: vẫn gợi ý theo đánh giá, không ghi DB; limit hoạt động", async () => {
    const candidate = await user();
    const res = await call(candidate, "/api/recommendations/me?limit=1");
    assert.equal(res.status, 200);
    assert.deepEqual(res.recommendations.basis.gaps, []);
    assert.ok(res.recommendations.mentors.length <= 1);
    assert.ok(res.recommendations.courses.length <= 1);
    assert.equal(await models.CandidateProfile.countDocuments({ userId: candidate._id }), 0);
  });

  it("401 khi chưa đăng nhập, 403 với mentor, 400 với limit sai", async () => {
    assert.equal((await call(null, "/api/recommendations/me")).status, 401);
    assert.equal((await call(await user("mentor"), "/api/recommendations/me")).status, 403);
    const res = await call(await user(), "/api/recommendations/me?limit=50");
    assert.equal(res.status, 400);
    assert.equal(res.success, false);
  });
});
