import path from "node:path";
import { httpError } from "../utils/apiErrors.js";

const VALID_EXTENSIONS = /\.(pdf|doc|docx|txt)$/i;
const MAX_BYTES = 5 * 1024 * 1024; // 5MB

// Từ khóa bắt buộc nhận diện nội dung CV (Tiếng Việt và Tiếng Anh)
const CV_SECTION_KEYWORDS = [
  "kinh nghiệm",
  "học vấn",
  "kỹ năng",
  "dự án",
  "mục tiêu",
  "học tập",
  "liên hệ",
  "người tham chiếu",
  "chức vụ",
  "bằng cấp",
  "chứng chỉ",
  "thông tin cá nhân",
  "tốt nghiệp",
  "trình độ",
  "hoạt động",
  "thành tích",
  "kinh nghiệm làm việc",
  "hồ sơ xin việc",
  "experience",
  "education",
  "skills",
  "summary",
  "objective",
  "projects",
  "contact",
  "certifications",
  "work experience",
  "curriculum vitae",
  "resume",
];

// Dấu hiệu file không phải CV (hóa đơn, báo cáo tài chính, ảnh)
const INVOICE_OR_RECEIPT_KEYWORDS = [
  "hóa đơn giá trị gia tăng",
  "hóa đơn vat",
  "phiếu thu",
  "phiếu xuất kho",
  "bảng kê thu viện phí",
  "sao kê tài khoản",
  "tax invoice",
  "receipt",
];

/**
 * PR-04: Kiểm tra tệp tải lên có đúng chuẩn CV hay không.
 * Từ chối ảnh, hóa đơn, bảng tính với thông báo lỗi tiếng Việt rõ ràng.
 */
export function validateCvFile({ originalname, mimetype, buffer, size }) {
  const fileName = String(originalname || "").trim();

  // 1. Kiểm tra phần mở rộng
  if (!VALID_EXTENSIONS.test(fileName)) {
    throw httpError(
      400,
      `Định dạng tệp "${path.extname(fileName) || fileName}" không được chấp nhận. Vui lòng tải lên tệp PDF, DOCX, DOC hoặc TXT.`
    );
  }

  // 2. Kiểm tra dung lượng
  if (size != null && size > MAX_BYTES) {
    throw httpError(400, "Tệp CV vượt quá dung lượng tối đa 5MB. Vui lòng nén hoặc chọn tệp nhỏ hơn.");
  }

  if (buffer && Buffer.isBuffer(buffer)) {
    // 3. Kiểm tra Magic Bytes loại trừ ảnh
    if (buffer.length >= 8) {
      // PNG magic number: 89 50 4E 47 0D 0A 1A 0A
      if (
        buffer[0] === 0x89 &&
        buffer[1] === 0x50 &&
        buffer[2] === 0x4e &&
        buffer[3] === 0x47
      ) {
        throw httpError(
          400,
          "Tệp tải lên là hình ảnh (PNG), không phải là CV hợp lệ. Vui lòng tải lên tệp văn bản PDF hoặc Word."
        );
      }

      // JPEG magic number: FF D8 FF
      if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
        throw httpError(
          400,
          "Tệp tải lên là hình ảnh (JPEG/JPG), không phải là CV hợp lệ. Vui lòng xuất CV sang định dạng PDF để tải lên."
        );
      }

      // GIF magic: GIF8
      if (buffer.slice(0, 4).toString() === "GIF8") {
        throw httpError(400, "Tệp ảnh GIF không phải là CV hợp lệ.");
      }
    }

    // 4. Kiểm tra nội dung văn bản (đối với text hoặc buffer có thể đọc text thô)
    const rawSample = buffer.slice(0, Math.min(buffer.length, 30000)).toString("utf-8").toLowerCase();

    // Kiểm tra hóa đơn
    const isInvoice = INVOICE_OR_RECEIPT_KEYWORDS.some((kw) => rawSample.includes(kw));
    if (isInvoice) {
      throw httpError(
        400,
        "Tệp tải lên là hóa đơn hoặc chứng từ kế toán, không phải CV. Vui lòng tải lên hồ sơ ứng tuyển của bạn."
      );
    }

    // Nếu là file txt hoặc có text trích xuất được
    if (fileName.endsWith(".txt") || mimetype === "text/plain") {
      const matchCount = CV_SECTION_KEYWORDS.filter((kw) => rawSample.includes(kw)).length;
      if (matchCount === 0 && rawSample.trim().length > 0) {
        throw httpError(
          400,
          "Tệp văn bản không chứa các mục thông tin CV cần thiết (Kinh nghiệm, Học vấn, Kỹ năng, Liên hệ)."
        );
      }
    }
  }

  return { isValid: true };
}
