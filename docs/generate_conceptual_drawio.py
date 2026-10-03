"""Generate the one-page ProInterview conceptual diagram in Crow's Foot notation."""

from dataclasses import dataclass
from math import hypot
from pathlib import Path
from xml.etree.ElementTree import Element, ElementTree, SubElement, indent


OUT = Path(__file__).parent
DRAWIO = OUT / "PROINTERVIEW_CONCEPTUAL.drawio"
PREVIEW = OUT / "PROINTERVIEW_CONCEPTUAL_unified.png"
WIDTH, HEIGHT = 2050, 1650

ONE = "ERmandOne"
ZERO_ONE = "ERzeroToOne"
ZERO_MANY = "ERzeroToMany"


@dataclass(frozen=True)
class Entity:
    name: str
    x: int
    y: int
    w: int
    h: int = 66


@dataclass(frozen=True)
class Relation:
    source: str
    target: str
    start: tuple[int, int]
    end: tuple[int, int]
    via: tuple[tuple[int, int], ...]
    source_card: str = ONE
    target_card: str = ZERO_MANY
    derived: bool = False

    @property
    def points(self):
        return (self.start, *self.via, self.end)


# Names here match the Mongoose models, not the entities in the example image.
ENTITIES = [
    Entity("SUBSCRIPTION", 140, 220, 190),
    Entity("MENTOR", 750, 220, 180),
    Entity("BOOKING", 1110, 220, 180),
    Entity("PAYOUT_REQUEST", 1670, 220, 200),
    Entity("CV_ANALYSIS", 140, 510, 210),
    Entity("USER", 680, 510, 180),
    Entity("PAYMENT", 1390, 510, 180),
    Entity("CART", 1700, 510, 170),
    Entity("INTERVIEW_SESSION", 140, 780, 220),
    Entity("REVIEW", 670, 900, 180),
    Entity("COURSE", 1030, 900, 180),
    Entity("ENROLLMENT", 1360, 830, 190),
    Entity("CART_ORDER", 1710, 900, 180),
    Entity("NOTIFICATION", 400, 1170, 190),
    Entity("COURSE_QA", 1000, 1190, 180),
    Entity("MENTOR_PEER_REVIEW", 1290, 1210, 230),
    Entity("REPORT", 140, 1420, 180),
]

RELATIONS = [
    # mentor.userId is optional and unique; seeded mentors may have no User.
    Relation("USER", "MENTOR", (755, 510), (840, 286), ((755, 385), (840, 385)), ZERO_ONE, ZERO_ONE),
    Relation("USER", "BOOKING", (830, 510), (1200, 286), ((830, 445), (1200, 445))),
    Relation("MENTOR", "BOOKING", (930, 253), (1110, 253), ()),
    Relation("MENTOR", "COURSE", (905, 286), (1030, 935), ((905, 935),)),
    Relation("MENTOR", "PAYOUT_REQUEST", (840, 220), (1770, 220), ((840, 185), (1770, 185))),
    Relation("USER", "SUBSCRIPTION", (680, 520), (330, 253), ((520, 520), (520, 253)), ONE, ZERO_ONE),
    Relation("USER", "CV_ANALYSIS", (680, 545), (350, 545), ()),
    Relation("USER", "INTERVIEW_SESSION", (680, 566), (360, 813), ((560, 566), (560, 813))),
    Relation("USER", "NOTIFICATION", (700, 576), (590, 1203), ((700, 665), (620, 665), (620, 1203))),
    Relation("USER", "REPORT", (685, 576), (140, 1453), ((685, 705), (100, 705), (100, 1453))),
    Relation("USER", "REVIEW", (790, 576), (790, 900), ()),
    Relation("USER", "PAYMENT", (860, 540), (1390, 540), ()),
    Relation("USER", "ENROLLMENT", (860, 565), (1360, 863), ((1260, 565), (1260, 863))),
    Relation("USER", "CART", (860, 520), (1785, 510), ((1040, 520), (1040, 430), (1785, 430)), ONE, ZERO_ONE),
    Relation("USER", "CART_ORDER", (850, 576), (1710, 933), ((875, 576), (875, 750), (1640, 750), (1640, 933))),
    # Payment.referenceModel/referenceId points to one of three business objects.
    Relation("BOOKING", "PAYMENT", (1200, 286), (1480, 510), ((1200, 365), (1480, 365)), ZERO_ONE, ZERO_MANY, True),
    Relation("SUBSCRIPTION", "PAYMENT", (235, 220), (1570, 540), ((235, 155), (1610, 155), (1610, 540)), ZERO_ONE, ZERO_MANY, True),
    Relation("ENROLLMENT", "PAYMENT", (1460, 830), (1460, 576), (), ZERO_ONE, ZERO_MANY, True),
    Relation("COURSE", "ENROLLMENT", (1210, 933), (1360, 875), ((1290, 933), (1290, 875))),
    # Review.targetType/targetId selects either Mentor or Course.
    Relation("COURSE", "REVIEW", (1030, 933), (850, 933), (), ZERO_ONE, ZERO_MANY, True),
    Relation("MENTOR", "REVIEW", (750, 255), (670, 933), ((640, 255), (640, 933)), ZERO_ONE, ZERO_MANY, True),
    Relation("COURSE", "COURSE_QA", (1120, 966), (1120, 1190), ()),
    Relation("USER", "COURSE_QA", (860, 550), (1000, 1223), ((965, 550), (965, 1223))),
    Relation("MENTOR", "MENTOR_PEER_REVIEW", (930, 270), (1405, 1276), ((950, 270), (950, 1370), (1405, 1370))),
    Relation("COURSE", "MENTOR_PEER_REVIEW", (1210, 950), (1290, 1243), ((1250, 950), (1250, 1243))),
    # Cart.courseIds is an array of references, not a separate join collection.
    Relation("CART", "COURSE", (1785, 576), (1140, 900), ((1785, 680), (1140, 680)), ZERO_MANY, ZERO_MANY, True),
    Relation("CART_ORDER", "ENROLLMENT", (1710, 950), (1550, 863), ((1620, 950), (1620, 863)), ZERO_ONE, ZERO_MANY),
]


def on_border(box: Entity, point: tuple[int, int]) -> bool:
    x, y = point
    return ((x in (box.x, box.x + box.w) and box.y <= y <= box.y + box.h)
            or (y in (box.y, box.y + box.h) and box.x <= x <= box.x + box.w))


by_name = {entity.name: entity for entity in ENTITIES}
assert len(by_name) == len(ENTITIES)
for relation in RELATIONS:
    assert relation.source in by_name and relation.target in by_name
    assert on_border(by_name[relation.source], relation.start), relation
    assert on_border(by_name[relation.target], relation.end), relation
    for a, b in zip(relation.points, relation.points[1:]):
        assert (a[0] == b[0]) != (a[1] == b[1]), relation


def vertex(root, ident, label, x, y, w, h, style):
    cell = SubElement(root, "mxCell", {
        "id": ident, "value": label, "style": style, "vertex": "1", "parent": "1",
    })
    SubElement(cell, "mxGeometry", {
        "x": str(x), "y": str(y), "width": str(w), "height": str(h), "as": "geometry",
    })


mxfile = Element("mxfile", {"host": "app.diagrams.net", "version": "24.7.17", "type": "device"})
diagram = SubElement(mxfile, "diagram", {"id": "conceptual", "name": "Conceptual Diagram"})
model = SubElement(diagram, "mxGraphModel", {
    "dx": "1800", "dy": "1400", "grid": "1", "gridSize": "10", "guides": "1",
    "tooltips": "1", "connect": "1", "arrows": "1", "fold": "1", "page": "1",
    "pageScale": "1", "pageWidth": str(WIDTH), "pageHeight": str(HEIGHT),
    "math": "0", "shadow": "0",
})
root = SubElement(model, "root")
SubElement(root, "mxCell", {"id": "0"})
SubElement(root, "mxCell", {"id": "1", "parent": "0"})

for number, relation in enumerate(RELATIONS, 1):
    source, target = by_name[relation.source], by_name[relation.target]
    sx, sy = (relation.start[0] - source.x) / source.w, (relation.start[1] - source.y) / source.h
    tx, ty = (relation.end[0] - target.x) / target.w, (relation.end[1] - target.y) / target.h
    style = (
        "edgeStyle=none;rounded=0;orthogonal=1;html=1;strokeColor=#111111;strokeWidth=1.5;"
        f"startArrow={relation.source_card};endArrow={relation.target_card};"
        "startFill=1;endFill=1;startSize=13;endSize=13;"
        f"exitX={sx:.5f};exitY={sy:.5f};entryX={tx:.5f};entryY={ty:.5f};"
        "exitPerimeter=0;entryPerimeter=0;"
    )
    if relation.derived:
        style += "dashed=1;dashPattern=8 5;"
    edge = SubElement(root, "mxCell", {
        "id": f"relationship_{number}", "value": "", "style": style,
        "edge": "1", "parent": "1", "source": relation.source, "target": relation.target,
    })
    geometry = SubElement(edge, "mxGeometry", {"relative": "1", "as": "geometry"})
    if relation.via:
        points = SubElement(geometry, "Array", {"as": "points"})
        for x, y in relation.via:
            SubElement(points, "mxPoint", {"x": str(x), "y": str(y)})

vertex(root, "heading", "II.6 Entity Relationship Diagram", 125, 25, 1500, 65,
       "text;html=1;fillColor=none;strokeColor=none;align=left;verticalAlign=middle;"
       "fontFamily=Times New Roman;fontSize=43;fontStyle=3;fontColor=#111111;")
vertex(root, "subheading", "Conceptual Diagram", 125, 95, 1200, 50,
       "text;html=1;fillColor=none;strokeColor=none;align=left;verticalAlign=middle;"
       "fontFamily=Times New Roman;fontSize=31;fontStyle=1;fontColor=#111111;")
box_style = (
    "rounded=0;whiteSpace=wrap;html=1;fillColor=#FFFFFF;strokeColor=#111111;"
    "strokeWidth=1.5;fontFamily=Arial;fontSize=16;fontStyle=1;"
    "fontColor=#111111;align=center;verticalAlign=middle;spacing=8;"
)
for entity in ENTITIES:
    vertex(root, entity.name, entity.name, entity.x, entity.y, entity.w, entity.h, box_style)

vertex(root, "note", "Nét đứt: liên kết theo referenceModel / targetType hoặc mảng courseIds.  "
       "Module, Lesson, Certificate, CV và JD là dữ liệu nằm trong model khác.",
       130, 1540, 1790, 55,
       "text;html=1;whiteSpace=wrap;fillColor=none;strokeColor=none;"
       "fontFamily=Arial;fontSize=15;fontColor=#333333;align=center;verticalAlign=middle;")

indent(mxfile, space="  ")
ElementTree(mxfile).write(DRAWIO, encoding="utf-8", xml_declaration=True)
print(DRAWIO)


try:
    from PIL import Image, ImageDraw, ImageFont
except ImportError:
    pass
else:
    fonts = Path("C:/Windows/Fonts")

    def font(name, size):
        path = fonts / name
        return ImageFont.truetype(str(path), size) if path.exists() else ImageFont.load_default()

    image = Image.new("RGB", (WIDTH, HEIGHT), "white")
    draw = ImageDraw.Draw(image)

    def marker(point, inside, kind):
        length = hypot(inside[0] - point[0], inside[1] - point[1])
        ux, uy = (inside[0] - point[0]) / length, (inside[1] - point[1]) / length
        vx, vy = -uy, ux

        def line_at(distance):
            x, y = point[0] + ux * distance, point[1] + uy * distance
            draw.line((x - vx * 7, y - vy * 7, x + vx * 7, y + vy * 7), fill="#111111", width=2)

        if kind == ONE:
            line_at(8)
            line_at(18)
        elif kind == ZERO_ONE:
            line_at(8)
            cx, cy = point[0] + ux * 21, point[1] + uy * 21
            draw.ellipse((cx - 5, cy - 5, cx + 5, cy + 5), fill="white", outline="#111111", width=2)
        elif kind == ZERO_MANY:
            tipx, tipy = point[0] + ux * 4, point[1] + uy * 4
            basex, basey = point[0] + ux * 18, point[1] + uy * 18
            for side in (-1, 0, 1):
                draw.line((tipx + vx * side * 8, tipy + vy * side * 8, basex, basey), fill="#111111", width=2)
            cx, cy = point[0] + ux * 30, point[1] + uy * 30
            draw.ellipse((cx - 5, cy - 5, cx + 5, cy + 5), fill="white", outline="#111111", width=2)

    for relation in RELATIONS:
        points = relation.points
        if relation.derived:
            for a, b in zip(points, points[1:]):
                length = hypot(b[0] - a[0], b[1] - a[1])
                dx, dy = (b[0] - a[0]) / length, (b[1] - a[1]) / length
                offset = 0
                while offset < length:
                    end = min(offset + 10, length)
                    draw.line((a[0] + dx * offset, a[1] + dy * offset,
                               a[0] + dx * end, a[1] + dy * end), fill="#111111", width=2)
                    offset += 17
        else:
            draw.line(points, fill="#111111", width=2)
        marker(points[0], points[1], relation.source_card)
        marker(points[-1], points[-2], relation.target_card)

    draw.text((125, 29), "II.6 Entity Relationship Diagram", font=font("timesbi.ttf", 48), fill="#111111")
    draw.text((125, 104), "Conceptual Diagram", font=font("timesbd.ttf", 34), fill="#111111")
    label_font = font("arialbd.ttf", 17)
    for entity in ENTITIES:
        draw.rectangle((entity.x, entity.y, entity.x + entity.w, entity.y + entity.h),
                       fill="white", outline="#111111", width=2)
        draw.text((entity.x + entity.w / 2, entity.y + entity.h / 2), entity.name,
                  anchor="mm", font=label_font, fill="#111111")
    draw.text((WIDTH / 2, 1552),
              "Nét đứt: referenceModel / targetType hoặc courseIds.  Module, Lesson, Certificate, CV và JD là dữ liệu lồng trong model khác.",
              anchor="mm", font=font("arial.ttf", 17), fill="#333333")
    image.save(PREVIEW, optimize=True)
    print(PREVIEW)
