/**
 * Loader và đổi phiên bản prompt (AI-02).
 *
 * - `getActivePrompt(key)`: bản `active` trong DB, cache trong bộ nhớ 60 giây. DB lỗi, chưa kết nối,
 *   không có bản active, hoặc template trong DB không hợp lệ → dùng prompt mặc định trong code và
 *   ghi log cảnh báo; luồng phỏng vấn không bao giờ lỗi vì loader. `version` trả về là version của
 *   prompt THỰC SỰ chạy (bản mặc định thì là `eval-v1` / `followup-v1`), dùng để ghi vào session.
 * - `activate(key, version, { by, note })`: kiểm tra template đủ phần, đủ biến (render thử) rồi mới
 *   bật; luôn giữ ràng buộc mỗi key tối đa 1 bản active; xóa cache.
 * - `createVersion(key, { baseVersion, template, fewShotExamples })`: tạo bản mới chưa bật (AI-03).
 *
 * Mỗi instance có cache riêng: instance khác nhận version mới chậm nhất sau TTL.
 */
import mongoose from "mongoose";
import { PromptVersion } from "../models/PromptVersion.js";
import { PROMPT_REGISTRY, versionNameError } from "../prompts/index.js";
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
 * Một version cụ thể của `key` (không cần active), dạng giống `getActivePrompt`. Dùng cho backtest
 * (AI-04). Version trùng bản mặc định trong code mà DB chưa có → bản mặc định.
 * Chuỗi cũ không có nội dung (`legacy`) hoặc template không hợp lệ → 400; không thấy → 404.
 */
export async function getPromptByVersion(key, version) {
  const entry = PROMPT_REGISTRY[key];
  if (!entry) throw httpError(400, `Key prompt "${key}" chưa được đăng ký.`);
  const doc = await PromptVersion.findOne({ key, version }).lean();
  if (!doc) {
    if (version === entry.default.version) return defaultPrompt(key);
    throw httpError(404, `Không tìm thấy phiên bản "${version}" của prompt "${key}".`);
  }
  if (doc.legacy || !doc.template) {
    throw httpError(400, `Phiên bản "${version}" là chuỗi cũ không có nội dung prompt.`);
  }
  const errors = validateTemplate(entry.spec, doc.template);
  if (errors.length) throw httpError(400, `Template của "${version}" chưa hợp lệ: ${errors.join("; ")}.`);
  return { key, version: doc.version, template: doc.template, fewShotExamples: doc.fewShotExamples ?? [], source: "db" };
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

/**
 * Số N lớn nhất trong các version `<tiền tố>-vN` đã có (bỏ qua chuỗi cũ khác quy ước), tính cả bản
 * mặc định trong code: DB chưa sync vẫn không tạo trùng tên `eval-v1` mà session cũ đã ghi.
 */
async function maxVersionNumber(prefix, defaultVersion) {
  const docs = await PromptVersion.find({ version: { $regex: `^${prefix}-v\\d+$` } }).select("version").lean();
  const numberOf = (v) => (v?.startsWith(`${prefix}-v`) ? Number(v.slice(prefix.length + 2)) || 0 : 0);
  return docs.reduce((max, d) => Math.max(max, numberOf(d.version)), numberOf(defaultVersion));
}

/**
 * Tạo version mới (chưa bật) cho `key` từ một bản gốc (AI-03, đề xuất h).
 *
 * - `baseVersion` bỏ trống → lấy bản `active`; chưa có bản active → bản mặc định trong code.
 * - `template` / `fewShotExamples` bỏ trống → chép từ bản gốc.
 * - Tên tự sinh `<tiền tố>-v(N+1)` (N lớn nhất đã có), hoặc truyền `version` để đặt tên.
 *   Kiểm tên và `validateTemplate` như `activate()`; không hợp lệ thì 400, trùng tên thì 409.
 * @returns {Promise<object>} bản ghi PromptVersion vừa tạo (`active: false`)
 */
export async function createVersion(
  key,
  { baseVersion = null, template, fewShotExamples, version = null, note = "" } = {},
) {
  const entry = PROMPT_REGISTRY[key];
  if (!entry) throw httpError(400, `Key prompt "${key}" chưa được đăng ký.`);

  let base;
  if (baseVersion) {
    base = await PromptVersion.findOne({ key, version: baseVersion }).lean();
    if (!base) throw httpError(404, `Không tìm thấy phiên bản "${baseVersion}" của prompt "${key}".`);
    if (base.legacy || !base.template) {
      throw httpError(400, `Phiên bản "${baseVersion}" là chuỗi cũ không có nội dung prompt, không làm bản gốc được.`);
    }
  } else {
    base = (await PromptVersion.findOne({ key, active: true }).lean()) ?? entry.default;
  }

  const nextTemplate = template ?? base.template;
  const errors = validateTemplate(entry.spec, nextTemplate);
  if (errors.length) throw httpError(400, `Template chưa hợp lệ: ${errors.join("; ")}.`);

  const nextFewShot = (fewShotExamples ?? base.fewShotExamples ?? []).map((e) => ({
    input: String(e?.input ?? ""),
    output: String(e?.output ?? ""),
    note: String(e?.note ?? ""),
  }));

  const autoName = !version;
  // Tự đặt tên: thử lại khi hai lượt tạo cùng lúc lấy trùng số.
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const name = version ?? `${entry.versionPrefix}-v${(await maxVersionNumber(entry.versionPrefix, entry.default.version)) + 1}`;
    const nameError = versionNameError(key, name);
    if (nameError) throw httpError(400, `${nameError}.`);
    try {
      const doc = await PromptVersion.create({
        key,
        version: name,
        // Bản mặc định trong code bị deepFreeze → chép ra object thường trước khi lưu.
        template: structuredClone(nextTemplate),
        fewShotExamples: nextFewShot,
        active: false,
        note: note || `Tạo từ ${base.version}`,
      });
      logger.info("prompt_version_created", { key, version: name, base: base.version });
      return doc.toObject();
    } catch (err) {
      if (err?.code !== 11000) throw err;
      if (!autoName) throw httpError(409, `Phiên bản "${name}" đã tồn tại.`);
    }
  }
  throw httpError(409, `Đang có thao tác tạo phiên bản khác cho prompt "${key}", thử lại sau.`);
}
