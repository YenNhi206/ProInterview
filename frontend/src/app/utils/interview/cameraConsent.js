/**
 * Đồng ý camera trong phỏng vấn AI — phải khớp CAMERA_CONSENT_VERSION ở backend
 * (backend/src/dto/consent.dto.js). Đổi nội dung thông báo thì tăng version để hỏi lại.
 */
export const CAMERA_CONSENT_VERSION = "camera-v1";

/** user.consent.camera = { acceptedAt, version } | null (từ toPublicUser). */
export function hasCameraConsent(user) {
  const camera = user?.consent?.camera;
  return Boolean(camera?.acceptedAt) && camera?.version === CAMERA_CONSENT_VERSION;
}
