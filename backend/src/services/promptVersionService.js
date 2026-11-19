/**
 * Loader và đổi phiên bản prompt (AI-02).
 *
 * - `getActivePrompt(key)`: bản `active` trong DB, cache trong bộ nhớ 60 giây. DB lỗi, chưa kết nối,
 *   không có bản active, hoặc template trong DB không hợp lệ → dùng prompt mặc định trong code và
 *   ghi log cảnh báo; luồng phỏng vấn không bao giờ lỗi vì loader. `version` trả về là version của
 *   prompt THỰC SỰ chạy (bản mặc định thì là `eval-v1` / `followup-v1`), dùng để ghi vào session.
 * - `activate(key, version, { by, note })`: kiểm tra template đủ phần, đủ biến (render thử) rồi mới
 *   bật; luôn giữ ràng buộc mỗi key tối đa 1 bản active; xóa cache.
 *
 * Mỗi instance có cache riêng: instance khác nhận version mới chậm nhất sau TTL.
 */
import mongoose from "mongoose";
import { PromptVersion } from "../models/PromptVersion.js";
import { PROMPT_REGISTRY } from "../prompts/index.js";
import { validateTemplate } from "../prompts/promptTemplate.js";
import { runInTransaction } from "../helpers/dbHelper.js";
import { httpError } from "../utils/apiErrors.js";
import { logger } from "../config/logger.js";

export const PROMPT_CACHE_TTL_MS = 60_000;
const DB_QUERY_TIMEOUT_MS = 2_000;

const cache = new Map(); // key → { value, expiresAt }
let now = () => Date.now();

/** Chỉ dùng trong test: thay đồng hồ để giả lập hết TTL. */
export function __setPromptClock(fn) {
  now = fn ?? (() => Date.now());
}

/** Xóa cache của một key (hoặc tất cả). */
export function clearPromptCache(key) {
  if (key) cache.delete(key);
  else cache.clear();
}

function registryEntry(key) {
  const entry = PROMPT_REGISTRY[key];
  if (!entry) throw new Error(`Prompt key chưa đăng ký: ${key}`);
  return entry;
}

function defaultPrompt(key) {
  const d = registryEntry(key).default;
  return { key, version: d.version, template: d.template, fewShotExamples: d.fewShotExamples, source: "default" };
}

async function loadFromDb(key) {
  const entry = registryEntry(key);
  if (mongoose.connection.readyState !== 1) {
    logger.warn("prompt_version_fallback", { key, reason: "db_not_connected" });
    return defaultPrompt(key);
  }
  let doc;
  try {
    doc = await PromptVersion.findOne({ key, active: true }).maxTimeMS(DB_QUERY_TIMEOUT_MS).lean();
  } catch (err) {
    logger.warn("prompt_version_fallback", { key, reason: "db_error", error: err?.message });
    return defaultPrompt(key);
  }
  if (!doc) {
    logger.warn("prompt_version_fallback", { key, reason: "no_active_version" });
    return defaultPrompt(key);
  }
  const errors = validateTemplate(entry.spec, doc.template);
  if (errors.length) {
    logger.error("prompt_version_fallback", { key, reason: "invalid_template", version: doc.version, errors });
    return defaultPrompt(key);
  }
  return { key, version: doc.version, template: doc.template, fewShotExamples: doc.fewShotExamples ?? [], source: "db" };
}

/**
 * Prompt đang dùng cho `key`.
 * @returns {Promise<{ key: string, version: string, template: object, fewShotExamples: object[], source: "db"|"default" }>}
 */
export async function getActivePrompt(key) {
  const hit = cache.get(key);
  if (hit && hit.expiresAt > now()) return hit.value;
  const value = await loadFromDb(key);
  cache.set(key, { value, expiresAt: now() + PROMPT_CACHE_TTL_MS });
  return value;
}

/**
 * Bật `version` làm bản active của `key`, tắt bản cũ.
 * @param {{ by?: import("mongoose").Types.ObjectId|string|null, note?: string }} [opts]
 * @returns {Promise<object>} bản ghi đã bật
 */
export async function activate(key, version, { by = null, note = "" } = {}) {
  const entry = PROMPT_REGISTRY[key];
  if (!entry) throw httpError(400, `Key prompt "${key}" chưa được đăng ký.`);
  const target = await PromptVersion.findOne({ key, version }).lean();
  if (!target) throw httpError(404, `Không tìm thấy phiên bản "${version}" của prompt "${key}".`);
  if (target.legacy || !target.template) {
    throw httpError(400, `Phiên bản "${version}" là chuỗi cũ không có nội dung prompt, không bật được.`);
  }
  const errors = validateTemplate(entry.spec, target.template);
  if (errors.length) {
    throw httpError(400, `Template của "${version}" chưa hợp lệ: ${errors.join("; ")}.`);
  }
  if (target.active) {
    clearPromptCache(key);
    return target;
  }

  const previous = await PromptVersion.findOne({ key, active: true }).select("_id").lean();
  const activation = { active: true, activatedAt: new Date(), activatedBy: by || null, ...(note ? { note } : {}) };

  try {
    await runInTransaction(async (session) => {
      const opts = session ? { session } : {};
      // Tắt trước rồi bật: partial unique index `key_single_active` không cho tồn tại 2 bản active.
      await PromptVersion.updateMany({ key, active: true, _id: { $ne: target._id } }, { $set: { active: false } }, opts);
      await PromptVersion.updateOne({ _id: target._id }, { $set: activation }, opts);
    });
  } catch (err) {
    // Không có transaction (standalone): bật lỗi thì bật lại bản cũ để key không mất bản active.
    if (previous) {
      await PromptVersion.updateOne({ _id: previous._id, active: false }, { $set: { active: true } }).catch(() => {});
    }
    clearPromptCache(key);
    if (err?.code === 11000) {
      throw httpError(409, `Đang có thao tác bật phiên bản khác cho prompt "${key}", thử lại sau.`);
    }
    throw err;
  }

  clearPromptCache(key);
  logger.info("prompt_version_activated", { key, version, previous: previous?._id?.toString() ?? null });
  return PromptVersion.findById(target._id).lean();
}
