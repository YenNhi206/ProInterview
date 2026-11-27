/**
 * JB-08 (C-05, NFR-06) và JB-09 (CM-04): ứng tuyển và Company Moderator xử lý đơn.
 *
 * Ứng viên (role customer):
 *   - `POST /api/jobs/:id/apply` { cvId, consent: true }: job phải đang mở (cùng quy tắc API công khai JB-03:
 *     published, chưa quá hạn, công ty không bị khóa). Thiếu đồng ý → 400. Mỗi job mỗi người 1 đơn → 409.
 *     Chụp snapshot: hồ sơ năng lực (PR-07), CV đã chọn, chỉ số với doanh nghiệp (JB-19).
 *   - `GET /api/applications/me`; `PATCH /api/applications/:id/withdraw` (submitted | viewed → withdrawn,
 *     xóa snapshot; doanh nghiệp chỉ còn thấy tên và "Đã rút", quyết định 14).
 * Company Moderator (`/api/company/applications`, đã qua requireCompanyModerator → `req.companyId`):
 *   - chỉ đọc đơn của công ty mình (đơn công ty khác → 404), chỉ qua đơn có đồng ý; đơn đã rút không có snapshot;
 *   - mở chi tiết đơn `submitted` → tự chuyển `viewed`; `PATCH /:id/status` viewed | shortlisted | rejected.
 * Mọi chuyển trạng thái gửi Notification (`application_submitted`, `application_status_changed`, N-06).
 */
import mongoose from "mongoose";
import {
  Application,
  APPLICATION_COMPANY_STATUSES,
  APPLICATION_CONSENT_SCOPE,
  APPLICATION_CONSENT_VERSION,
  APPLICATION_FINAL_STATUSES,
  APPLICATION_STATUSES,
  APPLICATION_WITHDRAWABLE_STATUSES,
} from "../models/Application.js";
import { CVDocument } from "../models/CVDocument.js";
import { User } from "../models/User.js";
import { JobPost } from "../models/JobPost.js";
import { Company } from "../models/Company.js";
import { findPublicJob } from "./publicJobsService.js";
import { getProfileCompetencies } from "./candidateProfileService.js";
import { companyMetricsSnapshot } from "./companyMetricsService.js";
import { deliverNotification } from "./notificationDeliveryService.js";
import { httpError } from "../utils/apiErrors.js";
import { logger } from "../config/logger.js";
import { resolveStoredUploadUrl } from "../utils/resolveStoredUploadUrl.js";

export const APPLICATION_NOTE_MAX = 1000;
export const COMPANY_APPLICATIONS_PAGE_MAX = 50;

const STATUS_LABEL = {
  submitted: "Đã nộp",
  viewed: "Nhà tuyển dụng đã xem",
  shortlisted: "Vào danh sách chọn",
  rejected: "Chưa phù hợp",
  withdrawn: "Đã rút",
};

function assertId(value, label) {
  if (!mongoose.isValidObjectId(value)) throw httpError(400, `${label} không hợp lệ.`);
}

const toObj = (doc) => (doc?.toObject ? doc.toObject() : doc);

// ---------------------------------------------------------------------------
// Ứng viên (JB-08)
// ---------------------------------------------------------------------------

function cvSnapshot(cv) {
  const content = toObj(cv.content) ?? {};
  return {
    id: String(cv._id),
    title: cv.title || "",
    targetRole: cv.targetRole || "",
    fileName: cv.fileName || "",
    fileUrl: cv.fileUrl || "",
    mimeType: cv.mimeType || "",
    skills: cv.skills ?? [],
    content,
  };
}

/** Đơn phía ứng viên (không trả snapshot đầy đủ; ứng viên xem CV / hồ sơ của mình ở trang riêng). */
function candidateApplicationDTO(app, job, company) {
  return {
    id: String(app._id),
    status: app.status,
    statusLabel: STATUS_LABEL[app.status] ?? app.status,
    canWithdraw: APPLICATION_WITHDRAWABLE_STATUSES.includes(app.status),
    submittedAt: app.submittedAt,
    viewedAt: app.viewedAt ?? null,
    decidedAt: app.decidedAt ?? null,
    withdrawnAt: app.withdrawnAt ?? null,
    updatedAt: app.updatedAt,
    cv: app.snapshot?.cv ? { id: app.snapshot.cv.id, title: app.snapshot.cv.title } : null,
    job: {
      id: String(app.jobPostId),
      title: job?.title || app.jobTitle || "",
      status: job?.status ?? null,
      company: company ? { id: String(company._id), name: company.name, slug: company.slug } : null,
    },
  };
}

async function notifyCompanyModerators(companyId, payload, ctx) {
  const mods = await User.find({ role: "company_moderator", companyId }).select("_id").lean();
  for (const m of mods) {
    await deliverNotification(m._id, payload).catch((err) =>
      logger.warn("application_notify_failed", { ...ctx, error: err?.message }),
    );
  }
}

/**
 * Ứng viên nộp đơn vào job đang mở.
 * @param {string} userId
 * @param {string} jobId
 * @param {{ cvId?: string, consent?: boolean }} body
 */
export async function applyToJob(userId, jobId, body = {}) {
  assertId(jobId, "Mã tin tuyển dụng");
  if (body?.consent !== true) {
    throw httpError(400, "Bạn cần đồng ý chia sẻ hồ sơ, CV và kết quả trả lời câu hỏi của doanh nghiệp để ứng tuyển.");
  }
  const cvId = String(body?.cvId ?? "").trim();
  if (!cvId) throw httpError(400, "Chọn một CV để ứng tuyển.");
  assertId(cvId, "Mã CV");

  const found = await findPublicJob(jobId);
  if (!found) throw httpError(404, "Không tìm thấy tin tuyển dụng đang mở.");
  const { job, company } = found;

  if (await Application.exists({ jobPostId: job._id, candidateId: userId })) {
    throw httpError(409, "Bạn đã ứng tuyển tin này rồi.");
  }
  const cv = await CVDocument.findOne({ _id: cvId, userId }).lean();
  if (!cv) throw httpError(404, "Không tìm thấy CV của bạn.");
  if (cv.isValidCv === false) {
    throw httpError(400, "CV này chưa hợp lệ (không giống một CV). Chọn CV khác hoặc chỉnh sửa trước khi ứng tuyển.");
  }

  const user = await User.findById(userId).select("name email").lean();
  const [{ snapshot: profile }, companyMetrics] = await Promise.all([
    getProfileCompetencies(userId),
    companyMetricsSnapshot(userId, job.companyId),
  ]);
  const now = new Date();
  let app;
  try {
    app = await Application.create({
      jobPostId: job._id,
      companyId: job.companyId,
      candidateId: userId,
      cvId: cv._id,
      candidateName: user?.name || "",
      jobTitle: job.title || "",
      consent: { given: true, at: now, scope: [...APPLICATION_CONSENT_SCOPE], version: APPLICATION_CONSENT_VERSION },
      snapshot: {
        candidate: { name: user?.name || "", email: user?.email || "" },
        profile,
        cv: cvSnapshot(cv),
        companyMetrics,
        capturedAt: now,
      },
      status: "submitted",
      history: [{ status: "submitted", at: now, by: userId }],
      submittedAt: now,
    });
  } catch (error) {
    // Bấm nộp 2 lần cùng lúc: unique {jobPostId, candidateId} chặn đơn thứ hai.
    if (error?.code === 11000) throw httpError(409, "Bạn đã ứng tuyển tin này rồi.");
    throw error;
  }

  await notifyCompanyModerators(job.companyId, {
    type: "application_submitted",
    title: "Có đơn ứng tuyển mới",
    body: `${user?.name || "Một ứng viên"} vừa ứng tuyển "${job.title}".`,
    metadata: { applicationId: app._id, jobPostId: job._id, companyId: job.companyId, actionUrl: `/company/applications/${app._id}` },
  }, { applicationId: String(app._id) });

  return candidateApplicationDTO(app.toObject(), job, company);
}

/** Đơn của ứng viên, mới nhất trước. */
export async function listMyApplications(userId) {
  const apps = await Application.find({ candidateId: userId })
    .select("-snapshot.profile -snapshot.companyMetrics -snapshot.cv.content")
    .sort({ submittedAt: -1 })
    .lean();
  if (!apps.length) return [];
  const [jobs, companies] = await Promise.all([
    JobPost.find({ _id: { $in: apps.map((a) => a.jobPostId) } }).select("title status").lean(),
    Company.find({ _id: { $in: apps.map((a) => a.companyId) } }).select("name slug").lean(),
  ]);
  const jobById = new Map(jobs.map((j) => [String(j._id), j]));
  const companyById = new Map(companies.map((c) => [String(c._id), c]));
  return apps.map((a) => candidateApplicationDTO(a, jobById.get(String(a.jobPostId)), companyById.get(String(a.companyId))));
}

/** Ứng viên rút đơn: submitted | viewed → withdrawn, xóa snapshot (quyết định 14). */
export async function withdrawApplication(userId, appId) {
  assertId(appId, "Mã đơn ứng tuyển");
  const now = new Date();
  const updated = await Application.findOneAndUpdate(
    { _id: appId, candidateId: userId, status: { $in: APPLICATION_WITHDRAWABLE_STATUSES } },
    {
      $set: { status: "withdrawn", withdrawnAt: now, snapshot: null },
      $push: { history: { status: "withdrawn", at: now, by: userId } },
    },
    { returnDocument: "after" },
  ).lean();
  if (!updated) {
    const current = await Application.findOne({ _id: appId, candidateId: userId }).select("status").lean();
    if (!current) throw httpError(404, "Không tìm thấy đơn ứng tuyển.");
    throw httpError(409, current.status === "withdrawn"
      ? "Bạn đã rút đơn này."
      : "Nhà tuyển dụng đã xử lý đơn này nên không rút được.");
  }
  await notifyCompanyModerators(updated.companyId, {
    type: "application_status_changed",
    title: "Ứng viên đã rút đơn",
    body: `${updated.candidateName || "Ứng viên"} đã rút đơn ứng tuyển "${updated.jobTitle}".`,
    metadata: { applicationId: updated._id, jobPostId: updated.jobPostId, companyId: updated.companyId, actionUrl: "/company/applications" },
  }, { applicationId: String(updated._id) });

  const [job, company] = await Promise.all([
    JobPost.findById(updated.jobPostId).select("title status").lean(),
    Company.findById(updated.companyId).select("name slug").lean(),
  ]);
  return candidateApplicationDTO(updated, job, company);
}

// ---------------------------------------------------------------------------
// Company Moderator (JB-09)
// ---------------------------------------------------------------------------

/** Điều kiện chung: đơn của công ty, có đồng ý (NFR-06). */
const companyScope = (companyId) => ({ companyId: new mongoose.Types.ObjectId(String(companyId)), "consent.given": true });

/** Đơn đã rút: chỉ tên và "Đã rút" (quyết định 14). */
function withdrawnDTO(app) {
  return {
    id: String(app._id),
    jobPostId: String(app.jobPostId),
    jobTitle: app.jobTitle || "",
    candidateName: app.candidateName || "",
    status: "withdrawn",
    statusLabel: STATUS_LABEL.withdrawn,
    submittedAt: app.submittedAt,
    withdrawnAt: app.withdrawnAt ?? null,
  };
}

function companyListItemDTO(app) {
  if (app.status === "withdrawn") return withdrawnDTO(app);
  const s = app.snapshot ?? {};
  return {
    id: String(app._id),
    jobPostId: String(app.jobPostId),
    jobTitle: app.jobTitle || "",
    candidate: { name: s.candidate?.name || app.candidateName || "", email: s.candidate?.email || "" },
    cv: s.cv ? { id: s.cv.id, title: s.cv.title } : null,
    competencyCount: s.profile?.competencies?.length ?? 0,
    isVerified: Boolean(s.profile?.isVerified),
    companyMetrics: s.companyMetrics
      ? {
        answeredCount: s.companyMetrics.answeredCount ?? 0,
        scoredCount: s.companyMetrics.scoredCount ?? 0,
        rubricScoreAvg: s.companyMetrics.rubricScoreAvg ?? null,
      }
      : null,
    status: app.status,
    statusLabel: STATUS_LABEL[app.status] ?? app.status,
    submittedAt: app.submittedAt,
    viewedAt: app.viewedAt ?? null,
    decidedAt: app.decidedAt ?? null,
  };
}

/** Đường dẫn file CV trong snapshot: `/uploads/...` (lưu đĩa) đổi sang URL mở được từ trình duyệt công ty. */
function snapshotWithFileUrl(snapshot) {
  if (!snapshot?.cv?.fileUrl) return snapshot ?? null;
  return { ...snapshot, cv: { ...snapshot.cv, fileUrl: resolveStoredUploadUrl(snapshot.cv.fileUrl) } };
}

function companyDetailDTO(app) {
  if (app.status === "withdrawn") return withdrawnDTO(app);
  return {
    ...companyListItemDTO(app),
    consent: { at: app.consent?.at ?? null, scope: app.consent?.scope ?? [], version: app.consent?.version ?? "" },
    snapshot: snapshotWithFileUrl(app.snapshot),
    history: (app.history ?? []).map((h) => ({ status: h.status, at: h.at, note: h.note || "" })),
  };
}

/**
 * Danh sách đơn của công ty. Lọc `status`, `jobPostId`; phân trang `page`, `limit` (≤ 50); kèm `counts` theo trạng thái.
 */
export async function listCompanyApplications(companyId, query = {}) {
  const filter = { ...companyScope(companyId) };
  if (query.status) {
    if (!APPLICATION_STATUSES.includes(query.status)) throw httpError(400, "Trạng thái đơn không hợp lệ.");
    filter.status = query.status;
  }
  if (query.jobPostId) {
    assertId(query.jobPostId, "Mã tin tuyển dụng");
    filter.jobPostId = new mongoose.Types.ObjectId(String(query.jobPostId));
  }
  const limit = Math.min(Math.max(Number.parseInt(query.limit, 10) || 20, 1), COMPANY_APPLICATIONS_PAGE_MAX);
  const page = Math.max(Number.parseInt(query.page, 10) || 1, 1);
  const countFilter = { ...companyScope(companyId), ...(filter.jobPostId ? { jobPostId: filter.jobPostId } : {}) };
  const [rows, total, grouped] = await Promise.all([
    Application.find(filter)
      .select("-snapshot.cv.content -snapshot.profile.competencies -snapshot.companyMetrics.criteria -snapshot.companyMetrics.sessions -snapshot.companyMetrics.answers -history")
      .sort({ submittedAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    Application.countDocuments(filter),
    Application.aggregate([{ $match: countFilter }, { $group: { _id: "$status", n: { $sum: 1 } } }]),
  ]);
  const counts = Object.fromEntries(APPLICATION_STATUSES.map((s) => [s, 0]));
  for (const g of grouped) counts[g._id] = g.n;
  return {
    applications: rows.map(companyListItemDTO),
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    counts,
  };
}

async function notifyCandidate(app, status, note) {
  const titles = {
    viewed: "Nhà tuyển dụng đã xem hồ sơ của bạn",
    shortlisted: "Bạn được chọn vào vòng tiếp theo",
    rejected: "Kết quả ứng tuyển",
  };
  const bodies = {
    viewed: `Đơn ứng tuyển "${app.jobTitle}" đã được nhà tuyển dụng xem.`,
    shortlisted: `Chúc mừng! Đơn "${app.jobTitle}" đã vào danh sách chọn. Nhà tuyển dụng sẽ liên hệ với bạn.`,
    rejected: `Đơn "${app.jobTitle}" chưa phù hợp với nhà tuyển dụng lần này.${note ? ` Ghi chú: ${note}` : ""}`,
  };
  await deliverNotification(app.candidateId, {
    type: "application_status_changed",
    title: titles[status],
    body: bodies[status],
    metadata: { applicationId: app._id, jobPostId: app.jobPostId, companyId: app.companyId, actionUrl: "/my-applications" },
  }).catch((err) => logger.warn("application_notify_failed", { applicationId: String(app._id), error: err?.message }));
}

/**
 * Chuyển trạng thái có điều kiện (chỉ từ `from`), ghi history, gửi thông báo cho ứng viên.
 * @returns {Promise<object|null>} đơn sau khi đổi, null nếu trạng thái đã khác `from`
 */
async function transition(companyId, appId, { from, to, by, note = "" }) {
  const now = new Date();
  const set = { status: to };
  if (to === "viewed") set.viewedAt = now;
  if (to === "shortlisted" || to === "rejected") set.decidedAt = now;
  const updated = await Application.findOneAndUpdate(
    { _id: appId, ...companyScope(companyId), status: { $in: from } },
    { $set: set, $push: { history: { status: to, at: now, by, note } } },
    { returnDocument: "after" },
  ).lean();
  if (updated) {
    // Mở thẳng shortlisted / rejected từ submitted: vẫn ghi mốc đã xem.
    if (to !== "viewed" && !updated.viewedAt) {
      await Application.updateOne({ _id: updated._id, viewedAt: null }, { $set: { viewedAt: now } });
      updated.viewedAt = now;
    }
    await notifyCandidate(updated, to, note);
  }
  return updated;
}

/** Chi tiết đơn (đơn công ty khác → 404). Đơn `submitted` mở lần đầu → `viewed`. */
export async function getCompanyApplication(companyId, userId, appId) {
  assertId(appId, "Mã đơn ứng tuyển");
  let app = await Application.findOne({ _id: appId, ...companyScope(companyId) }).lean();
  if (!app) throw httpError(404, "Không tìm thấy đơn ứng tuyển.");
  if (app.status === "submitted") {
    app = (await transition(companyId, app._id, { from: ["submitted"], to: "viewed", by: userId }))
      ?? (await Application.findById(app._id).lean());
  }
  return companyDetailDTO(app);
}

/**
 * Company Moderator đổi trạng thái: viewed | shortlisted | rejected.
 * Đơn đã shortlisted / rejected / withdrawn không đổi được (409).
 */
export async function changeCompanyApplicationStatus(companyId, userId, appId, body = {}) {
  assertId(appId, "Mã đơn ứng tuyển");
  const status = String(body?.status ?? "");
  if (!APPLICATION_COMPANY_STATUSES.includes(status)) {
    throw httpError(400, "Trạng thái phải là viewed, shortlisted hoặc rejected.");
  }
  const note = typeof body?.note === "string" ? body.note.trim().slice(0, APPLICATION_NOTE_MAX) : "";
  const current = await Application.findOne({ _id: appId, ...companyScope(companyId) }).select("status").lean();
  if (!current) throw httpError(404, "Không tìm thấy đơn ứng tuyển.");
  if (APPLICATION_FINAL_STATUSES.includes(current.status)) {
    throw httpError(409, current.status === "withdrawn"
      ? "Ứng viên đã rút đơn này."
      : `Đơn đã ở trạng thái "${STATUS_LABEL[current.status]}", không đổi được nữa.`);
  }
  if (current.status === status) return companyDetailDTO(await Application.findById(appId).lean());
  if (status === "viewed" && current.status !== "submitted") throw httpError(409, "Đơn đã được xem.");

  const from = status === "viewed" ? ["submitted"] : ["submitted", "viewed"];
  const updated = await transition(companyId, appId, { from, to: status, by: userId, note });
  if (!updated) throw httpError(409, "Đơn vừa đổi trạng thái (ứng viên rút đơn hoặc người khác đã xử lý). Vui lòng tải lại.");
  return companyDetailDTO(updated);
}
