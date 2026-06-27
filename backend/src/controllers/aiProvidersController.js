/**
 * aiProvidersController.js
 * Endpoints cho AI service stack (STT / TTS / Emotion / Avatar / Pre-generation).
 * Tất cả endpoints graceful-degrade: nếu service chưa có key → trả provider info + hint.
 *
 * Routes (mount tại /api/ai):
 *   GET  /config                        — Trạng thái tất cả providers
 *   POST /transcribe                    — Audio → text (AssemblyAI)
 *   POST /tts                           — Text → audio mp3 (ElevenLabs)
 *   GET  /tts/voices                    — Danh sách voices ElevenLabs
 *   POST /emotion                       — Audio/image → emotion (Hume AI)
 *
 *   GET  /avatar/presenters             — D-ID stock presenters
 *   GET  /avatar/usage                  — D-ID credits usage
 *
 *   POST /interview/pregenerate         — Pre-gen tất cả video + đợi kết quả (sync)
 *   POST /interview/pregen/start        — Bắt đầu pre-gen async (trả jobId)
 *   GET  /interview/pregen/:jobId       — Poll tiến độ pre-gen
 */

import { logger } from "../config/logger.js";
import { isAssemblyAIEnabled, getSTTProvider, transcribeAudio } from "../services/sttService.js";
import { isElevenLabsEnabled, getTTSProvider, synthesizeSpeech, listVoices } from "../services/ttsService.js";
import { isHumeEnabled, getEmotionProvider, analyzeAudioEmotion, analyzeFaceEmotion } from "../services/emotionService.js";
import {
  isDIDEnabled,
  isCircuitOpen,
  getAvatarProvider,
  getDIDUsage,
  listDIDPresenters,
} from "../services/avatarService.js";
import {
  pregenerateSync,
  startPregenerationJob,
  getPregenerationStatus,
} from "../services/videoPregenService.js";
import { getBaselineQuestionTexts } from "../config/baselineQuestions.js";

export const AIProvidersController = {

  /**
   * GET /api/ai/config
   * Trả trạng thái tất cả providers — frontend dùng để quyết định UI nào bật.
   */
  getConfig: (_req, res) => {
    res.json({
      success: true,
      providers: {
        llm: {
          current:    process.env.LLM_PROVIDER ?? "auto",
          baseUrl:    process.env.LLM_BASE_URL ?? "https://api.groq.com/openai/v1",
          model:      process.env.LLM_MODEL    ?? "llama-3.3-70b-versatile",
          anthropic:  Boolean(process.env.ANTHROPIC_API_KEY),
          langfuse:   Boolean(process.env.LANGFUSE_PUBLIC_KEY && process.env.LANGFUSE_SECRET_KEY),
        },
        stt: {
          provider:   getSTTProvider(),
          assemblyai: isAssemblyAIEnabled(),
        },
        tts: {
          provider:   getTTSProvider(),
          elevenlabs: isElevenLabsEnabled(),
        },
        emotion: {
          provider:    getEmotionProvider(),
          hume:        isHumeEnabled(),
          googleVision: Boolean(process.env.GOOGLE_VISION_API_KEY),
        },
        avatar: {
          provider:        getAvatarProvider(),
          // did=false khi key chưa set HOẶC circuit breaker đang open (D-ID degraded)
          // → frontend dùng giá trị này để quyết định có call pregen không
          did:             isDIDEnabled() && !isCircuitOpen(),
          circuitOpen:     isCircuitOpen(),
          mode:            "express",  // express = async REST (pre-generated MP4)
          redis:           Boolean(process.env.UPSTASH_REDIS_REST_URL),
          elevenlabsAudio: isElevenLabsEnabled(),  // ElevenLabs feeds into D-ID
        },
      },
    });
  },

  // ── STT ──────────────────────────────────────────────────────────────────────

  /**
   * POST /api/ai/transcribe
   * multipart/form-data: field "audio"
   * Query: ?lang=vi&speaker_labels=false&sentiment=false
   */
  transcribe: async (req, res) => {
    if (!isAssemblyAIEnabled()) {
      return res.json({
        success:  true,
        provider: "browser",
        text:     null,
        message:  "AssemblyAI không được cấu hình — dùng Web Speech API trên browser.",
      });
    }
    if (!req.file) {
      return res.status(400).json({ success: false, error: "Field 'audio' (file) là bắt buộc." });
    }

    try {
      const lang          = req.query.lang ?? "vi";
      const speakerLabels = req.query.speaker_labels === "true";
      const sentiment     = req.query.sentiment === "true";
      const contentType   = req.file.mimetype || "audio/webm";

      logger.info("stt_start", { userId: req.userId, lang, size: req.file.size });
      const result = await transcribeAudio(req.file.buffer, { languageCode: lang, speakerLabels, sentimentAnalysis: sentiment, contentType });
      logger.info("stt_ok", { userId: req.userId, textLen: result?.text?.length });
      res.json({ success: true, provider: "assemblyai", ...result });
    } catch (err) {
      logger.error("stt_failed", { userId: req.userId, error: err.message });
      res.status(500).json({ success: false, error: err.message });
    }
  },

  // ── TTS ──────────────────────────────────────────────────────────────────────

  /**
   * POST /api/ai/tts
   * Body JSON: { text, voiceId?, modelId?, stability?, similarityBoost?, style? }
   * Response: audio/mpeg binary
   */
  tts: async (req, res) => {
    if (!isElevenLabsEnabled()) {
      return res.status(503).json({
        success: false, provider: "did",
        error: "ElevenLabs không được cấu hình. D-ID tự dùng Azure TTS khi render.",
      });
    }
    const { text, voiceId, modelId, stability, similarityBoost, style } = req.body ?? {};
    if (!text?.trim()) return res.status(400).json({ success: false, error: "Field 'text' là bắt buộc." });
    if (text.length > 5000) return res.status(400).json({ success: false, error: "Text tối đa 5000 ký tự." });

    try {
      logger.info("tts_start", { userId: req.userId, textLen: text.length });
      const result = await synthesizeSpeech(text, { voiceId, modelId, stability, similarityBoost, style });
      res.setHeader("Content-Type",   result.contentType);
      res.setHeader("Content-Length", result.buffer.length);
      res.setHeader("X-TTS-Provider", "elevenlabs");
      res.send(result.buffer);
    } catch (err) {
      logger.error("tts_failed", { userId: req.userId, error: err.message });
      res.status(500).json({ success: false, error: err.message });
    }
  },

  /**
   * GET /api/ai/tts/voices
   */
  listVoices: async (_req, res) => {
    try {
      const voices = await listVoices();
      res.json({ success: true, voices });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  },

  // ── Emotion ──────────────────────────────────────────────────────────────────

  /**
   * POST /api/ai/emotion
   * multipart/form-data: field "audio" hoặc "image"
   * Query: ?type=audio|face
   */
  analyzeEmotion: async (req, res) => {
    if (!isHumeEnabled()) {
      return res.json({
        success: true, provider: "none", emotion: null,
        message: "Hume AI không được cấu hình. Google Vision chạy qua /interviews/sessions/:id/analyze-face.",
      });
    }
    if (!req.file) return res.status(400).json({ success: false, error: "Field 'audio' hoặc 'image' là bắt buộc." });

    const type = req.query.type ?? "audio";
    try {
      logger.info("emotion_start", { userId: req.userId, type, size: req.file.size });
      const emotion = type === "face" || req.file.mimetype?.startsWith("image/")
        ? await analyzeFaceEmotion(req.file.buffer, req.file.mimetype)
        : await analyzeAudioEmotion(req.file.buffer, req.file.mimetype || "audio/webm");
      logger.info("emotion_ok", { userId: req.userId, type });
      res.json({ success: true, emotion });
    } catch (err) {
      logger.error("emotion_failed", { userId: req.userId, error: err.message });
      res.status(500).json({ success: false, error: err.message });
    }
  },

  // ── D-ID Avatar ──────────────────────────────────────────────────────────────

  /**
   * GET /api/ai/avatar/presenters
   * Danh sách stock presenters từ D-ID (ảnh tĩnh + metadata).
   */
  listPresenters: async (_req, res) => {
    try {
      const presenters = await listDIDPresenters();
      res.json({ success: true, provider: "did", presenters });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  },

  /**
   * GET /api/ai/avatar/usage
   * Credits còn lại trong D-ID account.
   */
  getAvatarUsage: async (_req, res) => {
    try {
      const usage = await getDIDUsage();
      res.json({ success: true, provider: "did", usage });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  },

  // ── Interview Pre-generation ──────────────────────────────────────────────────

  /**
   * POST /api/ai/interview/pregenerate
   * Body JSON: { questions: string[], gender?: "female"|"male", voiceId? }
   *
   * Render TẤT CẢ video song song rồi trả về — đợi 30-90s.
   * Frontend hiện progress bar trong lúc chờ.
   * Dùng khi muốn đơn giản hóa: 1 request → tất cả URLs.
   *
   * persistVideo: true — mirror result_url D-ID (S3 us-west-2, không CDN) sang Cloudinary trước
   * khi trả về. Không mirror sẽ khiến browser phát thẳng từ S3 Oregon → khoảng cách xa, không edge
   * cache → buffer giữa chừng → video VÀ audio (chung 1 file mp4) cùng bị ngắt quãng khi phát.
   */
  pregenerateSync: async (req, res) => {
    if (!isDIDEnabled()) {
      return res.status(503).json({
        success: false,
        error:   "D_ID_API_KEY chưa được cấu hình.",
        hint:    "Đăng ký tại studio.d-id.com → API keys → set D_ID_API_KEY trong .env",
      });
    }

    const { questions, gender = "male", voiceId } = req.body ?? {};
    if (!Array.isArray(questions) || questions.length === 0) {
      return res.status(400).json({ success: false, error: "Field 'questions' (string[]) là bắt buộc." });
    }
    if (questions.length > 15) {
      return res.status(400).json({ success: false, error: "Tối đa 15 câu hỏi mỗi request." });
    }

    logger.info("pregen_sync_start", { userId: req.userId, count: questions.length, gender });

    // Wire client disconnect → abort D-ID polling immediately.
    // When the frontend's 45s Promise.race times out and closes the connection,
    // req fires 'close' → signal aborts → pollDIDTalk stops → no more D-ID calls.
    const ac = new AbortController();
    req.on("close", () => {
      if (!res.headersSent) ac.abort();
    });

    try {
      const result = await pregenerateSync(questions, { gender, voiceId, userId: req.userId, persistVideo: true }, ac.signal);

      logger.info("pregen_sync_ok", {
        userId:    req.userId,
        count:     questions.length,
        errors:    result.errors.length,
        durationMs: result.durationMs,
        cacheHits: result.cacheHits,
      });

      res.json({
        success:    true,
        videoUrls:  result.videoUrls,
        errors:     result.errors,
        durationMs: result.durationMs,
        cacheHits:  result.cacheHits,
      });
    } catch (err) {
      logger.error("pregen_sync_failed", { userId: req.userId, error: err.message });
      res.status(500).json({ success: false, error: err.message });
    }
  },

  /**
   * POST /api/ai/interview/pregen-baseline — PUBLIC (free trial, không cần đăng nhập)
   * Body JSON: { gender?: "female"|"male" }
   *
   * Pre-gen video cho 3 câu hỏi baseline CỐ ĐỊNH (baselineQuestions.js). Vì text + gender
   * cố định → cache key (avatarService.buildCacheKey) giống nhau cho mọi user — lần gọi
   * đầu tiên (per gender) tốn D-ID credit, mọi lần sau (toàn hệ thống) cache-hit ($0).
   */
  pregenerateBaseline: async (req, res) => {
    if (!isDIDEnabled()) {
      return res.status(503).json({
        success: false,
        error:   "D_ID_API_KEY chưa được cấu hình.",
        hint:    "Đăng ký tại studio.d-id.com → API keys → set D_ID_API_KEY trong .env",
      });
    }

    const { gender = "male" } = req.body ?? {};
    const resolvedGender = gender === "female" ? "female" : "male";
    const questions = getBaselineQuestionTexts();

    logger.info("pregen_baseline_start", { gender: resolvedGender, count: questions.length });

    const ac = new AbortController();
    req.on("close", () => {
      if (!res.headersSent) ac.abort();
    });

    try {
      const result = await pregenerateSync(questions, { gender: resolvedGender, persistVideo: true }, ac.signal);

      logger.info("pregen_baseline_ok", {
        gender:     resolvedGender,
        errors:     result.errors.length,
        durationMs: result.durationMs,
        cacheHits:  result.cacheHits,
      });

      res.json({
        success:    true,
        videoUrls:  result.videoUrls,
        errors:     result.errors,
        durationMs: result.durationMs,
        cacheHits:  result.cacheHits,
      });
    } catch (err) {
      logger.error("pregen_baseline_failed", { gender: resolvedGender, error: err.message });
      res.status(500).json({ success: false, error: err.message });
    }
  },

  /**
   * POST /api/ai/interview/pregen/start
   * Body JSON: { questions: string[], gender?, voiceId? }
   *
   * Bắt đầu pre-gen async (fire and forget). Trả jobId ngay lập tức.
   * Frontend poll GET /pregen/:jobId để theo dõi tiến độ.
   */
  startPregenJob: async (req, res) => {
    if (!isDIDEnabled()) {
      return res.status(503).json({
        success: false,
        error:   "D_ID_API_KEY chưa được cấu hình.",
      });
    }

    const { questions, gender = "male", voiceId } = req.body ?? {};
    if (!Array.isArray(questions) || questions.length === 0) {
      return res.status(400).json({ success: false, error: "Field 'questions' (string[]) là bắt buộc." });
    }
    if (questions.length > 15) {
      return res.status(400).json({ success: false, error: "Tối đa 15 câu hỏi mỗi request." });
    }

    const jobId = startPregenerationJob(questions, { gender, voiceId, userId: req.userId });
    logger.info("pregen_job_started", { userId: req.userId, jobId, count: questions.length });

    res.json({ success: true, jobId, total: questions.length, status: "running" });
  },

  /**
   * GET /api/ai/interview/pregen/:jobId
   * Poll tiến độ job đang chạy.
   * Response: { jobId, status, total, done, progress, videoUrls? }
   */
  getPregenStatus: async (req, res) => {
    const { jobId } = req.params;
    const status = getPregenerationStatus(jobId);

    if (!status) {
      return res.status(404).json({ success: false, error: "Job không tồn tại hoặc đã hết hạn." });
    }

    res.json({ success: true, ...status });
  },

  // ── D-ID WebRTC Streaming Proxy ───────────────────────────────────────────────
  // Giữ D_ID_API_KEY server-side — FE không cần (và không được) biết key này.

  didProxy: async (req, res) => {
    if (!isDIDEnabled()) {
      return res.status(503).json({ success: false, error: "D-ID chưa được cấu hình." });
    }
    const apiKey = process.env.D_ID_API_KEY ?? "";
    const auth = "Basic " + Buffer.from(`${apiKey}:`).toString("base64");

    // req.path is relative to the router mount (/api/ai), e.g. /did/streams/abc123/sdp
    const subpath = req.path.replace(/^\/did\/streams/, "");
    const target = `https://api.d-id.com/talks/streams${subpath}`;

    const headers = { Authorization: auth, "Content-Type": "application/json" };
    const body = req.method !== "GET" && req.body && Object.keys(req.body).length > 0
      ? JSON.stringify(req.body)
      : undefined;
    const fetchOpts = { method: req.method, headers, ...(body !== undefined ? { body } : {}) };

    try {
      const upstream = await fetch(target, fetchOpts);
      const ct = upstream.headers.get("content-type") ?? "";
      const text = await upstream.text();
      res.status(upstream.status);
      if (ct.includes("json")) {
        res.json(JSON.parse(text));
      } else {
        res.set("Content-Type", ct || "application/json").send(text);
      }
    } catch (err) {
      logger.error("did_proxy_error", { err: err.message });
      res.status(502).json({ success: false, error: "Không thể kết nối tới D-ID." });
    }
  },
};
