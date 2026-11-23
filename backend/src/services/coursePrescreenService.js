/**
 * AI-08 (REQ AIS-08): AI sàng lọc khóa học khi mentor gửi duyệt.
 *
 * Gọi sau khi khóa chuyển sang `pending_review` (khóa mới) hoặc `pending_update` (bản chỉnh sửa của
 * khóa đang bán). Kết quả chỉ là gợi ý cho Platform Moderator: không tự duyệt, không tự từ chối.
 *
 * 1. Luật (không tốn LLM): thiếu mô tả, ít bài học, bài video không có video, thiếu ảnh bìa, thiếu
 *    "bạn sẽ học được", giá 0 ở khóa có phí, số điện thoại / Zalo / email trong nội dung.
 * 2. LLM model rẻ (`activeLLMModel("prescreen")`, prompt `course_prescreen` theo PromptVersion):
 *    vi phạm chính sách, cam kết sai sự thật, kéo giao dịch ngoài nền tảng, lạc đề, chất lượng thấp.
 *    Ghi CostEvent `course_prescreen` (ngưỡng Slack theo ngày, AI-12).
 * 3. Ghi `Course.aiPrescreen` và upsert 1 ModerationItem `course_prescreen` / khóa (không vào hàng
 *    đợi HITL phỏng vấn); moderator duyệt / từ chối khóa thì item đóng (`closePrescreenItem`).
 *
 * Gửi lại đúng nội dung đã sàng lọc (`contentHash` trùng, lần trước `done`) thì không gọi LLM lại.
 */
import { createHash } from "node:crypto";
import { Course } from "../models/Course.js";
import { ModerationItem, PRIORITY_RANK } from "../models/ModerationItem.js";
import { callLLM, extractJson, activeLLMModel, isLLMConfigured } from "./interviewQuestionService.js";
import { getActivePrompt } from "./promptVersionService.js";
import { createTrace, finalizeTrace } from "./langfuseService.js";
import { COST_EVENT_KIND } from "../constants/costEventKinds.js";
import {
  COURSE_PRESCREEN_KEY,
  COURSE_PRESCREEN_AI_FLAG_CODES,
  buildCoursePrescreenPrompt,
} from "../prompts/coursePrescreenPrompt.js";
import { logger } from "../config/logger.js";

export const PRESCREEN_RULES = Object.freeze({
  minDescriptionLength: 100,
  minLessons: 3,
});

/** Độ dài tối đa của bản tóm tắt gửi LLM (ký tự) — giữ chi phí mỗi lần ≈ vài nghìn token. */
const DIGEST_LIMIT = 12_000;
const FIELD_LIMIT = 600;
const SEVERITY_PENALTY = { critical: 30, warning: 10, info: 0 };

const PHONE_RE = /(?:\+?84|0)(?:[\s.-]?\d){8,10}\b/;
const EMAIL_RE = /[\w.+-]+@[\w-]+\.[\w.-]+/;
const CONTACT_APP_RE = /\b(zalo|telegram|t\.me\/|facebook\.com|fb\.com|messenger)\b/i;

/** Nội dung cần sàng lọc: bản chờ duyệt (`pendingUpdate`) nếu khóa đang bán, không thì chính khóa. */
export function prescreenTarget(course) {
  if (course.status === "pending_update" && course.pendingUpdate) {
    return { target: "pending_update", content: course.pendingUpdate };
  }
  return { target: "course", content: course };
}

const clip = (s, n = FIELD_LIMIT) => {
  const t = String(s ?? "").replace(/\s+/g, " ").trim();
  return t.length > n ? `${t.slice(0, n)}…` : t;
};

function lessonsOf(content) {
  return (content.modules ?? []).flatMap((m) => m?.lessons ?? []);
}

/** Các trường quyết định kết quả — dùng để băm và để dựng bản tóm tắt. */
function relevantContent(content) {
  return {
    title: content.title ?? "",
    shortDescription: content.shortDescription ?? "",
    description: content.description ?? "",
    level: content.level ?? "",
    tags: content.tags ?? [],
    whatYoullLearn: content.whatYoullLearn ?? [],
    requirements: content.requirements ?? [],
    thumbnail: content.thumbnail ?? "",
    isFree: Boolean(content.isFree),
    price: Number(content.price) || 0,
    modules: (content.modules ?? []).map((m) => ({
      title: m?.title ?? "",
      lessons: (m?.lessons ?? []).map((l) => ({
        title: l?.title ?? "",
        type: l?.type ?? "",
        videoUrl: l?.videoUrl ?? "",
        documentUrl: l?.documentUrl ?? "",
        description: l?.description ?? "",
        transcript: l?.transcript ?? "",
      })),
    })),
  };
}

export function prescreenContentHash(content) {
  return createHash("sha256").update(JSON.stringify(relevantContent(content))).digest("hex");
}

/** Cờ theo luật (source `rule`). */
export function ruleFlags(content) {
  const flags = [];
  const add = (code, severity, message, evidence = "") => flags.push({ code, severity, message, evidence, source: "rule" });
  const c = relevantContent(content);
  const lessons = c.modules.flatMap((m) => m.lessons);

  if (c.description.replace(/\s+/g, " ").trim().length < PRESCREEN_RULES.minDescriptionLength) {
    add("short_description", "warning", `Mô tả khóa học ngắn hơn ${PRESCREEN_RULES.minDescriptionLength} ký tự.`);
  }
  if (!c.whatYoullLearn.some((x) => String(x).trim())) {
    add("missing_learning_outcomes", "warning", "Chưa có mục \"Bạn sẽ học được gì\".");
  }
  if (!c.thumbnail) add("missing_thumbnail", "info", "Chưa có ảnh bìa.");
  if (lessons.length < PRESCREEN_RULES.minLessons) {
    add("too_few_lessons", "warning", `Khóa chỉ có ${lessons.length} bài học (tối thiểu nên có ${PRESCREEN_RULES.minLessons}).`);
  }
  const videoLessons = lessons.filter((l) => l.type === "video");
  const missingVideo = videoLessons.filter((l) => !l.videoUrl);
  if (missingVideo.length) {
    add(
      "missing_video",
      "critical",
      `${missingVideo.length} bài học dạng video chưa có video.`,
      missingVideo.slice(0, 3).map((l) => l.title).join("; "),
    );
  }
  if (lessons.length && !videoLessons.length) add("no_video", "info", "Khóa không có bài học video nào.");
  const missingDocument = lessons.filter((l) => l.type === "document" && !l.documentUrl && !l.description.trim());
  if (missingDocument.length) {
    add("missing_document", "warning", `${missingDocument.length} bài học tài liệu chưa có tệp hoặc nội dung.`,
      missingDocument.slice(0, 3).map((l) => l.title).join("; "));
  }
  const undescribed = lessons.filter((l) => !l.description.trim());
  if (lessons.length && undescribed.length / lessons.length > 0.5) {
    add("lesson_missing_description", "info", `${undescribed.length}/${lessons.length} bài học chưa có mô tả.`);
  }
  if (!c.isFree && c.price <= 0) add("price_missing", "warning", "Khóa có phí nhưng giá bằng 0.");

  const texts = [c.title, c.shortDescription, c.description, ...c.whatYoullLearn, ...lessons.flatMap((l) => [l.title, l.description])];
  const contact = texts.map(String).find((t) => PHONE_RE.test(t) || EMAIL_RE.test(t) || CONTACT_APP_RE.test(t));
  if (contact) {
    const m = contact.match(PHONE_RE) ?? contact.match(EMAIL_RE) ?? contact.match(CONTACT_APP_RE);
    add("external_contact", "critical", "Nội dung có thông tin liên hệ ngoài nền tảng.", clip(m?.[0] ?? contact, 200));
  }
  return flags;
}

/** Bản tóm tắt dạng chữ gửi LLM. */
export function buildCourseDigest(content) {
  const c = relevantContent(content);
  const lines = [
    `Tiêu đề: ${clip(c.title, 200)}`,
    `Cấp độ: ${c.level || "(chưa chọn)"} · ${c.isFree ? "Miễn phí" : `Giá: ${c.price}đ`}`,
    c.tags.length ? `Thẻ: ${c.tags.slice(0, 10).join(", ")}` : "",
    `Mô tả ngắn: ${clip(c.shortDescription) || "(trống)"}`,
    `Mô tả: ${clip(c.description, 2000) || "(trống)"}`,
    c.whatYoullLearn.length ? `Bạn sẽ học được:\n${c.whatYoullLearn.slice(0, 10).map((x) => `- ${clip(x, 200)}`).join("\n")}` : "",
    c.requirements.length ? `Yêu cầu:\n${c.requirements.slice(0, 10).map((x) => `- ${clip(x, 200)}`).join("\n")}` : "",
    "Nội dung:",
    ...c.modules.map((m, i) => [
      `Chương ${i + 1}: ${clip(m.title, 200)}`,
      ...m.lessons.map((l, j) => {
        const detail = clip(l.description || l.transcript, 400);
        return `  Bài ${i + 1}.${j + 1} [${l.type || "?"}] ${clip(l.title, 200)}${detail ? ` — ${detail}` : ""}`;
      }),
    ].join("\n")),
  ].filter(Boolean);
  const text = lines.join("\n");
  return text.length > DIGEST_LIMIT ? `${text.slice(0, DIGEST_LIMIT)}\n…(đã cắt bớt)` : text;
}

async function callAndParse(built, opts) {
  let raw = await callLLM(built.system, built.user, opts);
  try {
    return JSON.parse(extractJson(raw));
  } catch {
    raw = await callLLM(built.jsonRepair, raw, { ...opts, temp: 0, retries: 0, traceName: "course_prescreen_json_repair" });
    return JSON.parse(extractJson(raw));
  }
}

/** Chỉ giữ cờ đúng mã, đúng mức; tối đa 10 cờ. */
export function sanitizeAiFlags(rawFlags) {
  if (!Array.isArray(rawFlags)) return [];
  return rawFlags
    .filter((f) => COURSE_PRESCREEN_AI_FLAG_CODES.includes(f?.code))
    .slice(0, 10)
    .map((f) => ({
      code: f.code,
      severity: f.severity === "critical" ? "critical" : "warning",
      message: clip(f.message, 300) || f.code,
      evidence: clip(f.evidence, 200),
      source: "ai",
    }));
}

/** Điểm cuối = min(điểm AI, 100 − phạt theo cờ luật). Không có điểm AI thì chỉ tính theo luật. */
export function combineScore(aiScore, flags) {
  const penalty = flags.filter((f) => f.source === "rule").reduce((s, f) => s + (SEVERITY_PENALTY[f.severity] ?? 0), 0);
  const ruleScore = Math.max(0, 100 - penalty);
  const ai = aiScore === null || aiScore === undefined || aiScore === "" ? NaN : Number(aiScore);
  return Number.isFinite(ai) ? Math.round(Math.min(Math.max(0, Math.min(100, ai)), ruleScore)) : ruleScore;
}

async function runAi(content, courseId, userId) {
  if (!isLLMConfigured()) return { ok: false, error: "Dịch vụ AI chưa được cấu hình." };
  const prompt = await getActivePrompt(COURSE_PRESCREEN_KEY);
  const built = buildCoursePrescreenPrompt(prompt, { course: buildCourseDigest(content) });
  const model = activeLLMModel("prescreen");
  const traceId = createTrace({
    name: "course_prescreen",
    userId,
    metadata: { courseId: String(courseId), promptVersion: prompt.version, model },
    tags: ["course_prescreen"],
  });
  try {
    const parsed = await callAndParse(built, {
      maxTokens: 1500,
      temp: 0,
      retries: 1,
      traceId,
      traceName: "course_prescreen",
      costKind: COST_EVENT_KIND.COURSE_PRESCREEN,
      model,
      anthropicModel: model,
    });
    finalizeTrace(traceId, "success");
    return {
      ok: true,
      model,
      promptVersion: prompt.version,
      score: parsed?.score,
      summary: clip(parsed?.summary, 500),
      flags: sanitizeAiFlags(parsed?.flags),
    };
  } catch (err) {
    finalizeTrace(traceId, "error", err?.message);
    logger.error("course_prescreen_llm_failed", { courseId: String(courseId), error: err?.message });
    return { ok: false, model, promptVersion: prompt.version, error: "AI chưa sàng lọc được khóa học." };
  }
}

async function upsertPrescreenItem(course, result, mentorUserId) {
  const critical = result.flags.some((f) => f.severity === "critical");
  const priority = critical ? "high" : "normal";
  await ModerationItem.findOneAndUpdate(
    { type: "course_prescreen", "refs.courseId": course._id },
    {
      $set: {
        status: "open",
        priority,
        priorityRank: PRIORITY_RANK[priority],
        assignee: null,
        resolution: { action: null, note: "", by: null, at: null },
        "refs.userId": mentorUserId ?? null,
        snapshot: {
          courseTitle: course.title ?? "",
          aiPrescreen: {
            target: result.target,
            status: result.status,
            score: result.score,
            summary: result.summary,
            flags: result.flags,
            model: result.model,
            promptVersion: result.promptVersion,
          },
        },
      },
    },
    { upsert: true },
  ).catch(async (err) => {
    // Hai lượt upsert cùng lúc cho 1 khóa: lượt thua (E11000) bỏ qua, lượt thắng đã ghi.
    if (err?.code !== 11000) throw err;
  });
}

/**
 * Sàng lọc một khóa đang chờ duyệt. Không ném lỗi ra ngoài vì lỗi LLM: lỗi thì `status: "failed"`,
 * cờ luật vẫn được ghi.
 * @param {string|import("mongoose").Types.ObjectId} courseId
 * @param {{ force?: boolean, userId?: string }} [opts]
 * @returns {Promise<object|null>} `aiPrescreen` đã ghi; khóa không tồn tại / không chờ duyệt → null
 */
export async function prescreenCourse(courseId, { force = false, userId = null } = {}) {
  const course = await Course.findById(courseId).lean();
  if (!course || !["pending_review", "pending_update"].includes(course.status)) return null;

  const { target, content } = prescreenTarget(course);
  const contentHash = prescreenContentHash(content);
  const prev = course.aiPrescreen;
  if (!force && prev?.status === "done" && prev.contentHash === contentHash && prev.target === target) {
    return prev;
  }

  await Course.updateOne({ _id: course._id }, { $set: { aiPrescreen: { status: "pending", target, contentHash, at: new Date() } } });

  const rules = ruleFlags(content);
  const ai = await runAi(content, course._id, userId);
  const flags = [...rules, ...(ai.flags ?? [])];
  const result = {
    status: ai.ok ? "done" : "failed",
    score: combineScore(ai.ok ? ai.score : null, flags),
    summary: ai.summary || "",
    flags,
    target,
    model: ai.model || "",
    promptVersion: ai.promptVersion || "",
    contentHash,
    error: ai.ok ? "" : ai.error,
    at: new Date(),
  };

  // Ghi có điều kiện: mentor gửi lại nội dung khác trong lúc chờ LLM thì bỏ kết quả cũ.
  const written = await Course.updateOne(
    { _id: course._id, "aiPrescreen.contentHash": contentHash },
    { $set: { aiPrescreen: result } },
  );
  if (written.matchedCount === 0) return null;

  await upsertPrescreenItem(course, result, userId);
  logger.info("course_prescreen_done", {
    courseId: String(course._id), status: result.status, score: result.score, flags: flags.map((f) => f.code),
  });
  return result;
}

const inflight = new Set();

/** Chạy nền sau khi mentor gửi duyệt (không chặn response). */
export function schedulePrescreen(courseId, userId) {
  const p = prescreenCourse(courseId, { userId })
    .catch((err) => logger.error("course_prescreen_failed", { courseId: String(courseId), error: err?.message }))
    .finally(() => inflight.delete(p));
  inflight.add(p);
  return p;
}

/** Chỉ dùng trong test: chờ mọi lượt sàng lọc nền chạy xong. */
export async function waitForPendingPrescreens() {
  while (inflight.size) await Promise.all([...inflight]);
}

/** Moderator duyệt / từ chối khóa → đóng item `course_prescreen` (giữ kết quả AI để so với quyết định). */
export async function closePrescreenItem(courseId, { decision, moderatorId, note = "" }) {
  await ModerationItem.updateOne(
    { type: "course_prescreen", "refs.courseId": courseId, status: { $in: ["open", "in_review"] } },
    {
      $set: {
        status: "resolved",
        resolution: { action: null, note: `${decision}${note ? `: ${String(note).slice(0, 480)}` : ""}`, by: moderatorId ?? null, at: new Date() },
      },
    },
  ).catch((err) => logger.warn("course_prescreen_close_failed", { courseId: String(courseId), error: err?.message }));
}
