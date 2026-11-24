import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { recentJobsForCard, initialSelectedJobId, shouldShowRecentJobsCard, RECENT_JOBS_CARD_LIMIT } from "./recentJobsCard.js";

describe("recentJobsCard (JB-21)", () => {
  it("lấy tối đa 3 job, giữ thứ tự mới xem trước, bỏ trùng và phần tử không có id", () => {
    const jobs = [{ id: "a" }, { id: "b" }, null, { id: "a" }, { title: "không id" }, { id: "c" }, { id: "d" }];
    assert.deepEqual(recentJobsForCard(jobs).map((j) => j.id), ["a", "b", "c"]);
    assert.equal(RECENT_JOBS_CARD_LIMIT, 3);
  });

  it("dữ liệu lạ → mảng rỗng", () => {
    assert.deepEqual(recentJobsForCard(null), []);
    assert.deepEqual(recentJobsForCard({}), []);
  });

  it("job chọn sẵn lấy từ URL, không tự chọn job đầu danh sách", () => {
    assert.equal(initialSelectedJobId(" 507f1f77bcf86cd799439011 "), "507f1f77bcf86cd799439011");
    assert.equal(initialSelectedJobId(null), "");
  });

  it("thẻ chỉ hiện khi có job gần đây hoặc đang chọn job từ URL", () => {
    assert.equal(shouldShowRecentJobsCard([], ""), false);
    assert.equal(shouldShowRecentJobsCard([{ id: "a" }], ""), true);
    assert.equal(shouldShowRecentJobsCard([], "abc"), true);
  });
});
