import { test } from "node:test";
import assert from "node:assert/strict";
import { CAMERA_CONSENT_VERSION, hasCameraConsent } from "./cameraConsent.js";

test("hasCameraConsent: chỉ true khi đã đồng ý đúng version hiện tại", () => {
  assert.equal(hasCameraConsent(null), false);
  assert.equal(hasCameraConsent({}), false);
  assert.equal(hasCameraConsent({ consent: { camera: null } }), false);
  assert.equal(
    hasCameraConsent({ consent: { camera: { acceptedAt: "2026-10-23T00:00:00Z", version: "camera-v0" } } }),
    false,
  );
  assert.equal(
    hasCameraConsent({ consent: { camera: { acceptedAt: "2026-10-23T00:00:00Z", version: CAMERA_CONSENT_VERSION } } }),
    true,
  );
});
