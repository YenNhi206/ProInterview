import React, { useState } from "react";
import { FileText, Briefcase, Search as MagnifyingGlass, Eye } from "lucide-react";

const CV_KEYWORDS_MATCHED = ["React", "TypeScript", "Node.js", "REST API", "Agile", "Git"];
const JD_KEYWORDS_ALL = ["React", "TypeScript", "Node.js", "Docker", "AWS", "CI/CD", "REST API", "PostgreSQL", "Agile", "Git"];
const MISSING_FROM_CV = JD_KEYWORDS_ALL.filter((k) => !CV_KEYWORDS_MATCHED.includes(k)); // Docker, AWS, CI/CD, PostgreSQL
const EXTRA_IN_CV = []; // keywords in CV but not in JD (none in this mock)

// ------- CV Mock Content -------
const CV_SECTIONS = [
  {
    type: "header",
    content: `NGUYỄN TUẤN ANH\nFrontend Developer`,
  },
  {
    type: "info",
    content: `Email: nguyentuananh@gmail.com\nĐiện thoại: 0912 345 678\nLinkedIn: linkedin.com/in/nguyentuananh\nĐịa chỉ: Cầu Giấy, Hà Nội`,
  },
  {
    type: "section",
    title: "MỤC TIÊU NGHỀ NGHIỆP",
    content: `Với 3 năm kinh nghiệm phát triển web với React và TypeScript, tôi mong muốn ứng dụng kỹ năng Node.js và REST API vào các sản phẩm lớn, làm việc trong môi trường Agile năng động để tạo ra giá trị thực sự.`,
  },
  {
    type: "section",
    title: "KỸ NĂNG KỸ THUẬT",
    content: `• Frontend: React, TypeScript, JavaScript, HTML/CSS, Tailwind\n• Backend: Node.js, Express.js, REST API\n• Database: MySQL, MongoDB\n• Tools: Git, Webpack, Vite, VS Code\n• Phương pháp: Agile, Scrum, Kanban`,
  },
  {
    type: "section",
    title: "KINH NGHIỆM LÀM VIỆC",
    content: `Senior Frontend Developer — ABC Tech (2022 – nay)\n• Phát triển và tối ưu các module với React, TypeScript\n• Xây dựng và tích hợp REST API với Node.js backend\n• Làm việc theo quy trình Agile với sprint 2 tuần\n• Quản lý source code qua Git, review code hàng ngày\n\nFrontend Developer — XYZ Startup (2020 – 2022)\n• Xây dựng SPA với React và TypeScript\n• Viết unit test và integration test\n• Tham gia daily standup, retrospective trong Agile team`,
  },
  {
    type: "section",
    title: "DỰ ÁN NỔI BẬT",
    content: `E-Commerce Platform (2023)\n• Stack: React, TypeScript, Node.js, REST API\n• Kết quả: tăng 40% conversion rate, phục vụ 50K users/ngày\n\nHR Dashboard (2022)\n• Stack: React, TypeScript, Git workflow\n• Tích hợp REST API với hệ thống HR nội bộ`,
  },
  {
    type: "section",
    title: "HỌC VẤN",
    content: `Đại học Bách Khoa Hà Nội — Kỹ thuật Máy tính (2016 – 2020)\nGPA: 3.5/4.0`,
  },
];

// ------- JD Mock Content -------
const JD_SECTIONS = [
  {
    type: "header",
    content: `SENIOR FRONTEND DEVELOPER\nShopee Vietnam — Ho Chi Minh City`,
  },
  {
    type: "section",
    title: "MÔ TẢ VỊ TRÍ",
    content: `Chúng tôi tìm kiếm một Senior Frontend Developer có kinh nghiệm với React và TypeScript để tham gia vào đội ngũ phát triển sản phẩm quy mô lớn phục vụ hàng triệu người dùng.`,
  },
  {
    type: "section",
    title: "YÊU CẦU KỸ THUẬT",
    content: `• Tối thiểu 3 năm kinh nghiệm với React và TypeScript\n• Thành thạo Node.js để phát triển BFF layer\n• Kinh nghiệm với REST API và thiết kế API chuẩn RESTful\n• Kiến thức về Docker để containerize ứng dụng\n• Kinh nghiệm deploy lên AWS (EC2, S3, CloudFront)\n• Quen thuộc với CI/CD pipelines (GitLab CI, Jenkins)\n• Làm việc với database PostgreSQL\n• Quản lý version với Git, quy trình GitFlow\n• Làm việc trong môi trường Agile/Scrum`,
  },
  {
    type: "section",
    title: "TRÁCH NHIỆM CÔNG VIỆC",
    content: `• Thiết kế và phát triển các tính năng frontend với React, TypeScript\n• Xây dựng CI/CD pipeline để tự động hóa deploy\n• Triển khai và quản lý ứng dụng trên AWS\n• Đóng gói ứng dụng với Docker để chạy nhất quán trên mọi môi trường\n• Tối ưu query PostgreSQL và tích hợp với REST API\n• Collaborate trong team Agile, tham gia code review qua Git`,
  },
  {
    type: "section",
    title: "YÊU CẦU KHÁC",
    content: `• Kỹ năng giao tiếp tiếng Anh tốt (đọc/viết tài liệu kỹ thuật)\n• Tư duy phân tích, giải quyết vấn đề độc lập\n• Có khả năng mentor junior developers\n• Chịu được áp lực, làm việc hiệu quả trong deadline`,
  },
  {
    type: "section",
    title: "PHÚC LỢI",
    content: `• Lương: 2,000 – 3,500 USD (thương lượng theo năng lực)\n• Thưởng hiệu suất hàng quý\n• Bảo hiểm sức khỏe cao cấp\n• MacBook Pro + màn hình 4K\n• Môi trường Agile linh hoạt, remote-friendly`,
  },
];

// Highlight function: splits text by keywords and wraps them with color marks

function buildSegments(text, keywords) {
  let segments = [{ text, type: "normal" }];
  for (const { kw, type } of keywords) {
    const newSegments = [];
    for (const seg of segments) {
      if (seg.type !== "normal") {
        newSegments.push(seg);
        continue;
      }
      const parts = seg.text.split(kw);
      for (let i = 0; i < parts.length; i++) {
        if (parts[i]) newSegments.push({ text: parts[i], type: "normal" });
        if (i < parts.length - 1) newSegments.push({ text: kw, type });
      }
    }
    segments = newSegments;
  }
  return segments;
}

function renderHighlightedText(text, matchedKws, missingKws, extraKws) {
  const keywords = [
    ...matchedKws.map((kw) => ({ kw, type: "matched" })),
    ...missingKws.map((kw) => ({ kw, type: "missing" })),
    ...extraKws.map((kw) => ({ kw, type: "extra" })),
  ];

  return text.split("\n").map((line, lineIdx) => {
    const segments = buildSegments(line, keywords);
    return (
      <div key={lineIdx} className={line === "" ? "h-2" : "leading-relaxed"}>
        {segments.map((seg, i) => {
          if (seg.type === "normal") return <span key={i}>{seg.text}</span>;
          if (seg.type === "matched")
            return (
              <mark
                key={i}
                style={{
                  background: "rgba(134,239,172,0.45)",
                  color: "#166534",
                  borderRadius: "3px",
                  padding: "0 3px",
                  fontWeight: 600,
                  border: "1px solid rgba(134,239,172,0.7)",
                }}
              >
                {seg.text}
              </mark>
            );
          if (seg.type === "missing")
            return (
              <mark
                key={i}
                style={{
                  background: "rgba(254,202,202,0.55)",
                  color: "#991b1b",
                  borderRadius: "3px",
                  padding: "0 3px",
                  fontWeight: 600,
                  border: "1px solid rgba(252,165,165,0.7)",
                }}
              >
                {seg.text}
              </mark>
            );
          // extra
          return (
            <mark
              key={i}
              style={{
                background: "rgba(219,234,254,0.55)",
                color: "#1e40af",
                borderRadius: "3px",
                padding: "0 3px",
                fontWeight: 600,
                border: "1px solid rgba(147,197,253,0.7)",
              }}
            >
              {seg.text}
            </mark>
          );
        })}
      </div>
    );
  });
}

function DocPanel({ title, fileName, icon, accentColor, sections, matchedKws, missingKws, extraKws }) {
  return (
    <div className="flex flex-col rounded-2xl overflow-hidden border border-gray-200 shadow-sm bg-white h-full">
      {/* Panel header */}
      <div className="px-4 py-3 flex items-center gap-2.5 border-b border-gray-100" style={{ background: accentColor }}>
        <div className="w-7 h-7 rounded-lg bg-white/20 flex items-center justify-center flex-shrink-0">{icon}</div>
        <div className="min-w-0">
          <p className="text-white text-xs font-semibold leading-tight">{title}</p>
          <p className="text-white/70 text-xs truncate">{fileName}</p>
        </div>
      </div>

      {/* Document body */}
      <div
        className="flex-1 overflow-y-auto p-5 text-gray-700"
        style={{ fontSize: "0.78rem", lineHeight: "1.6", maxHeight: "520px", background: "#fafafa" }}
      >
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 space-y-4">
          {sections.map((sec, idx) => (
            <div key={idx}>
              {sec.type === "header" && (
                <div className="mb-3 pb-3 border-b border-gray-200">
                  {sec.content.split("\n").map((line, i) => (
                    <div
                      key={i}
                      style={{
                        fontWeight: i === 0 ? 700 : 600,
                        fontSize: i === 0 ? "1rem" : "0.82rem",
                        color: i === 0 ? "#1a1a2e" : "#6E35E8",
                      }}
                    >
                      {line}
                    </div>
                  ))}
                </div>
              )}
              {sec.type === "info" && (
                <div className="text-gray-500 space-y-0.5 pb-3 border-b border-gray-100" style={{ fontSize: "0.74rem" }}>
                  {sec.content.split("\n").map((line, i) => (
                    <div key={i}>{line}</div>
                  ))}
                </div>
              )}
              {sec.type === "section" && (
                <div>
                  <div
                    className="uppercase tracking-wide mb-1.5 pb-0.5 border-b"
                    style={{ fontSize: "0.68rem", fontWeight: 700, color: "#374151", borderColor: "#e5e7eb" }}
                  >
                    {sec.title}
                  </div>
                  <div className="text-gray-600 space-y-0.5" style={{ fontSize: "0.77rem" }}>
                    {renderHighlightedText(sec.content, matchedKws, missingKws, extraKws)}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function CVDocumentPreview() {
  const [expanded, setExpanded] = useState(true);
  const matchedCount = CV_KEYWORDS_MATCHED.filter((k) => JD_KEYWORDS_ALL.includes(k)).length;

  return (
    <div className="mb-6">
      {/* Section header */}
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center justify-between mb-3 group"
      >
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: "rgba(110, 53, 232,0.1)" }}>
            <Eye className="w-4 h-4" style={{ color: "#6E35E8" }} />
          </div>
          <div className="text-left">
            <h3 className="text-gray-900 font-semibold" style={{ fontSize: "0.9rem" }}>
              So sánh CV & JD — Highlight từ khóa
            </h3>
            <p className="text-gray-400" style={{ fontSize: "0.75rem" }}>
              {matchedCount}/{JD_KEYWORDS_ALL.length} từ khóa khớp •{" "}
              <span style={{ color: "#dc2626" }}>{MISSING_FROM_CV.length} từ khóa JD chưa có trong CV</span>
            </p>
          </div>
        </div>
        <div
          className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg transition-colors"
          style={{ color: "#6E35E8", background: "rgba(110, 53, 232,0.07)" }}
        >
          <MagnifyingGlass className="w-3.5 h-3.5" />
          {expanded ? "Thu gọn" : "Xem chi tiết"}
        </div>
      </button>

      {/* Legend */}
      {expanded && (
        <div className="flex flex-wrap gap-3 mb-4 px-1">
          <div className="flex items-center gap-1.5">
            <span
              style={{
                display: "inline-block",
                width: 12,
                height: 12,
                borderRadius: 3,
                background: "rgba(134,239,172,0.45)",
                border: "1px solid rgba(134,239,172,0.7)",
              }}
            />
            <span className="text-gray-600" style={{ fontSize: "0.75rem" }}>
              Từ khóa khớp (matching)
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <span
              style={{
                display: "inline-block",
                width: 12,
                height: 12,
                borderRadius: 3,
                background: "rgba(254,202,202,0.55)",
                border: "1px solid rgba(252,165,165,0.7)",
              }}
            />
            <span className="text-gray-600" style={{ fontSize: "0.75rem" }}>
              Từ khóa JD chưa có trong CV
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <span
              style={{
                display: "inline-block",
                width: 12,
                height: 12,
                borderRadius: 3,
                background: "rgba(219,234,254,0.55)",
                border: "1px solid rgba(147,197,253,0.7)",
              }}
            />
            <span className="text-gray-600" style={{ fontSize: "0.75rem" }}>
              Từ khóa CV không có trong JD
            </span>
          </div>
        </div>
      )}

      {/* Side by side doc panels */}
      {expanded && (
        <div className="grid md:grid-cols-2 gap-4">
          <DocPanel
            title="CV của bạn"
            fileName="Nguyen_Tuan_Anh_CV.pdf"
            icon={<FileText className="w-4 h-4 text-white" />}
            accentColor="linear-gradient(135deg, #4F46E5, #7C3AED)"
            sections={CV_SECTIONS}
            matchedKws={CV_KEYWORDS_MATCHED.filter((k) => JD_KEYWORDS_ALL.includes(k))}
            missingKws={[]}
            extraKws={EXTRA_IN_CV}
          />
          <DocPanel
            title="Job Description"
            fileName="Shopee_Frontend_Senior_JD.pdf"
            icon={<Briefcase className="w-4 h-4 text-white" />}
            accentColor="linear-gradient(135deg, #7C3AED, #9333ea)"
            sections={JD_SECTIONS}
            matchedKws={CV_KEYWORDS_MATCHED.filter((k) => JD_KEYWORDS_ALL.includes(k))}
            missingKws={MISSING_FROM_CV}
            extraKws={[]}
          />
        </div>
      )}
    </div>
  );
}
