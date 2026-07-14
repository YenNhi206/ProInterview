/** Pure mappers — testable without Vite import.meta.env */

/** Bỏ từ khóa 1 ký tự (vd. "r") — tránh highlight sai trong PDF */
export function filterHighlightKeywords(list) {
  if (!list) return [];
  const arr = Array.isArray(list) ? list : [];
  return arr.map((k) => String(k ?? "").trim()).filter((k) => k.length >= 2);
}

/** Số lượt CV còn lại từ quota API (elite = không giới hạn). */
export function computeCvRemainingFromQuota(quota, planKey) {
  if (!quota) return 0;
  const limit = Number(quota.cvAnalysisLimit) || 3;
  const used = Number(quota.cvAnalysisUsed) || 0;
  return Math.max(0, limit - used);
}

function extractSkillFromTitle(title) {
  const m = String(title || "").match(/Bổ sung kỹ năng "(.+?)"/);
  return m ? m[1] : String(title || "").trim();
}

const NA_REASON = /^(n\/a|không áp dụng|not applicable|na)$/i;

function isNaReason(text) {
  const s = String(text ?? "").trim();
  return !s || NA_REASON.test(s);
}

/** Lý do cho gợi ý bổ sung kỹ năng — tránh "Không áp dụng" / N/A từ Python. */
export function formatSkillSuggestionReason(item, { mode = "jd" } = {}) {
  const reframe = String(item.reframe_tip ?? "").trim();
  const path = String(item.acquisition_path ?? "").trim();
  const effort = String(item.estimated_effort ?? "").trim();
  const skill = String(item.skill ?? "").trim();
  if (!isNaReason(reframe)) return reframe;
  if (path && !isNaReason(path)) return path;
  const parts = [];
  if (skill) {
    parts.push(
      mode === "field"
        ? `Chuẩn ngành cần kỹ năng «${skill}» nhưng CV chưa thể hiện rõ.`
        : `JD yêu cầu kỹ năng «${skill}» nhưng CV chưa thể hiện rõ.`,
    );
  }
  if (effort) parts.push(`Ước tính bổ sung: ${effort}.`);
  return (
    parts.join(" ") ||
    "Nên bổ sung vào mục Kỹ năng hoặc Kinh nghiệm để tăng điểm khớp."
  );
}

/** Chuẩn hoá lý do hiển thị trên UI (kể cả bản lưu lịch sử cũ). */
export function formatSuggestionDisplayReason(item, { mode = "jd" } = {}) {
  const r = String(item.reason ?? "").trim();
  if (!isNaReason(r)) return r;
  if (item.type === "add") {
    const skill = extractSkillFromTitle(item.title) || "kỹ năng này";
    return mode === "field"
      ? `CV chưa thể hiện «${skill}» theo chuẩn ngành — bổ sung giúp tăng điểm phù hợp.`
      : `CV chưa thể hiện «${skill}» mà JD yêu cầu — bổ sung giúp tăng điểm khớp từ khóa.`;
  }
  if (item.type === "remove") {
    return "Nội dung không liên quan tới yêu cầu tuyển dụng — nên rút gọn hoặc thay thế.";
  }
  return "Cải thiện bullet theo chuẩn STAR và nhúng từ khóa từ JD.";
}

function clampSaveText(value, maxLen) {
  const s = String(value ?? "");
  if (s.length <= maxLen) return s;
  return s.slice(0, maxLen);
}

/** Joi chỉ chấp nhận high | medium | low (Python có thể trả "High"). */
function normalizeSavePriority(priority) {
  const p = String(priority ?? "medium").trim().toLowerCase();
  if (p === "high" || p === "medium" || p === "low") return p;
  return "medium";
}

/** Python scorer trả 0–10; API MongoDB/DTO dùng 0–5. */
function normalizeDimensionScore(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  if (n > 5) return Math.min(5, Math.round((n / 10) * 5 * 10) / 10);
  return Math.min(5, Math.max(0, n));
}

export function mapAnalysisDocToHistoryItem(doc) {
  if (!doc) return null;
  const r = doc.result || {};
  const match = r.match || {};
  const mode =
    doc.mode === "field" || doc.mode === "jd"
      ? doc.mode
      : doc.jdFileName && String(doc.jdFileName).trim()
        ? "jd"
        : "field";

  return {
    analysisId: String(doc._id || doc.id || ""),
    mode,
    field: doc.field || r._ui?.field || null,
    company: doc.company || r._ui?.company || null,
    position: doc.position || r._ui?.position || null,
    cvFileName: doc.cvFileName || "cv",
    jdFileName: doc.jdFileName || null,
    matchScore: match.score ?? r.matchScore ?? r._ui?.matchScore ?? 0,
    matchedKeywords: match.matchedKeywords || r._ui?.matchedKeywords || [],
    missingKeywords: match.missingKeywords || r._ui?.missingKeywords || [],
    createdAt: doc.createdAt || new Date().toISOString(),
    hasCvFile: !!(doc.cvFileName || doc.cvFileUrl),
    hasJdFile: !!(doc.jdFileName || doc.jdText),
    cvStoragePath: r._ui?.cvStoragePath || null,
    jdStoragePath: r._ui?.jdStoragePath || null,
  };
}

/** Suy ra mảng suggestions phẳng (UI card shape) từ result.suggestions (dạng lưu DB: rewrittenBullets/missingSkillSuggestions). */
function deriveSuggestionsFromResult(r, isField) {
  const sugg = r.suggestions || {};

  const bulletSuggestions = (sugg.rewrittenBullets || []).map((b) => ({
    type: "fix",
    priority: "medium",
    title: `Cải thiện bullet: "${String(b.original ?? "").slice(0, 65)}${String(b.original ?? "").length > 65 ? "…" : ""}"`,
    reason: b.reasoning || b.changes_made?.join?.(" · ") || "",
    before: b.original ?? "",
    after: b.rewritten ?? "",
    keywordsAdded: b.keywords_added || [],
    starCheck: b.star_check || b.starElements || {},
    confidence: b.confidence ?? "medium",
  }));

  const missSuggestions = (sugg.missingSkillSuggestions || []).map((item) => ({
    type: "add",
    priority: item.priority || "medium",
    title: `Bổ sung kỹ năng "${item.skill}"`,
    reason: formatSkillSuggestionReason(item, { mode: isField ? "field" : "jd" }),
    before: `Chưa có trong CV${item.estimatedTimeWeeks ? ` — ước tính ${item.estimatedTimeWeeks} tuần` : ""}`,
    after:
      item.resources?.[0] ||
      item.acquisition_path ||
      (item.skill ? `Bổ sung «${item.skill}» vào mục Kỹ năng hoặc mô tả dự án.` : ""),
    keywordsAdded: [],
    starCheck: {},
    confidence: null,
  }));

  return [...bulletSuggestions, ...missSuggestions];
}

export function mapAnalysisDocToUiResult(doc) {
  if (!doc) return null;
  const r = doc.result || {};
  const ui = r._ui;
  if (ui && typeof ui === "object") {
    const hasSnapshot =
      Array.isArray(ui.matchedKeywords) ||
      Array.isArray(ui.suggestions) ||
      ui.summary ||
      ui.scores;
    if (hasSnapshot) {
      // _ui.suggestions có thể thiếu (vd. bản ghi tạo qua import hàng loạt, không đi qua
      // luồng CVAnalysis.jsx build _ui đầy đủ) — suy ra từ result.suggestions thay vì demo.
      const uiSuggestions =
        Array.isArray(ui.suggestions) && ui.suggestions.length > 0
          ? ui.suggestions
          : deriveSuggestionsFromResult(r, doc.mode === "field");
      return {
        ...ui,
        suggestions: uiSuggestions,
        cvFileUrl: ui.cvFileUrl ?? doc.cvFileUrl ?? null,
        jdFileUrl: ui.jdFileUrl ?? doc.jdFileUrl ?? null,
        matchScore: ui.matchScore ?? r.matchScore ?? r.match?.score ?? 0,
        overallScore:
          ui.overallScore ??
          (ui.scores
            ? Math.round(
                ((Number(ui.scores.clarity) +
                  Number(ui.scores.structure) +
                  Number(ui.scores.relevance) +
                  Number(ui.scores.credibility)) /
                  4) *
                  10,
              )
            : ui.matchScore ?? 0),
        cvText: ui.cvText ?? doc.cvText ?? "",
        jdText: ui.jdText ?? doc.jdText ?? "",
        field: ui.field ?? doc.field ?? null,
        company: ui.company ?? doc.company ?? null,
        position: ui.position ?? doc.position ?? null,
      };
    }
  }

  const match = r.match || {};
  const matched = match.matchedKeywords || r.matchStrengths || [];
  const missing = match.missingKeywords || r.areasToImprove || [];
  const scores = r.scores || null;
  const sugg = r.suggestions || {};

  const isField = doc.mode === "field";
  const strengths =
    matched.length > 0
      ? matched.slice(0, 8).map((sk) =>
          isField
            ? `Có kỹ năng "${sk}" phù hợp với ngành`
            : `Có kỹ năng "${sk}" phù hợp với yêu cầu JD`
        )
      : r.matchStrengths || r.topStrengths || [];

  const weaknesses =
    missing.length > 0
      ? missing.slice(0, 8).map((sk) =>
          isField
            ? `Thiếu kỹ năng "${sk}" so với chuẩn ngành`
            : `Thiếu kỹ năng "${sk}" mà JD yêu cầu`
        )
      : r.matchWeaknesses || r.areasToImprove || [];

  return {
    matchScore: match.score ?? r.matchScore ?? 0,
    overallScore: scores
      ? Math.round(
          ((Number(scores.clarity) + Number(scores.structure) + Number(scores.relevance) + Number(scores.credibility)) /
            4) *
            10,
        )
      : match.score ?? 0,
    totalKeywords: matched.length + missing.length,
    matchedKeywords: matched,
    missingKeywords: missing,
    scores: scores
      ? {
          clarity: normalizeDimensionScore(scores.clarity) * 2,
          structure: normalizeDimensionScore(scores.structure) * 2,
          relevance: normalizeDimensionScore(scores.relevance) * 2,
          credibility: normalizeDimensionScore(scores.credibility) * 2,
        }
      : {},
    scoreNotes: {},
    strengths,
    weaknesses,
    suggestions: deriveSuggestionsFromResult(r, isField),
    summary: sugg.executiveSummary || r.overallSummary || "",
    cvText: doc.cvText || "",
    jdText: doc.jdText || "",
  };
}

/** Map response Python (/analyze/*) → object analysis cho UI */
export function mapPythonCvPipelineToAnalysis(raw, { usedFallback = false, field = null } = {}) {
  const m = raw.match ?? {};
  const s = raw.scores ?? null;
  const sugg = raw.suggestions ?? {};
  const isSemantic = Boolean(m._semantic);

  const matchedSkills = m.matching ?? [];
  const missingSkills = m.missing ?? [];
  const transferable = m._transferable ?? [];

  // Semantic: dùng evidence cụ thể thay vì chỉ tên kỹ năng
  const strengths = isSemantic && (m._matched_details?.length ?? 0) > 0
    ? m._matched_details.slice(0, 6).map((d) =>
        d.match_type === "implicit"
          ? `${d.requirement}: ${d.evidence ?? "có trong CV (suy luận)"}`
          : d.match_type === "transferable"
            ? `${d.requirement}: có kỹ năng tương đương (${d.evidence ?? "chuyển đổi"})`
            : d.evidence
              ? `${d.requirement}: ${d.evidence}`
              : `Đáp ứng yêu cầu "${d.requirement}"`
      )
    : sugg.strengths ??
      matchedSkills.slice(0, 6).map((sk) => `Có kỹ năng "${sk}" phù hợp với yêu cầu`);

  const weaknesses = isSemantic && (m._missing_details?.length ?? 0) > 0
    ? m._missing_details.slice(0, 6).map((d) =>
        d.importance === "critical"
          ? `[Bắt buộc] Thiếu "${d.requirement}"`
          : `Thiếu "${d.requirement}"`
      )
    : sugg.weaknesses ??
      missingSkills.slice(0, 6).map((sk) => `Thiếu kỹ năng "${sk}" cần bổ sung`);

  const missingDetails = isSemantic
    ? (m._missing_details ?? []).map((d) => ({
        requirement: d.requirement,
        importance:  d.importance ?? "important",
        skillType:   d.skill_type ?? "market_standard",
        gapSize:     d.gap_size ?? "medium",
      }))
    : [];

  const bulletSuggestions = (sugg.rewritten_bullets ?? []).map((b) => ({
    type: "fix",
    priority: b.confidence === "high" ? "high" : b.confidence === "low" ? "low" : "medium",
    title: `Cải thiện bullet: "${(b.original ?? "").slice(0, 65)}${(b.original ?? "").length > 65 ? "…" : ""}"`,
    reason: b.changes_made?.length ? b.changes_made.join(" · ") : "Viết lại theo chuẩn STAR.",
    before: b.original ?? "",
    after: b.rewritten ?? "",
    keywordsAdded: b.keywords_added ?? [],
    starCheck: b.star_check ?? {},
    confidence: b.confidence ?? "medium",
  }));

  const missSuggestions = (sugg.missing_skill_suggestions ?? []).map((item) => ({
    type: "add",
    priority: item.priority,
    title: `Bổ sung kỹ năng "${item.skill}"`,
    reason: formatSkillSuggestionReason(item, {
      mode: field ? "field" : "jd",
    }),
    before: `Chưa có trong CV — ước tính ${item.estimated_effort ?? "chưa rõ"}`,
    after:
      item.acquisition_path && !isNaReason(item.acquisition_path)
        ? item.acquisition_path
        : item.skill
          ? `Bổ sung «${item.skill}» vào mục Kỹ năng hoặc mô tả kinh nghiệm.`
          : "",
    keywordsAdded: [],
    starCheck: {},
    confidence: null,
  }));

  const jdTotal = m.summary?.jd_total ?? matchedSkills.length + missingSkills.length;

  // Build time-estimate lookup from missing_skill_suggestions keyed by lowercase skill name
  const missTimeMap = {};
  for (const item of sugg.missing_skill_suggestions ?? []) {
    if (item.skill && item.estimated_effort) {
      missTimeMap[item.skill.toLowerCase()] = item.estimated_effort;
    }
  }
  const missingKwsWithTime = missingSkills.map((kw) => ({
    kw,
    time: missTimeMap[kw.toLowerCase()] ?? null,
  }));

  return {
    matchScore: Math.round(m.match_score ?? 0),
    overallScore: Math.round((s?.overall ?? 0) * 10),
    totalKeywords: m.summary?.jd_total ?? jdTotal,
    matchedKeywords: matchedSkills,
    missingKeywords: missingSkills,
    missingKwsWithTime,
    scores: {
      clarity: s?.clarity?.score ?? 0,
      structure: s?.structure?.score ?? 0,
      relevance: s?.relevance?.score ?? Math.round((m.match_score ?? 0) / 10),
      credibility: s?.credibility?.score ?? 0,
    },
    scoreNotes: {
      clarity:
        s?.clarity?.reason ??
        (usedFallback ? "Phân tích cơ bản — không có điểm AI chi tiết." : ""),
      structure:
        s?.structure?.reason ??
        (usedFallback ? "Phân tích cơ bản — không có điểm AI chi tiết." : ""),
      relevance:
        s?.relevance?.reason ??
        (usedFallback ? `Ước tính từ kỹ năng ngành: ${Math.round(m.match_score ?? 0)}%` : ""),
      credibility:
        s?.credibility?.reason ??
        (usedFallback ? "Phân tích cơ bản — không có điểm AI chi tiết." : ""),
    },
    strengths,
    weaknesses,
    missingDetails,
    suggestions: [...bulletSuggestions, ...missSuggestions],
    summary: m._overall_assessment || sugg.executive_summary || s?.summary || "",
    cvText: raw.resume_text ?? "",
    jdText: raw.jd_text ?? "",
    position: raw.position ?? null,
    company: null,
    field: field ?? raw.field ?? null,
    transferableSkills: transferable.map((t) => ({
      requirement: t.requirement ?? "",
      existingSkill: t.existing_skill ?? "",
      estimatedTime: t.estimated_time ?? "",
    })),
    isSemantic,
  };
}

const SAVE_META_LLM = new Set([
  "groq",
  "gemini",
  "openai",
  "ollama",
  "deepseek",
  "glm",
  "unknown",
  "mock",
]);
const SAVE_META_ENDPOINTS = new Set([
  "/analyze",
  "/analyze/full",
  "/analyze/suggestions",
  "/analyze/field",
]);

function sanitizeSaveMeta(meta = {}) {
  const m = { llmProvider: "unknown", fallbackTriggered: false, ...meta };
  if (!SAVE_META_LLM.has(m.llmProvider)) m.llmProvider = "unknown";
  if (m.pythonEndpoint && !SAVE_META_ENDPOINTS.has(m.pythonEndpoint)) {
    delete m.pythonEndpoint;
  }
  return m;
}

/** Payload POST /api/cv/analyses — khớp cvAnalysis.dto.js */
export function buildCvAnalysisSavePayload({
  analysis,
  cvFileName,
  jdFileName,
  cvFileUrl = null,
  jdFileUrl = null,
  cvFileId = null,
  jdFileId = null,
  analyzeMode,
  tier = "suggestions",
  planAtTime = "free",
  meta = {},
}) {
  const matched = analysis.matchedKeywords || [];
  const missing = analysis.missingKeywords || [];
  const fixItems = (analysis.suggestions || []).filter((s) => s.type === "fix");
  const addItems = (analysis.suggestions || []).filter((s) => s.type === "add");

  const mode = analyzeMode === "jd" ? "jd" : "field";
  const fieldLabel =
    mode === "field"
      ? String(analysis.field || "").trim() || "IT / Công nghệ"
      : "";

  const payload = {
    cvFileName: cvFileName || "cv.pdf",
    jdFileName: mode === "jd" ? jdFileName || "" : "",
    ...(cvFileUrl ? { cvFileUrl } : {}),
    ...(jdFileUrl ? { jdFileUrl } : {}),
    ...(cvFileId ? { cvFileId } : {}),
    ...(jdFileId ? { jdFileId } : {}),
    mode,
    tier,
    planAtTime,
    meta: sanitizeSaveMeta(meta),
    result: {
      matchScore: Number(analysis.matchScore) || 0,
      matchedKeywords: matched,
      missingKeywords: missing,
      skills: {
        cv: matched.map((name) => ({ name: String(name) })),
        jd: [...matched, ...missing].map((name) => ({ name: String(name) })),
        matched,
        missing,
      },
    },
  };

  if (mode === "field") {
    payload.field = fieldLabel;
  }
  if (analysis.position) {
    payload.position = String(analysis.position);
  }

  if (tier === "full" || tier === "suggestions") {
    const sc = analysis.scores || {};
    payload.result.scores = {
      clarity: normalizeDimensionScore(sc.clarity),
      structure: normalizeDimensionScore(sc.structure),
      relevance: normalizeDimensionScore(sc.relevance),
      credibility: normalizeDimensionScore(sc.credibility),
    };
  }

  if (tier === "suggestions") {
    payload.result.suggestions = {
      rewrittenBullets: fixItems
        .map((s) => {
          const original = clampSaveText(s.before || "", 2000).trim();
          const rewritten = clampSaveText(s.after || "", 2000).trim();
          if (!original || !rewritten) return null;
          return {
            original,
            rewritten,
            reasoning: clampSaveText(s.reason || "", 1000),
            starElements: {
              situation: !!s.starCheck?.situation,
              task: !!s.starCheck?.task,
              action: !!s.starCheck?.action,
              result: !!s.starCheck?.result,
            },
          };
        })
        .filter(Boolean),
      missingSkillSuggestions: addItems
        .map((s) => {
          const skill = clampSaveText(extractSkillFromTitle(s.title), 100);
          if (!skill) return null;
          return {
            skill,
            priority: normalizeSavePriority(s.priority),
            reason: clampSaveText(s.reason || "", 500),
            resources: s.after ? [clampSaveText(String(s.after), 500)] : [],
          };
        })
        .filter(Boolean),
      executiveSummary: clampSaveText(analysis.summary || "", 5000),
    };
  }

  payload.result._ui = {
    matchScore: analysis.matchScore,
    matchedKeywords: matched,
    missingKeywords: missing,
    scores: analysis.scores,
    scoreNotes: analysis.scoreNotes,
    strengths: analysis.strengths,
    weaknesses: analysis.weaknesses,
    suggestions: analysis.suggestions,
    summary: clampSaveText(analysis.summary || "", 5000),
    cvText: clampSaveText(analysis.cvText || "", 120_000),
    jdText: clampSaveText(analysis.jdText || "", 120_000),
    position: analysis.position ?? null,
    company: analysis.company ?? null,
    mode,
    field: mode === "field" ? fieldLabel : analysis.field ?? null,
    jdFileName: payload.jdFileName,
    cvFileName: payload.cvFileName,
    cvFileUrl: cvFileUrl || null,
    jdFileUrl: jdFileUrl || null,
  };

  return payload;
}
