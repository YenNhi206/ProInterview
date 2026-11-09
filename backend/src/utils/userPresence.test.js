import test from "node:test";
import assert from "node:assert/strict";
import { isUserOnline, PRESENCE_ONLINE_MS } from "./userPresence.js";

test("isUserOnline true within window", () => {
  const recent = new Date(Date.now() - PRESENCE_ONLINE_MS + 1000);
  assert.equal(isUserOnline(recent), true);
});

test("isUserOnline false when stale", () => {
  const old = new Date(Date.now() - PRESENCE_ONLINE_MS - 1000);
  assert.equal(isUserOnline(old), false);
});

test("isUserOnline false when missing", () => {
  assert.equal(isUserOnline(null), false);
  assert.equal(isUserOnline(undefined), false);
});
