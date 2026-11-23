import { it } from "node:test";
import assert from "node:assert/strict";
import { activeJobFilterCount, jobDeadlineInfo, jobFiltersToQuery, readJobFilters } from "./jobFilters.js";

it("đọc bộ lọc từ URL, bỏ giá trị enum lạ và page không hợp lệ", () => {
  const p = new URLSearchParams("q=  react &roleCategory=Frontend&level=junior&workMode=space&employmentType=full_time&page=0");
  assert.deepEqual(readJobFilters(p), { q: "react", roleCategory: "frontend", level: "junior", employmentType: "full_time", page: 1 });
  assert.deepEqual(readJobFilters(new URLSearchParams("page=3")), { page: 3 });
});

it("ghi bộ lọc ra query: bỏ rỗng, bỏ page 1, giữ thứ tự cố định", () => {
  assert.equal(jobFiltersToQuery({ workMode: "remote", q: "node", level: "", page: 1 }), "q=node&workMode=remote");
  assert.equal(jobFiltersToQuery({ roleCategory: "backend", page: 2 }), "roleCategory=backend&page=2");
  assert.equal(jobFiltersToQuery({}), "");
});

it("đọc rồi ghi lại cho ra cùng URL", () => {
  const q = "q=data&roleCategory=data_engineer&level=senior&employmentType=contract&workMode=remote&page=2";
  assert.equal(jobFiltersToQuery(readJobFilters(new URLSearchParams(q))), q);
});

it("đếm bộ lọc đang bật, không tính ô tìm kiếm", () => {
  assert.equal(activeJobFilterCount({ q: "x", level: "junior", workMode: "remote", page: 2 }), 2);
  assert.equal(activeJobFilterCount({}), 0);
});

it("hạn nộp: báo gấp khi còn ≤ 7 ngày, không có hạn thì null", () => {
  const now = Date.parse("2026-11-23T00:00:00Z");
  assert.equal(jobDeadlineInfo(null, now), null);
  assert.equal(jobDeadlineInfo("2026-11-28T00:00:00Z", now).urgent, true);
  assert.equal(jobDeadlineInfo("2026-12-23T00:00:00Z", now).urgent, false);
  assert.equal(jobDeadlineInfo("2026-12-23T00:00:00Z", now).daysLeft, 30);
});
