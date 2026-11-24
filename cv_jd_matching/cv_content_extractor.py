"""
cv_content_extractor.py — PR-08: tách file CV đã tải lên thành `content` JSON của CVDocument
(backend/src/models/CVDocument.js) để mở trong trình sửa CV `/cvs/:id/edit`.

Bước 1: lấy chữ còn giữ xuống dòng (PDF qua PyMuPDF, PDF scan qua OCR của pdf_parser, DOCX, TXT).
Bước 2: một lượt LLM trả đúng shape `content`. LLM lỗi hoặc trả rỗng → tách theo luật:
nhận dòng tiêu đề mục (Kinh nghiệm, Học vấn, Kỹ năng, ...), mỗi mục có ngày tháng là một mục con.
Kết quả luôn qua `normalize_content` để đúng kiểu và độ dài mà editor chấp nhận.
"""

from __future__ import annotations

import os
import re
import tempfile

import fitz  # PyMuPDF

from llm_client import call_llm, extract_json

LLM_TEXT_CHARS = 9000
MAX_ITEMS = 15
MAX_BULLETS = 12
MAX_SKILLS = 40

# Độ dài tối đa theo ô nhập của editor (frontend/src/app/pages/cv/CvEditor.jsx)
_LIMITS = {
    "personal": 200, "summary": 2000, "name": 150, "date": 30, "description": 1000,
    "bullet": 500, "skill": 60, "gpa": 30, "link": 300,
}

PERSONAL_FIELDS = ["fullName", "email", "phone", "location", "website", "linkedin", "github"]

# ── Lấy chữ ───────────────────────────────────────────────────────────────────


def pdf_lines_text(data: bytes) -> str:
    """Chữ PDF giữ xuống dòng. PDF scan (ít chữ) → OCR qua pdf_parser.parse_pdf."""
    with fitz.open(stream=data, filetype="pdf") as doc:
        pages = [page.get_text("text", sort=True) for page in doc]
        page_count = max(len(doc), 1)
    text = "\n".join(pages)
    if len(text.strip()) / page_count >= 50:
        return text

    from pdf_parser import parse_pdf  # OCR chỉ khi cần

    with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as tmp:
        tmp.write(data)
        tmp_path = tmp.name
    try:
        parsed = parse_pdf(tmp_path)
    finally:
        os.unlink(tmp_path)
    if parsed.get("error"):
        raise ValueError(f"Không đọc được PDF: {parsed['error']}")
    return parsed["text"]


def file_lines_text(filename: str, data: bytes) -> str:
    name = (filename or "").lower()
    if name.endswith(".pdf"):
        try:
            return pdf_lines_text(data)
        except ValueError:
            raise
        except Exception as e:  # file hỏng
            raise ValueError("Không đọc được file PDF.") from e
    if name.endswith(".docx"):
        from best_fit import docx_text

        try:
            return docx_text(data)
        except Exception as e:
            raise ValueError("Không đọc được file DOCX.") from e
    if name.endswith(".txt"):
        return data.decode("utf-8", errors="ignore")
    raise ValueError("Chỉ tách được nội dung từ file PDF, DOCX hoặc TXT.")


# ── Chuẩn hóa ─────────────────────────────────────────────────────────────────


def _s(v, limit: int) -> str:
    if v is None:
        return ""
    if isinstance(v, (list, tuple)):
        v = ", ".join(str(x) for x in v if x is not None)
    return re.sub(r"\s+", " ", str(v)).strip()[:limit]


def _str_list(v, limit: int, max_items: int) -> list[str]:
    if isinstance(v, str):
        v = re.split(r"[,;\n]", v)
    if not isinstance(v, list):
        return []
    out, seen = [], set()
    for x in v:
        item = _s(x, limit)
        key = item.lower()
        if item and key not in seen:
            seen.add(key)
            out.append(item)
        if len(out) >= max_items:
            break
    return out


def _dicts(v) -> list[dict]:
    return [x for x in v if isinstance(x, dict)][:MAX_ITEMS] if isinstance(v, list) else []


def _has_text(obj: dict) -> bool:
    return any((bool(x) if isinstance(x, list) else isinstance(x, str) and x.strip()) for x in obj.values())


def normalize_content(raw: dict | None) -> dict:
    """Ép mọi field về đúng kiểu, cắt độ dài, bỏ mục trống. Field lạ bị bỏ."""
    c = raw if isinstance(raw, dict) else {}
    personal = c.get("personalInfo") if isinstance(c.get("personalInfo"), dict) else {}
    lim = _LIMITS

    experiences = []
    for e in _dicts(c.get("experiences")):
        item = {
            "company": _s(e.get("company"), lim["name"]),
            "position": _s(e.get("position"), lim["name"]),
            "startDate": _s(e.get("startDate"), lim["date"]),
            "endDate": _s(e.get("endDate"), lim["date"]),
            "isCurrent": bool(e.get("isCurrent")),
            "description": _s(e.get("description"), lim["description"]),
            "bullets": [_s(b, lim["bullet"]) for b in (e.get("bullets") or []) if _s(b, lim["bullet"])][:MAX_BULLETS]
            if isinstance(e.get("bullets"), list) else [],
        }
        if item["isCurrent"]:
            item["endDate"] = ""
        if _has_text({k: v for k, v in item.items() if k != "isCurrent"}):
            experiences.append(item)

    educations = []
    for e in _dicts(c.get("educations")):
        item = {
            "institution": _s(e.get("institution"), lim["name"]),
            "degree": _s(e.get("degree"), lim["name"]),
            "fieldOfStudy": _s(e.get("fieldOfStudy"), lim["name"]),
            "startDate": _s(e.get("startDate"), lim["date"]),
            "endDate": _s(e.get("endDate"), lim["date"]),
            "gpa": _s(e.get("gpa"), lim["gpa"]),
        }
        if _has_text(item):
            educations.append(item)

    projects = []
    for p in _dicts(c.get("projects")):
        item = {
            "name": _s(p.get("name"), lim["name"]),
            "role": _s(p.get("role"), lim["name"]),
            "link": _s(p.get("link"), lim["link"]),
            "description": _s(p.get("description"), lim["description"]),
            "technologies": _str_list(p.get("technologies"), lim["skill"], 20),
        }
        if _has_text(item):
            projects.append(item)

    certifications = []
    for x in _dicts(c.get("certifications")):
        item = {
            "name": _s(x.get("name"), lim["name"]),
            "issuer": _s(x.get("issuer"), lim["name"]),
            "issueDate": _s(x.get("issueDate"), lim["date"]),
        }
        if item["name"]:
            certifications.append(item)

    return {
        "personalInfo": {k: _s(personal.get(k), lim["personal"]) for k in PERSONAL_FIELDS},
        "summary": _s(c.get("summary"), lim["summary"]),
        "experiences": experiences,
        "educations": educations,
        "skills": _str_list(c.get("skills"), lim["skill"], MAX_SKILLS),
        "projects": projects,
        "certifications": certifications,
    }


def filled_sections(content: dict) -> list[str]:
    out = []
    if _has_text(content["personalInfo"]):
        out.append("personalInfo")
    for key in ("summary", "experiences", "educations", "skills", "projects", "certifications"):
        if content[key]:
            out.append(key)
    return out


# ── Tách theo luật ────────────────────────────────────────────────────────────

_HEADINGS: dict[str, list[str]] = {
    "summary": [
        "mục tiêu nghề nghiệp", "mục tiêu", "giới thiệu bản thân", "giới thiệu", "tóm tắt", "tóm tắt bản thân",
        "summary", "profile", "objective", "career objective", "about me", "professional summary",
    ],
    "experiences": [
        "kinh nghiệm", "kinh nghiệm làm việc", "kinh nghiệm giảng dạy", "quá trình làm việc", "quá trình công tác",
        "experience", "work experience", "professional experience", "employment history", "work history",
    ],
    "educations": [
        "học vấn", "trình độ học vấn", "quá trình học tập", "education", "academic background",
    ],
    "skills": [
        "kỹ năng", "kỹ năng chuyên môn", "kĩ năng", "skills", "technical skills", "core skills", "tech stack",
    ],
    "projects": ["dự án", "dự án cá nhân", "projects", "personal projects"],
    "certifications": [
        "chứng chỉ", "chứng chỉ và giải thưởng", "giải thưởng", "certifications", "certificates", "awards",
    ],
    "other": [
        "hoạt động", "hoạt động ngoại khóa", "sở thích", "ngoại ngữ", "người tham chiếu", "thông tin thêm",
        "activities", "interests", "hobbies", "languages", "references",
    ],
}
_HEADING_LOOKUP = {h: key for key, names in _HEADINGS.items() for h in names}

_EMAIL_RE = re.compile(r"[\w.+-]+@[\w-]+\.[\w.-]+")
_PHONE_RE = re.compile(r"(?:\+84|\b0)\s?\d{2,3}[\s.-]?\d{3}[\s.-]?\d{3,4}\b|\+\d{1,3}[\s.-]?\d{2,4}[\s.-]?\d{3}[\s.-]?\d{3,4}")
_URL_RE = re.compile(r"(?:https?://)?(?:www\.)?[\w-]+(?:\.[\w-]+)+(?:/[\w./%-]*)?", re.I)
_MONTH = r"(?:\d{1,2}/)?\d{4}"
_END = rf"(?:{_MONTH}|nay|hiện tại|hiện nay|present|now|current)"
_RANGE_RE = re.compile(rf"\(?\s*({_MONTH})\s*[-–—~]\s*({_END})\s*\)?", re.I)
_YEAR_RE = re.compile(r"\(?\b((?:19|20)\d{2})\b\)?")
_BULLET_RE = re.compile(r"^\s*[-•*·▪●◦–+]\s*")
_SPLIT_RE = re.compile(r"\s+[—–|]\s+|\s+-\s+|\s*\|\s*")
_GPA_RE = re.compile(r",?\s*\bGPA\b[:\s]*([\d.,]+(?:\s*/\s*[\d.,]+)?)", re.I)
_LABEL_RE = re.compile(r"^(?:email|e-mail|sđt|số điện thoại|điện thoại|phone|tel|mobile|liên hệ|contact|địa chỉ|address|ngày sinh|date of birth)\s*:?\s*", re.I)
_CURRENT_WORDS = {"nay", "hiện tại", "hiện nay", "present", "now", "current"}
_COMPANY_HINT = re.compile(
    r"công ty|tập đoàn|ngân hàng|trung tâm|tnhh|\bcp\b|cổ phần|\bjsc\b|\bltd\b|\binc\b|\bcorp|\bco\.|studio|"
    r"group|bank|software|solutions|technolog|logistics|digital|agency",
    re.I,
)
_ISSUER_HINT = re.compile(
    r"amazon|google|microsoft|oracle|cisco|coursera|udemy|ibm|meta|pmi|iibf|british council|idp|ets|"
    r"bộ |sở |viện|hội|đại học|university",
    re.I,
)
_SCHOOL_HINT = re.compile(r"đại học|học viện|trường|cao đẳng|university|college|institute|academy|school", re.I)


def _heading_key(line: str) -> str | None:
    t = re.sub(r"[:：\s]+$", "", line.strip()).lower()
    t = re.sub(r"\s+", " ", t)
    if not t or len(t) > 40:
        return None
    return _HEADING_LOOKUP.get(t)


def _split_sections(lines: list[str]) -> tuple[list[str], dict[str, list[str]]]:
    header: list[str] = []
    sections: dict[str, list[str]] = {}
    current = None
    for line in lines:
        key = _heading_key(line)
        if key:
            current = key
            sections.setdefault(key, [])
            continue
        (sections[current] if current else header).append(line)
    return header, sections


def _parse_personal(header: list[str], all_text: str) -> dict:
    info = {k: "" for k in PERSONAL_FIELDS}
    m = _EMAIL_RE.search(all_text)
    if m:
        info["email"] = m.group()
    m = _PHONE_RE.search(all_text)
    if m:
        info["phone"] = m.group().strip()
    for url in _URL_RE.findall(_EMAIL_RE.sub(" ", all_text)):
        low = url.lower()
        if "linkedin.com" in low and not info["linkedin"]:
            info["linkedin"] = url
        elif "github.com" in low and not info["github"]:
            info["github"] = url
        elif any(s in low for s in ("behance.net", "dribbble.com", ".dev", ".io", "portfolio")) and not info["website"]:
            info["website"] = url

    for line in header:
        if line.lower().startswith(("curriculum vitae", "resume", "cv")) and len(line) < 25:
            continue
        name = _SPLIT_RE.split(line)[0].strip()
        if (
            name and not _EMAIL_RE.search(name) and not re.search(r"\d", name)
            and 2 <= len(name.split()) <= 6 and len(name) <= 60
        ):
            info["fullName"] = name.title() if name.isupper() else name
            break

    for line in header:
        m = re.match(r"^(?:địa chỉ|address)\s*:?\s*(.+)$", line, re.I)
        if m:
            info["location"] = m.group(1).split("|")[0].strip()
            break
    return info


def _date_parts(text: str) -> tuple[str, str, bool, str]:
    """(start, end, isCurrent, text đã bỏ ngày)."""
    m = _RANGE_RE.search(text)
    if not m:
        return "", "", False, text
    start, end = m.group(1), m.group(2)
    current = end.strip().lower() in _CURRENT_WORDS
    rest = (text[: m.start()] + text[m.end():]).strip(" ,—–-|")
    return start, "" if current else end, current, rest


def _entries(lines: list[str]) -> list[list[str]]:
    """Gom dòng thành mục con: dòng không phải bullet và có khoảng ngày mở mục mới."""
    groups: list[list[str]] = []
    for line in lines:
        is_bullet = bool(_BULLET_RE.match(line))
        if not is_bullet and (_RANGE_RE.search(line) or not groups):
            groups.append([line])
        else:
            groups[-1].append(line)
    return groups


def _two_parts(head: str, hint: re.Pattern) -> tuple[str, str]:
    """Tách 'A — B' thành (tổ chức, vai trò). Phần khớp `hint` là tổ chức; không rõ thì phần đầu."""
    parts = [p.strip() for p in _SPLIT_RE.split(head) if p.strip()]
    if not parts:
        return "", ""
    if len(parts) == 1:
        at = re.split(r"\s+(?:at|tại)\s+", parts[0], maxsplit=1, flags=re.I)
        if len(at) == 2:
            return at[1].strip(), at[0].strip()
        return (parts[0], "") if hint.search(parts[0]) else ("", parts[0])
    org_idx = next((i for i, p in enumerate(parts) if hint.search(p)), 0)
    org = parts[org_idx]
    role = " — ".join(p for i, p in enumerate(parts) if i != org_idx)
    return org, role


def _parse_experiences(lines: list[str]) -> list[dict]:
    out = []
    for group in _entries(lines):
        start, end, current, head = _date_parts(group[0])
        company, position = _two_parts(head, _COMPANY_HINT)
        bullets, desc = [], []
        for line in group[1:]:
            if _BULLET_RE.match(line):
                bullets.append(_BULLET_RE.sub("", line))
            else:
                desc.append(line)
        if not bullets and len(desc) > 1:
            bullets, desc = desc, []
        out.append({
            "company": company, "position": position, "startDate": start, "endDate": end,
            "isCurrent": current, "description": " ".join(desc), "bullets": bullets,
        })
    return out


def _parse_educations(lines: list[str]) -> list[dict]:
    out = []
    for group in _entries(lines):
        joined = " ".join(_BULLET_RE.sub("", x) for x in group)
        gpa = ""
        m = _GPA_RE.search(joined)
        if m:
            gpa = m.group(1).replace(" ", "")
            joined = (joined[: m.start()] + joined[m.end():]).strip()
        start, end, _, head = _date_parts(joined)
        if not start:
            years = _YEAR_RE.findall(head)
            if years:
                end = years[-1]
                head = _YEAR_RE.sub("", head).strip(" ,—–-|()")
        institution, degree = _two_parts(head, _SCHOOL_HINT)
        field = ""
        m = re.match(r"^(cử nhân|kỹ sư|thạc sĩ|tiến sĩ|bachelor of|master of|bachelor|master)\s+(.+)$", degree, re.I)
        if m:
            degree = re.sub(r"\s+of$", "", m.group(1).strip(), flags=re.I)
            field = m.group(2).strip()
        out.append({
            "institution": institution, "degree": degree, "fieldOfStudy": field,
            "startDate": start, "endDate": end, "gpa": gpa,
        })
    return out


def _parse_skills(lines: list[str]) -> list[str]:
    items = []
    for line in lines:
        line = _BULLET_RE.sub("", line)
        line = re.sub(r"^[^:]{1,30}:\s*", "", line) if ":" in line[:31] else line
        items.extend(re.split(r"[,;|•·]", line))
    return [s.strip(" .") for s in items if 0 < len(s.strip(" .")) <= 60]


def _parse_projects(lines: list[str]) -> list[dict]:
    out: list[dict] = []
    for line in lines:
        clean = _BULLET_RE.sub("", line)
        if _BULLET_RE.match(line) and out:
            out[-1]["description"] = (out[-1]["description"] + " " + clean).strip()
            continue
        m = re.match(r"^([^:]{2,120}?)\s*[:：]\s*(.*)$", clean)
        if m:
            name = re.sub(r"\s*\(.*?\)\s*", " ", m.group(1)).strip()
            out.append({"name": name, "role": "", "link": "", "description": m.group(2), "technologies": []})
        elif out and not _RANGE_RE.search(clean) and len(clean) > 60:
            out[-1]["description"] = (out[-1]["description"] + " " + clean).strip()
        else:
            out.append({"name": clean, "role": "", "link": "", "description": "", "technologies": []})
    return out


def _parse_certifications(lines: list[str]) -> list[dict]:
    out = []
    for line in lines:
        clean = _BULLET_RE.sub("", line)
        years = _YEAR_RE.findall(clean)
        issue = years[-1] if years else ""
        name = _YEAR_RE.sub("", clean).strip(" ,—–-|()")
        parts = [p.strip() for p in _SPLIT_RE.split(name) if p.strip()]
        # Chỉ tách đơn vị cấp khi phần sau trông như tổ chức ("— Amazon", "— Coursera");
        # "AWS Certified Developer — Associate" giữ nguyên tên.
        if len(parts) >= 2 and (_ISSUER_HINT.search(parts[-1]) or _COMPANY_HINT.search(parts[-1])):
            out.append({"name": " — ".join(parts[:-1]), "issuer": parts[-1], "issueDate": issue})
        else:
            out.append({"name": " — ".join(parts) or name, "issuer": "", "issueDate": issue})
    return out


# PDF hay đổi "-" thành soft hyphen hoặc các loại gạch khác; đưa về "-" trước khi tách.
_DASH_FIX = str.maketrans({"­": "-", "‐": "-", "‑": "-", "‒": "-", "−": "-"})


def rule_based_content(text: str) -> dict:
    text = (text or "").translate(_DASH_FIX)
    lines = [re.sub(r"[ \t]+", " ", x).strip() for x in text.splitlines()]
    lines = [x for x in lines if x]
    header, sections = _split_sections(lines)
    return normalize_content({
        "personalInfo": _parse_personal(header, "\n".join(header) or text),
        "summary": " ".join(sections.get("summary", [])),
        "experiences": _parse_experiences(sections.get("experiences", [])),
        "educations": _parse_educations(sections.get("educations", [])),
        "skills": _parse_skills(sections.get("skills", [])),
        "projects": _parse_projects(sections.get("projects", [])),
        "certifications": _parse_certifications(sections.get("certifications", [])),
    })


# ── LLM ───────────────────────────────────────────────────────────────────────

_SYSTEM = (
    "Bạn chuyển CV thành JSON có cấu trúc. Trả lời CHỈ bằng một object JSON hợp lệ, "
    "không markdown, không giải thích."
)


def _llm_prompt(text: str) -> str:
    return f"""Chuyển CV sau thành JSON. Giữ nguyên ngôn ngữ và câu chữ của CV, không dịch, không viết lại,
không bịa thông tin không có trong CV. Thiếu thông tin thì để chuỗi rỗng "" hoặc mảng rỗng [].

=== CV ===
{text[:LLM_TEXT_CHARS]}
=== HẾT CV ===

JSON đúng dạng sau:
{{
  "personalInfo": {{"fullName": "", "email": "", "phone": "", "location": "", "website": "", "linkedin": "", "github": ""}},
  "summary": "mục tiêu / giới thiệu bản thân",
  "experiences": [{{"company": "", "position": "", "startDate": "MM/YYYY hoặc YYYY", "endDate": "", "isCurrent": false,
                   "description": "", "bullets": ["mỗi ý một phần tử"]}}],
  "educations": [{{"institution": "", "degree": "Cử nhân / Kỹ sư / Bachelor ...", "fieldOfStudy": "", "startDate": "", "endDate": "", "gpa": ""}}],
  "skills": ["mỗi kỹ năng một phần tử"],
  "projects": [{{"name": "", "role": "", "link": "", "description": "", "technologies": []}}],
  "certifications": [{{"name": "", "issuer": "", "issueDate": ""}}]
}}
Quy tắc: isCurrent = true và endDate = "" khi đang làm ("nay", "hiện tại", "present").
Mục giải thưởng đưa vào certifications."""


def llm_content(text: str) -> dict | None:
    """Một lượt LLM. Lỗi, JSON hỏng hoặc không tách được mục nào → None."""
    try:
        raw = call_llm(_SYSTEM, _llm_prompt(text), max_tokens=3000, temperature=0.0, timeout=90)
    except Exception as e:  # ConnectionError / TimeoutError / RuntimeError / lỗi mạng
        print(f"  [cv_content_extractor] LLM error, using rules: {e!r}")
        return None
    data = extract_json(raw or "", {})
    if data.get("_parse_error"):
        return None
    content = normalize_content(data)
    core = [k for k in ("experiences", "educations", "skills", "summary") if content[k]]
    return content if core else None


def extract_cv_content(text: str, use_llm: bool = True) -> dict:
    """Entry point: chữ CV (giữ xuống dòng) → { content, method, sections }."""
    body = (text or "").translate(_DASH_FIX).strip()
    if not body:
        raise ValueError("File không có chữ đọc được để tách nội dung.")
    content = llm_content(body) if use_llm else None
    method = "llm"
    if content is None:
        content = rule_based_content(body)
        method = "rules"
    return {"content": content, "method": method, "sections": filled_sections(content)}
