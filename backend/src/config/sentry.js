/**
 * Sentry error tracking — optional, env-gated (SENTRY_DSN).
 * Phải init càng sớm càng tốt trong entry point (server.js), trước khi import app.js.
 */
import * as Sentry from "@sentry/node";

let initialized = false;

/**
 * Route có body nhạy cảm: ảnh khuôn mặt base64, file CV, mật khẩu/token.
 * SDK v8 tự đính kèm body request (tới 1MB) vào error event — phải xoá trước khi gửi.
 */
const SENSITIVE_BODY_PATHS = ["/analyze-face", "/extract-cv-text", "/cv/analyze", "/auth/"];

/** beforeSend: xoá `event.request.data` khi URL thuộc route nhạy cảm. Export để unit test. */
export function scrubSensitiveRequestData(event) {
  const url = String(event?.request?.url || "");
  if (event?.request && "data" in event.request && SENSITIVE_BODY_PATHS.some((p) => url.includes(p))) {
    delete event.request.data;
  }
  return event;
}

export function initSentry() {
  const dsn = process.env.SENTRY_DSN?.trim();
  if (!dsn) return false;
  if (initialized) return true;

  Sentry.init({
    dsn,
    environment:       process.env.NODE_ENV || "development",
    tracesSampleRate:  Number(process.env.SENTRY_TRACES_SAMPLE_RATE) || 0.1,
    beforeSend:        scrubSensitiveRequestData,
  });
  initialized = true;
  return true;
}

export function isSentryEnabled() {
  return initialized;
}

export { Sentry };
