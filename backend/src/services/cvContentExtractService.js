/**
 * PR-08 (REQ C-04): tách file CV đã tải lên thành `content` JSON để mở trong trình sửa CV
 * (`POST /api/cvs/:id/extract-content`).
 *
 * Node kiểm quyền (CV của chính user, có tệp gốc), đọc file, gọi Python `POST /extract-content`
 * (một lượt LLM, LLM lỗi thì Python tách theo tiêu đề mục). Không ghi DB: editor điền kết quả vào
 * bản nháp, người dùng kiểm rồi bấm Lưu (PATCH /api/cvs/:id tăng version như thường).
 */
import mongoose from "mongoose";
import { CVDocument } from "../models/CVDocument.js";
import { readCvFile } from "./cvBestFitService.js";
import { httpError } from "../utils/apiErrors.js";
import { logger } from "../config/logger.js";

const PYTHON_TIMEOUT_MS = 90_000;
const EXTRACTABLE = /\.(pdf|docx|txt)$/i;

const analyzerUrl = () => process.env.CV_ANALYZER_URL || "http://localhost:8000";

async function callPython(buffer, fileName, mimeType) {
  const form = new FormData();
  form.append("file", new Blob([buffer], { type: mimeType || "application/octet-stream" }), fileName);

  let res;
  try {
    res = await fetch(`${analyzerUrl()}/extract-content`, {
      method: "POST",
      body: form,
      signal: AbortSignal.timeout(PYTHON_TIMEOUT_MS),
    });
  } catch (err) {
    logger.error("cv_extract_content_python_unreachable", { error: err?.message });
    if (err?.name === "TimeoutError") throw httpError(504, "Dịch vụ phân tích CV phản hồi quá lâu, vui lòng thử lại.");
    throw httpError(503, "Không kết nối được dịch vụ phân tích CV, vui lòng thử lại sau.");
  }
  const text = await res.text();
  let data;
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    throw httpError(502, "Dịch vụ phân tích CV trả về dữ liệu không hợp lệ.");
  }
  if (!res.ok) {
    const detail = typeof data?.detail === "string" ? data.detail : "";
    throw httpError(res.status >= 500 ? 502 : 400, detail || "Không tách được nội dung từ tệp CV.");
  }
  if (!data?.content || typeof data.content !== "object") {
    throw httpError(502, "Dịch vụ phân tích CV trả về dữ liệu không hợp lệ.");
  }
  return data;
}

/**
 * @param {string} userId
 * @param {string} cvId
 * @returns {Promise<{ content: object, method: "llm" | "rules", sections: string[], cvVersion: number }>}
 */
export async function extractCvContent(userId, cvId) {
  if (!userId) throw httpError(401, "Yêu cầu đăng nhập.");
  if (!mongoose.isValidObjectId(cvId)) throw httpError(400, "Mã CV không hợp lệ.");

  const cv = await CVDocument.findOne({ _id: cvId, userId }).lean();
  if (!cv) throw httpError(404, "Không tìm thấy CV.");
  if (!cv.fileUrl) throw httpError(400, "CV này không có tệp tải lên để tách nội dung.");

  const fileName = cv.fileName || cv.fileKey || "cv.pdf";
  if (!EXTRACTABLE.test(fileName)) {
    throw httpError(400, "Chỉ tách được nội dung từ tệp PDF, DOCX hoặc TXT.");
  }

  const buffer = await readCvFile(cv);
  if (!buffer) throw httpError(404, "Không đọc được tệp CV gốc. Vui lòng tải lại tệp lên kho CV.");

  const started = Date.now();
  const data = await callPython(buffer, fileName, cv.mimeType);
  logger.info("cv_extract_content", {
    cvId: String(cv._id),
    method: data.method,
    sections: data.sections,
    durationMs: Date.now() - started,
  });

  return {
    content: data.content,
    method: data.method === "llm" ? "llm" : "rules",
    sections: Array.isArray(data.sections) ? data.sections : [],
    cvVersion: cv.version || 1,
  };
}
