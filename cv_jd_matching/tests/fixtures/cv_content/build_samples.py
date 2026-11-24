"""
PR-08: sinh CV mẫu cho test_cv_content_extractor.py.

Chạy lại khi sửa nội dung mẫu:
    cd cv_jd_matching && python tests/fixtures/cv_content/build_samples.py

Người và công ty trong mẫu là hư cấu. PDF dùng font Arial của Windows (hoặc DejaVuSans trên Linux)
để giữ dấu tiếng Việt.
"""

from __future__ import annotations

import io
import zipfile
from pathlib import Path
from xml.sax.saxutils import escape

import fitz  # PyMuPDF

OUT = Path(__file__).resolve().parent

SAMPLES: dict[str, str] = {
    "cv_backend_vi.pdf": """NGUYỄN MINH KHOA
Backend Developer
Email: khoa.nguyen.dev@gmail.com | SĐT: 0912 345 678 | github.com/khoanm
Địa chỉ: Quận Bình Thạnh, TP.HCM
MỤC TIÊU NGHỀ NGHIỆP
Trở thành kỹ sư backend vững về hệ thống phân tán trong 3 năm tới.
KINH NGHIỆM LÀM VIỆC
Công ty TNHH Phần mềm Sao Mai — Backend Developer (03/2022 - nay)
- Xây dựng REST API bằng Node.js, Express cho 200.000 người dùng.
- Giảm 40% thời gian phản hồi nhờ thêm Redis cache.
Công ty CP Công nghệ Lạc Hồng — Thực tập sinh Backend (06/2021 - 12/2021)
- Viết unit test cho module thanh toán.
HỌC VẤN
Đại học Bách khoa TP.HCM — Kỹ sư Khoa học máy tính (2017 - 2021), GPA 3.4/4
KỸ NĂNG
Node.js, Express, MongoDB, PostgreSQL, Docker, Git
DỰ ÁN
Hệ thống đặt vé xe khách: API đặt chỗ realtime bằng Socket.IO, 5.000 lượt đặt mỗi ngày.
CHỨNG CHỈ
AWS Certified Developer — Associate (2023)
SỞ THÍCH
Đọc sách, chạy bộ
""",
    "cv_frontend_en.pdf": """EMILY TRAN
Frontend Engineer
emily.tran@outlook.com · +84 903 222 111 · linkedin.com/in/emilytran
SUMMARY
Frontend engineer with 4 years building accessible React applications.
WORK EXPERIENCE
BlueWave Studio — Senior Frontend Engineer (2021 - Present)
• Led migration from Angular to React, cutting bundle size by 35%.
• Mentored 3 junior developers.
Kite Software — Frontend Developer (2019 - 2021)
• Built the design system used by 4 product teams.
EDUCATION
RMIT University Vietnam — Bachelor of Information Technology (2016 - 2020)
SKILLS
React, TypeScript, Next.js, Tailwind CSS, Jest
CERTIFICATIONS
AWS Certified Cloud Practitioner (2023)
""",
    "cv_marketing_vi.docx": """PHẠM THU TRANG
Chuyên viên Digital Marketing
0976 888 999 · trang.pham.mkt@gmail.com
GIỚI THIỆU BẢN THÂN
3 năm kinh nghiệm chạy quảng cáo Facebook, Google cho ngành mỹ phẩm.
KINH NGHIỆM
Công ty CP Mỹ phẩm Hoa Sen — Digital Marketing Executive (2021 - nay)
- Quản lý ngân sách quảng cáo 300 triệu đồng/tháng, ROAS trung bình 4.2.
HỌC VẤN
Đại học Ngoại thương — Cử nhân Marketing (2016 - 2020)
KỸ NĂNG
Facebook Ads; Google Ads; Google Analytics; Canva
""",
}


def _font_path() -> str | None:
    for cand in (
        "C:/Windows/Fonts/arial.ttf",
        "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
        "/Library/Fonts/Arial Unicode.ttf",
    ):
        if Path(cand).exists():
            return cand
    return None


def write_pdf(path: Path, text: str) -> None:
    font = _font_path()
    doc = fitz.open()
    page = doc.new_page(width=595, height=842)  # A4
    kwargs = {"fontsize": 10.5, "fontname": "body", "fontfile": font} if font else {"fontsize": 10.5, "fontname": "helv"}
    overflow = page.insert_textbox(fitz.Rect(50, 50, 545, 800), text.strip(), **kwargs)
    if overflow < 0:
        raise ValueError(f"{path.name}: text does not fit on one page")
    doc.save(path, garbage=4, deflate=True)
    doc.close()


def write_docx(path: Path, text: str) -> None:
    paras = "".join(
        f'<w:p><w:r><w:t xml:space="preserve">{escape(line)}</w:t></w:r></w:p>'
        for line in text.strip().splitlines()
    )
    document = (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">'
        f"<w:body>{paras}</w:body></w:document>"
    )
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as z:
        z.writestr("word/document.xml", document)
    path.write_bytes(buf.getvalue())


def main() -> None:
    for name, text in SAMPLES.items():
        path = OUT / name
        write_pdf(path, text) if name.endswith(".pdf") else write_docx(path, text)
        print(f"  {name}")
    print(f"Wrote {len(SAMPLES)} files to {OUT}")


if __name__ == "__main__":
    main()
