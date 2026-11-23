"""
best_fit.py — PR-05 (REQ C-04, AIS-05): chấm nhiều CV với một JD, trả xếp hạng và lý do.

- Mỗi CV: so kỹ năng (extract_skills + compute_match, không LLM) → skill_score 0–100.
- Một lượt LLM cho cả bộ CV (2–5 bản, mỗi bản cắt 2500 ký tự): llm_score 0–100, lý do, điểm mạnh,
  khoảng thiếu. Một lượt thay vì N lượt để 3 CV xong trong ≤ 60 giây.
- score = round(0.7 × llm_score + 0.3 × skill_score). LLM lỗi / thiếu CV trong output → dùng
  skill_score và lý do sinh từ kỹ năng khớp / thiếu (`mode: "skills"`), không trả điểm giả.
- CV không đọc được chữ đứng cuối, `score: null`, có `error`.
"""

from __future__ import annotations

import io
import re
import time
import zipfile

from llm_client import call_llm, extract_json
from matcher import compute_match
from skill_extractor import extract_skills

MIN_CVS = 2
MAX_CVS = 5
CV_CHARS = 2500
JD_CHARS = 2000
LLM_WEIGHT = 0.7
SKILL_WEIGHT = 0.3
LLM_TIMEOUT_S = 45

_SYSTEM = """Bạn là chuyên gia tuyển dụng. Bạn so sánh nhiều CV của CÙNG một ứng viên với một mô tả công việc (JD) để giúp ứng viên chọn CV nộp tốt nhất.
Chỉ trả JSON hợp lệ, không markdown, không giải thích ngoài JSON. Mọi trường văn bản viết bằng tiếng Việt."""


def docx_text(data: bytes) -> str:
    """Chữ trong .docx (zip chứa word/document.xml) — không cần thư viện ngoài."""
    with zipfile.ZipFile(io.BytesIO(data)) as z:
        xml = z.read("word/document.xml").decode("utf-8", errors="ignore")
    xml = re.sub(r"</w:p>", "\n", xml)
    xml = re.sub(r"<w:tab/>", " ", xml)
    text = re.sub(r"<[^>]+>", "", xml)
    for src, dst in (("&amp;", "&"), ("&lt;", "<"), ("&gt;", ">"), ("&quot;", '"'), ("&apos;", "'")):
        text = text.replace(src, dst)
    return re.sub(r"[ \t]+", " ", text).strip()


def build_prompt(jd_text: str, cvs: list[dict]) -> str:
    blocks = []
    for cv in cvs:
        blocks.append(f"=== CV id={cv['id']} — {cv.get('title') or 'Không tên'} ===\n{cv['text'][:CV_CHARS]}")
    cv_blocks = "\n\n".join(blocks)
    ids = ", ".join(f'"{cv["id"]}"' for cv in cvs)
    return f"""=== MÔ TẢ CÔNG VIỆC ===
{jd_text[:JD_CHARS]}

{cv_blocks}

=== NHIỆM VỤ ===
Chấm từng CV theo mức phù hợp với JD (0–100): kinh nghiệm và kỹ năng liên quan, kết quả đo lường được, cách trình bày nhấn đúng yêu cầu của JD.
So sánh các CV với nhau: lý do phải nói vì sao CV này hơn hoặc kém CV khác, dựa trên nội dung cụ thể trong CV.
Trả đúng {len(cvs)} phần tử, id lấy trong danh sách: {ids}.

{{
  "results": [
    {{
      "id": "<id của CV>",
      "score": 0,
      "reason": "<1–2 câu: vì sao CV này xếp ở vị trí đó>",
      "strengths": ["<tối đa 3 điểm mạnh so với JD>"],
      "gaps": ["<tối đa 3 điểm còn thiếu so với JD>"]
    }}
  ]
}}"""


def _clamp_score(value) -> int | None:
    try:
        n = float(value)
    except (TypeError, ValueError):
        return None
    if n != n:  # NaN
        return None
    return int(round(max(0.0, min(100.0, n))))


def _str_list(value, limit=3) -> list[str]:
    if not isinstance(value, list):
        return []
    return [str(x).strip()[:200] for x in value if str(x).strip()][:limit]


def llm_rank(jd_text: str, cvs: list[dict]) -> dict[str, dict]:
    """{id: {score, reason, strengths, gaps}}; lỗi → {} (người gọi rơi về chấm theo kỹ năng)."""
    raw = call_llm(_SYSTEM, build_prompt(jd_text, cvs), max_tokens=600 + 300 * len(cvs),
                   temperature=0.1, timeout=LLM_TIMEOUT_S)
    parsed = extract_json(raw, {"results": []})
    if parsed.get("_parse_error"):
        return {}
    known = {cv["id"] for cv in cvs}
    out: dict[str, dict] = {}
    for row in parsed.get("results") or []:
        if not isinstance(row, dict):
            continue
        cid = str(row.get("id", ""))
        score = _clamp_score(row.get("score"))
        if cid not in known or cid in out or score is None:
            continue
        out[cid] = {
            "score": score,
            "reason": str(row.get("reason") or "").strip()[:400],
            "strengths": _str_list(row.get("strengths")),
            "gaps": _str_list(row.get("gaps")),
        }
    return out


def _skill_reason(match: dict) -> str:
    total = match["summary"]["jd_total"]
    if not total:
        return "JD không nêu rõ kỹ năng để so khớp."
    head = f"Khớp {match['summary']['matching_count']}/{total} kỹ năng JD yêu cầu"
    if match["missing"]:
        head += f"; còn thiếu: {', '.join(match['missing'][:4])}"
    return head + "."


def rank_cvs(jd_text: str, cvs: list[dict], use_llm: bool = True) -> dict:
    """
    Args:
        jd_text: nội dung JD
        cvs: [{"id": str, "title": str, "text": str, "error": str | None}]
    Returns:
        {"ranking": [...], "jd_skills": [...], "mode": "llm" | "skills", "elapsed_ms": int}
    """
    started = time.monotonic()
    jd_skills = extract_skills(jd_text)["skills"]

    readable = [cv for cv in cvs if (cv.get("text") or "").strip() and not cv.get("error")]
    rows = []
    for cv in cvs:
        if cv not in readable:
            rows.append({"cv": cv, "match": None})
            continue
        cv_skills = extract_skills(cv["text"])["skills"]
        rows.append({"cv": cv, "match": compute_match(cv_skills, jd_skills)})

    llm: dict[str, dict] = {}
    llm_error = ""
    if use_llm and readable:
        try:
            llm = llm_rank(jd_text, readable)
        except (ConnectionError, TimeoutError, RuntimeError) as e:
            llm_error = str(e)[:200]
        if not llm_error and any(cv["id"] not in llm for cv in readable):
            # Thiếu CV nào thì bỏ cả kết quả AI: trộn điểm AI và điểm kỹ năng trong cùng bảng là không công bằng.
            llm_error = "AI trả kết quả không đủ cho mọi CV."
            llm = {}

    ranking = []
    for row in rows:
        cv, match = row["cv"], row["match"]
        if match is None:
            ranking.append({
                "id": cv["id"], "title": cv.get("title", ""), "score": None, "skill_score": None, "llm_score": None,
                "reason": "", "strengths": [], "gaps": [], "matching_skills": [], "missing_skills": [],
                "error": cv.get("error") or "Không đọc được nội dung CV.",
            })
            continue
        skill_score = int(round(match["match_score"]))
        judged = llm.get(cv["id"])
        if judged:
            score = int(round(LLM_WEIGHT * judged["score"] + SKILL_WEIGHT * skill_score))
            reason, strengths, gaps = judged["reason"] or _skill_reason(match), judged["strengths"], judged["gaps"]
        else:
            score, reason, strengths, gaps = skill_score, _skill_reason(match), [], match["missing"][:3]
        ranking.append({
            "id": cv["id"], "title": cv.get("title", ""), "score": score, "skill_score": skill_score,
            "llm_score": judged["score"] if judged else None, "reason": reason, "strengths": strengths, "gaps": gaps,
            "matching_skills": match["matching"], "missing_skills": match["missing"], "error": None,
        })

    ranking.sort(key=lambda r: (r["score"] is None, -(r["score"] or 0), -(r["skill_score"] or 0)))
    for i, r in enumerate(ranking, start=1):
        r["rank"] = i

    return {
        "ranking": ranking,
        "jd_skills": jd_skills,
        "mode": "llm" if llm else "skills",
        **({"llm_error": llm_error} if llm_error else {}),
        "elapsed_ms": int((time.monotonic() - started) * 1000),
    }
