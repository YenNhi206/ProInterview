/**
 * Danh sách env bắt buộc lúc khởi động — tách khỏi server.js để unit test được.
 * `critical` thiếu → server exit(1); `prodOnly` chỉ bắt buộc khi NODE_ENV=production
 * (dev vẫn chạy được với fallback, vd pepper refresh token).
 */
export const REQUIRED_ENV = {
  MONGO_URI:            { critical: true,  feature: "Database" },
  LLM_API_KEY:          { critical: true,  feature: "AI question generation + evaluation" },
  LLM_BASE_URL:         { critical: true,  feature: "LLM API endpoint" },
  JWT_SECRET:           { critical: true,  prodOnly: true, feature: "Ký access token (đăng nhập)" },
  REFRESH_TOKEN_PEPPER: { critical: true,  prodOnly: true, feature: "Hash refresh token" },
  CV_ANALYZER_URL:      { critical: false, feature: "CV text extraction (Python service)" },
  DID_API_KEY:          { critical: false, feature: "D-ID avatar (fallback Cloudinary)" },
};

/** @returns {{ critical: {key, feature}[], warnings: {key, feature}[] }} */
export function findMissingEnv(env = process.env, { isProd = false } = {}) {
  const critical = [];
  const warnings = [];
  for (const [key, config] of Object.entries(REQUIRED_ENV)) {
    if (String(env[key] ?? "").trim()) continue;
    const isCritical = config.critical && (!config.prodOnly || isProd);
    (isCritical ? critical : warnings).push({ key, feature: config.feature });
  }
  return { critical, warnings };
}
