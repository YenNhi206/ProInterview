/**
 * N-03 + đề xuất (n): script migrate role `enterprise` → `company_moderator`.
 * Role `enterprise` không còn trong enum `User.role`, nên dữ liệu cũ được ghi thẳng vào collection.
 */
import { describe, it, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { applyTestEnv, startMongoHarness, stopMongoHarness } from "../test_helpers/mongoTestHarness.js";

applyTestEnv();

let harness;
let User;
let migrateEnterpriseRole;
let mongoHost;

before(async () => {
  harness = await startMongoHarness();
  ({ User } = await import("../models/User.js"));
  ({ migrateEnterpriseRole, mongoHost } = await import("../scripts/migrateEnterpriseRole.js"));
});

after(async () => {
  if (harness) await stopMongoHarness(harness);
});

beforeEach(async () => {
  await User.collection.deleteMany({});
  await User.collection.insertMany([
    { name: "HR cũ 1", email: "old1@test.local", role: "enterprise" },
    { name: "HR cũ 2", email: "old2@test.local", role: "enterprise" },
    { name: "Ứng viên", email: "cand@test.local", role: "customer" },
  ]);
});

describe("N-03 — migrateEnterpriseRole", () => {
  it("dry run chỉ đếm, không ghi DB", async () => {
    assert.deepEqual(await migrateEnterpriseRole({ dryRun: true }), { found: 2, updated: 0 });
    assert.equal(await User.collection.countDocuments({ role: "enterprise" }), 2);
  });

  it("chạy thật đổi đúng user enterprise, không đụng role khác; chạy lại không lỗi", async () => {
    assert.deepEqual(await migrateEnterpriseRole(), { found: 2, updated: 2 });
    assert.equal(await User.collection.countDocuments({ role: "enterprise" }), 0);
    assert.equal(await User.collection.countDocuments({ role: "company_moderator" }), 2);
    assert.equal((await User.collection.findOne({ email: "cand@test.local" })).role, "customer");

    assert.deepEqual(await migrateEnterpriseRole(), { found: 0, updated: 0 });
  });

  it("mongoHost in host đích, không lộ user/mật khẩu", () => {
    assert.equal(mongoHost("mongodb+srv://admin:secret@cluster0.abc.mongodb.net/prointerview?retryWrites=true"), "cluster0.abc.mongodb.net");
    assert.equal(mongoHost("mongodb://127.0.0.1:27017/prointerview"), "127.0.0.1:27017");
  });
});
