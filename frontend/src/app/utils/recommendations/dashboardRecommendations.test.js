import { test } from "node:test";
import assert from "node:assert/strict";
import {
  basisSummary,
  jobActionUrl,
  mentorSubtitle,
  normalizeRecommendations,
  safeInternalPath,
  uniqueLabels,
} from "./dashboardRecommendations.js";

test("safeInternalPath chỉ nhận đường dẫn nội bộ", () => {
  assert.equal(safeInternalPath("/mentors/abc", "/x"), "/mentors/abc");
  assert.equal(safeInternalPath("//evil.com", "/x"), "/x");
  assert.equal(safeInternalPath("javascript:alert(1)", "/x"), "/x");
  assert.equal(safeInternalPath("https://a.com", "/x"), "/x");
  assert.equal(safeInternalPath(undefined, "/x"), "/x");
});

test("jobActionUrl mở /jobs lọc theo tên job (chưa có trang chi tiết)", () => {
  assert.equal(jobActionUrl({ title: "Backend Node.js" }), "/jobs?q=Backend%20Node.js");
  assert.equal(jobActionUrl({ title: "" }), "/jobs");
  assert.equal(jobActionUrl(null), "/jobs");
});

test("uniqueLabels bỏ trùng và giá trị giữ chỗ", () => {
  assert.deepEqual(uniqueLabels(["Backend", "backend ", "—", "", "Node.js"]), ["Backend", "Node.js"]);
  assert.deepEqual(uniqueLabels(null), []);
});

test("mentorSubtitle bỏ company giữ chỗ", () => {
  assert.equal(mentorSubtitle({ title: "Senior Dev", company: "Zalo" }), "Senior Dev · Zalo");
  assert.equal(mentorSubtitle({ title: "Mentor", company: "—" }), "Mentor");
  assert.equal(mentorSubtitle({}), "");
});

test("basisSummary ưu tiên năng lực thiếu, rồi vị trí mục tiêu, rồi gợi ý chung", () => {
  assert.match(
    basisSummary({ gaps: [{ name: "Giao tiếp" }, { name: "Giải quyết vấn đề" }, { name: "Lãnh đạo" }] }),
    /"Giao tiếp", "Giải quyết vấn đề" và 1 năng lực khác/,
  );
  assert.equal(
    basisSummary({ gaps: [], targetRoles: ["Backend", "Backend", "Node.js"] }),
    "Dựa trên vị trí mục tiêu: Backend, Node.js.",
  );
  assert.match(basisSummary({}), /phỏng vấn AI/);
});

test("normalizeRecommendations cắt theo limit và dựng href", () => {
  const raw = {
    basis: { gaps: [{ key: "communication", name: "Giao tiếp", level: 2 }], targetRoles: [] },
    mentors: [
      { id: "u1", name: "An", title: "Dev", company: "—", reason: "Có chuyên môn", actionUrl: "/mentors/u1" },
      { id: "u2", name: "Bình", actionUrl: "//evil" },
      { id: "u3", name: "Chi" },
      { id: "u4", name: "Dũng" },
    ],
    courses: [{ id: "c1", title: "Khóa A", price: 0, isFree: false, actionUrl: "/courses/c1" }],
    jobs: [{ id: "j1", title: "Backend", company: { name: "Công ty A" }, location: "Hà Nội", actionUrl: "/jobs/j1" }],
  };
  const out = normalizeRecommendations(raw);
  assert.equal(out.mentors.length, 3);
  assert.equal(out.mentors[0].subtitle, "Dev");
  assert.equal(out.mentors[1].href, "/mentors/u2");
  assert.equal(out.courses[0].isFree, true);
  assert.equal(out.jobs[0].href, "/jobs?q=Backend");
  assert.equal(out.jobs[0].subtitle, "Công ty A · Hà Nội");
  assert.equal(out.hasGaps, true);
  assert.equal(out.isEmpty, false);
});

test("normalizeRecommendations với dữ liệu rỗng", () => {
  const out = normalizeRecommendations(null);
  assert.equal(out.isEmpty, true);
  assert.deepEqual(out.mentors, []);
  assert.match(out.summary, /phỏng vấn AI/);
});
