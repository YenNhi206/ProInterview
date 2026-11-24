/**
 * N-11 (NFR-01, NFR-02, AIS-05): mỗi lần phân tích CV chỉ có **một** bản ghi `CVAnalysis`.
 *
 *   POST /api/cv/analyze*  ──> startAnalysisRun  ── status `processing` (tạo mới, hoặc dùng lại `analysisId`
 *                                                   FE gửi kèm khi thử bậc thấp hơn: suggestions → full → basic)
 *                          ──> gọi Python (đo `durationMs`)
 *                          ──> finishAnalysisRun ── `completed` + `result.match` + `meta.processingTimeMs`,
 *                                                   trừ 1 lượt quota (`quotaCharged: true`)
 *                                                ── hoặc `failed` + `error` + `meta.processingTimeMs`
 *   POST /api/cv/analyses { analysisId } ──> FE ghi phần kết quả đầy đủ (gợi ý, `_ui`, file) vào **chính** bản ghi đó;
 *                                            không trừ quota lần nữa nếu đã `quotaCharged`.
 *
 * Bản ghi `processing` / `failed` không hiện trong lịch sử của ứng viên (`CV_ANALYSIS_DONE_FILTER`), nhưng vẫn nằm
 * trong DB để đo thời gian và tỉ lệ lỗi (QA-03).
 */
import mongoose from "mongoose";
import { CVAnalysis, CV_ANALYSIS_RUN_STATUSES } from "../models/CVAnalysis.js";
import { User } from "../models/User.js";
import { logger } from "../config/logger.js";

/** Endpoint Python → tier lưu DB (khớp `analysisTier` FE tính ở `CVAnalysis.jsx`). */
export const CV_ENDPOINT_TIER = Object.freeze({
  "/analyze": "basic",
  "/analyze/full": "full",
  "/analyze/suggestions": "suggestions",
  "/analyze/field": "suggestions",
});

const MAX_ERROR_LEN = 500;

function planAtTimeOf(plan) {
  if (plan === "elite_pro") return "enterprise";
  if (plan === "starter_pro") return "pro";
  return "free";
}

/**
 * Mở (hoặc mở lại) bản ghi `processing` trước khi gọi Python.
 * `analysisId` hợp lệ, của chính user, đang `processing`/`failed` → dùng lại; ngược lại tạo mới.
 * @returns {Promise<string>} id bản ghi
 */
export async function startAnalysisRun({ userId, analysisId, endpoint, cvFileName, jdFileName, field }) {
  const mode = endpoint === "/analyze/field" ? "field" : "jd";
  const tier = CV_ENDPOINT_TIER[endpoint] || "basic";
  const set = {
    status: "processing",
    tier,
    "meta.pythonEndpoint": endpoint,
    ...(cvFileName ? { cvFileName } : {}),
    ...(jdFileName ? { jdFileName } : {}),
    ...(field ? { field } : {}),
  };

  if (analysisId && mongoose.isValidObjectId(analysisId)) {
    const reused = await CVAnalysis.findOneAndUpdate(
      { _id: analysisId, userId, mode, status: { $in: [...CV_ANALYSIS_RUN_STATUSES] } },
      { $set: set, $unset: { error: "" } },
      { new: true, projection: { _id: 1 } },
    );
    if (reused) return String(reused._id);
  }

  const user = await User.findById(userId).select("plan").lean();
  const created = await CVAnalysis.create({
    userId,
    mode,
    planAtTime: planAtTimeOf(user?.plan),
    ...set,
    cvFileName: cvFileName || "cv.pdf",
    meta: { pythonEndpoint: endpoint },
  });
  return String(created._id);
}

/** `match` gọn từ phản hồi Python (`raw.match.match_score`, `matching`, `missing`); không có điểm thì `null`. */
export function matchFromPython(raw) {
  const m = raw?.match;
  const score = Number(m?.match_score);
  if (!m || !Number.isFinite(score)) return null;
  const names = (list) => (Array.isArray(list) ? list.map((x) => String(x)).filter(Boolean) : []);
  return {
    score: Math.min(100, Math.max(0, Math.round(score))),
    matchedKeywords: names(m.matching),
    missingKeywords: names(m.missing),
  };
}

/**
 * Ghi kết quả lần gọi Python.
 * - Thành công: trừ 1 lượt quota (atomic, chỉ khi còn lượt và chưa trừ cho bản ghi này) rồi `completed`.
 *   Hết lượt giữa chừng (đa tab) → `failed` với `error: quota_exceeded`, trả `{ ok: false, quotaExceeded: true }`.
 * - Thất bại: `failed` + `error`.
 * @returns {Promise<{ ok: boolean, quotaExceeded?: boolean }>}
 */
export async function finishAnalysisRun(analysisId, { userId, ok, durationMs, raw, error, httpStatus }) {
  const base = { "meta.processingTimeMs": Math.max(0, Math.round(Number(durationMs) || 0)) };

  if (!ok) {
    await CVAnalysis.updateOne(
      { _id: analysisId, userId },
      { $set: { ...base, status: "failed", error: String(error || `http_${httpStatus || "error"}`).slice(0, MAX_ERROR_LEN) } },
    );
    return { ok: false };
  }

  const doc = await CVAnalysis.findOne({ _id: analysisId, userId }).select("quotaCharged").lean();
  if (!doc?.quotaCharged) {
    const user = await User.findById(userId).select("quota").lean();
    const charged = await User.findOneAndUpdate(
      { _id: userId, "quota.cvAnalysisUsed": { $lt: user?.quota?.cvAnalysisLimit ?? 3 } },
      { $inc: { "quota.cvAnalysisUsed": 1 } },
      { new: true, projection: { _id: 1 } },
    );
    if (!charged) {
      await CVAnalysis.updateOne({ _id: analysisId, userId }, { $set: { ...base, status: "failed", error: "quota_exceeded" } });
      return { ok: false, quotaExceeded: true };
    }
  }

  const match = matchFromPython(raw);
  const fallback = Boolean(raw?._fallback ?? raw?._mock);
  await CVAnalysis.updateOne(
    { _id: analysisId, userId },
    {
      $set: {
        ...base,
        status: "completed",
        completedAt: new Date(),
        quotaCharged: true,
        "meta.fallbackTriggered": fallback,
        ...(match ? { "result.match": match } : {}),
      },
      $unset: { error: "" },
    },
  );
  return { ok: true };
}

/** Log 1 dòng `cv_analysis_timing` cho mỗi lần gọi Python (đo NFR-01 trên Render). */
export function logAnalysisTiming(fields) {
  const level = fields.ok ? "info" : "warn";
  logger[level]("cv_analysis_timing", fields);
}
