import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  LEARNING_PATH_SCHEDULE_BLOCK as BLOCK,
  checkSessionSchedulable,
  findSchedulableSession,
  latestAttemptsByOrder,
} from "./learningPathSchedule.js";

const active = { status: "active" };
const s = (id, order, status, extra = {}) => ({ _id: id, order, attempt: 1, status, outcome: null, ...extra });
const passed = (id, order, extra = {}) => s(id, order, "done", { outcome: "passed", ...extra });
const failed = (id, order, extra = {}) => s(id, order, "done", { outcome: "not_passed", ...extra });

describe("latestAttemptsByOrder", () => {
  it("lấy attempt lớn nhất mỗi order, bỏ buổi cancelled, sắp theo order", () => {
    const rows = latestAttemptsByOrder([
      s("b", 2, "planned"),
      failed("a1", 1),
      s("a2", 1, "planned", { attempt: 2, retakeOf: "a1" }),
      s("a3", 1, "cancelled", { attempt: 3 }),
    ]);
    assert.deepEqual(rows.map((r) => r._id), ["a2", "b"]);
  });
});

describe("findSchedulableSession", () => {
  it("lộ trình chưa active thì không mở buổi nào", () => {
    for (const status of ["draft", "proposed", "pending_payment", "completed", "cancelled"]) {
      assert.equal(findSchedulableSession({ status }, [s("a", 1, "planned")]), null);
    }
  });

  it("vừa thanh toán: mở buổi 1", () => {
    assert.equal(findSchedulableSession(active, [s("a", 1, "planned"), s("b", 2, "planned"), s("c", 3, "planned")])._id, "a");
  });

  it("buổi 1 đang scheduled: chưa mở buổi 2", () => {
    assert.equal(findSchedulableSession(active, [s("a", 1, "scheduled"), s("b", 2, "planned")]), null);
  });

  it("buổi 1 đạt: mở buổi 2", () => {
    assert.equal(findSchedulableSession(active, [passed("a", 1), s("b", 2, "planned")])._id, "b");
  });

  it("buổi 2 không đạt và chưa có buổi học lại: không mở buổi 3", () => {
    assert.equal(findSchedulableSession(active, [passed("a", 1), failed("b", 2), s("c", 3, "planned")]), null);
  });

  it("buổi 2 không đạt, đã có buổi học lại: mở buổi học lại, không mở buổi 3", () => {
    const sessions = [passed("a", 1), failed("b", 2), s("b2", 2, "planned", { attempt: 2, retakeOf: "b" }), s("c", 3, "planned")];
    assert.equal(findSchedulableSession(active, sessions)._id, "b2");
  });

  it("buổi học lại đạt: mở buổi 3", () => {
    const sessions = [passed("a", 1), failed("b", 2), passed("b2", 2, { attempt: 2 }), s("c", 3, "planned")];
    assert.equal(findSchedulableSession(active, sessions)._id, "c");
  });

  it("thứ tự trong mảng không ảnh hưởng", () => {
    assert.equal(findSchedulableSession(active, [s("c", 3, "planned"), s("b", 2, "planned"), passed("a", 1)])._id, "b");
  });

  it("mọi buổi đã đạt: null", () => {
    assert.equal(findSchedulableSession(active, [passed("a", 1), passed("b", 2)]), null);
  });
});

describe("checkSessionSchedulable", () => {
  const sessions = [passed("a", 1), failed("b", 2), s("c", 3, "planned")];

  it("không đặt được buổi 3 khi buổi 2 chưa đạt, trả buổi đang chặn", () => {
    const r = checkSessionSchedulable(active, sessions, "c");
    assert.equal(r.ok, false);
    assert.equal(r.reason, BLOCK.PREVIOUS_NOT_PASSED);
    assert.equal(r.blockingSession._id, "b");
  });

  it("buổi đang mở thì ok", () => {
    const r = checkSessionSchedulable(active, [passed("a", 1), s("b", 2, "planned")], "b");
    assert.equal(r.ok, true);
    assert.equal(r.session._id, "b");
  });

  it("buổi không thuộc lộ trình", () => {
    assert.equal(checkSessionSchedulable(active, sessions, "zzz").reason, BLOCK.SESSION_NOT_FOUND);
  });

  it("lộ trình chưa active", () => {
    assert.equal(checkSessionSchedulable({ status: "pending_payment" }, [s("a", 1, "planned")], "a").reason, BLOCK.PATH_NOT_ACTIVE);
  });

  it("buổi đã scheduled hoặc done", () => {
    assert.equal(checkSessionSchedulable(active, [s("a", 1, "scheduled")], "a").reason, BLOCK.SESSION_NOT_PLANNED);
    assert.equal(checkSessionSchedulable(active, sessions, "a").reason, BLOCK.SESSION_NOT_PLANNED);
  });

  it("buổi planned đã bị thay bằng lần học mới hơn", () => {
    const rows = [s("a1", 1, "planned"), s("a2", 1, "planned", { attempt: 2 })];
    assert.equal(checkSessionSchedulable(active, rows, "a1").reason, BLOCK.SUPERSEDED);
  });

  it("nhận cả id dạng chuỗi (DTO) lẫn _id", () => {
    assert.equal(checkSessionSchedulable(active, [{ id: "x", order: 1, attempt: 1, status: "planned" }], "x").ok, true);
  });
});
