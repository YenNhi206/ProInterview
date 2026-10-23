import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { scrubSensitiveRequestData } from "./sentry.js";

const ev = (url) => ({ request: { url, method: "POST", data: '{"imageBase64":"AAAA"}' } });

describe("scrubSensitiveRequestData", () => {
  for (const url of [
    "https://api.example.com/api/interviews/sessions/abc/analyze-face",
    "https://api.example.com/api/interviews/extract-cv-text",
    "https://api.example.com/api/cv/analyze/full",
    "https://api.example.com/api/auth/login",
  ]) {
    it(`xoá body: ${url}`, () => {
      const out = scrubSensitiveRequestData(ev(url));
      assert.equal("data" in out.request, false);
      assert.equal(out.request.url, url);
    });
  }

  it("giữ body ở route thường", () => {
    const out = scrubSensitiveRequestData(ev("https://api.example.com/api/bookings"));
    assert.equal(out.request.data, '{"imageBase64":"AAAA"}');
  });

  it("event không có request vẫn trả về nguyên vẹn", () => {
    const e = { message: "x" };
    assert.equal(scrubSensitiveRequestData(e), e);
  });
});
