import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  normalizeCvContent,
  toSavePayload,
  isContentChanged,
  splitList,
  normalizeBulletText,
  extractBulletSuggestions,
  findBulletMatches,
  applyBulletSuggestion,
  appendBullet,
  pdfFileName,
} from "./cvEditor.js";

const cv = (experiences) => normalizeCvContent({ experiences });

describe("normalizeCvContent (PR-13)", () => {
  it("nội dung rỗng / null → đủ shape", () => {
    const c = normalizeCvContent(null);
    assert.equal(c.personalInfo.fullName, "");
    assert.deepEqual(c.experiences, []);
    assert.deepEqual(c.skills, []);
  });

  it("điền field thiếu, ép kiểu chuỗi", () => {
    const c = normalizeCvContent({ experiences: [{ company: "VNG", bullets: ["A", 3] }], projects: [{ name: "X" }] });
    assert.equal(c.experiences[0].position, "");
    assert.equal(c.experiences[0].isCurrent, false);
    assert.deepEqual(c.experiences[0].bullets, ["A", "3"]);
    assert.deepEqual(c.projects[0].technologies, []);
  });
});

describe("toSavePayload / isContentChanged", () => {
  it("trim, bỏ bullet rỗng, bỏ mục trống, bỏ kỹ năng trùng, đang làm thì xóa ngày kết thúc", () => {
    const payload = toSavePayload({
      summary: "  Tóm tắt  ",
      experiences: [
        { company: " VNG ", bullets: [" Làm A ", "", "  "], isCurrent: true, endDate: "2025" },
        { company: "", position: "", bullets: [""] },
      ],
      educations: [{ institution: "" }],
      skills: ["React", "react", " Node "],
      projects: [{ name: "P", technologies: ["TS", "ts"] }],
    });
    assert.equal(payload.summary, "Tóm tắt");
    assert.equal(payload.experiences.length, 1);
    assert.deepEqual(payload.experiences[0].bullets, ["Làm A"]);
    assert.equal(payload.experiences[0].company, "VNG");
    assert.equal(payload.experiences[0].endDate, "");
    assert.deepEqual(payload.educations, []);
    assert.deepEqual(payload.skills, ["React", "Node"]);
    assert.deepEqual(payload.projects[0].technologies, ["TS"]);
  });

  it("chỉ thêm khoảng trắng / dòng trống thì không tính là đổi", () => {
    const saved = { summary: "A", experiences: [{ company: "X", bullets: ["B"] }] };
    assert.equal(isContentChanged(saved, { summary: "A ", experiences: [{ company: "X", bullets: ["B", ""] }] }), false);
    assert.equal(isContentChanged(saved, { summary: "A2", experiences: [{ company: "X", bullets: ["B"] }] }), true);
  });
});

describe("splitList", () => {
  it("tách theo dấu phẩy, chấm phẩy, xuống dòng; bỏ trùng không phân biệt hoa thường", () => {
    assert.deepEqual(splitList("React, Node.js; react\nMongoDB,,"), ["React", "Node.js", "MongoDB"]);
  });
});

describe("gợi ý AI viết lại bullet", () => {
  it("normalizeBulletText bỏ ký hiệu đầu dòng, dấu câu cuối, khoảng trắng, hoa thường", () => {
    assert.equal(normalizeBulletText("•  Xây dựng   API REST."), "xây dựng api rest");
    assert.equal(normalizeBulletText("2) Viết test"), "viết test");
  });

  it("extractBulletSuggestions: mới nhất trước, bỏ lần phân tích không có gợi ý và gợi ý trùng câu gốc", () => {
    const groups = extractBulletSuggestions([
      { _id: "a1", createdAt: "2026-11-01T00:00:00Z", position: "Frontend", result: { suggestions: { rewrittenBullets: [{ original: "x", rewritten: "y" }] } } },
      { _id: "a2", createdAt: "2026-11-20T00:00:00Z", mode: "jd", result: { suggestions: { rewrittenBullets: [{ original: "x", rewritten: "x" }, { original: "m", rewritten: "n", reasoning: "r" }] } } },
      { _id: "a3", createdAt: "2026-11-21T00:00:00Z", result: { suggestions: { rewrittenBullets: [] } } },
      { _id: "a4", createdAt: "2026-11-22T00:00:00Z" },
    ]);
    assert.deepEqual(groups.map((g) => g.analysisId), ["a2", "a1"]);
    assert.deepEqual(groups[0].items, [{ original: "m", rewritten: "n", reasoning: "r" }]);
    assert.equal(groups[0].label, "Phân tích CV với JD");
    assert.equal(groups[1].label, "Frontend");
  });

  it("findBulletMatches: khớp đúng trước, rồi khớp chứa nhau khi câu đủ dài", () => {
    const content = cv([
      { bullets: ["- Xây dựng API REST cho hệ thống đặt lịch.", "Viết test"] },
      { bullets: ["Xây dựng API REST cho hệ thống đặt lịch và thanh toán"] },
    ]);
    assert.deepEqual(findBulletMatches(content, "xây dựng API REST cho hệ thống đặt lịch"), [{ expIndex: 0, bulletIndex: 0 }]);
    // Cả hai bullet đều nằm trong câu gốc: bullet dài gần bằng câu gốc nhất đứng đầu.
    assert.deepEqual(findBulletMatches(content, "Xây dựng API REST cho hệ thống đặt lịch và thanh toán, giảm 30% lỗi"), [
      { expIndex: 1, bulletIndex: 0 },
      { expIndex: 0, bulletIndex: 0 },
    ]);
    assert.deepEqual(findBulletMatches(content, "Viết"), [], "câu ngắn không khớp chứa nhau");
    assert.deepEqual(findBulletMatches(content, ""), []);
  });

  it("applyBulletSuggestion thay đúng bullet, không sửa bản cũ; vị trí sai thì giữ nguyên", () => {
    const content = cv([{ bullets: ["A", "B"] }]);
    const next = applyBulletSuggestion(content, { expIndex: 0, bulletIndex: 1 }, " B tốt hơn ");
    assert.deepEqual(next.experiences[0].bullets, ["A", "B tốt hơn"]);
    assert.deepEqual(content.experiences[0].bullets, ["A", "B"]);
    assert.deepEqual(applyBulletSuggestion(content, { expIndex: 3, bulletIndex: 0 }, "x").experiences[0].bullets, ["A", "B"]);
  });

  it("appendBullet thêm cuối kinh nghiệm, bỏ bullet rỗng", () => {
    const next = appendBullet(cv([{ bullets: ["A", ""] }]), 0, "Mới");
    assert.deepEqual(next.experiences[0].bullets, ["A", "Mới"]);
  });
});

describe("pdfFileName", () => {
  it("giữ chữ có dấu, bỏ ký tự cấm, rỗng thì CV.pdf", () => {
    assert.equal(pdfFileName("CV Frontend / bản tiếng Việt"), "CV Frontend bản tiếng Việt.pdf");
    assert.equal(pdfFileName(""), "CV.pdf");
  });
});
