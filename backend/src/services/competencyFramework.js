/**
 * competencyFramework.js
 * SHRM / DDI Competency Knowledge Base cho ProInterview AI.
 *
 * Nguồn tham chiếu:
 *  - SHRM Behavioral Competency Model (shrm.org/resourcesandtools/hr-topics/behavioral-competencies)
 *  - DDI Targeted Selection® / Leadership Frameworks (ddiworld.com)
 *
 * Kiến trúc:
 *  Layer 1 — Định nghĩa tĩnh (file này): SHRM definitions + DDI Key Actions + STAR rubric
 *  Layer 2 — Detect động từ CV/JD text: detectCompetenciesFromText()
 *  Layer 3 — Accumulation từ MongoDB: getFewShotContext() (gọi từ controller)
 */

import { readFileSync } from "node:fs";

// ── HELPER: Text normalization for diacritic-insensitive matching ─────────────

function normalizeForDetection(text) {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // strip diacritics
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// ── 1. COMPETENCY LIBRARY (đọc từ config/competencies.json) ───────────────────
// Nguồn duy nhất của bộ tiêu chí SHRM/DDI (LP-01): key năng lực, thang 6 mức 0–5,
// anchors, ngưỡng đạt, hệ số quy đổi điểm AI. FE đọc qua GET /api/competencies.
// Đọc đồng bộ 1 lần khi nạp module (không dùng import attributes để tránh cảnh báo
// thử nghiệm trên Node 20/22).

const FRAMEWORK_URL = new URL("../config/competencies.json", import.meta.url);

function deepFreeze(value) {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const v of Object.values(value)) deepFreeze(v);
  }
  return value;
}

/** Kiểm tra cấu trúc tối thiểu — sai thì throw ngay lúc khởi động (fail-fast). */
function assertFrameworkShape(fw) {
  if (!fw || !Array.isArray(fw.competencies) || fw.competencies.length === 0) {
    throw new Error("competencies.json: thiếu mảng competencies");
  }
  if (!Array.isArray(fw.levels) || !Number.isFinite(fw.passThreshold) || !fw.aiCalibration) {
    throw new Error("competencies.json: thiếu levels, passThreshold hoặc aiCalibration");
  }
  const seen = new Set();
  for (const c of fw.competencies) {
    if (!c?.key || seen.has(c.key)) {
      throw new Error(`competencies.json: key năng lực rỗng hoặc trùng (${c?.key ?? "?"})`);
    }
    seen.add(c.key);
  }
}

export function loadFrameworkFromFile(fileUrl = FRAMEWORK_URL) {
  const parsed = JSON.parse(readFileSync(fileUrl, "utf8"));
  assertFrameworkShape(parsed);
  return deepFreeze(parsed);
}

const FRAMEWORK = loadFrameworkFromFile();
const COMPETENCY_BY_KEY = new Map(FRAMEWORK.competencies.map((c) => [c.key, c]));
const DEPRECATED_KEYS = new Set(FRAMEWORK.competencies.filter((c) => c.deprecated).map((c) => c.key));

/**
 * Hình dạng cũ mà luồng phỏng vấn, DTO moderator và ngân hàng câu hỏi đang dùng
 * (`id`, `behavioralIndicators`, …). Giữ cả key `deprecated` để dữ liệu cũ vẫn hiện tên.
 * Bản sao (không đóng băng) để code cũ không đụng tới FRAMEWORK.
 */
export const COMPETENCY_LIBRARY = Object.fromEntries(
  FRAMEWORK.competencies.map((c) => [
    c.key,
    {
      id: c.key,
      nameVi: c.nameVi,
      nameEn: c.nameEn,
      shrm: c.shrm,
      ddi: c.ddi,
      definition: c.definition,
      behavioralIndicators: [...(c.indicators ?? [])],
      ddiKeyActions: [...(c.ddiKeyActions ?? [])],
      starRubric: { ...c.starRubric },
      keywords: [...(c.keywords ?? [])],
      synonyms: [...(c.synonyms ?? [])],
      relevantLayers: [...(c.relevantLayers ?? [])],
    },
  ]),
);

/** Toàn bộ bộ tiêu chí (đã đóng băng) — dùng cho GET /api/competencies. */
export function getFramework() {
  return FRAMEWORK;
}

/** Một năng lực theo key (kể cả key deprecated), không có thì null. */
export function getCompetency(key) {
  return COMPETENCY_BY_KEY.get(key) ?? null;
}

/**
 * Key có trong bộ tiêu chí không. Mặc định từ chối key `deprecated` (mentor, rubric,
 * job post không được chọn); đọc dữ liệu cũ thì truyền `{ allowDeprecated: true }`.
 * Dùng cho CO-07, JB-01, LP-03.
 */
export function isValidCompetencyKey(key, { allowDeprecated = false } = {}) {
  if (typeof key !== "string" || !COMPETENCY_BY_KEY.has(key)) return false;
  return allowDeprecated || !DEPRECATED_KEYS.has(key);
}

const isNum = (v) => typeof v === "number" && Number.isFinite(v);

/**
 * Câu được coi là "không trả lời" khi có thông tin answer (kể cả `null` = không có
 * answer cho câu đó) và transcript rỗng — cùng điều kiện với prompt chấm điểm
 * ("(Ứng viên không trả lời câu này)"). `answer` undefined = không biết.
 */
function isUnanswered(answer) {
  if (answer === undefined) return false;
  return !String(answer?.transcript ?? "").trim();
}

/**
 * Quy đổi điểm AI của một câu sang mức 0–5 của LP-01 (chỉ đọc, không ghi đè dữ liệu).
 *
 * @param {object} item  Một phần tử `feedback.perQuestion[]` (field `overall5`, `score`),
 *                       hoặc phần tử `evaluation.perQuestion[]` của API (field `overall`,
 *                       đã gộp `evaluationIncomplete`, `moderatorOverride`).
 * @param {object} [opts]
 * @param {object|null} [opts.answer]  `session.answers[i]` cùng `questionIndex` — nơi
 *                       lưu `moderatorOverride`, `evaluationIncomplete`, `transcript`.
 * @param {object} [opts.calibration]  Ghi đè `aiCalibration` (chỉ dùng khi backtest AI-01).
 * @returns {number|null} Số thập phân 0..maxLevel, hoặc null = "Chưa đủ dữ liệu".
 */
export function aiAnswerToLevel(item, { answer, calibration = FRAMEWORK.aiCalibration } = {}) {
  const q = item ?? {};
  let overall5 = null;

  // 1. Moderator chấm lại → lấy điểm moderator (cùng thang AI, áp cùng hệ số).
  const override = q.moderatorOverride ?? answer?.moderatorOverride ?? null;
  if (override && isNum(override.overall)) {
    overall5 = override.overall;
  } else {
    // 2. LLM chấm thiếu tiêu chí → điểm là fallback, không dùng.
    if (q.evaluationIncomplete === true || answer?.evaluationIncomplete === true) return null;

    // 3. overall5 > 0. (Không bao giờ đọc shrmLevel.)
    const o5 = isNum(q.overall5) ? q.overall5 : isNum(q.overall) ? q.overall : 0;
    if (o5 > 0) {
      overall5 = o5;
    } else if (isUnanswered(answer)) {
      // 4a. Không trả lời → mức 0.
      return 0;
    } else if (isNum(q.score) && q.score > 0) {
      // 4b. Session cũ chỉ có score 0–100.
      overall5 = q.score / 20;
    } else {
      return null;
    }
  }

  const offset = isNum(calibration?.offset) ? calibration.offset : 0;
  const maxLevel = isNum(calibration?.maxLevel) ? calibration.maxLevel : FRAMEWORK.scale.max;
  return Math.min(maxLevel, Math.max(0, overall5 + offset));
}

/**
 * Gợi ý kết quả buổi lộ trình — mentor là người quyết định cuối.
 * "passed" khi MỌI key của buổi có điểm ≥ ngưỡng (không dùng trung bình);
 * có key chưa có điểm (null) thì không gợi ý.
 *
 * @param {Record<string, number|null>|Map<string, number|null>} scoresByKey
 * @param {string[]} sessionKeys  `shrmKeys` của buổi
 * @returns {"passed"|"not_passed"|null}
 */
export function suggestOutcome(scoresByKey, sessionKeys, { passThreshold = FRAMEWORK.passThreshold } = {}) {
  const keys = [...new Set(Array.isArray(sessionKeys) ? sessionKeys : [])];
  if (keys.length === 0) return null;
  const read = (k) => (scoresByKey instanceof Map ? scoresByKey.get(k) : scoresByKey?.[k]);
  let allPass = true;
  for (const k of keys) {
    const v = read(k);
    if (!isNum(v)) return null;
    if (v < passThreshold) allPass = false;
  }
  return allPass ? "passed" : "not_passed";
}

/** Làm tròn mức để hiển thị; null/undefined giữ là null ("Chưa đủ dữ liệu"). */
export function toDisplayLevel(level) {
  return isNum(level) ? Math.round(level) : null;
}


// ── 2. ROLE → COMPETENCY PRIORITY MAP ────────────────────────────────────────
// Thứ tự = ưu tiên: index 0 = quan trọng nhất cho role này

export const ROLE_COMPETENCY_MAP = {
  frontend:         ["technical_learning", "problem_solving", "communication", "results_orientation", "adaptability", "teamwork"],
  backend:          ["technical_learning", "problem_solving", "planning_execution", "risk_management", "innovation", "results_orientation"],
  fullstack:        ["technical_learning", "problem_solving", "adaptability", "planning_execution", "results_orientation", "teamwork"],
  devops:           ["technical_learning", "problem_solving", "risk_management", "planning_execution", "adaptability", "results_orientation"],
  mobile:           ["technical_learning", "problem_solving", "adaptability", "customer_focus", "teamwork", "results_orientation"],
  data:             ["technical_learning", "data_driven_decision", "problem_solving", "communication", "strategic_thinking", "results_orientation"],
  ai_ml:            ["technical_learning", "problem_solving", "innovation", "data_driven_decision", "communication", "strategic_thinking"],
  manager:          ["leadership", "communication", "coaching_development", "strategic_thinking", "stakeholder_management", "accountability", "planning_execution"],
  product:          ["communication", "strategic_thinking", "customer_focus", "stakeholder_management", "data_driven_decision", "leadership"],
  design:           ["customer_focus", "communication", "innovation", "adaptability", "emotional_intelligence", "teamwork"],
  marketing:        ["communication", "data_driven_decision", "customer_focus", "innovation", "strategic_thinking", "results_orientation"],
  sales:            ["communication", "customer_focus", "results_orientation", "adaptability", "stakeholder_management", "emotional_intelligence"],
  hr:               ["communication", "coaching_development", "emotional_intelligence", "integrity", "teamwork", "leadership"],
  developer:        ["technical_learning", "problem_solving", "accountability", "teamwork", "communication", "planning_execution"],
  default:          ["problem_solving", "communication", "teamwork", "accountability", "adaptability", "results_orientation"],
};

// ── 3. ROLE DETECTION ─────────────────────────────────────────────────────────

export function detectRoleCategory(position = "", field = "") {
  const t = `${position} ${field}`.toLowerCase();
  if (/frontend|react|vue|angular|next\.?js|nuxt/.test(t))            return "frontend";
  if (/backend|node|java|spring|django|rails|laravel|golang|rust/.test(t)) return "backend";
  if (/fullstack|full.?stack/.test(t))                                 return "fullstack";
  if (/devops|cloud|aws|gcp|azure|infra|sre|platform|k8s|docker/.test(t)) return "devops";
  if (/mobile|android|ios|flutter|react native|swift|kotlin/.test(t)) return "mobile";
  if (/data|analyst|bi |etl|warehouse|tableau|power bi/.test(t))       return "data";
  if (/\bai\b|ml\b|machine learning|deep learning|nlp|llm/.test(t))   return "ai_ml";
  if (/manager|director|head|cto|ceo|vp |lead/.test(t))               return "manager";
  if (/product|pm\b|po\b|product owner/.test(t))                       return "product";
  if (/design|ux|ui designer|figma/.test(t))                          return "design";
  if (/marketing|seo|content|growth/.test(t))                         return "marketing";
  if (/sales|business dev|account exec/.test(t))                      return "sales";
  if (/hr|human resource|talent|recruit/.test(t))                     return "hr";
  if (/developer|engineer|programmer|software/.test(t))               return "developer";
  return "default";
}

// ── 4. COMPETENCY DETECTION FROM CV/JD TEXT ──────────────────────────────────
// Weighted keyword scoring — không tốn LLM token, chạy O(n) trên text
// - Exact keyword match in original text: score += 3
// - Synonym match in original text: score += 2
// - Normalized (diacritic-stripped) keyword match: score += 3
// - Normalized synonym match: score += 2

export function detectCompetenciesFromText(cvText = "", jdText = "") {
  return Object.entries(scoreCompetenciesInText(`${cvText} ${jdText}`))
    .sort(([, a], [, b]) => b - a)
    .map(([id]) => id);
}

/**
 * Điểm khớp từ khóa của từng năng lực (không deprecated) trong một đoạn chữ, cùng quy tắc với
 * `detectCompetenciesFromText`. Dùng cho gợi ý mentor / khóa học (AI-10).
 * @returns {Record<string, number>}
 */
export function scoreCompetenciesInText(text = "") {
  const combined = String(text ?? "");
  const combinedNorm = normalizeForDetection(combined);
  const scores = {};

  for (const [id, comp] of Object.entries(COMPETENCY_LIBRARY)) {
    // Key deprecated không được gợi ý cho câu hỏi mới (vẫn giữ trong thư viện để hiện tên).
    if (DEPRECATED_KEYS.has(id)) continue;
    let score = 0;
    const combinedLower = combined.toLowerCase();

    // Keyword matching — weight 3
    for (const kw of comp.keywords) {
      const kwLower = kw.toLowerCase();
      if (combinedLower.includes(kwLower)) {
        score += 3;
      } else {
        // Normalized fallback for diacritic-insensitive match
        const kwNorm = normalizeForDetection(kw);
        if (kwNorm.length > 1 && combinedNorm.includes(kwNorm)) {
          score += 3;
        }
      }
    }

    // Synonym matching — weight 2
    if (Array.isArray(comp.synonyms)) {
      for (const syn of comp.synonyms) {
        const synLower = syn.toLowerCase();
        if (combinedLower.includes(synLower)) {
          score += 2;
        } else {
          const synNorm = normalizeForDetection(syn);
          if (synNorm.length > 1 && combinedNorm.includes(synNorm)) {
            score += 2;
          }
        }
      }
    }

    scores[id] = score;
  }

  return scores;
}

// ── 5. MERGE: ROLE MAP + TEXT DETECTION ──────────────────────────────────────
// Kết hợp role priority + keyword evidence → top N competency ids

export function resolveTopCompetencies(position, field, cvText, jdText, topN = 4) {
  const roleCategory = detectRoleCategory(position, field);
  const rolePriority = ROLE_COMPETENCY_MAP[roleCategory] ?? ROLE_COMPETENCY_MAP.default;
  const textDetected = detectCompetenciesFromText(cvText, jdText);

  // Score: role map vị trí cao hơn (weight 3), text detection weight 1
  const scoreMap = {};
  rolePriority.forEach((id, idx) => {
    scoreMap[id] = (scoreMap[id] ?? 0) + (rolePriority.length - idx) * 3;
  });
  textDetected.forEach((id, idx) => {
    scoreMap[id] = (scoreMap[id] ?? 0) + Math.max(0, textDetected.length - idx);
  });

  return {
    roleCategory,
    competencyIds: Object.entries(scoreMap)
      .sort(([, a], [, b]) => b - a)
      .slice(0, topN)
      .map(([id]) => id),
  };
}

// ── 6. BUILD PROMPT CONTEXT ───────────────────────────────────────────────────
// Inject chỉ các competency được detect vào system prompt (tiết kiệm token)

export function buildCompetencyPromptBlock(competencyIds) {
  const blocks = competencyIds
    .map(id => COMPETENCY_LIBRARY[id])
    .filter(Boolean)
    .map(c => `### ${c.nameVi}  [${c.shrm} | ${c.ddi}]
Định nghĩa: ${c.definition}

DDI Key Actions (những hành vi cần tìm trong câu trả lời):
${c.ddiKeyActions.map(a => `  • ${a}`).join("\n")}

STAR Rubric — Câu trả lời xuất sắc:
  "${c.starRubric.excellent}"`);

  return blocks.join("\n\n");
}

// ── 7. COMPETENCY DISTRIBUTION GUIDE FOR QUESTION GENERATION ─────────────────
// Hướng dẫn LLM phân phối câu hỏi theo competency và layer

export function buildDistributionGuide(competencyIds) {
  const comps = competencyIds.map(id => COMPETENCY_LIBRARY[id]).filter(Boolean);
  const lines = comps.map((c, i) => {
    const preferredLayer = c.relevantLayers[0];
    return `  Q${i + 1}: nhắm vào "${c.nameVi}" — layer ưu tiên: ${preferredLayer}`;
  });
  // Đảm bảo luôn có ít nhất 2 behavior trong 5 câu
  return lines.join("\n");
}
