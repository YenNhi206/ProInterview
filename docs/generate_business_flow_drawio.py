"""Generate the editable ProInterview business process diagram and a PNG preview."""

from __future__ import annotations

from dataclasses import dataclass
from html import escape
from math import atan2, cos, hypot, sin
from pathlib import Path
from xml.etree.ElementTree import Element, ElementTree, SubElement, indent


OUT = Path(__file__).parent
DRAWIO = OUT / "PROINTERVIEW_BUSINESS_FLOW.drawio"
PNG = OUT / "PROINTERVIEW_BUSINESS_FLOW.png"

PAGE_W, PAGE_H = 5955, 2785
TITLE_Y, BODY_Y = 35, 105
GLOBAL_X, GLOBAL_W = 55, 90
LABEL_X, LABEL_W = 145, 155
CONTENT_X, CONTENT_W = 300, 5600
LANE_H = 440

PROCESS_FILL = "#55DDE0"
DECISION_FILL = "#FFF22D"
TERMINAL_FILL = "#4DFF3A"
LINE = "#000000"


@dataclass(frozen=True)
class Lane:
    key: str
    title: str
    y: int
    color: str


@dataclass(frozen=True)
class Node:
    key: str
    label: str
    lane: str
    x: int
    y: int
    w: int
    h: int
    kind: str = "process"


@dataclass(frozen=True)
class Edge:
    source: str
    target: str
    label: str = ""
    via: tuple[tuple[int, int], ...] = ()
    dashed: bool = False


LANES = [
    Lane("candidate", "Candidate / Learner", BODY_Y, "#B9D7F0"),
    Lane("system", "ProInterview System", BODY_Y + LANE_H, "#F4C7D5"),
    Lane("ai", "AI Services", BODY_Y + LANE_H * 2, "#FFD29D"),
    Lane("payment", "SePay / Payment Service", BODY_Y + LANE_H * 3, "#FFE699"),
    Lane("mentor", "Mentor", BODY_Y + LANE_H * 4, "#D7C3F1"),
    Lane("admin", "Admin (Reviewer*)", BODY_Y + LANE_H * 5, "#FF7474"),
]
LANE_BY_KEY = {lane.key: lane for lane in LANES}


def node(key, label, lane, x, kind="process", w=235, h=82, y_offset=175):
    return Node(key, label, lane, x, LANE_BY_KEY[lane].y + y_offset, w, h, kind)


NODES = [
    # Authentication and entry to four independent customer services.
    node("start", "Start", "candidate", 335, "terminal", 165, 72, 185),
    node("register", "Register / log in", "candidate", 535, w=230, y_offset=180),
    node("authenticate", "Authenticate account\nand load plan quota", "system", 535, w=255, y_offset=170),
    node("auth_ok", "Authenticated?", "system", 835, "decision", 195, 120, 145),
    node("correct_login", "Correct credentials", "candidate", 835, w=230, y_offset=315),
    node("profile", "Update personal profile\n(optional)", "candidate", 1090, w=245, y_offset=25),
    node("choose_service", "Choose service", "candidate", 1325, "decision", 205, 130, 150),

    # CV-JD analysis.
    node("cv_request", "Upload CV and\njob description", "candidate", 1600, w=235, y_offset=20),
    node("cv_quota", "CV quota\navailable?", "system", 1900, "decision", 190, 110, 5),
    node("cv_create", "Create CV analysis", "system", 2140, w=225, y_offset=20),
    node("cv_ai", "Parse, match and\nscore CV-JD", "ai", 2400, w=245, y_offset=60),
    node("cv_save", "Save score, gaps\nand suggestions", "system", 2710, w=245, y_offset=20),
    node("cv_result", "View CV recommendations", "candidate", 3010, w=250, y_offset=20),

    # AI interview practice.
    node("interview_request", "Choose interview mode\nand start session", "candidate", 1600, w=245, y_offset=120),
    node("interview_quota", "Interview quota /\nPro mode allowed?", "system", 1900, "decision", 200, 115, 105),
    node("interview_create", "Create interview session", "system", 2140, w=235, y_offset=120),
    node("interview_ai", "Generate questions and\nevaluate answers", "ai", 2400, w=255, y_offset=245),
    node("interview_save", "Save scores and feedback", "system", 2710, w=245, y_offset=120),
    node("interview_result", "View interview feedback", "candidate", 3010, w=250, y_offset=120),
    node("quota_notice", "Show quota / plan limit", "candidate", 2410, w=245, y_offset=205),

    # Mentor booking.
    node("mentor_browse", "Browse approved Mentor\nand choose a slot", "candidate", 1600, w=250, y_offset=220),
    node("slot_check", "Active Mentor and\nslot still available?", "system", 1900, "decision", 200, 115, 205),
    node("choose_again", "Choose another slot", "candidate", 2150, w=225, y_offset=220),
    node("booking_pending", "Create pending Booking", "system", 2420, w=235, y_offset=220),
    node("booking_transfer", "Transfer using\nBooking code", "candidate", 2710, w=230, y_offset=220),

    # Course enrollment.
    node("course_browse", "Browse published course\nand enroll / checkout", "candidate", 1600, w=250, y_offset=320),
    node("course_check", "Check published status\nand existing access", "system", 1900, w=250, y_offset=320),
    node("free_course", "Free course?", "system", 2200, "decision", 185, 110, 305),
    node("paid_order", "Create pending Enrollment\nor CartOrder", "system", 2420, w=250, y_offset=320),
    node("free_enrollment", "Create paid-status\nEnrollment", "system", 2720, w=235, y_offset=320),
    node("course_transfer", "Transfer using\norder code", "candidate", 3010, w=225, y_offset=320),

    # Shared transfer payment and service delivery.
    node("payment_process", "Receive transfer and\nreconcile SePay webhook", "payment", 3060, w=280, y_offset=150),
    node("payment_ok", "Payment\nconfirmed?", "payment", 3410, "decision", 200, 125, 130),
    node("retry_payment", "Retry payment\nor cancel request", "candidate", 3660, w=235, y_offset=270),
    node("apply_payment", "Mark paid; confirm Booking /\nactivate Enrollment; notify", "system", 3680, w=285, h=100, y_offset=230),
    node("paid_type", "Booking or\nCourse?", "system", 4020, "decision", 195, 120, 220),
    node("mentor_session", "Join / start session;\nMentor completes Booking", "mentor", 4300, w=275, y_offset=70),
    node("course_access", "Access lessons, update progress;\nrequest certificate at 100%", "candidate", 4300, w=295, h=92, y_offset=315),
    node("mentor_review", "Review Mentor or\nreport issue (optional)", "candidate", 4640, w=260, y_offset=220),
    node("course_review", "Review, Q&A or\nreport issue (optional)", "candidate", 4640, w=260, y_offset=320),
    node("continue_use", "Use another\nservice?", "candidate", 5200, "decision", 200, 130, 150),
    node("end", "End", "candidate", 5545, "terminal", 170, 72, 185),

    # Mentor onboarding and course publishing.
    node("mentor_onboarding", "Become a Mentor", "candidate", 335, "terminal", 205, 72, 340),
    node("mentor_apply", "Complete profile and submit\nMentor application", "candidate", 575, w=270, y_offset=320),
    node("review_mentor", "Review Mentor\napplication", "admin", 575, w=245, y_offset=70),
    node("mentor_ok", "Approved?", "admin", 870, "decision", 190, 120, 50),
    node("revise_application", "Revise and reapply", "candidate", 875, w=220, y_offset=320),
    node("activate_mentor", "Set role=mentor; activate\nand verify Mentor", "system", 1135, w=265, y_offset=320),
    node("configure_mentor", "Set session types, price\nand availability", "mentor", 1435, w=265, y_offset=70),
    node("course_draft", "Create course draft\nor published-course update", "mentor", 1750, w=280, y_offset=220),
    node("submit_course", "Submit course for review", "mentor", 2070, w=250, y_offset=220),
    node("review_course", "Review course content", "admin", 2070, w=245, y_offset=220),
    node("course_ok", "Approved?", "admin", 2360, "decision", 190, 120, 200),
    node("revise_course", "Revise and resubmit course", "mentor", 2360, w=260, y_offset=220),

    # Admin fallback and moderation paths.
    node("manual_payment", "Confirm transfer manually\nwhen reconciliation is needed", "admin", 3400, w=290, y_offset=70),
    node("resolve_report", "Review and resolve / dismiss\nsubmitted report", "admin", 4640, w=285, y_offset=70),
]
NODE_BY_KEY = {item.key: item for item in NODES}


EDGES = [
    Edge("start", "register"),
    Edge("register", "authenticate"),
    Edge("authenticate", "auth_ok"),
    Edge("auth_ok", "choose_service", "Yes", ((1060, 750), (1060, 320), (1325, 320))),
    Edge("auth_ok", "profile", "Optional", ((1030, 705), (1030, 170), (1090, 170))),
    Edge("profile", "choose_service"),
    Edge("auth_ok", "correct_login", "No"),
    Edge("correct_login", "register", "Try again", ((805, 461), (805, 250), (650, 250))),

    # Four separate services.
    Edge("choose_service", "cv_request", "CV analysis", ((1550, 280), (1550, 166), (1600, 166))),
    Edge("choose_service", "interview_request", "AI interview", ((1560, 300), (1560, 266), (1600, 266))),
    Edge("choose_service", "mentor_browse", "Mentor", ((1560, 340), (1560, 366), (1600, 366))),
    Edge("choose_service", "course_browse", "Course", ((1550, 360), (1550, 466), (1600, 466))),

    Edge("cv_request", "cv_quota"),
    Edge("cv_quota", "cv_create", "Yes"),
    Edge("cv_quota", "quota_notice", "No"),
    Edge("cv_create", "cv_ai"),
    Edge("cv_ai", "cv_save"),
    Edge("cv_save", "cv_result"),
    Edge("cv_result", "continue_use", via=((3320, 166), (5100, 166), (5100, 280))),

    Edge("interview_request", "interview_quota"),
    Edge("interview_quota", "interview_create", "Yes"),
    Edge("interview_quota", "quota_notice", "No"),
    Edge("interview_create", "interview_ai"),
    Edge("interview_ai", "interview_save"),
    Edge("interview_save", "interview_result"),
    Edge("interview_result", "continue_use", via=((3350, 266), (5070, 266))),
    Edge("quota_notice", "choose_service", "Choose another", ((2700, 351), (2700, 525), (1428, 525), (1428, 385))),

    Edge("mentor_browse", "slot_check"),
    Edge("slot_check", "booking_pending", "Yes"),
    Edge("slot_check", "choose_again", "No"),
    Edge("choose_again", "mentor_browse", "Choose again", ((2115, 366), (2115, 410), (1570, 410), (1570, 366))),
    Edge("booking_pending", "booking_transfer"),
    Edge("booking_transfer", "payment_process", "Booking code", ((2980, 366), (2980, 1616))),

    Edge("course_browse", "course_check"),
    Edge("course_check", "free_course"),
    Edge("free_course", "free_enrollment", "Yes", ((2395, 905), (2395, 960), (2838, 960), (2838, 947))),
    Edge("free_course", "paid_order", "No"),
    Edge("paid_order", "course_transfer"),
    Edge("course_transfer", "payment_process", "Order code"),

    Edge("payment_process", "payment_ok"),
    Edge("payment_ok", "apply_payment", "Yes"),
    Edge("payment_ok", "retry_payment", "No"),
    Edge("retry_payment", "payment_process", "Retry", ((3630, 416), (3630, 1605), (3340, 1605))),
    Edge("retry_payment", "continue_use", "Cancel", ((3950, 416), (5100, 416), (5100, 360))),
    Edge("apply_payment", "paid_type"),
    Edge("paid_type", "mentor_session", "Booking"),
    Edge("paid_type", "course_access", "Course"),
    Edge("free_enrollment", "course_access", "Free access", ((2980, 906), (4100, 906), (4100, 466), (4300, 466))),
    Edge("mentor_session", "mentor_review"),
    Edge("course_access", "course_review"),
    Edge("mentor_review", "continue_use", via=((4930, 366), (5070, 366))),
    Edge("course_review", "continue_use", via=((4950, 466), (5130, 466), (5130, 360))),
    Edge("continue_use", "choose_service", "Yes", ((5300, 240), (5300, 115), (1428, 115), (1428, 255))),
    Edge("continue_use", "end", "No"),

    # Mentor application and course publishing feed the marketplace.
    Edge("mentor_onboarding", "mentor_apply"),
    Edge("mentor_apply", "review_mentor"),
    Edge("review_mentor", "mentor_ok"),
    Edge("mentor_ok", "activate_mentor", "Yes"),
    Edge("mentor_ok", "revise_application", "No"),
    Edge("revise_application", "mentor_apply", "Reapply", ((850, 466), (850, 520), (710, 520), (710, 507))),
    Edge("activate_mentor", "configure_mentor"),
    Edge("configure_mentor", "mentor_browse", "Active Mentor listed", ((1575, 1935), (1575, 410), (1725, 410)), True),
    Edge("configure_mentor", "course_draft"),
    Edge("course_draft", "submit_course"),
    Edge("submit_course", "review_course"),
    Edge("review_course", "course_ok"),
    Edge("course_ok", "revise_course", "No"),
    Edge("revise_course", "submit_course", "Resubmit", ((2330, 2126), (2330, 2180), (2195, 2180), (2195, 2167))),
    Edge("course_ok", "course_browse", "Yes: publish course", ((2550, 2565), (3300, 2565), (3300, 525), (1725, 525), (1725, 507)), True),

    # SePay is primary. Admin payment confirmation is a fallback.
    Edge("manual_payment", "payment_ok", "Manual confirmation", ((3370, 2416), (3370, 1668), (3410, 1668)), True),
    Edge("mentor_review", "resolve_report", "If reported", ((4770, 407), (4770, 2375)), True),
    Edge("course_review", "resolve_report", "If reported", ((4820, 507), (4820, 2375)), True),
]


def center(item: Node):
    return item.x + item.w / 2, item.y + item.h / 2


def boundary(item: Node, towards: tuple[float, float]):
    cx, cy = center(item)
    dx, dy = towards[0] - cx, towards[1] - cy
    if item.kind == "decision":
        denominator = abs(dx) / (item.w / 2) + abs(dy) / (item.h / 2)
        scale = 1 / denominator if denominator else 0
        return cx + dx * scale, cy + dy * scale
    scale = min(
        (item.w / 2) / abs(dx) if dx else float("inf"),
        (item.h / 2) / abs(dy) if dy else float("inf"),
    )
    return cx + dx * scale, cy + dy * scale


def edge_points(edge: Edge):
    source, target = NODE_BY_KEY[edge.source], NODE_BY_KEY[edge.target]
    if edge.via:
        middle = edge.via
    else:
        sx, sy = center(source)
        tx, ty = center(target)
        middle = () if abs(sx - tx) < 1 or abs(sy - ty) < 1 else ((tx, sy),)
    first = middle[0] if middle else center(target)
    last = middle[-1] if middle else center(source)
    return (boundary(source, first), *middle, boundary(target, last))


def along(points, fraction):
    lengths = [hypot(b[0] - a[0], b[1] - a[1]) for a, b in zip(points, points[1:])]
    remaining = sum(lengths) * fraction
    for (a, b), length in zip(zip(points, points[1:]), lengths):
        if remaining <= length:
            ratio = remaining / length if length else 0
            return a[0] + (b[0] - a[0]) * ratio, a[1] + (b[1] - a[1]) * ratio
        remaining -= length
    return points[-1]


def add_vertex(root, ident, value, style, x, y, w, h):
    cell = SubElement(root, "mxCell", {
        "id": ident, "value": value, "style": style, "vertex": "1", "parent": "1",
    })
    SubElement(cell, "mxGeometry", {
        "x": str(x), "y": str(y), "width": str(w), "height": str(h), "as": "geometry",
    })


def write_drawio():
    mxfile = Element("mxfile", {"host": "app.diagrams.net", "version": "24.7.17", "type": "device"})
    diagram = SubElement(mxfile, "diagram", {"id": "prointerview-business-process", "name": "Business Process"})
    model = SubElement(diagram, "mxGraphModel", {
        "dx": "1800", "dy": "1200", "grid": "1", "gridSize": "10", "guides": "1",
        "tooltips": "1", "connect": "1", "arrows": "1", "fold": "1", "page": "1",
        "pageScale": "1", "pageWidth": str(PAGE_W), "pageHeight": str(PAGE_H),
        "math": "0", "shadow": "0", "adaptiveColors": "auto",
    })
    root = SubElement(model, "root")
    SubElement(root, "mxCell", {"id": "0"})
    SubElement(root, "mxCell", {"id": "1", "parent": "0"})

    add_vertex(
        root, "diagram_title", "<b>ProInterview Business Process Diagram</b>",
        "text;html=1;fillColor=#FFFFFF;strokeColor=#000000;strokeWidth=2;"
        "fontFamily=Arial;fontSize=28;fontColor=#000000;align=center;verticalAlign=middle;",
        GLOBAL_X, TITLE_Y, GLOBAL_W + LABEL_W + CONTENT_W, 70,
    )
    add_vertex(
        root, "global_label", "<b>PROINTERVIEW BUSINESS PROCESS</b>",
        "text;html=1;fillColor=#D8B9F2;strokeColor=#000000;strokeWidth=2;rotation=270;"
        "fontFamily=Arial;fontSize=20;fontColor=#B00020;align=center;verticalAlign=middle;",
        GLOBAL_X, BODY_Y, GLOBAL_W, LANE_H * len(LANES),
    )
    for lane in LANES:
        add_vertex(
            root, f"lane_label_{lane.key}", f"<b><i>{escape(lane.title)}</i></b>",
            f"text;html=1;fillColor={lane.color};strokeColor=#000000;strokeWidth=2;rotation=270;"
            "fontFamily=Arial;fontSize=20;fontColor=#000000;align=center;verticalAlign=middle;",
            LABEL_X, lane.y, LABEL_W, LANE_H,
        )
        add_vertex(
            root, f"lane_body_{lane.key}", "",
            "rounded=0;fillColor=#FFFFFF;strokeColor=#000000;strokeWidth=2;",
            CONTENT_X, lane.y, CONTENT_W, LANE_H,
        )

    for index, edge in enumerate(EDGES, 1):
        points = edge_points(edge)
        source, target = NODE_BY_KEY[edge.source], NODE_BY_KEY[edge.target]
        sx = (points[0][0] - source.x) / source.w
        sy = (points[0][1] - source.y) / source.h
        tx = (points[-1][0] - target.x) / target.w
        ty = (points[-1][1] - target.y) / target.h
        style = (
            "edgeStyle=segmentEdgeStyle;rounded=0;orthogonal=1;html=1;strokeColor=#000000;strokeWidth=2;"
            "startArrow=none;endArrow=block;endFill=1;endSize=9;"
            f"exitX={sx:.5f};exitY={sy:.5f};entryX={tx:.5f};entryY={ty:.5f};"
            "exitPerimeter=0;entryPerimeter=0;fontFamily=Arial;fontSize=15;fontColor=#000000;"
        )
        if edge.dashed:
            style += "dashed=1;dashPattern=7 5;"
        cell = SubElement(root, "mxCell", {
            "id": f"flow_{index}", "value": escape(edge.label), "edge": "1", "parent": "1",
            "source": edge.source, "target": edge.target, "style": style,
        })
        geometry = SubElement(cell, "mxGeometry", {"relative": "1", "as": "geometry"})
        points_array = SubElement(geometry, "Array", {"as": "points"})
        for x, y in points[1:-1]:
            SubElement(points_array, "mxPoint", {"x": str(x), "y": str(y)})

    for item in NODES:
        if item.kind == "process":
            style = (
                f"rounded=0;whiteSpace=wrap;html=1;fillColor={PROCESS_FILL};strokeColor=#000000;strokeWidth=2;"
                "fontFamily=Arial;fontSize=18;fontColor=#000000;align=center;verticalAlign=middle;spacing=6;"
            )
        elif item.kind == "decision":
            style = (
                f"rhombus;whiteSpace=wrap;html=1;fillColor={DECISION_FILL};strokeColor=#000000;strokeWidth=2;"
                "fontFamily=Arial;fontSize=17;fontColor=#000000;align=center;verticalAlign=middle;"
            )
        else:
            style = (
                f"rounded=1;arcSize=45;whiteSpace=wrap;html=1;fillColor={TERMINAL_FILL};strokeColor=#000000;strokeWidth=2;"
                "fontFamily=Arial;fontSize=18;fontColor=#000000;align=center;verticalAlign=middle;spacing=6;"
            )
        add_vertex(root, item.key, escape(item.label).replace("\n", "<br/>"), style,
                   item.x, item.y, item.w, item.h)

    add_vertex(
        root, "reviewer_note", "<i>* Current code assigns review operations to the Admin role.</i>",
        "text;html=1;fillColor=none;strokeColor=none;fontFamily=Arial;fontSize=15;"
        "fontColor=#000000;align=left;verticalAlign=middle;",
        5000, LANE_BY_KEY["admin"].y + 350, 780, 45,
    )
    indent(mxfile, space="  ")
    ElementTree(mxfile).write(DRAWIO, encoding="utf-8", xml_declaration=True)
    print(DRAWIO)


def write_preview():
    try:
        from PIL import Image, ImageDraw, ImageFont
    except ImportError:
        return

    fonts = Path("C:/Windows/Fonts")

    def get_font(size, bold=False, italic=False):
        if bold and italic:
            name = "arialbi.ttf"
        elif bold:
            name = "arialbd.ttf"
        elif italic:
            name = "ariali.ttf"
        else:
            name = "arial.ttf"
        candidate = fonts / name
        return ImageFont.truetype(str(candidate), size) if candidate.exists() else ImageFont.load_default()

    def centered(draw, box, text, font, fill="#000000"):
        x, y, w, h = box
        draw.multiline_text((x + w / 2, y + h / 2), text, anchor="mm", align="center",
                            font=font, fill=fill, spacing=4)

    def rotated_label(image, box, text, fill, font, text_fill="#000000"):
        x, y, w, h = box
        tile = Image.new("RGBA", (h, w), (0, 0, 0, 0))
        tile_draw = ImageDraw.Draw(tile)
        tile_draw.rectangle((0, 0, h - 1, w - 1), fill=fill, outline=LINE, width=2)
        tile_draw.text((h / 2, w / 2), text, anchor="mm", font=font, fill=text_fill)
        rotated = tile.rotate(90, expand=True)
        image.paste(rotated, (x, y), rotated)

    def dashed_line(draw, a, b, width=3, dash=13, gap=8):
        length = hypot(b[0] - a[0], b[1] - a[1])
        if not length:
            return
        ux, uy = (b[0] - a[0]) / length, (b[1] - a[1]) / length
        offset = 0
        while offset < length:
            end = min(offset + dash, length)
            draw.line((a[0] + ux * offset, a[1] + uy * offset,
                       a[0] + ux * end, a[1] + uy * end), fill=LINE, width=width)
            offset += dash + gap

    image = Image.new("RGB", (PAGE_W, PAGE_H), "white")
    draw = ImageDraw.Draw(image)
    draw.rectangle((GLOBAL_X, TITLE_Y, GLOBAL_X + GLOBAL_W + LABEL_W + CONTENT_W, TITLE_Y + 70),
                   fill="white", outline=LINE, width=3)
    centered(draw, (GLOBAL_X, TITLE_Y, GLOBAL_W + LABEL_W + CONTENT_W, 70),
             "ProInterview Business Process Diagram", get_font(28, True))

    rotated_label(image, (GLOBAL_X, BODY_Y, GLOBAL_W, LANE_H * len(LANES)),
                  "PROINTERVIEW BUSINESS PROCESS", "#D8B9F2", get_font(20, True), "#B00020")
    draw = ImageDraw.Draw(image)
    for lane in LANES:
        rotated_label(image, (LABEL_X, lane.y, LABEL_W, LANE_H), lane.title, lane.color,
                      get_font(20, True, True))
        draw = ImageDraw.Draw(image)
        draw.rectangle((CONTENT_X, lane.y, CONTENT_X + CONTENT_W, lane.y + LANE_H),
                       fill="white", outline=LINE, width=3)

    edge_font = get_font(15)
    for edge in EDGES:
        points = edge_points(edge)
        for a, b in zip(points, points[1:]):
            if edge.dashed:
                dashed_line(draw, a, b)
            else:
                draw.line((a, b), fill=LINE, width=3)
        a, b = points[-2], points[-1]
        angle = atan2(b[1] - a[1], b[0] - a[0])
        length = 16
        left = (b[0] - length * cos(angle - 0.48), b[1] - length * sin(angle - 0.48))
        right = (b[0] - length * cos(angle + 0.48), b[1] - length * sin(angle + 0.48))
        draw.polygon((b, left, right), fill=LINE)
        if edge.label:
            mx, my = along(points, 0.5)
            bbox = draw.textbbox((0, 0), edge.label, font=edge_font)
            tw, th = bbox[2] - bbox[0], bbox[3] - bbox[1]
            draw.rectangle((mx - tw / 2 - 6, my - th / 2 - 4,
                            mx + tw / 2 + 6, my + th / 2 + 4), fill="white")
            draw.text((mx, my), edge.label, anchor="mm", font=edge_font, fill=LINE)

    process_font = get_font(18)
    decision_font = get_font(17)
    terminal_font = get_font(18)
    for item in NODES:
        box = (item.x, item.y, item.x + item.w, item.y + item.h)
        if item.kind == "process":
            draw.rectangle(box, fill=PROCESS_FILL, outline=LINE, width=3)
            centered(draw, (item.x, item.y, item.w, item.h), item.label, process_font)
        elif item.kind == "decision":
            cx, cy = center(item)
            polygon = ((cx, item.y), (item.x + item.w, cy), (cx, item.y + item.h), (item.x, cy))
            draw.polygon(polygon, fill=DECISION_FILL)
            draw.line([*polygon, polygon[0]], fill=LINE, width=3)
            centered(draw, (item.x + 12, item.y + 10, item.w - 24, item.h - 20),
                     item.label, decision_font)
        else:
            draw.rounded_rectangle(box, radius=item.h // 2, fill=TERMINAL_FILL, outline=LINE, width=3)
            centered(draw, (item.x, item.y, item.w, item.h), item.label, terminal_font)

    draw.text((5000, LANE_BY_KEY["admin"].y + 372),
              "* Current code assigns review operations to the Admin role.",
              font=get_font(15, italic=True), fill=LINE)
    image.save(PNG, optimize=True)
    print(PNG)


if __name__ == "__main__":
    write_drawio()
    write_preview()
