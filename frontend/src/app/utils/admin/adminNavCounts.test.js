import { test } from "node:test";
import assert from "node:assert/strict";
import {
  countPayoutsAwaitingAdmin,
  filterPendingMentors,
  isPendingMentorApplication,
  navCountLabel,
} from "./adminNavCounts.js";

test("chỉ hồ sơ chưa kích hoạt, chưa xác minh và chưa bị từ chối là đang chờ duyệt", () => {
  assert.equal(isPendingMentorApplication({ isActive: false, isVerified: false, adminReview: { status: "pending" } }), true);
  assert.equal(isPendingMentorApplication({ isActive: false, isVerified: false }), true);
  assert.equal(isPendingMentorApplication({ isActive: false, isVerified: false, adminReview: { status: "rejected" } }), false);
  assert.equal(isPendingMentorApplication({ isActive: true, isVerified: true, adminReview: { status: "approved" } }), false);
  assert.equal(isPendingMentorApplication({ isActive: false, isVerified: true }), false);
  assert.equal(isPendingMentorApplication(null), false);
});

test("lọc danh sách mentor, dữ liệu không phải mảng thì trả rỗng", () => {
  const list = [
    { _id: "a", isActive: false, isVerified: false },
    { _id: "b", isActive: true, isVerified: true },
    { _id: "c", isActive: false, isVerified: false, adminReview: { status: "rejected" } },
  ];
  assert.deepEqual(filterPendingMentors(list).map((m) => m._id), ["a"]);
  assert.deepEqual(filterPendingMentors(undefined), []);
});

test("rút tiền cần admin xử lý: chờ duyệt và đã duyệt chưa chi", () => {
  const payouts = [
    { status: "pending" },
    { status: "pending" },
    { status: "approved" },
    { status: "paid" },
    { status: "rejected" },
    { status: "processing" },
    null,
  ];
  assert.equal(countPayoutsAwaitingAdmin(payouts), 3);
  assert.equal(countPayoutsAwaitingAdmin(undefined), 0);
});

test("nhãn số đếm: ẩn khi 0, gộp 99+", () => {
  assert.equal(navCountLabel(0), "");
  assert.equal(navCountLabel(undefined), "");
  assert.equal(navCountLabel(3), "3");
  assert.equal(navCountLabel(99), "99");
  assert.equal(navCountLabel(150), "99+");
});
