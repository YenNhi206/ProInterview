import { authedFetch } from "./authedJson.js";

/**
 * Bộ tiêu chí SHRM/DDI (LP-01) — `GET /api/competencies` (backend: routes/competencies.js).
 * Nguồn duy nhất là `backend/src/config/competencies.json`; FE không import file đó.
 *
 * Kết quả: `{ success, framework: { version, scale, passThreshold, aiCalibration, levels,
 * nullLabel, competencies: [{ key, nameVi, anchors, deprecated, ... }] } }`.
 * Form chấm điểm chỉ cho chọn key có `deprecated: false`; mức `null` hiển thị `nullLabel`.
 */
export const competenciesApi = {
  getFramework: () => authedFetch("/api/competencies"),
};
