/**
 * N-06: enum Notification.type mở rộng cho các luồng capstone; metadata giữ được ref mới.
 */
import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import { applyTestEnv, startMongoHarness, stopMongoHarness } from "../test_helpers/mongoTestHarness.js";

applyTestEnv();

let harness;
let Notification;
let NOTIFICATION_TYPES;
let NOTIFICATION_TYPE_GROUPS;
let User;
let deliverNotification;

const oid = () => new mongoose.Types.ObjectId();

const NEW_TYPES = [
  "learning_path_proposed",
  "learning_path_accepted",
  "learning_path_revision_requested",
  "learning_path_paid",
  "learning_path_session_result",
  "learning_path_cancelled",
  "application_submitted",
  "application_status_changed",
  "company_invite",
  "rubric_approved",
  "rubric_rejected",
  "job_post_hidden",
  "ai_improvement_proposed",
];

const LEGACY_TYPES = [
  "booking_confirmed",
  "booking_cancelled",
  "booking_reminder",
  "booking_completed",
  "new_review",
  "new_booking_request",
  "payment_success",
  "payment_failed",
  "plan_upgraded",
  "plan_expiring",
  "course_enrolled",
  "course_completed",
  "certificate_ready",
  "feedback",
  "system",
];

before(async () => {
  harness = await startMongoHarness();
  ({ Notification, NOTIFICATION_TYPES, NOTIFICATION_TYPE_GROUPS } = await import("../models/Notification.js"));
  ({ User } = await import("../models/User.js"));
  ({ deliverNotification } = await import("../services/notificationDeliveryService.js"));
  await Notification.init();
});

after(async () => {
  if (harness) await stopMongoHarness(harness);
});

describe("Notification.type (N-06)", () => {
  it("enum chứa đủ loại mới và giữ nguyên 15 loại cũ, không trùng", () => {
    for (const t of [...NEW_TYPES, ...LEGACY_TYPES]) assert.ok(NOTIFICATION_TYPES.includes(t), `thiếu ${t}`);
    assert.equal(new Set(NOTIFICATION_TYPES).size, NOTIFICATION_TYPES.length);
    assert.equal(NOTIFICATION_TYPES.length, NEW_TYPES.length + LEGACY_TYPES.length);
    assert.deepEqual(Object.values(NOTIFICATION_TYPE_GROUPS).flat(), NOTIFICATION_TYPES);
  });

  for (const type of NEW_TYPES) {
    it(`lưu được loại ${type}`, async () => {
      const doc = await Notification.create({ userId: oid(), type, title: "Tiêu đề", body: "Nội dung" });
      const saved = await Notification.findById(doc._id).lean();
      assert.equal(saved.type, type);
      assert.equal(saved.isRead, false);
    });
  }

  it("loại ngoài enum vẫn bị từ chối", async () => {
    await assert.rejects(
      Notification.create({ userId: oid(), type: "learning_path_unknown", title: "x", body: "x" }),
      /type/,
    );
  });

  it("metadata giữ được ref của luồng mới (không bị strict bỏ đi)", async () => {
    const metadata = {
      learningPathId: oid(),
      learningPathSessionId: oid(),
      jobPostId: oid(),
      applicationId: oid(),
      companyId: oid(),
      rubricId: oid(),
      proposalId: oid(),
      actionUrl: "/learning-paths/abc",
    };
    const doc = await Notification.create({ userId: oid(), type: "learning_path_proposed", title: "x", body: "x", metadata });
    const saved = await Notification.findById(doc._id).lean();
    for (const [k, v] of Object.entries(metadata)) assert.equal(String(saved.metadata[k]), String(v), k);
  });

  it("deliverNotification giao được loại mới (trước N-06 trả create_failed)", async () => {
    const user = await User.create({ email: `n06-${Date.now()}@test.local`, name: "N06", role: "customer", password: "Dev123456" });
    const res = await deliverNotification(user._id, {
      type: "application_status_changed",
      title: "Đơn ứng tuyển được shortlist",
      body: "Công ty đã đưa bạn vào danh sách rút gọn.",
      metadata: { applicationId: oid(), jobPostId: oid() },
    });
    assert.deepEqual(res, { delivered: true });
    assert.equal(await Notification.countDocuments({ userId: user._id, type: "application_status_changed" }), 1);
  });
});
