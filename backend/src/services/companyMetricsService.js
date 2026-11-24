/**
 * JB-19 (REQ CM-04, C-02, AIS-07): chỉ số theo cặp ứng viên và doanh nghiệp.
 *
 * Quyết định JB-19 (23/11/2026): hệ thống có chỉ số của từng ứng viên với từng doanh nghiệp từ các câu
 * doanh nghiệp ứng viên đã trả lời trong phỏng vấn AI (JB-06) và điểm rubric (JB-07):
 *   - số câu đã trả lời, số câu đã có điểm rubric;
 *   - điểm trung bình từng tiêu chí rubric (theo `criterionKey`) và điểm rubric trung bình;
 *   - ngày gần nhất; danh sách buổi.
 * Ứng viên xem chỉ số của mình (`GET /api/profile/me/company-metrics[/:companyId]`).
 * Doanh nghiệp KHÔNG có API đọc trực tiếp: chỉ xem bản chụp trong đơn ứng tuyển có đồng ý (JB-08, NFR-06,
 * quyết định 14) qua `companyMetricsSnapshot`.
 *
 * Tính từ InterviewSession `completed` mỗi lần gọi (không lưu collection riêng) nên luôn khớp dữ liệu gốc;
 * bản lưu lại là snapshot trong Application. Buổi `in_progress` / `abandoned` không tính.
 * Đọc dữ liệu JB-07 (`rubricScoringService.js`): câu doanh nghiệp = `companyQuestions[].questionId` khớp
 * `questions[i].questionBankId`; "đã trả lời" = transcript không rỗng (JB-07 ghi `rubricScoring.status`
 * `no_answer` khi rỗng); "đã chấm" = `rubricScoring.status === "scored"` và có `rubricScores`.
 */
import mongoose from "mongoose";
import { InterviewSession } from "../models/InterviewSession.js";
import { Company } from "../models/Company.js";
import { httpError } from "../utils/apiErrors.js";

/** Số buổi tối đa đưa vào danh sách buổi của DTO / snapshot. */
export const COMPANY_METRICS_MAX_SESSIONS = 20;

const round1 = (n) => Math.round(n * 10) / 10;
const avg = (xs) => (xs.length ? round1(xs.reduce((a, b) => a + b, 0) / xs.length) : null);
const sameId = (a, b) => a != null && b != null && String(a) === String(b);

/** Trung bình có trọng số các tiêu chí của một câu (0–5, 1 chữ số thập phân); không có thì null. */
export function weightedRubricScore(scores) {
  const rows = (scores ?? []).filter((s) => Number.isFinite(s?.score));
  if (!rows.length) return null;
  const w = (s) => (Number(s.weight) > 0 ? Number(s.weight) : 1);
  const total = rows.reduce((sum, s) => sum + w(s), 0);
  return round1(rows.reduce((sum, s) => sum + s.score * w(s), 0) / total);
}

/**
 * Câu của doanh nghiệp `companyId` trong một buổi: [{ questionIndex, answer }].
 * Ghép `companyQuestions[]` cùng công ty với `questions[i].questionBankId` (cùng cách JB-07 tìm câu).
 */
export function companyQuestionsOfSession(session, companyId) {
  const out = [];
  for (const cq of session.companyQuestions ?? []) {
    if (!sameId(cq.companyId, companyId)) continue;
    const index = (session.questions ?? []).findIndex((q) => sameId(q?.questionBankId, cq.questionId));
    if (index < 0) continue;
    out.push({ questionIndex: index, answer: (session.answers ?? []).find((a) => a.questionIndex === index) ?? null });
  }
  return out;
}

/**
 * Gộp chỉ số từ các buổi (lean) của một ứng viên với một doanh nghiệp. Hàm thuần.
 * @returns {{ questionCount, answeredCount, scoredCount, pendingScoringCount, rubricScoreAvg, lastAnsweredAt,
 *   criteria: object[], sessions: object[], sessionCount }}
 */
export function buildCompanyMetrics(sessions, companyId) {
  const byCriterion = new Map();
  const answerScores = [];
  const sessionRows = [];
  let questionCount = 0;
  let answeredCount = 0;
  let scoredCount = 0;
  let lastAnsweredAt = null;

  for (const s of sessions ?? []) {
    const items = companyQuestionsOfSession(s, companyId);
    if (!items.length) continue;
    const date = s.completedAt ?? s.createdAt ?? null;
    let sAnswered = 0;
    const sScores = [];
    for (const { answer } of items) {
      questionCount += 1;
      if (!String(answer?.transcript ?? "").trim()) continue;
      answeredCount += 1;
      sAnswered += 1;
      const scores = Array.isArray(answer?.rubricScores) ? answer.rubricScores : [];
      if (answer?.rubricScoring?.status !== "scored" || !scores.length) continue;
      scoredCount += 1;
      const score = weightedRubricScore(scores);
      if (Number.isFinite(score)) {
        answerScores.push(score);
        sScores.push(score);
      }
      for (const r of scores) {
        if (!Number.isFinite(r?.score)) continue;
        const key = String(r.criterionKey);
        const row = byCriterion.get(key) ?? {
          criterionKey: key,
          criterionName: r.criterionName || "",
          shrmKey: r.shrmKey || "",
          rubricId: answer.rubricScoring?.rubricId ? String(answer.rubricScoring.rubricId) : "",
          scores: [],
          lastAt: null,
        };
        row.scores.push(r.score);
        if (date && (!row.lastAt || new Date(date) > new Date(row.lastAt))) {
          row.lastAt = date;
          // Tên / năng lực lấy theo lần chấm gần nhất.
          row.criterionName = r.criterionName || row.criterionName;
          row.shrmKey = r.shrmKey || row.shrmKey;
        }
        byCriterion.set(key, row);
      }
    }
    if (sAnswered && date && (!lastAnsweredAt || new Date(date) > new Date(lastAnsweredAt))) lastAnsweredAt = date;
    sessionRows.push({
      sessionId: String(s._id),
      date,
      questionCount: items.length,
      answeredCount: sAnswered,
      rubricScore: avg(sScores),
    });
  }

  sessionRows.sort((a, b) => new Date(b.date ?? 0) - new Date(a.date ?? 0));
  const criteria = [...byCriterion.values()]
    .map((r) => ({
      criterionKey: r.criterionKey,
      criterionName: r.criterionName,
      shrmKey: r.shrmKey,
      rubricId: r.rubricId,
      avgScore: avg(r.scores),
      count: r.scores.length,
    }))
    .sort((a, b) => b.count - a.count || a.criterionName.localeCompare(b.criterionName, "vi"));

  return {
    questionCount,
    answeredCount,
    scoredCount,
    pendingScoringCount: answeredCount - scoredCount,
    rubricScoreAvg: avg(answerScores),
    lastAnsweredAt,
    criteria,
    sessionCount: sessionRows.length,
    sessions: sessionRows.slice(0, COMPANY_METRICS_MAX_SESSIONS),
  };
}

function assertCompanyId(companyId) {
  if (!mongoose.isValidObjectId(companyId)) throw httpError(400, "Mã doanh nghiệp không hợp lệ.");
}

async function completedSessionsWithCompany(userId, companyIds) {
  return InterviewSession.find({
    userId,
    status: "completed",
    "companyQuestions.companyId": { $in: companyIds.map((id) => new mongoose.Types.ObjectId(String(id))) },
  })
    .select("questions.questionBankId companyQuestions answers.questionIndex answers.transcript "
      + "answers.rubricScores answers.rubricScoring completedAt createdAt")
    .sort({ completedAt: -1, createdAt: -1 })
    .lean();
}

const companyDTO = (c) => (c ? { id: String(c._id), name: c.name, slug: c.slug } : null);

/**
 * Chỉ số của ứng viên với một doanh nghiệp (ứng viên tự xem). Chưa trả lời câu nào thì các số bằng 0.
 * @returns {Promise<object>}
 */
export async function candidateCompanyMetrics(userId, companyId) {
  assertCompanyId(companyId);
  const company = await Company.findById(companyId).select("name slug").lean();
  if (!company) throw httpError(404, "Không tìm thấy doanh nghiệp.");
  const sessions = await completedSessionsWithCompany(userId, [companyId]);
  return { company: companyDTO(company), ...buildCompanyMetrics(sessions, companyId), computedAt: new Date() };
}

/** Mọi doanh nghiệp ứng viên đã gặp câu hỏi trong phỏng vấn AI, mới nhất trước (bản tóm tắt). */
export async function listCandidateCompanyMetrics(userId) {
  const companyIds = await InterviewSession.distinct("companyQuestions.companyId", { userId, status: "completed" });
  if (!companyIds.length) return [];
  const [sessions, companies] = await Promise.all([
    completedSessionsWithCompany(userId, companyIds),
    Company.find({ _id: { $in: companyIds } }).select("name slug").lean(),
  ]);
  return companies
    .map((c) => {
      const m = buildCompanyMetrics(sessions, c._id);
      return {
        company: companyDTO(c),
        questionCount: m.questionCount,
        answeredCount: m.answeredCount,
        scoredCount: m.scoredCount,
        rubricScoreAvg: m.rubricScoreAvg,
        lastAnsweredAt: m.lastAnsweredAt,
        sessionCount: m.sessionCount,
      };
    })
    .filter((r) => r.questionCount > 0)
    .sort((a, b) => new Date(b.lastAnsweredAt ?? 0) - new Date(a.lastAnsweredAt ?? 0));
}

/**
 * DTO chụp vào Application lúc ứng tuyển (JB-08). Chỉ gọi khi ứng viên đã đồng ý chia sẻ.
 * Bỏ trường nội bộ, giữ đủ để Company Moderator xem: số câu, điểm từng tiêu chí, ngày gần nhất, buổi.
 */
export async function companyMetricsSnapshot(userId, companyId) {
  const m = await candidateCompanyMetrics(userId, companyId);
  return {
    companyId: m.company.id,
    questionCount: m.questionCount,
    answeredCount: m.answeredCount,
    scoredCount: m.scoredCount,
    rubricScoreAvg: m.rubricScoreAvg,
    lastAnsweredAt: m.lastAnsweredAt,
    criteria: m.criteria,
    sessionCount: m.sessionCount,
    sessions: m.sessions,
    capturedAt: m.computedAt,
  };
}
