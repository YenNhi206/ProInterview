"""Unit tests — cv_validator (PR-03): file tải lên có phải CV không; LLM giả lập."""
import json
import sys
import unittest
from pathlib import Path
from unittest import mock

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import cv_validator  # noqa: E402
from cv_validator import validate_cv_text, heuristic_verdict  # noqa: E402

SAMPLES_DIR = Path(__file__).resolve().parent / "fixtures" / "cv_validation"

# Văn bản lưng chừng: có Kỹ năng + liên hệ, thiếu Kinh nghiệm/Học vấn, kèm vài chữ của JD.
AMBIGUOUS = (
    "Nguyễn An — an.nguyen@gmail.com — 0912 000 111. "
    "Kỹ năng: Python, SQL, Docker. Mục tiêu nghề nghiệp: phát triển phần mềm. "
    "Dự án cá nhân: website bán sách. Mức lương mong muốn: 15 triệu. "
    + "Thông tin thêm về bản thân. " * 5
)


def sample_files():
    return sorted(p for p in SAMPLES_DIR.iterdir() if p.suffix in {".pdf", ".docx", ".txt"})


class TestSampleSet(unittest.TestCase):
    """Điều kiện xong của PR-03: 20 file mẫu (10 CV, 10 không phải) đúng ≥ 18."""

    def test_sample_set_has_10_cv_and_10_non_cv(self):
        files = sample_files()
        self.assertEqual(len(files), 20)
        self.assertEqual(sum(p.name.startswith("cv_") for p in files), 10)
        self.assertEqual(sum(p.name.startswith("not_") for p in files), 10)

    def test_at_least_18_of_20_correct_without_llm(self):
        from main import _file_text

        wrong = []
        for p in sample_files():
            text = _file_text(p.name, p.read_bytes())
            result = validate_cv_text(text, use_llm=False)
            if result["is_cv"] != p.name.startswith("cv_"):
                wrong.append(p.name)
        self.assertLessEqual(len(wrong), 2, f"Sai: {wrong}")


class TestHeuristics(unittest.TestCase):
    def test_hard_cases_are_decided_by_rules(self):
        # JD và thư xin việc có đủ chữ "kinh nghiệm / kỹ năng / email", vẫn phải bị loại.
        from main import _file_text

        for name, doc_type in (
            ("not_jd_backend_vi.pdf", "job_description"),
            ("not_cover_letter_vi.pdf", "cover_letter"),
        ):
            p = SAMPLES_DIR / name
            r = validate_cv_text(_file_text(p.name, p.read_bytes()), use_llm=False)
            self.assertFalse(r["is_cv"], name)
            self.assertEqual(r["doc_type"], doc_type)
            self.assertEqual(r["method"], "heuristic")

    def test_accountant_cv_mentioning_invoices_is_still_cv(self):
        from main import _file_text

        p = SAMPLES_DIR / "cv_accountant_vi.pdf"
        r = validate_cv_text(_file_text(p.name, p.read_bytes()), use_llm=False)
        self.assertTrue(r["is_cv"])
        self.assertEqual(r["missing_sections"], [])

    def test_too_short_text_is_rejected(self):
        r = validate_cv_text("Xin chào", use_llm=True)
        self.assertFalse(r["is_cv"])
        self.assertIn("không có chữ", r["reason"])

    def test_reason_lists_missing_sections_in_vietnamese(self):
        text = "Ghi chú cá nhân về chuyến đi Đà Lạt cuối tuần, thời tiết mát mẻ, đồ ăn ngon. " * 3
        r = validate_cv_text(text, use_llm=False)
        self.assertFalse(r["is_cv"])
        self.assertIn("Kinh nghiệm", r["reason"])
        self.assertIn("Học vấn", r["reason"])

    def test_ambiguous_text_is_undecided(self):
        self.assertFalse(heuristic_verdict(AMBIGUOUS)["decided"])


class TestLlmFallback(unittest.TestCase):
    def test_llm_only_called_when_rules_are_unsure(self):
        from main import _file_text

        p = SAMPLES_DIR / "cv_backend_vi.pdf"
        text = _file_text(p.name, p.read_bytes())
        with mock.patch.object(cv_validator, "call_llm") as call:
            r = validate_cv_text(text)
        call.assert_not_called()
        self.assertEqual(r["method"], "heuristic")

    def test_llm_decides_ambiguous_text(self):
        reply = json.dumps({"is_cv": True, "doc_type": "cv", "confidence": 0.8, "reason": "CV ngắn."})
        with mock.patch.object(cv_validator, "call_llm", return_value=reply) as call:
            r = validate_cv_text(AMBIGUOUS)
        self.assertEqual(call.call_count, 1)
        self.assertTrue(r["is_cv"])
        self.assertEqual(r["method"], "llm")
        self.assertEqual(r["confidence"], 0.8)

    def test_llm_negative_verdict_keeps_doc_type(self):
        reply = json.dumps({"is_cv": False, "doc_type": "cover_letter", "confidence": 0.9, "reason": "Thư."})
        with mock.patch.object(cv_validator, "call_llm", return_value=reply):
            r = validate_cv_text(AMBIGUOUS)
        self.assertFalse(r["is_cv"])
        self.assertEqual(r["doc_type"], "cover_letter")
        self.assertIn("thư xin việc", r["reason"])

    def test_llm_error_falls_back_to_rule_score(self):
        with mock.patch.object(cv_validator, "call_llm", side_effect=ConnectionError("down")):
            r = validate_cv_text(AMBIGUOUS)
        self.assertEqual(r["method"], "heuristic_fallback")
        self.assertIsInstance(r["is_cv"], bool)

    def test_llm_garbage_falls_back(self):
        with mock.patch.object(cv_validator, "call_llm", return_value="không phải json"):
            r = validate_cv_text(AMBIGUOUS)
        self.assertEqual(r["method"], "heuristic_fallback")


class TestValidateEndpoint(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        from fastapi.testclient import TestClient
        import main

        cls.client = TestClient(main.app)

    def test_rejects_png_image(self):
        png = b"\x89PNG\r\n\x1a\n" + b"\x00" * 64
        res = self.client.post("/validate", files={"file": ("cv.pdf", png, "application/pdf")})
        self.assertEqual(res.status_code, 200)
        body = res.json()
        self.assertFalse(body["is_cv"])
        self.assertEqual(body["doc_type"], "image")

    def test_accepts_cv_pdf(self):
        p = SAMPLES_DIR / "cv_frontend_en.pdf"
        res = self.client.post(
            "/validate",
            files={"file": (p.name, p.read_bytes(), "application/pdf")},
            data={"use_llm": "false"},
        )
        self.assertEqual(res.status_code, 200)
        self.assertTrue(res.json()["is_cv"])

    def test_rejects_invoice_pdf(self):
        p = SAMPLES_DIR / "not_invoice_vi.pdf"
        res = self.client.post(
            "/validate",
            files={"file": (p.name, p.read_bytes(), "application/pdf")},
            data={"use_llm": "false"},
        )
        body = res.json()
        self.assertFalse(body["is_cv"])
        self.assertEqual(body["doc_type"], "invoice")
        self.assertIn("hóa đơn", body["reason"])

    def test_unsupported_extension_is_unreadable(self):
        res = self.client.post("/validate", files={"file": ("data.xlsx", b"PK\x03\x04abc", "application/octet-stream")})
        self.assertFalse(res.json()["is_cv"])
        self.assertEqual(res.json()["doc_type"], "unreadable")

    def test_text_form_field(self):
        res = self.client.post("/validate", data={"text": "Kinh nghiệm: 3 năm. " * 10, "use_llm": "false"})
        self.assertEqual(res.status_code, 200)

    def test_requires_file_or_text(self):
        res = self.client.post("/validate", data={"use_llm": "false"})
        self.assertEqual(res.status_code, 400)


if __name__ == "__main__":
    unittest.main()
