import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  answersBySession,
  applicationActions,
  cvSections,
  formatRubricScore,
  isSafeFileUrl,
  isSafeHttpUrl,
} from "./applicationReview.js";

describe("applicationReview (JB-16)", () => {
  it("chỉ đơn submitted / viewed còn shortlist hoặc từ chối được", () => {
    assert.deepEqual(applicationActions("submitted"), { shortlist: true, reject: true });
    assert.deepEqual(applicationActions("viewed"), { shortlist: true, reject: true });
    for (const s of ["shortlisted", "rejected", "withdrawn", undefined]) {
      assert.deepEqual(applicationActions(s), { shortlist: false, reject: false });
    }
  });

  it("formatRubricScore làm tròn 1 chữ số, thiếu điểm hiện —", () => {
    assert.equal(formatRubricScore(4.26), "4.3/5");
    assert.equal(formatRubricScore(0), "0/5");
    assert.equal(formatRubricScore(null), "—");
    assert.equal(formatRubricScore(undefined), "—");
    assert.equal(formatRubricScore("abc"), "—");
  });

  it("isSafeHttpUrl chặn javascript: và chuỗi rác", () => {
    assert.equal(isSafeHttpUrl("https://cdn.test/cv.pdf"), true);
    assert.equal(isSafeHttpUrl("javascript:alert(1)"), false);
    assert.equal(isSafeHttpUrl("/uploads/cv.pdf"), false);
    assert.equal(isSafeHttpUrl(""), false);
  });

  it("file CV lưu trên backend (/uploads/...) vẫn mở được, chặn đường dẫn lạ", () => {
    assert.equal(isSafeFileUrl("/uploads/cv_1764_VoYenNhi.pdf"), true);
    assert.equal(isSafeFileUrl("https://res.cloudinary.com/x/raw/upload/cv.pdf"), true);
    assert.equal(isSafeFileUrl("//evil.test/cv.pdf"), false);
    assert.equal(isSafeFileUrl("/uploads/../.env"), false);
    assert.equal(isSafeFileUrl("javascript:alert(1)"), false);
    assert.equal(cvSections({ title: "CV", fileUrl: "/uploads/cv_1.pdf" }).fileUrl, "/uploads/cv_1.pdf");
  });

  it("cvSections bỏ mục rỗng, gộp kỹ năng không trùng, bỏ link không an toàn", () => {
    const out = cvSections({
      title: "CV Backend",
      fileUrl: "javascript:alert(1)",
      skills: ["Node.js", "MongoDB"],
      content: {
        summary: "  Backend 2 năm ",
        skills: ["node.js", "Docker"],
        experiences: [
          { company: "ACME", position: "Dev", startDate: "2024", isCurrent: true, bullets: ["Làm API", " "] },
          { company: "", position: "" },
        ],
        educations: [{ institution: "" }],
        projects: [{ name: "Shop", link: "javascript:x" }, { name: "", link: "https://x.dev" }],
      },
    });
    assert.equal(out.fileUrl, "");
    assert.equal(out.summary, "Backend 2 năm");
    assert.deepEqual(out.skills, ["Node.js", "MongoDB", "Docker"]);
    assert.equal(out.experiences.length, 1);
    assert.equal(out.experiences[0].title, "Dev · ACME");
    assert.equal(out.experiences[0].period, "2024 – nay");
    assert.deepEqual(out.experiences[0].bullets, ["Làm API"]);
    assert.equal(out.educations.length, 0);
    assert.deepEqual(out.projects.map((p) => [p.name, p.link]), [["Shop", ""]]);
    assert.equal(cvSections(null), null);
  });

  it("answersBySession gom theo buổi, buổi mới trước, câu theo thứ tự trong buổi", () => {
    const groups = answersBySession([
      { sessionId: "s1", date: "2026-11-20", questionIndex: 4 },
      { sessionId: "s2", date: "2026-11-22", questionIndex: 3 },
      { sessionId: "s1", date: "2026-11-20", questionIndex: 3 },
    ]);
    assert.deepEqual(groups.map((g) => g.sessionId), ["s2", "s1"]);
    assert.deepEqual(groups[1].answers.map((a) => a.questionIndex), [3, 4]);
    assert.deepEqual(answersBySession(undefined), []);
  });
});
