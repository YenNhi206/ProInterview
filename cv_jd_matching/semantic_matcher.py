"""
semantic_matcher.py — Phân tích CV vs JD qua LLM (semantic, không chỉ từ khóa).

Thay thế compute_match() heuristic cho tier full/suggestions.
LLM đọc nguyên văn CV + JD, hiểu:
  - Kỹ năng ẩn (implicit): "xây dựng REST API" → Node.js, HTTP, JSON, Auth
  - Kỹ năng chuyển đổi (transferable): Vue.js → React, Django → FastAPI
  - Mức độ phù hợp thực tế, không bị mất điểm vì dùng từ khác
"""

from __future__ import annotations
import json
from llm_client import call_llm, extract_json

_SYSTEM = """Bạn là chuyên gia phân tích CV và tuyển dụng tại thị trường Việt Nam.
Nhiệm vụ: Phân tích THỰC CHẤT sự phù hợp giữa CV và JD — không chỉ so từ khóa.
Trả lời CHỈ bằng JSON hợp lệ duy nhất, không markdown, không giải thích."""


def build_semantic_match_prompt(cv_text: str, jd_text: str) -> str:
    return f"""Phân tích sự phù hợp giữa hồ sơ ứng viên và mô tả công việc.

=== HỒ SƠ ỨNG VIÊN (CV) ===
{cv_text[:3000]}

=== MÔ TẢ CÔNG VIỆC (JD) ===
{jd_text[:2000]}

=== NHIỆM VỤ ===
Phân tích THỰC CHẤT — đừng chỉ so từ khóa. Hãy hiểu:
1. Kỹ năng NGẦM HIỂU: nếu CV nói "xây dựng hệ thống thanh toán real-time" → ứng viên hiểu concurrent programming, reliability, security
2. Kỹ năng CHUYỂN ĐỔI: Vue.js developer có nền tảng để học React; Django → FastAPI; MySQL → PostgreSQL
3. Kinh nghiệm TƯƠNG ĐƯƠNG: "dẫn nhóm 5 người" = leadership dù không ghi "Team Lead"
4. ĐỪNG phạt vì dùng từ khác nếu thực chất tương đương

Với từng yêu cầu của JD:
- "matched": Ứng viên đáp ứng được (có thể dùng từ khác hoặc kỹ năng tương đương)
- "missing": Thực sự thiếu, không thể suy luận từ CV
- "transferable": Chưa có nhưng có nền tảng dễ học (1–4 tuần)

Với mỗi kỹ năng "missing", phân loại "skill_type":
- "market_standard": kỹ năng mà hầu hết công ty trong ngành/role này đều yêu cầu (ví dụ: React với Frontend, SQL với Backend, Git với mọi dev)
- "company_specific": yêu cầu đặc thù của công ty này, không phải chuẩn chung của ngành (ví dụ: framework nội bộ, tool riêng, nghiệp vụ domain cụ thể)

Trả về JSON:
{{
  "matched": [
    {{
      "requirement": "<yêu cầu từ JD>",
      "evidence": "<bằng chứng cụ thể từ CV — trích dẫn hoặc suy luận>",
      "match_type": "direct|implicit|transferable",
      "confidence": "high|medium|low"
    }}
  ],
  "missing": [
    {{
      "requirement": "<yêu cầu từ JD ứng viên thực sự thiếu>",
      "importance": "critical|important|nice_to_have",
      "gap_size": "large|medium|small",
      "skill_type": "market_standard|company_specific"
    }}
  ],
  "transferable": [
    {{
      "requirement": "<yêu cầu từ JD>",
      "existing_skill": "<kỹ năng ứng viên đã có làm nền tảng>",
      "estimated_time": "<thời gian để đạt mức dùng được>"
    }}
  ],
  "match_score": <integer 0-100, dựa trên matched + transferable, KHÔNG chỉ đếm từ khóa>,
  "overall_assessment": "<2-3 câu nhận xét tổng quan bằng tiếng Việt — điểm mạnh chính, khoảng cách lớn nhất>",
  "fit_level": "excellent|good|fair|poor"
}}"""


def semantic_match(cv_text: str, jd_text: str, model: str = None) -> dict:
    """
    Phân tích semantic CV vs JD qua LLM.
    Returns dict tương thích với output của compute_match() + thông tin phong phú hơn.
    """
    prompt = build_semantic_match_prompt(cv_text, jd_text)

    _FALLBACK = {
        "matching": [], "missing": [], "transferable": [],
        "extra": [], "match_score": 0.0,
        "summary": {"jd_total": 0, "matching_count": 0, "missing_count": 0, "extra_count": 0},
        "overall_assessment": "Không thể phân tích.",
        "fit_level": "poor",
        "_semantic": False,
        "_semantic_error": True,
    }

    raw = call_llm(_SYSTEM, prompt, max_tokens=4096, temperature=0.15, ollama_model=model)
    result = extract_json(raw, _FALLBACK)

    if result.get("_semantic_error") or result.get("_parse_error"):
        # Không trả về _FALLBACK (match_score=0) như một kết quả hợp lệ — điều này khiến
        # lỗi LLM/parse trông giống hệt "CV không phù hợp 0%" trên FE. Raise để main.py
        # trả 502 rõ ràng, không đánh lừa người dùng bằng kết quả giả.
        raise RuntimeError(
            "Không phân tích được phản hồi từ AI (LLM trả về dữ liệu không hợp lệ hoặc rỗng). "
            "Vui lòng thử lại sau ít phút."
        )

    # Chuẩn hóa → format tương thích compute_match()
    matched_requirements = [m.get("requirement", "") for m in result.get("matched", []) if m.get("requirement")]
    missing_requirements = [m.get("requirement", "") for m in result.get("missing", []) if m.get("requirement")]
    transferable = result.get("transferable", [])

    score = int(result.get("match_score") or 0)
    score = max(0, min(100, score))

    return {
        # ── Format tương thích compute_match() ──────────────────────────────
        "matching":    matched_requirements,
        "missing":     missing_requirements,
        "extra":       [],
        "match_score": float(score),
        "summary": {
            "jd_total":       len(matched_requirements) + len(missing_requirements),
            "matching_count": len(matched_requirements),
            "missing_count":  len(missing_requirements),
            "extra_count":    0,
        },
        # ── Thông tin phong phú thêm (dùng cho FE nếu cần) ──────────────────
        "_semantic": True,
        "_matched_details":  result.get("matched", []),
        "_missing_details":  result.get("missing", []),
        "_transferable":     transferable,
        "_overall_assessment": result.get("overall_assessment", ""),
        "_fit_level":        result.get("fit_level", "fair"),
    }
