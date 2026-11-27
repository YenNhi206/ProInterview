import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  mergeNotificationPrefs,
  notificationPrefKeyForRole,
  publicNotificationPrefsForRole,
  sanitizeNotificationPrefsPatch,
} from "./notificationPrefs.js";

describe("notificationPrefs theo role", () => {
  it("mỗi role chỉ thấy nhánh của mình trong GET /me", () => {
    assert.deepEqual(Object.keys(publicNotificationPrefsForRole("customer", {})), ["customer"]);
    assert.deepEqual(Object.keys(publicNotificationPrefsForRole("mentor", {})), ["mentor"]);
    assert.deepEqual(publicNotificationPrefsForRole("moderator", {}), { moderator: { ai_improvement_proposed: true } });
    assert.deepEqual(Object.keys(publicNotificationPrefsForRole("company_moderator", {}).company), [
      "application_submitted",
      "application_withdrawn",
      "job_post_visibility",
    ]);
    assert.deepEqual(publicNotificationPrefsForRole("admin", {}), {
      admin: { mentor_application_submitted: true, payout_requested: true, booking_stale: true },
    });
  });

  it("moderator không nhận khóa của học viên khi PATCH", () => {
    assert.equal(sanitizeNotificationPrefsPatch("moderator", { customer: { streak_reminder: false } }), null);
    assert.deepEqual(
      sanitizeNotificationPrefsPatch("moderator", { moderator: { ai_improvement_proposed: false, streak_reminder: false } }),
      { moderator: { ai_improvement_proposed: false } },
    );
  });

  it("admin chỉ sửa nhánh admin", () => {
    assert.equal(sanitizeNotificationPrefsPatch("admin", { mentor: { payout_update: false } }), null);
    assert.deepEqual(sanitizeNotificationPrefsPatch("admin", { admin: { booking_stale: false } }), { admin: { booking_stale: false } });
  });

  it("deliverNotification chọn khóa theo role người nhận", () => {
    const payload = { customerPrefKey: "booking_cancelled", companyPrefKey: "application_submitted", moderatorPrefKey: "ai_improvement_proposed" };
    assert.equal(notificationPrefKeyForRole("customer", payload), "booking_cancelled");
    assert.equal(notificationPrefKeyForRole("company_moderator", payload), "application_submitted");
    assert.equal(notificationPrefKeyForRole("moderator", payload), "ai_improvement_proposed");
    assert.equal(notificationPrefKeyForRole("admin", payload), undefined);
  });

  it("lựa chọn đã lưu được giữ, khóa lạ bị bỏ", () => {
    const merged = mergeNotificationPrefs("company_moderator", {
      company: { application_withdrawn: false, foo: false },
      customer: { streak_reminder: false },
    });
    assert.deepEqual(merged, { application_submitted: true, application_withdrawn: false, job_post_visibility: true });
  });
});
