/**
 * QA-05: seed dữ liệu demo kịch bản 7 bước (`npm run seed:demo-staging`).
 * "Xong khi": một lệnh ra đủ dữ liệu kịch bản demo; miner có đủ dữ liệu (≥ 5 lượt chấm lại có điểm moderator,
 * ≥ 3 công ty đã đồng ý CO-02 có rubric đã duyệt cùng shrmKey cho AI-18). Chạy 2 lần không sinh bản trùng.
 */
import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import { User } from "../models/User.js";
import { Company } from "../models/Company.js";
import { CompanyRubric } from "../models/CompanyRubric.js";
import { JobPost } from "../models/JobPost.js";
import { QuestionBank } from "../models/QuestionBank.js";
import { Mentor } from "../models/Mentor.js";
import { CandidateProfile } from "../models/CandidateProfile.js";
import { CVDocument } from "../models/CVDocument.js";
import { InterviewSession } from "../models/InterviewSession.js";
import { LearningPath } from "../models/LearningPath.js";
import { ModerationItem } from "../models/ModerationItem.js";
import { AIImprovementProposal } from "../models/AIImprovementProposal.js";
import { seedStagingDemo } from "../scripts/seedStagingDemo.js";
import { isValidCompetencyKey } from "../services/competencyFramework.js";
import { isValidRoleCategory } from "../services/roleCategories.js";
import { listPublicJobs } from "../services/publicJobsService.js";
import { eligibleCompanyQuestionsByJob } from "../services/companyInterviewQuestionService.js";
import { listRecentJobs } from "../services/recentJobsService.js";
import { candidateCompanyMetrics } from "../services/companyMetricsService.js";
import { mineImprovementProposals } from "../services/aiImprovementMinerService.js";

const counts = async () => ({
  companies: await Company.countDocuments(),
  users: await User.countDocuments(),
  rubrics: await CompanyRubric.countDocuments(),
  jobs: await JobPost.countDocuments(),
  questions: await QuestionBank.countDocuments(),
  mentors: await Mentor.countDocuments(),
  cvs: await CVDocument.countDocuments(),
  sessions: await InterviewSession.countDocuments(),
  paths: await LearningPath.countDocuments(),
  moderation: await ModerationItem.countDocuments(),
});

describe("QA-05: Seed dữ liệu demo kịch bản 7 bước cho staging", () => {
  let mongod;
  let firstRun;

  before(async () => {
    mongod = await MongoMemoryServer.create();
    process.env.MONGO_URI = mongod.getUri();
    delete process.env.TARGET_MONGO_URI;
    await seedStagingDemo();
    firstRun = await counts();
    await seedStagingDemo();
  });

  after(async () => {
    await mongoose.disconnect();
    if (mongod) await mongod.stop();
  });

  it("chạy lại không sinh bản trùng", async () => {
    assert.deepEqual(await counts(), firstRun);
  });

  it("3 công ty, mỗi công ty 1 Company Moderator, cả 3 đã đồng ý điều khoản CO-02", async () => {
    const companies = await Company.find({}).lean();
    assert.equal(companies.length, 3);
    assert.ok(companies.every((c) => c.rubricSharingConsent?.acceptedAt && c.rubricSharingConsent?.termsVersion));
    for (const email of ["hr.fpt@prointerview.vn", "hr.vng@prointerview.vn", "hr.lumen@prointerview.vn"]) {
      const hr = await User.findOne({ email }).lean();
      assert.equal(hr?.role, "company_moderator", email);
    }
    assert.equal((await User.findOne({ email: "moderator@dev.local" }).lean())?.role, "moderator");
  });

  it("AI-18: ≥ 3 công ty khác nhau có rubric đã duyệt cùng tiêu chí problem_solving, trọng số đủ 100", async () => {
    const rubrics = await CompanyRubric.find({ status: "approved" }).lean();
    const withKey = new Set(rubrics.filter((r) => r.criteria.some((c) => c.shrmKey === "problem_solving")).map((r) => String(r.companyId)));
    assert.ok(withKey.size >= 3, `chỉ ${withKey.size} công ty`);
    for (const r of rubrics) {
      assert.equal(r.criteria.reduce((s, c) => s + c.weight, 0), 100, r.title);
      assert.ok(r.criteria.every((c) => isValidCompetencyKey(c.shrmKey)), r.title);
    }
  });

  it("3 job công khai; job FPT Frontend và VNG có câu doanh nghiệp hợp lệ (JB-06), job Golang thì không", async () => {
    const jobs = await JobPost.find({}).lean();
    assert.equal(jobs.length, 3);
    for (const job of jobs) {
      assert.ok(isValidRoleCategory(job.roleCategory), `roleCategory ${job.roleCategory}`);
      assert.ok(job.requiredCompetencies.every((c) => isValidCompetencyKey(c.shrmKey) && Number.isInteger(c.minLevel)));
    }
    assert.equal((await listPublicJobs({})).pagination.total, 3);
    const eligible = await eligibleCompanyQuestionsByJob(jobs);
    const byTitle = (t) => eligible.get(String(jobs.find((j) => j.title.startsWith(t))._id))?.length ?? 0;
    assert.equal(byTitle("Senior Frontend"), 2);
    assert.equal(byTitle("Fullstack Product"), 2);
    assert.equal(byTitle("Backend Golang"), 0);
  });

  it("ứng viên: 2 CV, lộ trình, 2 job đã xem có câu doanh nghiệp (JB-21), còn lượt phỏng vấn", async () => {
    const candidate = await User.findOne({ email: "candidate.demo@prointerview.vn" }).lean();
    assert.ok(candidate);
    const cvs = await CVDocument.find({ userId: candidate._id }).lean();
    assert.equal(cvs.length, 2);
    assert.equal(cvs.filter((c) => c.isDefault).length, 1);
    assert.ok(await LearningPath.exists({ candidateId: candidate._id }));
    assert.ok(await CandidateProfile.exists({ userId: candidate._id }));
    assert.equal((await Mentor.countDocuments()), 3);
    const recent = await listRecentJobs(candidate._id);
    assert.equal(recent.length, 2);
    assert.ok(recent.every((j) => j.companyQuestionCount > 0));
    assert.ok((candidate.quota?.interviewUsed ?? 0) < (candidate.quota?.interviewLimit ?? 1));
  });

  it("buổi có câu doanh nghiệp FPT đã chấm rubric: chỉ số JB-19 có số liệu, trích dẫn nằm trong câu trả lời", async () => {
    const candidate = await User.findOne({ email: "candidate.demo@prointerview.vn" }).lean();
    const fpt = await Company.findOne({ slug: "fpt-software" }).lean();
    const metrics = await candidateCompanyMetrics(candidate._id, fpt._id);
    assert.equal(metrics.answeredCount, 2);
    assert.equal(metrics.scoredCount, 2);
    assert.ok(metrics.rubricScoreAvg > 0);
    const session = await InterviewSession.findOne({ userId: candidate._id, "companyQuestions.0": { $exists: true } }).lean();
    const scored = session.answers.filter((a) => a.rubricScores?.length);
    assert.equal(scored.length, 2);
    for (const a of scored) {
      for (const r of a.rubricScores) if (r.evidenceQuote) assert.ok(a.transcript.includes(r.evidenceQuote), r.evidenceQuote);
    }
  });

  it("≥ 5 lượt chấm lại có điểm moderator → miner AI-03 tạo được đề xuất cải tiến", async () => {
    assert.ok((await ModerationItem.countDocuments({ status: "resolved", "resolution.action": "override_score" })) >= 5);
    const { created } = await mineImprovementProposals({ notify: false });
    assert.ok(created.length >= 1, "miner không tạo được đề xuất nào từ dữ liệu seed");
    assert.ok(await AIImprovementProposal.exists({ target: "evaluation" }));
  });
});
