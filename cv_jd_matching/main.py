"""
FastAPI backend — Day 1 + Day 2 + Day 3 endpoints.

Cách chạy:
    cd resume_analyzer/backend
    uvicorn main:app --reload

Docs: http://localhost:8000/docs
"""

import sys
import tempfile
import os
from pathlib import Path
from dotenv import load_dotenv

_here = Path(__file__).parent
load_dotenv(_here / ".env")                      # cv_jd_matching/.env (ưu tiên)
load_dotenv(_here.parent / "backend" / ".env")   # backend/.env làm fallback

sys.path.insert(0, str(Path(__file__).parent))

from fastapi import FastAPI, UploadFile, File, HTTPException, Query, Form
from fastapi.middleware.cors import CORSMiddleware

from pdf_parser import parse_pdf
from skill_extractor import extract_skills
from matcher import compute_match
from semantic_matcher import semantic_match
from scorer import score_resume
from suggester import generate_suggestions, extract_bullets_from_text
from llm_client import check_llm_health
from field_analyzer import analyze_cv_by_field
import cache as cv_cache
from cache import md5_of_bytes

app = FastAPI(title="Resume Analyzer API", version="0.4.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Helper ────────────────────────────────────────────────────────────────────

async def _process_upload(label: str, upload: UploadFile) -> dict:
    if not upload.filename.lower().endswith(".pdf"):
        raise HTTPException(400, f"File '{label}' phải là PDF")

    file_bytes = await upload.read()
    if len(file_bytes) == 0:
        raise HTTPException(400, f"File '{label}' rỗng")

    # Cache by MD5 — cùng file không parse lại
    file_hash = md5_of_bytes(file_bytes)
    cached = cv_cache.get("pdf_parse", file_hash)
    if cached:
        return cached

    with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as tmp:
        tmp.write(file_bytes)
        tmp_path = tmp.name

    try:
        parsed = parse_pdf(tmp_path)
    finally:
        os.unlink(tmp_path)

    if parsed["error"]:
        raise HTTPException(400, f"Lỗi parse '{label}': {parsed['error']}")

    skills = extract_skills(parsed["text"])
    result = {
        "text":       parsed["text"],
        "page_count": parsed["page_count"],
        "skills":     skills,
    }
    cv_cache.set(result, "pdf_parse", file_hash)
    return result


# ── Endpoints ─────────────────────────────────────────────────────────────────

@app.get("/")
@app.get("/health")
def health():
    """Render / load balancer — tránh 404 trên GET / (service bị coi là down)."""
    llm = check_llm_health()
    return {
        "ok": True,
        "service": "resume-analyzer",
        "version": "0.3.0",
        "llm_mode": llm.get("mode"),
        "llm_ready": bool(llm.get("running")),
    }


@app.get("/health/ollama")
def ollama_health():
    """Kiểm tra LLM provider (cloud hoặc Ollama) đang khả dụng."""
    return check_llm_health()


@app.post("/analyze")
async def analyze(
    resume: UploadFile = File(...),
    jd:     UploadFile = File(...),
):
    """Day 1+2 light: skill matching/missing. Không gọi LLM."""
    resume_data = await _process_upload("resume", resume)
    jd_data     = await _process_upload("jd", jd)

    match = compute_match(
        cv_skills=resume_data["skills"]["skills"],
        jd_skills=jd_data["skills"]["skills"],
    )

    return {
        "resume":      resume_data["skills"],
        "jd":          jd_data["skills"],
        "match":       match,
        "resume_text": resume_data["text"],
        "jd_text":     jd_data["text"],
    }


@app.post("/analyze/full")
async def analyze_full(
    resume: UploadFile = File(...),
    jd:     UploadFile = File(...),
    model:  str = Query(default="mistral:7b", description="Ollama model name"),
):
    """
    Semantic matching + scoring 4 dimensions.
    LLM đọc nguyên văn CV+JD, hiểu kỹ năng ẩn và chuyển đổi — không chỉ so từ khóa.
    """
    resume_data = await _process_upload("resume", resume)
    jd_data     = await _process_upload("jd", jd)

    cached = cv_cache.get("analyze/full", resume_data["text"], jd_data["text"])
    if cached:
        return cached

    try:
        match = semantic_match(
            cv_text=resume_data["text"],
            jd_text=jd_data["text"],
            model=model,
        )
    except (ConnectionError, TimeoutError):
        # Fallback về heuristic nếu mạng/timeout
        match = compute_match(
            cv_skills=resume_data["skills"]["skills"],
            jd_skills=jd_data["skills"]["skills"],
        )
    except RuntimeError as e:
        raise HTTPException(502, str(e))

    try:
        scores = score_resume(
            cv_text=resume_data["text"],
            jd_text=jd_data["text"],
            matching=match["matching"],
            missing=match["missing"],
            model=model,
        )
    except ConnectionError as e:
        raise HTTPException(503, f"Ollama không khả dụng: {e}")
    except TimeoutError as e:
        raise HTTPException(504, f"Ollama timeout: {e}")
    except RuntimeError as e:
        raise HTTPException(502, str(e))

    result = {
        "resume":      resume_data["skills"],
        "jd":          jd_data["skills"],
        "match":       match,
        "scores":      scores,
        "resume_text": resume_data["text"],
        "jd_text":     jd_data["text"],
    }
    cv_cache.set(result, "analyze/full", resume_data["text"], jd_data["text"])
    return result


@app.post("/analyze/suggestions")
async def analyze_suggestions(
    resume: UploadFile = File(...),
    jd:     UploadFile = File(...),
    model:  str = Query(default="mistral:7b", description="Ollama model name"),
):
    """
    Day 3: Toàn bộ pipeline — match + score + suggestions.

    Pipeline:
      parse PDF → extract skills → match → score (Day 2) → suggest (Day 3)

    Lưu ý thời gian: mỗi LLM call ~15-40s trên CPU.
    Tổng: ~60-120s tùy model và độ dài CV.

    Response:
    {
      "match":   { matching, missing, match_score },
      "scores":  { clarity, structure, relevance, credibility, overall, summary },
      "suggestions": {
        "rewritten_bullets":         [...],
        "missing_skill_suggestions": [...],
        "executive_summary":         "..."
      }
    }
    """
    resume_data = await _process_upload("resume", resume)
    jd_data     = await _process_upload("jd", jd)

    cached = cv_cache.get("analyze/suggestions", resume_data["text"], jd_data["text"])
    if cached:
        return cached

    # ── Step 1: Semantic match (LLM hiểu ngữ nghĩa, không chỉ từ khóa) ──
    try:
        match = semantic_match(
            cv_text=resume_data["text"],
            jd_text=jd_data["text"],
            model=model,
        )
    except (ConnectionError, TimeoutError):
        match = compute_match(
            cv_skills=resume_data["skills"]["skills"],
            jd_skills=jd_data["skills"]["skills"],
        )
    except RuntimeError as e:
        raise HTTPException(502, str(e))

    # ── Step 2: Score — Day 2 ─────────────────────────────────────────────
    try:
        scores = score_resume(
            cv_text=resume_data["text"],
            jd_text=jd_data["text"],
            matching=match["matching"],
            missing=match["missing"],
            model=model,
        )
    except ConnectionError as e:
        raise HTTPException(503, f"Ollama không khả dụng: {e}")
    except TimeoutError as e:
        raise HTTPException(504, f"Ollama timeout (scoring): {e}")
    except RuntimeError as e:
        raise HTTPException(502, str(e))

    # ── Step 3: Extract bullets from CV text ──────────────────────────────
    # Dùng heuristic extractor; thay bằng structured extractor nếu có
    cv_bullets = extract_bullets_from_text(resume_data["text"])

    # ── Step 4: Suggest — Day 3 ───────────────────────────────────────────
    try:
        suggestions = generate_suggestions(
            cv_text=resume_data["text"],
            jd_text=jd_data["text"],
            cv_bullets=cv_bullets,
            matching=match["matching"],
            missing=match["missing"],
            scores=scores,
            model=model,
        )
    except ConnectionError as e:
        raise HTTPException(503, f"Ollama không khả dụng: {e}")
    except TimeoutError as e:
        raise HTTPException(504, f"Ollama timeout (suggestions): {e}")
    except RuntimeError as e:
        raise HTTPException(502, str(e))

    result = {
        "match":       match,
        "scores":      scores,
        "suggestions": suggestions,
        "resume_text": resume_data["text"],
        "jd_text":     jd_data["text"],
    }
    cv_cache.set(result, "analyze/suggestions", resume_data["text"], jd_data["text"])
    return result


@app.post("/analyze/field")
async def analyze_field(
    resume: UploadFile = File(...),
    field:  str = Form(default="IT / Công nghệ"),
    model:  str = Query(default="mistral:7b", description="Ollama model name"),
):
    """
    Phân tích CV theo ngành nghề — không cần file JD.
    Dùng LLM (LLM_API_KEY) hoặc Ollama; fallback heuristic nếu LLM lỗi parse.
    """
    resume_data = await _process_upload("resume", resume)

    cached = cv_cache.get("analyze/field", resume_data["text"], field)
    if cached:
        return cached

    result = analyze_cv_by_field(
        cv_text=resume_data["text"],
        cv_skills=resume_data["skills"]["skills"],
        field=field,
        model=model,
    )

    response = {
        "resume":      resume_data["skills"],
        "match":       result["match"],
        "scores":      result["scores"],
        "suggestions": result["suggestions"],
        "resume_text": result["resume_text"],
        "jd_text":     "",
        "field":       result.get("field", field),
        "analysis_mode": "field",
        "fallback":    bool(result.get("_fallback")),
    }
    if not result.get("_fallback"):
        cv_cache.set(response, "analyze/field", resume_data["text"], field)
    return response


@app.post("/extract-text")
async def extract_text(
    file: UploadFile = File(...),
):
    """
    Trích xuất text thuần từ PDF.
    Dùng bởi backend Express (interviewsController) để chuẩn bị prompt LLM sinh câu hỏi.
    """
    data = await _process_upload("file", file)
    return {"text": data["text"], "page_count": data["page_count"]}