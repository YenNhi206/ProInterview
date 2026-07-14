"""Unit tests — phân tích CV theo ngành (field_analyzer)."""
import sys
import unittest
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from field_analyzer import (  # noqa: E402
    INDUSTRY_SKILLS,
    _heuristic_match,
    _heuristic_pipeline,
    _llm_to_pipeline,
    analyze_cv_by_field,
)

# Nhãn FE (CVAnalysis.jsx FIELDS)
FE_FIELDS = [
    "IT / Công nghệ",
    "Marketing",
    "Tài chính / Kế toán",
    "Nhân sự",
    "Quản lý sản phẩm",
    "Thiết kế / UX",
    "Kinh doanh",
    "Vận hành",
    "Biên - Phiên dịch / Ngoại ngữ",
]


class TestHeuristicMatch(unittest.TestCase):
    def test_finds_skills_in_it_field(self):
        matched, missing, score = _heuristic_match(
            ["react", "python", "git"],
            "IT / Công nghệ",
        )
        self.assertIn("react", matched)
        self.assertIn("python", matched)
        self.assertGreater(score, 0)
        self.assertLessEqual(score, 100)

    def test_unknown_field_defaults_to_it_bucket(self):
        matched_u, _, score_u = _heuristic_match(["react"], "Ngành không tồn tại")
        matched_it, _, score_it = _heuristic_match(["react"], "IT / Công nghệ")
        self.assertEqual(matched_u, matched_it)
        self.assertEqual(score_u, score_it)

    def test_score_never_exceeds_100(self):
        all_skills = list(INDUSTRY_SKILLS["Marketing"])
        _, _, score = _heuristic_match(all_skills, "Marketing")
        self.assertLessEqual(score, 100)


class TestHeuristicPipeline(unittest.TestCase):
    def test_pipeline_shape_for_frontend(self):
        out = _heuristic_pipeline("cv text", ["seo"], "Marketing")
        self.assertEqual(out["jd_text"], "")
        self.assertEqual(out["field"], "Marketing")
        self.assertEqual(out["analysis_mode"], "field")
        self.assertTrue(out["_fallback"])
        self.assertIn("match_score", out["match"])
        self.assertIn("executive_summary", out["suggestions"])
        self.assertGreaterEqual(len(out["suggestions"]["missing_skill_suggestions"]), 0)


class TestLlmToPipeline(unittest.TestCase):
    def test_maps_gemini_style_json(self):
        data = {
            "matchScore": 72,
            "totalKeywords": 10,
            "matchedKeywords": ["react", "typescript"],
            "missingKeywords": ["docker"],
            "scores": {"clarity": 8, "structure": 7, "relevance": 9, "credibility": 6},
            "scoreNotes": {"clarity": "Tốt"},
            "strengths": ["Mạnh FE"],
            "weaknesses": ["Thiếu DevOps"],
            "suggestions": [
                {
                    "type": "add",
                    "priority": "high",
                    "title": "Docker",
                    "reason": "Cần cho IT",
                    "before": "",
                    "after": "Học Docker",
                }
            ],
            "summary": "CV khá tốt",
            "position": "Frontend Developer",
        }
        out = _llm_to_pipeline(data, "cv", "IT / Công nghệ", ["react"])
        self.assertEqual(out["match"]["match_score"], 72)
        self.assertEqual(out["field"], "IT / Công nghệ")
        self.assertEqual(len(out["suggestions"]["missing_skill_suggestions"]), 1)
        self.assertFalse(out.get("_fallback"))


class TestAnalyzeCvByField(unittest.TestCase):
    def test_fallback_when_llm_unavailable(self):
        with patch("field_analyzer.call_llm", side_effect=ConnectionError("no ollama")):
            out = analyze_cv_by_field(
                "Senior React developer",
                ["react", "javascript"],
                "IT / Công nghệ",
            )
        self.assertTrue(out.get("_fallback"))
        self.assertGreater(out["match"]["match_score"], 0)
        self.assertEqual(out["resume_text"], "Senior React developer")


class TestIndustryCatalog(unittest.TestCase):
    def test_all_fe_fields_have_skill_list(self):
        for label in FE_FIELDS:
            self.assertIn(label, INDUSTRY_SKILLS, msg=f"Thiếu ngành: {label}")
            self.assertGreaterEqual(len(INDUSTRY_SKILLS[label]), 5)


if __name__ == "__main__":
    unittest.main()
