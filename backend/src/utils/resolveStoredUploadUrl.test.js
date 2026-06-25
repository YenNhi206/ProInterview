import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { isAllowedMediaUrl } from "./resolveStoredUploadUrl.js";

describe("isAllowedMediaUrl", () => {
  it("cho phép rỗng (field optional)", () => {
    assert.equal(isAllowedMediaUrl(""), true);
    assert.equal(isAllowedMediaUrl(undefined), true);
    assert.equal(isAllowedMediaUrl(null), true);
  });

  it("cho phép đường dẫn /uploads/ tương đối", () => {
    assert.equal(isAllowedMediaUrl("/uploads/file-123.png"), true);
  });

  it("cho phép URL tuyệt đối tới backend có /uploads/", () => {
    assert.equal(isAllowedMediaUrl("https://api.prointerview.app/uploads/video-1.mp4"), true);
    assert.equal(isAllowedMediaUrl("http://127.0.0.1:5000/uploads/video-1.mp4"), true);
  });

  it("cho phép URL Cloudinary", () => {
    assert.equal(
      isAllowedMediaUrl("https://res.cloudinary.com/demo/video/upload/v1/prointerview/courses/abc.mp4"),
      true,
    );
  });

  it("chặn link ngoài (hotlink) không thuộc hệ thống", () => {
    assert.equal(isAllowedMediaUrl("https://youtube.com/watch?v=abc"), false);
    assert.equal(isAllowedMediaUrl("https://evil.example.com/video.mp4"), false);
    assert.equal(isAllowedMediaUrl("https://attacker.cloudinary.com.evil.com/x.mp4"), false);
  });

  it("chặn chuỗi không phải URL hợp lệ và không phải /uploads/", () => {
    assert.equal(isAllowedMediaUrl("not-a-url-or-path"), false);
  });
});
