"""Unit tests — cv_content_extractor (PR-08): tách file CV thành content JSON cho editor; LLM giả lập."""
import json
import sys
import unittest
from pathlib import Path
from unittest import mock

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import cv_content_extractor as ex  # noqa: E402

SAMPLES = Path(__file__).resolve().parent / "fixtures" / "cv_content"


def rules(name):
    p = SAMPLES / name
    return ex.extract_cv_content(ex.file_lines_text(p.name, p.read_bytes()), use_llm=False)


class TestRuleExtractionOnSamples(unittest.TestCase):
    """Điều kiện xong của PR-08: CV mẫu tách đúng các mục chính (không cần LLM)."""

    def test_vietnamese_pdf(self):
        r = rules("cv_backend_vi.pdf")
        c = r["content"]
        self.assertEqual(r["method"], "rules")
        self.assertEqual(c["personalInfo"]["fullName"], "Nguyễn Minh Khoa")
        self.assertEqual(c["personalInfo"]["email"], "khoa.nguyen.dev@gmail.com")
        self.assertEqual(c["personalInfo"]["phone"], "0912 345 678")
        self.assertEqual(c["personalInfo"]["github"], "github.com/khoanm")
        self.assertEqual(c["personalInfo"]["website"], "", "không lấy tên miền của email làm website")
        self.assertIn("hệ thống phân tán", c["summary"])

        self.assertEqual(len(c["experiences"]), 2)
        first, second = c["experiences"]
        self.assertEqual(first["company"], "Công ty TNHH Phần mềm Sao Mai")
        self.assertEqual(first["position"], "Backend Developer")
        self.assertEqual((first["startDate"], first["endDate"], first["isCurrent"]), ("03/2022", "", True))
        self.assertEqual(len(first["bullets"]), 2)
        self.assertTrue(first["bullets"][0].startswith("Xây dựng REST API"))
        self.assertEqual((second["startDate"], second["endDate"], second["isCurrent"]), ("06/2021", "12/2021", False))

        edu = c["educations"][0]
        self.assertEqual(edu["institution"], "Đại học Bách khoa TP.HCM")
        self.assertEqual((edu["degree"], edu["fieldOfStudy"]), ("Kỹ sư", "Khoa học máy tính"))
        self.assertEqual((edu["startDate"], edu["endDate"], edu["gpa"]), ("2017", "2021", "3.4/4"))

        self.assertEqual(c["skills"], ["Node.js", "Express", "MongoDB", "PostgreSQL", "Docker", "Git"])
        self.assertEqual(c["projects"][0]["name"], "Hệ thống đặt vé xe khách")
        self.assertEqual(c["certifications"][0]["name"], "AWS Certified Developer — Associate")
        self.assertEqual(c["certifications"][0]["issueDate"], "2023")
        self.assertNotIn("Đọc sách", json.dumps(c, ensure_ascii=False), "mục Sở thích không lẫn vào mục khác")

    def test_english_pdf(self):
        c = rules("cv_frontend_en.pdf")["content"]
        self.assertEqual(c["personalInfo"]["fullName"], "Emily Tran")
        self.assertEqual(c["personalInfo"]["linkedin"], "linkedin.com/in/emilytran")
        self.assertEqual([e["company"] for e in c["experiences"]], ["BlueWave Studio", "Kite Software"])
        self.assertTrue(c["experiences"][0]["isCurrent"])
        self.assertEqual(c["educations"][0]["degree"], "Bachelor")
        self.assertEqual(c["educations"][0]["fieldOfStudy"], "Information Technology")
        self.assertIn("TypeScript", c["skills"])

    def test_docx(self):
        r = rules("cv_marketing_vi.docx")
        c = r["content"]
        self.assertEqual(c["personalInfo"]["fullName"], "Phạm Thu Trang")
        self.assertEqual(c["experiences"][0]["position"], "Digital Marketing Executive")
        self.assertEqual(c["educations"][0]["institution"], "Đại học Ngoại thương")
        self.assertEqual(c["skills"], ["Facebook Ads", "Google Ads", "Google Analytics", "Canva"])
        self.assertEqual(
            r["sections"], ["personalInfo", "summary", "experiences", "educations", "skills"]
        )


class TestNormalize(unittest.TestCase):
    def test_coerces_types_and_drops_empty_items(self):
        c = ex.normalize_content({
            "personalInfo": {"fullName": "  An  ", "unknown": "x"},
            "summary": ["dòng 1", "dòng 2"],
            "experiences": [
                {"company": "A", "isCurrent": 1, "endDate": "2024", "bullets": ["ok", "", None]},
                {"company": "", "position": ""},
                "rác",
            ],
            "skills": "React, react; Node",
            "certifications": [{"issuer": "chỉ có đơn vị cấp"}],
        })
        self.assertEqual(c["personalInfo"]["fullName"], "An")
        self.assertNotIn("unknown", c["personalInfo"])
        self.assertEqual(c["summary"], "dòng 1, dòng 2")
        self.assertEqual(len(c["experiences"]), 1)
        self.assertEqual(c["experiences"][0]["endDate"], "", "đang làm thì không có ngày kết thúc")
        self.assertEqual(c["experiences"][0]["bullets"], ["ok"])
        self.assertEqual(c["skills"], ["React", "Node"])
        self.assertEqual(c["certifications"], [])

    def test_clips_to_editor_limits(self):
        c = ex.normalize_content({"summary": "a" * 5000, "experiences": [{"company": "c" * 400}]})
        self.assertEqual(len(c["summary"]), 2000)
        self.assertEqual(len(c["experiences"][0]["company"]), 150)


class TestLlmPath(unittest.TestCase):
    TEXT = "NGUYỄN AN\nKINH NGHIỆM\nCông ty A — Dev (2020 - 2022)\nKỸ NĂNG\nPython"

    def test_uses_llm_result_when_valid(self):
        reply = json.dumps({
            "personalInfo": {"fullName": "Nguyễn An"},
            "experiences": [{"company": "Công ty A", "position": "Dev", "startDate": "2020", "endDate": "2022"}],
            "skills": ["Python"],
        })
        with mock.patch.object(ex, "call_llm", return_value=reply) as call:
            r = ex.extract_cv_content(self.TEXT)
        self.assertEqual(call.call_count, 1)
        self.assertEqual(r["method"], "llm")
        self.assertEqual(r["content"]["experiences"][0]["company"], "Công ty A")

    def test_falls_back_to_rules_on_llm_error(self):
        with mock.patch.object(ex, "call_llm", side_effect=TimeoutError("slow")):
            r = ex.extract_cv_content(self.TEXT)
        self.assertEqual(r["method"], "rules")
        self.assertEqual(r["content"]["experiences"][0]["company"], "Công ty A")

    def test_falls_back_when_llm_returns_nothing_useful(self):
        with mock.patch.object(ex, "call_llm", return_value=json.dumps({"personalInfo": {"fullName": "X"}})):
            r = ex.extract_cv_content(self.TEXT)
        self.assertEqual(r["method"], "rules")

    def test_empty_text_raises(self):
        with self.assertRaises(ValueError):
            ex.extract_cv_content("   ")


class TestExtractEndpoint(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        from fastapi.testclient import TestClient
        import main

        cls.client = TestClient(main.app)

    def test_pdf_returns_content(self):
        p = SAMPLES / "cv_backend_vi.pdf"
        res = self.client.post(
            "/extract-content",
            files={"file": (p.name, p.read_bytes(), "application/pdf")},
            data={"use_llm": "false"},
        )
        self.assertEqual(res.status_code, 200)
        body = res.json()
        self.assertEqual(body["method"], "rules")
        self.assertEqual(len(body["content"]["experiences"]), 2)
        self.assertGreater(body["text_chars"], 100)

    def test_unsupported_file_is_400(self):
        res = self.client.post("/extract-content", files={"file": ("a.png", b"\x89PNG\r\n", "image/png")})
        self.assertEqual(res.status_code, 400)
        self.assertIn("PDF, DOCX hoặc TXT", res.json()["detail"])

    def test_broken_pdf_is_400(self):
        res = self.client.post("/extract-content", files={"file": ("a.pdf", b"not a pdf", "application/pdf")})
        self.assertEqual(res.status_code, 400)


if __name__ == "__main__":
    unittest.main()
