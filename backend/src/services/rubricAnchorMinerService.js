/**
 * Nguồn đề xuất thứ hai của Learning from Reviews: ví dụ neo từ rubric công ty (AI-18, REQ AIS-06,
 * quyết định AI-18 ngày 23/11/2026, DESIGN.md mục 6 bước 2).
 *
 * 1. Gom tiêu chí của rubric `approved` theo `shrmKey`, chỉ lấy công ty `active` đã đồng ý điều khoản
 *    dùng rubric ẩn danh (`Company.rubricSharingConsent.acceptedAt`, CO-02).
 * 2. Key có tiêu chí từ ≥ 3 công ty khác nhau → LLM (`rubric_anchor`) tóm tắt ví dụ neo cho từng mức
 *    0–5. Tên, slug, tên miền công ty bị thay bằng "Nguồn A/B/C" trước khi gửi LLM, và bị xóa lần nữa
 *    khỏi kết quả (LLM có thể chép lại).
 * 3. Tạo PromptVersion mới cho prompt chấm `evaluation` (chưa bật) = bản active + 1 ví dụ neo cho key đó
 *    (thay ví dụ neo cũ cùng key), và 1 `AIImprovementProposal` kind `rubric_anchor`.
 *    Backtest AI-01 (AI-04) chạy sau; độ lệch tăng thì đề xuất bị loại tự động (`aiImprovementBacktestService`).
 *    Platform Mod duyệt hoặc rollback như AI-05.
 *
 * Nguồn học là NỘI DUNG rubric: không dùng điểm rubric (JB-07) hay quyết định shortlist. Không sửa bảng
 * 6 mức LP-01; rubric công ty vẫn chỉ chấm câu của công ty đó.
 * Không tạo lại khi đã có đề xuất `proposed` cho key, hoặc đề xuất gần nhất của key dùng đúng bộ rubric
 * hiện tại (kể cả đã bị từ chối) — chỉ tạo mới khi có rubric được duyệt thêm hoặc thay bản.
 */
import { AIImprovementProposal } from "../models/AIImprovementProposal.js";
import { Company } from "../models/Company.js";
import { CompanyRubric } from "../models/CompanyRubric.js";
import { PromptVersion } from "../models/PromptVersion.js";
import { EVALUATION_KEY } from "../prompts/evaluationPrompt.js";
import { RUBRIC_ANCHOR_KEY, buildRubricAnchorPrompt } from "../prompts/rubricAnchorPrompt.js";
import { createVersion, getActivePrompt } from "./promptVersionService.js";
import { getCompetency, getFramework, isValidCompetencyKey } from "./competencyFramework.js";
import { ANCHOR_NOTE_PREFIX, mergeFewShotExamples } from "../utils/fewShotMerge.js";
import { logger } from "../config/logger.js";

export const MIN_ANCHOR_COMPANIES = 3;
export const ANCHOR_LEVELS = [0, 1, 2, 3, 4, 5];
export const REDACTED = "[doanh nghiệp]";
const TEXT_LIMIT = 600;
const EXAMPLE_LIMIT = 400;

const clip = (s, n = TEXT_LIMIT) => {
  const t = String(s ?? "").replace(/\s+/g, " ").trim();
  return t.length > n ? `${t.slice(0, n)}…` : t;
};

// ── Ẩn danh ─────────────────────────────────────────────────────────────────────────────────────

const stripAccents = (s) => String(s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/g, "d").replace(/Đ/g, "D");
const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Chuỗi nhận diện một công ty: tên, slug (cả dạng có dấu cách), tên miền website. Bỏ chuỗi < 3 ký tự. */
export function companyIdentifiers(company) {
  const out = new Set();
  const add = (v) => {
    const t = String(v ?? "").trim();
    if (t.length >= 3) out.add(t);
  };
  add(company?.name);
  add(company?.slug);
  add(String(company?.slug ?? "").replace(/[-_]+/g, " "));
  const site = String(company?.website ?? "").trim();
  if (site) {
    try {
      const host = new URL(/^https?:\/\//i.test(site) ? site : `https://${site}`).hostname.replace(/^www\./, "");
      add(host);
      add(host.split(".")[0]);
    } catch {
      /* website lỗi định dạng → bỏ */
    }
  }
  return [...out].sort((a, b) => b.length - a.length);
}

/**
 * Thay mọi chuỗi nhận diện (không phân biệt hoa thường, có dấu hay không dấu) bằng `replacement`.
 * So trên bản bỏ dấu nhưng thay trên văn bản gốc (cùng độ dài ký tự sau NFC).
 * @returns {{ text: string, count: number }}
 */
export function redactIdentifiers(text, identifiers, replacement = REDACTED) {
  let src = String(text ?? "").normalize("NFC");
  let count = 0;
  for (const id of identifiers) {
    const re = new RegExp(`(?<![\\p{L}\\p{N}])${escapeRe(stripAccents(id).toLowerCase())}(?![\\p{L}\\p{N}])`, "giu");
    let folded = stripAccents(src).toLowerCase();
    if (folded.length !== src.length) {
      // Bỏ dấu đổi độ dài (ký tự tổ hợp lạ) → so trực tiếp, không bỏ dấu.
      const direct = new RegExp(`(?<![\\p{L}\\p{N}])${escapeRe(id)}(?![\\p{L}\\p{N}])`, "giu");
      src = src.replace(direct, () => { count += 1; return replacement; });
      continue;
    }
    let out = "";
    let last = 0;
    for (const m of folded.matchAll(re)) {
      out += src.slice(last, m.index) + replacement;
      last = m.index + m[0].length;
      count += 1;
    }
    src = out + src.slice(last);
    folded = stripAccents(src).toLowerCase();
  }
  return { text: src, count };
}

/** Văn bản còn chứa chuỗi nhận diện nào không (kiểm lại sau khi xóa). */
export function containsIdentifier(text, identifiers) {
  const folded = stripAccents(text).toLowerCase();
  return identifiers.some((id) =>
    new RegExp(`(?<![\\p{L}\\p{N}])${escapeRe(stripAccents(id).toLowerCase())}(?![\\p{L}\\p{N}])`, "iu").test(folded));
}

// ── Gom nguồn ───────────────────────────────────────────────────────────────────────────────────

/**
 * @returns {Promise<Map<string, { companies: Map<string, { company: object, criteria: object[] }>, rubricIds: Set<string>, roleCategories: Set<string> }>>}
 */
export async function collectAnchorGroups() {
  const companies = await Company.find({ status: "active", "rubricSharingConsent.acceptedAt": { $ne: null } })
    .select("name slug website")
    .lean();
  if (!companies.length) return new Map();
  const byCompany = new Map(companies.map((c) => [String(c._id), c]));
  const rubrics = await CompanyRubric.find({ status: "approved", companyId: { $in: companies.map((c) => c._id) } })
    .select("companyId roleCategory criteria")
    .lean();

  const groups = new Map();
  for (const rubric of rubrics) {
    const company = byCompany.get(String(rubric.companyId));
    if (!company) continue;
    for (const c of rubric.criteria ?? []) {
      const key = String(c.shrmKey ?? "").trim();
      if (!isValidCompetencyKey(key)) continue;
      if (!groups.has(key)) groups.set(key, { companies: new Map(), rubricIds: new Set(), roleCategories: new Set() });
      const g = groups.get(key);
      const cid = String(company._id);
      if (!g.companies.has(cid)) g.companies.set(cid, { company, criteria: [] });
      g.companies.get(cid).criteria.push({
        rubricId: rubric._id,
        roleCategory: rubric.roleCategory,
        name: c.name,
        description: c.description,
        levels: c.levels instanceof Map ? Object.fromEntries(c.levels) : (c.levels ?? {}),
      });
      g.rubricIds.add(String(rubric._id));
      g.roleCategories.add(rubric.roleCategory);
    }
  }
  return groups;
}

const sourceLabel = (i) => `Nguồn ${String.fromCharCode(65 + (i % 26))}${i >= 26 ? Math.floor(i / 26) : ""}`;

/** Văn bản nguồn đã ẩn danh gửi LLM + danh sách chuỗi nhận diện của mọi công ty trong nhóm. */
export function buildAnchorSources(group) {
  const entries = [...group.companies.values()];
  const identifiers = [...new Set(entries.flatMap((e) => companyIdentifiers(e.company)))].sort((a, b) => b.length - a.length);
  let redactedInInput = 0;
  const blocks = entries.map((entry, i) => {
    const lines = entry.criteria.map((c) => {
      const levels = ANCHOR_LEVELS
        .filter((l) => c.levels?.[l] ?? c.levels?.[String(l)])
        .map((l) => `  - Mức ${l}: ${clip(c.levels[l] ?? c.levels[String(l)], 300)}`)
        .join("\n");
      return [`- Tiêu chí: ${clip(c.name, 200)}`, c.description ? `  Mô tả: ${clip(c.description)}` : "", levels].filter(Boolean).join("\n");
    });
    const { text, count } = redactIdentifiers(`${sourceLabel(i)}\n${lines.join("\n")}`, identifiers);
    redactedInInput += count;
    return text;
  });
  return { text: blocks.join("\n\n"), identifiers, redactedInInput };
}

// ── LLM ─────────────────────────────────────────────────────────────────────────────────────────

function levelsText() {
  return getFramework().levels.map((l) => `- Mức ${l.score} (${l.label}): ${l.descriptor}`).join("\n");
}

/** Gọi LLM thật. Thiếu cấu hình → lỗi `code: "llm_not_configured"`. */
export async function defaultSummarize({ competency, sources }) {
  const { callLLM, extractJson, isLLMConfigured } = await import("./interviewQuestionService.js");
  if (!isLLMConfigured()) {
    const err = new Error("LLM chưa được cấu hình.");
    err.code = "llm_not_configured";
    throw err;
  }
  const prompt = await getActivePrompt(RUBRIC_ANCHOR_KEY);
  const built = buildRubricAnchorPrompt(prompt, { competency, levels: levelsText(), sources });
  const opts = { maxTokens: 1500, temp: 0.2, retries: 1, traceName: "rubric_anchor" };
  let raw = await callLLM(built.system, built.user, opts);
  let parsed;
  try {
    parsed = JSON.parse(extractJson(raw));
  } catch {
    raw = await callLLM(built.jsonRepair, raw, { ...opts, temp: 0, retries: 0, traceName: "rubric_anchor_json_repair" });
    parsed = JSON.parse(extractJson(raw));
  }
  return { anchors: parsed?.anchors, promptVersion: prompt.version };
}

/** Đủ 6 mức 0–5, mỗi mức có chữ → [{ level, example }] theo thứ tự; thiếu thì null. */
export function normalizeAnchors(anchors) {
  if (!Array.isArray(anchors)) return null;
  const byLevel = new Map();
  for (const a of anchors) {
    const level = Number(a?.level);
    const example = clip(a?.example, EXAMPLE_LIMIT);
    if (ANCHOR_LEVELS.includes(level) && example && !byLevel.has(level)) byLevel.set(level, example);
  }
  if (byLevel.size !== ANCHOR_LEVELS.length) return null;
  return ANCHOR_LEVELS.map((level) => ({ level, example: byLevel.get(level) }));
}

/** Ví dụ neo dạng few-shot của PromptVersion `evaluation`. */
export function anchorFewShotExample({ shrmKey, companyCount, anchors }) {
  const c = getCompetency(shrmKey);
  return {
    input: `Ví dụ neo cho năng lực "${c?.nameVi ?? shrmKey}" (${shrmKey}), tổng hợp ẩn danh từ rubric đã duyệt của ${companyCount} doanh nghiệp. Dùng để định vị điểm overall (0–5) của câu trả lời thuộc năng lực này; không thay bảng mức của nền tảng.`,
    output: anchors.map((a) => `Mức ${a.level}: ${a.example}`).join("\n"),
    note: `${ANCHOR_NOTE_PREFIX}${shrmKey}`,
  };
}

// ── Tạo đề xuất ─────────────────────────────────────────────────────────────────────────────────

const sameSet = (a, b) => a.length === b.length && a.every((x, i) => x === b[i]);

async function createAnchorProposal({ shrmKey, group, summarize }) {
  const { text: sources, identifiers, redactedInInput } = buildAnchorSources(group);
  const competency = `${getCompetency(shrmKey)?.nameVi ?? shrmKey} (${shrmKey}) — ${getCompetency(shrmKey)?.definition ?? ""}`;
  const result = await summarize({ shrmKey, competency, sources });

  let redactedInOutput = 0;
  const cleaned = (Array.isArray(result?.anchors) ? result.anchors : []).map((a) => {
    const { text, count } = redactIdentifiers(a?.example, identifiers);
    redactedInOutput += count;
    return { level: a?.level, example: text };
  });
  const anchors = normalizeAnchors(cleaned);
  if (!anchors) throw new Error("LLM không trả đủ ví dụ neo cho 6 mức 0–5.");
  if (anchors.some((a) => containsIdentifier(a.example, identifiers))) {
    throw new Error("Ví dụ neo vẫn còn thông tin nhận diện doanh nghiệp.");
  }

  const companyCount = group.companies.size;
  const rubricIds = [...group.rubricIds].sort();
  const base = await getActivePrompt(EVALUATION_KEY);
  const example = anchorFewShotExample({ shrmKey, companyCount, anchors });
  const merged = mergeFewShotExamples(base.fewShotExamples, [example]);
  const version = await createVersion(EVALUATION_KEY, {
    baseVersion: base.source === "db" ? base.version : null,
    fewShotExamples: merged,
    note: `AI-18: ví dụ neo ${shrmKey} từ rubric ${companyCount} doanh nghiệp`,
  });

  try {
    const proposal = await AIImprovementProposal.create({
      target: "evaluation",
      kind: "rubric_anchor",
      groupKey: shrmKey,
      summary:
        `${companyCount} doanh nghiệp đã đồng ý điều khoản có rubric đã duyệt cho năng lực "${getCompetency(shrmKey)?.nameVi ?? shrmKey}". ` +
        "Đề xuất thêm ví dụ neo 0–5 (ẩn danh) vào prompt chấm điểm.",
      evidence: {
        moderationItemIds: [],
        overrideCount: 0,
        shrmKey,
        companyCount,
        rubricIds,
        roleCategories: [...group.roleCategories].sort(),
        anchorPromptVersion: result?.promptVersion ?? "",
        redactedInInput,
        redactedInOutput,
      },
      before: { promptKey: EVALUATION_KEY, version: base.version, fewShotExamples: base.fewShotExamples ?? [] },
      after: { promptKey: EVALUATION_KEY, version: version.version, fewShotExamples: merged },
    });
    return proposal.toObject();
  } catch (err) {
    await PromptVersion.deleteOne({ _id: version._id, active: false }).catch(() => {});
    if (err?.code === 11000) return null;
    throw err;
  }
}

/**
 * Một lượt đào ví dụ neo. Gọi từ `mineImprovementProposals` (AI-03 job) hoặc test.
 * @param {{ summarize?: Function, minCompanies?: number }} [opts]  `summarize`: thay LLM (test)
 * @returns {Promise<{ created: object[], skipped: { target: string, groupKey: string, reason: string }[] }>}
 */
export async function mineRubricAnchorProposals({ summarize = defaultSummarize, minCompanies = MIN_ANCHOR_COMPANIES } = {}) {
  const groups = await collectAnchorGroups();
  const created = [];
  const skipped = [];
  const skip = (groupKey, reason) => skipped.push({ target: "evaluation", kind: "rubric_anchor", groupKey, reason });

  for (const [shrmKey, group] of groups) {
    if (group.companies.size < minCompanies) continue;
    const open = await AIImprovementProposal.exists({ target: "evaluation", kind: "rubric_anchor", groupKey: shrmKey, status: "proposed" });
    if (open) {
      skip(shrmKey, "open_proposal");
      continue;
    }
    const last = await AIImprovementProposal.findOne({ target: "evaluation", kind: "rubric_anchor", groupKey: shrmKey })
      .sort({ createdAt: -1, _id: -1 })
      .select("evidence.rubricIds")
      .lean();
    const current = [...group.rubricIds].sort();
    if (last && sameSet((last.evidence?.rubricIds ?? []).map(String).sort(), current)) {
      skip(shrmKey, "unchanged");
      continue;
    }
    try {
      const proposal = await createAnchorProposal({ shrmKey, group, summarize });
      if (proposal) created.push(proposal);
      else skip(shrmKey, "concurrent");
    } catch (err) {
      if (err?.code === "llm_not_configured") {
        skip(shrmKey, "llm_not_configured");
        continue;
      }
      logger.error("rubric_anchor_group_failed", { shrmKey, error: err?.message });
      skip(shrmKey, "error");
    }
  }
  return { created, skipped };
}
