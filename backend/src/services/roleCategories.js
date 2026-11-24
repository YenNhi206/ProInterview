/**
 * Danh sách nhóm vị trí (roleCategory) dùng chung (đề xuất (l), làm cùng JB-03).
 * Nguồn duy nhất: `config/roleCategories.json`. BE import từ file này; FE đọc `GET /api/role-categories`.
 * Áp dụng: câu hỏi công ty (CO-05), rubric công ty (CO-07), tin tuyển dụng (JB-01, JB-03), luyện theo job (JB-06).
 */
import { readFileSync } from "node:fs";
import { ROLE_COMPETENCY_MAP } from "./competencyFramework.js";

const CONFIG_URL = new URL("../config/roleCategories.json", import.meta.url);
const KEY_PATTERN = /^[a-z0-9_]{2,60}$/;

function deepFreeze(value) {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const v of Object.values(value)) deepFreeze(v);
  }
  return value;
}

/** Đọc và kiểm tra file cấu hình; sai cấu trúc thì throw lúc khởi động (giống `competencies.json`). */
export function loadRoleCategoriesFromFile(fileUrl = CONFIG_URL) {
  const parsed = JSON.parse(readFileSync(fileUrl, "utf8"));
  if (!parsed || typeof parsed.version !== "string" || !Array.isArray(parsed.roleCategories) || parsed.roleCategories.length === 0) {
    throw new Error("roleCategories.json: thiếu version hoặc danh sách roleCategories");
  }
  const seen = new Set();
  for (const row of parsed.roleCategories) {
    if (!KEY_PATTERN.test(row?.key ?? "") || seen.has(row.key)) {
      throw new Error(`roleCategories.json: key rỗng, sai dạng hoặc trùng (${row?.key ?? "?"})`);
    }
    if (!row.nameVi || !row.nameEn) throw new Error(`roleCategories.json: thiếu tên cho ${row.key}`);
    if (!ROLE_COMPETENCY_MAP[row.interviewRole]) {
      throw new Error(`roleCategories.json: interviewRole "${row.interviewRole}" của ${row.key} không có trong ROLE_COMPETENCY_MAP`);
    }
    seen.add(row.key);
  }
  return deepFreeze(parsed);
}

const CONFIG = loadRoleCategoriesFromFile();
const BY_KEY = new Map(CONFIG.roleCategories.map((r) => [r.key, r]));

export const ROLE_CATEGORIES_VERSION = CONFIG.version;

/** Key hợp lệ khi tạo / sửa dữ liệu mới. Đọc dữ liệu cũ thì truyền `{ allowDeprecated: true }`. */
export function isValidRoleCategory(key, { allowDeprecated = false } = {}) {
  const row = typeof key === "string" ? BY_KEY.get(key) : null;
  if (!row) return false;
  return allowDeprecated || !row.deprecated;
}

export function getRoleCategory(key) {
  return BY_KEY.get(key) ?? null;
}

/** Tên tiếng Việt để hiển thị; key lạ (dữ liệu cũ) thì trả lại chính key. */
export function roleCategoryName(key) {
  return BY_KEY.get(key)?.nameVi || key || "";
}

/** Năng lực ưu tiên của vị trí (key LP-01), theo `interviewRole` → ROLE_COMPETENCY_MAP. Dùng gợi ý khi soạn job. */
export function suggestedCompetenciesFor(key) {
  const row = BY_KEY.get(key);
  return row ? [...(ROLE_COMPETENCY_MAP[row.interviewRole] ?? [])] : [];
}

/** Payload cho `GET /api/role-categories`: chỉ key còn dùng, kèm năng lực gợi ý. */
export function listRoleCategories() {
  return {
    version: CONFIG.version,
    roleCategories: CONFIG.roleCategories
      .filter((r) => !r.deprecated)
      .map((r) => ({
        key: r.key,
        nameVi: r.nameVi,
        nameEn: r.nameEn,
        interviewRole: r.interviewRole,
        suggestedCompetencies: suggestedCompetenciesFor(r.key),
      })),
  };
}

/**
 * JB-06: các key vị trí (còn dùng) có `interviewRole` cho trước. Phỏng vấn AI đoán vai trò theo
 * `ROLE_COMPETENCY_MAP` (`resolveTopCompetencies`), còn job / câu doanh nghiệp dùng key ở file này.
 */
export function roleCategoryKeysForInterviewRole(interviewRole) {
  const role = String(interviewRole ?? "").trim();
  if (!role) return [];
  return CONFIG.roleCategories.filter((r) => !r.deprecated && r.interviewRole === role).map((r) => r.key);
}
