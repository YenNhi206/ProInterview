"""
PR-03: sinh bộ 20 file mẫu (10 CV, 10 không phải CV) cho test_cv_validator.py.

Chạy lại khi sửa nội dung mẫu:
    cd cv_jd_matching && python tests/fixtures/cv_validation/build_samples.py

Tên file: `cv_*` là CV, `not_*` là không phải CV. Người và công ty trong mẫu là hư cấu.
PDF dùng font Arial của Windows (hoặc DejaVuSans trên Linux) để giữ dấu tiếng Việt.
"""

from __future__ import annotations

import io
import zipfile
from pathlib import Path
from xml.sax.saxutils import escape

import fitz  # PyMuPDF

OUT = Path(__file__).resolve().parent

SAMPLES: dict[str, str] = {
    # ── CV ───────────────────────────────────────────────────────────────────
    "cv_backend_vi.pdf": """NGUYỄN MINH KHOA
Backend Developer
Email: khoa.nguyen.dev@gmail.com | SĐT: 0912 345 678 | github.com/khoanm
MỤC TIÊU NGHỀ NGHIỆP
Trở thành kỹ sư backend vững về hệ thống phân tán trong 3 năm tới.
KINH NGHIỆM LÀM VIỆC
Công ty TNHH Phần mềm Sao Mai — Backend Developer (03/2022 - nay)
- Xây dựng REST API bằng Node.js, Express cho 200.000 người dùng.
- Giảm 40% thời gian phản hồi nhờ thêm Redis cache.
HỌC VẤN
Đại học Bách khoa TP.HCM — Kỹ sư Khoa học máy tính (2017 - 2021), GPA 3.4/4
KỸ NĂNG
Node.js, Express, MongoDB, PostgreSQL, Docker, Git, làm việc nhóm
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
EDUCATION
RMIT University Vietnam — Bachelor of Information Technology (2016 - 2020)
SKILLS
React, TypeScript, Next.js, Tailwind CSS, Jest, Figma
CERTIFICATIONS
AWS Certified Cloud Practitioner (2023)
""",
    "cv_fresher_vi.pdf": """TRẦN THỊ BẢO NGỌC
Sinh viên năm cuối — Thực tập sinh Data Analyst
Ngày sinh: 12/05/2003 | Điện thoại: 0987 654 321 | Email: ngoc.ttb@student.edu.vn
HỌC VẤN
Trường Đại học Kinh tế TP.HCM — Hệ thống thông tin quản lý (2021 - 2025), GPA 3.6/4
DỰ ÁN
Phân tích doanh số chuỗi cà phê (đồ án môn học): làm sạch 50.000 dòng dữ liệu bằng Python,
dựng dashboard Power BI cho 3 chỉ số chính.
KỸ NĂNG
Python (pandas), SQL, Power BI, Excel, thuyết trình
HOẠT ĐỘNG NGOẠI KHÓA
Trưởng ban truyền thông CLB Data Science (2023)
NGOẠI NGỮ
Tiếng Anh IELTS 6.5
""",
    "cv_accountant_vi.pdf": """LÊ VĂN HẢI
Kế toán tổng hợp
Email: haile.ketoan@yahoo.com | SĐT: 0909 111 222 | Quận 7, TP.HCM
KINH NGHIỆM LÀM VIỆC
Công ty CP Thương mại Phú An — Kế toán tổng hợp (2019 - nay)
- Đối chiếu hóa đơn đầu vào, đầu ra và kê khai thuế GTGT hàng tháng.
- Lập báo cáo tài chính quý, làm việc với kiểm toán độc lập.
Công ty TNHH Gia Phát — Kế toán viên (2017 - 2019)
- Theo dõi công nợ phải thu, phải trả.
HỌC VẤN
Học viện Tài chính — Cử nhân Kế toán (2013 - 2017)
KỸ NĂNG
MISA, Excel nâng cao, nghiệp vụ thuế, cẩn thận và trung thực
CHỨNG CHỈ
Chứng chỉ Kế toán trưởng (2021)
""",
    "cv_designer_en.pdf": """MARCUS PHAM — UI/UX DESIGNER
behance.net/marcuspham · marcus.pham.design@gmail.com · 0935 444 555
PROFILE
Product designer focused on fintech and e-commerce mobile apps.
EXPERIENCE
Lumen Digital — UI/UX Designer (2020 - 2024)
Redesigned checkout flow, increasing conversion by 18%.
EDUCATION
Van Lang University — Bachelor of Graphic Design (2016 - 2020)
SKILLS
Figma, Adobe XD, user research, prototyping, design systems
AWARDS
Vietnam Design Week 2022 — Shortlist
""",
    "cv_marketing_vi.pdf": """PHẠM THU TRANG
Chuyên viên Digital Marketing
0976 888 999 · trang.pham.mkt@gmail.com · Hà Nội
GIỚI THIỆU BẢN THÂN
3 năm kinh nghiệm chạy quảng cáo Facebook, Google cho ngành mỹ phẩm.
QUÁ TRÌNH LÀM VIỆC
Công ty CP Mỹ phẩm Hoa Sen — Digital Marketing Executive (2021 - nay)
- Quản lý ngân sách quảng cáo 300 triệu đồng/tháng, ROAS trung bình 4.2.
HỌC VẤN
Đại học Ngoại thương — Cử nhân Marketing (2016 - 2020)
KỸ NĂNG
Facebook Ads, Google Ads, Google Analytics, Canva, viết nội dung
""",
    "cv_sales_en.pdf": """CURRICULUM VITAE
David Hoang
Phone: +84 908 123 456 | Email: david.hoang.sales@gmail.com
OBJECTIVE
Seeking a B2B account manager role in the logistics industry.
PROFESSIONAL EXPERIENCE
Sunrise Logistics — Sales Executive (2019 - 2024)
Grew key accounts revenue from 2 to 5 billion VND per year.
EDUCATION
University of Economics HCMC — Bachelor of Business Administration (2015 - 2019)
SKILLS
Negotiation, CRM (Salesforce), English (TOEIC 850)
""",
    "cv_devops_vi.docx": """ĐỖ QUANG HUY
DevOps Engineer
Email: huy.do.ops@gmail.com — Điện thoại: 0911 222 333 — github.com/huydq
KINH NGHIỆM
Công ty Cổ phần Công nghệ Lạc Việt — DevOps Engineer (2020 - nay)
Dựng pipeline CI/CD bằng GitLab CI cho 25 dịch vụ, giảm thời gian release từ 2 giờ xuống 15 phút.
Vận hành cụm Kubernetes trên AWS EKS.
HỌC VẤN
Đại học Công nghệ — ĐHQG Hà Nội, Kỹ sư Mạng máy tính (2014 - 2018)
KỸ NĂNG
Kubernetes, Docker, Terraform, AWS, Linux, Prometheus, Grafana
CHỨNG CHỈ
CKA — Certified Kubernetes Administrator
""",
    "cv_teacher_vi.docx": """VÕ THỊ MAI
Giáo viên Tiếng Anh
Liên hệ: 0938 765 432 | mai.vo.teacher@gmail.com
KINH NGHIỆM GIẢNG DẠY
Trung tâm Anh ngữ Ánh Dương — Giáo viên IELTS (2018 - nay)
Giảng dạy 15 lớp IELTS, 70% học viên đạt band 6.5 trở lên.
HỌC VẤN
Đại học Sư phạm TP.HCM — Cử nhân Sư phạm Tiếng Anh (2014 - 2018)
KỸ NĂNG
Thiết kế giáo án, quản lý lớp học, IELTS 8.0
""",
    "cv_minimal_en.txt": """John Le
john.le.qa@gmail.com | 0901 777 888

Experience
QA Engineer, Kite Software (2021 - 2024): wrote 400 automated test cases with Playwright.

Education
FPT University, Software Engineering (2017 - 2021)

Skills
Playwright, Selenium, Postman, SQL, Agile
""",
    # ── Không phải CV ────────────────────────────────────────────────────────
    "not_invoice_vi.pdf": """HÓA ĐƠN GIÁ TRỊ GIA TĂNG
Ký hiệu: 1C24TAA  Số: 0001234  Ngày 15 tháng 03 năm 2024
Đơn vị bán hàng: Công ty TNHH Thiết bị Văn phòng Minh Tâm
Mã số thuế: 0312345678
Địa chỉ: 12 Nguyễn Trãi, Quận 1, TP.HCM  Điện thoại: 028 3822 1234
Tên người mua hàng: Công ty CP Phú An
STT  Tên hàng hóa, dịch vụ  Đơn vị tính  Số lượng  Đơn giá  Thành tiền
1  Giấy A4 Double A  Ram  50  75.000  3.750.000
2  Mực in HP 12A  Hộp  5  420.000  2.100.000
Cộng tiền hàng: 5.850.000  Thuế suất GTGT: 10%  Tiền thuế: 585.000
Tổng cộng tiền thanh toán: 6.435.000
Số tiền viết bằng chữ: Sáu triệu bốn trăm ba mươi lăm nghìn đồng
""",
    "not_jd_backend_vi.pdf": """TUYỂN DỤNG BACKEND DEVELOPER (NODE.JS)
Công ty Cổ phần Công nghệ Biển Xanh
MÔ TẢ CÔNG VIỆC
- Thiết kế và phát triển REST API cho nền tảng thương mại điện tử.
- Phối hợp với đội frontend và QA để phát hành tính năng mới.
YÊU CẦU ỨNG VIÊN
- Tốt nghiệp đại học chuyên ngành Công nghệ thông tin.
- Có ít nhất 2 năm kinh nghiệm với Node.js, MongoDB.
- Kỹ năng giao tiếp và làm việc nhóm tốt.
QUYỀN LỢI
- Mức lương: 20 - 30 triệu đồng, thưởng tháng 13.
- Bảo hiểm đầy đủ, 15 ngày phép mỗi năm.
CÁCH THỨC ỨNG TUYỂN
Gửi CV về email tuyendung@bienxanh.vn, tiêu đề "Backend - Họ tên". Hạn nộp hồ sơ: 30/06/2024.
Liên hệ: 0283 999 8888
""",
    "not_jd_en.docx": """We are hiring: Senior Data Engineer (Remote)
About us
Northstar Analytics helps retailers forecast demand.
Responsibilities
- Build and maintain batch and streaming pipelines.
- Own data quality checks for our warehouse.
Requirements
- 4+ years of experience with Python and SQL.
- Bachelor degree in Computer Science or related field.
- Strong skills in Spark and Airflow.
What we offer
- Competitive salary and equity.
- Flexible working hours.
How to apply
Send your resume to jobs@northstar.example with the subject "Data Engineer".
""",
    "not_cover_letter_vi.pdf": """THƯ XIN VIỆC
Hà Nội, ngày 10 tháng 4 năm 2024
Kính gửi: Phòng Nhân sự Công ty CP Công nghệ Biển Xanh
Tôi tên là Nguyễn Minh Khoa, tôi viết thư này để ứng tuyển vị trí Backend Developer được đăng
trên trang tuyển dụng của Quý công ty. Tôi đã có 2 năm kinh nghiệm phát triển API bằng Node.js,
có kỹ năng làm việc nhóm và tốt nghiệp Đại học Bách khoa.
Tôi tin rằng kinh nghiệm của mình phù hợp với yêu cầu công việc và mong được phỏng vấn
để trao đổi thêm. CV chi tiết được gửi kèm thư này.
Email: khoa.nguyen.dev@gmail.com — Điện thoại: 0912 345 678
Trân trọng,
Nguyễn Minh Khoa
""",
    "not_transcript_vi.pdf": """BẢNG ĐIỂM HỌC TẬP
Trường Đại học Kinh tế TP.HCM — Phòng Đào tạo
Họ tên sinh viên: Trần Thị Bảo Ngọc  Mã số sinh viên: 31211020123
Ngành: Hệ thống thông tin quản lý
Học kỳ 1 năm học 2023 - 2024
Mã môn  Tên học phần  Số tín chỉ  Điểm hệ 10  Điểm chữ
ISM301  Cơ sở dữ liệu  3  8.5  A
ISM305  Phân tích thiết kế hệ thống  3  8.0  B+
ECO201  Kinh tế vĩ mô  3  7.5  B
Điểm trung bình học kỳ: 8.0  Điểm trung bình tích lũy: 3.45
Xác nhận của Phòng Đào tạo
""",
    "not_contract_vi.pdf": """CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM
Độc lập - Tự do - Hạnh phúc
HỢP ĐỒNG LAO ĐỘNG
Số: 15/2024/HĐLĐ
Bên A (Người sử dụng lao động): Công ty TNHH Gia Phát, đại diện bởi ông Trần Văn Bình — Giám đốc
Bên B (Người lao động): Ông Lê Văn Hải, sinh ngày 02/09/1995
Hai bên thỏa thuận ký kết hợp đồng lao động với các điều khoản sau:
Điều 1. Thời hạn hợp đồng: 12 tháng kể từ ngày 01/01/2024.
Điều 2. Công việc: Kế toán viên tại phòng Tài chính.
Điều 3. Mức lương chính: 12.000.000 đồng/tháng.
Đại diện Bên A                Đại diện Bên B
""",
    "not_bank_statement_en.txt": """ACCOUNT STATEMENT
Sunrise Commercial Bank
Account holder: LE VAN HAI   Account number: 0123 4567 8901
Statement period: 01/03/2024 - 31/03/2024
Opening balance: 15,200,000 VND
Date        Description                 Debit        Credit       Balance
02/03/2024  Salary March                              12,000,000   27,200,000
05/03/2024  Electricity bill            850,000                    26,350,000
12/03/2024  ATM withdrawal              2,000,000                  24,350,000
Closing balance: 24,350,000 VND
For enquiries call 1900 1234.
""",
    "not_meeting_minutes_vi.docx": """BIÊN BẢN HỌP
Dự án ProShop — Họp kế hoạch sprint 12
Thời gian: 9h00 ngày 18/03/2024. Địa điểm: Phòng họp tầng 5.
Thành phần tham dự: anh Bình (chủ trì), chị Trang, anh Huy, chị Mai.
Nội dung cuộc họp:
1. Đánh giá sprint 11: hoàn thành 34/40 điểm, còn 2 lỗi thanh toán.
2. Kế hoạch sprint 12: ưu tiên trang giỏ hàng và tích hợp đơn vị vận chuyển.
3. Phân công: Huy phụ trách hạ tầng, Mai viết tài liệu hướng dẫn.
Biên bản kết thúc lúc 10h30.
""",
    "not_report_vi.pdf": """BÁO CÁO ĐỒ ÁN TỐT NGHIỆP
Đề tài: Ứng dụng học máy dự đoán tỷ lệ khách hàng rời bỏ
Tóm tắt đề tài
Đồ án xây dựng mô hình dự đoán khách hàng rời bỏ dịch vụ viễn thông trên 7.000 bản ghi.
Chương 1. Tổng quan
Giới thiệu bài toán và các nghiên cứu liên quan.
Chương 2. Phương pháp nghiên cứu
So sánh hồi quy logistic, random forest và XGBoost.
Chương 3. Kết quả thực nghiệm
XGBoost đạt AUC 0.86.
Kết luận
Mô hình có thể áp dụng để ưu tiên chăm sóc khách hàng.
Tài liệu tham khảo
[1] Chen, T. & Guestrin, C. (2016). XGBoost: A Scalable Tree Boosting System.
""",
    "not_recipe_vi.txt": """CÔNG THỨC PHỞ BÒ HÀ NỘI
Khẩu phần: 4 người
Nguyên liệu
- 1,5 kg xương ống bò, 500 g thịt bò thăn
- 1 củ gừng, 2 củ hành tây, quế, hồi, thảo quả
- 800 g bánh phở tươi, hành lá, rau thơm
Cách làm
1. Chần xương bò qua nước sôi, rửa sạch.
2. Nướng gừng và hành tây cho thơm, cho vào nồi cùng xương, ninh 6 tiếng.
3. Rang quế, hồi, thảo quả rồi thả vào nồi nước dùng trong 30 phút cuối.
4. Trụng bánh phở, xếp thịt bò thái mỏng, chan nước dùng thật nóng.
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
    rect = fitz.Rect(50, 50, 545, 800)
    kwargs = {"fontsize": 10.5, "fontname": "body"}
    if font:
        kwargs["fontfile"] = font
    else:
        kwargs["fontname"] = "helv"
    overflow = page.insert_textbox(rect, text.strip(), **kwargs)
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
    content_types = (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
        '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
        '<Default Extension="xml" ContentType="application/xml"/>'
        '<Override PartName="/word/document.xml" '
        'ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>'
        "</Types>"
    )
    rels = (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
        '<Relationship Id="rId1" '
        'Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" '
        'Target="word/document.xml"/></Relationships>'
    )
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as z:
        z.writestr("[Content_Types].xml", content_types)
        z.writestr("_rels/.rels", rels)
        z.writestr("word/document.xml", document)
    path.write_bytes(buf.getvalue())


def main() -> None:
    for name, text in SAMPLES.items():
        path = OUT / name
        if name.endswith(".pdf"):
            write_pdf(path, text)
        elif name.endswith(".docx"):
            write_docx(path, text)
        else:
            path.write_text(text.strip() + "\n", encoding="utf-8")
        print(f"  {name}")
    print(f"Wrote {len(SAMPLES)} files to {OUT}")


if __name__ == "__main__":
    main()
