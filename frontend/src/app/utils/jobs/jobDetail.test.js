import { test } from "node:test";
import assert from "node:assert/strict";
import {
  gapAudience,
  interviewUrl,
  jdFileName,
  jobReportError,
  jobToJdText,
  mentorRequestUrl,
  readJobPostId,
  safeInternalPath,
} from "./jobDetail.js";

test("gapAudience: chỉ customer xem khoảng thiếu", () => {
  assert.equal(gapAudience(null), "guest");
  assert.equal(gapAudience({ role: "customer" }), "candidate");
  assert.equal(gapAudience({ role: "mentor" }), "other");
});

test("safeInternalPath chặn link ngoài", () => {
  assert.equal(safeInternalPath("/interview"), "/interview");
  assert.equal(safeInternalPath("//evil.com", "/x"), "/x");
  assert.equal(safeInternalPath("https://a.com", "/x"), "/x");
});

test("URL gắn job", () => {
  const id = "6b040254fd6c5a34349d5ca1";
  assert.equal(mentorRequestUrl(id), `/mentor-requests/new?jobPostId=${id}`);
  assert.equal(interviewUrl(id), `/interview?jobPostId=${id}`);
});

test("readJobPostId chỉ nhận ObjectId", () => {
  assert.equal(readJobPostId(new URLSearchParams("jobPostId=6b040254fd6c5a34349d5ca1")), "6b040254fd6c5a34349d5ca1");
  assert.equal(readJobPostId(new URLSearchParams("jobPostId=abc")), "");
  assert.equal(readJobPostId(new URLSearchParams("")), "");
});

test("jobReportError", () => {
  assert.equal(jobReportError({ reason: "", description: "Nội dung đủ dài" }), "Chọn lý do báo cáo.");
  assert.match(jobReportError({ reason: "fraud", description: "ngắn" }), /ít nhất 10/);
  assert.equal(jobReportError({ reason: "fraud", description: "Yêu cầu nộp phí trước" }), "");
});

test("jobToJdText gộp mô tả, kỹ năng, năng lực", () => {
  const text = jobToJdText({
    title: "Backend Developer",
    company: { name: "Công ty A" },
    location: "Hà Nội",
    description: "Xây dựng API.",
    requiredSkills: ["Node.js", "MongoDB"],
    requiredCompetencies: [{ shrmKey: "communication", name: "Giao tiếp", minLevel: 3 }],
  });
  assert.match(text, /^Vị trí: Backend Developer — Công ty A/);
  assert.match(text, /Xây dựng API\./);
  assert.match(text, /Kỹ năng yêu cầu: Node\.js, MongoDB/);
  assert.match(text, /Năng lực yêu cầu: Giao tiếp \(mức 3\/5\)/);
  assert.doesNotMatch(text, /\n\n\n/);
  assert.equal(jobToJdText(null), "");
});

test("jdFileName bỏ dấu", () => {
  assert.equal(jdFileName("Lập trình viên Backend"), "jd-lap-trinh-vien-backend.txt");
  assert.equal(jdFileName(""), "jd-job.txt");
});
