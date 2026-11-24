/**
 * JB-19 (CM-04, C-02, AIS-07): chỉ số theo cặp ứng viên và doanh nghiệp.
 * Xong khi: chỉ số khớp truy vấn tay trên dữ liệu test; doanh nghiệp không đọc được chỉ số khi chưa có đơn
 * kèm đồng ý (không có API cho company_moderator; đọc qua đơn ở JB-08/JB-09/JB-10); test.
 */
import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import {
  applyTestEnv, startMongoHarness, stopMongoHarness, mintAccessToken, startHttpServer, stopHttpServer,
} from "../test_helpers/mongoTestHarness.js";

applyTestEnv();
process.env.MAIL_USER = "";
process.env.MAIL_PASS = "";

let harness, http, User, InterviewSession, Company;
let candidate, otherCandidate, moderator, companyA, companyB;

const ANSWER = "Em gom log hai tuần, tìm ra nguyên nhân và thêm khóa idempotency cho mỗi đơn thanh toán.";
const oid = () => new mongoose.Types.ObjectId();

/** Một câu doanh nghiệp đã chấm theo model JB-07: [criterionKey, score, weight][]. */
function scoredAnswer(index, rows, transcript = ANSWER) {
  return {
    questionIndex: index,
    transcript,
    rubricScores: rows.map(([key, score, weight]) => ({
      criterionKey: key, criterionName: `Tiêu chí ${key}`, shrmKey: "problem_solving", weight, score, evidenceQuote: "",
    })),
    rubricScoring: { status: "scored", scoredAt: new Date() },
  };
}

async function sessionWith({ user, status = "completed", completedAt, items }) {
  // items: [{ company, answer }] — mỗi item là một câu doanh nghiệp sau 1 câu baseline.
  const questions = [{ id: "b1", question: "Giới thiệu", source: "baseline" }];
  const companyQuestions = [];
  const answers = [{ questionIndex: 0, transcript: "Em là kỹ sư backend ba năm kinh nghiệm." }];
  items.forEach((it, i) => {
    const qid = oid();
    questions.push({ id: `company${i + 1}`, question: `Câu DN ${i + 1}`, source: "company", questionBankId: qid });
    companyQuestions.push({ questionId: qid, companyId: it.company._id, rubricId: oid() });
    if (it.answer) answers.push({ ...it.answer, questionIndex: i + 1 });
  });
  return InterviewSession.create({ userId: user._id, hrGender: "male", status, completedAt, questions, companyQuestions, answers });
}

const get = (user, path) =>
  fetch(`${http.baseUrl}/api/profile${path}`, { headers: { Authorization: `Bearer ${mintAccessToken(user._id)}` } })
    .then(async (res) => ({ status: res.status, body: await res.json() }));

before(async () => {
  harness = await startMongoHarness();
  ({ User } = await import("../models/User.js"));
  ({ InterviewSession } = await import("../models/InterviewSession.js"));
  ({ Company } = await import("../models/Company.js"));
  http = await startHttpServer((await import("../app.js")).createApp());

  candidate = await User.create({ name: "Ứng viên", email: "jb19-cand@test.local", role: "customer" });
  otherCandidate = await User.create({ name: "Người khác", email: "jb19-other@test.local", role: "customer" });
  companyA = await Company.create({ name: "Công ty A", slug: "jb19-cong-ty-a" });
  companyB = await Company.create({ name: "Công ty B", slug: "jb19-cong-ty-b" });
  moderator = await User.create({ name: "HR A", email: "jb19-hr@test.local", role: "company_moderator", companyId: companyA._id });

  // Buổi 1 (20/11): 2 câu của A — câu 1 chấm (c1=4 w60, c2=2 w40 → 3.2), câu 2 bỏ trống (JB-07: no_answer).
  await sessionWith({ user: candidate, completedAt: new Date("2026-11-20T03:00:00Z"), items: [
    { company: companyA, answer: scoredAnswer(0, [["c1", 4, 60], ["c2", 2, 40]]) },
    { company: companyA, answer: { transcript: "", rubricScoring: { status: "no_answer", scoredAt: new Date() } } },
  ] });
  // Buổi 2 (22/11): 1 câu của A chấm (c1=5 w60, c2=3 w40 → 4.2) + 1 câu của B chấm (c9=1).
  await sessionWith({ user: candidate, completedAt: new Date("2026-11-22T03:00:00Z"), items: [
    { company: companyA, answer: scoredAnswer(0, [["c1", 5, 60], ["c2", 3, 40]]) },
    { company: companyB, answer: scoredAnswer(0, [["c9", 1, 100]]) },
  ] });
  // Buổi 3 (23/11): câu của A đã trả lời nhưng chưa có điểm rubric (JB-07 lỗi) → đếm đã trả lời, chưa chấm.
  await sessionWith({ user: candidate, completedAt: new Date("2026-11-23T03:00:00Z"), items: [
    { company: companyA, answer: { transcript: ANSWER, rubricScoring: { status: "failed", error: "LLM lỗi" } } },
  ] });
  // Không tính: buổi đang làm, buổi bỏ dở, buổi của người khác.
  await sessionWith({ user: candidate, status: "in_progress", items: [{ company: companyA, answer: scoredAnswer(0, [["c1", 0, 60]]) }] });
  await sessionWith({ user: candidate, status: "abandoned", items: [{ company: companyA, answer: scoredAnswer(0, [["c1", 0, 60]]) }] });
  await sessionWith({ user: otherCandidate, completedAt: new Date("2026-11-24T03:00:00Z"), items: [
    { company: companyA, answer: scoredAnswer(0, [["c1", 0, 60]]) },
  ] });
});

after(async () => {
  if (http?.server) await stopHttpServer(http.server);
  if (harness) await stopMongoHarness(harness);
});

describe("JB-19 chỉ số ứng viên – doanh nghiệp", () => {
  it("khớp số tính tay: số câu, đã trả lời, đã chấm, trung bình từng tiêu chí, ngày gần nhất, danh sách buổi", async () => {
    const res = await get(candidate, `/me/company-metrics/${companyA._id}`);
    assert.equal(res.status, 200, res.body.error);
    const m = res.body.metrics;
    assert.deepEqual(m.company, { id: String(companyA._id), name: "Công ty A", slug: "jb19-cong-ty-a" });
    assert.equal(m.questionCount, 4);       // 2 + 1 + 1 (không tính buổi in_progress / abandoned)
    assert.equal(m.answeredCount, 3);       // câu bỏ trống không tính
    assert.equal(m.scoredCount, 2);
    assert.equal(m.pendingScoringCount, 1);
    assert.equal(m.rubricScoreAvg, 3.7);    // (3.2 + 4.2) / 2
    assert.deepEqual(m.criteria.map((c) => [c.criterionKey, c.avgScore, c.count]), [["c1", 4.5, 2], ["c2", 2.5, 2]]);
    assert.equal(new Date(m.lastAnsweredAt).toISOString(), "2026-11-23T03:00:00.000Z");
    assert.equal(m.sessionCount, 3);
    assert.deepEqual(m.sessions.map((s) => [s.date.slice(0, 10), s.questionCount, s.answeredCount, s.rubricScore]), [
      ["2026-11-23", 1, 1, null],
      ["2026-11-22", 1, 1, 4.2],
      ["2026-11-20", 2, 1, 3.2],
    ]);
  });

  it("đối chiếu với truy vấn tay trực tiếp trên DB", async () => {
    const sessions = await InterviewSession.find({ userId: candidate._id, status: "completed", "companyQuestions.companyId": companyA._id }).lean();
    const manual = [];
    for (const s of sessions) {
      const ids = new Set(s.companyQuestions.filter((c) => String(c.companyId) === String(companyA._id)).map((c) => String(c.questionId)));
      s.questions.forEach((q, i) => {
        if (q.source === "company" && ids.has(String(q.questionBankId))) {
          const a = s.answers.find((x) => x.questionIndex === i);
          for (const r of a?.rubricScores ?? []) if (r.criterionKey === "c1") manual.push(r.score);
        }
      });
    }
    const m = (await get(candidate, `/me/company-metrics/${companyA._id}`)).body.metrics;
    assert.equal(m.criteria.find((c) => c.criterionKey === "c1").avgScore, manual.reduce((a, b) => a + b, 0) / manual.length);
  });

  it("chỉ số với doanh nghiệp khác tách riêng; danh sách các doanh nghiệp, mới nhất trước", async () => {
    const b = (await get(candidate, `/me/company-metrics/${companyB._id}`)).body.metrics;
    assert.equal(b.answeredCount, 1);
    assert.deepEqual(b.criteria.map((c) => [c.criterionKey, c.avgScore]), [["c9", 1]]);

    const list = await get(candidate, "/me/company-metrics");
    assert.equal(list.status, 200);
    assert.deepEqual(list.body.companies.map((c) => [c.company.name, c.answeredCount, c.scoredCount]), [["Công ty A", 3, 2], ["Công ty B", 1, 1]]);
  });

  it("chưa trả lời câu nào của doanh nghiệp: số bằng 0, không lỗi", async () => {
    const fresh = await User.create({ name: "Mới", email: "jb19-new@test.local", role: "customer" });
    const res = await get(fresh, `/me/company-metrics/${companyA._id}`);
    assert.equal(res.status, 200);
    assert.equal(res.body.metrics.answeredCount, 0);
    assert.equal(res.body.metrics.rubricScoreAvg, null);
    assert.deepEqual(res.body.metrics.sessions, []);
    assert.deepEqual((await get(fresh, "/me/company-metrics")).body.companies, []);
  });

  it("chỉ thấy dữ liệu của chính mình: ứng viên khác không thấy buổi của ứng viên này", async () => {
    const m = (await get(otherCandidate, `/me/company-metrics/${companyA._id}`)).body.metrics;
    assert.equal(m.questionCount, 1);
    assert.equal(m.criteria[0].avgScore, 0);
  });

  it("Company Moderator không đọc được chỉ số qua API này (403); không có API company cho chỉ số", async () => {
    assert.equal((await get(moderator, `/me/company-metrics/${companyA._id}`)).status, 403);
    assert.equal((await get(moderator, "/me/company-metrics")).status, 403);
    const res = await fetch(`${http.baseUrl}/api/company/candidates/${candidate._id}/metrics`, {
      headers: { Authorization: `Bearer ${mintAccessToken(moderator._id)}` },
    });
    assert.equal(res.status, 404);
  });

  it("mã doanh nghiệp sai → 400, không tồn tại → 404, chưa đăng nhập → 401", async () => {
    assert.equal((await get(candidate, "/me/company-metrics/khong-hop-le")).status, 400);
    assert.equal((await get(candidate, `/me/company-metrics/${oid()}`)).status, 404);
    assert.equal((await fetch(`${http.baseUrl}/api/profile/me/company-metrics`)).status, 401);
  });
});
