import { test } from "node:test";
import assert from "node:assert/strict";
import { notificationKind } from "./notificationKind.js";

test("N-06: loại thông báo mới có nhãn riêng, không rơi vào 'Cập nhật'", () => {
  const cases = {
    learning_path_proposed: "Lộ trình",
    learning_path_accepted: "Lộ trình",
    learning_path_revision_requested: "Lộ trình",
    learning_path_paid: "Lộ trình",
    learning_path_session_result: "Lộ trình",
    learning_path_cancelled: "Lộ trình",
    application_submitted: "Việc làm",
    application_status_changed: "Việc làm",
    job_post_hidden: "Việc làm",
    company_invite: "Công ty",
    rubric_approved: "Rubric",
    rubric_rejected: "Rubric",
    ai_improvement_proposed: "Cải tiến AI",
  };
  for (const [type, label] of Object.entries(cases)) {
    assert.equal(notificationKind(type).label, label, type);
    assert.ok(notificationKind(type).icon, `${type} thiếu icon`);
  }
});

test("loại tiêu cực dùng tông coral", () => {
  for (const type of ["learning_path_cancelled", "job_post_hidden", "rubric_rejected", "booking_cancelled", "payment_failed"]) {
    assert.equal(notificationKind(type).tone, "coral", type);
  }
});

test("loại cũ giữ nguyên hành vi", () => {
  assert.equal(notificationKind("booking_confirmed").label, "Lịch hẹn");
  assert.equal(notificationKind("payment_success").label, "Thanh toán");
  assert.equal(notificationKind("certificate_ready").label, "Khóa học");
  assert.equal(notificationKind("new_review").label, "Nhận xét");
  assert.equal(notificationKind("system").label, "Cập nhật");
  assert.equal(notificationKind().label, "Cập nhật");
});
