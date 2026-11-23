/**
 * PR-05 (REQ C-04, AIS-05): chọn CV phù hợp nhất cho một JD — `POST /api/cv/best-fit`.
 *
 * Node kiểm quyền (chỉ CV của chính user trong kho `/api/cvs`), lấy chữ / file từng CV, lấy JD từ
 * `jdText` hoặc job đang mở (`jobPostId`), rồi gọi Python `POST /best-fit` (một lượt LLM cho cả bộ;
 * LLM lỗi thì Python xếp theo kỹ năng). Không ghi DB.
 */
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import mongoose from "mongoose";
import Joi from "joi";
import { CVDocument } from "../models/CVDocument.js";
import { findPublicJob } from "./publicJobsService.js";
import { requiredCompetencyRows } from "./jobPostsService.js";
import { httpError } from "../utils/apiErrors.js";
import { logger } from "../config/logger.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const UPLOAD_ROOT = path.resolve(__dirname, "../../public/uploads");

export const BEST_FIT_LIMITS = Object.freeze({ minCvs: 2, maxCvs: 5, minJd: 30, maxJd: 20_000 });
const PYTHON_TIMEOUT_MS = 60_000;
const REMOTE_FILE_TIMEOUT_MS = 15_000;
const MAX_FILE_BYTES = 5 * 1024 * 1024;

const objectId = Joi.string().hex().length(24);
const input = Joi.object({
  cvIds: Joi.array().items(objectId).min(BEST_FIT_LIMITS.minCvs).max(BEST_FIT_LIMITS.maxCvs).unique().required(),
  jdText: Joi.string().trim().min(BEST_FIT_LIMITS.minJd).max(BEST_FIT_LIMITS.maxJd).allow(""),
  jobPostId: objectId.allow("", null),
});

const analyzerUrl = () => process.env.CV_ANALYZER_URL || "http://localhost:8000";

/** Chữ của CV soạn trong editor (`content`). Rỗng nếu chưa soạn gì. */
export function cvContentText(content = {}) {
  const c = content ?? {};
  const lines = [
    c.summary,
    ...(c.experiences ?? []).flatMap((e) => [
      [e.position, e.company, [e.startDate, e.isCurrent ? "nay" : e.endDate].filter(Boolean).join(" – ")].filter(Boolean).join(" · "),
      e.description,
      ...(e.bullets ?? []),
    ]),
    ...(c.projects ?? []).flatMap((p) => [[p.name, p.role].filter(Boolean).join(" · "), p.description, (p.technologies ?? []).join(", ")]),
    (c.skills ?? []).length ? `Kỹ năng: ${c.skills.join(", ")}` : "",
    ...(c.educations ?? []).map((e) => [e.degree, e.fieldOfStudy, e.institution].filter(Boolean).join(" · ")),
    ...(c.certifications ?? []).map((x) => [x.name, x.issuer].filter(Boolean).join(" · ")),
  ];
  return lines.map((l) => String(l ?? "").trim()).filter(Boolean).join("\n");
}

/** Bytes của file CV đã tải lên; không có / không đọc được → null. */
async function readCvFile(cv) {
  const url = String(cv.fileUrl || "");
  if (!url) return null;
  try {
    if (/^https?:\/\//i.test(url)) {
      const res = await fetch(url, { signal: AbortSignal.timeout(REMOTE_FILE_TIMEOUT_MS) });
      if (!res.ok) return null;
      const buf = Buffer.from(await res.arrayBuffer());
      return buf.length && buf.length <= MAX_FILE_BYTES ? buf : null;
    }
    const key = cv.fileKey || url.replace(/^\/?uploads\//, "");
    const local = path.resolve(UPLOAD_ROOT, key);
    if (!local.startsWith(UPLOAD_ROOT + path.sep)) return null; // chặn ../
    const buf = await fs.readFile(local);
    return buf.length <= MAX_FILE_BYTES ? buf : null;
  } catch (err) {
    logger.warn("cv_best_fit_file_unreadable", { cvId: String(cv._id), error: err?.message });
    return null;
  }
}

function jobToJdText(job, company) {
  const competencies = requiredCompetencyRows(job).map((r) => `${r.name} (mức ${r.minLevel}/5)`);
  return [
    `Vị trí: ${job.title}${company?.name ? ` — ${company.name}` : ""}`,
    job.level ? `Cấp độ: ${job.level}` : "",
    job.description || "",
    (job.requiredSkills ?? []).length ? `Kỹ năng yêu cầu: ${job.requiredSkills.join(", ")}` : "",
    competencies.length ? `Năng lực yêu cầu: ${competencies.join(", ")}` : "",
  ].filter(Boolean).join("\n");
}

async function callPython(jdText, items, files) {
  const form = new FormData();
  form.append("jd_text", jdText);
  form.append("items", JSON.stringify(items));
  for (const f of files) form.append("files", new Blob([f.buffer], { type: f.mimeType || "application/octet-stream" }), f.name);

  let res;
  try {
    res = await fetch(`${analyzerUrl()}/best-fit`, { method: "POST", body: form, signal: AbortSignal.timeout(PYTHON_TIMEOUT_MS) });
  } catch (err) {
    logger.error("cv_best_fit_python_unreachable", { error: err?.message });
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
    throw httpError(res.status >= 500 ? 502 : 400, detail || "Dịch vụ phân tích CV không xử lý được yêu cầu.");
  }
  if (!Array.isArray(data?.ranking)) throw httpError(502, "Dịch vụ phân tích CV trả về dữ liệu không hợp lệ.");
  return data;
}

/**
 * @param {string} userId
 * @param {{ cvIds: string[], jdText?: string, jobPostId?: string }} body
 */
export async function bestFitCvs(userId, body) {
  const { value, error } = input.validate(body ?? {}, { stripUnknown: true, convert: true });
  if (error) {
    const key = String(error.details[0]?.path?.[0] ?? "");
    if (key === "cvIds") {
      throw httpError(400, `Chọn từ ${BEST_FIT_LIMITS.minCvs} đến ${BEST_FIT_LIMITS.maxCvs} CV khác nhau trong kho CV.`);
    }
    if (key === "jdText") throw httpError(400, `Mô tả công việc cần từ ${BEST_FIT_LIMITS.minJd} đến ${BEST_FIT_LIMITS.maxJd} ký tự.`);
    throw httpError(400, "Dữ liệu không hợp lệ.");
  }

  let jdText = value.jdText || "";
  let jdSource = { type: "text" };
  if (!jdText) {
    if (!value.jobPostId) throw httpError(400, "Nhập mô tả công việc hoặc chọn một tin tuyển dụng.");
    const found = await findPublicJob(value.jobPostId);
    if (!found) throw httpError(404, "Tin tuyển dụng không tồn tại hoặc đã đóng.");
    jdText = jobToJdText(found.job, found.company);
    jdSource = { type: "job", jobPostId: String(found.job._id), title: found.job.title };
  }

  const cvs = await CVDocument.find({ _id: { $in: value.cvIds.map((id) => new mongoose.Types.ObjectId(id)) }, userId }).lean();
  if (cvs.length !== value.cvIds.length) throw httpError(404, "Không tìm thấy CV hoặc bạn không có quyền truy cập.");
  const byId = new Map(cvs.map((cv) => [String(cv._id), cv]));

  const items = [];
  const files = [];
  for (const id of value.cvIds) {
    const cv = byId.get(id);
    const item = { id, title: cv.title || "" };
    const buffer = await readCvFile(cv);
    if (buffer) {
      item.file_index = files.length;
      files.push({ buffer, name: cv.fileName || "cv.pdf", mimeType: cv.mimeType });
    } else {
      item.text = cvContentText(cv.content);
    }
    items.push(item);
  }

  const data = await callPython(jdText, items, files);
  const ranking = data.ranking.map((r) => ({
    cvId: String(r.id),
    title: byId.get(String(r.id))?.title ?? r.title ?? "",
    rank: r.rank,
    score: r.score ?? null,
    skillScore: r.skill_score ?? null,
    aiScore: r.llm_score ?? null,
    reason: r.reason || "",
    strengths: r.strengths ?? [],
    gaps: r.gaps ?? [],
    matchingSkills: r.matching_skills ?? [],
    missingSkills: r.missing_skills ?? [],
    error: r.error || null,
  }));
  return {
    ranking,
    bestCvId: ranking.find((r) => r.score !== null)?.cvId ?? null,
    mode: data.mode === "llm" ? "ai" : "skills",
    jdSource,
    elapsedMs: data.elapsed_ms ?? null,
  };
}
