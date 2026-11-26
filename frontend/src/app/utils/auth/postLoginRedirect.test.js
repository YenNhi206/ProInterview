import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { getPostLoginPath, isSafeAppRedirect } from "./auth.js";

describe("getPostLoginPath & isSafeAppRedirect", () => {
  const adminUser = { role: "admin", email: "admin@dev.local" };
  const mentorUser = { role: "mentor", email: "mentor@dev.local" };
  const moderatorUser = { role: "moderator", email: "mod@dev.local" };
  const companyUser = { role: "company_moderator", email: "hr@dev.local" };
  const customerUser = { role: "customer", email: "student@dev.local" };

  it("admin đăng nhập từ trang mua gói / bảng giá phải về /admin", () => {
    assert.equal(getPostLoginPath(adminUser, "/pricing"), "/admin");
    assert.equal(getPostLoginPath(adminUser, "/checkout?plan=starter_pro&billing=monthly"), "/admin");
    assert.equal(getPostLoginPath(adminUser, "/checkout"), "/admin");
    assert.equal(getPostLoginPath(adminUser, "/"), "/admin");
    assert.equal(getPostLoginPath(adminUser, ""), "/admin");
  });

  it("admin đăng nhập với redirect hợp lệ của admin hoặc cuộc họp thì được giữ", () => {
    assert.equal(getPostLoginPath(adminUser, "/admin/bookings"), "/admin/bookings");
    assert.equal(getPostLoginPath(adminUser, "/meeting/session-123"), "/meeting/session-123");
  });

  it("mentor đăng nhập từ trang bảng giá phải về /mentor/dashboard", () => {
    assert.equal(getPostLoginPath(mentorUser, "/pricing"), "/mentor/dashboard");
    assert.equal(getPostLoginPath(mentorUser, "/checkout?plan=starter_pro"), "/mentor/dashboard");
    assert.equal(getPostLoginPath(mentorUser, "/mentor/sessions"), "/mentor/sessions");
    assert.equal(getPostLoginPath(mentorUser, "/meeting/session-456"), "/meeting/session-456");
  });

  it("moderator đăng nhập từ trang bảng giá phải về /moderator", () => {
    assert.equal(getPostLoginPath(moderatorUser, "/pricing"), "/moderator");
    assert.equal(getPostLoginPath(moderatorUser, "/moderator/queue"), "/moderator/queue");
  });

  it("company moderator đăng nhập từ trang bảng giá phải về /company", () => {
    assert.equal(getPostLoginPath(companyUser, "/pricing"), "/company");
    assert.equal(getPostLoginPath(companyUser, "/company/jobs"), "/company/jobs");
  });

  it("customer đăng nhập từ bảng giá / checkout được giữ nguyên đích", () => {
    assert.equal(getPostLoginPath(customerUser, "/pricing"), "/pricing");
    assert.equal(getPostLoginPath(customerUser, "/checkout?plan=starter_pro"), "/checkout?plan=starter_pro");
  });

  it("customer không được redirect sang khu quản trị hay cố vấn", () => {
    assert.equal(getPostLoginPath(customerUser, "/admin"), "/");
    assert.equal(getPostLoginPath(customerUser, "/mentor/dashboard"), "/");
    assert.equal(getPostLoginPath(customerUser, "/moderator"), "/");
    assert.equal(getPostLoginPath(customerUser, "/company"), "/");
  });
});
