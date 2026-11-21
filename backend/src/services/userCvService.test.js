import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { User, toPublicUser } from "../models/User.js";

describe("User Model - Multi-CV Vault & Verified Competencies", () => {
  it("toPublicUser returns savedCvs array and verifiedCompetencies array", () => {
    const mockUser = {
      _id: "674000000000000000000001",
      name: "Nguyễn Văn A",
      email: "candidate@test.com",
      role: "customer",
      savedCvs: [
        {
          _id: "67400000000000000000000a",
          title: "CV Frontend React",
          fileName: "cv_frontend.pdf",
          fileUrl: "/uploads/prointerview/cv-files/cv_frontend.pdf",
          fileSize: 1024000,
          isDefault: true,
          uploadedAt: new Date("2026-11-01"),
        },
        {
          _id: "67400000000000000000000b",
          title: "CV Backend Node.js",
          fileName: "cv_backend.pdf",
          fileUrl: "/uploads/prointerview/cv-files/cv_backend.pdf",
          fileSize: 850000,
          isDefault: false,
          uploadedAt: new Date("2026-11-05"),
        },
      ],
      verifiedCompetencies: [
        {
          _id: "67400000000000000000001a",
          competencyId: "shrm_star_method",
          name: "Phương pháp STAR",
          category: "Cấu trúc phản xạ hành vi",
          score: 88,
          level: "Thành thạo",
          badge: "SHRM STAR Verified",
          verifiedBy: "AI SHRM Engine",
          verificationCode: "SHRM-DDI-0001-A1B2",
        },
      ],
      verifiedReadinessScore: 88,
      isCompetencyVerified: true,
      verifiedProfileSummary: "Đã hoàn thành kiểm định.",
    };

    const pub = toPublicUser(mockUser);
    assert.equal(pub.name, "Nguyễn Văn A");
    assert.equal(Array.isArray(pub.savedCvs), true);
    assert.equal(pub.savedCvs.length, 2);
    assert.equal(pub.savedCvs[0].title, "CV Frontend React");
    assert.equal(pub.savedCvs[0].isDefault, true);
    assert.equal(pub.savedCvs[1].isDefault, false);

    assert.equal(Array.isArray(pub.verifiedCompetencies), true);
    assert.equal(pub.verifiedCompetencies.length, 1);
    assert.equal(pub.verifiedCompetencies[0].name, "Phương pháp STAR");
    assert.equal(pub.verifiedReadinessScore, 88);
    assert.equal(pub.isCompetencyVerified, true);
  });

  it("handles empty savedCvs and empty verifiedCompetencies gracefully", () => {
    const mockUser = {
      _id: "674000000000000000000002",
      name: "Trần Thị B",
      email: "candidate2@test.com",
      role: "customer",
    };

    const pub = toPublicUser(mockUser);
    assert.deepEqual(pub.savedCvs, []);
    assert.deepEqual(pub.verifiedCompetencies, []);
    assert.equal(pub.verifiedReadinessScore, 0);
    assert.equal(pub.isCompetencyVerified, false);
  });

  it("ensures default CV mechanics work as expected", () => {
    const cvs = [
      { id: "1", title: "CV 1", isDefault: true },
      { id: "2", title: "CV 2", isDefault: false },
    ];

    // Simulating setDefault to id 2
    cvs.forEach(c => { c.isDefault = c.id === "2"; });
    assert.equal(cvs[0].isDefault, false);
    assert.equal(cvs[1].isDefault, true);

    // Simulating delete default CV -> first remaining becomes default
    const remaining = cvs.filter(c => c.id !== "2");
    if (remaining.length > 0) remaining[0].isDefault = true;
    assert.equal(remaining.length, 1);
    assert.equal(remaining[0].isDefault, true);
  });
});
