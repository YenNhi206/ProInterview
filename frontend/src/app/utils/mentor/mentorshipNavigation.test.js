import test from "node:test";
import assert from "node:assert/strict";
import { mentorshipBackTarget } from "./mentorshipNavigation.js";

test("returns to Mentor search with the original query", () => {
  assert.deepEqual(mentorshipBackTarget({ returnTo: "/mentors?search=React" }), { to: "/mentors?search=React", label: "Tìm Mentor" });
});
test("returns to the user's request list when created from that list", () => {
  assert.deepEqual(mentorshipBackTarget({ returnTo: "/mentor-requests" }), { to: "/mentor-requests", label: "Yêu cầu của tôi" });
});
test("direct entry falls back to search, detail falls back to the request list", () => {
  assert.equal(mentorshipBackTarget().to, "/mentors");
  assert.equal(mentorshipBackTarget({ detail: true }).to, "/mentor-requests");
});
test("rejects external URLs and return loops", () => {
  for (const returnTo of ["https://example.com", "//example.com", "/mentor-requests/new", "/mentors\\evil", "/admin"]) {
    assert.equal(mentorshipBackTarget({ returnTo }).to, "/mentors");
  }
});
test("Mentor request detail returns to its own board", () => {
  assert.deepEqual(mentorshipBackTarget({ returnTo: "/mentor/requests?scope=mine", mentor: true, detail: true }), { to: "/mentor/requests?scope=mine", label: "Nhu cầu từ mentee" });
});
