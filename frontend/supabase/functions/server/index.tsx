import { Hono } from "npm:hono";
import { cors } from "npm:hono/cors";
import { logger } from "npm:hono/logger";
import { createClient } from "npm:@supabase/supabase-js@2";
import { GoogleGenerativeAI } from "npm:@google/generative-ai";
import * as kv from "./kv_store.tsx";
import { MENTOR_SEED_DATA } from "./mentor_data.tsx";

const app = new Hono();

app.use("*", logger(console.log));

app.use(
  "/*",
  cors({
    origin: "*",
    allowHeaders: ["Content-Type", "Authorization", "X-Session-Id"],
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    exposeHeaders: ["Content-Length"],
    maxAge: 600,
  }),
);

// ── Constants ──────────────────────────────────────────────────────────────
const BUCKET = "make-64a0c849-cv-uploads";

// ── Supabase admin client helper ───────────────────────────────────────────
function makeSupabase() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
}

// ── Helper: resolve caller userId ───────────────────────────────────────────
// Returns the Supabase user id for a real JWT, or a deterministic guest id.
async function getUserId(c: any): Promise<string> {
  const authHeader = c.req.header("Authorization");
  const sessionId  = c.req.header("X-Session-Id"); // frontend guest session
  const anonKey    = Deno.env.get("SUPABASE_ANON_KEY") ?? "";

  if (authHeader) {
    const token = authHeader.split(" ")[1] ?? "";
    // If caller sent the anon key there is no real user
    if (token && token !== anonKey) {
      try {
        const { data: { user } } = await makeSupabase().auth.getUser(token);
        if (user?.id) return user.id;
      } catch { /* ignore */ }
    }
  }
  // Fall back to client-generated session id so guests get their own namespace
  return sessionId ? `guest-${sessionId}` : "guest";
}

// ── Helper: upload one file to storage, return path + signed URL ─────────
async function uploadToStorage(
  buffer: ArrayBuffer,
  filename: string,
  mimeType: string,
  storagePath: string,
): Promise<{ path: string; signedUrl: string | null }> {
  const supabase = makeSupabase();
  
  // Ensure bucket exists (idempotent)
  const { data: buckets } = await supabase.storage.listBuckets();
  const exists = buckets?.some((b) => b.name === BUCKET);
  if (!exists) {
    await supabase.storage.createBucket(BUCKET);
    console.log("Created storage bucket:", BUCKET);
  }
  
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(storagePath, buffer, { contentType: mimeType || "application/octet-stream", upsert: true });

  if (error) {
    console.log(`Storage upload error for ${storagePath}:`, error.message);
    throw new Error(`Lỗi lưu file "${filename}": ${error.message}`);
  }

  const { data } = await supabase.storage.from(BUCKET).createSignedUrl(storagePath, 86400); // 24 h
  return { path: storagePath, signedUrl: data?.signedUrl ?? null };
}

// ── Helper: download a stored file ──────────────────────────────────────────
async function downloadFromStorage(storagePath: string): Promise<ArrayBuffer | null> {
  const { data, error } = await makeSupabase().storage.from(BUCKET).download(storagePath);
  if (error || !data) {
    console.log("Storage download error:", error?.message);
    return null;
  }
  return await data.arrayBuffer();
}

// ── Gemini helpers ──────────────────────────────────────────────────────────

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  const chunk = 8192;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.slice(i, i + chunk));
  }
  return btoa(binary);
}

/** Build a single Gemini content part from an already-buffered file. */
async function buildGeminiPart(buffer: ArrayBuffer, filename: string): Promise<any> {
  const name = filename.toLowerCase();

  if (name.endsWith(".pdf")) {
    // SDK expects camelCase: inlineData / mimeType
    return { inlineData: { mimeType: "application/pdf", data: arrayBufferToBase64(buffer) } };
  }

  if (name.endsWith(".docx") || name.endsWith(".doc")) {
    try {
      const { default: mammoth } = await import("npm:mammoth");
      const result = await mammoth.extractRawText({ arrayBuffer: buffer });
      if (result.value?.trim().length > 20) return { text: result.value };
    } catch (e) {
      console.log("mammoth error:", e);
    }
  }

  return { text: new TextDecoder("utf-8", { fatal: false }).decode(buffer) };
}

const GEMINI_SYSTEM = `You are an expert HR analyst and CV coach specialising in the Vietnamese job market.
Analyse CVs and job descriptions with precision.
IMPORTANT: All text fields (strengths, weaknesses, suggestions.title, suggestions.reason, scoreNotes, summary) MUST be in Vietnamese.
Technical keywords (matchedKeywords, missingKeywords) stay in their original language.
Return ONLY a valid JSON object – no markdown, no extra text.`;

const JSON_SCHEMA = `{
  "matchScore": <integer 0-100>,
  "totalKeywords": <integer>,
  "matchedKeywords": ["<keyword>"],
  "missingKeywords": ["<keyword>"],
  "scores": { "clarity": <0-10>, "structure": <0-10>, "relevance": <0-10>, "credibility": <0-10> },
  "scoreNotes": { "clarity": "<vi>", "structure": "<vi>", "relevance": "<vi>", "credibility": "<vi>" },
  "position": "<string or null>",
  "company": "<string or null>",
  "strengths": ["<vi>"],
  "weaknesses": ["<vi>"],
  "suggestions": [{ "type": "add|fix|remove", "priority": "high|medium|low", "title": "<vi>", "reason": "<vi>", "before": "<string>", "after": "<string>" }],
  "summary": "<vi>"
}`;

async function callGemini(parts: any[], geminiKey: string): Promise<any> {
  // Models ordered by free-tier RPD quota on the new API key.
  // gemini-3.1-flash-lite: 500 RPD (best) → gemini-2.5-flash-lite: 20 RPD
  // → gemini-2.5-flash: 20 RPD → gemini-3-flash: 20 RPD
  // Old 2.0/1.5 models are deprecated in this project (0/0 limits).
  const MODELS = [
    "gemini-3.1-flash-lite",       // 500 RPD — primary
    "gemini-2.5-flash-lite",       // 20 RPD
    "gemini-2.5-flash",            // 20 RPD
    "gemini-3-flash",              // 20 RPD
    "gemini-2.5-flash-preview-04-17", // preview alias fallback
  ];

  const tried: string[] = [];
  let billingError = false;

  for (const modelName of MODELS) {
    try {
      console.log(`Trying Gemini model: ${modelName}`);
      const genAI = new GoogleGenerativeAI(geminiKey);
      const model = genAI.getGenerativeModel({
        model: modelName,
        systemInstruction: GEMINI_SYSTEM,
      });

      const result = await model.generateContent({
        contents: [{ role: "user", parts }],
        generationConfig: {
          responseMimeType: "application/json",
          temperature: 0.2,
          maxOutputTokens: 3000,
        } as any,
      });

      const text = result.response.text();
      console.log(`Gemini [${modelName}] OK — response length: ${text.length}`);

      try { return JSON.parse(text); } catch {
        const m = text.match(/\{[\s\S]*\}/);
        if (m) return JSON.parse(m[0]);
        throw new Error("Không thể parse JSON từ Gemini");
      }
    } catch (err: any) {
      const msg = String(err?.message ?? err);
      tried.push(modelName);

      if (msg.includes("429")) {
        billingError = true;
        console.log(`Model ${modelName} — quota exceeded (429), skipping immediately.`);
        continue;
      }
      if (msg.includes("404")) {
        console.log(`Model ${modelName} — not found (404), skipping.`);
        continue;
      }

      // Unexpected error — surface it directly
      throw err;
    }
  }

  // All models exhausted — return mock data so the app stays usable
  console.log(`All Gemini models failed (tried: ${tried.join(", ")}). Returning mock analysis.`);
  return MOCK_ANALYSIS;
}

// ── Mock analysis (returned when all Gemini models are quota-limited) ───────
const MOCK_ANALYSIS = {
  _isMocked: true,
  matchScore: 72,
  totalKeywords: 10,
  matchedKeywords: ["React", "TypeScript", "Node.js", "REST API", "Agile", "Git"],
  missingKeywords: ["Docker", "AWS", "CI/CD", "PostgreSQL"],
  scores: { clarity: 7, structure: 6, relevance: 8, credibility: 5 },
  scoreNotes: {
    clarity: "CV có cấu trúc khá rõ ràng, các mục được trình bày logic.",
    structure: "Phần kinh nghiệm chưa theo format STAR đầy đủ, thiếu Result cụ thể.",
    relevance: "6/10 từ khóa kỹ thuật trong JD đã có mặt trong CV.",
    credibility: "Thiếu số liệu cụ thể (%, KPI) để minh chứng thành tích.",
  },
  position: "Frontend Developer",
  company: "Demo Company",
  strengths: [
    "React & TypeScript — khớp hoàn toàn với yêu cầu JD",
    "Node.js + REST API có trong CV, phù hợp với backend nhẹ",
    "Agile/Scrum đã được đề cập trong kinh nghiệm làm việc",
    "Dự án thực tế liên quan đến lĩnh vực tuyển dụng",
  ],
  weaknesses: [
    "Thiếu Docker & AWS — 2 từ khóa bắt buộc trong JD",
    "Không đề cập CI/CD dù đây là yêu cầu quan trọng",
    "Mô tả kinh nghiệm thiếu số liệu KPI cụ thể",
    "Chưa có PostgreSQL dù JD yêu cầu database này",
  ],
  suggestions: [
    { type: "add",    priority: "high",   title: "Thêm Docker & AWS vào phần Kỹ năng",    reason: "JD liệt kê Docker và AWS là yêu cầu bắt buộc, được nhắc đến 3 lần.",          before: "Tools: Git, Webpack, Vite, VS Code",              after: "Tools: Git, Webpack, Vite, Docker, AWS (EC2, S3, CloudFront)" },
    { type: "add",    priority: "high",   title: "Đề cập CI/CD trong Kinh nghiệm",         reason: "JD yêu cầu 'Xây dựng CI/CD pipeline'. Hãy nhắc đến tool CI/CD bạn đã dùng.",  before: "• Quản lý source code qua Git, review code hàng ngày", after: "• Quản lý Git, thiết lập CI/CD pipeline với GitHub Actions" },
    { type: "add",    priority: "medium", title: "Thêm PostgreSQL vào Database",            reason: "JD đề cập PostgreSQL là database chính. CV chỉ có MySQL và MongoDB.",          before: "Database: MySQL, MongoDB",                           after: "Database: MySQL, MongoDB, PostgreSQL" },
    { type: "fix",    priority: "high",   title: "Thêm số liệu cụ thể vào thành tích",     reason: "Mô tả 'tối ưu hiệu năng' không thuyết phục. Nhà tuyển dụng cần con số.",      before: "• Tối ưu hiệu năng ứng dụng React",                   after: "• Tối ưu React, giảm 40% load time, Lighthouse 65 → 92" },
    { type: "fix",    priority: "medium", title: "Viết lại Kinh nghiệm theo format STAR",  reason: "Phần Kinh nghiệm chỉ mô tả Task, thiếu Situation, Action, Result.",           before: "• Xây dựng REST API với Node.js",                      after: "• Thiết kế 12 REST API endpoints, 50k req/ngày, uptime 99.9%" },
    { type: "remove", priority: "low",    title: "Loại bỏ kỹ năng không liên quan JD",    reason: "Photoshop/Illustrator không liên quan vai trò Frontend Developer.",            before: "Others: Photoshop, Illustrator, Figma",               after: "Others: Figma, Storybook, Jest/Vitest" },
  ],
  summary: "CV có nền tảng kỹ thuật tốt nhưng cần bổ sung Docker, AWS, CI/CD và thêm số liệu KPI để tăng tỉ lệ vượt qua ATS.",
};

// ══════════════════════════════════════════════════════════════════════════════
// Routes
// ══════════════════════════════════════════════════════════════════════════════

// ── Health ─────────────────────────────────────────────────────────────────
app.get("/make-server-64a0c849/health", (c) => c.json({ status: "ok" }));

// ── Auth: Sign Up ──────────────────────────────────────────────────────────
app.post("/make-server-64a0c849/auth/signup", async (c) => {
  try {
    const { name, email, password, role = "customer" } = await c.req.json();

    if (!name || !email || !password)
      return c.json({ error: "Thiếu thông tin bắt buộc (name, email, password)" }, 400);
    if (password.length < 8)
      return c.json({ error: "Mật khẩu phải có ít nhất 8 ký tự" }, 400);

    const { data, error } = await makeSupabase().auth.admin.createUser({
      email, password,
      user_metadata: { name, role },
      email_confirm: true,
    });

    if (error) {
      console.log("Signup error:", error.message);
      const msg = error.message.toLowerCase();
      if (msg.includes("already registered") || msg.includes("user already exists"))
        return c.json({ error: "Email này đã được đăng ký. Vui lòng đăng nhập." }, 409);
      return c.json({ error: `Đăng ký thất bại: ${error.message}` }, 400);
    }

    return c.json({ success: true, userId: data.user.id }, 201);
  } catch (err) {
    console.log("Signup unexpected error:", err);
    return c.json({ error: `Lỗi server khi đăng ký: ${err}` }, 500);
  }
});

// ── Auth: Me ───────────────────────────────────────────────────────────────
app.get("/make-server-64a0c849/auth/me", async (c) => {
  try {
    const token = c.req.header("Authorization")?.split(" ")[1];
    if (!token) return c.json({ error: "Unauthorized" }, 401);

    const { data: { user }, error } = await makeSupabase().auth.getUser(token);
    if (error || !user) return c.json({ error: "Invalid or expired token" }, 401);

    return c.json({
      id: user.id,
      email: user.email,
      name: user.user_metadata?.name ?? user.email?.split("@")[0],
      role: user.user_metadata?.role ?? "customer",
      ...user.user_metadata,
    });
  } catch (err) {
    return c.json({ error: `Server error: ${err}` }, 500);
  }
});

// ── CV: Upload files only (no analysis) ───────────────────────────────────
// POST /cv/upload  — stores CV + optional JD in Supabase Storage
app.post("/make-server-64a0c849/cv/upload", async (c) => {
  try {
    const userId   = await getUserId(c);
    const formData = await c.req.formData();
    const cvFile   = formData.get("cv") as File | null;
    const jdFile   = formData.get("jd") as File | null;

    if (!cvFile && !jdFile)
      return c.json({ error: "Cần ít nhất một file (cv hoặc jd)" }, 400);

    const uploadId = crypto.randomUUID();
    const result: Record<string, any> = { uploadId };

    if (cvFile) {
      const buf  = await cvFile.arrayBuffer();
      const path = `${userId}/${uploadId}/cv_${cvFile.name}`;
      const { path: savedPath, signedUrl } = await uploadToStorage(buf, cvFile.name, cvFile.type, path);
      result.cvPath       = savedPath;
      result.cvSignedUrl  = signedUrl;
      result.cvFileName   = cvFile.name;
      result.cvFileSize   = cvFile.size;
    }

    if (jdFile) {
      const buf  = await jdFile.arrayBuffer();
      const path = `${userId}/${uploadId}/jd_${jdFile.name}`;
      const { path: savedPath, signedUrl } = await uploadToStorage(buf, jdFile.name, jdFile.type, path);
      result.jdPath       = savedPath;
      result.jdSignedUrl  = signedUrl;
      result.jdFileName   = jdFile.name;
      result.jdFileSize   = jdFile.size;
    }

    console.log(`Upload done: uploadId=${uploadId}, userId=${userId}`);
    return c.json({ success: true, ...result });
  } catch (err) {
    console.log("Upload error:", err);
    return c.json({ error: `Lỗi upload: ${err}` }, 500);
  }
});

// ── CV: Analyse ───────────────────────────────────────────────────────────
// POST /cv-analysis
//   Accepts: multipart with `cv` (File) and optional `jd` (File)
//   OR re-analysis: `cvPath` + `jdPath` string fields (stored paths)
app.post("/make-server-64a0c849/cv-analysis", async (c) => {
  try {
    const geminiKey = Deno.env.get("GEMINI_API_KEY");
    if (!geminiKey) return c.json({ error: "GEMINI_API_KEY chưa được cấu hình" }, 500);

    const userId   = await getUserId(c);
    const formData = await c.req.formData();
    const mode     = (formData.get("mode")  as string) || "jd";
    const field    = (formData.get("field") as string) || "IT / Công nghệ";

    // Accept either a freshly uploaded File or a previously stored path
    const cvFile  = formData.get("cv")  as File   | null;
    const jdFile  = formData.get("jd")  as File   | null;
    const cvPath  = formData.get("cvPath") as string | null;
    const jdPath  = formData.get("jdPath") as string | null;

    if (!cvFile && !cvPath)
      return c.json({ error: "File CV là bắt buộc (cv hoặc cvPath)" }, 400);

    const analysisId = crypto.randomUUID();
    console.log(`Analysis start: id=${analysisId}, mode=${mode}, user=${userId}`);

    // ── Buffer file data ──────────────────────────────────────────────────
    let cvBuffer:   ArrayBuffer | null = null;
    let jdBuffer:   ArrayBuffer | null = null;
    let cvFileName  = "cv.pdf";
    let jdFileName: string | null = null;
    let cvFileSize  = 0;
    let jdFileSize  = 0;

    if (cvFile) {
      cvBuffer   = await cvFile.arrayBuffer();
      cvFileName = cvFile.name;
      cvFileSize = cvFile.size;
    } else if (cvPath) {
      cvBuffer   = await downloadFromStorage(cvPath);
      cvFileName = cvPath.split("/").pop() ?? "cv.pdf";
      if (!cvBuffer) return c.json({ error: "Không thể đọc file CV từ storage" }, 500);
    }

    if (jdFile) {
      jdBuffer   = await jdFile.arrayBuffer();
      jdFileName = jdFile.name;
      jdFileSize = jdFile.size;
    } else if (jdPath && mode === "jd") {
      jdBuffer   = await downloadFromStorage(jdPath);
      jdFileName = jdPath.split("/").pop() ?? "jd.pdf";
    }

    // ── Upload new files to storage (skip if using stored path) ──────────
    let cvStoragePath: string | null = cvPath ?? null;
    let jdStoragePath: string | null = jdPath ?? null;
    let cvSignedUrl:   string | null = null;
    let jdSignedUrl:   string | null = null;

    if (cvFile && cvBuffer) {
      const p = `${userId}/${analysisId}/cv_${cvFileName}`;
      try {
        const r = await uploadToStorage(cvBuffer, cvFileName, cvFile.type, p);
        cvStoragePath = r.path;
        cvSignedUrl   = r.signedUrl;
      } catch (e) { console.log("CV storage upload warning:", e); }
    } else if (cvStoragePath) {
      // Refresh signed URL for existing path
      const { data } = await makeSupabase().storage.from(BUCKET).createSignedUrl(cvStoragePath, 86400);
      cvSignedUrl = data?.signedUrl ?? null;
    }

    if (jdFile && jdBuffer) {
      const p = `${userId}/${analysisId}/jd_${jdFileName}`;
      try {
        const r = await uploadToStorage(jdBuffer, jdFileName!, jdFile.type, p);
        jdStoragePath = r.path;
        jdSignedUrl   = r.signedUrl;
      } catch (e) { console.log("JD storage upload warning:", e); }
    } else if (jdStoragePath) {
      const { data } = await makeSupabase().storage.from(BUCKET).createSignedUrl(jdStoragePath, 86400);
      jdSignedUrl = data?.signedUrl ?? null;
    }

    // ── Build Gemini parts ────────────────────────────────────────────────
    const parts: any[] = [];
    parts.push({ text: "Đây là file CV/Resume cần phân tích:" });
    parts.push(await buildGeminiPart(cvBuffer!, cvFileName));

    if (mode === "jd" && jdBuffer) {
      parts.push({ text: "\nĐây là file Job Description (JD):" });
      parts.push(await buildGeminiPart(jdBuffer, jdFileName!));
    }

    const instruction = mode === "jd" && jdBuffer
      ? `Phân tích mức độ phù hợp giữa CV và JD.\nmatchScore = % phù hợp tổng thể.\nmatchedKeywords: từ khóa có trong cả CV lẫn JD.\nmissingKeywords: từ khóa quan trọng trong JD NHƯNG thiếu trong CV.\nCung cấp ít nhất 5 suggestions cụ thể.\nTrả về JSON:\n${JSON_SCHEMA}`
      : `Phân tích chất lượng CV cho ngành "${field}".\nmatchScore = điểm chất lượng CV (0-100).\nmatchedKeywords: kỹ năng quan trọng cho ngành "${field}" đã có.\nmissingKeywords: kỹ năng quan trọng cho ngành "${field}" còn thiếu.\nposition: lấy từ CV. company: null.\nCung cấp ít nhất 5 suggestions cụ thể.\nTrả về JSON:\n${JSON_SCHEMA}`;

    parts.push({ text: instruction });

    // ── Call Gemini ───────────────────────────────────────────────────────
    const analysis = await callGemini(parts, geminiKey);
    console.log(`Analysis done: id=${analysisId}, score=${analysis.matchScore}, suggestions=${analysis.suggestions?.length}`);

    // ── Persist record to KV store ───────────────────────────────────────
    const record = {
      analysisId,
      userId,
      mode,
      field,
      cvFileName,
      cvFileSize,
      jdFileName,
      jdFileSize,
      cvStoragePath,
      jdStoragePath,
      analysis,
      createdAt: new Date().toISOString(),
    };
    await kv.set(`cv-analysis:${userId}:${analysisId}`, record);

    return c.json({ success: true, analysisId, analysis, cvSignedUrl, jdSignedUrl });
  } catch (err) {
    console.log("CV analysis error:", err);
    return c.json({ error: `Lỗi phân tích CV: ${err}` }, 500);
  }
});

// ── CV: List analyses ──────────────────────────────────────────────────────
// GET /cv/analyses  — returns lightweight list (no full analysis object)
app.get("/make-server-64a0c849/cv/analyses", async (c) => {
  try {
    const userId  = await getUserId(c);
    const records = await kv.getByPrefix(`cv-analysis:${userId}:`);

    const list = (records as any[])
      .filter((r) => r?.analysisId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .map((r) => ({
        analysisId:  r.analysisId,
        mode:        r.mode,
        field:       r.field,
        cvFileName:  r.cvFileName,
        cvFileSize:  r.cvFileSize,
        jdFileName:  r.jdFileName,
        jdFileSize:  r.jdFileSize,
        matchScore:  r.analysis?.matchScore,
        position:    r.analysis?.position ?? null,
        company:     r.analysis?.company  ?? null,
        createdAt:   r.createdAt,
        hasCvFile:   !!r.cvStoragePath,
        hasJdFile:   !!r.jdStoragePath,
        cvStoragePath: r.cvStoragePath,
        jdStoragePath: r.jdStoragePath,
      }));

    return c.json({ success: true, analyses: list });
  } catch (err) {
    console.log("List analyses error:", err);
    return c.json({ error: `Lỗi lấy danh sách: ${err}` }, 500);
  }
});

// ── CV: Get single analysis ────────────────────────────────────────────────
// GET /cv/analyses/:id  — returns full record + fresh 1-hour signed URLs
app.get("/make-server-64a0c849/cv/analyses/:id", async (c) => {
  try {
    const analysisId = c.req.param("id");
    const userId     = await getUserId(c);
    const record     = await kv.get(`cv-analysis:${userId}:${analysisId}`);

    if (!record) return c.json({ error: "Không tìm thấy phân tích này" }, 404);

    const supabase = makeSupabase();
    let cvSignedUrl: string | null = null;
    let jdSignedUrl: string | null = null;

    if (record.cvStoragePath) {
      const { data } = await supabase.storage.from(BUCKET).createSignedUrl(record.cvStoragePath, 3600);
      cvSignedUrl = data?.signedUrl ?? null;
    }
    if (record.jdStoragePath) {
      const { data } = await supabase.storage.from(BUCKET).createSignedUrl(record.jdStoragePath, 3600);
      jdSignedUrl = data?.signedUrl ?? null;
    }

    return c.json({ success: true, record, cvSignedUrl, jdSignedUrl });
  } catch (err) {
    console.log("Get analysis error:", err);
    return c.json({ error: `Lỗi lấy phân tích: ${err}` }, 500);
  }
});

// ── CV: Delete analysis + storage files ───────────────────────────────────
// DELETE /cv/analyses/:id
app.delete("/make-server-64a0c849/cv/analyses/:id", async (c) => {
  try {
    const analysisId = c.req.param("id");
    const userId     = await getUserId(c);
    const kvKey      = `cv-analysis:${userId}:${analysisId}`;
    const record     = await kv.get(kvKey);

    if (!record) return c.json({ error: "Không tìm thấy" }, 404);

    // Delete files from storage
    const toDelete = [record.cvStoragePath, record.jdStoragePath].filter(Boolean) as string[];
    if (toDelete.length > 0) {
      const { error } = await makeSupabase().storage.from(BUCKET).remove(toDelete);
      if (error) console.log("Storage delete warning:", error.message);
    }

    await kv.del(kvKey);
    console.log(`Deleted analysis ${analysisId} for user ${userId}`);
    return c.json({ success: true });
  } catch (err) {
    console.log("Delete analysis error:", err);
    return c.json({ error: `Lỗi xóa: ${err}` }, 500);
  }
});

// ── CV: Refresh signed URL ─────────────────────────────────────────────────
// GET /cv/signed-url?path=...
app.get("/make-server-64a0c849/cv/signed-url", async (c) => {
  try {
    const path = c.req.query("path");
    if (!path) return c.json({ error: "path là bắt buộc" }, 400);

    const { data, error } = await makeSupabase().storage.from(BUCKET).createSignedUrl(path, 3600);
    if (error) return c.json({ error: error.message }, 500);

    return c.json({ success: true, signedUrl: data.signedUrl });
  } catch (err) {
    return c.json({ error: `${err}` }, 500);
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// Seed mentors on cold start
// ══════════════════════════════════════════════════════════════════════════════

// Auto-seed mentors into KV on cold-start (idempotent)
async function seedMentors() {
  const existing = await kv.get("mentor:1");
  if (existing) { console.log("Mentor data already seeded, skipping."); return; }
  const keys = MENTOR_SEED_DATA.map((m) => `mentor:${m.id}`);
  await kv.mset(keys, MENTOR_SEED_DATA);
  console.log(`Seeded ${MENTOR_SEED_DATA.length} mentors into KV.`);
}

// ── POST /mentors/seed — force re-seed (idempotent) ────────────────────────
app.post("/make-server-64a0c849/mentors/seed", async (c) => {
  try {
    const keys = MENTOR_SEED_DATA.map((m) => `mentor:${m.id}`);
    await kv.mset(keys, MENTOR_SEED_DATA);
    console.log("Mentor seed triggered via API.");
    return c.json({ success: true, seeded: MENTOR_SEED_DATA.length });
  } catch (err) {
    console.log("Seed mentors error:", err);
    return c.json({ error: `Lỗi seed mentor: ${err}` }, 500);
  }
});

// ── GET /mentors — list all ────────────────────────────────────────────────
app.get("/make-server-64a0c849/mentors", async (c) => {
  try {
    let records = await kv.getByPrefix("mentor:");
    let mentors = (records as any[]).filter((m) => m?.id).sort((a, b) => Number(a.id) - Number(b.id));

    // If empty, seed on-the-fly and re-fetch
    if (mentors.length === 0) {
      console.log("No mentors found, seeding now...");
      const keys = MENTOR_SEED_DATA.map((m) => `mentor:${m.id}`);
      await kv.mset(keys, MENTOR_SEED_DATA);
      records = await kv.getByPrefix("mentor:");
      mentors = (records as any[]).filter((m) => m?.id).sort((a, b) => Number(a.id) - Number(b.id));
      console.log(`Auto-seeded ${mentors.length} mentors`);
    }

    return c.json({ success: true, mentors });
  } catch (err) {
    console.log("List mentors error:", err);
    return c.json({ error: `Lỗi lấy danh sách mentor: ${err}` }, 500);
  }
});

// ── GET /mentors/:id — single mentor ──────────────────────────────────────
app.get("/make-server-64a0c849/mentors/:id", async (c) => {
  try {
    const id = c.req.param("id");
    const mentor = await kv.get(`mentor:${id}`);
    if (!mentor) return c.json({ error: "Không tìm thấy mentor" }, 404);
    return c.json({ success: true, mentor });
  } catch (err) {
    console.log("Get mentor error:", err);
    return c.json({ error: `Lỗi lấy mentor: ${err}` }, 500);
  }
});

// ── PUT /mentors/:id — update mentor (admin) ──────────────────────────────
app.put("/make-server-64a0c849/mentors/:id", async (c) => {
  try {
    const id = c.req.param("id");
    const existing = await kv.get(`mentor:${id}`);
    if (!existing) return c.json({ error: "Không tìm thấy mentor" }, 404);
    const body = await c.req.json();
    const updated = { ...existing, ...body, id }; // id is immutable
    await kv.set(`mentor:${id}`, updated);
    return c.json({ success: true, mentor: updated });
  } catch (err) {
    console.log("Update mentor error:", err);
    return c.json({ error: `Lỗi cập nhật mentor: ${err}` }, 500);
  }
});

Deno.serve(app.fetch);