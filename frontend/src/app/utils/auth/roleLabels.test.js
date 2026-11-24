import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { roleLabel, ROLE_LABELS } from "./roleLabels.js";

describe("roleLabel (N-13)", () => {
  it("dùng tên trong đơn đăng ký", () => {
    assert.equal(roleLabel("customer"), "Candidate");
    assert.equal(roleLabel("moderator"), "Platform Moderator");
    assert.equal(roleLabel("company_moderator"), "Company Moderator");
    assert.equal(roleLabel("mentor"), "Mentor");
    assert.equal(roleLabel("admin"), "Admin");
  });

  it("role cũ enterprise hiển thị Company Moderator", () => {
    assert.equal(roleLabel("enterprise"), "Company Moderator");
  });

  it("không nhãn nào còn chữ customer / enterprise", () => {
    for (const label of Object.values(ROLE_LABELS)) {
      assert.doesNotMatch(label, /customer|enterprise/i);
    }
  });

  it("role lạ trả nguyên giá trị, rỗng / null trả chuỗi rỗng", () => {
    assert.equal(roleLabel("guest"), "guest");
    assert.equal(roleLabel(""), "");
    assert.equal(roleLabel(null), "");
  });
});
