import { it } from "node:test";
import assert from "node:assert/strict";
import { normalizeWorkspaceTheme, resolveWorkspaceTheme, DEFAULT_WORKSPACE_THEME } from "./workspaceTheme.js";

it("giữ 3 lựa chọn hợp lệ, giá trị lạ rơi về mặc định tối", () => {
  for (const mode of ["light", "dark", "system"]) assert.equal(normalizeWorkspaceTheme(mode), mode);
  assert.equal(DEFAULT_WORKSPACE_THEME, "dark");
  for (const bad of [null, undefined, "", "auto", "LIGHT"]) assert.equal(normalizeWorkspaceTheme(bad), "dark");
});

it("system đi theo cài đặt máy, sáng/tối cố định thì bỏ qua cài đặt máy", () => {
  assert.equal(resolveWorkspaceTheme("system", true), "dark");
  assert.equal(resolveWorkspaceTheme("system", false), "light");
  assert.equal(resolveWorkspaceTheme("light", true), "light");
  assert.equal(resolveWorkspaceTheme("dark", false), "dark");
  assert.equal(resolveWorkspaceTheme("garbage", false), "dark");
});
