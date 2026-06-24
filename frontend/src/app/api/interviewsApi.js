import { authFetch, hasAuthCredentials } from "../utils/auth/auth.js";
import { apiUrl } from "./http.js";

const jsonHeaders = {
  Accept: "application/json",
  "Content-Type": "application/json",
};

/**
 * Tạo phiên phỏng vấn AI, attach competencyProfile + questions vào session ngay khi tạo.
 * @param {string} hrGender
 * @param {{ questions?, inferredRole?, inferredSeniority?, competencyProfile?, coverageScore? }} sessionData
 */
export async function createInterviewSession(hrGender = "female", sessionData = {}) {
  if (!hasAuthCredentials()) return { success: false, error: "Chưa đăng nhập." };
  try {
    const res = await authFetch("/api/interviews/sessions", {
      method: "POST",
      headers: { ...jsonHeaders },
      body: JSON.stringify({
        hrGender: hrGender === "male" ? "male" : "female",
        ...sessionData,
      }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok || !body.success) {
      return { success: false, error: body.error || `Lỗi ${res.status}` };
    }
    const id = body.session?._id;
    if (!id) return { success: false, error: "Không nhận được id phiên." };
    return { success: true, sessionId: String(id) };
  } catch {
    return { success: false, error: "Không kết nối được backend." };
  }
}

/**
 * Sinh 5 câu hỏi phỏng vấn cá nhân hóa từ CV + JD qua LLM.
 * @param {{ cvText?, jdText?, position?, field?, level? }} params
 * @returns {{ success, questions, inferredRole, inferredSeniority, competencyProfile, coverageScore }}
 */
export async function generateInterviewQuestions({ cvText = "", jdText = "", position = "", field = "", level = "" } = {}) {
  if (!hasAuthCredentials()) return { success: false, error: "Chưa đăng nhập." };
  try {
    const res = await authFetch("/api/interviews/generate-questions", {
      method: "POST",
      headers: { ...jsonHeaders },
      body: JSON.stringify({ cvText, jdText, position, field, level }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok || !body.success) {
      return { success: false, error: body.error || `Lỗi ${res.status}` };
    }
    return {
      success:           true,
      questions:         body.questions,
      inferredRole:      body.inferredRole,
      inferredSeniority: body.inferredSeniority,
      competencyProfile: body.competencyProfile,
      coverageScore:     body.coverageScore,
    };
  } catch {
    return { success: false, error: "Không kết nối được backend." };
  }
}

/**
 * Sinh 2 câu hỏi cá nhân hóa GIỮA buổi phỏng vấn — dựa trên CV/JD + câu trả lời thật của
 * ứng viên cho 3 câu baseline. Chỉ Pro user gọi tới (free user dừng ở 3 câu baseline).
 * @param {string} sessionId
 * @param {{ cvText?, jdText?, position?, field?, level?, baselineAnswers: {questionIndex:number, transcript:string}[] }} params
 * @returns {{ success, questions, error? }}
 */
export async function generateFollowUpQuestions(sessionId, { cvText = "", jdText = "", position = "", field = "", level = "", baselineAnswers = [] } = {}) {
  if (!hasAuthCredentials() || !sessionId) return { success: false, error: "Thiếu phiên." };
  try {
    const res = await authFetch(`/api/interviews/sessions/${encodeURIComponent(sessionId)}/generate-followup-questions`, {
      method: "POST",
      headers: { ...jsonHeaders },
      body: JSON.stringify({ cvText, jdText, position, field, level, baselineAnswers }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok || !body.success) {
      return { success: false, error: body.error || `Lỗi ${res.status}` };
    }
    return { success: true, questions: body.questions ?? [] };
  } catch {
    return { success: false, error: "Không kết nối được backend." };
  }
}

/**
 * Trích xuất text thuần từ file PDF CV qua Python service.
 * @param {File} file - File object từ input[type=file]
 * @returns {{ success, text, pageCount }}
 */
export async function extractCvTextFromFile(file) {
  if (!hasAuthCredentials()) return { success: false, error: "Chưa đăng nhập." };
  try {
    const formData = new FormData();
    formData.append("file", file);
    const res = await authFetch("/api/interviews/extract-cv-text", {
      method: "POST",
      body: formData,
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok || !body.success) {
      return { success: false, error: body.error || `Lỗi ${res.status}` };
    }
    return { success: true, text: body.text, pageCount: body.pageCount };
  } catch {
    return { success: false, error: "Không kết nối được backend." };
  }
}

/**
 * Lấy 3 câu hỏi "baseline" cố định cho free trial — PUBLIC, không cần đăng nhập.
 * @returns {{ success, questions: object[] }}
 */
export async function getBaselineQuestions() {
  try {
    const res = await fetch(apiUrl("/api/interviews/baseline-questions"));
    const body = await res.json().catch(() => ({}));
    if (!res.ok || !body.success) return { success: false, error: body.error ?? `Lỗi ${res.status}` };
    return { success: true, questions: body.questions ?? [] };
  } catch {
    return { success: false, error: "Không kết nối được backend." };
  }
}

/**
 * Gửi transcripts lên backend để LLM đánh giá theo chuẩn SHRM/DDI.
 * @param {string} sessionId
 * @param {{ questionIndex: number, transcript: string, questionText?: string }[]} answers
 * @param {{ question: string, layer?: string, competencyName?: string }[]} [questions] - fallback khi session không có questions
 * @returns {{ success, evaluation, overallScore, generalComment, inferredRole, totalDurationSeconds, behavioralSummary, behavioralPerQuestion }}
 */
export async function evaluateInterviewSession(sessionId, answers = [], questions = []) {
  if (!hasAuthCredentials() || !sessionId) return { success: false, error: "Thiếu phiên." };
  try {
    const res = await authFetch(`/api/interviews/sessions/${encodeURIComponent(sessionId)}/evaluate`, {
      method: "POST",
      headers: { ...jsonHeaders },
      body: JSON.stringify({ answers, questions }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok || !body.success) {
      return { success: false, error: body.error || `Lỗi ${res.status}` };
    }
    return {
      success:               true,
      evaluation:            body.evaluation,
      overallScore:          body.overallScore,
      generalComment:        body.generalComment,
      inferredRole:          body.inferredRole,
      totalDurationSeconds:  body.totalDurationSeconds,
      behavioralSummary:     body.behavioralSummary     ?? null,
      behavioralPerQuestion: body.behavioralPerQuestion ?? [],
    };
  } catch {
    return { success: false, error: "Không kết nối được backend." };
  }
}

/**
 * Lưu câu trả lời + behavioral data cho 1 câu hỏi. Fire-and-forget từ client.
 * Route: PATCH /api/interviews/sessions/:id
 * @param {string} sessionId
 * @param {{ questionIndex, questionText, transcript, durationSeconds, behavioralData? }} params
 */
export async function saveAnswer(sessionId, { questionIndex, questionText, transcript, durationSeconds, behavioralData }) {
  if (!hasAuthCredentials() || !sessionId) return { success: false };
  try {
    const res = await authFetch(`/api/interviews/sessions/${encodeURIComponent(sessionId)}`, {
      method: "PATCH",
      headers: { ...jsonHeaders },
      body: JSON.stringify({ questionIndex, questionText, transcript, durationSeconds, behavioralData }),
    });
    const body = await res.json().catch(() => ({}));
    return res.ok && body.success ? { success: true } : { success: false };
  } catch {
    return { success: false };
  }
}

/**
 * Đánh dấu hoàn thành + feedback (dashboard-stats đếm status completed).
 */
export async function getInterviewSession(sessionId) {
  if (!hasAuthCredentials() || !sessionId) return { success: false, error: "Thiếu phiên." };
  try {
    const res = await authFetch(`/api/interviews/sessions/${encodeURIComponent(sessionId)}`, {
      method: "GET",
      headers: { Accept: "application/json" },
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok || !body.success) {
      return { success: false, error: body.error || `Lỗi ${res.status}` };
    }
    return { success: true, session: body.session };
  } catch {
    return { success: false, error: "Không kết nối được backend." };
  }
}

/**
 * GET /api/interviews/sessions — Lịch sử phỏng vấn
 * @returns {{success: boolean, list?: any[], error?: string}}
 */
export async function fetchInterviewSessions() {
  if (!hasAuthCredentials()) {
    return { success: false, error: "Chưa đăng nhập." };
  }
  try {
    const res = await authFetch("/api/interviews/sessions", {
      method: "GET",
      headers: { Accept: "application/json" },
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok || !body.success) {
      return { success: false, error: body.error || `Lỗi ${res.status}` };
    }
    return { success: true, list: body.list || [] };
  } catch {
    return { success: false, error: "Không kết nối được backend." };
  }
}

/**
 * Đánh dấu hoàn thành phiên + gửi kèm backup answers và behavioral summary.
 * @param {string} sessionId
 * @param {{ answers?, totalDurationSeconds?, behavioralSummary? }} [payload]
 */
export async function completeInterviewSession(sessionId, payload = {}) {
  if (!hasAuthCredentials() || !sessionId) return { success: false, error: "Thiếu phiên." };
  try {
    const res = await authFetch(`/api/interviews/sessions/${encodeURIComponent(sessionId)}/complete`, {
      method: "POST",
      headers: { ...jsonHeaders },
      body: JSON.stringify(payload),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok || !body.success) {
      return { success: false, error: body.error || `Lỗi ${res.status}` };
    }
    return { success: true };
  } catch {
    return { success: false, error: "Không kết nối được backend." };
  }
}

/**
 * Gửi 1 frame ảnh (base64 JPEG) lên backend để phân tích cảm xúc qua Google Vision API.
 * Fire-and-forget an toàn — không bao giờ throw, trả { success: false } nếu lỗi.
 * @param {string} sessionId
 * @param {string} imageBase64 — base64 JPEG không có prefix data:
 * @param {number} questionIndex
 */
export async function analyzeFaceSnapshot(sessionId, imageBase64, questionIndex) {
  if (!hasAuthCredentials() || !sessionId || !imageBase64) return { success: false };
  try {
    const res = await authFetch(`/api/interviews/sessions/${encodeURIComponent(sessionId)}/analyze-face`, {
      method: "POST",
      headers: { ...jsonHeaders },
      body: JSON.stringify({ imageBase64, questionIndex }),
    });
    const body = await res.json().catch(() => ({}));
    return res.ok ? body : { success: false };
  } catch {
    return { success: false };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// AI Provider Stack — /api/ai/* (STT / TTS / Emotion / Avatar)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Lấy trạng thái các AI providers đang active.
 * Dùng để quyết định hiển thị tính năng nào trên UI.
 * @returns {{ success, providers: { llm, stt, tts, emotion, avatar } }}
 */
export async function getAIProviderConfig() {
  try {
    const res = await fetch("/api/ai/config");
    const body = await res.json().catch(() => ({}));
    return res.ok ? body : { success: false, providers: {} };
  } catch {
    return { success: false, providers: {} };
  }
}

/**
 * Transcribe audio blob → text qua AssemblyAI (nếu enabled).
 * Nếu STT_PROVIDER=browser hoặc key chưa set → trả { success: true, provider: "browser", text: null }.
 * @param {Blob} audioBlob — audio/webm, audio/mp3, ...
 * @param {object} [opts]
 * @param {string} [opts.lang="vi"]
 * @param {boolean} [opts.speakerLabels=false]
 * @returns {{ success, provider, text, words?, utterances?, confidence? }}
 */
export async function transcribeAudio(audioBlob, opts = {}) {
  if (!hasAuthCredentials()) return { success: false, error: "Chưa đăng nhập." };
  try {
    const formData = new FormData();
    formData.append("audio", audioBlob, "recording.webm");

    const params = new URLSearchParams({
      lang:           opts.lang           ?? "vi",
      speaker_labels: opts.speakerLabels  ? "true" : "false",
      sentiment:      opts.sentiment      ? "true" : "false",
    });

    const res = await authFetch(`/api/ai/transcribe?${params}`, {
      method: "POST",
      body:   formData,
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) return { success: false, error: body.error ?? `Lỗi ${res.status}` };
    return { success: true, ...body };
  } catch {
    return { success: false, error: "Không kết nối được backend." };
  }
}

/**
 * Synthesize text → audio mp3 qua ElevenLabs (nếu enabled).
 * Trả ArrayBuffer để frontend tạo blob URL hoặc play trực tiếp.
 * @param {string} text
 * @param {object} [opts] - voiceId, modelId, stability, similarityBoost
 * @returns {{ success, audioBuffer: ArrayBuffer, contentType: string }|{ success: false, error }}
 */
export async function synthesizeSpeech(text, opts = {}) {
  if (!hasAuthCredentials()) return { success: false, error: "Chưa đăng nhập." };
  try {
    const res = await authFetch("/api/ai/tts", {
      method:  "POST",
      headers: { ...jsonHeaders },
      body:    JSON.stringify({ text, ...opts }),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      return { success: false, error: body.error ?? `Lỗi ${res.status}` };
    }

    const audioBuffer = await res.arrayBuffer();
    const contentType = res.headers.get("content-type") || "audio/mpeg";
    return { success: true, audioBuffer, contentType };
  } catch {
    return { success: false, error: "Không kết nối được backend." };
  }
}

/**
 * Tạo blob URL từ ArrayBuffer audio để play hoặc gửi cho D-ID.
 * @param {ArrayBuffer} audioBuffer
 * @param {string} [contentType="audio/mpeg"]
 * @returns {string} objectURL — nhớ URL.revokeObjectURL(url) khi xong
 */
export function createAudioBlobUrl(audioBuffer, contentType = "audio/mpeg") {
  const blob = new Blob([audioBuffer], { type: contentType });
  return URL.createObjectURL(blob);
}

/**
 * Analyze emotion từ audio blob qua Hume AI (nếu enabled).
 * @param {Blob} audioBlob
 * @param {"audio"|"face"} [type="audio"]
 * @returns {{ success, emotion: { top5, confidence, stress_level, engagement, authenticity }|null }}
 */
export async function analyzeEmotion(audioBlob, type = "audio") {
  if (!hasAuthCredentials()) return { success: false, error: "Chưa đăng nhập." };
  try {
    const formData = new FormData();
    formData.append("audio", audioBlob, type === "face" ? "face.jpg" : "audio.webm");

    const res = await authFetch(`/api/ai/emotion?type=${type}`, {
      method: "POST",
      body:   formData,
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) return { success: false, error: body.error ?? `Lỗi ${res.status}` };
    return { success: true, ...body };
  } catch {
    return { success: false, error: "Không kết nối được backend." };
  }
}

// ── D-ID Avatar — Pre-generation ─────────────────────────────────────────────

/**
 * Pre-generate tất cả video phỏng vấn trước khi bắt đầu (sync — đợi ~60-90s).
 * Render song song tất cả câu hỏi → D-ID Express API → trả mảng video URLs.
 *
 * @param {string[]} questions - Danh sách câu hỏi text
 * @param {object} [opts]
 * @param {"female"|"male"} [opts.gender="female"]
 * @param {string} [opts.voiceId] - ElevenLabs voice ID override
 * @returns {{ success, videoUrls: string[], errors, durationMs, cacheHits }}
 */
export async function pregenerateInterviewVideos(questions, opts = {}) {
  if (!hasAuthCredentials()) return { success: false, error: "Chưa đăng nhập." };
  try {
    const res = await authFetch("/api/ai/interview/pregenerate", {
      method:  "POST",
      headers: { ...jsonHeaders },
      body:    JSON.stringify({ questions, ...opts }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok || !body.success) return { success: false, error: body.error ?? `Lỗi ${res.status}` };
    return {
      success:    true,
      videoUrls:  body.videoUrls  ?? [],
      errors:     body.errors     ?? [],
      durationMs: body.durationMs ?? 0,
      cacheHits:  body.cacheHits  ?? 0,
    };
  } catch {
    return { success: false, error: "Không kết nối được backend." };
  }
}

/**
 * Pre-generate video cho 3 câu hỏi baseline (free trial) — PUBLIC, không cần đăng nhập.
 * Text câu hỏi cố định → cache key giống nhau cho mọi user/gender → cache-hit sau lần đầu.
 * @param {"male"|"female"} [gender="male"]
 * @returns {{ success, videoUrls: string[], errors, durationMs, cacheHits }}
 */
export async function pregenerateBaselineVideos(gender = "male") {
  try {
    const res = await fetch(apiUrl("/api/ai/interview/pregen-baseline"), {
      method:  "POST",
      headers: { ...jsonHeaders },
      body:    JSON.stringify({ gender }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok || !body.success) return { success: false, error: body.error ?? `Lỗi ${res.status}` };
    return {
      success:    true,
      videoUrls:  body.videoUrls  ?? [],
      errors:     body.errors     ?? [],
      durationMs: body.durationMs ?? 0,
      cacheHits:  body.cacheHits  ?? 0,
    };
  } catch {
    return { success: false, error: "Không kết nối được backend." };
  }
}

/**
 * Bắt đầu pre-generation job async — trả jobId ngay, dùng pollPregenJob() để theo dõi.
 * @param {string[]} questions
 * @param {object} [opts] - { gender, voiceId }
 * @returns {{ success, jobId, total, status }}
 */
export async function startPregenJob(questions, opts = {}) {
  if (!hasAuthCredentials()) return { success: false, error: "Chưa đăng nhập." };
  try {
    const res = await authFetch("/api/ai/interview/pregen/start", {
      method:  "POST",
      headers: { ...jsonHeaders },
      body:    JSON.stringify({ questions, ...opts }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok || !body.success) return { success: false, error: body.error ?? `Lỗi ${res.status}` };
    return { success: true, jobId: body.jobId, total: body.total, status: body.status };
  } catch {
    return { success: false, error: "Không kết nối được backend." };
  }
}

/**
 * Poll trạng thái pre-generation job.
 * @param {string} jobId
 * @returns {{ success, jobId, status, total, done, progress, videoUrls?, errors }}
 *   status: "running" | "done" | "error"
 */
export async function pollPregenJob(jobId) {
  if (!hasAuthCredentials() || !jobId) return { success: false, error: "Thiếu jobId." };
  try {
    const res = await authFetch(`/api/ai/interview/pregen/${encodeURIComponent(jobId)}`);
    const body = await res.json().catch(() => ({}));
    if (!res.ok) return { success: false, error: body.error ?? `Lỗi ${res.status}` };
    return { success: true, ...body };
  } catch {
    return { success: false, error: "Không kết nối được backend." };
  }
}

/**
 * Helper: đợi cho đến khi pre-gen job hoàn thành (polling every pollIntervalMs).
 * @param {string} jobId
 * @param {object} [opts]
 * @param {number} [opts.pollIntervalMs=3000]
 * @param {number} [opts.timeoutMs=120000]
 * @param {Function} [opts.onProgress] - callback(done, total, progress%)
 * @returns {{ success, videoUrls, errors }} khi xong hoặc timeout
 */
export async function waitForPregenJob(jobId, opts = {}) {
  const { pollIntervalMs = 3000, timeoutMs = 120_000, onProgress } = opts;
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    await new Promise(r => setTimeout(r, pollIntervalMs));
    const status = await pollPregenJob(jobId);

    if (!status.success) return { success: false, error: status.error };
    onProgress?.(status.done, status.total, status.progress);

    if (status.status === "done") {
      return { success: true, videoUrls: status.videoUrls ?? [], errors: status.errors ?? [] };
    }
    if (status.status === "error") {
      return { success: false, error: "Pre-generation thất bại", errors: status.errors ?? [] };
    }
  }

  return { success: false, error: "Pre-generation timed out" };
}

/**
 * Lấy danh sách D-ID stock presenters (avatars sẵn có).
 */
export async function listDIDPresenters() {
  if (!hasAuthCredentials()) return { success: false, presenters: [] };
  try {
    const res = await authFetch("/api/ai/avatar/presenters");
    const body = await res.json().catch(() => ({}));
    return res.ok ? { success: true, presenters: body.presenters ?? [] } : { success: false, presenters: [] };
  } catch {
    return { success: false, presenters: [] };
  }
}
