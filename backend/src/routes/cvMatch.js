import { Router } from "express";
import multer from "multer";
import { authJwt } from "../middleware/authJwt.js";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { cvAnalyzeLimiter } from "../middleware/rateLimiters.js";
import { requireCvAnalysisQuota } from "../utils/planGuard.js";

export const cvMatchRouter = Router();

const upload = multer({ storage: multer.memoryStorage() });

const CV_ANALYZER_URL = process.env.CV_ANALYZER_URL || "http://localhost:8000";

async function proxyToAnalyzer(path, files, res, extraFields = {}) {
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
    return res.status(503).json({
      success: false,
      error:
        "Không kết nối được service phân tích CV (Python). Trong thư mục cv_jd_matching chạy: python -m uvicorn main:app --reload --port 8000 (hoặc cài uvicorn vào PATH). Kiểm tra biến CV_ANALYZER_URL trong backend/.env.",
    });
  }

  const text = await response.text();
  let data;
  try {
    data = text ? JSON.parse(text) : {};
  } catch (parseErr) {
    console.error("[cvMatch] analyzer non-JSON body:", CV_ANALYZER_URL, response.status, text?.slice(0, 400), parseErr?.message);
    const isGatewayHtml = response.status >= 500 || text?.trimStart().startsWith("<!");
    const deployHint = isGatewayHtml
      ? ` Service Python tại CV_ANALYZER_URL (${CV_ANALYZER_URL}) không phản hồi JSON (HTTP ${response.status}). Trên Render: deploy thư mục cv_jd_matching riêng, Health Check Path = /health, set LLM_API_KEY (+ LLM_BASE_URL, LLM_MODEL), rồi gán URL service vào CV_ANALYZER_URL của backend. Free tier có thể sleep — thử mở URL /health trước khi phân tích.`
      : " Xem log FastAPI (cv_jd_matching) — thường do lỗi PDF, thiếu LLM_API_KEY, hoặc exception Python.";
    return res.status(502).json({
      success: false,
      error: `Service phân tích CV trả về dữ liệu không hợp lệ.${deployHint}`,
    });
  }

  // Surface LLM key errors as 502 with actionable message
  if (response.status === 502 && data?.detail) {
    const detail = typeof data.detail === "string" ? data.detail : JSON.stringify(data.detail);
    return res.status(502).json({ success: false, error: detail });
  }

  res.status(response.status).json(data);
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
    await proxyToAnalyzer("/analyze", { resume, jd }, res);
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
    await proxyToAnalyzer("/analyze/full", { resume, jd }, res);
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
    await proxyToAnalyzer("/analyze/suggestions", { resume, jd }, res);
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
    await proxyToAnalyzer("/analyze/field", { resume }, res, { field });
  }),
);
