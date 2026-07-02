"""
suggester.py — Gợi ý chỉnh sửa CV theo STAR + JD keywords.

Gồm 3 tầng:
  1. rewrite_bullets()          — viết lại từng bullet theo STAR + embed JD keyword
  2. suggest_missing_skills()   — reframe tips + learning path cho missing skills
  3. generate_summary()         — executive summary tổng hợp

Dùng cloud LLM (Groq/Gemini/OpenAI) nếu LLM_API_KEY set trong env,
fallback về Ollama local nếu không có key.
"""

from __future__ import annotations
import json
import re
from typing import Optional

from llm_client import call_llm, extract_json
from skill_taxonomy import enrich_missing_skills, build_taxonomy_context_for_prompt, infer_role_from_text

_SYSTEM_PROMPT = """Bạn là chuyên gia tư vấn CV/hồ sơ xin việc cho người Việt Nam. Bạn PHẢI trả lời bằng JSON hợp lệ duy nhất.
Không giải thích, không markdown, không code fence. Chỉ JSON object thuần.
Tất cả nội dung văn bản PHẢI viết bằng tiếng Việt tự nhiên, chuyên nghiệp."""


# ══════════════════════════════════════════════════════════════════════════════
# TẦNG 1 — BULLET REWRITER
# ══════════════════════════════════════════════════════════════════════════════

def _build_bullet_prompt(
    bullets: list[dict],
    missing_skills: list[str],
    scores: dict,
    jd_text: str,
) -> str:
    weak_dims = [
        k for k in ("clarity", "structure", "relevance", "credibility")
        if scores.get(k, {}).get("score", 10) < 6.0
    ]
    weakness_note = (
        f"Focus especially on fixing: {', '.join(weak_dims)}."
        if weak_dims else
        "All dimensions are decent; still improve STAR and keywords."
    )

    missing_str  = ", ".join(missing_skills[:15]) or "none"
    jd_snippet   = jd_text[:1200]
    # Cap bullets to avoid 413 Payload Too Large on Groq; trim fields to essentials
    slim_bullets = [
        {"id": b.get("id", ""), "original": b.get("original", "")[:300], "section": b.get("section", "")}
        for b in bullets[:20]
    ]
    bullets_json = json.dumps(slim_bullets, ensure_ascii=False)

    return f"""Bạn đang viết lại các bullet point trong CV để mạnh hơn và phù hợp với JD.

=== MÔ TẢ CÔNG VIỆC (1200 ký tự đầu) ===
{jd_snippet}

=== KỸ NĂNG CÒN THIẾU (có trong JD nhưng không có trong CV) ===
{missing_str}

=== BỐI CẢNH ĐIỂM SỐ ===
{weakness_note}

=== QUY TẮC ===
1. Theo chuẩn STAR: Động từ hành động → Tình huống/bối cảnh (ngắn gọn) → Kết quả đo lường được (số liệu/% nếu có)
2. Nhúng từ khóa từ JD một cách tự nhiên — KHÔNG ép từ khóa không liên quan
3. TUYỆT ĐỐI KHÔNG bịa đặt con số hoặc kinh nghiệm không có trong bản gốc
4. Nếu không biết kết quả, dùng cách diễn đạt như "góp phần cải thiện X"
5. Viết lại bằng tiếng Việt tự nhiên, chuyên nghiệp
6. Confidence = "high" nếu kết quả rõ ràng, "medium" nếu suy luận, "low" nếu bản gốc thiếu kết quả

=== CÁC BULLET CẦN VIẾT LẠI ===
{bullets_json}

Trả lời CHỈ với cấu trúc JSON (tất cả văn bản bằng tiếng Việt):
{{
  "rewritten_bullets": [
    {{
      "id": "<giữ nguyên id>",
      "original": "<bản gốc chính xác>",
      "rewritten": "<bản viết lại theo STAR + từ khóa JD, bằng tiếng Việt>",
      "changes_made": ["thay đổi 1", "thay đổi 2"],
      "star_check": {{"situation": true, "action": true, "result": true}},
      "keywords_added": ["từ_khóa1", "từ_khóa2"],
      "confidence": "high|medium|low"
    }}
  ]
}}"""


def rewrite_bullets(
    bullets: list[dict],
    missing_skills: list[str],
    scores: dict,
    jd_text: str,
    model: Optional[str] = None,
) -> dict:
    """Rewrite toàn bộ bullets trong 1 LLM call. Returns {"rewritten_bullets": [...]}"""
    if not bullets:
        return {"rewritten_bullets": []}

    prompt = _build_bullet_prompt(bullets, missing_skills, scores, jd_text)
    raw    = call_llm(_SYSTEM_PROMPT, prompt, max_tokens=4096, temperature=0.3,
                      ollama_model=model)
    result = extract_json(raw, fallback={"rewritten_bullets": []})

    for b in result.get("rewritten_bullets", []):
        b.setdefault("keywords_added", [])
        b.setdefault("changes_made",   [])
        b.setdefault("confidence",     "medium")
        b.setdefault("star_check",     {"situation": False, "action": True, "result": False})

    return result


# ══════════════════════════════════════════════════════════════════════════════
# TẦNG 2 — MISSING SKILLS SUGGESTER
# ══════════════════════════════════════════════════════════════════════════════

def _build_missing_prompt(
    missing_skills: list[str],
    cv_text: str,
    jd_text: str,
    taxonomy_context: str = "",
    inferred_role: str = "",
) -> str:
    cv_snippet  = cv_text[:1600]
    jd_snippet  = jd_text[:700]
    role_line   = f"Vai trò xác định từ JD: **{inferred_role}**\n" if inferred_role else ""

    taxonomy_section = ""
    if taxonomy_context:
        taxonomy_section = f"""
=== PHÂN TÍCH QUAN HỆ KỸ NĂNG (ESCO + O*NET) ===
{role_line}{taxonomy_context}

Chú thích:
  🔴 BẮT BUỘC   = JD yêu cầu cứng, ứng viên sẽ bị loại nếu thiếu
  🟡 QUAN TRỌNG = Tăng đáng kể cơ hội được chọn
  🟢 CÓ THÊM TỐT = Điểm cộng, không bắt buộc
  Dễ chuyển đổi  = Ứng viên đã có nền tảng liên quan — hãy ưu tiên tái diễn đạt
  Cần học từ đầu = Cần lộ trình học rõ ràng hơn
"""

    return f"""Bạn là chuyên gia tư vấn nghề nghiệp hàng đầu đang tư vấn cho ứng viên Việt Nam.
Nhiệm vụ: Đưa ra lời khuyên THỰC TẾ, CỤ THỂ để lấp đầy khoảng cách kỹ năng — không phải lời khuyên chung chung.
{taxonomy_section}
=== HỒ SƠ ỨNG VIÊN (trích 1600 ký tự) ===
{cv_snippet}

=== MÔ TẢ CÔNG VIỆC (trích 700 ký tự) ===
{jd_snippet}

=== KỸ NĂNG CÒN THIẾU CẦN XỬ LÝ ===
{json.dumps(missing_skills, ensure_ascii=False)}

Với MỖI kỹ năng còn thiếu, hãy cung cấp:

1. reframe_tip — Cách tái diễn đạt kinh nghiệm HIỆN CÓ trong CV để thể hiện một phần kỹ năng này.
   • Nếu phân tích ESCO cho thấy "Dễ chuyển đổi": bắt buộc phải viết reframe cụ thể dựa vào kinh nghiệm trong CV.
   • Ví dụ tốt: "Kinh nghiệm React của bạn (component lifecycle, state management) trực tiếp chuyển sang Vue — hãy thêm dòng 'Nền tảng JavaScript vững, có thể áp dụng vào Vue/Angular' vào phần kỹ năng."
   • Ví dụ xấu (KHÔNG dùng): "Không áp dụng" hoặc "Chưa có kinh nghiệm liên quan."
   • CHỈ ghi "Không áp dụng" khi thực sự không có BẤT KỲ kỹ năng liên quan nào trong CV.

2. acquisition_path — Lộ trình học NGẮN HẠN cụ thể nhất có thể.
   • Tên khóa học + nền tảng: "Khóa 'Docker for Developers' trên Udemy (8 giờ, dưới 300k)"
   • Hoặc dự án thực hành: "Containerize dự án Django hiện tại của bạn bằng Docker + docker-compose"
   • Hoặc chứng chỉ: "AWS Cloud Practitioner (CLF-C02) — ôn 2 tuần bằng Stephane Maarek trên Udemy"
   • KHÔNG viết: "Tìm hiểu thêm về X" hoặc "Tham gia các khóa học trực tuyến".

3. priority — Dựa vào phân tích O*NET ở trên:
   "high" nếu BẮT BUỘC theo O*NET hoặc JD dùng từ "required/bắt buộc/must"
   "medium" nếu QUAN TRỌNG theo O*NET hoặc JD dùng từ "preferred/ưu tiên"
   "low" nếu CÓ THÊM TỐT hoặc không đề cập rõ trong JD

4. estimated_effort — Thời gian thực tế để đạt mức "đủ dùng trong công việc":
   "1 tuần" | "2 tuần" | "1 tháng" | "3 tháng" | "6+ tháng"

Trả lời CHỈ với JSON (tất cả văn bản bằng tiếng Việt tự nhiên):
{{
  "missing_skill_suggestions": [
    {{
      "skill": "<tên kỹ năng>",
      "reframe_tip": "<lời khuyên cụ thể hoặc 'Không áp dụng'>",
      "acquisition_path": "<lộ trình học cụ thể với tên khóa/dự án>",
      "priority": "high|medium|low",
      "estimated_effort": "<thời gian thực tế>"
    }}
  ]
}}"""


def suggest_missing_skills(
    missing_skills: list[str],
    cv_text: str,
    jd_text: str,
    candidate_skills: list[str] | None = None,
    model: Optional[str] = None,
) -> dict:
    """
    Returns {"missing_skill_suggestions": [...]}.
    candidate_skills: danh sách kỹ năng ứng viên đã có (từ matching) — dùng cho ESCO transfer analysis.
    """
    if not missing_skills:
        return {"missing_skill_suggestions": []}

    # Cap ở nguồn: backend Joi validate missingSkillSuggestions max(20) khi lưu lịch sử.
    # CV lệch JD nhiều có thể có 25+ missing skill — sinh gợi ý cho hết vừa tốn token vừa
    # khiến save lịch sử fail validation. Giữ 15 mục quan trọng nhất, chừa biên an toàn.
    missing_skills = missing_skills[:15]

    # ── ESCO + O*NET enrichment ────────────────────────────────────────────
    taxonomy_context = ""
    inferred_role    = ""
    if candidate_skills:
        inferred_role   = infer_role_from_text(jd_text) or ""
        enriched        = enrich_missing_skills(missing_skills, candidate_skills, jd_text, inferred_role or None)
        taxonomy_context = build_taxonomy_context_for_prompt(enriched)

    prompt = _build_missing_prompt(missing_skills, cv_text, jd_text, taxonomy_context, inferred_role)
    raw    = call_llm(_SYSTEM_PROMPT, prompt, max_tokens=4096, temperature=0.25,
                      ollama_model=model)
    return extract_json(raw, fallback={"missing_skill_suggestions": []})


# ══════════════════════════════════════════════════════════════════════════════
# TẦNG 3 — EXECUTIVE SUMMARY
# ══════════════════════════════════════════════════════════════════════════════

def _build_summary_prompt(
    matching: list[str],
    missing: list[str],
    scores: dict,
    rewritten_count: int,
) -> str:
    score_lines = "\n".join(
        f"  {k}: {v.get('score', 0)}/10 — {v.get('reason', '')}"
        for k, v in scores.items()
        if k in ("clarity", "structure", "relevance", "credibility")
    )
    total = len(matching) + len(missing)
    match_pct = round(len(matching) / total * 100) if total else 0

    return f"""Viết một nhận xét tổng quan ngắn gọn (3-4 câu) cho buổi đánh giá CV.

Tỷ lệ khớp kỹ năng: {match_pct}% ({len(matching)} khớp, {len(missing)} còn thiếu)
Số bullet đã viết lại: {rewritten_count}

Điểm số các tiêu chí:
{score_lines}

Kỹ năng phù hợp nhất: {', '.join(matching[:8])}
Kỹ năng thiếu quan trọng nhất: {', '.join(missing[:6])}

Quy tắc sáng tạo:
- Giọng văn: chuyên nghiệp, trung thực, khích lệ, sáng tạo và hấp dẫn (không máy móc).
- Nếu CV RẤT PHÙ HỢP (điểm cao, khớp nhiều): Đưa ra lời khuyên chuẩn bị phỏng vấn, deal lương hoặc cách thể hiện sự tự tin.
- Nếu CV CHƯA PHÙ HỢP (thiếu nhiều kỹ năng): Đưa ra lộ trình ngắn gọn để bổ sung kỹ năng, khích lệ ứng viên không nản chí.
- Đề cập tỷ lệ phù hợp tổng thể và phân tích nhanh 1 điểm mạnh, 1 điểm yếu.
- TUYỆT ĐỐI không dùng Markdown hay text thừa, chỉ xuất ra một JSON duy nhất.

Trả lời CHỈ với JSON này:
{{
  "summary": "nhận xét tổng quan 3-4 câu bằng tiếng Việt"
}}"""


def generate_summary(
    matching: list[str],
    missing: list[str],
    scores: dict,
    rewritten_count: int,
    model: Optional[str] = None,
) -> str:
    """Returns plain string summary."""
    prompt = _build_summary_prompt(matching, missing, scores, rewritten_count)
    # 1024 không đủ cho gemini-2.5-flash — thinking tokens ngốn hết budget trước khi
    # xuất JSON (cùng nguyên nhân đã sửa ở scorer.py). Khớp mức 4096 dùng ở các call khác
    # trong file này (dòng ~105, ~218) vốn đang chạy ổn định.
    raw    = call_llm(_SYSTEM_PROMPT, prompt, max_tokens=4096, temperature=0.3,
                      ollama_model=model)
    fallback_text = "Không thể tạo nhận xét chi tiết (hệ thống AI phản hồi không hợp lệ)."
    parsed = extract_json(raw, fallback={"summary": fallback_text})
    return parsed.get("summary", fallback_text)


# ══════════════════════════════════════════════════════════════════════════════
# MAIN ORCHESTRATOR — gọi từ main.py
# ══════════════════════════════════════════════════════════════════════════════

def generate_suggestions(
    cv_text:        str,
    jd_text:        str,
    cv_bullets:     list[dict],
    matching:       list[str],
    missing:        list[str],
    scores:         dict,
    model:          Optional[str] = None,
) -> dict:
    """
    Entry point chính — gọi từ FastAPI endpoint /analyze/suggestions.

    Returns:
        {
          "rewritten_bullets":         [...],
          "missing_skill_suggestions": [...],
          "executive_summary":         "..."
        }
    """
    print("  [suggester] Step 1/3 — Rewriting bullets...")
    bullets_result = rewrite_bullets(cv_bullets, missing, scores, jd_text, model)

    print("  [suggester] Step 2/3 — Generating missing skill suggestions (ESCO+O*NET enriched)...")
    missing_result = suggest_missing_skills(missing, cv_text, jd_text,
                                            candidate_skills=matching, model=model)

    rewritten_count = len(bullets_result.get("rewritten_bullets", []))
    print(f"  [suggester] Step 3/3 — Generating summary ({rewritten_count} bullets rewritten)...")
    summary = generate_summary(matching, missing, scores, rewritten_count, model)

    return {
        "rewritten_bullets":          bullets_result.get("rewritten_bullets", []),
        "missing_skill_suggestions":  missing_result.get("missing_skill_suggestions", []),
        "executive_summary":          summary,
    }


# ══════════════════════════════════════════════════════════════════════════════
# UTILITY — tự extract bullets nếu parser chưa trả về structured bullets
# ══════════════════════════════════════════════════════════════════════════════

def extract_bullets_from_text(cv_text: str) -> list[dict]:
    """
    Heuristic: tách các dòng bắt đầu bằng bullet char hoặc dash.
    Format trả về tương thích với rewrite_bullets().
    """
    bullets = []
    current_section = "Experience"

    section_keywords = {
        "experience": "Experience",
        "work":       "Experience",
        "employment": "Experience",
        "education":  "Education",
        "project":    "Projects",
        "skill":      "Skills",
        "certif":     "Certifications",
        "summary":    "Summary",
        "objective":  "Summary",
    }

    for i, line in enumerate(cv_text.splitlines()):
        line_stripped = line.strip()

        lower = line_stripped.lower()
        for kw, section in section_keywords.items():
            if kw in lower and len(line_stripped) < 40:
                current_section = section
                break

        is_bullet = (
            line_stripped.startswith(("•", "-", "–", "▪", "*", "◦"))
            or (len(line_stripped) > 20 and line.startswith("  ") and line_stripped[0].isupper())
        )

        if is_bullet and len(line_stripped) > 15:
            text = re.sub(r'^[•\-–▪\*◦]\s*', '', line_stripped)
            if text:
                bullets.append({
                    "id":             f"b{str(i).zfill(3)}",
                    "original":       text,
                    "section":        current_section,
                    "company":        "",
                    "matched_skills": [],
                })

    return bullets


# ══════════════════════════════════════════════════════════════════════════════
# CLI TEST
# ══════════════════════════════════════════════════════════════════════════════

if __name__ == "__main__":
    import sys
    from llm_client import check_llm_health

    health = check_llm_health()
    print(json.dumps(health, indent=2, ensure_ascii=False))
    if not health.get("running"):
        print("LLM không khả dụng. Set LLM_API_KEY hoặc chạy Ollama.")
        sys.exit(1)

    sample_cv = """
    Software Engineer at ABC Corp (2021–2024)
    • Built REST APIs for internal services using Python and Flask
    • Optimized slow database queries, reducing report generation time
    • Deployed new features to production monthly using manual process

    Junior Developer at XYZ Startup (2019–2021)
    • Wrote unit tests for frontend codebase in JavaScript
    • Participated in daily standups and sprint planning
    • Fixed bugs reported by QA team
    """

    sample_jd = """
    Senior Backend Engineer
    Requirements:
    - 5+ years Python (FastAPI preferred)
    - AWS experience (Lambda, ECS, RDS)
    - Kubernetes and Docker
    - CI/CD (GitHub Actions or Jenkins)
    - System design: microservices, event-driven architecture
    Nice to have: TypeScript, GraphQL
    """

    sample_bullets = extract_bullets_from_text(sample_cv)
    print(f"\nExtracted {len(sample_bullets)} bullets from sample CV")

    sample_matching = ["Python", "Flask", "REST API", "JavaScript"]
    sample_missing  = ["FastAPI", "AWS", "Kubernetes", "CI/CD", "Docker", "System Design", "TypeScript"]
    sample_scores   = {
        "clarity":     {"score": 6.5, "reason": "Clear but lacks specifics"},
        "structure":   {"score": 3.5, "reason": "STAR format absent in most bullets"},
        "relevance":   {"score": 5.0, "reason": "Some mismatch with JD"},
        "credibility": {"score": 5.0, "reason": "No metrics or quantifiable results"},
        "overall":     5.0,
        "summary":     "Decent foundation but needs stronger evidence.",
    }

    print("\nRunning full suggestion pipeline...\n")
    result = generate_suggestions(
        cv_text=sample_cv,
        jd_text=sample_jd,
        cv_bullets=sample_bullets,
        matching=sample_matching,
        missing=sample_missing,
        scores=sample_scores,
    )

    print("\n── Executive Summary ──")
    print(result["executive_summary"])

    print(f"\n── {len(result['rewritten_bullets'])} Rewritten Bullets ──")
    for b in result["rewritten_bullets"]:
        print(f"\n[{b['id']}] ORIGINAL:  {b['original']}")
        print(f"          REWRITTEN: {b['rewritten']}")
        print(f"          Keywords:  {b.get('keywords_added', [])}")
        print(f"          Confidence:{b.get('confidence')}")

    print(f"\n── {len(result['missing_skill_suggestions'])} Missing Skill Suggestions ──")
    for s in result["missing_skill_suggestions"]:
        print(f"\n• {s['skill']} [{s['priority']}] ~{s['estimated_effort']}")
        print(f"  Reframe: {s['reframe_tip']}")
        print(f"  Learn:   {s['acquisition_path']}")

    out = "day3_test_output.json"
    with open(out, "w", encoding="utf-8") as f:
        json.dump(result, f, ensure_ascii=False, indent=2)
    print(f"\n✓ Full output saved to {out}")
