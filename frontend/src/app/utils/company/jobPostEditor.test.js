import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  JOB_MAX_COMPETENCIES,
  JOB_MAX_SKILLS,
  addSkills,
  addSuggestedCompetencies,
  attachableRubrics,
  dateInputToIso,
  emptyJobForm,
  formatJobDate,
  isJobEditable,
  isoToDateInput,
  jobActions,
  jobPublishErrors,
  jobSaveErrors,
  roleOptionsWithCurrent,
  todayDateInput,
  toJobForm,
  toJobPayload,
} from "./jobPostEditor.js";

const NOW = new Date("2026-11-23T05:00:00Z");
const DESC = "Mô tả công việc đủ dài để đăng tin tuyển dụng trên ProInterview, hơn năm mươi ký tự.";
const filled = (over = {}) => ({
  ...emptyJobForm("backend"),
  title: "Kỹ sư Backend",
  description: DESC,
  requiredCompetencies: [{ shrmKey: "communication", minLevel: 3 }],
  ...over,
});

describe("ngày hạn nhận hồ sơ (giờ Việt Nam)", () => {
  it("YYYY-MM-DD → 23:59:59 ngày đó giờ VN; đổi ngược lại đúng ngày", () => {
    const iso = dateInputToIso("2026-12-31");
    assert.equal(iso, "2026-12-31T16:59:59.000Z");
    assert.equal(isoToDateInput(iso), "2026-12-31");
    assert.equal(formatJobDate(iso), "31/12/2026");
  });
  it("ISO gần nửa đêm UTC vẫn ra đúng ngày VN", () => {
    assert.equal(isoToDateInput("2026-11-23T18:30:00Z"), "2026-11-24");
  });
  it("rỗng / sai định dạng", () => {
    assert.equal(dateInputToIso(""), null);
    assert.equal(dateInputToIso("31/12/2026"), null);
    assert.equal(isoToDateInput(null), "");
    assert.equal(isoToDateInput("abc"), "");
    assert.equal(formatJobDate(null), "—");
  });
});

describe("toJobForm / toJobPayload", () => {
  it("job từ API → form → payload giữ đủ field, rubric rỗng thành null", () => {
    const job = {
      id: "j1", status: "published", title: " Backend ", roleCategory: "backend", level: "senior", employmentType: "contract",
      workMode: "remote", location: "HCM", salaryRange: "30–40 triệu", description: DESC,
      requiredCompetencies: [{ shrmKey: "communication", minLevel: 4, name: "Giao tiếp" }],
      requiredSkills: ["Node.js"], rubricId: "", closesAt: "2026-12-31T16:59:59.000Z",
    };
    const form = toJobForm(job);
    assert.equal(form.id, "j1");
    assert.equal(form.closesAt, "2026-12-31");
    assert.deepEqual(form.requiredCompetencies, [{ shrmKey: "communication", minLevel: 4 }]);
    const p = toJobPayload(form);
    assert.equal(p.title, "Backend");
    assert.equal(p.rubricId, null);
    assert.equal(p.closesAt, "2026-12-31T16:59:59.000Z");
    assert.deepEqual(p.requiredSkills, ["Node.js"]);
    assert.equal("id" in p, false);
    assert.equal("status" in p, false);
  });
  it("null → form trống với nhóm vị trí mặc định; payload không có hạn → closesAt null", () => {
    const form = toJobForm(null, "frontend");
    assert.equal(form.roleCategory, "frontend");
    assert.equal(form.status, "draft");
    assert.equal(toJobPayload(form).closesAt, null);
  });
  it("payload bỏ dòng năng lực chưa chọn, ép mức về số", () => {
    const p = toJobPayload(filled({ requiredCompetencies: [{ shrmKey: "", minLevel: 3 }, { shrmKey: "teamwork", minLevel: "4" }] }));
    assert.deepEqual(p.requiredCompetencies, [{ shrmKey: "teamwork", minLevel: 4 }]);
  });
});

describe("trạng thái và nút thao tác", () => {
  it("draft sửa + đăng; published sửa + đóng; hidden chỉ đóng; closed không gì", () => {
    assert.deepEqual(jobActions("draft"), { edit: true, publish: true, close: false });
    assert.deepEqual(jobActions("published"), { edit: true, publish: false, close: true });
    assert.deepEqual(jobActions("hidden"), { edit: false, publish: false, close: true });
    assert.deepEqual(jobActions("closed"), { edit: false, publish: false, close: false });
    assert.equal(isJobEditable("hidden"), false);
  });
});

describe("addSkills", () => {
  it("tách dấu phẩy / xuống dòng, gộp khoảng trắng, bỏ trùng không phân biệt hoa thường", () => {
    const { skills, rejected } = addSkills(["Node.js"], " node.js , React  Native\nSQL,, ");
    assert.deepEqual(skills, ["Node.js", "React Native", "SQL"]);
    assert.deepEqual(rejected, []);
  });
  it("bỏ kỹ năng quá 60 ký tự và vượt 30 kỹ năng", () => {
    const long = "x".repeat(61);
    assert.deepEqual(addSkills([], long).rejected, [long]);
    const full = Array.from({ length: JOB_MAX_SKILLS }, (_, i) => `s${i}`);
    const res = addSkills(full, "thêm");
    assert.equal(res.skills.length, JOB_MAX_SKILLS);
    assert.deepEqual(res.rejected, ["thêm"]);
  });
});

describe("addSuggestedCompetencies", () => {
  it("thêm key chưa có với mức 3, bỏ key không chọn được, không vượt 10", () => {
    const rows = addSuggestedCompetencies([{ shrmKey: "communication", minLevel: 4 }], ["communication", "teamwork", "old_key"], new Set(["communication", "teamwork"]));
    assert.deepEqual(rows, [{ shrmKey: "communication", minLevel: 4 }, { shrmKey: "teamwork", minLevel: 3 }]);
    const many = Array.from({ length: 12 }, (_, i) => `k${i}`);
    assert.equal(addSuggestedCompetencies([], many).length, JOB_MAX_COMPETENCIES);
  });
});

describe("kiểm tra trước khi lưu / đăng (khớp backend JB-01)", () => {
  it("bản nháp chỉ cần tiêu đề, vị trí, cấp độ hợp lệ — mô tả ngắn vẫn lưu được", () => {
    assert.deepEqual(jobSaveErrors(filled({ description: "ngắn", requiredCompetencies: [] })), []);
  });
  it("tiêu đề ngắn, năng lực trùng / trống / ngừng dùng, mức ngoài 1–5 bị chặn khi lưu", () => {
    const keys = new Set(["communication", "teamwork"]);
    const errs = jobSaveErrors(filled({
      title: "ab",
      requiredCompetencies: [{ shrmKey: "communication", minLevel: 3 }, { shrmKey: "communication", minLevel: 6 }, { shrmKey: "", minLevel: 3 }, { shrmKey: "legacy", minLevel: 3 }],
    }), keys);
    assert.ok(errs.some((e) => e.startsWith("Tiêu đề")));
    assert.ok(errs.some((e) => e.includes("trùng")));
    assert.ok(errs.some((e) => e.includes("dòng trống")));
    assert.ok(errs.some((e) => e.includes("ngừng dùng")));
    assert.ok(errs.some((e) => e.includes("1 đến 5")));
  });
  it("đăng cần mô tả ≥ 50 ký tự, ít nhất 1 năng lực, hạn ở tương lai", () => {
    assert.deepEqual(jobPublishErrors(filled({ closesAt: "2026-12-31" }), null, NOW), []);
    const errs = jobPublishErrors(filled({ description: "ngắn", requiredCompetencies: [], closesAt: "2026-11-01" }), null, NOW);
    assert.ok(errs.some((e) => e.includes("ít nhất 50")));
    assert.ok(errs.some((e) => e.includes("ít nhất 1 năng lực")));
    assert.ok(errs.some((e) => e.includes("tương lai")));
  });
  it("hạn đúng hôm nay vẫn đăng được (hết hạn lúc 23:59 giờ VN)", () => {
    assert.deepEqual(jobPublishErrors(filled({ closesAt: "2026-11-23" }), null, NOW), []);
  });
});

describe("attachableRubrics", () => {
  it("chỉ rubric đã duyệt cùng nhóm vị trí", () => {
    const rubrics = [
      { _id: "a", status: "approved", roleCategory: "backend" },
      { _id: "b", status: "pending_review", roleCategory: "backend" },
      { _id: "c", status: "approved", roleCategory: "frontend" },
    ];
    assert.deepEqual(attachableRubrics(rubrics, "backend").map((r) => r._id), ["a"]);
  });
});

describe("nhóm vị trí đã ngừng dùng (tin cũ)", () => {
  const options = [{ id: "backend", label: "Backend" }, { id: "frontend", label: "Frontend" }];
  it("ô chọn thêm lại vị trí hiện tại kèm nhãn ngừng dùng; vị trí còn dùng thì giữ nguyên danh sách", () => {
    const list = roleOptionsWithCurrent(options, "legacy_role", "Vị trí cũ");
    assert.deepEqual(list[0], { id: "legacy_role", label: "Vị trí cũ (ngừng dùng)", stale: true });
    assert.equal(list.length, 3);
    assert.equal(roleOptionsWithCurrent(options, "backend").length, 2);
    assert.equal(roleOptionsWithCurrent(options, "").length, 2);
  });
  it("sửa tin không đổi vị trí → không gửi roleCategory; đổi vị trí → gửi; tạo mới → luôn gửi", () => {
    const form = toJobForm({ id: "j1", title: "Tin cũ", roleCategory: "legacy_role", level: "junior", description: DESC });
    assert.equal("roleCategory" in toJobPayload(form), false);
    assert.equal(toJobPayload({ ...form, roleCategory: "backend" }).roleCategory, "backend");
    assert.equal(toJobPayload(emptyJobForm("backend")).roleCategory, "backend");
  });
});

describe("todayDateInput", () => {
  it("ngày hôm nay theo giờ VN (qua nửa đêm UTC+7 là sang ngày mới)", () => {
    assert.equal(todayDateInput(new Date("2026-11-23T16:59:00Z")), "2026-11-23");
    assert.equal(todayDateInput(new Date("2026-11-23T17:00:00Z")), "2026-11-24");
  });
});
