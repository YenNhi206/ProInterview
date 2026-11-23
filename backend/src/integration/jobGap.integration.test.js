/**
 * JB-05: GET /api/jobs/:id/gap — hồ sơ năng lực so với requiredCompetencies, CV mặc định so với requiredSkills.
 * "Xong khi": trả danh sách thiếu có mức độ và gợi ý bước tiếp.
 */
import { before, after, describe, it } from "node:test";
import assert from "node:assert/strict";
import { applyTestEnv, startMongoHarness, stopMongoHarness, mintAccessToken, startHttpServer, stopHttpServer } from "../test_helpers/mongoTestHarness.js";

applyTestEnv();
process.env.MAIL_USER = "";
process.env.MAIL_PASS = "";

let harness, http, models, gapSvc;
let company, suspendedCo;

const DESCRIPTION = "Xây dựng dịch vụ backend cho nền tảng thanh toán, tối ưu hiệu năng và độ tin cậy của hệ thống.";
let seq = 0;

async function call(user, path) {
  const res = await fetch(`${http.baseUrl}${path}`, {
    headers: user ? { Authorization: `Bearer ${mintAccessToken(user._id)}` } : {},
  });
  return { status: res.status, ...(await res.json()) };
}

function job(overrides = {}) {
  seq += 1;
  return models.JobPost.create({
    companyId: company._id,
    title: `Backend JB05 ${seq}`,
    roleCategory: "backend",
    level: "middle",
    description: DESCRIPTION,
    requiredCompetencies: [
      { shrmKey: "problem_solving", minLevel: 3 },
      { shrmKey: "communication", minLevel: 4 },
      { shrmKey: "teamwork", minLevel: 2 },
      { shrmKey: "leadership", minLevel: 3 },
    ],
    requiredSkills: ["Node.js", "MongoDB", "Docker", "Tiếng Anh"],
    status: "published",
    publishedAt: new Date(),
    ...overrides,
  });
}

function user(role = "customer") {
  seq += 1;
  return models.User.create({ name: `JB05 ${role} ${seq}`, email: `jb05-${role}-${seq}@test.local`, role });
}

before(async () => {
  harness = await startMongoHarness();
  models = await import("../models/index.js");
  gapSvc = await import("../services/jobGapService.js");
  await Promise.all(Object.values(models).filter((m) => m?.modelName).map((m) => m.init()));
  company = await models.Company.create({ name: "Công ty Gamma", slug: "jb05-gamma" });
  suspendedCo = await models.Company.create({ name: "Công ty khóa", slug: "jb05-locked", status: "suspended" });
  http = await startHttpServer((await import("../app.js")).createApp());
});

after(async () => {
  if (http) await stopHttpServer(http.server);
  if (harness) await stopMongoHarness(harness);
});

describe("GET /api/jobs/:id/gap (JB-05)", () => {
  it("trả năng lực thiếu có mức độ + gợi ý; kỹ năng CV mặc định khớp / thiếu", async () => {
    const candidate = await user();
    const j = await job();
    const cv = await models.CVDocument.create({
      userId: candidate._id,
      title: "CV Backend",
      isDefault: true,
      skills: ["NodeJS"],
      content: { skills: ["mongodb"], projects: [{ name: "API", technologies: ["docker"] }] },
    });
    await models.CandidateProfile.create({
      userId: candidate._id,
      defaultCvId: cv._id,
      competencies: [
        { key: "problem_solving", level: 3, evidenceCount: 2 }, // đạt
        { key: "communication", level: 1, evidenceCount: 1 }, // thiếu 3 bậc → high
        { key: "teamwork", level: 1, evidenceCount: 0 }, // level mặc định, chưa có bằng chứng
        // leadership: không có trong hồ sơ
      ],
    });

    const res = await call(candidate, `/api/jobs/${j._id}/gap`);
    assert.equal(res.status, 200);
    const { gap } = res;
    assert.equal(gap.job.id, String(j._id));
    assert.equal(gap.job.company.name, "Công ty Gamma");

    const byKey = Object.fromEntries(gap.competencies.map((c) => [c.shrmKey, c]));
    assert.equal(byKey.problem_solving.status, "met");
    assert.equal(byKey.problem_solving.severity, null);
    assert.equal(byKey.problem_solving.nextStep, null);

    assert.equal(byKey.communication.status, "below");
    assert.equal(byKey.communication.gap, 3);
    assert.equal(byKey.communication.severity, "high");
    assert.equal(byKey.communication.nextStep.type, "mentor_request");
    assert.equal(byKey.communication.nextStep.actionUrl, `/mentor-requests?jobPostId=${j._id}`);
    assert.ok(byKey.communication.name);

    for (const key of ["teamwork", "leadership"]) {
      assert.equal(byKey[key].status, "no_evidence");
      assert.equal(byKey[key].currentLevel, null);
      assert.equal(byKey[key].severity, "unknown");
      assert.equal(byKey[key].nextStep.type, "ai_interview");
    }

    assert.deepEqual(gap.skills.cv, { id: String(cv._id), title: "CV Backend" });
    assert.deepEqual(gap.skills.matched, ["Node.js", "MongoDB", "Docker"]);
    assert.equal(gap.skills.missing.length, 1);
    assert.equal(gap.skills.missing[0].skill, "Tiếng Anh");
    assert.equal(gap.skills.missing[0].nextStep.type, "course");

    assert.deepEqual(gap.summary, {
      competenciesMet: 1, competenciesTotal: 4, competenciesNoEvidence: 2, skillsMatched: 3, skillsTotal: 4,
    });
  });

  it("chưa có hồ sơ, chưa có CV: mọi năng lực no_evidence, mọi kỹ năng thiếu, gợi ý chọn CV; không tạo hồ sơ", async () => {
    const candidate = await user();
    const j = await job();
    const res = await call(candidate, `/api/jobs/${j._id}/gap`);
    assert.equal(res.status, 200);
    assert.ok(res.gap.competencies.every((c) => c.status === "no_evidence"));
    assert.equal(res.gap.skills.cv, null);
    assert.equal(res.gap.skills.missing.length, 4);
    assert.ok(res.gap.skills.missing.every((m) => m.nextStep.type === "update_cv"));
    assert.equal(await models.CandidateProfile.countDocuments({ userId: candidate._id }), 0);
  });

  it("CV mặc định lấy theo hồ sơ; CV của người khác không được dùng", async () => {
    const candidate = await user();
    const other = await user();
    const j = await job({ requiredSkills: ["Docker"] });
    const foreign = await models.CVDocument.create({ userId: other._id, title: "CV người khác", skills: ["Docker"], isDefault: true });
    await models.CandidateProfile.create({ userId: candidate._id, defaultCvId: foreign._id });
    const res = await call(candidate, `/api/jobs/${j._id}/gap`);
    assert.equal(res.gap.skills.cv, null);
    assert.deepEqual(res.gap.skills.matched, []);
  });

  it("chưa đăng nhập 401; không phải ứng viên 403; job không mở 404; id sai 400", async () => {
    const j = await job();
    assert.equal((await call(null, `/api/jobs/${j._id}/gap`)).status, 401);
    const mentor = await user("mentor");
    assert.equal((await call(mentor, `/api/jobs/${j._id}/gap`)).status, 403);

    const candidate = await user();
    const draft = await job({ status: "draft", publishedAt: null });
    const locked = await job({ companyId: suspendedCo._id });
    for (const closed of [draft, locked]) {
      const res = await call(candidate, `/api/jobs/${closed._id}/gap`);
      assert.equal(res.status, 404);
      assert.equal(res.success, false);
    }
    assert.equal((await call(candidate, "/api/jobs/abc/gap")).status, 400);
  });
});

describe("normalizeSkill (JB-05)", () => {
  it("bỏ dấu, hoa/thường, ký tự đặc biệt, đuôi js; giữ C++ / C# khác C", () => {
    const n = gapSvc.normalizeSkill;
    assert.equal(n("React.js"), n("react"));
    assert.equal(n("ReactJS"), n("React"));
    assert.equal(n("Tiếng Anh"), n("tieng anh"));
    assert.notEqual(n("C++"), n("C"));
    assert.notEqual(n("C#"), n("C"));
    assert.notEqual(n("Java"), n("JavaScript"));
    assert.equal(n("js"), "js");
  });
});
