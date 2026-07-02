"""
Phân tích CV theo ngành nghề (không cần JD).
LLM (cloud/Ollama) khi có; fallback heuristic từ danh sách kỹ năng theo ngành.
"""

from __future__ import annotations

from typing import Any

from llm_client import call_llm, extract_json

# Nhãn UI (tiếng Việt) — khớp frontend FIELDS
INDUSTRY_SKILLS: dict[str, list[str]] = {
    "IT / Công nghệ": [
        "python", "javascript", "typescript", "react", "node.js", "sql", "git",
        "docker", "aws", "java", "rest api", "agile", "linux", "mongodb", "html",
    ],
    "Marketing": [
        "seo", "google analytics", "facebook ads", "content marketing", "copywriting",
        "social media", "crm", "email marketing", "branding", "market research",
    ],
    "Tài chính / Kế toán": [
        "excel", "financial analysis", "accounting", "sap", "budgeting", "audit",
        "tax", "ifrs", "power bi", "forecasting", "risk management",
    ],
    "Nhân sự": [
        "recruitment", "onboarding", "hr policies", "payroll", "labor law",
        "performance management", "training", "employee relations", "hris",
    ],
    "Quản lý sản phẩm": [
        "product roadmap", "user research", "agile", "scrum", "jira", "figma",
        "sql", "a/b testing", "stakeholder management", "okrs", "analytics",
    ],
    "Thiết kế / UX": [
        "figma", "ui design", "ux research", "wireframing", "prototyping",
        "adobe xd", "design systems", "usability testing", "sketch",
    ],
    "Kinh doanh": [
        "sales", "crm", "negotiation", "b2b", "lead generation", "pipeline",
        "customer success", "presentation", "kpi", "business development",
    ],
    "Vận hành": [
        "process improvement", "supply chain", "logistics", "kpi", "lean",
        "six sigma", "inventory", "vendor management", "operations",
    ],
}

_SYSTEM = """Bạn là chuyên gia HR và career coach, thị trường việc làm Việt Nam.
Trả lời CHỈ bằng một JSON object hợp lệ. Mọi mô tả (strengths, weaknesses, suggestions, scoreNotes, summary) bằng tiếng Việt.
Từ khóa kỹ năng (matchedKeywords, missingKeywords) giữ nguyên tiếng Anh/kỹ thuật nếu phù hợp."""

_JSON_SCHEMA = """{
  "matchScore": <integer 0-100>,
  "totalKeywords": <integer>,
  "matchedKeywords": ["<keyword>"],
  "missingKeywords": ["<keyword>"],
  "scores": { "clarity": <0-10>, "structure": <0-10>, "relevance": <0-10>, "credibility": <0-10> },
  "scoreNotes": { "clarity": "<vi>", "structure": "<vi>", "relevance": "<vi>", "credibility": "<vi>" },
  "position": "<string or null>",
  "company": null,
  "strengths": ["<vi>"],
  "weaknesses": ["<vi>"],
  "suggestions": [{ "type": "add|fix|remove", "priority": "high|medium|low", "title": "<vi>", "reason": "<vi>", "before": "<string>", "after": "<string>" }],
  "summary": "<vi>"
}"""


def _norm(s: str) -> str:
    return (s or "").strip().lower()


def _heuristic_match(cv_skills: list[str], field: str) -> tuple[list[str], list[str], int]:
    expected = INDUSTRY_SKILLS.get(field) or INDUSTRY_SKILLS["IT / Công nghệ"]
    cv_norm = {_norm(s) for s in cv_skills if s}
    matching: list[str] = []
    for skill in expected:
        sn = _norm(skill)
        if sn in cv_norm:
            matching.append(skill)
            continue
        if any(sn in c or c in sn for c in cv_norm):
            matching.append(skill)
    missing = [s for s in expected if s not in matching]
    score = round(100 * len(matching) / max(len(expected), 1))
    return matching, missing, min(score, 100)


def _llm_to_pipeline(data: dict, cv_text: str, field: str, cv_skills: list[str]) -> dict:
    """Chuyển JSON Gemini-style → format giống /analyze/suggestions cho FE."""
    matched = data.get("matchedKeywords") or []
    missing = data.get("missingKeywords") or []
    scores_flat = data.get("scores") or {}
    notes = data.get("scoreNotes") or {}

    def dim(key: str, default: float = 6.0) -> dict:
        raw = scores_flat.get(key)
        score = float(raw) if isinstance(raw, (int, float)) else default
        return {
            "score": score,
            "reason": notes.get(key) or f"Đánh giá theo tiêu chí {key} cho ngành {field}.",
        }

    match_score = int(data.get("matchScore") or 0)
    overall = round(
        sum(
            dim(k).get("score", 0)
            for k in ("clarity", "structure", "relevance", "credibility")
        )
        / 4,
        1,
    )

    sugg_list = data.get("suggestions") or []
    missing_skill_suggestions = []
    rewritten_bullets = []
    for s in sugg_list:
        if not isinstance(s, dict):
            continue
        stype = (s.get("type") or "add").lower()
        if stype == "add":
            missing_skill_suggestions.append({
                "skill": s.get("title", "")[:80],
                "priority": s.get("priority", "medium"),
                "reframe_tip": s.get("reason", ""),
                "acquisition_path": s.get("after", s.get("reason", "")),
                "estimated_effort": "1–3 tháng",
            })
        else:
            rewritten_bullets.append({
                "original": s.get("before", ""),
                "rewritten": s.get("after", ""),
                "changes_made": [s.get("reason", "")],
                "keywords_added": [],
                "star_check": {},
                "confidence": s.get("priority", "medium"),
            })

    strengths = data.get("strengths") or [
        f"Có kỹ năng «{k}» phù hợp ngành {field}" for k in matched[:5]
    ]
    weaknesses = data.get("weaknesses") or [
        f"Nên bổ sung «{k}» cho ngành {field}" for k in missing[:5]
    ]

    return {
        "match": {
            "matching": matched,
            "missing": missing,
            "match_score": match_score,
            "summary": {
                "cv_total": len(cv_skills),
                "jd_total": int(data.get("totalKeywords") or len(matched) + len(missing)),
            },
        },
        "scores": {
            "clarity": dim("clarity"),
            "structure": dim("structure"),
            "relevance": dim("relevance"),
            "credibility": dim("credibility"),
            "overall": overall,
            "summary": data.get("summary") or "",
        },
        "suggestions": {
            "executive_summary": data.get("summary") or "",
            "rewritten_bullets": rewritten_bullets,
            "missing_skill_suggestions": missing_skill_suggestions,
            "strengths": strengths,
            "weaknesses": weaknesses,
        },
        "resume_text": cv_text,
        "jd_text": "",
        "field": field,
        "position": data.get("position"),
        "analysis_mode": "field",
    }


def _heuristic_pipeline(
    cv_text: str,
    cv_skills: list[str],
    field: str,
) -> dict:
    matched, missing, score = _heuristic_match(cv_skills, field)
    overall = round(score / 10, 1)
    return {
        "match": {
            "matching": matched,
            "missing": missing,
            "match_score": score,
            "summary": {"cv_total": len(cv_skills), "jd_total": len(matched) + len(missing)},
        },
        "scores": {
            "clarity": {"score": overall, "reason": "Phân tích cơ bản theo kỹ năng trích xuất từ CV."},
            "structure": {"score": overall, "reason": "Chưa có LLM — bật LLM_API_KEY để đánh giá chi tiết hơn."},
            "relevance": {"score": overall, "reason": f"So với bộ kỹ năng tham chiếu ngành «{field}»."},
            "credibility": {"score": overall, "reason": "Phân tích heuristic, không đọc sâu từng bullet."},
            "overall": overall,
            "summary": f"CV đạt khoảng {score}% kỹ năng thường gặp trong ngành {field}.",
        },
        "suggestions": {
            "executive_summary": f"CV đạt khoảng {score}% kỹ năng tham chiếu ngành {field}.",
            "rewritten_bullets": [],
            "missing_skill_suggestions": [
                {
                    "skill": sk,
                    "priority": "high" if i < 3 else "medium",
                    "reframe_tip": f"Bổ sung kinh nghiệm hoặc dự án liên quan tới {sk}.",
                    "acquisition_path": f"Học và thể hiện {sk} trên CV (dự án, chứng chỉ).",
                    "estimated_effort": "1–3 tháng",
                }
                for i, sk in enumerate(missing[:8])
            ],
        },
        "resume_text": cv_text,
        "jd_text": "",
        "field": field,
        "analysis_mode": "field",
        "_fallback": True,
    }


def analyze_cv_by_field(
    cv_text: str,
    cv_skills: list[str],
    field: str,
    model: str = "mistral:7b",
) -> dict[str, Any]:
    """Phân tích CV theo ngành. Raises ConnectionError/TimeoutError nếu LLM bắt buộc và lỗi."""
    field = (field or "IT / Công nghệ").strip()
    skills_preview = ", ".join((cv_skills or [])[:30]) or "không trích xuất được"

    user_prompt = f"""Phân tích chất lượng CV cho ngành «{field}» (thị trường Việt Nam).

=== CV (2500 ký tự đầu) ===
{cv_text[:2500]}

=== Kỹ năng trích từ CV (heuristic) ===
{skills_preview}

Hướng dẫn:
- matchScore = điểm chất lượng / phù hợp ngành (0–100), KHÔNG phải so với một JD cụ thể.
- matchedKeywords: kỹ năng quan trọng cho ngành «{field}» đã thể hiện trong CV.
- missingKeywords: kỹ năng quan trọng cho ngành còn thiếu.
- position: suy ra từ CV; company: null.
- Ít nhất 5 suggestions cụ thể, actionable.

Trả về JSON đúng schema:
{_JSON_SCHEMA}
"""

    try:
        # 2000 đôi khi không đủ cho gemini-2.5-flash (thinking tokens tính chung max_tokens) —
        # khớp mức 4096 đã xác nhận ổn định ở semantic_matcher.py / scorer.py.
        raw = call_llm(_SYSTEM, user_prompt, max_tokens=4096, temperature=0.2, ollama_model=model)
        parsed = extract_json(raw, {})
        if parsed and not parsed.get("_parse_error"):
            return _llm_to_pipeline(parsed, cv_text, field, cv_skills)
    except (ConnectionError, TimeoutError):
        # Không có Ollama/cloud → vẫn trả kết quả heuristic (giống /analyze fallback)
        return _heuristic_pipeline(cv_text, cv_skills, field)
    except Exception:
        pass

    return _heuristic_pipeline(cv_text, cv_skills, field)
