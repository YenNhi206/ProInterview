import path from "node:path";
import { fileURLToPath } from "node:url";
import PDFDocument from "pdfkit";
import { httpError } from "../utils/apiErrors.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FONT_REGULAR_PATH = path.join(__dirname, "../assets/fonts/DejaVuSans.ttf");
const FONT_BOLD_PATH = path.join(__dirname, "../assets/fonts/DejaVuSans-Bold.ttf");

/**
 * PR-09: Xuất PDF CV chuẩn ATS bằng pdfkit + font DejaVu Sans (hỗ trợ trọn vẹn tiếng Việt có dấu).
 */
export async function exportCvToPdf(cv, user) {
  if (!cv) throw httpError(404, "Không tìm thấy dữ liệu CV để xuất PDF.");

  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: "A4",
        margins: { top: 36, bottom: 36, left: 40, right: 40 },
        bufferPages: true,
      });

      doc.registerFont("DejaVuSans", FONT_REGULAR_PATH);
      doc.registerFont("DejaVuSans-Bold", FONT_BOLD_PATH);

      const chunks = [];
      doc.on("data", (chunk) => chunks.push(chunk));
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.on("error", (err) => reject(err));

      const content = cv.content || {};
      const personal = content.personalInfo || {};
      const fullName = personal.fullName || user?.name || "Ứng viên ProInterview";
      const targetRole = cv.targetRole || personal.title || "Chuyên viên Kỹ thuật";

      // ── Header ──
      doc.font("DejaVuSans-Bold").fontSize(18).fillColor("#0f172a").text(fullName, { align: "left" });
      doc.font("DejaVuSans").fontSize(12).fillColor("#4f46e5").text(targetRole, { align: "left" });

      doc.moveDown(0.3);

      // Contact row
      const contacts = [
        personal.email || user?.email,
        personal.phone || user?.phone,
        personal.location,
        personal.linkedin,
        personal.github || personal.website,
      ].filter(Boolean);

      if (contacts.length > 0) {
        doc.font("DejaVuSans").fontSize(9).fillColor("#475569").text(contacts.join("   •   "), { align: "left" });
      }

      doc.moveDown(0.5);
      // Divider line
      doc
        .strokeColor("#cbd5e1")
        .lineWidth(1)
        .moveTo(doc.page.margins.left, doc.y)
        .lineTo(doc.page.width - doc.page.margins.right, doc.y)
        .stroke();

      doc.moveDown(0.8);

      const renderSectionHeading = (title) => {
        doc.moveDown(0.5);
        doc.font("DejaVuSans-Bold").fontSize(11).fillColor("#1e293b").text(title.toUpperCase());
        doc
          .strokeColor("#94a3b8")
          .lineWidth(0.5)
          .moveTo(doc.page.margins.left, doc.y)
          .lineTo(doc.page.width - doc.page.margins.right, doc.y)
          .stroke();
        doc.moveDown(0.4);
      };

      // ── Summary ──
      const summaryText = content.summary || cv.summary;
      if (summaryText && summaryText.trim()) {
        renderSectionHeading("Tóm tắt nghề nghiệp");
        doc.font("DejaVuSans").fontSize(9.5).fillColor("#334155").text(summaryText.trim(), {
          align: "justify",
          lineGap: 3,
        });
      }

      // ── Experience ──
      const experiences = Array.isArray(content.experiences) ? content.experiences : [];
      if (experiences.length > 0) {
        renderSectionHeading("Kinh nghiệm làm việc");
        for (const exp of experiences) {
          const titleLine = `${exp.position || "Vị trí"} - ${exp.company || "Công ty"}`;
          const period = `${exp.startDate || ""} - ${exp.isCurrent ? "Hiện tại" : exp.endDate || ""}`;

          doc.font("DejaVuSans-Bold").fontSize(10).fillColor("#0f172a").text(titleLine, { continued: true });
          doc.font("DejaVuSans").fontSize(9).fillColor("#64748b").text(`  (${period.trim()})`, { align: "right" });

          if (exp.description && exp.description.trim()) {
            doc.font("DejaVuSans").fontSize(9).fillColor("#334155").text(exp.description.trim(), { lineGap: 2 });
          }

          if (Array.isArray(exp.bullets) && exp.bullets.length > 0) {
            for (const b of exp.bullets) {
              if (b && b.trim()) {
                doc.font("DejaVuSans").fontSize(9).fillColor("#334155").text(`  •  ${b.trim()}`, {
                  indent: 10,
                  lineGap: 2,
                });
              }
            }
          }
          doc.moveDown(0.4);
        }
      }

      // ── Skills ──
      const skills = Array.isArray(cv.skills) && cv.skills.length ? cv.skills : content.skills;
      if (Array.isArray(skills) && skills.length > 0) {
        renderSectionHeading("Kỹ năng chuyên môn");
        doc.font("DejaVuSans").fontSize(9.5).fillColor("#334155").text(skills.join(", "), { lineGap: 3 });
      }

      // ── Projects ──
      const projects = Array.isArray(content.projects) ? content.projects : [];
      if (projects.length > 0) {
        renderSectionHeading("Dự án tiêu biểu");
        for (const prj of projects) {
          const prjTitle = prj.role ? `${prj.name} (${prj.role})` : prj.name;
          doc.font("DejaVuSans-Bold").fontSize(9.5).fillColor("#0f172a").text(prjTitle);

          if (Array.isArray(prj.technologies) && prj.technologies.length > 0) {
            doc.font("DejaVuSans").fontSize(8.5).fillColor("#64748b").text(`Công nghệ: ${prj.technologies.join(", ")}`);
          }

          if (prj.description && prj.description.trim()) {
            doc.font("DejaVuSans").fontSize(9).fillColor("#334155").text(prj.description.trim(), { lineGap: 2 });
          }
          doc.moveDown(0.3);
        }
      }

      // ── Education ──
      const educations = Array.isArray(content.educations) ? content.educations : [];
      if (educations.length > 0) {
        renderSectionHeading("Học vấn");
        for (const edu of educations) {
          const degLine = `${edu.degree || "Bằng cấp"} ${edu.fieldOfStudy ? `• ${edu.fieldOfStudy}` : ""} - ${edu.institution || "Trường học"}`;
          const eduPeriod = `${edu.startDate || ""} - ${edu.endDate || ""}`;

          doc.font("DejaVuSans-Bold").fontSize(9.5).fillColor("#0f172a").text(degLine, { continued: true });
          if (eduPeriod.trim() !== "-") {
            doc.font("DejaVuSans").fontSize(8.5).fillColor("#64748b").text(`  (${eduPeriod.trim()})`, { align: "right" });
          } else {
            doc.text("");
          }

          if (edu.gpa) {
            doc.font("DejaVuSans").fontSize(8.5).fillColor("#64748b").text(`GPA: ${edu.gpa}`);
          }
          doc.moveDown(0.3);
        }
      }

      // ── Certifications ──
      const certifications = Array.isArray(content.certifications) ? content.certifications : [];
      if (certifications.length > 0) {
        renderSectionHeading("Chứng chỉ");
        for (const cert of certifications) {
          const certLine = `${cert.name}${cert.issuer ? ` - ${cert.issuer}` : ""}${cert.issueDate ? ` (${cert.issueDate})` : ""}`;
          doc.font("DejaVuSans").fontSize(9).fillColor("#334155").text(`  •  ${certLine}`);
        }
      }

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}
