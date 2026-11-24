"""
cv_validator.py — PR-03: kiểm tra một văn bản có phải CV không.

Bước 1 (luật): đếm 4 nhóm mục cốt lõi của CV (Kinh nghiệm, Học vấn, Kỹ năng, Liên hệ),
mục phụ (mục tiêu, dự án, chứng chỉ, ...) và dấu hiệu loại giấy tờ khác (hóa đơn, JD,
thư xin việc, hợp đồng, sao kê, bảng điểm, ...).
Bước 2 (LLM): chỉ gọi khi luật không chắc. LLM lỗi thì quyết theo điểm luật.

Kết quả: { is_cv, confidence, method, doc_type, reason, signals, missing_sections }.
`reason` viết tiếng Việt để backend trả thẳng cho người dùng.
"""

from __future__ import annotations

import re

from llm_client import call_llm, extract_json

MIN_TEXT_CHARS = 120
LLM_TEXT_CHARS = 3500

# Nhóm mục cốt lõi: key → (nhãn hiển thị, regex)
CORE_SECTIONS: dict[str, tuple[str, str]] = {
    "experience": (
        "Kinh nghiệm",
        r"kinh nghiệm|quá trình (?:làm việc|công tác)|work experience|professional experience"
        r"|employment history|\bexperience\b|work history",
    ),
    "education": (
        "Học vấn",
        r"học vấn|quá trình học tập|bằng cấp|\beducation\b|academic background|tốt nghiệp"
        r"|\bbachelor|\bmaster of|cử nhân|\bgpa\b",
    ),
    "skills": (
        "Kỹ năng",
        r"kỹ năng|\bskills?\b|tech stack|năng lực chuyên môn|competenc",
    ),
}

_EMAIL_RE = re.compile(r"[\w.+-]+@[\w-]+\.[\w.-]+")
_PHONE_RE = re.compile(r"(?:\+84|\b0)\s?\d{2,3}[\s.-]?\d{3}[\s.-]?\d{3,4}\b|\+\d{1,3}[\s.-]?\(?\d{2,4}\)?[\s.-]?\d{3}[\s.-]?\d{3,4}")
_PROFILE_LINK_RE = re.compile(r"linkedin\.com|github\.com|behance\.net")

# Mục phụ hay gặp trong CV: mỗi mẫu khớp được 0.5 điểm, tối đa 3 mẫu.
EXTRA_PATTERNS = [
    r"mục tiêu nghề nghiệp|career objective|\bobjective\b",
    r"giới thiệu bản thân|\bsummary\b|\bprofile\b|about me",
    r"dự án|\bprojects?\b",
    r"chứng chỉ|certifications?|giải thưởng|\bawards?\b",
    r"hoạt động ngoại khóa|sở thích|\binterests\b|\bhobbies\b",
    r"ngày sinh|date of birth|người tham chiếu",
    r"curriculum vitae|\bresume\b|\bcv\b",
    r"ngoại ngữ|\blanguages?\b",
]

# Dấu hiệu giấy tờ khác: nhóm → (nhãn tiếng Việt, [mẫu]). Mỗi mẫu khớp tính 1 điểm.
NEGATIVE_GROUPS: dict[str, tuple[str, list[str]]] = {
    "invoice": ("hóa đơn hoặc chứng từ thanh toán", [
        r"hóa đơn giá trị gia tăng|hóa đơn gtgt|\bvat invoice|tax invoice",
        r"mã số thuế|\btax code",
        r"đơn giá|unit price",
        r"thành tiền|\bsubtotal\b",
        r"tổng (?:cộng )?tiền thanh toán|total amount|grand total",
        r"số tiền viết bằng chữ|thuế suất",
        r"\breceipt\b|phiếu thu|biên lai",
    ]),
    "job_description": ("mô tả công việc (JD)", [
        r"mô tả công việc|job description",
        r"yêu cầu ứng viên|yêu cầu công việc|\brequirements\b",
        r"quyền lợi|\bbenefits\b|what we offer",
        r"mức lương|\bsalary\b",
        r"hạn nộp hồ sơ|cách thức ứng tuyển|apply now|how to apply",
        r"chúng tôi đang tìm|we are looking for|we are hiring|tuyển dụng",
        r"\bresponsibilities\b|trách nhiệm công việc",
    ]),
    "cover_letter": ("thư xin việc", [
        r"kính gửi|\bdear (?:hiring|sir|madam|mr|ms|recruit)",
        r"trân trọng|\bsincerely\b|best regards",
        r"thư xin việc|thư ứng tuyển|cover letter",
        r"tôi viết thư này|i am writing to|tôi xin ứng tuyển|i would like to apply",
        r"mong được phỏng vấn|look forward to (?:hearing|the opportunity)",
    ]),
    "contract": ("hợp đồng", [
        r"hợp đồng|\bagreement\b|\bcontract\b",
        r"bên a\b|bên b\b|\bparty a\b|\bparty b\b",
        r"điều khoản|\bhereby\b|\bclause\b",
        r"đại diện bởi|represented by",
    ]),
    "bank_statement": ("sao kê ngân hàng", [
        r"sao kê|bank statement|account statement",
        r"số dư (?:đầu|cuối) kỳ|opening balance|closing balance",
        r"số tài khoản|account number",
        r"ghi nợ|ghi có|\bdebit\b|\bcredit\b",
    ]),
    "transcript": ("bảng điểm", [
        r"bảng điểm|academic transcript",
        r"học phần|mã môn|course code",
        r"tín chỉ|\bcredits\b",
        r"điểm trung bình tích lũy|cumulative gpa|học kỳ",
    ]),
    "academic": ("báo cáo hoặc tài liệu học thuật", [
        r"\babstract\b|tóm tắt đề tài",
        r"tài liệu tham khảo|bibliography",
        r"chương \d|\bchapter \d",
        r"phương pháp nghiên cứu|\bmethodology\b",
        r"kết luận|\bconclusion\b",
    ]),
    "minutes": ("biên bản họp", [
        r"biên bản|meeting minutes",
        r"thành phần tham dự|attendees",
        r"chủ trì|nội dung cuộc họp|\bagenda\b",
    ]),
    "manual": ("hướng dẫn sử dụng sản phẩm", [
        r"hướng dẫn sử dụng|user manual|user guide",
        r"thông số kỹ thuật|specifications",
        r"bảo hành|\bwarranty\b",
        r"cảnh báo an toàn|safety warning",
    ]),
    "recipe": ("công thức nấu ăn", [
        r"nguyên liệu|\bingredients\b",
        r"cách làm|cách chế biến|\bdirections\b",
        r"khẩu phần|\bservings\b",
    ]),
}

_LLM_SYSTEM = (
    "Bạn phân loại tài liệu tuyển dụng. Trả lời CHỈ bằng một object JSON hợp lệ, "
    "không markdown, không giải thích ngoài JSON."
)

_LLM_DOC_TYPES = ["cv", *NEGATIVE_GROUPS.keys(), "other"]


def _hits(pattern: str, text: str) -> bool:
    return re.search(pattern, text) is not None


def collect_signals(text: str) -> dict:
    """Đếm tín hiệu CV và tín hiệu giấy tờ khác trong văn bản (đã lowercase)."""
    t = (text or "").lower()
    sections = [key for key, (_, pat) in CORE_SECTIONS.items() if _hits(pat, t)]
    has_contact = bool(_EMAIL_RE.search(t) or _PHONE_RE.search(t) or _PROFILE_LINK_RE.search(t))
    if has_contact:
        sections.append("contact")
    extras = sum(1 for pat in EXTRA_PATTERNS if _hits(pat, t))

    negative: dict[str, int] = {}
    for group, (_, patterns) in NEGATIVE_GROUPS.items():
        n = sum(1 for pat in patterns if _hits(pat, t))
        if n:
            negative[group] = n
    return {
        "sections": sections,
        "has_contact": has_contact,
        "extras": extras,
        "negative": negative,
    }


def _scores(signals: dict) -> tuple[float, float]:
    """(điểm CV, điểm giấy tờ khác). Một nhóm khác chỉ mạnh khi khớp ≥ 2 mẫu."""
    positive = len(signals["sections"]) + 0.5 * min(signals["extras"], 3)
    negative = sum(n for n in signals["negative"].values() if n >= 2)
    negative += 0.5 * sum(1 for n in signals["negative"].values() if n == 1)
    return positive, negative


def _top_negative(signals: dict) -> str | None:
    neg = signals["negative"]
    if not neg:
        return None
    group, n = max(neg.items(), key=lambda kv: kv[1])
    return group if n >= 2 else None


def _missing_labels(signals: dict) -> list[str]:
    labels = {key: label for key, (label, _) in CORE_SECTIONS.items()}
    labels["contact"] = "Thông tin liên hệ"
    return [label for key, label in labels.items() if key not in signals["sections"]]


def _not_cv_reason(signals: dict, doc_type: str | None) -> str:
    if doc_type and doc_type in NEGATIVE_GROUPS:
        return f"Tệp có vẻ là {NEGATIVE_GROUPS[doc_type][0]}, không phải CV. Vui lòng tải lên CV của bạn."
    missing = _missing_labels(signals)
    if missing:
        return (
            "Tệp không giống CV: thiếu các mục " + ", ".join(missing)
            + ". Vui lòng tải lên CV có Kinh nghiệm, Học vấn, Kỹ năng và thông tin liên hệ."
        )
    return "Tệp không giống CV. Vui lòng tải lên CV của bạn."


def heuristic_verdict(text: str) -> dict:
    """
    Quyết bằng luật. `decided` = False nghĩa là chưa chắc (gọi LLM).
    `lean_cv` là phán đoán nghiêng về phía nào khi buộc phải quyết bằng luật.
    """
    signals = collect_signals(text)
    positive, negative = _scores(signals)
    core = len(signals["sections"])
    doc_type = _top_negative(signals)

    if core >= 3 and negative <= 1:
        decided, is_cv = True, True
    elif core <= 1 and positive < 2.5:
        decided, is_cv = True, False
    elif negative >= positive + 1:
        decided, is_cv = True, False
    else:
        decided, is_cv = False, None

    margin = positive - negative
    lean_cv = margin >= 2.5 if is_cv is None else is_cv
    confidence = min(0.95, 0.55 + 0.1 * abs(margin)) if decided else min(0.7, 0.5 + 0.05 * abs(margin))
    return {
        "decided": decided,
        "is_cv": is_cv,
        "lean_cv": lean_cv,
        "confidence": round(confidence, 2),
        "doc_type": "cv" if lean_cv else (doc_type or "other"),
        "signals": signals,
        "scores": {"positive": positive, "negative": negative},
    }


def _llm_prompt(text: str) -> str:
    types = ", ".join(_LLM_DOC_TYPES)
    return f"""Tài liệu dưới đây được tải lên kho CV của một ứng viên. Hãy cho biết đây có phải CV / resume
của một cá nhân không (có thể tiếng Việt hoặc tiếng Anh).

Một CV mô tả CHÍNH người viết: thông tin liên hệ, kinh nghiệm hoặc dự án, học vấn, kỹ năng.
KHÔNG phải CV: mô tả công việc (JD) của nhà tuyển dụng, thư xin việc, hóa đơn, hợp đồng, sao kê,
bảng điểm, báo cáo, biên bản, tài liệu khác.

=== TÀI LIỆU ===
{text[:LLM_TEXT_CHARS]}
=== HẾT ===

Trả về JSON đúng dạng:
{{"is_cv": true, "doc_type": "một trong: {types}", "confidence": 0.0, "reason": "một câu tiếng Việt"}}"""


def llm_verdict(text: str) -> dict | None:
    """Hỏi LLM. Trả None khi LLM lỗi hoặc trả JSON không dùng được."""
    try:
        raw = call_llm(_LLM_SYSTEM, _llm_prompt(text), max_tokens=200, temperature=0.0, timeout=30)
    except Exception as e:  # ConnectionError / TimeoutError / RuntimeError / lỗi mạng khác
        print(f"  [cv_validator] LLM error, using rule score: {e!r}")
        return None
    data = extract_json(raw or "", {})
    if data.get("_parse_error") or not isinstance(data.get("is_cv"), bool):
        return None
    doc_type = str(data.get("doc_type") or "").strip().lower()
    if doc_type not in _LLM_DOC_TYPES:
        doc_type = "cv" if data["is_cv"] else "other"
    try:
        confidence = float(data.get("confidence"))
    except (TypeError, ValueError):
        confidence = 0.7
    return {
        "is_cv": data["is_cv"],
        "doc_type": "cv" if data["is_cv"] else doc_type,
        "confidence": round(max(0.0, min(1.0, confidence)), 2),
        "reason": str(data.get("reason") or "").strip(),
    }


def validate_cv_text(text: str, use_llm: bool = True) -> dict:
    """Entry point: văn bản đã trích từ file → kết luận có phải CV không."""
    body = (text or "").strip()
    if len(body) < MIN_TEXT_CHARS:
        return {
            "is_cv": False,
            "confidence": 0.9,
            "method": "heuristic",
            "doc_type": "empty" if not body else "other",
            "reason": "Tệp gần như không có chữ đọc được. Vui lòng tải lên CV dạng PDF, DOCX hoặc TXT có nội dung.",
            "signals": collect_signals(body),
            "missing_sections": [],
        }

    h = heuristic_verdict(body)
    signals = h["signals"]
    method = "heuristic"
    is_cv, confidence, doc_type, llm_reason = h["is_cv"], h["confidence"], h["doc_type"], ""

    if not h["decided"]:
        llm = llm_verdict(body) if use_llm else None
        if llm:
            method = "llm"
            is_cv, confidence, doc_type, llm_reason = llm["is_cv"], llm["confidence"], llm["doc_type"], llm["reason"]
        else:
            method = "heuristic_fallback"
            is_cv = h["lean_cv"]

    if is_cv:
        doc_type = "cv"
        reason = "Tệp có các mục chính của CV."
    else:
        if doc_type == "cv":
            doc_type = "other"
        reason = _not_cv_reason(signals, doc_type)
        if llm_reason:
            reason = f"{reason} ({llm_reason})"

    return {
        "is_cv": bool(is_cv),
        "confidence": confidence,
        "method": method,
        "doc_type": doc_type,
        "reason": reason,
        "signals": signals,
        "missing_sections": _missing_labels(signals),
    }
