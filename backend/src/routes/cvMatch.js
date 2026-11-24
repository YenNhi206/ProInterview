import { Router } from "express";
import multer from "multer";
import { authJwt } from "../middleware/authJwt.js";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { cvAnalyzeLimiter } from "../middleware/rateLimiters.js";
import { requireCvAnalysisQuota } from "../utils/planGuard.js";
import { createStepTimer } from "../utils/stepTimer.js";
import { startAnalysisRun, finishAnalysisRun, logAnalysisTiming } from "../services/cvAnalysisRunService.js";
import { bestFitCvs } from "../services/cvBestFitService.js";

export const cvMatchRouter = Router();

const upload = multer({ storage: multer.memoryStorage() });

const CV_ANALYZER_URL = process.env.CV_ANALYZER_URL || "http://localhost:8000";

/**
 * Gọi Python. Trả `{ status, data }` khi Python phản hồi JSON, hoặc `{ status, error, logError }` khi không gọi
 * được / phản hồi không phải JSON (`status` là mã Express trả cho FE).
 */
async function callAnalyzer(path, files, extraFields) {
  const form = new FormData();
  for (const [field, file] of Object.entries(files)) {
    const blob = new Blob([file.buffer], { type: "application/pdf" });
    form.append(field, blob, file.originalname);
  }
  for (const [key, value] of Object.entries(extraFields)) {
    if (value != null && value !== "") form.append(key, String(value));
  }

  let response;
  try {
    response = await fetch(`${CV_ANALYZER_URL}${path}`, { method: "POST", body: form });
  } catch (err) {
    console.error("[cvMatch] fetch failed:", CV_ANALYZER_URL, err?.message);
    return {
      status: 503,
      error:
        "Không kết nối được service phân tích CV (Python). Trong thư mục cv_jd_matching chạy: python -m uvicorn main:app --reload --port 8000 (hoặc cài uvicorn vào PATH). Kiểm tra biến CV_ANALYZER_URL trong backend/.env.",
      logError: `fetch_failed: ${err?.message || err}`,
    };
  }

  const text = await response.text();
  try {
    return { status: response.status, data: text ? JSON.parse(text) : {} };
  } catch (parseErr) {
    console.error("[cvMatch] analyzer non-JSON body:", CV_ANALYZER_URL, response.status, text?.slice(0, 400), parseErr?.message);
    const isGatewayHtml = response.status >= 500 || text?.trimStart().startsWith("<!");
    const deployHint = isGatewayHtml
      ? ` Service Python tại CV_ANALYZER_URL (${CV_ANALYZER_URL}) không phản hồi JSON (HTTP ${response.status}). Trên Render: deploy thư mục cv_jd_matching riêng, Health Check Path = /health, set LLM_API_KEY (+ LLM_BASE_URL, LLM_MODEL), rồi gán URL service vào CV_ANALYZER_URL của backend. Free tier có thể sleep — thử mở URL /health trước khi phân tích.`
      : " Xem log FastAPI (cv_jd_matching) — thường do lỗi PDF, thiếu LLM_API_KEY, hoặc exception Python.";
    return {
      status: 502,
      error: `Service phân tích CV trả về dữ liệu không hợp lệ.${deployHint}`,
      logError: `non_json_http_${response.status}`,
    };
  }
}

function pythonErrorText(data, status) {
  const detail = data?.detail ?? data?.error ?? data?.message;
  if (typeof detail === "string" && detail) return detail;
  if (detail) return JSON.stringify(detail);
  return `http_${status}`;
}

/**
 * N-11: mở bản ghi `CVAnalysis` (`processing`) trước khi gọi Python, ghi `completed` / `failed` kèm
 * `meta.processingTimeMs` sau, log `cv_analysis_timing`. Phản hồi luôn kèm `analysisId` để FE ghi kết quả
 * đầy đủ vào đúng bản ghi này (`POST /api/cv/analyses { analysisId }`) hoặc gửi lại khi thử bậc thấp hơn.
 */
async function proxyToAnalyzer(path, files, req, res, extraFields = {}) {
  const timing = createStepTimer();
  const analysisId = await timing.step("dbStartMs", () =>
    startAnalysisRun({
      userId: req.userId,
      analysisId: req.body?.analysisId,
      endpoint: path,
      cvFileName: files.resume?.originalname,
      jdFileName: files.jd?.originalname,
      field: extraFields.field,
    }),
  );

  const result = await timing.step("pythonMs", () => callAnalyzer(path, files, extraFields));
  const ok = !result.error && result.status >= 200 && result.status < 300;
  const errorText = result.error ? result.logError || result.error : ok ? "" : pythonErrorText(result.data, result.status);
  const finished = await timing.step("dbFinishMs", () =>
    finishAnalysisRun(analysisId, {
      userId: req.userId,
      ok,
      durationMs: timing.elapsed(),
      raw: result.data,
      error: errorText,
      httpStatus: result.status,
    }),
  );
  const succeeded = ok && finished.ok;
  logAnalysisTiming(
    timing.summary({
      ok: succeeded,
      analysisId,
      userId: String(req.userId),
      endpoint: path,
      httpStatus: result.status,
      ...(succeeded ? {} : { error: finished.quotaExceeded ? "quota_exceeded" : errorText.slice(0, 200) }),
      cvBytes: files.resume?.buffer?.length ?? 0,
      jdBytes: files.jd?.buffer?.length ?? 0,
    }),
  );

  if (finished.quotaExceeded) {
    return res.status(403).json({
      success: false,
      error: "quota_exceeded",
      message: "Bạn đã hết lượt phân tích CV. Vui lòng nâng cấp gói.",
      analysisId,
    });
  }
  if (result.error) return res.status(result.status).json({ success: false, error: result.error, analysisId });

  // Surface LLM key errors as 502 with actionable message
  if (result.status === 502 && result.data?.detail) {
    return res.status(502).json({ success: false, error: pythonErrorText(result.data, 502), analysisId });
  }

  const body = result.data && typeof result.data === "object" && !Array.isArray(result.data) ? result.data : { data: result.data };
  res.status(result.status).json({ ...body, analysisId });
}

// POST /api/cv/analyze — skill matching (không cần Ollama)
cvMatchRouter.post(
  "/analyze",
  authJwt,
  cvAnalyzeLimiter,
  requireCvAnalysisQuota,
  upload.fields([{ name: "resume", maxCount: 1 }, { name: "jd", maxCount: 1 }]),
  asyncHandler(async (req, res) => {
    const resume = req.files?.["resume"]?.[0];
    const jd = req.files?.["jd"]?.[0];
    if (!resume || !jd) return res.status(400).json({ success: false, error: "Cần upload cả resume và jd (PDF)" });
    await proxyToAnalyzer("/analyze", { resume, jd }, req, res);
  }),
);

// POST /api/cv/analyze/full — skill matching + Ollama scoring
cvMatchRouter.post(
  "/analyze/full",
  authJwt,
  cvAnalyzeLimiter,
  requireCvAnalysisQuota,
  upload.fields([{ name: "resume", maxCount: 1 }, { name: "jd", maxCount: 1 }]),
  asyncHandler(async (req, res) => {
    const resume = req.files?.["resume"]?.[0];
    const jd = req.files?.["jd"]?.[0];
    if (!resume || !jd) return res.status(400).json({ success: false, error: "Cần upload cả resume và jd (PDF)" });
    await proxyToAnalyzer("/analyze/full", { resume, jd }, req, res);
  }),
);

// POST /api/cv/analyze/suggestions — full pipeline + suggestions
cvMatchRouter.post(
  "/analyze/suggestions",
  authJwt,
  cvAnalyzeLimiter,
  requireCvAnalysisQuota,
  upload.fields([{ name: "resume", maxCount: 1 }, { name: "jd", maxCount: 1 }]),
  asyncHandler(async (req, res) => {
    const resume = req.files?.["resume"]?.[0];
    const jd = req.files?.["jd"]?.[0];
    if (!resume || !jd) return res.status(400).json({ success: false, error: "Cần upload cả resume và jd (PDF)" });
    await proxyToAnalyzer("/analyze/suggestions", { resume, jd }, req, res);
  }),
);

// POST /api/cv/analyze/field — CV + ngành nghề (không JD)
cvMatchRouter.post(
  "/analyze/field",
  authJwt,
  cvAnalyzeLimiter,
  requireCvAnalysisQuota,
  upload.fields([{ name: "resume", maxCount: 1 }]),
  asyncHandler(async (req, res) => {
    const resume = req.files?.["resume"]?.[0];
    const field = req.body?.field || "IT / Công nghệ";
    if (!resume) return res.status(400).json({ success: false, error: "Cần upload CV (PDF)" });
    await proxyToAnalyzer("/analyze/field", { resume }, req, res, { field });
  }),
);

// PR-05: POST /api/cv/best-fit — xếp hạng 2–5 CV trong kho với một JD (jdText hoặc jobPostId).
// Cần còn lượt phân tích CV (gọi LLM) nhưng không trừ lượt.
cvMatchRouter.post(
  "/best-fit",
  authJwt,
  cvAnalyzeLimiter,
  requireCvAnalysisQuota,
  asyncHandler(async (req, res) => {
    const bestFit = await bestFitCvs(req.userId, req.body);
    res.json({ success: true, bestFit });
  }),
);
