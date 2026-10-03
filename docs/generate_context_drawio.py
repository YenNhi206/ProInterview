"""Generate the editable, three-page ProInterview draw.io diagram."""

from pathlib import Path
from xml.etree.ElementTree import Element, SubElement, ElementTree, indent


OUTPUT = Path(__file__).with_name("PROINTERVIEW_CONTEXT.drawio")

ROOT = Element(
    "mxfile",
    {
        "host": "app.diagrams.net",
        "agent": "ProInterview documentation",
        "version": "24.7.17",
        "type": "device",
    },
)


def page(page_id, name, width, height):
    diagram = SubElement(ROOT, "diagram", {"id": page_id, "name": name})
    model = SubElement(
        diagram,
        "mxGraphModel",
        {
            "dx": "1800",
            "dy": "1100",
            "grid": "1",
            "gridSize": "10",
            "guides": "1",
            "tooltips": "1",
            "connect": "1",
            "arrows": "1",
            "fold": "1",
            "page": "1",
            "pageScale": "1",
            "pageWidth": str(width),
            "pageHeight": str(height),
            "math": "0",
            "shadow": "0",
        },
    )
    cells = SubElement(model, "root")
    SubElement(cells, "mxCell", {"id": "0"})
    SubElement(cells, "mxCell", {"id": "1", "parent": "0"})
    return cells


def node(cells, node_id, label, x, y, width, height, kind="external"):
    palette = {
        "actor": ("#EFF6FF", "#2563EB", "#172554"),
        "planned": ("#F4E9FF", "#7C3AED", "#3B0764"),
        "system": ("#1F1B4B", "#6D4AFF", "#FFFFFF"),
        "system_panel": ("#1F1B4B", "#6D4AFF", "#FFFFFF"),
        "external": ("#F4F7FC", "#64748B", "#0F172A"),
        "internal": ("#E8F4FF", "#0284C7", "#0C4A6E"),
        "process": ("#F4E9FF", "#7C3AED", "#3B0764"),
        "store": ("#ECFDF5", "#059669", "#064E3B"),
        "source": ("#FFF7ED", "#EA580C", "#7C2D12"),
        "plain": ("none", "none", "#334155"),
    }
    fill, stroke, font = palette[kind]
    shape = "ellipse" if kind == "system" else "shape=cylinder" if kind == "store" else "rounded=1;arcSize=14"
    style = (
        f"{shape};whiteSpace=wrap;html=1;fillColor={fill};strokeColor={stroke};"
        f"strokeWidth={3 if kind in ('system', 'system_panel') else 2};fontColor={font};"
        f"fontFamily=Arial;fontSize={27 if kind in ('system', 'system_panel') else 18};"
        "fontStyle=0;align=center;verticalAlign=middle;spacing=12;"
    )
    if kind == "plain":
        style += "strokeColor=none;fillColor=none;fontSize=16;"
    cell = SubElement(
        cells,
        "mxCell",
        {"id": node_id, "value": label, "style": style, "vertex": "1", "parent": "1"},
    )
    SubElement(
        cell,
        "mxGeometry",
        {"x": str(x), "y": str(y), "width": str(width), "height": str(height), "as": "geometry"},
    )


def edge(
    cells, edge_id, source, target, label="", color="#64748B", planned=False,
    both=False, exit_x=None, exit_y=None, entry_x=None, entry_y=None,
):
    style = (
        "html=1;rounded=1;strokeWidth=2;"
        f"strokeColor={color};fontColor={color};fontFamily=Arial;fontSize=15;"
        "labelBackgroundColor=#FFFFFF;endArrow=classic;endFill=1;"
    )
    if both:
        style += "startArrow=classic;startFill=1;"
    if planned:
        style += "dashed=1;dashPattern=8 5;"
    for name, value in (("exitX", exit_x), ("exitY", exit_y), ("entryX", entry_x), ("entryY", entry_y)):
        if value is not None:
            style += f"{name}={value};"
    if exit_x is not None or exit_y is not None:
        style += "exitPerimeter=0;"
    if entry_x is not None or entry_y is not None:
        style += "entryPerimeter=0;"
    cell = SubElement(
        cells,
        "mxCell",
        {
            "id": edge_id,
            "value": label,
            "style": style,
            "edge": "1",
            "parent": "1",
            "source": source,
            "target": target,
        },
    )
    SubElement(cell, "mxGeometry", {"relative": "1", "as": "geometry"})


# Page 1: one system boundary with distinct candidate information flows.
p = page("context", "01 - Context Diagram", 2700, 1900)
node(p, "title", "<b>PROINTERVIEW · CONTEXT DIAGRAM (DFD MỨC 0)</b>", 560, 30, 1600, 65, "plain")
node(p, "col_people", "NGƯỜI DÙNG", 130, 130, 470, 50, "plain")
node(p, "col_services", "DỊCH VỤ BÊN NGOÀI", 1980, 130, 540, 50, "plain")

node(
    p, "candidate",
    "<b>ỨNG VIÊN</b><br/><br/>8 nhóm trao đổi dữ liệu với hệ thống.<br/>Mỗi đường nối là một nhóm nghiệp vụ riêng.<br/><br/>Xem trang 02 để đọc luồng chi tiết.",
    100, 260, 540, 760, "actor",
)
node(p, "mentor", "<b>MENTOR</b><br/>Lịch rảnh · tư vấn · tạo khóa học", 100, 1110, 540, 130, "actor")
node(p, "admin", "<b>ADMIN</b><br/>Quản lý · duyệt mentor · thanh toán", 100, 1330, 540, 130, "actor")
node(p, "reviewer", "<b>KIỂM DUYỆT VIÊN</b><br/>Câu hỏi · CV-JD · Review Queue · Quality", 100, 1550, 540, 145, "planned")
node(
    p, "system",
    "<b>0. PROINTERVIEW</b><br/><br/>Tài khoản &amp; hồ sơ<br/>CV-JD &amp; phỏng vấn AI<br/>Mentor &amp; booking<br/>Khóa học &amp; thanh toán<br/>Đánh giá &amp; thông báo",
    1120, 260, 460, 760, "system_panel",
)

external = [
    ("google", "<b>GOOGLE SIGN-IN</b><br/>Đăng nhập &amp; xác thực", "Đăng nhập ↔ xác thực"),
    ("llm", "<b>NHÀ CUNG CẤP LLM</b><br/>Câu hỏi · chấm điểm · gợi ý", "Prompt ↔ kết quả AI"),
    ("vision", "<b>GOOGLE VISION / HUME</b><br/>Phân tích hình ảnh / cảm xúc", "Ảnh ↔ phân tích"),
    ("did", "<b>D-ID</b><br/>Avatar phỏng vấn", "Kịch bản ↔ avatar"),
    ("cloudinary", "<b>CLOUDINARY</b><br/>Ảnh · CV · âm thanh · video", "Tệp ↔ URL lưu trữ"),
    ("speech", "<b>ASSEMBLYAI / ELEVENLABS</b><br/>Giọng nói &amp; bản chép lời", "Âm thanh ↔ văn bản"),
    ("payment", "<b>VNPAY / SEPAY</b><br/>Thanh toán &amp; webhook", "Giao dịch ↔ trạng thái"),
    ("smtp", "<b>SMTP</b><br/>Email xác thực và thông báo", "Gửi email"),
    ("meeting", "<b>JITSI / JAAS</b><br/>Phòng tư vấn trực tuyến", "Mở phòng ↔ phiên họp"),
]
for index, (key, label, flow) in enumerate(external):
    node(p, key, label, 1980, 210 + index * 165, 550, 105, "external")
    edge(
        p, f"e_{key}", "system", key, flow, both=key != "smtp",
        exit_x=1, exit_y=round(0.08 + index * 0.105, 3), entry_x=0, entry_y=0.5,
    )

candidate_flows = [
    "1 · Đăng nhập ↔ hồ sơ / phiên",
    "2 · CV/JD ↔ điểm khớp / gợi ý",
    "3 · Phỏng vấn AI ↔ câu hỏi / phản hồi",
    "4 · Tìm mentor ↔ hồ sơ / lịch trống",
    "5 · Booking / họp ↔ xác nhận / lịch",
    "6 · Khóa học ↔ bài học / tiến độ",
    "7 · Gói / thanh toán ↔ hóa đơn",
    "8 · Đánh giá / báo cáo ↔ thông báo",
]
for index, flow in enumerate(candidate_flows):
    port_y = round(0.10 + index * 0.113, 3)
    edge(
        p, f"e_candidate_{index+1}", "candidate", "system", flow,
        "#2563EB", both=True, exit_x=1, exit_y=port_y, entry_x=0, entry_y=port_y,
    )

edge(p, "e_mentor", "mentor", "system", "Lịch / nội dung ↔ booking / thu nhập", "#2563EB", both=True, exit_x=1, exit_y=0.5, entry_x=0.22, entry_y=1)
edge(p, "e_admin", "admin", "system", "Quản lý ↔ báo cáo", "#2563EB", both=True, exit_x=1, exit_y=0.5, entry_x=0.5, entry_y=1)
edge(p, "e_reviewer", "reviewer", "system", "Duyệt/từ chối ↔ hàng chờ", "#7C3AED", planned=True, both=True, exit_x=1, exit_y=0.5, entry_x=0.78, entry_y=1)
node(
    p,
    "context_note",
    "Nét đứt màu tím: Kiểm duyệt viên là tính năng dự kiến. Frontend, backend, FastAPI CV-JD và MongoDB nằm trong ProInterview.",
    530,
    1790,
    1650,
    55,
    "plain",
)


# Page 2: candidate journey, preserving the eight distinct context-level exchanges.
p = page("candidate_detail", "02 - Ung vien chi tiet", 2600, 1900)
node(p, "candidate_title", "<b>ỨNG VIÊN · CÁC LUỒNG TƯƠNG TÁC CHI TIẾT</b>", 550, 30, 1500, 65, "plain")
node(p, "internal_heading", "CHỨC NĂNG TRONG PROINTERVIEW", 820, 125, 630, 45, "plain")
node(p, "provider_heading", "DỊCH VỤ / DỮ LIỆU LIÊN QUAN", 1870, 125, 580, 45, "plain")
node(
    p, "candidate_actor", "<b>ỨNG VIÊN</b><br/><br/>Chủ động gửi yêu cầu,<br/>nhận kết quả và<br/>theo dõi tiến trình",
    100, 210, 390, 1380, "actor",
)

candidate_processes = [
    ("account", "<b>1. TÀI KHOẢN &amp; HỒ SƠ</b><br/>Đăng ký, xác thực, đăng nhập, cập nhật hồ sơ", "Thông tin tài khoản ↔ phiên đăng nhập"),
    ("cv", "<b>2. PHÂN TÍCH CV-JD</b><br/>Tải PDF, đối chiếu JD, xem điểm và gợi ý", "CV/JD ↔ điểm khớp, kỹ năng, gợi ý"),
    ("interview", "<b>3. PHỎNG VẤN AI</b><br/>Chọn CV/vị trí, trả lời, nhận điểm và lịch sử", "Thiết lập/câu trả lời ↔ phản hồi"),
    ("mentor_search", "<b>4. TÌM MENTOR &amp; ĐẶT LỊCH</b><br/>Xem hồ sơ/lịch trống, đặt, đổi hoặc hủy lịch", "Tìm/đặt lịch ↔ mentor, lịch trống"),
    ("mentor_meeting", "<b>5. HỌP &amp; ĐÁNH GIÁ MENTOR</b><br/>Vào phòng, đánh giá, báo vắng nếu cần", "Tham gia/đánh giá ↔ thông tin buổi họp"),
    ("learning", "<b>6. KHÓA HỌC</b><br/>Tìm khóa, giỏ hàng, ghi danh, học, tiến độ", "Chọn/học ↔ bài học, tiến độ, chứng chỉ"),
    ("billing", "<b>7. GÓI &amp; THANH TOÁN</b><br/>Xem gói, mua, chuyển khoản, xem hóa đơn", "Thanh toán ↔ trạng thái, hóa đơn"),
    ("dashboard", "<b>8. THEO DÕI &amp; PHẢN HỒI</b><br/>Dashboard, thông báo, đánh giá, gửi báo cáo", "Yêu cầu/đánh giá ↔ thông báo, thống kê"),
]

related = {
    "account": ("google_provider", "<b>GOOGLE SIGN-IN</b><br/>Xác thực tài khoản", "Token ↔ thông tin đăng nhập", "external"),
    "cv": ("llm_provider", "<b>NHÀ CUNG CẤP LLM</b><br/>Trích xuất và đánh giá CV-JD", "Prompt ↔ phân tích", "external"),
    "interview": ("interview_provider", "<b>D-ID · VISION · STT/TTS</b><br/>Avatar, hình ảnh, giọng nói", "Yêu cầu ↔ avatar / phân tích", "external"),
    "mentor_meeting": ("jitsi_provider", "<b>JITSI / JAAS</b><br/>Cuộc họp trực tuyến", "Phiên họp", "external"),
    "learning": ("cloudinary_provider", "<b>CLOUDINARY</b><br/>Ảnh và video bài học", "Tệp ↔ URL nội dung", "external"),
    "billing": ("payment_provider", "<b>VNPAY / SEPAY</b><br/>Thanh toán và xác nhận", "Giao dịch ↔ kết quả", "external"),
    "dashboard": ("smtp_provider", "<b>SMTP</b><br/>Email và nhắc lịch", "Gửi email", "external"),
}

for index, (key, label, flow) in enumerate(candidate_processes):
    row_y = 200 + index * 184
    node(p, key, label, 830, row_y, 650, 140, "internal")
    candidate_port = round((row_y + 70 - 210) / 1380, 3)
    edge(
        p, f"candidate_to_{key}", "candidate_actor", key, flow, "#2563EB",
        both=True, exit_x=1, exit_y=candidate_port, entry_x=0, entry_y=0.5,
    )
    if key in related:
        provider_id, provider_label, provider_flow, provider_kind = related[key]
        node(p, provider_id, provider_label, 1860, row_y + 5, 560, 130, provider_kind)
        edge(
            p, f"{key}_to_provider", key, provider_id, provider_flow,
            both=provider_id not in ("jitsi_provider", "smtp_provider"),
            exit_x=1, exit_y=0.5, entry_x=0, entry_y=0.5,
        )

edge(p, "cv_to_interview", "cv", "interview", "CV dùng cho phỏng vấn", "#7C3AED", exit_x=0.75, exit_y=1, entry_x=0.75, entry_y=0)
edge(p, "booking_to_meeting", "mentor_search", "mentor_meeting", "Booking được xác nhận", "#7C3AED", exit_x=0.75, exit_y=1, entry_x=0.75, entry_y=0)
node(
    p, "candidate_note",
    "Trang này phóng to luồng Ứng viên. FastAPI phân tích CV-JD và MongoDB là thành phần nội bộ của ProInterview, không phải dịch vụ ngoài ở trang 01.",
    410, 1740, 1780, 75, "plain",
)


# Page 3: proposed review workflow, with explicit processes and data stores.
p = page("reviewer", "03 - Kiem duyet vien", 2400, 1500)
node(p, "review_title", "<b>KIỂM DUYỆT VIÊN · DFD MỨC 1 (ĐỀ XUẤT)</b>", 450, 30, 1500, 60, "plain")
node(p, "reviewer_actor", "<b>KIỂM DUYỆT VIÊN</b><br/>Xem, đánh giá và ra quyết định", 90, 650, 350, 150, "planned")
node(p, "ai_source", "<b>ĐẦU RA TỪ AI</b><br/>Câu hỏi và kết quả CV-JD", 540, 160, 400, 120, "source")
node(p, "queue", "<b>1. REVIEW QUEUE</b><br/>Gom mục chờ, sắp ưu tiên, theo dõi trạng thái", 540, 620, 400, 170, "process")
node(p, "questions", "<b>2. DUYỆT CÂU HỎI</b><br/>Duyệt · sửa · từ chối", 1100, 250, 430, 150, "process")
node(p, "matching", "<b>3. DUYỆT LOGIC CV-JD</b><br/>Xem ca mẫu · duyệt quy tắc · yêu cầu sửa", 1100, 590, 430, 150, "process")
node(p, "dashboard", "<b>4. QUALITY DASHBOARD</b><br/>Tỉ lệ đạt · thời gian xử lý · chất lượng đầu ra", 1100, 980, 430, 150, "process")
node(p, "q_store", "<b>D1. NGÂN HÀNG CÂU HỎI</b><br/>Câu hỏi, phiên bản, trạng thái", 1780, 220, 480, 150, "store")
node(p, "m_store", "<b>D2. LOGIC &amp; MẪU CV-JD</b><br/>Quy tắc, ca mẫu, trạng thái", 1780, 510, 480, 150, "store")
node(p, "log_store", "<b>D3. LỊCH SỬ KIỂM DUYỆT</b><br/>Người duyệt, lý do, thời điểm", 1780, 800, 480, 150, "store")
node(p, "result_store", "<b>D4. KẾT QUẢ SẢN PHẨM</b><br/>Điểm phỏng vấn và CV-JD", 1780, 1090, 480, 150, "store")

edge(p, "r1", "ai_source", "q_store", "Câu hỏi mới", "#EA580C")
edge(p, "r2", "ai_source", "m_store", "Kết quả / đề xuất", "#EA580C")
edge(p, "r3", "q_store", "queue", "Mục câu hỏi chờ")
edge(p, "r4", "m_store", "queue", "Mục CV-JD chờ")
edge(p, "r5", "reviewer_actor", "queue", "Mở hàng chờ ↔ danh sách", "#7C3AED", both=True)
edge(p, "r6", "reviewer_actor", "questions", "Quyết định câu hỏi", "#7C3AED")
edge(p, "r7", "questions", "q_store", "Cập nhật nội dung / trạng thái", "#7C3AED")
edge(p, "r8", "reviewer_actor", "matching", "Quyết định logic CV-JD", "#7C3AED")
edge(p, "r9", "matching", "m_store", "Cập nhật quy tắc / trạng thái", "#7C3AED")
edge(p, "r10", "questions", "log_store", "Lưu quyết định")
edge(p, "r11", "matching", "log_store", "Lưu quyết định")
edge(p, "r12", "q_store", "dashboard", "Tỉ lệ câu hỏi đạt")
edge(p, "r13", "m_store", "dashboard", "Tỉ lệ logic đạt")
edge(p, "r14", "log_store", "dashboard", "Tồn đọng và thời gian xử lý")
edge(p, "r15", "result_store", "dashboard", "Chất lượng đầu ra")
edge(p, "r16", "dashboard", "reviewer_actor", "Biểu đồ / cảnh báo", "#7C3AED")
node(
    p,
    "review_note",
    "Trang này phóng to vai trò Kiểm duyệt viên. Các quy trình và kho dữ liệu là thiết kế đề xuất từ yêu cầu trong ảnh.",
    470,
    1360,
    1450,
    55,
    "plain",
)


indent(ROOT, space="  ")
ElementTree(ROOT).write(OUTPUT, encoding="utf-8", xml_declaration=True)
print(OUTPUT)
