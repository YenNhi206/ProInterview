import { test } from "node:test";
import assert from "node:assert/strict";
import { CV_MAX_BYTES, cvFileError, defaultCvTitle, formatFileSize, sortCvs } from "./cvVault.js";

test("cvFileError: đúng đuôi và dưới 5 MB thì hợp lệ", () => {
  assert.equal(cvFileError({ name: "CV_Nhi.PDF", size: 1000 }), null);
  assert.equal(cvFileError({ name: "cv.docx", size: CV_MAX_BYTES }), null);
  assert.match(cvFileError({ name: "anh.png", size: 10 }), /PDF/);
  assert.match(cvFileError({ name: "cv.pdf", size: CV_MAX_BYTES + 1 }), /5 MB/);
  assert.match(cvFileError({ name: "cv.pdf", size: 0 }), /rỗng/);
  assert.match(cvFileError(null), /Chọn/);
});

test("formatFileSize / defaultCvTitle", () => {
  assert.equal(formatFileSize(512), "512 B");
  assert.equal(formatFileSize(2048), "2 KB");
  assert.equal(formatFileSize(3 * 1024 * 1024), "3.0 MB");
  assert.equal(defaultCvTitle("CV_Frontend-2026.pdf"), "CV Frontend 2026");
  assert.equal(defaultCvTitle(".pdf"), "CV mới");
});

test("sortCvs: CV mặc định đứng đầu, còn lại mới cập nhật trước", () => {
  const out = sortCvs([
    { id: "a", isDefault: false, updatedAt: "2026-11-01" },
    { id: "b", isDefault: true, updatedAt: "2026-10-01" },
    { id: "c", isDefault: false, updatedAt: "2026-11-10" },
  ]);
  assert.deepEqual(out.map((c) => c.id), ["b", "c", "a"]);
});
