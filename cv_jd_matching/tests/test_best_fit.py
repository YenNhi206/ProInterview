"""Unit tests — best_fit (PR-05): xếp hạng nhiều CV với một JD; LLM giả lập."""
import io
import json
import sys
import time
import unittest
import zipfile
from pathlib import Path
from unittest import mock

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import best_fit  # noqa: E402

JD = "Tuyển Backend Engineer: Python, Docker, PostgreSQL, Kubernetes, REST API, CI/CD. Có kinh nghiệm tối ưu hiệu năng."
CVS = [
    {"id": "a", "title": "CV Frontend", "text": "Frontend developer: React, TypeScript, CSS, Figma."},
    {"id": "b", "title": "CV Backend", "text": "Backend engineer 3 năm: Python, Docker, PostgreSQL, Kubernetes, REST API, CI/CD. Giảm 40% độ trễ API."},
    {"id": "c", "title": "CV Fullstack", "text": "Fullstack: Python, React, Docker, MongoDB."},
]


def llm_reply(results):
    return json.dumps({"results": results})


class TestBestFit(unittest.TestCase):
    def test_llm_ranking_blends_scores_and_orders(self):
        reply = llm_reply([
            {"id": "a", "score": 20, "reason": "Thiên về frontend.", "strengths": ["React"], "gaps": ["Python"]},
            {"id": "b", "score": 92, "reason": "Đủ kỹ năng backend, có số liệu.", "strengths": ["Python"], "gaps": []},
            {"id": "c", "score": 60, "reason": "Có Python nhưng thiếu Kubernetes.", "strengths": [], "gaps": ["Kubernetes"]},
        ])
        with mock.patch.object(best_fit, "call_llm", return_value=reply) as call:
            out = best_fit.rank_cvs(JD, [dict(c, error=None) for c in CVS])
        self.assertEqual(call.call_count, 1, "một lượt LLM cho cả bộ CV")
        self.assertEqual(out["mode"], "llm")
        ids = [r["id"] for r in out["ranking"]]
        self.assertEqual(ids[0], "b")
        self.assertEqual([r["rank"] for r in out["ranking"]], [1, 2, 3])
        top = out["ranking"][0]
        self.assertEqual(top["llm_score"], 92)
        self.assertEqual(top["score"], round(0.7 * 92 + 0.3 * top["skill_score"]))
        for r in out["ranking"]:
            self.assertTrue(r["reason"])

    def test_llm_error_falls_back_to_skills(self):
        with mock.patch.object(best_fit, "call_llm", side_effect=TimeoutError("timeout")):
            out = best_fit.rank_cvs(JD, [dict(c, error=None) for c in CVS])
        self.assertEqual(out["mode"], "skills")
        self.assertIn("timeout", out["llm_error"])
        self.assertEqual(out["ranking"][0]["id"], "b")
        for r in out["ranking"]:
            self.assertIsNone(r["llm_score"])
            self.assertTrue(r["reason"].startswith("Khớp "))

    def test_partial_llm_output_is_discarded(self):
        reply = llm_reply([{"id": "a", "score": 99, "reason": "x"}, {"id": "zzz", "score": 50, "reason": "id lạ"}])
        with mock.patch.object(best_fit, "call_llm", return_value=reply):
            out = best_fit.rank_cvs(JD, [dict(c, error=None) for c in CVS])
        self.assertEqual(out["mode"], "skills")
        self.assertTrue(all(r["llm_score"] is None for r in out["ranking"]))

    def test_unreadable_cv_goes_last_with_error(self):
        cvs = [dict(CVS[0], error=None), {"id": "x", "title": "Ảnh", "text": "", "error": "Không đọc được PDF"}, dict(CVS[1], error=None)]
        with mock.patch.object(best_fit, "call_llm", return_value=llm_reply([
            {"id": "a", "score": 30, "reason": "r"}, {"id": "b", "score": 90, "reason": "r"},
        ])) as call:
            out = best_fit.rank_cvs(JD, cvs)
        last = out["ranking"][-1]
        self.assertEqual(last["id"], "x")
        self.assertIsNone(last["score"])
        self.assertEqual(last["error"], "Không đọc được PDF")
        self.assertNotIn("id=x", call.call_args.args[1], "CV lỗi không gửi lên LLM")

    def test_three_cvs_within_budget(self):
        with mock.patch.object(best_fit, "call_llm", return_value=llm_reply([
            {"id": c["id"], "score": 50, "reason": "r"} for c in CVS
        ])):
            started = time.monotonic()
            best_fit.rank_cvs(JD, [dict(c, error=None) for c in CVS])
            self.assertLess(time.monotonic() - started, 5, "phần không phải LLM phải nhanh")
        self.assertLessEqual(best_fit.LLM_TIMEOUT_S, 60)

    def test_docx_text(self):
        buf = io.BytesIO()
        with zipfile.ZipFile(buf, "w") as z:
            z.writestr("word/document.xml", "<w:document><w:body><w:p><w:r><w:t>Kinh nghiệm &amp; Python</w:t></w:r></w:p>"
                                            "<w:p><w:r><w:t>Docker</w:t></w:r></w:p></w:body></w:document>")
        self.assertEqual(best_fit.docx_text(buf.getvalue()), "Kinh nghiệm & Python\nDocker")


if __name__ == "__main__":
    unittest.main()
