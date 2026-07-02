"""
scorer.py — Đánh giá CV theo 4 dimensions qua LLM (cloud hoặc Ollama).

Ưu tiên cloud (Groq/Gemini/OpenAI) nếu LLM_API_KEY được set trong env.
Fallback về Ollama local nếu không có key.
"""

from __future__ import annotations
import json
from typing import Optional

from llm_client import call_llm, extract_json, check_llm_health


# ── Prompt builder ───────────────────────────────────────────────────────────

_SYSTEM_PROMPT = """Bạn là chuyên gia đánh giá CV/hồ sơ xin việc. Bạn PHẢI trả lời bằng JSON hợp lệ duy nhất.
Không giải thích, không markdown, không code fence. Chỉ JSON object thuần.
Tất cả các trường văn bản (reason, summary, examples) PHẢI viết bằng tiếng Việt."""

def build_scoring_prompt(cv_text: str, jd_text: str, matching: list, missing: list) -> str:
    """Gộp toàn bộ context → 1 LLM call. Trả JSON 4 dimension scores + lý do tiếng Việt."""
    matching_str = ", ".join(matching[:20]) if matching else "không có"
    missing_str  = ", ".join(missing[:20])  if missing  else "không có"

    return f"""Hãy đánh giá CV này so với mô tả công việc (JD).

=== HỒ SƠ CV (2000 ký tự đầu) ===
{cv_text[:2000]}

=== MÔ TẢ CÔNG VIỆC (1500 ký tự đầu) ===
{jd_text[:1500]}

=== PHÂN TÍCH KỸ NĂNG ===
Kỹ năng khớp: {matching_str}
Kỹ năng còn thiếu: {missing_str}

=== NHIỆM VỤ ===
Chấm điểm CV theo 4 tiêu chí (thang 0.0 đến 10.0):

1. RÕ RÀNG (CLARITY): Văn phong có rõ ràng, súc tích, không dùng từ ngữ mơ hồ?
   Kiểm tra: ngôn ngữ cụ thể, tránh cụm từ chung chung như "phụ trách", "hỗ trợ"

2. CẤU TRÚC STAR: Các bullet point có theo Tình huống→Hành động→Kết quả?
   Kiểm tra: mỗi bullet có kết quả đo lường được không (con số, %, thời gian)?
   Điểm cao hơn nếu >50% bullet có kết quả định lượng.

3. PHÙ HỢP JD (RELEVANCE): CV có phù hợp với vị trí công việc này không?
   Kiểm tra: % kỹ năng trùng khớp, tên vị trí, ngành nghề.
   Dùng dữ liệu kỹ năng khớp/thiếu ở trên.

4. ĐỘ THUYẾT PHỤC (CREDIBILITY): Các tuyên bố có cụ thể và kiểm chứng được không?
   Kiểm tra: tên công ty, tên công cụ, số liệu cụ thể, chứng chỉ.
   Trừ điểm nếu tuyên bố mơ hồ như "cải thiện hiệu suất đáng kể".

Trả lời CHỈ với cấu trúc JSON sau (tất cả văn bản bằng tiếng Việt):
{{
  "clarity": {{
    "score": 7.5,
    "reason": "một câu giải thích bằng tiếng Việt",
    "examples": ["trích dẫn hoặc nhận xét cụ thể từ CV"]
  }},
  "structure": {{
    "score": 6.0,
    "reason": "một câu giải thích bằng tiếng Việt",
    "star_found": true,
    "quantified_bullets": 3,
    "total_bullets": 8
  }},
  "relevance": {{
    "score": 8.0,
    "reason": "một câu giải thích bằng tiếng Việt",
    "match_percentage": 65.0
  }},
  "credibility": {{
    "score": 7.0,
    "reason": "một câu giải thích bằng tiếng Việt",
    "examples": ["tuyên bố thuyết phục tìm được trong CV"]
  }},
  "overall": 7.1,
  "summary": "nhận xét tổng quan 2-3 câu bằng tiếng Việt"
}}"""


_SCORE_FALLBACK = {
    "clarity":     {"score": 0, "reason": "Không thể phân tích"},
    "structure":   {"score": 0, "reason": "Không thể phân tích", "star_found": False,
                    "quantified_bullets": 0, "total_bullets": 0},
    "relevance":   {"score": 0, "reason": "Không thể phân tích", "match_percentage": 0},
    "credibility": {"score": 0, "reason": "Không thể phân tích", "examples": []},
    "overall":     0,
    "summary":     "Không thể phân tích kết quả từ AI.",
}


# ── Main entry point ─────────────────────────────────────────────────────────

def score_resume(
    cv_text:  str,
    jd_text:  str,
    matching: list,
    missing:  list,
    model:    Optional[str] = None,
) -> dict:
    """
    Entry point chính. Gọi từ main.py.

    Returns dict với scores theo 4 dimensions + overall + summary.
    Raises ConnectionError nếu Ollama chưa chạy.
    """
    prompt   = build_scoring_prompt(cv_text, jd_text, matching, missing)
    # 1500 không đủ cho gemini-2.5-flash: "thinking tokens" tính chung vào max_tokens,
    # thường ngốn hết budget trước khi model kịp xuất JSON → finish_reason="length",
    # content bị cắt cụt, extract_json luôn fail. 4096 khớp mức đang chạy ổn ở semantic_match.
    raw      = call_llm(_SYSTEM_PROMPT, prompt, max_tokens=4096, temperature=0.1,
                        ollama_model=model)
    scores   = extract_json(raw, _SCORE_FALLBACK)

    if scores.get("_parse_error"):
        # Không trả về _SCORE_FALLBACK (toàn bộ 4 dimension = 0) như kết quả hợp lệ —
        # sẽ trông giống CV bị chấm điểm thực sự thấp thay vì lỗi hệ thống.
        raise RuntimeError(
            "Không phân tích được điểm số từ AI (LLM trả về dữ liệu không hợp lệ hoặc rỗng). "
            "Vui lòng thử lại sau ít phút."
        )

    # Tính overall nếu model không trả về
    if "overall" not in scores or scores["overall"] == 0:
        dims = ["clarity", "structure", "relevance", "credibility"]
        vals = [scores.get(d, {}).get("score", 0) for d in dims]
        scores["overall"] = round(sum(vals) / len(vals), 1)

    return scores


# ── Health check helper ───────────────────────────────────────────────────────

def check_ollama_health(model: str = None) -> dict:
    """Delegate to llm_client unified health check."""
    return check_llm_health()


# ── CLI test ──────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    print("Checking LLM health...")
    health = check_ollama_health()
    print(json.dumps(health, indent=2, ensure_ascii=False))

    if not health.get("running"):
        print("\nLLM không khả dụng. Set LLM_API_KEY hoặc chạy Ollama.")
        exit(1)

    print("\nRunning test scoring...")
    result = score_resume(
        cv_text="Software engineer with 3 years Python experience. Built REST APIs with Django. "
                "Reduced API response time by 40% through caching. Led team of 3 developers.",
        jd_text="Looking for Python backend engineer. FastAPI or Django. AWS experience preferred. "
                "Must have experience with PostgreSQL and Redis.",
        matching=["python", "django"],
        missing=["fastapi", "aws", "postgresql", "redis"],
    )
    print(json.dumps(result, indent=2, ensure_ascii=False))