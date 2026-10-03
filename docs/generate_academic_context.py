"""Generate an academic-style ProInterview context diagram for draw.io and SVG."""

from __future__ import annotations

from dataclasses import dataclass
from html import escape
from math import sqrt
from pathlib import Path
from xml.etree.ElementTree import Element, ElementTree, SubElement, indent


OUT = Path(__file__).parent
DRAWIO = OUT / "PROINTERVIEW_CONTEXT_MAU.drawio"
SVG = OUT / "PROINTERVIEW_CONTEXT_MAU.svg"
PNG = OUT / "PROINTERVIEW_CONTEXT_MAU.png"
PAGE_W, PAGE_H = 3200, 2200
CX, CY, R = 1600, 1100, 260


@dataclass(frozen=True)
class Box:
    key: str
    title: str
    subtitle: str
    x: int
    y: int
    w: int
    h: int
    planned: bool = False


@dataclass(frozen=True)
class Flow:
    key: str
    source: str
    target: str
    label: str
    points: tuple[tuple[float, float], ...]
    label_x: float
    label_y: float
    label_w: int
    planned: bool = False


BOXES = [
    Box("guest", "KHÁCH", "Chưa đăng nhập", 220, 170, 440, 190),
    Box("candidate", "ỨNG VIÊN", "Tài khoản đã đăng nhập", 220, 1750, 500, 230),
    Box("admin", "ADMIN", "Quản trị nền tảng", 2540, 170, 440, 190),
    Box("reviewer", "KIỂM DUYỆT VIÊN", "Tính năng dự kiến", 2540, 850, 440, 190, True),
    Box("mentor", "MENTOR", "Tư vấn và tạo khóa học", 2540, 1760, 440, 230),
    Box("ai", "DỊCH VỤ AI", "LLM · D-ID · Vision · STT/TTS", 890, 130, 390, 170),
    Box("payment", "THANH TOÁN", "VNPay · SePay", 1900, 130, 400, 170),
]
BOX_BY_KEY = {box.key: box for box in BOXES}
FLOWS: list[Flow] = []


def circle_x(y: float, side: str) -> float:
    amount = sqrt(R * R - (y - CY) ** 2)
    return CX - amount if side == "left" else CX + amount


def circle_y(x: float, side: str) -> float:
    amount = sqrt(R * R - (x - CX) ** 2)
    return CY - amount if side == "top" else CY + amount


def add_group_flow(
    key: str, actor: str, label: str, points_actor_to_system: list[tuple[float, float]],
    label_x: float, label_y: float, label_w: int, into_system: bool, planned: bool = False,
) -> None:
    points = tuple(points_actor_to_system if into_system else reversed(points_actor_to_system))
    FLOWS.append(
        Flow(key, actor if into_system else "system", "system" if into_system else actor,
             label, points, label_x, label_y, label_w, planned)
    )


# Guests: the public mentor/course routes and the public interview trial are in the code.
guest_items = [
    ("Đăng ký / đăng nhập / Google", True),
    ("Tìm mentor và khóa học", True),
    ("Yêu cầu phỏng vấn thử", True),
    ("Tài khoản / phiên đăng nhập", False),
    ("Danh sách mentor / khóa học", False),
    ("Câu hỏi phỏng vấn thử", False),
]
for i, (label, into_system) in enumerate(guest_items):
    sx, sy = 300 + 55 * i, 360
    lane = 550 + 42 * i
    ey = 890 + 25 * i
    ex = circle_x(ey, "left")
    route = [(sx, sy), (sx, lane), (ex - 90, lane), (ex - 90, ey), (ex, ey)]
    add_group_flow(f"guest_{i+1}", "guest", label, route, 940, lane, 490, into_system)


# Candidate flows are deliberately separated into one-way requests and responses.
candidate_items = [
    ("CV, JD hoặc lĩnh vực cần phân tích", True),
    ("Điểm khớp và gợi ý cải thiện CV", False),
    ("Vị trí và câu trả lời phỏng vấn", True),
    ("Câu hỏi, điểm và phản hồi AI", False),
    ("Tìm mentor; đặt / đổi / hủy lịch", True),
    ("Booking và liên kết phòng tư vấn", False),
    ("Giỏ hàng; ghi danh khóa học", True),
    ("Bài học, tiến độ và chứng chỉ", False),
    ("Chọn gói; yêu cầu thanh toán", True),
    ("Trạng thái giao dịch và hóa đơn", False),
    ("Đánh giá mentor / gửi báo cáo", True),
    ("Dashboard cá nhân và thông báo", False),
]
for i, (label, into_system) in enumerate(candidate_items):
    sx, sy = 265 + 37 * i, 1750
    lane = 1390 + 27 * i
    ex = 1380 + 16 * i
    ey = circle_y(ex, "bottom")
    route = [(sx, sy), (sx, lane), (ex, lane), (ex, ey)]
    add_group_flow(f"candidate_{i+1}", "candidate", label, route, 1020, lane, 570, into_system)


# Admin operations are backed by the admin routes and audit/finance services.
admin_items = [
    ("Duyệt mentor / khóa học", True),
    ("Hồ sơ và khóa học chờ duyệt", False),
    ("Quản lý user, booking, thanh toán", True),
    ("Báo cáo và thống kê hệ thống", False),
    ("Xử lý hoàn tiền / payout", True),
    ("Nhật ký kiểm toán / cảnh báo", False),
]
for i, (label, into_system) in enumerate(admin_items):
    sx, sy = 2610 + 55 * i, 360
    lane = 550 + 42 * i
    ey = 890 + 25 * i
    ex = circle_x(ey, "right")
    route = [(sx, sy), (sx, lane), (ex + 90, lane), (ex + 90, ey), (ex, ey)]
    add_group_flow(f"admin_{i+1}", "admin", label, route, 2240, lane, 540, into_system)


# Reviewer is drawn as a proposed actor because User.role has no reviewer value.
reviewer_items = [
    ("Review Queue: câu hỏi / CV-JD", False),
    ("Duyệt / từ chối nội dung", True),
    ("Quality Dashboard", False),
    ("Nhận xét và yêu cầu chỉnh sửa", True),
]
for i, (label, into_system) in enumerate(reviewer_items):
    sx, sy = 2540, 885 + 40 * i
    lane = 990 + 48 * i
    ey = 1040 + 40 * i
    ex = circle_x(ey, "right")
    route = [(sx, sy), (2450, sy), (2450, lane), (ex, lane), (ex, ey)]
    add_group_flow(f"reviewer_{i+1}", "reviewer", label, route, 2200, lane, 520, into_system, True)


# Mentor profile, bookings, courses and finance appear in the mentor routes.
mentor_items = [
    ("Hồ sơ mentor và lịch rảnh", True),
    ("Danh sách booking / học viên", False),
    ("Xác nhận / hoàn tất buổi tư vấn", True),
    ("Thông tin cuộc họp và đánh giá", False),
    ("Tạo / cập nhật khóa học", True),
    ("Q&A, học viên và thống kê khóa", False),
    ("Yêu cầu rút tiền / tài khoản nhận", True),
    ("Doanh thu và trạng thái payout", False),
]
for i, (label, into_system) in enumerate(mentor_items):
    sx, sy = 2585 + 48 * i, 1760
    lane = 1400 + 38 * i
    ex = 1645 + 21 * i
    ey = circle_y(ex, "bottom")
    route = [(sx, sy), (sx, lane), (ex, lane), (ex, ey)]
    add_group_flow(f"mentor_{i+1}", "mentor", label, route, 2220, lane, 580, into_system)


ai_items = [
    ("Prompt CV-JD / phỏng vấn / avatar", False),
    ("Câu hỏi, điểm, video, transcript", True),
]
for i, (label, into_system) in enumerate(ai_items):
    sx, sy = 1010 + 165 * i, 300
    lane = 460 + 50 * i
    ex = 1510 + 40 * i
    ey = circle_y(ex, "top")
    route = [(sx, sy), (sx, lane), (ex, lane), (ex, ey)]
    # This helper receives the route from the outside actor toward the system.
    add_group_flow(f"ai_{i+1}", "ai", label, route, 1300, lane, 410, into_system)


payment_items = [
    ("Yêu cầu thanh toán VNPay", False),
    ("IPN VNPay / webhook SePay", True),
]
for i, (label, into_system) in enumerate(payment_items):
    sx, sy = 2010 + 160 * i, 300
    lane = 460 + 50 * i
    ex = 1650 + 40 * i
    ey = circle_y(ex, "top")
    route = [(sx, sy), (sx, lane), (ex, lane), (ex, ey)]
    add_group_flow(f"payment_{i+1}", "payment", label, route, 1860, lane, 400, into_system)


def rect_port(box: Box, point: tuple[float, float]) -> tuple[float, float]:
    return ((point[0] - box.x) / box.w, (point[1] - box.y) / box.h)


def system_port(point: tuple[float, float]) -> tuple[float, float]:
    return ((point[0] - (CX - R)) / (2 * R), (point[1] - (CY - R)) / (2 * R))


def graph_port(key: str, point: tuple[float, float]) -> tuple[float, float]:
    return system_port(point) if key == "system" else rect_port(BOX_BY_KEY[key], point)


def make_drawio() -> None:
    root = Element("mxfile", {"host": "app.diagrams.net", "agent": "ProInterview", "version": "24.7.17", "type": "device"})
    diagram = SubElement(root, "diagram", {"id": "academic_context", "name": "Context Diagram - Mau hoc thuat"})
    model = SubElement(diagram, "mxGraphModel", {
        "dx": "2000", "dy": "1300", "grid": "1", "gridSize": "10", "guides": "1",
        "tooltips": "1", "connect": "1", "arrows": "1", "fold": "1", "page": "1",
        "pageScale": "1", "pageWidth": str(PAGE_W), "pageHeight": str(PAGE_H),
        "math": "0", "shadow": "0",
    })
    cells = SubElement(model, "root")
    SubElement(cells, "mxCell", {"id": "0"})
    SubElement(cells, "mxCell", {"id": "1", "parent": "0"})

    for flow in FLOWS:
        start, end = flow.points[0], flow.points[-1]
        exit_x, exit_y = graph_port(flow.source, start)
        entry_x, entry_y = graph_port(flow.target, end)
        style = (
            "edgeStyle=segmentEdgeStyle;rounded=0;orthogonal=1;html=1;"
            "strokeColor=#111111;strokeWidth=1.5;endArrow=classic;endFill=1;"
            f"exitX={exit_x:.5f};exitY={exit_y:.5f};entryX={entry_x:.5f};entryY={entry_y:.5f};"
            "exitPerimeter=0;entryPerimeter=0;"
        )
        if flow.planned:
            style += "dashed=1;dashPattern=8 5;"
        edge = SubElement(cells, "mxCell", {
            "id": flow.key, "value": "", "style": style, "edge": "1", "parent": "1",
            "source": flow.source, "target": flow.target,
        })
        geo = SubElement(edge, "mxGeometry", {"relative": "1", "as": "geometry"})
        arr = SubElement(geo, "Array", {"as": "points"})
        for x, y in flow.points[1:-1]:
            SubElement(arr, "mxPoint", {"x": f"{x:.2f}", "y": f"{y:.2f}"})

    def vertex(key: str, value: str, style: str, x: float, y: float, w: float, h: float) -> None:
        cell = SubElement(cells, "mxCell", {
            "id": key, "value": value, "style": style, "vertex": "1", "parent": "1",
        })
        SubElement(cell, "mxGeometry", {
            "x": f"{x:.2f}", "y": f"{y:.2f}", "width": f"{w:.2f}", "height": f"{h:.2f}", "as": "geometry",
        })

    vertex("title", "<b><i>II.3 Context Diagram — ProInterview</i></b>",
           "text;html=1;whiteSpace=wrap;fillColor=none;strokeColor=none;fontFamily=Georgia;fontSize=54;align=left;verticalAlign=middle;",
           350, 30, 1450, 95)
    for box in BOXES:
        label = f"<b>{escape(box.title)}</b><br/>{escape(box.subtitle)}"
        style = (
            "shape=rectangle;whiteSpace=wrap;html=1;rounded=0;fillColor=#FFFFFF;"
            "strokeColor=#111111;strokeWidth=1.7;fontColor=#111111;fontFamily=Arial;"
            "fontSize=22;align=center;verticalAlign=middle;spacing=14;"
        )
        if box.planned:
            style += "dashed=1;dashPattern=8 5;"
        vertex(box.key, label, style, box.x, box.y, box.w, box.h)
    vertex("system", "<b>PROINTERVIEW</b><br/>Hệ thống luyện phỏng vấn AI<br/>và kết nối mentor", 
           "ellipse;whiteSpace=wrap;html=1;fillColor=#FFFFFF;strokeColor=#111111;"
           "strokeWidth=2.2;fontColor=#111111;fontFamily=Arial;fontSize=25;"
           "align=center;verticalAlign=middle;spacing=14;",
           CX - R, CY - R, R * 2, R * 2)

    for flow in FLOWS:
        style = (
            "text;html=1;whiteSpace=wrap;fillColor=#FFFFFF;strokeColor=none;"
            "fontColor=#111111;fontFamily=Arial;fontSize=18;align=center;verticalAlign=middle;"
        )
        vertex(f"label_{flow.key}", escape(flow.label), style,
               flow.label_x - flow.label_w / 2, flow.label_y - 15, flow.label_w, 30)
    vertex("legend", "Nét đứt: Kiểm duyệt viên là tính năng dự kiến. Các luồng còn lại dựa trên route/service hiện có.",
           "text;html=1;whiteSpace=wrap;fillColor=none;strokeColor=none;"
           "fontFamily=Arial;fontSize=19;align=center;verticalAlign=middle;",
           450, 2070, 2300, 55)
    indent(root, space="  ")
    ElementTree(root).write(DRAWIO, encoding="utf-8", xml_declaration=True)


def make_svg() -> None:
    svg = Element("svg", {
        "xmlns": "http://www.w3.org/2000/svg", "width": str(PAGE_W), "height": str(PAGE_H),
        "viewBox": f"0 0 {PAGE_W} {PAGE_H}",
    })
    defs = SubElement(svg, "defs")
    marker = SubElement(defs, "marker", {
        "id": "arrow", "markerWidth": "10", "markerHeight": "10", "refX": "8.3", "refY": "3.5",
        "orient": "auto", "markerUnits": "strokeWidth",
    })
    SubElement(marker, "path", {"d": "M0,0 L8.5,3.5 L0,7 Z", "fill": "#111111"})
    SubElement(svg, "rect", {"x": "0", "y": "0", "width": str(PAGE_W), "height": str(PAGE_H), "fill": "#FFFFFF"})
    title = SubElement(svg, "text", {
        "x": "350", "y": "103", "font-family": "Georgia, Times New Roman, serif",
        "font-size": "58", "font-style": "italic", "font-weight": "bold", "fill": "#111111",
    })
    title.text = "II.3 Context Diagram — ProInterview"

    for flow in FLOWS:
        SubElement(svg, "polyline", {
            "points": " ".join(f"{x:.2f},{y:.2f}" for x, y in flow.points),
            "fill": "none", "stroke": "#111111", "stroke-width": "1.9", "marker-end": "url(#arrow)",
            **({"stroke-dasharray": "9 6"} if flow.planned else {}),
        })

    for box in BOXES:
        SubElement(svg, "rect", {
            "x": str(box.x), "y": str(box.y), "width": str(box.w), "height": str(box.h),
            "fill": "#FFFFFF", "stroke": "#111111", "stroke-width": "2",
            **({"stroke-dasharray": "10 7"} if box.planned else {}),
        })
        heading = SubElement(svg, "text", {
            "x": str(box.x + box.w / 2), "y": str(box.y + box.h / 2 - 4),
            "text-anchor": "middle", "font-family": "Arial, sans-serif", "font-size": "24",
            "font-weight": "bold", "fill": "#111111",
        })
        heading.text = box.title
        subtitle = SubElement(svg, "text", {
            "x": str(box.x + box.w / 2), "y": str(box.y + box.h / 2 + 27),
            "text-anchor": "middle", "font-family": "Arial, sans-serif", "font-size": "19", "fill": "#111111",
        })
        subtitle.text = box.subtitle

    SubElement(svg, "circle", {
        "cx": str(CX), "cy": str(CY), "r": str(R), "fill": "#FFFFFF",
        "stroke": "#111111", "stroke-width": "2.5",
    })
    for text_value, y, size, weight in [
        ("PROINTERVIEW", CY - 30, 32, "bold"),
        ("Hệ thống luyện phỏng vấn AI", CY + 12, 23, "normal"),
        ("và kết nối mentor", CY + 47, 23, "normal"),
    ]:
        txt = SubElement(svg, "text", {
            "x": str(CX), "y": str(y), "text-anchor": "middle", "font-family": "Arial, sans-serif",
            "font-size": str(size), "font-weight": weight, "fill": "#111111",
        })
        txt.text = text_value

    for flow in FLOWS:
        SubElement(svg, "rect", {
            "x": str(flow.label_x - flow.label_w / 2), "y": str(flow.label_y - 16),
            "width": str(flow.label_w), "height": "32", "fill": "#FFFFFF",
        })
        label = SubElement(svg, "text", {
            "x": str(flow.label_x), "y": str(flow.label_y + 6), "text-anchor": "middle",
            "font-family": "Arial, sans-serif", "font-size": "18", "fill": "#111111",
        })
        label.text = flow.label
    note = SubElement(svg, "text", {
        "x": str(PAGE_W / 2), "y": "2110", "text-anchor": "middle",
        "font-family": "Arial, sans-serif", "font-size": "19", "fill": "#111111",
    })
    note.text = "Nét đứt: Kiểm duyệt viên là tính năng dự kiến. Các luồng còn lại dựa trên route/service hiện có."
    indent(svg, space="  ")
    ElementTree(svg).write(SVG, encoding="utf-8", xml_declaration=True)


def make_png() -> bool:
    """Render a quick preview if Pillow is available; draw.io remains the source."""
    try:
        from PIL import Image, ImageDraw, ImageFont
    except ImportError:
        return False

    from math import atan2, cos, sin, pi

    image = Image.new("RGB", (PAGE_W, PAGE_H), "white")
    draw = ImageDraw.Draw(image)
    font_dir = Path("C:/Windows/Fonts")
    fallback_dir = OUT.parent / "backend" / "src" / "assets" / "fonts"

    def font(size: int, bold: bool = False, title: bool = False):
        candidates = (
            [font_dir / "timesbi.ttf", font_dir / "georgiaz.ttf"] if title else
            [font_dir / ("arialbd.ttf" if bold else "arial.ttf"),
             fallback_dir / ("DejaVuSans-Bold.ttf" if bold else "DejaVuSans.ttf")]
        )
        for candidate in candidates:
            if candidate.exists():
                return ImageFont.truetype(str(candidate), size)
        return ImageFont.load_default()

    title_font, box_font, sub_font = font(58, title=True), font(24, True), font(19)
    core_font, core_sub_font, label_font = font(32, True), font(23), font(18)
    draw.text((350, 30), "II.3 Context Diagram — ProInterview", font=title_font, fill="#111111")

    def dashed(start, end, width=2):
        x1, y1 = start
        x2, y2 = end
        length = ((x2 - x1) ** 2 + (y2 - y1) ** 2) ** 0.5
        if length == 0:
            return
        step = 18
        for pos in range(0, int(length), step):
            a = pos / length
            b = min(pos + 10, length) / length
            draw.line((x1 + (x2-x1)*a, y1 + (y2-y1)*a,
                       x1 + (x2-x1)*b, y1 + (y2-y1)*b), fill="#111111", width=width)

    for flow in FLOWS:
        pts = flow.points
        for a, b in zip(pts, pts[1:]):
            if flow.planned:
                dashed(a, b)
            else:
                draw.line((*a, *b), fill="#111111", width=2)
        angle = atan2(pts[-1][1] - pts[-2][1], pts[-1][0] - pts[-2][0])
        ex, ey = pts[-1]
        arrow = [
            (ex, ey),
            (ex - 15*cos(angle-pi/6), ey - 15*sin(angle-pi/6)),
            (ex - 15*cos(angle+pi/6), ey - 15*sin(angle+pi/6)),
        ]
        draw.polygon(arrow, fill="#111111")

    for box in BOXES:
        x1, y1, x2, y2 = box.x, box.y, box.x + box.w, box.y + box.h
        draw.rectangle((x1, y1, x2, y2), fill="white")
        if box.planned:
            for a, b in [((x1,y1),(x2,y1)), ((x2,y1),(x2,y2)),
                         ((x2,y2),(x1,y2)), ((x1,y2),(x1,y1))]:
                dashed(a, b)
        else:
            draw.rectangle((x1, y1, x2, y2), outline="#111111", width=2)
        draw.text((box.x + box.w/2, box.y + box.h/2 - 5), box.title,
                  font=box_font, fill="#111111", anchor="mm")
        draw.text((box.x + box.w/2, box.y + box.h/2 + 29), box.subtitle,
                  font=sub_font, fill="#111111", anchor="mm")

    draw.ellipse((CX-R, CY-R, CX+R, CY+R), fill="white", outline="#111111", width=3)
    draw.text((CX, CY-35), "PROINTERVIEW", font=core_font, fill="#111111", anchor="mm")
    draw.text((CX, CY+12), "Hệ thống luyện phỏng vấn AI", font=core_sub_font, fill="#111111", anchor="mm")
    draw.text((CX, CY+48), "và kết nối mentor", font=core_sub_font, fill="#111111", anchor="mm")

    for flow in FLOWS:
        x1 = flow.label_x - flow.label_w/2
        draw.rectangle((x1, flow.label_y-16, x1+flow.label_w, flow.label_y+16), fill="white")
        draw.text((flow.label_x, flow.label_y), flow.label, font=label_font,
                  fill="#111111", anchor="mm")
    draw.text((PAGE_W/2, 2100),
              "Nét đứt: Kiểm duyệt viên là tính năng dự kiến. Các luồng còn lại dựa trên route/service hiện có.",
              font=sub_font, fill="#111111", anchor="mm")
    image.save(PNG, optimize=True)
    return True


make_drawio()
make_svg()
preview = make_png()
print(f"{DRAWIO}\n{SVG}" + (f"\n{PNG}" if preview else "") + f"\n{len(FLOWS)} one-way data flows")
