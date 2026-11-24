/**
 * CO-06: pregen và cache video avatar cho câu hỏi công ty đã duyệt, giống câu baseline.
 *
 * Cache video tính theo nội dung câu + ảnh avatar + giọng (`buildCacheKey` trong avatarService.js),
 * không theo id câu. Vì vậy chỉ cần render trước mỗi câu × 2 giới tính một lần với
 * `persistVideo: true` (mirror Cloudinary, cache không TTL) là mọi buổi luyện theo job sau đó
 * trúng cache, không gọi provider video. Không thêm field nào vào QuestionBank.
 *
 * Chạy nền (fire-and-forget): duyệt câu không phải chờ render. Mọi lô xếp vào một hàng đợi
 * trong process, mỗi lô tối đa WARM_CHUNK_SIZE câu, để duyệt hàng loạt 12 câu không bắn
 * hàng chục job render song song. Lỗi render chỉ ghi log; người dùng đầu tiên của câu lỗi
 * sẽ render lúc luyện như trước đây.
 *
 * Provider đang chạy do avatarService quyết định (D-ID; ElevenLabs sau AI-15). Đổi provider
 * làm đổi cache key → chạy lại `npm run warmup:company-videos`.
 */
import { QuestionBank } from "../models/QuestionBank.js";
import { isDIDEnabled } from "./avatarService.js";
import { pregenerateSync } from "./videoPregenService.js";
import { logger } from "../config/logger.js";

export const WARM_GENDERS = ["male", "female"];
export const WARM_CHUNK_SIZE = 3;

let pregenImpl = null; // test thay provider giả qua __setCompanyVideoPregenForTest
let queue = Promise.resolve();

/** Test: thay hàm pregen (nhận như `pregenerateSync`). Truyền null để trả về mặc định. */
export function __setCompanyVideoPregenForTest(fn) {
  pregenImpl = typeof fn === "function" ? fn : null;
}

/** Chờ hàng đợi warm chạy hết (test và script dùng). */
export function whenCompanyVideoWarmIdle() {
  return queue;
}

function isMockMode() {
  return process.env.MOCK_AI_SERVICES === "true" || process.env.MOCK_AI === "true";
}

/** Có render video được không: cần key provider và không ở chế độ mock (QA-01). */
export function isCompanyVideoWarmEnabled() {
  if (pregenImpl) return true;
  return isDIDEnabled() && !isMockMode();
}

function uniqueTexts(texts) {
  const seen = new Set();
  const out = [];
  for (const raw of texts ?? []) {
    const text = String(raw ?? "").trim();
    if (text && !seen.has(text)) {
      seen.add(text);
      out.push(text);
    }
  }
  return out;
}

/**
 * Render (hoặc xác nhận đã cache) video cho danh sách câu, cả 2 giới tính. Chạy tuần tự theo lô.
 * @returns {Promise<{questions: number, renders: number, cacheHits: number, errors: number}>}
 */
export async function warmCompanyQuestionTexts(texts, { log = null } = {}) {
  const list = uniqueTexts(texts);
  const summary = { questions: list.length, renders: 0, cacheHits: 0, errors: 0 };
  if (list.length === 0 || !isCompanyVideoWarmEnabled()) return summary;

  const pregen = pregenImpl ?? pregenerateSync;
  for (const gender of WARM_GENDERS) {
    for (let i = 0; i < list.length; i += WARM_CHUNK_SIZE) {
      const chunk = list.slice(i, i + WARM_CHUNK_SIZE);
      try {
        const result = await pregen(chunk, { gender, persistVideo: true });
        const errors = result?.errors?.length ?? 0;
        const hits = result?.cacheHits ?? 0;
        summary.errors += errors;
        summary.cacheHits += hits;
        summary.renders += chunk.length - errors - hits;
        log?.(`[${gender}] ${i + chunk.length}/${list.length}: cache ${hits}, lỗi ${errors}`);
      } catch (err) {
        summary.errors += chunk.length;
        logger.error("company_question_video_warm_failed", { gender, count: chunk.length, error: err.message });
        log?.(`[${gender}] lô ${i / WARM_CHUNK_SIZE + 1} lỗi: ${err.message}`);
      }
    }
  }
  logger.info("company_question_video_warm_done", summary);
  return summary;
}

/**
 * Xếp câu công ty đã duyệt vào hàng đợi warm, không chờ. Chỉ nhận câu `orgId != null` và
 * `status: "approved"`; câu nháp, bị từ chối hoặc câu pool chung bị bỏ qua.
 * @param {Array<{text?: string, orgId?: unknown, status?: string}>} questions
 */
export function scheduleCompanyQuestionVideoWarm(questions) {
  const texts = (questions ?? [])
    .filter((q) => q && q.orgId && q.status === "approved")
    .map((q) => q.text);
  if (texts.length === 0 || !isCompanyVideoWarmEnabled()) return;

  queue = queue
    .then(() => warmCompanyQuestionTexts(texts))
    .catch((err) => logger.error("company_question_video_warm_failed", { error: err.message }));
}

/** Xếp hàng warm theo danh sách id (dùng sau `updateMany` duyệt hàng loạt). */
export function scheduleCompanyQuestionVideoWarmByIds(ids, companyId) {
  if (!isCompanyVideoWarmEnabled() || !Array.isArray(ids) || ids.length === 0) return;
  queue = queue
    .then(async () => {
      const questions = await QuestionBank.find({ _id: { $in: ids }, orgId: companyId, status: "approved" })
        .select("text")
        .lean();
      return warmCompanyQuestionTexts(questions.map((q) => q.text));
    })
    .catch((err) => logger.error("company_question_video_warm_failed", { error: err.message }));
}

/** Mọi câu công ty đang được duyệt (script backfill). */
export async function listApprovedCompanyQuestionTexts() {
  const texts = await QuestionBank.distinct("text", { orgId: { $ne: null }, status: "approved" });
  return uniqueTexts(texts);
}
