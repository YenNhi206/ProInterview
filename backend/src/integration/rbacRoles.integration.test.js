/**
 * Integration: nền RBAC sau khi thêm role `moderator` và `enterprise`.
 *
 * Khóa lại hai tính chất của middleware requireRole (src/middleware/requireRole.js):
 *   1. Cổng moderator chỉ cho role moderator — admin KHÔNG đi vòng được, vì kiểm
 *      duyệt nội dung đã tách khỏi quyền vận hành của admin.
 *   2. Cổng admin không bị role mới làm rộng ra.
 */
import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import {
  applyTestEnv,
  startMongoHarness,
  stopMongoHarness,
  mintAccessToken,
  startHttpServer,
  stopHttpServer,
} from "../test_helpers/mongoTestHarness.js";

applyTestEnv();

let harness;
let http;
let User;
let createApp;

before(async () => {
  harness = await startMongoHarness();
  ({ User } = await import("../models/User.js"));
  ({ createApp } = await import("../app.js"));
  http = await startHttpServer(createApp());
});

after(async () => {
  if (http?.server) await stopHttpServer(http.server);
  if (harness) await stopMongoHarness(harness);
});

const ROLES = ["customer", "mentor", "admin", "moderator", "enterprise"];

async function userWithRole(role, suffix) {
  return User.create({
    name: `RBAC ${role}`,
    email: `rbac-${role}-${suffix}@test.local`,
    role,
  });
}

function get(path, userId) {
  return fetch(`${http.baseUrl}${path}`, {
    headers: {
      Authorization: `Bearer ${mintAccessToken(userId)}`,
      Accept: "application/json",
    },
  });
}

describe("RBAC: role moderator và enterprise", () => {
  it("User.role nhận cả 5 role (enum đã mở rộng)", async () => {
    const suffix = `enum-${Date.now()}`;
    for (const role of ROLES) {
      const u = await userWithRole(role, suffix);
      assert.equal(u.role, role, `role ${role} phải lưu được`);
    }
  });

  it("GET /api/moderator/courses/pending — chỉ moderator qua được, admin bị 403", async () => {
    const suffix = `gate-${Date.now()}`;
    const expected = {
      customer: 403,
      mentor: 403,
      admin: 403,
      enterprise: 403,
      moderator: 200,
    };

    for (const role of ROLES) {
      const u = await userWithRole(role, suffix);
      const res = await get("/api/moderator/courses/pending", u._id);
      assert.equal(
        res.status,
        expected[role],
        `role ${role} phải nhận ${expected[role]} ở cổng moderator, nhận ${res.status}`,
      );
    }
  });

  it("Cổng moderator từ chối khi chưa đăng nhập (401, không phải 403)", async () => {
    const res = await fetch(`${http.baseUrl}/api/moderator/courses/pending`, {
      headers: { Accept: "application/json" },
    });
    assert.equal(res.status, 401);
  });

  it("GET /api/admin/stats — role mới KHÔNG được coi là admin", async () => {
    const suffix = `admin-gate-${Date.now()}`;
    for (const role of ["moderator", "enterprise", "customer", "mentor"]) {
      const u = await userWithRole(role, suffix);
      const res = await get("/api/admin/stats", u._id);
      assert.equal(res.status, 403, `role ${role} không được vào cổng admin`);
    }
    const admin = await userWithRole("admin", suffix);
    const res = await get("/api/admin/stats", admin._id);
    assert.equal(res.status, 200, "admin vẫn vào được cổng admin");
  });

  it("Admin không còn route duyệt khóa học — /api/admin/courses/pending đã bỏ", async () => {
    const admin = await userWithRole("admin", `gone-${Date.now()}`);
    const res = await get("/api/admin/courses/pending", admin._id);
    assert.equal(res.status, 404, "route cũ phải biến mất, không phải 200");
  });
});
