import { test } from "node:test";
import assert from "node:assert/strict";
import {
  applicationForJob,
  applicationTimeline,
  applyFormError,
  companyMetricsView,
  countByFilter,
  defaultCvId,
  filterApplications,
  statusLabelOf,
  usableCvs,
} from "./applications.js";

const apps = [
  { id: "a1", status: "submitted", job: { id: "j1" } },
  { id: "a2", status: "viewed", job: { id: "j2" } },
  { id: "a3", status: "shortlisted", job: { id: "j3" } },
  { id: "a4", status: "rejected", job: { id: "j4" } },
  { id: "a5", status: "withdrawn", statusLabel: "Đã rút", job: { id: "j5" } },
];

test("lọc và đếm đơn theo nhóm", () => {
  assert.deepEqual(filterApplications(apps, "active").map((a) => a.id), ["a1", "a2"]);
  assert.deepEqual(filterApplications(apps, "closed").map((a) => a.id), ["a4", "a5"]);
  assert.equal(filterApplications(apps, "all").length, 5);
  assert.deepEqual(countByFilter(apps), { all: 5, active: 2, shortlisted: 1, closed: 2 });
  assert.deepEqual(filterApplications(null, "all"), []);
});

test("statusLabelOf ưu tiên nhãn của API", () => {
  assert.equal(statusLabelOf(apps[4]), "Đã rút");
  assert.equal(statusLabelOf({ status: "viewed" }), "Nhà tuyển dụng đã xem");
});

test("applicationForJob tìm đơn của job (kể cả đã rút)", () => {
  assert.equal(applicationForJob(apps, "j5").id, "a5");
  assert.equal(applicationForJob(apps, "x"), null);
});

test("CV chọn được và CV chọn sẵn", () => {
  const cvs = [
    { id: "c1", isValidCv: false, isDefault: true },
    { id: "c2" },
    { id: "c3", isDefault: false },
  ];
  assert.deepEqual(usableCvs(cvs).map((c) => c.id), ["c2", "c3"]);
  assert.equal(defaultCvId(cvs), "c2");
  assert.equal(defaultCvId([{ id: "c1" }, { id: "c2", isDefault: true }]), "c2");
  assert.equal(defaultCvId([]), "");
});

test("applyFormError", () => {
  assert.match(applyFormError({ cvId: "", consent: true }), /Chọn một CV/);
  assert.match(applyFormError({ cvId: "c1", consent: false }), /đồng ý/);
  assert.equal(applyFormError({ cvId: "c1", consent: true }), "");
});

test("applicationTimeline", () => {
  const t = applicationTimeline({ status: "withdrawn", submittedAt: "2026-11-20T03:00:00Z", withdrawnAt: "2026-11-22T03:00:00Z" });
  assert.match(t, /^Nộp \d+\/11\/2026 · Đã rút \d+\/11\/2026$/);
  assert.match(applicationTimeline({ status: "viewed", submittedAt: "2026-11-20T03:00:00Z", viewedAt: "2026-11-21T03:00:00Z" }), /Được xem/);
  assert.equal(applicationTimeline({}), "");
});

test("companyMetricsView: chưa trả lời câu nào → empty", () => {
  assert.deepEqual(companyMetricsView(null), { empty: true });
  assert.deepEqual(companyMetricsView({ answeredCount: 0, rubricScoreAvg: null }), { empty: true });
});

test("companyMetricsView: số liệu và tiêu chí thấp nhất lên đầu", () => {
  const v = companyMetricsView({
    questionCount: 4, answeredCount: 3, scoredCount: 2, pendingScoringCount: 1, sessionCount: 2, rubricScoreAvg: 3.46,
    lastAnsweredAt: "2026-11-24T03:00:00Z",
    criteria: [
      { criterionKey: "k1", criterionName: "Giải quyết vấn đề", avgScore: 4.25, count: 2 },
      { criterionKey: "k2", criterionName: "Giao tiếp", avgScore: 2, count: 1 },
      { criterionKey: "k3", criterionName: "Chưa chấm", avgScore: null, count: 0 },
    ],
  });
  assert.equal(v.empty, false);
  assert.equal(v.average, 3.5);
  assert.deepEqual(v.criteria.map((c) => [c.name, c.avg]), [["Giao tiếp", 2], ["Giải quyết vấn đề", 4.3]]);
  assert.equal(v.pendingScoringCount, 1);
});
