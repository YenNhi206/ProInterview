import { Router } from "express";
import multer from "multer";
import { authJwt } from "../middleware/authJwt.js";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { baselineTrialLimiter } from "../middleware/rateLimiters.js";
import { AIProvidersController } from "../controllers/aiProvidersController.js";

const upload = multer({
  storage: multer.memoryStorage(),
  limits:  { fileSize: 25 * 1024 * 1024 }, // 25MB cho audio files
});

export const aiProvidersRouter = Router();

// ── Public config ─────────────────────────────────────────────────────────────
aiProvidersRouter.get("/config", AIProvidersController.getConfig);

// ── STT ───────────────────────────────────────────────────────────────────────
aiProvidersRouter.post(
  "/transcribe",
  authJwt,
  upload.single("audio"),
  asyncHandler(AIProvidersController.transcribe),
);

// ── TTS ───────────────────────────────────────────────────────────────────────
aiProvidersRouter.post("/tts",       authJwt, asyncHandler(AIProvidersController.tts));
aiProvidersRouter.get("/tts/voices", authJwt, asyncHandler(AIProvidersController.listVoices));

// ── Emotion ───────────────────────────────────────────────────────────────────
aiProvidersRouter.post(
  "/emotion",
  authJwt,
  upload.single("audio"),
  asyncHandler(AIProvidersController.analyzeEmotion),
);

// ── D-ID Avatar ───────────────────────────────────────────────────────────────
aiProvidersRouter.get("/avatar/presenters", authJwt, asyncHandler(AIProvidersController.listPresenters));
aiProvidersRouter.get("/avatar/usage",      authJwt, asyncHandler(AIProvidersController.getAvatarUsage));

// ── Interview Pre-generation ──────────────────────────────────────────────────
// Sync (đợi tất cả xong — timeout ~120s): dùng cho interview flow chính
aiProvidersRouter.post(
  "/interview/pregenerate",
  authJwt,
  asyncHandler(AIProvidersController.pregenerateSync),
);

// Public — free trial: pregen 3 câu hỏi baseline cố định (cache dùng chung toàn hệ thống)
aiProvidersRouter.post(
  "/interview/pregen-baseline",
  baselineTrialLimiter,
  asyncHandler(AIProvidersController.pregenerateBaseline),
);

// Async (trả jobId ngay, poll để theo dõi): dùng khi cần progress updates chi tiết
aiProvidersRouter.post(
  "/interview/pregen/start",
  authJwt,
  asyncHandler(AIProvidersController.startPregenJob),
);
aiProvidersRouter.get(
  "/interview/pregen/:jobId",
  authJwt,
  asyncHandler(AIProvidersController.getPregenStatus),
);

// ── D-ID WebRTC Streaming Proxy ───────────────────────────────────────────────
// FE calls /api/ai/did/streams[/...] → BE proxies to api.d-id.com with server-side key.
// VITE_DID_API_KEY no longer needed in the frontend.
const didProxyHandler = asyncHandler(AIProvidersController.didProxy);
aiProvidersRouter.post(   "/did/streams",          authJwt, didProxyHandler);
aiProvidersRouter.post(   "/did/streams/:id/sdp",  authJwt, didProxyHandler);
aiProvidersRouter.post(   "/did/streams/:id/ice",  authJwt, didProxyHandler);
aiProvidersRouter.post(   "/did/streams/:id",      authJwt, didProxyHandler);
aiProvidersRouter.delete( "/did/streams/:id",      authJwt, didProxyHandler);
