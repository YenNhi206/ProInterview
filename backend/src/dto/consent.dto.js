import Joi from "joi";

/** Phiên bản nội dung thông báo camera ở trang /interview — FE gửi lên đúng giá trị này. */
export const CAMERA_CONSENT_VERSION = "camera-v1";

const cameraConsentSchema = Joi.object({
  accepted: Joi.boolean().required(),
  version: Joi.string().valid(CAMERA_CONSENT_VERSION).required(),
}).unknown(false);

export function validateCameraConsent(body) {
  return cameraConsentSchema.validate(body ?? {}, { abortEarly: false, stripUnknown: false });
}
