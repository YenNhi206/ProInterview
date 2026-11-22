import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import { User } from "../models/User.js";
import { Company } from "../models/Company.js";
import { CompanyRubric } from "../models/CompanyRubric.js";
import { Mentor } from "../models/Mentor.js";
import { CandidateProfile } from "../models/CandidateProfile.js";
import { CVDocument } from "../models/CVDocument.js";
import { InterviewSession } from "../models/InterviewSession.js";
import { LearningPath } from "../models/LearningPath.js";
import { ModerationItem } from "../models/ModerationItem.js";
import { seedStagingDemo } from "../scripts/seedStagingDemo.js";
import { isValidCompetencyKey } from "../services/competencyFramework.js";
import { isValidRoleCategory } from "../services/roleCategories.js";
import { listPublicJobs } from "../services/publicJobsService.js";

describe("QA-05: Seed dữ liệu demo kịch bản 7 bước cho staging", () => {
  let mongod;

  before(async () => {
    mongod = await MongoMemoryServer.create();
    process.env.MONGO_URI = mongod.getUri();
  });

  after(async () => {
    await mongoose.disconnect();
    if (mongod) await mongod.stop();
  });

  it("Chạy seedStagingDemo tạo đủ 2 công ty, 3 job, rubric duyệt, 3 mentor, candidate 2 CV và >= 5 lượt chấm lại", async () => {
    await seedStagingDemo();

    // 1. Kiểm tra 2 công ty
    const companies = await Company.find({});
    assert.equal(companies.length, 2, "Phải có đúng 2 công ty (FPT & VNG)");

    // 2. Kiểm tra tài khoản Company Moderator & Platform Moderator
    const hrFpt = await User.findOne({ email: "hr.fpt@prointerview.vn" });
    assert.ok(hrFpt);
    assert.equal(hrFpt.role, "company_moderator");

    const platformMod = await User.findOne({ email: "moderator@dev.local" });
    assert.ok(platformMod);
    assert.equal(platformMod.role, "moderator");

    // 3. Kiểm tra rubric được phê duyệt
    const rubric = await CompanyRubric.findOne({ status: "approved" });
    assert.ok(rubric);
    assert.equal(rubric.criteria.reduce((sum, c) => sum + c.weight, 0), 100);

    // 4. Kiểm tra 3 Job Posts đúng model JobPost (JB-01) và hiện ở danh sách công khai (JB-03)
    const jobs = await mongoose.connection.collection("job_posts").find({}).toArray();
    assert.equal(jobs.length, 3, "Phải có đúng 3 Job Posts");
    for (const job of jobs) {
      assert.ok(isValidRoleCategory(job.roleCategory), `roleCategory ${job.roleCategory}`);
      assert.ok(job.requiredCompetencies.length > 0);
      assert.ok(job.requiredCompetencies.every((c) => isValidCompetencyKey(c.shrmKey) && Number.isInteger(c.minLevel)));
      assert.ok(job.publishedAt);
    }
    assert.ok(rubric.criteria.every((c) => isValidCompetencyKey(c.shrmKey)), "Tiêu chí rubric dùng key LP-01");
    const publicJobs = await listPublicJobs({});
    assert.equal(publicJobs.pagination.total, 3, "Cả 3 job demo hiện ở GET /api/jobs");

    // 5. Kiểm tra 3 Mentors
    const mentors = await Mentor.find({});
    assert.equal(mentors.length, 3, "Phải có đúng 3 Mentors");

    // 6. Kiểm tra Candidate có 2 CVs và LearningPath
    const candidate = await User.findOne({ email: "candidate.demo@prointerview.vn" });
    assert.ok(candidate);

    const cvs = await CVDocument.find({ userId: candidate._id });
    assert.equal(cvs.length, 2, "Candidate phải có 2 CVs trong kho");
    assert.equal(cvs.filter((c) => c.isDefault).length, 1, "Đúng 1 CV mặc định");

    const profile = await CandidateProfile.findOne({ userId: candidate._id });
    assert.ok(profile);
    assert.equal(profile.isVerified, true);

    const lp = await LearningPath.findOne({ candidateId: candidate._id });
    assert.ok(lp);
    assert.equal(lp.totalAmount, 1050000);

    // 7. Kiểm tra ít nhất 5 lượt chấm lại để miner đủ ngưỡng
    const rescores = await ModerationItem.countDocuments({ "resolution.action": "override_score" });
    assert.ok(rescores >= 5, "Phải có ít nhất 5 lượt chấm lại");
  });
});
